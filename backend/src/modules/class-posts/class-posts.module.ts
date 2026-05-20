import {
  Body, Controller, Delete, ForbiddenException, Get, Injectable, Module, NotFoundException,
  Param, ParseIntPipe, Patch, Post, Query, UploadedFiles, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Repository, DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthModule } from '../auth/auth.module';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';

@Entity('class_posts')
export class ClassPost {
  @PrimaryGeneratedColumn() id: number;
  @Column({ name: 'class_id' }) classId: number;
  @Column({ name: 'user_id' }) userId: number;
  @Column({ nullable: true }) title: string;
  @Column({ type: 'text' }) content: string;
  @Column({ name: 'is_pinned', default: false }) isPinned: boolean;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Entity('post_comments')
export class PostComment {
  @PrimaryGeneratedColumn() id: number;
  @Column({ name: 'post_id' }) postId: number;
  @Column({ name: 'user_id' }) userId: number;
  @Column({ type: 'text' }) content: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Entity('post_attachments')
export class PostAttachment {
  @PrimaryGeneratedColumn() id: number;
  @Column({ name: 'post_id' }) postId: number;
  @Column({ name: 'file_url', type: 'text' }) fileUrl: string;
  @Column({ name: 'file_name' }) fileName: string;
  @Column({ name: 'mime_type', nullable: true }) mimeType: string;
  @Column({ name: 'file_size', nullable: true }) fileSize: number;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

const uploadRoot = () => process.env.UPLOAD_DIR || './uploads';
const ensureUploadDir = (folder: string) => {
  const dir = join(process.cwd(), uploadRoot(), folder);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
};

@WebSocketGateway({ cors: { origin: process.env.CORS_ORIGIN || 'http://localhost:5173', credentials: true } })
export class ClassPostsGateway {
  @WebSocketServer() server: Server;

  constructor(private readonly jwt: JwtService) {}

  emit(classId: number, payload: any) {
    this.server?.to(`class:${classId}`).emit('class-posts:update', payload);
  }

  @SubscribeMessage('class-posts:join')
  join(@MessageBody() body: any, @ConnectedSocket() client: Socket) {
    const token = body?.token;
    const classId = +body?.classId;
    if (!token || !classId) return { ok: false };
    this.jwt.verify(token);
    client.join(`class:${classId}`);
    return { ok: true };
  }

  @SubscribeMessage('class-posts:leave')
  leave(@MessageBody() body: any, @ConnectedSocket() client: Socket) {
    const classId = +body?.classId;
    if (classId) client.leave(`class:${classId}`);
    return { ok: true };
  }
}

@Injectable()
export class ClassPostsService {
  constructor(
    @InjectRepository(ClassPost) private postRepo: Repository<ClassPost>,
    @InjectRepository(PostComment) private commentRepo: Repository<PostComment>,
    @InjectRepository(PostAttachment) private attachmentRepo: Repository<PostAttachment>,
    private dataSource: DataSource,
    private events: ClassPostsGateway,
  ) {}

  private async postWithClass(id: number) {
    const rows = await this.dataSource.query(
      `SELECT p.*, c.teacher_id
       FROM class_posts p JOIN classes c ON c.id = p.class_id
       WHERE p.id = $1 LIMIT 1`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException('Post not found');
    return rows[0];
  }

  private async canAccessClass(user: any, classId: number) {
    if (user.role === 'ADMIN') return true;
    if (user.role === 'TEACHER') {
      const rows = await this.dataSource.query(`SELECT 1 FROM classes WHERE id = $1 AND teacher_id = $2`, [classId, user.id]);
      return !!rows[0];
    }
    const rows = await this.dataSource.query(
      `SELECT 1 FROM enrollments WHERE class_id = $1 AND student_id = $2 AND is_active = true`,
      [classId, user.id],
    );
    return !!rows[0];
  }

  private async ensureAccess(user: any, classId: number) {
    if (!(await this.canAccessClass(user, classId))) throw new ForbiddenException('No class access');
  }

  private canManage(user: any, post: any) {
    return user.role === 'ADMIN' || +post.user_id === +user.id || (user.role === 'TEACHER' && +post.teacher_id === +user.id);
  }

  async list(classId: number, user: any) {
    await this.ensureAccess(user, classId);
    return this.dataSource.query(
      `SELECT p.id, p.class_id, p.user_id, p.title, p.content, p.is_pinned, p.created_at,
              u.full_name as "authorName", u.avatar_url as "authorAvatarUrl", u.role as "authorRole",
              COUNT(DISTINCT pc.id)::int as "commentCount",
              COALESCE(
                JSON_AGG(DISTINCT JSONB_BUILD_OBJECT(
                  'id', pa.id,
                  'fileUrl', pa.file_url,
                  'fileName', pa.file_name,
                  'mimeType', pa.mime_type,
                  'fileSize', pa.file_size
                )) FILTER (WHERE pa.id IS NOT NULL),
                '[]'
              ) as attachments
       FROM class_posts p
       JOIN users u ON u.id = p.user_id
       LEFT JOIN post_comments pc ON pc.post_id = p.id
       LEFT JOIN post_attachments pa ON pa.post_id = p.id
       WHERE p.class_id = $1
       GROUP BY p.id, u.full_name, u.avatar_url, u.role
       ORDER BY p.is_pinned DESC, p.created_at DESC`,
      [classId],
    );
  }

  async create(data: any, user: any, files: any[] = []) {
    const classId = +data.classId;
    await this.ensureAccess(user, classId);
    const content = String(data.content || '').trim();
    if (!content && !files.length) throw new ForbiddenException('Post content or media is required');
    const post = await this.postRepo.save(this.postRepo.create({
      classId,
      userId: user.id,
      title: (data.title || '').trim() || null,
      content,
    }));
    if (files.length) {
      await this.attachmentRepo.save(files.map(file => this.attachmentRepo.create({
        postId: post.id,
        fileUrl: `/uploads/forum/${file.filename}`,
        fileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
      })));
    }
    this.events.emit(classId, { type: 'post-created', postId: post.id });
    return post;
  }

  async remove(id: number, user: any) {
    const post = await this.postWithClass(id);
    if (!this.canManage(user, post)) throw new ForbiddenException('No permission');
    await this.postRepo.delete(id);
    this.events.emit(+post.class_id, { type: 'post-deleted', postId: id });
    return { success: true };
  }

  async togglePin(id: number, user: any) {
    const post = await this.postWithClass(id);
    if (user.role !== 'ADMIN' && !(user.role === 'TEACHER' && +post.teacher_id === +user.id)) {
      throw new ForbiddenException('No permission');
    }
    await this.postRepo.update(id, { isPinned: !post.is_pinned });
    this.events.emit(+post.class_id, { type: 'post-pinned', postId: id });
    return this.postRepo.findOne({ where: { id } });
  }

  async comments(postId: number, user: any) {
    const post = await this.postWithClass(postId);
    await this.ensureAccess(user, +post.class_id);
    return this.dataSource.query(
      `SELECT pc.id, pc.post_id, pc.user_id, pc.content, pc.created_at,
              u.full_name as "authorName", u.avatar_url as "authorAvatarUrl", u.role as "authorRole"
       FROM post_comments pc
       JOIN users u ON u.id = pc.user_id
       WHERE pc.post_id = $1
       ORDER BY pc.created_at ASC`,
      [postId],
    );
  }

  async addComment(postId: number, content: string, user: any) {
    const post = await this.postWithClass(postId);
    await this.ensureAccess(user, +post.class_id);
    const comment = await this.commentRepo.save(this.commentRepo.create({
      postId,
      userId: user.id,
      content: String(content || '').trim(),
    }));
    this.events.emit(+post.class_id, { type: 'comment-created', postId, commentId: comment.id });
    return comment;
  }
}

@Controller('class-posts')
export class ClassPostsController {
  constructor(
    private readonly service: ClassPostsService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  list(@Query('classId') classId: string, @CurrentUser() user: any) {
    return this.service.list(+classId, user);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('files', 8, {
    storage: diskStorage({
      destination: (_req, _file, cb) => cb(null, ensureUploadDir('forum')),
      filename: (_req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `forum-${unique}${extname(file.originalname)}`);
      },
    }),
    limits: { fileSize: 100 * 1024 * 1024 },
  }))
  create(@Body() body: any, @UploadedFiles() files: any[], @CurrentUser() user: any) {
    return this.service.create(body, user, files || []);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.service.remove(id, user);
  }

  @Patch(':id/pin')
  @UseGuards(JwtAuthGuard)
  pin(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.service.togglePin(id, user);
  }

  @Get(':id/comments')
  @UseGuards(JwtAuthGuard)
  comments(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.service.comments(id, user);
  }

  @Post(':id/comments')
  @UseGuards(JwtAuthGuard)
  addComment(@Param('id', ParseIntPipe) id: number, @Body() body: any, @CurrentUser() user: any) {
    return this.service.addComment(id, body.content, user);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([ClassPost, PostComment, PostAttachment]), AuthModule],
  controllers: [ClassPostsController],
  providers: [ClassPostsService, ClassPostsGateway],
})
export class ClassPostsModule {}
