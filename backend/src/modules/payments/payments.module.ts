import { Injectable, Module, Controller, Get, Post, Patch, Body, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Repository, DataSource } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../common/roles.guard';

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
