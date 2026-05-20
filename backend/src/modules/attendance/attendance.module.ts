import { Injectable, Module, Controller, Get, Post, Body, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Repository, DataSource } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../common/roles.guard';

@Entity('attendance')
export class Attendance {
  @PrimaryGeneratedColumn() id: number;
  @Column({ name: 'session_id' }) sessionId: number;
  @Column({ name: 'student_id' }) studentId: number;
  @Column({ default: 'PRESENT' }) status: string;
  @Column({ name: 'is_excused', default: false }) isExcused: boolean;
  @Column({ type: 'text', nullable: true }) reason: string;
  @Column({ type: 'text', nullable: true }) note: string;
  @CreateDateColumn({ name: 'recorded_at' }) recordedAt: Date;
}

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(Attendance) private repo: Repository<Attendance>,
    private dataSource: DataSource,
  ) {}

  findBySession(sessionId: number) {
    return this.repo.find({ where: { sessionId } });
  }

  findByStudent(studentId: number, classId?: number) {
    let sql = `
      SELECT a.*, s.session_no, s.planned_date, s.topic, s.class_id
      FROM attendance a JOIN sessions s ON s.id = a.session_id
      WHERE a.student_id = $1
    `;
    const params: any[] = [studentId];
    if (classId) { params.push(classId); sql += ` AND s.class_id = $${params.length}`; }
    sql += ' ORDER BY s.session_no';
    return this.dataSource.query(sql, params);
  }

  async upsertOne(sessionId: number, studentId: number, status: string, extra: any = {}) {
    const exist = await this.repo.findOne({ where: { sessionId, studentId } });
    if (exist) {
      await this.repo.update(exist.id, { status, ...extra });
      return this.repo.findOne({ where: { id: exist.id } });
    }
    return this.repo.save(this.repo.create({ sessionId, studentId, status, ...extra }));
  }

  // Bulk mark for a session
  async bulkMark(sessionId: number, records: Array<{ studentId: number; status: string; isExcused?: boolean; reason?: string }>) {
    const results = [];
    for (const r of records) {
      results.push(await this.upsertOne(sessionId, r.studentId, r.status, { isExcused: r.isExcused, reason: r.reason }));
    }
    return results;
  }

  // Statistics per student in a class
  async statsForStudent(studentId: number, classId: number) {
    const rows = await this.dataSource.query(
      `SELECT a.status, a.is_excused
       FROM attendance a JOIN sessions s ON s.id = a.session_id
       WHERE a.student_id = $1 AND s.class_id = $2 AND s.status = 'DONE'`,
      [studentId, classId],
    );
    const totalDone = +(await this.dataSource.query(
      `SELECT COUNT(*)::int as c FROM sessions WHERE class_id = $1 AND status = 'DONE'`, [classId]
    ))[0].c;
    let present = 0, absent = 0, late = 0, excused = 0;
    for (const r of rows) {
      if (r.status === 'PRESENT') present++;
      else if (r.status === 'ABSENT') { absent++; if (r.is_excused) excused++; }
      else if (r.status === 'LATE') late++;
    }
    // Sessions without record = considered present by default (or you can change)
    const recorded = present + absent + late;
    if (recorded < totalDone) present += (totalDone - recorded);

    return { total: totalDone, present, absent, late, excusedAbsent: excused, unExcusedAbsent: absent - excused };
  }

  // For a class: table of all students across all done sessions
  async classMatrix(classId: number) {
    return this.dataSource.query(
      `SELECT a.session_id as "sessionId", a.student_id as "studentId", a.status, a.is_excused as "isExcused"
       FROM attendance a JOIN sessions s ON s.id = a.session_id
       WHERE s.class_id = $1`, [classId]
    );
  }
}

@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceController {
  constructor(private readonly service: AttendanceService) {}

  @Get()
  findAll(@Query('sessionId') sessionId?: string, @Query('studentId') studentId?: string, @Query('classId') classId?: string) {
    if (sessionId) return this.service.findBySession(+sessionId);
    if (studentId) return this.service.findByStudent(+studentId, classId ? +classId : undefined);
    return [];
  }

  @Get('matrix/:classId')
  matrix(@Param('classId', ParseIntPipe) classId: number) { return this.service.classMatrix(classId); }

  @Get('stats')
  stats(@Query('studentId', ParseIntPipe) studentId: number, @Query('classId', ParseIntPipe) classId: number) {
    return this.service.statsForStudent(studentId, classId);
  }

  @Post('bulk')
  @Roles('ADMIN','TEACHER')
  bulkMark(@Body() body: { sessionId: number; records: Array<{ studentId: number; status: string; isExcused?: boolean; reason?: string }> }) {
    return this.service.bulkMark(body.sessionId, body.records);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([Attendance])],
  controllers: [AttendanceController],
  providers: [AttendanceService],
  exports: [AttendanceService, TypeOrmModule],
})
export class AttendanceModule {}
