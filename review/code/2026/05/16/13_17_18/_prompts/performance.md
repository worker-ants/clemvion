# 성능(Performance) Review Payload

본 파일은 orchestrator 가 성능(Performance) reviewer 용으로 작성한 입력입니다. 다음 코드 변경을 성능 관점에서 분석한다.
sub-agent 의 system prompt 에 정의된 호출 규약·등급 기준·출력 형식을 그대로
따르되, 분석 시 아래 "점검 관점" 을 빠짐없이 적용하세요. 결과는 `output_file`
인자에 review.md 로 Write 하고 호출자에게는 STATUS 한 줄만 반환합니다.

## 점검 관점 (성능(Performance))

1. **알고리즘 복잡도**: 시간/공간 복잡도, 비효율적인 알고리즘
2. **N+1 쿼리/호출**: 반복문 내 DB·API 호출, 배치 처리 가능 여부
3. **메모리 할당**: 불필요한 객체 생성, 대규모 데이터 적재, 메모리 누수 가능성
4. **캐싱**: 반복 계산/호출 결과 캐싱 필요성, 캐시 무효화 전략
5. **블로킹 I/O**: 동기 I/O 병목, 비동기 처리가 필요한 구간
6. **불필요한 연산**: 중복 계산, 과도한 문자열 연결 (O(n²) 누적 등)
7. **데이터 구조**: 용도에 맞지 않는 자료구조 사용
8. **지연 로딩**: 즉시 필요하지 않은 리소스의 선행 로딩

## 리뷰 대상 파일

### 파일 1: backend/src/migrations.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/migrations.spec.ts b/backend/src/migrations.spec.ts
index a5ddb123..0c981cfb 100644
--- a/backend/src/migrations.spec.ts
+++ b/backend/src/migrations.spec.ts
@@ -110,18 +110,14 @@ describe('findDuplicateVersions (가드 로직 음성 케이스)', () => {
   });
 
   it('zero-padding drift: V01 vs V001 도 같은 정수 1 로 정규화되어 중복', () => {
-    expect(
-      findDuplicateVersions(['V01__pad.sql', 'V001__unpad.sql']),
-    ).toEqual([1]);
+    expect(findDuplicateVersions(['V01__pad.sql', 'V001__unpad.sql'])).toEqual([
+      1,
+    ]);
   });
 
   it('같은 V번호 3개 이상이어도 정수 한 번만 보고된다', () => {
     expect(
-      findDuplicateVersions([
-        'V050__a.sql',
-        'V050__b.sql',
-        'V050__c.sql',
-      ]),
+      findDuplicateVersions(['V050__a.sql', 'V050__b.sql', 'V050__c.sql']),
     ).toEqual([50]);
   });
 
@@ -138,10 +134,7 @@ describe('findDuplicateVersions (가드 로직 음성 케이스)', () => {
 
   it('짝지어진 .conf 는 정수로 카운트되지 않는다 (.sql 만 검사 대상)', () => {
     expect(
-      findDuplicateVersions([
-        'V030__only.sql',
-        'V030__only.conf',
-      ]),
+      findDuplicateVersions(['V030__only.sql', 'V030__only.conf']),
     ).toEqual([]);
   });
 

```

#### 전체 파일 컨텍스트
```
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Flyway 마이그레이션 파일명 컨벤션 가드.
 *
 * 본 프로젝트는 `backend/migrations/V<정수>__<설명>.sql` 단조 정수 prefix
 * 만 사용한다 (`backend/migrations/README.md` 참조). Flyway 10 의 기본
 * version regex 는 `V[0-9.]+__...` 형태라 alphanumeric suffix (V035a 등)
 * 는 매치되지 않아 **silent skip** 되며 schema_history 에 등록되지 않는다 —
 * PR-B Part A 에서 V035a/V035b 두 파일이 그대로 누락되어 prod 에서 회귀
 * 발생한 사례가 있다.
 *
 * 본 spec 은 매 빌드/CI 마다 마이그레이션 파일명을 검증해 동일 회귀를
 * 차단한다. 컨벤션 위반 (alphanumeric suffix / 잘못된 separator / 짝지어진
 * .conf 의 prefix mismatch / version 중복) 시 즉시 fail.
 *
 * 빌드 시점에는 `backend/migrations/check-duplicate-versions.sh` 가 동일한
 * 정규화 규칙으로 한 번 더 차단한다 — 정책: `spec/conventions/migrations.md` §6.
 */

const MIGRATIONS_DIR = join(__dirname, '..', 'migrations');
// 단조 정수 prefix + 더블 언더스코어 + 영소문자/숫자/언더스코어/하이픈만 허용.
// Flyway 가 invalid 로 간주하지 않을 안전한 부분집합.
const SQL_NAME_RE = /^V([0-9]+)__[a-z0-9_-]+\.sql$/;
const CONF_NAME_RE = /^V([0-9]+)__[a-z0-9_-]+\.conf$/;
// 빌드 시점 가드 스크립트의 V번호 추출 정규식과 동일한 정규화 규칙
// (`s/^V0*([0-9]+)__.*/\1/`). 두 가드가 같은 정수로 정규화하므로
// V01__a.sql 과 V001__b.sql 도 동일 버전 1 로 중복 검출된다.
const VERSION_FROM_SQL_RE = /^V0*([0-9]+)__/;

/**
 * 파일 목록에서 동일 V번호(정수 정규화 후) 가 둘 이상인 케이스를 찾아 반환한다.
 * 빌드 시점 가드 (`check-duplicate-versions.sh`) 와 동일 규칙.
 */
export function findDuplicateVersions(filenames: readonly string[]): number[] {
  const seen = new Set<number>();
  const dup = new Set<number>();
  for (const name of filenames) {
    if (!name.endsWith('.sql')) continue;
    const m = VERSION_FROM_SQL_RE.exec(name);
    if (!m) continue;
    const v = parseInt(m[1], 10);
    if (seen.has(v)) dup.add(v);
    else seen.add(v);
  }
  return [...dup].sort((a, b) => a - b);
}

describe('Flyway migration naming convention', () => {
  let entries: string[];

  beforeAll(() => {
    entries = readdirSync(MIGRATIONS_DIR);
  });

  it('모든 V*.sql 파일이 정수 prefix 컨벤션을 만족한다', () => {
    const sqlFiles = entries.filter(
      (f) => f.startsWith('V') && f.endsWith('.sql'),
    );
    expect(sqlFiles.length).toBeGreaterThan(0);
    const violators = sqlFiles.filter((f) => !SQL_NAME_RE.test(f));
    expect(violators).toEqual([]);
  });

  it('모든 V*.conf 파일이 같은 prefix 컨벤션을 만족하고 짝지어진 .sql 이 존재한다', () => {
    const confFiles = entries.filter(
      (f) => f.startsWith('V') && f.endsWith('.conf'),
    );
    const sqlSet = new Set(
      entries.filter((f) => f.startsWith('V') && f.endsWith('.sql')),
    );
    const violators: string[] = [];
    for (const conf of confFiles) {
      if (!CONF_NAME_RE.test(conf)) {
        violators.push(`${conf} (잘못된 prefix)`);
        continue;
      }
      const expectedSql = conf.replace(/\.conf$/, '.sql');
      if (!sqlSet.has(expectedSql)) {
        violators.push(`${conf} (짝지어진 .sql 없음: ${expectedSql})`);
      }
    }
    expect(violators).toEqual([]);
  });

  it('현재 마이그레이션 디렉토리에 동일 V번호 .sql 이 중복되지 않는다', () => {
    expect(findDuplicateVersions(entries)).toEqual([]);
  });

  it('alphanumeric suffix (e.g. V035a) 가 등장하지 않는다 (silent skip 회귀 가드)', () => {
    const offenders = entries.filter(
      (f) =>
        (f.endsWith('.sql') || f.endsWith('.conf')) && /^V[0-9]+[a-z]/.test(f),
    );
    expect(offenders).toEqual([]);
  });
});

describe('findDuplicateVersions (가드 로직 음성 케이스)', () => {
  it('단순 중복: 같은 V<N>__*.sql 두 개 → 해당 정수 반환', () => {
    expect(
      findDuplicateVersions([
        'V040__a.sql',
        'V041__one.sql',
        'V041__two.sql',
        'V042__c.sql',
      ]),
    ).toEqual([41]);
  });

  it('zero-padding drift: V01 vs V001 도 같은 정수 1 로 정규화되어 중복', () => {
    expect(findDuplicateVersions(['V01__pad.sql', 'V001__unpad.sql'])).toEqual([
      1,
    ]);
  });

  it('같은 V번호 3개 이상이어도 정수 한 번만 보고된다', () => {
    expect(
      findDuplicateVersions(['V050__a.sql', 'V050__b.sql', 'V050__c.sql']),
    ).toEqual([50]);
  });

  it('서로 다른 두 V번호가 각각 중복이면 둘 다 보고된다 (정렬됨)', () => {
    expect(
      findDuplicateVersions([
        'V010__a.sql',
        'V010__b.sql',
        'V020__c.sql',
        'V020__d.sql',
      ]),
    ).toEqual([10, 20]);
  });

  it('짝지어진 .conf 는 정수로 카운트되지 않는다 (.sql 만 검사 대상)', () => {
    expect(
      findDuplicateVersions(['V030__only.sql', 'V030__only.conf']),
    ).toEqual([]);
  });

  it('빈 입력 / .sql 가 없는 경우 빈 배열', () => {
    expect(findDuplicateVersions([])).toEqual([]);
    expect(findDuplicateVersions(['README.md', 'V030__only.conf'])).toEqual([]);
  });
});

```

---

### 파일 2: backend/src/modules/integrations/third-party-oauth.controller.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/modules/integrations/third-party-oauth.controller.ts b/backend/src/modules/integrations/third-party-oauth.controller.ts
index 95721853..ee3f4f3b 100644
--- a/backend/src/modules/integrations/third-party-oauth.controller.ts
+++ b/backend/src/modules/integrations/third-party-oauth.controller.ts
@@ -197,7 +197,8 @@ export class ThirdPartyOAuthController {
   })
   @ApiProduces('text/html')
   @ApiOkResponse({
-    description: 'OAuth 처리 결과 HTML 페이지 (postMessage payload 에 분기 정보 포함)',
+    description:
+      'OAuth 처리 결과 HTML 페이지 (postMessage payload 에 분기 정보 포함)',
   })
   @ApiBadRequestResponse({ description: '지원하지 않는 OAuth provider' })
   async oauthCallback(

```

#### 전체 파일 컨텍스트
```
import { Controller, Get, Param, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { renderInstallErrorHtml } from './services/install-error.template';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiProduces,
} from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import {
  ALLOWED_OAUTH_PROVIDERS,
  Cafe24InstallQuery,
  IntegrationOAuthService,
} from './integration-oauth.service';
import { renderCallbackHtml } from './services/oauth-callback.template';
import {
  INSTALL_TOKEN_PATTERN,
  THIRD_PARTY_PREFIX,
} from './third-party-oauth.constants';

/**
 * 3rd-party 가 호출하는 OAuth endpoints (Cafe24 "테스트 실행" install +
 * provider callbacks). 사용자가 호출하는 통합 관리 API
 * (`/api/integrations/...`) 와 분리. spec/2-navigation/4-integration.md
 * §9.2 Rationale "Cafe24 App URL 100자 한도 대응".
 *
 * install_token 형식·URL 조립 헬퍼는 `third-party-oauth.constants.ts` 의
 * 단일 진실 지점에서 정의 — 토큰 생성(서비스)·검증(본 컨트롤러)·appUrl
 * 조립(서비스) 사이의 불일치를 컴파일 타임에 차단한다.
 */
@ApiTags('Third-Party OAuth')
@Controller(THIRD_PARTY_PREFIX)
export class ThirdPartyOAuthController {
  constructor(private readonly oauthService: IntegrationOAuthService) {}

  /**
   * Cafe24 Private 앱 App URL 엔드포인트. Cafe24 Developers 의 "테스트 실행"
   * 이 path 의 install_token 으로 단일 row 조회 → HMAC 1회 검증 후 Cafe24
   * authorize URL 로 redirect.
   *
   * Rate limit: install_token 이 URL path 에 노출되어 (logs / Referer) 추가
   * 보호가 필요. spec Rationale "CAFE24_INSTALL_INVALID_TOKEN(404) 의 보안
   * 전제" 참조.
   */
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('cafe24/install/:installToken')
  @ApiOperation({
    summary: 'Cafe24 Private 앱 설치 진입점 (App URL — install_token)',
    description:
      'Cafe24 Developers "테스트 실행" 시 Cafe24가 호출하는 App URL 엔드포인트. path 의 install_token 으로 pending_install Integration 을 단일 row 조회하고 HMAC 1회 검증 후 Cafe24 authorize URL 로 302 redirect 합니다.',
  })
  @ApiParam({
    name: 'installToken',
    description: '16바이트 base64url (22자) install_token',
    example: 'AbCdEfGhIjKlMnOpQrStUv',
  })
  @ApiOkResponse({ description: '302 redirect to Cafe24 authorize URL' })
  @ApiBadRequestResponse({
    description:
      'CAFE24_INSTALL_MISSING_PARAMS — mall_id/timestamp/hmac 누락. CAFE24_INSTALL_REPLAY — timestamp 가 ±5분 윈도우 밖.',
  })
  @ApiForbiddenResponse({
    description:
      'CAFE24_INSTALL_INVALID_HMAC — HMAC 검증 실패 또는 install_token 의 row 가 다른 mall_id 와 매칭.',
  })
  @ApiNotFoundResponse({
    description:
      'CAFE24_INSTALL_INVALID_TOKEN — install_token 형식 불일치(22 base64url 아님) 또는 미존재(callback 성공/TTL 만료로 NULL).',
  })
  async cafe24Install(
    @Param('installToken') installToken: string,
    @Query('mall_id') mallId: string | undefined,
    @Query('timestamp') timestamp: string | undefined,
    @Query('hmac') hmac: string | undefined,
    @Query('shop_no') shopNo: string | undefined,
    @Query('user_id') userId: string | undefined,
    @Query('user_name') userName: string | undefined,
    @Query('user_type') userType: string | undefined,
    @Query('lang') lang: string | undefined,
    @Query('nation') nation: string | undefined,
    @Query('is_multi_shop') isMultiShop: string | undefined,
    @Query('auth_config') authConfig: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    // API H-1 (2026-05-16): spec/5-system/2-api-convention.md §5.3 은
    // 에러 응답을 `{ error: { code, message } }` envelope 으로 통일한다.
    // 옛 코드는 bare `{ code, message }` 를 반환해 규약 위반이었다.
    if (!INSTALL_TOKEN_PATTERN.test(installToken)) {
      res.status(404).json({
        error: {
          code: 'CAFE24_INSTALL_INVALID_TOKEN',
          message: 'install_token format invalid',
        },
      });
      return;
    }
    if (!mallId || !timestamp || !hmac) {
      res.status(400).json({
        error: {
          code: 'CAFE24_INSTALL_MISSING_PARAMS',
          message: 'mall_id, timestamp, hmac are required',
        },
      });
      return;
    }
    const rawQuery = req.url.includes('?') ? req.url.split('?', 2)[1] : '';
    const query: Cafe24InstallQuery = {
      mall_id: mallId,
      timestamp,
      hmac,
      shop_no: shopNo,
      user_id: userId,
      user_name: userName,
      user_type: userType,
      lang,
      nation,
      is_multi_shop: isMultiShop,
      auth_config: authConfig,
      rawQuery,
    };
    try {
      const redirectUrl = await this.oauthService.handleInstall(
        installToken,
        query,
      );
      res.redirect(302, redirectUrl);
    } catch (err) {
      const e = err as {
        status?: number;
        response?: { code?: string; message?: string };
        message?: string;
      };
      const status = e.status ?? 400;
      const code = e.response?.code ?? 'CAFE24_INSTALL_FAILED';
      const message = e.response?.message ?? e.message ?? 'Install failed';
      // Render an HTML page when the browser is the consumer (Cafe24's "테스트
      // 실행" / "앱으로 가기" opens this URL in a new tab → user sees this page
      // directly). JSON is still returned to API-style clients. req.headers
      // is `?` because some test fixtures construct a bare Request object
      // without the Express request envelope.
      const acceptHeader = req.headers?.['accept'] ?? '';
      const acceptsHtml =
        typeof acceptHeader === 'string' && acceptHeader.includes('text/html');
      if (acceptsHtml) {
        res
          .status(status)
          .setHeader('Content-Type', 'text/html; charset=utf-8')
          .send(renderInstallErrorHtml(code, message));
      } else {
        // API H-1: 자체 API 규약 §5.3 envelope.
        res.status(status).json({ error: { code, message } });
      }
    }
  }

  /**
   * Generic OAuth callback for all integration providers. Provider 마다 별도
   * controller 를 만들지 않고 :provider 파라메트릭 단일 핸들러로 유지 (현
   * google/github/cafe24 3종 모두 동일 처리 흐름).
   * spec/2-navigation/4-integration.md §10.
   *
   * ※ 사용자 소셜 로그인 콜백 (`/api/auth/oauth/:provider/callback`) 과 별개다.
   *
   * Throttle: state 검증으로 reflected abuse 는 차단되나, OAuth code 교환
   * 호출의 외부 의존성 비용을 감안해 install 보다 약한 60 req/min 적용.
   */
  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get(':provider/callback')
  @ApiOperation({
    summary: 'OAuth 콜백 처리 (통합 연동)',
    description:
      'OAuth provider 가 리디렉션하는 콜백 엔드포인트입니다. 인증 불필요. 처리 후 결과를 담은 HTML 페이지를 반환하며 `postMessage`로 부모 창에 결과를 전달합니다. 사용자 소셜 로그인 콜백(/api/auth/oauth/:provider/callback) 과 별개입니다.\n\n' +
      '**postMessage payload 의 에러 코드 어휘 (API H-3 / spec §10.4):**\n' +
      '- `OAUTH_PROVIDER_UNKNOWN` — 허용되지 않은 provider\n' +
      '- `OAUTH_DENIED` — 사용자가 authorize 단계에서 거부 (`?error=...`)\n' +
      '- `OAUTH_STATE_MISSING` / `OAUTH_STATE_MISMATCH` / `OAUTH_STATE_EXPIRED` — CSRF state 토큰 검증 실패\n' +
      '- `OAUTH_CODE_MISSING` — authorization code 미수신\n' +
      '- `OAUTH_TOKEN_EXCHANGE_FAILED` — provider 토큰 endpoint 호출 실패\n' +
      '- `OAUTH_STATE_INVALID` — reauthorize state 의 integrationId 누락 등 구조 오류\n' +
      '- `RESOURCE_NOT_FOUND` — state 의 integrationId 가 가리키는 row 부재\n' +
      '\n' +
      'frontend 는 `postMessage` event.data.error.code 로 분기. 응답 HTTP status 는 항상 200 (HTML page 자체는 정상 반환).',
  })
  @ApiParam({
    name: 'provider',
    description: 'OAuth provider 식별자 (google, github, cafe24)',
    example: 'google',
  })
  @ApiProduces('text/html')
  @ApiOkResponse({
    description:
      'OAuth 처리 결과 HTML 페이지 (postMessage payload 에 분기 정보 포함)',
  })
  @ApiBadRequestResponse({ description: '지원하지 않는 OAuth provider' })
  async oauthCallback(
    @Param('provider') provider: string,
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    const targetOrigin = process.env.FRONTEND_URL || process.env.APP_URL;
    if (!targetOrigin) {
      res.status(500).setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(
        '<p>OAuth callback misconfigured: FRONTEND_URL / APP_URL not set.</p>',
      );
      return;
    }
    // SEC H-3 (2026-05-16): `targetOrigin` 은 `renderCallbackHtml` 의
    // `postMessage(payload, targetOrigin)` 으로 전달돼 OAuth 결과
    // (`previewToken`, `integrationId` 등) 를 부모 창에 통보한다.
    // `*` 이거나 외부 도메인으로 잘못 설정되면 결과가 임의 origin 에 노출.
    // 부팅 시 origin shape 를 검증해 잘못된 설정을 명시 거부.
    if (!isValidPostMessageOrigin(targetOrigin)) {
      res.status(500).setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(
        '<p>OAuth callback misconfigured: FRONTEND_URL / APP_URL must be a concrete https:// or http://localhost origin (wildcards rejected).</p>',
      );
      return;
    }

    if (!(ALLOWED_OAUTH_PROVIDERS as readonly string[]).includes(provider)) {
      res.status(400).setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(
        renderCallbackHtml(
          {
            status: 'error',
            provider,
            error: 'Unsupported OAuth provider',
          },
          targetOrigin,
        ),
      );
      return;
    }

    try {
      const result = await this.oauthService.handleCallbackWithErrorCapture(
        provider,
        { code, state, error },
      );
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(renderCallbackHtml({ status: 'success', result }, targetOrigin));
    } catch (err) {
      const e = err as {
        message?: string;
        response?: { message?: string };
      };
      const message = e.response?.message ?? e.message ?? 'OAuth failed';
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(
        renderCallbackHtml(
          { status: 'error', provider, error: message },
          targetOrigin,
        ),
      );
    }
  }
}

/**
 * SEC H-3 — postMessage(payload, targetOrigin) 의 targetOrigin 으로 안전한
 * origin 인지 검증.
 *
 * 허용:
 *   - `https://...` 로 시작하는 origin (path 없음, query 없음)
 *   - `http://localhost(:port)?` (개발 환경)
 *   - `http://127.0.0.1(:port)?` (개발 환경)
 *
 * 거부:
 *   - `*` 또는 `null` (wildcard)
 *   - `http://...` (localhost 외 비-TLS)
 *   - 경로/쿼리 포함 (`https://foo.com/path`) — origin 만 허용
 *   - 비-URL 문자열
 *
 * 잘못 설정된 운영 환경에서 OAuth 결과 (previewToken, integrationId) 가
 * 외부 origin 에 누출되는 것을 차단.
 */
export function isValidPostMessageOrigin(origin: string): boolean {
  if (!origin || origin === '*' || origin === 'null') return false;
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }
  // origin 만 허용 — 경로/쿼리/fragment 가 있으면 거부
  if (parsed.pathname !== '/' && parsed.pathname !== '') return false;
  if (parsed.search || parsed.hash) return false;
  if (parsed.protocol === 'https:') return true;
  if (parsed.protocol === 'http:') {
    // localhost / 127.0.0.1 만 평문 허용
    return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  }
  return false;
}

```

---

### 파일 3: backend/src/nodes/integration/send-email/send-email.schema.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/integration/send-email/send-email.schema.spec.ts b/backend/src/nodes/integration/send-email/send-email.schema.spec.ts
index 3da7dea9..3bfa02e8 100644
--- a/backend/src/nodes/integration/send-email/send-email.schema.spec.ts
+++ b/backend/src/nodes/integration/send-email/send-email.schema.spec.ts
@@ -237,7 +237,9 @@ describe('Send Email node schema', () => {
     it('emits all four declarative warnings on a freshly-created node', () => {
       const errors = evaluateMetadataBlockingErrors(sendEmailNodeMetadata, {});
       expect(errors).toContain('Email integration must be selected.');
-      expect(errors).toContain('Recipient (To) must include at least one address.');
+      expect(errors).toContain(
+        'Recipient (To) must include at least one address.',
+      );
       expect(errors).toContain('Subject must be entered.');
       expect(errors).toContain('Body must be entered.');
     });

```

#### 전체 파일 컨텍스트
```
import { evaluateWarnings } from '@workflow/node-summary';
import {
  sendEmailNodeConfigSchema,
  sendEmailNodeMetadata,
  sendEmailNodeOutputSchema,
  sendEmailNodePorts,
  validateSendEmailConfig,
} from './send-email.schema';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation';

describe('Send Email node schema', () => {
  describe('sendEmailNodeConfigSchema defaults', () => {
    it('빈 config 는 기본값으로 채워짐 (subject/body 모두 "", 배열 필드 []) ', () => {
      const parsed = sendEmailNodeConfigSchema.parse({});
      expect(parsed.subject).toBe('');
      expect(parsed.body).toBe('');
      expect(parsed.to).toEqual([]);
      expect(parsed.cc).toEqual([]);
      expect(parsed.bcc).toEqual([]);
      expect(parsed.bodyType).toBe('text');
      expect(parsed.attachments).toEqual([]);
      expect(parsed.integrationId).toBeUndefined();
    });

    // subject/body 를 `.default('')` 로 둔 이유: LLM 이 `.optional()` 을
    // "선택 사항" 으로 오인해 인자 자체를 누락하는 사례를 차단.
    // 누락 시 zod 가 '' 를 채워주므로 핸들러 validate 가 "required 미충족" 을
    // 명시적으로 반환할 수 있다.
    it('subject 를 omit 하면 빈 문자열 기본값 (LLM omit 방지)', () => {
      const parsed = sendEmailNodeConfigSchema.parse({});
      expect(parsed.subject).toBe('');
    });

    it('body 를 omit 하면 빈 문자열 기본값', () => {
      const parsed = sendEmailNodeConfigSchema.parse({});
      expect(parsed.body).toBe('');
    });

    it('명시적으로 subject="" 를 전달해도 유효 (handler 가 runtime-required 체크)', () => {
      const result = sendEmailNodeConfigSchema.safeParse({ subject: '' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.subject).toBe('');
      }
    });
  });

  describe('sendEmailNodeConfigSchema bodyType', () => {
    it("bodyType 은 'text' / 'html' 만 허용", () => {
      expect(
        sendEmailNodeConfigSchema.safeParse({ bodyType: 'text' }).success,
      ).toBe(true);
      expect(
        sendEmailNodeConfigSchema.safeParse({ bodyType: 'html' }).success,
      ).toBe(true);
    });

    it('bodyType 이 그 외 값이면 거부 (markdown 등)', () => {
      expect(
        sendEmailNodeConfigSchema.safeParse({ bodyType: 'markdown' }).success,
      ).toBe(false);
    });
  });

  describe('sendEmailNodeConfigSchema arrays', () => {
    it('to/cc/bcc 에 string 배열 허용', () => {
      const parsed = sendEmailNodeConfigSchema.parse({
        to: ['a@x.com'],
        cc: ['b@x.com', 'c@x.com'],
        bcc: [],
      });
      expect(parsed.to).toEqual(['a@x.com']);
      expect(parsed.cc).toEqual(['b@x.com', 'c@x.com']);
      expect(parsed.bcc).toEqual([]);
    });

    it('attachments: filename + content 객체 배열 허용', () => {
      const parsed = sendEmailNodeConfigSchema.parse({
        attachments: [
          { filename: 'a.pdf', content: 'base64data' },
          { filename: 'b.txt', content: 'https://example.com/file' },
        ],
      });
      expect(parsed.attachments).toHaveLength(2);
      expect(parsed.attachments[0].filename).toBe('a.pdf');
    });
  });

  describe('sendEmailNodeOutputSchema', () => {
    // 성공/실패 분기 — output 스키마는 성공 필드(messageId 등) 와 error 필드를
    // 모두 optional 로 허용. config 스키마의 `.default('')` 와는 의도적으로 비대칭
    // (config 는 LLM omit 방지, output 은 성공·실패 양쪽 path 표현).
    it('성공 shape 수용 (messageId + accepted + deliveryStatus)', () => {
      const result = sendEmailNodeOutputSchema.safeParse({
        config: { integrationId: 'i1', to: ['a@x.com'], subject: 'hi' },
        output: { messageId: 'm-1', accepted: ['a@x.com'], rejected: [] },
        meta: { durationMs: 123, deliveryStatus: 'sent' },
        port: 'out',
        status: 'success',
      });
      expect(result.success).toBe(true);
    });

    it('실패 shape 수용 (error envelope + port=error)', () => {
      const result = sendEmailNodeOutputSchema.safeParse({
        config: { to: ['a@x.com'] },
        output: {
          error: {
            code: 'SMTP_AUTH_FAILED',
            message: 'invalid credentials',
            details: { smtpCode: 535 },
          },
        },
        meta: { deliveryStatus: 'failed' },
        port: 'error',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('static metadata', () => {
    it('ports: inputs=[in], outputs=[out, error]', () => {
      expect(sendEmailNodePorts.outputs.map((p) => p.id)).toEqual([
        'out',
        'error',
      ]);
    });

    it('metadata: type=send_email, category=integration', () => {
      expect(sendEmailNodeMetadata.type).toBe('send_email');
      expect(sendEmailNodeMetadata.category).toBe('integration');
    });
  });

  describe('warningRules', () => {
    const firedIds = (config: unknown) =>
      evaluateWarnings(
        config as Record<string, unknown>,
        sendEmailNodeMetadata.warningRules,
      ).map((w) => w.id);

    describe('send_email:no-integration', () => {
      it('fires when integrationId is missing', () => {
        expect(firedIds({})).toContain('send_email:no-integration');
      });

      it('does NOT fire when integrationId is set', () => {
        expect(firedIds({ integrationId: 'i-1' })).not.toContain(
          'send_email:no-integration',
        );
      });
    });

    describe('send_email:no-recipient', () => {
      it('fires when to is missing', () => {
        expect(firedIds({})).toContain('send_email:no-recipient');
      });

      it('fires when to is empty array', () => {
        expect(firedIds({ to: [] })).toContain('send_email:no-recipient');
      });

      it('does NOT fire when to has at least one element', () => {
        expect(firedIds({ to: ['a@example.com'] })).not.toContain(
          'send_email:no-recipient',
        );
      });
    });

    describe('send_email:no-subject', () => {
      it('fires when subject is empty string', () => {
        expect(firedIds({ subject: '' })).toContain('send_email:no-subject');
      });

      it('does NOT fire when subject is set', () => {
        expect(firedIds({ subject: 'hi' })).not.toContain(
          'send_email:no-subject',
        );
      });
    });

    describe('send_email:no-body', () => {
      it('fires when body is empty string', () => {
        expect(firedIds({ body: '' })).toContain('send_email:no-body');
      });

      it('does NOT fire when body is set', () => {
        expect(firedIds({ body: 'hello' })).not.toContain('send_email:no-body');
      });
    });
  });

  describe('validateSendEmailConfig (imperative)', () => {
    it('returns [] when to is a non-empty string', () => {
      expect(validateSendEmailConfig({ to: 'a@example.com' })).toEqual([]);
    });

    it('returns [] when to is a non-empty array of strings', () => {
      expect(
        validateSendEmailConfig({ to: ['a@example.com', 'b@example.com'] }),
      ).toEqual([]);
    });

    it('rejects to when missing', () => {
      expect(validateSendEmailConfig({})).toContain(
        'to is required and must be a non-empty string or array of email addresses',
      );
    });

    it('rejects to when array contains empty / non-string entries', () => {
      expect(validateSendEmailConfig({ to: [''] })).toContain(
        'to is required and must be a non-empty string or array of email addresses',
      );
      expect(validateSendEmailConfig({ to: [123 as never] })).toContain(
        'to is required and must be a non-empty string or array of email addresses',
      );
    });

    it('skips cc/bcc validation when they are unset / empty', () => {
      expect(
        validateSendEmailConfig({ to: 'a@example.com', cc: [], bcc: '' }),
      ).toEqual([]);
    });

    it('rejects cc when set but malformed (array with non-string)', () => {
      const errors = validateSendEmailConfig({
        to: 'a@example.com',
        cc: [123 as never],
      });
      expect(errors).toContain(
        'cc must be a string or array of email addresses',
      );
    });
  });

  describe('evaluateMetadataBlockingErrors integration (send_email)', () => {
    it('emits all four declarative warnings on a freshly-created node', () => {
      const errors = evaluateMetadataBlockingErrors(sendEmailNodeMetadata, {});
      expect(errors).toContain('Email integration must be selected.');
      expect(errors).toContain(
        'Recipient (To) must include at least one address.',
      );
      expect(errors).toContain('Subject must be entered.');
      expect(errors).toContain('Body must be entered.');
    });

    it('returns [] when fully configured', () => {
      expect(
        evaluateMetadataBlockingErrors(sendEmailNodeMetadata, {
          integrationId: 'i-1',
          to: ['a@example.com'],
          subject: 'hi',
          body: 'hello',
        }),
      ).toEqual([]);
    });
  });
});

```

---

### 파일 4: backend/src/nodes/logic/if-else/if-else.schema.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/logic/if-else/if-else.schema.ts b/backend/src/nodes/logic/if-else/if-else.schema.ts
index 3489e56f..c90d5991 100644
--- a/backend/src/nodes/logic/if-else/if-else.schema.ts
+++ b/backend/src/nodes/logic/if-else/if-else.schema.ts
@@ -160,7 +160,7 @@ export const ifElseMetadata: NodeComponentMetadata = {
     {
       id: 'if_else:first-condition-field-empty',
       when: 'length(conditions) > 0 && !conditions.0.field',
-      message: 'First condition\'s field must be entered.',
+      message: "First condition's field must be entered.",
     },
   ],
   validateConfig: validateIfElseConfig,

```

#### 전체 파일 컨텍스트
```
import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

export const conditionOperatorSchema = z.enum([
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'contains',
  'not_contains',
  'starts_with',
  'ends_with',
  'is_empty',
  'is_not_empty',
  'regex',
  'is_null',
  'is_type',
]);

export const conditionGroupSchema = z
  .object({
    field: z
      .string()
      .default('')
      .meta({
        ui: {
          label: 'Field',
          widget: 'expression',
          placeholder: '{{ $input.value }}',
        },
      }),
    operator: conditionOperatorSchema.default('eq').meta({
      ui: { label: 'Operator', widget: 'select' },
    }),
    value: z
      .unknown()
      .optional()
      .meta({
        ui: { label: 'Value', widget: 'expression' },
      }),
  })
  .passthrough();

export const ifElseOutputSchema = z
  .object({
    config: z
      .object({
        conditions: z.array(conditionGroupSchema).optional(),
        combineMode: z.enum(['and', 'or']).optional(),
        strictComparison: z.boolean().optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    output: z.unknown().optional(),
    port: z.enum(['true', 'false']).optional(),
    status: z.string().optional(),
  })
  .passthrough();

export const ifElseConfigSchema = z
  .object({
    conditions: z
      .array(conditionGroupSchema)
      .default([])
      .meta({
        ui: {
          label: 'Conditions',
          widget: 'condition-builder',
          itemLabel: 'Condition',
        },
      }),
    combineMode: z
      .enum(['and', 'or'])
      .default('and')
      .meta({
        ui: { label: 'Combine Mode', widget: 'select' },
      }),
    strictComparison: z
      .boolean()
      .default(false)
      .meta({
        ui: {
          label: 'Strict Comparison',
          widget: 'checkbox',
          hint: 'Compare without type coercion',
        },
      }),
  })
  .passthrough();
export type IfElseConfig = z.infer<typeof ifElseConfigSchema>;

export const ifElsePorts: NodePorts = {
  inputs: [{ id: 'in', label: 'Input', type: 'data' }],
  outputs: [
    { id: 'true', label: 'True', type: 'data' },
    { id: 'false', label: 'False', type: 'data' },
  ],
};

/**
 * Imperative escape hatch — per-condition validation (operator whitelist,
 * field presence) needs array iteration the mini-DSL can't express.
 * Single-field "is conditions empty?" / "first condition.field set?" checks
 * live in `warningRules` below so they fire the canvas badge.
 */
export function validateIfElseConfig(config: unknown): string[] {
  const c = (config ?? {}) as Record<string, unknown>;
  const errors: string[] = [];
  const conditions = c.conditions;

  if (Array.isArray(conditions)) {
    for (let i = 0; i < conditions.length; i++) {
      const cond = (conditions[i] ?? {}) as Record<string, unknown>;
      if (!cond.field || typeof cond.field !== 'string') {
        errors.push(`conditions[${i}].field is required and must be a string`);
      }
      if (
        !cond.operator ||
        !(conditionOperatorSchema.options as readonly string[]).includes(
          cond.operator as string,
        )
      ) {
        errors.push(
          `conditions[${i}].operator must be one of: ${conditionOperatorSchema.options.join(', ')}`,
        );
      }
    }
  }

  return errors;
}

export const ifElseMetadata: NodeComponentMetadata = {
  type: 'if_else',
  category: 'logic',
  label: 'If/Else',
  description: 'Conditional branching',
  icon: 'GitBranch',
  color: '#3B82F6',
  executionMetadata: { kind: 'standard' },
  // SSOT for warnings (frontend canvas + backend handler.validate).
  // Mirror points:
  //  - frontend `ifElseSummary` warning ("Condition not set" — fires when
  //    conditions[] is empty OR conditions[0].field is blank).
  //  - backend handler.validate's structural checks: conditions must be
  //    non-empty + each condition needs field + operator. Per-item operator
  //    whitelist iterates `conditions[]`, so it lives in `validateConfig`.
  warningRules: [
    {
      id: 'if_else:no-conditions',
      when: 'length(conditions) == 0',
      message: 'At least one condition must be added.',
    },
    {
      id: 'if_else:first-condition-field-empty',
      when: 'length(conditions) > 0 && !conditions.0.field',
      message: "First condition's field must be entered.",
    },
  ],
  validateConfig: validateIfElseConfig,
};

```

---

### 파일 5: backend/src/nodes/logic/parallel/parallel.schema.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/logic/parallel/parallel.schema.spec.ts b/backend/src/nodes/logic/parallel/parallel.schema.spec.ts
index d0b86bf5..ab02be84 100644
--- a/backend/src/nodes/logic/parallel/parallel.schema.spec.ts
+++ b/backend/src/nodes/logic/parallel/parallel.schema.spec.ts
@@ -169,9 +169,7 @@ describe('Parallel node', () => {
         branchCount: 1,
       });
       expect(errors).toContain('branchCount must be 2 to 16.');
-      expect(errors).toContain(
-        'branchCount must be a value between 2 and 16.',
-      );
+      expect(errors).toContain('branchCount must be a value between 2 and 16.');
     });
   });
 

```

#### 전체 파일 컨텍스트
```
import { evaluateWarnings } from '@workflow/node-summary';
import { ParallelHandler } from './parallel.handler';
import {
  parallelNodeConfigSchema,
  parallelNodeMetadata,
  validateParallelConfig,
} from './parallel.schema';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation';
import { createEmptyConversationThread } from '../../../shared/conversation-thread/conversation-thread.types';

describe('Parallel node', () => {
  it('스키마 기본값: branchCount=2, maxConcurrency=0, waitAll=true', () => {
    const parsed = parallelNodeConfigSchema.parse({});
    expect(parsed.branchCount).toBe(2);
    expect(parsed.maxConcurrency).toBe(0);
    expect(parsed.waitAll).toBe(true);
  });

  it('스키마: 명시적으로 값을 전달하면 그대로 유지', () => {
    const parsed = parallelNodeConfigSchema.parse({
      branchCount: 4,
      maxConcurrency: 2,
      waitAll: false,
    });
    expect(parsed.branchCount).toBe(4);
    expect(parsed.maxConcurrency).toBe(2);
    expect(parsed.waitAll).toBe(false);
  });

  it('메타데이터: type=parallel, category=logic', () => {
    expect(parallelNodeMetadata.type).toBe('parallel');
    expect(parallelNodeMetadata.category).toBe('logic');
  });

  describe('handler.validate', () => {
    const handler = new ParallelHandler();

    it('branchCount: 2~16 범위 내는 valid', () => {
      expect(handler.validate({ branchCount: 2 }).valid).toBe(true);
      expect(handler.validate({ branchCount: 16 }).valid).toBe(true);
      expect(handler.validate({ branchCount: 8 }).valid).toBe(true);
    });

    it('branchCount: 1 이하 또는 17 이상은 invalid', () => {
      expect(handler.validate({ branchCount: 1 }).valid).toBe(false);
      expect(handler.validate({ branchCount: 17 }).valid).toBe(false);
    });

    it('maxConcurrency: 0~16 범위 내는 valid (0=제한 없음)', () => {
      expect(
        handler.validate({ branchCount: 4, maxConcurrency: 0 }).valid,
      ).toBe(true);
      expect(
        handler.validate({ branchCount: 4, maxConcurrency: 1 }).valid,
      ).toBe(true);
      expect(
        handler.validate({ branchCount: 4, maxConcurrency: 16 }).valid,
      ).toBe(true);
    });

    it('maxConcurrency: 음수·17 이상·정수 아님은 invalid', () => {
      expect(
        handler.validate({ branchCount: 4, maxConcurrency: -1 }).valid,
      ).toBe(false);
      expect(
        handler.validate({ branchCount: 4, maxConcurrency: 17 }).valid,
      ).toBe(false);
      expect(
        handler.validate({ branchCount: 4, maxConcurrency: 2.5 }).valid,
      ).toBe(false);
    });

    it('maxConcurrency: undefined이면 검증 스킵 (스키마 default 적용 대상)', () => {
      expect(handler.validate({ branchCount: 4 }).valid).toBe(true);
    });

    it('waitAll: boolean 이외는 invalid', () => {
      expect(handler.validate({ branchCount: 4, waitAll: true }).valid).toBe(
        true,
      );
      expect(handler.validate({ branchCount: 4, waitAll: false }).valid).toBe(
        true,
      );
      expect(
        handler.validate({
          branchCount: 4,
          waitAll: 'yes',
        }).valid,
      ).toBe(false);
    });
  });

  describe('warningRules', () => {
    const firedIds = (config: unknown) =>
      evaluateWarnings(
        config as Record<string, unknown>,
        parallelNodeMetadata.warningRules,
      ).map((w) => w.id);

    it('parallel:branch-count-out-of-range — fires for branchCount=1', () => {
      expect(firedIds({ branchCount: 1 })).toContain(
        'parallel:branch-count-out-of-range',
      );
    });

    it('parallel:branch-count-out-of-range — fires for branchCount=17', () => {
      expect(firedIds({ branchCount: 17 })).toContain(
        'parallel:branch-count-out-of-range',
      );
    });

    it('parallel:branch-count-out-of-range — does NOT fire for in-range', () => {
      expect(firedIds({ branchCount: 4 })).not.toContain(
        'parallel:branch-count-out-of-range',
      );
    });
  });

  describe('validateParallelConfig (imperative)', () => {
    it('returns [] for a valid config', () => {
      expect(
        validateParallelConfig({
          branchCount: 4,
          maxConcurrency: 2,
          waitAll: true,
        }),
      ).toEqual([]);
    });

    it('rejects branchCount=2.5 (non-integer)', () => {
      expect(validateParallelConfig({ branchCount: 2.5 })).toContain(
        'branchCount must be an integer.',
      );
    });

    it('rejects branchCount=1 (out of range)', () => {
      expect(validateParallelConfig({ branchCount: 1 })).toContain(
        'branchCount must be a value between 2 and 16.',
      );
    });

    it('rejects maxConcurrency=-1', () => {
      expect(
        validateParallelConfig({ branchCount: 4, maxConcurrency: -1 }),
      ).toContain(
        'maxConcurrency must be a value between 0 and 16 (0 = unlimited).',
      );
    });

    it('rejects waitAll being a non-boolean', () => {
      expect(
        validateParallelConfig({ branchCount: 4, waitAll: 'yes' }),
      ).toContain('waitAll must be a boolean.');
    });
  });

  describe('evaluateMetadataBlockingErrors integration (parallel)', () => {
    it('returns [] for the schema default config', () => {
      expect(
        evaluateMetadataBlockingErrors(
          parallelNodeMetadata,
          parallelNodeConfigSchema.parse({}),
        ),
      ).toEqual([]);
    });

    it('surfaces both declarative and imperative messages for branchCount=1', () => {
      const errors = evaluateMetadataBlockingErrors(parallelNodeMetadata, {
        branchCount: 1,
      });
      expect(errors).toContain('branchCount must be 2 to 16.');
      expect(errors).toContain('branchCount must be a value between 2 and 16.');
    });
  });

  describe('handler.execute', () => {
    const handler = new ParallelHandler();
    const ctx = {
      executionId: 'exec-1',
      workflowId: 'wf-1',
      variables: {},
      nodeOutputCache: {},
      structuredOutputCache: {},
      engineResolvedConfigCache: {},
      conversationThread: createEmptyConversationThread(),
      recursionDepth: 0,
    };

    it('branchCount만큼 branch_N 포트를 모두 활성화 + output: null (Principle 9 컨테이너 컨트랙트)', async () => {
      const result = await handler.execute(
        { hello: 'world' },
        { branchCount: 3 },
        ctx,
      );
      // CONVENTIONS Principle 9: 컨테이너 핸들러는 시작 시점에 `output: null`
      // 을 반환하고, 엔진이 완료 시점에 `{ branches: [...] }` 로 오버라이트한다
      // (loop/foreach/map 과 동일 패턴).
      expect(result.output).toBeNull();
      expect(result.port).toEqual(['branch_0', 'branch_1', 'branch_2']);
    });

    it('config 에 maxConcurrency/waitAll 정규화 값을 포함', async () => {
      const result = await handler.execute(
        {},
        { branchCount: 4, maxConcurrency: 2, waitAll: true },
        ctx,
      );
      expect(result.config).toEqual({
        branchCount: 4,
        maxConcurrency: 2,
        waitAll: true,
      });
    });

    it('branchCount 누락 시 기본 2', async () => {
      const result = await handler.execute({ x: 1 }, {}, ctx);
      expect(result.port).toEqual(['branch_0', 'branch_1']);
    });

    it('16 초과 값은 16으로 클램프', async () => {
      const result = await handler.execute({}, { branchCount: 100 }, ctx);
      expect(Array.isArray(result.port) ? result.port.length : 0).toBe(16);
    });

    it('maxConcurrency 음수·초과 값은 raw 그대로 echo (clamping 은 engine 내부)', async () => {
      // CONVENTIONS Principle 7 — config echoes the raw user input. The 0..16
      // clamping policy is an engine-side branch-count concern; observable
      // clamping is via `result.port.length` (always 2..16) rather than the
      // echoed config field.
      const result = await handler.execute(
        {},
        { branchCount: 4, maxConcurrency: 100 },
        ctx,
      );
      expect(result.config.maxConcurrency).toBe(100);
      const result2 = await handler.execute(
        {},
        { branchCount: 4, maxConcurrency: -3 },
        ctx,
      );
      expect(result2.config.maxConcurrency).toBe(-3);
    });
  });
});

```

---

### 파일 6: backend/src/nodes/logic/switch/switch.schema.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/logic/switch/switch.schema.spec.ts b/backend/src/nodes/logic/switch/switch.schema.spec.ts
index 937906fa..e2490b4e 100644
--- a/backend/src/nodes/logic/switch/switch.schema.spec.ts
+++ b/backend/src/nodes/logic/switch/switch.schema.spec.ts
@@ -273,9 +273,7 @@ describe('Switch node schema', () => {
   describe('evaluateMetadataBlockingErrors integration (switch)', () => {
     it('emits both Korean warnings on a freshly-created node', () => {
       const errors = evaluateMetadataBlockingErrors(switchNodeMetadata, {});
-      expect(errors).toContain(
-        'In Value mode, Switch Value must be entered.',
-      );
+      expect(errors).toContain('In Value mode, Switch Value must be entered.');
       expect(errors).toContain('At least one case must be added.');
     });
 

```

#### 전체 파일 컨텍스트
```
import { evaluateWarnings } from '@workflow/node-summary';
import {
  caseDefSchema,
  switchNodeConfigSchema,
  switchNodeMetadata,
  switchNodeOutputSchema,
  switchNodePorts,
  validateSwitchConfig,
} from './switch.schema';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation';

describe('Switch node schema', () => {
  describe('caseDefSchema', () => {
    it('id 는 optional — 생략 가능 (resolver 가 case_${i} fallback)', () => {
      const parsed = caseDefSchema.parse({ label: 'A' });
      expect(parsed.id).toBeUndefined();
      expect(parsed.label).toBe('A');
    });

    it('id 는 slug 형식 (a-z A-Z 0-9 _ -) 만 허용', () => {
      expect(
        caseDefSchema.safeParse({ id: 'my_case-1', label: 'A' }).success,
      ).toBe(true);
      expect(caseDefSchema.safeParse({ id: 'case1', label: 'A' }).success).toBe(
        true,
      );
      expect(
        caseDefSchema.safeParse({ id: 'CASE_X', label: 'A' }).success,
      ).toBe(true);
    });

    it('id 에 공백·특수문자·엔티티가 포함되면 거부 (포트 라우팅 키 안전)', () => {
      expect(caseDefSchema.safeParse({ id: 'my case' }).success).toBe(false);
      expect(caseDefSchema.safeParse({ id: '<script>' }).success).toBe(false);
      expect(caseDefSchema.safeParse({ id: 'case.1' }).success).toBe(false);
      expect(caseDefSchema.safeParse({ id: 'case/1' }).success).toBe(false);
      expect(caseDefSchema.safeParse({ id: '한글' }).success).toBe(false);
    });

    it('id 길이 상한 64 — 65자 이상은 거부', () => {
      const ok = 'a'.repeat(64);
      const tooLong = 'a'.repeat(65);
      expect(caseDefSchema.safeParse({ id: ok }).success).toBe(true);
      expect(caseDefSchema.safeParse({ id: tooLong }).success).toBe(false);
    });

    it('label 기본값은 빈 문자열', () => {
      const parsed = caseDefSchema.parse({});
      expect(parsed.label).toBe('');
    });

    it('value 는 any 타입 허용 (mode=value 시 사용)', () => {
      expect(caseDefSchema.parse({ value: 42 }).value).toBe(42);
      expect(caseDefSchema.parse({ value: 'str' }).value).toBe('str');
      expect(caseDefSchema.parse({ value: null }).value).toBeNull();
    });

    // 스키마(optional) ↔ resolver(fallback 으로 채움) ↔ handler(validate 에서
    // runtime-required) 3 계층 불일치 고정. 스키마를 required 로 바꾸면 legacy
    // config 가 깨지므로 의도된 설계 — 변경 시 resolver 와 handler 가 모두
    // 영향 받으므로 함께 본다.
    it('id optional 은 의도적 — resolver 가 case_${i} fallback, handler.validate 는 runtime-required 체크', () => {
      // schema parse 는 통과, 실제 실행 단계에서 handler.validate 가 거부.
      expect(caseDefSchema.safeParse({ label: 'A' }).success).toBe(true);
    });
  });

  describe('switchNodeConfigSchema', () => {
    it('빈 config 는 기본값 세트로 채워짐', () => {
      const parsed = switchNodeConfigSchema.parse({});
      expect(parsed.mode).toBe('value');
      expect(parsed.switchValue).toBe('');
      expect(parsed.cases).toEqual([]);
      expect(parsed.hasDefault).toBe(false);
      expect(parsed.strictComparison).toBe(false);
    });

    it('mode 는 value / expression 만 허용', () => {
      expect(switchNodeConfigSchema.safeParse({ mode: 'value' }).success).toBe(
        true,
      );
      expect(
        switchNodeConfigSchema.safeParse({ mode: 'expression' }).success,
      ).toBe(true);
      expect(switchNodeConfigSchema.safeParse({ mode: 'regex' }).success).toBe(
        false,
      );
    });

    it('cases 배열에 유효한 case 를 전달하면 그대로 유지', () => {
      const parsed = switchNodeConfigSchema.parse({
        cases: [
          { id: 'yes', label: 'Yes', value: true },
          { id: 'no', label: 'No', value: false },
        ],
      });
      expect(parsed.cases).toHaveLength(2);
      expect(parsed.cases[0].id).toBe('yes');
    });

    it('cases 에 잘못된 id 가 있으면 전체 parse 실패', () => {
      const result = switchNodeConfigSchema.safeParse({
        cases: [{ id: 'has space' }],
      });
      expect(result.success).toBe(false);
    });

    it('passthrough: 알 수 없는 키는 통과', () => {
      const parsed = switchNodeConfigSchema.parse({
        mode: 'value',
        futureField: 'x',
      });
      expect((parsed as Record<string, unknown>).futureField).toBe('x');
    });
  });

  describe('switchNodeOutputSchema', () => {
    it('성공 shape 수용 (port=case id)', () => {
      const result = switchNodeOutputSchema.safeParse({
        config: { cases: [{ id: 'yes' }] },
        output: { value: 1 },
        meta: { matchedCase: 'yes' },
        port: 'yes',
      });
      expect(result.success).toBe(true);
    });

    it('default 분기 shape 수용 (port=default)', () => {
      const result = switchNodeOutputSchema.safeParse({
        meta: { matchedCase: 'default' },
        port: 'default',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('static metadata', () => {
    it('ports: inputs=[in], outputs=[default] — dynamic cases 는 resolver 가 합성', () => {
      expect(switchNodePorts.inputs).toEqual([
        { id: 'in', label: 'Input', type: 'data' },
      ]);
      expect(switchNodePorts.outputs).toEqual([
        { id: 'default', label: 'Default', type: 'data' },
      ]);
    });

    it('metadata: dynamicPorts.kind = switch-cases, isDynamicPorts = true', () => {
      expect(switchNodeMetadata.type).toBe('switch');
      expect(switchNodeMetadata.isDynamicPorts).toBe(true);
      expect(switchNodeMetadata.dynamicPorts).toEqual({ kind: 'switch-cases' });
    });
  });

  describe('warningRules', () => {
    const firedIds = (config: unknown) =>
      evaluateWarnings(
        config as Record<string, unknown>,
        switchNodeMetadata.warningRules,
      ).map((w) => w.id);

    describe('switch:value-mode-needs-switch-value', () => {
      it('fires for default mode (no mode set) when switchValue is missing', () => {
        expect(firedIds({ cases: [{ id: 'a' }] })).toContain(
          'switch:value-mode-needs-switch-value',
        );
      });

      it('fires for explicit mode=value when switchValue is missing', () => {
        expect(firedIds({ mode: 'value', cases: [{ id: 'a' }] })).toContain(
          'switch:value-mode-needs-switch-value',
        );
      });

      it('does NOT fire when mode=expression', () => {
        expect(
          firedIds({ mode: 'expression', cases: [{ id: 'a' }] }),
        ).not.toContain('switch:value-mode-needs-switch-value');
      });

      it('does NOT fire when switchValue is set', () => {
        expect(
          firedIds({
            mode: 'value',
            switchValue: '{{ $input.kind }}',
            cases: [{ id: 'a' }],
          }),
        ).not.toContain('switch:value-mode-needs-switch-value');
      });
    });

    describe('switch:no-cases', () => {
      it('fires when cases is empty', () => {
        expect(firedIds({ cases: [] })).toContain('switch:no-cases');
      });

      it('fires when cases is missing entirely', () => {
        expect(firedIds({})).toContain('switch:no-cases');
      });

      it('does NOT fire when at least one case is defined', () => {
        expect(firedIds({ cases: [{ id: 'a' }] })).not.toContain(
          'switch:no-cases',
        );
      });
    });
  });

  describe('validateSwitchConfig (imperative)', () => {
    it('returns [] for a valid value-mode config', () => {
      expect(
        validateSwitchConfig({
          mode: 'value',
          switchValue: 'x',
          cases: [{ id: 'yes', value: true }],
        }),
      ).toEqual([]);
    });

    it('rejects duplicate case ids', () => {
      const errors = validateSwitchConfig({
        cases: [{ id: 'dup' }, { id: 'dup' }],
      });
      expect(errors).toContain("cases[1].id 'dup' is duplicated");
    });

    it('rejects unknown valueType', () => {
      const errors = validateSwitchConfig({
        cases: [{ id: 'a', valueType: 'date' }],
      });
      expect(errors).toContain(
        'cases[0].valueType must be one of: string, number, boolean',
      );
    });

    it('expression mode requires per-case condition', () => {
      const errors = validateSwitchConfig({
        mode: 'expression',
        cases: [{ id: 'a' }],
      });
      expect(errors).toContain(
        'cases[0].condition is required when mode is "expression"',
      );
    });

    it.each(['default', 'out', 'error'])(
      'rejects reserved case id "%s" — would collide with engine port (D7)',
      (reserved) => {
        const errors = validateSwitchConfig({
          cases: [{ id: reserved }],
        });
        expect(errors).toContain(
          `cases[0].id '${reserved}' is a reserved port name (default / out / error)`,
        );
      },
    );

    it('does NOT reject reserved id substrings (e.g. "default_admin")', () => {
      // The reserved set is a strict whole-token match, not a substring
      // check — case ids that merely contain "default" / "out" / "error"
      // remain valid (e.g. user-defined `default_role`, `outbound`).
      expect(
        validateSwitchConfig({
          cases: [
            { id: 'default_admin' },
            { id: 'outbound' },
            { id: 'error_recovery' },
          ],
        }),
      ).toEqual([]);
    });
  });

  describe('evaluateMetadataBlockingErrors integration (switch)', () => {
    it('emits both Korean warnings on a freshly-created node', () => {
      const errors = evaluateMetadataBlockingErrors(switchNodeMetadata, {});
      expect(errors).toContain('In Value mode, Switch Value must be entered.');
      expect(errors).toContain('At least one case must be added.');
    });

    it('returns [] when fully configured (value mode)', () => {
      expect(
        evaluateMetadataBlockingErrors(switchNodeMetadata, {
          mode: 'value',
          switchValue: '{{ $input.kind }}',
          cases: [{ id: 'a', value: true }],
        }),
      ).toEqual([]);
    });
  });
});

```

---

### 파일 7: backend/src/nodes/logic/variable-declaration/variable-declaration.schema.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/logic/variable-declaration/variable-declaration.schema.ts b/backend/src/nodes/logic/variable-declaration/variable-declaration.schema.ts
index 69856703..6e0417e2 100644
--- a/backend/src/nodes/logic/variable-declaration/variable-declaration.schema.ts
+++ b/backend/src/nodes/logic/variable-declaration/variable-declaration.schema.ts
@@ -121,7 +121,7 @@ export const variableDeclarationNodeMetadata: NodeComponentMetadata = {
     {
       id: 'variable_declaration:first-variable-name-empty',
       when: 'length(variables) > 0 && !variables.0.name',
-      message: 'First variable\'s name must be entered.',
+      message: "First variable's name must be entered.",
     },
   ],
   validateConfig: validateVariableDeclarationConfig,

```

#### 전체 파일 컨텍스트
```
import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

export const varDefSchema = z
  .object({
    name: z
      .string()
      .default('')
      .meta({
        ui: {
          label: 'Name',
          widget: 'text',
          placeholder: 'variableName',
        },
      }),
    type: z
      .enum(['string', 'number', 'boolean', 'array', 'object'])
      .default('string')
      .meta({ ui: { label: 'Type', widget: 'select' } }),
    defaultValue: z
      .unknown()
      .optional()
      .meta({
        ui: { label: 'Default Value', widget: 'expression' },
      }),
  })
  .passthrough();

/**
 * Variable Declaration passes input through and only mutates the execution
 * variable pool (`context.variables.<name>`) — the declared variables are
 * surfaced to expressions via `$var.<name>`, NOT through this node's output.
 * Hence the `output` schema mirrors the passthrough input with `unknown`.
 */
export const variableDeclarationNodeOutputSchema = z
  .object({
    config: z
      .object({
        variables: z.array(varDefSchema).optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    output: z.unknown().optional(),
    port: z.string().optional(),
    status: z.string().optional(),
  })
  .passthrough();

export const variableDeclarationNodeConfigSchema = z
  .object({
    variables: z
      .array(varDefSchema)
      .default([])
      .meta({
        ui: {
          label: 'Variables',
          widget: 'field-array',
          itemLabel: 'Variable',
        },
      }),
  })
  .passthrough();
export type VariableDeclarationConfig = z.infer<
  typeof variableDeclarationNodeConfigSchema
>;

export const variableDeclarationNodePorts: NodePorts = {
  inputs: [{ id: 'in', label: 'Input', type: 'data' }],
  outputs: [{ id: 'out', label: 'Output', type: 'data' }],
};

/**
 * Imperative escape hatch — per-variable name/type validation needs array
 * iteration the mini-DSL can't express. Single-field "is variables empty?"
 * / "first variable.name set?" checks live in `warningRules` below.
 */
export function validateVariableDeclarationConfig(config: unknown): string[] {
  const c = (config ?? {}) as Record<string, unknown>;
  const errors: string[] = [];
  const variables = c.variables;

  if (Array.isArray(variables)) {
    for (let i = 0; i < variables.length; i++) {
      const v = (variables[i] ?? {}) as Record<string, unknown>;
      if (!v.name || typeof v.name !== 'string') {
        errors.push(`variables[${i}].name is required and must be a string`);
      }
      if (!v.type || typeof v.type !== 'string') {
        errors.push(`variables[${i}].type is required and must be a string`);
      }
    }
  }

  return errors;
}

export const variableDeclarationNodeMetadata: NodeComponentMetadata = {
  type: 'variable_declaration',
  category: 'logic',
  label: 'Variable',
  description: 'Declare variables',
  icon: 'Variable',
  color: '#3B82F6',
  executionMetadata: { kind: 'standard' },
  // SSOT for warnings (frontend canvas + backend handler.validate).
  // Mirror points:
  //  - frontend `variableDeclarationSummary` warning ("No variables defined" —
  //    fires when variables[] is empty OR no variable has a name set)
  //  - backend handler.validate's "variables non-empty" + per-variable
  //    name/type rules. Per-item iteration lives in `validateConfig`.
  warningRules: [
    {
      id: 'variable_declaration:no-variables',
      when: 'length(variables) == 0',
      message: 'At least one variable must be defined.',
    },
    {
      id: 'variable_declaration:first-variable-name-empty',
      when: 'length(variables) > 0 && !variables.0.name',
      message: "First variable's name must be entered.",
    },
  ],
  validateConfig: validateVariableDeclarationConfig,
};

```

---

### 파일 8: backend/src/nodes/logic/variable-modification/variable-modification.schema.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/logic/variable-modification/variable-modification.schema.ts b/backend/src/nodes/logic/variable-modification/variable-modification.schema.ts
index fce25ecc..4f406f4f 100644
--- a/backend/src/nodes/logic/variable-modification/variable-modification.schema.ts
+++ b/backend/src/nodes/logic/variable-modification/variable-modification.schema.ts
@@ -166,7 +166,7 @@ export const variableModificationNodeMetadata: NodeComponentMetadata = {
     {
       id: 'variable_modification:first-variable-empty',
       when: 'length(modifications) > 0 && !modifications.0.variable',
-      message: 'First modification\'s target variable must be selected.',
+      message: "First modification's target variable must be selected.",
     },
   ],
   validateConfig: validateVariableModificationConfig,

```

#### 전체 파일 컨텍스트
```
import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

export const modOperationSchema = z.enum([
  'set',
  'increment',
  'decrement',
  'append',
  'push',
  'pop',
]);

export const modDefSchema = z
  .object({
    variable: z
      .string()
      .default('')
      .meta({
        ui: {
          label: 'Variable',
          widget: 'text',
          placeholder: 'variableName',
        },
      }),
    operation: modOperationSchema.default('set').meta({
      ui: { label: 'Operation', widget: 'select' },
    }),
    value: z
      .unknown()
      .optional()
      .meta({
        ui: { label: 'Value', widget: 'expression' },
      }),
  })
  .passthrough();

/**
 * Variable Modification mutates `context.variables` in place and passes the
 * input through as output. Like Variable Declaration, modified variables
 * surface through `$var.<name>` — not the node's output envelope.
 */
export const variableModificationNodeOutputSchema = z
  .object({
    config: z
      .object({
        modifications: z.array(modDefSchema).optional(),
        recordValues: z.boolean().optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    output: z.unknown().optional(),
    port: z.string().optional(),
    status: z.string().optional(),
  })
  .passthrough();

export const variableModificationNodeConfigSchema = z
  .object({
    modifications: z
      .array(modDefSchema)
      .default([])
      .meta({
        ui: {
          label: 'Modifications',
          widget: 'field-array',
          itemLabel: 'Modification',
        },
      }),
    /**
     * When `true`, each `meta.modifications[i]` entry is augmented with
     * `before` / `after` snapshots of the variable value, with sensitive
     * keys masked via `maskValueForLog`. Default `false` because the
     * snapshots can be large for collection variables and may include user
     * data that should not surface in run logs by default.
     *
     * Spec: 4-nodes/1-logic/5-variable-modification.md §5.1.
     */
    recordValues: z
      .boolean()
      .default(false)
      .meta({
        ui: {
          label: 'Record values in meta',
          widget: 'checkbox',
          hint: 'Include before/after snapshots in meta.modifications (masked). Off by default.',
        },
      }),
  })
  .passthrough();
export type VariableModificationConfig = z.infer<
  typeof variableModificationNodeConfigSchema
>;

export const variableModificationNodePorts: NodePorts = {
  inputs: [{ id: 'in', label: 'Input', type: 'data' }],
  outputs: [{ id: 'out', label: 'Output', type: 'data' }],
};

/**
 * Imperative escape hatch — per-modification variable/operation validation
 * needs array iteration the mini-DSL can't express. Single-field "is
 * modifications empty?" / "first modification.variable set?" checks live in
 * `warningRules` below.
 */
export function validateVariableModificationConfig(config: unknown): string[] {
  // Mirror the handler's whitelist exactly. The schema enum
  // (`modOperationSchema`) and handler `applyModification` switch share
  // this same 6-operation set — keep all three in sync.
  const VALID_OPERATIONS = new Set([
    'set',
    'increment',
    'decrement',
    'append',
    'push',
    'pop',
  ]);
  const c = (config ?? {}) as Record<string, unknown>;
  const errors: string[] = [];
  const modifications = c.modifications;

  if (Array.isArray(modifications)) {
    for (let i = 0; i < modifications.length; i++) {
      const m = (modifications[i] ?? {}) as Record<string, unknown>;
      if (!m.variable || typeof m.variable !== 'string') {
        errors.push(
          `modifications[${i}].variable is required and must be a string`,
        );
      }
      if (!m.operation || !VALID_OPERATIONS.has(m.operation as string)) {
        errors.push(
          `modifications[${i}].operation must be one of: ${[...VALID_OPERATIONS].join(', ')}`,
        );
      }
    }
  }

  return errors;
}

export const variableModificationNodeMetadata: NodeComponentMetadata = {
  type: 'variable_modification',
  category: 'logic',
  label: 'Set Variable',
  description: 'Modify variables',
  icon: 'PenLine',
  color: '#3B82F6',
  executionMetadata: { kind: 'standard' },
  // SSOT for warnings (frontend canvas + backend handler.validate).
  // Mirror points:
  //  - frontend `variableModificationSummary` warning ("Variable not selected"
  //    — fires when modifications[] is empty OR first modification.variable
  //    is blank)
  //  - backend handler.validate's "modifications non-empty" + per-item
  //    variable/operation rules. Per-item iteration lives in
  //    `validateConfig`.
  warningRules: [
    {
      id: 'variable_modification:no-modifications',
      when: 'length(modifications) == 0',
      message: 'At least one modification must be added.',
    },
    {
      id: 'variable_modification:first-variable-empty',
      when: 'length(modifications) > 0 && !modifications.0.variable',
      message: "First modification's target variable must be selected.",
    },
  ],
  validateConfig: validateVariableModificationConfig,
};

```

---

### 파일 9: backend/src/nodes/presentation/carousel/carousel.schema.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/presentation/carousel/carousel.schema.spec.ts b/backend/src/nodes/presentation/carousel/carousel.schema.spec.ts
index e7862bf7..c87672ef 100644
--- a/backend/src/nodes/presentation/carousel/carousel.schema.spec.ts
+++ b/backend/src/nodes/presentation/carousel/carousel.schema.spec.ts
@@ -297,9 +297,7 @@ describe('evaluateMetadataBlockingErrors integration (carousel)', () => {
       buttons: [{ type: 'port', label: '' }],
     });
     // Declarative fires:
-    expect(errors).toContain(
-      'In Dynamic mode, a Title field must be entered.',
-    );
+    expect(errors).toContain('In Dynamic mode, a Title field must be entered.');
     // Imperative (validateButtons) fires:
     expect(errors).toEqual(
       expect.arrayContaining([

```

#### 전체 파일 컨텍스트
```
import { z } from 'zod';
import { evaluateWarnings } from '@workflow/node-summary';
import {
  carouselNodeConfigSchema,
  carouselNodeMetadata,
  validateCarouselConfig,
} from './carousel.schema';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation';

describe('carouselNodeConfigSchema', () => {
  it('applies defaults for empty input', () => {
    const result = carouselNodeConfigSchema.parse({});
    expect(result.mode).toBe('dynamic');
    expect(result.items).toEqual([]);
    expect(result.maxItems).toBe(10);
    expect(result.layout).toBe('card');
    expect(result.buttons).toEqual([]);
    expect(result.itemButtons).toEqual([]);
  });

  it('mode clearFields DOES NOT include user-authored content (`items`, `itemButtons`)', () => {
    // Regression: earlier iteration wiped `items` on mode switch, causing data
    // loss. This test guards against that behaviour re-appearing via schema
    // metadata.
    const jsonSchema = z.toJSONSchema(carouselNodeConfigSchema) as unknown as {
      properties?: Record<string, { ui?: { clearFields?: string[] } }>;
    };
    const clearFields = jsonSchema.properties?.mode?.ui?.clearFields ?? [];
    expect(clearFields).not.toContain('items');
    expect(clearFields).not.toContain('itemButtons');
  });

  it('marks static-only fields with visibleWhen=static', () => {
    const jsonSchema = z.toJSONSchema(carouselNodeConfigSchema) as unknown as {
      properties?: Record<string, { ui?: { visibleWhen?: unknown } }>;
    };
    expect(jsonSchema.properties?.items?.ui?.visibleWhen).toEqual({
      field: 'mode',
      equals: 'static',
    });
  });

  it('marks dynamic-only fields with visibleWhen=dynamic', () => {
    const jsonSchema = z.toJSONSchema(carouselNodeConfigSchema) as unknown as {
      properties?: Record<string, { ui?: { visibleWhen?: unknown } }>;
    };
    for (const key of [
      'source',
      'titleField',
      'descriptionField',
      'imageField',
      'maxItems',
      'itemButtons',
    ]) {
      expect(jsonSchema.properties?.[key]?.ui?.visibleWhen).toEqual({
        field: 'mode',
        equals: 'dynamic',
      });
    }
  });

  it('uses `button-list` widget for buttons', () => {
    const jsonSchema = z.toJSONSchema(carouselNodeConfigSchema) as unknown as {
      properties?: Record<string, { ui?: { widget?: string } }>;
    };
    expect(jsonSchema.properties?.buttons?.ui?.widget).toBe('button-list');
    expect(jsonSchema.properties?.itemButtons?.ui?.widget).toBe('button-list');
  });

  it('marks titleField / items with mode-scoped requiredWhen', () => {
    const jsonSchema = z.toJSONSchema(carouselNodeConfigSchema) as unknown as {
      properties?: Record<string, { ui?: { requiredWhen?: unknown } }>;
    };
    expect(jsonSchema.properties?.titleField?.ui?.requiredWhen).toEqual({
      field: 'mode',
      equals: 'dynamic',
    });
    expect(jsonSchema.properties?.items?.ui?.requiredWhen).toEqual({
      field: 'mode',
      equals: 'static',
    });
  });

  it('marks each static item title as required for UI cues', () => {
    const jsonSchema = z.toJSONSchema(carouselNodeConfigSchema) as unknown as {
      properties?: {
        items?: {
          items?: {
            properties?: Record<string, { ui?: { required?: boolean } }>;
          };
        };
      };
    };
    const titleUi = jsonSchema.properties?.items?.items?.properties?.title?.ui;
    expect(titleUi?.required).toBe(true);
  });
});

describe('carouselNodeMetadata.warningRules', () => {
  // Helper: just the ids that fired, in declaration order.
  const firedIds = (config: unknown) =>
    evaluateWarnings(
      config as Record<string, unknown>,
      carouselNodeMetadata.warningRules,
    ).map((w) => w.id);

  describe('carousel:dynamic-mode-needs-title-field', () => {
    it('fires when dynamic mode and titleField missing', () => {
      expect(firedIds({ mode: 'dynamic' })).toContain(
        'carousel:dynamic-mode-needs-title-field',
      );
    });

    it('does NOT fire when dynamic mode and titleField set', () => {
      expect(firedIds({ mode: 'dynamic', titleField: 'name' })).not.toContain(
        'carousel:dynamic-mode-needs-title-field',
      );
    });

    it('does NOT fire in static mode even without titleField', () => {
      expect(
        firedIds({ mode: 'static', items: [{ title: 'x' }] }),
      ).not.toContain('carousel:dynamic-mode-needs-title-field');
    });
  });

  describe('carousel:static-mode-needs-items', () => {
    it('fires when static mode and items empty', () => {
      expect(firedIds({ mode: 'static', items: [] })).toContain(
        'carousel:static-mode-needs-items',
      );
    });

    it('fires when static mode and items missing entirely', () => {
      expect(firedIds({ mode: 'static' })).toContain(
        'carousel:static-mode-needs-items',
      );
    });

    it('does NOT fire when static mode has at least one item', () => {
      expect(
        firedIds({ mode: 'static', items: [{ title: 'a' }] }),
      ).not.toContain('carousel:static-mode-needs-items');
    });

    it('does NOT fire in dynamic mode even with items empty', () => {
      expect(
        firedIds({ mode: 'dynamic', titleField: 'name', items: [] }),
      ).not.toContain('carousel:static-mode-needs-items');
    });
  });

  describe('carousel:invalid-mode', () => {
    it('fires when mode is something other than static / dynamic', () => {
      expect(firedIds({ mode: 'unknown', titleField: 'x' })).toContain(
        'carousel:invalid-mode',
      );
    });

    it('does NOT fire for valid modes', () => {
      expect(
        firedIds({ mode: 'static', items: [{ title: 'a' }] }),
      ).not.toContain('carousel:invalid-mode');
      expect(firedIds({ mode: 'dynamic', titleField: 'name' })).not.toContain(
        'carousel:invalid-mode',
      );
    });
  });
});

describe('validateCarouselConfig (imperative)', () => {
  it('returns [] for a fully-configured static carousel', () => {
    expect(
      validateCarouselConfig({
        mode: 'static',
        items: [{ title: 'Slide 1', buttons: [] }],
      }),
    ).toEqual([]);
  });

  it('flags missing item.title in static mode for each row', () => {
    const errors = validateCarouselConfig({
      mode: 'static',
      items: [{ title: '' }, { title: 'ok' }, { title: 42 }],
    });
    expect(errors).toEqual(
      expect.arrayContaining([
        'items[0].title is required and must be a string',
        'items[2].title is required and must be a string',
      ]),
    );
    expect(errors).not.toContain(
      'items[1].title is required and must be a string',
    );
  });

  it('caps per-item buttons at 4 in static mode', () => {
    const tooMany = Array.from({ length: 5 }, (_, i) => ({
      id: `b${i}`,
      label: `B${i}`,
      type: 'port',
    }));
    const errors = validateCarouselConfig({
      mode: 'static',
      items: [{ title: 'Slide', buttons: tooMany }],
    });
    expect(errors).toContain('items[0]: maximum 4 buttons per item');
  });

  it('rejects reserved separator "__item_" in per-item button id', () => {
    const errors = validateCarouselConfig({
      mode: 'static',
      items: [
        {
          title: 'Slide',
          buttons: [{ id: 'b__item_0', label: 'X', type: 'port' }],
        },
      ],
    });
    expect(errors).toContain(
      'items[0].buttons[0].id must not contain reserved separator "__item_"',
    );
  });

  it('rejects duplicate per-item button ids', () => {
    const errors = validateCarouselConfig({
      mode: 'static',
      items: [
        {
          title: 'Slide',
          buttons: [
            { id: 'go', label: 'Go', type: 'port' },
            { id: 'go', label: 'Again', type: 'port' },
          ],
        },
      ],
    });
    expect(errors).toContain(
      'items[0].buttons[1].id must be unique (duplicate: go)',
    );
  });

  it('flags itemButtons rules in dynamic mode', () => {
    const errors = validateCarouselConfig({
      mode: 'dynamic',
      titleField: 'name',
      itemButtons: [{ id: 'a', type: 'link' }], // missing label, missing url
    });
    expect(errors).toEqual(
      expect.arrayContaining([
        'itemButtons.buttons[0].label is required',
        'itemButtons.buttons[0].url is required for link type buttons',
      ]),
    );
  });

  it('blocks disallowed URL schemes on link buttons', () => {
    const errors = validateCarouselConfig({
      mode: 'dynamic',
      titleField: 'name',
      itemButtons: [
        {
          id: 'evil',
          label: 'X',
          type: 'link',
          url: 'javascript:alert(1)',
        },
      ],
    });
    expect(errors).toContain(
      'itemButtons.buttons[0].url contains a disallowed URL scheme',
    );
  });

  it('forwards global buttons errors via shared validateButtons', () => {
    const errors = validateCarouselConfig({
      mode: 'dynamic',
      titleField: 'name',
      buttons: [{ id: '', type: 'port', label: '' }],
    });
    expect(errors).toEqual(
      expect.arrayContaining([
        'buttons[0].id is required',
        'buttons[0].label is required and must be a string',
      ]),
    );
  });
});

describe('evaluateMetadataBlockingErrors integration (carousel)', () => {
  it('merges declarative + imperative errors as a single flat blocking list', () => {
    // Empty config → dynamic-mode rule fires (declarative) AND
    // validateButtons returns nothing (no buttons configured). Adding a
    // bad button forces an imperative entry too.
    const errors = evaluateMetadataBlockingErrors(carouselNodeMetadata, {
      mode: 'dynamic',
      buttons: [{ type: 'port', label: '' }],
    });
    // Declarative fires:
    expect(errors).toContain('In Dynamic mode, a Title field must be entered.');
    // Imperative (validateButtons) fires:
    expect(errors).toEqual(
      expect.arrayContaining([
        'buttons[0].id is required',
        'buttons[0].label is required and must be a string',
      ]),
    );
  });
});

```
