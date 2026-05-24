import { Controller, Get, Injectable, Module, Param, ParseIntPipe, Post, Query, Res, UseGuards, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Repository, DataSource } from 'typeorm';
import { Response } from 'express';
import { existsSync } from 'fs';
import { join } from 'path';
import PDFDocument = require('pdfkit');
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../common/roles.guard';
import { CurrentUser } from '../../common/current-user.decorator';

const findUnicodeFont = () => {
  const windir = process.env.WINDIR || 'C:\\Windows';
  const candidates = [
    process.env.PDF_FONT_PATH,
    join(process.cwd(), 'assets', 'fonts', 'Roboto-Regular.ttf'),
    join(process.cwd(), 'assets', 'fonts', 'NotoSans-Regular.ttf'),
    join(windir, 'Fonts', 'arial.ttf'),
    join(windir, 'Fonts', 'calibri.ttf'),
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  ].filter(Boolean) as string[];
  return candidates.find((path) => existsSync(path));
};

@Entity('certificates')
export class Certificate {
  @PrimaryGeneratedColumn() id: number;
  @Column({ name: 'enrollment_id' }) enrollmentId: number;
  @Column({ name: 'cert_number', unique: true }) certNumber: string;
  @CreateDateColumn({ name: 'issued_at' }) issuedAt: Date;
  @Column({ name: 'issued_by', nullable: true }) issuedBy: number;
  @Column({ name: 'final_score', type: 'numeric', precision: 5, scale: 2, nullable: true }) finalScore: number;
  @Column({ nullable: true }) classification: string;
}

@Injectable()
export class CertificatesService {
  constructor(
    @InjectRepository(Certificate) private repo: Repository<Certificate>,
    private dataSource: DataSource,
  ) {}

  private classify(avg: number) {
    if (avg >= 8.5) return 'Giỏi';
    if (avg >= 7) return 'Khá';
    if (avg >= 5) return 'Đạt';
    return 'Chưa đạt';
  }

  private async enrollmentData(enrollmentId: number) {
    const rows = await this.dataSource.query(
      `SELECT e.id as "enrollmentId", e.student_id as "studentId", e.class_id as "classId", e.enrolled_at as "enrolledAt",
              u.full_name as "studentName", u.email as "studentEmail",
              c.name as "className", c.teacher_id as "teacherId", c.start_date as "classStartDate", c.end_date as "classEndDate",
              co.name as "courseName", co.start_date as "courseStartDate", co.end_date as "courseEndDate",
              t.full_name as "teacherName",
              cert.id as "certificateId", cert.cert_number as "certNumber", cert.issued_at as "issuedAt",
              cert.final_score as "finalScore", cert.classification
       FROM enrollments e
       JOIN users u ON u.id = e.student_id
       JOIN classes c ON c.id = e.class_id
       LEFT JOIN courses co ON co.id = c.course_id
       LEFT JOIN users t ON t.id = c.teacher_id
       LEFT JOIN certificates cert ON cert.enrollment_id = e.id
       WHERE e.id = $1 AND e.is_active = true
       LIMIT 1`,
      [enrollmentId],
    );
    if (!rows[0]) throw new NotFoundException('Enrollment not found');
    const grades = await this.dataSource.query(
      `SELECT g.score, gi.weight
       FROM grades g JOIN grade_items gi ON gi.id = g.grade_item_id
       WHERE g.student_id = $1 AND gi.class_id = $2 AND g.score IS NOT NULL`,
      [rows[0].studentId, rows[0].classId],
    );
    const weightSum = grades.reduce((s, g) => s + Number(g.weight || 0), 0);
    const finalScore = grades.length
      ? (weightSum > 0
        ? grades.reduce((s, g) => s + Number(g.score) * Number(g.weight || 0), 0) / weightSum
        : grades.reduce((s, g) => s + Number(g.score), 0) / grades.length)
      : null;
    return { ...rows[0], gradeCount: grades.length, finalScore: finalScore == null ? null : Math.round(finalScore * 100) / 100, classification: finalScore == null ? null : this.classify(finalScore) };
  }

  private async requireTeacherAccess(user: any, enrollment: any) {
    if (user.role === 'ADMIN') return;
    if (user.role === 'TEACHER' && +user.id === +enrollment.teacherId) return;
    throw new ForbiddenException('No permission');
  }

  private async requireCertAccess(user: any, certId: number) {
    const rows = await this.dataSource.query(
      `SELECT cert.*, e.student_id, c.teacher_id
       FROM certificates cert
       JOIN enrollments e ON e.id = cert.enrollment_id
       JOIN classes c ON c.id = e.class_id
       WHERE cert.id = $1`,
      [certId],
    );
    const cert = rows[0];
    if (!cert) throw new NotFoundException('Certificate not found');
    if (user.role === 'ADMIN' || +user.id === +cert.student_id || (user.role === 'TEACHER' && +user.id === +cert.teacher_id)) return cert;
    throw new ForbiddenException('No permission');
  }

  async list(query: any, user: any) {
    const params: any[] = [];
    let where = `WHERE 1=1`;
    if (query.studentId) { params.push(+query.studentId); where += ` AND e.student_id = $${params.length}`; }
    if (query.classId) { params.push(+query.classId); where += ` AND e.class_id = $${params.length}`; }
    if (user.role === 'STUDENT') { params.push(+user.id); where += ` AND e.student_id = $${params.length}`; }
    if (user.role === 'TEACHER') { params.push(+user.id); where += ` AND c.teacher_id = $${params.length}`; }
    return this.dataSource.query(
      `SELECT cert.id, cert.enrollment_id, cert.cert_number, cert.issued_at, cert.final_score, cert.classification,
              e.student_id as "studentId", e.class_id as "classId",
              u.full_name as "studentName", c.name as "className", co.name as "courseName"
       FROM certificates cert
       JOIN enrollments e ON e.id = cert.enrollment_id
       JOIN users u ON u.id = e.student_id
       JOIN classes c ON c.id = e.class_id
       LEFT JOIN courses co ON co.id = c.course_id
       ${where}
       ORDER BY cert.issued_at DESC`,
      params,
    );
  }

  preview(enrollmentId: number, user: any) {
    return this.enrollmentData(enrollmentId).then(async data => {
      await this.requireTeacherAccess(user, data);
      return data;
    });
  }

  private async nextCertNumber() {
    const year = new Date().getFullYear();
    const rows = await this.dataSource.query(
      `SELECT cert_number FROM certificates WHERE cert_number LIKE $1 ORDER BY cert_number DESC LIMIT 1`,
      [`CERT-${year}-%`],
    );
    const last = rows[0]?.cert_number ? Number(String(rows[0].cert_number).split('-').pop()) : 0;
    return `CERT-${year}-${String(last + 1).padStart(3, '0')}`;
  }

  async issue(enrollmentId: number, user: any) {
    const data = await this.enrollmentData(enrollmentId);
    await this.requireTeacherAccess(user, data);
    if (!data.gradeCount || data.finalScore == null) throw new ForbiddenException('Student has no graded score');
    if (data.finalScore < 5) throw new ForbiddenException('Average score must be at least 5');
    if (data.certificateId) return this.repo.findOne({ where: { id: +data.certificateId } });
    return this.repo.save(this.repo.create({
      enrollmentId,
      certNumber: await this.nextCertNumber(),
      issuedBy: user.id,
      finalScore: data.finalScore,
      classification: data.classification,
    }));
  }

  async renderPdf(certId: number, user: any, res: Response) {
    const cert = await this.requireCertAccess(user, certId);
    const data = await this.enrollmentData(+cert.enrollment_id);
    const certNumber = cert.cert_number || data.certNumber;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${certNumber}.pdf"`);

    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 48 });
    doc.pipe(res);
    const unicodeFont = findUnicodeFont();
    if (unicodeFont) {
      doc.registerFont('app-regular', unicodeFont);
      doc.font('app-regular');
    }

    const w = doc.page.width;
    const h = doc.page.height;
    doc.rect(24, 24, w - 48, h - 48).lineWidth(3).strokeColor('#0F6E56').stroke();
    doc.rect(38, 38, w - 76, h - 76).lineWidth(1).strokeColor('#C9A24D').stroke();
    doc.fillColor('#E1F5EE').opacity(0.45).circle(120, 110, 70).fill().circle(w - 120, h - 110, 90).fill().opacity(1);

    doc.fillColor('#0F6E56').fontSize(24).text('ClassManager', 0, 60, { align: 'center' });
    doc.fillColor('#111').fontSize(28).text('CHỨNG CHỈ HOÀN THÀNH KHÓA HỌC', 0, 118, { align: 'center' });
    doc.moveDown(1.2);
    doc.fontSize(13).fillColor('#666').text('Chứng nhận', { align: 'center' });
    doc.fontSize(30).fillColor('#0F6E56').text(data.studentName || '-', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(14).fillColor('#333').text(`Đã hoàn thành khóa học: ${data.courseName || '-'}`, { align: 'center' });
    doc.text(`Lớp: ${data.className || '-'}`, { align: 'center' });
    doc.text(`Thời gian học: ${this.date(data.courseStartDate || data.classStartDate)} - ${this.date(data.courseEndDate || data.classEndDate)}`, { align: 'center' });
    doc.moveDown();
    doc.fontSize(15).fillColor('#111').text(`Điểm tổng kết: ${Number(cert.final_score || data.finalScore).toFixed(2)} - Xếp loại: ${cert.classification || data.classification}`, { align: 'center' });
    doc.moveDown(1.5);
    doc.fontSize(11).fillColor('#555').text(`Mã số: ${certNumber}`, 70, h - 115);
    doc.text(`Ngày cấp: ${this.date(cert.issued_at || new Date())}`, 70, h - 95);
    doc.text('Giáo viên phụ trách', w - 250, h - 130, { width: 180, align: 'center' });
    doc.moveTo(w - 245, h - 78).lineTo(w - 75, h - 78).strokeColor('#999').stroke();
    doc.fontSize(11).text(data.teacherName || '', w - 250, h - 65, { width: 180, align: 'center' });
    doc.end();
  }

  private date(d: any) {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('vi-VN');
  }
}

@Controller('certificates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CertificatesController {
  constructor(private readonly service: CertificatesService) {}

  @Get() list(@Query() query: any, @CurrentUser() user: any) { return this.service.list(query, user); }
  @Get('preview/:enrollmentId') @Roles('ADMIN', 'TEACHER') preview(@Param('enrollmentId', ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.service.preview(id, user);
  }
  @Post('issue/:enrollmentId') @Roles('ADMIN', 'TEACHER') issue(@Param('enrollmentId', ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.service.issue(id, user);
  }
  @Get(':id/download') download(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any, @Res() res: Response) {
    return this.service.renderPdf(id, user, res);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([Certificate])],
  controllers: [CertificatesController],
  providers: [CertificatesService],
})
export class CertificatesModule {}
