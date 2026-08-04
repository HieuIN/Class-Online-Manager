import { Injectable, Module, Controller, Get, Post, Patch, Body, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Repository, DataSource } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { Roles, RolesGuard } from '../../common/roles.guard';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn() id: number;
  @Column({ name: 'user_id' }) userId: number;
  @Column({ name: 'notif_type', nullable: true }) notifType: string;
  @Column() title: string;
  @Column({ type: 'text', nullable: true }) content: string;
  @Column({ name: 'related_url', nullable: true }) relatedUrl: string;
  @Column({ name: 'is_read', default: false }) isRead: boolean;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Entity('alert_rules')
export class AlertRule {
  @PrimaryGeneratedColumn() id: number;
  @Column({ name: 'class_id', unique: true }) classId: number;
  @Column({ name: 'max_total_absences', nullable: true }) maxTotalAbsences: number;
  @Column({ name: 'max_consecutive_absences', nullable: true }) maxConsecutiveAbsences: number;
  @Column({ name: 'max_missing_assignments', nullable: true }) maxMissingAssignments: number;
  @Column({ name: 'is_active', default: true }) isActive: boolean;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification) private notifRepo: Repository<Notification>,
    @InjectRepository(AlertRule) private ruleRepo: Repository<AlertRule>,
    private dataSource: DataSource,
  ) {}

  list(userId: number) {
    return this.notifRepo.find({ where: { userId }, order: { createdAt: 'DESC' }, take: 50 });
  }

  unreadCount(userId: number) {
    return this.notifRepo.count({ where: { userId, isRead: false } });
  }

  markRead(id: number) { return this.notifRepo.update(id, { isRead: true }); }
  markAllRead(userId: number) { return this.notifRepo.update({ userId, isRead: false }, { isRead: true }); }

  create(d: Partial<Notification>) { return this.notifRepo.save(this.notifRepo.create(d)); }

  clearSessionReminder(sessionId: number) {
    return this.notifRepo.createQueryBuilder()
      .delete()
      .where('notif_type = :type', { type: 'REMINDER' })
      .andWhere('content LIKE :marker', { marker: `%session_id=${sessionId};%` })
      .execute();
  }

  private async createOnce(userId: number, notifType: string, marker: string, data: Partial<Notification>) {
    const exists = await this.notifRepo.createQueryBuilder('notification')
      .where('notification.userId = :userId', { userId })
      .andWhere('notification.notifType = :notifType', { notifType })
      .andWhere('notification.content LIKE :marker', { marker: `%${marker}%` })
      .getCount();
    if (exists) return false;
    await this.create({ userId, notifType, ...data });
    return true;
  }

  @Cron('0 */5 * * * *')
  async runClassReminders() {
    const sessions = await this.dataSource.query(
      `SELECT s.id, s.class_id, s.session_no, s.planned_date, s.start_time, s.end_time, s.meeting_url, c.name as class_name, c.teacher_id
       FROM sessions s
       JOIN classes c ON c.id = s.class_id
       WHERE s.status = 'PLANNED'
         AND s.start_time IS NOT NULL
         AND s.planned_date = CURRENT_DATE
         AND (s.planned_date + s.start_time) BETWEEN NOW() AND NOW() + INTERVAL '15 minutes'`,
    );

    let created = 0;
    for (const s of sessions) {
      const users = await this.dataSource.query(
        `SELECT student_id as user_id FROM enrollments WHERE class_id = $1 AND is_active = true
         UNION
         SELECT $2::int as user_id WHERE $2::int IS NOT NULL`,
        [s.class_id, s.teacher_id],
      );
      const time = String(s.start_time).slice(0, 5);
      const date = String(s.planned_date).slice(0, 10);
      const endTime = s.end_time ? String(s.end_time).slice(0, 5) : '';
      const content = `session_id=${s.id};start_at=${date}T${time};end_at=${endTime ? `${date}T${endTime}` : ''}; Lớp ${s.class_name} sẽ bắt đầu lúc ${time}. ${s.meeting_url ? 'Đã có đường dẫn phòng học.' : 'Giáo viên chưa cập nhật đường dẫn phòng học.'}`;
      for (const u of users) {
        const wasCreated = await this.createOnce(u.user_id, 'REMINDER', `session_id=${s.id};`, {
          title: 'Buổi học sắp bắt đầu',
          content,
          relatedUrl: s.meeting_url,
        });
        if (wasCreated) created++;
      }
      console.log(`[reminder] Class ${s.class_name} session ${s.session_no}: created ${created} notifications so far`);
    }
    return { sessions: sessions.length, notifications: created };
  }

  /** Publish scheduled assignments and notify students before their deadlines. */
  @Cron('0 */15 * * * *')
  async runAssignmentWorkflow() {
    const published = await this.dataSource.query(
      `UPDATE assignments SET status = 'PUBLISHED'
       WHERE status = 'DRAFT' AND publish_at IS NOT NULL AND publish_at <= NOW()
       RETURNING id, class_id, title, due_date`,
    );
    let publicationNotifications = 0;
    for (const assignment of published) {
      const students = await this.dataSource.query(`SELECT student_id FROM enrollments WHERE class_id = $1 AND is_active = true`, [assignment.class_id]);
      for (const student of students) {
        const created = await this.createOnce(student.student_id, 'ASSIGNMENT_PUBLISHED', `assignment_id=${assignment.id};published;`, {
          title: 'Bài tập mới đã phát hành',
          content: `assignment_id=${assignment.id};published; ${assignment.title} đã sẵn sàng. Hạn nộp: ${new Date(assignment.due_date).toLocaleString('vi-VN')}.`,
          relatedUrl: '/student/assignments',
        });
        if (created) publicationNotifications++;
      }
    }

    const dueAssignments = await this.dataSource.query(
      `SELECT a.id, a.class_id, a.title, a.due_date,
              CASE WHEN a.due_date BETWEEN NOW() + INTERVAL '45 minutes' AND NOW() + INTERVAL '75 minutes' THEN '1h' ELSE '24h' END as window
       FROM assignments a
       WHERE a.status = 'PUBLISHED'
         AND ((a.due_date BETWEEN NOW() + INTERVAL '45 minutes' AND NOW() + INTERVAL '75 minutes')
           OR (a.due_date BETWEEN NOW() + INTERVAL '23 hours 45 minutes' AND NOW() + INTERVAL '24 hours 15 minutes'))`,
    );
    let deadlineNotifications = 0;
    for (const assignment of dueAssignments) {
      const students = await this.dataSource.query(
        `SELECT e.student_id
         FROM enrollments e
         WHERE e.class_id = $1 AND e.is_active = true
           AND NOT EXISTS (
             SELECT 1 FROM submissions s
             LEFT JOIN assignment_group_members gm ON gm.group_id = s.group_id
             WHERE s.assignment_id = $2 AND (s.student_id = e.student_id OR gm.student_id = e.student_id)
           )`,
        [assignment.class_id, assignment.id],
      );
      for (const student of students) {
        const marker = `assignment_id=${assignment.id};due=${assignment.window};`;
        const created = await this.createOnce(student.student_id, 'ASSIGNMENT_DUE', marker, {
          title: 'Sắp đến hạn nộp bài',
          content: `${marker} ${assignment.title} sẽ đến hạn lúc ${new Date(assignment.due_date).toLocaleString('vi-VN')}.`,
          relatedUrl: '/student/assignments',
        });
        if (created) deadlineNotifications++;
      }
    }
    return { published: published.length, publicationNotifications, deadlineNotifications };
  }

  getRule(classId: number) { return this.ruleRepo.findOne({ where: { classId } }); }
  async upsertRule(classId: number, data: Partial<AlertRule>) {
    const exist = await this.getRule(classId);
    if (exist) { await this.ruleRepo.update(exist.id, data); return this.getRule(classId); }
    return this.ruleRepo.save(this.ruleRepo.create({ classId, ...data }));
  }

  /** Auto-check absence + missing-assignment rules. Run nightly. */
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async runAlertCheck() {
    const rules = await this.ruleRepo.find({ where: { isActive: true } });
    for (const rule of rules) {
      // Total absences check
      if (rule.maxTotalAbsences != null) {
        const rows = await this.dataSource.query(
          `SELECT a.student_id, COUNT(*)::int as absences, u.full_name
           FROM attendance a
           JOIN sessions s ON s.id = a.session_id
           JOIN users u ON u.id = a.student_id
           WHERE s.class_id = $1 AND a.status = 'ABSENT'
           GROUP BY a.student_id, u.full_name
           HAVING COUNT(*) > $2`,
          [rule.classId, rule.maxTotalAbsences]
        );
        for (const r of rows) {
          await this.create({
            userId: r.student_id,
            notifType: 'ALERT_ABSENCE',
            title: 'Cảnh báo vắng mặt',
            content: `Bạn đã vắng ${r.absences} buổi (vượt mức cho phép ${rule.maxTotalAbsences})`,
          });
        }
      }

      // Missing assignment check
      if (rule.maxMissingAssignments != null) {
        const rows = await this.dataSource.query(
          `SELECT e.student_id, u.full_name,
            COUNT(a.id) - COUNT(s.id) as missing
           FROM enrollments e
           JOIN users u ON u.id = e.student_id
           CROSS JOIN assignments a
           LEFT JOIN submissions s ON s.assignment_id = a.id AND s.student_id = e.student_id
           WHERE e.class_id = $1 AND a.class_id = $1 AND e.is_active = true
           GROUP BY e.student_id, u.full_name
           HAVING COUNT(a.id) - COUNT(s.id) > $2`,
          [rule.classId, rule.maxMissingAssignments]
        );
        for (const r of rows) {
          await this.create({
            userId: r.student_id,
            notifType: 'ALERT_HOMEWORK',
            title: 'Cảnh báo nộp bài',
            content: `Bạn chưa nộp ${r.missing} bài tập (vượt mức ${rule.maxMissingAssignments})`,
          });
        }
      }
    }
  }
}

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}
  @Get() list(@CurrentUser() user: any) { return this.service.list(user.id); }
  @Get('unread-count') unread(@CurrentUser() user: any) { return this.service.unreadCount(user.id); }
  @Patch(':id/read') markRead(@Param('id', ParseIntPipe) id: number) { return this.service.markRead(id); }
  @Patch('read-all') markAllRead(@CurrentUser() user: any) { return this.service.markAllRead(user.id); }

  @Get('rules/:classId') @Roles('ADMIN','TEACHER') getRule(@Param('classId', ParseIntPipe) classId: number) { return this.service.getRule(classId); }
  @Post('rules/:classId') @Roles('ADMIN','TEACHER') setRule(@Param('classId', ParseIntPipe) classId: number, @Body() body: any) { return this.service.upsertRule(classId, body); }

  @Post('test-trigger') @Roles('ADMIN') async trigger() {
    const alerts = await this.service.runAlertCheck();
    const reminders = await this.service.runClassReminders();
    const assignments = await this.service.runAssignmentWorkflow();
    return { alerts, reminders, assignments };
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([Notification, AlertRule])],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService, TypeOrmModule],
})
export class NotificationsModule {}
