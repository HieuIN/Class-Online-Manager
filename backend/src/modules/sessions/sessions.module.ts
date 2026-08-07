import { Injectable, Module, Controller, Get, Post, Patch, Delete, Body, Param, ParseIntPipe, Query, UseGuards, Req, ForbiddenException, ServiceUnavailableException, BadRequestException } from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../common/roles.guard';
import { NotificationsModule, NotificationsService } from '../notifications/notifications.module';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';

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
  @Column({ name: 'zoom_require_auth', default: false }) zoomRequireAuth: boolean;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Entity('zoom_connections')
export class ZoomConnection {
  @PrimaryGeneratedColumn() id: number;
  @Column({ name: 'user_id', unique: true }) userId: number;
  @Column({ name: 'access_token', type: 'text' }) accessToken: string;
  @Column({ name: 'refresh_token', type: 'text' }) refreshToken: string;
  @Column({ name: 'expires_at', type: 'timestamptz' }) expiresAt: Date;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(ClassSession) private repo: Repository<ClassSession>,
    @InjectRepository(ZoomConnection) private zoomConnections: Repository<ZoomConnection>,
    private notificationsService: NotificationsService,
    private dataSource: DataSource,
    private config: ConfigService,
  ) {}
  findByClass(classId: number) {
    return this.repo.find({ where: { classId }, order: { sessionNo: 'ASC' } });
  }
  findOne(id: number) { return this.repo.findOne({ where: { id } }); }
  private zoomRedirectUri() {
    return this.config.get<string>('ZOOM_OAUTH_REDIRECT_URI') || 'https://api.ctalkchinese.com/api/zoom-oauth/callback';
  }
  private tokenKey() {
    return createHash('sha256').update(this.config.get<string>('JWT_SECRET') || 'ctalk-zoom-token-key').digest();
  }
  private encryptToken(value: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.tokenKey(), iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
  }
  private decryptToken(value: string) {
    const [iv, tag, encrypted] = value.split('.').map(part => Buffer.from(part, 'base64url'));
    const decipher = createDecipheriv('aes-256-gcm', this.tokenKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  }
  private oauthState(userId: number) {
    const payload = Buffer.from(JSON.stringify({ userId, exp: Date.now() + 10 * 60 * 1000 })).toString('base64url');
    const signature = createHmac('sha256', this.tokenKey()).update(payload).digest('base64url');
    return `${payload}.${signature}`;
  }
  private verifyOauthState(state: string) {
    const [payload, signature] = String(state || '').split('.');
    if (!payload || !signature) throw new BadRequestException('OAuth state không hợp lệ');
    const expected = createHmac('sha256', this.tokenKey()).update(payload).digest();
    const actual = Buffer.from(signature, 'base64url');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new BadRequestException('OAuth state không hợp lệ');
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!parsed.userId || parsed.exp < Date.now()) throw new BadRequestException('Yêu cầu kết nối Zoom đã hết hạn');
    return Number(parsed.userId);
  }
  zoomOauthUrl(user: any) {
    if (!['TEACHER', 'ADMIN'].includes(user.role)) throw new ForbiddenException('Chỉ giáo viên hoặc quản trị viên được kết nối Zoom');
    const clientId = this.config.get<string>('ZOOM_MEETING_SDK_KEY');
    if (!clientId) throw new ServiceUnavailableException('Zoom OAuth chưa được cấu hình');
    const params = new URLSearchParams({ response_type: 'code', client_id: clientId, redirect_uri: this.zoomRedirectUri(), state: this.oauthState(user.id) });
    return { url: `https://zoom.us/oauth/authorize?${params.toString()}` };
  }
  async zoomOauthCallback(code: string, state: string) {
    const userId = this.verifyOauthState(state);
    const tokens = await this.exchangeZoomToken({ grant_type: 'authorization_code', code, redirect_uri: this.zoomRedirectUri() });
    const existing = await this.zoomConnections.findOne({ where: { userId } });
    await this.zoomConnections.save(this.zoomConnections.create({
      ...(existing || {}), userId,
      accessToken: this.encryptToken(tokens.access_token),
      refreshToken: this.encryptToken(tokens.refresh_token),
      expiresAt: new Date(Date.now() + Number(tokens.expires_in || 3600) * 1000),
    }));
    return this.config.get<string>('FRONTEND_URL') || 'https://ctalkchinese.com';
  }
  private async exchangeZoomToken(params: Record<string, string>) {
    const clientId = this.config.get<string>('ZOOM_MEETING_SDK_KEY') || '';
    const clientSecret = this.config.get<string>('ZOOM_MEETING_SDK_SECRET') || '';
    const response = await fetch(`https://zoom.us/oauth/token?${new URLSearchParams(params)}`, {
      method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}` },
    });
    const data: any = await response.json();
    if (!response.ok) throw new BadRequestException(data?.reason || data?.message || 'Không thể kết nối tài khoản Zoom');
    return data;
  }
  private async getTeacherZak(userId: number) {
    const connection = await this.zoomConnections.findOne({ where: { userId } });
    if (!connection) return '';
    let accessToken = this.decryptToken(connection.accessToken);
    if (new Date(connection.expiresAt).getTime() <= Date.now() + 60_000) {
      const tokens = await this.exchangeZoomToken({ grant_type: 'refresh_token', refresh_token: this.decryptToken(connection.refreshToken) });
      accessToken = tokens.access_token;
      connection.accessToken = this.encryptToken(tokens.access_token);
      if (tokens.refresh_token) connection.refreshToken = this.encryptToken(tokens.refresh_token);
      connection.expiresAt = new Date(Date.now() + Number(tokens.expires_in || 3600) * 1000);
      await this.zoomConnections.save(connection);
    }
    const response = await fetch('https://api.zoom.us/v2/users/me/token?type=zak', { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) return '';
    const data: any = await response.json();
    return String(data.token || '');
  }
  async zoomJoinConfig(id: number, user: any) {
    const session = await this.findOne(id);
    if (!session) throw new BadRequestException('Buổi học không tồn tại');

    const access = await this.dataSource.query(
      `SELECT c.teacher_id AS "teacherId", c.name AS "className", co.name AS "courseName",
              EXISTS(SELECT 1 FROM enrollments e WHERE e.class_id = c.id AND e.student_id = $2 AND e.is_active = true) AS enrolled
       FROM classes c LEFT JOIN courses co ON co.id = c.course_id WHERE c.id = $1`,
      [session.classId, user.id],
    );
    const allowed = user.role === 'ADMIN' || Number(access[0]?.teacherId) === Number(user.id) || access[0]?.enrolled === true;
    if (!allowed) throw new ForbiddenException('Bạn không thuộc lớp học này');

    const url = String(session.meetingUrl || '');
    let parsed: URL;
    try { parsed = new URL(url); } catch { throw new BadRequestException('Đường dẫn Zoom không hợp lệ'); }
    if (!/(^|\.)zoom\.us$/i.test(parsed.hostname)) throw new BadRequestException('Buổi học này không sử dụng Zoom');
    const meetingNumber = parsed.pathname.match(/\/(?:j|s|wc)\/(\d+)/i)?.[1];
    if (!meetingNumber) throw new BadRequestException('Không tìm thấy mã cuộc họp trong đường dẫn Zoom');

    const sdkKey = this.config.get<string>('ZOOM_MEETING_SDK_KEY');
    const sdkSecret = this.config.get<string>('ZOOM_MEETING_SDK_SECRET');
    if (!sdkKey || !sdkSecret) throw new ServiceUnavailableException('Phòng học trực tiếp chưa được cấu hình. Vui lòng mở bằng Zoom.');

    // Starting a meeting as host additionally requires a host ZAK. Without it,
    // teachers join safely as participants and can use the external Zoom fallback to host.
    const isClassTeacher = Number(access[0]?.teacherId) === Number(user.id);
    const hostZak = isClassTeacher ? (await this.getTeacherZak(user.id) || this.config.get<string>('ZOOM_HOST_ZAK') || '') : '';
    const role = isClassTeacher && hostZak ? 1 : 0;
    const now = Math.floor(Date.now() / 1000) - 30;
    const expires = now + 60 * 60 * 2;
    const header = { alg: 'HS256', typ: 'JWT' };
    const payload = { sdkKey, appKey: sdkKey, mn: meetingNumber, role, iat: now, exp: expires, tokenExp: expires };
    const encode = (value: any) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const unsigned = `${encode(header)}.${encode(payload)}`;
    const signature = `${unsigned}.${createHmac('sha256', sdkSecret).update(unsigned).digest('base64url')}`;

    const displayName = [access[0]?.courseName, access[0]?.className, user.fullName || user.email]
      .filter(Boolean).join(' – ').slice(0, 64) || 'Ctalk Chinese';
    const plannedDate = String(session.plannedDate).slice(0, 10);
    const startTime = String(session.startTime || '00:00:00').slice(0, 8);
    const endTime = session.endTime ? String(session.endTime).slice(0, 8) : null;
    return {
      sdkKey, signature, meetingNumber, role,
      password: parsed.searchParams.get('pwd') || '',
      zak: role === 1 ? hostZak : '',
      userName: displayName,
      meetingUrl: url,
      topic: session.topic || `Buổi ${session.sessionNo}`,
      startsAt: `${plannedDate}T${startTime}+07:00`,
      endsAt: endTime ? `${plannedDate}T${endTime}+07:00` : null,
      canStartInWeb: role === 1,
    };
  }
  private async inviteStudents(session: ClassSession, studentIds: number[], sendEmail: boolean, isUpdate = false) {
    const ids = [...new Set((studentIds || []).map(Number).filter(Boolean))];
    if (!ids.length) return { selected: 0, notified: 0, emailed: 0, emailConfigured: false };
    const students = await this.dataSource.query(
      `SELECT u.id, u.email, u.full_name as "fullName", c.name as "className"
       FROM users u JOIN enrollments e ON e.student_id = u.id JOIN classes c ON c.id = e.class_id
       WHERE e.class_id = $1 AND e.is_active = true AND u.id = ANY($2::int[])`,
      [session.classId, ids],
    );
    const date = String(session.plannedDate).slice(0, 10).split('-').reverse().join('/');
    const start = String(session.startTime || '').slice(0, 5);
    for (const student of students) {
      await this.notificationsService.create({
        userId: student.id, notifType: 'REMINDER',
        title: isUpdate ? 'Lịch học đã được cập nhật' : 'Bạn có lịch học mới',
        content: `Lớp ${student.className}: ${session.topic || `Buổi ${session.sessionNo}`} vào ${date} lúc ${start}.${session.meetingUrl ? ' Đã có đường dẫn phòng học.' : ''}`,
        relatedUrl: '/calendar',
      });
    }
    const host = this.config.get<string>('SMTP_HOST');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    if (!sendEmail || !host || !user || !pass) return { selected: students.length, notified: students.length, emailed: 0, emailConfigured: !!(host && user && pass) };
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({ host, port: parseInt(this.config.get<string>('SMTP_PORT') || '587', 10), secure: this.config.get<string>('SMTP_SECURE') === 'true', auth: { user, pass } });
    const results = await Promise.allSettled(students.map((student: any) => transporter.sendMail({
      from: this.config.get<string>('SMTP_FROM') || user,
      to: student.email,
      subject: `${isUpdate ? '[Cập nhật] ' : ''}Lịch học ${student.className} - ${date} ${start}`,
      text: `Xin chào ${student.fullName},\n\n${isUpdate ? 'Lịch học đã được cập nhật.' : 'Bạn được mời tham gia buổi học mới.'}\nLớp: ${student.className}\nChủ đề: ${session.topic || `Buổi ${session.sessionNo}`}\nThời gian: ${date} ${start}-${String(session.endTime || '').slice(0, 5)}\nLink phòng học: ${session.meetingUrl || 'Giáo viên sẽ cập nhật sau'}\n\nCtalk Chinese`,
    })));
    return { selected: students.length, notified: students.length, emailed: results.filter(result => result.status === 'fulfilled').length, emailConfigured: true };
  }
  async create(data: Partial<ClassSession> & { inviteStudentIds?: number[]; sendEmailInvites?: boolean }) {
    const { inviteStudentIds = [], sendEmailInvites = false, ...sessionData } = data;
    const session = await this.repo.save(this.repo.create(sessionData));
    const invites = await this.inviteStudents(session, inviteStudentIds, sendEmailInvites);
    await this.notificationsService.runClassReminders();
    return { ...session, invites };
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
  async update(id: number, data: Partial<ClassSession> & { inviteStudentIds?: number[]; sendEmailInvites?: boolean }) {
    const { inviteStudentIds = [], sendEmailInvites = false, ...sessionData } = data;
    if (sessionData.plannedDate !== undefined || sessionData.startTime !== undefined || sessionData.meetingUrl !== undefined) {
      await this.notificationsService.clearSessionReminder(id);
    }
    await this.repo.update(id, sessionData);
    await this.notificationsService.runClassReminders();
    const session = await this.findOne(id);
    const invites = session ? await this.inviteStudents(session, inviteStudentIds, sendEmailInvites, true) : null;
    return session ? { ...session, invites } : null;
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
  @Post(':id/zoom-signature') zoomSignature(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.zoomJoinConfig(id, req.user);
  }
  @Post('generate') @Roles('ADMIN','TEACHER') generate(@Body() body: any) { return this.service.generate(body); }
  @Get(':id') findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOne(id); }
  @Post() @Roles('ADMIN','TEACHER') create(@Body() body: any) { return this.service.create(body); }
  @Patch(':id') @Roles('ADMIN','TEACHER') update(@Param('id', ParseIntPipe) id: number, @Body() body: any) { return this.service.update(id, body); }
  @Delete(':id') @Roles('ADMIN','TEACHER') remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); }
}

@Controller('zoom-oauth')
export class ZoomOAuthController {
  constructor(private readonly service: SessionsService) {}
  @Get('url') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMIN','TEACHER') url(@Req() req: any) { return this.service.zoomOauthUrl(req.user); }
  @Get('callback') async callback(@Query('code') code: string, @Query('state') state: string, @Req() req: any) {
    const frontend = await this.service.zoomOauthCallback(code, state);
    req.res.redirect(`${frontend.replace(/\/$/, '')}/calendar?zoom=connected`);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([ClassSession, ZoomConnection]), NotificationsModule],
  controllers: [SessionsController, ZoomOAuthController],
  providers: [SessionsService],
  exports: [SessionsService, TypeOrmModule],
})
export class SessionsModule {}
