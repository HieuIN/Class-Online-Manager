import { Header, Injectable, Module, Controller, Get, Post, Delete, Body, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Repository, Between, DataSource } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../common/roles.guard';
import { CurrentUser } from '../../common/current-user.decorator';

@Entity('calendar_events')
export class CalendarEvent {
  @PrimaryGeneratedColumn() id: number;
  @Column({ name: 'class_id', nullable: true }) classId: number;
  @Column({ name: 'event_type' }) eventType: string;
  @Column({ name: 'related_id', nullable: true }) relatedId: number;
  @Column() title: string;
  @Column({ type: 'text', nullable: true }) description: string;
  @Column({ name: 'start_time', type: 'timestamp' }) startTime: Date;
  @Column({ name: 'end_time', type: 'timestamp', nullable: true }) endTime: Date;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Injectable()
export class CalendarService {
  constructor(
    @InjectRepository(CalendarEvent) private repo: Repository<CalendarEvent>,
    private dataSource: DataSource,
  ) {}

  findRange(start: string, end: string, classId?: number) {
    const where: any = { startTime: Between(new Date(start), new Date(end)) };
    if (classId) where.classId = classId;
    return this.repo.find({ where, order: { startTime: 'ASC' } });
  }

  // Aggregated events for a user (sessions + assignment deadlines from their classes)
  async forUser(userId: number, role: string, start: string, end: string) {
    const events: any[] = [];

    // 1. Sessions for classes user belongs to
    let classFilter = '';
    const params: any[] = [start, end];
    if (role === 'TEACHER') { params.push(userId); classFilter = `AND c.teacher_id = $3`; }
    else if (role === 'STUDENT') {
      params.push(userId);
      classFilter = `AND c.id IN (SELECT class_id FROM enrollments WHERE student_id = $3 AND is_active = true)`;
    }

    const sessions = await this.dataSource.query(
      `SELECT s.id,
              (s.planned_date + COALESCE(s.start_time, TIME '00:00')) as "startTime",
              CASE WHEN s.end_time IS NULL THEN NULL ELSE (s.planned_date + s.end_time) END as "endTime",
              s.topic as title,
              s.meeting_url as "meetingUrl",
              s.zoom_require_auth as "zoomRequireAuth",
              s.session_no as "sessionNo",
              c.name as "className",
              'SESSION' as "eventType",
              c.id as "classId"
       FROM sessions s JOIN classes c ON c.id = s.class_id
       WHERE s.planned_date BETWEEN $1 AND $2 ${classFilter}`, params);
    events.push(...sessions);

    // 2. Assignment deadlines
    const assignments = await this.dataSource.query(
      `SELECT a.id, a.due_date as "startTime", CONCAT('Hạn nộp: ', a.title) as title, c.name as "className", 'ASSIGNMENT_DUE' as "eventType", c.id as "classId"
       FROM assignments a JOIN classes c ON c.id = a.class_id
       WHERE a.due_date BETWEEN $1 AND $2 ${classFilter}`, params);
    events.push(...assignments);

    // 3. Custom calendar events
    const custom = await this.repo.find({ where: { startTime: Between(new Date(start), new Date(end)) } });
    events.push(...custom);

    return events.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }

  create(d: Partial<CalendarEvent>) { return this.repo.save(this.repo.create(d)); }
  remove(id: number) { return this.repo.delete(id); }

  async exportClassIcs(classId: number, userId: number, role: string) {
    if (!classId) return '';
    const accessFilter =
      role === 'TEACHER' ? 'AND c.teacher_id = $2' :
      role === 'STUDENT' ? 'AND c.id IN (SELECT class_id FROM enrollments WHERE student_id = $2 AND is_active = true)' :
      '';
    const params = accessFilter ? [classId, userId] : [classId];
    const sessions = await this.dataSource.query(
      `SELECT s.id, s.session_no, s.planned_date, s.start_time, s.end_time, s.topic, s.meeting_url, c.name as "className"
       FROM sessions s
       JOIN classes c ON c.id = s.class_id
       WHERE c.id = $1 ${accessFilter}
       ORDER BY s.planned_date, s.start_time, s.session_no`,
      params,
    );

    const escapeText = (value: any) => String(value || '')
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\r?\n/g, '\\n');
    const dt = (date: any, time?: string) => {
      const d = new Date(`${String(date).slice(0, 10)}T${time || '00:00'}:00+07:00`);
      return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    };
    const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//ClassManager//Calendar//VI',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
    ];

    for (const s of sessions) {
      const start = dt(s.planned_date, s.start_time || '00:00');
      const end = dt(s.planned_date, s.end_time || s.start_time || '00:00');
      const title = `${s.className} - Buổi ${s.session_no}${s.topic ? `: ${s.topic}` : ''}`;
      const description = [s.topic, s.meeting_url ? `Link học: ${s.meeting_url}` : ''].filter(Boolean).join('\n');
      lines.push(
        'BEGIN:VEVENT',
        `UID:class-manager-session-${s.id}@classmanager`,
        `DTSTAMP:${now}`,
        `DTSTART:${start}`,
        `DTEND:${end}`,
        `SUMMARY:${escapeText(title)}`,
        `DESCRIPTION:${escapeText(description)}`,
      );
      if (s.meeting_url) lines.push(`URL:${escapeText(s.meeting_url)}`);
      lines.push('END:VEVENT');
    }

    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }
}

@Controller('calendar')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CalendarController {
  constructor(private readonly service: CalendarService) {}

  @Get()
  list(@Query('start') start: string, @Query('end') end: string, @CurrentUser() user: any) {
    return this.service.forUser(user.id, user.role, start, end);
  }

  @Get('range')
  range(@Query('start') start: string, @Query('end') end: string, @Query('classId') classId?: string) {
    return this.service.findRange(start, end, classId ? +classId : undefined);
  }

  @Get('export.ics')
  @Header('Content-Type', 'text/calendar; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="class-manager-calendar.ics"')
  exportIcs(@Query('classId', ParseIntPipe) classId: number, @CurrentUser() user: any) {
    return this.service.exportClassIcs(classId, user.id, user.role);
  }

  @Post() @Roles('ADMIN','TEACHER') create(@Body() body: any) { return this.service.create(body); }
  @Delete(':id') @Roles('ADMIN','TEACHER') remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); }
}

@Module({
  imports: [TypeOrmModule.forFeature([CalendarEvent])],
  controllers: [CalendarController],
  providers: [CalendarService],
  exports: [CalendarService, TypeOrmModule],
})
export class CalendarModule {}
