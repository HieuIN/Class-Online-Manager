import {
  BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Injectable, Module,
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
  @Column({ name: 'created_by', nullable: true }) createdBy: number;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  attachments?: AssignmentAttachment[];
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

@Injectable()
export class AssignmentsService {
  constructor(
    @InjectRepository(Assignment) private readonly repo: Repository<Assignment>,
    @InjectRepository(AssignmentAttachment) private readonly attachmentRepo: Repository<AssignmentAttachment>,
    private readonly dataSource: DataSource,
  ) {}

  private bool(value: any, fallback: boolean) {
    if (value === undefined || value === null || value === '') return fallback;
    return value === true || String(value).toLowerCase() === 'true';
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

  private async withAttachments(assignments: Assignment[]) {
    if (!assignments.length) return assignments;
    const ids = assignments.map(item => item.id);
    const allAttachments = await this.attachmentRepo.find({ where: { assignmentId: In(ids) }, order: { createdAt: 'ASC' } });
    const byAssignment = new Map<number, AssignmentAttachment[]>();
    for (const attachment of allAttachments) {
      byAssignment.set(attachment.assignmentId, [...(byAssignment.get(attachment.assignmentId) || []), attachment]);
    }
    return assignments.map(item => Object.assign(item, { attachments: byAssignment.get(item.id) || [] }));
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
    if (!partial || body.isRequired !== undefined || body.is_required !== undefined) {
      data.isRequired = this.bool(body.isRequired ?? body.is_required, true);
    }
    const submissionType = String(body.submissionType ?? body.submission_type ?? 'BOTH').toUpperCase();
    if (!partial || body.submissionType !== undefined || body.submission_type !== undefined) {
      if (!['FILE', 'TEXT', 'BOTH'].includes(submissionType)) throw new BadRequestException('Hình thức nộp bài không hợp lệ');
      data.submissionType = submissionType;
    }
    if (!partial || body.allowLateSubmission !== undefined || body.allow_late_submission !== undefined) {
      data.allowLateSubmission = this.bool(body.allowLateSubmission ?? body.allow_late_submission, true);
    }
    const estimatedMinutes = body.estimatedMinutes ?? body.estimated_minutes;
    if (!partial || estimatedMinutes !== undefined) {
      if (estimatedMinutes === '' || estimatedMinutes === null) data.estimatedMinutes = null;
      else {
        const parsed = +estimatedMinutes;
        if (!Number.isInteger(parsed) || parsed < 1 || parsed > 1440) throw new BadRequestException('Thời lượng dự kiến phải từ 1 đến 1440 phút');
        data.estimatedMinutes = parsed;
      }
    }
    return data;
  }

  private async addAttachments(assignmentId: number, files: any[]) {
    if (!files?.length) return [];
    return this.attachmentRepo.save(files.map(file => this.attachmentRepo.create({
      assignmentId,
      fileUrl: `/uploads/assignments/${file.filename}`,
      fileName: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
    })));
  }

  async findByClass(classId: number, user: any) {
    await this.ensureClassAccess(user, classId);
    return this.withAttachments(await this.repo.find({ where: { classId }, order: { dueDate: 'ASC' } }));
  }

  async findOne(id: number, user: any) {
    const assignment = await this.repo.findOne({ where: { id } });
    if (!assignment) throw new NotFoundException('Không tìm thấy bài tập');
    await this.ensureClassAccess(user, assignment.classId);
    return (await this.withAttachments([assignment]))[0];
  }

  async create(body: any, files: any[], user: any) {
    const data = this.normalize(body);
    await this.ensureManager(user, data.classId);
    const assignment = await this.repo.save(this.repo.create({ ...data, createdBy: user.id }));
    await this.addAttachments(assignment.id, files);
    return this.findOne(assignment.id, user);
  }

  async update(id: number, body: any, files: any[], user: any) {
    const assignment = await this.repo.findOne({ where: { id } });
    if (!assignment) throw new NotFoundException('Không tìm thấy bài tập');
    await this.ensureManager(user, assignment.classId);
    const data = this.normalize(body, true);
    if (data.classId && data.classId !== assignment.classId) await this.ensureManager(user, data.classId);
    await this.repo.update(id, data);
    await this.addAttachments(id, files);
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
}

@Controller('assignments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssignmentsController {
  constructor(private readonly service: AssignmentsService) {}

  @Get()
  findAll(@Query('classId', ParseIntPipe) classId: number, @CurrentUser() user: any) {
    return this.service.findByClass(classId, user);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.service.findOne(id, user);
  }

  @Post()
  @Roles('ADMIN', 'TEACHER')
  @UseInterceptors(assignmentUpload)
  create(@Body() body: any, @UploadedFiles() files: any[], @CurrentUser() user: any) {
    return this.service.create(body, files || [], user);
  }

  @Patch(':id')
  @Roles('ADMIN', 'TEACHER')
  @UseInterceptors(assignmentUpload)
  update(@Param('id', ParseIntPipe) id: number, @Body() body: any, @UploadedFiles() files: any[], @CurrentUser() user: any) {
    return this.service.update(id, body, files || [], user);
  }

  @Delete(':id/attachments/:attachmentId')
  @Roles('ADMIN', 'TEACHER')
  removeAttachment(
    @Param('id', ParseIntPipe) id: number,
    @Param('attachmentId', ParseIntPipe) attachmentId: number,
    @CurrentUser() user: any,
  ) {
    return this.service.removeAttachment(id, attachmentId, user);
  }

  @Delete(':id')
  @Roles('ADMIN', 'TEACHER')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.service.remove(id, user);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([Assignment, AssignmentAttachment])],
  controllers: [AssignmentsController],
  providers: [AssignmentsService],
  exports: [AssignmentsService, TypeOrmModule],
})
export class AssignmentsModule {}
