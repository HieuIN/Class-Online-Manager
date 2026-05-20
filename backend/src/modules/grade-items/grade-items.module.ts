import { Injectable, Module, Controller, Get, Post, Patch, Delete, Body, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../common/roles.guard';

@Entity('grade_items')
export class GradeItem {
  @PrimaryGeneratedColumn() id: number;
  @Column({ name: 'class_id' }) classId: number;
  @Column() name: string;
  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 }) weight: number;
  @Column({ name: 'max_score', type: 'numeric', precision: 5, scale: 2, default: 10 }) maxScore: number;
  @Column({ name: 'display_order', default: 0 }) displayOrder: number;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Injectable()
export class GradeItemsService {
  constructor(@InjectRepository(GradeItem) private repo: Repository<GradeItem>) {}
  findByClass(classId: number) { return this.repo.find({ where: { classId }, order: { displayOrder: 'ASC', id: 'ASC' } }); }
  create(d: Partial<GradeItem>) { return this.repo.save(this.repo.create(d)); }
  async update(id: number, d: Partial<GradeItem>) { await this.repo.update(id, d); return this.repo.findOne({ where: { id } }); }
  remove(id: number) { return this.repo.delete(id); }
}

@Controller('grade-items')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GradeItemsController {
  constructor(private readonly service: GradeItemsService) {}
  @Get() findAll(@Query('classId', ParseIntPipe) classId: number) { return this.service.findByClass(classId); }
  @Post() @Roles('ADMIN','TEACHER') create(@Body() body: any) { return this.service.create(body); }
  @Patch(':id') @Roles('ADMIN','TEACHER') update(@Param('id', ParseIntPipe) id: number, @Body() body: any) { return this.service.update(id, body); }
  @Delete(':id') @Roles('ADMIN','TEACHER') remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); }
}

@Module({
  imports: [TypeOrmModule.forFeature([GradeItem])],
  controllers: [GradeItemsController],
  providers: [GradeItemsService],
  exports: [GradeItemsService, TypeOrmModule],
})
export class GradeItemsModule {}
