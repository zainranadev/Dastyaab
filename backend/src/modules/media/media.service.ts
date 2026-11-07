import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { UploadApiResponse, v2 as cloudinary } from 'cloudinary';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { AppException } from '../../common/errors/app-exception';
import { Env } from '../../config/env';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // BR-11
export const MAX_IMAGES_PER_PROBLEM = 5; // BR-11
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/** BR-11 enforced at the edge: 413 FILE_TOO_LARGE (multer limit) and 415 UNSUPPORTED_FILE_TYPE. */
export const imageUploadOptions: MulterOptions = {
  limits: { fileSize: MAX_IMAGE_BYTES, files: MAX_IMAGES_PER_PROBLEM },
  fileFilter: (_req, file, cb) => {
    if (EXT[file.mimetype]) return cb(null, true);
    cb(new AppException(415, 'UNSUPPORTED_FILE_TYPE', 'Only jpg, png and webp images are allowed.'), false);
  },
};

export interface StoredImage {
  url: string;
  sizeBytes: number;
}

@Injectable()
export class MediaService {
  constructor(private readonly config: ConfigService<Env, true>) {
    if (this.config.get('STORAGE_DRIVER', { infer: true }) === 'cloudinary') {
      cloudinary.config({ secure: true }); // also picks up CLOUDINARY_URL
    }
  }

  async saveImage(file: Express.Multer.File): Promise<StoredImage> {
    if (this.config.get('STORAGE_DRIVER', { infer: true }) === 'cloudinary') {
      const res = await new Promise<UploadApiResponse>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'backend/problems', resource_type: 'image' },
          (error, result) => (error || !result ? reject(error ?? new Error('Upload failed')) : resolve(result)),
        );
        stream.end(file.buffer);
      });
      return { url: res.secure_url, sizeBytes: file.size };
    }

    const dir = join(process.cwd(), 'uploads');
    await mkdir(dir, { recursive: true });
    const name = `${randomUUID()}.${EXT[file.mimetype]}`;
    await writeFile(join(dir, name), file.buffer);
    return { url: `${this.config.get('PUBLIC_API_URL', { infer: true })}/uploads/${name}`, sizeBytes: file.size };
  }
}
