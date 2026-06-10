import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';

@Injectable()
export class S3Service {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly configService: ConfigService) {
    const bucket = this.configService.get<string>('s3.bucket');
    const endpoint = this.configService.get<string>('s3.endpoint');
    const region = this.configService.get<string>('s3.region');
    const accessKey = this.configService.get<string>('s3.accessKey');
    const secretKey = this.configService.get<string>('s3.secretKey');

    if (!bucket || !endpoint || !accessKey || !secretKey) {
      throw new Error(
        'Missing required S3 configuration. Ensure s3.bucket, s3.endpoint, s3.accessKey, and s3.secretKey are set.',
      );
    }

    this.bucket = bucket;
    this.client = new S3Client({
      endpoint,
      region: region || 'us-east-1',
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
      forcePathStyle: true,
    });
  }

  async upload(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return key;
  }

  async download(key: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
    const stream = response.Body as Readable;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk as Uint8Array));
    }
    return Buffer.concat(chunks);
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  /** `DeleteObjects` 의 요청당 키 상한 (S3 API 규격). */
  private static readonly DELETE_OBJECTS_MAX_KEYS = 1000;

  /**
   * 다수 객체를 `DeleteObjectsCommand` 로 일괄 삭제한다 (1000키/요청 청크).
   *
   * 반환의 `errored` 는 응답 `Errors[].Key`(권한/내부 오류) 목록 — TypeORM
   * `DeleteResult` 와 무관한 자체 형태다. 비실존 키는 S3 표준 멱등 의미론에
   * 따라 `Deleted` 로 반환되므로 errored 에 포함되지 않는다 (호출자는 errored
   * 를 best-effort warn 으로 매핑하면 단건 delete 의 catch-warn 과 의미 동등).
   */
  async deleteMany(keys: string[]): Promise<{ errored: string[] }> {
    const errored: string[] = [];
    const max = S3Service.DELETE_OBJECTS_MAX_KEYS;
    for (let i = 0; i < keys.length; i += max) {
      const chunk = keys.slice(i, i + max);
      const res = await this.client.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: chunk.map((Key) => ({ Key })) },
        }),
      );
      for (const e of res.Errors ?? []) {
        if (e.Key) errored.push(e.Key);
      }
    }
    return { errored };
  }
}
