# 신규 식별자 충돌 검토 — spec/4-nodes/4-integration/5-makeshop.md

## 발견사항

### 1. 요구사항 ID 충돌

**[INFO]** target 파일은 독립 요구사항 ID(예: `ND-MS-*` 형식)를 새로 부여하지 않는다.
- target 신규 식별자: 없음 (요구사항 ID 도입 없이 Cafe24 §8.2–§8.6 등 기존 spec 섹션 참조로 처리)
- 기존 사용처: 해당 없음
- 상세: target 은 새 요구사항 ID 대신 "Cafe24 §N 동형" 패턴으로 기존 spec 참조를 재사용한다. 충돌 없음.

---

### 2. 엔티티/타입명 충돌

**[WARNING]** `MAKESHOP_SERVICE_UNAVAILABLE` vs `INTEGRATION_SERVICE_UNAVAILABLE`
- target 신규 식별자: `MAKESHOP_SERVICE_UNAVAILABLE` (§6 에러 코드 표)
- 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/makeshop-api-catalog-730deb/spec/4-nodes/4-integration/4-cafe24.md` §6 에러 코드 표 line 350 — Cafe24 노드는 동일 조건(`__workspaceId` 컨텍스트 누락 / `Cafe24ApiClient` 미주입)에 대해 `INTEGRATION_SERVICE_UNAVAILABLE`(공통 코드)를 사용한다.
- 상세: Cafe24 는 deployment 오류 조건에 공통 prefix `INTEGRATION_SERVICE_UNAVAILABLE`을 쓰는 반면, target 의 MakeShop 노드는 `MAKESHOP_SERVICE_UNAVAILABLE`이라는 서비스 고유 코드를 신설한다. 동일한 조건(deployment misconfiguration)을 두 노드가 다른 코드로 발행하게 되어 클라이언트가 코드로 분기할 때 두 케이스를 별도 처리해야 한다.
- 제안: 공통 조건이므로 `INTEGRATION_SERVICE_UNAVAILABLE`을 그대로 재사용하거나, 공통 코드 (`0-common.md §4.2` INTEGRATION_* 목록)에 편입하는 쪽이 `error-codes.md §1` "의미 기반 명명·도메인 prefix" 원칙에 더 부합한다. 단, 이미 Cafe24 가 `INTEGRATION_SERVICE_UNAVAILABLE`로 사용 중이므로 MakeShop 이 같은 코드를 쓰도록 맞추는 것이 자연스럽다.

**[INFO]** `MakeshopOperationMetadata` 인터페이스명
- target 신규 식별자: `MakeshopOperationMetadata` (§4 실행 로직 및 `spec/conventions/makeshop-api-metadata.md` line 38)
- 기존 사용처: Cafe24 에 대응하는 `Cafe24OperationMetadata` — `/Volumes/project/private/clemvion/.claude/worktrees/makeshop-api-catalog-730deb/spec/conventions/cafe24-api-metadata.md`
- 상세: 네이밍 패턴이 일관되게 적용되어 있어 충돌 없음. INFO 수준 기록.

**[INFO]** `MakeshopApiClient`
- target 신규 식별자: `MakeshopApiClient` (§4 step 9, §6)
- 기존 사용처: `Cafe24ApiClient` — Cafe24 노드 spec 전반
- 상세: 패턴 일관(`<Service>ApiClient`). 충돌 없음.

**[INFO]** `MakeshopMcpToolProvider`
- target 신규 식별자: `MakeshopMcpToolProvider` (§8, §Overview)
- 기존 사용처: `Cafe24McpToolProvider` — `/Volumes/project/private/clemvion/.claude/worktrees/makeshop-api-catalog-730deb/spec/4-nodes/4-integration/_product-overview.md` line 77, `/Volumes/project/private/clemvion/.claude/worktrees/makeshop-api-catalog-730deb/spec/5-system/11-mcp-client.md` line 70
- 상세: 기존 spec 에서 이미 `MakeshopMcpToolProvider`라는 이름으로 "Planned" 항목으로 예약되어 있고, target spec 이 해당 예약 이름을 동일한 의미로 사용한다. 충돌 없음.

---

### 3. API endpoint 충돌

**[INFO]** `GET /api/integrations/services/makeshop/catalog`
- target 신규 식별자: `GET /api/integrations/services/makeshop/catalog` (§4 step 11)
- 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/makeshop-api-catalog-730deb/spec/2-navigation/4-integration.md` line 802 — `GET /api/integrations/services/:type/catalog` 의 `:type='makeshop'` 케이스로 이미 명시적으로 예약되어 있다.
- 상세: 기존 spec 이 이 endpoint를 "Planned" 케이스로 명시하고 있어 target 이 그대로 구체화한다. 새로운 method+path 선점 아님. 충돌 없음.

---

### 4. 이벤트/메시지명 충돌

**[INFO]** 이벤트/메시지 명 신규 도입 없음
- target 은 webhook/queue/SSE 이벤트 이름을 새로 도입하지 않는다. CPIK webhook 11개는 본 노드 범위 밖(§9.6)으로 명시적으로 분리. 충돌 없음.

---

### 5. 환경변수·설정키 충돌

**[INFO]** 신규 환경변수 없음
- target 은 새 ENV var 또는 config key를 도입하지 않는다. 기존 OAuth 인프라(`third-party-oauth`) 를 그대로 재사용. 충돌 없음.

---

### 6. 파일 경로 충돌

**[INFO]** `spec/4-nodes/4-integration/5-makeshop.md`
- target 신규 파일 경로: `spec/4-nodes/4-integration/5-makeshop.md`
- 기존 파일: `4-cafe24.md` (숫자 prefix `4`). `5-makeshop.md`는 기존 파일들과 중복되지 않고 숫자 prefix 순서(`0-common`, `1-http-request`, `2-database-query`, `3-send-email`, `4-cafe24`, `5-makeshop`)가 자연스럽게 이어진다.
- 상세: 충돌 없음. 명명 컨벤션(`N-name.md`) 준수.

**[INFO]** frontmatter `id: makeshop`
- target 신규 식별자: `id: makeshop` (frontmatter)
- 기존 사용처: 전체 spec 파일 내 `id: makeshop`을 가진 다른 파일 없음 — `/Volumes/project/private/clemvion/.claude/worktrees/makeshop-api-catalog-730deb/spec/4-nodes/4-integration/5-makeshop.md` 단독.
- 상세: `spec/conventions/makeshop-api-catalog/` 하위 파일들은 `id: makeshop-product`, `id: makeshop-shop` 등 suffix를 붙여 구분. 충돌 없음.

**[INFO]** `spec/conventions/makeshop-api-catalog/` 하위 파일들
- target 에서 직접 참조하는 경로이며 해당 파일들은 이미 worktree 내 존재 (`benefit.md`, `board.md`, `cpik.md`, `member.md`, `order.md`, `product.md`, `shop.md`, `_overview.md`). 파일 경로 충돌 없음.

---

## 요약

`spec/4-nodes/4-integration/5-makeshop.md`가 도입하는 식별자 중 실질적 충돌은 없다. 주목할 사항은 §6 에러 코드 표의 `MAKESHOP_SERVICE_UNAVAILABLE`이다: 동일한 deployment 오류 조건에 대해 Cafe24 노드가 `INTEGRATION_SERVICE_UNAVAILABLE`(공통 코드)을 사용하는 반면 MakeShop 노드는 서비스 고유 코드를 신설하여 클라이언트가 두 코드를 따로 처리해야 하는 불일치가 생긴다. `error-codes.md §1` 원칙("의미 기반·공통 조건은 공통 코드")에 비추어 `INTEGRATION_SERVICE_UNAVAILABLE`로 통일하는 것이 권장되나, 현재 Cafe24 spec 의 코드 표에도 `INTEGRATION_SERVICE_UNAVAILABLE`이 이미 정의되어 있으므로 충돌(같은 이름 다른 의미)이 아니라 일관성 보완 사안이다. 나머지 에러 코드(`MAKESHOP_4XX`, `MAKESHOP_AUTH_FAILED`, `MAKESHOP_RATE_LIMITED` 등)는 `CAFE24_*` 패턴을 도메인 prefix만 교체한 형태로 일관성이 있으며, 새 엔티티명·endpoint·이벤트명·파일 경로 모두 기존 식별자와 중복 없이 예약된 이름 또는 자연스러운 확장으로 확인되었다.

## 위험도

LOW
