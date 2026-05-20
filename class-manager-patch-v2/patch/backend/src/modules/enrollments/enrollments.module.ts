import { Injectable, Module, Controller, Get, Post, Delete, Body, Param, ParseIntPipe, UseGuards, Query } from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Repository, DataSource } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../common/roles.guard';

@Entity('enrollments')
export class Enrollment {
  @PrimaryGeneratedColumn() id: number;
  @Column({ name: 'class_id' }) classId: number;
  @Column({ name: 'student_id' }) studentId: number;
  @Column({ name: 'is_active', default: true }) isActive: boolean;
  @CreateDateColumn({ name: 'enrolled_at' }) enrolledAt: Date;
}

@Injectable()
export class EnrollmentsService {
  constructor(
    @InjectRepository(Enrollment) private repo: Repository<Enrollment>,
    private dataSource: DataSource,
  ) {}

  findByClass(classId: number) { return this.repo.find({ where: { classId, isActive: true } }); }
  findByStudent(studentId: number) {
    return this.dataSource.query(
      `SELECT e.*, c.name as class_name FROM enrollments e
       JOIN classes c ON c.id = e.class_id
       WHERE e.student_id = $1 AND e.is_active = true`, [studentId]);
  }

  // Auto-create payment when enrolling
  async enroll(classId: number, studentId: number) {
    // Check if already enrolled (re-activate if exists)
    const existing = await this.repo.findOne({ where: { classId, studentId } });
    if (existing) {
      if (!existing.isActive) {
        existing.isActive = true;
        await this.repo.save(existing);
      }
      return existing;
    }
    const enrollment = await this.repo.save(this.repo.create({ classId, studentId }));
    // Auto-create payment row based on class tuition_fee
    await this.dataSource.query(
      `INSERT INTO payments (student_id, class_id, amount, status, due_date)
       SELECT $1, $2, c.tuition_fee, 'PENDING', CURRENT_DATE + INTERVAL '14 days'
       FROM classes c WHERE c.id = $2 AND c.tuition_fee > 0
       ON CONFLICT DO NOTHING`,
      [studentId, classId]
    );
    return enrollment;
  }

  async bulkEnroll(classId: number, studentIds: number[]) {
    const results = [];
    for (const sid of studentIds) {
      results.push(await this.enroll(classId, sid));
    }
    return results;
  }

  remove(id: number) { return this.repo.update(id, { isActive: false }); }
}

@Controller('enrollments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EnrollmentsController {
  constructor(private readonly service: EnrollmentsService) {}
  @Get() findAll(@Query('classId') classId?: string, @Query('studentId') studentId?: string) {
    if (classId) return this.service.findByClass(+classId);
    if (studentId) return this.service.findByStudent(+studentId);
    return [];
  }
  @Post() @Roles('ADMIN','TEACHER') enroll(@Body() body: { classId: number; studentId: number }) {
    return this.service.enroll(body.classId, body.studentId);
  }
  @Post('bulk') @Roles('ADMIN','TEACHER') bulk(@Body() body: { classId: number; studentIds: number[] }) {
    return this.service.bulkEnroll(body.classId, body.studentIds);
  }
  @Delete(':id') @Roles('ADMIN','TEACHER') remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); }
}

@Module({
  imports: [TypeOrmModule.forFeature([Enrollment])],
  controllers: [EnrollmentsController],
  providers: [EnrollmentsService],
  exports: [EnrollmentsService, TypeOrmModule],
})
export class EnrollmentsModule {}
