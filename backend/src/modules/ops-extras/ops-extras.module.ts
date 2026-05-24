import { Body, Controller, Get, Injectable, Module, Param, ParseIntPipe, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../common/roles.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { Response } from 'express';
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';
import { randomInt } from 'crypto';

@Injectable()
export class OpsExtrasService {
  constructor(private dataSource: DataSource, private config: ConfigService) {}

  auditLogs(query: any) {
    const params: any[] = [];
    let where = 'WHERE 1=1';
    if (query.action) { params.push(query.action); where += ` AND action = $${params.length}`; }
    if (query.actorId) { params.push(+query.actorId); where += ` AND actor_id = $${params.length}`; }
    return this.dataSource.query(
      `SELECT al.*, u.full_name as "actorName" FROM audit_logs al LEFT JOIN users u ON u.id = al.actor_id ${where} ORDER BY al.created_at DESC LIMIT 200`,
      params,
    );
  }

  createAudit(userId: number, body: any) {
    return this.dataSource.query(
      `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, before_json, after_json)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [userId, body.action, body.entityType, body.entityId || null, body.before || null, body.after || null],
    ).then(r => r[0]);
  }

  backupDir() {
    const dir = join(process.cwd(), 'backups');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    return dir;
  }

  createBackup() {
    const name = `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.sql`;
    const path = join(this.backupDir(), name);
    const content = `-- ClassManager backup placeholder\n-- Created at ${new Date().toISOString()}\n-- Configure pg_dump in production for full DB backups.\n`;
    writeFileSync(path, content, 'utf8');
    return { fileName: name, size: content.length };
  }

  listBackups() {
    return readdirSync(this.backupDir())
      .filter(f => f.endsWith('.sql'))
      .map(f => ({ fileName: f, size: statSync(join(this.backupDir(), f)).size, createdAt: statSync(join(this.backupDir(), f)).mtime }))
      .sort((a, b) => +b.createdAt - +a.createdAt);
  }

  async set2fa(userId: number, enabled: boolean) {
    await this.dataSource.query(`UPDATE users SET two_factor_enabled = $1 WHERE id = $2`, [enabled, userId]);
    return { success: true, enabled };
  }

  async sendOtp(userId: number) {
    const [user] = await this.dataSource.query(`SELECT id, email, full_name FROM users WHERE id = $1`, [userId]);
    const code = String(randomInt(100000, 999999));
    await this.dataSource.query(`INSERT INTO login_otps (user_id, code, expires_at) VALUES ($1, $2, NOW() + INTERVAL '10 minutes')`, [userId, code]);
    console.log(`[2fa] OTP for ${user.email}: ${code}`);
    const host = this.config.get<string>('SMTP_HOST');
    if (host) {
      try {
        const nodemailer = await import('nodemailer');
        const transporter = nodemailer.createTransport({
          host,
          port: parseInt(this.config.get<string>('SMTP_PORT') || '587', 10),
          secure: this.config.get<string>('SMTP_SECURE') === 'true',
          auth: { user: this.config.get<string>('SMTP_USER'), pass: this.config.get<string>('SMTP_PASS') },
        });
        await transporter.sendMail({ from: this.config.get<string>('SMTP_FROM') || this.config.get<string>('SMTP_USER'), to: user.email, subject: 'ClassManager OTP', text: `Mã OTP của bạn: ${code}` });
      } catch (e) { console.error('[2fa] send failed', e); }
    }
    return { success: true };
  }

  savePushSubscription(userId: number, subscription: any) {
    const endpoint = subscription?.endpoint || '';
    return this.dataSource.query(
      `INSERT INTO web_push_subscriptions (user_id, endpoint_hash, subscription_json)
       VALUES ($1, md5($2), $3)
       ON CONFLICT (user_id, endpoint_hash) DO UPDATE SET subscription_json = EXCLUDED.subscription_json, updated_at = NOW()
       RETURNING id`,
      [userId, endpoint, subscription],
    ).then(r => r[0]);
  }

  birthdayRun() {
    return this.dataSource.query(
      `INSERT INTO notifications (user_id, notif_type, title, content)
       SELECT id, 'BIRTHDAY', 'Chúc mừng sinh nhật', 'Chúc mừng sinh nhật ' || full_name || '!'
       FROM users
       WHERE birth_date IS NOT NULL AND to_char(birth_date, 'MM-DD') = to_char(CURRENT_DATE, 'MM-DD')
       RETURNING *`,
    );
  }

  referralCode(userId: number) {
    return this.dataSource.query(
      `INSERT INTO referral_codes (user_id, code)
       VALUES ($1, 'REF' || $1::text)
       ON CONFLICT (user_id) DO UPDATE SET code = referral_codes.code
       RETURNING *`,
      [userId],
    ).then(r => r[0]);
  }
}

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class OpsExtrasController {
  constructor(private service: OpsExtrasService) {}
  @Get('audit-logs') @Roles('ADMIN') auditLogs(@Query() query: any) { return this.service.auditLogs(query); }
  @Post('audit-logs') createAudit(@Body() body: any, @CurrentUser() user: any) { return this.service.createAudit(user.id, body); }
  @Get('backups') @Roles('ADMIN') backups() { return this.service.listBackups(); }
  @Post('backups') @Roles('ADMIN') createBackup() { return this.service.createBackup(); }
  @Get('backups/:file') @Roles('ADMIN') downloadBackup(@Param('file') file: string, @Res() res: Response) {
    return res.download(join(this.service.backupDir(), file));
  }
  @Patch('auth/2fa') set2fa(@CurrentUser() user: any, @Body() body: any) { return this.service.set2fa(user.id, !!body.enabled); }
  @Post('auth/2fa/send') sendOtp(@CurrentUser() user: any) { return this.service.sendOtp(user.id); }
  @Post('push/subscribe') push(@CurrentUser() user: any, @Body() body: any) { return this.service.savePushSubscription(user.id, body); }
  @Post('birthdays/run') @Roles('ADMIN') birthdays() { return this.service.birthdayRun(); }
  @Get('referrals/my-code') referral(@CurrentUser() user: any) { return this.service.referralCode(user.id); }
}

@Module({ controllers: [OpsExtrasController], providers: [OpsExtrasService] })
export class OpsExtrasModule {}
