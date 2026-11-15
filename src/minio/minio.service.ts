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
  private readonly isR2: boolean;
  private readonly includeBucketInUrl: boolean;

  constructor(private readonly configService: ConfigService) {
    // Поддержка Cloudflare R2, AWS S3 и MinIO через единую конфигурацию
    this.endpoint =
      this.configService.get<string>('R2_ENDPOINT') ||
      this.configService.get<string>('S3_ENDPOINT') ||
      this.configService.get<string>('MINIO_ENDPOINT') ||
      process.env.R2_ENDPOINT ||
      process.env.S3_ENDPOINT ||
      process.env.MINIO_ENDPOINT ||
      'http://localhost:9000';

    this.isR2 = this.endpoint.toLowerCase().includes('.r2.cloudflarestorage.com');

    this.bucket =
      this.configService.get<string>('R2_BUCKET_NAME') ||
      this.configService.get<string>('S3_BUCKET_NAME') ||
      this.configService.get<string>('MINIO_BUCKET_NAME') ||
      process.env.R2_BUCKET_NAME ||
      process.env.S3_BUCKET_NAME ||
      process.env.MINIO_BUCKET_NAME ||
      'trackup-storage';

    this.publicUrl =
      this.configService.get<string>('R2_PUBLIC_URL') ||
      this.configService.get<string>('S3_PUBLIC_URL') ||
      this.configService.get<string>('MINIO_PUBLIC_URL') ||
      process.env.R2_PUBLIC_URL ||
      process.env.S3_PUBLIC_URL ||
      process.env.MINIO_PUBLIC_URL ||
      this.endpoint;

    // В Cloudflare R2 публичные домены (Custom Domain или r2.dev) привязаны напрямую к корню бакета.
    // Поэтому бакет не должен дублироваться в URL, в отличие от локального MinIO path-style.
    const explicitInclude =
      this.configService.get<string>('STORAGE_INCLUDE_BUCKET_IN_URL') ||
      process.env.STORAGE_INCLUDE_BUCKET_IN_URL;

    if (explicitInclude !== undefined) {
      this.includeBucketInUrl = explicitInclude === 'true';
    } else {
      // Авто-определение: если это R2 или домен r2.dev или кастомный CDN домен, бакет не добавляем
      const isR2Dev = this.publicUrl.toLowerCase().includes('.r2.dev');
      const isCustomCdn = this.publicUrl !== this.endpoint;
      this.includeBucketInUrl = !(this.isR2 || isR2Dev || isCustomCdn);
    }

    const accessKeyId =
      this.configService.get<string>('R2_ACCESS_KEY_ID') ||
      this.configService.get<string>('S3_ACCESS_KEY_ID') ||
      this.configService.get<string>('MINIO_ROOT_USER') ||
      this.configService.get<string>('MINIO_ACCESS_KEY') ||
      process.env.R2_ACCESS_KEY_ID ||
      process.env.S3_ACCESS_KEY_ID ||
      process.env.MINIO_ROOT_USER ||
      process.env.MINIO_ACCESS_KEY ||
      'trackup';

    const secretAccessKey =
      this.configService.get<string>('R2_SECRET_ACCESS_KEY') ||
      this.configService.get<string>('S3_SECRET_ACCESS_KEY') ||
      this.configService.get<string>('MINIO_ROOT_PASSWORD') ||
      this.configService.get<string>('MINIO_SECRET_KEY') ||
      process.env.R2_SECRET_ACCESS_KEY ||
      process.env.S3_SECRET_ACCESS_KEY ||
      process.env.MINIO_ROOT_PASSWORD ||
      process.env.MINIO_SECRET_KEY ||
      'K3tgD0U;RbCj%Lfvu';

    // В Cloudflare R2 регион ОБЯЗАТЕЛЬНО должен быть 'auto'
    const region =
      this.configService.get<string>('R2_REGION') ||
      this.configService.get<string>('S3_REGION') ||
      this.configService.get<string>('MINIO_REGION') ||
      process.env.R2_REGION ||
      process.env.S3_REGION ||
      process.env.MINIO_REGION ||
      (this.isR2 ? 'auto' : 'us-east-1');

    this.s3Client = new S3Client({
      endpoint: this.endpoint,
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      // Для MinIO и Cloudflare R2 path-style адресация надежнее всего
      forcePathStyle: true,
    });

    this.logger.log(
      `Storage client initialized (${this.isR2 ? 'Cloudflare R2' : 'S3/MinIO'}), bucket: ${this.bucket}, publicUrl: ${this.publicUrl}`
    );
  }

  async onModuleInit() {
    try {
      await this.ensureBucket();
    } catch (error) {
      this.logger.warn(
        `Failed to initialize storage bucket '${this.bucket}': ${
          error instanceof Error ? error.message : error
        }. Will retry on file upload.`
      );
    }
  }

  private async ensureBucket() {
    try {
      await this.s3Client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`Storage bucket '${this.bucket}' verified and ready.`);
    } catch (headErr: unknown) {
      // Для Cloudflare R2 бакеты создаются в панели Cloudflare, а токены доступа обычно ограничены чтением/записью объектов
      if (this.isR2) {
        this.logger.warn(
          `Could not verify Cloudflare R2 bucket '${this.bucket}'. Ensure the bucket is created in Cloudflare Dashboard and token permissions are correct.`
        );
        return;
      }

      this.logger.log(`Bucket '${this.bucket}' not found, creating...`);
      try {
        await this.s3Client.send(
          new CreateBucketCommand({ Bucket: this.bucket })
        );

        // PutBucketPolicyCommand применим к MinIO. Cloudflare R2 политики через S3 API не поддерживает
        try {
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
        } catch {
          // Игнорируем ошибку назначения политики (актуально для хранилищ без поддержки S3 Bucket Policy)
        }
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
   * Загружает буфер в хранилище (Cloudflare R2 / MinIO / S3).
   * Возвращает объект с url, secure_url и key для обратной совместимости.
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
   * Удаляет файл по ключу S3 / R2.
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
   * Удаляет файл по URL, надежно извлекая ключ объекта (для R2, MinIO и S3).
   */
  async deleteByUrl(url: string): Promise<void> {
    if (!url) return;
    const key = this.extractKeyFromUrl(url);
    if (key) {
      await this.deleteFile(key);
    }
  }

  /**
   * Возвращает публичный URL для ключа с учетом специфики Cloudflare R2 и MinIO.
   */
  getFileUrl(key: string): string {
    const base = this.publicUrl.replace(/\/+$/, '');
    const cleanKey = key.replace(/^\/+/, '');

    if (this.includeBucketInUrl) {
      if (base.endsWith(`/${this.bucket}`)) {
        return `${base}/${cleanKey}`;
      }
      return `${base}/${this.bucket}/${cleanKey}`;
    }

    return `${base}/${cleanKey}`;
  }

  /**
   * Извлекает ключ объекта из URL хранилища (поддерживает path-style MinIO, direct CDN R2 и r2.dev).
   */
  private extractKeyFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      let pathname = decodeURIComponent(urlObj.pathname).replace(/^\/+/, '');
      if (pathname.startsWith(`${this.bucket}/`)) {
        pathname = pathname.substring(this.bucket.length + 1);
      }
      return pathname || null;
    } catch {
      if (url.includes(`/${this.bucket}/`)) {
        return decodeURIComponent(url.split(`/${this.bucket}/`)[1] || '') || null;
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
      case 'avif':
        return 'image/avif';
      case 'svg':
        return 'image/svg+xml';
      case 'mp3':
        return 'audio/mpeg';
      case 'wav':
        return 'audio/wav';
      case 'ogg':
        return 'audio/ogg';
      case 'flac':
        return 'audio/flac';
      case 'pdf':
        return 'application/pdf';
      default:
        return 'application/octet-stream';
    }
  }
}
