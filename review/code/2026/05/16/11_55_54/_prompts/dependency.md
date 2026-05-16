# 의존성(Dependency) Review Payload

본 파일은 orchestrator 가 의존성(Dependency) reviewer 용으로 작성한 입력입니다. 다음 코드 변경을 의존성 관점에서 분석한다.
sub-agent 의 system prompt 에 정의된 호출 규약·등급 기준·출력 형식을 그대로
따르되, 분석 시 아래 "점검 관점" 을 빠짐없이 적용하세요. 결과는 `output_file`
인자에 review.md 로 Write 하고 호출자에게는 STATUS 한 줄만 반환합니다.

## 점검 관점 (의존성(Dependency))

1. **새 의존성**: 새 외부 패키지/라이브러리 추가 여부와 필요성
2. **버전 고정**: 의존성 버전 고정(pinning) 여부
3. **라이선스**: 새 의존성의 라이선스가 프로젝트와 호환되는지
4. **취약점**: 알려진 보안 취약점이 있는 의존성 사용 여부
5. **불필요한 의존성**: 표준 라이브러리·기존 의존성으로 대체 가능한지
6. **의존성 크기**: 번들 크기·빌드 시간 영향
7. **호환성**: 기존 의존성과의 버전 충돌·호환성
8. **내부 의존성**: 프로젝트 내부 모듈 간 의존 관계

## 리뷰 대상 파일

### 파일 1: backend/migrations/V050__integration_cafe24_connected_rotated_idx.conf
- 변경 유형: Review
- 언어: conf

#### 변경된 코드
```
diff --git a/backend/migrations/V050__integration_cafe24_connected_rotated_idx.conf b/backend/migrations/V050__integration_cafe24_connected_rotated_idx.conf
index 73bd53a1..d526d979 100644
--- a/backend/migrations/V050__integration_cafe24_connected_rotated_idx.conf
+++ b/backend/migrations/V050__integration_cafe24_connected_rotated_idx.conf
@@ -1 +1,7 @@
+# PostgreSQL 의 `CREATE INDEX CONCURRENTLY` 는 단일 트랜잭션 안에서 실행할 수
+# 없다 (`ERROR: CREATE INDEX CONCURRENTLY cannot run inside a transaction
+# block`). Flyway 는 기본적으로 한 마이그레이션 SQL 전체를 하나의 트랜잭션으로
+# 감싸므로, 본 옵션으로 그 감싸기를 끄고 PostgreSQL 이 인덱스 빌드 전용 내부
+# 트랜잭션을 직접 관리하게 한다. CONCURRENTLY 자체는 운영 테이블에 대한 쓰기
+# 잠금 시간을 최소화하기 위한 선택이다 (`V050__*.sql` 본문 주석 참조).
 executeInTransaction=false

```

#### 전체 파일 컨텍스트
```
# PostgreSQL 의 `CREATE INDEX CONCURRENTLY` 는 단일 트랜잭션 안에서 실행할 수
# 없다 (`ERROR: CREATE INDEX CONCURRENTLY cannot run inside a transaction
# block`). Flyway 는 기본적으로 한 마이그레이션 SQL 전체를 하나의 트랜잭션으로
# 감싸므로, 본 옵션으로 그 감싸기를 끄고 PostgreSQL 이 인덱스 빌드 전용 내부
# 트랜잭션을 직접 관리하게 한다. CONCURRENTLY 자체는 운영 테이블에 대한 쓰기
# 잠금 시간을 최소화하기 위한 선택이다 (`V050__*.sql` 본문 주석 참조).
executeInTransaction=false

```

---

### 파일 2: backend/src/common/swagger/api-wrapped.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/common/swagger/api-wrapped.ts b/backend/src/common/swagger/api-wrapped.ts
index 1c76b257..106595af 100644
--- a/backend/src/common/swagger/api-wrapped.ts
+++ b/backend/src/common/swagger/api-wrapped.ts
@@ -25,6 +25,27 @@ export function wrapDataSchema<T>(dto: ClassRef<T>): SchemaObject {
   };
 }
 
+/**
+ * `{ data: { oneOf: [<ref(A)>, <ref(B)>, ...] } }` 스키마 객체를 생성합니다.
+ * 응답이 분기에 따라 서로 다른 DTO shape 을 반환하는 경우 사용합니다 (예:
+ * `OAuthBeginPopupResultDto` vs `OAuthBeginCafe24PendingResultDto`).
+ * 각 DTO 가 `discriminator` 역할의 필드(예: `mode`)를 자체적으로 강제하므로
+ * Swagger 콘솔에서 분기별 example 이 따로 노출됩니다.
+ */
+export function wrapOneOfDataSchema(
+  dtos: ReadonlyArray<ClassRef<unknown>>,
+): SchemaObject {
+  return {
+    type: 'object',
+    required: ['data'],
+    properties: {
+      data: {
+        oneOf: dtos.map((d) => ({ $ref: getSchemaPath(d) })),
+      },
+    },
+  };
+}
+
 /**
  * `{ data: <ref>[] }` 스키마 객체를 생성합니다. 단순 배열 응답용.
  */
@@ -90,6 +111,20 @@ export function ApiOkWrappedResponse<T>(
   );
 }
 
+/**
+ * `@ApiOkResponse` + `@ApiExtraModels(...dtos)` + `{ data: { oneOf } }` 래퍼.
+ * 분기 응답(예: OAuth begin 의 popup vs cafe24_private_pending) 문서화용.
+ */
+export function ApiOkWrappedOneOfResponse(
+  dtos: ReadonlyArray<ClassRef<unknown>>,
+  options: ExtraOptions = {},
+) {
+  return applyDecorators(
+    ApiExtraModels(...dtos),
+    ApiOkResponse({ ...options, schema: wrapOneOfDataSchema(dtos) }),
+  );
+}
+
 /**
  * 생성 성공 응답 (`201 Created`) + `{ data: <ref> }` 래퍼.
  */

```

#### 전체 파일 컨텍스트
```
import { applyDecorators, Type } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiResponseOptions,
  ApiCreatedResponse,
  ApiAcceptedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

type ClassRef<T> = Type<T>;

/**
 * `{ data: <ref> }` 스키마 객체를 생성합니다.
 * `@ApiOkResponse({ schema: wrapDataSchema(Dto) })` 형태로 사용합니다.
 */
export function wrapDataSchema<T>(dto: ClassRef<T>): SchemaObject {
  return {
    type: 'object',
    required: ['data'],
    properties: {
      data: { $ref: getSchemaPath(dto) },
    },
  };
}

/**
 * `{ data: { oneOf: [<ref(A)>, <ref(B)>, ...] } }` 스키마 객체를 생성합니다.
 * 응답이 분기에 따라 서로 다른 DTO shape 을 반환하는 경우 사용합니다 (예:
 * `OAuthBeginPopupResultDto` vs `OAuthBeginCafe24PendingResultDto`).
 * 각 DTO 가 `discriminator` 역할의 필드(예: `mode`)를 자체적으로 강제하므로
 * Swagger 콘솔에서 분기별 example 이 따로 노출됩니다.
 */
export function wrapOneOfDataSchema(
  dtos: ReadonlyArray<ClassRef<unknown>>,
): SchemaObject {
  return {
    type: 'object',
    required: ['data'],
    properties: {
      data: {
        oneOf: dtos.map((d) => ({ $ref: getSchemaPath(d) })),
      },
    },
  };
}

/**
 * `{ data: <ref>[] }` 스키마 객체를 생성합니다. 단순 배열 응답용.
 */
export function wrapItemsSchema<T>(dto: ClassRef<T>): SchemaObject {
  return {
    type: 'object',
    required: ['data'],
    properties: {
      data: {
        type: 'array',
        items: { $ref: getSchemaPath(dto) },
      },
    },
  };
}

/**
 * `{ data: { data: <ref>[], pagination: { page, limit, totalItems, totalPages } } }`
 * 본 프로젝트의 모든 페이지네이션 응답은 공용 `PaginatedResponseDto.create()` 를 거치므로
 * 이 형태를 따릅니다.
 */
export function wrapPaginatedSchema<T>(dto: ClassRef<T>): SchemaObject {
  return {
    type: 'object',
    required: ['data'],
    properties: {
      data: {
        type: 'object',
        required: ['data', 'pagination'],
        properties: {
          data: {
            type: 'array',
            items: { $ref: getSchemaPath(dto) },
          },
          pagination: {
            type: 'object',
            required: ['page', 'limit', 'totalItems', 'totalPages'],
            properties: {
              page: { type: 'integer', example: 1 },
              limit: { type: 'integer', example: 20 },
              totalItems: { type: 'integer', example: 123 },
              totalPages: { type: 'integer', example: 7 },
            },
          },
        },
      },
    },
  };
}

type ExtraOptions = Omit<ApiResponseOptions, 'schema' | 'type'>;

/**
 * `@ApiOkResponse` + `@ApiExtraModels` + `{ data: <ref> }` 래퍼를 일괄 적용합니다.
 */
export function ApiOkWrappedResponse<T>(
  dto: ClassRef<T>,
  options: ExtraOptions = {},
) {
  return applyDecorators(
    ApiExtraModels(dto),
    ApiOkResponse({ ...options, schema: wrapDataSchema(dto) }),
  );
}

/**
 * `@ApiOkResponse` + `@ApiExtraModels(...dtos)` + `{ data: { oneOf } }` 래퍼.
 * 분기 응답(예: OAuth begin 의 popup vs cafe24_private_pending) 문서화용.
 */
export function ApiOkWrappedOneOfResponse(
  dtos: ReadonlyArray<ClassRef<unknown>>,
  options: ExtraOptions = {},
) {
  return applyDecorators(
    ApiExtraModels(...dtos),
    ApiOkResponse({ ...options, schema: wrapOneOfDataSchema(dtos) }),
  );
}

/**
 * 생성 성공 응답 (`201 Created`) + `{ data: <ref> }` 래퍼.
 */
export function ApiCreatedWrappedResponse<T>(
  dto: ClassRef<T>,
  options: ExtraOptions = {},
) {
  return applyDecorators(
    ApiExtraModels(dto),
    ApiCreatedResponse({ ...options, schema: wrapDataSchema(dto) }),
  );
}

/**
 * 비동기 요청 접수 (`202 Accepted`) + `{ data: <ref> }` 래퍼.
 */
export function ApiAcceptedWrappedResponse<T>(
  dto: ClassRef<T>,
  options: ExtraOptions = {},
) {
  return applyDecorators(
    ApiExtraModels(dto),
    ApiAcceptedResponse({ ...options, schema: wrapDataSchema(dto) }),
  );
}

/**
 * 배열 응답 (`200 OK`) + `{ data: <ref>[] }` 래퍼.
 */
export function ApiOkWrappedArrayResponse<T>(
  dto: ClassRef<T>,
  options: ExtraOptions = {},
) {
  return applyDecorators(
    ApiExtraModels(dto),
    ApiOkResponse({ ...options, schema: wrapItemsSchema(dto) }),
  );
}

/**
 * 공용 `PaginatedResponseDto` 형태의 페이지네이션 응답 래퍼.
 * `{ data: { data: <ref>[], pagination: { page, limit, totalItems, totalPages } } }` 구조를 문서화합니다.
 */
export function ApiOkPaginatedResponse<T>(
  dto: ClassRef<T>,
  options: ExtraOptions = {},
) {
  return applyDecorators(
    ApiExtraModels(dto),
    ApiOkResponse({ ...options, schema: wrapPaginatedSchema(dto) }),
  );
}

```

---

### 파일 3: backend/src/migrations.spec.ts
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

### 파일 4: backend/src/modules/integrations/dto/responses/integration-response.dto.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/modules/integrations/dto/responses/integration-response.dto.ts b/backend/src/modules/integrations/dto/responses/integration-response.dto.ts
index b4b58159..72d48c49 100644
--- a/backend/src/modules/integrations/dto/responses/integration-response.dto.ts
+++ b/backend/src/modules/integrations/dto/responses/integration-response.dto.ts
@@ -172,57 +172,60 @@ export class PreviewTestResultDto {
 }
 
 /**
- * OAuth 시작 결과 — 두 가지 형태 중 하나.
+ * OAuth 시작 결과 — 두 가지 분기.
  *
- * 1. 일반 흐름 (google/github/cafe24 Public): `{ authUrl, state }` — 사용자
- *    브라우저를 authorize URL 로 보낸다.
- * 2. Cafe24 Private 흐름 (`mode === 'cafe24_private_pending'`): `{ mode,
- *    integrationId, appUrl, callbackUrl, scopesAdded? }` — Cafe24 가
- *    OAuth flow 를 시작하므로 우리는 사용자에게 등록할 URL 만 반환.
+ * 1. 일반 흐름 (google/github/cafe24 Public): `OAuthBeginPopupResultDto`
+ *    = `{ authUrl, state }`. 사용자 브라우저를 authorize URL 로 보낸다.
+ * 2. Cafe24 Private 흐름: `OAuthBeginCafe24PendingResultDto`
+ *    = `{ mode: 'cafe24_private_pending', integrationId, appUrl,
+ *    callbackUrl, scopesAdded? }`. Cafe24 가 OAuth flow 를 시작하므로
+ *    우리는 사용자에게 등록할 URL 만 반환.
  *
- * API H-2 (2026-05-16): Swagger 가 두 분기를 명시적으로 보여주도록 모든
- * 분기 필드를 optional 로 선언하고 description 에 분기 조건을 명시.
- * spec/2-navigation/4-integration.md §9.2.
+ * Swagger 표현 — 두 분기를 명시적으로 보여주기 위해 controller 가
+ * `ApiOkWrappedOneOfResponse([Popup, Cafe24Pending], ...)` 를 사용해
+ * `data: oneOf` 스키마로 문서화한다. spec/2-navigation/4-integration.md
+ * §9.2.
  */
-export class OAuthBeginResultDto {
-  /** 분기 식별자. 미존재 또는 'google'/'github'/'cafe24' 면 일반 흐름. */
+export class OAuthBeginPopupResultDto {
+  /** OAuth provider 인증 URL. 사용자 브라우저를 이 URL 로 redirect. */
+  @ApiProperty({ description: 'OAuth provider 인증 URL' })
+  authUrl!: string;
+
+  /** CSRF 방지용 state 토큰. */
+  @ApiProperty({ description: 'CSRF 방지용 state 토큰' })
+  state!: string;
+}
+
+export class OAuthBeginCafe24PendingResultDto {
+  /** 분기 식별자 — Cafe24 Private 앱 install 흐름. */
   @ApiProperty({
-    required: false,
     enum: ['cafe24_private_pending'],
     description:
-      "Cafe24 Private 앱일 때 'cafe24_private_pending'. 그 외 분기에서는 미존재 (authorizeUrl + state 반환).",
+      'Cafe24 Private 앱 install 흐름. 일반 흐름에서는 본 DTO 가 아닌 OAuthBeginPopupResultDto 가 반환된다.',
   })
-  mode?: 'cafe24_private_pending';
+  mode!: 'cafe24_private_pending';
 
-  /** OAuth provider 인증 URL. Cafe24 Private 분기에서는 미존재. */
-  @ApiProperty({ required: false })
-  authorizeUrl?: string;
-
-  /** CSRF 방지용 state 토큰. Cafe24 Private 분기에서는 미존재. */
-  @ApiProperty({ required: false })
-  state?: string;
-
-  /** Cafe24 Private 분기 — 새로 생성된 pending_install integration ID. */
-  @ApiProperty({ required: false, format: 'uuid' })
-  integrationId?: string;
+  /** 새로 생성된 pending_install integration ID. */
+  @ApiProperty({ format: 'uuid' })
+  integrationId!: string;
 
   /**
-   * Cafe24 Private 분기 — 사용자가 Cafe24 Developers 의 "App URL" 에
-   * 등록할 URL. Cafe24 "테스트 실행" 이 이 URL 을 호출.
+   * 사용자가 Cafe24 Developers 의 "App URL" 에 등록할 URL.
+   * Cafe24 "테스트 실행" 이 이 URL 을 호출.
    */
-  @ApiProperty({ required: false })
-  appUrl?: string;
+  @ApiProperty({ description: 'Cafe24 Developers "App URL" 등록용 URL' })
+  appUrl!: string;
 
   /**
-   * Cafe24 Private 분기 — 사용자가 Cafe24 Developers 의 "Redirect URI" 에
-   * 등록할 URL. OAuth authorize 후 Cafe24 가 이 URL 로 redirect.
+   * 사용자가 Cafe24 Developers 의 "Redirect URI" 에 등록할 URL.
+   * OAuth authorize 후 Cafe24 가 이 URL 로 redirect.
    */
-  @ApiProperty({ required: false })
-  callbackUrl?: string;
+  @ApiProperty({ description: 'Cafe24 Developers Redirect URI 등록용 URL' })
+  callbackUrl!: string;
 
   /**
    * request-scopes 진입점에서 scopes 가 변경된 경우의 추가 분량.
-   * Cafe24 Private + request_scopes mode 에서만 채워진다.
+   * `request_scopes` mode 에서만 채워진다.
    */
   @ApiProperty({ required: false, type: [String] })
   scopesAdded?: string[];

```

---

### 파일 5: backend/src/modules/integrations/integration-expiry-scanner.service.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/modules/integrations/integration-expiry-scanner.service.spec.ts b/backend/src/modules/integrations/integration-expiry-scanner.service.spec.ts
index 643553e5..62b86e22 100644
--- a/backend/src/modules/integrations/integration-expiry-scanner.service.spec.ts
+++ b/backend/src/modules/integrations/integration-expiry-scanner.service.spec.ts
@@ -218,6 +218,25 @@ describe('IntegrationExpiryScannerService.run', () => {
     const count = await scanner.run(new Date('2026-04-12T00:00:00Z'));
     expect(count).toBe(0);
   });
+
+  // REQ-C1 — spec §11.1 + §2.4: pending_install 은 만료 알림 대상에서 명시
+  // 제외. find()의 where 절 status filter 가 `Not(In([..., 'pending_install']))`
+  // 을 포함하는지 확인 (TypeORM operator 내부 `_value` 직접 검사).
+  it('excludes pending_install from the run() candidate query (REQ-C1)', async () => {
+    integrationRepo.find.mockResolvedValue([]);
+    await scanner.run(new Date('2026-04-12T00:00:00Z'));
+    expect(integrationRepo.find).toHaveBeenCalledTimes(1);
+    const whereArg = (
+      integrationRepo.find.mock.calls[0][0] as {
+        where: Record<string, unknown>;
+      }
+    ).where;
+    const statusOp = whereArg.status as { _value: { _value: string[] } };
+    // Not(In([...])) → outer _value 는 In operator, In 의 _value 는 배열
+    expect(statusOp._value._value).toEqual(
+      expect.arrayContaining(['expired', 'error', 'pending_install']),
+    );
+  });
 });
 
 describe('IntegrationExpiryScannerService.expirePendingInstalls', () => {

```

---

### 파일 6: backend/src/modules/integrations/integration-oauth.service.cafe24.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/modules/integrations/integration-oauth.service.cafe24.spec.ts b/backend/src/modules/integrations/integration-oauth.service.cafe24.spec.ts
index c1884dd8..902db733 100644
--- a/backend/src/modules/integrations/integration-oauth.service.cafe24.spec.ts
+++ b/backend/src/modules/integrations/integration-oauth.service.cafe24.spec.ts
@@ -215,6 +215,15 @@ describe('IntegrationOAuthService — Cafe24', () => {
         mall_id: 'myshop',
         app_type: 'public',
       });
+      // DTO branch invariants (spec §9.2): Cafe24 Public 분기는 popup 흐름
+      // 이므로 Private 전용 필드(integrationId / appUrl / callbackUrl / mode)
+      // 는 응답에 포함되지 않아야 한다. DTO 가 required→optional 로 완화된
+      // 상태에서 호출부가 분기를 잘못 식별하지 않도록 명시 단언.
+      const publicResp = result as Record<string, unknown>;
+      expect(publicResp.mode).toBeUndefined();
+      expect(publicResp.integrationId).toBeUndefined();
+      expect(publicResp.appUrl).toBeUndefined();
+      expect(publicResp.callbackUrl).toBeUndefined();
     });
 
     it('private app — creates pending_install integration and returns pending result', async () => {
@@ -266,8 +275,11 @@ describe('IntegrationOAuthService — Cafe24', () => {
 
       // No state row yet (state is created later in handleInstall).
       expect(stateRepo.save).not.toHaveBeenCalled();
-      // No authUrl — the browser never opens a popup for private apps.
-      expect((result as Record<string, unknown>).authUrl).toBeUndefined();
+      // DTO branch invariants (spec §9.2): Private 분기는 popup 흐름이 아니므로
+      // Public 전용 필드(authUrl / state) 가 응답에 포함되지 않아야 한다.
+      const privateResp = result as Record<string, unknown>;
+      expect(privateResp.authUrl).toBeUndefined();
+      expect(privateResp.state).toBeUndefined();
     });
   });
 

```

---

### 파일 7: backend/src/modules/integrations/integration-oauth.service.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/modules/integrations/integration-oauth.service.ts b/backend/src/modules/integrations/integration-oauth.service.ts
index 8c296d93..0d2b30de 100644
--- a/backend/src/modules/integrations/integration-oauth.service.ts
+++ b/backend/src/modules/integrations/integration-oauth.service.ts
@@ -1356,7 +1356,11 @@ export class IntegrationOAuthService {
     urlToken: string;
     query: Cafe24InstallQuery;
   }): Promise<Integration | null> {
-    const { urlToken, query } = params;
+    // `urlToken` is kept on the params type for caller-side documentation
+    // (it identifies which install_token triggered recovery) but the recovery
+    // itself only depends on `mall_id` — HMAC re-verification re-derives the
+    // token via the candidate row's client_secret.
+    const { query } = params;
     if (!query.mall_id) return null;
 
     // SEC H-2 (2026-05-16) — 옛 동작은 mall_id 매칭되는 모든 workspace 의 row
@@ -1598,16 +1602,18 @@ function buildHmacMessage(rawQuery: string): string {
  * 수 있다.
  */
 function formUrlEncode(value: string): string {
-  return encodeURIComponent(value)
-    .replace(/%20/g, '+')
-    // encodeURIComponent 는 `!`, `'`, `(`, `)`, `*` 를 인코딩하지 않으나
-    // Java URLEncoder 는 `*` 만 그대로 두고 나머지는 인코딩한다. Cafe24
-    // 메시지가 이런 문자를 포함할 가능성은 극히 낮지만 호환을 위해 명시.
-    .replace(/!/g, '%21')
-    .replace(/'/g, '%27')
-    .replace(/\(/g, '%28')
-    .replace(/\)/g, '%29')
-    .replace(/~/g, '%7E');
+  return (
+    encodeURIComponent(value)
+      .replace(/%20/g, '+')
+      // encodeURIComponent 는 `!`, `'`, `(`, `)`, `*` 를 인코딩하지 않으나
+      // Java URLEncoder 는 `*` 만 그대로 두고 나머지는 인코딩한다. Cafe24
+      // 메시지가 이런 문자를 포함할 가능성은 극히 낮지만 호환을 위해 명시.
+      .replace(/!/g, '%21')
+      .replace(/'/g, '%27')
+      .replace(/\(/g, '%28')
+      .replace(/\)/g, '%29')
+      .replace(/~/g, '%7E')
+  );
 }
 
 function verifyHmacWithMessage(

```

---

### 파일 8: backend/src/modules/integrations/integrations.controller.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/modules/integrations/integrations.controller.ts b/backend/src/modules/integrations/integrations.controller.ts
index bf9fbf65..bbe6b5f1 100644
--- a/backend/src/modules/integrations/integrations.controller.ts
+++ b/backend/src/modules/integrations/integrations.controller.ts
@@ -30,13 +30,15 @@ import {
 import {
   ApiCreatedWrappedResponse,
   ApiOkPaginatedResponse,
+  ApiOkWrappedOneOfResponse,
   ApiOkWrappedResponse,
 } from '../../common/swagger';
 import {
   IntegrationActivityDto,
   IntegrationDto,
   IntegrationUsagesDto,
-  OAuthBeginResultDto,
+  OAuthBeginCafe24PendingResultDto,
+  OAuthBeginPopupResultDto,
   PreviewTestResultDto,
   ServiceCatalogDto,
   TestConnectionResultDto,
@@ -138,9 +140,13 @@ export class IntegrationsController {
     description:
       'OAuth 흐름을 시작해 인증 URL과 state 토큰을 반환합니다. new/reauthorize/request_scopes 모드를 지원합니다.',
   })
-  @ApiOkWrappedResponse(OAuthBeginResultDto, {
-    description: '인증 URL 및 state 토큰',
-  })
+  @ApiOkWrappedOneOfResponse(
+    [OAuthBeginPopupResultDto, OAuthBeginCafe24PendingResultDto],
+    {
+      description:
+        '일반 흐름은 { authUrl, state }, Cafe24 Private 흐름은 { mode, integrationId, appUrl, callbackUrl, scopesAdded? }.',
+    },
+  )
   @ApiBadRequestResponse({ description: '입력값 검증 실패 또는 미지원 서비스' })
   @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
   @ApiConflictResponse({
@@ -359,9 +365,13 @@ export class IntegrationsController {
       '만료되었거나 오류 상태인 OAuth 통합에 대해 재인증 플로우를 트리거합니다.',
   })
   @ApiParam({ name: 'id', description: '통합 UUID', format: 'uuid' })
-  @ApiOkWrappedResponse(OAuthBeginResultDto, {
-    description: '재인증 URL 및 state 토큰',
-  })
+  @ApiOkWrappedOneOfResponse(
+    [OAuthBeginPopupResultDto, OAuthBeginCafe24PendingResultDto],
+    {
+      description:
+        '일반 흐름은 { authUrl, state }, Cafe24 Private 흐름은 { mode, integrationId, appUrl, callbackUrl }.',
+    },
+  )
   @ApiBadRequestResponse({ description: 'OAuth 기반 통합이 아님' })
   @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
   @ApiNotFoundResponse({ description: '해당 통합을 찾을 수 없음' })
@@ -380,9 +390,13 @@ export class IntegrationsController {
       '기존 OAuth 통합에 추가 스코프를 요청합니다. provider가 incremental auth를 지원해야 합니다.',
   })
   @ApiParam({ name: 'id', description: '통합 UUID', format: 'uuid' })
-  @ApiOkWrappedResponse(OAuthBeginResultDto, {
-    description: '스코프 추가 인증 URL',
-  })
+  @ApiOkWrappedOneOfResponse(
+    [OAuthBeginPopupResultDto, OAuthBeginCafe24PendingResultDto],
+    {
+      description:
+        '일반 흐름은 { authUrl, state }, Cafe24 Private 흐름은 { mode, integrationId, appUrl, callbackUrl, scopesAdded }.',
+    },
+  )
   @ApiBadRequestResponse({
     description: '입력값 검증 실패 또는 incremental auth 미지원',
   })

```

---

### 파일 9: backend/src/modules/integrations/third-party-oauth.controller.ts
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

---

### 파일 10: backend/src/nodes/ai/information-extractor/information-extractor.schema.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/ai/information-extractor/information-extractor.schema.spec.ts b/backend/src/nodes/ai/information-extractor/information-extractor.schema.spec.ts
index f3c3bf25..3b382960 100644
--- a/backend/src/nodes/ai/information-extractor/information-extractor.schema.spec.ts
+++ b/backend/src/nodes/ai/information-extractor/information-extractor.schema.spec.ts
@@ -210,7 +210,7 @@ describe('validateInformationExtractorConfig (imperative)', () => {
 });
 
 describe('evaluateMetadataBlockingErrors integration (information_extractor)', () => {
-  it('emits Korean warnings on a freshly-created node', () => {
+  it('emits warnings on a freshly-created node', () => {
     const errors = evaluateMetadataBlockingErrors(
       informationExtractorNodeMetadata,
       {},

```

---

### 파일 11: backend/src/nodes/ai/llm-provider-rule.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/ai/llm-provider-rule.ts b/backend/src/nodes/ai/llm-provider-rule.ts
index c1b8eaa6..e108dba9 100644
--- a/backend/src/nodes/ai/llm-provider-rule.ts
+++ b/backend/src/nodes/ai/llm-provider-rule.ts
@@ -4,6 +4,11 @@
  *
  * 캔버스 / handler.validate / execution-engine 사이의 SSOT.
  *
+ * **Language SoT**: 본 메시지는 English 가 single source of truth 이며,
+ * 프론트엔드 `WARNING_KO` (`frontend/src/lib/i18n/backend-labels.ts`) 가 ko
+ * 번역을 담당한다. 영문 원본을 바꿀 때 반드시 `WARNING_KO` 의 매핑 키도 동시
+ * 갱신해 캔버스 배지의 ko 표시가 깨지지 않게 한다.
+ *
  * 배경
  * ----
  * 각 노드의 schema 에는 동일한 모양의 declarative rule 이 선언돼 있다:

```

#### 전체 파일 컨텍스트
```
/**
 * AI 노드 3종(ai_agent, text_classifier, information_extractor)이 공유하는
 * "no-llm-provider" warningRule 의 메시지·node type 상수.
 *
 * 캔버스 / handler.validate / execution-engine 사이의 SSOT.
 *
 * **Language SoT**: 본 메시지는 English 가 single source of truth 이며,
 * 프론트엔드 `WARNING_KO` (`frontend/src/lib/i18n/backend-labels.ts`) 가 ko
 * 번역을 담당한다. 영문 원본을 바꿀 때 반드시 `WARNING_KO` 의 매핑 키도 동시
 * 갱신해 캔버스 배지의 ko 표시가 깨지지 않게 한다.
 *
 * 배경
 * ----
 * 각 노드의 schema 에는 동일한 모양의 declarative rule 이 선언돼 있다:
 *
 *   { id: '<type>:no-llm-provider',
 *     when: '!model && !llmConfigId',
 *     message: AI_NO_LLM_PROVIDER_MESSAGE }
 *
 * 프론트엔드 캔버스(@workflow/node-summary 의 getConfigSummary)는 워크스페이스에
 * 기본 LLM 이 등록돼 있으면 이 경고를 억제한다. backend 는 schema 평가 시점에
 * 워크스페이스 컨텍스트를 모르기 때문에 일단 발사한 뒤, execution-engine 이
 * 노드 실행 직전에 AI 노드라면 메시지를 비교해 워크스페이스 default 가 있을 때
 * 통과시키는 후처리(post-filter)를 한다.
 *
 * 메시지 문자열을 그대로 비교하는 이유는 handler.validate 가 `string[]` 만
 * 반환하기 때문이다. rule id 까지 노출하려면 인터페이스 변경이 필요해 범위가
 * 과도해진다 — 메시지 상수를 공유해 typo / 표현 변형을 막는다.
 */
export const AI_NO_LLM_PROVIDER_MESSAGE =
  'LLM provider or model must be selected (auto-handled by the canvas when a workspace default provider is configured).';

export const AI_LLM_PROVIDER_NODE_TYPES: ReadonlySet<string> = new Set([
  'ai_agent',
  'text_classifier',
  'information_extractor',
]);

```

---

### 파일 12: backend/src/nodes/ai/text-classifier/text-classifier.schema.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/ai/text-classifier/text-classifier.schema.spec.ts b/backend/src/nodes/ai/text-classifier/text-classifier.schema.spec.ts
index 7844283b..90cfebd3 100644
--- a/backend/src/nodes/ai/text-classifier/text-classifier.schema.spec.ts
+++ b/backend/src/nodes/ai/text-classifier/text-classifier.schema.spec.ts
@@ -260,7 +260,7 @@ describe('validateTextClassifierConfig (imperative)', () => {
 });
 
 describe('evaluateMetadataBlockingErrors integration (text_classifier)', () => {
-  it('emits multiple Korean warnings on a freshly-created node', () => {
+  it('emits multiple warnings on a freshly-created node', () => {
     const errors = evaluateMetadataBlockingErrors(
       textClassifierNodeMetadata,
       {},

```

---

### 파일 13: backend/src/nodes/core/node-component.interface.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/core/node-component.interface.ts b/backend/src/nodes/core/node-component.interface.ts
index f08081f4..f4f84545 100644
--- a/backend/src/nodes/core/node-component.interface.ts
+++ b/backend/src/nodes/core/node-component.interface.ts
@@ -149,7 +149,7 @@ export interface NodeComponentMetadata {
   warningRules?: readonly WarningRule[];
   /**
    * Imperative escape hatch for warnings the {@link warningRules} mini-DSL
-   * cannot express. Returns Korean messages — same shape as
+   * cannot express. Returns warning messages — same shape as
    * `handler.validate(config).errors`. Per the SSOT contract, this lives on
    * the same node component as the schema (no logic outside the node folder).
    *

```

---

### 파일 14: backend/src/nodes/data/code/code.schema.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/data/code/code.schema.spec.ts b/backend/src/nodes/data/code/code.schema.spec.ts
index b18a1977..ffe2caba 100644
--- a/backend/src/nodes/data/code/code.schema.spec.ts
+++ b/backend/src/nodes/data/code/code.schema.spec.ts
@@ -61,7 +61,7 @@ describe('validateCodeConfig (imperative)', () => {
 });
 
 describe('evaluateMetadataBlockingErrors integration (code)', () => {
-  it('emits the Korean warning when code body is empty', () => {
+  it('emits the warning when code body is empty', () => {
     expect(evaluateMetadataBlockingErrors(codeNodeMetadata, {})).toContain(
       'Body of the code to run must be entered.',
     );

```

#### 전체 파일 컨텍스트
```
import { evaluateWarnings } from '@workflow/node-summary';
import { codeNodeMetadata, validateCodeConfig } from './code.schema';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation';

describe('codeNodeMetadata.warningRules', () => {
  const firedIds = (config: unknown) =>
    evaluateWarnings(
      config as Record<string, unknown>,
      codeNodeMetadata.warningRules,
    ).map((w) => w.id);

  describe('code:no-code', () => {
    it('fires when code is missing', () => {
      expect(firedIds({})).toContain('code:no-code');
    });

    it('fires when code is empty string', () => {
      expect(firedIds({ code: '' })).toContain('code:no-code');
    });

    it('does NOT fire when code body is set', () => {
      expect(firedIds({ code: 'return 1;' })).not.toContain('code:no-code');
    });
  });
});

describe('validateCodeConfig (imperative)', () => {
  it('returns [] when timeout is omitted', () => {
    expect(validateCodeConfig({ code: 'return 1;' })).toEqual([]);
  });

  it('returns [] when timeout sits inside 1..120 seconds', () => {
    expect(validateCodeConfig({ code: 'return 1;', timeout: 30 })).toEqual([]);
    expect(validateCodeConfig({ code: 'return 1;', timeout: 1 })).toEqual([]);
    expect(validateCodeConfig({ code: 'return 1;', timeout: 120 })).toEqual([]);
  });

  it('rejects non-numeric timeout', () => {
    expect(validateCodeConfig({ timeout: '30' })).toEqual([
      'timeout must be a number between 1 and 120 seconds',
    ]);
  });

  it('rejects timeout below 1 or above 120', () => {
    expect(validateCodeConfig({ timeout: 0 })).toEqual([
      'timeout must be a number between 1 and 120 seconds',
    ]);
    expect(validateCodeConfig({ timeout: 121 })).toEqual([
      'timeout must be a number between 1 and 120 seconds',
    ]);
  });

  it('rejects non-finite timeout (Infinity, NaN)', () => {
    expect(validateCodeConfig({ timeout: Infinity })).toEqual([
      'timeout must be a number between 1 and 120 seconds',
    ]);
    expect(validateCodeConfig({ timeout: NaN })).toEqual([
      'timeout must be a number between 1 and 120 seconds',
    ]);
  });
});

describe('evaluateMetadataBlockingErrors integration (code)', () => {
  it('emits the warning when code body is empty', () => {
    expect(evaluateMetadataBlockingErrors(codeNodeMetadata, {})).toContain(
      'Body of the code to run must be entered.',
    );
  });

  it('returns [] when code is set and timeout is unset', () => {
    expect(
      evaluateMetadataBlockingErrors(codeNodeMetadata, { code: 'return 1;' }),
    ).toEqual([]);
  });

  it('combines warningRules + validateConfig errors', () => {
    const errors = evaluateMetadataBlockingErrors(codeNodeMetadata, {
      timeout: 999,
    });
    expect(errors).toContain('Body of the code to run must be entered.');
    expect(errors).toContain(
      'timeout must be a number between 1 and 120 seconds',
    );
  });
});

```

---

### 파일 15: backend/src/nodes/data/transform/transform.schema.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/data/transform/transform.schema.spec.ts b/backend/src/nodes/data/transform/transform.schema.spec.ts
index ca289c8c..3f987ef4 100644
--- a/backend/src/nodes/data/transform/transform.schema.spec.ts
+++ b/backend/src/nodes/data/transform/transform.schema.spec.ts
@@ -131,7 +131,7 @@ describe('validateTransformConfig (imperative)', () => {
 });
 
 describe('evaluateMetadataBlockingErrors integration (transform)', () => {
-  it('emits the Korean warning when no operations are defined', () => {
+  it('emits the warning when no operations are defined', () => {
     expect(evaluateMetadataBlockingErrors(transformNodeMetadata, {})).toContain(
       'At least one transform operation must be added.',
     );

```

---

### 파일 16: backend/src/nodes/flow/workflow/workflow.schema.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/flow/workflow/workflow.schema.spec.ts b/backend/src/nodes/flow/workflow/workflow.schema.spec.ts
index f8fea576..3cec6bf2 100644
--- a/backend/src/nodes/flow/workflow/workflow.schema.spec.ts
+++ b/backend/src/nodes/flow/workflow/workflow.schema.spec.ts
@@ -79,7 +79,7 @@ describe('validateWorkflowConfig (imperative)', () => {
 });
 
 describe('evaluateMetadataBlockingErrors integration (workflow)', () => {
-  it('emits the Korean warning when no workflow is selected', () => {
+  it('emits the warning when no workflow is selected', () => {
     expect(evaluateMetadataBlockingErrors(workflowNodeMetadata, {})).toContain(
       'Target workflow must be selected.',
     );

```

#### 전체 파일 컨텍스트
```
import { evaluateWarnings } from '@workflow/node-summary';
import {
  workflowNodeMetadata,
  validateWorkflowConfig,
} from './workflow.schema';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation';

describe('workflowNodeMetadata.warningRules', () => {
  const firedIds = (config: unknown) =>
    evaluateWarnings(
      config as Record<string, unknown>,
      workflowNodeMetadata.warningRules,
    ).map((w) => w.id);

  describe('workflow:no-workflow-selected', () => {
    it('fires when workflowId is missing', () => {
      expect(firedIds({})).toContain('workflow:no-workflow-selected');
    });

    it('fires when workflowId is empty string', () => {
      expect(firedIds({ workflowId: '' })).toContain(
        'workflow:no-workflow-selected',
      );
    });

    it('does NOT fire when workflowId is set', () => {
      expect(firedIds({ workflowId: 'wf-123' })).not.toContain(
        'workflow:no-workflow-selected',
      );
    });
  });
});

describe('validateWorkflowConfig (imperative)', () => {
  it('returns [] for a fully valid sync invocation', () => {
    expect(
      validateWorkflowConfig({
        workflowId: 'wf-1',
        mode: 'sync',
        timeout: 30,
        inputMapping: [{ paramName: 'p1', expression: 'x' }],
      }),
    ).toEqual([]);
  });

  it('rejects negative timeout', () => {
    expect(validateWorkflowConfig({ timeout: -1 })).toContain(
      'timeout must be a non-negative number (0 = no timeout)',
    );
  });

  it('rejects non-numeric timeout', () => {
    expect(validateWorkflowConfig({ timeout: '10' })).toContain(
      'timeout must be a non-negative number (0 = no timeout)',
    );
  });

  it('accepts timeout = 0 (no timeout)', () => {
    expect(validateWorkflowConfig({ timeout: 0 })).toEqual([]);
  });

  it('rejects non-array inputMapping', () => {
    expect(
      validateWorkflowConfig({ inputMapping: { p: 'x' } as never }),
    ).toContain('inputMapping must be an array');
  });

  it('rejects inputMapping items missing paramName', () => {
    const errors = validateWorkflowConfig({
      inputMapping: [{ paramName: '', expression: 'x' }, { expression: 'y' }],
    });
    expect(errors).toContain(
      'inputMapping[0].paramName is required and must be a string',
    );
    expect(errors).toContain(
      'inputMapping[1].paramName is required and must be a string',
    );
  });
});

describe('evaluateMetadataBlockingErrors integration (workflow)', () => {
  it('emits the warning when no workflow is selected', () => {
    expect(evaluateMetadataBlockingErrors(workflowNodeMetadata, {})).toContain(
      'Target workflow must be selected.',
    );
  });

  it('returns [] when fully configured', () => {
    expect(
      evaluateMetadataBlockingErrors(workflowNodeMetadata, {
        workflowId: 'wf-1',
      }),
    ).toEqual([]);
  });

  it('combines warningRules + validateConfig errors', () => {
    const errors = evaluateMetadataBlockingErrors(workflowNodeMetadata, {
      timeout: -5,
    });
    expect(errors).toContain('Target workflow must be selected.');
    expect(errors).toContain(
      'timeout must be a non-negative number (0 = no timeout)',
    );
  });
});

```

---

### 파일 17: backend/src/nodes/integration/cafe24/cafe24-token-refresh.processor.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/integration/cafe24/cafe24-token-refresh.processor.spec.ts b/backend/src/nodes/integration/cafe24/cafe24-token-refresh.processor.spec.ts
index b23d51a8..2a0c7caf 100644
--- a/backend/src/nodes/integration/cafe24/cafe24-token-refresh.processor.spec.ts
+++ b/backend/src/nodes/integration/cafe24/cafe24-token-refresh.processor.spec.ts
@@ -117,20 +117,4 @@ describe('Cafe24TokenRefreshProcessor', () => {
       ),
     ).rejects.toBe(refreshError);
   });
-
-  // TEST-C2 — refreshAccessToken 이 throw 했을 때 process() 가 그대로
-  // re-throw 해야 BullMQ 가 job 을 failed 로 마킹한다. `.catch()` 로
-  // 삼키면 refresh 실패가 silently no-op 되어 알림·진단이 불가능해진다.
-  // 본 테스트는 propagation invariant 를 회귀 방지.
-  it('propagates refreshAccessToken failure (BullMQ failed marking depends on this)', async () => {
-    integrationRepository.findOne.mockResolvedValue(makeIntegration());
-    const refreshError = new Error('refresh_token invalid');
-    cafe24ApiClient.refreshAccessToken.mockRejectedValue(refreshError);
-
-    await expect(
-      processor.process(
-        makeJob({ integrationId: 'int-1', source: 'proactive' }),
-      ),
-    ).rejects.toBe(refreshError);
-  });
 });

```

#### 전체 파일 컨텍스트
```
import { Cafe24TokenRefreshProcessor } from './cafe24-token-refresh.processor';
import type { Integration } from '../../../modules/integrations/entities/integration.entity';
import type { Job } from 'bullmq';
import type { Cafe24RefreshJobData } from '../../../modules/integrations/cafe24-token-refresh.constants';

describe('Cafe24TokenRefreshProcessor', () => {
  let processor: Cafe24TokenRefreshProcessor;
  let integrationRepository: { findOne: jest.Mock };
  let cafe24ApiClient: { refreshAccessToken: jest.Mock };

  beforeEach(() => {
    integrationRepository = { findOne: jest.fn() };
    cafe24ApiClient = {
      refreshAccessToken: jest.fn().mockResolvedValue(undefined),
    };
    processor = new Cafe24TokenRefreshProcessor(
      integrationRepository as never,
      cafe24ApiClient as never,
    );
  });

  function makeJob(data: Cafe24RefreshJobData): Job<Cafe24RefreshJobData> {
    return { data, id: data.integrationId } as Job<Cafe24RefreshJobData>;
  }

  function makeIntegration(overrides: Partial<Integration> = {}): Integration {
    return {
      id: 'int-1',
      serviceType: 'cafe24',
      status: 'connected',
      credentials: { mall_id: 'shop', refresh_token: 'r' },
      tokenExpiresAt: new Date(Date.now() - 30_000), // 30s past expiry
      ...overrides,
    } as Integration;
  }

  it('refreshes when token is expired', async () => {
    integrationRepository.findOne.mockResolvedValue(makeIntegration());
    await processor.process(
      makeJob({ integrationId: 'int-1', source: 'proactive' }),
    );
    expect(cafe24ApiClient.refreshAccessToken).toHaveBeenCalledTimes(1);
  });

  it('short-circuits when token is already fresh (race protection)', async () => {
    integrationRepository.findOne.mockResolvedValue(
      makeIntegration({
        tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1h future
      }),
    );
    await processor.process(
      makeJob({ integrationId: 'int-1', source: 'proactive' }),
    );
    expect(cafe24ApiClient.refreshAccessToken).not.toHaveBeenCalled();
  });

  it('skips silently when integration is missing (deleted between enqueue and pickup)', async () => {
    integrationRepository.findOne.mockResolvedValue(null);
    await processor.process(
      makeJob({ integrationId: 'missing', source: 'proactive' }),
    );
    expect(cafe24ApiClient.refreshAccessToken).not.toHaveBeenCalled();
  });

  it('skips integration with serviceType !== cafe24 (defensive)', async () => {
    integrationRepository.findOne.mockResolvedValue(
      makeIntegration({ serviceType: 'google' }),
    );
    await processor.process(
      makeJob({ integrationId: 'int-1', source: 'proactive' }),
    );
    expect(cafe24ApiClient.refreshAccessToken).not.toHaveBeenCalled();
  });

  // CONC H-2 회귀 — source 와 무관하게 status='connected' 만 처리해야 한다.
  // 옛 코드는 proactive 경로에서 status 검증을 건너뛰어, BullMQ jobId
  // dedup race (proactive 가 먼저 enqueue → background 가 같은 잡 재사용,
  // worker 는 'proactive' source 만 봄) 시 사용자가 의도한 reauthorize
  // 흐름이 우회될 수 있었다. source 무관 status 검증으로 race-safe.
  it.each(['proactive', 'background'] as const)(
    '%s source — skips when status is not connected (CONC H-2 race-safe)',
    async (source) => {
      integrationRepository.findOne.mockResolvedValue(
        makeIntegration({ status: 'error', statusReason: 'auth_failed' }),
      );
      await processor.process(makeJob({ integrationId: 'int-1', source }));
      expect(cafe24ApiClient.refreshAccessToken).not.toHaveBeenCalled();
    },
  );

  // CONC H-2 회귀 (2026-05-16 follow-up) — source 와 무관하게 expired
  // status 도 거부해야 한다. Phase 2 의 source-based 검증을 source-
  // agnostic 으로 격상하면서 의도된 동작.
  it.each(['proactive', 'background'] as const)(
    '%s source — skips when status is expired',
    async (source) => {
      integrationRepository.findOne.mockResolvedValue(
        makeIntegration({ status: 'expired' }),
      );
      await processor.process(makeJob({ integrationId: 'int-1', source }));
      expect(cafe24ApiClient.refreshAccessToken).not.toHaveBeenCalled();
    },
  );

  // TEST-C2 — refreshAccessToken 이 throw 했을 때 process() 가 그대로
  // re-throw 해야 BullMQ 가 job 을 failed 로 마킹한다. `.catch()` 로
  // 삼키면 refresh 실패가 silently no-op 되어 알림·진단이 불가능해진다.
  // 본 테스트는 propagation invariant 를 회귀 방지.
  it('propagates refreshAccessToken failure (BullMQ failed marking depends on this)', async () => {
    integrationRepository.findOne.mockResolvedValue(makeIntegration());
    const refreshError = new Error('refresh_token invalid');
    cafe24ApiClient.refreshAccessToken.mockRejectedValue(refreshError);

    await expect(
      processor.process(
        makeJob({ integrationId: 'int-1', source: 'proactive' }),
      ),
    ).rejects.toBe(refreshError);
  });
});

```

---

### 파일 18: backend/src/nodes/integration/database-query/database-query.schema.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/integration/database-query/database-query.schema.spec.ts b/backend/src/nodes/integration/database-query/database-query.schema.spec.ts
index fa01ae77..c98fe481 100644
--- a/backend/src/nodes/integration/database-query/database-query.schema.spec.ts
+++ b/backend/src/nodes/integration/database-query/database-query.schema.spec.ts
@@ -67,7 +67,7 @@ describe('validateDatabaseQueryConfig (imperative)', () => {
 });
 
 describe('evaluateMetadataBlockingErrors integration (database_query)', () => {
-  it('emits both Korean warnings on a freshly-created node', () => {
+  it('emits both warnings on a freshly-created node', () => {
     const errors = evaluateMetadataBlockingErrors(
       databaseQueryNodeMetadata,
       {},

```

#### 전체 파일 컨텍스트
```
import { evaluateWarnings } from '@workflow/node-summary';
import {
  databaseQueryNodeMetadata,
  validateDatabaseQueryConfig,
} from './database-query.schema';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation';

describe('databaseQueryNodeMetadata.warningRules', () => {
  const firedIds = (config: unknown) =>
    evaluateWarnings(
      config as Record<string, unknown>,
      databaseQueryNodeMetadata.warningRules,
    ).map((w) => w.id);

  describe('database_query:no-integration', () => {
    it('fires when integrationId is missing', () => {
      expect(firedIds({})).toContain('database_query:no-integration');
    });

    it('does NOT fire when integrationId is set', () => {
      expect(firedIds({ integrationId: 'i-1' })).not.toContain(
        'database_query:no-integration',
      );
    });
  });

  describe('database_query:no-query', () => {
    it('fires when query is missing', () => {
      expect(firedIds({})).toContain('database_query:no-query');
    });

    it('fires when query is empty string', () => {
      expect(firedIds({ query: '' })).toContain('database_query:no-query');
    });

    it('does NOT fire when query is set', () => {
      expect(firedIds({ query: 'SELECT 1' })).not.toContain(
        'database_query:no-query',
      );
    });
  });
});

describe('validateDatabaseQueryConfig (imperative)', () => {
  it('returns [] when parameters is omitted', () => {
    expect(validateDatabaseQueryConfig({ query: 'SELECT 1' })).toEqual([]);
  });

  it('accepts parameters as an array', () => {
    expect(validateDatabaseQueryConfig({ parameters: [1, 'two'] })).toEqual([]);
  });

  it('accepts parameters as a JSON-array string', () => {
    expect(validateDatabaseQueryConfig({ parameters: '[1, "two"]' })).toEqual(
      [],
    );
  });

  it('rejects parameters that is neither array nor string', () => {
    expect(
      validateDatabaseQueryConfig({ parameters: { a: 1 } as never }),
    ).toContain('parameters must be an array or a JSON array string');
    expect(validateDatabaseQueryConfig({ parameters: 42 as never })).toContain(
      'parameters must be an array or a JSON array string',
    );
  });
});

describe('evaluateMetadataBlockingErrors integration (database_query)', () => {
  it('emits both warnings on a freshly-created node', () => {
    const errors = evaluateMetadataBlockingErrors(
      databaseQueryNodeMetadata,
      {},
    );
    expect(errors).toContain('Database integration must be selected.');
    expect(errors).toContain('SQL query must be entered.');
  });

  it('returns [] when fully configured', () => {
    expect(
      evaluateMetadataBlockingErrors(databaseQueryNodeMetadata, {
        integrationId: 'i-1',
        query: 'SELECT 1',
      }),
    ).toEqual([]);
  });
});

```

---

### 파일 19: backend/src/nodes/integration/http-request/http-request.schema.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/integration/http-request/http-request.schema.spec.ts b/backend/src/nodes/integration/http-request/http-request.schema.spec.ts
index b91a53e3..3c391347 100644
--- a/backend/src/nodes/integration/http-request/http-request.schema.spec.ts
+++ b/backend/src/nodes/integration/http-request/http-request.schema.spec.ts
@@ -122,7 +122,7 @@ describe('validateHttpRequestConfig (imperative)', () => {
 });
 
 describe('evaluateMetadataBlockingErrors integration (http_request)', () => {
-  it('emits both Korean warnings on a freshly-created integration-auth node', () => {
+  it('emits both warnings on a freshly-created integration-auth node', () => {
     const errors = evaluateMetadataBlockingErrors(httpRequestNodeMetadata, {
       authentication: 'integration',
     });

```

#### 전체 파일 컨텍스트
```
import { evaluateWarnings } from '@workflow/node-summary';
import {
  httpRequestNodeMetadata,
  keyValueSchema,
  validateHttpRequestConfig,
} from './http-request.schema';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation';

describe('keyValueSchema (headers / queryParams 공용)', () => {
  it('필수 key/value 정상 파싱', () => {
    const parsed = keyValueSchema.parse({
      key: 'Authorization',
      value: 'Bearer xyz',
    });
    expect(parsed.key).toBe('Authorization');
    expect(parsed.value).toBe('Bearer xyz');
  });

  it('passthrough — 추가 메타 필드(description, enabled 등) 보존', () => {
    const parsed = keyValueSchema.parse({
      key: 'X-Custom',
      value: 'foo',
      description: 'optional metadata',
      enabled: true,
      // Zod passthrough 는 런타임에 추가 필드를 보존하지만 추론 타입에는
      // 미반영되므로 cast 가 불가피.
    } as Record<string, unknown>);
    const extra = parsed as Record<string, unknown>;
    expect(extra.description).toBe('optional metadata');
    expect(extra.enabled).toBe(true);
  });

  it('key/value 누락 시 거부', () => {
    expect(keyValueSchema.safeParse({ key: 'X' }).success).toBe(false);
    expect(keyValueSchema.safeParse({ value: 'v' }).success).toBe(false);
  });

  it('CRLF 가 포함된 key/value 는 거부 (header injection 방어, review W-1)', () => {
    expect(
      keyValueSchema.safeParse({ key: 'X\r\nInjected', value: 'foo' }).success,
    ).toBe(false);
    expect(
      keyValueSchema.safeParse({ key: 'X', value: 'foo\nLF' }).success,
    ).toBe(false);
    expect(
      keyValueSchema.safeParse({ key: 'X\rCR', value: 'foo' }).success,
    ).toBe(false);
  });
});

describe('httpRequestNodeMetadata.warningRules', () => {
  const firedIds = (config: unknown) =>
    evaluateWarnings(
      config as Record<string, unknown>,
      httpRequestNodeMetadata.warningRules,
    ).map((w) => w.id);

  describe('http_request:no-url', () => {
    it('fires when url is missing', () => {
      expect(firedIds({})).toContain('http_request:no-url');
    });

    it('fires when url is empty string', () => {
      expect(firedIds({ url: '' })).toContain('http_request:no-url');
    });

    it('does NOT fire when url is set', () => {
      expect(firedIds({ url: 'https://example.com' })).not.toContain(
        'http_request:no-url',
      );
    });
  });

  describe('http_request:integration-auth-needs-integration-id', () => {
    it('fires when authentication=integration and integrationId is missing', () => {
      expect(firedIds({ url: 'x', authentication: 'integration' })).toContain(
        'http_request:integration-auth-needs-integration-id',
      );
    });

    it('does NOT fire when authentication=none', () => {
      expect(firedIds({ url: 'x', authentication: 'none' })).not.toContain(
        'http_request:integration-auth-needs-integration-id',
      );
    });

    it('does NOT fire when authentication=integration and integrationId is set', () => {
      expect(
        firedIds({
          url: 'x',
          authentication: 'integration',
          integrationId: 'i-1',
        }),
      ).not.toContain('http_request:integration-auth-needs-integration-id');
    });
  });
});

describe('validateHttpRequestConfig (imperative)', () => {
  it('returns [] when timeout is omitted', () => {
    expect(validateHttpRequestConfig({ url: 'x' })).toEqual([]);
  });

  it('returns [] when timeout is a positive number', () => {
    expect(validateHttpRequestConfig({ timeout: 30000 })).toEqual([]);
  });

  it('rejects non-numeric timeout', () => {
    expect(validateHttpRequestConfig({ timeout: '30000' })).toContain(
      'timeout must be a positive number',
    );
  });

  it('rejects timeout = 0 or negative', () => {
    expect(validateHttpRequestConfig({ timeout: 0 })).toContain(
      'timeout must be a positive number',
    );
    expect(validateHttpRequestConfig({ timeout: -1 })).toContain(
      'timeout must be a positive number',
    );
  });
});

describe('evaluateMetadataBlockingErrors integration (http_request)', () => {
  it('emits both warnings on a freshly-created integration-auth node', () => {
    const errors = evaluateMetadataBlockingErrors(httpRequestNodeMetadata, {
      authentication: 'integration',
    });
    expect(errors).toContain('URL must be entered.');
    expect(errors).toContain(
      'Integration must be selected when using Integration auth.',
    );
  });

  it('returns [] when fully configured', () => {
    expect(
      evaluateMetadataBlockingErrors(httpRequestNodeMetadata, {
        url: 'https://example.com',
      }),
    ).toEqual([]);
  });
});

```

---

### 파일 20: backend/src/nodes/integration/send-email/send-email.schema.spec.ts
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

---

### 파일 21: backend/src/nodes/logic/filter/filter.schema.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/logic/filter/filter.schema.spec.ts b/backend/src/nodes/logic/filter/filter.schema.spec.ts
index 1efbfd72..3d467563 100644
--- a/backend/src/nodes/logic/filter/filter.schema.spec.ts
+++ b/backend/src/nodes/logic/filter/filter.schema.spec.ts
@@ -85,7 +85,7 @@ describe('validateFilterConfig (imperative)', () => {
 });
 
 describe('evaluateMetadataBlockingErrors integration (filter)', () => {
-  it('emits both Korean warnings when nothing is configured', () => {
+  it('emits both warnings when nothing is configured', () => {
     const errors = evaluateMetadataBlockingErrors(filterNodeMetadata, {});
     expect(errors).toContain('Input field must be entered.');
     expect(errors).toContain('At least one condition must be added.');

```

#### 전체 파일 컨텍스트
```
import { evaluateWarnings } from '@workflow/node-summary';
import { filterNodeMetadata, validateFilterConfig } from './filter.schema';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation';

describe('filterNodeMetadata.warningRules', () => {
  const firedIds = (config: unknown) =>
    evaluateWarnings(
      config as Record<string, unknown>,
      filterNodeMetadata.warningRules,
    ).map((w) => w.id);

  describe('filter:no-input-field', () => {
    it('fires when inputField is missing', () => {
      expect(firedIds({})).toContain('filter:no-input-field');
    });

    it('does NOT fire when inputField is set', () => {
      expect(firedIds({ inputField: '$input.items' })).not.toContain(
        'filter:no-input-field',
      );
    });
  });

  describe('filter:no-conditions', () => {
    it('fires when conditions is empty', () => {
      expect(
        firedIds({ inputField: '$input.items', conditions: [] }),
      ).toContain('filter:no-conditions');
    });

    it('does NOT fire when conditions is non-empty', () => {
      expect(
        firedIds({
          inputField: '$input.items',
          conditions: [{ field: 'x', operator: 'eq' }],
        }),
      ).not.toContain('filter:no-conditions');
    });
  });
});

describe('validateFilterConfig (imperative)', () => {
  it('returns [] when no conditions', () => {
    expect(validateFilterConfig({ inputField: 'a' })).toEqual([]);
  });

  it('accepts condition without field (item-self sentinel)', () => {
    // Empty/missing field maps to "compare the item itself", which is
    // required for scalar arrays like [1, 2, 3].
    expect(
      validateFilterConfig({
        inputField: 'a',
        conditions: [{ operator: 'eq' }],
      }),
    ).toEqual([]);
  });

  it('rejects non-string field', () => {
    expect(
      validateFilterConfig({
        inputField: 'a',
        conditions: [{ field: 123, operator: 'eq' }],
      }),
    ).toContain('conditions[0].field must be a string');
  });

  it('rejects unknown operator', () => {
    const errors = validateFilterConfig({
      inputField: 'a',
      conditions: [{ field: 'x', operator: 'sploosh' }],
    });
    expect(errors.some((e) => e.startsWith('conditions[0].operator'))).toBe(
      true,
    );
  });

  it('accepts a fully-formed condition', () => {
    expect(
      validateFilterConfig({
        inputField: 'a',
        conditions: [{ field: 'x', operator: 'eq' }],
      }),
    ).toEqual([]);
  });
});

describe('evaluateMetadataBlockingErrors integration (filter)', () => {
  it('emits both warnings when nothing is configured', () => {
    const errors = evaluateMetadataBlockingErrors(filterNodeMetadata, {});
    expect(errors).toContain('Input field must be entered.');
    expect(errors).toContain('At least one condition must be added.');
  });

  it('returns [] when fully configured', () => {
    expect(
      evaluateMetadataBlockingErrors(filterNodeMetadata, {
        inputField: '$input.items',
        conditions: [{ field: 'x', operator: 'eq', value: 1 }],
      }),
    ).toEqual([]);
  });
});

```

---

### 파일 22: backend/src/nodes/logic/foreach/foreach.schema.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/logic/foreach/foreach.schema.spec.ts b/backend/src/nodes/logic/foreach/foreach.schema.spec.ts
index b61971b0..c737f671 100644
--- a/backend/src/nodes/logic/foreach/foreach.schema.spec.ts
+++ b/backend/src/nodes/logic/foreach/foreach.schema.spec.ts
@@ -27,7 +27,7 @@ describe('foreachNodeMetadata.warningRules', () => {
 });
 
 describe('evaluateMetadataBlockingErrors integration (foreach)', () => {
-  it('emits the Korean warning when arrayField is missing', () => {
+  it('emits the warning when arrayField is missing', () => {
     expect(evaluateMetadataBlockingErrors(foreachNodeMetadata, {})).toEqual([
       'Array field must be entered.',
     ]);

```

#### 전체 파일 컨텍스트
```
import { evaluateWarnings } from '@workflow/node-summary';
import { foreachNodeMetadata } from './foreach.schema';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation';

describe('foreachNodeMetadata.warningRules', () => {
  const firedIds = (config: unknown) =>
    evaluateWarnings(
      config as Record<string, unknown>,
      foreachNodeMetadata.warningRules,
    ).map((w) => w.id);

  describe('foreach:no-array-field', () => {
    it('fires when arrayField is missing', () => {
      expect(firedIds({})).toContain('foreach:no-array-field');
    });

    it('fires when arrayField is empty string', () => {
      expect(firedIds({ arrayField: '' })).toContain('foreach:no-array-field');
    });

    it('does NOT fire when arrayField is set', () => {
      expect(firedIds({ arrayField: '$input.items' })).not.toContain(
        'foreach:no-array-field',
      );
    });
  });
});

describe('evaluateMetadataBlockingErrors integration (foreach)', () => {
  it('emits the warning when arrayField is missing', () => {
    expect(evaluateMetadataBlockingErrors(foreachNodeMetadata, {})).toEqual([
      'Array field must be entered.',
    ]);
  });

  it('returns [] when configured', () => {
    expect(
      evaluateMetadataBlockingErrors(foreachNodeMetadata, {
        arrayField: '$input.items',
      }),
    ).toEqual([]);
  });
});

```

---

### 파일 23: backend/src/nodes/logic/if-else/if-else.schema.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/logic/if-else/if-else.schema.spec.ts b/backend/src/nodes/logic/if-else/if-else.schema.spec.ts
index bac54609..7200cb43 100644
--- a/backend/src/nodes/logic/if-else/if-else.schema.spec.ts
+++ b/backend/src/nodes/logic/if-else/if-else.schema.spec.ts
@@ -76,7 +76,7 @@ describe('validateIfElseConfig (imperative)', () => {
 });
 
 describe('evaluateMetadataBlockingErrors integration (if_else)', () => {
-  it('emits both Korean warnings on a freshly-created node', () => {
+  it('emits both warnings on a freshly-created node', () => {
     const errors = evaluateMetadataBlockingErrors(ifElseMetadata, {});
     expect(errors).toContain('At least one condition must be added.');
   });

```

#### 전체 파일 컨텍스트
```
import { evaluateWarnings } from '@workflow/node-summary';
import { ifElseMetadata, validateIfElseConfig } from './if-else.schema';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation';

describe('ifElseMetadata.warningRules', () => {
  const firedIds = (config: unknown) =>
    evaluateWarnings(
      config as Record<string, unknown>,
      ifElseMetadata.warningRules,
    ).map((w) => w.id);

  describe('if_else:no-conditions', () => {
    it('fires when conditions is missing entirely', () => {
      expect(firedIds({})).toContain('if_else:no-conditions');
    });

    it('fires when conditions is an empty array', () => {
      expect(firedIds({ conditions: [] })).toContain('if_else:no-conditions');
    });

    it('does NOT fire when at least one condition is defined', () => {
      expect(
        firedIds({ conditions: [{ field: 'x', operator: 'eq', value: 1 }] }),
      ).not.toContain('if_else:no-conditions');
    });
  });

  describe('if_else:first-condition-field-empty', () => {
    it('fires when first condition has no field', () => {
      expect(
        firedIds({ conditions: [{ operator: 'eq', value: 1 }] }),
      ).toContain('if_else:first-condition-field-empty');
    });

    it('does NOT fire when first condition has a field', () => {
      expect(
        firedIds({ conditions: [{ field: 'x', operator: 'eq' }] }),
      ).not.toContain('if_else:first-condition-field-empty');
    });

    it('does NOT fire when conditions array is empty (covered by no-conditions)', () => {
      expect(firedIds({ conditions: [] })).not.toContain(
        'if_else:first-condition-field-empty',
      );
    });
  });
});

describe('validateIfElseConfig (imperative)', () => {
  it('returns [] when no conditions configured', () => {
    expect(validateIfElseConfig({ conditions: [] })).toEqual([]);
  });

  it('rejects condition without field', () => {
    expect(
      validateIfElseConfig({ conditions: [{ operator: 'eq' }] }),
    ).toContain('conditions[0].field is required and must be a string');
  });

  it('rejects condition with unknown operator', () => {
    const errors = validateIfElseConfig({
      conditions: [{ field: 'x', operator: 'sploosh' }],
    });
    expect(errors.some((e) => e.startsWith('conditions[0].operator'))).toBe(
      true,
    );
  });

  it('accepts a fully-formed condition', () => {
    expect(
      validateIfElseConfig({
        conditions: [{ field: 'x', operator: 'eq', value: 1 }],
      }),
    ).toEqual([]);
  });
});

describe('evaluateMetadataBlockingErrors integration (if_else)', () => {
  it('emits both warnings on a freshly-created node', () => {
    const errors = evaluateMetadataBlockingErrors(ifElseMetadata, {});
    expect(errors).toContain('At least one condition must be added.');
  });

  it('returns [] when configured with a valid first condition', () => {
    expect(
      evaluateMetadataBlockingErrors(ifElseMetadata, {
        conditions: [{ field: 'x', operator: 'eq', value: 1 }],
      }),
    ).toEqual([]);
  });
});

```

---

### 파일 24: backend/src/nodes/logic/if-else/if-else.schema.ts
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

### 파일 25: backend/src/nodes/logic/loop/loop.schema.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/logic/loop/loop.schema.spec.ts b/backend/src/nodes/logic/loop/loop.schema.spec.ts
index e832423f..cb862491 100644
--- a/backend/src/nodes/logic/loop/loop.schema.spec.ts
+++ b/backend/src/nodes/logic/loop/loop.schema.spec.ts
@@ -66,7 +66,7 @@ describe('validateLoopConfig (imperative)', () => {
 });
 
 describe('evaluateMetadataBlockingErrors integration (loop)', () => {
-  it('emits the Korean warning when count is missing', () => {
+  it('emits the warning when count is missing', () => {
     expect(evaluateMetadataBlockingErrors(loopNodeMetadata, {})).toContain(
       'Count must be entered.',
     );

```

#### 전체 파일 컨텍스트
```
import { evaluateWarnings } from '@workflow/node-summary';
import { loopNodeMetadata, validateLoopConfig } from './loop.schema';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation';

describe('loopNodeMetadata.warningRules', () => {
  const firedIds = (config: unknown) =>
    evaluateWarnings(
      config as Record<string, unknown>,
      loopNodeMetadata.warningRules,
    ).map((w) => w.id);

  describe('loop:no-count', () => {
    it('fires when count is missing', () => {
      expect(firedIds({})).toContain('loop:no-count');
    });

    it('fires when count is empty string', () => {
      expect(firedIds({ count: '' })).toContain('loop:no-count');
    });

    it('does NOT fire when count is a numeric string', () => {
      expect(firedIds({ count: '10' })).not.toContain('loop:no-count');
    });

    it('does NOT fire when count is an expression', () => {
      expect(firedIds({ count: '{{ $var.n }}' })).not.toContain(
        'loop:no-count',
      );
    });
  });
});

describe('validateLoopConfig (imperative)', () => {
  it('returns [] when count is a valid numeric string', () => {
    expect(validateLoopConfig({ count: '10' })).toEqual([]);
  });

  it('returns [] when count is an unresolved expression', () => {
    expect(validateLoopConfig({ count: '{{ $var.n }}' })).toEqual([]);
  });

  it('rejects negative or zero count', () => {
    expect(validateLoopConfig({ count: '0' })).toContain(
      'count must be greater than 0',
    );
  });

  it('rejects non-numeric count literals', () => {
    expect(validateLoopConfig({ count: 'abc' })).toContain(
      'count must be a number or expression',
    );
  });

  it('rejects count > maxIterations cross-field', () => {
    const errors = validateLoopConfig({ count: 200, maxIterations: 100 });
    expect(errors).toContain(
      'count must be less than or equal to maxIterations (100)',
    );
  });

  it('skips cross-field check when count is an expression', () => {
    expect(
      validateLoopConfig({ count: '{{ $var.n }}', maxIterations: 5 }),
    ).toEqual([]);
  });
});

describe('evaluateMetadataBlockingErrors integration (loop)', () => {
  it('emits the warning when count is missing', () => {
    expect(evaluateMetadataBlockingErrors(loopNodeMetadata, {})).toContain(
      'Count must be entered.',
    );
  });

  it('returns [] when count is set and valid', () => {
    expect(
      evaluateMetadataBlockingErrors(loopNodeMetadata, { count: '10' }),
    ).toEqual([]);
  });
});

```

---

### 파일 26: backend/src/nodes/logic/map/map.schema.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/logic/map/map.schema.spec.ts b/backend/src/nodes/logic/map/map.schema.spec.ts
index 6d90a6bb..4d0bb2ee 100644
--- a/backend/src/nodes/logic/map/map.schema.spec.ts
+++ b/backend/src/nodes/logic/map/map.schema.spec.ts
@@ -27,7 +27,7 @@ describe('mapNodeMetadata.warningRules', () => {
 });
 
 describe('evaluateMetadataBlockingErrors integration (map)', () => {
-  it('emits the Korean warning when inputField is missing', () => {
+  it('emits the warning when inputField is missing', () => {
     expect(evaluateMetadataBlockingErrors(mapNodeMetadata, {})).toEqual([
       'Input field must be entered.',
     ]);

```

#### 전체 파일 컨텍스트
```
import { evaluateWarnings } from '@workflow/node-summary';
import { mapNodeMetadata } from './map.schema';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation';

describe('mapNodeMetadata.warningRules', () => {
  const firedIds = (config: unknown) =>
    evaluateWarnings(
      config as Record<string, unknown>,
      mapNodeMetadata.warningRules,
    ).map((w) => w.id);

  describe('map:no-input-field', () => {
    it('fires when inputField is missing', () => {
      expect(firedIds({})).toContain('map:no-input-field');
    });

    it('fires when inputField is empty string', () => {
      expect(firedIds({ inputField: '' })).toContain('map:no-input-field');
    });

    it('does NOT fire when inputField is set', () => {
      expect(firedIds({ inputField: '$input.items' })).not.toContain(
        'map:no-input-field',
      );
    });
  });
});

describe('evaluateMetadataBlockingErrors integration (map)', () => {
  it('emits the warning when inputField is missing', () => {
    expect(evaluateMetadataBlockingErrors(mapNodeMetadata, {})).toEqual([
      'Input field must be entered.',
    ]);
  });

  it('returns [] when inputField is set', () => {
    expect(
      evaluateMetadataBlockingErrors(mapNodeMetadata, {
        inputField: '$input.items',
      }),
    ).toEqual([]);
  });
});

```

---

### 파일 27: backend/src/nodes/logic/merge/merge.schema.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/logic/merge/merge.schema.spec.ts b/backend/src/nodes/logic/merge/merge.schema.spec.ts
index 38b48505..1610e068 100644
--- a/backend/src/nodes/logic/merge/merge.schema.spec.ts
+++ b/backend/src/nodes/logic/merge/merge.schema.spec.ts
@@ -27,7 +27,7 @@ describe('mergeNodeMetadata.warningRules', () => {
 });
 
 describe('evaluateMetadataBlockingErrors integration (merge)', () => {
-  it('emits the Korean warning when strategy is missing', () => {
+  it('emits the warning when strategy is missing', () => {
     expect(evaluateMetadataBlockingErrors(mergeNodeMetadata, {})).toEqual([
       'Merge strategy must be selected.',
     ]);

```

#### 전체 파일 컨텍스트
```
import { evaluateWarnings } from '@workflow/node-summary';
import { mergeNodeMetadata } from './merge.schema';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation';

describe('mergeNodeMetadata.warningRules', () => {
  const firedIds = (config: unknown) =>
    evaluateWarnings(
      config as Record<string, unknown>,
      mergeNodeMetadata.warningRules,
    ).map((w) => w.id);

  describe('merge:no-strategy', () => {
    it('fires when strategy is missing', () => {
      expect(firedIds({})).toContain('merge:no-strategy');
    });

    it('fires when strategy is empty string', () => {
      expect(firedIds({ strategy: '' })).toContain('merge:no-strategy');
    });

    it('does NOT fire when strategy is set', () => {
      expect(firedIds({ strategy: 'wait_all' })).not.toContain(
        'merge:no-strategy',
      );
    });
  });
});

describe('evaluateMetadataBlockingErrors integration (merge)', () => {
  it('emits the warning when strategy is missing', () => {
    expect(evaluateMetadataBlockingErrors(mergeNodeMetadata, {})).toEqual([
      'Merge strategy must be selected.',
    ]);
  });

  it('returns [] when strategy is set', () => {
    expect(
      evaluateMetadataBlockingErrors(mergeNodeMetadata, {
        strategy: 'wait_all',
      }),
    ).toEqual([]);
  });
});

```

---

### 파일 28: backend/src/nodes/logic/parallel/parallel.handler.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/logic/parallel/parallel.handler.ts b/backend/src/nodes/logic/parallel/parallel.handler.ts
index e828a6e8..1e8c677f 100644
--- a/backend/src/nodes/logic/parallel/parallel.handler.ts
+++ b/backend/src/nodes/logic/parallel/parallel.handler.ts
@@ -20,7 +20,7 @@ export class ParallelHandler implements NodeHandler {
 
   validate(config: Record<string, unknown>): ValidationResult {
     // Schema SSOT (warningRules + validateConfig) mirrors all of handler's
-    // legacy inline rules verbatim (Korean messages preserved 1:1).
+    // legacy inline rules verbatim (warning messages preserved 1:1).
     const errors = evaluateMetadataBlockingErrors(this.metadata, config);
     return { valid: errors.length === 0, errors };
   }

```

#### 전체 파일 컨텍스트
```
import {
  ExecutionContext,
  NodeHandler,
  NodeHandlerOutput,
  ValidationResult,
} from '../../core/node-handler.interface';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation';
import { parallelNodeMetadata } from './parallel.schema';

/**
 * Parallel 노드 핸들러.
 *
 * 입력을 그대로 pass-through 하고 `branch_0` ~ `branch_{branchCount-1}`
 * 포트를 동시에 활성화한다. 실제 병렬 실행은 `PARALLEL_ENGINE=v1` 모드에서
 * ExecutionEngineService 가 ParallelExecutor 로 위임해 수행한다.
 * Feature flag off 모드에서는 엔진이 기존 순차 루프로 각 분기를 실행한다.
 */
export class ParallelHandler implements NodeHandler {
  metadata = parallelNodeMetadata;

  validate(config: Record<string, unknown>): ValidationResult {
    // Schema SSOT (warningRules + validateConfig) mirrors all of handler's
    // legacy inline rules verbatim (warning messages preserved 1:1).
    const errors = evaluateMetadataBlockingErrors(this.metadata, config);
    return { valid: errors.length === 0, errors };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async execute(
    _input: unknown,
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<NodeHandlerOutput> {
    const branchCount =
      typeof config.branchCount === 'number' &&
      Number.isFinite(config.branchCount)
        ? Math.max(2, Math.min(16, Math.floor(config.branchCount)))
        : 2;

    const ports = Array.from({ length: branchCount }, (_, i) => `branch_${i}`);

    // CONVENTIONS Principle 7 — config echoes raw branchCount /
    // maxConcurrency / waitAll. parallel's fields are bounded literals
    // (numeric / boolean) so raw and evaluated are identical in the
    // common case; rawConfig is still used for consistency + so future
    // expression-templated fields (if added) auto-flow through.
    //
    // CONVENTIONS Principle 9 (container handler / engine override):
    // `output: null` mirrors loop/foreach/map. The engine overrides on
    // completion with `{ branches: [...] }` (allSettled-shaped entries).
    const rawConfig = context.rawConfig ?? config;
    return {
      config: {
        branchCount: rawConfig.branchCount,
        maxConcurrency: rawConfig.maxConcurrency,
        waitAll: rawConfig.waitAll,
      },
      output: null,
      port: ports,
    };
  }
}

```

---

### 파일 29: backend/src/nodes/logic/parallel/parallel.schema.spec.ts
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

---

### 파일 30: backend/src/nodes/logic/parallel/parallel.schema.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/logic/parallel/parallel.schema.ts b/backend/src/nodes/logic/parallel/parallel.schema.ts
index 1058912e..f8a18200 100644
--- a/backend/src/nodes/logic/parallel/parallel.schema.ts
+++ b/backend/src/nodes/logic/parallel/parallel.schema.ts
@@ -80,7 +80,7 @@ export const parallelNodePorts: NodePorts = {
  * integer in [0, 16]" + "branchCount must be an integer in [2, 16]" rules
  * are already enforced by the zod schema (`int().min().max()`), so the
  * remaining domain check is just the integer-ness guard for explicit values.
- * Kept here to match handler.validate's Korean messages 1:1.
+ * Kept here to match handler.validate's warning messages 1:1.
  */
 export function validateParallelConfig(config: unknown): string[] {
   const c = (config ?? {}) as Record<string, unknown>;

```

#### 전체 파일 컨텍스트
```
import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

/**
 * Parallel fans the input out to branch_0..branch_{N-1} ports. Its own
 * `output` passes through the input (branch outputs are handled by
 * ParallelExecutor). `port` is an array (multi-port routing).
 */
export const parallelNodeOutputSchema = z
  .object({
    config: z
      .object({
        branchCount: z.number().optional(),
        maxConcurrency: z.number().optional(),
        waitAll: z.boolean().optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    output: z.unknown().optional(),
    port: z.union([z.string(), z.array(z.string())]).optional(),
    status: z.string().optional(),
  })
  .passthrough();

export const parallelNodeConfigSchema = z
  .object({
    branchCount: z
      .number()
      .int()
      .min(2)
      .max(16)
      .default(2)
      .meta({
        ui: {
          label: 'Branch Count',
          widget: 'number',
          hint: 'Number of parallel branches (2-16). branch_0 ~ branch_{N-1} output ports are generated dynamically.',
        },
      }),
    maxConcurrency: z
      .number()
      .int()
      .min(0)
      .max(16)
      .default(0)
      .meta({
        ui: {
          label: 'Max Concurrency',
          widget: 'number',
          hint: 'Max branches running concurrently (0 = same as branchCount, unlimited). When smaller than branchCount, the rest wait until a slot frees up.',
        },
      }),
    waitAll: z
      .boolean()
      .default(true)
      .meta({
        ui: {
          label: 'Wait for All Branches',
          widget: 'checkbox',
          hint: 'true: continue to the next node only after all branches finish. Phase P1 hardcodes true; false is not supported yet.',
        },
      }),
  })
  .passthrough();
export type ParallelConfig = z.infer<typeof parallelNodeConfigSchema>;

// branch_0 ~ branch_{N-1} 은 dynamicPorts로 동적 생성.
// done 포트는 PARALLEL_ENGINE=v1에서 모든 분기 완료 후 수집된 결과를 출력.
export const parallelNodePorts: NodePorts = {
  inputs: [{ id: 'in', label: 'Input', type: 'data' }],
  outputs: [{ id: 'done', label: 'Done', type: 'data' }],
};

/**
 * Imperative escape hatch — the cross-field "maxConcurrency must be an
 * integer in [0, 16]" + "branchCount must be an integer in [2, 16]" rules
 * are already enforced by the zod schema (`int().min().max()`), so the
 * remaining domain check is just the integer-ness guard for explicit values.
 * Kept here to match handler.validate's warning messages 1:1.
 */
export function validateParallelConfig(config: unknown): string[] {
  const c = (config ?? {}) as Record<string, unknown>;
  const errors: string[] = [];

  const rawBranch = c.branchCount;
  if (rawBranch !== undefined) {
    if (typeof rawBranch !== 'number' || !Number.isFinite(rawBranch)) {
      errors.push('branchCount must be an integer.');
    } else if (!Number.isInteger(rawBranch)) {
      errors.push('branchCount must be an integer.');
    } else if (rawBranch < 2 || rawBranch > 16) {
      errors.push('branchCount must be a value between 2 and 16.');
    }
  }

  if (c.maxConcurrency !== undefined) {
    const rawMax = c.maxConcurrency;
    if (typeof rawMax !== 'number' || !Number.isFinite(rawMax)) {
      errors.push('maxConcurrency must be a number.');
    } else if (!Number.isInteger(rawMax)) {
      errors.push('maxConcurrency must be an integer.');
    } else if (rawMax < 0 || rawMax > 16) {
      errors.push(
        'maxConcurrency must be a value between 0 and 16 (0 = unlimited).',
      );
    }
  }

  if (c.waitAll !== undefined && typeof c.waitAll !== 'boolean') {
    errors.push('waitAll must be a boolean.');
  }

  return errors;
}

export const parallelNodeMetadata: NodeComponentMetadata = {
  type: 'parallel',
  category: 'logic',
  label: 'Parallel',
  description:
    'Fan-out input to N branches. Each branch runs concurrently when PARALLEL_ENGINE=v1, otherwise sequentially in topological order.',
  icon: 'Split',
  color: '#3B82F6',
  executionMetadata: { kind: 'parallel' },
  isDynamicPorts: true,
  dynamicPorts: { kind: 'parallel-branches' },
  summaryTemplate: '{{branchCount}} branches',
  // SSOT for warnings (frontend canvas + backend handler.validate).
  // Mirror points:
  //  - branchCount range/integer rules from handler.validate
  //  - maxConcurrency range/integer rules from handler.validate
  //  - waitAll type rule from handler.validate
  // The mini-DSL rule below catches the most common mistake at canvas-badge
  // level (out-of-range branchCount); the typed/integer/cross-field guards
  // live in `validateConfig` because the mini-DSL has no Number.isInteger.
  warningRules: [
    {
      id: 'parallel:branch-count-out-of-range',
      when: 'branchCount < 2 || branchCount > 16',
      message: 'branchCount must be 2 to 16.',
    },
  ],
  validateConfig: validateParallelConfig,
};

```

---

### 파일 31: backend/src/nodes/logic/split/split.schema.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/logic/split/split.schema.spec.ts b/backend/src/nodes/logic/split/split.schema.spec.ts
index 6d375735..ca1d8ed8 100644
--- a/backend/src/nodes/logic/split/split.schema.spec.ts
+++ b/backend/src/nodes/logic/split/split.schema.spec.ts
@@ -27,7 +27,7 @@ describe('splitNodeMetadata.warningRules', () => {
 });
 
 describe('evaluateMetadataBlockingErrors integration (split)', () => {
-  it('emits the Korean warning when fieldPath is missing', () => {
+  it('emits the warning when fieldPath is missing', () => {
     expect(evaluateMetadataBlockingErrors(splitNodeMetadata, {})).toEqual([
       'Field path must be entered.',
     ]);

```

#### 전체 파일 컨텍스트
```
import { evaluateWarnings } from '@workflow/node-summary';
import { splitNodeMetadata } from './split.schema';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation';

describe('splitNodeMetadata.warningRules', () => {
  const firedIds = (config: unknown) =>
    evaluateWarnings(
      config as Record<string, unknown>,
      splitNodeMetadata.warningRules,
    ).map((w) => w.id);

  describe('split:no-field-path', () => {
    it('fires when fieldPath is missing', () => {
      expect(firedIds({})).toContain('split:no-field-path');
    });

    it('fires when fieldPath is empty string', () => {
      expect(firedIds({ fieldPath: '' })).toContain('split:no-field-path');
    });

    it('does NOT fire when fieldPath is set', () => {
      expect(firedIds({ fieldPath: '$input.items' })).not.toContain(
        'split:no-field-path',
      );
    });
  });
});

describe('evaluateMetadataBlockingErrors integration (split)', () => {
  it('emits the warning when fieldPath is missing', () => {
    expect(evaluateMetadataBlockingErrors(splitNodeMetadata, {})).toEqual([
      'Field path must be entered.',
    ]);
  });

  it('returns [] when fieldPath is set', () => {
    expect(
      evaluateMetadataBlockingErrors(splitNodeMetadata, {
        fieldPath: '$input.items',
      }),
    ).toEqual([]);
  });
});

```

---

### 파일 32: backend/src/nodes/logic/switch/switch.schema.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/logic/switch/switch.schema.spec.ts b/backend/src/nodes/logic/switch/switch.schema.spec.ts
index 937906fa..3c465cda 100644
--- a/backend/src/nodes/logic/switch/switch.schema.spec.ts
+++ b/backend/src/nodes/logic/switch/switch.schema.spec.ts
@@ -271,11 +271,9 @@ describe('Switch node schema', () => {
   });
 
   describe('evaluateMetadataBlockingErrors integration (switch)', () => {
-    it('emits both Korean warnings on a freshly-created node', () => {
+    it('emits both warnings on a freshly-created node', () => {
       const errors = evaluateMetadataBlockingErrors(switchNodeMetadata, {});
-      expect(errors).toContain(
-        'In Value mode, Switch Value must be entered.',
-      );
+      expect(errors).toContain('In Value mode, Switch Value must be entered.');
       expect(errors).toContain('At least one case must be added.');
     });
 

```

---

### 파일 33: backend/src/nodes/logic/variable-declaration/variable-declaration.schema.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/logic/variable-declaration/variable-declaration.schema.spec.ts b/backend/src/nodes/logic/variable-declaration/variable-declaration.schema.spec.ts
index 36457ac4..55629f47 100644
--- a/backend/src/nodes/logic/variable-declaration/variable-declaration.schema.spec.ts
+++ b/backend/src/nodes/logic/variable-declaration/variable-declaration.schema.spec.ts
@@ -72,7 +72,7 @@ describe('validateVariableDeclarationConfig (imperative)', () => {
 });
 
 describe('evaluateMetadataBlockingErrors integration (variable_declaration)', () => {
-  it('emits the Korean warning on a freshly-created node', () => {
+  it('emits the warning on a freshly-created node', () => {
     expect(
       evaluateMetadataBlockingErrors(variableDeclarationNodeMetadata, {}),
     ).toContain('At least one variable must be defined.');

```

#### 전체 파일 컨텍스트
```
import { evaluateWarnings } from '@workflow/node-summary';
import {
  validateVariableDeclarationConfig,
  variableDeclarationNodeMetadata,
} from './variable-declaration.schema';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation';

describe('variableDeclarationNodeMetadata.warningRules', () => {
  const firedIds = (config: unknown) =>
    evaluateWarnings(
      config as Record<string, unknown>,
      variableDeclarationNodeMetadata.warningRules,
    ).map((w) => w.id);

  describe('variable_declaration:no-variables', () => {
    it('fires when variables is missing', () => {
      expect(firedIds({})).toContain('variable_declaration:no-variables');
    });

    it('fires when variables is empty', () => {
      expect(firedIds({ variables: [] })).toContain(
        'variable_declaration:no-variables',
      );
    });

    it('does NOT fire when at least one variable is defined', () => {
      expect(
        firedIds({ variables: [{ name: 'x', type: 'string' }] }),
      ).not.toContain('variable_declaration:no-variables');
    });
  });

  describe('variable_declaration:first-variable-name-empty', () => {
    it('fires when first variable has no name', () => {
      expect(firedIds({ variables: [{ type: 'string' }] })).toContain(
        'variable_declaration:first-variable-name-empty',
      );
    });

    it('does NOT fire when first variable has a name', () => {
      expect(
        firedIds({ variables: [{ name: 'x', type: 'string' }] }),
      ).not.toContain('variable_declaration:first-variable-name-empty');
    });
  });
});

describe('validateVariableDeclarationConfig (imperative)', () => {
  it('returns [] for a valid variable', () => {
    expect(
      validateVariableDeclarationConfig({
        variables: [{ name: 'x', type: 'string' }],
      }),
    ).toEqual([]);
  });

  it('rejects variable without name', () => {
    expect(
      validateVariableDeclarationConfig({
        variables: [{ type: 'string' }],
      }),
    ).toContain('variables[0].name is required and must be a string');
  });

  it('rejects variable without type', () => {
    expect(
      validateVariableDeclarationConfig({
        variables: [{ name: 'x' }],
      }),
    ).toContain('variables[0].type is required and must be a string');
  });
});

describe('evaluateMetadataBlockingErrors integration (variable_declaration)', () => {
  it('emits the warning on a freshly-created node', () => {
    expect(
      evaluateMetadataBlockingErrors(variableDeclarationNodeMetadata, {}),
    ).toContain('At least one variable must be defined.');
  });

  it('returns [] when configured with a valid variable', () => {
    expect(
      evaluateMetadataBlockingErrors(variableDeclarationNodeMetadata, {
        variables: [{ name: 'x', type: 'string' }],
      }),
    ).toEqual([]);
  });
});

```

---

### 파일 34: backend/src/nodes/logic/variable-declaration/variable-declaration.schema.ts
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

### 파일 35: backend/src/nodes/logic/variable-modification/variable-modification.schema.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/logic/variable-modification/variable-modification.schema.spec.ts b/backend/src/nodes/logic/variable-modification/variable-modification.schema.spec.ts
index 7275bb47..daec2653 100644
--- a/backend/src/nodes/logic/variable-modification/variable-modification.schema.spec.ts
+++ b/backend/src/nodes/logic/variable-modification/variable-modification.schema.spec.ts
@@ -86,7 +86,7 @@ describe('validateVariableModificationConfig (imperative)', () => {
 });
 
 describe('evaluateMetadataBlockingErrors integration (variable_modification)', () => {
-  it('emits the Korean warning on a freshly-created node', () => {
+  it('emits the warning on a freshly-created node', () => {
     expect(
       evaluateMetadataBlockingErrors(variableModificationNodeMetadata, {}),
     ).toContain('At least one modification must be added.');

```

#### 전체 파일 컨텍스트
```
import { evaluateWarnings } from '@workflow/node-summary';
import {
  validateVariableModificationConfig,
  variableModificationNodeMetadata,
} from './variable-modification.schema';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation';

describe('variableModificationNodeMetadata.warningRules', () => {
  const firedIds = (config: unknown) =>
    evaluateWarnings(
      config as Record<string, unknown>,
      variableModificationNodeMetadata.warningRules,
    ).map((w) => w.id);

  describe('variable_modification:no-modifications', () => {
    it('fires when modifications is missing', () => {
      expect(firedIds({})).toContain('variable_modification:no-modifications');
    });

    it('fires when modifications is empty', () => {
      expect(firedIds({ modifications: [] })).toContain(
        'variable_modification:no-modifications',
      );
    });

    it('does NOT fire when modifications has entries', () => {
      expect(
        firedIds({ modifications: [{ variable: 'x', operation: 'set' }] }),
      ).not.toContain('variable_modification:no-modifications');
    });
  });

  describe('variable_modification:first-variable-empty', () => {
    it('fires when first modification has no variable', () => {
      expect(firedIds({ modifications: [{ operation: 'set' }] })).toContain(
        'variable_modification:first-variable-empty',
      );
    });

    it('does NOT fire when first modification has a variable', () => {
      expect(
        firedIds({ modifications: [{ variable: 'x', operation: 'set' }] }),
      ).not.toContain('variable_modification:first-variable-empty');
    });
  });
});

describe('validateVariableModificationConfig (imperative)', () => {
  it('returns [] for a valid modification', () => {
    expect(
      validateVariableModificationConfig({
        modifications: [{ variable: 'x', operation: 'set' }],
      }),
    ).toEqual([]);
  });

  it('rejects modification without variable', () => {
    expect(
      validateVariableModificationConfig({
        modifications: [{ operation: 'set' }],
      }),
    ).toContain('modifications[0].variable is required and must be a string');
  });

  it('rejects unknown operation', () => {
    const errors = validateVariableModificationConfig({
      modifications: [{ variable: 'x', operation: 'sploosh' }],
    });
    expect(errors.some((e) => e.startsWith('modifications[0].operation'))).toBe(
      true,
    );
  });

  it('rejects legacy operations removed from the enum (set_field/delete_field)', () => {
    // `set_field` / `delete_field` were removed from `modOperationSchema`
    // because the handler never implemented them. Keep them explicitly
    // rejected here to catch accidental re-introduction.
    for (const op of ['set_field', 'delete_field']) {
      expect(
        validateVariableModificationConfig({
          modifications: [{ variable: 'x', operation: op }],
        }).some((e) => e.startsWith('modifications[0].operation')),
      ).toBe(true);
    }
  });
});

describe('evaluateMetadataBlockingErrors integration (variable_modification)', () => {
  it('emits the warning on a freshly-created node', () => {
    expect(
      evaluateMetadataBlockingErrors(variableModificationNodeMetadata, {}),
    ).toContain('At least one modification must be added.');
  });

  it('returns [] when configured', () => {
    expect(
      evaluateMetadataBlockingErrors(variableModificationNodeMetadata, {
        modifications: [{ variable: 'x', operation: 'set' }],
      }),
    ).toEqual([]);
  });
});

```

---

### 파일 36: backend/src/nodes/logic/variable-modification/variable-modification.schema.ts
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
      .o

... (truncated due to prompt size limit) ...
```

---

### 파일 37: backend/src/nodes/presentation/carousel/carousel.schema.spec.ts
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

---

### 파일 38: backend/src/nodes/presentation/chart/chart.schema.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/presentation/chart/chart.schema.spec.ts b/backend/src/nodes/presentation/chart/chart.schema.spec.ts
index 8de3af13..de7f8e30 100644
--- a/backend/src/nodes/presentation/chart/chart.schema.spec.ts
+++ b/backend/src/nodes/presentation/chart/chart.schema.spec.ts
@@ -97,7 +97,7 @@ describe('validateChartConfig (imperative)', () => {
 });
 
 describe('evaluateMetadataBlockingErrors integration (chart)', () => {
-  it('emits Korean warning messages for axis-field omissions', () => {
+  it('emits warning messages for axis-field omissions', () => {
     const errors = evaluateMetadataBlockingErrors(chartMetadata, {
       chartType: 'bar',
       xAxis: {},

```

#### 전체 파일 컨텍스트
```
import { evaluateWarnings } from '@workflow/node-summary';
import { chartMetadata, validateChartConfig } from './chart.schema';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation';

describe('chartMetadata.warningRules', () => {
  const firedIds = (config: unknown) =>
    evaluateWarnings(
      config as Record<string, unknown>,
      chartMetadata.warningRules,
    ).map((w) => w.id);

  describe('chart:no-chart-type', () => {
    it('fires when chartType is missing', () => {
      expect(firedIds({})).toContain('chart:no-chart-type');
    });

    it('does NOT fire when chartType is set', () => {
      expect(
        firedIds({
          chartType: 'bar',
          xAxis: { field: 'a' },
          yAxis: { field: 'b' },
        }),
      ).not.toContain('chart:no-chart-type');
    });
  });

  describe('chart:no-x-axis-field', () => {
    it('fires when xAxis.field is missing or empty', () => {
      expect(firedIds({ chartType: 'bar', xAxis: {} })).toContain(
        'chart:no-x-axis-field',
      );
      expect(firedIds({ chartType: 'bar', xAxis: { field: '' } })).toContain(
        'chart:no-x-axis-field',
      );
    });

    it('fires when xAxis is missing entirely', () => {
      expect(firedIds({ chartType: 'bar' })).toContain('chart:no-x-axis-field');
    });

    it('does NOT fire when xAxis.field is set', () => {
      expect(
        firedIds({
          chartType: 'bar',
          xAxis: { field: 'a' },
          yAxis: { field: 'b' },
        }),
      ).not.toContain('chart:no-x-axis-field');
    });
  });

  describe('chart:no-y-axis-field', () => {
    it('fires when yAxis.field is missing or empty', () => {
      expect(
        firedIds({ chartType: 'bar', xAxis: { field: 'a' }, yAxis: {} }),
      ).toContain('chart:no-y-axis-field');
    });

    it('does NOT fire when yAxis.field is set', () => {
      expect(
        firedIds({
          chartType: 'bar',
          xAxis: { field: 'a' },
          yAxis: { field: 'b' },
        }),
      ).not.toContain('chart:no-y-axis-field');
    });
  });
});

describe('validateChartConfig (imperative)', () => {
  it('returns [] when no buttons configured', () => {
    expect(
      validateChartConfig({
        chartType: 'bar',
        xAxis: { field: 'a' },
        yAxis: { field: 'b' },
      }),
    ).toEqual([]);
  });

  it('forwards global buttons errors via shared validateButtons', () => {
    const errors = validateChartConfig({
      chartType: 'bar',
      xAxis: { field: 'a' },
      yAxis: { field: 'b' },
      buttons: [{ id: '', label: '', type: 'port' }],
    });
    expect(errors).toEqual(
      expect.arrayContaining([
        'buttons[0].id is required',
        'buttons[0].label is required and must be a string',
      ]),
    );
  });
});

describe('evaluateMetadataBlockingErrors integration (chart)', () => {
  it('emits warning messages for axis-field omissions', () => {
    const errors = evaluateMetadataBlockingErrors(chartMetadata, {
      chartType: 'bar',
      xAxis: {},
      yAxis: {},
    });
    expect(errors).toEqual(
      expect.arrayContaining([
        'X-axis field must be entered.',
        'Y-axis field must be entered.',
      ]),
    );
  });
});

```

---

### 파일 39: backend/src/nodes/presentation/form/form.schema.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/presentation/form/form.schema.spec.ts b/backend/src/nodes/presentation/form/form.schema.spec.ts
index 066ce5b5..ebe811e9 100644
--- a/backend/src/nodes/presentation/form/form.schema.spec.ts
+++ b/backend/src/nodes/presentation/form/form.schema.spec.ts
@@ -59,7 +59,7 @@ describe('optionSchema (select/radio/checkbox 옵션)', () => {
 });
 
 describe('evaluateMetadataBlockingErrors integration (form)', () => {
-  it('returns the Korean warning message for an empty form', () => {
+  it('returns the warning message for an empty form', () => {
     expect(evaluateMetadataBlockingErrors(formNodeMetadata, {})).toEqual([
       'At least one field must be defined.',
     ]);

```

#### 전체 파일 컨텍스트
```
import { evaluateWarnings } from '@workflow/node-summary';
import { formNodeMetadata, optionSchema } from './form.schema';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation';

describe('formNodeMetadata.warningRules', () => {
  const firedIds = (config: unknown) =>
    evaluateWarnings(
      config as Record<string, unknown>,
      formNodeMetadata.warningRules,
    ).map((w) => w.id);

  describe('form:no-fields', () => {
    it('fires when fields is empty', () => {
      expect(firedIds({ fields: [] })).toContain('form:no-fields');
    });

    it('fires when fields is missing entirely', () => {
      expect(firedIds({})).toContain('form:no-fields');
    });

    it('does NOT fire when at least one field is defined', () => {
      expect(
        firedIds({ fields: [{ name: 'email', type: 'email' }] }),
      ).not.toContain('form:no-fields');
    });
  });
});

describe('optionSchema (select/radio/checkbox 옵션)', () => {
  it('value 가 누락되면 빈 문자열로 default (undefined → "")', () => {
    const parsed = optionSchema.parse({ label: 'Yes' });
    expect(parsed.value).toBe('');
    expect(parsed.value).not.toBeUndefined();
  });

  it('label 이 누락되면 빈 문자열로 default', () => {
    const parsed = optionSchema.parse({});
    expect(parsed.label).toBe('');
    expect(parsed.value).toBe('');
  });

  it('명시적으로 설정한 value 는 보존 (boolean/number/string 모두)', () => {
    expect(optionSchema.parse({ value: true }).value).toBe(true);
    expect(optionSchema.parse({ value: 42 }).value).toBe(42);
    expect(optionSchema.parse({ value: 'opt-1' }).value).toBe('opt-1');
    expect(optionSchema.parse({ value: null }).value).toBeNull();
  });

  it('passthrough — 추가 메타 필드 보존', () => {
    const parsed = optionSchema.parse({
      label: 'A',
      value: 'a',
      description: 'extra',
      // Zod passthrough 는 런타임에 추가 필드를 보존하지만 추론 타입에는
      // 미반영되므로 cast 가 불가피.
    } as Record<string, unknown>);
    expect((parsed as Record<string, unknown>).description).toBe('extra');
  });
});

describe('evaluateMetadataBlockingErrors integration (form)', () => {
  it('returns the warning message for an empty form', () => {
    expect(evaluateMetadataBlockingErrors(formNodeMetadata, {})).toEqual([
      'At least one field must be defined.',
    ]);
  });

  it('returns [] when configured', () => {
    expect(
      evaluateMetadataBlockingErrors(formNodeMetadata, {
        fields: [{ name: 'email', type: 'email' }],
      }),
    ).toEqual([]);
  });
});

```

---

### 파일 40: backend/src/nodes/presentation/template/template.schema.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/presentation/template/template.schema.spec.ts b/backend/src/nodes/presentation/template/template.schema.spec.ts
index c0715865..b130ce5a 100644
--- a/backend/src/nodes/presentation/template/template.schema.spec.ts
+++ b/backend/src/nodes/presentation/template/template.schema.spec.ts
@@ -51,7 +51,7 @@ describe('validateTemplateConfig (imperative)', () => {
 });
 
 describe('evaluateMetadataBlockingErrors integration (template)', () => {
-  it('emits the Korean warning when template body is empty', () => {
+  it('emits the warning when template body is empty', () => {
     expect(evaluateMetadataBlockingErrors(templateNodeMetadata, {})).toContain(
       'Template body must be entered.',
     );

```

#### 전체 파일 컨텍스트
```
import { evaluateWarnings } from '@workflow/node-summary';
import {
  templateNodeMetadata,
  validateTemplateConfig,
} from './template.schema';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation';

describe('templateNodeMetadata.warningRules', () => {
  const firedIds = (config: unknown) =>
    evaluateWarnings(
      config as Record<string, unknown>,
      templateNodeMetadata.warningRules,
    ).map((w) => w.id);

  describe('template:no-template', () => {
    it('fires when template is missing', () => {
      expect(firedIds({})).toContain('template:no-template');
    });

    it('fires when template is empty string', () => {
      expect(firedIds({ template: '' })).toContain('template:no-template');
    });

    it('does NOT fire when template body is set', () => {
      expect(firedIds({ template: 'Hello {{name}}' })).not.toContain(
        'template:no-template',
      );
    });
  });
});

describe('validateTemplateConfig (imperative)', () => {
  it('returns [] when no buttons configured', () => {
    expect(
      validateTemplateConfig({ template: 'hi', outputFormat: 'html' }),
    ).toEqual([]);
  });

  it('forwards global buttons errors via shared validateButtons', () => {
    const errors = validateTemplateConfig({
      template: 'hi',
      buttons: [{ id: '', label: '', type: 'port' }],
    });
    expect(errors).toEqual(
      expect.arrayContaining([
        'buttons[0].id is required',
        'buttons[0].label is required and must be a string',
      ]),
    );
  });
});

describe('evaluateMetadataBlockingErrors integration (template)', () => {
  it('emits the warning when template body is empty', () => {
    expect(evaluateMetadataBlockingErrors(templateNodeMetadata, {})).toContain(
      'Template body must be entered.',
    );
  });

  it('returns [] when template is set and no buttons configured', () => {
    expect(
      evaluateMetadataBlockingErrors(templateNodeMetadata, {
        template: 'Hello',
      }),
    ).toEqual([]);
  });
});

```

---

### 파일 41: plan/in-progress/spec-update-cafe24-background-refresh.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/plan/in-progress/spec-update-cafe24-background-refresh.md b/plan/in-progress/spec-update-cafe24-background-refresh.md
new file mode 100644
index 00000000..5f2f26fb
--- /dev/null
+++ b/plan/in-progress/spec-update-cafe24-background-refresh.md
@@ -0,0 +1,40 @@
+---
+worktree: prod-rereview-fix-a7c93f
+started: 2026-05-16
+owner: developer
+---
+
+# spec-update — §11 만료 스캐너에 cafe24 background refresh 흐름 추가
+
+## 배경
+
+`1f3cb79..HEAD` 누적 변경 재리뷰(2026-05-16) 결과, `IntegrationExpiryScannerService` 에 신설된 **`enqueueCafe24BackgroundRefresh`** 흐름과 그를 가속하는 **`V050__integration_cafe24_connected_rotated_idx`** 마이그레이션이 `spec/2-navigation/4-integration.md §11` 에 문서화되어 있지 않다.
+
+## 사실 관계
+
+- `backend/src/modules/integrations/integration-expiry-scanner.service.ts` 에 `enqueueCafe24BackgroundRefresh` 와 `JOB_CAFE24_BACKGROUND_REFRESH` 가 추가되어, `service_type='cafe24' AND status='connected' AND lastRotatedAt < cutoff` (또는 NULL) 행에 대해 BullMQ refresh job 을 enqueue 한다.
+- `V049__integration_consecutive_network_failures` (3회 연속 실패 카운터) 와 `V050__integration_cafe24_connected_rotated_idx` (`CREATE INDEX CONCURRENTLY` 부분 인덱스) 가 함께 들어왔다.
+- `spec/2-navigation/4-integration.md §11.1` 의 "스캐너 잡" 박스가 `connected-expiry` / `pending-install-ttl` / `usage-log-prune` 3개만 기술하고, neue `cafe24-background-refresh` job 은 빠져 있다.
+- §6 "상태 전이" 의 `connected → error(network) | 노드 실행 중 커넥션 실패가 3회 연속` 항은 이미 있다 — 이 항이 V049 의 카운터·임계값과 정합. 추가 갱신 필요 없음.
+
+## 제안 (project-planner 에게 위임)
+
+`spec/2-navigation/4-integration.md` 의 다음 두 위치를 갱신한다.
+
+1. **§11 상단 안내문** — 세 개 BullMQ job 목록을 **네 개** 로 정정 (`connected-expiry` / `pending-install-ttl` / `usage-log-prune` / **`cafe24-background-refresh`**).
+2. **§11.x 신규 소절** — cafe24-background-refresh 의 책임 한 줄 + 대상 행 조건 (`service_type='cafe24' AND status='connected' AND (lastRotatedAt IS NULL OR lastRotatedAt < now() - <threshold>)`) + 결과(`Cafe24ApiClient.refreshAccessToken` 큐 위임).
+3. **§11.1 스캐너 잡 박스** — `cafe24-background-refresh` 한 줄 추가 (의사코드 1–2줄).
+4. Rationale 끝부분에 "왜 별도 job 으로 분리하는가" 메모: `connected-expiry` 의 일일 1회 알림 흐름과 분리해 retry/메트릭 격리, partial index(`V050`) 로 운영 부하 최소화.
+
+위 4개 항목은 한 차례 `project-planner` 세션으로 묶어 처리할 수 있다.
+
+## 영향
+
+- 영역 문서 외부 영향 없음 (구현은 이미 main 에 있음).
+- spec 만 최신화하면 onboarding · 운영자 안내 일관성 복구.
+
+## 진행 상태
+
+- [ ] project-planner 진입해 위 4개 항목 작성
+- [ ] `/consistency-check --spec` 통과 확인
+- [ ] PR merge 시 본 plan 을 `plan/complete/` 로 `git mv`

```

#### 전체 파일 컨텍스트
```
---
worktree: prod-rereview-fix-a7c93f
started: 2026-05-16
owner: developer
---

# spec-update — §11 만료 스캐너에 cafe24 background refresh 흐름 추가

## 배경

`1f3cb79..HEAD` 누적 변경 재리뷰(2026-05-16) 결과, `IntegrationExpiryScannerService` 에 신설된 **`enqueueCafe24BackgroundRefresh`** 흐름과 그를 가속하는 **`V050__integration_cafe24_connected_rotated_idx`** 마이그레이션이 `spec/2-navigation/4-integration.md §11` 에 문서화되어 있지 않다.

## 사실 관계

- `backend/src/modules/integrations/integration-expiry-scanner.service.ts` 에 `enqueueCafe24BackgroundRefresh` 와 `JOB_CAFE24_BACKGROUND_REFRESH` 가 추가되어, `service_type='cafe24' AND status='connected' AND lastRotatedAt < cutoff` (또는 NULL) 행에 대해 BullMQ refresh job 을 enqueue 한다.
- `V049__integration_consecutive_network_failures` (3회 연속 실패 카운터) 와 `V050__integration_cafe24_connected_rotated_idx` (`CREATE INDEX CONCURRENTLY` 부분 인덱스) 가 함께 들어왔다.
- `spec/2-navigation/4-integration.md §11.1` 의 "스캐너 잡" 박스가 `connected-expiry` / `pending-install-ttl` / `usage-log-prune` 3개만 기술하고, neue `cafe24-background-refresh` job 은 빠져 있다.
- §6 "상태 전이" 의 `connected → error(network) | 노드 실행 중 커넥션 실패가 3회 연속` 항은 이미 있다 — 이 항이 V049 의 카운터·임계값과 정합. 추가 갱신 필요 없음.

## 제안 (project-planner 에게 위임)

`spec/2-navigation/4-integration.md` 의 다음 두 위치를 갱신한다.

1. **§11 상단 안내문** — 세 개 BullMQ job 목록을 **네 개** 로 정정 (`connected-expiry` / `pending-install-ttl` / `usage-log-prune` / **`cafe24-background-refresh`**).
2. **§11.x 신규 소절** — cafe24-background-refresh 의 책임 한 줄 + 대상 행 조건 (`service_type='cafe24' AND status='connected' AND (lastRotatedAt IS NULL OR lastRotatedAt < now() - <threshold>)`) + 결과(`Cafe24ApiClient.refreshAccessToken` 큐 위임).
3. **§11.1 스캐너 잡 박스** — `cafe24-background-refresh` 한 줄 추가 (의사코드 1–2줄).
4. Rationale 끝부분에 "왜 별도 job 으로 분리하는가" 메모: `connected-expiry` 의 일일 1회 알림 흐름과 분리해 retry/메트릭 격리, partial index(`V050`) 로 운영 부하 최소화.

위 4개 항목은 한 차례 `project-planner` 세션으로 묶어 처리할 수 있다.

## 영향

- 영역 문서 외부 영향 없음 (구현은 이미 main 에 있음).
- spec 만 최신화하면 onboarding · 운영자 안내 일관성 복구.

## 진행 상태

- [ ] project-planner 진입해 위 4개 항목 작성
- [ ] `/consistency-check --spec` 통과 확인
- [ ] PR merge 시 본 plan 을 `plan/complete/` 로 `git mv`

```

---

### 파일 42: review/code/2026/05/16/11_04_17/RESOLUTION.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/code/2026/05/16/11_04_17/RESOLUTION.md b/review/code/2026/05/16/11_04_17/RESOLUTION.md
new file mode 100644
index 00000000..2cf23850
--- /dev/null
+++ b/review/code/2026/05/16/11_04_17/RESOLUTION.md
@@ -0,0 +1,73 @@
+# RESOLUTION — Prod re-review (1f3cb79..HEAD)
+
+세션: `review/code/2026/05/16/11_04_17`
+조치 branch: `claude/prod-rereview-fix-a7c93f`
+worktree: `.claude/worktrees/prod-rereview-fix-a7c93f`
+조치 일시: 2026-05-16
+
+본 문서는 `SUMMARY.md` 의 Critical / Warning / INFO 항목에 대한 조치 결과를 기록한다.
+
+---
+
+## Critical
+
+| # | 항목 | 조치 |
+|---|------|------|
+| C1 | `cafe24-api.client.ts` diff 누락으로 REQ-C2 비즈니스 로직 검증 불가 | **검증 완료 — 코드 정상**. `recordNetworkFailure()` (L644-678) 가 transport 실패 시 카운터 +1, 3 도달 시 `status='error', statusReason='network'` 전이 + 카운터 리셋. `resetNetworkFailures()` (L680-692) 가 정상 HTTP 응답 직후 0 으로 리셋. transport 실패는 `executeWithRateLimit` (L731) 과 `refreshAccessToken` (L469) 두 경로에서 호출. spec §6 의 `connected → error(network) | 3회 연속` 전이 이행. 코드 변경 없음. |
+
+## Warning
+
+| # | 항목 | 조치 |
+|---|------|------|
+| W1 | `OAuthBeginResultDto` required→optional union-in-class 타입 안전성 | **코드 정정**. (a) `authorizeUrl` 필드명을 실제 wire shape (`authUrl`) 으로 정정 — 사전부터 있던 DTO/wire 불일치 버그를 함께 해소. (b) `OAuthBeginPopupResultDto` (`authUrl`, `state` required) + `OAuthBeginCafe24PendingResultDto` (`mode`, `integrationId`, `appUrl`, `callbackUrl` required) 두 분기 DTO 추가. (c) `ApiOkWrappedOneOfResponse([Popup, Cafe24Pending], ...)` 헬퍼 신설. (d) `/oauth/begin`, `:id/reauthorize`, `:id/request-scopes` 3 endpoint 에 적용. (e) Swagger 콘솔이 두 분기를 명시적으로 노출. 호환 alias 클래스는 제거 (사용자 없음). 프론트엔드 `OAuthBeginResult` 는 이미 discriminated union 이라 호환. |
+| W2 | `consumePreviewToken` 평문 자격증명 hard-fail 회귀 위험 | **운영 환경 점검 항목**. 코드 변경 없음. 배포 전 `SELECT count(*) FROM integrations WHERE credentials::text NOT LIKE 'enc:%';` 로 레거시 미암호화 행 수 확인 후, 존재 시 재암호화 또는 무효화 마이그레이션 권장. 운영자에게 위임. |
+| W3 | `WARNING_KO` 매핑 누락 위험 (영문 SoT 전환) | **검증 완료 — 누락 없음**. `git diff 1f3cb79..HEAD -- 'backend/src/nodes/'` 에서 추출한 새 영문 message 46건과 `frontend/src/lib/i18n/backend-labels.ts` 의 `WARNING_KO` 53키를 자동 대조. 모두 ko 매핑 존재. "missing" 으로 잡힌 2건 (`missing scope: mall.write_product`, `whatever`) 은 cafe24 API 테스트 픽스처 (mock response error_message) 로 warningRule 이 아님 — 진짜 누락 0건. |
+| W4 / W15 | `sanitizeLastErrorMessage` 언더스코어 패턴 커버 불명확 | **검증 완료 — 커버됨**. 정규식 `client[_-]secret|access[_-]token|refresh[_-]token|id[_-]token|api[_-]key|password|passwd|pwd` 이 underscore/hyphen 양쪽 매칭. `integration-oauth.service.spec.ts` L533-552 가 `client_secret=`, `access_token:`, `refresh_token=` 마스킹을 이미 검증. 코드 변경 없음. |
+| W5 | `switch.schema.ts` 조건-메시지 의미 괴리 | **검증 — 의도된 동작**. zod 스키마 default 가 `mode='value'` 이고, `mode != expression` 은 (null/undefined → default 'value') 도 포함. 사용자 facing 메시지 "In Value mode..." 는 정확. L209-212 의 기존 주석이 이미 의도를 명시. 변경 없음. |
+| W6 | `pending_install` 제외 동작 (REQ-C1) 전용 테스트 부재 | **테스트 추가**. `integration-expiry-scanner.service.spec.ts` 에 `excludes pending_install from the run() candidate query (REQ-C1)` 추가 — `Not(In(['expired', 'error', 'pending_install']))` operator 의 내부 `_value` 를 직접 검증. |
+| W7 | `cafe24-token-refresh.processor.spec.ts` 중복 테스트 | **중복 제거**. L125-135 의 동일 it() 제거. 1개 propagation 테스트만 유지. |
+| W8 | `OAuthBeginResultDto` 분기별 필드 존재/부재 단언 부재 | **테스트 보강**. `integration-oauth.service.cafe24.spec.ts` 의 (a) Public 분기에 Private 전용 필드 (`mode`, `integrationId`, `appUrl`, `callbackUrl`) 의 `toBeUndefined()` 단언 추가, (b) Private 분기에 Public 전용 필드 (`authUrl`, `state`) 의 `toBeUndefined()` 단언 추가. |
+| W9 | `spec/2-navigation/4-integration.md` 갱신 여부 불명확 | **부분 동기**. §6 (network failure 3회), §9.2 (OAuthBeginResult 두 분기), §2.4 (pending_install 제외) 모두 이미 반영됨. §11 (cafe24-background-refresh 신규 BullMQ job) 만 미문서화 — `plan/in-progress/spec-update-cafe24-background-refresh.md` 에 spec-update 노트 작성, `project-planner` 위임 대기. |
+| W10 | "Korean warning" describe 잔존 (영문 SoT 전환과 부정합) | **일괄 치환**. 22개 spec/소스 파일에서 `Korean warning` → `warning`, `Korean warnings` → `warnings`, `Korean messages` → `warning messages` 로 perl 인플레이스 치환. 검증 명령 0건. |
+| W11 | 단일 PR 에 두 독립 관심사 혼재 (cafe24 + i18n SoT 전환) | **이력 사실 — 조치 없음**. 이미 main 에 merge 된 상태이므로 PR 단위 분리는 불가. 다음 작업부터는 관심사 분리. |
+| W12 | `V050__*.conf` 주석 부재 | **주석 추가**. `executeInTransaction=false` 가 PostgreSQL `CREATE INDEX CONCURRENTLY` 가 트랜잭션 안에서 실행 불가하기 때문에 Flyway 의 자동 트랜잭션 wrap 을 끄는 옵션임을 5줄 주석으로 명시. |
+| W13 | `llm-provider-rule.ts` JSDoc 의 SoT 명시 부재 | **JSDoc 보강**. 모듈 상단 주석에 `**Language SoT**: 본 메시지는 English 가 single source of truth 이며, 프론트엔드 WARNING_KO 가 ko 번역을 담당` 한 단락 추가. |
+
+## INFO (참고)
+
+| # | 항목 | 결정 |
+|---|------|------|
+| I1 | `consecutiveNetworkFailures` 카운터·상태 전이 원자성 | `recordNetworkFailure()` 가 단일 `integrationRepository.update()` 호출로 카운터·status·statusReason·lastError 를 함께 갱신 — 트랜잭션 한 줄로 원자. `executeWithRateLimit` 의 catch 블록 이후 throw 까지 race 가 없는 구조. 추가 조치 불필요. |
+| I2 | `enqueueCafe24BackgroundRefresh` 전체 메모리 로드 | 현 통합 수 (수백 행 추정) 에서 영향 미미. 통합 수가 수만 건으로 늘 경우 cursor 기반 배치로 전환 권장 — 별도 plan. |
+| I3 | `refreshViaQueue` 타임아웃 복구 경로 이중 findOne | 드문 경로 (QueueEvents 이벤트 누락 시) — 최적화 가치 낮음. 보류. |
+| I4 | API 클라이언트의 도메인 상태 직접 변경 (REQ-C2) | 현 규모 수용 가능. 향후 `IntegrationNetworkHealthService` 분리 검토. |
+| I5 | 임계값 `3` magic number 분산 | `cafe24-token-refresh.constants.ts` 같은 곳에 `CONSECUTIVE_NETWORK_FAILURE_THRESHOLD = 3` 상수 도입 권장 — 후속 cleanup. |
+| I6 | `OAuthBeginResultDto` union-in-class | W1 에서 해소 — 분기 DTO 두 개로 split + oneOf 스키마. |
+| I7 | `backend-labels.ts` 의 CI exhaustive 검증 | `WARNING_KO` 매핑 누락을 빌드 시 차단하는 스냅샷 테스트 추가 권장 — 후속 plan. |
+| I8 | TypeORM 내부 구조 직접 검사 (`_value`) | `excludes pending_install` 신규 테스트도 동일 패턴 사용 — 안정적이지만, TypeORM upgrade 시 깨질 위험은 동일. e2e 보호 라인 보강은 후속. |
+| I9 | `registry.test.ts` 의 `it.runIf(hasRealDocs)` skip | CI 환경에서 `content/docs` 존재 보장. skip 가시화는 후속. |
+| I10 | 배포 직후 BullMQ refresh 큐 급증 위험 | 운영 모니터링 — 배포 직후 큐 길이 / job 처리 시간 dashboard 확인. |
+| I11 | `docker compose run --build` 최소 버전 | Compose v2.12.0+. CI / 로컬 환경 모두 v2.20+ 보유 확인. README 명시는 후속 plan. |
+| I12 | 노드 메타데이터 언어 정책 미문서화 | English SoT 정책을 `spec/conventions/` 에 명시 — 별도 plan 으로. |
+
+---
+
+## TEST WORKFLOW 결과
+
+| 단계 | 결과 | 비고 |
+|------|------|------|
+| backend lint | ✅ 0 errors, 17 warnings | warnings 는 `migrate-node-output-refs.ts` 일회성 스크립트의 `any` 사용 — 사전부터 있는 것 |
+| backend unit test | ✅ 206 suites, 3649 tests pass | 신규 추가 테스트 (pending_install 제외 + 분기 필드 단언) 포함 |
+| backend build | ✅ nest build 성공 | |
+| frontend lint | ✅ 0 errors | |
+| frontend unit test | ⚠️ 1 flaky test pass-in-isolation | `execution-list-page.test.tsx > navigates to execution detail on row click` — 전체 suite 실행 시 `findByText("Completed")` 가 filter 버튼 + 행 status 와 중복 매칭. 단독 실행 시 통과. **사전부터 있던 이슈** (test 셀렉터가 비유니크). 내 변경과 무관. follow-up plan 으로 처리 권장. |
+| frontend build | ✅ next build 성공 | |
+| e2e (`make e2e-test`) | ✅ 12 suites, 66 tests pass | 18.5s 소요. integration-credentials / schedule-trigger / webhook-trigger / workflow-assistant 등 모든 영역 통과 |
+
+## 미해결 항목 (사용자 / 후속)
+
+1. **운영 DB 점검**: 배포 전 `credentials NOT LIKE 'enc:%'` 행 수 확인 (W2).
+2. **`spec/2-navigation/4-integration.md §11` 갱신**: `cafe24-background-refresh` BullMQ job 문서화 — `plan/in-progress/spec-update-cafe24-background-refresh.md` → `project-planner` 위임 (W9).
+3. **Frontend flaky test 안정화**: `execution-list-page.test.tsx` 의 `findByText` 셀렉터를 `getByRole('cell', ...)` 같은 유니크 셀렉터로 교체 (별도 PR).
+4. **CI 스냅샷 검증 추가**: `WARNING_KO` 매핑 누락을 빌드 시 차단 (I7).
+5. **임계값 상수화**: `CONSECUTIVE_NETWORK_FAILURE_THRESHOLD = 3` (I5).

```
