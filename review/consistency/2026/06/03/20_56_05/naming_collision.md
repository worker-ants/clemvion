# 신규 식별자 충돌 검토 결과

검토 범위: `spec/4-nodes/4-integration/` (0-common.md · 1-http-request.md · 2-database-query.md · 3-send-email.md · 4-cafe24.md · 5-makeshop.md)
검토 모드: `--impl-prep`

---

## 발견사항

### 1. 요구사항 ID 충돌

특이사항 없음. target 에서 새로 부여하는 요구사항 ID 는 없고, MakeShop spec (`5-makeshop.md`) 이 참조하는 기존 ID(`ND-CF-*`, `INT-US-05` 등) 는 이미 정의된 범위 안에서 인용만 한다.

---

### 2. 엔티티/타입명 충돌

- **[INFO]** `MakeshopOperationMetadata` vs `Cafe24OperationMetadata` — 대칭 네이밍
  - target 신규 식별자: `MakeshopOperationMetadata` (`spec/conventions/makeshop-api-metadata.md` line 38)
  - 기존 사용처: `Cafe24OperationMetadata` (`spec/conventions/cafe24-api-metadata.md` line 51)
  - 상세: 두 인터페이스는 완전히 다른 서비스를 위한 별개 타입이며 충돌은 없다. 단, 필드 구성이 의도적으로 비대칭하다 — Cafe24 는 `restrictedApproval` 필드와 `method: GET|POST|PUT|DELETE` 4종을 가지지만 MakeShop 은 `restrictedApproval` 없음 + `method: GET|POST` 2종만 정의 (§9.5). 구현 시 TypeScript 공통 base interface 없이 두 타입이 병렬 존재해도 무방하다.
  - 제안: 현 설계 유지. 충돌 없음.

- **[INFO]** `MakeshopMcpToolProvider` — 신규 클래스명
  - target 신규 식별자: `MakeshopMcpToolProvider` (`5-makeshop.md` §8, `spec/2-navigation/4-integration.md` line 669)
  - 기존 사용처: `Cafe24McpToolProvider` (`codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts` 등)
  - 상세: 다른 서비스를 위한 별개 클래스명이며 충돌 없음. 구현 경로 `codebase/backend/src/nodes/ai/ai-agent/tool-providers/makeshop-mcp-tool-provider.ts` 는 cafe24 경로와 대칭.
  - 제안: 현 설계 유지.

- **[INFO]** `MakeshopApiClient` — 신규 wrapper 클래스명
  - target 신규 식별자: `MakeshopApiClient` (`5-makeshop.md` §4 step 9)
  - 기존 사용처: `Cafe24ApiClient` (`codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts`)
  - 상세: 별개 클래스명. 충돌 없음.
  - 제안: 현 설계 유지.

---

### 3. API Endpoint 충돌

- **[INFO]** `GET /api/integrations/services/makeshop/catalog` — 신규 endpoint
  - target 신규 식별자: `GET /api/integrations/services/makeshop/catalog` (`spec/2-navigation/4-integration.md` line 802)
  - 기존 사용처: `GET /api/integrations/services/cafe24/catalog` (동일 파일, 기존 정의)
  - 상세: `:type` 파라미터가 다른 별개 endpoint. 충돌 없음. NestJS 선언 순서 규칙(`services/:type/catalog` 가 `:id` 동적 경로보다 앞) 도 4-integration.md 에 명시돼 있다.
  - 제안: 현 설계 유지.

- **[INFO]** `GET /api/3rd-party/makeshop/install/:installToken` / `POST /api/3rd-party/makeshop/callback` — 신규 OAuth endpoint (Planned)
  - target 신규 식별자: `${APP_URL}/api/3rd-party/makeshop/install/...` (`spec/2-navigation/4-integration.md` line 776)
  - 기존 사용처: `/api/3rd-party/cafe24/install/:installToken`, `/api/3rd-party/cafe24/callback` (기존 구현 완료)
  - 상세: path 구분자(`cafe24` vs `makeshop`)가 달라 충돌 없음.
  - 제안: 현 설계 유지.

---

### 4. 이벤트/메시지명 충돌

- **[WARNING]** MakeShop 토큰 갱신 BullMQ 큐 이름 미정의
  - target 신규 식별자: 명시 없음 — `5-makeshop.md` §4 step 6 에서 "cross-pod 직렬화는 Cafe24 §4 step 6 정책 재사용" 이라고 하나, Cafe24 의 BullMQ 큐명 `cafe24-token-refresh` 과 BullMQ 프로세서 `Cafe24TokenRefreshProcessor` 의 MakeShop 대응 이름이 spec 어디에도 정의돼 있지 않다.
  - 기존 사용처: `cafe24-token-refresh` 큐 (`spec/5-system/16-system-status-api.md` line 27, `spec/data-flow/5-integration.md` line 139), `Cafe24TokenRefreshProcessor` (`data-flow/5-integration.md` line 142), `cafe24-background-refresh` 스케줄러 (`data-flow/5-integration.md` line 142)
  - 상세: Cafe24 token refresh 는 BullMQ 큐명(`cafe24-token-refresh`)·스케줄러 ID(`cafe24-background-refresh-daily`)·프로세서 클래스(`Cafe24TokenRefreshProcessor`) 모두 spec 에 명시돼 있다. MakeShop 도 동일 메커니즘을 재사용하겠다고 하지만 대응하는 큐명·스케줄러 ID·프로세서명이 spec 에 없다. 구현 시 `cafe24-token-refresh` 큐에 두 통합이 혼용되거나(`service_type` 필드로 구분), 별도 큐(`makeshop-token-refresh`)를 신설할 수 있는데, 어느 쪽인지 spec 에서 결정돼 있지 않다. 시스템 상태 API(`spec/5-system/16-system-status-api.md`)도 `cafe24-token-refresh` 큐만 카탈로그에 올라 있어 MakeShop 큐 추가 여부가 불명확하다.
  - 제안: `5-makeshop.md` §4 step 6 또는 `spec/2-navigation/4-integration.md §5.9` 에 다음 중 하나를 명시: (a) 기존 `cafe24-token-refresh` 큐를 `service_type` 필드 분기로 공용 — 큐명 변경 불필요하나 명시 필요, (b) 별도 `makeshop-token-refresh` 큐 신설 — 큐명·프로세서명·스케줄러 ID 등록 필요.

---

### 5. 환경변수·설정키 충돌

특이사항 없음. target 이 새로 도입하는 ENV var 는 없다. `ALLOW_PRIVATE_HOST_TARGETS` 는 기존 플래그를 공용하며 (`0-common.md` §4.1), `5-makeshop.md` 는 이를 명시적으로 재사용한다.

`spec/2-navigation/4-integration.md §5.9` 에 명시된 OAuth endpoint 호스트(`auth.makeshop.com`, `connect.makeshop.co.kr`) 는 코드에 하드코딩될 URL 이며 ENV var 가 아니다 — 충돌 없음.

---

### 6. 파일 경로 충돌

- **[INFO]** `spec/conventions/makeshop-api-catalog/` — 새 카탈로그 디렉토리
  - target 신규 식별자: `spec/conventions/makeshop-api-catalog/` (worktree 에 이미 생성됨)
  - 기존 사용처: `spec/conventions/cafe24-api-catalog/` (기존 디렉토리)
  - 상세: 디렉토리명이 다르며 충돌 없음. `_overview.md` 와 섹션별 `.md` 파일·`openapi/` 하위 구조도 cafe24 패턴과 대칭. 현재 worktree 에 실제 파일이 존재한다 (`spec/conventions/makeshop-api-catalog/shop.md` 등).
  - 제안: 현 설계 유지.

- **[INFO]** `spec/conventions/makeshop-api-metadata.md` — 새 컨벤션 파일
  - target 신규 식별자: `spec/conventions/makeshop-api-metadata.md` (worktree 에 이미 생성됨)
  - 기존 사용처: `spec/conventions/cafe24-api-metadata.md` (기존 파일)
  - 상세: 파일명이 다르며 충돌 없음.
  - 제안: 현 설계 유지.

- **[INFO]** `spec/4-nodes/4-integration/5-makeshop.md` — 새 spec 파일
  - target 신규 식별자: `spec/4-nodes/4-integration/5-makeshop.md` (worktree 에 이미 생성됨)
  - 기존 사용처: `spec/4-nodes/4-integration/4-cafe24.md` (기존 파일)
  - 상세: 번호 prefix(`4-` vs `5-`) 가 순차적으로 부여돼 충돌 없음. 컨벤션(`N-name.md` 패턴)에 부합.
  - 제안: 현 설계 유지.

---

### 7. 에러 코드 충돌/누락

- **[INFO]** `MAKESHOP_*` 에러 코드군 — 신규 코드 네임스페이스
  - target 신규 식별자: `MAKESHOP_4XX`, `MAKESHOP_404`, `MAKESHOP_422`, `MAKESHOP_AUTH_FAILED`, `MAKESHOP_RATE_LIMITED`, `MAKESHOP_5XX`, `MAKESHOP_TRANSPORT_FAILED`, `MAKESHOP_UNKNOWN_OPERATION`, `MAKESHOP_MISSING_FIELDS`, `MAKESHOP_INVALID_SHOP_UID` (`5-makeshop.md` §6)
  - 기존 사용처: `CAFE24_4XX`, `CAFE24_404`, `CAFE24_422`, `CAFE24_AUTH_FAILED`, `CAFE24_RATE_LIMITED`, `CAFE24_5XX`, `CAFE24_TRANSPORT_FAILED`, `CAFE24_UNKNOWN_OPERATION`, `CAFE24_MISSING_FIELDS` (`4-cafe24.md` §6). `MAKESHOP_*` 코드는 `spec/conventions/error-codes.md` 의 historical-artifact 레지스트리에 없고, 기존 코드 공간과 겹치지 않는다.
  - 상세: `CAFE24_*` 와 `MAKESHOP_*` 는 도메인 prefix 가 달라 충돌 없음. 의미 기반 명명 원칙(`spec/conventions/error-codes.md §1`) 도 준수. `INTEGRATION_SERVICE_UNAVAILABLE` 은 공유 코드로 명시돼 있으며(`5-makeshop.md` §6 비고) 의도적 재사용이다.
  - 제안: 현 설계 유지.

---

## 요약

`spec/4-nodes/4-integration/` target 범위의 신규 식별자(MakeShop 노드·메타데이터·카탈로그 관련)는 기존 Cafe24/공통 식별자와 도메인 prefix(`MAKESHOP_` vs `CAFE24_`), 파일 경로(`5-makeshop.md` vs `4-cafe24.md`), 클래스명(`MakeshopMcpToolProvider` vs `Cafe24McpToolProvider`) 등에서 명확히 분리돼 있어 직접적인 식별자 충돌은 없다. 단 하나의 WARNING 이 발견됐는데, MakeShop 의 토큰 자동 갱신에 사용할 BullMQ 큐명·스케줄러 ID·프로세서 클래스명이 spec 어디에도 정의돼 있지 않아, 구현 시 `cafe24-token-refresh` 큐와의 공용 여부 또는 신규 큐 신설 여부에 대한 결정이 필요하다. 나머지 발견사항은 모두 INFO 수준(명확성 보완 제안)이다.

## 위험도

LOW
