import { Injectable, Module, Controller, Get, Post, Patch, Delete, Body, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../common/roles.guard';
import { NotificationsModule, NotificationsService } from '../notifications/notifications.module';

@Entity('sessions')
export class ClassSession {
  @PrimaryGeneratedColumn() id: number;
  @Column({ name: 'class_id' }) classId: number;
  @Column({ name: 'session_no' }) sessionNo: number;
  @Column({ name: 'planned_date', type: 'date' }) plannedDate: Date;
  @Column({ name: 'actual_date', type: 'date', nullable: true }) actualDate: Date;
  @Column({ name: 'start_time', type: 'time', nullable: true }) startTime: string;
  @Column({ name: 'end_time', type: 'time', nullable: true }) endTime: string;
  @Column({ nullable: true }) topic: string;
  @Column({ default: 'PLANNED' }) status: string;
  @Column({ type: 'text', nullable: true }) note: string;
  @Column({ name: 'meeting_url', type: 'text', nullable: true }) meetingUrl: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(ClassSession) private repo: Repository<ClassSession>,
    private notificationsService: NotificationsService,
  ) {}
  findByClass(classId: number) {
    return this.repo.find({ where: { classId }, order: { sessionNo: 'ASC' } });
  }
  findOne(id: number) { return this.repo.findOne({ where: { id } }); }
  async create(data: Partial<ClassSession>) {
    const session = await this.repo.save(this.repo.create(data));
    await this.notificationsService.runClassReminders();
    return session;
  }
  async generate(data: { classId: number; startDate: string; weekdays: number[]; startTime?: string; endTime?: string; totalSessions: number }) {
    const classId = +data.classId;
    const totalSessions = Math.max(0, +data.totalSessions || 0);
    const weekdays = Array.isArray(data.weekdays) ? data.weekdays.map(Number) : [];
    if (!classId || !data.startDate || !weekdays.length || !totalSessions) return { created: 0, sessions: [] };

    const sessions: Partial<ClassSession>[] = [];
    const current = new Date(`${data.startDate}T00:00:00`);
    let sessionNo = 1;
    let guard = 0;
    while (sessions.length < totalSessions && guard < 500) {
      if (weekdays.includes(current.getDay())) {
        const plannedDate = current.toISOString().slice(0, 10) as any;
        sessions.push({
          classId,
          sessionNo,
          plannedDate,
          startTime: data.startTime || null,
          endTime: data.endTime || null,
          topic: `Buổi ${sessionNo}`,
          status: 'PLANNED',
        });
        sessionNo++;
      }
      current.setDate(current.getDate() + 1);
      guard++;
    }

    const saved = sessions.length ? await this.repo.save(this.repo.create(sessions)) : [];
    return { created: saved.length, sessions: saved };
  }
  async update(id: number, data: Partial<ClassSession>) {
    await this.repo.update(id, data);
    await this.notificationsService.runClassReminders();
    return this.findOne(id);
  }
  remove(id: number) { return this.repo.delete(id); }

  // Progress summary for a class
  async getProgress(classId: number) {
    const sessions = await this.findByClass(classId);
    const total = sessions.length;
    const done = sessions.filter(s => s.status === 'DONE').length;
    const delayed = sessions.filter(s => s.actualDate && s.plannedDate && new Date(s.actualDate) > new Date(s.plannedDate)).length;
    return {
      total, done, delayed,
      percent: total ? Math.round(done / total * 100) : 0,
      sessions,
    };
  }
}

@Controller('sessions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SessionsController {
  constructor(private readonly service: SessionsService) {}
  @Get() findAll(@Query('classId') classId: string) {
    return classId ? this.service.findByClass(+classId) : [];
  }
  @Get('progress/:classId') progress(@Param('classId', ParseIntPipe) classId: number) {
    return this.service.getProgress(classId);
  }
  @Post('generate') @Roles('ADMIN','TEACHER') generate(@Body() body: any) { return this.service.generate(body); }
  @Get(':id') findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOne(id); }
  @Post() @Roles('ADMIN','TEACHER') create(@Body() body: any) { return this.service.create(body); }
  @Patch(':id') @Roles('ADMIN','TEACHER') update(@Param('id', ParseIntPipe) id: number, @Body() body: any) { return this.service.update(id, body); }
  @Delete(':id') @Roles('ADMIN','TEACHER') remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); }
}

@Module({
  imports: [TypeOrmModule.forFeature([ClassSession]), NotificationsModule],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService, TypeOrmModule],
})
export class SessionsModule {}
