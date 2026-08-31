import {
  resolvePublicBaseUrl,
  s3Config,
  shouldWarnPublicBaseIsPrivate,
} from './s3.config';

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

/**
 * 폴백 **규칙 자체**를 문는다. 이 규칙은 `s3.config` 와 `main.ts` 의 부팅 경고가 공유하며,
 * 사본이 갈리면 경고가 조용히 침묵한다(리뷰 4라운드에서 실제로 그랬다 — 사본의 마지막 항이
 * `''` 라 두 env 미설정 시 경고가 안 났다).
 */
describe('resolvePublicBaseUrl (폴백 SoT)', () => {
  it('S3_PUBLIC_BASE_URL 이 최우선', () => {
    expect(
      resolvePublicBaseUrl({
        S3_PUBLIC_BASE_URL: 'https://cdn.example',
        S3_ENDPOINT: 'http://minio:9000',
      }),
    ).toBe('https://cdn.example');
  });

  it('둘 다 미설정이면 localhost — 빈 문자열이 아니다', () => {
    // 여기서 `''` 를 돌려주면 `main.ts` 의 경고가 이 케이스를 놓친다.
    expect(resolvePublicBaseUrl({})).toBe('http://localhost:9000');
  });

  it.each([
    [
      'S3_PUBLIC_BASE_URL',
      { S3_PUBLIC_BASE_URL: '', S3_ENDPOINT: 'http://minio:9000' },
      'http://minio:9000',
    ],
    [
      '둘 다',
      { S3_PUBLIC_BASE_URL: '', S3_ENDPOINT: '' },
      'http://localhost:9000',
    ],
  ])(
    '%s 가 빈 문자열이면 미설정과 같게 다룬다 (`||` 이지 `??` 가 아니다)',
    (_label, env, expected) => {
      expect(resolvePublicBaseUrl(env as NodeJS.ProcessEnv)).toBe(expected);
    },
  );
});

/**
 * 부팅 경고의 **조합 판정**. 6라운드 리뷰가 `main.ts` 안의 인라인 조합을
 * `if (false && …)` 로 뮤테이션해도 85건이 전부 GREEN 임을 실측했다 — 부트스트랩 본문은
 * 유닛이 못 붙잡는다. 그래서 조합을 순수 함수로 빼고 여기서 문다.
 */
describe('shouldWarnPublicBaseIsPrivate', () => {
  it('production 이 아니면 판정하지 않는다 (dev 는 localhost 가 정상)', () => {
    expect(
      shouldWarnPublicBaseIsPrivate({
        NODE_ENV: 'development',
        S3_PUBLIC_BASE_URL: 'http://localhost:9000',
      }),
    ).toBe(false);
  });

  it.each([
    ['loopback', 'http://localhost:9000'],
    ['127.0.0.1', 'http://127.0.0.1:9000'],
    ['IPv6 loopback', 'http://[::1]:9000'],
    ['RFC1918 10.x', 'http://10.0.0.5:9000'],
    ['RFC1918 192.168.x', 'http://192.168.1.10'],
  ])('production + %s → 경고한다', (_label, url) => {
    expect(
      shouldWarnPublicBaseIsPrivate({
        NODE_ENV: 'production',
        S3_PUBLIC_BASE_URL: url,
      }),
    ).toBe(true);
  });

  it.each([
    ['공개 도메인', 'https://cdn.example.com'],
    ['미치환 sentinel', 'https://REPLACE_ME.cloudfront.net'],
    ['서브도메인 함정', 'https://localhost.evil.com'],
  ])('production + %s → 경고하지 않는다', (_label, url) => {
    expect(
      shouldWarnPublicBaseIsPrivate({
        NODE_ENV: 'production',
        S3_PUBLIC_BASE_URL: url,
      }),
    ).toBe(false);
  });

  it('두 env 가 모두 미설정이면 경고한다 — 기본값이 localhost 이기 때문', () => {
    // 이 케이스가 핵심이다. 4라운드까지 `main.ts` 사본의 폴백 마지막 항이 `''` 라
    // **여기서 침묵했다** — 가드가 정확히 기본값 경로를 놓쳤다.
    expect(shouldWarnPublicBaseIsPrivate({ NODE_ENV: 'production' })).toBe(
      true,
    );
  });

  it('S3_ENDPOINT 만 사설이어도 경고한다 (공개 base 미설정 → endpoint 폴백)', () => {
    expect(
      shouldWarnPublicBaseIsPrivate({
        NODE_ENV: 'production',
        S3_ENDPOINT: 'http://10.1.2.3:9000',
      }),
    ).toBe(true);
  });
});
