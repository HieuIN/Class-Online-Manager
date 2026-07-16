import { Body, Controller, Delete, ForbiddenException, Get, Param, ParseIntPipe, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../common/roles.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { ensureUploadDir } from '../../common/upload-dir.util';

const avatarDir = () => ensureUploadDir('avatars');

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get()
  @Roles('ADMIN', 'TEACHER')
  findAll(@Query('role') role?: string) { return this.service.findAll(role); }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOne(id); }

  @Post()
  @Roles('ADMIN')
  create(@Body() body: any) { return this.service.create(body); }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: any, @CurrentUser() user: any) {
    if (user.role !== 'ADMIN' && +user.id !== +id) throw new ForbiddenException('No permission');
    const allowed = user.role === 'ADMIN'
      ? body
      : { fullName: body.fullName, phone: body.phone, birthDate: body.birthDate };
    return this.service.update(id, allowed);
  }

  @Post(':id/avatar')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (_req, _file, cb) => cb(null, avatarDir()),
      filename: (_req, file, cb) => cb(null, `avatar-${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname)}`),
    }),
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => cb(null, /^image\/(jpeg|png|webp)$/.test(file.mimetype)),
  }))
  uploadAvatar(@Param('id', ParseIntPipe) id: number, @UploadedFile() file: any, @CurrentUser() user: any) {
    if (user.role !== 'ADMIN' && +user.id !== +id) throw new ForbiddenException('No permission');
    if (!file) throw new ForbiddenException('Invalid image');
    return this.service.update(id, { avatarUrl: `/uploads/avatars/${file.filename}` });
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); }
}
