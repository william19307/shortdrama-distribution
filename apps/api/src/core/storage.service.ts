import { createHash, createHmac, randomUUID } from 'crypto';
import { jwtSecret } from './auth';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  CompleteMultipartUploadCommand,
  CreateBucketCommand,
  CreateMultipartUploadCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutBucketCorsCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export type StoredPart = { partNumber: number; etag: string };

export abstract class StorageService {
  abstract driver(): 'memory' | 's3';
  abstract presignPut(key: string, contentType: string): Promise<{ url: string; headers: Record<string, string> }>;
  abstract presignGet(key: string): Promise<string>;
  abstract createMultipart(key: string, contentType: string): Promise<string>;
  abstract presignPart(key: string, uploadId: string, partNumber: number): Promise<string>;
  abstract completeMultipart(key: string, uploadId: string, parts: StoredPart[]): Promise<void>;
  abstract putObject(key: string, body: Buffer, contentType: string): Promise<void>;
  abstract uploadPart(key: string, uploadId: string, partNumber: number, body: Buffer): Promise<string>;
  abstract getObject(key: string): Promise<Buffer>;
  abstract head(key: string): Promise<{ size: number } | null>;
}

const memoryObjects = new Map<string, Buffer>();
const memoryParts = new Map<string, Buffer>();

@Injectable()
export class MemoryStorageService extends StorageService {
  driver(): 'memory' {
    return 'memory';
  }

  async presignPut() {
    return { url: '', headers: {} };
  }

  async presignGet(key: string) {
    const exp = Date.now() + 60 * 60 * 1000;
    const sig = signRead(key, exp);
    return `/api/storage/objects?key=${encodeURIComponent(key)}&exp=${exp}&sig=${sig}`;
  }

  async createMultipart() {
    return `mem-${randomUUID()}`;
  }

  async presignPart() {
    return '';
  }

  async completeMultipart(key: string, uploadId: string, parts: StoredPart[]) {
    const ordered = [...parts].sort((a, b) => a.partNumber - b.partNumber);
    const chunks = ordered.map((part) => memoryParts.get(`${key}:${uploadId}:${part.partNumber}`) || Buffer.alloc(0));
    memoryObjects.set(key, Buffer.concat(chunks));
  }

  async putObject(key: string, body: Buffer) {
    memoryObjects.set(key, body);
  }

  async uploadPart(key: string, uploadId: string, partNumber: number, body: Buffer) {
    memoryParts.set(`${key}:${uploadId}:${partNumber}`, body);
    return `"mem-${partNumber}"`;
  }

  async getObject(key: string) {
    const buf = memoryObjects.get(key);
    if (!buf) throw new Error('对象不存在');
    return buf;
  }

  async head(key: string) {
    const buf = memoryObjects.get(key);
    return buf ? { size: buf.length } : null;
  }
}

function s3ClientOptions(endpoint: string | undefined) {
  return {
    region: process.env.S3_REGION || 'us-east-1',
    endpoint,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY || '',
      secretAccessKey: process.env.S3_SECRET_KEY || '',
    },
    // 旧版 MinIO 不认识 SDK 默认附带的校验和请求头。
    requestChecksumCalculation: 'WHEN_REQUIRED' as const,
    responseChecksumValidation: 'WHEN_REQUIRED' as const,
  };
}

/** 容器内用 S3_ENDPOINT（如 http://minio:9000）。发给浏览器的预签名改用 PUBLIC_OBJECT_URL。 */
export function publicObjectEndpoint() {
  const raw = (process.env.PUBLIC_OBJECT_URL || process.env.S3_ENDPOINT || '').trim().replace(/\/$/, '');
  return raw;
}

@Injectable()
export class S3StorageService extends StorageService {
  private readonly logger = new Logger(S3StorageService.name);
  private readonly bucket = process.env.S3_BUCKET || 'shortform';
  private readonly client = new S3Client(s3ClientOptions(process.env.S3_ENDPOINT));
  private readonly signer = new S3Client(s3ClientOptions(publicObjectEndpoint()));

  driver(): 's3' {
    return 's3';
  }

  async ensureBucket() {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`已创建存储桶 ${this.bucket}`);
    }
    try {
      await this.client.send(
        new PutBucketCorsCommand({
          Bucket: this.bucket,
          CORSConfiguration: {
            CORSRules: [
              {
                AllowedOrigins: ['*'],
                AllowedMethods: ['GET', 'PUT', 'POST', 'HEAD'],
                AllowedHeaders: ['*'],
                ExposeHeaders: ['ETag'],
                MaxAgeSeconds: 3600,
              },
            ],
          },
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (!message.toLowerCase().includes('not implemented')) throw error;
      this.logger.warn('当前对象存储不支持设置桶 CORS。浏览器直传需要存储端允许来源，否则把 UPLOAD_VIA_API 设为 true。');
    }
  }

  async presignPut(key: string, contentType: string) {
    const url = await getSignedUrl(this.signer, new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }), { expiresIn: 3600 });
    return { url, headers: { 'Content-Type': contentType } };
  }

  async presignGet(key: string) {
    return getSignedUrl(this.signer, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn: 3600 });
  }

  async createMultipart(key: string, contentType: string) {
    const out = await this.client.send(new CreateMultipartUploadCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }));
    if (!out.UploadId) throw new Error('创建分片上传失败');
    return out.UploadId;
  }

  async presignPart(key: string, uploadId: string, partNumber: number) {
    return getSignedUrl(this.signer, new UploadPartCommand({ Bucket: this.bucket, Key: key, UploadId: uploadId, PartNumber: partNumber }), { expiresIn: 3600 });
  }

  async completeMultipart(key: string, uploadId: string, parts: StoredPart[]) {
    await this.client.send(
      new CompleteMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: [...parts]
            .sort((a, b) => a.partNumber - b.partNumber)
            .map((part) => ({ PartNumber: part.partNumber, ETag: part.etag })),
        },
      }),
    );
  }

  async putObject(key: string, body: Buffer, contentType: string) {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }));
  }

  async uploadPart(key: string, uploadId: string, partNumber: number, body: Buffer) {
    const out = await this.client.send(new UploadPartCommand({ Bucket: this.bucket, Key: key, UploadId: uploadId, PartNumber: partNumber, Body: body }));
    return out.ETag || `"part-${partNumber}"`;
  }

  async getObject(key: string) {
    const out = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const bytes = await out.Body?.transformToByteArray();
    if (!bytes) throw new Error('对象不存在');
    return Buffer.from(bytes);
  }

  async head(key: string) {
    try {
      const out = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return { size: Number(out.ContentLength ?? 0) };
    } catch {
      return null;
    }
  }
}

export function useMemoryStorage() {
  if (process.env.STORAGE_DRIVER === 'memory') return true;
  if (process.env.STORAGE_DRIVER === 's3') return false;
  return !process.env.S3_ENDPOINT;
}

export function signRead(key: string, exp: number) {
  return createHmac('sha256', jwtSecret()).update(`${key}.${exp}`).digest('hex');
}

export function verifyRead(key: string, exp: number, sig: string) {
  if (!exp || Date.now() > exp) return false;
  const expected = signRead(key, exp);
  return expected.length === sig.length && createHash('sha256').update(expected).digest('hex') === createHash('sha256').update(sig).digest('hex');
}

@Injectable()
export class StorageLifecycle implements OnModuleInit {
  private readonly logger = new Logger(StorageLifecycle.name);

  constructor(private readonly storage: StorageService) {}

  async onModuleInit() {
    if (this.storage.driver() !== 's3') return;
    const attempts = 15;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        await (this.storage as S3StorageService).ensureBucket();
        return;
      } catch (error) {
        if (attempt === attempts) {
          this.logger.warn(`对象存储暂不可用，上传会失败，其余接口仍可使用：${(error as Error).message}`);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  }
}
