import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const activated = await super.canActivate(context);
    const request = context.switchToHttp().getRequest();
    const allowWhileChangingPassword = ['/api/auth/me', '/api/auth/change-password'];

    if (request.user?.mustChangePassword && !allowWhileChangingPassword.includes(request.path)) {
      throw new ForbiddenException('Vui lòng đổi mật khẩu tạm thời trước khi tiếp tục');
    }

    return Boolean(activated);
  }
}
