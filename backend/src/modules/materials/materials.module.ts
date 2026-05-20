import { Injectable, Module, Controller, Get, Post, Patch, Delete, Body, Param, ParseIntPipe, Query, UseGuards, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../common/roles.guard';
import { CurrentUser } from '../../common/current-user.decorator';

@Entity('materials')
export class Material {
  @PrimaryGeneratedColumn() id: number;
  @Column({ name: 'course_id' }) courseId: number;
  @Column({ nullable: true }) chapter: string;
  @Column({ nullable: true }) lesson: string;
  @Column() title: string;
  @Column({ type: 'text', nullable: true }) description: string;
  @Column({ name: 'material_type', nullable: true }) materialType: string;
  @Column({ name: 'file_url', type: 'text', nullable: true }) fileUrl: string;
  @Column({ name: 'link_url', type: 'text', nullable: true }) linkUrl: string;
  @Column({ name: 'is_required', default: false }) isRequired: boolean;
  @Column({ name: 'display_order', default: 0 }) displayOrder: number;
  @Column({ name: 'created_by', nullable: true }) createdBy: number;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Injectable()
export class MaterialsService {
  constructor(@InjectRepository(Material) private repo: Repository<Material>) {}
  findByCourse(courseId: number) { return this.repo.find({ where: { courseId }, order: { chapter: 'ASC', displayOrder: 'ASC' } }); }
  create(d: Partial<Material>) { return this.repo.save(this.repo.create(d)); }
  async update(id: number, d: Partial<Material>) { await this.repo.update(id, d); return this.repo.findOne({ where: { id } }); }
  remove(id: number) { return this.repo.delete(id); }
}

@Controller('materials')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MaterialsController {
  constructor(private readonly service: MaterialsService) {}
  @Get() findAll(@Query('courseId', ParseIntPipe) courseId: number) { return this.service.findByCourse(courseId); }

  @Post('upload')
  @Roles('ADMIN','TEACHER')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: process.env.UPLOAD_DIR || './uploads',
      filename: (_req, file, cb) => cb(null, `material-${Date.now()}${extname(file.originalname)}`),
    }),
    limits: { fileSize: 200 * 1024 * 1024 },
  }))
  async upload(@UploadedFile() file: any, @Body() body: any, @CurrentUser() user: any) {
    return this.service.create({
      courseId: +body.courseId,
      title: body.title || file.originalname,
      chapter: body.chapter,
      lesson: body.lesson,
      materialType: body.materialType,
      fileUrl: `/uploads/${file.filename}`,
      isRequired: body.isRequired === 'true' || body.isRequired === true,
      createdBy: user.id,
    });
  }

  @Post() @Roles('ADMIN','TEACHER') create(@Body() body: any, @CurrentUser() user: any) {
    return this.service.create({ ...body, createdBy: user.id });
  }
  @Patch(':id') @Roles('ADMIN','TEACHER') update(@Param('id', ParseIntPipe) id: number, @Body() body: any) { return this.service.update(id, body); }
  @Delete(':id') @Roles('ADMIN','TEACHER') remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); }
}

@Module({
  imports: [TypeOrmModule.forFeature([Material])],
  controllers: [MaterialsController],
  providers: [MaterialsService],
  exports: [MaterialsService, TypeOrmModule],
})
export class MaterialsModule {}
