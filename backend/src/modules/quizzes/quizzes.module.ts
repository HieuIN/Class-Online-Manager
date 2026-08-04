import {
  Body, Controller, Delete, ForbiddenException, Get, Injectable, Module, NotFoundException,
  Param, ParseIntPipe, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ensureUploadDir } from '../../common/upload-dir.util';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Repository, DataSource } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../common/roles.guard';
import { CurrentUser } from '../../common/current-user.decorator';

@Entity('quizzes')
export class Quiz {
  @PrimaryGeneratedColumn() id: number;
  @Column({ name: 'class_id' }) classId: number;
  @Column() title: string;
  @Column({ type: 'text', nullable: true }) description: string;
  @Column({ name: 'time_limit_minutes', nullable: true }) timeLimitMinutes: number;
  @Column({ name: 'available_from', type: 'timestamp', nullable: true }) availableFrom: Date;
  @Column({ name: 'available_until', type: 'timestamp', nullable: true }) availableUntil: Date;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Entity('quiz_questions')
export class QuizQuestion {
  @PrimaryGeneratedColumn() id: number;
  @Column({ name: 'quiz_id' }) quizId: number;
  @Column({ type: 'text' }) question: string;
  @Column({ name: 'option_a', type: 'text', nullable: true }) optionA: string;
  @Column({ name: 'option_b', type: 'text', nullable: true }) optionB: string;
  @Column({ name: 'option_c', type: 'text', nullable: true }) optionC: string;
  @Column({ name: 'option_d', type: 'text', nullable: true }) optionD: string;
  @Column({ name: 'correct_answer', length: 1, nullable: true }) correctAnswer: string;
  @Column({ name: 'question_type', default: 'SINGLE_CHOICE' }) questionType: string;
  @Column({ name: 'media_url', type: 'text', nullable: true }) mediaUrl: string;
  @Column({ name: 'media_type', nullable: true }) mediaType: string;
  @Column({ type: 'jsonb', default: {} }) config: Record<string, any>;
  @Column({ type: 'text', nullable: true }) explanation: string;
  @Column({ type: 'numeric', precision: 5, scale: 2, default: 1 }) points: number;
  @Column({ name: 'display_order', default: 0 }) displayOrder: number;
}

@Entity('quiz_attempts')
export class QuizAttempt {
  @PrimaryGeneratedColumn() id: number;
  @Column({ name: 'quiz_id' }) quizId: number;
  @Column({ name: 'student_id' }) studentId: number;
  @Column({ type: 'jsonb', nullable: true }) answers: Record<string, string>;
  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true }) score: number;
  @CreateDateColumn({ name: 'started_at' }) startedAt: Date;
  @Column({ name: 'submitted_at', type: 'timestamp', nullable: true }) submittedAt: Date;
  @Column({ name: 'needs_manual_grading', default: false }) needsManualGrading: boolean;
}

@Injectable()
export class QuizzesService {
  constructor(
    @InjectRepository(Quiz) private quizRepo: Repository<Quiz>,
    @InjectRepository(QuizQuestion) private questionRepo: Repository<QuizQuestion>,
    @InjectRepository(QuizAttempt) private attemptRepo: Repository<QuizAttempt>,
    private dataSource: DataSource,
  ) {}

  private async classAccess(user: any, classId: number) {
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

  private async requireClassAccess(user: any, classId: number) {
    if (!(await this.classAccess(user, classId))) throw new ForbiddenException('No class access');
  }

  private async requireTeacher(user: any, classId: number) {
    if (user.role === 'ADMIN') return;
    if (user.role !== 'TEACHER') throw new ForbiddenException('Teacher only');
    const rows = await this.dataSource.query(`SELECT 1 FROM classes WHERE id = $1 AND teacher_id = $2`, [classId, user.id]);
    if (!rows[0]) throw new ForbiddenException('No class access');
  }

  private async quizWithClass(id: number) {
    const quiz = await this.quizRepo.findOne({ where: { id } });
    if (!quiz) throw new NotFoundException('Quiz not found');
    return quiz;
  }

  async list(classId: number, user: any) {
    await this.requireClassAccess(user, classId);
    return this.dataSource.query(
      `SELECT q.id, q.class_id, q.title, q.description, q.time_limit_minutes, q.available_from, q.available_until, q.created_at,
              COUNT(DISTINCT qq.id)::int as "questionCount",
              COUNT(DISTINCT qa.id)::int as "attemptCount"
       FROM quizzes q
       LEFT JOIN quiz_questions qq ON qq.quiz_id = q.id
       LEFT JOIN quiz_attempts qa ON qa.quiz_id = q.id
       WHERE q.class_id = $1
       GROUP BY q.id
       ORDER BY q.created_at DESC`,
      [classId],
    );
  }

  async create(body: any, user: any) {
    const classId = +body.classId;
    await this.requireTeacher(user, classId);
    const quiz = await this.quizRepo.save(this.quizRepo.create({
      classId,
      title: String(body.title || '').trim(),
      description: body.description || null,
      timeLimitMinutes: body.timeLimitMinutes || null,
      availableFrom: body.availableFrom || null,
      availableUntil: body.availableUntil || null,
    }));
    await this.saveQuestions(quiz.id, body.questions || []);
    return this.full(quiz.id, user);
  }

  private async saveQuestions(quizId: number, questions: any[]) {
    await this.questionRepo.delete({ quizId });
    const rows = questions
      .filter(q => String(q.question || '').trim())
      .map((q, idx) => this.questionRepo.create({
        quizId,
        question: String(q.question).trim(),
        optionA: q.optionA || q.option_a || '',
        optionB: q.optionB || q.option_b || '',
        optionC: q.optionC || q.option_c || '',
        optionD: q.optionD || q.option_d || '',
        correctAnswer: String(q.correctAnswer || q.correct_answer || 'A').toUpperCase(),
        questionType: q.questionType || q.question_type || 'SINGLE_CHOICE',
        mediaUrl: q.mediaUrl || q.media_url || null,
        mediaType: q.mediaType || q.media_type || null,
        config: q.config || {},
        explanation: q.explanation || null,
        points: +(q.points || 1),
        displayOrder: q.displayOrder ?? idx,
      }));
    if (rows.length) await this.questionRepo.save(rows);
  }

  async update(id: number, body: any, user: any) {
    const quiz = await this.quizWithClass(id);
    await this.requireTeacher(user, quiz.classId);
    await this.quizRepo.update(id, {
      title: body.title,
      description: body.description || null,
      timeLimitMinutes: body.timeLimitMinutes || null,
      availableFrom: body.availableFrom || null,
      availableUntil: body.availableUntil || null,
    });
    if (Array.isArray(body.questions)) await this.saveQuestions(id, body.questions);
    return this.full(id, user);
  }

  async remove(id: number, user: any) {
    const quiz = await this.quizWithClass(id);
    await this.requireTeacher(user, quiz.classId);
    await this.quizRepo.delete(id);
    return { success: true };
  }

  async detail(id: number, user: any, includeCorrect = false) {
    const quiz = await this.quizWithClass(id);
    await (includeCorrect ? this.requireTeacher(user, quiz.classId) : this.requireClassAccess(user, quiz.classId));
    const questions = await this.questionRepo.find({ where: { quizId: id }, order: { displayOrder: 'ASC', id: 'ASC' } });
    const studentQuestion = ({ correctAnswer, config, ...q }: QuizQuestion) => {
      const safe: any = { ...(config || {}) };
      delete safe.correctAnswers; delete safe.correctOrder; delete safe.correctPairs; delete safe.correctGroups; delete safe.acceptableAnswers; delete safe.correctArea;
      if (q.questionType === 'MATCHING') {
        const shuffle = (items: any[]) => { const result = [...items]; for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; } return result; };
        const pairs = (config?.pairs || []).map((p: any, index: number) => ({
          id: p.id || `pair-${index}`,
          leftText: p.leftText ?? p.left ?? '', leftImage: p.leftImage ?? p.image ?? '',
          rightText: p.rightText ?? p.right ?? '', rightImage: p.rightImage ?? '',
        }));
        safe.leftItems = shuffle(pairs.map((p: any) => ({ id: p.id, text: p.leftText, image: p.leftImage })));
        safe.rightOptions = shuffle(pairs.map((p: any) => ({ id: p.id, text: p.rightText, image: p.rightImage })));
        delete safe.pairs;
      }
      if (q.questionType === 'ORDERING') safe.items = [...(config?.correctOrder || [])].sort(() => Math.random() - .5);
      if (q.questionType === 'CLASSIFICATION') safe.classItems = (config?.classItems || []).map((i: any) => ({ text: i.text, image: i.image || '' }));
      return { ...q, config: safe };
    };
    return {
      ...quiz,
      questions: includeCorrect ? questions : questions.map(studentQuestion),
    };
  }

  full(id: number, user: any) {
    return this.detail(id, user, true);
  }

  async start(id: number, user: any) {
    const quiz = await this.quizWithClass(id);
    await this.requireClassAccess(user, quiz.classId);
    if (user.role !== 'STUDENT') throw new ForbiddenException('Student only');
    const attempt = await this.attemptRepo.save(this.attemptRepo.create({ quizId: id, studentId: user.id }));
    return attempt;
  }

  async submitAttempt(id: number, body: any, user: any) {
    const attempt = await this.attemptRepo.findOne({ where: { id } });
    if (!attempt) throw new NotFoundException('Attempt not found');
    if (user.role !== 'ADMIN' && +attempt.studentId !== +user.id) throw new ForbiddenException('No permission');
    if (attempt.submittedAt) throw new ForbiddenException('Attempt already submitted');

    const quiz = await this.quizWithClass(attempt.quizId);
    await this.requireClassAccess(user, quiz.classId);
    const questions = await this.questionRepo.find({ where: { quizId: attempt.quizId } });
    const answers = body.answers || {};
    let needsManualGrading = false;
    const normalized = (value: any) => String(value ?? '').trim().toLocaleLowerCase('vi').replace(/\s+/g, ' ');
    const sameArray = (a: any, b: any, sort = false) => {
      const aa = Array.isArray(a) ? a.map(String) : [];
      const bb = Array.isArray(b) ? b.map(String) : [];
      if (sort) { aa.sort(); bb.sort(); }
      return JSON.stringify(aa) === JSON.stringify(bb);
    };
    const score = questions.reduce((sum, q) => {
      const type = q.questionType || 'SINGLE_CHOICE';
      const answer = answers[q.id];
      const config: any = q.config || {};
      let correct = false;
      if (['SINGLE_CHOICE','TRUE_FALSE','IMAGE_CHOICE','AUDIO_CHOICE','READING'].includes(type)) correct = normalized(answer) === normalized(q.correctAnswer);
      else if (type === 'MULTIPLE_CHOICE') correct = sameArray(answer, config.correctAnswers || String(q.correctAnswer || '').split(','), true);
      else if (['TEXT_INPUT','FILL_BLANK','LISTEN_TYPE','DRAG_BLANK'].includes(type)) correct = (config.acceptableAnswers || [q.correctAnswer]).some((item: any) => normalized(item) === normalized(answer));
      else if (type === 'ORDERING') correct = sameArray(answer, config.correctOrder || []);
      else if (type === 'MATCHING') {
        const expected = (config.pairs || []).length
          ? Object.fromEntries((config.pairs || []).map((p: any, index: number) => { const id = p.id || `pair-${index}`; return [id, id]; }))
          : (config.correctPairs || {});
        const submitted = answer || {};
        correct = Object.keys(expected).length === Object.keys(submitted).length
          && Object.entries(expected).every(([key, value]) => submitted[key] === value);
      }
      else if (type === 'CLASSIFICATION') correct = JSON.stringify(answer || {}) === JSON.stringify(config.correctGroups || {});
      else if (type === 'IMAGE_HOTSPOT') {
        const point = answer || {}, rect = config.correctArea || {};
        correct = Number(point.x) >= Number(rect.x) && Number(point.x) <= Number(rect.x) + Number(rect.width) && Number(point.y) >= Number(rect.y) && Number(point.y) <= Number(rect.y) + Number(rect.height);
      } else if (type === 'HANZI_WRITE') correct = !!answer?.completed;
      else if (type === 'RECORDING') needsManualGrading = true;
      return sum + (correct ? +q.points : 0);
    }, 0);
    await this.attemptRepo.update(id, { answers, score, needsManualGrading, submittedAt: new Date() });
    return this.attemptResult(id, user);
  }

  async attempts(query: any, user: any) {
    if (query.quizId) {
      const quiz = await this.quizWithClass(+query.quizId);
      await this.requireTeacher(user, quiz.classId);
      return this.dataSource.query(
        `SELECT qa.id, qa.quiz_id, qa.student_id, qa.answers, qa.score, qa.started_at, qa.submitted_at, qa.needs_manual_grading,
                u.full_name as "studentName", u.email as "studentEmail"
         FROM quiz_attempts qa
         JOIN users u ON u.id = qa.student_id
         WHERE qa.quiz_id = $1
         ORDER BY qa.started_at DESC`,
        [+query.quizId],
      );
    }
    const studentId = query.studentId ? +query.studentId : user.id;
    if (user.role === 'STUDENT' && +user.id !== studentId) throw new ForbiddenException('No permission');
    return this.dataSource.query(
      `SELECT qa.id, qa.quiz_id, qa.student_id, qa.answers, qa.score, qa.started_at, qa.submitted_at, qa.needs_manual_grading,
              q.title as "quizTitle", q.class_id as "classId", c.name as "className"
       FROM quiz_attempts qa
       JOIN quizzes q ON q.id = qa.quiz_id
       JOIN classes c ON c.id = q.class_id
       WHERE qa.student_id = $1
       ORDER BY qa.started_at DESC`,
      [studentId],
    );
  }

  async attemptResult(id: number, user: any) {
    const rows = await this.dataSource.query(
      `SELECT qa.id, qa.quiz_id, qa.student_id, qa.answers, qa.score, qa.started_at, qa.submitted_at, qa.needs_manual_grading,
              q.title as "quizTitle", q.class_id as "classId"
       FROM quiz_attempts qa
       JOIN quizzes q ON q.id = qa.quiz_id
       WHERE qa.id = $1`,
      [id],
    );
    const attempt = rows[0];
    if (!attempt) throw new NotFoundException('Attempt not found');
    if (user.role === 'STUDENT' && +attempt.student_id !== +user.id) throw new ForbiddenException('No permission');
    await this.requireClassAccess(user, +attempt.classId);
    const questions = await this.questionRepo.find({ where: { quizId: +attempt.quiz_id }, order: { displayOrder: 'ASC', id: 'ASC' } });
    return { ...attempt, questions };
  }

  async gradeAttempt(id: number, score: number, user: any) {
    const attempt = await this.attemptRepo.findOne({ where: { id } });
    if (!attempt) throw new NotFoundException('Attempt not found');
    const quiz = await this.quizWithClass(attempt.quizId);
    await this.requireTeacher(user, quiz.classId);
    await this.attemptRepo.update(id, { score: Math.max(0, Number(score || 0)), needsManualGrading: false });
    return this.attemptResult(id, user);
  }
}

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class QuizzesController {
  constructor(private readonly service: QuizzesService) {}

  @Get('quizzes') list(@Query('classId', ParseIntPipe) classId: number, @CurrentUser() user: any) {
    return this.service.list(classId, user);
  }

  @Post('quizzes') @Roles('ADMIN', 'TEACHER') create(@Body() body: any, @CurrentUser() user: any) {
    return this.service.create(body, user);
  }

  @Patch('quizzes/:id') @Roles('ADMIN', 'TEACHER') update(@Param('id', ParseIntPipe) id: number, @Body() body: any, @CurrentUser() user: any) {
    return this.service.update(id, body, user);
  }

  @Delete('quizzes/:id') @Roles('ADMIN', 'TEACHER') remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.service.remove(id, user);
  }

  @Get('quizzes/:id') detail(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.service.detail(id, user, false);
  }

  @Get('quizzes/:id/full') @Roles('ADMIN', 'TEACHER') full(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.service.full(id, user);
  }

  @Post('quizzes/:id/start') @Roles('STUDENT') start(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.service.start(id, user);
  }

  @Post('quiz-attempts/:id/submit') @Roles('STUDENT', 'ADMIN') submit(@Param('id', ParseIntPipe) id: number, @Body() body: any, @CurrentUser() user: any) {
    return this.service.submitAttempt(id, body, user);
  }

  @Get('quiz-attempts') attempts(@Query() query: any, @CurrentUser() user: any) {
    return this.service.attempts(query, user);
  }

  @Get('quiz-attempts/:id') result(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.service.attemptResult(id, user);
  }
  @Patch('quiz-attempts/:id/grade') @Roles('ADMIN','TEACHER') grade(@Param('id', ParseIntPipe) id: number, @Body() body: any, @CurrentUser() user: any) {
    return this.service.gradeAttempt(id, body.score, user);
  }

  @Post('quiz-media')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({ destination: (_req, _file, cb) => cb(null, ensureUploadDir('quizzes')), filename: (_req, file, cb) => cb(null, `quiz-${Date.now()}-${Math.round(Math.random()*1e9)}${extname(file.originalname)}`) }),
    limits: { fileSize: 40 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => cb(null, /^(image|audio|video)\//.test(file.mimetype)),
  }))
  uploadMedia(@UploadedFile() file: any) {
    const mediaType = file.mimetype.startsWith('image/') ? 'IMAGE' : file.mimetype.startsWith('audio/') ? 'AUDIO' : 'VIDEO';
    return { mediaUrl: `/uploads/quizzes/${file.filename}`, mediaType };
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([Quiz, QuizQuestion, QuizAttempt])],
  controllers: [QuizzesController],
  providers: [QuizzesService],
})
export class QuizzesModule {}
