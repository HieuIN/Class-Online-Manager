import { Injectable, Module, Controller, Get, Post, Body, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Repository, DataSource } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../common/roles.guard';

@Entity('grades')
export class Grade {
  @PrimaryGeneratedColumn() id: number;
  @Column({ name: 'grade_item_id' }) gradeItemId: number;
  @Column({ name: 'student_id' }) studentId: number;
  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true }) score: number;
  @Column({ type: 'text', nullable: true }) feedback: string;
  @CreateDateColumn({ name: 'graded_at' }) gradedAt: Date;
  @Column({ name: 'graded_by', nullable: true }) gradedBy: number;
}

function classifyAvg(avg: number) {
  if (avg == null) return null;
  if (avg >= 8.5) return 'GIOI';
  if (avg >= 7) return 'KHA';
  if (avg >= 5) return 'TB';
  return 'YEU';
}

@Injectable()
export class GradesService {
  constructor(
    @InjectRepository(Grade) private repo: Repository<Grade>,
    private dataSource: DataSource,
  ) {}

  findByItem(gradeItemId: number) { return this.repo.find({ where: { gradeItemId } }); }
  findByStudent(studentId: number, classId?: number) {
    let sql = `
      SELECT g.*, gi.name as "itemName", gi.weight, gi.max_score as "maxScore", gi.class_id as "classId"
      FROM grades g JOIN grade_items gi ON gi.id = g.grade_item_id
      WHERE g.student_id = $1
    `;
    const params: any[] = [studentId];
    if (classId) { params.push(classId); sql += ` AND gi.class_id = $${params.length}`; }
    sql += ' ORDER BY gi.display_order, gi.id';
    return this.dataSource.query(sql, params);
  }

  async upsert(gradeItemId: number, studentId: number, score: number, feedback?: string, gradedBy?: number) {
    const exist = await this.repo.findOne({ where: { gradeItemId, studentId } });
    if (exist) {
      await this.repo.update(exist.id, { score, feedback, gradedBy });
      return this.repo.findOne({ where: { id: exist.id } });
    }
    return this.repo.save(this.repo.create({ gradeItemId, studentId, score, feedback, gradedBy }));
  }

  // Bulk insert/update (used by Excel import)
  async bulkUpsert(records: Array<{ gradeItemId: number; studentId: number; score: number; feedback?: string }>) {
    const results = [];
    for (const r of records) results.push(await this.upsert(r.gradeItemId, r.studentId, r.score, r.feedback));
    return results;
  }

  /** Average grade weighted by item.weight for one student in one class */
  async classAverage(studentId: number, classId: number) {
    const rows = await this.dataSource.query(
      `SELECT g.score, gi.weight FROM grades g JOIN grade_items gi ON gi.id = g.grade_item_id
       WHERE g.student_id = $1 AND gi.class_id = $2 AND g.score IS NOT NULL`,
      [studentId, classId]
    );
    let totalW = 0, ws = 0;
    for (const r of rows) { totalW += +r.weight; ws += +r.score * +r.weight; }
    if (!totalW) return { average: null, classification: null };
    const avg = +(ws / totalW).toFixed(2);
    return { average: avg, classification: classifyAvg(avg) };
  }

  // For analytics: distribution of midterm grades in class
  async distribution(classId: number, itemName?: string) {
    const rows = await this.dataSource.query(
      `SELECT g.score FROM grades g JOIN grade_items gi ON gi.id = g.grade_item_id
       WHERE gi.class_id = $1 ${itemName ? 'AND gi.name = $2' : ''}`,
      itemName ? [classId, itemName] : [classId]
    );
    const buckets = { yeu: 0, tb: 0, kha: 0, gioi: 0 };
    for (const r of rows) {
      const s = +r.score;
      if (s < 5) buckets.yeu++;
      else if (s < 7) buckets.tb++;
      else if (s < 8.5) buckets.kha++;
      else buckets.gioi++;
    }
    return buckets;
  }
}

@Controller('grades')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GradesController {
  constructor(private readonly service: GradesService) {}

  @Get()
  findAll(@Query('gradeItemId') gid?: string, @Query('studentId') sid?: string, @Query('classId') cid?: string) {
    if (gid) return this.service.findByItem(+gid);
    if (sid) return this.service.findByStudent(+sid, cid ? +cid : undefined);
    return [];
  }

  @Get('average')
  average(@Query('studentId', ParseIntPipe) studentId: number, @Query('classId', ParseIntPipe) classId: number) {
    return this.service.classAverage(studentId, classId);
  }

  @Get('distribution/:classId')
  distribution(@Param('classId', ParseIntPipe) classId: number, @Query('itemName') itemName?: string) {
    return this.service.distribution(classId, itemName);
  }

  @Post()
  @Roles('ADMIN','TEACHER')
  upsert(@Body() body: { gradeItemId: number; studentId: number; score: number; feedback?: string }) {
    return this.service.upsert(body.gradeItemId, body.studentId, body.score, body.feedback);
  }

  @Post('bulk')
  @Roles('ADMIN','TEACHER')
  bulkUpsert(@Body() body: { records: any[] }) {
    return this.service.bulkUpsert(body.records);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([Grade])],
  controllers: [GradesController],
  providers: [GradesService],
  exports: [GradesService, TypeOrmModule],
})
export class GradesModule {}
