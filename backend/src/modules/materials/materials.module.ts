import { BadRequestException, ForbiddenException, Injectable, Module, Controller, Get, Post, Patch, Delete, Body, Param, ParseIntPipe, Query, UseGuards, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../common/roles.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { ensureUploadDir } from '../../common/upload-dir.util';

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
  constructor(
    @InjectRepository(Material) private repo: Repository<Material>,
    private readonly dataSource: DataSource,
  ) {}

  private async canAccessCourse(user: any, courseId: number) {
    if (user.role === 'ADMIN') return true;
    if (user.role === 'TEACHER') {
      const rows = await this.dataSource.query(
        `SELECT 1 FROM classes WHERE course_id = $1 AND teacher_id = $2 AND is_active = true`,
        [courseId, user.id],
      );
      return !!rows[0];
    }
    const rows = await this.dataSource.query(
      `SELECT 1
       FROM enrollments e
       JOIN classes c ON c.id = e.class_id
       WHERE c.course_id = $1 AND e.student_id = $2 AND e.is_active = true AND c.is_active = true`,
      [courseId, user.id],
    );
    return !!rows[0];
  }

  private async ensureCourseAccess(user: any, courseId: number) {
    if (!(await this.canAccessCourse(user, courseId))) {
      throw new ForbiddenException('Bạn không có quyền truy cập tài liệu của khóa học này');
    }
  }

  private async ensureCourseManager(user: any, courseId: number) {
    if (user.role === 'ADMIN') return;
    if (user.role !== 'TEACHER' || !(await this.canAccessCourse(user, courseId))) {
      throw new ForbiddenException('Bạn không có quyền quản lý tài liệu của khóa học này');
    }
  }

  async findByCourse(courseId: number, user: any) {
    await this.ensureCourseAccess(user, courseId);
    return this.repo.find({ where: { courseId }, order: { chapter: 'ASC', displayOrder: 'ASC' } });
  }

  async create(d: Partial<Material>, user: any) {
    await this.ensureCourseManager(user, +d.courseId);
    return this.repo.save(this.repo.create(d));
  }

  async update(id: number, d: Partial<Material>, user: any) {
    const material = await this.repo.findOne({ where: { id } });
    if (!material) return null;
    await this.ensureCourseManager(user, material.courseId);
    if (d.courseId && +d.courseId !== material.courseId) await this.ensureCourseManager(user, +d.courseId);
    await this.repo.update(id, d);
    return this.repo.findOne({ where: { id } });
  }

  async remove(id: number, user: any) {
    const material = await this.repo.findOne({ where: { id } });
    if (!material) return { affected: 0 };
    await this.ensureCourseManager(user, material.courseId);
    return this.repo.delete(id);
  }
}

@Controller('materials')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MaterialsController {
  constructor(private readonly service: MaterialsService) {}
  @Get() findAll(@Query('courseId', ParseIntPipe) courseId: number, @CurrentUser() user: any) { return this.service.findByCourse(courseId, user); }

  @Post('upload')
  @Roles('ADMIN','TEACHER')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (_req, _file, cb) => cb(null, ensureUploadDir('materials')),
      filename: (_req, file, cb) => cb(null, `material-${Date.now()}${extname(file.originalname)}`),
    }),
    limits: { fileSize: 200 * 1024 * 1024 },
  }))
  async upload(@UploadedFile() file: any, @Body() body: any, @CurrentUser() user: any) {
    if (!file) throw new BadRequestException('Vui lòng chọn file tài liệu để tải lên');
    const courseId = +body.courseId;
    if (!Number.isInteger(courseId) || courseId <= 0) throw new BadRequestException('Khóa học không hợp lệ');
    return this.service.create({
      courseId,
      title: body.title || file.originalname,
      chapter: body.chapter,
      lesson: body.lesson,
      materialType: body.materialType,
      fileUrl: `/uploads/materials/${file.filename}`,
      isRequired: body.isRequired === 'true' || body.isRequired === true,
      createdBy: user.id,
    }, user);
  }

  @Post(':id/upload')
  @Roles('ADMIN','TEACHER')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (_req, _file, cb) => cb(null, ensureUploadDir('materials')),
      filename: (_req, file, cb) => cb(null, `material-${Date.now()}${extname(file.originalname)}`),
    }),
    limits: { fileSize: 200 * 1024 * 1024 },
  }))
  async replaceFile(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: any,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    if (!file) throw new BadRequestException('Vui lòng chọn file tài liệu mới để tải lên');
    return this.service.update(id, {
      title: body.title,
      chapter: body.chapter,
      lesson: body.lesson,
      materialType: body.materialType,
      isRequired: body.isRequired === 'true' || body.isRequired === true,
      fileUrl: `/uploads/materials/${file.filename}`,
      linkUrl: null,
    }, user);
  }

  @Post() @Roles('ADMIN','TEACHER') create(@Body() body: any, @CurrentUser() user: any) {
    return this.service.create({ ...body, createdBy: user.id }, user);
  }
  @Patch(':id') @Roles('ADMIN','TEACHER') update(@Param('id', ParseIntPipe) id: number, @Body() body: any, @CurrentUser() user: any) { return this.service.update(id, body, user); }
  @Delete(':id') @Roles('ADMIN','TEACHER') remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) { return this.service.remove(id, user); }
}

@Module({
  imports: [TypeOrmModule.forFeature([Material])],
  controllers: [MaterialsController],
  providers: [MaterialsService],
  exports: [MaterialsService, TypeOrmModule],
})
export class MaterialsModule {}
