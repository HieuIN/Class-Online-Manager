import { Controller, Get, Injectable, Module, Param, ParseIntPipe, Query, Res, UseGuards } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../common/roles.guard';
import { Response } from 'express';
import { existsSync } from 'fs';
import { join } from 'path';
import PDFDocument = require('pdfkit');

const findUnicodeFont = () => {
  const windir = process.env.WINDIR || 'C:\\Windows';
  const candidates = [
    process.env.PDF_FONT_PATH,
    join(process.cwd(), 'assets', 'fonts', 'Roboto-Regular.ttf'),
    join(process.cwd(), 'assets', 'fonts', 'NotoSans-Regular.ttf'),
    join(windir, 'Fonts', 'arial.ttf'),
    join(windir, 'Fonts', 'calibri.ttf'),
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
  ].filter(Boolean) as string[];
  return candidates.find((path) => existsSync(path));
};

@Injectable()
export class AnalyticsService {
  constructor(private dataSource: DataSource) {}

  private parseIds(classIds: string) {
    return String(classIds || '').split(',').map(x => +x.trim()).filter(Boolean);
  }

  async ranking(classId: number) {
    return this.dataSource.query(
      `WITH students AS (
         SELECT u.id, u.full_name
         FROM enrollments e JOIN users u ON u.id = e.student_id
         WHERE e.class_id = $1 AND e.is_active = true
       ),
       grade_avg AS (
         SELECT g.student_id,
                ROUND((SUM(g.score * gi.weight) / NULLIF(SUM(gi.weight), 0))::numeric, 2) as average
         FROM grades g JOIN grade_items gi ON gi.id = g.grade_item_id
         WHERE gi.class_id = $1 AND g.score IS NOT NULL
         GROUP BY g.student_id
       ),
       attendance_stats AS (
         SELECT st.id as student_id,
                COUNT(s.id)::int as total,
                COUNT(s.id) FILTER (WHERE COALESCE(a.status, 'PRESENT') = 'PRESENT')::int as present,
                COUNT(s.id) FILTER (WHERE a.status = 'LATE')::int as late,
                COUNT(s.id) FILTER (WHERE a.status = 'ABSENT')::int as absent
         FROM students st
         LEFT JOIN sessions s ON s.class_id = $1 AND s.status = 'DONE'
         LEFT JOIN attendance a ON a.session_id = s.id AND a.student_id = st.id
         GROUP BY st.id
       ),
       submissions_stats AS (
         SELECT st.id as student_id,
                COUNT(a.id)::int as total,
                COUNT(s.id) FILTER (WHERE s.status IS NULL OR s.status <> 'NOT_SUBMITTED')::int as submitted
         FROM students st
         LEFT JOIN assignments a ON a.class_id = $1 AND a.is_required = true
         LEFT JOIN submissions s ON s.assignment_id = a.id AND s.student_id = st.id
         GROUP BY st.id
       )
       SELECT st.id as "studentId", st.full_name as "studentName",
              COALESCE(ga.average, 0)::float as "averageScore",
              CASE WHEN ats.total > 0 THEN ROUND(((ats.present + ats.late * 0.5) * 100.0 / ats.total)::numeric, 0)::int ELSE 100 END as "attendanceRate",
              CASE WHEN ss.total > 0 THEN ROUND((ss.submitted * 100.0 / ss.total)::numeric, 0)::int ELSE 100 END as "submissionRate",
              ats.absent as "absentCount",
              ss.submitted as "submittedAssignments",
              ss.total as "totalAssignments"
       FROM students st
       LEFT JOIN grade_avg ga ON ga.student_id = st.id
       LEFT JOIN attendance_stats ats ON ats.student_id = st.id
       LEFT JOIN submissions_stats ss ON ss.student_id = st.id
       ORDER BY COALESCE(ga.average, 0) DESC, "attendanceRate" DESC, st.full_name`,
      [classId],
    );
  }

  async compareClasses(classIds: string) {
    const ids = this.parseIds(classIds);
    if (!ids.length) return [];
    const rows = [];
    for (const classId of ids) {
      const [cls] = await this.dataSource.query(`SELECT id, name FROM classes WHERE id = $1`, [classId]);
      if (!cls) continue;
      const ranking = await this.ranking(classId);
      const avgGrade = ranking.length ? ranking.reduce((s, x) => s + (+x.averageScore || 0), 0) / ranking.length : 0;
      const attendanceRate = ranking.length ? ranking.reduce((s, x) => s + (+x.attendanceRate || 0), 0) / ranking.length : 0;
      const submissionRate = ranking.length ? ranking.reduce((s, x) => s + (+x.submissionRate || 0), 0) / ranking.length : 0;
      rows.push({
        classId,
        className: cls.name,
        studentCount: ranking.length,
        avgGrade: +avgGrade.toFixed(2),
        attendanceRate: Math.round(attendanceRate),
        submissionRate: Math.round(submissionRate),
      });
    }
    return rows;
  }

  async predictFinal(classId: number) {
    return this.dataSource.query(
      `WITH students AS (
         SELECT u.id, u.full_name
         FROM enrollments e JOIN users u ON u.id = e.student_id
         WHERE e.class_id = $1 AND e.is_active = true
       ),
       weighted AS (
         SELECT st.id as student_id,
                SUM(CASE WHEN g.score IS NOT NULL THEN gi.weight ELSE 0 END)::float as completed_weight,
                SUM(CASE WHEN g.score IS NOT NULL THEN g.score * gi.weight ELSE 0 END)::float as weighted_score,
                SUM(gi.weight)::float as total_weight
         FROM students st
         CROSS JOIN grade_items gi
         LEFT JOIN grades g ON g.grade_item_id = gi.id AND g.student_id = st.id
         WHERE gi.class_id = $1
         GROUP BY st.id
       )
       SELECT st.id as "studentId", st.full_name as "studentName",
              ROUND((w.weighted_score / NULLIF(w.completed_weight, 0))::numeric, 2)::float as "currentAverage",
              ROUND((w.weighted_score / NULLIF(w.completed_weight, 0))::numeric, 2)::float as "predictedFinal",
              GREATEST(0, COALESCE(w.total_weight, 0) - COALESCE(w.completed_weight, 0)) as "missingWeight",
              CASE
                WHEN w.completed_weight IS NULL OR w.completed_weight = 0 THEN 'NO_DATA'
                WHEN (w.weighted_score / NULLIF(w.completed_weight, 0)) < 5 THEN 'HIGH'
                WHEN (w.weighted_score / NULLIF(w.completed_weight, 0)) < 6.5 THEN 'MEDIUM'
                ELSE 'LOW'
              END as "riskLevel"
       FROM students st
       LEFT JOIN weighted w ON w.student_id = st.id
       ORDER BY "riskLevel", "predictedFinal" NULLS FIRST, st.full_name`,
      [classId],
    );
  }

  async attendanceHeatmap(classId: number) {
    return this.dataSource.query(
      `SELECT s.id as "sessionId",
              s.session_no as "sessionNo",
              s.planned_date as "date",
              COUNT(e.student_id)::int as total,
              COUNT(a.id) FILTER (WHERE a.status = 'ABSENT')::int as absent,
              COUNT(a.id) FILTER (WHERE a.status = 'LATE')::int as late
       FROM sessions s
       JOIN enrollments e ON e.class_id = s.class_id AND e.is_active = true
       LEFT JOIN attendance a ON a.session_id = s.id AND a.student_id = e.student_id
       WHERE s.class_id = $1 AND s.status = 'DONE'
       GROUP BY s.id
       ORDER BY s.planned_date, s.session_no`,
      [classId],
    );
  }

  async assignmentDifficulty(classId: number) {
    return this.dataSource.query(
      `SELECT a.id as "assignmentId", a.title,
              COUNT(e.student_id)::int as total,
              COUNT(s.id) FILTER (WHERE s.status IS NOT NULL AND s.status <> 'NOT_SUBMITTED')::int as submitted,
              (COUNT(e.student_id) - COUNT(s.id) FILTER (WHERE s.status IS NOT NULL AND s.status <> 'NOT_SUBMITTED'))::int as missing,
              COUNT(s.id) FILTER (WHERE s.status = 'REVISION_REQUIRED')::int as revision,
              ROUND((AVG(s.score) FILTER (WHERE s.score IS NOT NULL))::numeric, 2)::float as "avgScore"
       FROM assignments a
       JOIN enrollments e ON e.class_id = a.class_id AND e.is_active = true
       LEFT JOIN submissions s ON s.assignment_id = a.id AND s.student_id = e.student_id
       WHERE a.class_id = $1
       GROUP BY a.id
       ORDER BY "avgScore" NULLS FIRST, missing DESC, revision DESC`,
      [classId],
    );
  }

  async finalReportData(studentId: number, classId: number) {
    const [student] = await this.dataSource.query(
      `SELECT u.full_name as "studentName", u.email, u.phone, c.name as "className", t.full_name as "teacherName"
       FROM users u
       JOIN enrollments e ON e.student_id = u.id
       JOIN classes c ON c.id = e.class_id
       LEFT JOIN users t ON t.id = c.teacher_id
       WHERE u.id = $1 AND c.id = $2`,
      [studentId, classId],
    );
    const grades = await this.dataSource.query(
      `SELECT gi.name, gi.weight, gi.max_score as "maxScore", g.score, g.feedback
       FROM grade_items gi
       LEFT JOIN grades g ON g.grade_item_id = gi.id AND g.student_id = $2
       WHERE gi.class_id = $1 ORDER BY gi.display_order, gi.id`,
      [classId, studentId],
    );
    const [attendance] = await this.dataSource.query(
      `SELECT COUNT(s.id)::int as total,
              COUNT(s.id) FILTER (WHERE COALESCE(a.status, 'PRESENT') = 'PRESENT')::int as present,
              COUNT(s.id) FILTER (WHERE a.status = 'ABSENT')::int as absent,
              COUNT(s.id) FILTER (WHERE a.status = 'LATE')::int as late
       FROM sessions s
       LEFT JOIN attendance a ON a.session_id = s.id AND a.student_id = $2
       WHERE s.class_id = $1 AND s.status = 'DONE'`,
      [classId, studentId],
    );
    const assignments = await this.dataSource.query(
      `SELECT a.title, s.status, s.score, s.teacher_comment as "teacherComment"
       FROM assignments a
       LEFT JOIN submissions s ON s.assignment_id = a.id AND s.student_id = $2
       WHERE a.class_id = $1 ORDER BY a.due_date`,
      [classId, studentId],
    );
    const [avg] = await this.dataSource.query(
      `SELECT ROUND((SUM(g.score * gi.weight) / NULLIF(SUM(gi.weight), 0))::numeric, 2)::float as average
       FROM grades g JOIN grade_items gi ON gi.id = g.grade_item_id
       WHERE gi.class_id = $1 AND g.student_id = $2 AND g.score IS NOT NULL`,
      [classId, studentId],
    );
    return { student, grades, attendance, assignments, average: avg?.average || null };
  }
}

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(private service: AnalyticsService) {}

  @Get('compare-classes') compare(@Query('classIds') classIds: string) { return this.service.compareClasses(classIds); }
  @Get('predict-final') predict(@Query('classId', ParseIntPipe) classId: number) { return this.service.predictFinal(classId); }
  @Get('attendance-heatmap') heatmap(@Query('classId', ParseIntPipe) classId: number) { return this.service.attendanceHeatmap(classId); }
  @Get('ranking') ranking(@Query('classId', ParseIntPipe) classId: number) { return this.service.ranking(classId); }
  @Get('assignment-difficulty') difficulty(@Query('classId', ParseIntPipe) classId: number) { return this.service.assignmentDifficulty(classId); }
}

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FinalReportsController {
  constructor(private service: AnalyticsService) {}

  @Get('student-final/:studentId')
  @Roles('ADMIN', 'TEACHER')
  async finalReport(@Param('studentId', ParseIntPipe) studentId: number, @Query('classId', ParseIntPipe) classId: number, @Res() res: Response) {
    const data = await this.service.finalReportData(studentId, classId);
    if (!data.student) return res.status(404).send('Student not found');
    const safeName = String(data.student.studentName || 'student').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="bao-cao-cuoi-khoa-${safeName}.pdf"`);

    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    doc.pipe(res);
    const unicodeFont = findUnicodeFont();
    if (unicodeFont) {
      doc.registerFont('app-regular', unicodeFont);
      doc.font('app-regular');
    }

    const attendanceRate = data.attendance?.total ? Math.round(((data.attendance.present + data.attendance.late * 0.5) / data.attendance.total) * 100) : 100;
    doc.fontSize(20).fillColor('#0F6E56').text('Báo cáo cuối khóa');
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#333')
      .text(`Học viên: ${data.student.studentName}`)
      .text(`Lớp: ${data.student.className}`)
      .text(`Giáo viên: ${data.student.teacherName || '-'}`)
      .text(`Điểm trung bình: ${data.average ?? '-'}`)
      .text(`Chuyên cần: ${attendanceRate}% (${data.attendance.present}/${data.attendance.total} buổi, vắng ${data.attendance.absent}, muộn ${data.attendance.late})`);
    doc.moveDown();

    doc.fontSize(14).fillColor('#111').text('Bảng điểm');
    doc.fontSize(10).fillColor('#333');
    for (const g of data.grades) doc.text(`${g.name}: ${g.score ?? '-'} / ${g.maxScore} (hệ số ${g.weight}%)${g.feedback ? ` - ${g.feedback}` : ''}`);
    doc.moveDown();

    doc.fontSize(14).fillColor('#111').text('Bài tập');
    doc.fontSize(10).fillColor('#333');
    for (const a of data.assignments) doc.text(`${a.title}: ${a.status || 'NOT_SUBMITTED'}${a.score != null ? ` - ${a.score}/10` : ''}${a.teacherComment ? ` - ${a.teacherComment}` : ''}`);
    doc.moveDown();
    doc.fontSize(10).fillColor('#666').text(`Ngày xuất báo cáo: ${new Date().toLocaleDateString('vi-VN')}`, { align: 'right' });
    doc.end();
  }
}

@Module({
  controllers: [AnalyticsController, FinalReportsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
