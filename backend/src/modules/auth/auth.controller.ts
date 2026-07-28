import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { Roles, RolesGuard } from '../../common/roles.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body.email, body.password);
  }

  @Post('verify-2fa')
  verify2fa(@Body() body: { userId: number; code: string }) {
    return this.authService.verifyOtp(body.userId, body.code);
  }

  @Post('register')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  register(@Body() body: any) {
    return this.authService.register(body);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: any) {
    return this.authService.getSessionUser(user.id);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  changePassword(@CurrentUser() user: any, @Body() body: { oldPassword: string; newPassword: string }) {
    return this.authService.changePassword(user.id, body.oldPassword, body.newPassword);
  }

  @Post('forgot-password')
  forgotPassword(@Body() body: { email: string }) {
    return this.authService.forgotPassword(body.email);
  }

  @Post('reset-password')
  resetPassword(@Body() body: { token: string; newPassword: string }) {
    return this.authService.resetPassword(body.token, body.newPassword);
  }
}
