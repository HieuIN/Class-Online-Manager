import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomInt } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { User } from '../users/user.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    private jwtService: JwtService,
    private dataSource: DataSource,
    private config: ConfigService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.userRepo.findOne({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Sai email hoặc mật khẩu');
    }
    if (!user.isActive) throw new UnauthorizedException('Tài khoản đã bị khóa');

    if (user.twoFactorEnabled) {
      await this.sendLoginOtp(user);
      return { requiresOtp: true, userId: user.id };
    }

    return this.signUser(user);
  }

  private signUser(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role, fullName: user.fullName };
    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
    };
  }

  async verifyOtp(userId: number, code: string) {
    const user = await this.userRepo.findOne({ where: { id: userId, isActive: true } });
    if (!user) throw new UnauthorizedException();
    const [otp] = await this.dataSource.query(
      `SELECT id FROM login_otps
       WHERE user_id = $1 AND code = $2 AND used_at IS NULL AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [userId, code],
    );
    if (!otp) throw new UnauthorizedException('OTP khong hop le hoac da het han');
    await this.dataSource.query(`UPDATE login_otps SET used_at = NOW() WHERE id = $1`, [otp.id]);
    return this.signUser(user);
  }

  async register(data: { email: string; password: string; fullName: string; phone?: string; role?: string }) {
    const exists = await this.userRepo.findOne({ where: { email: data.email } });
    if (exists) throw new ConflictException('Email đã tồn tại');

    const hash = await bcrypt.hash(data.password, 10);
    const user = this.userRepo.create({
      email: data.email,
      passwordHash: hash,
      fullName: data.fullName,
      phone: data.phone,
      role: data.role || 'STUDENT',
    });
    await this.userRepo.save(user);
    return this.login(data.email, data.password);
  }

  async changePassword(userId: number, oldPassword: string, newPassword: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    if (!(await bcrypt.compare(oldPassword, user.passwordHash))) {
      throw new BadRequestException('Mật khẩu hiện tại không đúng');
    }
    if (!newPassword || newPassword.length < 6) {
      throw new BadRequestException('Mật khẩu mới tối thiểu 6 ký tự');
    }
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await this.userRepo.save(user);
    return { success: true };
  }

  async forgotPassword(email: string) {
    const normalizedEmail = (email || '').trim().toLowerCase();
    const user = normalizedEmail
      ? await this.userRepo.findOne({ where: { email: normalizedEmail, isActive: true } })
      : null;

    if (!user) return { success: true };

    const token = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await this.dataSource.query(
      `DELETE FROM password_reset_tokens WHERE user_id = $1 AND used_at IS NULL`,
      [user.id],
    );
    await this.dataSource.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [user.id, tokenHash, expiresAt],
    );

    const frontendUrl = this.config.get<string>('FRONTEND_URL') || this.config.get<string>('CORS_ORIGIN') || 'http://localhost:5173';
    const resetUrl = `${frontendUrl.replace(/\/$/, '')}/reset-password?token=${token}`;
    const sent = await this.sendResetEmail(user, resetUrl);

    const response: any = { success: true };
    if (!sent && this.config.get<string>('NODE_ENV') !== 'production') {
      response.devResetUrl = resetUrl;
    }
    return response;
  }

  async resetPassword(token: string, newPassword: string) {
    if (!token) throw new BadRequestException('Token không hợp lệ');
    if (!newPassword || newPassword.length < 6) {
      throw new BadRequestException('Mật khẩu mới tối thiểu 6 ký tự');
    }

    const tokenHash = this.hashToken(token);
    const rows = await this.dataSource.query(
      `SELECT prt.id, prt.user_id
       FROM password_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
       WHERE prt.token_hash = $1
         AND prt.used_at IS NULL
         AND prt.expires_at > NOW()
         AND u.is_active = TRUE
       LIMIT 1`,
      [tokenHash],
    );
    const reset = rows[0];
    if (!reset) throw new BadRequestException('Link reset đã hết hạn hoặc không hợp lệ');

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.dataSource.query(
      `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
      [passwordHash, reset.user_id],
    );
    await this.dataSource.query(
      `UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1`,
      [reset.id],
    );

    return { success: true };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private async sendLoginOtp(user: User) {
    const code = String(randomInt(100000, 999999));
    await this.dataSource.query(
      `INSERT INTO login_otps (user_id, code, expires_at) VALUES ($1, $2, NOW() + INTERVAL '10 minutes')`,
      [user.id, code],
    );

    const host = this.config.get<string>('SMTP_HOST');
    const userName = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    if (!host || !userName || !pass) {
      console.log(`[auth] OTP for ${user.email}: ${code}`);
      return false;
    }

    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host,
      port: parseInt(this.config.get<string>('SMTP_PORT') || '587', 10),
      secure: this.config.get<string>('SMTP_SECURE') === 'true',
      auth: { user: userName, pass },
    });
    await transporter.sendMail({
      from: this.config.get<string>('SMTP_FROM') || userName,
      to: user.email,
      subject: 'ClassManager OTP',
      text: `Ma OTP ClassManager cua ban: ${code}`,
    });
    return true;
  }

  private async sendResetEmail(user: User, resetUrl: string): Promise<boolean> {
    const host = this.config.get<string>('SMTP_HOST');
    const userName = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    if (!host || !userName || !pass) {
      console.log(`[auth] Password reset link for ${user.email}: ${resetUrl}`);
      return false;
    }

    const nodemailer = await import('nodemailer');
    const port = parseInt(this.config.get<string>('SMTP_PORT') || '587', 10);
    const secure = this.config.get<string>('SMTP_SECURE') === 'true';
    const from = this.config.get<string>('SMTP_FROM') || userName;
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user: userName, pass },
    });

    await transporter.sendMail({
      from,
      to: user.email,
      subject: 'Reset mật khẩu ClassManager',
      html: `
        <p>Xin chào ${user.fullName || user.email},</p>
        <p>Bạn vừa yêu cầu đặt lại mật khẩu ClassManager. Link này hết hạn sau 30 phút.</p>
        <p><a href="${resetUrl}">Đặt lại mật khẩu</a></p>
        <p>Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>
      `,
    });
    return true;
  }
}
