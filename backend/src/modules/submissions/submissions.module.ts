import {
  BadRequestException, Body, Controller, ForbiddenException, Get, Injectable, Module,
  NotFoundException, Param, ParseIntPipe, Patch, Post, Query, UploadedFiles, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Column, CreateDateColumn, DataSource, Entity, In, PrimaryGeneratedColumn, Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../common/roles.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { attachmentFileFilter, attachmentFileName, maxAttachmentSize } from '../../common/attachment-upload.util';
import { ensureUploadDir } from '../../common/upload-dir.util';

const submissionUpload = AnyFilesInterceptor({
  storage: diskStorage({
    destination: (_req, _file, callback) => callback(null, ensureUploadDir('submissions')),
    filename: (_req, file, callback) => callback(null, attachmentFileName('submission', file.originalname)),
  }),
  limits: { fileSize: maxAttachmentSize, files: 5 },
  fileFilter: attachmentFileFilter,
});

@Entity('submissions')
export class Submission {
  @PrimaryGeneratedColumn() id: number;
  @Column({ name: 'assignment_id' }) assignmentId: number;
  @Column({ name: 'student_id' }) studentId: number;
  @Column({ name: 'group_id', nullable: true }) groupId: number;
  @Column({ name: 'file_url', type: 'text', nullable: true }) fileUrl: string;
  @Column({ name: 'file_name', nullable: true }) fileName: string;
  @Column({ name: 'content_text', type: 'text', nullable: true }) contentText: string;
  @CreateDateColumn({ name: 'submitted_at' }) submittedAt: Date;
  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true }) score: number;
  @Column({ name: 'teacher_comment', type: 'text', nullable: true }) teacherComment: string;
  @Column({ default: 'SUBMITTED' }) status: string;
  @Column({ name: 'graded_at', type: 'timestamp', nullable: true }) gradedAt: Date;
  @Column({ name: 'graded_by', nullable: true }) gradedBy: number;
  attachments?: SubmissionAttachment[];
  rubricScores?: SubmissionRubricScore[];
  versionCount?: number;
}

@Entity('submission_attachments')
export class SubmissionAttachment {
  @PrimaryGeneratedColumn() id: number;
  @Column({ name: 'submission_id' }) submissionId: number;
  @Column({ name: 'file_url', type: 'text' }) fileUrl: string;
  @Column({ name: 'file_name' }) fileName: string;
  @Column({ name: 'mime_type', nullable: true }) mimeType: string;
  @Column({ name: 'file_size', nullable: true }) fileSize: number;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Entity('submission_versions')
export class SubmissionVersion {
  @PrimaryGeneratedColumn() id: number;
  @Column({ name: 'submission_id' }) submissionId: number;
  @Column({ name: 'version_no' }) versionNo: number;
  @Column({ name: 'submitted_by', nullable: true }) submittedBy: number;
  @Column({ name: 'group_id', nullable: true }) groupId: number;
  @Column({ name: 'content_text', type: 'text', nullable: true }) contentText: string;
  @Column({ type: 'jsonb', default: [] }) attachments: any[];
  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true }) score: number;
  @Column({ name: 'teacher_comment', type: 'text', nullable: true }) teacherComment: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Entity('submission_rubric_scores')
export class SubmissionRubricScore {
  @PrimaryGeneratedColumn() id: number;
  @Column({ name: 'submission_id' }) submissionId: number;
  @Column({ name: 'rubric_id' }) rubricId: number;
  @Column({ type: 'numeric', precision: 5, scale: 2 }) score: number;
  @Column({ type: 'text', nullable: true }) feedback: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @Column({ name: 'updated_at', type: 'timestamp' }) updatedAt: Date;
  criterion?: string;
  description?: string;
  maxPoints?: number;
}

@Entity('submission_annotations')
export class SubmissionAnnotation {
  @PrimaryGeneratedColumn() id: number;
  @Column({ name: 'submission_id' }) submissionId: number;
  @Column({ name: 'attachment_id', nullable: true }) attachmentId: number;
  @Column({ name: 'author_id' }) authorId: number;
  @Column({ name: 'page_no', nullable: true }) pageNo: number;
  @Column({ name: 'position_x', type: 'numeric', precision: 7, scale: 4, nullable: true }) positionX: number;
  @Column({ name: 'position_y', type: 'numeric', precision: 7, scale: 4, nullable: true }) positionY: number;
  @Column({ type: 'text' }) content: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Injectable()
export class SubmissionsService {
  constructor(
    @InjectRepository(Submission) private readonly repo: Repository<Submission>,
    @InjectRepository(SubmissionAttachment) private readonly attachmentRepo: Repository<SubmissionAttachment>,
    @InjectRepository(SubmissionVersion) private readonly versionRepo: Repository<SubmissionVersion>,
    @InjectRepository(SubmissionRubricScore) private readonly rubricScoreRepo: Repository<SubmissionRubricScore>,
    @InjectRepository(SubmissionAnnotation) private readonly annotationRepo: Repository<SubmissionAnnotation>,
    private readonly dataSource: DataSource,
  ) {}

  private parseJson(value: any, fallback: any) {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value !== 'string') return value;
    try { return JSON.parse(value); } catch { throw new BadRequestException('Dữ liệu không hợp lệ'); }
  }

  private async assignmentContext(assignmentId: number) {
    const rows = await this.dataSource.query(
      `SELECT a.id, a.class_id as "classId", a.due_date as "dueDate", a.max_score as "maxScore",
              a.submission_type as "submissionType", a.allow_late_submission as "allowLateSubmission",
              a.is_group_assignment as "isGroupAssignment", c.teacher_id as "teacherId"
       FROM assignments a JOIN classes c ON c.id = a.class_id
       WHERE a.id = $1 AND c.is_active = true`,
      [assignmentId],
    );
    if (!rows[0]) throw new NotFoundException('Không tìm thấy bài tập');
    return rows[0];
  }

  private async ensureManager(user: any, classId: number) {
    if (user.role === 'ADMIN') return;
    if (user.role !== 'TEACHER') throw new ForbiddenException('Bạn không có quyền quản lý bài nộp');
    const rows = await this.dataSource.query(`SELECT 1 FROM classes WHERE id = $1 AND teacher_id = $2 AND is_active = true`, [classId, user.id]);
    if (!rows[0]) throw new ForbiddenException('Bạn không có quyền quản lý bài nộp của lớp này');
  }

  private async studentGroup(assignmentId: number, studentId: number) {
    const rows = await this.dataSource.query(
      `SELECT g.id, g.name FROM assignment_groups g
       JOIN assignment_group_members gm ON gm.group_id = g.id
       WHERE g.assignment_id = $1 AND gm.student_id = $2`,
      [assignmentId, studentId],
    );
    return rows[0] || null;
  }

  private async ensureStudentCanSubmit(user: any, assignment: any) {
    if (user.role !== 'STUDENT') throw new ForbiddenException('Chỉ học viên mới có thể nộp bài');
    const enrolled = await this.dataSource.query(`SELECT 1 FROM enrollments WHERE class_id = $1 AND student_id = $2 AND is_active = true`, [assignment.classId, user.id]);
    if (!enrolled[0]) throw new ForbiddenException('Bạn không thuộc lớp học của bài tập này');
    if (!assignment.allowLateSubmission && new Date() > new Date(assignment.dueDate)) throw new BadRequestException('Bài tập đã quá hạn nộp');
    const group = assignment.isGroupAssignment ? await this.studentGroup(assignment.id, user.id) : null;
    if (assignment.isGroupAssignment && !group) throw new BadRequestException('Giáo viên chưa phân nhóm cho bạn');
    return group;
  }

  private async ensureCanViewSubmission(submissionId: number, user: any) {
    const rows = await this.dataSource.query(
      `SELECT s.id, s.student_id as "studentId", s.group_id as "groupId", a.class_id as "classId"
       FROM submissions s JOIN assignments a ON a.id = s.assignment_id WHERE s.id = $1`, [submissionId],
    );
    if (!rows[0]) throw new NotFoundException('Không tìm thấy bài nộp');
    const submission = rows[0];
    if (user.role === 'ADMIN') return submission;
    if (user.role === 'TEACHER') { await this.ensureManager(user, submission.classId); return submission; }
    if (submission.studentId === user.id) return submission;
    if (submission.groupId) {
      const group = await this.dataSource.query(`SELECT 1 FROM assignment_group_members WHERE group_id = $1 AND student_id = $2`, [submission.groupId, user.id]);
      if (group[0]) return submission;
    }
    throw new ForbiddenException('Bạn không có quyền xem bài nộp này');
  }

  private async withDetails<T extends Record<string, any>>(rows: T[]) {
    if (!rows.length) return rows;
    const ids = rows.map(row => Number(row.id ?? row.submissionId)).filter(Number.isInteger);
    const [attachments, rubricRows, versions] = await Promise.all([
      ids.length ? this.attachmentRepo.find({ where: { submissionId: In(ids) }, order: { createdAt: 'ASC' } }) : [],
      ids.length ? this.dataSource.query(
        `SELECT srs.*, ar.criterion, ar.description, ar.max_points as "maxPoints"
         FROM submission_rubric_scores srs JOIN assignment_rubrics ar ON ar.id = srs.rubric_id
         WHERE srs.submission_id = ANY($1::int[]) ORDER BY ar.display_order, ar.id`, [ids],
      ) : [],
      ids.length ? this.dataSource.query(`SELECT submission_id as "submissionId", COUNT(*)::int as count FROM submission_versions WHERE submission_id = ANY($1::int[]) GROUP BY submission_id`, [ids]) : [],
    ]);
    const attachmentMap = new Map<number, SubmissionAttachment[]>();
    const rubricMap = new Map<number, any[]>();
    const versionMap = new Map<number, number>();
    attachments.forEach(item => attachmentMap.set(item.submissionId, [...(attachmentMap.get(item.submissionId) || []), item]));
    rubricRows.forEach(item => rubricMap.set(Number(item.submission_id), [...(rubricMap.get(Number(item.submission_id)) || []), item]));
    versions.forEach(item => versionMap.set(Number(item.submissionId), Number(item.count)));
    return rows.map(row => {
      const submissionId = Number(row.id ?? row.submissionId);
      const directUrl = row.fileUrl ?? row.file_url;
      const directName = row.fileName ?? row.file_name;
      const legacy = directUrl ? [{ id: `legacy-${submissionId}`, fileUrl: directUrl, fileName: directName || String(directUrl).split('/').pop() }] : [];
      return { ...row, attachments: attachmentMap.get(submissionId)?.length ? attachmentMap.get(submissionId) : legacy, rubricScores: rubricMap.get(submissionId) || [], versionCount: versionMap.get(submissionId) || 0 };
    });
  }

  async findByAssignment(assignmentId: number, user: any) {
    const assignment = await this.assignmentContext(assignmentId);
    await this.ensureManager(user, assignment.classId);
    const rows = await this.dataSource.query(
      `SELECT s.*, u.full_name as "studentName", u.avatar_url as "studentAvatar", g.name as "groupName"
       FROM submissions s JOIN users u ON u.id = s.student_id
       LEFT JOIN assignment_groups g ON g.id = s.group_id
       WHERE s.assignment_id = $1 ORDER BY g.name NULLS LAST, u.full_name`, [assignmentId],
    );
    return this.withDetails(rows);
  }

  async findByStudent(studentId: number, classId: number | undefined, user: any) {
    if (user.role === 'STUDENT' && studentId !== user.id) throw new ForbiddenException('Bạn chỉ có thể xem bài nộp của mình');
    if (user.role === 'TEACHER') { if (!classId) throw new BadRequestException('Cần chọn lớp học'); await this.ensureManager(user, classId); }
    let sql = `SELECT DISTINCT ON (s.id) s.*, a.title, a.due_date as "dueDate", a.class_id as "classId",
                      a.max_score as "maxScore", a.submission_type as "submissionType", g.name as "groupName"
               FROM submissions s JOIN assignments a ON a.id = s.assignment_id
               LEFT JOIN assignment_group_members gm ON gm.group_id = s.group_id
               LEFT JOIN assignment_groups g ON g.id = s.group_id
               WHERE (s.student_id = $1 OR gm.student_id = $1)`;
    const params: any[] = [studentId];
    if (classId) { params.push(classId); sql += ` AND a.class_id = $${params.length}`; }
    sql += ' ORDER BY s.id, a.due_date DESC';
    return this.withDetails(await this.dataSource.query(sql, params));
  }

  async statusMatrix(assignmentId: number, user: any) {
    const assignment = await this.assignmentContext(assignmentId);
    await this.ensureManager(user, assignment.classId);
    const rows = await this.dataSource.query(
      `SELECT u.id as "studentId", u.full_name as "studentName", ag.id as "groupId", ag.name as "groupName",
              s.id as "submissionId", s.status, s.score, s.teacher_comment as "teacherComment",
              s.submitted_at as "submittedAt", s.file_url as "fileUrl", s.file_name as "fileName", s.content_text as "contentText"
       FROM enrollments e JOIN users u ON u.id = e.student_id
       LEFT JOIN (
         SELECT gm.student_id, g.id, g.name
         FROM assignment_groups g
         JOIN assignment_group_members gm ON gm.group_id = g.id
         WHERE g.assignment_id = $1
       ) ag ON ag.student_id = u.id
       LEFT JOIN submissions s ON s.assignment_id = $1
         AND ((ag.id IS NOT NULL AND s.group_id = ag.id) OR (ag.id IS NULL AND s.student_id = u.id))
       WHERE e.class_id = $2 AND e.is_active = true ORDER BY ag.name NULLS LAST, u.full_name`,
      [assignmentId, assignment.classId],
    );
    return this.withDetails(rows);
  }

  private async archiveVersion(submission: Submission, submittedBy: number) {
    const attachments = await this.attachmentRepo.find({ where: { submissionId: submission.id }, order: { createdAt: 'ASC' } });
    const max = await this.dataSource.query(`SELECT COALESCE(MAX(version_no), 0)::int as version FROM submission_versions WHERE submission_id = $1`, [submission.id]);
    await this.versionRepo.save(this.versionRepo.create({
      submissionId: submission.id,
      versionNo: Number(max[0]?.version || 0) + 1,
      submittedBy,
      groupId: submission.groupId || null,
      contentText: submission.contentText,
      attachments: attachments.map(file => ({ fileUrl: file.fileUrl, fileName: file.fileName, mimeType: file.mimeType, fileSize: file.fileSize })),
      score: submission.score,
      teacherComment: submission.teacherComment,
    }));
  }

  async submit(assignmentId: number, contentText: string | undefined, files: any[], user: any) {
    const assignment = await this.assignmentContext(assignmentId);
    const group = await this.ensureStudentCanSubmit(user, assignment);
    const text = String(contentText || '').trim();
    const mode = String(assignment.submissionType || 'BOTH').toUpperCase();
    const hasFiles = !!files?.length;
    if (mode === 'FILE' && !hasFiles) throw new BadRequestException('Bài tập này yêu cầu nộp tệp đính kèm');
    if (mode === 'TEXT' && !text) throw new BadRequestException('Bài tập này yêu cầu nộp nội dung văn bản');
    if (mode === 'BOTH' && !hasFiles && !text) throw new BadRequestException('Chọn ít nhất một tệp hoặc nhập nội dung bài làm');
    let submission = group
      ? await this.repo.findOne({ where: { assignmentId, groupId: group.id } })
      : await this.repo.findOne({ where: { assignmentId, studentId: user.id, groupId: null } });
    const firstFile = files?.[0];
    const update = {
      fileUrl: firstFile ? `/uploads/submissions/${firstFile.filename}` : null,
      fileName: firstFile?.originalname || null,
      contentText: text || null,
      status: 'SUBMITTED', score: null, teacherComment: null, gradedAt: null, gradedBy: null, submittedAt: new Date(),
    };
    if (submission) {
      await this.archiveVersion(submission, user.id);
      await this.repo.update(submission.id, update);
      await this.attachmentRepo.delete({ submissionId: submission.id });
      await this.rubricScoreRepo.delete({ submissionId: submission.id });
    } else {
      submission = await this.repo.save(this.repo.create({ assignmentId, studentId: user.id, groupId: group?.id || null, ...update }));
    }
    if (files?.length) await this.attachmentRepo.save(files.map(file => this.attachmentRepo.create({
      submissionId: submission.id, fileUrl: `/uploads/submissions/${file.filename}`, fileName: file.originalname, mimeType: file.mimetype, fileSize: file.size,
    })));
    return (await this.withDetails([await this.repo.findOne({ where: { id: submission.id } })]))[0];
  }

  private normalizeRubricScores(value: any, rubrics: any[]) {
    const scores = this.parseJson(value, []);
    if (!Array.isArray(scores)) throw new BadRequestException('Điểm rubric không hợp lệ');
    const byId = new Map(rubrics.map(rubric => [Number(rubric.id), rubric]));
    if (rubrics.length && scores.length !== rubrics.length) throw new BadRequestException('Cần chấm đầy đủ tất cả tiêu chí rubric');
    return scores.map(item => {
      const rubric = byId.get(Number(item.rubricId ?? item.rubric_id));
      const score = Number(item.score);
      if (!rubric || !Number.isFinite(score) || score < 0 || score > Number(rubric.max_points ?? rubric.maxPoints)) throw new BadRequestException('Điểm rubric không hợp lệ');
      return { rubricId: Number(rubric.id), score, feedback: String(item.feedback || '').trim() || null };
    });
  }

  async grade(id: number, data: { score?: number; teacherComment?: string; status?: string; rubricScores?: any }, user: any) {
    const rows = await this.dataSource.query(
      `SELECT s.assignment_id as "assignmentId", a.class_id as "classId", a.max_score as "maxScore"
       FROM submissions s JOIN assignments a ON a.id = s.assignment_id WHERE s.id = $1`, [id],
    );
    if (!rows[0]) throw new NotFoundException('Không tìm thấy bài nộp');
    await this.ensureManager(user, rows[0].classId);
    const rubrics = await this.dataSource.query(`SELECT id, max_points FROM assignment_rubrics WHERE assignment_id = $1 ORDER BY display_order, id`, [rows[0].assignmentId]);
    const rubricScores = data.rubricScores === undefined ? undefined : this.normalizeRubricScores(data.rubricScores, rubrics);
    const rubricTotal = rubricScores?.reduce((sum, item) => sum + item.score, 0);
    const score = rubricTotal ?? Number(data.score);
    if (!Number.isFinite(score) || score < 0 || score > Number(rows[0].maxScore)) throw new BadRequestException(`Điểm phải từ 0 đến ${rows[0].maxScore}`);
    const status = data.status === 'REVISION_REQUIRED' ? 'REVISION_REQUIRED' : 'GRADED';
    await this.repo.update(id, { score, teacherComment: String(data.teacherComment || '').trim() || null, status, gradedAt: new Date(), gradedBy: user.id });
    if (rubricScores) {
      await this.rubricScoreRepo.delete({ submissionId: id });
      await this.rubricScoreRepo.save(rubricScores.map(item => this.rubricScoreRepo.create({ submissionId: id, rubricId: item.rubricId, score: item.score, feedback: item.feedback, updatedAt: new Date() })));
    }
    return (await this.withDetails([await this.repo.findOne({ where: { id } })]))[0];
  }

  async versions(submissionId: number, user: any) {
    await this.ensureCanViewSubmission(submissionId, user);
    return this.versionRepo.find({ where: { submissionId }, order: { versionNo: 'DESC' } });
  }

  async annotations(submissionId: number, attachmentId: number | undefined, user: any) {
    await this.ensureCanViewSubmission(submissionId, user);
    const where: any = { submissionId };
    if (attachmentId) where.attachmentId = attachmentId;
    const rows = await this.annotationRepo.find({ where, order: { createdAt: 'ASC' } });
    const authors = rows.length ? await this.dataSource.query(`SELECT id, full_name as "authorName" FROM users WHERE id = ANY($1::int[])`, [[...new Set(rows.map(row => row.authorId))]]) : [];
    const authorMap = new Map(authors.map(author => [author.id, author.authorName]));
    return rows.map(row => ({ ...row, authorName: authorMap.get(row.authorId) || 'Giáo viên' }));
  }

  async addAnnotation(submissionId: number, body: any, user: any) {
    const submission = await this.ensureCanViewSubmission(submissionId, user);
    await this.ensureManager(user, submission.classId);
    const content = String(body.content || '').trim();
    if (!content) throw new BadRequestException('Nhập nội dung nhận xét');
    const attachmentId = body.attachmentId ? +body.attachmentId : null;
    if (attachmentId) {
      const attachment = await this.attachmentRepo.findOne({ where: { id: attachmentId, submissionId } });
      if (!attachment) throw new BadRequestException('Tệp nhận xét không thuộc bài nộp');
    }
    const number = (value: any, min: number, max: number) => value === undefined || value === null || value === '' ? null : (Number.isFinite(+value) && +value >= min && +value <= max ? +value : (() => { throw new BadRequestException('Vị trí nhận xét không hợp lệ'); })());
    return this.annotationRepo.save(this.annotationRepo.create({
      submissionId, attachmentId, authorId: user.id,
      pageNo: number(body.pageNo, 1, 9999), positionX: number(body.positionX, 0, 1), positionY: number(body.positionY, 0, 1), content,
    }));
  }

  private tokenSet(text: string) {
    return new Set(String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().match(/[a-z0-9]{3,}/g) || []);
  }

  async similarity(assignmentId: number, user: any) {
    const assignment = await this.assignmentContext(assignmentId);
    await this.ensureManager(user, assignment.classId);
    const submissions = await this.dataSource.query(
      `SELECT s.id, s.content_text as "contentText", u.full_name as "studentName", g.name as "groupName"
       FROM submissions s JOIN users u ON u.id = s.student_id LEFT JOIN assignment_groups g ON g.id = s.group_id
       WHERE s.assignment_id = $1 AND LENGTH(TRIM(COALESCE(s.content_text, ''))) >= 30`, [assignmentId],
    );
    const matches: any[] = [];
    for (let left = 0; left < submissions.length; left++) for (let right = left + 1; right < submissions.length; right++) {
      const a = this.tokenSet(submissions[left].contentText); const b = this.tokenSet(submissions[right].contentText);
      const union = new Set([...a, ...b]);
      const shared = [...a].filter(token => b.has(token)).length;
      const similarity = union.size ? shared / union.size : 0;
      if (similarity >= 0.35) matches.push({ left: { submissionId: submissions[left].id, studentName: submissions[left].studentName, groupName: submissions[left].groupName }, right: { submissionId: submissions[right].id, studentName: submissions[right].studentName, groupName: submissions[right].groupName }, similarity: Math.round(similarity * 100) });
    }
    return { analyzed: submissions.length, threshold: 35, matches: matches.sort((a, b) => b.similarity - a.similarity) };
  }
}

@Controller('submissions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubmissionsController {
  constructor(private readonly service: SubmissionsService) {}

  @Get('matrix/:assignmentId') @Roles('ADMIN', 'TEACHER')
  matrix(@Param('assignmentId', ParseIntPipe) id: number, @CurrentUser() user: any) { return this.service.statusMatrix(id, user); }

  @Get('similarity/:assignmentId') @Roles('ADMIN', 'TEACHER')
  similarity(@Param('assignmentId', ParseIntPipe) id: number, @CurrentUser() user: any) { return this.service.similarity(id, user); }

  @Get(':id/versions')
  versions(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) { return this.service.versions(id, user); }

  @Get(':id/annotations')
  annotations(@Param('id', ParseIntPipe) id: number, @Query('attachmentId') attachmentId: string | undefined, @CurrentUser() user: any) { return this.service.annotations(id, attachmentId ? +attachmentId : undefined, user); }

  @Post(':id/annotations') @Roles('ADMIN', 'TEACHER')
  addAnnotation(@Param('id', ParseIntPipe) id: number, @Body() body: any, @CurrentUser() user: any) { return this.service.addAnnotation(id, body, user); }

  @Get()
  findAll(@Query('assignmentId') assignmentId: string | undefined, @Query('studentId') studentId: string | undefined, @Query('classId') classId: string | undefined, @CurrentUser() user: any) {
    if (assignmentId) return this.service.findByAssignment(+assignmentId, user);
    if (studentId) return this.service.findByStudent(+studentId, classId ? +classId : undefined, user);
    return [];
  }

  @Post('upload') @Roles('STUDENT') @UseInterceptors(submissionUpload)
  upload(@UploadedFiles() files: any[], @Body() body: any, @CurrentUser() user: any) { return this.service.submit(+body.assignmentId, body.contentText, files || [], user); }

  @Post('submit') @Roles('STUDENT') @UseInterceptors(submissionUpload)
  submit(@UploadedFiles() files: any[], @Body() body: any, @CurrentUser() user: any) { return this.service.submit(+body.assignmentId, body.contentText, files || [], user); }

  @Patch(':id/grade') @Roles('ADMIN', 'TEACHER')
  grade(@Param('id', ParseIntPipe) id: number, @Body() body: any, @CurrentUser() user: any) { return this.service.grade(id, body, user); }
}

@Module({
  imports: [TypeOrmModule.forFeature([Submission, SubmissionAttachment, SubmissionVersion, SubmissionRubricScore, SubmissionAnnotation])],
  controllers: [SubmissionsController],
  providers: [SubmissionsService],
  exports: [SubmissionsService, TypeOrmModule],
})
export class SubmissionsModule {}
