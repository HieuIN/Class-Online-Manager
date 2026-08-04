import {
  BadRequestException, Body, ConflictException, Controller, Delete, ForbiddenException, Get, Injectable, Module,
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

const assignmentUpload = AnyFilesInterceptor({
  storage: diskStorage({
    destination: (_req, _file, callback) => callback(null, ensureUploadDir('assignments')),
    filename: (_req, file, callback) => callback(null, attachmentFileName('assignment', file.originalname)),
  }),
  limits: { fileSize: maxAttachmentSize, files: 8 },
  fileFilter: attachmentFileFilter,
});

@Entity('assignments')
export class Assignment {
  @PrimaryGeneratedColumn() id: number;
  @Column({ name: 'class_id' }) classId: number;
  @Column() title: string;
  @Column({ type: 'text', nullable: true }) description: string;
  @Column({ name: 'due_date', type: 'timestamp' }) dueDate: Date;
  @Column({ name: 'attachment_url', type: 'text', nullable: true }) attachmentUrl: string;
  @Column({ name: 'max_score', type: 'numeric', precision: 5, scale: 2, default: 10 }) maxScore: number;
  @Column({ name: 'is_required', default: true }) isRequired: boolean;
  @Column({ name: 'submission_type', default: 'BOTH' }) submissionType: string;
  @Column({ name: 'allow_late_submission', default: true }) allowLateSubmission: boolean;
  @Column({ name: 'estimated_minutes', nullable: true }) estimatedMinutes: number;
  @Column({ default: 'PUBLISHED' }) status: string;
  @Column({ name: 'publish_at', type: 'timestamp', nullable: true }) publishAt: Date;
  @Column({ name: 'is_group_assignment', default: false }) isGroupAssignment: boolean;
  @Column({ name: 'group_max_members', nullable: true }) groupMaxMembers: number;
  @Column({ name: 'created_by', nullable: true }) createdBy: number;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  attachments?: AssignmentAttachment[];
  rubrics?: AssignmentRubric[];
  groups?: AssignmentGroup[];
  myGroup?: AssignmentGroup;
}

@Entity('assignment_attachments')
export class AssignmentAttachment {
  @PrimaryGeneratedColumn() id: number;
  @Column({ name: 'assignment_id' }) assignmentId: number;
  @Column({ name: 'file_url', type: 'text' }) fileUrl: string;
  @Column({ name: 'file_name' }) fileName: string;
  @Column({ name: 'mime_type', nullable: true }) mimeType: string;
  @Column({ name: 'file_size', nullable: true }) fileSize: number;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Entity('assignment_rubrics')
export class AssignmentRubric {
  @PrimaryGeneratedColumn() id: number;
  @Column({ name: 'assignment_id' }) assignmentId: number;
  @Column() criterion: string;
  @Column({ type: 'text', nullable: true }) description: string;
  @Column({ name: 'max_points', type: 'numeric', precision: 5, scale: 2 }) maxPoints: number;
  @Column({ name: 'display_order', default: 0 }) displayOrder: number;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Entity('assignment_templates')
export class AssignmentTemplate {
  @PrimaryGeneratedColumn() id: number;
  @Column({ name: 'created_by' }) createdBy: number;
  @Column() name: string;
  @Column({ type: 'jsonb' }) payload: any;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @Column({ name: 'updated_at', type: 'timestamp' }) updatedAt: Date;
}

@Entity('assignment_groups')
export class AssignmentGroup {
  @PrimaryGeneratedColumn() id: number;
  @Column({ name: 'assignment_id' }) assignmentId: number;
  @Column() name: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  members?: Array<{ id: number; fullName: string; email?: string }>;
}

@Entity('assignment_group_members')
export class AssignmentGroupMember {
  @PrimaryGeneratedColumn() id: number;
  @Column({ name: 'group_id' }) groupId: number;
  @Column({ name: 'student_id' }) studentId: number;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

type RubricInput = { criterion: string; description?: string; maxPoints: number };

@Injectable()
export class AssignmentsService {
  constructor(
    @InjectRepository(Assignment) private readonly repo: Repository<Assignment>,
    @InjectRepository(AssignmentAttachment) private readonly attachmentRepo: Repository<AssignmentAttachment>,
    @InjectRepository(AssignmentRubric) private readonly rubricRepo: Repository<AssignmentRubric>,
    @InjectRepository(AssignmentTemplate) private readonly templateRepo: Repository<AssignmentTemplate>,
    @InjectRepository(AssignmentGroup) private readonly groupRepo: Repository<AssignmentGroup>,
    @InjectRepository(AssignmentGroupMember) private readonly groupMemberRepo: Repository<AssignmentGroupMember>,
    private readonly dataSource: DataSource,
  ) {}

  private bool(value: any, fallback: boolean) {
    if (value === undefined || value === null || value === '') return fallback;
    return value === true || String(value).toLowerCase() === 'true';
  }

  private parseJson(value: any, fallback: any) {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value !== 'string') return value;
    try { return JSON.parse(value); } catch { throw new BadRequestException('Dữ liệu cấu hình không hợp lệ'); }
  }

  private async canAccessClass(user: any, classId: number) {
    if (user.role === 'ADMIN') return true;
    if (user.role === 'TEACHER') {
      const rows = await this.dataSource.query(`SELECT 1 FROM classes WHERE id = $1 AND teacher_id = $2 AND is_active = true`, [classId, user.id]);
      return !!rows[0];
    }
    const rows = await this.dataSource.query(
      `SELECT 1 FROM enrollments e JOIN classes c ON c.id = e.class_id
       WHERE e.class_id = $1 AND e.student_id = $2 AND e.is_active = true AND c.is_active = true`,
      [classId, user.id],
    );
    return !!rows[0];
  }

  private async ensureClassAccess(user: any, classId: number) {
    if (!(await this.canAccessClass(user, classId))) throw new ForbiddenException('Bạn không có quyền truy cập bài tập của lớp này');
  }

  private async ensureManager(user: any, classId: number) {
    if (user.role === 'ADMIN') return;
    if (user.role !== 'TEACHER' || !(await this.canAccessClass(user, classId))) {
      throw new ForbiddenException('Bạn không có quyền quản lý bài tập của lớp này');
    }
  }

  private normalizeRubrics(value: any, maxScore: number | undefined): RubricInput[] | undefined {
    if (value === undefined) return undefined;
    const rubrics = this.parseJson(value, []);
    if (!Array.isArray(rubrics) || rubrics.length > 12) throw new BadRequestException('Rubric có tối đa 12 tiêu chí');
    const normalized = rubrics.map((rubric, index) => {
      const criterion = String(rubric.criterion || '').trim();
      const points = Number(rubric.maxPoints ?? rubric.max_points);
      if (!criterion || !Number.isFinite(points) || points <= 0 || points > 100) {
        throw new BadRequestException(`Tiêu chí rubric ${index + 1} không hợp lệ`);
      }
      return { criterion, description: String(rubric.description || '').trim() || null, maxPoints: points };
    });
    const total = normalized.reduce((sum, rubric) => sum + rubric.maxPoints, 0);
    if (maxScore != null && total > maxScore + 0.001) {
      throw new BadRequestException('Tổng điểm rubric không được lớn hơn thang điểm bài tập');
    }
    return normalized;
  }

  private normalize(body: any, partial = false): Partial<Assignment> {
    const data: Partial<Assignment> = {};
    const assign = (key: keyof Assignment, value: any) => { if (value !== undefined) (data as any)[key] = value; };
    const classId = body.classId ?? body.class_id;
    if (classId !== undefined) {
      const parsed = +classId;
      if (!Number.isInteger(parsed) || parsed <= 0) throw new BadRequestException('Lớp học không hợp lệ');
      data.classId = parsed;
    }
    if (!partial || body.title !== undefined) {
      const title = String(body.title || '').trim();
      if (!title) throw new BadRequestException('Nhập tên bài tập');
      data.title = title;
    }
    if (!partial || body.description !== undefined) assign('description', String(body.description || '').trim() || null);
    const dueDate = body.dueDate ?? body.due_date;
    if (!partial || dueDate !== undefined) {
      if (!dueDate || Number.isNaN(new Date(dueDate).getTime())) throw new BadRequestException('Hạn nộp không hợp lệ');
      data.dueDate = new Date(dueDate);
    }
    const maxScore = body.maxScore ?? body.max_score;
    if (!partial || maxScore !== undefined) {
      const parsed = Number(maxScore ?? 10);
      if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 100) throw new BadRequestException('Thang điểm phải từ 0.5 đến 100');
      data.maxScore = parsed;
    }
    if (!partial || body.isRequired !== undefined || body.is_required !== undefined) data.isRequired = this.bool(body.isRequired ?? body.is_required, true);
    const submissionType = String(body.submissionType ?? body.submission_type ?? 'BOTH').toUpperCase();
    if (!partial || body.submissionType !== undefined || body.submission_type !== undefined) {
      if (!['FILE', 'TEXT', 'BOTH'].includes(submissionType)) throw new BadRequestException('Hình thức nộp bài không hợp lệ');
      data.submissionType = submissionType;
    }
    if (!partial || body.allowLateSubmission !== undefined || body.allow_late_submission !== undefined) data.allowLateSubmission = this.bool(body.allowLateSubmission ?? body.allow_late_submission, true);
    const estimatedMinutes = body.estimatedMinutes ?? body.estimated_minutes;
    if (!partial || estimatedMinutes !== undefined) {
      if (estimatedMinutes === '' || estimatedMinutes === null) data.estimatedMinutes = null;
      else {
        const parsed = +estimatedMinutes;
        if (!Number.isInteger(parsed) || parsed < 1 || parsed > 1440) throw new BadRequestException('Thời lượng dự kiến phải từ 1 đến 1440 phút');
        data.estimatedMinutes = parsed;
      }
    }
    const publishAt = body.publishAt ?? body.publish_at;
    if (!partial || publishAt !== undefined) {
      if (publishAt === '' || publishAt === null) data.publishAt = null;
      else if (Number.isNaN(new Date(publishAt).getTime())) throw new BadRequestException('Thời điểm phát hành không hợp lệ');
      else data.publishAt = new Date(publishAt);
    }
    const requestedStatus = String(body.status ?? 'PUBLISHED').toUpperCase();
    if (!partial || body.status !== undefined || publishAt !== undefined) {
      if (!['DRAFT', 'PUBLISHED'].includes(requestedStatus)) throw new BadRequestException('Trạng thái bài tập không hợp lệ');
      const scheduled = data.publishAt && data.publishAt > new Date();
      data.status = scheduled ? 'DRAFT' : requestedStatus;
    }
    if (!partial || body.isGroupAssignment !== undefined || body.is_group_assignment !== undefined) {
      data.isGroupAssignment = this.bool(body.isGroupAssignment ?? body.is_group_assignment, false);
    }
    const groupMaxMembers = body.groupMaxMembers ?? body.group_max_members;
    if ((!partial && !data.isGroupAssignment) || data.isGroupAssignment === false) {
      data.groupMaxMembers = null;
    } else if (!partial || groupMaxMembers !== undefined) {
      if ((groupMaxMembers === undefined || groupMaxMembers === '' || groupMaxMembers === null) && data.isGroupAssignment) data.groupMaxMembers = 2;
      else if (groupMaxMembers === undefined || groupMaxMembers === '' || groupMaxMembers === null) data.groupMaxMembers = null;
      else {
        const parsed = +groupMaxMembers;
        if (!Number.isInteger(parsed) || parsed < 2 || parsed > 20) throw new BadRequestException('Số thành viên nhóm phải từ 2 đến 20');
        data.groupMaxMembers = parsed;
      }
    }
    return data;
  }

  private async addAttachments(assignmentId: number, files: any[]) {
    if (!files?.length) return [];
    return this.attachmentRepo.save(files.map(file => this.attachmentRepo.create({
      assignmentId, fileUrl: `/uploads/assignments/${file.filename}`, fileName: file.originalname,
      mimeType: file.mimetype, fileSize: file.size,
    })));
  }

  private async replaceRubrics(assignmentId: number, rubrics: RubricInput[] | undefined) {
    if (rubrics === undefined) return;
    await this.rubricRepo.delete({ assignmentId });
    if (rubrics.length) await this.rubricRepo.save(rubrics.map((rubric, index) => this.rubricRepo.create({ ...rubric, assignmentId, displayOrder: index })));
  }

  private async withDetails(assignments: Assignment[], user: any) {
    if (!assignments.length) return assignments;
    const ids = assignments.map(item => item.id);
    const [attachments, rubrics, groups] = await Promise.all([
      this.attachmentRepo.find({ where: { assignmentId: In(ids) }, order: { createdAt: 'ASC' } }),
      this.rubricRepo.find({ where: { assignmentId: In(ids) }, order: { displayOrder: 'ASC', id: 'ASC' } }),
      this.groupRepo.find({ where: { assignmentId: In(ids) }, order: { name: 'ASC' } }),
    ]);
    const groupIds = groups.map(group => group.id);
    const members = groupIds.length ? await this.dataSource.query(
      `SELECT gm.group_id as "groupId", u.id, u.full_name as "fullName", u.email
       FROM assignment_group_members gm JOIN users u ON u.id = gm.student_id
       WHERE gm.group_id = ANY($1::int[]) ORDER BY u.full_name`, [groupIds],
    ) : [];
    const attachMap = new Map<number, AssignmentAttachment[]>();
    const rubricMap = new Map<number, AssignmentRubric[]>();
    const groupMap = new Map<number, AssignmentGroup[]>();
    const memberMap = new Map<number, any[]>();
    attachments.forEach(item => attachMap.set(item.assignmentId, [...(attachMap.get(item.assignmentId) || []), item]));
    rubrics.forEach(item => rubricMap.set(item.assignmentId, [...(rubricMap.get(item.assignmentId) || []), item]));
    members.forEach(item => memberMap.set(item.groupId, [...(memberMap.get(item.groupId) || []), { id: item.id, fullName: item.fullName, email: item.email }]));
    groups.forEach(group => {
      group.members = memberMap.get(group.id) || [];
      groupMap.set(group.assignmentId, [...(groupMap.get(group.assignmentId) || []), group]);
    });
    return assignments.map(assignment => {
      const assignmentGroups = groupMap.get(assignment.id) || [];
      const detail: any = Object.assign(assignment, { attachments: attachMap.get(assignment.id) || [], rubrics: rubricMap.get(assignment.id) || [] });
      if (user.role === 'STUDENT') detail.myGroup = assignmentGroups.find(group => group.members?.some(member => member.id === user.id)) || null;
      else detail.groups = assignmentGroups;
      return detail;
    });
  }

  async findByClass(classId: number, user: any) {
    await this.ensureClassAccess(user, classId);
    const query = this.repo.createQueryBuilder('assignment').where('assignment.class_id = :classId', { classId });
    if (user.role === 'STUDENT') query.andWhere(`assignment.status = 'PUBLISHED' AND (assignment.publish_at IS NULL OR assignment.publish_at <= NOW())`);
    query.orderBy('assignment.due_date', 'ASC');
    return this.withDetails(await query.getMany(), user);
  }

  async findOne(id: number, user: any) {
    const assignment = await this.repo.findOne({ where: { id } });
    if (!assignment) throw new NotFoundException('Không tìm thấy bài tập');
    await this.ensureClassAccess(user, assignment.classId);
    if (user.role === 'STUDENT' && (assignment.status !== 'PUBLISHED' || (assignment.publishAt && assignment.publishAt > new Date()))) throw new NotFoundException('Bài tập chưa được phát hành');
    return (await this.withDetails([assignment], user))[0];
  }

  async create(body: any, files: any[], user: any) {
    const data = this.normalize(body);
    await this.ensureManager(user, data.classId);
    const rubrics = this.normalizeRubrics(body.rubrics, Number(data.maxScore));
    const assignment = await this.repo.save(this.repo.create({ ...data, createdBy: user.id }));
    await Promise.all([this.addAttachments(assignment.id, files), this.replaceRubrics(assignment.id, rubrics)]);
    return this.findOne(assignment.id, user);
  }

  async update(id: number, body: any, files: any[], user: any) {
    const assignment = await this.repo.findOne({ where: { id } });
    if (!assignment) throw new NotFoundException('Không tìm thấy bài tập');
    await this.ensureManager(user, assignment.classId);
    const data = this.normalize(body, true);
    if (data.classId && data.classId !== assignment.classId) await this.ensureManager(user, data.classId);
    const rubrics = this.normalizeRubrics(body.rubrics, Number(data.maxScore ?? assignment.maxScore));
    await this.repo.update(id, data);
    await Promise.all([this.addAttachments(id, files), this.replaceRubrics(id, rubrics)]);
    return this.findOne(id, user);
  }

  async publish(id: number, user: any) {
    const assignment = await this.repo.findOne({ where: { id } });
    if (!assignment) throw new NotFoundException('Không tìm thấy bài tập');
    await this.ensureManager(user, assignment.classId);
    await this.repo.update(id, { status: 'PUBLISHED', publishAt: null });
    return this.findOne(id, user);
  }

  async remove(id: number, user: any) {
    const assignment = await this.repo.findOne({ where: { id } });
    if (!assignment) throw new NotFoundException('Không tìm thấy bài tập');
    await this.ensureManager(user, assignment.classId);
    return this.repo.delete(id);
  }

  async removeAttachment(assignmentId: number, attachmentId: number, user: any) {
    const assignment = await this.repo.findOne({ where: { id: assignmentId } });
    if (!assignment) throw new NotFoundException('Không tìm thấy bài tập');
    await this.ensureManager(user, assignment.classId);
    const attachment = await this.attachmentRepo.findOne({ where: { id: attachmentId, assignmentId } });
    if (!attachment) throw new NotFoundException('Không tìm thấy file đính kèm');
    await this.attachmentRepo.delete(attachment.id);
    return { success: true };
  }

  async templates(user: any) {
    return this.templateRepo.find({ where: { createdBy: user.id }, order: { updatedAt: 'DESC', id: 'DESC' } });
  }

  async saveTemplate(body: any, user: any) {
    const name = String(body.name || '').trim();
    if (!name) throw new BadRequestException('Nhập tên mẫu bài tập');
    const payload = this.parseJson(body.payload, null);
    if (!payload || typeof payload !== 'object') throw new BadRequestException('Nội dung mẫu không hợp lệ');
    return this.templateRepo.save(this.templateRepo.create({ createdBy: user.id, name, payload, updatedAt: new Date() }));
  }

  async deleteTemplate(id: number, user: any) {
    const template = await this.templateRepo.findOne({ where: { id } });
    if (!template || (user.role !== 'ADMIN' && template.createdBy !== user.id)) throw new NotFoundException('Không tìm thấy mẫu bài tập');
    await this.templateRepo.delete(id);
    return { success: true };
  }

  async createFromTemplate(id: number, body: any, user: any) {
    const template = await this.templateRepo.findOne({ where: { id } });
    if (!template || (user.role !== 'ADMIN' && template.createdBy !== user.id)) throw new NotFoundException('Không tìm thấy mẫu bài tập');
    const payload = template.payload || {};
    return this.create({ ...payload, ...body, classId: body.classId, dueDate: body.dueDate ?? payload.dueDate }, [], user);
  }

  async groups(assignmentId: number, user: any) {
    const assignment = await this.repo.findOne({ where: { id: assignmentId } });
    if (!assignment) throw new NotFoundException('Không tìm thấy bài tập');
    await this.ensureClassAccess(user, assignment.classId);
    const detail = await this.withDetails([assignment], user);
    return user.role === 'STUDENT' ? detail[0].myGroup ? [detail[0].myGroup] : [] : detail[0].groups || [];
  }

  async replaceGroups(assignmentId: number, body: any, user: any) {
    const assignment = await this.repo.findOne({ where: { id: assignmentId } });
    if (!assignment) throw new NotFoundException('Không tìm thấy bài tập');
    await this.ensureManager(user, assignment.classId);
    if (!assignment.isGroupAssignment) throw new BadRequestException('Hãy bật chế độ bài tập nhóm trước');
    const groups = this.parseJson(body.groups, []);
    if (!Array.isArray(groups) || !groups.length || groups.length > 30) throw new BadRequestException('Cần có từ 1 đến 30 nhóm');
    const usedStudents = new Set<number>();
    const normalized = groups.map((group, index) => {
      const name = String(group.name || '').trim();
      const sourceIds = Array.isArray(group.studentIds || group.student_ids) ? (group.studentIds || group.student_ids) : [];
      const studentIds: number[] = [...new Set<number>(sourceIds.map((value: any) => Number(value)).filter((value: number) => Number.isInteger(value)))];
      if (!name || !studentIds.length) throw new BadRequestException(`Nhóm ${index + 1} chưa đủ thông tin`);
      if (assignment.groupMaxMembers && studentIds.length > assignment.groupMaxMembers) throw new BadRequestException(`Nhóm ${name} vượt quá số thành viên cho phép`);
      studentIds.forEach(studentId => {
        if (usedStudents.has(studentId)) throw new BadRequestException('Một học viên chỉ được thuộc một nhóm');
        usedStudents.add(studentId);
      });
      return { name, studentIds };
    });
    const enrolled = await this.dataSource.query(`SELECT student_id as id FROM enrollments WHERE class_id = $1 AND is_active = true`, [assignment.classId]);
    const enrolledIds = new Set(enrolled.map(row => Number(row.id)));
    if ([...usedStudents].some(id => !enrolledIds.has(id))) throw new BadRequestException('Nhóm có học viên không thuộc lớp');
    const submissions = await this.dataSource.query(`SELECT COUNT(*)::int as count FROM submissions WHERE assignment_id = $1 AND group_id IS NOT NULL`, [assignmentId]);
    if (submissions[0]?.count) throw new ConflictException('Không thể đổi nhóm sau khi đã có bài nộp nhóm');
    await this.dataSource.transaction(async manager => {
      await manager.delete(AssignmentGroup, { assignmentId });
      for (const group of normalized) {
        const saved = await manager.save(AssignmentGroup, manager.create(AssignmentGroup, { assignmentId, name: group.name }));
        await manager.save(AssignmentGroupMember, group.studentIds.map(studentId => manager.create(AssignmentGroupMember, { groupId: saved.id, studentId })));
      }
    });
    return this.groups(assignmentId, user);
  }
}

@Controller('assignment-templates')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'TEACHER')
export class AssignmentTemplatesController {
  constructor(private readonly service: AssignmentsService) {}
  @Get() list(@CurrentUser() user: any) { return this.service.templates(user); }
  @Post() save(@Body() body: any, @CurrentUser() user: any) { return this.service.saveTemplate(body, user); }
  @Post(':id/create') create(@Param('id', ParseIntPipe) id: number, @Body() body: any, @CurrentUser() user: any) { return this.service.createFromTemplate(id, body, user); }
  @Delete(':id') remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) { return this.service.deleteTemplate(id, user); }
}

@Controller('assignments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssignmentsController {
  constructor(private readonly service: AssignmentsService) {}

  @Get()
  findAll(@Query('classId', ParseIntPipe) classId: number, @CurrentUser() user: any) { return this.service.findByClass(classId, user); }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) { return this.service.findOne(id, user); }

  @Post()
  @Roles('ADMIN', 'TEACHER')
  @UseInterceptors(assignmentUpload)
  create(@Body() body: any, @UploadedFiles() files: any[], @CurrentUser() user: any) { return this.service.create(body, files || [], user); }

  @Patch(':id')
  @Roles('ADMIN', 'TEACHER')
  @UseInterceptors(assignmentUpload)
  update(@Param('id', ParseIntPipe) id: number, @Body() body: any, @UploadedFiles() files: any[], @CurrentUser() user: any) { return this.service.update(id, body, files || [], user); }

  @Post(':id/publish')
  @Roles('ADMIN', 'TEACHER')
  publish(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) { return this.service.publish(id, user); }

  @Get(':id/groups')
  groups(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) { return this.service.groups(id, user); }

  @Post(':id/groups')
  @Roles('ADMIN', 'TEACHER')
  saveGroups(@Param('id', ParseIntPipe) id: number, @Body() body: any, @CurrentUser() user: any) { return this.service.replaceGroups(id, body, user); }

  @Delete(':id/attachments/:attachmentId')
  @Roles('ADMIN', 'TEACHER')
  removeAttachment(@Param('id', ParseIntPipe) id: number, @Param('attachmentId', ParseIntPipe) attachmentId: number, @CurrentUser() user: any) { return this.service.removeAttachment(id, attachmentId, user); }

  @Delete(':id')
  @Roles('ADMIN', 'TEACHER')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) { return this.service.remove(id, user); }
}

@Module({
  imports: [TypeOrmModule.forFeature([Assignment, AssignmentAttachment, AssignmentRubric, AssignmentTemplate, AssignmentGroup, AssignmentGroupMember])],
  controllers: [AssignmentsController, AssignmentTemplatesController],
  providers: [AssignmentsService],
  exports: [AssignmentsService, TypeOrmModule],
})
export class AssignmentsModule {}
