import { BadRequestException } from '@nestjs/common';
import { extname } from 'path';

export const attachmentAccept = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.md,.jpg,.jpeg,.png,.webp,.gif,.mp3,.wav,.ogg,.m4a,.mp4,.webm,.mov,.zip,.rar,.7z';
export const maxAttachmentSize = 100 * 1024 * 1024;

const allowedExtensions = new Set(attachmentAccept.split(',').map(value => value.slice(1)));

export const attachmentFileFilter = (_req: any, file: any, callback: any) => {
  const extension = extname(file.originalname || '').slice(1).toLowerCase();
  if (!allowedExtensions.has(extension)) {
    callback(new BadRequestException(`Định dạng .${extension || 'không rõ'} chưa được hỗ trợ`), false);
    return;
  }
  callback(null, true);
};

export const attachmentFileName = (prefix: string, originalName: string) => {
  const extension = extname(originalName || '').toLowerCase();
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 1_000_000_000)}${extension}`;
};
