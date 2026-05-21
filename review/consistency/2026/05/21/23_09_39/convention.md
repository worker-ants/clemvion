STATUS: WARN

## Critical

없음.

---

## Warning

### [WARNING] `POST /api/executions/:id/cancel` 응답 코드가 API 컨벤션과 불일치
- **target 위치**: `spec/5-system/14-external-interaction-api.md` §5.4 (줄 335)
- **위반 규약**: `spec/5-system/2-api-convention.md` §6 HTTP 상태 코드 표 — "200 OK: 조회, 수정 성공" / "204 No Content: 삭제 성공"
- **상세**: §5.4 의 cancel 엔드포인트 응답이 `200 OK + { executionId, status: "cancelled" }` 로 정의되어 있다. 이 자체는 컨벤션의 200 범위 안에 있으나, §5.1 의 `/interact` 는 action 실행이라 `202 Accepted` 를 쓰면서 `cancel` 만 `200` 을 쓰는 불일치가 존재한다. cancel 도 내부적으로 비동기 execution.stop 을 발송하는 action 이므로 `202 Accepted` 가 더 정합하다. 현재 spec 내부에서 §3.2(EIA-IN-05) 는 "cancel = interact 의 alias" 라고 했으나 응답 코드는 다르게 명시되어 있다.
- **제안**: §5.4 의 응답 코드를 `202 Accepted` 로 통일하거나, 동기적으로 cancelled 상태가 보장될 경우 그 이유를 Rationale 에 명시. 최소한 §5.4 본문에 "cancel 은 동기 응답(즉시 상태 확인 가능)" 이라는 설명을 추가해 코드 선택 근거를 명시해야 한다.

### [WARNING] Swagger 컨벤션 — interaction token bearer scheme 분리 미정의
- **target 위치**: `spec/5-system/14-external-interaction-api.md` §10 구현 파일 구조
- **위반 규약**: `spec/conventions/swagger.md` §2-1 — `@ApiBearerAuth('access-token')` 은 main.ts 에 등록한 Bearer scheme 이름이며, 보호된 컨트롤러는 이 scheme 을 사용한다.
- **상세**: `/api/executions/:id/interact` / `/stream` / `/cancel` / `/refresh-token` 는 기존 워크스페이스 JWT (`access-token` scheme) 가 아닌 별도 토큰 family (`iext_*`/`itk_*`) 로 인증된다. spec 은 이 사실을 §4·§8.3 에서 명시하지만, §10 구현 파일 구조에서는 Swagger 데코레이터 처리 방향을 전혀 언급하지 않는다. swagger 컨벤션의 `@ApiBearerAuth('access-token')` 을 그대로 붙이면 Swagger UI 에서 잘못된 scheme 으로 문서화된다.
- **제안**: §10 또는 별도 구현 가이드 절에 "`interaction.controller.ts` 는 `@ApiBearerAuth('access-token')` 대신 별도 `@ApiBearerAuth('interaction-token')` scheme (또는 `@ApiSecurity`) 을 사용한다" 는 지침을 추가하거나, swagger 컨벤션에 별도 Bearer scheme 등록 패턴을 추가하도록 규약 갱신을 제안해야 한다.

### [WARNING] 에러 응답 body 형식이 API 컨벤션 구조와 부분 불일치
- **target 위치**: `spec/5-system/14-external-interaction-api.md` §5.1 에러 응답 표, §5.2 규약 절
- **위반 규약**: `spec/5-system/2-api-convention.md` §5.3 — 에러 응답 형식은 `{ "error": { "code": "...", "message": "...", "details": [...] } }` 구조. `spec/5-system/12-webhook.md` §5.2 는 `{ "statusCode": 400, "message": "...", "errors": [...] }` 구조를 이미 사용 중.
- **상세**: 14-external-interaction-api §5.1 의 에러 응답 표는 코드(`VALIDATION_FAILED`, `TOKEN_INVALID` 등)와 조건만 명시하고, 실제 JSON body shape 를 명시하지 않는다. 12-webhook.md §5.2 는 `statusCode / message / errors[]` 형태를 사용하고 있으나, 2-api-convention §5.3 은 `error.code / error.message / error.details[]` 형태를 정의한다. 본 spec 이 어느 쪽을 따를지 명시되어 있지 않아 구현자가 선택해야 하는 상황이다.
- **제안**: §5.1 에러 응답 표에 실제 body shape 를 명시하거나 "에러 body 형식은 API 컨벤션 §5.3 을 따른다" 는 참조를 추가한다. 12-webhook 의 `statusCode/errors` shape 를 계속 쓰는 경우 그 이유를 Rationale 에 명시하고, 2-api-convention 과의 divergence 를 인지한다.

### [WARNING] `conversationConfig` / `conversationThread` 의 `source` 마커 fallback 처리 미언급
- **target 위치**: `spec/5-system/14-external-interaction-api.md` §5.3, §6.2
- **위반 규약**: `spec/conventions/conversation-thread.md` §5.1 — WebSocket emit 결과의 `source` 마커 (`live`/`injected`) 와 §4.4.6 페이로드 전용 2값 표식의 fallback 처리; `spec/conventions/conversation-thread.md` §9 (1차 소스 = `conversationThread.turns`)
- **상세**: §5.3 의 `GET /api/executions/:id` 응답에 `"conversationThread": { ... }` 를 동봉한다고 정의했으나, 이 snapshot 의 `messages[].source` 마커 (`live`/`injected`) 가 누락된 경우의 fallback 처리를 명시하지 않는다. conversation-thread 컨벤션 §5.1 은 "필드 누락 시 `'live'` 로 간주" 폴백을 WebSocket §4.4.6 에 위임하나, 외부 REST 응답 경로에 동일 폴백이 보장되는지 불명확하다. 또한 §6.2 outbound notification 페이로드의 `context.conversationThread` 항목에도 동일 폴백 적용 여부가 언급되지 않는다.
- **제안**: §5.3 응답 정의 또는 §8 보안/신뢰성 절에 "conversationThread.turns 의 `source` 마커 누락 시 conversation-thread §5.1 의 폴백 규약 (`'live'` 로 간주) 을 동일하게 적용한다" 는 명시를 추가한다.

### [WARNING] `GET /api/executions/:executionId` 응답 미래 충돌 — 기존 executions 컨트롤러와 namespace 검증 부재
- **target 위치**: `spec/5-system/14-external-interaction-api.md` §12 호환성 (줄 691)
- **위반 규약**: `spec/5-system/2-api-convention.md` §2.2 명명 규칙 — 중첩 2단계 이내, 3단계 이상은 최상위 분리
- **상세**: §12 호환성 절에서 "기존 `/api/executions/*` 컨트롤러와 충돌 검증 필요" 라고 스스로 언급하고 있다. `GET /api/executions/:id` 와 `GET /api/executions/:id/stream` 등은 기존 실행 이력 API 에서 이미 같은 경로가 사용 중일 가능성이 있다. 이 검증을 "plan §6 e2e" 로 미루고 spec 에서 결론을 내리지 않은 채 채택했다. 충돌이 있으면 CRITICAL 이 된다.
- **제안**: spec 채택 전에 기존 `executions` 컨트롤러의 GET 엔드포인트 목록을 명시하고, 본 spec 의 `/api/executions/:id` (interaction token 인증) 와 기존 `/api/executions/:id` (workspace JWT 인증) 의 routing 분리 방법 (Guard 분기, 별도 prefix, content-negotiation 등) 을 spec 에 결정사항으로 기술해야 한다. 미결 상태로 구현으로 넘기는 것은 convention 상 단일 진실 원칙에 위배된다.

---

## Info

### [INFO] 문서 구조 — `---` 구분선 위치가 타 spec 과 달리 Overview 섹션 경계에 위치하지 않음
- **target 위치**: `spec/5-system/14-external-interaction-api.md` 줄 29 (`---` 다음 바로 `## 3. 요구사항`)
- **위반 규약**: CLAUDE.md 의 "Overview / 본문 / Rationale 3섹션 권장" 패턴 — `## Overview` 이후 본문 진입점이 명확해야 함
- **상세**: `## Overview (제품 정의)` 하위에 §1·§2 가 포함되고, `---` 이후 `## 3. 요구사항` 이 바로 시작된다. 다른 spec 들(`12-webhook.md`)은 Overview → 본문이 명확히 section heading 으로 분리되어 있다. 본 spec 은 §1·§2 가 Overview 소속인지 본문 소속인지 구분이 모호하다.
- **제안**: Overview 섹션을 `## Overview` heading 아래 §1, §2 로 명시하고 `---` 이후 `## 본문` 또는 `## 상세 명세` 같은 heading 을 추가하거나, `## 3. 요구사항` 앞에 명시적으로 "본문" 섹션 구분을 만든다.

### [INFO] SQL 컬럼 명명 — `notification_health` 기본값 문자열 enum 이 DB 타입 미명시
- **target 위치**: `spec/5-system/14-external-interaction-api.md` §7.1 ALTER TABLE (줄 495-499)
- **위반 규약**: `spec/conventions/migrations.md` §1 명명 규약 — 실제 마이그레이션 작성 가이드는 `codebase/backend/migrations/README.md` 에 위임하나, 컬럼 type 을 `VARCHAR(16)` 로만 쓰고 PostgreSQL `CHECK` 제약이나 `ENUM` 타입 정의가 없다.
- **상세**: `notification_health VARCHAR(16) NOT NULL DEFAULT 'unknown'` 는 허용 값(`unknown`/`healthy`/`degraded`) 을 DB 레벨에서 강제하지 않는다. 마이그레이션 README 의 가이드(NOT NULL, DEFAULT, CHECK constraint 패턴) 와 정합하지 않을 수 있다.
- **제안**: `CHECK (notification_health IN ('unknown', 'healthy', 'degraded'))` 제약을 ALTER 문에 추가하거나, 본 spec 의 SQL 예시는 "개념 설명용" 이라고 명시하고 실제 제약은 migration README 가이드를 따르도록 안내한다.

### [INFO] ID prefix `EIA-*` 의 기존 prefix 충돌 여부 — 명시적 검증 미포함
- **target 위치**: `spec/5-system/14-external-interaction-api.md` §3 요구사항 표들 (EIA-NX-*, EIA-IN-*, EIA-AU-*, EIA-RL-*, EIA-NF-*)
- **위반 규약**: CLAUDE.md 의 "단일 진실 원칙" — ID prefix 는 기존 요구사항 IDs 와 충돌 없어야 함
- **상세**: 기존 prefix 목록(WH, AI, EH, FB, ND 등) 에 `EIA` 는 없으므로 충돌은 없는 것으로 판단되나, 공식 prefix 레지스트리가 spec 어디에도 존재하지 않는다. 본 spec 이 `EIA` 를 "확정" 했다는 기록이 없다.
- **제안**: prefix 레지스트리 역할을 하는 문서(예: `spec/0-overview.md` 또는 `spec/conventions/` 내 별도 파일)에 `EIA` 를 공식 등록하거나, 본 spec Rationale 에 "기존 prefix 와 충돌 없음 확인" 을 명시한다.

### [INFO] i18n 컨벤션 — API 응답 텍스트의 i18n 키 미정의는 허용 범위
- **target 위치**: 해당 없음 (spec 전반)
- **위반 규약**: `spec/conventions/i18n-userguide.md` Principle 1 — UI 문자열은 dict 키 경유
- **상세**: 본 spec 은 `message: "Webhook received, workflow execution started"` 같은 영문 상수를 API 응답 문자열로 정의한다. i18n 컨벤션의 적용 대상은 프론트엔드 TSX 하드코딩이며, API 응답 문자열은 직접 적용 범위가 아니므로 위반은 아니다. 단, 이 문자열이 프론트엔드에서 사용자에게 직접 노출된다면 i18n 처리가 필요하다.
- **제안**: 필요 없으면 무시 가능. API 에러 메시지를 UI 에서 toast 등으로 직접 노출하는 경우 i18n 키 경유 여부를 구현 phase 에서 확인한다.

### [INFO] `spec/5-system/4-execution-engine.md` 수정 — cross-link 한 줄만 추가, 별도 검토 불필요
- **target 위치**: `spec/5-system/4-execution-engine.md` (MOD)
- **위반 규약**: 해당 없음
- **상세**: common-context 에 따르면 헤더 cross-link 한 줄만 추가된 변경이다. 컨벤션 위반 소지 없음.
- **제안**: 해당 없음.

---

## 요약

`spec/5-system/14-external-interaction-api.md` (신규 924줄) 는 전반적으로 규약을 잘 따르고 있다. `# Spec: ...` 헤더, `> 관련 문서:` 링크, `## Overview`, 본문, `## Rationale` 구조가 준수되어 있고, `EIA-*` prefix 는 기존 것과 충돌하지 않으며, SQL 컬럼 명명은 snake_case 이다. `spec/5-system/12-webhook.md` 와 `6-websocket-protocol.md` 수정도 cross-link 및 요구사항 추가 수준으로 컨벤션 위반 없다. 주요 경고 사항은 (1) `POST /cancel` 의 응답 코드(`200` vs `202`) 불일치, (2) Swagger 컨벤션에서 별도 토큰 scheme 처리 방안 미기술, (3) 에러 응답 body shape 미명시로 인한 12-webhook 과의 불일치, (4) 기존 `/api/executions/:id` 컨트롤러와의 routing 충돌 결론 미확정이다. CRITICAL 급 위반은 없으나 위 4개 WARNING 을 해소하지 않고 구현으로 넘어가면 구현 단계에서 재작업 가능성이 높다.

## 위험도

MEDIUM

STATUS: WARN
