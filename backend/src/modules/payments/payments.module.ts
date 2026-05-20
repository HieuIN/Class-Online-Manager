import { Injectable, Module, Controller, Get, Post, Patch, Body, Param, ParseIntPipe, Query, UseGuards, Res } from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Repository, DataSource } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../common/roles.guard';
import { Response } from 'express';
import PDFDocument = require('pdfkit');

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
      `SELECT p.*, u.full_name as "studentName", u.email as "studentEmail"
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

  async markPaid(id: number, paidAmount?: number) {
    const payment = await this.repo.findOne({ where: { id } });
    if (!payment) return null;
    const fullPaid = !paidAmount || paidAmount >= +payment.amount;
    await this.repo.update(id, {
      paidAmount: paidAmount || payment.amount,
      status: fullPaid ? 'PAID' : 'PARTIAL',
      paidAt: new Date(),
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
}

@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}
  @Get('summary') @Roles('ADMIN') summary() { return this.service.summary(); }

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
    const cleanName = String(p.studentName || 'student').replace(/[^\w-]+/g, '-').replace(/-+/g, '-');
    const filename = `hoa-don-${cleanName}-${now.toISOString().slice(0, 10)}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    doc.pipe(res);

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
  @Patch(':id/pay') @Roles('ADMIN','TEACHER') pay(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.service.markPaid(id, body.paidAmount);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([Payment])],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService, TypeOrmModule],
})
export class PaymentsModule {}
