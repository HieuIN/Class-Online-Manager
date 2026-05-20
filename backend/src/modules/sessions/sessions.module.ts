import { Injectable, Module, Controller, Get, Post, Patch, Delete, Body, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../common/roles.guard';

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
  constructor(@InjectRepository(ClassSession) private repo: Repository<ClassSession>) {}
  findByClass(classId: number) {
    return this.repo.find({ where: { classId }, order: { sessionNo: 'ASC' } });
  }
  findOne(id: number) { return this.repo.findOne({ where: { id } }); }
  create(data: Partial<ClassSession>) { return this.repo.save(this.repo.create(data)); }
  async update(id: number, data: Partial<ClassSession>) {
    await this.repo.update(id, data);
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
  @Get(':id') findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOne(id); }
  @Post() @Roles('ADMIN','TEACHER') create(@Body() body: any) { return this.service.create(body); }
  @Patch(':id') @Roles('ADMIN','TEACHER') update(@Param('id', ParseIntPipe) id: number, @Body() body: any) { return this.service.update(id, body); }
  @Delete(':id') @Roles('ADMIN','TEACHER') remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); }
}

@Module({
  imports: [TypeOrmModule.forFeature([ClassSession])],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService, TypeOrmModule],
})
export class SessionsModule {}
