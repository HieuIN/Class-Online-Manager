import {
  BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Injectable, Module, Param, ParseIntPipe,
  Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../common/roles.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { ensureUploadDir } from '../../common/upload-dir.util';

const pronunciationDir = () => ensureUploadDir('pronunciation');

const audioFilter = (_req: any, file: any, cb: any) => {
  cb(null, /^audio\//.test(file.mimetype) || file.mimetype === 'video/webm');
};

const audioUpload = FileInterceptor('file', {
  storage: diskStorage({
    destination: (_req, _file, cb) => cb(null, pronunciationDir()),
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const ext = extname(file.originalname) || (file.mimetype.includes('webm') ? '.webm' : '.audio');
      cb(null, `pronunciation-${unique}${ext}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: audioFilter,
});

@Injectable()
export class PronunciationService {
  constructor(private dataSource: DataSource) {}

  private async canAccessClass(user: any, classId: number) {
    if (user.role === 'ADMIN') return true;
    if (user.role === 'TEACHER') {
      const rows = await this.dataSource.query(`SELECT 1 FROM classes WHERE id = $1 AND teacher_id = $2`, [classId, user.id]);
      return !!rows[0];
    }
    const rows = await this.dataSource.query(
      `SELECT 1 FROM enrollments WHERE class_id = $1 AND student_id = $2 AND is_active = true`,
      [classId, user.id],
    );
    return !!rows[0];
  }

  private async ensureClassAccess(user: any, classId: number) {
    if (!(await this.canAccessClass(user, classId))) throw new ForbiddenException('No class access');
  }

  private async ensureTeacherAccess(user: any, classId: number) {
    if (user.role === 'ADMIN') return;
    if (user.role !== 'TEACHER') throw new ForbiddenException('Teacher only');
    const rows = await this.dataSource.query(`SELECT 1 FROM classes WHERE id = $1 AND teacher_id = $2`, [classId, user.id]);
    if (!rows[0]) throw new ForbiddenException('No class access');
  }

  private async exercise(id: number) {
    const rows = await this.dataSource.query(
      `SELECT pe.*, c.teacher_id
       FROM pronunciation_exercises pe
       JOIN classes c ON c.id = pe.class_id
       WHERE pe.id = $1`,
      [id],
    );
    if (!rows[0]) throw new ForbiddenException('Exercise not found');
    return rows[0];
  }

  async list(classId: number, user: any) {
    await this.ensureClassAccess(user, classId);
    const params: any[] = [classId];
    let studentSubmitJoin = '';
    if (user.role === 'STUDENT') {
      params.push(user.id);
      studentSubmitJoin = `
        LEFT JOIN pronunciation_submissions own
          ON own.exercise_id = pe.id AND own.student_id = $2
      `;
    }
    return this.dataSource.query(
      `SELECT pe.id, pe.class_id as "classId", pe.title, pe.prompt_text as "promptText", pe.pinyin,
              pe.meaning, pe.sample_audio_url as "sampleAudioUrl", pe.due_date as "dueDate",
              pe.created_by as "createdBy", pe.created_at as "createdAt",
              u.full_name as "createdByName",
              COUNT(ps.id)::int as "submissionCount"
              ${user.role === 'STUDENT' ? ', own.id as "mySubmissionId", own.status as "myStatus", own.score as "myScore", own.teacher_comment as "myTeacherComment"' : ''}
       FROM pronunciation_exercises pe
       LEFT JOIN users u ON u.id = pe.created_by
       LEFT JOIN pronunciation_submissions ps ON ps.exercise_id = pe.id
       ${studentSubmitJoin}
       WHERE pe.class_id = $1
       GROUP BY pe.id, u.full_name ${user.role === 'STUDENT' ? ', own.id, own.status, own.score, own.teacher_comment' : ''}
       ORDER BY pe.created_at DESC`,
      params,
    );
  }

  async create(body: any, file: any, user: any) {
    const classId = +body.classId;
    await this.ensureTeacherAccess(user, classId);
    return this.dataSource.query(
      `INSERT INTO pronunciation_exercises
        (class_id, title, prompt_text, pinyin, meaning, sample_audio_url, due_date, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, class_id as "classId", title, prompt_text as "promptText", pinyin, meaning,
                 sample_audio_url as "sampleAudioUrl", due_date as "dueDate", created_at as "createdAt"`,
      [
        classId,
        String(body.title || '').trim(),
        body.promptText || body.prompt_text || '',
        body.pinyin || null,
        body.meaning || null,
        file ? `/uploads/pronunciation/${file.filename}` : (body.sampleAudioUrl || null),
        body.dueDate || null,
        user.id,
      ],
    ).then(r => r[0]);
  }

  async update(id: number, body: any, file: any, user: any) {
    const ex = await this.exercise(id);
    await this.ensureTeacherAccess(user, +ex.class_id);
    return this.dataSource.query(
      `UPDATE pronunciation_exercises
       SET title = COALESCE($2, title),
           prompt_text = COALESCE($3, prompt_text),
           pinyin = $4,
           meaning = $5,
           sample_audio_url = COALESCE($6, sample_audio_url),
           due_date = $7
       WHERE id = $1
       RETURNING id, class_id as "classId", title, prompt_text as "promptText", pinyin, meaning,
                 sample_audio_url as "sampleAudioUrl", due_date as "dueDate", created_at as "createdAt"`,
      [
        id,
        body.title || null,
        body.promptText || body.prompt_text || null,
        body.pinyin || null,
        body.meaning || null,
        file ? `/uploads/pronunciation/${file.filename}` : (body.sampleAudioUrl || null),
        body.dueDate || null,
      ],
    ).then(r => r[0]);
  }

  async remove(id: number, user: any) {
    const ex = await this.exercise(id);
    await this.ensureTeacherAccess(user, +ex.class_id);
    await this.dataSource.query(`DELETE FROM pronunciation_exercises WHERE id = $1`, [id]);
    return { success: true };
  }

  async submissions(exerciseId: number, user: any) {
    const ex = await this.exercise(exerciseId);
    await this.ensureTeacherAccess(user, +ex.class_id);
    return this.dataSource.query(
      `SELECT u.id as "studentId", u.full_name as "studentName", u.email as "studentEmail",
              ps.id as "submissionId", ps.audio_url as "audioUrl", ps.duration_seconds as "durationSeconds",
              ps.score, ps.teacher_comment as "teacherComment", ps.status, ps.submitted_at as "submittedAt",
              ps.graded_at as "gradedAt"
       FROM enrollments e
       JOIN users u ON u.id = e.student_id
       LEFT JOIN pronunciation_submissions ps ON ps.exercise_id = $1 AND ps.student_id = u.id
       WHERE e.class_id = $2 AND e.is_active = true
       ORDER BY u.full_name`,
      [exerciseId, ex.class_id],
    );
  }

  async studentSubmissions(user: any, classId?: number) {
    const studentId = user.role === 'STUDENT' ? user.id : +user.id;
    const params: any[] = [studentId];
    let extra = '';
    if (classId) {
      params.push(classId);
      extra = ` AND pe.class_id = $${params.length}`;
    }
    return this.dataSource.query(
      `SELECT ps.id, ps.exercise_id as "exerciseId", ps.audio_url as "audioUrl", ps.duration_seconds as "durationSeconds",
              ps.score, ps.teacher_comment as "teacherComment", ps.status, ps.submitted_at as "submittedAt",
              pe.title, pe.class_id as "classId", c.name as "className"
       FROM pronunciation_submissions ps
       JOIN pronunciation_exercises pe ON pe.id = ps.exercise_id
       JOIN classes c ON c.id = pe.class_id
       WHERE ps.student_id = $1 ${extra}
       ORDER BY ps.submitted_at DESC`,
      params,
    );
  }

  async submit(exerciseId: number, body: any, file: any, user: any) {
    if (user.role !== 'STUDENT') throw new ForbiddenException('Student only');
    if (!file) throw new BadRequestException('Vui lòng chọn hoặc ghi một file audio hợp lệ');
    const ex = await this.exercise(exerciseId);
    await this.ensureClassAccess(user, +ex.class_id);
    return this.dataSource.query(
      `INSERT INTO pronunciation_submissions
        (exercise_id, student_id, audio_url, duration_seconds, status, submitted_at)
       VALUES ($1, $2, $3, $4, 'SUBMITTED', NOW())
       ON CONFLICT (exercise_id, student_id) DO UPDATE
       SET audio_url = EXCLUDED.audio_url,
           duration_seconds = EXCLUDED.duration_seconds,
           status = 'SUBMITTED',
           score = NULL,
           teacher_comment = NULL,
           submitted_at = NOW(),
           graded_at = NULL,
           graded_by = NULL
       RETURNING id, exercise_id as "exerciseId", audio_url as "audioUrl", duration_seconds as "durationSeconds",
                 score, teacher_comment as "teacherComment", status, submitted_at as "submittedAt"`,
      [exerciseId, user.id, `/uploads/pronunciation/${file.filename}`, body.durationSeconds || null],
    ).then(r => r[0]);
  }

  async grade(id: number, body: any, user: any) {
    const rows = await this.dataSource.query(
      `SELECT ps.*, pe.class_id
       FROM pronunciation_submissions ps
       JOIN pronunciation_exercises pe ON pe.id = ps.exercise_id
       WHERE ps.id = $1`,
      [id],
    );
    const sub = rows[0];
    if (!sub) throw new ForbiddenException('Submission not found');
    await this.ensureTeacherAccess(user, +sub.class_id);
    return this.dataSource.query(
      `UPDATE pronunciation_submissions
       SET score = $2,
           teacher_comment = $3,
           status = 'GRADED',
           graded_at = NOW(),
           graded_by = $4
       WHERE id = $1
       RETURNING id, exercise_id as "exerciseId", student_id as "studentId", audio_url as "audioUrl",
                 duration_seconds as "durationSeconds", score, teacher_comment as "teacherComment",
                 status, submitted_at as "submittedAt", graded_at as "gradedAt"`,
      [id, body.score, body.teacherComment || null, user.id],
    ).then(r => r[0]);
  }
}

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class PronunciationController {
  constructor(private service: PronunciationService) {}

  @Get('pronunciation-exercises')
  list(@Query('classId', ParseIntPipe) classId: number, @CurrentUser() user: any) {
    return this.service.list(classId, user);
  }

  @Post('pronunciation-exercises')
  @Roles('ADMIN', 'TEACHER')
  @UseInterceptors(audioUpload)
  create(@Body() body: any, @UploadedFile() file: any, @CurrentUser() user: any) {
    return this.service.create(body, file, user);
  }

  @Patch('pronunciation-exercises/:id')
  @Roles('ADMIN', 'TEACHER')
  @UseInterceptors(audioUpload)
  update(@Param('id', ParseIntPipe) id: number, @Body() body: any, @UploadedFile() file: any, @CurrentUser() user: any) {
    return this.service.update(id, body, file, user);
  }

  @Delete('pronunciation-exercises/:id')
  @Roles('ADMIN', 'TEACHER')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.service.remove(id, user);
  }

  @Get('pronunciation-exercises/:id/submissions')
  @Roles('ADMIN', 'TEACHER')
  submissions(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.service.submissions(id, user);
  }

  @Post('pronunciation-exercises/:id/submit')
  @Roles('STUDENT')
  @UseInterceptors(audioUpload)
  submit(@Param('id', ParseIntPipe) id: number, @Body() body: any, @UploadedFile() file: any, @CurrentUser() user: any) {
    return this.service.submit(id, body, file, user);
  }

  @Get('pronunciation-submissions')
  studentSubmissions(@Query('classId') classId: string, @CurrentUser() user: any) {
    return this.service.studentSubmissions(user, classId ? +classId : undefined);
  }

  @Patch('pronunciation-submissions/:id/grade')
  @Roles('ADMIN', 'TEACHER')
  grade(@Param('id', ParseIntPipe) id: number, @Body() body: any, @CurrentUser() user: any) {
    return this.service.grade(id, body, user);
  }
}

@Module({ controllers: [PronunciationController], providers: [PronunciationService] })
export class PronunciationModule {}
