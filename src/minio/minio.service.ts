import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  PutBucketPolicyCommand,
} from '@aws-sdk/client-s3';

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private readonly s3Client: S3Client;
  public readonly bucket: string;
  private readonly endpoint: string;
  private readonly publicUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.endpoint =
      this.configService.get<string>('MINIO_ENDPOINT') ||
      process.env.MINIO_ENDPOINT ||
      'http://localhost:9000';

    this.publicUrl =
      this.configService.get<string>('MINIO_PUBLIC_URL') ||
      process.env.MINIO_PUBLIC_URL ||
      this.endpoint;

    this.bucket =
      this.configService.get<string>('MINIO_BUCKET_NAME') ||
      process.env.MINIO_BUCKET_NAME ||
      'trackup-storage';

    const accessKeyId =
      this.configService.get<string>('MINIO_ROOT_USER') ||
      this.configService.get<string>('MINIO_ACCESS_KEY') ||
      process.env.MINIO_ROOT_USER ||
      process.env.MINIO_ACCESS_KEY ||
      'trackup';

    const secretAccessKey =
      this.configService.get<string>('MINIO_ROOT_PASSWORD') ||
      this.configService.get<string>('MINIO_SECRET_KEY') ||
      process.env.MINIO_ROOT_PASSWORD ||
      process.env.MINIO_SECRET_KEY ||
      'K3tgD0U;RbCj%Lfvu';

    this.s3Client = new S3Client({
      endpoint: this.endpoint,
      region: this.configService.get<string>('MINIO_REGION') || 'us-east-1',
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: true,
    });
  }

  async onModuleInit() {
    try {
      await this.ensureBucket();
    } catch (error) {
      this.logger.warn(
        `Failed to initialize MinIO bucket '${this.bucket}': ${
          error instanceof Error ? error.message : error
        }. Will retry on file upload.`
      );
    }
  }

  private async ensureBucket() {
    try {
      await this.s3Client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      this.logger.log(`Bucket '${this.bucket}' not found, creating...`);
      try {
        await this.s3Client.send(
          new CreateBucketCommand({ Bucket: this.bucket })
        );
        const policy = {
          Version: '2012-10-17',
          Statement: [
            {
              Sid: 'PublicRead',
              Effect: 'Allow',
              Principal: '*',
              Action: ['s3:GetObject'],
              Resource: [`arn:aws:s3:::${this.bucket}/*`],
            },
          ],
        };
        await this.s3Client.send(
          new PutBucketPolicyCommand({
            Bucket: this.bucket,
            Policy: JSON.stringify(policy),
          })
        );
        this.logger.log(`Bucket '${this.bucket}' created with public read access.`);
      } catch (createErr) {
        this.logger.warn(
          `Could not create bucket '${this.bucket}': ${
            createErr instanceof Error ? createErr.message : createErr
          }`
        );
      }
    }
  }

  /**
   * Загружает буфер в MinIO.
   * Возвращает объект с url, secure_url и key для обратной совместимости с Cloudinary.
   */
  async uploadBuffer(
    buffer: Buffer,
    fileName: string,
    folder: string = 'avatars',
    contentType?: string
  ): Promise<{ url: string; secure_url: string; key: string }> {
    const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = folder ? `${folder}/${cleanFileName}` : cleanFileName;
    const mime = contentType || this.detectMimeType(cleanFileName);

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mime,
      })
    );

    const publicUrl = this.getFileUrl(key);

    return {
      url: publicUrl,
      secure_url: publicUrl,
      key,
    };
  }

  /**
   * Удаляет файл по ключу S3.
   */
  async deleteFile(key: string): Promise<void> {
    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    );
  }

  /**
   * Удаляет файл по URL, извлекая ключ объекта.
   */
  async deleteByUrl(url: string): Promise<void> {
    if (!url) return;
    const key = this.extractKeyFromUrl(url);
    if (key) {
      await this.deleteFile(key);
    }
  }

  /**
   * Возвращает публичный URL для ключа.
   */
  getFileUrl(key: string): string {
    const base = this.publicUrl.replace(/\/+$/, '');
    return `${base}/${this.bucket}/${key}`;
  }

  /**
   * Извлекает ключ из URL MinIO / S3.
   */
  private extractKeyFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname.replace(/^\/+/, '');
      if (pathname.startsWith(`${this.bucket}/`)) {
        return pathname.substring(this.bucket.length + 1);
      }
      return pathname;
    } catch {
      if (url.includes(`/${this.bucket}/`)) {
        return url.split(`/${this.bucket}/`)[1] || null;
      }
      return null;
    }
  }

  private detectMimeType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'png':
        return 'image/png';
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'gif':
        return 'image/gif';
      case 'webp':
        return 'image/webp';
      case 'svg':
        return 'image/svg+xml';
      default:
        return 'application/octet-stream';
    }
  }
}
