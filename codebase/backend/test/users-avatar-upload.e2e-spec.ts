import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail } from './helpers/db';
import { registerAndLogin } from './helpers/auth';
import {
  assertMatchesContract,
  contractForDto,
} from '../src/shared/testing/response-contract';
import { UserProfileDto } from '../src/modules/users/dto/responses/user-response.dto';

/**
 * e2e: spec/2-navigation/9-user-profile.md §6.1 아바타 업로드 (공개 버킷 + 공개 URL).
 *
 * ## 이 스펙만 증명할 수 있는 것
 *
 * 이 기능의 접근 통제는 **코드가 아니라 버킷 정책**이 정한다. 유닛 테스트는 `S3Service`
 * 를 통째로 mock 하므로 정책이 실수로 되돌아가도 전부 GREEN 이다(리뷰 4·5라운드가 두 번
 * 지목). 여기서 실 MinIO 를 상대로 두 가지를 못 박는다:
 *
 *   1. 익명 GET 이 **200** — 이게 안 되면 업로드는 성공하고 이미지만 403 이다.
 *   2. 익명 목록 조회가 **403** — 열리면 키의 UUID 추측 불가능성이 통째로 무의미해진다.
 *      (`mc anonymous set download` 를 쓰면 실제로 열린다 — `scripts/minio/README.md`.)
 *
 * ## 왜 응답의 `avatarUrl` 을 그대로 fetch 하지 않는가
 *
 * `S3_PUBLIC_BASE_URL` 은 **브라우저가 도달할 주소**라 컨테이너 안에서 도는 이 테스트의
 * 도달 주소와 다를 수 있다(e2e 는 `localhost:9000`, 컨테이너 망은 `minio:9000`).
 * base 를 따라가면 환경 설정을 시험하게 되고 정책은 못 본다. 그래서 응답 URL 에서 **키만**
 * 떼어 내 컨테이너 망 주소로 직접 친다 — 시험 대상을 버킷 정책 하나로 좁힌다.
 * base URL 자체의 정확성은 유닛(`s3.service.spec.ts`)과 부팅 경고(`main.ts`)가 맡는다.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';
const MINIO_URL = process.env.S3_ENDPOINT ?? 'http://minio:9000';
const BUCKET = process.env.S3_BUCKET ?? 'workflow-storage';

/** 1x1 투명 PNG (실제 PNG 시그니처를 가진 최소 바이트). */
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk' +
    'YPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

/** 공개 URL 에서 `avatars/...` 키만 떼어 낸다 (base 는 환경마다 다르다). */
function keyFromPublicUrl(url: string): string {
  const at = url.indexOf('avatars/');
  if (at < 0) throw new Error(`avatars/ 접두가 없는 URL: ${url}`);
  return url.slice(at);
}

describe('아바타 업로드 — 공개 버킷 정책 (e2e)', () => {
  let db: Client;
  let accessToken: string;
  let avatarUrl: string;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const user = await registerAndLogin(BASE_URL, uniqueEmail('avatar'), db);
    accessToken = user.accessToken;
  }, 60_000);

  afterAll(async () => {
    await db?.end();
  });

  it('업로드하면 200 과 avatars/ 접두의 공개 URL 을 돌려준다', async () => {
    const res = await request(BASE_URL)
      .post('/api/users/me/avatar')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', PNG_1X1, {
        filename: 'me.png',
        contentType: 'image/png',
      });

    // 자매 POST 엔드포인트들과 같이 명시 200 (NestJS 기본 201 이 아니다).
    expect(res.status).toBe(200);
    avatarUrl = (res.body.data as { avatarUrl: string }).avatarUrl;
    expect(avatarUrl).toContain('avatars/');
    assertMatchesContract(res.body.data, await contractForDto(UserProfileDto));
    // 키의 UUID 는 장식이 아니라 접근 통제다 — userId 만으로 완성되면 열거된다.
    expect(avatarUrl).toMatch(
      /avatars\/[0-9a-f-]{36}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/,
    );
  }, 60_000);

  it('익명 GET 이 200 이고 image/png 로 서빙된다', async () => {
    const key = keyFromPublicUrl(avatarUrl);
    const res = await fetch(`${MINIO_URL}/${BUCKET}/${key}`);

    // 정책이 닫혀 있으면 403 — 업로드는 성공했는데 이미지만 안 뜨는 그 상태다.
    expect(res.status).toBe(200);
    // Content-Type 은 클라이언트 mimetype 이 아니라 확장자에서 파생돼 저장된다.
    expect(res.headers.get('content-type')).toBe('image/png');
  }, 60_000);

  it('익명 목록 조회는 거부된다 — 키 UUID 가 유일한 접근 통제이므로', async () => {
    const res = await fetch(
      `${MINIO_URL}/${BUCKET}?list-type=2&prefix=avatars`,
    );
    // 200 이면 익명 요청이 전 사용자의 아바타 키를 열거할 수 있다는 뜻이다.
    expect(res.status).toBe(403);
  }, 60_000);

  it('허용되지 않는 확장자는 400 이고 아무것도 올라가지 않는다', async () => {
    const res = await request(BASE_URL)
      .post('/api/users/me/avatar')
      .set('Authorization', `Bearer ${accessToken}`)
      // SVG 는 스크립트를 품을 수 있어 **의도적으로 제외**된 유일한 이미지 포맷이다.
      .attach('file', PNG_1X1, {
        filename: 'me.svg',
        contentType: 'image/svg+xml',
      });

    expect(res.status).toBe(400);
    // 에러 봉투는 `{ error: { code } }` 다 (`auth.e2e-spec.ts` 등 기존 관례).
    expect((res.body as { error?: { code?: string } }).error?.code).toBe(
      'INVALID_FILE_TYPE',
    );
  }, 60_000);

  it('2MB 를 넘으면 413 이고 아무것도 올라가지 않는다', async () => {
    // multer `limits.fileSize` 가 스트림 단계에서 끊는다. 컨트롤러가
    // `@ApiPayloadTooLargeResponse('파일 크기 초과 (2MB)')` 로 **문서화**해 둔 계약인데
    // 그 강제를 실제로 확인하는 테스트가 없었다(리뷰 6·7라운드가 두 번 지목) — 문서한
    // 보장이 구현보다 넓은 상태였다. 상한 참조가 깨져도 아무도 RED 를 내지 않았다.
    const tooBig = Buffer.alloc(2 * 1024 * 1024 + 1, 0);
    const res = await request(BASE_URL)
      .post('/api/users/me/avatar')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', tooBig, {
        filename: 'huge.png',
        contentType: 'image/png',
      });

    expect(res.status).toBe(413);
  }, 60_000);

  it('교체하면 옛 객체가 정리된다 (익명 GET 이 더 이상 200 이 아니다)', async () => {
    const oldKey = keyFromPublicUrl(avatarUrl);

    const res = await request(BASE_URL)
      .post('/api/users/me/avatar')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', PNG_1X1, {
        filename: 'new.png',
        contentType: 'image/png',
      });
    expect(res.status).toBe(200);
    const newKey = keyFromPublicUrl(
      (res.body.data as { avatarUrl: string }).avatarUrl,
    );
    expect(newKey).not.toBe(oldKey);

    // 새 것은 살아 있고 옛 것은 사라졌다 — 고아 객체가 쌓이지 않는다는 계약.
    expect((await fetch(`${MINIO_URL}/${BUCKET}/${newKey}`)).status).toBe(200);
    expect((await fetch(`${MINIO_URL}/${BUCKET}/${oldKey}`)).status).toBe(404);
  }, 60_000);
});
