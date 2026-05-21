import Anthropic from '@anthropic-ai/sdk';
import { BadRequestException, Body, Controller, Injectable, Module, Post, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../common/roles.guard';

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
              COUNT(*) FILTER (WHERE a.status = 'LATE')::int as late
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
}

@Module({
  controllers: [AiSuggestionsController],
  providers: [AiSuggestionsService],
})
export class AiSuggestionsModule {}
