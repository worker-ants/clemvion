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
  private readonly publicBaseUrl: string;

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
    // 미설정 시 `endpoint` 폴백은 `s3.config.ts` 가 한다 — 여기서 다시 폴백하면
    // 폴백 규칙이 두 곳이 되어 갈라진다.
    this.publicBaseUrl =
      this.configService.get<string>('s3.publicBaseUrl') ?? endpoint;
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

  /**
   * 공개 읽기가 열린 오브젝트의 브라우저 접근 URL.
   *
   * ## 전제 — 이 메서드는 버킷 정책을 만들지 않는다
   *
   * URL 문자열만 조립한다. 그 경로가 실제로 익명 GET 을 허용하는지는 **버킷 정책**이
   * 정하며 그건 인프라 설정이다(코드 밖). 정책이 닫혀 있으면 이 URL 은 403 을 낸다 —
   * 조용히 깨지는 것이 아니라 눈에 보이게 실패한다.
   *
   * ## 왜 `endpoint` 가 아니라 `publicBaseUrl` 인가
   *
   * `endpoint` 는 백엔드가 SDK 로 쓰는 **내부** 주소다(`http://minio:9000`). 그 값을
   * 브라우저에 주면 컨테이너 호스트명이라 도달하지 못한다. 배포 환경에서는
   * `S3_PUBLIC_BASE_URL` 로 공개 도메인/CDN 을 준다.
   *
   * @param key `upload()` 가 돌려준 오브젝트 키.
   */
  getPublicUrl(key: string): string {
    const base = this.publicBaseUrl.replace(/\/+$/, '');
    // 키의 각 세그먼트만 인코딩한다 — 통째로 `encodeURIComponent` 하면 `/` 가 `%2F` 가
    // 되어 경로가 아니라 한 덩어리 오브젝트명이 된다.
    const encoded = key
      .split('/')
      .map((seg) => encodeURIComponent(seg))
      .join('/');
    return `${base}/${this.bucket}/${encoded}`;
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
