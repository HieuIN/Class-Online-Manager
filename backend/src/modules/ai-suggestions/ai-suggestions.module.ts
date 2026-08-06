import Anthropic from '@anthropic-ai/sdk';
import { BadRequestException, Body, Controller, Injectable, Module, Post, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../common/roles.guard';
import { CurrentUser } from '../../common/current-user.decorator';

@Injectable()
export class AiSuggestionsService {
  constructor(
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  async suggestFeedback(studentId: number, classId: number) {
    if (!studentId || !classId) {
      throw new BadRequestException('studentId and classId are required');
    }

    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException('ANTHROPIC_API_KEY is not configured');
    }

    const [student] = await this.dataSource.query(
      `SELECT u.full_name as "studentName", c.name as "className"
       FROM users u
       JOIN enrollments e ON e.student_id = u.id
       JOIN classes c ON c.id = e.class_id
       WHERE u.id = $1 AND c.id = $2 AND e.is_active = true`,
      [studentId, classId],
    );
    if (!student) throw new BadRequestException('Student is not enrolled in this class');

    const grades = await this.dataSource.query(
      `SELECT gi.name, gi.max_score as "maxScore", g.score
       FROM grade_items gi
       LEFT JOIN grades g ON g.grade_item_id = gi.id AND g.student_id = $2
       WHERE gi.class_id = $1
       ORDER BY gi.display_order, gi.id`,
      [classId, studentId],
    );

    const [attendance] = await this.dataSource.query(
      `SELECT COUNT(*)::int as total,
              COUNT(*) FILTER (WHERE COALESCE(a.status, 'PRESENT') = 'PRESENT')::int as present,
              COUNT(*) FILTER (WHERE a.status = 'ABSENT')::int as absent,
              COUNT(*) FILTER (WHERE a.status IN ('LATE', 'LEFT_EARLY'))::int as late
       FROM sessions s
       LEFT JOIN attendance a ON a.session_id = s.id AND a.student_id = $2
       WHERE s.class_id = $1 AND s.status = 'DONE'`,
      [classId, studentId],
    );

    const [assignments] = await this.dataSource.query(
      `SELECT COUNT(a.id)::int as total,
              COUNT(s.id) FILTER (WHERE s.status IS NULL OR s.status <> 'NOT_SUBMITTED')::int as submitted
       FROM assignments a
       LEFT JOIN submissions s ON s.assignment_id = a.id AND s.student_id = $2
       WHERE a.class_id = $1 AND a.is_required = true`,
      [classId, studentId],
    );

    const totalSessions = attendance?.total || 0;
    const present = attendance?.present || 0;
    const absent = attendance?.absent || 0;
    const late = attendance?.late || 0;
    const attendanceRate = totalSessions ? Math.round((present / totalSessions) * 100) : 0;
    const submitted = assignments?.submitted || 0;
    const totalAssignments = assignments?.total || 0;
    const gradeList = grades.length
      ? grades.map((g: any) => `${g.name}: ${g.score ?? 'chưa có điểm'}/${g.maxScore}`).join(', ')
      : 'Chưa có cột điểm';

    const prompt = `Bạn là GV. Học viên ${student.studentName} trong lớp ${student.className}. Dữ liệu:
- Điểm: ${gradeList}
- Chuyên cần: ${attendanceRate}% (${present}/${totalSessions} buổi có mặt, vắng ${absent} buổi, đi muộn ${late} buổi)
- Bài tập: nộp ${submitted}/${totalAssignments} bài
Hãy viết 2-3 câu nhận xét bằng tiếng Việt, mang tính xây dựng, gợi ý cải thiện. Chỉ trả về nội dung nhận xét, không thêm tiêu đề.`;

    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const suggestion = response.content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('\n')
      .trim();

    return { suggestion };
  }

  private async ensureManager(user: any, classId: number) {
    if (user.role === 'ADMIN') return;
    const rows = await this.dataSource.query(
      `SELECT 1 FROM classes WHERE id = $1 AND teacher_id = $2 AND is_active = true`,
      [classId, user.id],
    );
    if (!rows[0]) throw new BadRequestException('Bạn không có quyền chấm bài của lớp này');
  }

  async suggestAssignmentReview(submissionId: number, user: any) {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) throw new ServiceUnavailableException('ANTHROPIC_API_KEY is not configured');
    const [submission] = await this.dataSource.query(
      `SELECT s.id, s.content_text as "contentText", s.file_name as "fileName", u.full_name as "studentName",
              a.title as "assignmentTitle", a.description as "assignmentDescription", a.class_id as "classId", a.max_score as "maxScore"
       FROM submissions s JOIN assignments a ON a.id = s.assignment_id JOIN users u ON u.id = s.student_id
       WHERE s.id = $1`,
      [submissionId],
    );
    if (!submission) throw new BadRequestException('Không tìm thấy bài nộp');
    await this.ensureManager(user, submission.classId);
    const rubrics = await this.dataSource.query(
      `SELECT criterion, description, max_points as "maxPoints" FROM assignment_rubrics
       WHERE assignment_id = (SELECT assignment_id FROM submissions WHERE id = $1) ORDER BY display_order, id`,
      [submissionId],
    );
    const rubricText = rubrics.length
      ? rubrics.map((rubric: any) => `- ${rubric.criterion} (${rubric.maxPoints} điểm): ${rubric.description || 'Không có mô tả'}`).join('\n')
      : 'Không có rubric.';
    const submissionText = String(submission.contentText || '').trim() || `(Học viên nộp tệp: ${submission.fileName || 'không có nội dung văn bản'})`;
    const prompt = `Bạn là trợ lý chấm bài cho giáo viên. Hãy hỗ trợ nhận xét bằng tiếng Việt, không tự khẳng định học viên vi phạm.
Bài tập: ${submission.assignmentTitle}
Yêu cầu: ${submission.assignmentDescription || 'Không có mô tả'}
Thang điểm tối đa: ${submission.maxScore}
Rubric:
${rubricText}
Học viên: ${submission.studentName}
Nội dung bài làm:
${submissionText}

Trả lời gồm đúng 2 phần ngắn:
1. "Nhận xét gợi ý": 2-4 câu, tích cực và cụ thể.
2. "Cần kiểm tra thêm": các yêu cầu có thể còn thiếu hoặc chưa đủ thông tin để đánh giá. Nếu không có, ghi "Không thấy rõ".
Không tự cho điểm, không nói đây là kết luận cuối cùng.`;
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5', max_tokens: 420, messages: [{ role: 'user', content: prompt }],
    });
    const suggestion = response.content.filter((block: any) => block.type === 'text').map((block: any) => block.text).join('\n').trim();
    return { suggestion, analyzedText: !!submission.contentText, rubricCount: rubrics.length };
  }
}

@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AiSuggestionsController {
  constructor(private readonly service: AiSuggestionsService) {}

  @Post('suggest-feedback')
  @Roles('ADMIN', 'TEACHER')
  suggestFeedback(@Body() body: { studentId: number; classId: number }) {
    return this.service.suggestFeedback(+body.studentId, +body.classId);
  }

  @Post('assignment-review')
  @Roles('ADMIN', 'TEACHER')
  suggestAssignmentReview(@Body() body: { submissionId: number }, @CurrentUser() user: any) {
    return this.service.suggestAssignmentReview(+body.submissionId, user);
  }
}

@Module({
  controllers: [AiSuggestionsController],
  providers: [AiSuggestionsService],
})
export class AiSuggestionsModule {}
