import { Injectable, Module, Controller, Get, Post, Patch, Body, Param, ParseIntPipe, Query, UseGuards, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Repository, DataSource } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../common/roles.guard';
import { CurrentUser } from '../../common/current-user.decorator';

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
}

@Injectable()
export class SubmissionsService {
  constructor(
    @InjectRepository(Submission) private repo: Repository<Submission>,
    private dataSource: DataSource,
  ) {}

  // Get all submissions for an assignment (joined with student info)
  async findByAssignment(assignmentId: number) {
    return this.dataSource.query(
      `SELECT s.*, u.full_name as "studentName", u.avatar_url as "studentAvatar"
       FROM submissions s JOIN users u ON u.id = s.student_id
       WHERE s.assignment_id = $1 ORDER BY u.full_name`, [assignmentId]
    );
  }

  // All submissions for one student (across class)
  async findByStudent(studentId: number, classId?: number) {
    let sql = `SELECT s.*, a.title, a.due_date as "dueDate", a.class_id as "classId"
               FROM submissions s JOIN assignments a ON a.id = s.assignment_id
               WHERE s.student_id = $1`;
    const params: any[] = [studentId];
    if (classId) { params.push(classId); sql += ` AND a.class_id = $${params.length}`; }
    sql += ' ORDER BY a.due_date DESC';
    return this.dataSource.query(sql, params);
  }

  /** Returns matrix: who submitted what for an assignment (incl. NOT_SUBMITTED entries) */
  async statusMatrix(assignmentId: number) {
    return this.dataSource.query(
      `SELECT u.id as "studentId", u.full_name as "studentName",
              s.id as "submissionId", s.status, s.score, s.teacher_comment as "teacherComment",
              s.submitted_at as "submittedAt", s.file_url as "fileUrl"
       FROM enrollments e
       JOIN users u ON u.id = e.student_id
       LEFT JOIN submissions s ON s.assignment_id = $1 AND s.student_id = u.id
       WHERE e.class_id = (SELECT class_id FROM assignments WHERE id = $1)
         AND e.is_active = true
       ORDER BY u.full_name`, [assignmentId]
    );
  }

  async submit(data: { assignmentId: number; studentId: number; fileUrl?: string; fileName?: string; contentText?: string }) {
    const exist = await this.repo.findOne({ where: { assignmentId: data.assignmentId, studentId: data.studentId } });
    if (exist) {
      await this.repo.update(exist.id, { fileUrl: data.fileUrl, fileName: data.fileName, contentText: data.contentText, status: 'SUBMITTED' });
      return this.repo.findOne({ where: { id: exist.id } });
    }
    return this.repo.save(this.repo.create({ ...data, status: 'SUBMITTED' }));
  }

  async grade(id: number, data: { score?: number; teacherComment?: string; status?: string; gradedBy?: number }) {
    await this.repo.update(id, { ...data, gradedAt: new Date() });
    return this.repo.findOne({ where: { id } });
  }
}

@Controller('submissions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubmissionsController {
  constructor(private readonly service: SubmissionsService) {}

  @Get('matrix/:assignmentId')
  matrix(@Param('assignmentId', ParseIntPipe) id: number) { return this.service.statusMatrix(id); }

  @Get()
  findAll(@Query('assignmentId') aid?: string, @Query('studentId') sid?: string, @Query('classId') cid?: string) {
    if (aid) return this.service.findByAssignment(+aid);
    if (sid) return this.service.findByStudent(+sid, cid ? +cid : undefined);
    return [];
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: process.env.UPLOAD_DIR || './uploads',
      filename: (_req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `submission-${unique}${extname(file.originalname)}`);
      }
    }),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  }))
  async upload(@UploadedFile() file: any, @Body() body: any, @CurrentUser() user: any) {
    return this.service.submit({
      assignmentId: +body.assignmentId,
      studentId: user.id,
      fileUrl: `/uploads/${file.filename}`,
      fileName: file.originalname,
    });
  }

  @Post('submit')
  submit(@Body() body: any, @CurrentUser() user: any) {
    return this.service.submit({ ...body, studentId: user.id });
  }

  @Patch(':id/grade')
  @Roles('ADMIN','TEACHER')
  grade(@Param('id', ParseIntPipe) id: number, @Body() body: any, @CurrentUser() user: any) {
    return this.service.grade(id, { ...body, gradedBy: user.id, status: body.status || 'GRADED' });
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([Submission])],
  controllers: [SubmissionsController],
  providers: [SubmissionsService],
  exports: [SubmissionsService, TypeOrmModule],
})
export class SubmissionsModule {}
