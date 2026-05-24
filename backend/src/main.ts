import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Ensure uploads folder exists
  const uploadDir = join(process.cwd(), 'uploads');
  if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
  for (const folder of ['materials', 'submissions', 'forum', 'gallery', 'avatars', 'flashcards']) {
    const subDir = join(uploadDir, folder);
    if (!existsSync(subDir)) mkdirSync(subDir, { recursive: true });
  }

  app.setGlobalPrefix('api', { exclude: ['uploads/(.*)'] });

  // Serve uploaded files at /uploads/<filename>
  app.useStaticAssets(uploadDir, { prefix: '/uploads/' });

  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  const port = process.env.PORT || 3000;
  await app.listen(port);
  Logger.log(`🚀 Class Manager API running on http://localhost:${port}/api`, 'Bootstrap');
  Logger.log(`📁 Files served at http://localhost:${port}/uploads/`, 'Bootstrap');
}
bootstrap();
