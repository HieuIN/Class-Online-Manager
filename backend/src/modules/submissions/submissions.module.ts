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

@Injectable()
export class SubmissionsService {
  constructor(
    @InjectRepository(Submission) private readonly repo: Repository<Submission>,
    @InjectRepository(SubmissionAttachment) private readonly attachmentRepo: Repository<SubmissionAttachment>,
    private readonly dataSource: DataSource,
  ) {}

  private async assignmentContext(assignmentId: number) {
    const rows = await this.dataSource.query(
      `SELECT a.id, a.class_id as "classId", a.due_date as "dueDate", a.max_score as "maxScore",
              a.submission_type as "submissionType", a.allow_late_submission as "allowLateSubmission",
              c.teacher_id as "teacherId"
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
    const rows = await this.dataSource.query(
      `SELECT 1 FROM classes WHERE id = $1 AND teacher_id = $2 AND is_active = true`,
      [classId, user.id],
    );
    if (!rows[0]) throw new ForbiddenException('Bạn không có quyền quản lý bài nộp của lớp này');
  }

  private async ensureStudentCanSubmit(user: any, assignment: any) {
    if (user.role !== 'STUDENT') throw new ForbiddenException('Chỉ học viên mới có thể nộp bài');
    const enrolled = await this.dataSource.query(
      `SELECT 1 FROM enrollments WHERE class_id = $1 AND student_id = $2 AND is_active = true`,
      [assignment.classId, user.id],
    );
    if (!enrolled[0]) throw new ForbiddenException('Bạn không thuộc lớp học của bài tập này');
    if (!assignment.allowLateSubmission && new Date() > new Date(assignment.dueDate)) {
      throw new BadRequestException('Bài tập đã quá hạn nộp');
    }
  }

  private async withAttachments<T extends Record<string, any>>(rows: T[]) {
    if (!rows.length) return rows;
    const ids = rows.map(row => Number(row.id ?? row.submissionId)).filter(Number.isInteger);
    const attachments = ids.length
      ? await this.attachmentRepo.find({ where: { submissionId: In(ids) }, order: { createdAt: 'ASC' } })
      : [];
    const bySubmission = new Map<number, SubmissionAttachment[]>();
    for (const attachment of attachments) {
      bySubmission.set(attachment.submissionId, [...(bySubmission.get(attachment.submissionId) || []), attachment]);
    }
    return rows.map(row => {
      const submissionId = Number(row.id ?? row.submissionId);
      const current = bySubmission.get(submissionId) || [];
      const legacyUrl = row.fileUrl ?? row.file_url;
      const legacyName = row.fileName ?? row.file_name;
      const legacy = legacyUrl ? [{ id: `legacy-${submissionId}`, fileUrl: legacyUrl, fileName: legacyName || String(legacyUrl).split('/').pop() }] : [];
      return { ...row, attachments: current.length ? current : legacy };
    });
  }

  async findByAssignment(assignmentId: number, user: any) {
    const assignment = await this.assignmentContext(assignmentId);
    await this.ensureManager(user, assignment.classId);
    const rows = await this.dataSource.query(
      `SELECT s.*, u.full_name as "studentName", u.avatar_url as "studentAvatar"
       FROM submissions s JOIN users u ON u.id = s.student_id
       WHERE s.assignment_id = $1 ORDER BY u.full_name`,
      [assignmentId],
    );
    return this.withAttachments(rows);
  }

  async findByStudent(studentId: number, classId: number | undefined, user: any) {
    if (user.role === 'STUDENT' && studentId !== user.id) {
      throw new ForbiddenException('Bạn chỉ có thể xem bài nộp của mình');
    }
    if (user.role === 'TEACHER') {
      if (!classId) throw new BadRequestException('Cần chọn lớp học');
      await this.ensureManager(user, classId);
    }
    let sql = `SELECT s.*, a.title, a.due_date as "dueDate", a.class_id as "classId",
                      a.max_score as "maxScore", a.submission_type as "submissionType"
               FROM submissions s JOIN assignments a ON a.id = s.assignment_id
               WHERE s.student_id = $1`;
    const params: any[] = [studentId];
    if (classId) {
      params.push(classId);
      sql += ` AND a.class_id = $${params.length}`;
    }
    sql += ' ORDER BY a.due_date DESC';
    return this.withAttachments(await this.dataSource.query(sql, params));
  }

  async statusMatrix(assignmentId: number, user: any) {
    const assignment = await this.assignmentContext(assignmentId);
    await this.ensureManager(user, assignment.classId);
    const rows = await this.dataSource.query(
      `SELECT u.id as "studentId", u.full_name as "studentName",
              s.id as "submissionId", s.status, s.score, s.teacher_comment as "teacherComment",
              s.submitted_at as "submittedAt", s.file_url as "fileUrl", s.file_name as "fileName",
              s.content_text as "contentText"
       FROM enrollments e
       JOIN users u ON u.id = e.student_id
       LEFT JOIN submissions s ON s.assignment_id = $1 AND s.student_id = u.id
       WHERE e.class_id = $2 AND e.is_active = true
       ORDER BY u.full_name`,
      [assignmentId, assignment.classId],
    );
    return this.withAttachments(rows);
  }

  async submit(assignmentId: number, contentText: string | undefined, files: any[], user: any) {
    const assignment = await this.assignmentContext(assignmentId);
    await this.ensureStudentCanSubmit(user, assignment);
    const text = String(contentText || '').trim();
    const mode = String(assignment.submissionType || 'BOTH').toUpperCase();
    const hasFiles = !!files?.length;
    if (mode === 'FILE' && !hasFiles) throw new BadRequestException('Bài tập này yêu cầu nộp tệp đính kèm');
    if (mode === 'TEXT' && !text) throw new BadRequestException('Bài tập này yêu cầu nộp nội dung văn bản');
    if (mode === 'BOTH' && !hasFiles && !text) throw new BadRequestException('Chọn ít nhất một tệp hoặc nhập nội dung bài làm');

    let submission = await this.repo.findOne({ where: { assignmentId, studentId: user.id } });
    const firstFile = files?.[0];
    const update = {
      fileUrl: firstFile ? `/uploads/submissions/${firstFile.filename}` : null,
      fileName: firstFile?.originalname || null,
      contentText: text || null,
      status: 'SUBMITTED',
      score: null,
      teacherComment: null,
      gradedAt: null,
      gradedBy: null,
      submittedAt: new Date(),
    };
    if (submission) {
      await this.repo.update(submission.id, update);
      await this.attachmentRepo.delete({ submissionId: submission.id });
    } else {
      submission = await this.repo.save(this.repo.create({ assignmentId, studentId: user.id, ...update }));
    }
    if (files?.length) {
      await this.attachmentRepo.save(files.map(file => this.attachmentRepo.create({
        submissionId: submission.id,
        fileUrl: `/uploads/submissions/${file.filename}`,
        fileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
      })));
    }
    return (await this.withAttachments([await this.repo.findOne({ where: { id: submission.id } })]))[0];
  }

  async grade(id: number, data: { score?: number; teacherComment?: string; status?: string }, user: any) {
    const rows = await this.dataSource.query(
      `SELECT s.assignment_id as "assignmentId", a.class_id as "classId", a.max_score as "maxScore"
       FROM submissions s JOIN assignments a ON a.id = s.assignment_id WHERE s.id = $1`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException('Không tìm thấy bài nộp');
    await this.ensureManager(user, rows[0].classId);
    const score = Number(data.score);
    if (!Number.isFinite(score) || score < 0 || score > Number(rows[0].maxScore)) {
      throw new BadRequestException(`Điểm phải từ 0 đến ${rows[0].maxScore}`);
    }
    const status = data.status === 'REVISION_REQUIRED' ? 'REVISION_REQUIRED' : 'GRADED';
    await this.repo.update(id, {
      score,
      teacherComment: String(data.teacherComment || '').trim() || null,
      status,
      gradedAt: new Date(),
      gradedBy: user.id,
    });
    return (await this.withAttachments([await this.repo.findOne({ where: { id } })]))[0];
  }
}

@Controller('submissions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubmissionsController {
  constructor(private readonly service: SubmissionsService) {}

  @Get('matrix/:assignmentId')
  @Roles('ADMIN', 'TEACHER')
  matrix(@Param('assignmentId', ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.service.statusMatrix(id, user);
  }

  @Get()
  findAll(
    @Query('assignmentId') assignmentId: string | undefined,
    @Query('studentId') studentId: string | undefined,
    @Query('classId') classId: string | undefined,
    @CurrentUser() user: any,
  ) {
    if (assignmentId) return this.service.findByAssignment(+assignmentId, user);
    if (studentId) return this.service.findByStudent(+studentId, classId ? +classId : undefined, user);
    return [];
  }

  @Post('upload')
  @Roles('STUDENT')
  @UseInterceptors(submissionUpload)
  upload(@UploadedFiles() files: any[], @Body() body: any, @CurrentUser() user: any) {
    return this.service.submit(+body.assignmentId, body.contentText, files || [], user);
  }

  @Post('submit')
  @Roles('STUDENT')
  @UseInterceptors(submissionUpload)
  submit(@UploadedFiles() files: any[], @Body() body: any, @CurrentUser() user: any) {
    return this.service.submit(+body.assignmentId, body.contentText, files || [], user);
  }

  @Patch(':id/grade')
  @Roles('ADMIN', 'TEACHER')
  grade(@Param('id', ParseIntPipe) id: number, @Body() body: any, @CurrentUser() user: any) {
    return this.service.grade(id, body, user);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([Submission, SubmissionAttachment])],
  controllers: [SubmissionsController],
  providers: [SubmissionsService],
  exports: [SubmissionsService, TypeOrmModule],
})
export class SubmissionsModule {}
