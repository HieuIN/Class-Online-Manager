import { Body, Controller, Delete, Get, Injectable, Module, Param, ParseIntPipe, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../common/roles.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ensureUploadDir } from '../../common/upload-dir.util';

const galleryDir = () => ensureUploadDir('gallery');
const flashcardDir = () => ensureUploadDir('flashcards');

@Injectable()
export class LearningExtrasService {
  constructor(private dataSource: DataSource) {}

  submitAnonymousFeedback(classId: number, body: any, userId: number) {
    return this.dataSource.query(
      `INSERT INTO anonymous_feedbacks (class_id, rating, comment, submitter_hash)
       VALUES ($1, $2, $3, md5($4::text || ':' || $1::text))
       ON CONFLICT (class_id, submitter_hash) DO UPDATE
       SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, created_at = NOW()
       RETURNING id, class_id as "classId", rating, comment, created_at as "createdAt"`,
      [classId, body.rating, body.comment || null, userId],
    ).then(r => r[0]);
  }

  feedbackStats(classId: number) {
    return this.dataSource.query(
      `SELECT COUNT(*)::int as count, ROUND(AVG(rating)::numeric, 2)::float as "avgRating"
       FROM anonymous_feedbacks WHERE class_id = $1`,
      [classId],
    ).then(async ([stats]) => ({
      ...stats,
      comments: await this.dataSource.query(
        `SELECT id, rating, comment, created_at as "createdAt"
         FROM anonymous_feedbacks WHERE class_id = $1 ORDER BY created_at DESC`,
        [classId],
      ),
    }));
  }

  assignmentComments(assignmentId: number) {
    return this.dataSource.query(
      `SELECT ac.id, ac.content, ac.created_at as "createdAt", u.full_name as "authorName", u.avatar_url as "authorAvatar"
       FROM assignment_comments ac
       LEFT JOIN users u ON u.id = ac.user_id
       WHERE ac.assignment_id = $1
       ORDER BY ac.created_at`,
      [assignmentId],
    );
  }

  addAssignmentComment(assignmentId: number, userId: number, content: string) {
    return this.dataSource.query(
      `INSERT INTO assignment_comments (assignment_id, user_id, content)
       VALUES ($1, $2, $3)
       RETURNING id, content, created_at as "createdAt"`,
      [assignmentId, userId, content],
    ).then(r => r[0]);
  }

  decks(classId: number) {
    return this.dataSource.query(
      `SELECT d.*, COUNT(c.id)::int as "cardCount"
       FROM flashcard_decks d
       LEFT JOIN flashcards c ON c.deck_id = d.id
       WHERE d.class_id = $1
       GROUP BY d.id
       ORDER BY d.created_at DESC`,
      [classId],
    );
  }

  createDeck(body: any, userId: number) {
    return this.dataSource.query(
      `INSERT INTO flashcard_decks (class_id, title, description, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [body.classId, body.title, body.description || null, userId],
    ).then(r => r[0]);
  }

  cards(deckId: number) {
    return this.dataSource.query(`SELECT * FROM flashcards WHERE deck_id = $1 ORDER BY display_order, id`, [deckId]);
  }

  createCard(deckId: number, body: any) {
    return this.dataSource.query(
      `INSERT INTO flashcards (deck_id, front, back, example, display_order, media_url, media_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [deckId, body.front, body.back, body.example || null, body.displayOrder || 0, body.mediaUrl || null, body.mediaType || null],
    ).then(r => r[0]);
  }

  updateCard(cardId: number, body: any) {
    return this.dataSource.query(
      `UPDATE flashcards SET front = $1, back = $2, example = $3, media_url = $4, media_type = $5
       WHERE id = $6 RETURNING *`,
      [body.front, body.back, body.example || null, body.mediaUrl || null, body.mediaType || null, cardId],
    ).then(r => r[0] || null);
  }

  deleteCard(cardId: number) {
    return this.dataSource.query(`DELETE FROM flashcards WHERE id = $1 RETURNING id`, [cardId]).then(r => r[0] || null);
  }

  flashcardMedia(file: any) {
    const mediaType = file.mimetype.startsWith('image/')
      ? 'IMAGE'
      : file.mimetype.startsWith('audio/')
        ? 'AUDIO'
        : file.mimetype.startsWith('video/')
          ? 'VIDEO'
          : 'FILE';
    return { mediaUrl: `/uploads/flashcards/${file.filename}`, mediaType, mimeType: file.mimetype, fileName: file.originalname };
  }

  markCard(cardId: number, userId: number, remembered: boolean) {
    return this.dataSource.query(
      `INSERT INTO flashcard_progress (card_id, student_id, remembered, reviewed_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (card_id, student_id) DO UPDATE SET remembered = EXCLUDED.remembered, reviewed_at = NOW()
       RETURNING *`,
      [cardId, userId, remembered],
    ).then(r => r[0]);
  }

  hanziSets(classId: number, userId: number) {
    return this.dataSource.query(
      `SELECT s.*, COUNT(c.id)::int AS "characterCount",
              COUNT(p.id) FILTER (WHERE p.student_id = $2 AND p.completed = true)::int AS "completedCount"
       FROM hanzi_sets s LEFT JOIN hanzi_characters c ON c.set_id = s.id
       LEFT JOIN hanzi_practice_progress p ON p.character_id = c.id AND p.student_id = $2
       WHERE s.class_id = $1 GROUP BY s.id ORDER BY s.created_at DESC`, [classId, userId],
    );
  }

  createHanziSet(body: any, userId: number) {
    return this.dataSource.query(
      `INSERT INTO hanzi_sets (class_id, title, description, created_by) VALUES ($1,$2,$3,$4) RETURNING *`,
      [body.classId, body.title, body.description || null, userId],
    ).then(r => r[0]);
  }

  hanziCharacters(setId: number, userId: number) {
    return this.dataSource.query(
      `SELECT c.*, COALESCE(p.learned,false) AS learned, COALESCE(p.completed,false) AS completed,
              COALESCE(p.mistakes,0)::int AS mistakes, COALESCE(p.attempts,0)::int AS attempts
       FROM hanzi_characters c LEFT JOIN hanzi_practice_progress p ON p.character_id = c.id AND p.student_id = $2
       WHERE c.set_id = $1 ORDER BY c.display_order, c.id`, [setId, userId],
    );
  }

  createHanziCharacter(setId: number, body: any) {
    return this.dataSource.query(
      `INSERT INTO hanzi_characters (set_id, character, pinyin, meaning, note, example, stroke_gif_url, illustration_url, display_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [setId, body.character, body.pinyin || null, body.meaning, body.note || null, body.example || null,
       body.strokeGifUrl || null, body.illustrationUrl || null, body.displayOrder || 0],
    ).then(r => r[0]);
  }

  updateHanziCharacter(id: number, body: any) {
    return this.dataSource.query(
      `UPDATE hanzi_characters SET character=$1,pinyin=$2,meaning=$3,note=$4,example=$5,stroke_gif_url=$6,illustration_url=$7,display_order=$8
       WHERE id=$9 RETURNING *`,
      [body.character, body.pinyin || null, body.meaning, body.note || null, body.example || null,
       body.strokeGifUrl || null, body.illustrationUrl || null, body.displayOrder || 0, id],
    ).then(r => r[0] || null);
  }

  deleteHanziCharacter(id: number) {
    return this.dataSource.query(`DELETE FROM hanzi_characters WHERE id=$1 RETURNING id`, [id]).then(r => r[0] || null);
  }

  saveHanziProgress(characterId: number, studentId: number, body: any) {
    return this.dataSource.query(
      `INSERT INTO hanzi_practice_progress (character_id,student_id,learned,completed,mistakes,attempts,completed_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,CASE WHEN $4 THEN NOW() ELSE NULL END,NOW())
       ON CONFLICT (character_id,student_id) DO UPDATE SET
         learned=hanzi_practice_progress.learned OR EXCLUDED.learned,
         completed=hanzi_practice_progress.completed OR EXCLUDED.completed,
         mistakes=hanzi_practice_progress.mistakes + EXCLUDED.mistakes,
         attempts=hanzi_practice_progress.attempts + EXCLUDED.attempts,
         completed_at=CASE WHEN EXCLUDED.completed THEN NOW() ELSE hanzi_practice_progress.completed_at END,
         updated_at=NOW() RETURNING *`,
      [characterId, studentId, !!body.learned, !!body.completed, Number(body.mistakes || 0), Number(body.attempts || 0)],
    ).then(r => r[0]);
  }

  transcript(studentId: number) {
    return this.dataSource.query(
      `SELECT c.id as "classId", c.name as "className", e.enrolled_at as "enrolledAt",
              COUNT(DISTINCT s.id)::int as "totalSessions",
              COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'DONE')::int as "doneSessions",
              ROUND((SUM(g.score * gi.weight) / NULLIF(SUM(gi.weight), 0))::numeric, 2)::float as "averageScore",
              cert.id as "certificateId", cert.cert_number as "certificateNumber"
       FROM enrollments e
       JOIN classes c ON c.id = e.class_id
       LEFT JOIN sessions s ON s.class_id = c.id
       LEFT JOIN grade_items gi ON gi.class_id = c.id
       LEFT JOIN grades g ON g.grade_item_id = gi.id AND g.student_id = e.student_id
       LEFT JOIN certificates cert ON cert.enrollment_id = e.id
       WHERE e.student_id = $1
       GROUP BY c.id, c.name, e.enrolled_at, cert.id, cert.cert_number
       ORDER BY e.enrolled_at DESC`,
      [studentId],
    );
  }

  async duplicateClass(id: number, body: any) {
    const [created] = await this.dataSource.query(
      `INSERT INTO classes (course_id, name, teacher_id, total_sessions, tuition_fee, start_date, end_date, schedule_note, is_active)
       SELECT course_id, $2, teacher_id, total_sessions, tuition_fee, COALESCE($3::date, start_date), end_date, COALESCE($4, schedule_note), true
       FROM classes WHERE id = $1 RETURNING *`,
      [id, body.name || `Copy of class ${id}`, body.startDate || null, body.scheduleNote || null],
    );
    await this.dataSource.query(
      `INSERT INTO grade_items (class_id, name, weight, max_score, display_order)
       SELECT $2, name, weight, max_score, display_order FROM grade_items WHERE class_id = $1`,
      [id, created.id],
    );
    if (body.copySessions) {
      await this.dataSource.query(
        `INSERT INTO sessions (class_id, session_no, planned_date, start_time, end_time, topic, status, note, meeting_url)
         SELECT $2, session_no, planned_date, start_time, end_time, topic, 'PLANNED', note, meeting_url FROM sessions WHERE class_id = $1`,
        [id, created.id],
      );
    }
    return created;
  }

  gallery(classId: number) {
    return this.dataSource.query(
      `SELECT id, class_id as "classId", file_url as "fileUrl", caption, created_at as "createdAt"
       FROM class_gallery WHERE class_id = $1 ORDER BY created_at DESC`,
      [classId],
    );
  }

  addGallery(classId: number, file: any, caption: string, userId: number) {
    return this.dataSource.query(
      `INSERT INTO class_gallery (class_id, file_url, caption, uploaded_by)
       VALUES ($1, $2, $3, $4) RETURNING id, class_id as "classId", file_url as "fileUrl", caption`,
      [classId, `/uploads/gallery/${file.filename}`, caption || null, userId],
    ).then(r => r[0]);
  }

  removeGallery(id: number) { return this.dataSource.query(`DELETE FROM class_gallery WHERE id = $1`, [id]); }

  async reorderGradeItems(items: Array<{ id: number; displayOrder: number }>) {
    for (const item of items || []) {
      await this.dataSource.query(`UPDATE grade_items SET display_order = $1 WHERE id = $2`, [item.displayOrder, item.id]);
    }
    return { success: true };
  }

  async reorderSessions(items: Array<{ id: number; sessionNo: number }>) {
    for (const item of items || []) {
      await this.dataSource.query(`UPDATE sessions SET session_no = $1 WHERE id = $2`, [item.sessionNo, item.id]);
    }
    return { success: true };
  }

  sentiment(text: string) {
    const content = String(text || '').toLowerCase();
    const positive = ['tốt', 'hay', 'dễ hiểu', 'hài lòng', 'thích', 'tuyệt', 'cảm ơn'];
    const negative = ['khó hiểu', 'chậm', 'không hài lòng', 'tệ', 'mệt', 'quá khó', 'không thích'];
    const score = positive.filter(w => content.includes(w)).length - negative.filter(w => content.includes(w)).length;
    return { sentiment: score > 0 ? 'POSITIVE' : score < 0 ? 'NEGATIVE' : 'NEUTRAL', score };
  }
}

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class LearningExtrasController {
  constructor(private service: LearningExtrasService) {}

  @Post('anonymous-feedback/:classId') submitFeedback(@Param('classId', ParseIntPipe) classId: number, @Body() body: any, @CurrentUser() user: any) {
    return this.service.submitAnonymousFeedback(classId, body, user.id);
  }
  @Get('anonymous-feedback/:classId') @Roles('ADMIN','TEACHER') feedbackStats(@Param('classId', ParseIntPipe) classId: number) {
    return this.service.feedbackStats(classId);
  }
  @Get('assignments/:id/comments') comments(@Param('id', ParseIntPipe) id: number) { return this.service.assignmentComments(id); }
  @Post('assignments/:id/comments') addComment(@Param('id', ParseIntPipe) id: number, @Body() body: any, @CurrentUser() user: any) {
    return this.service.addAssignmentComment(id, user.id, body.content);
  }
  @Get('flashcards/decks') decks(@Query('classId', ParseIntPipe) classId: number) { return this.service.decks(classId); }
  @Post('flashcards/decks') @Roles('ADMIN','TEACHER') createDeck(@Body() body: any, @CurrentUser() user: any) { return this.service.createDeck(body, user.id); }
  @Get('flashcards/decks/:id/cards') cards(@Param('id', ParseIntPipe) id: number) { return this.service.cards(id); }
  @Post('flashcards/decks/:id/cards') @Roles('ADMIN','TEACHER') createCard(@Param('id', ParseIntPipe) id: number, @Body() body: any) { return this.service.createCard(id, body); }
  @Patch('flashcards/cards/:id') @Roles('ADMIN','TEACHER') updateCard(@Param('id', ParseIntPipe) id: number, @Body() body: any) { return this.service.updateCard(id, body); }
  @Delete('flashcards/cards/:id') @Roles('ADMIN','TEACHER') deleteCard(@Param('id', ParseIntPipe) id: number) { return this.service.deleteCard(id); }
  @Post('flashcards/media')
  @Roles('ADMIN','TEACHER')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (_req, _file, cb) => cb(null, flashcardDir()),
      filename: (_req, file, cb) => cb(null, `flashcard-${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname)}`),
    }),
    limits: { fileSize: 25 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => cb(null, /^(image|audio|video)\//.test(file.mimetype) || file.mimetype === 'application/pdf'),
  }))
  uploadFlashcardMedia(@UploadedFile() file: any) { return this.service.flashcardMedia(file); }
  @Patch('flashcards/cards/:id/progress') markCard(@Param('id', ParseIntPipe) id: number, @Body() body: any, @CurrentUser() user: any) {
    return this.service.markCard(id, user.id, !!body.remembered);
  }
  @Get('hanzi/sets') hanziSets(@Query('classId', ParseIntPipe) classId: number, @CurrentUser() user: any) { return this.service.hanziSets(classId, user.id); }
  @Post('hanzi/sets') @Roles('ADMIN','TEACHER') createHanziSet(@Body() body: any, @CurrentUser() user: any) { return this.service.createHanziSet(body, user.id); }
  @Get('hanzi/sets/:id/characters') hanziCharacters(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) { return this.service.hanziCharacters(id, user.id); }
  @Post('hanzi/sets/:id/characters') @Roles('ADMIN','TEACHER') createHanziCharacter(@Param('id', ParseIntPipe) id: number, @Body() body: any) { return this.service.createHanziCharacter(id, body); }
  @Patch('hanzi/characters/:id') @Roles('ADMIN','TEACHER') updateHanziCharacter(@Param('id', ParseIntPipe) id: number, @Body() body: any) { return this.service.updateHanziCharacter(id, body); }
  @Delete('hanzi/characters/:id') @Roles('ADMIN','TEACHER') deleteHanziCharacter(@Param('id', ParseIntPipe) id: number) { return this.service.deleteHanziCharacter(id); }
  @Patch('hanzi/characters/:id/progress') @Roles('STUDENT') saveHanziProgress(@Param('id', ParseIntPipe) id: number, @Body() body: any, @CurrentUser() user: any) { return this.service.saveHanziProgress(id, user.id, body); }
  @Get('students/:id/transcript') transcript(@Param('id', ParseIntPipe) id: number) { return this.service.transcript(id); }
  @Post('classes/:id/duplicate') @Roles('ADMIN','TEACHER') duplicate(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.service.duplicateClass(id, body);
  }
  @Get('gallery') gallery(@Query('classId', ParseIntPipe) classId: number) { return this.service.gallery(classId); }
  @Post('gallery/:classId')
  @Roles('ADMIN','TEACHER')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (_req, _file, cb) => cb(null, galleryDir()),
      filename: (_req, file, cb) => cb(null, `gallery-${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname)}`),
    }),
    limits: { fileSize: 8 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => cb(null, /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)),
  }))
  addGallery(@Param('classId', ParseIntPipe) classId: number, @UploadedFile() file: any, @Body('caption') caption: string, @CurrentUser() user: any) {
    return this.service.addGallery(classId, file, caption, user.id);
  }
  @Delete('gallery/:id') @Roles('ADMIN','TEACHER') removeGallery(@Param('id', ParseIntPipe) id: number) { return this.service.removeGallery(id); }
  @Patch('grade-items/reorder') @Roles('ADMIN','TEACHER') reorderGradeItems(@Body() body: any) {
    return this.service.reorderGradeItems(body.items || []);
  }
  @Patch('sessions/reorder') @Roles('ADMIN','TEACHER') reorderSessions(@Body() body: any) {
    return this.service.reorderSessions(body.items || []);
  }
  @Post('feedback/sentiment') sentiment(@Body() body: any) { return this.service.sentiment(body.text); }
}

@Module({ controllers: [LearningExtrasController], providers: [LearningExtrasService] })
export class LearningExtrasModule {}
