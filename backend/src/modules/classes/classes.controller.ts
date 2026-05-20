import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ClassesService } from './classes.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../common/roles.guard';
import { CurrentUser } from '../../common/current-user.decorator';

@Controller('classes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClassesController {
  constructor(private readonly service: ClassesService) {}

  @Get()
  findAll(@CurrentUser() user: any) {
    // teacher sees own classes; student sees their enrolled classes; admin sees all
    if (user.role === 'TEACHER') return this.service.findAllWithStats({ teacherId: user.id });
    if (user.role === 'STUDENT') return this.service.findAllWithStats({ studentId: user.id });
    return this.service.findAllWithStats();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOne(id); }

  @Get(':id/students')
  getStudents(@Param('id', ParseIntPipe) id: number) { return this.service.getStudentsInClass(id); }

  @Post()
  @Roles('ADMIN','TEACHER')
  create(@Body() body: any) { return this.service.create(body); }

  @Patch(':id')
  @Roles('ADMIN','TEACHER')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: any) { return this.service.update(id, body); }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); }
}
