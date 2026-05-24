import { Body, Controller, Get, Injectable, Module, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../common/roles.guard';

@Injectable()
export class FinanceExtrasService {
  constructor(private dataSource: DataSource) {}

  installments(paymentId: number) {
    return this.dataSource.query(`SELECT * FROM payment_installments WHERE payment_id = $1 ORDER BY due_date, id`, [paymentId]);
  }

  createInstallment(paymentId: number, body: any) {
    return this.dataSource.query(
      `INSERT INTO payment_installments (payment_id, due_date, amount, paid_amount, status)
       VALUES ($1, $2, $3, COALESCE($4, 0), COALESCE($5, 'PENDING')) RETURNING *`,
      [paymentId, body.dueDate, body.amount, body.paidAmount, body.status],
    ).then(r => r[0]);
  }

  async payInstallment(id: number, body: any) {
    const [row] = await this.dataSource.query(`SELECT * FROM payment_installments WHERE id = $1`, [id]);
    const paid = +(body.paidAmount ?? row.amount);
    const status = paid >= +row.amount ? 'PAID' : paid > 0 ? 'PARTIAL' : 'PENDING';
    await this.dataSource.query(
      `UPDATE payment_installments SET paid_amount = $1, status = $2, paid_at = CASE WHEN $1 > 0 THEN NOW() ELSE NULL END WHERE id = $3`,
      [paid, status, id],
    );
    await this.syncPayment(row.payment_id);
    return this.dataSource.query(`SELECT * FROM payment_installments WHERE id = $1`, [id]).then(r => r[0]);
  }

  async syncPayment(paymentId: number) {
    const [sum] = await this.dataSource.query(
      `SELECT COALESCE(SUM(amount), 0)::numeric as amount, COALESCE(SUM(paid_amount), 0)::numeric as paid
       FROM payment_installments WHERE payment_id = $1`,
      [paymentId],
    );
    if (+sum.amount > 0) {
      const status = +sum.paid >= +sum.amount ? 'PAID' : +sum.paid > 0 ? 'PARTIAL' : 'PENDING';
      await this.dataSource.query(`UPDATE payments SET paid_amount = $1, status = $2, paid_at = CASE WHEN $2 = 'PAID' THEN NOW() ELSE paid_at END WHERE id = $3`, [sum.paid, status, paymentId]);
    }
  }

  vietqr(paymentId: number) {
    return this.dataSource.query(
      `SELECT p.*, u.full_name as "studentName", c.name as "className"
       FROM payments p JOIN users u ON u.id = p.student_id JOIN classes c ON c.id = p.class_id
       WHERE p.id = $1`,
      [paymentId],
    ).then(([p]) => {
      const bank = process.env.VIETQR_BANK_ID || '970436';
      const account = process.env.VIETQR_ACCOUNT_NO || '0000000000';
      const name = encodeURIComponent(process.env.VIETQR_ACCOUNT_NAME || 'CLASSMANAGER');
      const amount = Math.max(0, +p.amount - +p.paid_amount);
      const addInfo = encodeURIComponent(`CM${p.id} ${p.studentName}`);
      const qrUrl = `https://img.vietqr.io/image/${bank}-${account}-compact2.png?amount=${amount}&addInfo=${addInfo}&accountName=${name}`;
      return { amount, qrUrl, content: `CM${p.id} ${p.studentName}` };
    });
  }

  commissions(month: string) {
    const from = `${month || new Date().toISOString().slice(0, 7)}-01`;
    return this.dataSource.query(
      `SELECT t.id as "teacherId", t.full_name as "teacherName",
              COALESCE(t.commission_rate, 0)::float as "commissionRate",
              COALESCE(SUM(p.paid_amount), 0)::numeric as revenue,
              ROUND((COALESCE(SUM(p.paid_amount), 0) * COALESCE(t.commission_rate, 0) / 100)::numeric, 0)::numeric as commission
       FROM users t
       LEFT JOIN classes c ON c.teacher_id = t.id
       LEFT JOIN payments p ON p.class_id = c.id AND p.status = 'PAID' AND date_trunc('month', p.paid_at) = date_trunc('month', $1::date)
       WHERE t.role = 'TEACHER'
       GROUP BY t.id, t.full_name, t.commission_rate
       ORDER BY commission DESC`,
      [from],
    );
  }
}

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class FinanceExtrasController {
  constructor(private service: FinanceExtrasService) {}
  @Get('payments/:id/installments') installments(@Param('id', ParseIntPipe) id: number) { return this.service.installments(id); }
  @Post('payments/:id/installments') @Roles('ADMIN','TEACHER') createInstallment(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.service.createInstallment(id, body);
  }
  @Patch('payment-installments/:id/pay') @Roles('ADMIN','TEACHER') payInstallment(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.service.payInstallment(id, body);
  }
  @Get('payments/:id/vietqr') vietqr(@Param('id', ParseIntPipe) id: number) { return this.service.vietqr(id); }
  @Get('payments/teacher-commissions') @Roles('ADMIN') commissions(@Query('month') month: string) { return this.service.commissions(month); }
}

@Module({ controllers: [FinanceExtrasController], providers: [FinanceExtrasService] })
export class FinanceExtrasModule {}
