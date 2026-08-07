import { BadRequestException, Injectable, Module, Controller, Get, Post, Patch, Body, Param, ParseIntPipe, Query, UseGuards, Res, UploadedFile, UseInterceptors, Req } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Repository, DataSource } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../common/roles.guard';
import { Response } from 'express';
import { existsSync } from 'fs';
import { join } from 'path';
import { extname } from 'path';
import { ensureUploadDir } from '../../common/upload-dir.util';
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

const paymentProofUpload = FileInterceptor('proof', {
  storage: diskStorage({
    destination: (_req, _file, cb) => cb(null, ensureUploadDir('payment-proofs')),
    filename: (_req, file, cb) => cb(null, `payment-${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^(image\/(jpeg|png|webp|gif)|application\/pdf)$/i.test(file.mimetype)) return cb(null, true);
    cb(new BadRequestException('Bằng chứng chỉ hỗ trợ ảnh hoặc PDF'), false);
  },
});

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn() id: number;
  @Column({ name: 'student_id' }) studentId: number;
  @Column({ name: 'class_id' }) classId: number;
  @Column({ type: 'numeric', precision: 12, scale: 2 }) amount: number;
  @Column({ name: 'paid_amount', type: 'numeric', precision: 12, scale: 2, default: 0 }) paidAmount: number;
  @Column({ default: 'VND' }) currency: string;
  @Column({ default: 'PENDING' }) status: string;
  @Column({ name: 'due_date', type: 'date', nullable: true }) dueDate: Date;
  @Column({ name: 'paid_at', type: 'timestamp', nullable: true }) paidAt: Date;
  @Column({ type: 'text', nullable: true }) note: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment) private repo: Repository<Payment>,
    private dataSource: DataSource,
  ) {}

  async findByClass(classId: number) {
    return this.dataSource.query(
      `SELECT p.*, u.full_name as "studentName", u.email as "studentEmail",
              (SELECT proof_url FROM payment_receipts pr WHERE pr.payment_id=p.id AND pr.proof_url IS NOT NULL ORDER BY pr.created_at DESC LIMIT 1) as "latestProofUrl",
              (SELECT COUNT(*)::int FROM payment_receipts pr WHERE pr.payment_id=p.id AND pr.proof_url IS NOT NULL) as "proofCount"
       FROM payments p JOIN users u ON u.id = p.student_id
       WHERE p.class_id = $1 ORDER BY u.full_name`, [classId]
    );
  }

  findByStudent(studentId: number) {
    return this.repo.find({ where: { studentId } });
  }

  create(d: Partial<Payment>) { return this.repo.save(this.repo.create(d)); }

  async invoiceData(id: number) {
    const rows = await this.dataSource.query(
      `SELECT p.*,
              u.full_name as "studentName", u.email as "studentEmail", u.phone as "studentPhone",
              c.name as "className", c.schedule_note as "scheduleNote",
              t.full_name as "teacherName"
       FROM payments p
       JOIN users u ON u.id = p.student_id
       JOIN classes c ON c.id = p.class_id
       LEFT JOIN users t ON t.id = c.teacher_id
       WHERE p.id = $1
       LIMIT 1`,
      [id],
    );
    return rows[0];
  }

  async markPaid(id: number, receivedAmount?: number, proof?: { url: string; name: string; mimeType: string; size: number }, createdBy?: number) {
    const payment = await this.repo.findOne({ where: { id } });
    if (!payment) return null;
    const total = +payment.amount || 0;
    const alreadyPaid = +payment.paidAmount || 0;
    const received = receivedAmount == null ? total - alreadyPaid : Math.max(0, +receivedAmount || 0);
    if (received <= 0) throw new BadRequestException('Số tiền thanh toán phải lớn hơn 0');
    const paidAmount = Math.min(total, alreadyPaid + received);
    const fullPaid = paidAmount >= total;
    await this.repo.update(id, {
      paidAmount,
      status: fullPaid ? 'PAID' : paidAmount > 0 ? 'PARTIAL' : 'PENDING',
      paidAt: paidAmount > 0 ? new Date() : payment.paidAt,
    });
    await this.dataSource.query(
      `INSERT INTO payment_receipts (payment_id, amount, proof_url, proof_name, proof_mime_type, proof_size, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, received, proof?.url || null, proof?.name || null, proof?.mimeType || null, proof?.size || null, createdBy || null],
    );
    return this.repo.findOne({ where: { id } });
  }

  async editPaid(id: number, paidAmount: number, proof?: { url: string; name: string; mimeType: string; size: number }) {
    const payment = await this.repo.findOne({ where: { id } });
    if (!payment) return null;
    const total = +payment.amount || 0;
    const previousPaid = +payment.paidAmount || 0;
    const correctedPaid = +paidAmount || 0;
    if (correctedPaid <= 0) throw new BadRequestException('Số tiền đã đóng phải lớn hơn 0');
    if (correctedPaid > total) throw new BadRequestException('Số tiền đã đóng không được vượt quá tổng học phí');

    await this.dataSource.transaction(async manager => {
      await manager.update(Payment, id, {
        paidAmount: correctedPaid,
        status: correctedPaid >= total ? 'PAID' : 'PARTIAL',
        paidAt: payment.paidAt || new Date(),
      });
      const receipts = await manager.query(
        `SELECT id, amount FROM payment_receipts WHERE payment_id=$1 ORDER BY created_at DESC LIMIT 1`, [id],
      );
      if (receipts[0]) {
        const correctedReceiptAmount = +receipts[0].amount + correctedPaid - previousPaid;
        if (correctedReceiptAmount <= 0) throw new BadRequestException('Số tiền sửa làm cho lần thanh toán gần nhất không hợp lệ');
        await manager.query(
          `UPDATE payment_receipts SET amount=$1,
             proof_url=COALESCE($2, proof_url), proof_name=COALESCE($3, proof_name),
             proof_mime_type=COALESCE($4, proof_mime_type), proof_size=COALESCE($5, proof_size)
           WHERE id=$6`,
          [correctedReceiptAmount, proof?.url || null, proof?.name || null, proof?.mimeType || null, proof?.size || null, receipts[0].id],
        );
      } else {
        await manager.query(
          `INSERT INTO payment_receipts (payment_id, amount, proof_url, proof_name, proof_mime_type, proof_size)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [id, correctedPaid, proof?.url || null, proof?.name || null, proof?.mimeType || null, proof?.size || null],
        );
      }
    });
    return this.repo.findOne({ where: { id } });
  }

  /** Total revenue summary */
  async summary() {
    const rows = await this.dataSource.query(`
      SELECT status, SUM(amount)::numeric as total, COUNT(*)::int as count
      FROM payments GROUP BY status`);
    const out: any = { PAID: { total: 0, count: 0 }, PENDING: { total: 0, count: 0 }, PARTIAL: { total: 0, count: 0 } };
    for (const r of rows) out[r.status] = { total: +r.total, count: r.count };
    return out;
  }

  async revenueReport(from: string, to: string) {
    return this.dataSource.query(
      `SELECT DATE_TRUNC('month', p.paid_at) as month,
              c.id as class_id,
              c.name as class_name,
              SUM(COALESCE(NULLIF(p.paid_amount, 0), p.amount))::numeric as revenue,
              COUNT(*)::int as payment_count
       FROM payments p JOIN classes c ON c.id = p.class_id
       WHERE p.paid_at BETWEEN $1 AND $2 AND p.status = 'PAID'
       GROUP BY month, c.id, c.name
       ORDER BY month, c.name`,
      [from, to],
    );
  }
}

@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}
  @Get('summary') @Roles('ADMIN') summary() { return this.service.summary(); }
  @Get('revenue-report') @Roles('ADMIN') revenueReport(@Query('from') from: string, @Query('to') to: string) {
    return this.service.revenueReport(from, to);
  }

  @Get(':id/invoice')
  @Roles('ADMIN','TEACHER')
  async invoice(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const p = await this.service.invoiceData(id);
    if (!p) return res.status(404).send('Payment not found');

    const now = new Date();
    const invoiceNo = `INV-${p.id}-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const amount = +p.amount || 0;
    const paid = +p.paid_amount || 0;
    const remain = Math.max(0, amount - paid);
    const money = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + ' VND';
    const cleanName = String(p.studentName || 'student')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\u0111/g, 'd')
      .replace(/\u0110/g, 'D')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'student';
    const filename = `hoa-don-${cleanName}-${now.toISOString().slice(0, 10)}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    doc.pipe(res);
    const unicodeFont = findUnicodeFont();
    if (unicodeFont) {
      doc.registerFont('app-regular', unicodeFont);
      doc.font('app-regular');
    }

    doc.fontSize(22).fillColor('#0F6E56').text('ClassManager', { continued: true });
    doc.fontSize(11).fillColor('#666').text('  Invoice', { align: 'right' });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#333').text(`Invoice No: ${invoiceNo}`);
    doc.text(`Issue Date: ${now.toLocaleDateString('vi-VN')}`);
    doc.moveDown();

    doc.fontSize(14).fillColor('#111').text('Student');
    doc.fontSize(10).fillColor('#333')
      .text(`Name: ${p.studentName || '-'}`)
      .text(`Email: ${p.studentEmail || '-'}`)
      .text(`Phone: ${p.studentPhone || '-'}`);
    doc.moveDown();

    doc.fontSize(14).fillColor('#111').text('Class');
    doc.fontSize(10).fillColor('#333')
      .text(`Class: ${p.className || '-'}`)
      .text(`Teacher: ${p.teacherName || '-'}`)
      .text(`Schedule: ${p.scheduleNote || '-'}`);
    doc.moveDown();

    const tableTop = doc.y + 8;
    doc.rect(48, tableTop, 500, 28).fill('#E1F5EE');
    doc.fillColor('#0F6E56').fontSize(11).text('Description', 60, tableTop + 9);
    doc.text('Amount', 430, tableTop + 9, { width: 100, align: 'right' });
    doc.fillColor('#333').fontSize(10)
      .text(`Tuition fee - ${p.className || ''}`, 60, tableTop + 44)
      .text(money(amount), 430, tableTop + 44, { width: 100, align: 'right' });
    doc.moveTo(48, tableTop + 70).lineTo(548, tableTop + 70).strokeColor('#ddd').stroke();

    doc.y = tableTop + 92;
    doc.fontSize(11)
      .text(`Total: ${money(amount)}`, { align: 'right' })
      .text(`Paid: ${money(paid)}`, { align: 'right' })
      .text(`Remaining: ${money(remain)}`, { align: 'right' })
      .text(`Status: ${p.status}`, { align: 'right' });
    doc.moveDown(3);
    doc.fontSize(10).fillColor('#666').text('Teacher signature', 380);
    doc.moveTo(380, doc.y + 36).lineTo(540, doc.y + 36).strokeColor('#aaa').stroke();
    doc.end();
  }

  @Get() findAll(@Query('classId') cid?: string, @Query('studentId') sid?: string) {
    if (cid) return this.service.findByClass(+cid);
    if (sid) return this.service.findByStudent(+sid);
    return [];
  }
  @Post() @Roles('ADMIN','TEACHER') create(@Body() body: any) { return this.service.create(body); }
  @Patch(':id/pay') @Roles('ADMIN','TEACHER') @UseInterceptors(paymentProofUpload)
  pay(@Param('id', ParseIntPipe) id: number, @Body() body: any, @UploadedFile() file: any, @Req() req: any) {
    const proof = file ? { url: `/uploads/payment-proofs/${file.filename}`, name: file.originalname, mimeType: file.mimetype, size: file.size } : undefined;
    return this.service.markPaid(id, body.paidAmount === undefined ? undefined : +body.paidAmount, proof, req.user?.id);
  }
  @Patch(':id/payment-details') @Roles('ADMIN','TEACHER') @UseInterceptors(paymentProofUpload)
  editPayment(@Param('id', ParseIntPipe) id: number, @Body() body: any, @UploadedFile() file: any) {
    const proof = file ? { url: `/uploads/payment-proofs/${file.filename}`, name: file.originalname, mimeType: file.mimetype, size: file.size } : undefined;
    return this.service.editPaid(id, +body.paidAmount, proof);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([Payment])],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService, TypeOrmModule],
})
export class PaymentsModule {}
