import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { allowedOrigins } from './common/cors.util';
import { ensureUploadDir } from './common/upload-dir.util';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.set('trust proxy', 1);
  app.enableShutdownHooks();

  const uploadDir = ensureUploadDir();
  for (const folder of ['materials', 'assignments', 'submissions', 'forum', 'gallery', 'avatars', 'flashcards', 'pronunciation', 'payment-proofs']) {
    ensureUploadDir(folder);
  }

  app.setGlobalPrefix('api', { exclude: ['uploads/(.*)'] });
  app.useStaticAssets(uploadDir, { prefix: '/uploads/' });
  app.enableCors({ origin: allowedOrigins(), credentials: true });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  Logger.log(`Class Manager API listening on port ${port}`, 'Bootstrap');
}

bootstrap();
