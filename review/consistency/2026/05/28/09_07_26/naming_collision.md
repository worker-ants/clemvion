# 신규 식별자 충돌 검토 — integration-activity-api-label

> 검토 모드: `--impl-prep` (scope=`spec/`)
> 검토 일시: 2026-05-28
> 대상 변경 파일: `spec/1-data-model.md`, `spec/2-navigation/4-integration.md`, `spec/4-nodes/4-integration/_product-overview.md`, `spec/4-nodes/4-integration/0-common.md`, `spec/4-nodes/4-integration/1-http-request.md`, `spec/4-nodes/4-integration/2-database-query.md`, `spec/4-nodes/4-integration/3-send-email.md`, `spec/4-nodes/4-integration/4-cafe24.md`, `spec/conventions/cafe24-api-metadata.md`

---

## 발견사항

### [WARNING] `ServiceCatalogDto` 와 신규 "catalog" 개념의 명칭 혼동 위험

- **target 신규 식별자**: `GET /api/integrations/services/:type/catalog` endpoint 및 그 응답 shape `{ operations: Array<{ key, method, path, labelKey, descriptionKey }> }`
- **기존 사용처**: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:138` — `ServiceCatalogDto { services: ServiceCatalogEntryDto[] }`. 이 DTO 는 이미 존재하는 `GET /api/integrations/services` 응답 타입으로, `spec/2-navigation/4-integration.md §9.1` 에도 "지원 서비스 메타데이터" 로 등록되어 있다.
- **상세**: 기존 `ServiceCatalogDto` 는 "어떤 서비스 타입을 통합할 수 있는가" (서비스 종류 목록) 를 담는 반면, 신규 endpoint 의 "catalog" 는 "특정 서비스 타입이 노출하는 operation 목록" 을 담는다. 두 개념 모두 "카탈로그" 라는 단어를 공유하지만 의미 계층이 다르다. 구현 단계에서 신규 endpoint 의 응답 DTO 를 명명할 때 `ServiceCatalogDto` 를 재사용하거나 유사한 이름을 붙일 경우 — 예: `ServiceCatalogDto` vs `OperationCatalogDto` vs `Cafe24CatalogDto` — 혼동이 발생할 수 있다. spec 이 아직 응답 DTO 이름을 명시하지 않아 구현자가 직접 선택해야 한다.
- **제안**: spec `§9.3` 의 신규 endpoint 설명에 응답 DTO 이름을 명시적으로 지정한다. 권장 이름: `OperationCatalogDto` (기존 `ServiceCatalogDto` — 서비스 종류 목록 — 와 명확히 구분). 또는 `ApiCatalogDto`. 기존 `ServiceCatalogDto` 와 이름 충돌은 없지만, 구현 PR 에서 잘못된 이름이 채택되는 회귀를 사전에 차단하려면 spec 에 이름을 못 박아야 한다.

---

### [WARNING] `GET /api/integrations/services/:type/catalog` — NestJS 라우트 선언 순서 위험

- **target 신규 식별자**: `GET /api/integrations/services/:type/catalog`
- **기존 사용처**: `codebase/backend/src/modules/integrations/integrations.controller.ts:111` — `@Get('services')` (정적 경로). 현재 컨트롤러에는 `cafe24/precheck` 가 `:id` 동적 경로보다 앞에 선언되어야 한다는 라우트 순서 주의 주석이 이미 존재한다 (`integrations.controller.ts:211-216`).
- **상세**: 신규 `GET 'services/:type/catalog'` 는 기존 `GET 'services'` 와 prefix 가 `services` 로 동일하다. NestJS(Express 라우터)는 정적 경로 `services` 와 동적 경로 `services/:type/catalog` 를 path 길이 차이 덕분에 정상 구분하므로 직접 충돌은 없다. 그러나 만약 구현자가 `services/:type` 패턴의 다른 route 를 먼저 선언하면, `services/cafe24/catalog` 의 `:type` segment 가 `cafe24` 로 소비된 후 `/catalog` 가 남아 404 를 받는 형태의 오배선 위험이 잠재한다. 이미 `cafe24/precheck` 사례에서 학습한 패턴임에도 spec 에 선언 순서 주의가 기재되어 있지 않다.
- **제안**: `spec/2-navigation/4-integration.md §9.3` 신규 endpoint 행에, "NestJS 선언 순서: 정적 경로 `services` 및 `services/:type/catalog` 는 기존 `cafe24/precheck` 주석(controller 215행)과 동일하게, `:id` 동적 경로보다 앞에 선언할 것. `services/:type` 단독 경로가 추가될 경우 `catalog` sub-path 보다 뒤에 선언할 것" 을 비고로 추가한다.

---

### [INFO] `api` 파라미터 오브젝트 내 `method` / `path` 필드명 — 기존 node output 규약과 중복 가능성

- **target 신규 식별자**: `logUsage()` 신규 파라미터 `api: { label?, method?, path? }` 의 `method` / `path` 키
- **기존 사용처**: `spec/conventions/node-output.md` 의 `output.response` 규약, `spec/4-nodes/4-integration/1-http-request.md` 의 `config.method`, `config.url` (내부 경로 식별에 `path` 사용). 코드베이스 전반에서 `method` / `path` 는 HTTP 개념 그대로 쓰이나, 여기서 `api.path` 는 "HTTP Request 노드의 경우 host+path" 이고 "Database Query 노드의 경우 driver 토큰" 이고 "cafe24 의 경우 path template" 으로 의미가 노드마다 다르다.
- **상세**: 이 비대칭 의미 다중성은 spec 이 이미 INT-US-05 표와 각 노드 spec 에 명시하고 있으므로 spec 레벨에서는 충분히 설명되어 있다. 다만 `logUsage` 호출 인터페이스 상 `api.method` 가 "HTTP method" 인지 "SQL 동사" 인지 "상수 SEND" 인지를 TypeScript 타입 주석 없이 구현자가 판단해야 하므로, 구현 DTO 에서 `method?: string` 이 너무 넓게 잡혀 타입 안전성 부족이 생길 수 있다. 이는 spec 식별자 충돌이 아닌 구현 위험이므로 INFO 등급.
- **제안**: `spec/4-nodes/4-integration/0-common.md §4.1` 의 `api` 파라미터 정의에 TypeScript 타입 힌트를 추가한다 — 예: `method?: string /* HTTP method | SQL verb | 'SEND' */`. 구현 PR 에서 union type 또는 JSDoc 으로 인코딩하면 충분하다.

---

### [INFO] `INT-US-05` — 요구사항 ID 기존 사용 없음, 안전

- **target 신규 식별자**: `INT-US-05`
- **기존 사용처**: `spec/4-nodes/4-integration/_product-overview.md` 의 동일 파일 내 기존 ID 는 `INT-US-01`~`INT-US-04`. `INT-US-05` 는 본 PR 이 처음 부여한 번호.
- **상세**: 기존 ID 와 번호 충돌 없음. INT-US 시리즈는 해당 파일에만 정의되어 있으며, 다른 spec 파일에서 `INT-US-05` 를 다른 의미로 사용한 곳이 없다.
- **제안**: 이상 없음.

---

### [INFO] `clampMessage` 패턴 — 기존 구현 함수 이름과 spec 참조 일치

- **target 신규 식별자**: spec 이 `clampMessage` 라는 구현 패턴 이름을 직접 참조 (`spec/2-navigation/4-integration.md §9.3`, `spec/4-nodes/4-integration/0-common.md §4.1`)
- **기존 사용처**: `codebase/backend/src/modules/integrations/integrations.service.ts:100` — `function clampMessage(raw: string | undefined): string` 가 이미 존재하며 `logUsage` 내부에서 사용 중.
- **상세**: 충돌이 아닌 일치. spec 이 기존 구현 함수 이름을 그대로 참조하여 단일 진실을 맞춤. 다만 구현 파일의 내부 함수가 모듈 레벨로 격상되거나 이름이 바뀔 경우 spec 참조가 stale 해질 수 있다.
- **제안**: 이상 없음. 향후 `clampMessage` 가 공용 유틸로 이동/리네이밍 될 경우 spec 참조 동기화.

---

### [INFO] `ActivityItem` — 프론트엔드 기존 타입 이름 재사용, 필드 확장

- **target 신규 식별자**: `apiLabel`, `apiMethod`, `apiPath` 필드 (기존 `ActivityItem` 인터페이스에 추가)
- **기존 사용처**: `codebase/frontend/src/lib/api/integrations.ts:153` — `export interface ActivityItem` 이 이미 존재하며 현재 `id / integrationId / nodeExecutionId / workflowId / status / error / durationMs / at` 8개 필드만 포함.
- **상세**: 인터페이스 이름 충돌 없음. 기존 `ActivityItem` 에 새 3개 필드를 추가하는 확장이므로 이름 충돌이 아닌 단순 필드 증가. 기존 코드가 `ActivityItem` 을 destructuring 하는 곳이 신규 필드 없이 동작 가능한지(optional 처리 여부)만 구현 시 확인하면 된다.
- **제안**: spec 의 `ActivityItem` shape 정의(`§9.3 (a)` 표)에 `apiLabel`, `apiMethod`, `apiPath` 가 `string | null` 임을 명시하고, 기존 frontend 인터페이스 필드와 타입 일치 여부를 구현 PR 에서 동기화 확인할 것.

---

## 요약

본 PR 이 도입하는 신규 식별자(`api_label` / `api_method` / `api_path` DB 컬럼, `INT-US-05` 요구사항 ID, `GET /api/integrations/services/:type/catalog` endpoint, catalog key 형식 `cafe24.<resource>.<operation>`, `§7.5` 규약 섹션)는 기존 spec 및 코드베이스와 **직접적인 의미 충돌이 없다**. 주요 위험은 두 가지 경고 수준 사항이다. 첫째, 기존 `ServiceCatalogDto` (서비스 종류 목록) 와 신규 endpoint 의 "catalog" (operation 목록) 가 같은 "카탈로그" 단어를 공유해 구현 DTO 명명 시 혼동을 유발할 수 있으며, spec 에 응답 DTO 이름을 명시적으로 지정함으로써 사전 차단할 수 있다. 둘째, 신규 `GET 'services/:type/catalog'` 경로는 기존 NestJS 라우트 선언 순서 규칙(`cafe24/precheck` 사례)과 동일한 위험 패턴을 갖고 있으나, spec 에 순서 주의 비고가 아직 없어 구현 PR 에서 누락될 수 있다.

## 위험도

MEDIUM
