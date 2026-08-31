import { s3Config } from './s3.config';

/**
 * `publicBaseUrl` 의 3단 폴백. 이 값이 틀리면 아바타는 **업로드까지 성공하고** 브라우저
 * 에서만 깨진다 — 조용하지는 않지만 증상이 원인에서 멀다. 그래서 각 단을 고정한다.
 */
describe('s3Config.publicBaseUrl 폴백', () => {
  const KEYS = ['S3_PUBLIC_BASE_URL', 'S3_ENDPOINT'] as const;
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('S3_PUBLIC_BASE_URL 이 최우선', () => {
    process.env.S3_PUBLIC_BASE_URL = 'https://cdn.example';
    process.env.S3_ENDPOINT = 'http://minio:9000';
    expect(s3Config().publicBaseUrl).toBe('https://cdn.example');
  });

  it('없으면 S3_ENDPOINT 로 폴백한다 — 단일 호스트 개발 환경에서만 맞는 가정이다', () => {
    process.env.S3_ENDPOINT = 'http://minio:9000';
    expect(s3Config().publicBaseUrl).toBe('http://minio:9000');
  });

  it('둘 다 없으면 localhost', () => {
    expect(s3Config().publicBaseUrl).toBe('http://localhost:9000');
  });
});
