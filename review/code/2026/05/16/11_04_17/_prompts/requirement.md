# 요구사항(Requirement) Review Payload

본 파일은 orchestrator 가 요구사항(Requirement) reviewer 용으로 작성한 입력입니다. 다음 코드 변경이 의도한 기능을 충족하는지 분석한다.
sub-agent 의 system prompt 에 정의된 호출 규약·등급 기준·출력 형식을 그대로
따르되, 분석 시 아래 "점검 관점" 을 빠짐없이 적용하세요. 결과는 `output_file`
인자에 review.md 로 Write 하고 호출자에게는 STATUS 한 줄만 반환합니다.

## 점검 관점 (요구사항(Requirement))

1. **기능 완전성**: 코드가 의도한 기능을 완전히 구현하고 있는지
2. **엣지 케이스**: 경계값, null/undefined, 빈 컬렉션, 최대/최솟값 처리
3. **TODO/FIXME**: 미완성 작업을 시사하는 TODO, FIXME, HACK, XXX 주석 존재 여부
4. **의도와 구현 간 괴리**: 함수명·주석과 실제 구현의 일치
5. **에러 시나리오**: 정상 흐름 외 에러 상황 동작 정의
6. **데이터 유효성**: 입력 데이터의 유효성 검증
7. **비즈니스 로직**: 비즈니스 규칙이 코드에 정확히 반영됐는지
8. **반환값**: 모든 경로에서 적절한 값을 반환하는지

## 리뷰 대상 파일

### 파일 1: CHANGELOG.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/CHANGELOG.md b/CHANGELOG.md
index ab0dc6fc..00f5d76f 100644
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -2,7 +2,7 @@
 
 ## Unreleased — Node Output Contract Unification
 
-Implements the CONVENTIONS rulebook in `user_memo/node-specs-improvement/CONVENTIONS.md` across all 26+ node handlers. Split over staged refactors (Stage 1–7 + follow-ups) all landing in this release.
+Implements the CONVENTIONS rulebook in `spec/conventions/node-output.md` across all 26+ node handlers. Split over staged refactors (Stage 1–7 + follow-ups) all landing in this release.
 
 ### Breaking changes
 
@@ -71,3 +71,7 @@ See [Spec 실행 엔진 §6.3](spec/5-system/4-execution-engine.md#63-재실행
      --workspace-id <uuid> --user-id <uuid>
    ```
 5. **Verify** by running representative workflows. The migration is idempotent — re-running is safe.
+
+### Test infrastructure
+
+- **`make e2e-*` 가 매 실행마다 backend 이미지를 자동 rebuild** — `Makefile` 의 `e2e-up` / `e2e-test` / `e2e-test-full` 가 `docker compose ... --build` 를 명시. 누락 시 Docker layer cache 에 박힌 stale 이미지가 재사용되어 새로 추가한 컨트롤러 (예: `BackgroundRunsController`, `ThirdPartyOAuthController`) 가 컨테이너에 반영되지 않고 e2e 가 사일런트 404 로 실패하는 회귀가 발생함 (2026-05-15 background-monitoring 사례). BuildKit layer cache 가 변경 없는 layer 는 재사용하므로 첫 build 이후 부담은 작음.

```

---

### 파일 2: Makefile
- 변경 유형: Review
- 언어: 

#### 변경된 코드
```
diff --git a/Makefile b/Makefile
index 5507b19b..fbde9190 100644
--- a/Makefile
+++ b/Makefile
@@ -9,13 +9,17 @@ COMPOSE_E2E := docker compose -f docker-compose.e2e.yml
 
 help:
 	@echo "Targets:"
-	@echo "  e2e-up         e2e 인프라 + backend-e2e 까지 백그라운드 기동 (runner 제외)"
+	@echo "  e2e-up         e2e 인프라 + backend-e2e 까지 백그라운드 기동 (runner 제외, 자동 image rebuild)"
 	@echo "  e2e-down       e2e 리소스 정리 (volume·orphan 모두)"
-	@echo "  e2e-test       backend e2e (supertest) 1-shot — 끝나면 자동 down"
-	@echo "  e2e-test-full  backend + playwright 까지 — 끝나면 자동 down"
+	@echo "  e2e-test       backend e2e (supertest) 1-shot — 자동 image rebuild, 끝나면 자동 down"
+	@echo "  e2e-test-full  backend + playwright — 자동 image rebuild, 끝나면 자동 down"
 
+# `--build` 는 source 변경 후 stale 이미지 사용을 방지한다. Docker BuildKit
+# layer cache 가 변경되지 않은 layer 는 재사용하므로 첫 build 이후 부담은 작다.
+# 누락 시 새로 추가한 controller / 라우트가 컨테이너에 반영되지 않아 e2e 가
+# 사일런트하게 404 로 실패한다 (예: 2026-05-15 background-monitoring 사전 결함).
 e2e-up:
-	$(COMPOSE_E2E) up -d --wait backend-e2e
+	$(COMPOSE_E2E) up -d --wait --build backend-e2e
 
 e2e-down:
 	$(COMPOSE_E2E) down -v --remove-orphans
@@ -24,12 +28,21 @@ e2e-down:
 # `--abort-on-container-exit` 패턴은 Docker Desktop 의 network race 와 충돌하는
 # 사례가 있어 분리. 실패하더라도 후속 e2e-down 이 실행되도록 `; STATUS=$$?` 패턴 사용.
 e2e-test:
-	$(COMPOSE_E2E) up -d --wait backend-e2e
-	$(COMPOSE_E2E) run --rm backend-e2e-runner; STATUS=$$?; \
+	$(COMPOSE_E2E) up -d --wait --build backend-e2e
+	$(COMPOSE_E2E) run --rm --build backend-e2e-runner; STATUS=$$?; \
 	$(MAKE) e2e-down; exit $$STATUS
 
+# `e2e-test` 와 패턴이 약간 달라 보이지만 동작은 일치한다.
+# `runner1 && runner2; STATUS=$$?` 형태로, runner1 실패 시 `&&` 가 short-circuit
+# 하여 runner2 가 skip 되고, `$$?` 는 마지막 실행된 명령의 exit code 를 캡처한다
+# (runner1 실패 → STATUS=runner1 exit, runner2 실패 → STATUS=runner2 exit, 둘 다
+# 성공 → 0). e2e-down 은 항상 실행되며 최종 exit 코드는 STATUS.
+#
+# 설계 의도: runner1 (backend e2e) 실패 시 runner2 (playwright) 는 실행하지
+# 않는다 — 백엔드 e2e 통과가 frontend e2e 의 선행 조건이며, 백엔드가 깨진
+# 상태에서 playwright 를 돌려 노이즈 실패를 발생시키지 않기 위함.
 e2e-test-full:
-	$(COMPOSE_E2E) up -d --wait backend-e2e
-	$(COMPOSE_E2E) run --rm backend-e2e-runner && \
-	  $(COMPOSE_E2E) run --rm playwright-runner; STATUS=$$?; \
+	$(COMPOSE_E2E) up -d --wait --build backend-e2e
+	$(COMPOSE_E2E) run --rm --build backend-e2e-runner && \
+	  $(COMPOSE_E2E) run --rm --build playwright-runner; STATUS=$$?; \
 	$(MAKE) e2e-down; exit $$STATUS

```

---

### 파일 3: README.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/README.md b/README.md
index 76cda30e..df5a0774 100644
--- a/README.md
+++ b/README.md
@@ -74,8 +74,9 @@ Client (Next.js SPA)
 
 ```
 ./
-├── prd/                        # 제품 요구 사항 정의서 (PRD)
-├── spec/                       # 기술 스펙 문서 (SDD)
+├── spec/                       # 제품 정의·기술 명세 (single source of truth — 옛 prd/ 도 흡수)
+├── plan/                       # 작업 추적 (in-progress/ ↔ complete/)
+├── review/                     # 코드 리뷰·일관성 검토 산출물 (시점별)
 ├── frontend/                   # 클라이언트 (Next.js)
 │   └── src/
 │       ├── app/                #   App Router 페이지
@@ -227,9 +228,22 @@ npm run dev
 | 테스트 | `npm run test` | `npm run test` |
 | 테스트 (E2E) | - | `npm run test:e2e` |
 
+### 격리 인프라 기반 e2e (`make e2e-*`)
+
+`docker-compose.e2e.yml` 의 격리 Postgres/Redis/MinIO 위에서 backend e2e 와 playwright 를 실행한다. 개발용 인프라(`docker-compose.yml`) 와 `name:` top-level key 가 다르므로 동시 기동해도 충돌 없음.
+
+```bash
+make e2e-test        # backend supertest 1-shot (~30–60s). 끝나면 자동 down
+make e2e-test-full   # backend + playwright. 끝나면 자동 down
+make e2e-up          # 인프라 + backend-e2e 만 백그라운드 기동 (runner 제외)
+make e2e-down        # 정리 (volume·orphan 모두)
+```
+
+빌드 타겟 세 개 (`e2e-up`, `e2e-test`, `e2e-test-full`) 모두 매 실행 시 `docker compose ... --build` 로 backend 이미지를 갱신한다 (`e2e-down` 은 정리 전용이라 제외). BuildKit layer cache 가 변경 없는 layer 는 재사용하므로 첫 build 이후 오버헤드는 작고, 새로 추가한 컨트롤러·라우트가 stale 이미지에 반영되지 않아 사일런트 404 로 실패하는 회귀를 차단한다.
+
 ### 문서 링크 검증
 
-`prd/`, `spec/` 의 markdown 내부 링크와 `frontend/src/content/docs/**.mdx` frontmatter `spec:` 항목 정합성을 확인한다.
+`spec/` 의 markdown 내부 링크와 `frontend/src/content/docs/**.mdx` frontmatter `spec:` 항목 정합성을 확인한다.
 
 ```bash
 python3 scripts/check-doc-links.py
@@ -238,7 +252,7 @@ python3 scripts/check-doc-links.py
 - 종료 코드: 깨진 항목이 있으면 `1`, 모두 정상이면 `0`
 - 의존성 없음 (Python 3 표준 라이브러리만 사용)
 - 검사 항목: 파일 경로 존재 여부, anchor (`#section`) 가 대상 파일 헤딩 슬러그에 매칭되는지, MDX `spec:` 배열의 모든 경로 존재 여부
-- PR 머지 전 또는 spec/PRD 헤딩을 변경한 후 한 번씩 돌려서 cross-reference 깨짐을 잡는 용도
+- PR 머지 전 또는 spec 헤딩을 변경한 후 한 번씩 돌려서 cross-reference 깨짐을 잡는 용도
 
 ### 운영 스크립트 (backend/scripts)
 

```

---

### 파일 4: backend/migrations/V049__integration_consecutive_network_failures.sql
- 변경 유형: Review
- 언어: sql

#### 변경된 코드
```
diff --git a/backend/migrations/V049__integration_consecutive_network_failures.sql b/backend/migrations/V049__integration_consecutive_network_failures.sql
new file mode 100644
index 00000000..92fb648d
--- /dev/null
+++ b/backend/migrations/V049__integration_consecutive_network_failures.sql
@@ -0,0 +1,18 @@
+-- spec/2-navigation/4-integration.md §6 의 `connected → error(network) | 노드
+-- 실행 중 커넥션 실패 3회 연속` 상태 전이를 위해 연속 transport 실패
+-- 카운터를 Integration 행에 추가한다.
+--
+-- 의도:
+-- * Cafe24ApiClient 의 fetch 실패 시 +1, 성공 시 0 으로 리셋.
+-- * 3 도달 시점에 `status='error', status_reason='network'` 전이 + 카운터 리셋.
+-- * 사용자가 reauthorize 또는 Rotate credentials 로 status 를 `connected`
+--   로 되돌리면 카운터도 함께 초기화.
+--
+-- 컬럼은 NOT NULL DEFAULT 0 — 기존 행은 0 으로 backfill 되어 다음 호출
+-- 시점부터 카운터가 정상 동작한다. spec 의도와 동일.
+
+ALTER TABLE integration
+  ADD COLUMN consecutive_network_failures INT NOT NULL DEFAULT 0;
+
+COMMENT ON COLUMN integration.consecutive_network_failures IS
+  'Consecutive transport-level failures on this integration. Incremented by the API client on fetch errors, reset to 0 on success. Triggers status=error, status_reason=network at 3 (spec §6).';

```

---

### 파일 5: backend/migrations/V050__integration_cafe24_connected_rotated_idx.conf
- 변경 유형: Review
- 언어: conf

#### 변경된 코드
```
diff --git a/backend/migrations/V050__integration_cafe24_connected_rotated_idx.conf b/backend/migrations/V050__integration_cafe24_connected_rotated_idx.conf
new file mode 100644
index 00000000..73bd53a1
--- /dev/null
+++ b/backend/migrations/V050__integration_cafe24_connected_rotated_idx.conf
@@ -0,0 +1 @@
+executeInTransaction=false

```

---

### 파일 6: backend/migrations/V050__integration_cafe24_connected_rotated_idx.sql
- 변경 유형: Review
- 언어: sql

#### 변경된 코드
```
diff --git a/backend/migrations/V050__integration_cafe24_connected_rotated_idx.sql b/backend/migrations/V050__integration_cafe24_connected_rotated_idx.sql
new file mode 100644
index 00000000..e8acabfe
--- /dev/null
+++ b/backend/migrations/V050__integration_cafe24_connected_rotated_idx.sql
@@ -0,0 +1,25 @@
+-- DB H-1: `IntegrationExpiryScannerService.enqueueCafe24BackgroundRefresh`
+-- 의 일일 쿼리 `WHERE service_type='cafe24' AND status='connected' AND
+-- last_rotated_at < cutoff` 를 부분 인덱스로 가속한다.
+--
+-- 옛 상태:
+--   - 기존 인덱스: idx_integration_workspace_status (workspace_id, status),
+--     idx_integration_workspace_service (workspace_id, service_type),
+--     idx_integration_token_expires_at (token_expires_at WHERE NOT NULL).
+--   - 세 컬럼 조합 (service_type='cafe24', status='connected', last_rotated_at)
+--     을 직접 커버하는 인덱스 없음 → 통합 row 수가 늘면 PostgreSQL 이
+--     workspace_id 인덱스의 부분 스캔 또는 seq scan 으로 떨어질 가능성.
+--
+-- 새 인덱스:
+--   - 부분 인덱스 — `service_type='cafe24' AND status='connected'` 인 행
+--     만 포함. cafe24 통합은 전체 통합 중 일부이고 connected 상태도 일부
+--     라 인덱스 크기가 매우 작다.
+--   - 키 컬럼 `last_rotated_at` 로 정렬 → `< cutoff` 범위 스캔 O(log N).
+--   - `last_rotated_at IS NULL` 행은 인덱스에 포함되며 NULL 정렬 위치는
+--     기본 ASC 에서 가장 끝 (PostgreSQL NULLS LAST 기본).
+--
+-- spec/2-navigation/4-integration.md §11 의 background refresh 패스 운영
+-- 비용 최소화. 인덱스 생성은 CONCURRENTLY 로 zero-downtime.
+CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_integration_cafe24_connected_rotated
+  ON integration (last_rotated_at)
+  WHERE service_type = 'cafe24' AND status = 'connected';

```

---

### 파일 7: backend/src/modules/integrations/dto/responses/integration-response.dto.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/modules/integrations/dto/responses/integration-response.dto.ts b/backend/src/modules/integrations/dto/responses/integration-response.dto.ts
index 44f598db..b4b58159 100644
--- a/backend/src/modules/integrations/dto/responses/integration-response.dto.ts
+++ b/backend/src/modules/integrations/dto/responses/integration-response.dto.ts
@@ -171,15 +171,61 @@ export class PreviewTestResultDto {
   preview?: McpConnectionPreviewDto;
 }
 
-/** OAuth 시작 결과 */
+/**
+ * OAuth 시작 결과 — 두 가지 형태 중 하나.
+ *
+ * 1. 일반 흐름 (google/github/cafe24 Public): `{ authUrl, state }` — 사용자
+ *    브라우저를 authorize URL 로 보낸다.
+ * 2. Cafe24 Private 흐름 (`mode === 'cafe24_private_pending'`): `{ mode,
+ *    integrationId, appUrl, callbackUrl, scopesAdded? }` — Cafe24 가
+ *    OAuth flow 를 시작하므로 우리는 사용자에게 등록할 URL 만 반환.
+ *
+ * API H-2 (2026-05-16): Swagger 가 두 분기를 명시적으로 보여주도록 모든
+ * 분기 필드를 optional 로 선언하고 description 에 분기 조건을 명시.
+ * spec/2-navigation/4-integration.md §9.2.
+ */
 export class OAuthBeginResultDto {
-  /** OAuth provider 인증 URL */
-  @ApiProperty()
-  authorizeUrl: string;
+  /** 분기 식별자. 미존재 또는 'google'/'github'/'cafe24' 면 일반 흐름. */
+  @ApiProperty({
+    required: false,
+    enum: ['cafe24_private_pending'],
+    description:
+      "Cafe24 Private 앱일 때 'cafe24_private_pending'. 그 외 분기에서는 미존재 (authorizeUrl + state 반환).",
+  })
+  mode?: 'cafe24_private_pending';
 
-  /** CSRF 방지용 state 토큰 */
-  @ApiProperty()
-  state: string;
+  /** OAuth provider 인증 URL. Cafe24 Private 분기에서는 미존재. */
+  @ApiProperty({ required: false })
+  authorizeUrl?: string;
+
+  /** CSRF 방지용 state 토큰. Cafe24 Private 분기에서는 미존재. */
+  @ApiProperty({ required: false })
+  state?: string;
+
+  /** Cafe24 Private 분기 — 새로 생성된 pending_install integration ID. */
+  @ApiProperty({ required: false, format: 'uuid' })
+  integrationId?: string;
+
+  /**
+   * Cafe24 Private 분기 — 사용자가 Cafe24 Developers 의 "App URL" 에
+   * 등록할 URL. Cafe24 "테스트 실행" 이 이 URL 을 호출.
+   */
+  @ApiProperty({ required: false })
+  appUrl?: string;
+
+  /**
+   * Cafe24 Private 분기 — 사용자가 Cafe24 Developers 의 "Redirect URI" 에
+   * 등록할 URL. OAuth authorize 후 Cafe24 가 이 URL 로 redirect.
+   */
+  @ApiProperty({ required: false })
+  callbackUrl?: string;
+
+  /**
+   * request-scopes 진입점에서 scopes 가 변경된 경우의 추가 분량.
+   * Cafe24 Private + request_scopes mode 에서만 채워진다.
+   */
+  @ApiProperty({ required: false, type: [String] })
+  scopesAdded?: string[];
 }
 
 /** 사용처 조회 응답 */

```

---

### 파일 8: backend/src/modules/integrations/entities/integration.entity.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/modules/integrations/entities/integration.entity.ts b/backend/src/modules/integrations/entities/integration.entity.ts
index 998f5d40..f78dc30d 100644
--- a/backend/src/modules/integrations/entities/integration.entity.ts
+++ b/backend/src/modules/integrations/entities/integration.entity.ts
@@ -116,6 +116,21 @@ export class Integration {
   })
   lastError: Record<string, unknown> | null;
 
+  /**
+   * 연속 transport 실패 카운터. spec §6 "connected → error(network) | 노드
+   * 실행 중 커넥션 실패 3회 연속" 상태 전이의 구현 기반. Cafe24ApiClient 가
+   * 각 호출의 fetch 실패 시 증가시키고, 성공 시 0 으로 리셋한다. 3 도달
+   * 시점에 markStatus('error', 'network') 호출 + 카운터 리셋.
+   *
+   * spec/2-navigation/4-integration.md §6 / REQ-C2 (2026-05-16).
+   */
+  @Column({
+    name: 'consecutive_network_failures',
+    type: 'int',
+    default: 0,
+  })
+  consecutiveNetworkFailures: number;
+
   @Column({ name: 'created_by' })
   createdBy: string;
 

```

---

### 파일 9: backend/src/modules/integrations/integration-expiry-scanner.service.spec.ts
- 변경 유형: Review
- 언어: ts


... (diff omitted due to prompt size limit) ...

---

### 파일 10: backend/src/modules/integrations/integration-expiry-scanner.service.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/modules/integrations/integration-expiry-scanner.service.ts b/backend/src/modules/integrations/integration-expiry-scanner.service.ts
index 462cbb07..71b029cc 100644
--- a/backend/src/modules/integrations/integration-expiry-scanner.service.ts
+++ b/backend/src/modules/integrations/integration-expiry-scanner.service.ts
@@ -2,7 +2,15 @@ import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
 import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
 import { Job, Queue } from 'bullmq';
 import { InjectRepository } from '@nestjs/typeorm';
-import { In, LessThan, LessThanOrEqual, Not, Repository } from 'typeorm';
+import {
+  In,
+  IsNull,
+  LessThan,
+  LessThanOrEqual,
+  Not,
+  Or,
+  Repository,
+} from 'typeorm';
 import { Integration } from './entities/integration.entity';
 import {
   IntegrationExpiryDispatch,
@@ -178,11 +186,16 @@ export class IntegrationExpiryScannerService
     const cutoff = new Date(
       now.getTime() - REFRESH_PROACTIVE_THRESHOLD_DAYS * DAY_MS,
     );
+    // `lastRotatedAt IS NULL` 통합도 대상에 포함한다. 신규 create() 경로는
+    // 이제 `lastRotatedAt = new Date()` 로 명시 초기화하지만 (`integrations.
+    // service.ts`), V045 이전 legacy row 와 다른 진입 경로(향후 추가될 수
+    // 있는 manual ETL 등) 에 대비한 belt-and-suspenders. PostgreSQL 의
+    // `NULL < cutoff = FALSE` 시맨틱 때문에 IS NULL 분기를 OR 로 명시.
     const targets = await this.integrationRepository.find({
       where: {
         serviceType: 'cafe24',
         status: 'connected',
-        lastRotatedAt: LessThan(cutoff),
+        lastRotatedAt: Or(LessThan(cutoff), IsNull()),
       },
       select: ['id', 'lastRotatedAt'],
     });
@@ -282,7 +295,13 @@ export class IntegrationExpiryScannerService
 
     const candidates = await this.integrationRepository.find({
       where: {
-        status: Not(In(['expired', 'error'])),
+        // spec/2-navigation/4-integration.md §11.1 + §2.4 가 `pending_install`
+        // 을 만료 알림 대상에서 제외하도록 명시. 정상 흐름에서는
+        // pending_install 의 `tokenExpiresAt` 가 NULL 이라 LessThanOrEqual 조건
+        // 에 매칭되지 않지만, 엣지 케이스 (재사용 분기에서 tokenExpiresAt 가
+        // 의도치 않게 보존되는 경우 등) 를 차단하기 위해 status 필터에 명시
+        // 추가 (REQ-C1).
+        status: Not(In(['expired', 'error', 'pending_install'])),
         tokenExpiresAt: LessThanOrEqual(horizon),
       },
     });

```

---

### 파일 11: backend/src/modules/integrations/integration-oauth.service.cafe24.spec.ts
- 변경 유형: Review
- 언어: ts


... (diff omitted due to prompt size limit) ...

---

### 파일 12: backend/src/modules/integrations/integration-oauth.service.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/modules/integrations/integration-oauth.service.spec.ts b/backend/src/modules/integrations/integration-oauth.service.spec.ts
index 839befb8..7c04b4a3 100644
--- a/backend/src/modules/integrations/integration-oauth.service.spec.ts
+++ b/backend/src/modules/integrations/integration-oauth.service.spec.ts
@@ -555,6 +555,29 @@ describe('IntegrationOAuthService', () => {
     it('returns input unchanged for empty / non-string', () => {
       expect(sanitizeLastErrorMessage('')).toBe('');
     });
+
+    // SEC-C2 — Cafe24 가 응답에 `client-secret` (하이픈) 또는 `"secret":...`
+    // 단독 키워드를 echo 하는 비정상 케이스 대비. 운영 보고 (2026-05-16)
+    // 후 패턴 확장.
+    it('masks hyphenated client-secret variant', () => {
+      expect(
+        sanitizeLastErrorMessage('error: client-secret=sk_abc123 invalid'),
+      ).toBe('error: *** invalid');
+    });
+
+    it('masks standalone "secret:" keyword (JSON-style echo)', () => {
+      expect(sanitizeLastErrorMessage('echo: "secret":"verySecret"')).toContain(
+        '***',
+      );
+      expect(
+        sanitizeLastErrorMessage('echo: "secret":"verySecret"'),
+      ).not.toMatch(/verySecret/);
+    });
+
+    it('masks hyphenated access-token / refresh-token / api-key', () => {
+      expect(sanitizeLastErrorMessage('access-token=abc def')).toBe('*** def');
+      expect(sanitizeLastErrorMessage('api-key=xyz fail')).toBe('*** fail');
+    });
   });
 
   describe('markIntegrationCallbackError', () => {
@@ -763,9 +786,11 @@ describe('IntegrationOAuthService', () => {
       expect(result.credentials.access_token).toBe('t');
     });
 
-    it('parses credentials when raw row is snake_case + plain JSON string (legacy path)', async () => {
-      // Raw SQL DELETE…RETURNING 의 실제 응답 shape (snake_case).
-      // normalizeRawPreviewRow 이 legacy 미암호화 string 도 JSON.parse 한다.
+    // SEC-C1/H-5: 옛 동작은 `enc:` prefix 가 없는 plaintext credentials 도
+    // `JSON.parse` 해 통과시켰다. 이는 암호화 invariant 를 우회하는 경로를
+    // 열어두는 보안 결함이라 hard-fail 로 변경. 이제 plaintext 는
+    // `INTEGRATION_CREDENTIALS_INVALID` 로 거부된다.
+    it('rejects plaintext (no enc: prefix) credentials as security defense', async () => {
       dataSource.query.mockResolvedValue([
         [
           {
@@ -780,8 +805,13 @@ describe('IntegrationOAuthService', () => {
         ],
         1,
       ]);
-      const result = await service.consumePreviewToken('tmp_x', 'ws-1', 'u-1');
-      expect(result.credentials.access_token).toBe('t-str');
+      await expect(
+        service.consumePreviewToken('tmp_x', 'ws-1', 'u-1'),
+      ).rejects.toMatchObject({
+        response: expect.objectContaining({
+          code: 'INTEGRATION_CREDENTIALS_INVALID',
+        }),
+      });
     });
 
     it('rejects with BadRequest when raw credentials string is corrupt (not unhandled 500)', async () => {

```

---

### 파일 13: backend/src/modules/integrations/integration-oauth.service.ts
- 변경 유형: Review
- 언어: ts


... (diff omitted due to prompt size limit) ...

---

### 파일 14: backend/src/modules/integrations/integrations.service.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/modules/integrations/integrations.service.spec.ts b/backend/src/modules/integrations/integrations.service.spec.ts
index e6ed4343..0a11407c 100644
--- a/backend/src/modules/integrations/integrations.service.spec.ts
+++ b/backend/src/modules/integrations/integrations.service.spec.ts
@@ -621,6 +621,28 @@ describe('IntegrationsService', () => {
         expect.objectContaining({ action: 'integration.created' }),
       );
     });
+
+    // 회귀 — 신규 통합 생성 시 lastRotatedAt 이 명시 초기화되어야 한다.
+    // 없으면 NULL 로 저장되어 `enqueueCafe24BackgroundRefresh` 의 cutoff
+    // 비교 (`LessThan(now - 10d)`) 에서 PostgreSQL 의 `NULL < value = FALSE`
+    // 시맨틱으로 영원히 제외 → 신규 Cafe24 통합 14일 idle 시 refresh_token
+    // 만료. PR #56 의 idle 보호 무력화 회귀를 차단.
+    it('initializes lastRotatedAt on create so background refresh covers fresh integrations', async () => {
+      await service.create('ws-1', 'user-1', 'member', {
+        serviceType: 'http',
+        authType: 'api_key',
+        name: 'My API',
+        credentials: {
+          location: 'header',
+          key_name: 'X-Api-Key',
+          value: 'secret',
+        },
+      });
+      const createArg = integrationRepo.create.mock.calls[0][0] as {
+        lastRotatedAt?: Date;
+      };
+      expect(createArg.lastRotatedAt).toBeInstanceOf(Date);
+    });
   });
 
   // -----------------------------------------------------------------

```

---

### 파일 15: backend/src/modules/integrations/integrations.service.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/modules/integrations/integrations.service.ts b/backend/src/modules/integrations/integrations.service.ts
index cabf467f..67240b35 100644
--- a/backend/src/modules/integrations/integrations.service.ts
+++ b/backend/src/modules/integrations/integrations.service.ts
@@ -288,6 +288,14 @@ export class IntegrationsService {
       scope: requestedScope,
       status: 'connected',
       tokenExpiresAt,
+      // lastRotatedAt 을 명시 초기화한다. 본 컬럼은
+      // `IntegrationExpiryScannerService.enqueueCafe24BackgroundRefresh` 의
+      // cutoff 비교 (`LessThan(now - 10d)`) 에 사용된다. NULL 로 저장하면
+      // PostgreSQL 의 NULL < value = NULL (FALSE) 시맨틱으로 row 가
+      // background refresh 대상에서 영원히 제외 → 신규 Cafe24 통합이 14일
+      // idle 시 refresh_token 까지 만료되어 PR #56 의 idle 보호가 무력화된다.
+      // 발급 시점을 기록해 cutoff 비교가 의도대로 동작하게 한다.
+      lastRotatedAt: new Date(),
     });
 
     try {

```

---

### 파일 16: backend/src/modules/integrations/third-party-oauth.controller.spec.ts
- 변경 유형: Review
- 언어: ts


... (diff omitted due to prompt size limit) ...

---

### 파일 17: backend/src/modules/integrations/third-party-oauth.controller.ts
- 변경 유형: Review
- 언어: ts


... (diff omitted due to prompt size limit) ...

---

### 파일 18: backend/src/nodes/ai/ai-agent/ai-agent.handler.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/ai/ai-agent/ai-agent.handler.spec.ts b/backend/src/nodes/ai/ai-agent/ai-agent.handler.spec.ts
index 584fd6b0..63b16b68 100644
--- a/backend/src/nodes/ai/ai-agent/ai-agent.handler.spec.ts
+++ b/backend/src/nodes/ai/ai-agent/ai-agent.handler.spec.ts
@@ -109,7 +109,7 @@ describe('AiAgentHandler', () => {
         model: 'gpt-4',
       });
       expect(result.valid).toBe(false);
-      // Schema warningRule "Multi Turn 모드에서는 System Prompt 가 필요합니다." fires.
+      // Schema warningRule "Multi Turn mode requires System Prompt." fires.
       expect(result.errors.some((e) => e.includes('Multi Turn'))).toBe(true);
     });
   });
@@ -1789,7 +1789,7 @@ describe('AiAgentHandler', () => {
         conditions,
       });
       expect(result.valid).toBe(false);
-      // Schema warningRule "Conditions 는 최대 20개까지 추가할 수 있습니다." fires.
+      // Schema warningRule "Conditions are limited to 20 entries." fires.
       expect(result.errors.some((e) => e.includes('20'))).toBe(true);
     });
   });

```

---

### 파일 19: backend/src/nodes/ai/ai-agent/ai-agent.schema.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/ai/ai-agent/ai-agent.schema.spec.ts b/backend/src/nodes/ai/ai-agent/ai-agent.schema.spec.ts
index fdb6b827..5429a7a6 100644
--- a/backend/src/nodes/ai/ai-agent/ai-agent.schema.spec.ts
+++ b/backend/src/nodes/ai/ai-agent/ai-agent.schema.spec.ts
@@ -356,7 +356,7 @@ describe('evaluateMetadataBlockingErrors integration (ai_agent)', () => {
     // both "no provider" and "single-turn needs prompt" should fire
     expect(errors.some((e) => e.includes('LLM provider'))).toBe(true);
     expect(errors).toContain(
-      'System Prompt 또는 User Prompt 중 하나는 입력해야 합니다.',
+      'Either System Prompt or User Prompt must be entered.',
     );
   });
 

```

---

### 파일 20: backend/src/nodes/ai/ai-agent/ai-agent.schema.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/ai/ai-agent/ai-agent.schema.ts b/backend/src/nodes/ai/ai-agent/ai-agent.schema.ts
index caf5605c..dbba732f 100644
--- a/backend/src/nodes/ai/ai-agent/ai-agent.schema.ts
+++ b/backend/src/nodes/ai/ai-agent/ai-agent.schema.ts
@@ -559,17 +559,17 @@ export const aiAgentNodeMetadata: NodeComponentMetadata = {
     {
       id: 'ai_agent:multi-turn-needs-system-prompt',
       when: 'mode == multi_turn && !systemPrompt',
-      message: 'Multi Turn 모드에서는 System Prompt 가 필요합니다.',
+      message: 'Multi Turn mode requires System Prompt.',
     },
     {
       id: 'ai_agent:single-turn-needs-prompt',
       when: 'mode != multi_turn && !systemPrompt && !userPrompt',
-      message: 'System Prompt 또는 User Prompt 중 하나는 입력해야 합니다.',
+      message: 'Either System Prompt or User Prompt must be entered.',
     },
     {
       id: 'ai_agent:too-many-conditions',
       when: 'length(conditions) > 20',
-      message: 'Conditions 는 최대 20개까지 추가할 수 있습니다.',
+      message: 'Conditions are limited to 20 entries.',
     },
   ],
   validateConfig: validateAiAgentConfig,

```

---

### 파일 21: backend/src/nodes/ai/information-extractor/information-extractor.schema.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/ai/information-extractor/information-extractor.schema.spec.ts b/backend/src/nodes/ai/information-extractor/information-extractor.schema.spec.ts
index 054df582..f3c3bf25 100644
--- a/backend/src/nodes/ai/information-extractor/information-extractor.schema.spec.ts
+++ b/backend/src/nodes/ai/information-extractor/information-extractor.schema.spec.ts
@@ -216,9 +216,9 @@ describe('evaluateMetadataBlockingErrors integration (information_extractor)', (
       {},
     );
     expect(errors.some((e) => e.includes('LLM provider'))).toBe(true);
-    expect(errors).toContain('하나 이상의 추출 필드를 정의해야 합니다.');
+    expect(errors).toContain('At least one extraction field must be defined.');
     expect(errors).toContain(
-      'Single Turn 모드에서는 Input Field 를 입력해야 합니다.',
+      'In Single Turn mode, Input Field must be entered.',
     );
   });
 

```

---

### 파일 22: backend/src/nodes/ai/information-extractor/information-extractor.schema.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/ai/information-extractor/information-extractor.schema.ts b/backend/src/nodes/ai/information-extractor/information-extractor.schema.ts
index c90b7f02..a95c4c2b 100644
--- a/backend/src/nodes/ai/information-extractor/information-extractor.schema.ts
+++ b/backend/src/nodes/ai/information-extractor/information-extractor.schema.ts
@@ -280,12 +280,12 @@ export const informationExtractorNodeMetadata: NodeComponentMetadata = {
     {
       id: 'information_extractor:no-output-schema',
       when: 'length(outputSchema) == 0',
-      message: '하나 이상의 추출 필드를 정의해야 합니다.',
+      message: 'At least one extraction field must be defined.',
     },
     {
       id: 'information_extractor:single-turn-needs-input-field',
       when: 'mode != multi_turn && !inputField',
-      message: 'Single Turn 모드에서는 Input Field 를 입력해야 합니다.',
+      message: 'In Single Turn mode, Input Field must be entered.',
     },
   ],
   validateConfig: validateInformationExtractorConfig,

```

---

### 파일 23: backend/src/nodes/ai/llm-provider-rule.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/ai/llm-provider-rule.ts b/backend/src/nodes/ai/llm-provider-rule.ts
index d05d713e..c1b8eaa6 100644
--- a/backend/src/nodes/ai/llm-provider-rule.ts
+++ b/backend/src/nodes/ai/llm-provider-rule.ts
@@ -23,7 +23,7 @@
  * 과도해진다 — 메시지 상수를 공유해 typo / 표현 변형을 막는다.
  */
 export const AI_NO_LLM_PROVIDER_MESSAGE =
-  'LLM provider 또는 model 을 선택해야 합니다 (workspace 기본 provider 가 설정된 경우 캔버스에서 자동 처리).';
+  'LLM provider or model must be selected (auto-handled by the canvas when a workspace default provider is configured).';
 
 export const AI_LLM_PROVIDER_NODE_TYPES: ReadonlySet<string> = new Set([
   'ai_agent',

```

---

### 파일 24: backend/src/nodes/ai/text-classifier/text-classifier.handler.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/ai/text-classifier/text-classifier.handler.spec.ts b/backend/src/nodes/ai/text-classifier/text-classifier.handler.spec.ts
index c304b2b6..cabee746 100644
--- a/backend/src/nodes/ai/text-classifier/text-classifier.handler.spec.ts
+++ b/backend/src/nodes/ai/text-classifier/text-classifier.handler.spec.ts
@@ -67,8 +67,8 @@ describe('TextClassifierHandler', () => {
     it('should fail without categories', () => {
       const result = handler.validate({ inputField: 'test', model: 'gpt-4' });
       expect(result.valid).toBe(false);
-      // Schema warningRule "하나 이상의 카테고리를 추가해야 합니다." fires.
-      expect(result.errors.some((e) => e.includes('카테고리'))).toBe(true);
+      // Schema warningRule "At least one category must be added." fires.
+      expect(result.errors.some((e) => e.includes('category'))).toBe(true);
     });
 
     it('should fail with empty categories array', () => {
@@ -78,7 +78,7 @@ describe('TextClassifierHandler', () => {
         categories: [],
       });
       expect(result.valid).toBe(false);
-      expect(result.errors.some((e) => e.includes('카테고리'))).toBe(true);
+      expect(result.errors.some((e) => e.includes('category'))).toBe(true);
     });
 
     it('should fail when category name is empty', () => {
@@ -97,7 +97,7 @@ describe('TextClassifierHandler', () => {
         categories: [{ name: 'A', description: 'Cat A' }],
       });
       expect(result.valid).toBe(false);
-      // Schema warningRule "Input Field 를 입력해야 합니다." fires.
+      // Schema warningRule "Input Field must be entered." fires.
       expect(result.errors.some((e) => e.includes('Input Field'))).toBe(true);
     });
 

```

---

### 파일 25: backend/src/nodes/ai/text-classifier/text-classifier.schema.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/ai/text-classifier/text-classifier.schema.spec.ts b/backend/src/nodes/ai/text-classifier/text-classifier.schema.spec.ts
index 9fa343f3..7844283b 100644
--- a/backend/src/nodes/ai/text-classifier/text-classifier.schema.spec.ts
+++ b/backend/src/nodes/ai/text-classifier/text-classifier.schema.spec.ts
@@ -266,8 +266,8 @@ describe('evaluateMetadataBlockingErrors integration (text_classifier)', () => {
       {},
     );
     expect(errors.some((e) => e.includes('LLM provider'))).toBe(true);
-    expect(errors).toContain('하나 이상의 카테고리를 추가해야 합니다.');
-    expect(errors).toContain('Input Field 를 입력해야 합니다.');
+    expect(errors).toContain('At least one category must be added.');
+    expect(errors).toContain('Input Field must be entered.');
   });
 
   it('returns [] when fully configured', () => {

```

---

### 파일 26: backend/src/nodes/ai/text-classifier/text-classifier.schema.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/ai/text-classifier/text-classifier.schema.ts b/backend/src/nodes/ai/text-classifier/text-classifier.schema.ts
index f15a29c1..398e6df8 100644
--- a/backend/src/nodes/ai/text-classifier/text-classifier.schema.ts
+++ b/backend/src/nodes/ai/text-classifier/text-classifier.schema.ts
@@ -207,12 +207,12 @@ export const textClassifierNodeMetadata: NodeComponentMetadata = {
     {
       id: 'text_classifier:no-categories',
       when: 'length(categories) == 0',
-      message: '하나 이상의 카테고리를 추가해야 합니다.',
+      message: 'At least one category must be added.',
     },
     {
       id: 'text_classifier:no-input-field',
       when: '!inputField',
-      message: 'Input Field 를 입력해야 합니다.',
+      message: 'Input Field must be entered.',
     },
   ],
   validateConfig: validateTextClassifierConfig,

```

---

### 파일 27: backend/src/nodes/core/metadata-validation.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/core/metadata-validation.ts b/backend/src/nodes/core/metadata-validation.ts
index 45c021d7..462dbf75 100644
--- a/backend/src/nodes/core/metadata-validation.ts
+++ b/backend/src/nodes/core/metadata-validation.ts
@@ -3,7 +3,9 @@ import type { NodeComponentMetadata } from './node-component.interface';
 
 /**
  * Evaluate every warning declared on a node component's metadata against a
- * concrete `config` and return the resulting Korean messages.
+ * concrete `config` and return the resulting messages (English SoT —
+ * frontend `getConfigSummary` translates them via `WARNING_KO` for the ko
+ * locale; backend / assistant pipelines stay on the English originals).
  *
  * SSOT bridge — both surfaces ultimately call this:
  *   - Backend `handler.validate()` (each node's handler) wires this into its

```

---

### 파일 28: backend/src/nodes/data/code/code.handler.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/data/code/code.handler.spec.ts b/backend/src/nodes/data/code/code.handler.spec.ts
index 56f9df8f..0793ad19 100644
--- a/backend/src/nodes/data/code/code.handler.spec.ts
+++ b/backend/src/nodes/data/code/code.handler.spec.ts
@@ -30,8 +30,8 @@ describe('CodeHandler', () => {
     it('should reject missing code', () => {
       const result = handler.validate({});
       expect(result.valid).toBe(false);
-      // Schema warningRule "실행할 코드를 입력해야 합니다." fires.
-      expect(result.errors.some((e) => e.includes('코드'))).toBe(true);
+      // Schema warningRule "Body of the code to run must be entered." fires.
+      expect(result.errors.some((e) => e.includes('code'))).toBe(true);
     });
 
     it('should reject empty code string', () => {

```

---

### 파일 29: backend/src/nodes/data/code/code.schema.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/data/code/code.schema.spec.ts b/backend/src/nodes/data/code/code.schema.spec.ts
index e22863fc..b18a1977 100644
--- a/backend/src/nodes/data/code/code.schema.spec.ts
+++ b/backend/src/nodes/data/code/code.schema.spec.ts
@@ -63,7 +63,7 @@ describe('validateCodeConfig (imperative)', () => {
 describe('evaluateMetadataBlockingErrors integration (code)', () => {
   it('emits the Korean warning when code body is empty', () => {
     expect(evaluateMetadataBlockingErrors(codeNodeMetadata, {})).toContain(
-      '실행할 코드를 입력해야 합니다.',
+      'Body of the code to run must be entered.',
     );
   });
 
@@ -77,7 +77,7 @@ describe('evaluateMetadataBlockingErrors integration (code)', () => {
     const errors = evaluateMetadataBlockingErrors(codeNodeMetadata, {
       timeout: 999,
     });
-    expect(errors).toContain('실행할 코드를 입력해야 합니다.');
+    expect(errors).toContain('Body of the code to run must be entered.');
     expect(errors).toContain(
       'timeout must be a number between 1 and 120 seconds',
     );

```

---

### 파일 30: backend/src/nodes/data/code/code.schema.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/data/code/code.schema.ts b/backend/src/nodes/data/code/code.schema.ts
index 774aa934..e7b54ddd 100644
--- a/backend/src/nodes/data/code/code.schema.ts
+++ b/backend/src/nodes/data/code/code.schema.ts
@@ -110,7 +110,7 @@ export const codeNodeMetadata: NodeComponentMetadata = {
     {
       id: 'code:no-code',
       when: '!code',
-      message: '실행할 코드를 입력해야 합니다.',
+      message: 'Body of the code to run must be entered.',
     },
   ],
   validateConfig: validateCodeConfig,

```

---

### 파일 31: backend/src/nodes/data/transform/transform.handler.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/data/transform/transform.handler.spec.ts b/backend/src/nodes/data/transform/transform.handler.spec.ts
index 79f2d023..0ab18d49 100644
--- a/backend/src/nodes/data/transform/transform.handler.spec.ts
+++ b/backend/src/nodes/data/transform/transform.handler.spec.ts
@@ -31,8 +31,8 @@ describe('TransformHandler', () => {
     it('should fail when operations is missing', () => {
       const result = handler.validate({});
       expect(result.valid).toBe(false);
-      // Schema warningRule "하나 이상의 변환 작업을 추가해야 합니다." fires.
-      expect(result.errors.some((e) => e.includes('변환'))).toBe(true);
+      // Schema warningRule "At least one transform operation must be added." fires.
+      expect(result.errors.some((e) => e.includes('transform'))).toBe(true);
     });
 
     it('should fail when operations is not an array', () => {

```

---

### 파일 32: backend/src/nodes/data/transform/transform.schema.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/data/transform/transform.schema.spec.ts b/backend/src/nodes/data/transform/transform.schema.spec.ts
index c0b8614d..ca289c8c 100644
--- a/backend/src/nodes/data/transform/transform.schema.spec.ts
+++ b/backend/src/nodes/data/transform/transform.schema.spec.ts
@@ -133,7 +133,7 @@ describe('validateTransformConfig (imperative)', () => {
 describe('evaluateMetadataBlockingErrors integration (transform)', () => {
   it('emits the Korean warning when no operations are defined', () => {
     expect(evaluateMetadataBlockingErrors(transformNodeMetadata, {})).toContain(
-      '하나 이상의 변환 작업을 추가해야 합니다.',
+      'At least one transform operation must be added.',
     );
   });
 

```

---

### 파일 33: backend/src/nodes/data/transform/transform.schema.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/data/transform/transform.schema.ts b/backend/src/nodes/data/transform/transform.schema.ts
index 4b63a04f..a284835e 100644
--- a/backend/src/nodes/data/transform/transform.schema.ts
+++ b/backend/src/nodes/data/transform/transform.schema.ts
@@ -241,7 +241,7 @@ export const transformNodeMetadata: NodeComponentMetadata = {
     {
       id: 'transform:no-operations',
       when: 'length(operations) == 0',
-      message: '하나 이상의 변환 작업을 추가해야 합니다.',
+      message: 'At least one transform operation must be added.',
     },
   ],
   validateConfig: validateTransformConfig,

```

---

### 파일 34: backend/src/nodes/flow/workflow/workflow.handler.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/flow/workflow/workflow.handler.spec.ts b/backend/src/nodes/flow/workflow/workflow.handler.spec.ts
index 18a61e92..0b0d4888 100644
--- a/backend/src/nodes/flow/workflow/workflow.handler.spec.ts
+++ b/backend/src/nodes/flow/workflow/workflow.handler.spec.ts
@@ -52,8 +52,8 @@ describe('WorkflowHandler', () => {
     it('should fail when workflowId is missing', () => {
       const result = handler.validate({ mode: 'sync' });
       expect(result.valid).toBe(false);
-      // Schema warningRule "실행할 워크플로우를 선택해야 합니다." fires.
-      expect(result.errors.some((e) => e.includes('워크플로우'))).toBe(true);
+      // Schema warningRule "Target workflow must be selected." fires.
+      expect(result.errors.some((e) => e.includes('workflow'))).toBe(true);
     });
 
     it('should fail when workflowId is not a string', () => {

```

---

### 파일 35: backend/src/nodes/flow/workflow/workflow.schema.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/flow/workflow/workflow.schema.spec.ts b/backend/src/nodes/flow/workflow/workflow.schema.spec.ts
index fd76ea69..f8fea576 100644
--- a/backend/src/nodes/flow/workflow/workflow.schema.spec.ts
+++ b/backend/src/nodes/flow/workflow/workflow.schema.spec.ts
@@ -81,7 +81,7 @@ describe('validateWorkflowConfig (imperative)', () => {
 describe('evaluateMetadataBlockingErrors integration (workflow)', () => {
   it('emits the Korean warning when no workflow is selected', () => {
     expect(evaluateMetadataBlockingErrors(workflowNodeMetadata, {})).toContain(
-      '실행할 워크플로우를 선택해야 합니다.',
+      'Target workflow must be selected.',
     );
   });
 
@@ -97,7 +97,7 @@ describe('evaluateMetadataBlockingErrors integration (workflow)', () => {
     const errors = evaluateMetadataBlockingErrors(workflowNodeMetadata, {
       timeout: -5,
     });
-    expect(errors).toContain('실행할 워크플로우를 선택해야 합니다.');
+    expect(errors).toContain('Target workflow must be selected.');
     expect(errors).toContain(
       'timeout must be a non-negative number (0 = no timeout)',
     );

```

---

### 파일 36: backend/src/nodes/flow/workflow/workflow.schema.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/flow/workflow/workflow.schema.ts b/backend/src/nodes/flow/workflow/workflow.schema.ts
index bb85bcdb..c98d1e79 100644
--- a/backend/src/nodes/flow/workflow/workflow.schema.ts
+++ b/backend/src/nodes/flow/workflow/workflow.schema.ts
@@ -185,7 +185,7 @@ export const workflowNodeMetadata: NodeComponentMetadata = {
     {
       id: 'workflow:no-workflow-selected',
       when: '!workflowId',
-      message: '실행할 워크플로우를 선택해야 합니다.',
+      message: 'Target workflow must be selected.',
     },
   ],
   validateConfig: validateWorkflowConfig,

```

---

### 파일 37: backend/src/nodes/integration/cafe24/cafe24-api.client.spec.ts
- 변경 유형: Review
- 언어: ts


... (diff omitted due to prompt size limit) ...

---

### 파일 38: backend/src/nodes/integration/cafe24/cafe24-api.client.ts
- 변경 유형: Review
- 언어: ts


... (diff omitted due to prompt size limit) ...

---

### 파일 39: backend/src/nodes/integration/cafe24/cafe24-token-refresh.processor.spec.ts
- 변경 유형: Review
- 언어: ts


... (diff omitted due to prompt size limit) ...

---

### 파일 40: backend/src/nodes/integration/cafe24/cafe24-token-refresh.processor.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/integration/cafe24/cafe24-token-refresh.processor.ts b/backend/src/nodes/integration/cafe24/cafe24-token-refresh.processor.ts
index e3a4e702..0df2939c 100644
--- a/backend/src/nodes/integration/cafe24/cafe24-token-refresh.processor.ts
+++ b/backend/src/nodes/integration/cafe24/cafe24-token-refresh.processor.ts
@@ -78,13 +78,20 @@ export class Cafe24TokenRefreshProcessor extends WorkerHost {
       return;
     }
 
-    // 백그라운드 경로는 status='connected' 만 대상. 호출자 검증을 신뢰하지
-    // 않고 worker 에서 다시 확인 — `error`/`expired` 상태인데 큐에 잘못
-    // 들어온 잡이 토큰을 자동 회복시키면 사용자가 의도한 reauthorize
-    // 흐름이 우회될 수 있다.
-    if (source === 'background' && fresh.status !== 'connected') {
+    // CONC H-2 (2026-05-16) — status 검증은 source 와 무관하게 적용한다.
+    // BullMQ jobId dedup 의 부수 효과 때문 — proactive 가 먼저 enqueue 된
+    // 직후 background 가 같은 jobId 로 add() 하면 worker 는 기존 잡의
+    // `source='proactive'` data 만 보게 된다 (data 는 dedup 시 덮어쓰지
+    // 않음). 옛 코드는 `source === 'background'` 일 때만 status 검증을
+    // 수행해, 위 race 가 발생하면 사용자가 의도한 reauthorize 흐름이
+    // 우회될 수 있었다. 이제 source 무관하게 connected 만 처리해 race-safe.
+    //
+    // 호출자 (Cafe24ApiClient.call) 는 어차피 handler 의 `resolveIntegration`
+    // 에서 status='connected' 검증을 거친 뒤에만 도착하므로 proactive 경로
+    // 도 이 검증이 정상 흐름에 영향을 주지 않는다.
+    if (fresh.status !== 'connected') {
       this.logger.log(
-        `Cafe24 background refresh skipped for ${integrationId} — status=${fresh.status} (reauthorize required)`,
+        `Cafe24 refresh skipped for ${integrationId} — status=${fresh.status} (reauthorize required, source=${source})`,
       );
       return;
     }

```

---

### 파일 41: backend/src/nodes/integration/cafe24/cafe24.schema.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/integration/cafe24/cafe24.schema.ts b/backend/src/nodes/integration/cafe24/cafe24.schema.ts
index 7a735315..adc61d4a 100644
--- a/backend/src/nodes/integration/cafe24/cafe24.schema.ts
+++ b/backend/src/nodes/integration/cafe24/cafe24.schema.ts
@@ -135,23 +135,23 @@ export const cafe24NodeMetadata: NodeComponentMetadata = {
   summaryTemplate: {
     template: '{{resource}} · {{operation}}',
     warnWhen: '!resource || !operation',
-    warnMessage: 'Resource / operation 미선택',
+    warnMessage: 'Resource / operation not selected',
   },
   warningRules: [
     {
       id: 'cafe24:no-integration',
       when: '!integrationId',
-      message: 'Integration 을 선택해야 합니다.',
+      message: 'Integration must be selected.',
     },
     {
       id: 'cafe24:no-resource',
       when: '!resource',
-      message: 'Resource 를 선택해야 합니다.',
+      message: 'Resource must be selected.',
     },
     {
       id: 'cafe24:no-operation',
       when: '!operation',
-      message: 'Operation 을 선택해야 합니다.',
+      message: 'Operation must be selected.',
     },
   ],
 };

```

---

### 파일 42: backend/src/nodes/integration/database-query/database-query.schema.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/integration/database-query/database-query.schema.spec.ts b/backend/src/nodes/integration/database-query/database-query.schema.spec.ts
index fe438d60..fa01ae77 100644
--- a/backend/src/nodes/integration/database-query/database-query.schema.spec.ts
+++ b/backend/src/nodes/integration/database-query/database-query.schema.spec.ts
@@ -72,8 +72,8 @@ describe('evaluateMetadataBlockingErrors integration (database_query)', () => {
       databaseQueryNodeMetadata,
       {},
     );
-    expect(errors).toContain('Database integration 을 선택해야 합니다.');
-    expect(errors).toContain('SQL query 를 입력해야 합니다.');
+    expect(errors).toContain('Database integration must be selected.');
+    expect(errors).toContain('SQL query must be entered.');
   });
 
   it('returns [] when fully configured', () => {

```

---

### 파일 43: backend/src/nodes/integration/database-query/database-query.schema.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/integration/database-query/database-query.schema.ts b/backend/src/nodes/integration/database-query/database-query.schema.ts
index f4a0724d..78faca06 100644
--- a/backend/src/nodes/integration/database-query/database-query.schema.ts
+++ b/backend/src/nodes/integration/database-query/database-query.schema.ts
@@ -158,12 +158,12 @@ export const databaseQueryNodeMetadata: NodeComponentMetadata = {
     {
       id: 'database_query:no-integration',
       when: '!integrationId',
-      message: 'Database integration 을 선택해야 합니다.',
+      message: 'Database integration must be selected.',
     },
     {
       id: 'database_query:no-query',
       when: '!query',
-      message: 'SQL query 를 입력해야 합니다.',
+      message: 'SQL query must be entered.',
     },
   ],
   validateConfig: validateDatabaseQueryConfig,

```

---

### 파일 44: backend/src/nodes/integration/http-request/http-request.handler.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/integration/http-request/http-request.handler.spec.ts b/backend/src/nodes/integration/http-request/http-request.handler.spec.ts
index 3912cc89..43df1338 100644
--- a/backend/src/nodes/integration/http-request/http-request.handler.spec.ts
+++ b/backend/src/nodes/integration/http-request/http-request.handler.spec.ts
@@ -51,7 +51,7 @@ describe('HttpRequestHandler', () => {
     it('should fail when url is missing', () => {
       const result = handler.validate({ method: 'GET' });
       expect(result.valid).toBe(false);
-      // Schema warningRule "URL 을 입력해야 합니다." fires.
+      // Schema warningRule "URL must be entered." fires.
       expect(result.errors.some((e) => e.includes('URL'))).toBe(true);
     });
 

```

---

### 파일 45: backend/src/nodes/integration/http-request/http-request.schema.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/integration/http-request/http-request.schema.spec.ts b/backend/src/nodes/integration/http-request/http-request.schema.spec.ts
index 0ed21e3a..b91a53e3 100644
--- a/backend/src/nodes/integration/http-request/http-request.schema.spec.ts
+++ b/backend/src/nodes/integration/http-request/http-request.schema.spec.ts
@@ -126,9 +126,9 @@ describe('evaluateMetadataBlockingErrors integration (http_request)', () => {
     const errors = evaluateMetadataBlockingErrors(httpRequestNodeMetadata, {
       authentication: 'integration',
     });
-    expect(errors).toContain('URL 을 입력해야 합니다.');
+    expect(errors).toContain('URL must be entered.');
     expect(errors).toContain(
-      'Integration 인증을 사용하려면 integration 을 선택해야 합니다.',
+      'Integration must be selected when using Integration auth.',
     );
   });
 

```

---

### 파일 46: backend/src/nodes/integration/http-request/http-request.schema.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/integration/http-request/http-request.schema.ts b/backend/src/nodes/integration/http-request/http-request.schema.ts
index 6d261ab3..ca6aabf5 100644
--- a/backend/src/nodes/integration/http-request/http-request.schema.ts
+++ b/backend/src/nodes/integration/http-request/http-request.schema.ts
@@ -232,12 +232,12 @@ export const httpRequestNodeMetadata: NodeComponentMetadata = {
     {
       id: 'http_request:no-url',
       when: '!url',
-      message: 'URL 을 입력해야 합니다.',
+      message: 'URL must be entered.',
     },
     {
       id: 'http_request:integration-auth-needs-integration-id',
       when: 'authentication == integration && !integrationId',
-      message: 'Integration 인증을 사용하려면 integration 을 선택해야 합니다.',
+      message: 'Integration must be selected when using Integration auth.',
     },
   ],
   validateConfig: validateHttpRequestConfig,

```

---

### 파일 47: backend/src/nodes/integration/send-email/send-email.handler.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/integration/send-email/send-email.handler.spec.ts b/backend/src/nodes/integration/send-email/send-email.handler.spec.ts
index 324ad560..df41ca05 100644
--- a/backend/src/nodes/integration/send-email/send-email.handler.spec.ts
+++ b/backend/src/nodes/integration/send-email/send-email.handler.spec.ts
@@ -76,7 +76,7 @@ describe('SendEmailHandler', () => {
       void _drop;
       const result = handler.validate(rest);
       expect(result.valid).toBe(false);
-      // Schema warningRule "Email integration 을 선택해야 합니다." fires.
+      // Schema warningRule "Email integration must be selected." fires.
       expect(result.errors.join(' ')).toContain('integration');
     });
 
@@ -85,7 +85,7 @@ describe('SendEmailHandler', () => {
       void _drop;
       const result = handler.validate(rest);
       expect(result.valid).toBe(false);
-      // Schema warningRule "수신자 (To) 를 한 명 이상 입력해야 합니다." fires
+      // Schema warningRule "Recipient (To) must include at least one address." fires
       // alongside the imperative recipient sum-type guard. Both contain "To".
       expect(result.errors.join(' ')).toMatch(/to|To|수신자/);
     });

```

---

### 파일 48: backend/src/nodes/integration/send-email/send-email.schema.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/integration/send-email/send-email.schema.spec.ts b/backend/src/nodes/integration/send-email/send-email.schema.spec.ts
index 98f53909..3da7dea9 100644
--- a/backend/src/nodes/integration/send-email/send-email.schema.spec.ts
+++ b/backend/src/nodes/integration/send-email/send-email.schema.spec.ts
@@ -236,10 +236,10 @@ describe('Send Email node schema', () => {
   describe('evaluateMetadataBlockingErrors integration (send_email)', () => {
     it('emits all four declarative warnings on a freshly-created node', () => {
       const errors = evaluateMetadataBlockingErrors(sendEmailNodeMetadata, {});
-      expect(errors).toContain('Email integration 을 선택해야 합니다.');
-      expect(errors).toContain('수신자 (To) 를 한 명 이상 입력해야 합니다.');
-      expect(errors).toContain('제목을 입력해야 합니다.');
-      expect(errors).toContain('본문을 입력해야 합니다.');
+      expect(errors).toContain('Email integration must be selected.');
+      expect(errors).toContain('Recipient (To) must include at least one address.');
+      expect(errors).toContain('Subject must be entered.');
+      expect(errors).toContain('Body must be entered.');
     });
 
     it('returns [] when fully configured', () => {

```

---

### 파일 49: backend/src/nodes/integration/send-email/send-email.schema.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/integration/send-email/send-email.schema.ts b/backend/src/nodes/integration/send-email/send-email.schema.ts
index 47d21ccc..45cb4531 100644
--- a/backend/src/nodes/integration/send-email/send-email.schema.ts
+++ b/backend/src/nodes/integration/send-email/send-email.schema.ts
@@ -252,22 +252,22 @@ export const sendEmailNodeMetadata: NodeComponentMetadata = {
     {
       id: 'send_email:no-integration',
       when: '!integrationId',
-      message: 'Email integration 을 선택해야 합니다.',
+      message: 'Email integration must be selected.',
     },
     {
       id: 'send_email:no-recipient',
       when: 'length(to) == 0',
-      message: '수신자 (To) 를 한 명 이상 입력해야 합니다.',
+      message: 'Recipient (To) must include at least one address.',
     },
     {
       id: 'send_email:no-subject',
       when: '!subject',
-      message: '제목을 입력해야 합니다.',
+      message: 'Subject must be entered.',
     },
     {
       id: 'send_email:no-body',
       when: '!body',
-      message: '본문을 입력해야 합니다.',
+      message: 'Body must be entered.',
     },
   ],
   validateConfig: validateSendEmailConfig,

```

---

### 파일 50: backend/src/nodes/logic/filter/filter.handler.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/logic/filter/filter.handler.spec.ts b/backend/src/nodes/logic/filter/filter.handler.spec.ts
index 6ce00d71..b45150d2 100644
--- a/backend/src/nodes/logic/filter/filter.handler.spec.ts
+++ b/backend/src/nodes/logic/filter/filter.handler.spec.ts
@@ -64,7 +64,7 @@ describe('FilterHandler', () => {
         combineMode: 'and',
       });
       expect(result.valid).toBe(false);
-      // Schema warningRule "Input 필드를 입력해야 합니다." fires.
+      // Schema warningRule "Input field must be entered." fires.
       expect(result.errors.some((e) => e.includes('Input'))).toBe(true);
     });
 
@@ -74,8 +74,8 @@ describe('FilterHandler', () => {
         combineMode: 'and',
       });
       expect(result.valid).toBe(false);
-      // Schema warningRule "최소 1개 이상의 조건을 추가해야 합니다." fires.
-      expect(result.errors.some((e) => e.includes('조건'))).toBe(true);
+      // Schema warningRule "At least one condition must be added." fires.
+      expect(result.errors.some((e) => e.includes('condition'))).toBe(true);
     });
 
     it('should return invalid when conditions is empty', () => {
@@ -85,7 +85,7 @@ describe('FilterHandler', () => {
         combineMode: 'and',
       });
       expect(result.valid).toBe(false);
-      expect(result.errors.some((e) => e.includes('조건'))).toBe(true);
+      expect(result.errors.some((e) => e.includes('condition'))).toBe(true);
     });
 
     it('should accept missing field as item-self sentinel', () => {

```

---

### 파일 51: backend/src/nodes/logic/filter/filter.schema.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/logic/filter/filter.schema.spec.ts b/backend/src/nodes/logic/filter/filter.schema.spec.ts
index 883cfa14..1efbfd72 100644
--- a/backend/src/nodes/logic/filter/filter.schema.spec.ts
+++ b/backend/src/nodes/logic/filter/filter.schema.spec.ts
@@ -87,8 +87,8 @@ describe('validateFilterConfig (imperative)', () => {
 describe('evaluateMetadataBlockingErrors integration (filter)', () => {
   it('emits both Korean warnings when nothing is configured', () => {
     const errors = evaluateMetadataBlockingErrors(filterNodeMetadata, {});
-    expect(errors).toContain('Input 필드를 입력해야 합니다.');
-    expect(errors).toContain('최소 1개 이상의 조건을 추가해야 합니다.');
+    expect(errors).toContain('Input field must be entered.');
+    expect(errors).toContain('At least one condition must be added.');
   });
 
   it('returns [] when fully configured', () => {

```

---

### 파일 52: backend/src/nodes/logic/filter/filter.schema.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/logic/filter/filter.schema.ts b/backend/src/nodes/logic/filter/filter.schema.ts
index 06c67f8f..853df206 100644
--- a/backend/src/nodes/logic/filter/filter.schema.ts
+++ b/backend/src/nodes/logic/filter/filter.schema.ts
@@ -155,12 +155,12 @@ export const filterNodeMetadata: NodeComponentMetadata = {
     {
       id: 'filter:no-input-field',
       when: '!inputField',
-      message: 'Input 필드를 입력해야 합니다.',
+      message: 'Input field must be entered.',
     },
     {
       id: 'filter:no-conditions',
       when: 'length(conditions) == 0',
-      message: '최소 1개 이상의 조건을 추가해야 합니다.',
+      message: 'At least one condition must be added.',
     },
   ],
   validateConfig: validateFilterConfig,

```

---

### 파일 53: backend/src/nodes/logic/foreach/foreach.handler.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/logic/foreach/foreach.handler.spec.ts b/backend/src/nodes/logic/foreach/foreach.handler.spec.ts
index 338f0d9e..aa503b5b 100644
--- a/backend/src/nodes/logic/foreach/foreach.handler.spec.ts
+++ b/backend/src/nodes/logic/foreach/foreach.handler.spec.ts
@@ -42,8 +42,8 @@ describe('ForEachHandler', () => {
     it('should reject missing arrayField', () => {
       const result = handler.validate({ errorPolicy: 'stop' });
       expect(result.valid).toBe(false);
-      // Schema warningRule "배열 필드를 입력해야 합니다." fires.
-      expect(result.errors.some((e) => e.includes('배열'))).toBe(true);
+      // Schema warningRule "Array field must be entered." fires.
+      expect(result.errors.some((e) => e.includes('Array'))).toBe(true);
     });
 
     it('should reject empty string arrayField', () => {

```

---

### 파일 54: backend/src/nodes/logic/foreach/foreach.schema.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/logic/foreach/foreach.schema.spec.ts b/backend/src/nodes/logic/foreach/foreach.schema.spec.ts
index c14a8ca4..b61971b0 100644
--- a/backend/src/nodes/logic/foreach/foreach.schema.spec.ts
+++ b/backend/src/nodes/logic/foreach/foreach.schema.spec.ts
@@ -29,7 +29,7 @@ describe('foreachNodeMetadata.warningRules', () => {
 describe('evaluateMetadataBlockingErrors integration (foreach)', () => {
   it('emits the Korean warning when arrayField is missing', () => {
     expect(evaluateMetadataBlockingErrors(foreachNodeMetadata, {})).toEqual([
-      '배열 필드를 입력해야 합니다.',
+      'Array field must be entered.',
     ]);
   });
 

```

---

### 파일 55: backend/src/nodes/logic/foreach/foreach.schema.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/logic/foreach/foreach.schema.ts b/backend/src/nodes/logic/foreach/foreach.schema.ts
index 4b2d206c..1e69f740 100644
--- a/backend/src/nodes/logic/foreach/foreach.schema.ts
+++ b/backend/src/nodes/logic/foreach/foreach.schema.ts
@@ -76,7 +76,7 @@ export const foreachNodeMetadata: NodeComponentMetadata = {
     {
       id: 'foreach:no-array-field',
       when: '!arrayField',
-      message: '배열 필드를 입력해야 합니다.',
+      message: 'Array field must be entered.',
     },
   ],
 };

```

---

### 파일 56: backend/src/nodes/logic/if-else/if-else.handler.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/logic/if-else/if-else.handler.spec.ts b/backend/src/nodes/logic/if-else/if-else.handler.spec.ts
index a994e660..cb5743be 100644
--- a/backend/src/nodes/logic/if-else/if-else.handler.spec.ts
+++ b/backend/src/nodes/logic/if-else/if-else.handler.spec.ts
@@ -33,8 +33,8 @@ describe('IfElseHandler', () => {
     it('should return invalid when conditions is missing', () => {
       const result = handler.validate({ combineMode: 'and' });
       expect(result.valid).toBe(false);
-      // Schema warningRule "최소 1개 이상의 조건을 추가해야 합니다." fires.
-      expect(result.errors.some((e) => e.includes('조건'))).toBe(true);
+      // Schema warningRule "At least one condition must be added." fires.
+      expect(result.errors.some((e) => e.includes('condition'))).toBe(true);
     });
 
     it('should return invalid when conditions is empty', () => {
@@ -43,7 +43,7 @@ describe('IfElseHandler', () => {
         combineMode: 'and',
       });
       expect(result.valid).toBe(false);
-      expect(result.errors.some((e) => e.includes('조건'))).toBe(true);
+      expect(result.errors.some((e) => e.includes('condition'))).toBe(true);
     });
 
     it('should return invalid for missing field in condition', () => {

```

---

### 파일 57: backend/src/nodes/logic/if-else/if-else.schema.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/logic/if-else/if-else.schema.spec.ts b/backend/src/nodes/logic/if-else/if-else.schema.spec.ts
index ee0b1c5e..bac54609 100644
--- a/backend/src/nodes/logic/if-else/if-else.schema.spec.ts
+++ b/backend/src/nodes/logic/if-else/if-else.schema.spec.ts
@@ -78,7 +78,7 @@ describe('validateIfElseConfig (imperative)', () => {
 describe('evaluateMetadataBlockingErrors integration (if_else)', () => {
   it('emits both Korean warnings on a freshly-created node', () => {
     const errors = evaluateMetadataBlockingErrors(ifElseMetadata, {});
-    expect(errors).toContain('최소 1개 이상의 조건을 추가해야 합니다.');
+    expect(errors).toContain('At least one condition must be added.');
   });
 
   it('returns [] when configured with a valid first condition', () => {

```

---

### 파일 58: backend/src/nodes/logic/if-else/if-else.schema.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/logic/if-else/if-else.schema.ts b/backend/src/nodes/logic/if-else/if-else.schema.ts
index decf0867..3489e56f 100644
--- a/backend/src/nodes/logic/if-else/if-else.schema.ts
+++ b/backend/src/nodes/logic/if-else/if-else.schema.ts
@@ -155,12 +155,12 @@ export const ifElseMetadata: NodeComponentMetadata = {
     {
       id: 'if_else:no-conditions',
       when: 'length(conditions) == 0',
-      message: '최소 1개 이상의 조건을 추가해야 합니다.',
+      message: 'At least one condition must be added.',
     },
     {
       id: 'if_else:first-condition-field-empty',
       when: 'length(conditions) > 0 && !conditions.0.field',
-      message: '첫 번째 조건의 필드를 입력해야 합니다.',
+      message: 'First condition\'s field must be entered.',
     },
   ],
   validateConfig: validateIfElseConfig,

```

---

### 파일 59: backend/src/nodes/logic/loop/loop.handler.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/logic/loop/loop.handler.spec.ts b/backend/src/nodes/logic/loop/loop.handler.spec.ts
index 352c6863..3b20e5c5 100644
--- a/backend/src/nodes/logic/loop/loop.handler.spec.ts
+++ b/backend/src/nodes/logic/loop/loop.handler.spec.ts
@@ -45,7 +45,7 @@ describe('LoopHandler', () => {
     it('rejects missing count', () => {
       const result = handler.validate({});
       expect(result.valid).toBe(false);
-      // Schema warningRule "Count 를 입력해야 합니다." fires.
+      // Schema warningRule "Count must be entered." fires.
       expect(result.errors.some((e) => e.includes('Count'))).toBe(true);
     });
 

```

---

### 파일 60: backend/src/nodes/logic/loop/loop.schema.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/logic/loop/loop.schema.spec.ts b/backend/src/nodes/logic/loop/loop.schema.spec.ts
index d02d3c3d..e832423f 100644
--- a/backend/src/nodes/logic/loop/loop.schema.spec.ts
+++ b/backend/src/nodes/logic/loop/loop.schema.spec.ts
@@ -68,7 +68,7 @@ describe('validateLoopConfig (imperative)', () => {
 describe('evaluateMetadataBlockingErrors integration (loop)', () => {
   it('emits the Korean warning when count is missing', () => {
     expect(evaluateMetadataBlockingErrors(loopNodeMetadata, {})).toContain(
-      'Count 를 입력해야 합니다.',
+      'Count must be entered.',
     );
   });
 

```

---

### 파일 61: backend/src/nodes/logic/loop/loop.schema.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/logic/loop/loop.schema.ts b/backend/src/nodes/logic/loop/loop.schema.ts
index 77186755..e0ea29d4 100644
--- a/backend/src/nodes/logic/loop/loop.schema.ts
+++ b/backend/src/nodes/logic/loop/loop.schema.ts
@@ -155,7 +155,7 @@ export const loopNodeMetadata: NodeComponentMetadata = {
     {
       id: 'loop:no-count',
       when: '!count',
-      message: 'Count 를 입력해야 합니다.',
+      message: 'Count must be entered.',
     },
   ],
   validateConfig: validateLoopConfig,

```

---

### 파일 62: backend/src/nodes/logic/map/map.handler.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/logic/map/map.handler.spec.ts b/backend/src/nodes/logic/map/map.handler.spec.ts
index 7e9f8672..a0f6aaaa 100644
--- a/backend/src/nodes/logic/map/map.handler.spec.ts
+++ b/backend/src/nodes/logic/map/map.handler.spec.ts
@@ -38,7 +38,7 @@ describe('MapHandler', () => {
     it('should reject missing inputField', () => {
       const result = handler.validate({ errorPolicy: 'stop' });
       expect(result.valid).toBe(false);
-      // Schema warningRule "Input 필드를 입력해야 합니다." fires.
+      // Schema warningRule "Input field must be entered." fires.
       expect(result.errors.some((e) => e.includes('Input'))).toBe(true);
     });
 

```

---

### 파일 63: backend/src/nodes/logic/map/map.schema.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/logic/map/map.schema.spec.ts b/backend/src/nodes/logic/map/map.schema.spec.ts
index 3248de28..6d90a6bb 100644
--- a/backend/src/nodes/logic/map/map.schema.spec.ts
+++ b/backend/src/nodes/logic/map/map.schema.spec.ts
@@ -29,7 +29,7 @@ describe('mapNodeMetadata.warningRules', () => {
 describe('evaluateMetadataBlockingErrors integration (map)', () => {
   it('emits the Korean warning when inputField is missing', () => {
     expect(evaluateMetadataBlockingErrors(mapNodeMetadata, {})).toEqual([
-      'Input 필드를 입력해야 합니다.',
+      'Input field must be entered.',
     ]);
   });
 

```

---

### 파일 64: backend/src/nodes/logic/map/map.schema.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/logic/map/map.schema.ts b/backend/src/nodes/logic/map/map.schema.ts
index 727f2469..cc8a5edd 100644
--- a/backend/src/nodes/logic/map/map.schema.ts
+++ b/backend/src/nodes/logic/map/map.schema.ts
@@ -83,7 +83,7 @@ export const mapNodeMetadata: NodeComponentMetadata = {
     {
       id: 'map:no-input-field',
       when: '!inputField',
-      message: 'Input 필드를 입력해야 합니다.',
+      message: 'Input field must be entered.',
     },
   ],
 };

```

---

### 파일 65: backend/src/nodes/logic/merge/merge.schema.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/logic/merge/merge.schema.spec.ts b/backend/src/nodes/logic/merge/merge.schema.spec.ts
index e360b14e..38b48505 100644
--- a/backend/src/nodes/logic/merge/merge.schema.spec.ts
+++ b/backend/src/nodes/logic/merge/merge.schema.spec.ts
@@ -29,7 +29,7 @@ describe('mergeNodeMetadata.warningRules', () => {
 describe('evaluateMetadataBlockingErrors integration (merge)', () => {
   it('emits the Korean warning when strategy is missing', () => {
     expect(evaluateMetadataBlockingErrors(mergeNodeMetadata, {})).toEqual([
-      'Merge strategy 를 선택해야 합니다.',
+      'Merge strategy must be selected.',
     ]);
   });
 

```

---

### 파일 66: backend/src/nodes/logic/merge/merge.schema.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/logic/merge/merge.schema.ts b/backend/src/nodes/logic/merge/merge.schema.ts
index 8e04d4b2..cf64f358 100644
--- a/backend/src/nodes/logic/merge/merge.schema.ts
+++ b/backend/src/nodes/logic/merge/merge.schema.ts
@@ -91,7 +91,7 @@ export const mergeNodeMetadata: NodeComponentMetadata = {
     {
       id: 'merge:no-strategy',
       when: '!strategy',
-      message: 'Merge strategy 를 선택해야 합니다.',
+      message: 'Merge strategy must be selected.',
     },
   ],
 };

```

---

### 파일 67: backend/src/nodes/logic/parallel/parallel.schema.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/logic/parallel/parallel.schema.spec.ts b/backend/src/nodes/logic/parallel/parallel.schema.spec.ts
index 339497fe..d0b86bf5 100644
--- a/backend/src/nodes/logic/parallel/parallel.schema.spec.ts
+++ b/backend/src/nodes/logic/parallel/parallel.schema.spec.ts
@@ -129,13 +129,13 @@ describe('Parallel node', () => {
 
     it('rejects branchCount=2.5 (non-integer)', () => {
       expect(validateParallelConfig({ branchCount: 2.5 })).toContain(
-        'branchCount는 정수여야 합니다.',
+        'branchCount must be an integer.',
       );
     });
 
     it('rejects branchCount=1 (out of range)', () => {
       expect(validateParallelConfig({ branchCount: 1 })).toContain(
-        'branchCount는 2 이상 16 이하의 값이어야 합니다.',
+        'branchCount must be a value between 2 and 16.',
       );
     });
 
@@ -143,14 +143,14 @@ describe('Parallel node', () => {
       expect(
         validateParallelConfig({ branchCount: 4, maxConcurrency: -1 }),
       ).toContain(
-        'maxConcurrency는 0 이상 16 이하의 값이어야 합니다 (0 = 제한 없음).',
+        'maxConcurrency must be a value between 0 and 16 (0 = unlimited).',
       );
     });
 
     it('rejects waitAll being a non-boolean', () => {
       expect(
         validateParallelConfig({ branchCount: 4, waitAll: 'yes' }),
-      ).toContain('waitAll는 boolean이어야 합니다.');
+      ).toContain('waitAll must be a boolean.');
     });
   });
 
@@ -168,9 +168,9 @@ describe('Parallel node', () => {
       const errors = evaluateMetadataBlockingErrors(parallelNodeMetadata, {
         branchCount: 1,
       });
-      expect(errors).toContain('branchCount 는 2 이상 16 이하여야 합니다.');
+      expect(errors).toContain('branchCount must be 2 to 16.');
       expect(errors).toContain(
-        'branchCount는 2 이상 16 이하의 값이어야 합니다.',
+        'branchCount must be a value between 2 and 16.',
       );
     });
   });

```

---

### 파일 68: backend/src/nodes/logic/parallel/parallel.schema.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/logic/parallel/parallel.schema.ts b/backend/src/nodes/logic/parallel/parallel.schema.ts
index dd68351f..1058912e 100644
--- a/backend/src/nodes/logic/parallel/parallel.schema.ts
+++ b/backend/src/nodes/logic/parallel/parallel.schema.ts
@@ -89,29 +89,29 @@ export function validateParallelConfig(config: unknown): string[] {
   const rawBranch = c.branchCount;
   if (rawBranch !== undefined) {
     if (typeof rawBranch !== 'number' || !Number.isFinite(rawBranch)) {
-      errors.push('branchCount는 정수여야 합니다.');
+      errors.push('branchCount must be an integer.');
     } else if (!Number.isInteger(rawBranch)) {
-      errors.push('branchCount는 정수여야 합니다.');
+      errors.push('branchCount must be an integer.');
     } else if (rawBranch < 2 || rawBranch > 16) {
-      errors.push('branchCount는 2 이상 16 이하의 값이어야 합니다.');
+      errors.push('branchCount must be a value between 2 and 16.');
     }
   }
 
   if (c.maxConcurrency !== undefined) {
     const rawMax = c.maxConcurrency;
     if (typeof rawMax !== 'number' || !Number.isFinite(rawMax)) {
-      errors.push('maxConcurrency는 숫자여야 합니다.');
+      errors.push('maxConcurrency must be a number.');
     } else if (!Number.isInteger(rawMax)) {
-      errors.push('maxConcurrency는 정수여야 합니다.');
+      errors.push('maxConcurrency must be an integer.');
     } else if (rawMax < 0 || rawMax > 16) {
       errors.push(
-        'maxConcurrency는 0 이상 16 이하의 값이어야 합니다 (0 = 제한 없음).',
+        'maxConcurrency must be a value between 0 and 16 (0 = unlimited).',
       );
     }
   }
 
   if (c.waitAll !== undefined && typeof c.waitAll !== 'boolean') {
-    errors.push('waitAll는 boolean이어야 합니다.');
+    errors.push('waitAll must be a boolean.');
   }
 
   return errors;
@@ -122,7 +122,7 @@ export const parallelNodeMetadata: NodeComponentMetadata = {
   category: 'logic',
   label: 'Parallel',
   description:
-    'Fan-out input to N branches. PARALLEL_ENGINE=v1 일 때 각 분기가 동시 실행되며, 그렇지 않으면 토폴로지 순서로 순차 진행됩니다.',
+    'Fan-out input to N branches. Each branch runs concurrently when PARALLEL_ENGINE=v1, otherwise sequentially in topological order.',
   icon: 'Split',
   color: '#3B82F6',
   executionMetadata: { kind: 'parallel' },
@@ -141,7 +141,7 @@ export const parallelNodeMetadata: NodeComponentMetadata = {
     {
       id: 'parallel:branch-count-out-of-range',
       when: 'branchCount < 2 || branchCount > 16',
-      message: 'branchCount 는 2 이상 16 이하여야 합니다.',
+      message: 'branchCount must be 2 to 16.',
     },
   ],
   validateConfig: validateParallelConfig,

```

---

### 파일 69: backend/src/nodes/logic/split/split.handler.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/logic/split/split.handler.spec.ts b/backend/src/nodes/logic/split/split.handler.spec.ts
index 17fe33f3..d898efde 100644
--- a/backend/src/nodes/logic/split/split.handler.spec.ts
+++ b/backend/src/nodes/logic/split/split.handler.spec.ts
@@ -24,7 +24,7 @@ describe('SplitHandler', () => {
     it('fails when fieldPath is missing', () => {
       const result = handler.validate({});
       expect(result.valid).toBe(false);
-      // Schema warningRule "Field path 를 입력해야 합니다." fires.
+      // Schema warningRule "Field path must be entered." fires.
       expect(result.errors.some((e) => e.includes('Field path'))).toBe(true);
     });
 

```

---

### 파일 70: backend/src/nodes/logic/split/split.schema.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/logic/split/split.schema.spec.ts b/backend/src/nodes/logic/split/split.schema.spec.ts
index 3ed6d3c8..6d375735 100644
--- a/backend/src/nodes/logic/split/split.schema.spec.ts
+++ b/backend/src/nodes/logic/split/split.schema.spec.ts
@@ -29,7 +29,7 @@ describe('splitNodeMetadata.warningRules', () => {
 describe('evaluateMetadataBlockingErrors integration (split)', () => {
   it('emits the Korean warning when fieldPath is missing', () => {
     expect(evaluateMetadataBlockingErrors(splitNodeMetadata, {})).toEqual([
-      'Field path 를 입력해야 합니다.',
+      'Field path must be entered.',
     ]);
   });
 

```

---

### 파일 71: backend/src/nodes/logic/split/split.schema.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/logic/split/split.schema.ts b/backend/src/nodes/logic/split/split.schema.ts
index 5fa7b51f..482ef75a 100644
--- a/backend/src/nodes/logic/split/split.schema.ts
+++ b/backend/src/nodes/logic/split/split.schema.ts
@@ -77,7 +77,7 @@ export const splitNodeMetadata: NodeComponentMetadata = {
     {
       id: 'split:no-field-path',
       when: '!fieldPath',
-      message: 'Field path 를 입력해야 합니다.',
+      message: 'Field path must be entered.',
     },
   ],
 };

```

---

### 파일 72: backend/src/nodes/logic/switch/switch.handler.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/logic/switch/switch.handler.spec.ts b/backend/src/nodes/logic/switch/switch.handler.spec.ts
index 72505dd2..9e70cd59 100644
--- a/backend/src/nodes/logic/switch/switch.handler.spec.ts
+++ b/backend/src/nodes/logic/switch/switch.handler.spec.ts
@@ -51,7 +51,7 @@ describe('SwitchHandler', () => {
         cases: [{ id: 'case-1', value: 'a' }],
       });
       expect(result.valid).toBe(false);
-      // Schema warningRule "Value 모드에서는 Switch Value 를 입력해야 합니다." fires.
+      // Schema warningRule "In Value mode, Switch Value must be entered." fires.
       expect(result.errors.some((e) => e.includes('Switch Value'))).toBe(true);
     });
 
@@ -113,7 +113,7 @@ describe('SwitchHandler', () => {
         cases: [],
       });
       expect(result.valid).toBe(false);
-      // Schema warningRule "최소 1개 이상의 case 를 추가해야 합니다." fires.
+      // Schema warningRule "At least one case must be added." fires.
       expect(result.errors.some((e) => e.includes('case'))).toBe(true);
     });
 

```

---

### 파일 73: backend/src/nodes/logic/switch/switch.schema.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/logic/switch/switch.schema.spec.ts b/backend/src/nodes/logic/switch/switch.schema.spec.ts
index 1e5e14ce..937906fa 100644
--- a/backend/src/nodes/logic/switch/switch.schema.spec.ts
+++ b/backend/src/nodes/logic/switch/switch.schema.spec.ts
@@ -274,9 +274,9 @@ describe('Switch node schema', () => {
     it('emits both Korean warnings on a freshly-created node', () => {
       const errors = evaluateMetadataBlockingErrors(switchNodeMetadata, {});
       expect(errors).toContain(
-        'Value 모드에서는 Switch Value 를 입력해야 합니다.',
+        'In Value mode, Switch Value must be entered.',
       );
-      expect(errors).toContain('최소 1개 이상의 case 를 추가해야 합니다.');
+      expect(errors).toContain('At least one case must be added.');
     });
 
     it('returns [] when fully configured (value mode)', () => {

```

---

### 파일 74: backend/src/nodes/logic/switch/switch.schema.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/logic/switch/switch.schema.ts b/backend/src/nodes/logic/switch/switch.schema.ts
index 008bc582..615d2e8e 100644
--- a/backend/src/nodes/logic/switch/switch.schema.ts
+++ b/backend/src/nodes/logic/switch/switch.schema.ts
@@ -212,12 +212,12 @@ export const switchNodeMetadata: NodeComponentMetadata = {
       // `mode != expression` instead of `mode == value` covers both.
       id: 'switch:value-mode-needs-switch-value',
       when: 'mode != expression && !switchValue',
-      message: 'Value 모드에서는 Switch Value 를 입력해야 합니다.',
+      message: 'In Value mode, Switch Value must be entered.',
     },
     {
       id: 'switch:no-cases',
       when: 'length(cases) == 0',
-      message: '최소 1개 이상의 case 를 추가해야 합니다.',
+      message: 'At least one case must be added.',
     },
   ],
   validateConfig: validateSwitchConfig,

```

---

### 파일 75: backend/src/nodes/logic/variable-declaration/variable-declaration.handler.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/logic/variable-declaration/variable-declaration.handler.spec.ts b/backend/src/nodes/logic/variable-declaration/variable-declaration.handler.spec.ts
index 0b2575e6..6ee254d7 100644
--- a/backend/src/nodes/logic/variable-declaration/variable-declaration.handler.spec.ts
+++ b/backend/src/nodes/logic/variable-declaration/variable-declaration.handler.spec.ts
@@ -35,14 +35,14 @@ describe('VariableDeclarationHandler', () => {
     it('should return invalid when variables is missing', () => {
       const result = handler.validate({});
       expect(result.valid).toBe(false);
-      // Schema warningRule "최소 1개 이상의 변수를 정의해야 합니다." fires.
-      expect(result.errors.some((e) => e.includes('변수'))).toBe(true);
+      // Schema warningRule "At least one variable must be defined." fires.
+      expect(result.errors.some((e) => e.includes('variable'))).toBe(true);
     });
 
     it('should return invalid when variables is empty', () => {
       const result = handler.validate({ variables: [] });
       expect(result.valid).toBe(false);
-      expect(result.errors.some((e) => e.includes('변수'))).toBe(true);
+      expect(result.errors.some((e) => e.includes('variable'))).toBe(true);
     });
 
     it('should return invalid when variable name is missing', () => {

```

---

### 파일 76: backend/src/nodes/logic/variable-declaration/variable-declaration.schema.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/logic/variable-declaration/variable-declaration.schema.spec.ts b/backend/src/nodes/logic/variable-declaration/variable-declaration.schema.spec.ts
index d764075b..36457ac4 100644
--- a/backend/src/nodes/logic/variable-declaration/variable-declaration.schema.spec.ts
+++ b/backend/src/nodes/logic/variable-declaration/variable-declaration.schema.spec.ts
@@ -75,7 +75,7 @@ describe('evaluateMetadataBlockingErrors integration (variable_declaration)', ()
   it('emits the Korean warning on a freshly-created node', () => {
     expect(
       evaluateMetadataBlockingErrors(variableDeclarationNodeMetadata, {}),
-    ).toContain('최소 1개 이상의 변수를 정의해야 합니다.');
+    ).toContain('At least one variable must be defined.');
   });
 
   it('returns [] when configured with a valid variable', () => {

```

---

### 파일 77: backend/src/nodes/logic/variable-declaration/variable-declaration.schema.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/logic/variable-declaration/variable-declaration.schema.ts b/backend/src/nodes/logic/variable-declaration/variable-declaration.schema.ts
index 403ccce4..69856703 100644
--- a/backend/src/nodes/logic/variable-declaration/variable-declaration.schema.ts
+++ b/backend/src/nodes/logic/variable-declaration/variable-declaration.schema.ts
@@ -116,12 +116,12 @@ export const variableDeclarationNodeMetadata: NodeComponentMetadata = {
     {
       id: 'variable_declaration:no-variables',
       when: 'length(variables) == 0',
-      message: '최소 1개 이상의 변수를 정의해야 합니다.',
+      message: 'At least one variable must be defined.',
     },
     {
       id: 'variable_declaration:first-variable-name-empty',
       when: 'length(variables) > 0 && !variables.0.name',
-      message: '첫 번째 변수의 이름을 입력해야 합니다.',
+      message: 'First variable\'s name must be entered.',
     },
   ],
   validateConfig: validateVariableDeclarationConfig,

```

---

### 파일 78: backend/src/nodes/logic/variable-modification/variable-modification.handler.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/logic/variable-modification/variable-modification.handler.spec.ts b/backend/src/nodes/logic/variable-modification/variable-modification.handler.spec.ts
index e04f797a..938793c9 100644
--- a/backend/src/nodes/logic/variable-modification/variable-modification.handler.spec.ts
+++ b/backend/src/nodes/logic/variable-modification/variable-modification.handler.spec.ts
@@ -42,8 +42,8 @@ describe('VariableModificationHandler', () => {
     it('should reject missing modifications', () => {
       const result = handler.validate({});
       expect(result.valid).toBe(false);
-      // Schema warningRule "최소 1개 이상의 변경을 추가해야 합니다." fires.
-      expect(result.errors.some((e) => e.includes('변경'))).toBe(true);
+      // Schema warningRule "At least one modification must be added." fires.
+      expect(result.errors.some((e) => e.includes('modification'))).toBe(true);
     });
 
     it('should reject non-array modifications', () => {
@@ -54,7 +54,7 @@ describe('VariableModificationHandler', () => {
     it('should reject empty modifications array', () => {
       const result = handler.validate({ modifications: [] });
       expect(result.valid).toBe(false);
-      expect(result.errors.some((e) => e.includes('변경'))).toBe(true);
+      expect(result.errors.some((e) => e.includes('modification'))).toBe(true);
     });
 
     it('should reject modification with missing variable', () => {

```

---

### 파일 79: backend/src/nodes/logic/variable-modification/variable-modification.schema.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/logic/variable-modification/variable-modification.schema.spec.ts b/backend/src/nodes/logic/variable-modification/variable-modification.schema.spec.ts
index 6e5cf715..7275bb47 100644
--- a/backend/src/nodes/logic/variable-modification/variable-modification.schema.spec.ts
+++ b/backend/src/nodes/logic/variable-modification/variable-modification.schema.spec.ts
@@ -89,7 +89,7 @@ describe('evaluateMetadataBlockingErrors integration (variable_modification)', (
   it('emits the Korean warning on a freshly-created node', () => {
     expect(
       evaluateMetadataBlockingErrors(variableModificationNodeMetadata, {}),
-    ).toContain('최소 1개 이상의 변경을 추가해야 합니다.');
+    ).toContain('At least one modification must be added.');
   });
 
   it('returns [] when configured', () => {

```

---

### 파일 80: backend/src/nodes/logic/variable-modification/variable-modification.schema.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/logic/variable-modification/variable-modification.schema.ts b/backend/src/nodes/logic/variable-modification/variable-modification.schema.ts
index 1ca85a36..fce25ecc 100644
--- a/backend/src/nodes/logic/variable-modification/variable-modification.schema.ts
+++ b/backend/src/nodes/logic/variable-modification/variable-modification.schema.ts
@@ -161,12 +161,12 @@ export const variableModificationNodeMetadata: NodeComponentMetadata = {
     {
       id: 'variable_modification:no-modifications',
       when: 'length(modifications) == 0',
-      message: '최소 1개 이상의 변경을 추가해야 합니다.',
+      message: 'At least one modification must be added.',
     },
     {
       id: 'variable_modification:first-variable-empty',
       when: 'length(modifications) > 0 && !modifications.0.variable',
-      message: '첫 번째 변경의 대상 변수를 선택해야 합니다.',
+      message: 'First modification\'s target variable must be selected.',
     },
   ],
   validateConfig: validateVariableModificationConfig,

```

---

### 파일 81: backend/src/nodes/presentation/carousel/carousel.handler.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/presentation/carousel/carousel.handler.spec.ts b/backend/src/nodes/presentation/carousel/carousel.handler.spec.ts
index d4df5f47..1738969e 100644
--- a/backend/src/nodes/presentation/carousel/carousel.handler.spec.ts
+++ b/backend/src/nodes/presentation/carousel/carousel.handler.spec.ts
@@ -47,7 +47,7 @@ describe('CarouselHandler', () => {
     it('should fail when titleField is missing in dynamic mode', () => {
       const result = handler.validate({});
       expect(result.valid).toBe(false);
-      // Schema warningRule "Dynamic 모드에서는 Title 필드를 입력해야 합니다." fires.
+      // Schema warningRule "In Dynamic mode, a Title field must be entered." fires.
       expect(result.errors.some((e) => e.includes('Title'))).toBe(true);
     });
 
@@ -95,14 +95,14 @@ describe('CarouselHandler', () => {
     it('should fail when items is missing in static mode', () => {
       const result = handler.validate({ mode: 'static' });
       expect(result.valid).toBe(false);
-      // Schema warningRule "Static 모드에서는 최소 1개 이상의 슬라이드를 추가해야 합니다." fires.
-      expect(result.errors.some((e) => e.includes('슬라이드'))).toBe(true);
+      // Schema warningRule "In Static mode, at least one slide must be added." fires.
+      expect(result.errors.some((e) => e.includes('slide'))).toBe(true);
     });
 
     it('should fail when items is empty array in static mode', () => {
       const result = handler.validate({ mode: 'static', items: [] });
       expect(result.valid).toBe(false);
-      expect(result.errors.some((e) => e.includes('슬라이드'))).toBe(true);
+      expect(result.errors.some((e) => e.includes('slide'))).toBe(true);
     });
 
     it('should fail when items is not an array in static mode', () => {
@@ -144,7 +144,7 @@ describe('CarouselHandler', () => {
     it('should fail for invalid mode value', () => {
       const result = handler.validate({ mode: 'unknown' });
       expect(result.valid).toBe(false);
-      // Schema warningRule "Mode 는 static 또는 dynamic 이어야 합니다." fires.
+      // Schema warningRule "Mode must be either static or dynamic." fires.
       expect(result.errors.some((e) => e.includes('Mode'))).toBe(true);
     });
 

```

---

### 파일 82: backend/src/nodes/presentation/carousel/carousel.schema.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/presentation/carousel/carousel.schema.spec.ts b/backend/src/nodes/presentation/carousel/carousel.schema.spec.ts
index 29e5c509..e7862bf7 100644
--- a/backend/src/nodes/presentation/carousel/carousel.schema.spec.ts
+++ b/backend/src/nodes/presentation/carousel/carousel.schema.spec.ts
@@ -298,7 +298,7 @@ describe('evaluateMetadataBlockingErrors integration (carousel)', () => {
     });
     // Declarative fires:
     expect(errors).toContain(
-      'Dynamic 모드에서는 Title 필드를 입력해야 합니다.',
+      'In Dynamic mode, a Title field must be entered.',
     );
     // Imperative (validateButtons) fires:
     expect(errors).toEqual(

```

---

### 파일 83: backend/src/nodes/presentation/carousel/carousel.schema.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/presentation/carousel/carousel.schema.ts b/backend/src/nodes/presentation/carousel/carousel.schema.ts
index d440db66..a9d12fd5 100644
--- a/backend/src/nodes/presentation/carousel/carousel.schema.ts
+++ b/backend/src/nodes/presentation/carousel/carousel.schema.ts
@@ -431,17 +431,17 @@ export const carouselNodeMetadata: NodeComponentMetadata = {
     {
       id: 'carousel:dynamic-mode-needs-title-field',
       when: 'mode == dynamic && !titleField',
-      message: 'Dynamic 모드에서는 Title 필드를 입력해야 합니다.',
+      message: 'In Dynamic mode, a Title field must be entered.',
     },
     {
       id: 'carousel:static-mode-needs-items',
       when: 'mode == static && length(items) == 0',
-      message: 'Static 모드에서는 최소 1개 이상의 슬라이드를 추가해야 합니다.',
+      message: 'In Static mode, at least one slide must be added.',
     },
     {
       id: 'carousel:invalid-mode',
       when: 'mode != static && mode != dynamic',
-      message: 'Mode 는 static 또는 dynamic 이어야 합니다.',
+      message: 'Mode must be either static or dynamic.',
     },
   ],
   validateConfig: validateCarouselConfig,

```

---

### 파일 84: backend/src/nodes/presentation/chart/chart.handler.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/presentation/chart/chart.handler.spec.ts b/backend/src/nodes/presentation/chart/chart.handler.spec.ts
index 73b64936..3da83825 100644
--- a/backend/src/nodes/presentation/chart/chart.handler.spec.ts
+++ b/backend/src/nodes/presentation/chart/chart.handler.spec.ts
@@ -52,7 +52,7 @@ describe('ChartHandler', () => {
       const result = handler.validate({ xAxis: { field: 'x' } });
       expect(result.valid).toBe(false);
       // Schema warningRule fires when chartType is missing.
-      expect(result.errors.some((e) => e.includes('차트 타입'))).toBe(true);
+      expect(result.errors.some((e) => e.includes('Chart type'))).toBe(true);
     });
 
     it('should reject invalid chartType', () => {
@@ -78,8 +78,8 @@ describe('ChartHandler', () => {
     it('should reject missing xAxis', () => {
       const result = handler.validate({ chartType: 'bar' });
       expect(result.valid).toBe(false);
-      // Schema warningRule "X축 필드를 입력해야 합니다." fires.
-      expect(result.errors.some((e) => e.includes('X축'))).toBe(true);
+      // Schema warningRule "X-axis field must be entered." fires.
+      expect(result.errors.some((e) => e.includes('X-axis'))).toBe(true);
     });
 
     it('should reject xAxis without field', () => {

```

---

### 파일 85: backend/src/nodes/presentation/chart/chart.schema.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/presentation/chart/chart.schema.spec.ts b/backend/src/nodes/presentation/chart/chart.schema.spec.ts
index e80e6f59..8de3af13 100644
--- a/backend/src/nodes/presentation/chart/chart.schema.spec.ts
+++ b/backend/src/nodes/presentation/chart/chart.schema.spec.ts
@@ -105,8 +105,8 @@ describe('evaluateMetadataBlockingErrors integration (chart)', () => {
     });
     expect(errors).toEqual(
       expect.arrayContaining([
-        'X축 필드를 입력해야 합니다.',
-        'Y축 필드를 입력해야 합니다.',
+        'X-axis field must be entered.',
+        'Y-axis field must be entered.',
       ]),
     );
   });

```

---

### 파일 86: backend/src/nodes/presentation/chart/chart.schema.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/presentation/chart/chart.schema.ts b/backend/src/nodes/presentation/chart/chart.schema.ts
index d6b5534d..0c2a1d9a 100644
--- a/backend/src/nodes/presentation/chart/chart.schema.ts
+++ b/backend/src/nodes/presentation/chart/chart.schema.ts
@@ -158,17 +158,17 @@ export const chartMetadata: NodeComponentMetadata = {
     {
       id: 'chart:no-chart-type',
       when: '!chartType',
-      message: '차트 타입을 선택해야 합니다.',
+      message: 'Chart type must be selected.',
     },
     {
       id: 'chart:no-x-axis-field',
       when: '!xAxis.field',
-      message: 'X축 필드를 입력해야 합니다.',
+      message: 'X-axis field must be entered.',
     },
     {
       id: 'chart:no-y-axis-field',
       when: '!yAxis.field',
-      message: 'Y축 필드를 입력해야 합니다.',
+      message: 'Y-axis field must be entered.',
     },
   ],
   validateConfig: validateChartConfig,

```

---

### 파일 87: backend/src/nodes/presentation/form/form.handler.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/presentation/form/form.handler.spec.ts b/backend/src/nodes/presentation/form/form.handler.spec.ts
index 02f198e1..6631e34a 100644
--- a/backend/src/nodes/presentation/form/form.handler.spec.ts
+++ b/backend/src/nodes/presentation/form/form.handler.spec.ts
@@ -32,14 +32,14 @@ describe('FormHandler', () => {
     it('rejects missing fields', () => {
       const result = handler.validate({});
       expect(result.valid).toBe(false);
-      // Schema warningRule "최소 1개 이상의 필드를 정의해야 합니다." fires.
-      expect(result.errors.some((e) => e.includes('필드'))).toBe(true);
+      // Schema warningRule "At least one field must be defined." fires.
+      expect(result.errors.some((e) => e.includes('field'))).toBe(true);
     });
 
     it('rejects empty fields array', () => {
       const result = handler.validate({ fields: [] });
       expect(result.valid).toBe(false);
-      expect(result.errors.some((e) => e.includes('필드'))).toBe(true);
+      expect(result.errors.some((e) => e.includes('field'))).toBe(true);
     });
 
     it('rejects non-array fields', () => {
@@ -51,7 +51,7 @@ describe('FormHandler', () => {
     it('rejects null fields', () => {
       const result = handler.validate({ fields: null });
       expect(result.valid).toBe(false);
-      expect(result.errors.some((e) => e.includes('필드'))).toBe(true);
+      expect(result.errors.some((e) => e.includes('field'))).toBe(true);
     });
   });
 

```

---

### 파일 88: backend/src/nodes/presentation/form/form.schema.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/presentation/form/form.schema.spec.ts b/backend/src/nodes/presentation/form/form.schema.spec.ts
index 0e99d117..066ce5b5 100644
--- a/backend/src/nodes/presentation/form/form.schema.spec.ts
+++ b/backend/src/nodes/presentation/form/form.schema.spec.ts
@@ -61,7 +61,7 @@ describe('optionSchema (select/radio/checkbox 옵션)', () => {
 describe('evaluateMetadataBlockingErrors integration (form)', () => {
   it('returns the Korean warning message for an empty form', () => {
     expect(evaluateMetadataBlockingErrors(formNodeMetadata, {})).toEqual([
-      '최소 1개 이상의 필드를 정의해야 합니다.',
+      'At least one field must be defined.',
     ]);
   });
 

```

---

### 파일 89: backend/src/nodes/presentation/form/form.schema.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/presentation/form/form.schema.ts b/backend/src/nodes/presentation/form/form.schema.ts
index 8c0fe84a..949c0852 100644
--- a/backend/src/nodes/presentation/form/form.schema.ts
+++ b/backend/src/nodes/presentation/form/form.schema.ts
@@ -174,7 +174,7 @@ export const formNodeMetadata: NodeComponentMetadata = {
     {
       id: 'form:no-fields',
       when: 'length(fields) == 0',
-      message: '최소 1개 이상의 필드를 정의해야 합니다.',
+      message: 'At least one field must be defined.',
     },
   ],
 };

```

---

### 파일 90: backend/src/nodes/presentation/table/table.handler.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/presentation/table/table.handler.spec.ts b/backend/src/nodes/presentation/table/table.handler.spec.ts
index 44e80496..317d2d71 100644
--- a/backend/src/nodes/presentation/table/table.handler.spec.ts
+++ b/backend/src/nodes/presentation/table/table.handler.spec.ts
@@ -49,13 +49,13 @@ describe('TableHandler', () => {
     it('should warn when columns is missing (schema warningRule)', () => {
       const result = handler.validate({});
       expect(result.valid).toBe(false);
-      expect(result.errors.some((e) => e.includes('컬럼'))).toBe(true);
+      expect(result.errors.some((e) => e.includes('column'))).toBe(true);
     });
 
     it('should warn when columns array is empty (schema warningRule)', () => {
       const result = handler.validate({ columns: [] });
       expect(result.valid).toBe(false);
-      expect(result.errors.some((e) => e.includes('컬럼'))).toBe(true);
+      expect(result.errors.some((e) => e.includes('column'))).toBe(true);
     });
 
     it('should fail when columns is not an array', () => {
@@ -81,7 +81,7 @@ describe('TableHandler', () => {
         rows: [{ col0: 'Value' }],
       });
       expect(result.valid).toBe(false);
-      expect(result.errors.some((e) => e.includes('컬럼'))).toBe(true);
+      expect(result.errors.some((e) => e.includes('column'))).toBe(true);
     });
 
     it('should accept missing rows in static mode (schema default is [])', () => {
@@ -118,7 +118,7 @@ describe('TableHandler', () => {
         columns: [{ field: 'name', label: 'Name' }],
       });
       expect(result.valid).toBe(false);
-      // Schema warningRule "Mode 는 static 또는 dynamic 이어야 합니다." fires.
+      // Schema warningRule "Mode must be either static or dynamic." fires.
       expect(result.errors.some((e) => e.includes('Mode'))).toBe(true);
     });
 

```

---

### 파일 91: backend/src/nodes/presentation/table/table.schema.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/presentation/table/table.schema.spec.ts b/backend/src/nodes/presentation/table/table.schema.spec.ts
index 5053e2e4..d7da61d0 100644
--- a/backend/src/nodes/presentation/table/table.schema.spec.ts
+++ b/backend/src/nodes/presentation/table/table.schema.spec.ts
@@ -127,7 +127,7 @@ describe('evaluateMetadataBlockingErrors integration (table)', () => {
       columns: [],
       sortBy: 'phantom',
     });
-    expect(errors).toContain('컬럼을 1개 이상 정의해야 합니다.');
+    expect(errors).toContain('At least one column must be defined.');
     // sortBy doesn't match because columns is empty → no field list → skipped.
     // Add a column to confirm that branch fires correctly:
     const withColumn = evaluateMetadataBlockingErrors(tableNodeMetadata, {

```

---

### 파일 92: backend/src/nodes/presentation/table/table.schema.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/presentation/table/table.schema.ts b/backend/src/nodes/presentation/table/table.schema.ts
index 3a1e63dc..9be6ec30 100644
--- a/backend/src/nodes/presentation/table/table.schema.ts
+++ b/backend/src/nodes/presentation/table/table.schema.ts
@@ -296,12 +296,12 @@ export const tableNodeMetadata: NodeComponentMetadata = {
     {
       id: 'table:no-columns',
       when: 'length(columns) == 0',
-      message: '컬럼을 1개 이상 정의해야 합니다.',
+      message: 'At least one column must be defined.',
     },
     {
       id: 'table:invalid-mode',
       when: 'mode != static && mode != dynamic',
-      message: 'Mode 는 static 또는 dynamic 이어야 합니다.',
+      message: 'Mode must be either static or dynamic.',
     },
   ],
   validateConfig: validateTableConfig,

```

---

### 파일 93: backend/src/nodes/presentation/template/template.schema.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/presentation/template/template.schema.spec.ts b/backend/src/nodes/presentation/template/template.schema.spec.ts
index e0b49d82..c0715865 100644
--- a/backend/src/nodes/presentation/template/template.schema.spec.ts
+++ b/backend/src/nodes/presentation/template/template.schema.spec.ts
@@ -53,7 +53,7 @@ describe('validateTemplateConfig (imperative)', () => {
 describe('evaluateMetadataBlockingErrors integration (template)', () => {
   it('emits the Korean warning when template body is empty', () => {
     expect(evaluateMetadataBlockingErrors(templateNodeMetadata, {})).toContain(
-      'Template 본문을 입력해야 합니다.',
+      'Template body must be entered.',
     );
   });
 

```

---

### 파일 94: backend/src/nodes/presentation/template/template.schema.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/nodes/presentation/template/template.schema.ts b/backend/src/nodes/presentation/template/template.schema.ts
index 676b53cc..df4efd5b 100644
--- a/backend/src/nodes/presentation/template/template.schema.ts
+++ b/backend/src/nodes/presentation/template/template.schema.ts
@@ -151,7 +151,7 @@ export const templateNodeMetadata: NodeComponentMetadata = {
     {
       id: 'template:no-template',
       when: '!template',
-      message: 'Template 본문을 입력해야 합니다.',
+      message: 'Template body must be entered.',
     },
   ],
   validateConfig: validateTemplateConfig,

```

---

### 파일 95: frontend/src/components/editor/canvas/custom-node.tsx
- 변경 유형: Review
- 언어: tsx

#### 변경된 코드
```
diff --git a/frontend/src/components/editor/canvas/custom-node.tsx b/frontend/src/components/editor/canvas/custom-node.tsx
index 5de3da05..61f4e026 100644
--- a/frontend/src/components/editor/canvas/custom-node.tsx
+++ b/frontend/src/components/editor/canvas/custom-node.tsx
@@ -12,6 +12,7 @@ import { useExecutionStore } from "@/lib/stores/execution-store";
 import { getConfigSummary, truncateSummary } from "@/lib/utils/node-config-summary";
 import type { SummaryContext } from "@/lib/utils/node-config-summary";
 import { llmConfigsApi, type LlmConfigData } from "@/lib/api/llm-configs";
+import { useLocale } from "@/lib/i18n";
 import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
 import { NodeIcon } from "./node-icon";
 
@@ -81,9 +82,10 @@ function CustomNodeComponent({ id, data, selected }: NodeProps<CustomNodeType>)
     return { hasDefaultLlmConfig: configs.some((c) => c.isDefault) };
   }, [isAiNode, llmConfigsData]);
 
+  const locale = useLocale();
   const summary = useMemo(
-    () => getConfigSummary(data.type, data.config, summaryContext),
-    [data.type, data.config, summaryContext],
+    () => getConfigSummary(data.type, data.config, summaryContext, locale),
+    [data.type, data.config, summaryContext, locale],
   );
 
   const { display: displayText, isTruncated } = useMemo(

```

---

### 파일 96: frontend/src/components/editor/settings-panel/node-configs/__tests__/cafe24-config.test.tsx
- 변경 유형: Review
- 언어: tsx


... (diff omitted due to prompt size limit) ...

---

### 파일 97: frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx
- 변경 유형: Review
- 언어: tsx


... (diff omitted due to prompt size limit) ...

---

### 파일 98: frontend/src/components/editor/settings-panel/node-configs/shared.tsx
- 변경 유형: Review
- 언어: tsx

#### 변경된 코드
```
diff --git a/frontend/src/components/editor/settings-panel/node-configs/shared.tsx b/frontend/src/components/editor/settings-panel/node-configs/shared.tsx
index 4d962d8b..da8e07e1 100644
--- a/frontend/src/components/editor/settings-panel/node-configs/shared.tsx
+++ b/frontend/src/components/editor/settings-panel/node-configs/shared.tsx
@@ -242,6 +242,7 @@ export function KeyValueEditor({
               size="icon"
               className="h-7 w-7 shrink-0"
               onClick={() => removeItem(i)}
+              aria-label={t("editor.sharedRemoveRow")}
             >
               <X size={12} />
             </Button>

```

---

### 파일 99: frontend/src/content/docs/02-nodes/ai.en.mdx
- 변경 유형: Review
- 언어: mdx


... (diff omitted due to prompt size limit) ...

---

### 파일 100: frontend/src/content/docs/02-nodes/ai.mdx
- 변경 유형: Review
- 언어: mdx


... (diff omitted due to prompt size limit) ...

---

### 파일 101: frontend/src/content/docs/02-nodes/integrations.en.mdx
- 변경 유형: Review
- 언어: mdx


... (diff omitted due to prompt size limit) ...

---

### 파일 102: frontend/src/content/docs/02-nodes/integrations.mdx
- 변경 유형: Review
- 언어: mdx


... (diff omitted due to prompt size limit) ...

---

### 파일 103: frontend/src/content/docs/02-nodes/overview.en.mdx
- 변경 유형: Review
- 언어: mdx

#### 변경된 코드
```
diff --git a/frontend/src/content/docs/02-nodes/overview.en.mdx b/frontend/src/content/docs/02-nodes/overview.en.mdx
index 1398d931..fad850b8 100644
--- a/frontend/src/content/docs/02-nodes/overview.en.mdx
+++ b/frontend/src/content/docs/02-nodes/overview.en.mdx
@@ -17,7 +17,7 @@ Nodes are grouped into seven categories. Each has a distinct color that makes th
   {name: "Logic", required: false, type: "Blue #3B82F6", description: "Controls data flow — branches, loops, variables, merges.", default: "-"},
   {name: "Flow", required: false, type: "Purple #8B5CF6", description: "Calls other workflows as sub-workflows.", default: "-"},
   {name: "AI", required: false, type: "Green #10B981", description: "LLM-powered agents, classification, and information extraction.", default: "-"},
-  {name: "Integration", required: false, type: "Orange #F97316", description: "Integrations with external services like HTTP, databases, email.", default: "-"},
+  {name: "Integration", required: false, type: "Orange #F97316", description: "Integrations with external services like HTTP, databases, email, and Cafe24.", default: "-"},
   {name: "Data", required: false, type: "Cyan #06B6D4", description: "Shape and transform data with Transform and Code nodes.", default: "-"},
   {name: "Presentation", required: false, type: "Pink #EC4899", description: "Show results or collect input via carousel, chart, form, table, and template nodes.", default: "-"}
 ]} />

```

---

### 파일 104: frontend/src/content/docs/02-nodes/overview.mdx
- 변경 유형: Review
- 언어: mdx

#### 변경된 코드
```
diff --git a/frontend/src/content/docs/02-nodes/overview.mdx b/frontend/src/content/docs/02-nodes/overview.mdx
index 09385652..b24766b9 100644
--- a/frontend/src/content/docs/02-nodes/overview.mdx
+++ b/frontend/src/content/docs/02-nodes/overview.mdx
@@ -28,7 +28,7 @@ code: ["backend/src/nodes/core/node-component.interface.ts", "backend/src/nodes/
   {name: "Logic", required: false, type: "파랑 #3B82F6", description: "분기, 반복, 변수, 병합 등 데이터 흐름을 제어해요.", default: "-"},
   {name: "Flow", required: false, type: "보라 #8B5CF6", description: "다른 워크플로우를 서브 워크플로우로 호출해요.", default: "-"},
   {name: "AI", required: false, type: "초록 #10B981", description: "LLM 기반 에이전트, 분류, 정보 추출을 수행해요.", default: "-"},
-  {name: "Integration", required: false, type: "주황 #F97316", description: "HTTP, 데이터베이스, 이메일 같은 외부 서비스 연동이에요.", default: "-"},
+  {name: "Integration", required: false, type: "주황 #F97316", description: "HTTP, 데이터베이스, 이메일, Cafe24 같은 외부 서비스 연동이에요.", default: "-"},
   {name: "Data", required: false, type: "시안 #06B6D4", description: "Transform과 Code로 데이터를 가공해요.", default: "-"},
   {name: "Presentation", required: false, type: "핑크 #EC4899", description: "캐러셀, 차트, 폼, 테이블, 템플릿으로 결과를 보여주거나 입력을 받아요.", default: "-"}
 ]} />

```

---

### 파일 105: frontend/src/content/docs/04-expression-language/variables-and-context.en.mdx
- 변경 유형: Review
- 언어: mdx


... (diff omitted due to prompt size limit) ...

---

### 파일 106: frontend/src/content/docs/04-expression-language/variables-and-context.mdx
- 변경 유형: Review
- 언어: mdx

#### 변경된 코드
```
diff --git a/frontend/src/content/docs/04-expression-language/variables-and-context.mdx b/frontend/src/content/docs/04-expression-language/variables-and-context.mdx
index 68b8baa5..de020b5a 100644
--- a/frontend/src/content/docs/04-expression-language/variables-and-context.mdx
+++ b/frontend/src/content/docs/04-expression-language/variables-and-context.mdx
@@ -23,7 +23,8 @@ code: ["packages/expression-engine/src/evaluator.ts"]
   { name: "$trigger", type: "Object", description: "트리거 데이터예요. 웹훅 페이로드, 스케줄 컨텍스트 등이 들어가요." },
   { name: "$loop", type: "Object", description: "Loop 노드 내부 컨텍스트예요. 인덱스, 반복 횟수, 첫·마지막 여부를 담아요." },
   { name: "$item", type: "Any", description: "ForEach/Map 컨테이너의 현재 항목이에요." },
-  { name: "$itemIndex", type: "Number", description: "ForEach 현재 인덱스예요. 0부터 시작해요." }
+  { name: "$itemIndex", type: "Number", description: "ForEach 현재 인덱스예요. 0부터 시작해요." },
+  { name: "$thread", type: "Object", description: "Conversation Thread — 워크플로우 실행 동안 누적된 사용자·AI Agent turn 의 읽기 전용 스냅샷이에요. `turns`, `length`, `text` 속성을 가져요." }
 ]} />
 
 ## `$input`: 직전 노드 결과
@@ -144,6 +145,42 @@ Webhook, Schedule, Manual 트리거가 제공하는 원본 데이터에 접근
 ```
 </Example>
 
+## `$thread`: Conversation Thread
+
+워크플로우가 실행되는 동안 누적된 **사용자 입력 + AI Agent 응답 turn** 의 읽기 전용 뷰예요. AI Agent 노드의 `contextScope` 자동 주입과는 별개로, 어떤 표현식에서나 명시적으로 참조할 수 있어요.
+
+<FieldTable rows={[
+  { name: "turns", type: "Array", description: "ConversationTurn 배열의 readonly 스냅샷이에요. 각 turn 은 `source`, `role`, `nodeId`, `data` 등을 포함해요." },
+  { name: "length", type: "Number", description: "누적된 turn 개수예요." },
+  { name: "text", type: "String", description: "전체 thread 를 system_text 포맷으로 렌더한 결과예요. 첫 접근 시 메모이즈돼요." }
+]} />
+
+<Example title="누적 turn 개수로 분기">
+```ts
+{{ $thread.length > 5 }}
+```
+</Example>
+
+<Example title="전체 thread 텍스트를 후속 노드 입력으로 첨부">
+```ts
+{{ $thread.text }}
+```
+</Example>
+
+<Example title="첫 turn 의 form 데이터 필드 참조 (Presentation Form turn 일 때)">
+```ts
+{{ $thread.turns[0].data.email }}
+```
+</Example>
+
+<Callout type="note">
+`$thread.text` 는 한 노드의 실행 컨텍스트 안에서 처음 접근할 때 전체 thread 를 렌더하고 그 결과를 캐시해요. 즉, **같은 노드의 표현식 안에서 여러 번 써도 1번만 렌더**돼요. 다만 ForEach/Loop 처럼 iteration 마다 새 노드 컨텍스트가 만들어지는 곳에서는 매번 다시 렌더되므로, 루프 안에서 자주 참조해야 하면 미리 변수 노드에 담아 두는 편이 안전해요.
+</Callout>
+
+<Callout type="tip">
+대부분의 경우 AI Agent 노드의 [Conversation Context 설정](/docs/02-nodes/ai#conversation-context)으로 자동 주입하는 편이 더 간단해요. 직접 `$thread` 를 참조하는 건 (1) AI Agent 가 아닌 노드(예: Transform/HTTP/Code)에서 thread 를 가공할 때, (2) 일부 turn만 골라 쓰고 싶을 때 유용해요.
+</Callout>
+
 ## 팁 & 참고
 
 - 자동완성은 마지막 실행 결과의 스키마를 기반으로 해요. 한 번도 실행하지 않은 워크플로우에서는 필드 제안이 제한되니 **먼저 한 번 실행**해 보는 걸 권장해요.

```

---

### 파일 107: frontend/src/lib/docs/__tests__/registry.test.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/frontend/src/lib/docs/__tests__/registry.test.ts b/frontend/src/lib/docs/__tests__/registry.test.ts
index 7efb6f21..7a65b98e 100644
--- a/frontend/src/lib/docs/__tests__/registry.test.ts
+++ b/frontend/src/lib/docs/__tests__/registry.test.ts
@@ -1,3 +1,4 @@
+import fs from "node:fs";
 import path from "node:path";
 import { describe, it, expect } from "vitest";
 import {
@@ -211,3 +212,43 @@ describe("buildSearchIndex(locale)", () => {
     expect(b?.title).toBe("두 번째 페이지");
   });
 });
+
+// spec/2-navigation/13-user-guide.md §11 ("빌드 시 검증") 의 요구사항:
+// "registry.ts 단위 테스트에서 모든 spec:/code: 경로 존재 확인".
+// 작성된 사용자 매뉴얼의 frontmatter 가 실재하는 spec / 코드 파일을 가리키는지
+// CI 시점에 강제해서, 리네임·삭제·오타로 매뉴얼이 dangling 참조가 되는 것을 방지한다.
+describe("real docs frontmatter spec/code paths", () => {
+  const repoRoot = path.resolve(__dirname, "..", "..", "..", "..", "..");
+  const realDocsRoot = path.resolve(__dirname, "..", "..", "..", "content", "docs");
+
+  // 본 worktree 에 실제 content/docs 가 있을 때만 검증. 격리 환경에서 docs 폴더가
+  // 부재할 수 있으므로 부재 시는 skip — 표준 개발 환경에서는 항상 수행된다.
+  const hasRealDocs = fs.existsSync(realDocsRoot);
+
+  it.runIf(hasRealDocs)(
+    "모든 .mdx frontmatter 의 spec/code 경로가 실재해요",
+    () => {
+      const index = loadDocsIndex(realDocsRoot, { includeDrafts: true });
+      const missing: string[] = [];
+      for (const section of index.sections) {
+        for (const page of section.pages) {
+          const fm = page.frontmatter;
+          const refs = [
+            ...(fm.spec ?? []).map((p) => ({ kind: "spec" as const, raw: p })),
+            ...(fm.code ?? []).map((p) => ({ kind: "code" as const, raw: p })),
+          ];
+          for (const ref of refs) {
+            // 일부 code 경로는 디렉터리이거나 trailing `/` 가 붙어 있다 — 양쪽 모두 허용.
+            const abs = path.resolve(repoRoot, ref.raw);
+            if (!fs.existsSync(abs)) {
+              missing.push(
+                `${section.key}/${page.slug.slice(-1)[0]} → ${ref.kind}: ${ref.raw}`,
+              );
+            }
+          }
+        }
+      }
+      expect(missing, missing.join("\n")).toEqual([]);
+    },
+  );
+});

```

---

### 파일 108: frontend/src/lib/i18n/backend-labels.ts
- 변경 유형: Review
- 언어: ts


... (diff omitted due to prompt size limit) ...

---

### 파일 109: frontend/src/lib/i18n/dict/en.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/frontend/src/lib/i18n/dict/en.ts b/frontend/src/lib/i18n/dict/en.ts
index 89dc6611..02cbb820 100644
--- a/frontend/src/lib/i18n/dict/en.ts
+++ b/frontend/src/lib/i18n/dict/en.ts
@@ -876,6 +876,7 @@ export const en: Dict = {
     searchNodesPlaceholder: "Search nodes...",
     noNodesFound: "No nodes found",
     sharedAdd: "Add",
+    sharedRemoveRow: "Remove row",
     fieldHelpAriaLabel: "Help",
     fieldHelpLearnMore: "Learn more →",
   },

```

---

### 파일 110: frontend/src/lib/i18n/dict/ko.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/frontend/src/lib/i18n/dict/ko.ts b/frontend/src/lib/i18n/dict/ko.ts
index 0ddc09ab..cd8caa45 100644
--- a/frontend/src/lib/i18n/dict/ko.ts
+++ b/frontend/src/lib/i18n/dict/ko.ts
@@ -874,6 +874,7 @@ export const ko = {
     searchNodesPlaceholder: "노드 검색...",
     noNodesFound: "일치하는 노드가 없어요",
     sharedAdd: "추가",
+    sharedRemoveRow: "행 제거",
     fieldHelpAriaLabel: "도움말",
     fieldHelpLearnMore: "자세히 보기 →",
   },

```

---

### 파일 111: frontend/src/lib/utils/node-config-summary.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/frontend/src/lib/utils/node-config-summary.ts b/frontend/src/lib/utils/node-config-summary.ts
index 207f97b3..62d30021 100644
--- a/frontend/src/lib/utils/node-config-summary.ts
+++ b/frontend/src/lib/utils/node-config-summary.ts
@@ -4,6 +4,8 @@ import {
   type EvaluatedWarning,
 } from "@workflow/node-summary";
 import { getNodeDefinition } from "@/lib/stores/node-definitions-store";
+import { translateBackendWarning } from "@/lib/i18n/backend-labels";
+import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/types";
 
 type NodeConfig = Record<string, unknown>;
 
@@ -60,6 +62,7 @@ export function getConfigSummary(
   nodeType: string,
   config: NodeConfig,
   context?: SummaryContext,
+  locale: Locale = DEFAULT_LOCALE,
 ): ConfigSummaryResult | null {
   if (nodeType === "manual_trigger") return null;
 
@@ -78,7 +81,9 @@ export function getConfigSummary(
     return true;
   });
   if (blocking) {
-    return { text: `⚠ ${blocking.message}`, isWarning: true };
+    const localized =
+      translateBackendWarning(blocking.message, locale) ?? blocking.message;
+    return { text: `⚠ ${localized}`, isWarning: true };
   }
 
   return renderSummaryTemplate(def?.summaryTemplate, config);

```

---

### 파일 112: plan/complete/cafe24-fields-add-button-fix.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/plan/complete/cafe24-fields-add-button-fix.md b/plan/complete/cafe24-fields-add-button-fix.md
new file mode 100644
index 00000000..8567cb19
--- /dev/null
+++ b/plan/complete/cafe24-fields-add-button-fix.md
@@ -0,0 +1,58 @@
+---
+worktree: cafe24-fields-add-btn-d3f8a2
+started: 2026-05-16
+owner: developer
+---
+
+# Cafe24 노드 `fields` 추가 버튼 무동작 버그 수정
+
+## 배경
+
+사용자 보고 (2026-05-16): 워크플로 에디터의 Cafe24 노드 설정 패널에서 `Fields` 항목의 "추가" 버튼을 눌러도 행이 늘어나지 않는다.
+
+## 원인
+
+`frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx` 의 `Cafe24Config`:
+
+1. `KeyValueEditor` 의 `addItem` → `onChange([...items, { key: "", value: "" }])` 로 빈 행 1개 추가.
+2. `Cafe24Config` 의 onChange 콜백은 받은 items 를 object 로 변환할 때 `if (it.key) obj[it.key] = it.value` — **빈 key 행을 즉시 버린다**.
+3. 다음 렌더에서 `normalizeCafe24Fields(config.fields)` 는 object 에서 다시 list 를 만드는데, 빈 key 항목은 사라진 상태이므로 새 행이 보이지 않는다.
+
+기존 코드 주석(line 339–342) 은 "Persist BOTH the keyvalue list (for UI round-trip) and the resolved object form" 이라 적었지만 실제로는 object 만 저장 — 주석과 구현의 괴리가 버그의 원인.
+
+## 해결 방향
+
+`Cafe24Config` 내부에 keyvalue 편집 버퍼용 React `useState` 도입:
+
+- 초기값: `useState(() => normalizeCafe24Fields(config.fields))` — 마운트 시 1회 props 에서 파생.
+- KeyValueEditor 의 onChange 는 로컬 state 를 갱신하고, 동시에 빈 key 를 제거한 object 형태로 `config.fields` 에 반영.
+- 외부 변경(undo/redo 등)으로 `config.fields` 가 우리의 마지막 출력과 다른 내용으로 들어오면 로컬 state 를 재동기화.
+- 백엔드 계약 `config.fields: Record<string, unknown>` 은 그대로 보존 ([spec §1](../../../spec/4-nodes/4-integration/4-cafe24.md#1-설정-config), [conventions/cafe24-api-metadata.md](../../../spec/conventions/cafe24-api-metadata.md)).
+- `SettingsTab` 이 `selectedNodeId` 로 keyed 되어 있어 노드 전환 시 컴포넌트가 unmount/remount — 다른 노드 선택으로 인한 state stale 문제 없음.
+
+## consistency-check 결과
+
+세션: `review/consistency/2026/05/16/09_03_04/SUMMARY.md` — **BLOCK: NO**. 5 checker 전체 NONE.
+
+INFO 권고:
+- `fields` 변수와 충돌 회피용 state 명칭은 `fieldRows` 사용 (naming_collision INFO 6).
+- 구현 완료 후 spec §2 또는 §9 Rationale 에 "fields 편집 UI 는 key-value 배열로 관리, onChange 시 object 변환" 한 줄 추가 권장 (cross_spec INFO 1 + rationale_continuity INFO 2). → 본 plan 종료 시 `plan/in-progress/spec-update-cafe24-fields-ui-buffer.md` 로 위임.
+
+§9 절 순서 역전 (9.7/9.8) · §5 Case 번호 불연속 등 사전 존재 위배는 별도 시점 처리 (이번 PR 범위 외).
+
+## 작업 항목
+
+- [x] worktree 진입 (`cafe24-fields-add-btn-d3f8a2`)
+- [x] 스펙 분석 (`spec/4-nodes/4-integration/4-cafe24.md`, `spec/conventions/cafe24-api-metadata.md`)
+- [x] consistency-check (BLOCK: NO)
+- [x] TDD — 추가 버튼 동작 회귀 테스트 작성
+- [x] 구현 — `Cafe24Config` 에 `useState` 도입
+- [x] TEST WORKFLOW (lint / unit / build)
+- [x] REVIEW WORKFLOW (`/ai-review`) → RESOLUTION 작성
+- [x] spec 보완 위임 plan 작성 (`plan/in-progress/spec-update-cafe24-fields-ui-buffer.md`)
+
+## 영향 범위
+
+- Frontend 단일 파일 수정 + 신규 unit test 1건
+- 백엔드 / 스펙 본문 / 데이터 모델 변경 없음
+- e2e 대상 아님 (단일 컴포넌트 UI 트윅) — `[skip-e2e]`

```

---

### 파일 113: plan/complete/e2e-makefile-followup-2026-05-16.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/plan/complete/e2e-makefile-followup-2026-05-16.md b/plan/complete/e2e-makefile-followup-2026-05-16.md
new file mode 100644
index 00000000..6e18cb13
--- /dev/null
+++ b/plan/complete/e2e-makefile-followup-2026-05-16.md
@@ -0,0 +1,38 @@
+---
+worktree: bg-monitoring-e2e-fix-f789b9
+started: 2026-05-16
+owner: developer
+---
+
+# e2e Makefile follow-up — 문서 안내 + help 갱신 + pattern 일관화 (2026-05-16)
+
+## 배경
+
+이전 `e2e-makefile-stale-image-fix-2026-05-16.md` 의 RESOLUTION 후속 항목 3건을 같은 worktree 에서 처리. 모두 `Makefile` 주변 문서·일관성 작업이라 단일 PR 로 묶는 편이 자연스럽다.
+
+## 작업 범위
+
+- [x] **README.md** — 「스크립트」 표 아래에 "격리 인프라 기반 e2e (`make e2e-*`)" 섹션 신설. 4개 target (`e2e-up`/`e2e-test`/`e2e-test-full`/`e2e-down`) 안내 + `--build` 자동 rebuild 동작 설명.
+- [x] **CHANGELOG.md** — "Unreleased" 하단에 "Test infrastructure" 섹션 신설. `make e2e-*` 의 `--build` 추가 결정과 사유(2026-05-15 background-monitoring 사례) 기록.
+- [x] **Makefile help 텍스트** — `e2e-up` / `e2e-test` / `e2e-test-full` 항목에 "(자동 image rebuild)" 추가.
+- [x] **`e2e-test-full` 패턴 의도 명시** — `runner1 && runner2; STATUS=$$?` 동작이 의도대로임을 다중-라인 주석으로 인라인 설명. 동작 변경 없음.
+
+### 동반 사전 결함 해소 (consistency-check 발견)
+
+본 PR 의 target 파일 자체가 docs-consolidation(2026-05-12) 컨벤션 위반을 사전부터 가지고 있음. 같은 파일을 편집하는 김에 동반 해소 (ISSUE FIX 정책).
+
+- [x] **README.md L77** — 「주요 경로」 트리의 폐기된 `prd/` 항목 제거. `spec/` 항목 설명을 "제품 정의·기술 명세 (single source of truth — 옛 prd/ 도 흡수)" 로 보강. `plan/`, `review/` 도 트리에 추가.
+- [x] **README.md L232** — `prd/`, `spec/` → `spec/` 단독 표기. "spec/PRD 헤딩" → "spec 헤딩".
+- [x] **CHANGELOG.md L4** — `user_memo/node-specs-improvement/CONVENTIONS.md` 를 `spec/conventions/node-output.md` 로 교체.
+
+## 의도적 제외
+
+- **README 「스크립트」 표 자체 재구성** — table 컬럼 변경은 별 PR 의 범위. 본 follow-up 은 e2e 안내 한 단락만 추가.
+- **CHANGELOG 의 다른 누락 항목** — Cafe24·background-monitoring 등 다수 누락이 있을 수 있으나 본 PR 범위 밖.
+
+## 체크리스트
+
+- [x] consistency-check --impl-prep — Critical 3건은 모두 사전 결함, 본 plan 범위로 흡수해 동반 해소. `review/consistency/2026/05/16/09_34_14/`.
+- [x] 구현
+- [x] TEST WORKFLOW — backend lint/unit/build 영향 없음 (코드 변경 0), e2e (`make e2e-test`) 12/12 suites, 66/66 tests PASS.
+- [x] REVIEW WORKFLOW — 13/13 reviewer success, Critical 0, Warning 3 (1건 즉시 조치 + 2건 plan 라이프사이클 자연 해소), Info 1건 즉시 조치. `review/code/2026/05/16/09_43_04/`.

```

---

### 파일 114: plan/complete/e2e-makefile-stale-image-fix-2026-05-16.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/plan/complete/e2e-makefile-stale-image-fix-2026-05-16.md b/plan/complete/e2e-makefile-stale-image-fix-2026-05-16.md
new file mode 100644
index 00000000..49a09c82
--- /dev/null
+++ b/plan/complete/e2e-makefile-stale-image-fix-2026-05-16.md
@@ -0,0 +1,49 @@
+---
+worktree: bg-monitoring-e2e-fix-f789b9
+started: 2026-05-16
+owner: developer
+---
+
+# `make e2e-test` Stale Docker Image — Background 모니터링 e2e 사전 결함 (2026-05-16)
+
+## 배경
+
+`background-monitoring.e2e-spec.ts` 의 2 테스트가 main 브랜치에서 reproducible 하게 실패. 사용자 보고 (user-guide-sync 작업의 REVIEW WORKFLOW 단계 e2e 결과) 후 본 worktree 에서 별도 조사.
+
+## 근본 원인 (Root Cause)
+
+`Makefile` 의 `e2e-test` / `e2e-up` / `e2e-test-full` 타겟이 `docker compose ... up -d --wait backend-e2e` 만 호출하고 **`--build` 플래그를 누락**했다. 결과:
+
+1. 첫 e2e 실행 후 `clemvion-e2e-backend-e2e:latest` 이미지가 Docker daemon 에 캐시됨.
+2. 이후 backend 소스 (controller / module / route) 가 추가·수정되어도 Compose 가 캐시된 이미지를 재사용 — rebuild 없이 그대로 컨테이너 기동.
+3. 새 컨트롤러가 이미지 안 `dist/` 에 없으므로 NestJS RoutesResolver 가 등록조차 하지 않고, 외부 요청은 Express 의 `Cannot GET ...` 404 로 떨어진다.
+
+### 증거
+
+- `docker inspect clemvion-e2e-backend-e2e:latest --format '{{.Created}}'` → `2026-05-12T10:21:35Z`.
+- `BackgroundRunsController` 추가 커밋 `cd7603df feat(executions): Background 본문 모니터링 API` → 5월 14-15일.
+- 빈 stale 이미지의 컨테이너 startup log 에서 `RoutesResolver` 등록 controller 26개 (소스 28개) — `BackgroundRunsController` 와 `ThirdPartyOAuthController` 누락.
+- `docker compose -f docker-compose.e2e.yml build backend-e2e` 후 동일 `make e2e-test` 실행 → 12/12 suites, 66/66 tests PASS.
+
+## 작업 범위
+
+- [x] `Makefile` 의 `e2e-up`, `e2e-test`, `e2e-test-full` 타겟에 `--build` 플래그 추가 — `up -d --wait --build backend-e2e`, `run --rm --build backend-e2e-runner`, `run --rm --build playwright-runner`. WHY: Docker BuildKit layer cache 가 변경되지 않은 layer 는 재사용하므로 첫 build 이후 오버헤드는 작음. 누락 시 새로 추가한 controller 가 stale 이미지에 반영되지 않아 사일런트 404.
+- [x] 사전 결함 lint error 동반 수정 — `third-party-oauth.controller.spec.ts` L428~430 의 `Record<string, unknown>` 타입을 `Record<string, string>` 로 좁혀 `@typescript-eslint/no-base-to-string` 위반 해소.
+- [x] consistency-check --impl-prep
+
+## 의도적 제외
+
+- **BackgroundRunsController / ThirdPartyOAuthController 로직 변경** — 코드 자체에는 문제 없음. stale 이미지가 유일한 원인.
+- **CI workflow 변경** — CI 는 매번 fresh container 라 영향 없음 (docker layer cache 도 사용량 한도까지).
+
+## 후속
+
+- 이 fix 이후 `make e2e-test` 가 매번 `docker compose ... up --build` 를 실행 → BuildKit layer cache 가 변경되지 않은 layer 는 재사용하므로 첫 build 이후 부담 작음.
+- (선택) `.github/workflows/*` 가 `make e2e-test` 를 그대로 호출하는지 확인. CI 는 매 실행 fresh runner 라 영향 없지만 의존성 명시 차원.
+
+## 체크리스트
+
+- [x] consistency-check
+- [x] 구현 (Makefile 수정 + 동반 lint fix)
+- [x] TEST WORKFLOW — backend lint(error 0)·unit(3580/3580 PASS)·build·e2e(`make e2e-test` 12/12 suites, 66/66 tests)
+- [x] REVIEW WORKFLOW — 13/13 reviewer success, Critical 0, Warning 1(미조치 사유 RESOLUTION 기록), 회귀 없음. `review/code/2026/05/16/09_22_53/` 참고.

```

---

### 파일 115: plan/in-progress/spec-update-cafe24-fields-ui-buffer.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/plan/in-progress/spec-update-cafe24-fields-ui-buffer.md b/plan/in-progress/spec-update-cafe24-fields-ui-buffer.md
new file mode 100644
index 00000000..86c3a051
--- /dev/null
+++ b/plan/in-progress/spec-update-cafe24-fields-ui-buffer.md
@@ -0,0 +1,41 @@
+---
+worktree: (none — project-planner 진입 시 새 worktree)
+started: 2026-05-16
+owner: project-planner (다음 진입자)
+---
+
+# Spec Update: Cafe24 `fields` UI 편집 버퍼 분리 원칙 기록
+
+## 배경
+
+`plan/in-progress/cafe24-fields-add-button-fix.md` 의 구현 과정에서 Cafe24 노드 설정 UI 의 `fields` 항목은 다음 두 가지 표현 사이를 왔다갔다 한다:
+
+- **저장된 config 표현** — `Record<string, unknown>` (백엔드 계약, [spec/4-nodes/4-integration/4-cafe24.md §1](../../spec/4-nodes/4-integration/4-cafe24.md#1-설정-config), [conventions/cafe24-api-metadata.md](../../spec/conventions/cafe24-api-metadata.md))
+- **UI 편집 버퍼** — `Array<{key: string; value: string}>` (React state 안에서만 존재)
+
+두 표현 사이 변환:
+- 저장 → 편집: 컴포넌트 마운트 시 `Object.entries` 로 행 배열로 펼침
+- 편집 → 저장: `onChange` 시 빈 key 행을 제거(객체 표현 불가)한 뒤 `Object.fromEntries` 로 저장
+
+이 분리가 spec/Rationale 에 명시되어 있지 않다 — 같은 패턴이 향후 다른 노드(e.g. KeyValueEditor 를 fields=object 로 노출하는 모든 케이스)에 재발할 수 있어 한 줄 기록 권장.
+
+## consistency-check 출처
+
+`review/consistency/2026/05/16/09_03_04/SUMMARY.md` INFO 1 + INFO 2 (cross_spec · rationale_continuity).
+
+## 제안 변경
+
+`spec/4-nodes/4-integration/4-cafe24.md` 의 §2 (설정 UI) 또는 §9 Rationale 에 다음 한 줄 추가:
+
+> **Fields 편집 UI**: 내부적으로 `Array<{key, value}>` 편집 버퍼를 React state 로 관리한다. `onChange` 시 빈 key 행을 제거하고 `Record<string, unknown>` 로 변환해 `config.fields` 에 저장한다. 비어있는 key 행이 즉시 사라지는 것을 막아 "추가" 버튼이 행을 즉시 보여주도록 한다.
+
+§9.5 (5필드 invariant 준수) 직후나 §2 (설정 UI) 마지막 단락이 자연스러운 위치.
+
+## 작업 항목
+
+- [ ] `project-planner` 가 spec/4-nodes/4-integration/4-cafe24.md 에 한 줄 추가
+- [ ] (선택) 별도 시점 — §9 Rationale 절 순서 정리 (9.7/9.8 역전) + §5 Case 번호 연속화. SUMMARY.md INFO 3·4 참고
+
+## 영향 범위
+
+spec 본문 1~2 줄 추가. 코드/API/데이터모델 변경 없음.

```

---

### 파일 116: plan/in-progress/user-guide-sync-2026-05-16.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/plan/in-progress/user-guide-sync-2026-05-16.md b/plan/in-progress/user-guide-sync-2026-05-16.md
new file mode 100644
index 00000000..d71519d2
--- /dev/null
+++ b/plan/in-progress/user-guide-sync-2026-05-16.md
@@ -0,0 +1,49 @@
+---
+worktree: user-guide-sync-4af69c
+started: 2026-05-16
+owner: developer
+---
+
+# User Guide ↔ 구현 정합성 보강 (2026-05-16)
+
+## 배경
+
+`frontend/src/content/docs/**` 사용자 매뉴얼이 일부 영역에서 실제 구현(backend/frontend)·spec 과 어긋남이 확인됨. 가이드를 단일 진실(spec/4-nodes, packages/expression-engine, backend/src/nodes)에 다시 맞춘다.
+
+## 작업 범위
+
+다음 4가지 보강만 본 plan 에서 처리한다. **도구 연결(tool connection) 영역은 손대지 않는다** — 그 부분은 `plan/in-progress/ai-agent-tool-connection-rewrite.md` 가 책임지므로 별도 작업으로 분리.
+
+- [x] **02-nodes/ai.mdx (+ .en.mdx)** — `conversationHistory` / `historyCount` 필드 표 행 제거, 실 구현 필드(`contextScope` / `contextScopeN` / `contextInjectionMode` / `includeToolTurns` / `excludeFromConversationThread`) 추가. `## Conversation Context` 섹션 신설.
+  - 소스: `backend/src/nodes/ai/ai-agent/ai-agent.schema.ts` L246–384, `spec/conventions/conversation-thread.md` §5, `spec/4-nodes/3-ai/0-common.md` §10.
+- [x] **02-nodes/integrations.mdx (+ .en.mdx)** — Cafe24 노드 섹션 추가. 풀 등록 흐름은 `/docs/06-integrations-and-config/cafe24` 로 deep-link.
+  - 소스: `backend/src/nodes/integration/cafe24/cafe24.schema.ts`, `spec/4-nodes/4-integration/4-cafe24.md`.
+- [x] **02-nodes/overview.mdx (+ .en.mdx)** — Integration 카테고리 한 줄 설명에 Cafe24 포함. 카테고리별 페이지 목록은 그대로.
+- [x] **04-expression-language/variables-and-context.mdx (+ .en.mdx)** — `$thread` 변수 행을 한눈에-보기 표에 추가 + `## $thread: Conversation Thread` 섹션 신설.
+  - 소스: `backend/src/modules/execution-engine/expression/expression-resolver.service.ts` L100–145, `spec/5-system/5-expression-language.md` §4.1 / §4.4.
+
+## 의도적 제외
+
+- **AI Agent 도구 연결 UX 갱신** (Tool Area 사용법, 신규 입력 경로) — `ai-agent-tool-connection-rewrite` plan 에서 별도 처리.
+- **영문 frontmatter** — `frontend/src/lib/docs/registry.ts` 의 `isLocaleSibling` 가 `.en.mdx` 를 navigation 등록에서 제외하므로 frontmatter 필수 대상 아님. 위반 아님으로 결론.
+- **cafe24 페이지 IA 등록** — `spec/2-navigation/13-user-guide.md` §2 IA 가 cafe24 항목을 빠뜨림. 이는 spec 갱신 사항이므로 `project-planner` 위임 (아래 spec-update 노트 참고).
+
+## 후속(spec 갱신 위임)
+
+다음 항목은 `developer` 권한 밖이므로 `project-planner` 위임. 본 worktree 의 consistency-check 세션 `review/consistency/2026/05/16/08_22_34/SUMMARY.md` 참고.
+
+- `spec/2-navigation/13-user-guide.md` §2 IA 의 `06-integrations-and-config/` 트리에 `cafe24` 항목 추가
+- `spec/4-nodes/4-integration/4-cafe24.md` §2/§5.1 의 `{{ $now.iso }}` → `{{ $now }}` 정정 (W1)
+- `spec/4-nodes/4-integration/4-cafe24.md` §9.4/§9.8 에 `install_token mismatch 회복 분기` 보강 (W3)
+- `spec/4-nodes/4-integration/4-cafe24.md` §5 섹션 번호 불연속 정리 (W4)
+- `spec/5-system/5-expression-language.md` §4.1 에 `$schedule` 변수 추가 (W2)
+- `spec/5-system/5-expression-language.md` 함수 목록에 `today()` 함수 명시
+- I3, I7, I8, I9, I10 등 정합·구조 항목 (SUMMARY.md 참고)
+
+## 체크리스트
+
+- [x] consistency-check --impl-prep
+- [x] DOCUMENTATION (본 plan = 곧 결과물 자체)
+- [x] 테스트 — `registry.ts` 단위 테스트에서 모든 .mdx frontmatter 의 `spec`/`code` 경로 실존을 검증함 (변경 결과로 새 spec/code 경로 추가 시 통과 여부 확인)
+- [x] TEST WORKFLOW (lint, unit, build)
+- [x] REVIEW WORKFLOW

```

---

### 파일 117: review/code/2026/05/16/08_35_36/RESOLUTION.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 118: review/code/2026/05/16/08_35_36/SUMMARY.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/code/2026/05/16/08_35_36/SUMMARY.md b/review/code/2026/05/16/08_35_36/SUMMARY.md
new file mode 100644
index 00000000..7e5c0e90
--- /dev/null
+++ b/review/code/2026/05/16/08_35_36/SUMMARY.md
@@ -0,0 +1,58 @@
+# Code Review 통합 보고서
+
+세션: `review/code/2026/05/16/08_35_36`
+변경 범위: 8 MDX (한/영 페어) + 1 plan + consistency-check 산출물
+리뷰어: 13/13 success, 0 pending
+
+## 전체 위험도
+
+**LOW** — 순수 문서 동기화. 런타임 코드 변경 없음. Critical 0건.
+
+## Critical
+
+없음
+
+## Warning (조치 결정)
+
+| # | 분류 | 발견 | 조치 |
+|---|---|---|---|
+| W1 | testing | `registry.ts` 단위 테스트에 모든 .mdx frontmatter 의 `spec`/`code` 경로 실존 검증이 부재. spec/2-navigation/13-user-guide.md §11 이 명시적으로 요구 | **즉시 조치** — registry.test.ts 에 실제 content/docs 루트 대상 path-existence 테스트 추가 |
+| W2 | requirement | `$thread.text` 의 "memoized after first access" 와 본문 Callout 의 "renders every time" 가 상충 | **즉시 조치** — backend 의 `buildThreadView` closure 가 실제로 memoize 함을 확인. Callout 문구를 "expression 호출 1회당 1번 평가, 루프 안에서 여러 번 쓰면 매 iteration 마다 새로 평가" 로 수정 |
+| W3 | requirement | `contextInjectionMode: messages` 가 Anthropic system role 비호환 케이스 미경고 | **불요** — messages 모드는 user/assistant role 만 사용. spec 도 system role 제약을 본 모드에 한정해 명시하지 않음. INFO 처리 |
+| W4 | architecture | overview.mdx Integration 카테고리 서비스명 직접 열거 | **불요** — 통합 종류 총 4가지로 적고, 사용자가 어떤 통합이 있는지 즉시 파악하는 가치가 추상화 가치보다 큼. 의도된 trade-off |
+| W5 | documentation | integrations.mdx 도입부 "세 종류" 문구가 Cafe24 추가로 "네 종류" 로 갱신 필요 | **즉시 조치** — 한/영 모두 |
+| W6 | maintainability | 한/영 페어의 장기 drift 위험 | **불요** — 본 작업에서 한/영 페어를 모두 갱신함. 일반 컨벤션 issue 로 별도 다룸. INFO 처리 |
+
+## Info (RESOLUTION 에 추적만)
+
+I1~I20 — 총 20건. 다음만 즉시 추가 조치:
+
+- **I10** — Cafe24 예시 제목 "어제 미발송 주문" 과 `start_date` 가 `$now`(오늘) 로 mismatch. 제목 또는 표현식 정정.
+- **I3** — W2 와 묶어 메모이제이션 경계 명시.
+
+나머지(I1, I2, I4~I9, I11~I20)는 RESOLUTION.md 에 추적 항목으로 기록 후 다음 문서 사이클에 반영. spec 본문 변경이 필요한 항목은 `project-planner` 위임 대상.
+
+## 즉시 조치 요약
+
+1. **W1**: `frontend/src/lib/docs/__tests__/registry.test.ts` 에 spec/code 경로 실존 테스트 추가
+2. **W2 + I3**: `variables-and-context.{mdx,en.mdx}` `$thread.text` Callout 정합화
+3. **W5**: `integrations.{mdx,en.mdx}` 도입부 "세 종류" → "네 종류"
+4. **I10**: `integrations.{mdx,en.mdx}` 의 Cafe24 예시 제목 또는 `start_date` 표현식 정정
+
+## 에이전트별
+
+| 에이전트 | 위험도 | 핵심 |
+|---|---|---|
+| security | NONE | 정보 보강 권고 3건 (INFO) |
+| performance | LOW | $thread.text 메모이제이션 경계 명시 (W2/I3 통합) |
+| architecture | LOW | overview Integration 열거 (W4 — 의도) |
+| requirement | LOW | W2, I6~I11 |
+| scope | NONE | 모든 변경 plan 범위 내 |
+| side_effect | NONE | 런타임 부작용 없음 |
+| maintainability | LOW | 한/영 drift 일반 컨벤션 issue |
+| testing | LOW | **W1** registry path-existence 테스트 부재 |
+| documentation | LOW | W5, I13~I17 |
+| dependency | NONE | 의존성 변경 없음 |
+| database | NONE | N/A |
+| concurrency | NONE | N/A |
+| api_contract | NONE | N/A |

```

---

### 파일 119: review/code/2026/05/16/08_35_36/_prompts/api_contract.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 120: review/code/2026/05/16/08_35_36/_prompts/architecture.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 121: review/code/2026/05/16/08_35_36/_prompts/concurrency.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 122: review/code/2026/05/16/08_35_36/_prompts/database.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 123: review/code/2026/05/16/08_35_36/_prompts/dependency.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 124: review/code/2026/05/16/08_35_36/_prompts/documentation.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 125: review/code/2026/05/16/08_35_36/_prompts/maintainability.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 126: review/code/2026/05/16/08_35_36/_prompts/performance.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 127: review/code/2026/05/16/08_35_36/_prompts/requirement.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 128: review/code/2026/05/16/08_35_36/_prompts/scope.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 129: review/code/2026/05/16/08_35_36/_prompts/security.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 130: review/code/2026/05/16/08_35_36/_prompts/side_effect.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 131: review/code/2026/05/16/08_35_36/_prompts/testing.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 132: review/code/2026/05/16/08_35_36/_retry_state.json
- 변경 유형: Review
- 언어: json


... (diff omitted due to prompt size limit) ...

---

### 파일 133: review/code/2026/05/16/08_35_36/api_contract/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/code/2026/05/16/08_35_36/api_contract/review.md b/review/code/2026/05/16/08_35_36/api_contract/review.md
new file mode 100644
index 00000000..a294743d
--- /dev/null
+++ b/review/code/2026/05/16/08_35_36/api_contract/review.md
@@ -0,0 +1,13 @@
+### 발견사항
+
+해당 없음
+
+변경된 파일 전체가 사용자 가이드 문서(`.mdx`), plan 추적 문서(`.md`), consistency-check 산출물(`.md`)이다. 백엔드 API 엔드포인트·컨트롤러·DTO·라우터 코드 또는 프론트엔드 API 클라이언트 코드에 대한 변경이 없으며, HTTP API 계약에 직접 영향을 주는 코드 변경이 포함되어 있지 않다.
+
+### 요약
+
+이번 변경은 순수 문서 동기화 작업(사용자 가이드 MDX 갱신, plan 문서 신설, consistency-check 산출물 추가)으로 구성되어 있다. 문서가 기술한 노드 필드명(`contextScope`, `contextScopeN` 등)과 Cafe24 통합 설명은 이미 구현된 백엔드 스키마를 반영한 것으로, API 계약 자체를 변경하거나 새 엔드포인트를 추가하는 코드 변경이 아니다. API 계약 관점(하위 호환성, 버전 관리, 응답 형식, 에러 응답, 요청 검증, URL 설계, 페이지네이션, 인증/인가)의 검토 대상 코드가 존재하지 않는다.
+
+### 위험도
+
+NONE

```

---

### 파일 134: review/code/2026/05/16/08_35_36/architecture/review.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 135: review/code/2026/05/16/08_35_36/concurrency/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/code/2026/05/16/08_35_36/concurrency/review.md b/review/code/2026/05/16/08_35_36/concurrency/review.md
new file mode 100644
index 00000000..1a4a95ec
--- /dev/null
+++ b/review/code/2026/05/16/08_35_36/concurrency/review.md
@@ -0,0 +1,12 @@
+### 발견사항
+
+해당 없음
+
+변경된 파일 3개(`ai.en.mdx`, `ai.mdx`, `integrations.en.mdx`)는 모두 사용자 가이드 문서(MDX)로, 실행 가능한 코드가 포함되어 있지 않습니다. AI Agent 노드의 `contextScope`·`contextInjectionMode`·`includeToolTurns`·`excludeFromConversationThread` 파라미터 설명과 Cafe24 통합 노드 문서를 추가한 순수 콘텐츠 변경입니다. async/await, 락, 스레드, 공유 자원 접근, 이벤트 루프 등 동시성 관련 코드가 전혀 포함되어 있지 않아 분석 대상이 없습니다.
+
+### 요약
+
+리뷰 대상 변경분은 MDX 사용자 가이드 문서의 텍스트·필드 테이블·예시 콘텐츠 추가로만 구성되어 있으며, 동시성(Concurrency) 관점에서 점검할 실행 코드가 존재하지 않습니다. 경쟁 조건, 데드락, 동기화, 스레드 안전성, async/await, 원자성, 이벤트 루프, 리소스 풀링 중 어느 항목도 해당되지 않습니다.
+
+### 위험도
+NONE

```

---

### 파일 136: review/code/2026/05/16/08_35_36/database/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/code/2026/05/16/08_35_36/database/review.md b/review/code/2026/05/16/08_35_36/database/review.md
new file mode 100644
index 00000000..f42ed0d3
--- /dev/null
+++ b/review/code/2026/05/16/08_35_36/database/review.md
@@ -0,0 +1,11 @@
+### 발견사항
+
+해당 없음
+
+### 요약
+
+이번 변경은 전적으로 프론트엔드 사용자 가이드 문서(`frontend/src/content/docs/02-nodes/ai.mdx`, `ai.en.mdx`, `integrations.en.mdx`)의 내용 업데이트로, AI Agent 노드의 Conversation Context 파라미터 명칭 변경(`conversationHistory` → `contextScope` 등) 및 Cafe24 통합 노드 문서 추가에 해당한다. 데이터베이스 스키마, 쿼리, ORM 엔티티, 마이그레이션, 커넥션 풀, SQL 등 데이터베이스와 직접 관련된 코드 변경은 전혀 포함되어 있지 않으므로 데이터베이스 관점의 리뷰 대상에 해당하지 않는다.
+
+### 위험도
+
+NONE

```

---

### 파일 137: review/code/2026/05/16/08_35_36/dependency/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/code/2026/05/16/08_35_36/dependency/review.md b/review/code/2026/05/16/08_35_36/dependency/review.md
new file mode 100644
index 00000000..f11f509e
--- /dev/null
+++ b/review/code/2026/05/16/08_35_36/dependency/review.md
@@ -0,0 +1,31 @@
+# 의존성(Dependency) 리뷰
+
+## 발견사항
+
+- **[INFO]** 이번 변경에서 외부 패키지·라이브러리 추가 없음
+  - 위치: 전체 diff (파일 1~11)
+  - 상세: 변경 대상은 모두 MDX 문서 파일(`frontend/src/content/docs/**`), plan 추적 문서(`plan/in-progress/`), consistency 리뷰 산출물(`review/consistency/`)이다. `package.json`, `package-lock.json`, `node_modules` 에 대한 변경이 전혀 없다.
+  - 제안: 해당 없음
+
+- **[INFO]** MDX 컴포넌트(`<FieldTable>`, `<Example>`, `<Callout>`) 사용은 기존 의존성 범위 내
+  - 위치: `ai.mdx`, `ai.en.mdx`, `integrations.mdx`, `integrations.en.mdx`, `variables-and-context.mdx`, `variables-and-context.en.mdx`
+  - 상세: 신규 추가된 `contextScope`, `contextScopeN`, `contextInjectionMode`, `includeToolTurns`, `excludeFromConversationThread`, `$thread` 관련 섹션은 이미 프로젝트에 등록된 MDX 컴포넌트(`<FieldTable>`, `<Example>`, `<Callout>`)만 사용한다. 신규 컴포넌트 임포트 없음.
+  - 제안: 해당 없음
+
+- **[INFO]** frontmatter의 `spec` / `code` 경로 참조 추가에 대한 실존 검증 필요성 확인
+  - 위치: `ai.mdx` line +89 (`spec/conventions/conversation-thread.md` 추가), `integrations.mdx` line +229~230 (`spec/4-nodes/4-integration/4-cafe24.md`, `backend/src/nodes/integration/cafe24/cafe24.schema.ts` 추가)
+  - 상세: plan 문서(`plan/in-progress/user-guide-sync-2026-05-16.md`)에서 `registry.ts` 단위 테스트가 `.mdx` frontmatter의 `spec`/`code` 경로 실존을 검증한다고 명시되어 있다. 이 테스트가 실제로 통과되었다면 경로 오류는 없으나, 리뷰 diff 내에서 테스트 결과 자체는 확인할 수 없다.
+  - 제안: CI 빌드에서 해당 단위 테스트(`registry.ts`)가 통과했는지 확인. 통과 시 문제 없음.
+
+- **[INFO]** 내부 모듈 참조 구조: 문서가 backend 구현체에 단방향 의존
+  - 위치: `integrations.mdx` frontmatter `code` 필드 — `backend/src/nodes/integration/cafe24/cafe24.schema.ts`
+  - 상세: 사용자 가이드 MDX가 backend 스키마 파일을 `code` frontmatter로 참조하는 패턴은 이미 기존 파일에서도 사용 중인 단방향 참조다. backend가 문서를 참조하는 역방향 의존은 없으며, 이는 의도된 SDD 접근 방식이다.
+  - 제안: 해당 없음
+
+## 요약
+
+이번 변경(`user-guide-sync-4af69c`)은 사용자 가이드 MDX 파일, plan 추적 문서, consistency 리뷰 산출물만을 다룬다. 새 외부 패키지·라이브러리가 추가되지 않았고, 버전 고정, 라이선스, 취약점, 번들 크기, 호환성 어느 관점에서도 문제가 없다. MDX 컴포넌트는 기존 등록된 것만 사용하며, frontmatter의 신규 spec/code 경로는 plan에 기술된 단위 테스트(`registry.ts`)로 실존이 검증되어야 한다. 내부 모듈 의존 관계는 문서 → backend 단방향으로 정상적이다. 의존성 관점에서 조치가 필요한 항목은 없다.
+
+## 위험도
+
+NONE

```

---

### 파일 138: review/code/2026/05/16/08_35_36/documentation/review.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 139: review/code/2026/05/16/08_35_36/maintainability/review.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 140: review/code/2026/05/16/08_35_36/meta.json
- 변경 유형: Review
- 언어: json


... (diff omitted due to prompt size limit) ...

---

### 파일 141: review/code/2026/05/16/08_35_36/performance/review.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 142: review/code/2026/05/16/08_35_36/requirement/review.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 143: review/code/2026/05/16/08_35_36/scope/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/code/2026/05/16/08_35_36/scope/review.md b/review/code/2026/05/16/08_35_36/scope/review.md
new file mode 100644
index 00000000..51ada530
--- /dev/null
+++ b/review/code/2026/05/16/08_35_36/scope/review.md
@@ -0,0 +1,36 @@
+# 변경 범위(Scope) 리뷰
+
+## 발견사항
+
+- **[INFO]** plan 파일 신규 생성 — 작업 범위 내 정상 산출물
+  - 위치: `plan/in-progress/user-guide-sync-2026-05-16.md` (파일 9, 전체)
+  - 상세: CLAUDE.md 의 규약에 따라 worktree 단위 plan 문서를 in-progress 에 신설했다. frontmatter(`worktree`, `started`, `owner`) 가 완비되어 있으며, 작업 범위·의도적 제외·후속 위임 섹션이 명확히 분리되어 있다. 이 파일 자체가 결과물의 일부이므로 의도 이상의 변경이 아니다.
+  - 제안: 없음 (정상).
+
+- **[INFO]** consistency-check 산출물 신규 생성 — 프로세스 규약 산출물
+  - 위치: `review/consistency/2026/05/16/08_22_34/SUMMARY.md` (파일 10), `review/consistency/2026/05/16/08_22_34/_prompts/convention_compliance.md` (파일 11)
+  - 상세: developer 역할이 구현 착수 직전 의무 실행해야 하는 `consistency-checker --impl-prep` 결과물이다. CLAUDE.md 규약에 명시된 필수 단계이므로 의도 이상의 변경이 아니다. `_prompts/` 파일은 orchestrator 가 작성하는 입력 파일로 spec 규약상 정상 경로다.
+  - 제안: 없음 (정상).
+
+- **[INFO]** `spec` 참조 필드 확장 — 실질 변경과 직결된 메타데이터 갱신
+  - 위치: `frontend/src/content/docs/02-nodes/ai.mdx` L88-89 (파일 2), `frontend/src/content/docs/02-nodes/integrations.mdx` L229-230 (파일 4)
+  - 상세: `ai.mdx` 의 `spec` frontmatter 에 `spec/conventions/conversation-thread.md` 가 추가되었고, `integrations.mdx` 의 `spec`·`code` frontmatter 에 Cafe24 관련 경로가 추가되었다. 추가된 섹션 내용(Conversation Context, Cafe24)의 소스 문서를 정확히 반영한 것으로, 변경 의도와 일치한다.
+  - 제안: 없음 (정상).
+
+- **[INFO]** `summary`/`summary_en` 텍스트 갱신 — Cafe24 포함으로 인한 자연스러운 업데이트
+  - 위치: `frontend/src/content/docs/02-nodes/integrations.mdx` L227-228 (파일 4)
+  - 상세: 통합 노드 페이지 요약 문구에 Cafe24 를 추가했다. Cafe24 섹션을 신설한 것과 직접 연동된 최소 변경이다.
+  - 제안: 없음 (정상).
+
+- **[INFO]** `overview.mdx` / `overview.en.mdx` Integration 카테고리 설명 한 줄 변경
+  - 위치: `frontend/src/content/docs/02-nodes/overview.mdx` L336 (파일 6), `frontend/src/content/docs/02-nodes/overview.en.mdx` L312 (파일 5)
+  - 상세: Integration 카테고리 description 에 "Cafe24" 를 추가하는 최소 변경이다. plan 의 작업 범위에 명시된 항목과 정확히 일치한다.
+  - 제안: 없음 (정상).
+
+## 요약
+
+이번 변경은 plan(`user-guide-sync-2026-05-16.md`)에 명시된 4개 보강 항목(AI Agent contextScope 필드군 갱신, Cafe24 섹션 추가, overview 카테고리 설명 갱신, `$thread` 변수 문서 추가)을 한국어·영문 양쪽 MDX 에 대칭 적용했으며, 의무 프로세스 산출물(plan 파일, consistency-check 결과)을 함께 커밋했다. 변경된 10개 파일 전체가 plan 에 선언된 범위 안에 있고, 요청하지 않은 리팩토링·불필요한 임포트 정리·포맷팅 혼입 등은 발견되지 않는다. 의도 이상의 수정, 무관한 파일 변경, 설정 파일 오염 모두 없다.
+
+## 위험도
+
+NONE

```

---

### 파일 144: review/code/2026/05/16/08_35_36/security/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/code/2026/05/16/08_35_36/security/review.md b/review/code/2026/05/16/08_35_36/security/review.md
new file mode 100644
index 00000000..c813a4f5
--- /dev/null
+++ b/review/code/2026/05/16/08_35_36/security/review.md
@@ -0,0 +1,53 @@
+# 보안(Security) 코드 리뷰
+
+대상 세션: `review/code/2026/05/16/08_35_36`
+리뷰어: Security
+분석 파일 수: 11개 (MDX 문서 8개 + plan 1개 + consistency review 2개)
+
+---
+
+## 발견사항
+
+### INFO 등급
+
+- **[INFO]** `$thread.turns[0].data.email` 표현식 예시가 문서에 노출됨
+  - 위치: `frontend/src/content/docs/04-expression-language/variables-and-context.en.mdx` (추가된 라인 `{{ $thread.turns[0].data.email }}`), `frontend/src/content/docs/02-nodes/ai.en.mdx` 동일 예시
+  - 상세: `$thread.turns[0].data.email` 은 사용자 form 입력의 이메일 필드를 직접 참조하는 예시 표현식이다. 이 자체는 문서상 예시이므로 코드 취약점은 아니나, 최종 사용자 데이터(개인식별정보)가 `$thread.data` 구조체를 통해 워크플로우 표현식으로 자유롭게 접근된다는 사실을 문서가 공개하고 있다. 이는 설계 의도에 부합하지만, `$thread` 에 push 된 data 객체 전체에 대한 접근 제어(어떤 노드가 어떤 thread turn 을 읽을 수 있는지)가 런타임 레벨에서 별도로 보장되어야 함을 의미한다.
+  - 제안: 문서에 "thread 내 data 객체는 워크플로우 실행 컨텍스트 안에서만 접근 가능하며, 외부로 노출되지 않습니다" 같은 보안 경계 설명을 추가하는 것을 검토한다. 실제 구현 측에서는 `$thread` 가 HTTP 응답이나 로그에 직렬화되지 않도록 직렬화 필터가 적용되어 있는지 확인 필요.
+
+- **[INFO]** Cafe24 통합 문서에서 `integrationId` (UUID) 를 config 예시에 `"…"` 플레이스홀더로 표시
+  - 위치: `frontend/src/content/docs/02-nodes/integrations.en.mdx` 및 `integrations.mdx` 의 Example 코드 블록 (`integrationId: "…"`)
+  - 상세: 실제 UUID 값이 아닌 플레이스홀더가 사용되어 하드코딩된 시크릿 문제는 없음. 다만 `integrationId` 가 OAuth 토큰과 연결된 민감한 식별자임을 사용자가 인지하지 못할 경우, 이를 코드나 공개 저장소에 노출할 위험이 있다. 문서 자체는 문제없음.
+  - 제안: 예시 주석 또는 Callout 에 "integrationId는 민감한 자격증명 참조 ID이므로 소스 코드·공개 저장소에 하드코딩하지 마세요" 안내 추가를 고려.
+
+- **[INFO]** `contextScope: thread` 설정 시 전체 Conversation Thread 가 LLM 에 전달된다는 잠재적 데이터 노출 경로
+  - 위치: `frontend/src/content/docs/02-nodes/ai.en.mdx` 및 `ai.mdx` — `contextScope: thread` 설명 섹션
+  - 상세: 문서가 `contextScope: thread` 사용 시 워크플로우 내 모든 turn(form 입력, 사용자 메시지 포함)이 LLM API 호출 페이로드에 포함된다고 명시한다. 이는 사용자의 개인정보·민감 입력이 제3자 LLM 서비스(OpenAI/Anthropic)로 전송될 수 있음을 의미한다. 문서 자체의 취약점은 아니나, 이 위험을 사용자에게 충분히 안내하고 있는지 검토가 필요하다. 현재 문서는 "토큰 사용량이 빠르게 늘 수 있어요"(토큰 비용 관점)만 언급하고 개인정보 전송 측면은 언급하지 않는다.
+  - 제안: `contextScope: thread` 설명에 "thread 에 포함된 사용자 입력이 외부 LLM 서비스로 전송될 수 있으므로, 개인정보·민감 데이터를 포함하는 경우 데이터 처리 정책을 확인하세요" 류의 주의 문구 추가를 검토.
+
+---
+
+## 보안 관점 항목별 평가
+
+| 점검 항목 | 결과 | 비고 |
+|---|---|---|
+| 인젝션 취약점 | 이상 없음 | 순수 문서 변경. 런타임 코드 없음 |
+| 하드코딩된 시크릿 | 이상 없음 | 예시에 플레이스홀더 사용, 실제 값 없음 |
+| 인증/인가 | 이상 없음 | 문서 범위. Cafe24 OAuth 흐름은 deep-link 로 위임 |
+| 입력 검증 | 이상 없음 | 문서 범위 |
+| OWASP Top 10 | 이상 없음 | 해당 없음 (문서 파일) |
+| 암호화 | 이상 없음 | 해당 없음 |
+| 에러 처리 | 이상 없음 | error 포트 설명은 일반적 수준. 민감 정보 노출 없음 |
+| 의존성 보안 | 이상 없음 | 패키지 변경 없음 |
+
+---
+
+## 요약
+
+이번 변경은 전적으로 사용자 매뉴얼 MDX 파일(AI Agent contextScope 필드 갱신, Cafe24 통합 노드 섹션 추가, $thread 변수 섹션 추가)과 plan/review 마크다운 문서의 추가로 구성되어 있다. 런타임 코드·의존성·인프라 설정 변경이 전혀 없으므로 인젝션, 하드코딩 시크릿, 인증/인가, 암호화 등 전통적 보안 취약점 범주에 해당하는 문제는 발견되지 않는다. 다만 문서가 설명하는 기능($thread 를 통한 form 입력 데이터 접근, contextScope: thread 로 전체 대화 내용이 외부 LLM API 로 전달됨)은 개인정보 처리 관점에서 사용자 안내가 보완될 여지가 있다. 이는 문서 품질 개선 수준의 권고이며 보안 결함은 아니다.
+
+---
+
+## 위험도
+
+**NONE**

```

---

### 파일 145: review/code/2026/05/16/08_35_36/side_effect/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/code/2026/05/16/08_35_36/side_effect/review.md b/review/code/2026/05/16/08_35_36/side_effect/review.md
new file mode 100644
index 00000000..7d920563
--- /dev/null
+++ b/review/code/2026/05/16/08_35_36/side_effect/review.md
@@ -0,0 +1,50 @@
+# 부작용(Side Effect) 코드 리뷰
+
+검토 대상: user-guide-sync-4af69c worktree 변경분 (11개 파일)
+검토 관점: 의도치 않은 상태 변경, 전역 변수, 파일시스템, 시그니처/인터페이스 변경, 환경 변수, 네트워크 호출, 이벤트/콜백
+
+---
+
+## 발견사항
+
+- **[INFO]** `ai.mdx` / `ai.en.mdx` — 필드 테이블에서 `conversationHistory` / `historyCount` 행 제거 후 `contextScope` 등 5개 신규 행 추가
+  - 위치: `frontend/src/content/docs/02-nodes/ai.mdx` L97-103, `ai.en.mdx` L35-41
+  - 상세: MDX frontmatter의 `spec` 배열에 `spec/conventions/conversation-thread.md`가 추가되어, 문서 빌드 시 이 경로 파일이 없으면 빌드가 실패할 수 있다. 그러나 해당 파일은 이미 존재하는 컨벤션 문서이므로 현재 무결하다. 필드 테이블 변경 자체는 정적 문서(MDX) 수정이므로 런타임 부작용은 없다.
+  - 제안: `spec/conventions/conversation-thread.md` 경로가 실제로 존재하는지 CI 단계에서 `registry.ts` 단위 테스트로 자동 검증되는지 확인한다(plan 체크리스트에 따르면 이미 수행됨).
+
+- **[INFO]** `integrations.mdx` / `integrations.en.mdx` — frontmatter `spec`·`code` 배열에 신규 경로 추가
+  - 위치: `frontend/src/content/docs/02-nodes/integrations.mdx` L229-230, `integrations.en.mdx` L89-90
+  - 상세: `spec/4-nodes/4-integration/4-cafe24.md`와 `backend/src/nodes/integration/cafe24/cafe24.schema.ts`가 `code` 배열에 추가되었다. 문서 빌드·링크 검사 도구가 이 경로를 실존 파일로 확인하지 못할 경우 빌드 오류를 유발할 수 있다. 런타임 부작용은 없다.
+  - 제안: 위 두 경로의 실존 여부를 CI 단계에서 점검한다.
+
+- **[INFO]** `variables-and-context.mdx` / `variables-and-context.en.mdx` — `$thread` 변수 표 행 및 섹션 추가
+  - 위치: `frontend/src/content/docs/04-expression-language/variables-and-context.mdx` L428-471, `.en.mdx` L360-403
+  - 상세: `$thread`는 표현식 엔진 내 읽기 전용 컨텍스트 변수로 문서화되었다. 문서 변경은 순수 정적 콘텐츠이며 런타임 상태를 변경하지 않는다. `$thread.text` 메모이즈 주의 Callout이 포함되어 있어 사용자 관점 부작용 안내는 적절하다.
+  - 제안: 특이 없음.
+
+- **[INFO]** `overview.mdx` / `overview.en.mdx` — Integration 카테고리 설명에 "Cafe24" 추가
+  - 위치: `frontend/src/content/docs/02-nodes/overview.mdx` L336, `overview.en.mdx` L312
+  - 상세: 단순 문자열 추가. 부작용 없음.
+  - 제안: 특이 없음.
+
+- **[INFO]** `plan/in-progress/user-guide-sync-2026-05-16.md` — 신규 plan 파일 생성
+  - 위치: `plan/in-progress/user-guide-sync-2026-05-16.md`
+  - 상세: 작업 추적 문서로, 파일시스템에 새 파일이 추가된다. 이는 의도된 동작이며 코드 실행 경로에 영향을 주지 않는다. frontmatter(`worktree`, `started`, `owner`)가 CLAUDE.md 규약에 맞게 기술되어 있다.
+  - 제안: 특이 없음.
+
+- **[INFO]** `review/consistency/2026/05/16/08_22_34/SUMMARY.md` 및 `_prompts/convention_compliance.md` — 신규 리뷰 산출물 파일 생성
+  - 위치: `review/consistency/2026/05/16/08_22_34/` 하위
+  - 상세: 시점 기록 성격의 review 산출물이다. 파일시스템에 새 파일이 추가되나, 코드 실행에 영향을 주는 부작용은 없다.
+  - 제안: 특이 없음.
+
+---
+
+## 요약
+
+이번 변경은 전적으로 **정적 문서(MDX) 및 작업 추적 파일(plan, review)** 수정으로 구성되어 있다. 전역 변수 도입, 환경 변수 조작, 네트워크 호출, 이벤트/콜백 변경, 함수 시그니처·공개 API 변경에 해당하는 코드가 존재하지 않는다. 유일하게 주목할 부분은 MDX frontmatter의 `spec`·`code` 경로 배열 확장인데, 이 경로들이 실제 파일시스템에 존재하지 않을 경우 문서 빌드 단계에서 오류를 일으킬 수 있다. plan 체크리스트에 따르면 `registry.ts` 단위 테스트로 이미 검증한 것으로 기술되어 있으므로, 현재 발견된 부작용 위험은 모두 낮은 수준이다.
+
+---
+
+## 위험도
+
+NONE

```

---

### 파일 146: review/code/2026/05/16/08_35_36/testing/review.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 147: review/code/2026/05/16/09_17_17/RESOLUTION.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 148: review/code/2026/05/16/09_17_17/SUMMARY.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/code/2026/05/16/09_17_17/SUMMARY.md b/review/code/2026/05/16/09_17_17/SUMMARY.md
new file mode 100644
index 00000000..c63ba7f8
--- /dev/null
+++ b/review/code/2026/05/16/09_17_17/SUMMARY.md
@@ -0,0 +1,60 @@
+# Code Review 통합 보고서
+
+> 세션: `review/code/2026/05/16/09_17_17`
+> 대상: Cafe24 Fields 편집 버퍼 도입 (`fix(node-configs/cafe24): keep newly added fields rows visible`)
+> 리뷰어: 13개 전원 완료 (pending 0 / fatal 0)
+
+## 전체 위험도
+
+**LOW** — 기능 동작은 올바르게 수정되었으며 Critical 위험 없음. 렌더 중 `setState` 패턴의 잠재적 무한 루프 가능성과 테스트 커버리지 갭이 주요 개선 포인트.
+
+## Critical 발견사항
+
+없음
+
+## 경고 (WARNING)
+
+| # | 카테고리 | 발견사항 | 위치 | 제안 |
+|---|----------|----------|------|------|
+| 1 | 동시성 / 아키텍처 | 렌더 본문에서 `setState` 직접 호출 — 부모가 매 렌더마다 새 참조 객체를 `config.fields`로 전달하면 `objectsEqual`이 항상 `false`를 반환해 `Too many re-renders` 오류로 이어질 수 있음. | `integration-configs.tsx` — `Cafe24Config` | 참조 기반 추적으로 전환 (`lastSeenFields !== config.fields`) 하거나 `useEffect`로 동기화 |
+| 2 | 테스팅 | undo/redo(외부 config 재설정) 경로에 대한 테스트 없음 | `cafe24-config.test.tsx` | `rerender`로 상이한 `config.fields` 주입 테스트 추가 |
+| 3 | 테스팅 | 삭제 버튼 탐색 로직이 DOM 구조에 강하게 결합 | `cafe24-config.test.tsx` — "removes a row" | `KeyValueEditor` 삭제 버튼에 `aria-label` 추가 후 명시적 셀렉터 사용 |
+| 4 | 테스팅 | `objectsEqual` / `fieldRowsToObject` / `normalizeCafe24Fields` 순수 함수 단위 테스트 없음 | `integration-configs.tsx` 헬퍼 함수들 | 함수를 named export로 노출해 독립 단위 테스트 작성 |
+| 5 | 테스팅 | `normalizeCafe24Fields` 의 배열 입력 / 잘못된 입력 경로 미검증 | `integration-configs.tsx` | 배열·null·primitive 입력 케이스 추가 |
+| 6 | 유지보수성 | 행 제거 테스트의 이중 폴백 쿼리 패턴 | `cafe24-config.test.tsx` | 단일 명확한 쿼리 전략으로 통일 |
+
+## 참고 (INFO)
+
+상세 20건은 각 reviewer review.md 참고. 핵심:
+- `lastPropagated` → `useState` vs `useRef` 선택 (INFO 4): 참조 비교 채택 시 useState 유지
+- 중복 키 last-write-wins 동작이 spec/주석에 미기록 (INFO 5): 주석으로 명시
+- `plan/in-progress/cafe24-fields-add-button-fix.md` 체크박스 완료 후 `complete/` 이동 (INFO 9)
+- 로컬 store 원상복구 누락 (INFO 14)
+- `objectsEqual` 의 `String()` 강제 변환에 따른 타입 모호성 (INFO 11)
+
+## 에이전트별 위험도 요약
+
+| 에이전트 | 위험도 | 핵심 발견 |
+|----------|--------|-----------|
+| security | NONE | 모두 INFO. 시크릿/계약 변경 없음 |
+| performance | NONE | `objectsEqual` 매 렌더 실행 — 현 규모 영향 미미 |
+| architecture | LOW | 렌더 중 setState, 세 책임 혼재 (WARNING) |
+| requirement | LOW | 정책 미명세 등 INFO 7건 |
+| scope | NONE | 변경 범위 적절 |
+| side_effect | LOW | locale 원상복구 누락 (INFO) |
+| maintainability | LOW | 파생 상태 패턴, 테스트 이중 폴백 (WARNING) |
+| testing | LOW | undo/redo 미검증, DOM 결합, 헬퍼 단위 테스트 없음 (WARNING) |
+| documentation | LOW | JSDoc 누락 (INFO) |
+| dependency | NONE | 신규 의존성 없음 |
+| database | NONE | 해당 없음 |
+| concurrency | LOW | 렌더 중 setState 잠재 무한 루프 (WARNING) |
+| api_contract | NONE | 백엔드 계약 유지 |
+
+## 권장 조치
+
+1. 렌더 중 setState 패턴 → 참조 기반 추적으로 리팩토링
+2. KeyValueEditor 삭제 버튼에 aria-label 추가
+3. undo/redo · 배열 입력 · 헬퍼 함수 단위 테스트 추가
+4. JSDoc, last-write-wins 명시
+5. locale store afterEach 원상복구
+6. plan 파일 `complete/` 이동

```

---

### 파일 149: review/code/2026/05/16/09_17_17/_prompts/api_contract.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 150: review/code/2026/05/16/09_17_17/_prompts/architecture.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 151: review/code/2026/05/16/09_17_17/_prompts/concurrency.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 152: review/code/2026/05/16/09_17_17/_prompts/database.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 153: review/code/2026/05/16/09_17_17/_prompts/dependency.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 154: review/code/2026/05/16/09_17_17/_prompts/documentation.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 155: review/code/2026/05/16/09_17_17/_prompts/maintainability.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 156: review/code/2026/05/16/09_17_17/_prompts/performance.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 157: review/code/2026/05/16/09_17_17/_prompts/requirement.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 158: review/code/2026/05/16/09_17_17/_prompts/scope.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 159: review/code/2026/05/16/09_17_17/_prompts/security.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 160: review/code/2026/05/16/09_17_17/_prompts/side_effect.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 161: review/code/2026/05/16/09_17_17/_prompts/testing.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 162: review/code/2026/05/16/09_17_17/_retry_state.json
- 변경 유형: Review
- 언어: json


... (diff omitted due to prompt size limit) ...

---

### 파일 163: review/code/2026/05/16/09_17_17/api_contract/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/code/2026/05/16/09_17_17/api_contract/review.md b/review/code/2026/05/16/09_17_17/api_contract/review.md
new file mode 100644
index 00000000..f6b70c04
--- /dev/null
+++ b/review/code/2026/05/16/09_17_17/api_contract/review.md
@@ -0,0 +1,11 @@
+### 발견사항
+
+해당 없음
+
+### 요약
+
+이번 변경은 프론트엔드 React 컴포넌트(`Cafe24Config`)의 로컬 상태 관리 로직과 해당 단위 테스트 파일만을 수정한다. 변경 내용은 UI 편집 행(row)을 `useState`로 관리하여 빈 키 행이 렌더 사이에 사라지지 않도록 하는 것이며, 백엔드로 전파하는 데이터 형식(`Record<string, unknown>` 객체)은 기존과 동일하게 유지된다. HTTP API 엔드포인트, 요청/응답 스키마, URL 경로, 인증/인가, 페이지네이션 등 API 계약 관점의 어떤 요소도 변경되지 않았다.
+
+### 위험도
+
+NONE

```

---

### 파일 164: review/code/2026/05/16/09_17_17/architecture/review.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 165: review/code/2026/05/16/09_17_17/concurrency/review.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 166: review/code/2026/05/16/09_17_17/database/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/code/2026/05/16/09_17_17/database/review.md b/review/code/2026/05/16/09_17_17/database/review.md
new file mode 100644
index 00000000..76e5a572
--- /dev/null
+++ b/review/code/2026/05/16/09_17_17/database/review.md
@@ -0,0 +1,10 @@
+### 발견사항
+
+해당 없음
+
+### 요약
+
+이번 변경은 `frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx` 와 해당 테스트 파일(`cafe24-config.test.tsx`)에만 적용된 순수 프론트엔드 React 컴포넌트 수정이다. `Cafe24Config` 컴포넌트가 Fields 편집 중 로컬 React state를 활용하도록 리팩토링한 UI 버그 수정으로, 백엔드·데이터베이스·스키마·쿼리·마이그레이션·커넥션 관리 등 데이터베이스 관점의 어떤 요소도 포함되지 않는다. 커밋 메시지에도 "backend / spec / data model unchanged"가 명시되어 있다.
+
+### 위험도
+NONE

```

---

### 파일 167: review/code/2026/05/16/09_17_17/dependency/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/code/2026/05/16/09_17_17/dependency/review.md b/review/code/2026/05/16/09_17_17/dependency/review.md
new file mode 100644
index 00000000..7592bd8d
--- /dev/null
+++ b/review/code/2026/05/16/09_17_17/dependency/review.md
@@ -0,0 +1,31 @@
+# 의존성(Dependency) 코드 리뷰
+
+## 발견사항
+
+- **[INFO]** 새 외부 의존성 추가 없음 — 변경은 React 내장 훅(`useState`)만 사용
+  - 위치: `frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx` line 1 (`import { useState } from "react"`)
+  - 상세: `useState`는 `react` 패키지의 내장 API이며, `react`는 이미 `package.json` `dependencies`에 `19.2.4`(exact pin)로 등록되어 있다. 별도 패키지 추가 없이 기존 의존성만 활용한 구현이다.
+  - 제안: 변경 불필요.
+
+- **[INFO]** 테스트 파일의 import도 기존 의존성 범위 내
+  - 위치: `frontend/src/components/editor/settings-panel/node-configs/__tests__/cafe24-config.test.tsx` lines 1–3
+  - 상세: `vitest`, `@testing-library/react`, `react`는 모두 `devDependencies`에 이미 등록된 패키지이다. `useLocaleStore`는 내부 모듈(`@/lib/stores/locale-store`) 경유이며 새 외부 의존성이 아니다.
+  - 제안: 변경 불필요.
+
+- **[INFO]** `react` 버전 고정 방식 혼재 — `19.2.4` exact pin vs. `^19` type 범위
+  - 위치: `frontend/package.json` — `dependencies.react: "19.2.4"`, `dependencies.react-dom: "19.2.4"` (exact) / `devDependencies."@types/react": "^19"`, `devDependencies."@types/react-dom": "^19"` (range)
+  - 상세: 런타임 패키지(`react`, `react-dom`)는 exact pin이어서 재현 가능한 빌드를 보장한다. 타입 정의(`@types/react`)는 캐럿 범위로 두어 minor 업데이트를 허용하는 전형적 패턴이며 이번 변경과 무관하다. 본 PR이 이 구조를 바꾸지 않으므로 위험 없음.
+  - 제안: 현행 유지. 타입 패키지도 exact pin으로 통일하려면 별도 PR에서 일괄 처리한다.
+
+- **[INFO]** 내부 모듈 의존 관계 확인
+  - 위치: `integration-configs.tsx` — `./shared`, `@/components/editor/expression`, `./integration-selector`, `@/lib/i18n`, `@/lib/stores/locale-store`(테스트용 mock 경유)
+  - 상세: 이번 변경으로 새로운 내부 모듈 경계를 넘는 import가 추가되지 않았다. `integration-selector`는 테스트에서 `vi.mock`으로 교체되어 react-query 의존 전파를 차단하고 있으며, 이는 적절한 격리 패턴이다.
+  - 제안: 변경 불필요.
+
+## 요약
+
+이번 PR(`fix(node-configs/cafe24): keep newly added fields rows visible`)은 새로운 외부 패키지를 일절 추가하지 않았다. 변경은 React `useState` 훅(이미 `dependencies`에 exact pin된 `react 19.2.4` 포함)만 사용하여 `Cafe24Config` 내부 편집 버퍼를 도입하고, 기존 `@testing-library/react`·`vitest` 인프라로 단위 테스트를 추가하는 데 그친다. 의존성 추가·버전 변경·라이선스·취약점·번들 크기·내부 모듈 구조 어느 측면에서도 새로운 위험 요소가 발생하지 않는다.
+
+## 위험도
+
+NONE

```

---

### 파일 168: review/code/2026/05/16/09_17_17/documentation/review.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 169: review/code/2026/05/16/09_17_17/maintainability/review.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 170: review/code/2026/05/16/09_17_17/meta.json
- 변경 유형: Review
- 언어: json


... (diff omitted due to prompt size limit) ...

---

### 파일 171: review/code/2026/05/16/09_17_17/performance/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/code/2026/05/16/09_17_17/performance/review.md b/review/code/2026/05/16/09_17_17/performance/review.md
new file mode 100644
index 00000000..40407273
--- /dev/null
+++ b/review/code/2026/05/16/09_17_17/performance/review.md
@@ -0,0 +1,31 @@
+# 성능(Performance) 리뷰
+
+## 발견사항
+
+- **[INFO]** `objectsEqual` 이 매 렌더마다 무조건 실행됨
+  - 위치: `integration-configs.tsx` — `Cafe24Config` 함수 본체, `externalFields` 계산 직후 (렌더 경로)
+  - 상세: `objectsEqual(externalFields, lastPropagated)` 는 컴포넌트가 렌더될 때마다 호출된다. `Object.keys` 를 두 번 호출하고 모든 키를 순회하므로 O(n) 이다. `config.fields` 의 키 수가 수십 개 이하인 일반적인 UI 사용 패턴에서는 실제 비용이 미미하지만, 이 비교 자체가 렌더 결과에 영향을 줄 `useState` setter 호출을 유발할 수 있는 분기 조건이라는 점에서 최적화 여지가 있다. `useMemo` 를 써서 `externalFields` 의 참조나 직렬화 결과가 실제로 달라졌을 때만 비교를 수행하면 렌더 비용을 줄일 수 있다.
+  - 제안: `config.fields` 를 `useMemo` 로 안정화(stable reference)하거나, `objectsEqual` 호출을 `useEffect` + ref 패턴으로 이동해 렌더 함수 본체에서 제거하는 것을 고려한다. 단, 현재 React "derived-state update during render" 패턴 자체가 의도된 것이므로 변경 시에는 동일한 동작 보장이 전제되어야 한다.
+
+- **[INFO]** `normalizeCafe24Fields` 가 매 외부 변경마다 두 번 호출될 수 있음
+  - 위치: `integration-configs.tsx` — `objectsEqual` 분기 내부 (라인 352–354)
+  - 상세: 외부 리셋(undo/redo) 발생 시 `normalizeCafe24Fields(externalFields)` 로 `nextRows` 를 만

... (truncated due to prompt size limit) ...

---

### 파일 172: review/code/2026/05/16/09_17_17/requirement/review.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 173: review/code/2026/05/16/09_17_17/scope/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/code/2026/05/16/09_17_17/scope/review.md b/review/code/2026/05/16/09_17_17/scope/review.md
new file mode 100644
index 00000000..693c1b17
--- /dev/null
+++ b/review/code/2026/05/16/09_17_17/scope/review.md
@@ -0,0 +1,31 @@
+# 변경 범위(Scope) 리뷰
+
+## 발견사항
+
+- **[INFO]** `integration-configs.tsx` — `fieldRowsToObject` 및 `objectsEqual` 헬퍼 함수 신규 추출
+  - 위치: `integration-configs.tsx` +302~+327 (추가된 두 함수)
+  - 상세: `fieldRowsToObject`는 기존 인라인 `for` 루프를 명명된 함수로 분리한 것이고, `objectsEqual`은 외부 변경 감지를 위해 새로 도입한 비교 로직이다. 버그 수정의 핵심 로직(`useState` 도입)에 직접 필요한 함수들이므로 범위 이탈로 보기는 어렵다. 단, `fieldRowsToObject`는 기존 인라인 변환 코드를 단순 추출한 것이라 별도 리팩토링 성격도 있다는 점은 인지할 만하다.
+  - 제안: 현 수준은 허용 범위. 향후 동일 패턴이 다른 노드에 확산될 때 공유 유틸로 승격 고려.
+
+- **[INFO]** `integration-configs.tsx` — 인라인 주석 다수 추가
+  - 위치: +301~+361 (함수 및 훅 상단 주석 블록)
+  - 상세: `fieldRowsToObject`, `objectsEqual`, `useState` 블록 등에 구현 의도를 상세히 설명하는 주석이 추가되었다. 주석 내용이 코드의 비자명한 동작(derived-state re-sync 패턴, React 공식 문서 링크 등)을 설명하므로 불필요한 주석으로 보기 어렵다. 다만 주석 분량이 다소 많아 코드 가독성을 해칠 여지는 있다.
+  - 제안: 핵심 의도 주석은 유지하되, React 공식 문서 URL 인용 등 부가적 설명은 팀 내 주석 정책에 따라 정리 가능.
+
+- **[INFO]** `plan/in-progress/spec-update-cafe24-fields-ui-buffer.md` 신규 생성
+  - 위치: 파일 4 전체
+  - 상세: 버그 수정 PR에서 spec 보완 작업을 직접 처리하지 않고 별도 plan으로 위임한 것이다. CLAUDE.md의 "구현 중 스펙 수정이 필요해지면 developer는 project-planner로 위임" 정책에 따른 정상적인 처리이므로 범위 이탈이 아니다. plan 파일 자체가 이번 커밋에 포함된 것도 PLAN 문서 라이프사이클 규약상 적절하다.
+  - 제안: 이상 없음.
+
+- **[INFO]** `review/consistency/2026/05/16/09_03_04/` 하위 파일 커밋에 포함
+  - 위치: 파일 5(`SUMMARY.md`), 파일 6(`_prompts/convention_compliance.md`)
+  - 상세: consistency-check 세션 산출물과 프롬프트 파일이 동일 커밋에 포함되었다. 이 파일들은 구현 착수 전 실행된 검토 산출물로, 본 PR과 직접 관련된 아티팩트이다. CLAUDE.md의 `review/consistency/**` 경로 관리 정책에 부합하며, 리뷰 추적성 측면에서 포함이 자연스럽다. 단, 프롬프트 파일(`_prompts/convention_compliance.md`)까지 커밋 대상으로 포함하는 것이 팀 관행인지 확인할 필요는 있다.
+  - 제안: `_prompts/` 하위 파일의 커밋 포함 정책이 명확히 정의되어 있다면 현재 방식이 적절. 정책이 불명확하다면 `_prompts/`를 `.gitignore`로 제외할지 논의 권장.
+
+## 요약
+
+변경 범위가 요청된 버그 수정("추가" 버튼 클릭 시 새 행이 사라지는 문제)에 충실하게 집중되어 있다. `integration-configs.tsx` 수정은 `Cafe24Config` 컴포넌트에 `useState`를 도입하는 최소한의 변경이며, 추출된 헬퍼 함수 2개도 해당 수정에 직접 필요한 로직이다. 신규 단위 테스트는 TDD 방법론 이행에 필수적이고, plan 문서 및 consistency-check 산출물 파일은 프로젝트 관리 규약에 따른 정상 아티팩트다. 범위를 이탈하는 불필요한 리팩토링, 기능 확장, 무관한 파일 수정은 발견되지 않았다. 주석 분량과 `_prompts/` 파일 커밋 포함 정책에 관한 경미한 사항만 확인되었다.
+
+## 위험도
+
+NONE

```

---

### 파일 174: review/code/2026/05/16/09_17_17/security/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/code/2026/05/16/09_17_17/security/review.md b/review/code/2026/05/16/09_17_17/security/review.md
new file mode 100644
index 00000000..8af17ec2
--- /dev/null
+++ b/review/code/2026/05/16/09_17_17/security/review.md
@@ -0,0 +1,31 @@
+# 보안(Security) 코드 리뷰
+
+## 발견사항
+
+- **[INFO]** 사용자 입력 키값에 대한 클라이언트 측 길이·형식 제한 없음
+  - 위치: `integration-configs.tsx` — `fieldRowsToObject` 함수 및 `handleFieldRowsChange` 핸들러
+  - 상세: `KeyValueEditor`에서 입력받은 key/value 쌍을 그대로 `Record<string, string>` 으로 변환해 upstream에 전달한다. 현재 코드는 키 이름이나 값의 길이, 허용 문자 범위에 대한 클라이언트 측 검증이 없다. 악의적 사용자가 매우 긴 문자열이나 특수문자를 key/value에 입력하더라도 프론트엔드 레이어에서 차단되지 않는다. 단, 이 설정값은 Cafe24 API 호출 시 백엔드에서 재검증될 것으로 예상되므로 현 컴포넌트 단독 위협은 낮다.
+  - 제안: 백엔드에서 key/value 값 검증이 이루어지는지 확인하고, 필요하다면 `fieldRowsToObject` 또는 `handleFieldRowsChange` 에서 허용 길이(예: 256자)와 허용 문자 패턴(예: 영숫자·언더스코어)을 명시적으로 제한하는 로직을 추가한다.
+
+- **[INFO]** `config.fields` 외부값을 타입 캐스팅 없이 `Record<string, unknown>` 으로 신뢰
+  - 위치: `integration-configs.tsx` 라인 351–354 (`externalFields` 계산 블록)
+  - 상세: `config.fields` 가 객체인지 배열인지를 런타임에 확인한 뒤 `as Record<string, unknown>` 으로 캐스팅한다. 이 경우 배열이 아닌 다른 비-객체 프리미티브(예: 문자열, 숫자)는 빈 객체로 폴백되므로 처리 자체는 안전하다. 그러나 `normalizeCafe24Fields` 내부에서 `config.fields` 의 각 value를 어떻게 처리하는지에 따라 잠재적 타입 혼동이 발생할 수 있다. `unknown` 타입의 value를 `String()` 강제 변환 없이 그대로 전달하면 런타임 오류로 이어질 수 있다.
+  - 제안: `normalizeCafe24Fields` 에서 value를 처리할 때 `String(v ?? "")` 처럼 안전한 문자열 변환을 명시적으로 적용하고 있는지 확인한다. `objectsEqual` 함수는 이미 `String(a[k] ?? "")` 패턴을 사용하고 있어 일관성 유지 권장.
+
+- **[INFO]** 테스트 코드에서 DOM 구조에 의존한 버튼 탐색 패턴
+  - 위치: `cafe24-config.test.tsx` 라인 207–216 (`removeButton` 탐색 로직)
+  - 상세: 삭제 버튼을 `row.querySelector("button:not([data-state])")` 와 `candidateButtons[candidateButtons.length - 1]` 순서로 조합해 선택한다. 이는 테스트 코드에서의 패턴이므로 프로덕션 보안에 직접 영향을 주지 않는다. 그러나 `data-testid` 또는 `aria-label` 없이 DOM 구조에만 의존하는 방식은 향후 UI 변경 시 의도치 않게 다른 버튼을 클릭하는 테스트 오탐(false positive)을 유발할 수 있어, 보안 관련 동작을 검증하는 테스트의 신뢰도를 낮춘다.
+  - 제안: 삭제 버튼에 `data-testid="remove-field-row"` 또는 `aria-label` 을 추가해 DOM 위치에 의존하지 않는 명확한 선택자를 사용한다.
+
+- **[INFO]** 이메일 주소가 커밋 메타데이터에 노출
+  - 위치: 커밋 author 정보 `worker-ants <admin@getit.co.kr>`
+  - 상세: 이는 git history의 일반적인 구성이며 직접적인 취약점은 아니다. 그러나 내부 이메일 주소가 공개 저장소에 노출될 경우 스팸·사회공학 공격의 단서가 될 수 있다.
+  - 제안: 공개 저장소라면 git 커밋 이메일로 noreply 주소 사용을 검토한다. 비공개 저장소라면 현재 수준으로 충분하다.
+
+## 요약
+
+이번 변경은 Cafe24 노드 설정 패널의 `Fields` 편집 버퍼를 React 로컬 state로 분리하는 프론트엔드 UI 픽스 및 단위 테스트 추가로, 백엔드 계약·데이터 모델·인증/인가 로직은 변경되지 않았다. SQL 인젝션·XSS·커맨드 인젝션·경로 탐색 등 전통적 인젝션 벡터와 직접 관련된 코드 변경은 없으며, 하드코딩된 시크릿이나 API 키도 발견되지 않았다. 변경 범위가 순수 UI 상태 관리에 국한되고, `fieldRowsToObject` 의 빈 키 필터링은 오히려 빈 key가 객체에 유입되는 것을 방지하는 방어적 로직으로 평가된다. 사용자 입력 값에 대한 클라이언트 측 검증이 없는 점과 `config.fields` 타입 신뢰 방식은 백엔드 검증이 충분하다면 허용 가능한 수준이며, 모두 INFO 등급으로 분류된다.
+
+## 위험도
+
+NONE

```

---

### 파일 175: review/code/2026/05/16/09_17_17/side_effect/review.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 176: review/code/2026/05/16/09_17_17/testing/review.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 177: review/code/2026/05/16/09_22_53/RESOLUTION.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/code/2026/05/16/09_22_53/RESOLUTION.md b/review/code/2026/05/16/09_22_53/RESOLUTION.md
new file mode 100644
index 00000000..057976e2
--- /dev/null
+++ b/review/code/2026/05/16/09_22_53/RESOLUTION.md
@@ -0,0 +1,37 @@
+# Review Resolution — bg-monitoring-e2e-fix 2026-05-16
+
+세션: `review/code/2026/05/16/09_22_53`
+
+## 결과
+
+Critical 0건. Warning 1건은 미조치(의도)로 RESOLUTION 에 사유 기록. Info ~40건은 추적 항목.
+
+## Warning — 미조치 사유
+
+### W1 — stale 이미지 회귀 방지 smoke test 미존재 (testing reviewer)
+
+**권고** 컨트롤러 등록을 검증하는 별도 smoke test (예: `GET /api/executions/<uuid>/background-runs/<uuid>` 가 404 가 아닌 401/200 을 반환하는지) 추가.
+
+**미조치 사유**
+
+1. **중복 검증**: 기존 e2e 스위트(12 suites, 66 tests)가 이미 컨트롤러 등록을 간접 검증함. background-monitoring.e2e-spec.ts 의 2 테스트가 사전 결함을 발견한 매커니즘이 곧 smoke test 역할.
+2. **유효 범위**: 본 fix 는 인프라 수준(`Makefile --build`)에서 stale 이미지 자체를 차단함. 코드 레이어 smoke test 는 인프라 결함을 검출하는 적절한 위치가 아님.
+3. **유지보수 비용**: 28개 컨트롤러 각각에 smoke test 를 추가하면 28건의 코드 추가가 발생. 새 컨트롤러 추가 시마다 동기화 부담.
+4. **원칙 위반 우려**: SKILL.md "Don't add features, refactor, or introduce abstractions beyond what the task requires" 와 충돌.
+
+대안: 본 Makefile fix 가 적용된 후에는 stale 이미지 시나리오가 구조적으로 차단되므로 별도 smoke test 추가의 비용 대비 효용이 낮음.
+
+## Info — 추적
+
+- **performance / scope**: runner 서비스 `--build` 의 필요성 재검토 (host volume mount 사용 시) — 일관성·예외상황 대비 차원에서 현 결정 유지.
+- **documentation**: README.md / CHANGELOG.md 에 `make e2e-*` 타겟 안내 누락. `help` 메시지에 `--build` 동작 안내 추가 권고. 다음 문서 사이클 처리.
+- **testing**: `e2e-test-full` 의 `&&` vs `; STATUS=$$?` 패턴 혼재 (backend runner 실패 시 playwright skip, 그러나 STATUS 는 playwright 만 반영). 사전 결함, 본 PR 범위 밖. 후속 후보.
+- **maintainability**: `review/consistency/**/_prompts/*.md` 가 spec snapshot 을 복제해 저장소 크기에 누적. CLAUDE.md "review/** 시점 기록" 정책에 따른 의도된 형태.
+- **scope**: 사전 lint fix 동반 포함은 SKILL.md ISSUE FIX 정책 (TEST WORKFLOW 에서 발견되는 사전 결함도 해결) 에 부합.
+
+## TEST WORKFLOW 재검증
+
+- **backend lint** ✅ 0 errors (사전 17 warnings 잔존 — 본 PR 범위 밖, 별도 후속)
+- **backend unit (jest)** ✅ 3580/3580 PASS (205 suites)
+- **backend build (nest)** ✅ PASS
+- **backend e2e (`make e2e-test`)** ✅ 12/12 suites, 66/66 tests PASS — 기존 stale 이미지가 삭제된 상태에서 자동 rebuild 가 성공적으로 동작함을 확인.

```

---

### 파일 178: review/code/2026/05/16/09_22_53/SUMMARY.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/code/2026/05/16/09_22_53/SUMMARY.md b/review/code/2026/05/16/09_22_53/SUMMARY.md
new file mode 100644
index 00000000..bd34c185
--- /dev/null
+++ b/review/code/2026/05/16/09_22_53/SUMMARY.md
@@ -0,0 +1,47 @@
+# Code Review 통합 보고서
+
+세션: `review/code/2026/05/16/09_22_53`
+변경: `Makefile` (--build 플래그), `third-party-oauth.controller.spec.ts` (lint fix), plan + consistency-check 산출물
+리뷰어: 13/13 success, 0 pending
+
+## 전체 위험도
+
+**LOW** — Critical 0건. Warning 1건(테스트 권고). 나머지 INFO. 인프라 fix 가 본 PR 의 핵심이며, 동반된 사전 lint error 도 함께 해소됨.
+
+## Critical
+
+없음
+
+## Warning
+
+| # | 분류 | 발견 | 조치 |
+|---|---|---|---|
+| W1 | testing | stale 이미지 결함의 회귀 방지 smoke test 미존재 — 컨트롤러 등록 자체를 검증하는 별도 테스트 권고 | **미조치 (의도)**. 기존 e2e 스위트 자체가 컨트롤러 등록을 간접 검증하며(사전 결함 발견의 매커니즘), 별도 smoke test 추가는 중복·유지보수 비용. 인프라 수준에서 해결한 결함을 코드 테스트로 이중 잠금하는 것은 SKILL.md "Don't add features beyond what the task requires" 원칙에 어긋남. 본 WARNING 은 권고 성격으로 RESOLUTION 에 기록만 함 |
+
+## Info (RESOLUTION 추적)
+
+총 ~40건 INFO. 주요 항목:
+
+- **performance**: `run --rm --build` 의 runner 서비스 재빌드 필요성 재검토 — runner 가 host volume mount 사용하므로 `up --build` 만으로 충분할 수 있음. 단, 일관성·예외상황 대비 차원에서 현 결정 유지 (모든 runner 가 동일 정책).
+- **documentation**: README.md / CHANGELOG.md 에 e2e make target 자체가 미언급. `help` 텍스트에 `--build` 동작 추가 권고. 다음 문서 사이클 처리.
+- **testing**: `e2e-test-full` 의 `&&` vs `; STATUS=$$?` 패턴 혼재 — backend runner 실패 시 playwright 가 skip 되나 STATUS 캡처가 playwright 결과만 반영. 사전 결함, 본 PR 범위 밖.
+- **maintainability**: review/consistency/**/_prompts/*.md 가 spec snapshot 을 다량 복제 — 저장소 크기에 누적. CLAUDE.md "review/** 시점 기록" 정책 따름.
+- **scope**: 변경 범위 적절. 사전 lint fix 동반 포함은 SKILL.md ISSUE FIX 정책에 부합.
+
+## 에이전트별 위험도
+
+| 에이전트 | 위험도 | 핵심 |
+|---|---|---|
+| security | NONE | 인프라 변경, 보안 표면 영향 없음 |
+| performance | LOW | `--build` 의 layer-cache 비용 미미 |
+| architecture | NONE | 인프라 레이어, 아키텍처 변경 없음 |
+| requirement | LOW | 의도 충족 |
+| scope | NONE | 변경 범위 적절 |
+| side_effect | NONE | 인프라 단독 변경 |
+| maintainability | LOW | review prompt 크기 (시점 기록 정책) |
+| testing | LOW | **W1** smoke test 권고 (미조치 의도) |
+| documentation | LOW | README/CHANGELOG 후속 |
+| dependency | NONE | 외부 의존성 변경 없음 |
+| database | NONE | N/A |
+| concurrency | NONE | N/A |
+| api_contract | NONE | API 계약 변경 없음 |

```

---

### 파일 179: review/code/2026/05/16/09_22_53/_prompts/api_contract.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 180: review/code/2026/05/16/09_22_53/_prompts/architecture.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 181: review/code/2026/05/16/09_22_53/_prompts/concurrency.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 182: review/code/2026/05/16/09_22_53/_prompts/database.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 183: review/code/2026/05/16/09_22_53/_prompts/dependency.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 184: review/code/2026/05/16/09_22_53/_prompts/documentation.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 185: review/code/2026/05/16/09_22_53/_prompts/maintainability.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 186: review/code/2026/05/16/09_22_53/_prompts/performance.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 187: review/code/2026/05/16/09_22_53/_prompts/requirement.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 188: review/code/2026/05/16/09_22_53/_prompts/scope.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 189: review/code/2026/05/16/09_22_53/_prompts/security.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 190: review/code/2026/05/16/09_22_53/_prompts/side_effect.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 191: review/code/2026/05/16/09_22_53/_prompts/testing.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 192: review/code/2026/05/16/09_22_53/_retry_state.json
- 변경 유형: Review
- 언어: json


... (diff omitted due to prompt size limit) ...

---

### 파일 193: review/code/2026/05/16/09_22_53/api_contract/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/code/2026/05/16/09_22_53/api_contract/review.md b/review/code/2026/05/16/09_22_53/api_contract/review.md
new file mode 100644
index 00000000..e0fc384d
--- /dev/null
+++ b/review/code/2026/05/16/09_22_53/api_contract/review.md
@@ -0,0 +1,11 @@
+### 발견사항
+
+해당 없음
+
+### 요약
+
+이번 변경은 Makefile 의 Docker Compose `--build` 플래그 추가, 테스트 파일의 TypeScript 타입 좁히기 lint 수정, plan 문서 신규 생성, consistency check 결과 문서 신규 생성으로 구성된다. API 엔드포인트의 신규 추가·변경·삭제, 응답 스키마 변경, 에러 응답 형식 변경, 요청 파라미터 검증 변경, URL 설계 변경, 인증·인가 로직 변경 등 API 계약에 영향을 주는 코드가 포함되어 있지 않다. 빌드 인프라 및 테스트 인프라 수준의 수정에 해당하므로 API 계약 관점의 검토 대상이 아니다.
+
+### 위험도
+
+NONE

```

---

### 파일 194: review/code/2026/05/16/09_22_53/architecture/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/code/2026/05/16/09_22_53/architecture/review.md b/review/code/2026/05/16/09_22_53/architecture/review.md
new file mode 100644
index 00000000..f15c20a3
--- /dev/null
+++ b/review/code/2026/05/16/09_22_53/architecture/review.md
@@ -0,0 +1,39 @@
+# 아키텍처(Architecture) Review
+
+리뷰 대상: `Makefile`, `backend/src/modules/integrations/third-party-oauth.controller.spec.ts`, `plan/in-progress/e2e-makefile-stale-image-fix-2026-05-16.md`, `review/consistency/2026/05/16/09_13_51/SUMMARY.md`
+
+---
+
+### 발견사항
+
+- **[INFO]** Makefile `e2e-up` 타겟의 책임 일관성
+  - 위치: `Makefile` — `e2e-up` 타겟
+  - 상세: `e2e-up` 은 "인프라 기동" 단독 책임을 갖는 타겟이다. `--build` 추가는 "소스 반영" 책임도 함께 포함하게 되어 단일 책임 범위가 미미하게 확장된다. 다만 `e2e-test`, `e2e-test-full` 이 `e2e-up` 을 직접 호출하지 않고 각자 `up --build` 를 인라인으로 실행하는 구조이므로, `e2e-up` 의 변경은 독립적으로 `e2e-up` 을 사용하는 개발자(예: 로컬 디버깅 목적 수동 기동) 에 대한 배려로 일관성 있다. 실질적인 SRP 위반은 아님.
+  - 제안: 현 구조 유지 가능. 향후 "기동만" / "빌드+기동" 두 시나리오를 구분할 필요가 생기면 `e2e-up-fresh` 같은 별도 타겟을 분리하는 방식으로 확장성 확보 가능.
+
+- **[INFO]** `e2e-test` 와 `e2e-up` 사이의 중복 (DRY / 응집도)
+  - 위치: `Makefile` — `e2e-test`, `e2e-test-full`, `e2e-up` 타겟
+  - 상세: `e2e-test` / `e2e-test-full` 이 `e2e-up` 을 재사용하지 않고 `$(COMPOSE_E2E) up -d --wait --build backend-e2e` 를 직접 중복 인라인 한다. 이는 기존 설계부터의 패턴이며, plan 문서에 `--abort-on-container-exit` 를 피하기 위한 의도적 분리임이 명시되어 있다. 아키텍처 결함은 아니나, 향후 `up` 인자(예: `--profile`)가 추가될 때 세 곳을 동시에 수정해야 하는 변경 취약점이 된다.
+  - 제안: `e2e-up` 에 대해 `$(MAKE) e2e-up` 을 통해 재사용하거나, `COMPOSE_E2E_UP` 같은 Makefile 변수로 `up` 인자를 중앙화하면 변경 지점이 1곳으로 줄어든다.
+
+- **[INFO]** TypeScript 테스트 코드의 타입 레이어 경계
+  - 위치: `backend/src/modules/integrations/third-party-oauth.controller.spec.ts` L85-88
+  - 상세: `Record<string, unknown>` → `Record<string, string>` 으로 타입을 좁힌 변경은 ESLint `@typescript-eslint/no-base-to-string` 규칙을 해소하는 lint-driven fix다. 테스트 코드에서 실제 HTTP 응답 헤더를 `string` 으로 좁히는 것은 현실적이고 적절하다. 아키텍처 레이어 측면에서, 테스트가 `res` 의 내부 구조를 직접 캐스팅(`as { headers?: ... }`)하는 방식은 supertest mock 객체와 강하게 결합되어 있어 타입 안전성이 타입 캐스팅에 의존한다.
+  - 제안: 이 패턴은 supertest mock의 타입 한계에 기인하는 허용 가능한 pragmatic cast다. 중요도 낮음. 만약 이 패턴이 반복적으로 사용된다면 테스트 헬퍼 함수(`getContentType(res)`) 를 추출해 캐스팅 로직을 단일화하는 리팩토링을 고려할 수 있다.
+
+- **[INFO]** 빌드 인프라 결정의 문서화 위치
+  - 위치: `Makefile` 인라인 주석 (L35-38)
+  - 상세: `--build` 누락의 근본 원인·결정 배경이 Makefile 인라인 주석에 직접 기술되어 있다. CLAUDE.md 규약상 아키텍처 결정의 배경·근거는 해당 spec 문서의 `## Rationale` 섹션에 두도록 되어 있다. 다만 Makefile 은 `spec/` 영역이 아닌 인프라 스크립트이며, 해당 내용이 plan 문서에도 충실히 기술되어 있으므로 실질적 정보 손실은 없다.
+  - 제안: Makefile 인라인 주석 유지는 합리적이다. e2e 인프라 관련 spec 문서(예: `spec/5-system/` 내 e2e 전략 문서)가 존재한다면 해당 사전 결함 사례를 `## Rationale` 또는 `## 주의사항` 섹션에 추가해두면 향후 유사 실수를 방지하는 guard 역할을 한다.
+
+---
+
+### 요약
+
+이번 변경은 Docker e2e 인프라의 `--build` 플래그 누락이라는 단순하지만 사일런트한 실패를 유발하는 인프라 결함을 수정한 것으로, 아키텍처 관점에서 새로운 구조적 문제를 도입하지 않는다. Makefile 타겟의 책임 구분(`e2e-up` / `e2e-test` / `e2e-test-full`)은 기존 설계 의도(네트워크 race 회피를 위한 분리)를 유지하며, `--build` 추가도 각 타겟에 일관성 있게 적용되었다. TypeScript 테스트의 타입 수정은 lint 준수를 위한 최소 변경으로, 레이어 경계나 의존성 구조에 영향을 주지 않는다. 유일한 관찰 사항은 `up` 인자가 세 타겟에 중복 인라인되어 있어 향후 인자 추가 시 변경 지점이 분산될 수 있다는 점이며, 이는 경미한 DRY 개선 기회다.
+
+---
+
+### 위험도
+
+LOW

```

---

### 파일 195: review/code/2026/05/16/09_22_53/concurrency/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/code/2026/05/16/09_22_53/concurrency/review.md b/review/code/2026/05/16/09_22_53/concurrency/review.md
new file mode 100644
index 00000000..993f517d
--- /dev/null
+++ b/review/code/2026/05/16/09_22_53/concurrency/review.md
@@ -0,0 +1,11 @@
+### 발견사항
+
+해당 없음
+
+### 요약
+
+이번 변경은 Makefile 의 Docker Compose 명령에 `--build` 플래그를 추가하여 stale 이미지 재사용을 방지하는 빌드 인프라 수정, TypeScript 테스트 파일의 타입 선언을 `Record<string, unknown>` 에서 `Record<string, string>` 으로 좁혀 `@typescript-eslint/no-base-to-string` lint 오류를 해소하는 타입 수정, plan 문서 및 consistency check 결과 markdown 문서 추가로 구성된다. 변경된 코드 중 공유 자원 접근, 비동기 처리, 락/동기화, 스레드 안전성, 이벤트 루프, 리소스 풀링과 관련된 런타임 동시성 코드는 존재하지 않는다. 동시성 관점의 검토 대상이 없다.
+
+### 위험도
+
+NONE

```

---

### 파일 196: review/code/2026/05/16/09_22_53/database/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/code/2026/05/16/09_22_53/database/review.md b/review/code/2026/05/16/09_22_53/database/review.md
new file mode 100644
index 00000000..8f1a74a6
--- /dev/null
+++ b/review/code/2026/05/16/09_22_53/database/review.md
@@ -0,0 +1,10 @@
+### 발견사항
+
+해당 없음
+
+### 요약
+
+이번 변경은 Makefile의 Docker Compose 명령에 `--build` 플래그를 추가한 e2e 빌드 설정 수정, TypeScript 타입 좁히기 lint fix, plan 문서 및 consistency review 산출물 추가로 구성된다. 데이터베이스 쿼리, 스키마, 마이그레이션, 커넥션 관리, ORM 코드 등 데이터베이스 관련 변경사항이 전혀 포함되어 있지 않아 데이터베이스 관점의 검토 대상이 없다.
+
+### 위험도
+NONE

```

---

### 파일 197: review/code/2026/05/16/09_22_53/dependency/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/code/2026/05/16/09_22_53/dependency/review.md b/review/code/2026/05/16/09_22_53/dependency/review.md
new file mode 100644
index 00000000..926aafee
--- /dev/null
+++ b/review/code/2026/05/16/09_22_53/dependency/review.md
@@ -0,0 +1,26 @@
+# 의존성(Dependency) Review
+
+## 발견사항
+
+- **[INFO]** 변경 대상 파일에 새 외부 패키지/라이브러리 추가 없음
+  - 위치: `Makefile`, `backend/src/modules/integrations/third-party-oauth.controller.spec.ts`, `plan/in-progress/e2e-makefile-stale-image-fix-2026-05-16.md`, `review/consistency/2026/05/16/09_13_51/SUMMARY.md`
+  - 상세: 이번 변경 세트는 (1) Makefile에 `--build` 플래그 추가, (2) TypeScript 타입 리터럴 수정, (3) plan/review 문서 신규 생성으로만 구성된다. `package.json`, `package-lock.json`, `docker-compose.e2e.yml`(diff 미포함)의 의존성 섹션에 변경이 없으며 외부 패키지 추가·업그레이드·제거가 없다.
+  - 제안: 이슈 없음.
+
+- **[INFO]** Docker BuildKit 내부 의존성 — `--build` 플래그 추가로 Docker 빌드 레이어 캐시에 대한 런타임 의존이 명시됨
+  - 위치: `Makefile` 변경 라인 (e2e-up, e2e-test, e2e-test-full 타겟)
+  - 상세: `docker compose ... up -d --wait --build backend-e2e` 및 `run --rm --build` 플래그는 Docker BuildKit의 레이어 캐시 재사용에 의존한다. 이는 외부 패키지 의존성이 아니라 빌드 인프라 의존이다. Docker BuildKit은 Docker Engine 23.0+에서 기본 활성화되어 있고 프로젝트가 이미 `docker-compose.e2e.yml`을 사용하고 있으므로 호환성 우려는 없다. 캐시 히트 시 첫 빌드 이후 증분 빌드 오버헤드는 매우 작다.
+  - 제안: 이슈 없음. 기존 인프라 의존 범위 안이다.
+
+- **[INFO]** 내부 모듈 간 의존 관계 — `third-party-oauth.controller.spec.ts` 타입 수정
+  - 위치: `backend/src/modules/integrations/third-party-oauth.controller.spec.ts` L85-88
+  - 상세: `Record<string, unknown>` → `Record<string, string>` 타입 좁히기는 동일 파일 내 타입 단언 수정으로, 외부 의존성이나 내부 모듈 간 의존 구조에 영향을 주지 않는다. `@typescript-eslint/no-base-to-string` lint 규칙 위반을 해소하는 목적이므로 올바른 방향이다.
+  - 제안: 이슈 없음.
+
+## 요약
+
+이번 변경 세트(`bg-monitoring-e2e-fix-f789b9`)는 순수한 빌드 플래그 수정(`Makefile --build` 추가)과 TypeScript 타입 정밀화, 문서 추가로만 구성된다. 새 외부 패키지 도입, 버전 변경, 라이선스 문제, 알려진 취약점을 가진 의존성 사용, 번들 크기 변화, 내부 모듈 간 의존 관계 변경은 전혀 없다. Docker BuildKit 레이어 캐시에 대한 런타임 의존이 더 명시적으로 드러나지만 이미 프로젝트가 의존하고 있던 인프라 범위 안이다. 의존성 관점에서 지적할 사항이 없는 무결한 변경이다.
+
+## 위험도
+
+NONE

```

---

### 파일 198: review/code/2026/05/16/09_22_53/documentation/review.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 199: review/code/2026/05/16/09_22_53/maintainability/review.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 200: review/code/2026/05/16/09_22_53/meta.json
- 변경 유형: Review
- 언어: json

#### 변경된 코드
```
diff --git a/review/code/2026/05/16/09_22_53/meta.json b/review/code/2026/05/16/09_22_53/meta.json
new file mode 100644
index 00000000..2064df74
--- /dev/null
+++ b/review/code/2026/05/16/09_22_53/meta.json
@@ -0,0 +1,100 @@
+{
+  "timestamp": "2026-05-16T09:22:53.473492",
+  "files": [
+    {
+      "file_path": "Makefile",
+      "change_type": "Review",
+      "file_extension": ""
+    },
+    {
+      "file_path": "backend/src/modules/integrations/third-party-oauth.controller.spec.ts",
+      "change_type": "Review",
+      "file_extension": "ts"
+    },
+    {
+      "file_path": "plan/in-progress/e2e-makefile-stale-image-fix-2026-05-16.md",
+      "change_type": "Review",
+      "file_extension": "md"
+    },
+    {
+      "file_path": "review/consistency/2026/05/16/09_13_51/SUMMARY.md",
+      "change_type": "Review",
+      "file_extension": "md"
+    },
+    {
+      "file_path": "review/consistency/2026/05/16/09_13_51/_prompts/convention_compliance.md",
+      "change_type": "Review",
+      "file_extension": "md"
+    },
+    {
+      "file_path": "review/consistency/2026/05/16/09_13_51/_prompts/cross_spec.md",
+      "change_type": "Review",
+      "file_extension": "md"
+    },
+    {
+      "file_path": "review/consistency/2026/05/16/09_13_51/_prompts/naming_collision.md",
+      "change_type": "Review",
+      "file_extension": "md"
+    },
+    {
+      "file_path": "review/consistency/2026/05/16/09_13_51/_prompts/plan_coherence.md",
+      "change_type": "Review",
+      "file_extension": "md"
+    },
+    {
+      "file_path": "review/consistency/2026/05/16/09_13_51/_prompts/rationale_continuity.md",
+      "change_type": "Review",
+      "file_extension": "md"
+    },
+    {
+      "file_path": "review/consistency/2026/05/16/09_13_51/_retry_state.json",
+      "change_type": "Review",
+      "file_extension": "json"
+    },
+    {
+      "file_path": "review/consistency/2026/05/16/09_13_51/convention_compliance/review.md",
+      "change_type": "Review",
+      "file_extension": "md"
+    },
+    {
+      "file_path": "review/consistency/2026/05/16/09_13_51/cross_spec/review.md",
+      "change_type": "Review",
+      "file_extension": "md"
+    },
+    {
+      "file_path": "review/consistency/2026/05/16/09_13_51/meta.json",
+      "change_type": "Review",
+      "file_extension": "json"
+    },
+    {
+      "file_path": "review/consistency/2026/05/16/09_13_51/naming_collision/review.md",
+      "change_type": "Review",
+      "file_extension": "md"
+    },
+    {
+      "file_path": "review/consistency/2026/05/16/09_13_51/plan_coherence/review.md",
+      "change_type": "Review",
+      "file_extension": "md"
+    },
+    {
+      "file_path": "review/consistency/2026/05/16/09_13_51/rationale_continuity/review.md",
+      "change_type": "Review",
+      "file_extension": "md"
+    }
+  ],
+  "agents": [
+    "security",
+    "performance",
+    "architecture",
+    "requirement",
+    "scope",
+    "side_effect",
+    "maintainability",
+    "testing",
+    "documentation",
+    "dependency",
+    "database",
+    "concurrency",
+    "api_contract"
+  ]
+}
\ No newline at end of file

```

---

### 파일 201: review/code/2026/05/16/09_22_53/performance/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/code/2026/05/16/09_22_53/performance/review.md b/review/code/2026/05/16/09_22_53/performance/review.md
new file mode 100644
index 00000000..cefd874e
--- /dev/null
+++ b/review/code/2026/05/16/09_22_53/performance/review.md
@@ -0,0 +1,33 @@
+# 성능(Performance) 코드 리뷰
+
+세션: `review/code/2026/05/16/09_22_53`
+대상 파일: `Makefile`, `backend/src/modules/integrations/third-party-oauth.controller.spec.ts`, `plan/in-progress/e2e-makefile-stale-image-fix-2026-05-16.md`, `review/consistency/2026/05/16/09_13_51/SUMMARY.md`
+
+---
+
+### 발견사항
+
+- **[INFO]** `--build` 플래그 추가로 인한 e2e-test 실행 시간 증가 (캐시 미스 시)
+  - 위치: `Makefile` lines 41, 52, 59–61 (`e2e-up`, `e2e-test`, `e2e-test-full` 타겟)
+  - 상세: `--build` 플래그를 항상 전달하면 Docker BuildKit 이 매 실행마다 레이어 체크섬 비교를 수행한다. 소스가 변경되지 않은 경우 모든 레이어가 캐시 히트하여 오버헤드는 수백 ms 수준이므로 실용적으로 문제없다. 다만 `backend-e2e-runner` 와 `playwright-runner` 에 `run --rm --build` 를 적용하면, `run` 서비스는 `up` 과 달리 BuildKit 가 빌드 컨텍스트를 다시 해시하는 비용이 추가로 발생한다. CI 환경처럼 layer cache 가 없는 경우에는 빌드 오버헤드가 상당할 수 있다.
+  - 제안: `backend-e2e-runner` 와 `playwright-runner` 가 `backend-e2e` 와 동일한 이미지를 공유하거나 별도 Dockerfile 을 갖는지 확인한다. 이미 `up --build backend-e2e` 로 서버 이미지를 빌드한 뒤 runner 가 그 이미지를 단순 실행만 한다면 `run --rm` 에서 `--build` 를 제거해도 stale 이미지 문제가 해소된다. 구조상 필요한 경우에만 runner 에도 `--build` 를 유지한다.
+
+- **[INFO]** `e2e-test-full` 의 `playwright-runner` 는 `backend-e2e-runner` 성공 시에만 실행되지만 (`&&` 연결), `STATUS=$$?` 가 마지막 명령(`$(MAKE) e2e-down`)의 exit code 가 아닌 `playwright-runner` 의 exit code 를 보존한다는 점에서 타이밍 의미론이 변경 전과 동일함 — 성능 문제는 아니지만 `e2e-down` 자체 실패 시 STATUS 가 0 으로 오염될 수 있음. 변경 diff 범위 밖이므로 INFO 로 기록.
+  - 위치: `Makefile` lines 59–62
+  - 상세: 기존 로직 그대로이나, `--build` 추가로 runner 빌드가 실패하면 `STATUS` 가 runner 빌드 실패 코드를 받아 이후 스텝에서 혼동될 수 있다.
+  - 제안: runner 이미지가 서버 이미지와 독립적으로 빌드된다면 빌드 단계를 `e2e-up` 에 통합하고 `run` 단계에서는 `--build` 를 제거하는 것이 오버헤드와 오류 격리 모두에 유리하다.
+
+- **[INFO]** `third-party-oauth.controller.spec.ts` 의 타입 narrowing 변경은 성능 무관
+  - 위치: `backend/src/modules/integrations/third-party-oauth.controller.spec.ts` lines 85–88
+  - 상세: `Record<string, unknown>` → `Record<string, string>` 타입 좁히기 + `String(contentType ?? '')` → `contentType ?? ''` 의 불필요한 `String()` 래핑 제거는 런타임에서 객체 래핑을 한 단계 줄인다. 효과는 마이크로초 단위로 테스트 전체 성능에 실질 영향은 없으나 코드 명확성 측면에서 올바른 방향이다.
+  - 제안: 유지. 변경 자체가 성능·정확성 모두에 긍정적이다.
+
+---
+
+### 요약
+
+이번 변경은 Docker BuildKit `--build` 플래그 추가와 소규모 TypeScript 타입 수정으로 구성된다. 성능 측면의 핵심 고려점은 `--build` 플래그가 매 e2e 실행마다 레이어 체크섬 비교 비용을 수반한다는 점이다. 소스 변경이 없는 경우 BuildKit layer cache 가 모든 레이어를 재사용하므로 로컬 개발 환경에서의 오버헤드는 미미하고, stale 이미지로 인한 사일런트 404 실패를 방지하는 정확성 이득이 훨씬 크다. 다만 `run --rm --build` 로 runner 서비스까지 매번 빌드하는 구조가 필요한지 재검토할 여지가 있으며, runner 가 독립 이미지를 갖지 않는다면 `up` 단계에서의 단일 `--build` 만으로 충분하다. TypeScript 변경은 불필요한 `String()` 래핑을 제거한 미세한 개선으로 성능 관점에서 특이사항 없다. 전체적으로 성능 위험도가 낮은 변경이다.
+
+### 위험도
+
+LOW

```

---

### 파일 202: review/code/2026/05/16/09_22_53/requirement/review.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 203: review/code/2026/05/16/09_22_53/scope/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/code/2026/05/16/09_22_53/scope/review.md b/review/code/2026/05/16/09_22_53/scope/review.md
new file mode 100644
index 00000000..010d0618
--- /dev/null
+++ b/review/code/2026/05/16/09_22_53/scope/review.md
@@ -0,0 +1,41 @@
+# 변경 범위(Scope) 리뷰
+
+## 발견사항
+
+- **[INFO]** `Makefile` — `--build` 플래그 추가는 요청된 수정 범위(stale 이미지 문제 해소)와 정확히 일치
+  - 위치: `e2e-up` (L41), `e2e-test` (L51-52), `e2e-test-full` (L59-61)
+  - 상세: 3개 타겟 전부에 `--build` 플래그를 일관되게 추가했으며, 어느 타겟도 누락 없이 같은 방식으로 처리됨. 범위 초과 없음.
+  - 제안: 없음.
+
+- **[INFO]** `Makefile` — 새로 추가된 주석 블록(L36-38)은 `--build` 플래그의 목적과 side-effect 를 설명
+  - 위치: `e2e-up` 타겟 위 4줄 주석
+  - 상세: 주석이 변경 의도(stale 이미지 방지), BuildKit layer cache 동작, 실제 사례(`background-monitoring` 사전 결함)를 명시적으로 기술함. 불필요한 주석이 아니라 미래 유지보수자에게 필수적인 WHY 설명이므로 정당한 추가임.
+  - 제안: 없음.
+
+- **[INFO]** `third-party-oauth.controller.spec.ts` — 타입 좁히기와 불필요한 `String()` 캐스트 제거
+  - 위치: L85-88 (diff 기준)
+  - 상세: `Record<string, unknown>` → `Record<string, string>` 로 좁혀 `@typescript-eslint/no-base-to-string` lint 오류를 해소하고, `expect(String(contentType ?? '')).toContain(...)` 를 `expect(contentType ?? '').toContain(...)` 로 단순화. plan 문서(파일 3)의 "의도적 제외" 섹션에 이 lint fix 가 '동반 수정'으로 명시되어 있어 의도된 범위 안의 변경임.
+  - 제안: 없음.
+
+- **[INFO]** `plan/in-progress/e2e-makefile-stale-image-fix-2026-05-16.md` — 신규 plan 문서 생성
+  - 위치: 전체 파일 (49 lines)
+  - 상세: 작업 배경, 근본 원인, 증거, 작업 범위 체크리스트, 의도적 제외 항목, 후속 내용이 구조적으로 문서화됨. frontmatter(`worktree`, `started`, `owner`) 도 규약대로 포함. REVIEW WORKFLOW 체크박스(`[ ]`)가 미완 상태로 올바르게 남아 있으므로 `in-progress/` 위치가 정확함. 범위 초과 없음.
+  - 제안: 없음.
+
+- **[INFO]** `review/consistency/2026/05/16/09_13_51/SUMMARY.md` — consistency-check 산출물 추가
+  - 위치: 전체 파일 (30 lines)
+  - 상세: developer 가 구현 착수 전 `--impl-prep` 모드로 consistency-check 를 실행한 결과물. CLAUDE.md 규약("구현 착수 직전 consistency-checker --impl-prep 의무 호출")에 따른 정상적인 부산물이며, `review/consistency/` 경로는 쓰기 권한 범위에 포함됨.
+  - 제안: 없음.
+
+- **[INFO]** `review/consistency/2026/05/16/09_13_51/_prompts/convention_compliance.md` — consistency-check orchestrator 생성 파일
+  - 위치: 전체 파일 (635 lines 이상)
+  - 상세: orchestrator 가 자동으로 생성한 내부 prompt 파일. `review/consistency/.../_prompts/` 경로는 consistency-checker 세션의 산출 규약상 허용 경로. 내용은 기존 `spec/conventions/` 문서를 그대로 인용한 것으로 새로운 코드나 설정 변경이 아님.
+  - 제안: 없음.
+
+## 요약
+
+이번 변경은 `make e2e-test` 계열 타겟의 stale Docker 이미지 문제를 해소하기 위한 `--build` 플래그 추가가 핵심이며, 그 외 수정은 (1) lint 오류 동반 수정으로 plan 에 명시된 항목, (2) plan 문서 신규 생성, (3) 의무 consistency-check 산출물 세 가지에 한정된다. 요청 범위를 벗어난 리팩토링, 기능 확장, 무관한 파일 수정, 의미 없는 포맷팅 변경은 존재하지 않는다. 모든 변경이 plan 문서의 "작업 범위"·"의도적 제외" 섹션과 정합하며, 과도한 over-engineering 징후도 없다.
+
+## 위험도
+
+NONE

```

---

### 파일 204: review/code/2026/05/16/09_22_53/security/review.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 205: review/code/2026/05/16/09_22_53/side_effect/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/code/2026/05/16/09_22_53/side_effect/review.md b/review/code/2026/05/16/09_22_53/side_effect/review.md
new file mode 100644
index 00000000..b0d3681d
--- /dev/null
+++ b/review/code/2026/05/16/09_22_53/side_effect/review.md
@@ -0,0 +1,36 @@
+# 부작용(Side Effect) 리뷰
+
+## 발견사항
+
+- **[INFO]** `Makefile` — `e2e-up` / `e2e-test` / `e2e-test-full` 에 `--build` 플래그 추가로 Docker BuildKit 레이어 캐시 재평가 발생
+  - 위치: `Makefile` L40, L51, L56, L59, L61
+  - 상세: `--build` 는 `docker compose up` 및 `docker compose run` 실행 시 이미지 재빌드를 강제하는 플래그다. 이는 의도된 변경이며 명시된 부작용(stale 이미지 문제 해결)이다. 단, CI/CD 환경에서 `make e2e-up` 을 직접 호출하는 스크립트가 있다면 빌드 시간이 늘어날 수 있다. plan 문서에 "CI 는 매번 fresh container 라 영향 없음" 으로 명시되어 있어 CI 쪽 부작용은 낮다고 판단된다.
+  - 제안: 현재 변경 자체는 적절하다. 다만 `make e2e-up` 을 CI 에서 직접 호출하는 워크플로가 있다면, 빌드 시간 증가 여부를 한 번 확인하는 것을 권장한다.
+
+- **[INFO]** `Makefile` — `e2e-test-full` 의 `playwright-runner` 에도 `--build` 추가
+  - 위치: `Makefile` L61
+  - 상세: `playwright-runner` 는 e2e 테스트 실행 컨테이너이며 소스 코드 변경과 직접 연동된다. 소스 변경 시 항상 rebuild 하는 것은 올바른 동작이다. 단, playwright 이미지 자체의 레이어가 많다면 첫 실행 빌드 비용이 높을 수 있다.
+  - 제안: 허용 가능한 수준의 부작용으로 별도 조치 불필요.
+
+- **[INFO]** `third-party-oauth.controller.spec.ts` — 타입 어설션 범위 좁히기 (`unknown` → `string`)
+  - 위치: `backend/src/modules/integrations/third-party-oauth.controller.spec.ts` L85~88
+  - 상세: `Record<string, unknown>` 에서 `Record<string, string>` 으로 타입이 좁혀졌고, `String(contentType ?? '')` 에서 `contentType ?? ''` 로 변경되었다. 런타임 동작에 변화가 없으며 타입 안정성이 개선되었다. 테스트 파일이므로 공개 API 영향 없음.
+  - 제안: 문제 없음.
+
+- **[INFO]** `plan/in-progress/e2e-makefile-stale-image-fix-2026-05-16.md` — 신규 파일 추가 (파일시스템 부작용)
+  - 위치: `plan/in-progress/e2e-makefile-stale-image-fix-2026-05-16.md`
+  - 상세: plan 문서 신규 생성은 프로젝트 규약에 정의된 정상 절차이다. frontmatter 에 `worktree`, `started`, `owner` 가 올바르게 기재되어 있으며 `plan/in-progress/` 에 위치하는 것도 규약에 부합한다. REVIEW WORKFLOW 체크박스 `[ ]` 가 미완으로 남아 있어 `in-progress/` 에 있는 것이 맞다.
+  - 제안: 문제 없음.
+
+- **[INFO]** `review/consistency/2026/05/16/09_13_51/SUMMARY.md` — 신규 파일 추가 (파일시스템 부작용)
+  - 위치: `review/consistency/2026/05/16/09_13_51/SUMMARY.md`
+  - 상세: consistency-checker 산출물로, 규약에 정의된 경로(`review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/SUMMARY.md`)에 정확히 위치한다. 부작용 없음.
+  - 제안: 문제 없음.
+
+## 요약
+
+이번 변경에서 부작용 관점의 실질적 위험 요소는 발견되지 않았다. `Makefile` 의 `--build` 플래그 추가는 Docker BuildKit 레이어 캐시 재평가를 유발하지만 이는 의도된 부작용(stale 이미지 방지)이며 plan 문서에 근거와 범위가 명시되어 있다. 타입 어설션 변경은 테스트 파일 내부에 국한되어 공개 API나 인터페이스에 영향이 없다. 신규 생성된 문서 파일들은 모두 프로젝트 규약에 정의된 경로와 포맷을 준수한다. 전역 변수, 환경 변수, 네트워크 호출, 이벤트/콜백 변경은 포함되지 않는다.
+
+## 위험도
+
+NONE

```

---

### 파일 206: review/code/2026/05/16/09_22_53/testing/review.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 207: review/code/2026/05/16/09_43_04/RESOLUTION.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/code/2026/05/16/09_43_04/RESOLUTION.md b/review/code/2026/05/16/09_43_04/RESOLUTION.md
new file mode 100644
index 00000000..a35881a6
--- /dev/null
+++ b/review/code/2026/05/16/09_43_04/RESOLUTION.md
@@ -0,0 +1,46 @@
+# Review Resolution — e2e Makefile follow-up 2026-05-16
+
+세션: `review/code/2026/05/16/09_43_04`
+
+## 결과
+
+Critical 0. Warning 3 — 1건 즉시 조치 (Makefile 주석 보강), 2건 자연 해소 (REVIEW 종료 시 plan complete 이동). Info 1건 즉시 조치 (README 표현 명시화). 회귀 없음 (e2e 12/12 유지).
+
+## 즉시 조치
+
+### W1 — Makefile `e2e-test-full` 주석에 설계 의도 명시 (requirement reviewer)
+
+**문제** 주석이 short-circuit 동작은 정확히 기술하나, **왜** runner2 (playwright) 가 skip 되어야 하는가의 설계 의도가 빠짐. 후속 개발자가 "playwright 도 항상 실행해야 하지 않나" 라고 오해할 여지.
+
+**조치** Makefile 주석에 한 단락 추가:
+
+```
+설계 의도: runner1 (backend e2e) 실패 시 runner2 (playwright) 는 실행하지
+않는다 — 백엔드 e2e 통과가 frontend e2e 의 선행 조건이며, 백엔드가 깨진
+상태에서 playwright 를 돌려 노이즈 실패를 발생시키지 않기 위함.
+```
+
+### I (README) — "세 `e2e-*` 타겟" 표현 명시화 (documentation reviewer)
+
+**문제** README 의 새 e2e 섹션에서 "세 `e2e-*` 타겟 모두 매 실행 시 `--build`" 라는 표현이 `e2e-down` 까지 포함하는지 모호. 코드 예시에 4개가 나열되어 있어 독자가 잠시 혼동 가능.
+
+**조치** "빌드 타겟 세 개 (`e2e-up`, `e2e-test`, `e2e-test-full`) 모두 ... (`e2e-down` 은 정리 전용이라 제외)" 로 정확히 열거.
+
+## 자연 해소 (Warning W2/W3 — plan 라이프사이클)
+
+reviewer 가 "plan 이 `in-progress/` 에 있는 채로 commit 됐다"·"미체크 항목 잔존" 으로 지적. 본 commit 시점에서는 REVIEW WORKFLOW 가 아직 진행 중이라 `[ ] REVIEW WORKFLOW` 가 미체크인 것은 정합. REVIEW 종료 후 `complete/` 로 `git mv` 하여 자연 해소.
+
+reviewer 의 진단은 commit 시점의 스냅샷만 보고 내린 것으로, 워크플로 단계의 의도된 순서를 반영하지 않음. 실제 자동 commit 규약 (developer SKILL.md "단계별 자동 커밋") 에 따르면 단계별 commit 이 권장되며 plan 이동은 마지막 단계 (REVIEW 후) 에 묶임.
+
+## Info — 추적
+
+총 ~28건 INFO. RESOLUTION 에 상세 기록 생략 — 주요는 다음 세 카테고리:
+
+1. **추가 문서 보강 권고** — README 의 `make e2e-*` 섹션이 인프라 의존 (Docker Desktop) 을 명시하면 더 친절함. 다음 사이클.
+2. **CHANGELOG 의 Test infrastructure 섹션 위치** — 정식 release 시 별 섹션으로 promote 권고. 본 PR 범위 밖.
+3. **e2e-up 후 backend-e2e 외 서비스 정리** — `e2e-up` 직후 `make e2e-down` 없이 다른 작업 진행 시 idle container 잔존. 본 PR 범위 밖.
+
+## TEST WORKFLOW 재검증
+
+- **e2e (`make e2e-test`)**: 12/12 suites, 66/66 tests PASS — Makefile 주석·README 텍스트 변경 외 동작 영향 없음.
+- backend/frontend 코드 변경 0건이라 lint/unit/build 영향 없음 (이전 commit 에서 이미 검증됨).

```

---

### 파일 208: review/code/2026/05/16/09_43_04/SUMMARY.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/code/2026/05/16/09_43_04/SUMMARY.md b/review/code/2026/05/16/09_43_04/SUMMARY.md
new file mode 100644
index 00000000..aece5fe1
--- /dev/null
+++ b/review/code/2026/05/16/09_43_04/SUMMARY.md
@@ -0,0 +1,50 @@
+# Code Review 통합 보고서
+
+세션: `review/code/2026/05/16/09_43_04`
+변경: `README.md` / `CHANGELOG.md` / `Makefile` follow-up + 사전 결함 흡수
+리뷰어: 13/13 success, 0 pending
+
+## 위험도
+
+**LOW** — Critical 0. Warning 3건은 모두 문서·주석 명확화 권고 또는 plan 라이프사이클 timing.
+
+## Critical
+
+없음
+
+## Warning
+
+| # | 분류 | 발견 | 조치 |
+|---|---|---|---|
+| W1 | requirement | Makefile `e2e-test-full` 주석에 "runner1 실패 시 runner2 skip" 의 설계 의도 명시 누락 | **즉시 조치** — 주석에 "백엔드 e2e 통과가 playwright 선행 조건" 한 줄 추가 |
+| W2 | requirement | plan 이 `in-progress/` 에 있는 채로 commit | **자연 해소** — REVIEW WORKFLOW 가 본 commit 후에 진행 중. REVIEW 종료 시 모든 [x] 후 `complete/` 로 `git mv` |
+| W3 | maintainability | plan 의 미체크 항목 잔존 | **자연 해소** — W2 와 동일. REVIEW 단계만 미체크였음 |
+
+## Info → 즉시 조치 1건
+
+- **README**: "세 `e2e-*` 타겟" 표현이 `e2e-down` 까지 포함하는지 모호 → "빌드 타겟 세 개 (`e2e-up`, `e2e-test`, `e2e-test-full`) ... (`e2e-down` 은 정리 전용이라 제외)" 로 명시화.
+
+## 그 외 Info
+
+총 ~30건. 주요:
+- security: README 내부 `python3 scripts/check-doc-links.py` 안내 (사전 결함, 별도 cycle)
+- performance/architecture: 변경이 인프라·문서 한정으로 직접 영향 없음
+- documentation: CHANGELOG 의 "Test infrastructure" 섹션이 정식 release 이전 임시 위치라는 점 (현재 Unreleased 안이므로 OK)
+
+## 에이전트별
+
+| 에이전트 | 위험도 | 핵심 |
+|---|---|---|
+| security | NONE | 인프라·문서 변경, 보안 영향 없음 |
+| performance | NONE | 동일 |
+| architecture | LOW | 문서 정합성 정리 |
+| requirement | LOW | W1, W2 |
+| scope | NONE | 사전 결함 흡수 정당 (ISSUE FIX 정책) |
+| side_effect | NONE | 동작 변경 없음 (주석/문서 한정) |
+| maintainability | LOW | W3 |
+| testing | NONE | e2e 12/12 PASS 유지 |
+| documentation | LOW | I (세 타겟 표현) |
+| dependency | NONE | N/A |
+| database | NONE | N/A |
+| concurrency | NONE | N/A |
+| api_contract | NONE | N/A |

```

---

### 파일 209: review/code/2026/05/16/09_43_04/_prompts/api_contract.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 210: review/code/2026/05/16/09_43_04/_prompts/architecture.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 211: review/code/2026/05/16/09_43_04/_prompts/concurrency.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 212: review/code/2026/05/16/09_43_04/_prompts/database.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 213: review/code/2026/05/16/09_43_04/_prompts/dependency.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 214: review/code/2026/05/16/09_43_04/_prompts/documentation.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 215: review/code/2026/05/16/09_43_04/_prompts/maintainability.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 216: review/code/2026/05/16/09_43_04/_prompts/performance.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 217: review/code/2026/05/16/09_43_04/_prompts/requirement.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 218: review/code/2026/05/16/09_43_04/_prompts/scope.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 219: review/code/2026/05/16/09_43_04/_prompts/security.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 220: review/code/2026/05/16/09_43_04/_prompts/side_effect.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 221: review/code/2026/05/16/09_43_04/_prompts/testing.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 222: review/code/2026/05/16/09_43_04/_retry_state.json
- 변경 유형: Review
- 언어: json


... (diff omitted due to prompt size limit) ...

---

### 파일 223: review/code/2026/05/16/09_43_04/api_contract/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/code/2026/05/16/09_43_04/api_contract/review.md b/review/code/2026/05/16/09_43_04/api_contract/review.md
new file mode 100644
index 00000000..7ad1c220
--- /dev/null
+++ b/review/code/2026/05/16/09_43_04/api_contract/review.md
@@ -0,0 +1,11 @@
+### 발견사항
+
+해당 없음
+
+### 요약
+
+이번 변경은 CHANGELOG.md, Makefile, README.md 에 대한 문서 및 빌드 스크립트 업데이트로 구성되어 있습니다. API 엔드포인트 정의, 응답 형식, 에러 응답, 요청 검증, 인증/인가, URL 설계, 페이지네이션 등 API 계약 관련 코드 변경이 전혀 포함되어 있지 않으므로 API 계약 관점의 리뷰 대상에 해당하지 않습니다.
+
+### 위험도
+
+NONE

```

---

### 파일 224: review/code/2026/05/16/09_43_04/architecture/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/code/2026/05/16/09_43_04/architecture/review.md b/review/code/2026/05/16/09_43_04/architecture/review.md
new file mode 100644
index 00000000..40ce1556
--- /dev/null
+++ b/review/code/2026/05/16/09_43_04/architecture/review.md
@@ -0,0 +1,38 @@
+# Architecture Review
+
+## 발견사항
+
+- **[INFO]** 단일 진실 원칙(Single Source of Truth) 정합성 복원 — 문서 아키텍처 관점
+  - 위치: `CHANGELOG.md` L4, `README.md` L77·L232
+  - 상세: `docs-consolidation(2026-05-12)` 이후 폐기된 `prd/`, `user_memo/` 경로가 핵심 공개 문서(README, CHANGELOG)에 잔존해 있었음. 이는 정보 아키텍처 상 단일 진실 원칙 위반이며, 신규 개발자나 자동화 도구가 구 경로를 참조할 수 있는 위험이 있었다. 본 변경으로 `spec/` 를 유일한 진실 공급원으로 정렬.
+  - 제안: 향후 docs-consolidation 같은 구조 전환 시, README/CHANGELOG 를 동일 커밋·PR 범위에 포함하는 체크리스트를 developer SKILL.md 에 추가해 잔존 참조가 발생하지 않도록 선제 예방.
+
+- **[INFO]** 테스트 인프라 아키텍처의 문서화 — 격리 원칙 명시
+  - 위치: `README.md` (신설 "격리 인프라 기반 e2e" 섹션), `CHANGELOG.md` ("Test infrastructure" 섹션), `Makefile` help 텍스트
+  - 상세: 격리 인프라(`docker-compose.e2e.yml`)와 개발 인프라(`docker-compose.yml`)가 `name:` top-level key 로 충돌 없이 공존하는 격리 아키텍처 결정이 이전까지 코드 내에만 암묵적으로 존재했음. 이번 변경으로 격리 원칙과 `--build` 강제 결정의 배경(stale 이미지 → 사일런트 404 회귀 사례)이 README·CHANGELOG 에 명시됨. 아키텍처 결정 사유가 문서화됨으로써 이후 유지보수자의 의사결정 맥락이 보존됨.
+  - 제안: CHANGELOG 의 "Test infrastructure" 절이 `spec/` 의 어느 문서와 대응되는지 참조 링크를 추가하면, spec-driven 원칙과의 정합성이 더 명확해진다 (예: developer SKILL.md 의 E2E TEST WRITING GUIDE 또는 관련 spec 경로).
+
+- **[INFO]** `e2e-test-full` 의 `runner1 && runner2; STATUS=$$?` 패턴 — 인라인 주석으로 설계 의도 명시
+  - 위치: `Makefile` `e2e-test-full` 타겟 상단 주석 블록
+  - 상세: short-circuit `&&` 와 최종 exit code 캡처 로직은 shell 스크립팅의 비자명한 패턴이다. 이전에는 코드만 존재했고, `e2e-test` 와 패턴이 달라 보여 유지보수자가 "버그인가?" 하는 오해를 살 수 있었음. 다중 라인 주석으로 의도를 인라인 문서화한 것은 적절한 조치. 동작 변경이 없으므로 회귀 위험 없음.
+  - 제안: 없음. 현행 처리 적절함.
+
+- **[INFO]** plan 문서의 미완료 상태 — `in-progress/` 위치 적절
+  - 위치: `plan/in-progress/e2e-makefile-followup-2026-05-16.md` 체크리스트
+  - 상세: `TEST WORKFLOW` 와 `REVIEW WORKFLOW` 항목이 미체크(`[ ]`) 상태로 `in-progress/` 에 위치함. CLAUDE.md plan 라이프사이클 규약과 정합. 리뷰 대상 커밋 시점에서 아직 완료 전 단계이므로 `complete/` 이동은 하지 않은 것이 올바름.
+  - 제안: 리뷰 완료 후 모든 항목이 체크되면 `git mv` 로 `complete/` 이동 필요. 자동 reminder 가 없으므로 REVIEW WORKFLOW 후 즉시 처리.
+
+### 아키텍처 관점 추가 검토
+
+- **[INFO]** consistency-checker 결과의 동반 처리 — 사전 결함 흡수 패턴
+  - 위치: `review/consistency/2026/05/16/09_34_14/SUMMARY.md`, plan 문서 §동반 사전 결함 해소
+  - 상세: consistency-checker 가 발견한 Critical 3건이 "같은 파일을 편집하는 김에 동반 해소"로 plan 에 흡수되었다. 이 패턴은 아키텍처적으로 적절하다 — 동일 레이어(문서 계층)의 관련 결함을 별도 PR/worktree 로 분산시키면 오히려 문서 정합성의 일관성이 낮아지고 review 부담이 증가한다. 단, 흡수 범위가 커지면 PR 의 단일 책임 원칙(SRP)이 희석될 수 있음. 이번 케이스는 모두 문서 경로 교정이라 범위가 명확하게 한정되어 있어 적절한 판단.
+  - 제안: 향후 흡수할 결함이 "동일 파일, 동일 레이어"를 벗어나는 경우 (예: 구현 코드 변경을 수반하는 경우)는 별도 PR 분리를 원칙으로 삼을 것을 권장.
+
+## 요약
+
+이번 변경은 소스 코드 아키텍처가 아닌 **프로젝트 정보 아키텍처(문서 계층)**를 대상으로 한 정리 작업이다. 핵심은 `docs-consolidation` 이후 잔존한 폐기 경로 참조를 제거하여 `spec/` 단일 진실 원칙을 README·CHANGELOG까지 일관되게 적용한 것이다. `Makefile`의 e2e 인프라 격리 아키텍처와 `--build` 강제 결정 사유가 명시됨으로써, 테스트 인프라의 설계 의도가 처음으로 공개 문서 수준에서 가시화되었다. SOLID 원칙 관점에서는 단일 책임 범위가 "문서 경로 교정 + 인프라 안내 추가"로 다소 혼합되어 있으나, 동일 파일을 편집하는 불가피한 맥락에서의 흡수이고 구현 코드 변경이 없으므로 위험도는 낮다. 순환 의존성·레이어 책임·디자인 패턴 관점에서 이 변경이 미치는 부정적 영향은 없다.
+
+## 위험도
+
+NONE

```

---

### 파일 225: review/code/2026/05/16/09_43_04/concurrency/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/code/2026/05/16/09_43_04/concurrency/review.md b/review/code/2026/05/16/09_43_04/concurrency/review.md
new file mode 100644
index 00000000..a618d3c0
--- /dev/null
+++ b/review/code/2026/05/16/09_43_04/concurrency/review.md
@@ -0,0 +1,11 @@
+### 발견사항
+
+해당 없음
+
+### 요약
+
+이번 변경은 CHANGELOG.md, Makefile, README.md 세 파일에 대한 문서 및 빌드 스크립트 업데이트로 구성된다. 변경 내용은 `make e2e-*` 타겟의 help 텍스트 보강, CHANGELOG 경로 참조 수정, README의 폐기된 경로 항목 제거에 한정되며, 런타임 코드·공유 자원 접근·비동기 로직·스레드/프로세스 관련 코드가 전혀 포함되어 있지 않다. 동시성(Concurrency) 관점에서 점검할 대상이 존재하지 않는다.
+
+### 위험도
+
+NONE

```

---

### 파일 226: review/code/2026/05/16/09_43_04/database/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/code/2026/05/16/09_43_04/database/review.md b/review/code/2026/05/16/09_43_04/database/review.md
new file mode 100644
index 00000000..8b65c8ee
--- /dev/null
+++ b/review/code/2026/05/16/09_43_04/database/review.md
@@ -0,0 +1,11 @@
+### 발견사항
+
+해당 없음
+
+### 요약
+
+이번 변경은 CHANGELOG.md, Makefile, README.md 세 파일에 대한 문서 및 빌드 스크립트 수정으로 구성되어 있다. 변경 내용은 `make e2e-*` 타겟의 help 텍스트 보강, `e2e-test-full` 동작 설명 주석 추가, 폐기된 `prd/`·`user_memo/` 경로 참조 제거 등 순수 문서화 작업이다. 데이터베이스 스키마, 쿼리, ORM 코드, 마이그레이션, 커넥션 설정 등 데이터베이스와 관련된 어떠한 코드도 포함되지 않아 데이터베이스 관점의 검토 대상이 아니다.
+
+### 위험도
+
+NONE

```

---

### 파일 227: review/code/2026/05/16/09_43_04/dependency/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/code/2026/05/16/09_43_04/dependency/review.md b/review/code/2026/05/16/09_43_04/dependency/review.md
new file mode 100644
index 00000000..a0aad2c0
--- /dev/null
+++ b/review/code/2026/05/16/09_43_04/dependency/review.md
@@ -0,0 +1,31 @@
+# 의존성(Dependency) Review
+
+## 발견사항
+
+- **[INFO]** 이번 변경에서 외부 패키지·라이브러리 신규 추가 없음
+  - 위치: 전체 diff (파일 1~17)
+  - 상세: 변경된 파일은 CHANGELOG.md, Makefile, README.md, plan 추적 문서, consistency review 산출물 총 17개이며, package.json / package-lock.json / go.mod / requirements.txt 등 의존성 매니페스트 파일은 단 하나도 포함되지 않음. 의존성 관점에서 추가·제거·변경이 전혀 없음.
+  - 제안: 해당 없음.
+
+- **[INFO]** Makefile 의 Docker/Make 도구 체인 의존 — 기존 그대로 유지
+  - 위치: Makefile diff (파일 2)
+  - 상세: `docker compose`, `make` 를 런타임 도구로 사용하는 구조는 이전 commit 에서 확정된 것이며 이번 변경은 help 텍스트와 주석만 수정함. 새 도구 의존이 발생하지 않음.
+  - 제안: 해당 없음.
+
+- **[INFO]** `scripts/check-doc-links.py` — Python 3 표준 라이브러리만 사용
+  - 위치: README.md diff L250 (파일 3)
+  - 상세: README 문서에 "의존성 없음 (Python 3 표준 라이브러리만 사용)" 이 명시되어 있어 외부 패키지가 추가되지 않았음이 문서 수준에서 확인됨. 변경 전부터 동일 기술이며 이번 diff 에서도 해당 문장에 변동 없음.
+  - 제안: 해당 없음.
+
+- **[INFO]** 내부 모듈 간 의존 관계 — 문서 경로 참조만 갱신
+  - 위치: CHANGELOG.md L4 (파일 1), README.md L77·L232 (파일 3)
+  - 상세: `user_memo/node-specs-improvement/CONVENTIONS.md` → `spec/conventions/node-output.md`, `prd/` → `spec/` 등 docs-consolidation(2026-05-12) 후 폐기된 경로 참조를 현행 경로로 교체. 실제 코드 모듈 간 의존 관계에는 영향 없으며 문서 내 링크 정합성만 개선됨.
+  - 제안: 해당 없음.
+
+## 요약
+
+이번 PR(docs(infra): README/CHANGELOG/Makefile follow-up)은 docs-consolidation 이후 잔존한 폐기 경로 참조 3건 해소와 e2e Makefile 관련 도움말·주석 개선을 목적으로 하며, 변경 범위가 문서·Makefile help 텍스트·plan 추적 파일·consistency review 산출물에 한정된다. 외부 패키지, 의존성 매니페스트, 내부 코드 모듈 간 임포트 관계에 아무런 변화가 없으므로 의존성 관점에서 지적할 사항이 존재하지 않는다.
+
+## 위험도
+
+NONE

```

---

### 파일 228: review/code/2026/05/16/09_43_04/documentation/review.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 229: review/code/2026/05/16/09_43_04/maintainability/review.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 230: review/code/2026/05/16/09_43_04/meta.json
- 변경 유형: Review
- 언어: json


... (diff omitted due to prompt size limit) ...

---

### 파일 231: review/code/2026/05/16/09_43_04/performance/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/code/2026/05/16/09_43_04/performance/review.md b/review/code/2026/05/16/09_43_04/performance/review.md
new file mode 100644
index 00000000..af0503b8
--- /dev/null
+++ b/review/code/2026/05/16/09_43_04/performance/review.md
@@ -0,0 +1,28 @@
+# 성능(Performance) 리뷰
+
+리뷰 대상 커밋: `39c869c5` — docs(infra): README/CHANGELOG/Makefile follow-up + docs-consolidation 사전 결함 동반 해소
+
+## 발견사항
+
+- **[INFO]** Makefile `e2e-test-full` 의 `--build` 플래그로 인한 빌드 오버헤드 — 구조적 의도 확인
+  - 위치: Makefile `e2e-test-full` 타겟 (변경 전부터 존재, 이번 커밋은 주석 추가만)
+  - 상세: `e2e-up`, `e2e-test`, `e2e-test-full` 세 타겟 모두 `docker compose ... --build` 를 명시한다. 커밋 메시지·README·CHANGELOG 모두 "BuildKit layer cache 가 변경 없는 layer 는 재사용하므로 첫 build 이후 부담은 작다" 고 설명하며, 이 설계는 stale 이미지로 인한 사일런트 404 회귀를 방지하기 위한 의도적 트레이드오프다. 실제 레이어 캐시 적중률은 Dockerfile layer 분리 방식에 의존하므로, `package.json` / `package-lock.json` 복사 → `npm ci` → 소스 복사 순서로 layer 를 구성했는지 별도 검토 필요.
+  - 제안: Dockerfile 의 dependency 설치 layer 를 소스 복사 layer 와 분리하는 multi-stage 패턴을 이미 적용 중이라면 현재 설계로 충분하다. 미적용 시 `npm ci` layer 가 소스 변경마다 무효화되어 CI 시간이 불필요하게 늘어나므로 Dockerfile layer 순서를 점검할 것.
+
+- **[INFO]** `e2e-test-full` 의 `runner1 && runner2` short-circuit 패턴 — runner2 skip 시 playwright 결과 누락 가능성
+  - 위치: Makefile `e2e-test-full` 타겟 (이번 커밋은 설명 주석 추가만, 동작 변경 없음)
+  - 상세: `runner1(supertest) && runner2(playwright); STATUS=$$?` 패턴은 runner1 실패 시 playwright 를 실행하지 않는다. 성능 측면에서는 실패 조기 종료로 인프라 점유 시간을 줄이는 효과가 있어 의도적으로 타당하다. 다만 두 runner 를 독립적으로 실행하고 양쪽 결과를 모두 수집해야 하는 시나리오(예: CI 에서 전체 실패 현황 파악)가 생기면 패턴 변경이 필요하다.
+  - 제안: 현재 요구사항 기준으로는 적절하다. "supertest 실패 시에도 playwright 를 돌려야 한다" 는 요구가 생기면 `runner1; R1=$$?; runner2; R2=$$?; [ $$R1 -eq 0 ] && [ $$R2 -eq 0 ]` 형태로 전환한다.
+
+- **[INFO]** 이번 커밋의 리뷰 대상 파일 전체가 문서·plan·review 마크다운이며 실행 로직 변경 없음
+  - 위치: CHANGELOG.md, README.md, plan/in-progress/e2e-makefile-followup-2026-05-16.md, review/consistency/\*\*/\*.md
+  - 상세: 알고리즘 복잡도, N+1 쿼리, 메모리 할당, 캐싱, 블로킹 I/O, 불필요한 연산, 자료구조, 지연 로딩 등 8개 성능 점검 관점이 모두 해당 없다. 실질적인 실행 코드 변경은 Makefile help 문자열 수정(echo 4줄)과 주석 블록 추가뿐이며 런타임 성능에 영향 없다.
+  - 제안: 해당 없음.
+
+## 요약
+
+이번 커밋은 문서(CHANGELOG, README), Makefile help 텍스트, plan/review 마크다운만을 수정한 순수 docs 변경이다. 실행 코드 변경이 없으므로 알고리즘 복잡도·N+1·메모리·캐싱·블로킹 I/O 등 핵심 성능 관점은 모두 해당 없다. 유일한 성능 관련 관찰은 `--build` 플래그의 의도적 트레이드오프(매 실행 빌드 vs. stale 이미지 회귀 방지)이며, 커밋 메시지와 README 가 그 근거를 명시적으로 기록하고 있다. Dockerfile layer 분리 설계가 잘 되어 있다면 실제 오버헤드는 미미하다. 성능 측면의 신규 위험 요소는 없다.
+
+## 위험도
+
+NONE

```

---

### 파일 232: review/code/2026/05/16/09_43_04/requirement/review.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 233: review/code/2026/05/16/09_43_04/scope/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/code/2026/05/16/09_43_04/scope/review.md b/review/code/2026/05/16/09_43_04/scope/review.md
new file mode 100644
index 00000000..9eadcaa1
--- /dev/null
+++ b/review/code/2026/05/16/09_43_04/scope/review.md
@@ -0,0 +1,28 @@
+# 변경 범위(Scope) 리뷰
+
+## 발견사항
+
+- **[INFO]** docs-consolidation 사전 결함 3건 동반 해소 — 요청 범위 외 수정 포함됨
+  - 위치: `README.md` (L77, L232), `CHANGELOG.md` (L4)
+  - 상세: 본 PR 의 원래 목적은 이전 `Makefile --build` fix 의 RESOLUTION 후속 4건(README e2e 섹션 추가, CHANGELOG Test infrastructure 섹션, Makefile help 텍스트 갱신, e2e-test-full 주석) 처리다. 여기에 더해 docs-consolidation(2026-05-12) 이후 잔존한 폐기 경로 참조 3건(`prd/` 항목 제거, `user_memo/` 경로 → `spec/conventions/` 교체)이 추가되었다. 이 3건은 원래 follow-up plan 에 없던 항목이다.
+  - 평가: commit message 와 plan 문서(`e2e-makefile-followup-2026-05-16.md`)에 "동반 사전 결함 해소"로 명시하고, consistency-check ISSUE FIX 정책에 따른 것임을 근거로 기록했다. 또한 plan 의 "의도적 제외" 섹션에서 다른 누락 항목과 범위를 명확히 구분했다. 같은 파일을 편집하는 김에 묶은 점도 합리적이다. 다만 이 3건은 본 PR 의 핵심 의도와 무관한 수정이므로, 별도 commit 또는 PR 로 분리하면 변경 추적이 더 명확해진다.
+
+- **[INFO]** `review/consistency/2026/05/16/09_34_14/` 파일 일괄 커밋
+  - 위치: `review/consistency/2026/05/16/09_34_14/SUMMARY.md`, `_prompts/convention_compliance.md` 등
+  - 상세: 구현 착수 전 실행한 consistency-check 산출물이 구현 커밋과 동일 commit 으로 묶였다. 이 파일들은 리뷰 아티팩트로 `review/` 경로에 보관되는 것이 정책상 올바르나, 시점 기록 목적상 consistency-check 완료 직후의 별도 commit 으로 남기는 편이 더 자연스럽다. 현재 묶임 자체가 규칙 위반은 아니다.
+
+- **[INFO]** `plan/in-progress/e2e-makefile-followup-2026-05-16.md` 의 미완료 항목
+  - 위치: `plan/in-progress/e2e-makefile-followup-2026-05-16.md` L346–347
+  - 상세: 체크리스트에 `[ ] TEST WORKFLOW`, `[ ] REVIEW WORKFLOW` 두 항목이 미체크 상태로 커밋되었다. plan 문서가 `in-progress/` 에 위치한 점은 규칙에 맞으나, commit 시점에 이미 e2e 테스트가 통과(12/12 suites, 66/66 tests)한 상태라면 TEST WORKFLOW 체크박스가 미완료인 이유가 불분명하다. 의도적으로 남겨둔 것이라면 주석으로 근거를 남기는 것이 좋다.
+
+- **[INFO]** `README.md` 「격리 인프라 기반 e2e」 섹션의 내용 범위
+  - 위치: `README.md` L230–240
+  - 상세: `e2e-test` / `e2e-test-full` 두 타겟에 대해 "세 `e2e-*` 타겟 모두" 라고 표기하고 있으나, `e2e-down` 은 `--build` 와 무관하므로 서술이 다소 부정확하다 (`e2e-down` 을 제외한 세 타겟이 `--build` 를 갖는다). 기능 확장이나 의도 이상의 변경은 아니지만 문서 정확성 측면에서 확인이 필요하다.
+
+## 요약
+
+본 변경은 `Makefile --build` fix 의 후속 문서화 작업(RESOLUTION 4건)을 핵심 목적으로 하며, 모든 핵심 수정(README e2e 섹션 추가, CHANGELOG Test infrastructure 섹션, Makefile help 갱신, e2e-test-full 주석)이 해당 목적에 정확히 부합한다. 의도 이상의 변경으로 분류될 수 있는 docs-consolidation 잔존 결함 3건 해소가 포함되어 있으나, consistency-check ISSUE FIX 정책에 따라 plan 문서와 commit message 에 명시적으로 근거를 남겼고 같은 파일 편집 범위 안에서 처리한 점에서 실질적 리스크는 낮다. 불필요한 리팩토링·기능 확장·무관한 파일 수정·포맷팅 오염·임포트 변경·설정 파일 의도치 않은 변경은 발견되지 않았다. 동반 해소 항목의 분리 커밋 여부는 팀 컨벤션에 따라 결정하면 충분하다.
+
+## 위험도
+
+LOW

```

---

### 파일 234: review/code/2026/05/16/09_43_04/security/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/code/2026/05/16/09_43_04/security/review.md b/review/code/2026/05/16/09_43_04/security/review.md
new file mode 100644
index 00000000..b7f909a0
--- /dev/null
+++ b/review/code/2026/05/16/09_43_04/security/review.md
@@ -0,0 +1,23 @@
+# Security Review
+
+검토 대상: `CHANGELOG.md`, `Makefile`, `README.md`, `plan/in-progress/e2e-makefile-followup-2026-05-16.md`, `review/consistency/2026/05/16/09_34_14/` 하위 문서 17개
+
+## 발견사항
+
+- **[INFO]** `_retry_state.json` 에 절대 경로 하드코딩
+  - 위치: `review/consistency/2026/05/16/09_34_14/_retry_state.json` L3–4
+  - 상세: `session_dir` 및 `summary_output_file` 필드에 `/Volumes/project/private/clemvion/...` 형태의 로컬 머신 절대 경로가 그대로 기록되어 있다. 이 파일이 원격 저장소(GitHub 등)에 커밋되면 팀원 또는 외부 기여자가 로컬 디렉토리 구조·볼륨명·사용자명을 추론할 수 있다. 직접적인 시크릿 노출은 아니지만 정보 노출(OWASP A05: Security Misconfiguration 의 불필요한 시스템 정보 공개) 범주에 해당한다.
+  - 제안: `_retry_state.json` 은 로컬 세션 전용 임시 파일이므로 `.gitignore` 에 `review/**/_retry_state.json` 또는 `review/**/_*.json` 패턴을 추가해 원격 저장소에 포함되지 않도록 한다. 이미 커밋된 경우 `git rm --cached` 로 추적에서 제거한 뒤 `.gitignore` 에 등록한다.
+
+- **[INFO]** Makefile `e2e-test-full` 의 short-circuit 동작과 cleanup 보장
+  - 위치: `Makefile` diff `+154–157` (새로 추가된 주석 블록 및 기존 `e2e-test-full` 타겟)
+  - 상세: 신규 주석은 `runner1 && runner2; STATUS=$$?` 패턴을 올바르게 설명한다. 보안 관점에서 `e2e-down` 이 항상 실행되어 격리 컨테이너가 확실히 정리된다는 점은 긍정적이다. 다만 `docker compose run --rm` 플래그가 이미 컨테이너를 자동 제거하므로 실질 위험은 낮다. 현 변경은 동작 변경 없이 주석만 추가한 것이므로 추가 조치 불요.
+  - 제안: 현 구현 유지. 향후 runner 추가 시에도 동일 패턴(`&&` + `; STATUS=$$?` + `$(MAKE) e2e-down; exit $$STATUS`)을 일관 적용할 것.
+
+## 요약
+
+이번 변경은 `CHANGELOG.md`, `Makefile`(help 텍스트·인라인 주석 추가), `README.md`(e2e 안내 섹션 신설 및 폐기 경로 정리), plan/review 메타 문서 추가로만 구성된 순수 문서·인프라 변경이다. 프론트엔드·백엔드 애플리케이션 코드는 전혀 포함되지 않았다. 인젝션, 인증/인가, 암호화, 의존성 취약점 등 주요 보안 관점에서 리스크가 되는 코드 변경은 없다. 유일한 지적 사항은 `_retry_state.json` 에 로컬 절대 경로가 기록된 채 저장소에 커밋되어 있는 점(정보 노출)이며, `.gitignore` 등록으로 간단히 해소 가능하다.
+
+## 위험도
+
+LOW

```

---

### 파일 235: review/code/2026/05/16/09_43_04/side_effect/review.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 236: review/code/2026/05/16/09_43_04/testing/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/code/2026/05/16/09_43_04/testing/review.md b/review/code/2026/05/16/09_43_04/testing/review.md
new file mode 100644
index 00000000..7d800605
--- /dev/null
+++ b/review/code/2026/05/16/09_43_04/testing/review.md
@@ -0,0 +1,32 @@
+# 테스트(Testing) 리뷰
+
+리뷰 대상: commit `39c869c5` — `docs(infra): README/CHANGELOG/Makefile follow-up + docs-consolidation 사전 결함 동반 해소`
+
+---
+
+### 발견사항
+
+- **[INFO]** plan 문서에 TEST WORKFLOW 미완료 항목이 명시되어 있음
+  - 위치: `plan/in-progress/e2e-makefile-followup-2026-05-16.md` L346 — `- [ ] TEST WORKFLOW`
+  - 상세: 이번 커밋은 plan 의 `TEST WORKFLOW`·`REVIEW WORKFLOW` 체크박스가 미완료인 상태에서 생성되었다. plan 라이프사이클 규약상 `in-progress/` 에 있는 것은 적절하나, "이미 e2e 12/12 suites 통과" 를 commit message 에서 주장하면서 정작 plan 의 TEST WORKFLOW 가 `[ ]` 인 점이 불일치한다. TEST WORKFLOW 는 developer SKILL.md 의 정식 절차인데, 이번 변경이 순수 문서 수정이라 실질적 테스트 실행이 불필요한 경우 그 근거를 plan 에 명시하거나 항목을 제거하는 것이 명확하다.
+  - 제안: 변경 내용이 소스 코드 변경 없는 순수 문서·Makefile 텍스트 수정임을 plan 에 기록하고 TEST WORKFLOW 항목을 "해당 없음(문서 전용 변경)" 으로 닫거나, 기존 e2e 통과 결과(12/12 suites, 66/66 tests)를 근거로 체크하고 명시한다.
+
+- **[INFO]** `e2e-test-full` 의 exit code 캡처 로직(`runner1 && runner2; STATUS=$$?`)에 대한 단위 테스트 또는 통합 검증 없음
+  - 위치: `Makefile` L36–44 (`e2e-test-full` 타겟)
+  - 상세: 새로 추가된 주석은 `runner1 && runner2; STATUS=$$?` 의 동작(short-circuit, exit code 전파)을 상세히 설명한다. 그러나 이 동작을 검증하는 자동화된 수단이 없다. runner1 이 실패하면 STATUS 가 runner1 의 exit code 를 가지고, runner2 는 실행되지 않는다는 동작은 현재 주석 설명에만 의존한다. Makefile 자체 테스트(`make --dry-run`, bats 등)나, 의도적으로 실패하는 mock runner 를 사용해 exit code 전파를 확인하는 smoke test 가 없다.
+  - 제안: 현재 순수 문서 변경 범위이므로 즉시 수정이 필요한 결함은 아니다. 다만 향후 Makefile 을 변경할 때 exit code 전파 동작을 회귀 검증하기 어렵다. 필요하다면 간단한 bash 스크립트(`scripts/test-makefile-exit.sh`)로 mock 컨테이너를 이용한 smoke test 를 작성해 두는 것이 유지보수에 유리하다.
+
+- **[INFO]** 커밋 메시지의 e2e 통과 주장이 자동화된 CI 결과로 검증되는지 불확실
+  - 위치: commit message `e2e (\`make e2e-test\`) 12/12 suites, 66/66 tests 통과 유지`
+  - 상세: commit message 에 e2e 통과 결과가 기재되어 있으나, 이번 변경된 파일(CHANGELOG.md, README.md, Makefile 주석·help 텍스트, plan/review 산출물)은 테스트 대상 소스 코드가 아니다. 이미 통과 중이던 결과를 기재한 것으로 해석되며 회귀 위험은 없다. 그러나 향후 동일 패턴에서 소스 코드 변경이 포함된다면 CI 파이프라인에서 `make e2e-test` 를 자동 실행하지 않는 경우 이 주장이 수동 확인에 의존하게 된다.
+  - 제안: CI 워크플로우(GitHub Actions 등)에 `make e2e-test` 가 포함되어 있는지 확인한다. 포함되어 있다면 현재 구조로 충분하다. 포함되어 있지 않다면 e2e pass 주장이 수동 실행 의존이므로 CI 통합이 권장된다.
+
+---
+
+### 요약
+
+이번 변경은 전적으로 문서·Makefile help 텍스트·주석·plan/review 산출물 수정으로 구성되며, 실질적인 소스 코드 변경이 없다. 따라서 신규 테스트 코드 작성의 필요성은 없고, 기존 e2e 66개 테스트가 회귀 없이 통과하는 것이 확인된 상태다. 테스트 관점에서 주목할 사항은 두 가지다. 첫째, plan 의 `TEST WORKFLOW` 항목이 미체크 상태인데 commit message 에서 e2e 통과를 이미 주장하는 불일치가 있어 plan 상태 정리가 필요하다. 둘째, `e2e-test-full` 의 exit code 전파 동작(`runner1 && runner2; STATUS=$$?`)이 주석으로만 설명되고 자동 검증 수단이 없어 향후 Makefile 수정 시 회귀 탐지가 어렵다. 두 항목 모두 즉각적인 결함이 아닌 개선 권고 수준이며, 현재 변경의 위험도는 낮다.
+
+### 위험도
+
+LOW

```

---

### 파일 237: review/consistency/2026/05/16/08_22_34/SUMMARY.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/08_22_34/SUMMARY.md b/review/consistency/2026/05/16/08_22_34/SUMMARY.md
new file mode 100644
index 00000000..f0da4f45
--- /dev/null
+++ b/review/consistency/2026/05/16/08_22_34/SUMMARY.md
@@ -0,0 +1,54 @@
+BLOCK: NO
+
+# Consistency Check 통합 보고서
+
+검토 세션: `review/consistency/2026/05/16/08_22_34`
+검토 모드: 구현 착수 전 검토 (`--impl-prep`)
+대상: `spec/4-nodes/3-ai/0-common.md`, `spec/4-nodes/4-integration/4-cafe24.md`, `spec/5-system/5-expression-language.md`, `spec/conventions/conversation-thread.md`
+
+호출자: developer (user-guide-sync-4af69c worktree)
+
+---
+
+## 결론
+
+**Critical 없음. 구현 착수 가능.** 발견된 4건의 Warning 및 13건의 Info 는 본 user-guide-sync 작업이 직접 영향을 받지 않는 spec 본문 측 항목으로, `project-planner` 후속 위임 대상.
+
+본 plan(`plan/in-progress/user-guide-sync-2026-05-16.md`)이 보강하려는 4개 MDX 변경(AI Agent contextScope 필드, integrations.mdx Cafe24 섹션, overview.mdx 카테고리 한 줄, variables-and-context.mdx `$thread` 행)은 W/I 어느 항목과도 직접 충돌하지 않는다.
+
+---
+
+## 본 작업과의 관련성
+
+| 항목 | 본 MDX 작업 충돌? | 비고 |
+|---|---|---|
+| W1 `{{ $now.iso }}` (cafe24 spec 예시) | 무관 | MDX 의 예시에서 `$now.iso` 표현식을 신규로 추가하지 않는다 — `$now` 만 사용 |
+| W2 `$schedule` 변수 누락 | 무관 | 본 작업은 `$thread` 변수만 추가, `$schedule` 는 spec 갱신 사항 |
+| W3 cafe24 install_token 회복 분기 | 무관 | cafe24 통합은 06-... 페이지 deep-link 만 추가, 회복 로직 본문 미기재 |
+| W4 cafe24 §5 섹션 번호 불연속 | 무관 | 사용자 가이드는 spec 의 섹션 번호를 그대로 노출하지 않음 |
+| I3 `contextScope` 표 중복(0-common §10 ↔ conversation-thread §5) | 정보성 | 본 MDX 는 `conversation-thread §5` 를 1차 소스로 frontmatter 의 `spec` 에 명시 |
+| I11 plan stale 위험 | 처리됨 | 본 plan 의 "후속(spec 갱신 위임)" 섹션에 cafe24 install_token spec 후속 영향 노트 |
+
+---
+
+## 후속(spec 갱신 위임)
+
+본 SUMMARY 의 W1~W4·I1~I13 중 spec 본문 수정이 필요한 항목은 `developer` 권한 밖이므로 다음과 같이 위임:
+
+- W1, W3, W4 → `spec/4-nodes/4-integration/4-cafe24.md` 본문 수정. `project-planner` 호출.
+- W2 → `spec/5-system/5-expression-language.md` §4.1 에 `$schedule` 추가. `project-planner` 호출.
+- I3, I7, I8, I9, I10 → spec 정합·구조 정리. `project-planner` 호출.
+
+이 노트는 본 plan 의 "후속(spec 갱신 위임)" 섹션에 추가로 반영.
+
+---
+
+## Checker 산출물
+
+- `cross_spec/review.md` — 5 issues, MEDIUM
+- `rationale_continuity/review.md` — 4 issues, LOW
+- `convention_compliance/review.md` — 6 issues, LOW
+- `plan_coherence/review.md` — 3 issues, LOW
+- `naming_collision/review.md` — 2 issues, NONE
+
+총 17건 (Critical 0 / Warning 4 / Info 13).

```

---

### 파일 238: review/consistency/2026/05/16/08_22_34/_prompts/convention_compliance.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 239: review/consistency/2026/05/16/08_22_34/_prompts/cross_spec.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 240: review/consistency/2026/05/16/08_22_34/_prompts/naming_collision.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 241: review/consistency/2026/05/16/08_22_34/_prompts/plan_coherence.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 242: review/consistency/2026/05/16/08_22_34/_prompts/rationale_continuity.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 243: review/consistency/2026/05/16/08_22_34/_retry_state.json
- 변경 유형: Review
- 언어: json


... (diff omitted due to prompt size limit) ...

---

### 파일 244: review/consistency/2026/05/16/08_22_34/convention_compliance/review.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 245: review/consistency/2026/05/16/08_22_34/cross_spec/review.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 246: review/consistency/2026/05/16/08_22_34/meta.json
- 변경 유형: Review
- 언어: json

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/08_22_34/meta.json b/review/consistency/2026/05/16/08_22_34/meta.json
new file mode 100644
index 00000000..de653a90
--- /dev/null
+++ b/review/consistency/2026/05/16/08_22_34/meta.json
@@ -0,0 +1,12 @@
+{
+  "timestamp": "2026-05-16T08:22:34.351061",
+  "mode": "구현 착수 전 검토 (--impl-prep, scope=spec/4-nodes/3-ai/0-common.md,spec/4-nodes/4-integration/4-cafe24.md,spec/5-system/5-expression-language.md,spec/conventions/conversation-thread.md)",
+  "target_path": "spec/4-nodes/3-ai/0-common.md,spec/4-nodes/4-integration/4-cafe24.md,spec/5-system/5-expression-language.md,spec/conventions/conversation-thread.md",
+  "checkers": [
+    "cross_spec",
+    "rationale_continuity",
+    "convention_compliance",
+    "plan_coherence",
+    "naming_collision"
+  ]
+}
\ No newline at end of file

```

---

### 파일 247: review/consistency/2026/05/16/08_22_34/naming_collision/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/08_22_34/naming_collision/review.md b/review/consistency/2026/05/16/08_22_34/naming_collision/review.md
new file mode 100644
index 00000000..4f9dc4af
--- /dev/null
+++ b/review/consistency/2026/05/16/08_22_34/naming_collision/review.md
@@ -0,0 +1,32 @@
+# 신규 식별자 충돌 검토 (naming_collision)
+
+검토 모드: `--impl-prep`
+대상 스코프: `spec/4-nodes/3-ai/0-common.md`, `spec/4-nodes/4-integration/4-cafe24.md`, `spec/5-system/5-expression-language.md`, `spec/conventions/conversation-thread.md`
+
+---
+
+## 발견사항
+
+### [INFO] `ConversationThread.id = "default"` 값과 Edge port 예약어 `"default"` 의 namespace 혼동 가능성
+- **target 신규 식별자**: `ConversationThread.id` — 고정값 `"default"` (v1 single-thread)
+- **기존 사용처**: `spec/1-data-model.md §2.7 Edge.source_port` 및 `spec/3-workflow-editor/2-edge.md` 에서 포트 예약어 `"default"` 가 출력 포트 기본값으로 사용됨
+- **상세**: `spec/conventions/conversation-thread.md §1.3` 는 이미 "port 예약어 `'default'` 와 무관 — namespace 분리. 코드에서 `DEFAULT_THREAD_ID = 'default'` 상수 추출 권장" 이라고 명시한다. 두 `"default"` 는 서로 다른 도메인(thread ID vs. port 이름)에 속하며 런타임 충돌은 없다. 단, 사용자 매뉴얼(MDX)에서 `$thread` 변수를 설명할 때 port `"default"` 와의 의미 차이를 독자가 혼동하지 않도록 문맥을 분리하는 것이 바람직하다.
+- **제안**: MDX docs 에 `$thread` 소개 시 "thread ID `default`" 라는 내부 구현 상세는 노출하지 않고 변수 접근 방법(`.turns` / `.length` / `.text`)만 설명하면 충분. spec 레벨의 명세는 이미 정합되어 있으므로 spec 변경 불필요.
+
+---
+
+### [INFO] `application.ts` Cafe24 메타데이터 파일명과 Cafe24 OAuth `app_type` 개념의 혼동 가능성
+- **target 신규 식별자**: `backend/src/nodes/integration/cafe24/metadata/application.ts` — Cafe24 "앱 관리 API" 카테고리의 Operation 메타데이터 파일
+- **기존 사용처**: `spec/1-data-model.md §2.10 Integration.credentials` 의 `app_type` (public / private), `spec/2-navigation/4-integration.md §5.8` 의 Cafe24 Private App 등록 흐름에서 "application" / "앱" 용어가 반복 사용됨
+- **상세**: `spec/conventions/cafe24-api-metadata.md §1` 이 이미 "⚠ Cafe24 앱 관리 API — OAuth 앱 등록(credentials.app_type)과 무관. naming collision 주의" 라고 명시해 선제적으로 경고하고 있다. 런타임 충돌은 없으며 spec 차원에서도 이미 인지·문서화된 상태이다.
+- **제안**: 기존 spec 주의 표기로 충분. 개발자가 `application.ts` 파일명이 OAuth app 등록과 무관함을 코드 주석으로도 명시하면 혼동이 줄어든다. spec 수정 불필요.
+
+---
+
+## 요약
+
+이번 구현 착수 전 검토(`--impl-prep`) 의 대상은 기존 spec 파일 4종을 1차 소스로 삼아 MDX 사용자 매뉴얼을 보강하는 작업이다. target 문서 자체에 신규 식별자 내용이 없으며(`(없음)` 표기), 보강에 사용될 식별자(`contextScope` / `contextScopeN` / `contextInjectionMode` / `includeToolTurns` / `excludeFromConversationThread` / `$thread` 변수 및 하위 속성 / `ConversationTurnSource` · `ConversationTurn` · `ConversationThread` 타입 / Cafe24 노드)는 모두 spec 에서 일관되게 정의되어 있고 기존 사용처와 의미 충돌이 없다. `ConversationThread.id = "default"` 와 Edge port 예약어 `"default"`, `application.ts` 와 OAuth app 개념의 잠재 혼동은 spec 자체에서 이미 명시적으로 경고·분리되어 있다. 구현을 차단할 CRITICAL·WARNING 수준의 식별자 충돌은 발견되지 않았다.
+
+## 위험도
+
+NONE

```

---

### 파일 248: review/consistency/2026/05/16/08_22_34/plan_coherence/review.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 249: review/consistency/2026/05/16/08_22_34/rationale_continuity/review.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 250: review/consistency/2026/05/16/09_03_04/SUMMARY.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 251: review/consistency/2026/05/16/09_03_04/_prompts/convention_compliance.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 252: review/consistency/2026/05/16/09_03_04/_prompts/cross_spec.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 253: review/consistency/2026/05/16/09_03_04/_prompts/naming_collision.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 254: review/consistency/2026/05/16/09_03_04/_prompts/plan_coherence.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 255: review/consistency/2026/05/16/09_03_04/_prompts/rationale_continuity.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 256: review/consistency/2026/05/16/09_03_04/_retry_state.json
- 변경 유형: Review
- 언어: json


... (diff omitted due to prompt size limit) ...

---

### 파일 257: review/consistency/2026/05/16/09_03_04/convention_compliance/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/09_03_04/convention_compliance/review.md b/review/consistency/2026/05/16/09_03_04/convention_compliance/review.md
new file mode 100644
index 00000000..96dc21d3
--- /dev/null
+++ b/review/consistency/2026/05/16/09_03_04/convention_compliance/review.md
@@ -0,0 +1,60 @@
+# Convention Compliance Review
+
+**대상 문서**: `spec/4-nodes/4-integration/4-cafe24.md`
+**검토 모드**: 구현 착수 전 (--impl-prep)
+**작업 범위**: `Cafe24Config` UI 버그 수정 (fields "추가" 버튼 동작 안 함)
+
+---
+
+## 발견사항
+
+### 1. [INFO] §9.4 Rationale 의 9.7·9.8 절 순서 역전
+
+- target 위치: 문서 §9 Rationale 의 절 순서 (라인 404~451)
+- 위반 규약: CLAUDE.md 문서 구조 권장 — 본문 끝의 `## Rationale` 순서 정합성
+- 상세: `9.7 OAuth scope wire format` 절(라인 441~451)이 `9.8 Private 앱 App URL HMAC 검증` 절(라인 406~438) 뒤에 텍스트상 위치하지만 번호는 9.7 < 9.8 이다. 실제 파일에서는 9.8 절 내용 본문(라인 406~438) 이 먼저 나오고, 그 뒤에 9.7 절 텍스트(라인 441~451) 가 이어진다. 즉, 절 번호와 파일 내 순서가 불일치한다.
+- 제안: 9.7 과 9.8 절을 파일 내 순서와 번호가 일치하도록 재배열하거나, CHANGELOG(§10) 직전 순서로 정리한다.
+
+### 2. [INFO] Principle 11 Case 번호 불연속 (5.1 / 5.3 / 5.8)
+
+- target 위치: §5 출력 구조 (Case 번호: 5.1, 5.3, 5.8)
+- 위반 규약: `spec/conventions/node-output.md` Principle 11 — "Case별로 분리 (성공 / 에러 / 재개 등)"
+- 상세: Principle 11 의 포맷 규칙은 `### Case: <케이스 이름>` 형식을 요구한다. 본 문서는 Case 를 `5.1`, `5.3`, `5.8` 로 번호 붙여 관리하는데, 5.2 / 5.4~5.7 이 없어 독자가 누락을 의심하게 만든다. 실제 누락은 아니고 의도적 skip 이지만 규약이 권장하는 연속 Case 서술 패턴과 거리감이 있다.
+- 제안: 연속 번호를 쓰거나 (`5.1`, `5.2`, `5.3`), 또는 번호 없이 `### Case: 2xx 성공`, `### Case: API 에러 또는 Transport 실패`, `### Case: Pre-flight throw` 형식으로 서술한다.
+
+---
+
+## 이번 작업과의 직접 관련성 검토
+
+이번 구현 작업(Cafe24Config fields "추가" 버튼 버그 수정)은 다음 범위에만 영향을 미친다:
+
+- `frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx` — `Cafe24Config` 컴포넌트에 React state 추가
+- 신규 unit test 1건
+
+아래 항목들이 **변경 없음**을 확인하였다:
+
+| 항목 | 확인 결과 |
+|------|-----------|
+| `spec/4-nodes/4-integration/4-cafe24.md` §1 `config.fields` 타입 (`Record<string,unknown>`) | 보존 — 백엔드 계약 변경 없음 |
+| `spec/conventions/cafe24-api-metadata.md` §2 `fields` 형식 | 보존 — 메타데이터 테이블 변경 없음 |
+| `spec/conventions/node-output.md` Principle 0~11 출력 포맷 | 보존 — 출력 구조 변경 없음 |
+| 옛 `prd/` / `memory/` 경로 답습 여부 | 없음 |
+
+---
+
+## Target 문서 전체 규약 준수 요약
+
+`spec/4-nodes/4-integration/4-cafe24.md` 는 정식 규약과 전반적으로 잘 정합한다:
+
+- **명명 규약**: 파일명 `4-cafe24.md` — 숫자 prefix + 평문명 패턴 준수. Integration 영역의 `0-common.md` 참조 구조도 정상.
+- **문서 구조**: Overview(§ 없는 서두) / 본문(§1~§8) / Rationale(§9) / CHANGELOG(§10) 의 3섹션 + CHANGELOG 구성으로 CLAUDE.md 권장 구조 준수.
+- **출력 포맷 규약**: Principle 0(5필드), Principle 3.2(`output.error` envelope), Principle 7(`config` echo), Principle 8.2(`output.response` HTTP 관용 네이밍), Principle 11(JSON 예시 + 표) 모두 명시적으로 준수하고 있음.
+- **API 문서 규약**: Swagger/DTO 패턴 직접 정의 없으나 Source of Truth 를 `backend/src/nodes/integration/cafe24/cafe24.schema.ts` 로 명시해 DTO 명명 책임을 코드로 위임함.
+- **금지 항목**: 옛 `prd/`, `memory/`, `user_memo/` 경로 참조 없음. `spec/conventions/` 의 카페24 메타데이터 컨벤션을 올바르게 참조.
+- **이번 작업 직접 영향**: 발견된 2건은 모두 INFO 등급으로, 이번 구현 작업(프론트엔드 UI 버그 수정)의 착수를 차단할 규약 위반 없음.
+
+---
+
+## 위험도
+
+NONE

```

---

### 파일 258: review/consistency/2026/05/16/09_03_04/cross_spec/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/09_03_04/cross_spec/review.md b/review/consistency/2026/05/16/09_03_04/cross_spec/review.md
new file mode 100644
index 00000000..bb30010e
--- /dev/null
+++ b/review/consistency/2026/05/16/09_03_04/cross_spec/review.md
@@ -0,0 +1,41 @@
+# Cross-Spec 일관성 검토 결과
+
+검토 대상: `spec/4-nodes/4-integration/4-cafe24.md` (구현 착수 전 --impl-prep)
+작업 요약: `Cafe24Config` fields "추가" 버튼 버그 수정 — frontend React state 분리, 백엔드 계약 무변경
+
+---
+
+### 발견사항
+
+특이사항 없음 — 아래 6개 점검 관점 전항 이상 없음.
+
+- **[INFO]** `config.fields` 의 UI 내부 표현과 백엔드 계약 형태의 분리 패턴 — 명시적 문서화 권장
+  - target 위치: `Cafe24Config.onChange` 콜백 (현재 `integration-configs.tsx` lines ~332-342)
+  - 충돌 대상: `spec/4-nodes/4-integration/4-cafe24.md §1` (`fields: Record<string, unknown>`) · `spec/conventions/cafe24-api-metadata.md §2`
+  - 상세: 수정 방향은 `Cafe24Config` 내부에 `Array<{key,value}>` 형태의 React state 를 도입하여 빈 key 행을 UI 에 유지하고, key 가 채워질 때만 `Record<string,unknown>` 으로 변환해 `config.fields` 에 flush 한다. 이는 spec 이 규정한 백엔드 계약(`fields: Record<string,unknown>`) 을 그대로 준수하는 구현 선택이다. 다만 현재 spec §2 설정 UI 설명에는 이 "UI 내부 목록 표현 ↔ 백엔드 object 형태 간 변환" 패턴이 명시되지 않아, 향후 동일 컴포넌트를 유지보수하는 개발자가 UI 형태와 저장 형태의 차이를 spec 에서 확인할 수 없다.
+  - 제안: 구현 완료 후 `spec/4-nodes/4-integration/4-cafe24.md §2` 에 한 줄 주석("fields 편집 UI 는 내부적으로 key-value 배열을 관리하며, `onChange` 시 빈 key 항목을 제거한 뒤 `Record<string,unknown>` 으로 변환해 저장한다") 추가를 권장. 구현 차단 대상이 아님.
+
+---
+
+### 점검 관점별 결과
+
+| 관점 | 결과 | 비고 |
+|------|------|------|
+| 1. 데이터 모델 충돌 | 이상 없음 | `config.fields: Record<string,unknown>` shape 변경 없음. `spec/1-data-model.md §2.6 Node.config: JSONB` 와 일치 유지 |
+| 2. API 계약 충돌 | 이상 없음 | 백엔드 schema(`cafe24.schema.ts`) 가 `fields` 를 `Record<string,unknown>` 으로 수신하는 계약 유지. 프론트엔드 내부 상태 분리는 API 경계에 영향 없음 |
+| 3. 요구사항 ID 충돌 | 해당 없음 | 본 작업은 요구사항 ID 를 신규 정의·변경하지 않음 |
+| 4. 상태 전이 충돌 | 해당 없음 | 노드 실행 흐름·Integration 상태 머신 변경 없음 |
+| 5. 권한·RBAC 모델 충돌 | 해당 없음 | 권한 구조 변경 없음 |
+| 6. 계층 책임 충돌 | 이상 없음 | 변경이 frontend 설정 패널 내부(React state)에 국한. 백엔드 executor 계약(`spec/4-nodes/4-integration/4-cafe24.md §4` · `spec/4-nodes/4-integration/0-common.md §4`) 은 `config.fields` 의 object shape 을 그대로 받으며, 이 계약은 변경되지 않음. frontend/backend 경계 준수 |
+
+---
+
+### 요약
+
+본 작업은 `Cafe24Config` 컴포넌트 내부에서 `KeyValueEditor` 가 추가한 빈 key 행이 `onChange` 의 object 변환 시 즉시 소실되는 버그를 로컬 React state 도입으로 수정한다. 변경은 frontend 렌더 로직에만 한정되며, `config.fields` 의 백엔드 계약(`Record<string,unknown>`)·데이터 모델(`Node.config: JSONB`)·API 계약·Integration 상태 전이·RBAC 모델 중 어느 것도 변경하지 않는다. spec 과의 직접 모순은 발견되지 않았고, `spec/4-nodes/4-integration/4-cafe24.md §2` 에 UI 내부 표현 변환 패턴을 한 줄 보완하면 미래 유지보수 명료성이 높아지나 구현을 차단할 이유는 없다.
+
+---
+
+### 위험도
+
+NONE

```

---

### 파일 259: review/consistency/2026/05/16/09_03_04/meta.json
- 변경 유형: Review
- 언어: json

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/09_03_04/meta.json b/review/consistency/2026/05/16/09_03_04/meta.json
new file mode 100644
index 00000000..83fad5cf
--- /dev/null
+++ b/review/consistency/2026/05/16/09_03_04/meta.json
@@ -0,0 +1,12 @@
+{
+  "timestamp": "2026-05-16T09:03:04.490363",
+  "mode": "구현 착수 전 검토 (--impl-prep, scope=spec/4-nodes/4-integration/4-cafe24.md\n\n작업 요약: cafe24 노드 설정 UI(`frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx` 의 `Cafe24Config`) 에서 fields 항목의 \"추가\" 버튼이 동작하지 않는 버그 수정.\n\n원인: `KeyValueEditor` 가 빈 행 `{key:\"\", value:\"\"}` 추가 → `onChange` 콜백이 빈 key 를 가진 행을 object 변환 시 즉시 제거 → 다음 렌더에서 새 행이 사라짐.\n\n수정 방향: `Cafe24Config` 내부에 keyvalue 편집용 React state 를 도입해 빈 key 행이 UI 에 유지되도록 함. 사용자가 key 를 입력하면 그 시점에 object 형태(`Record<string,unknown>`) 로 `config.fields` 에 반영. 백엔드 계약(spec/4-nodes/4-integration/4-cafe24.md §1, conventions/cafe24-api-metadata.md) 의 object shape 은 그대로 보존.\n\n영향 영역: frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx + 신규 unit test 1건. 백엔드/스펙/데이터모델 변경 없음.)",
+  "target_path": "spec/4-nodes/4-integration/4-cafe24.md\n\n작업 요약: cafe24 노드 설정 UI(`frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx` 의 `Cafe24Config`) 에서 fields 항목의 \"추가\" 버튼이 동작하지 않는 버그 수정.\n\n원인: `KeyValueEditor` 가 빈 행 `{key:\"\", value:\"\"}` 추가 → `onChange` 콜백이 빈 key 를 가진 행을 object 변환 시 즉시 제거 → 다음 렌더에서 새 행이 사라짐.\n\n수정 방향: `Cafe24Config` 내부에 keyvalue 편집용 React state 를 도입해 빈 key 행이 UI 에 유지되도록 함. 사용자가 key 를 입력하면 그 시점에 object 형태(`Record<string,unknown>`) 로 `config.fields` 에 반영. 백엔드 계약(spec/4-nodes/4-integration/4-cafe24.md §1, conventions/cafe24-api-metadata.md) 의 object shape 은 그대로 보존.\n\n영향 영역: frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx + 신규 unit test 1건. 백엔드/스펙/데이터모델 변경 없음.",
+  "checkers": [
+    "cross_spec",
+    "rationale_continuity",
+    "convention_compliance",
+    "plan_coherence",
+    "naming_collision"
+  ]
+}
\ No newline at end of file

```

---

### 파일 260: review/consistency/2026/05/16/09_03_04/naming_collision/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/09_03_04/naming_collision/review.md b/review/consistency/2026/05/16/09_03_04/naming_collision/review.md
new file mode 100644
index 00000000..39eaa420
--- /dev/null
+++ b/review/consistency/2026/05/16/09_03_04/naming_collision/review.md
@@ -0,0 +1,34 @@
+# 신규 식별자 충돌 검토 결과
+
+검토 대상: `spec/4-nodes/4-integration/4-cafe24.md` (구현 착수 전 --impl-prep)
+작업: `Cafe24Config` fields "추가" 버튼 버그 수정 — `KeyValueEditor` 빈 key 행 유지를 위한 내부 React state 도입
+
+---
+
+## 발견사항
+
+### [INFO] `fields` 지역 변수와 신규 draft state 명칭 주의
+
+- **target 신규 식별자**: 구현 시 `Cafe24Config` 내부에 도입될 keyvalue draft용 React state 변수 (구체적 이름은 아직 미정 — 예: `localRows`, `kvRows`, `draftRows` 등)
+- **기존 사용처**: `integration-configs.tsx:297` — `const fields = normalizeCafe24Fields(config.fields)` 로 이미 `fields` 라는 지역 변수가 선언됨. `config.fields` 는 백엔드 계약 키명(`Record<string,unknown>`)으로 spec과 DB schema에서 고정.
+- **상세**: 신규 React state를 `fields` 또는 `setFields` 로 명명하면 기존 지역 변수 `const fields`와 동일 스코프에서 선언 충돌이 발생한다. TypeScript/ESLint 는 same-scope 재선언을 컴파일 에러로 거부하므로 실수로 같은 이름을 쓰면 즉시 빌드 실패가 난다. 다만 스펙 레벨의 식별자 충돌은 아니며 런타임 혼선 위험도 없다.
+- **제안**: draft state는 `localRows` 또는 `fieldRows`처럼 기존 `fields` 변수와 명확히 구분되는 이름을 채택한다. `useState<{ key: string; value: string }[]>` 형태로 초기화하고, `useEffect` 또는 controlled pattern으로 `config.fields` 와 동기화. 기존 `const fields` 선언은 draft state로 교체하거나 제거해 스코프 내 의미 중복을 없앤다.
+
+---
+
+### [INFO] `normalizeCafe24Fields` 함수 — 신규 state 도입 후 역할 재검토
+
+- **target 신규 식별자**: 신규 React state 도입 시 `normalizeCafe24Fields` 의 호출 위치·시점이 변경됨
+- **기존 사용처**: `integration-configs.tsx:270-293` — `normalizeCafe24Fields(config.fields)` 를 매 렌더마다 호출하여 `fields` 배열을 파생함
+- **상세**: draft state 패턴을 도입하면 `normalizeCafe24Fields` 는 초기화(mount 시) 또는 외부 props 변경 시에만 호출하게 된다. 함수 이름 자체의 충돌은 없으나, 동일 이름 함수가 다른 역할(전체 렌더 파생 vs 초기화 전용)로 쓰이면 읽는 사람에게 혼동을 줄 수 있다.
+- **제안**: 함수 이름은 그대로 유지하되, 사용 시점을 `useState` 초기값(`useState(() => normalizeCafe24Fields(config.fields))`) 또는 `useEffect` 내에서 명시적으로 제한해 역할을 명확히 한다.
+
+---
+
+## 종합 평가
+
+이번 구현은 프론트엔드 컴포넌트 내부의 React state 패턴 변경으로, 스펙 레벨 식별자(요구사항 ID, 엔티티/타입명, API endpoint, 이벤트명, 환경변수, 파일 경로)의 신규 도입이 전혀 없다. 백엔드 계약(`config.fields: Record<string,unknown>`)과 spec(`spec/4-nodes/4-integration/4-cafe24.md`, `spec/conventions/cafe24-api-metadata.md`)은 그대로 보존된다. 유일한 주의 사항은 `Cafe24Config` 내부 스코프에서 기존 `const fields` 지역 변수와 신규 draft state 이름이 충돌하지 않도록 하는 것으로, 이는 TypeScript 컴파일러가 즉시 잡아주므로 실질 리스크는 낮다. 명확한 이름(예: `localRows`)을 처음부터 선택하면 혼동 없이 구현 가능하다.
+
+## 위험도
+
+NONE

```

---

### 파일 261: review/consistency/2026/05/16/09_03_04/plan_coherence/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/09_03_04/plan_coherence/review.md b/review/consistency/2026/05/16/09_03_04/plan_coherence/review.md
new file mode 100644
index 00000000..d14a77fe
--- /dev/null
+++ b/review/consistency/2026/05/16/09_03_04/plan_coherence/review.md
@@ -0,0 +1,27 @@
+# Plan 정합성 검토 결과
+
+검토 대상: `cafe24-fields-add-btn-d3f8a2` worktree — `Cafe24Config` fields "추가" 버튼 버그 수정  
+검토 모드: `--impl-prep` (구현 착수 전)  
+검토 일시: 2026-05-16
+
+---
+
+### 발견사항
+
+발견된 CRITICAL / WARNING 사항 없음.
+
+- **[INFO]** 동일 도메인 병렬 worktree 존재 (Cafe24)
+  - target 위치: 작업 요약 — 영향 영역 `frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx`
+  - 관련 plan: `plan/in-progress/cafe24-app-url-3rdparty-shorten.md` (worktree: `cafe24-3rdparty-url-503aa0`)
+  - 상세: 두 worktree가 모두 Cafe24 기능을 다루지만 수정 파일이 겹치지 않는다. `cafe24-3rdparty-url-503aa0`은 URL routing / namespace / 토큰 단축 레이어(백엔드 + API 경로)를 다루고, 본 worktree는 설정 패널 UI 컴포넌트(`integration-configs.tsx`) 한 파일만 수정한다. 현재 알려진 정보 범위에서 파일 수준 경합은 없다.
+  - 제안: 추적 메모 수준으로 충분. `cafe24-3rdparty-url-503aa0`이 `integration-configs.tsx`를 수정할 가능성이 생기면 그 시점에 직렬화 필요.
+
+---
+
+### 요약
+
+진행 중인 plan 문서(`0-unimplemented-overview.md`, `ai-review-subagent.md`, `brand-refresh-impl.md`, `cafe24-app-url-3rdparty-shorten.md`, `2fa-webauthn.md`, `ai-agent-tool-connection-rewrite.md`)를 전수 검토한 결과, 본 target 작업과 미해결 결정 충돌, 동일 파일 경합, 선행 조건 미해소, 후속 항목 무효화 중 어느 항목도 해당하지 않는다. target은 `spec/4-nodes/4-integration/4-cafe24.md`와 `spec/conventions/cafe24-api-metadata.md`가 정의한 `config.fields` object shape을 변경하지 않으며, 변경 범위가 단일 frontend 컴포넌트 + unit test 1건으로 제한되어 worktree 간 경합 위험이 없다. 구현 착수를 차단할 사유가 없다.
+
+### 위험도
+
+NONE

```

---

### 파일 262: review/consistency/2026/05/16/09_03_04/rationale_continuity/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/09_03_04/rationale_continuity/review.md b/review/consistency/2026/05/16/09_03_04/rationale_continuity/review.md
new file mode 100644
index 00000000..589da63b
--- /dev/null
+++ b/review/consistency/2026/05/16/09_03_04/rationale_continuity/review.md
@@ -0,0 +1,39 @@
+# Rationale 연속성 검토 결과
+
+검토 대상: `spec/4-nodes/4-integration/4-cafe24.md`
+검토 범위: `--impl-prep` — Cafe24 `fields` 추가 버튼 버그 수정 구현 착수 전 검토
+수정 방향 요약: `Cafe24Config` 컴포넌트에 keyvalue 편집용 React state 도입 → 빈 key 행이 UI에 유지되도록 함. 사용자가 key를 채운 시점에 `Record<string,unknown>` 형태로 `config.fields`에 반영. 백엔드 계약의 object shape은 그대로 보존.
+
+---
+
+### 발견사항
+
+이하 4개 점검 관점 모두 적용한 결과, 명시적 CRITICAL·WARNING 항목은 발견되지 않았다. INFO 1건을 기록한다.
+
+- **[INFO]** UI state 분리 패턴이 Rationale 어느 항목에도 명시되지 않음
+  - target 위치: `frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx` `Cafe24Config` 컴포넌트 (spec §2 설정 UI 구현부)
+  - 과거 결정 출처: `spec/4-nodes/4-integration/4-cafe24.md §9.5` (Principle 7 — config는 rawConfig echo) 및 `§1` (fields 타입 `Record<string, unknown>`)
+  - 상세: Principle 7은 백엔드 handler가 `context.rawConfig`를 config echo로 사용하는 **backend 측 계약**이다. 수정 방향은 프론트엔드 편집 중간 상태(빈 key 행)를 React state에 격리하고, key가 채워진 시점에만 `Record<string,unknown>`으로 `config.fields`를 갱신하는 패턴이다. 이는 Principle 7을 위반하지 않는다 — 백엔드에는 항상 key가 있는 행만 전달되기 때문이다. 다만 이 "UI 편집 버퍼"와 "저장 계약 state"를 분리하는 패턴은 spec §2 설정 UI 섹션이나 §9 Rationale 어디에도 명시된 적이 없다. 이번 수정이 처음으로 이 패턴을 도입하는 구현 사례가 된다.
+  - 제안: spec §9 Rationale 또는 §2 설정 UI 섹션에 "편집 버퍼와 config 저장 상태의 분리" 원칙을 짧게 기록해두면, 동일 컴포넌트를 이후 수정하는 구현자가 패턴 의도를 오해할 가능성을 줄일 수 있다. 필수 수정 사항은 아니다.
+
+---
+
+### 점검 결과 (4개 관점)
+
+1. **기각된 대안의 재도입**: 해당 없음. spec §9.1은 endpoint-당 노드(A)·범용 HTTP 노드(B)를 기각하고 단일 노드+메타데이터(C)를 채택했다. 수정 방향은 이 결정과 무관한 UI 버그 수정이다.
+
+2. **합의된 원칙 위반**: 해당 없음. spec §1의 `fields: Record<string, unknown>` 타입 계약과 §9.5의 Principle 7(config echo) 모두 이번 수정 후에도 유지된다. UI 내부 편집 버퍼는 백엔드에 노출되지 않으며 key가 채워진 행만 object로 변환되어 전달된다.
+
+3. **결정의 무근거 번복**: 해당 없음. 수정 방향은 기존 결정을 번복하지 않는다. spec 변경도 없다.
+
+4. **암묵적 가정 충돌**: 해당 없음. spec §9.3(메타데이터 위치)·§9.4(Private/Public 앱)·§9.8(HMAC 검증) 등 모든 시스템 invariant는 프론트엔드 UI state 레이어와 무관하다.
+
+---
+
+### 요약
+
+이번 구현은 `Cafe24Config` 내부 React state에서 빈 key 행을 일시적으로 보유하고, key가 채워진 시점에만 `config.fields`(`Record<string,unknown>`)로 반영하는 UI 버그 수정이다. spec §4-cafe24.md의 모든 Rationale 항목 — 단일 노드+메타데이터 원칙(§9.1), config echo 계약(§9.5 Principle 7), object shape 타입(§1), HMAC 보안 invariant(§9.8) — 과 충돌하지 않는다. 기각된 대안의 재도입이나 합의된 원칙의 위반은 발견되지 않았다. 유일한 발견은 INFO 1건으로, UI 편집 버퍼 분리 패턴이 Rationale에 미기록 상태라는 보완 제안이다.
+
+### 위험도
+
+NONE

```

---

### 파일 263: review/consistency/2026/05/16/09_13_51/SUMMARY.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/09_13_51/SUMMARY.md b/review/consistency/2026/05/16/09_13_51/SUMMARY.md
new file mode 100644
index 00000000..d9db21cf
--- /dev/null
+++ b/review/consistency/2026/05/16/09_13_51/SUMMARY.md
@@ -0,0 +1,30 @@
+BLOCK: NO
+
+# Consistency Check 통합 보고서
+
+세션: `review/consistency/2026/05/16/09_13_51`
+모드: `--impl-prep`
+대상: `Makefile`, `docker-compose.e2e.yml`
+호출자: developer (bg-monitoring-e2e-fix-f789b9 worktree)
+
+## 결론
+
+Critical 0건. 구현 착수 가능. plan_coherence checker 의 정당한 지적(체크박스 사전 `[x]` 표기) 은 plan 문서를 `[ ]` 로 되돌려 즉시 해소함.
+
+## Checker 별
+
+| Checker | issues | 위험도 |
+|---|---|---|
+| cross_spec | 0 | NONE |
+| rationale_continuity | 4 | LOW (자동/수동 빌드 관련 정합성 노트) |
+| convention_compliance | 1 | LOW (스타일 변경 1건) |
+| plan_coherence | 3 | LOW (체크박스 사전 표기 — 즉시 해소) |
+| naming_collision | 0 | NONE |
+
+## 즉시 조치 완료
+
+- **plan_coherence W1**: plan 의 작업 체크박스 `[x]` → `[ ]` 로 되돌림. 구현·테스트·리뷰 단계 종료 시점에 순서대로 갱신.
+
+## 진행
+
+`Makefile` 의 `e2e-up`, `e2e-test`, `e2e-test-full` 에 `--build` 플래그 추가 구현 진입.

```

---

### 파일 264: review/consistency/2026/05/16/09_13_51/_prompts/convention_compliance.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 265: review/consistency/2026/05/16/09_13_51/_prompts/cross_spec.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 266: review/consistency/2026/05/16/09_13_51/_prompts/naming_collision.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 267: review/consistency/2026/05/16/09_13_51/_prompts/plan_coherence.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 268: review/consistency/2026/05/16/09_13_51/_prompts/rationale_continuity.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 269: review/consistency/2026/05/16/09_13_51/_retry_state.json
- 변경 유형: Review
- 언어: json


... (diff omitted due to prompt size limit) ...

---

### 파일 270: review/consistency/2026/05/16/09_13_51/convention_compliance/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/09_13_51/convention_compliance/review.md b/review/consistency/2026/05/16/09_13_51/convention_compliance/review.md
new file mode 100644
index 00000000..3c6afb5a
--- /dev/null
+++ b/review/consistency/2026/05/16/09_13_51/convention_compliance/review.md
@@ -0,0 +1,52 @@
+# 정식 규약 준수 검토 결과
+
+검토 대상: `Makefile`, `docker-compose.e2e.yml`
+검토 모드: 구현 착수 전 (--impl-prep)
+검토 일시: 2026-05-16
+
+---
+
+### 발견사항
+
+규약 위반 또는 우려 사항이 없습니다.
+
+`Makefile`과 `docker-compose.e2e.yml`은 인프라 자동화 파일이며, 다음 관점에서 검토하였습니다.
+
+**1. 명명 규약**
+- `docker-compose.e2e.yml` 파일명은 CLAUDE.md에서 e2e 격리 인프라 기준 파일로 직접 언급(`make e2e-test`, `docker-compose.e2e.yml` 기반)되어 있으며, 파일명이 일치한다.
+- `name: clemvion-e2e` — Compose project name이 dev 환경(`clemvion`)과 명확히 분리되어 있어 CLAUDE.md의 격리 원칙을 준수한다.
+- 서비스 이름(`postgres`, `redis`, `minio`, `migrate`, `backend-e2e`, `backend-e2e-runner`, `playwright-runner`)은 용도를 반영한 명확한 kebab-case로 작성되어 있다. 규약에 서비스 이름 패턴을 별도로 정의하지 않으나, 기존 프로젝트 관습과 일치한다.
+- Makefile target 이름(`e2e-up`, `e2e-down`, `e2e-test`, `e2e-test-full`)은 CLAUDE.md의 `make e2e-test` 호출 예시와 정확히 일치한다.
+
+**2. 출력 포맷 규약**
+- 본 파일들은 노드 Output, API 응답, error code 등의 출력 포맷 규약(`spec/conventions/node-output.md`) 적용 대상이 아니다. 인프라 설정 파일이므로 해당 규약과 교차하는 지점이 없다.
+
+**3. 문서 구조 규약**
+- `Makefile`, `docker-compose.e2e.yml`은 spec 문서가 아니므로 Overview/본문/Rationale 3섹션 구성 요건이 적용되지 않는다.
+- 두 파일 모두 상단 주석으로 목적과 사용법을 간결하게 기술하고 있어 가독성 측면에서 무리가 없다.
+
+**4. API 문서 규약**
+- Swagger 패턴·DTO 명명 규약(`spec/conventions/swagger.md`) 적용 대상 파일이 아니다.
+
+**5. 금지 항목**
+- `prd/`, `memory/`, `user_memo/` 경로를 참조하거나 생성하는 패턴이 없다.
+- `subprocess.run(["claude", "-p", ...])` 또는 Anthropic SDK 직접 호출 패턴이 없다.
+- `e2e-test-full` target의 runner 연결 방식(`&&` + `; STATUS=$$?`)이 일관성 없이 혼용되어 있으나, 이는 정식 규약의 명시적 금지 항목이 아닌 구현 품질 사항이다 (하단 INFO 항목 참조).
+
+---
+
+- **[INFO]** `e2e-test-full` target의 runner 연결 연산자 혼용
+  - target 위치: `Makefile` 31-35행, `e2e-test-full` target
+  - 위반 규약: 해당 없음 (정식 규약 금지 항목 아님)
+  - 상세: `e2e-test`는 `backend-e2e-runner`를 `;`로 연결하고 `STATUS=$$?`로 종료 코드를 포착하는 패턴을 사용한다. 반면 `e2e-test-full`은 `backend-e2e-runner && playwright-runner` 로 `&&`를 사용하여 backend runner 실패 시 playwright runner를 건너뛰지만, 이어서 `; STATUS=$$?`로 playwright runner의 종료 코드만 포착한다. backend runner가 실패했을 때 exit code가 playwright-runner의 결과(미실행 시 0이 아닌 값 또는 255)에 의존하게 되어 의도한 실패 전파가 불명확하다. Makefile 상단 주석에서 "분리" 이유를 설명했으나 `e2e-test-full`의 경우 그 설명이 누락되어 있다.
+  - 제안: `e2e-test`와 동일하게 `;`로 분리하고 `STATUS=$$?`로 각각 포착하거나, 주석으로 의도를 명시한다. 정식 규약 항목은 아니므로 규약 갱신이 아닌 코드 수정이 적절하다.
+
+---
+
+### 요약
+
+`Makefile`과 `docker-compose.e2e.yml` 두 파일은 `spec/conventions/` 내 정식 규약(node-output, swagger, migrations, cafe24-api-metadata, conversation-thread)의 직접 적용 대상이 아닌 인프라 자동화 파일이다. CLAUDE.md에서 명시한 `make e2e-test` / `docker-compose.e2e.yml` 기반 e2e 격리 운영 방침과 정확히 부합하며, 금지된 경로·패턴을 사용하지 않는다. 발견된 유일한 사항은 `e2e-test-full` target의 종료 코드 포착 패턴 불일치로, 이는 구현 품질 차원의 INFO이며 규약 위반이 아니다.
+
+### 위험도
+
+NONE

```

---

### 파일 271: review/consistency/2026/05/16/09_13_51/cross_spec/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/09_13_51/cross_spec/review.md b/review/consistency/2026/05/16/09_13_51/cross_spec/review.md
new file mode 100644
index 00000000..fafc96b9
--- /dev/null
+++ b/review/consistency/2026/05/16/09_13_51/cross_spec/review.md
@@ -0,0 +1,65 @@
+# Cross-Spec 일관성 검토 — `Makefile, docker-compose.e2e.yml`
+
+검토 모드: `--impl-prep` (구현 착수 전 검토)
+대상 범위: `Makefile` e2e 타겟에 `--build` 플래그 추가
+
+---
+
+## 발견사항
+
+이번 변경은 `Makefile` 의 `e2e-up` / `e2e-test` / `e2e-test-full` 타겟에 `--build` 플래그를 추가하는 순수 빌드 툴링 버그픽스다. 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC 규칙 중 어느 것도 수정하지 않는다. 아래 점검 결과를 기술한다.
+
+### 데이터 모델 충돌
+
+발견 없음. `Makefile` / `docker-compose.e2e.yml` 은 엔티티 정의를 보유하지 않는다.
+
+### API 계약 충돌
+
+발견 없음. 빌드 플래그 변경은 e2e 실행 방식에만 영향을 미치며, HTTP endpoint / request-response shape 과 무관하다.
+
+### 요구사항 ID 충돌
+
+발견 없음. 이 변경에 요구사항 ID 가 사용되지 않는다.
+
+### 상태 전이 충돌
+
+발견 없음. `docker-compose.e2e.yml` 의 서비스 의존 체인(`depends_on: condition: service_healthy / service_completed_successfully`)은 변경되지 않으며, `backend-e2e` 의 상태 전이(`healthy` 로 인정되어야 runner 기동)도 그대로다.
+
+### 권한·RBAC 모델 충돌
+
+발견 없음. 빌드 플래그는 RBAC 구조와 무관하다.
+
+### 계층 책임 충돌
+
+발견 없음. `docker-compose.e2e.yml` 은 이미 `backend-e2e` 와 `backend-e2e-runner` 모두에 `build:` 섹션을 보유하고 있다. `--build` 플래그 추가는 기존 Compose 설계(빌드 가능 서비스)와 완전히 일치한다.
+
+---
+
+### 참조 spec 와의 정합 확인
+
+| 참조 위치 | 내용 | 정합 여부 |
+|----------|------|----------|
+| `spec/conventions/migrations.md:57` | `make e2e-test` 로 마이그레이션 dry-run 수행 | 명령 이름 변경 없음 — 정합 |
+| `.claude/skills/developer/SKILL.md` §TEST WORKFLOW | `make e2e-test` / `make e2e-test-full` / `make e2e-down` 명령 | 명령 이름 변경 없음 — 정합 |
+| `.claude/skills/developer/SKILL.md:66` | "e2e 는 `docker-compose.e2e.yml` 에서 backend 이미지를 빌드해 실행" | `--build` 는 이 설명이 항상 성립하도록 보장하는 수정 — 정합 강화 |
+| `spec/0-overview.md §2.6` | "셀프 호스팅: Docker Compose에 포함" (MinIO) | e2e Compose 파일 구조 변경 없음 — 정합 |
+
+---
+
+### 부가 관찰 (INFO)
+
+- **[INFO]** `docker-compose.e2e.yml` 의 `backend-e2e` 서비스는 `--build` 를 Makefile 에서 지정하지 않아도 `build:` 섹션이 존재해 Compose 가 최초에 빌드한다. 그러나 이후 소스 변경 시 `--build` 없이는 재빌드가 일어나지 않는다는 점이 이번 버그의 근본 원인이다. 이 사실은 Makefile help 메시지(`e2e-up: e2e 인프라 + backend-e2e 까지 백그라운드 기동`)와도 일치하며, `--build` 추가 후에도 동일 서술이 유효하다. spec 수정 불필요.
+  - target 위치: `Makefile:12-35`
+  - 충돌 대상: 없음 (단순 관찰)
+  - 상세: 변경이 기존 Compose 구조 및 모든 참조 spec 과 일치함을 확인하는 정보성 메모.
+  - 제안: 필요 없음.
+
+---
+
+## 요약
+
+이번 구현 대상(`Makefile` e2e 타겟에 `--build` 플래그 추가)은 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 중 어떤 영역과도 충돌하지 않는다. `docker-compose.e2e.yml` 은 이미 빌드 가능한 서비스 구조를 보유하고 있으며, `spec/conventions/migrations.md` 및 `.claude/skills/developer/SKILL.md` 가 참조하는 `make e2e-test` 명령 이름도 변경되지 않는다. 오히려 `developer/SKILL.md` 가 "e2e 는 backend 이미지를 빌드해 실행"이라고 명시한 설계 의도를 `--build` 추가가 항상 보장하게 되어 정합성이 강화된다. Cross-Spec 관점에서 구현 착수를 차단할 이유가 없다.
+
+## 위험도
+
+NONE

```

---

### 파일 272: review/consistency/2026/05/16/09_13_51/meta.json
- 변경 유형: Review
- 언어: json

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/09_13_51/meta.json b/review/consistency/2026/05/16/09_13_51/meta.json
new file mode 100644
index 00000000..339b076f
--- /dev/null
+++ b/review/consistency/2026/05/16/09_13_51/meta.json
@@ -0,0 +1,12 @@
+{
+  "timestamp": "2026-05-16T09:13:51.194395",
+  "mode": "구현 착수 전 검토 (--impl-prep, scope=Makefile,docker-compose.e2e.yml)",
+  "target_path": "Makefile,docker-compose.e2e.yml",
+  "checkers": [
+    "cross_spec",
+    "rationale_continuity",
+    "convention_compliance",
+    "plan_coherence",
+    "naming_collision"
+  ]
+}
\ No newline at end of file

```

---

### 파일 273: review/consistency/2026/05/16/09_13_51/naming_collision/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/09_13_51/naming_collision/review.md b/review/consistency/2026/05/16/09_13_51/naming_collision/review.md
new file mode 100644
index 00000000..b62dcccb
--- /dev/null
+++ b/review/consistency/2026/05/16/09_13_51/naming_collision/review.md
@@ -0,0 +1,37 @@
+# 신규 식별자 충돌 검토 — naming_collision
+
+검토 모드: --impl-prep  
+대상 파일: `Makefile`, `docker-compose.e2e.yml`  
+변경 내용: `e2e-up` / `e2e-test` / `e2e-test-full` Makefile 타겟에 `--build` 플래그 추가
+
+---
+
+## 발견사항
+
+### 발견 없음
+
+본 변경(Makefile 타겟에 `--build` 플래그 추가)은 식별자를 새로 도입하지 않는다. 구체적으로 아래 6개 관점을 각각 점검한 결과:
+
+1. **요구사항 ID 충돌** — 새로 부여된 요구사항 ID 없음. 기존 플랜 문서(`plan/in-progress/e2e-makefile-stale-image-fix-2026-05-16.md`)의 작업 항목 변경만 발생.
+
+2. **엔티티/타입명 충돌** — 새 엔티티·DTO·인터페이스 미도입. `Makefile`·`docker-compose.e2e.yml`의 서비스 이름(`backend-e2e`, `backend-e2e-runner`, `playwright-runner`, `postgres`, `redis`, `minio`, `createbuckets`, `migrate`)과 Make 타겟명(`e2e-up`, `e2e-down`, `e2e-test`, `e2e-test-full`)은 모두 기존에 존재하는 식별자이며 의미가 변경되지 않는다.
+
+3. **API endpoint 충돌** — API 경로 변경 없음.
+
+4. **이벤트/메시지명 충돌** — webhook·queue·SSE 이벤트명 변경 없음.
+
+5. **환경변수·설정키 충돌** — `docker-compose.e2e.yml`에 선언된 환경변수(`NODE_ENV`, `APP_PORT`, `APP_URL`, `FRONTEND_URL`, `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`, `REDIS_HOST`, `REDIS_PORT`, `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `MAIL_TRANSPORT`, `JWT_SECRET`, `JWT_ACCESS_EXPIRATION`, `JWT_REFRESH_EXPIRATION`, `ENCRYPTION_KEY`, `INTEGRATION_ENCRYPTION_KEY`, `OAUTH_STUB_MODE`, `E2E_BASE_URL`, `POSTGRES_VERSION`, `MC_USER`, `MC_PASS`, `CI`, `PLAYWRIGHT_BASE_URL`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`)는 모두 기존 `backend/.env.example` 및 `docker-compose.yml`(dev)에서 동일한 의미로 이미 사용 중이다. 신규 도입된 키 없음.
+
+6. **파일 경로 충돌** — 새 spec 파일이나 파일 경로 변경 없음. `Makefile`·`docker-compose.e2e.yml` 두 파일 모두 repo 루트에 기존부터 존재한다.
+
+---
+
+## 요약
+
+`Makefile`의 `e2e-up`·`e2e-test`·`e2e-test-full` 타겟에 `--build` 플래그를 추가하는 이번 변경은 기존 식별자의 동작 방식(컨테이너를 기동 전 항상 rebuild)을 보강할 뿐이며, 새로운 식별자(요구사항 ID, 엔티티명, API 경로, 이벤트명, 환경변수, 파일 경로)를 전혀 도입하지 않는다. 6가지 신규 식별자 충돌 관점 모두에서 발견 사항이 없다.
+
+---
+
+## 위험도
+
+NONE

```

---

### 파일 274: review/consistency/2026/05/16/09_13_51/plan_coherence/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/09_13_51/plan_coherence/review.md b/review/consistency/2026/05/16/09_13_51/plan_coherence/review.md
new file mode 100644
index 00000000..683a3b59
--- /dev/null
+++ b/review/consistency/2026/05/16/09_13_51/plan_coherence/review.md
@@ -0,0 +1,27 @@
+## 발견사항
+
+- **[WARNING]** plan 체크리스트와 실제 코드 상태 불일치
+  - target 위치: `Makefile` (e2e-up, e2e-test, e2e-test-full 타겟)
+  - 관련 plan: `plan/in-progress/e2e-makefile-stale-image-fix-2026-05-16.md` §체크리스트 — `[x] 구현 (Makefile 수정)`, `[x] TEST WORKFLOW`, `[x] REVIEW WORKFLOW`
+  - 상세: `plan/in-progress/e2e-makefile-stale-image-fix-2026-05-16.md` 의 체크리스트 항목 "구현 (Makefile 수정)" 이 `[x]` 로 표기되어 있지만, worktree `bg-monitoring-e2e-fix-f789b9` 는 main 브랜치(`8fbad212`)와 동일한 커밋에 머물러 있고 Makefile 에 실제 변경이 없다. `git status` 는 plan 파일과 review 디렉토리만 untracked 로 보여준다. 즉 consistency-check `--impl-prep` 이 실행된 시점에 target 파일 diff 가 "(없음)" 인 상태가 맞지만, 동시에 plan 의 "구현 완료" 체크가 사실과 다르다.
+  - 제안: plan 의 `[x] 구현 (Makefile 수정)` 과 `[x] TEST WORKFLOW`, `[x] REVIEW WORKFLOW` 를 `[ ]` 로 되돌려 실제 구현 순서를 반영한다. consistency-check 완료 후 Makefile `--build` 플래그 추가 구현 → `make e2e-test` 통과 확인 → plan 체크박스 순서대로 갱신.
+
+- **[INFO]** `brand-refresh-impl.md` 의 e2e fail #2 와 Makefile 수정의 간접 연관
+  - target 위치: `Makefile` e2e-test / e2e-test-full 타겟
+  - 관련 plan: `plan/in-progress/brand-refresh-impl.md` §5 "fail #2 (password-reset — `/login` redirect timeout) — root cause 미확정, CI 검증 대기"
+  - 상세: `brand-refresh-impl.md` 는 `make e2e-test-full` 에서 password-reset e2e 가 local Mac ARM Docker 에서 결정적으로 실패하고 있으며 CI 결과를 대기 중이다. 본 Makefile 수정 (`--build` 추가) 은 stale 이미지 문제를 해결하지만, brand-refresh worktree(`brand-refresh-7a3f12`) 는 별도 브랜치이므로 fix 가 merge 되기 전까지 그 worktree 에서 `make e2e-test` 실행 시 동일 stale 이미지 문제가 재현될 수 있다. 인과 관계는 없으나 brand-refresh 의 e2e 재검증 시 stale 이미지 여부도 같이 확인하면 좋다.
+  - 제안: plan 갱신 불필요. brand-refresh e2e 재검증 시 `docker compose -f docker-compose.e2e.yml build` 수동 실행 여부를 확인하는 메모를 `brand-refresh-impl.md` §5 fail #2 항목 하단에 추가하면 추적에 도움이 됨 (선택 사항).
+
+- **[INFO]** worktree 간 `Makefile` / `docker-compose.e2e.yml` 동시 수정 없음 — 충돌 없음
+  - target 위치: `Makefile`, `docker-compose.e2e.yml`
+  - 관련 plan: 전체 활성 worktree (`ai-agent-i18n-fix-b7d4e2`, `cafe24-fields-add-btn-d3f8a2`, `cafe24-node-i18n-fix-d8f3a1`, `cafe24-refresh-fix-a8c2f1`, `migrate-dup-guard-51c9fc`, `user-guide-sync-4af69c`)
+  - 상세: 모든 활성 worktree 의 `docker-compose.e2e.yml` 이 main 과 동일하고, `Makefile` 도 마찬가지다. `self-hosting-deployment.md` 는 `docker-compose.production.yml` (신규 파일) 만 다루므로 경합 없음. worktree 충돌 없음.
+  - 제안: 없음.
+
+## 요약
+
+target 파일(`Makefile`, `docker-compose.e2e.yml`) 에 대한 현재 diff 가 없는 상태(`(없음)`)로 consistency-check `--impl-prep` 이 수행된 것은 구현 착수 직전이라는 점에서 절차상 정상이다. 다른 진행 중 plan 과의 worktree 충돌, 미해결 결정 우회, 중복 작업은 발견되지 않았다. 단, `e2e-makefile-stale-image-fix-2026-05-16.md` 의 체크리스트가 구현·테스트·리뷰 항목까지 모두 `[x]` 로 선행 표기되어 있는 점은 plan 문서와 실제 git 상태 사이의 불일치를 초래한다. plan 체크박스를 실제 완료 시점에 맞게 갱신해 계획(plan)이 진실 소스로서의 역할을 유지하도록 교정이 필요하다.
+
+## 위험도
+
+LOW

```

---

### 파일 275: review/consistency/2026/05/16/09_13_51/rationale_continuity/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/09_13_51/rationale_continuity/review.md b/review/consistency/2026/05/16/09_13_51/rationale_continuity/review.md
new file mode 100644
index 00000000..099c8615
--- /dev/null
+++ b/review/consistency/2026/05/16/09_13_51/rationale_continuity/review.md
@@ -0,0 +1,33 @@
+### 발견사항
+
+- **[INFO]** Makefile 인라인 Rationale(기각된 `--abort-on-container-exit` 패턴) 은 유지됨
+  - target 위치: `Makefile` 주석 블록 (L23-25) — "Docker Desktop 의 network race 와 충돌하는 사례가 있어 분리"
+  - 과거 결정 출처: `Makefile` 자체 주석 (인라인 ADR). `spec/` 레벨 Rationale 없음.
+  - 상세: `--abort-on-container-exit` 가 Docker Desktop network race 를 유발해 기각됐고, 대신 `up -d --wait` + `run --rm` + `; STATUS=$$?` 패턴을 채택한 결정이 코드 주석으로 보존되어 있다. 현재 `Makefile` 내 어떤 타겟도 이 기각된 패턴을 재도입하고 있지 않다.
+  - 제안: 문제 없음. 향후 타겟 추가 시에도 `--abort-on-container-exit` 재사용은 주석 근거에 따라 금지.
+
+- **[INFO]** `docker-compose.e2e.yml` 의 격리 원칙(ephemeral, 호스트 포트 미노출, `OAUTH_STUB_MODE`) 유지됨
+  - target 위치: `docker-compose.e2e.yml` 전체
+  - 과거 결정 출처: `docker-compose.e2e.yml` 파일 상단 주석 블록 + `CLAUDE.md` e2e 인프라 원칙 ("e2e 는 `docker-compose.e2e.yml` 에서 격리 인프라" 정책)
+  - 상세: (a) `name: clemvion-e2e` 로 dev 인프라와 project-level 격리, (b) 호스트 포트 미노출로 dev 포트 충돌 방지, (c) 영속 볼륨 없는 ephemeral 설계, (d) `OAUTH_STUB_MODE: "true"` 로 OAuth 실 호출 차단. 이 4가지 invariant 가 모두 유지된다.
+  - 제안: 향후 서비스 추가 시 이 4가지 속성을 동일하게 적용해야 한다. 특히 `OAUTH_STUB_MODE` 는 e2e 격리의 핵심이므로 신규 OAuth 의존 기능 e2e 작성 시 이 설정이 테스트 의미에 영향을 주는지 반드시 검토.
+
+- **[INFO]** `profiles: ["test"]` runner 분리 원칙 유지됨
+  - target 위치: `docker-compose.e2e.yml` L164, L182 (`backend-e2e-runner`, `playwright-runner`)
+  - 과거 결정 출처: `docker-compose.e2e.yml` 주석("runner 서비스는 `profiles: ["test"]` 로 분리되어 `make e2e-up` 만으로는 안 뜬다")
+  - 상세: `make e2e-up` 과 `make e2e-test` 의 역할이 명확히 분리되어 있고, runner 서비스는 profile 게이트로 분리된 설계가 유지된다.
+  - 제안: 문제 없음.
+
+- **[INFO]** Makefile `--build` 플래그 누락 — plan 의 결정과 현재 파일 상태 불일치 (Rationale 연속성 범위 경계)
+  - target 위치: `Makefile` L18, L27, L32 (`e2e-up`, `e2e-test`, `e2e-test-full` 타겟의 `up -d --wait` 호출)
+  - 과거 결정 출처: `plan/in-progress/e2e-makefile-stale-image-fix-2026-05-16.md` — "e2e-up, e2e-test, e2e-test-full 타겟에 `--build` 플래그 추가" (체크박스 `[x]`)
+  - 상세: plan 문서는 `--build` 추가가 완료됐다고 표기하지만, 실제 `Makefile` 에는 `--build` 가 없다. `--build` 추가는 기각된 어떤 대안을 재도입하는 것이 아니며(기각된 대안은 `--abort-on-container-exit` 패턴이었음), 기존 `up -d --wait` 패턴을 유지하면서 캐시 새로고침만 추가하는 것이므로 Rationale 원칙과 충돌하지 않는다. 다만 plan 이 완료됐다고 기록됐는데 파일이 미반영된 상태는 `plan_coherence` 검사 영역이며 Rationale 연속성 자체의 위반은 아니다.
+  - 제안: 본 checker 범위 밖이나 기록 목적으로 명시. `plan_coherence` checker 또는 구현 재확인이 필요.
+
+### 요약
+
+`Makefile` 과 `docker-compose.e2e.yml` 은 spec 레벨의 `## Rationale` 섹션 대상 문서가 아니다. 이 두 파일에 관련된 과거 설계 결정은 (a) Makefile 인라인 주석의 `--abort-on-container-exit` 기각 기록, (b) `docker-compose.e2e.yml` 의 ephemeral·호스트포트 미노출·project 격리·`OAUTH_STUB_MODE` invariant 네 가지, (c) `profiles: ["test"]` runner 분리 원칙이다. 현재 두 파일의 내용은 이 모든 과거 결정과 충돌하지 않으며, 제공된 spec Rationale 발췌(data-model, OAuth/integration, navigation, user-profile, AI-assistant 영역)는 이 두 인프라 파일과 직접적 연관이 없어 충돌 가능성이 없다. plan 문서와 실제 Makefile 상태 간 불일치(--build 누락)는 Rationale 원칙 위반이 아니며 plan_coherence 영역이다.
+
+### 위험도
+
+NONE

```

---

### 파일 276: review/consistency/2026/05/16/09_34_14/SUMMARY.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/09_34_14/SUMMARY.md b/review/consistency/2026/05/16/09_34_14/SUMMARY.md
new file mode 100644
index 00000000..267cf2b0
--- /dev/null
+++ b/review/consistency/2026/05/16/09_34_14/SUMMARY.md
@@ -0,0 +1,45 @@
+BLOCK: NO
+
+# Consistency Check 통합 보고서
+
+세션: `review/consistency/2026/05/16/09_34_14`
+모드: `--impl-prep`
+대상: `README.md`, `CHANGELOG.md`, `Makefile`
+호출자: developer (bg-monitoring-e2e-fix-f789b9 worktree, e2e-makefile-followup plan)
+
+## 결론
+
+Critical 3건 모두 **사전 결함** (docs-consolidation 2026-05-12 이후 잔존). 본 PR 의 target 파일 안에 있고 같은 파일을 편집하므로 SKILL.md ISSUE FIX 정책 ("TEST WORKFLOW·REVIEW WORKFLOW 에서 발견되는 사항은 기존부터 있던 이슈라도 반드시 해결") 에 따라 **plan 범위에 추가 흡수해 동반 해소**. BLOCK 처리 사유 없음 — fix 가 본 PR 안에 포함됨.
+
+## Critical → plan 범위에 흡수
+
+| # | 위치 | 위반 | 처리 |
+|---|---|---|---|
+| C1 | `README.md` L78 | 「주요 경로」 트리에 폐기된 `prd/` 항목 | plan 「동반 사전 결함 해소」에 추가, 트리에서 제거 + `spec/` 설명 보강 |
+| C2 | `README.md` L232 | doc-link 검증 설명에 `prd/` 언급 | plan 에 추가, `prd/` 제거 후 `spec/` 단독 표기 |
+| C3 | `CHANGELOG.md` L4 | `user_memo/node-specs-improvement/CONVENTIONS.md` 경로 | plan 에 추가, `spec/conventions/node-output.md` 로 교체 |
+
+## Warning
+
+- **plan_coherence W1**: `ai-review-subagent-b7c8d9` worktree 의 미완료 README.md 변경과 동일 파일 작업. 편집 구간 다르고 별도 worktree merge 시점에 충돌 검출 가능. 추적 메모만.
+
+## Info
+
+총 5건. 주요:
+- README.md 의 `spec/` 항목 설명 보강 (C1 와 함께 처리됨)
+- CHANGELOG.md 의 "Unreleased" 섹션 가독성
+- e2e-makefile-stale-image-fix 선행 PR merge 상태 확인 (현 worktree 의 직전 commit 들 — 미 merge, follow-up 와 같은 PR 로 묶이는 자연스러운 형태)
+
+## Checker 별
+
+| Checker | issues | 위험도 |
+|---|---|---|
+| cross_spec | 3 | LOW (Warning) |
+| rationale_continuity | 0 | NONE |
+| convention_compliance | 5 | MEDIUM (Critical 3건 → 흡수로 해소) |
+| plan_coherence | 4 | LOW |
+| naming_collision | 0 | NONE |
+
+## 진행
+
+확장된 plan 범위 (3 Critical 흡수 포함) 로 구현 진입.

```

---

### 파일 277: review/consistency/2026/05/16/09_34_14/_prompts/convention_compliance.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 278: review/consistency/2026/05/16/09_34_14/_prompts/cross_spec.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 279: review/consistency/2026/05/16/09_34_14/_prompts/naming_collision.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 280: review/consistency/2026/05/16/09_34_14/_prompts/plan_coherence.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 281: review/consistency/2026/05/16/09_34_14/_prompts/rationale_continuity.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 282: review/consistency/2026/05/16/09_34_14/_retry_state.json
- 변경 유형: Review
- 언어: json

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/09_34_14/_retry_state.json b/review/consistency/2026/05/16/09_34_14/_retry_state.json
new file mode 100644
index 00000000..da4d202b
--- /dev/null
+++ b/review/consistency/2026/05/16/09_34_14/_retry_state.json
@@ -0,0 +1,16 @@
+{
+  "session_dir": "/Volumes/project/private/clemvion/.claude/worktrees/bg-monitoring-e2e-fix-f789b9/review/consistency/2026/05/16/09_34_14",
+  "summary_subagent_type": "consistency-summary",
+  "summary_output_file": "/Volumes/project/private/clemvion/.claude/worktrees/bg-monitoring-e2e-fix-f789b9/review/consistency/2026/05/16/09_34_14/SUMMARY.md",
+  "agents_pending": [],
+  "agents_success": ["cross_spec", "rationale_continuity", "convention_compliance", "plan_coherence", "naming_collision"],
+  "agents_fatal": [],
+  "agent_history": {
+    "cross_spec": [{"status": "success", "issues": 3}],
+    "rationale_continuity": [{"status": "success", "issues": 0}],
+    "convention_compliance": [{"status": "success", "issues": 5}],
+    "plan_coherence": [{"status": "success", "issues": 4}],
+    "naming_collision": [{"status": "success", "issues": 0}]
+  },
+  "loop_mode": false
+}

```

---

### 파일 283: review/consistency/2026/05/16/09_34_14/convention_compliance/review.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 284: review/consistency/2026/05/16/09_34_14/cross_spec/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/09_34_14/cross_spec/review.md b/review/consistency/2026/05/16/09_34_14/cross_spec/review.md
new file mode 100644
index 00000000..d41c05c9
--- /dev/null
+++ b/review/consistency/2026/05/16/09_34_14/cross_spec/review.md
@@ -0,0 +1,38 @@
+# Cross-Spec 일관성 검토 — e2e Makefile follow-up (README · CHANGELOG · Makefile)
+
+검토 모드: `--impl-prep` / scope: `README.md`, `CHANGELOG.md`, `Makefile`
+대상 plan: `plan/in-progress/e2e-makefile-followup-2026-05-16.md`
+
+---
+
+## 발견사항
+
+- **[WARNING]** README.md 디렉토리 트리에 폐기된 `prd/` 경로 박제
+  - target 위치: `README.md` 라인 77 — `├── prd/                        # 제품 요구 사항 정의서 (PRD)`
+  - 충돌 대상: `spec/0-overview.md §8 문서 맵` / `CLAUDE.md §폴더 구조`
+  - 상세: docs-consolidation(2026-05-12)으로 `prd/` 는 `spec/` 으로 완전 흡수되었고, `CLAUDE.md` 는 "`옛 prd/, memory/, user_memo/ 폴더는 docs-consolidation(2026-05-12)으로 모두 spec/ 또는 plan/complete/archive/ 로 흡수되었다`" 라고 명시한다. `README.md` 디렉토리 트리의 `prd/` 항목은 존재하지 않는 경로를 공식 문서에 표기하는 것이므로 spec 과 직접 모순된다. 본 plan 이 README 를 편집하는 시점에 함께 수정하지 않으면 스텔스 회귀가 고착된다.
+  - 제안: `README.md` 편집 작업 시 해당 라인을 `spec/                       # 제품 정의·기술 명세 (단일 진실)` 로 교체하거나 삭제. 이미 라인 76 에 `prd/` 와 `spec/` 둘 다 나열되어 있는 상태이므로 `prd/` 행 제거가 가장 간결하다.
+
+- **[INFO]** README.md 스크립트 표가 `make e2e-test` 를 누락하여 `npm run test:e2e` 만 안내
+  - target 위치: `README.md` 라인 222–228 `### 스크립트` 표
+  - 충돌 대상: `plan/in-progress/e2e-makefile-followup-2026-05-16.md` 작업 항목 1 / `CLAUDE.md §개발 방법론` ("e2e — `make e2e-test`, `docker-compose.e2e.yml` 기반 격리 인프라")
+  - 상세: CLAUDE.md 는 e2e 테스트 실행의 정규 경로로 `make e2e-test` 를 명시하나, README 스크립트 표에는 `npm run test:e2e` 만 기술되어 있다. plan 이 "스크립트 표 자체 재구성은 의도적 제외" 라고 밝히고 별도 단락 추가를 선택한 점은 인지되어 있다. 단락 추가 후에도 표와 단락이 병존하므로 독자가 두 경로의 차이(격리 인프라 여부)를 오해할 수 있다.
+  - 제안: 추가하는 단락에 "표의 `npm run test:e2e` 는 host 환경 직접 실행(인프라 별도 필요), `make e2e-test` 는 격리 인프라 포함 1-shot 실행" 임을 한 문장으로 구분해 표기. 또는 표에 Makefile 타겟 행을 추가하고 단락을 생략하는 것도 동등하게 유효.
+
+- **[INFO]** CHANGELOG.md "Unreleased" 섹션 제목이 특정 기능("Node Output Contract Unification")으로 고정되어 Test infrastructure 항목과 의미상 혼재
+  - target 위치: `CHANGELOG.md` 라인 3 — `## Unreleased — Node Output Contract Unification`
+  - 충돌 대상: 없음 (외부 spec 충돌 아님)
+  - 상세: plan 이 "Unreleased 하단 신설 섹션(예: 'Test infrastructure') 에 1-2줄 기록" 을 계획하는데, 현재 Unreleased 헤더가 단일 기능명("Node Output Contract Unification")으로 이미 고정되어 있다. 새 섹션이 추가되면 하나의 Unreleased 블록 안에 서로 다른 주제(노드 계약 통일 + e2e 인프라 변경)가 섞인다. 이는 spec 위반이 아니라 changelog 가독성 문제이므로 INFO 로 분류.
+  - 제안: 추가 섹션의 헤더를 명확히 구분(`### Test infrastructure` 또는 `### Internal / DX`) 해 Unreleased 내 하위 카테고리임을 드러내는 것이 충분. Unreleased 헤더 자체를 변경할 필요는 없다.
+
+---
+
+## 요약
+
+target 파일(`README.md`, `CHANGELOG.md`, `Makefile`) 은 spec 도메인 엔티티·API 계약·상태 머신·RBAC 와 직접 교차하지 않는 문서/인프라 레이어이므로 CRITICAL 충돌은 없다. 다만 `README.md` 라인 77 의 `prd/` 경로 박제가 docs-consolidation(2026-05-12) 결정과 직접 모순되는 WARNING 이 1건 있다. README 를 편집하는 본 plan 의 작업 범위 안에서 해당 행을 함께 수정하면 추가 PR 없이 해결된다. INFO 2건은 독자 경험·changelog 가독성 개선 권장 사항이며 착수 차단 사유가 아니다.
+
+---
+
+## 위험도
+
+LOW

```

---

### 파일 285: review/consistency/2026/05/16/09_34_14/meta.json
- 변경 유형: Review
- 언어: json

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/09_34_14/meta.json b/review/consistency/2026/05/16/09_34_14/meta.json
new file mode 100644
index 00000000..00a9919b
--- /dev/null
+++ b/review/consistency/2026/05/16/09_34_14/meta.json
@@ -0,0 +1,12 @@
+{
+  "timestamp": "2026-05-16T09:34:14.359459",
+  "mode": "구현 착수 전 검토 (--impl-prep, scope=README.md,CHANGELOG.md,Makefile)",
+  "target_path": "README.md,CHANGELOG.md,Makefile",
+  "checkers": [
+    "cross_spec",
+    "rationale_continuity",
+    "convention_compliance",
+    "plan_coherence",
+    "naming_collision"
+  ]
+}
\ No newline at end of file

```

---

### 파일 286: review/consistency/2026/05/16/09_34_14/naming_collision/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/09_34_14/naming_collision/review.md b/review/consistency/2026/05/16/09_34_14/naming_collision/review.md
new file mode 100644
index 00000000..7c221046
--- /dev/null
+++ b/review/consistency/2026/05/16/09_34_14/naming_collision/review.md
@@ -0,0 +1,37 @@
+# 신규 식별자 충돌 검토 결과
+
+검토 모드: `--impl-prep`
+대상 파일: `README.md`, `CHANGELOG.md`, `Makefile`
+
+---
+
+## 발견사항
+
+발견된 충돌 없음.
+
+target 세 파일(`README.md`, `CHANGELOG.md`, `Makefile`)이 본 작업에서 도입하는 변경 내용은 다음과 같다.
+
+- `README.md` — `make e2e-*` 타겟 안내 단락 추가 (문서 텍스트)
+- `CHANGELOG.md` — "Unreleased" 하단 테스트 인프라 변경 이력 1-2줄 추가 (서술 텍스트)
+- `Makefile` — `e2e-up` / `e2e-test` / `e2e-test-full` help 텍스트에 "(자동 image rebuild)" 설명 추가, `e2e-test-full` 패턴 의도 주석 추가
+
+6개 점검 관점을 각각 검토한 결과:
+
+1. **요구사항 ID 충돌** — 새로 부여되는 요구사항 ID 없음.
+2. **엔티티/타입명 충돌** — 새로 정의되는 엔티티·DTO·인터페이스 없음.
+3. **API endpoint 충돌** — 새로 정의되는 endpoint(method + path) 없음.
+4. **이벤트/메시지명 충돌** — 새로 정의되는 webhook·queue·SSE 이벤트 이름 없음.
+5. **환경변수·설정키 충돌** — 새로 도입되는 ENV var 또는 config key 없음. `Makefile` 내 `$(COMPOSE_E2E)` 변수는 기존 정의를 그대로 사용.
+6. **파일 경로 충돌** — 새 spec 파일 경로 신설 없음. 수정 대상은 루트 레벨 `README.md`·`CHANGELOG.md`·`Makefile` 로, 기존 컨벤션(`spec/`, `plan/`, `review/`)과 독립적이며 중복 없음.
+
+---
+
+## 요약
+
+`README.md`, `CHANGELOG.md`, `Makefile` 세 파일에 대한 변경은 기존 `make e2e-*` 인프라에 대한 사용 안내·변경 이력·help 주석을 추가하는 순수 문서·주석 작업이다. 신규 식별자(요구사항 ID, 엔티티명, endpoint, 이벤트명, ENV var, spec 파일 경로)를 전혀 도입하지 않으므로 충돌 위험은 없다.
+
+---
+
+## 위험도
+
+NONE

```

---

### 파일 287: review/consistency/2026/05/16/09_34_14/plan_coherence/review.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 288: review/consistency/2026/05/16/09_34_14/rationale_continuity/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/09_34_14/rationale_continuity/review.md b/review/consistency/2026/05/16/09_34_14/rationale_continuity/review.md
new file mode 100644
index 00000000..b770ab5b
--- /dev/null
+++ b/review/consistency/2026/05/16/09_34_14/rationale_continuity/review.md
@@ -0,0 +1,30 @@
+# Rationale 연속성 검토 결과
+
+검토 모드: `--impl-prep` (구현 착수 전)
+검토 대상: `README.md`, `CHANGELOG.md`, `Makefile`
+검토 시각: 2026-05-16
+
+---
+
+### 발견사항
+
+발견된 이슈 없음.
+
+검토 대상 파일(`README.md`, `CHANGELOG.md`, `Makefile`)에 구현 변경 내용이 존재하지 않는다 — orchestrator 가 수집한 diff 가 "(없음)" 으로 명시되어 있다. 따라서 아래 네 가지 점검 관점 모두 적용할 대상 코드·설계 결정이 없다.
+
+1. **기각된 대안의 재도입** — 해당 없음 (변경 없음)
+2. **합의된 원칙 위반** — 해당 없음 (변경 없음)
+3. **결정의 무근거 번복** — 해당 없음 (변경 없음)
+4. **암묵적 가정 충돌** — 해당 없음 (변경 없음)
+
+---
+
+### 요약
+
+`README.md`, `CHANGELOG.md`, `Makefile` 세 파일은 이번 구현 착수 범위에서 실질적 변경이 없는 것으로 확인되어 Rationale 연속성 충돌 위험이 전혀 존재하지 않는다. Rationale 발췌로 제공된 spec 문서들(data-model, integration, auth-flow, workflow-list, user-profile, brand/layout, AI-assistant 등)은 풍부한 결정 맥락을 담고 있으나, 현재 검토 범위 파일들과 교차되는 설계 결정이 없으므로 어떠한 기각 대안 재도입·원칙 위반·번복도 식별되지 않는다.
+
+---
+
+### 위험도
+
+NONE

```
