# Cross-Spec 일관성 검토 — Cafe24 Public 흐름 중복 가드 + precheck endpoint

대상 draft: `plan/in-progress/spec-draft-cafe24-public-dup-guard.md`
대상 spec: `spec/2-navigation/4-integration.md` §9.2, §9.4, Rationale

---

## 발견사항

### 1. [WARNING] §9.2 begin 행 기술 범위 vs. 현행 spec 기술 범위 불일치

- **target 위치**: 변경 1 — §9.2 `POST /api/integrations/oauth/begin` ※ 문구 교체
- **충돌 대상**: `spec/2-navigation/4-integration.md` line 696 (§9.2 begin 행 현행 본문)
- **상세**: 현행 begin 행의 ※ 문구는 **"Cafe24 Private 흐름 진입 시"** 에 한정해 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 사전 가드를 설명한다. draft 신규 문구는 **"Cafe24 흐름 진입 시 (app_type 무관 — public/private 모두)"** 로 범위를 확장하면서, Public 흐름은 `connected` row 만 차단하고 다른 status(`pending_install`/`expired`/`error`)는 begin 단계에서 차단하지 않는다고 명시한다. 이 비대칭(Public begin = connected 한정, Private begin = 어떤 status든) 이 draft 본문 자체에 설명되어 있으나, 동일 §9.2 표 내의 **Cafe24 Private begin 행의 기술이 변경되지 않는다**. 현행 Private begin 행은 "이미 존재하면 (`app_type` 무관 — public 이든 private 이든) begin 자체가 ... 즉시 거부" 로 묘사되어 있어, 독자가 Private 흐름도 connected 한정 사전 가드를 적용하는지 아니면 전체 status 차단인지 혼동할 수 있다. draft Rationale에서 "다른 status(pending_install/expired/error)는 begin 단계에서 차단하지 않고"라고 쓰인 문장이 Public 한정인지 Public+Private 모두인지 begin 행 텍스트만으로는 특정이 어렵다.
- **제안**: begin 행의 ※ 문구에 "(Public 흐름: `connected` row 차단. Private 흐름: 현행 유지 — 어떤 status든 동일 mall_id 가 존재하면 거부)" 와 같이 흐름별 가드 조건을 명시적으로 분리해 서술한다. 또는 Public/Private begin 가드 조건을 별도 열(또는 sub-bullet)로 구조화한다.

---

### 2. [WARNING] precheck 응답의 `existingIntegrationId` 노출과 정보 최소화 원칙 간 잠재 충돌

- **target 위치**: 변경 2 — `GET /api/integrations/cafe24/precheck` 응답 shape `{ conflict: bool, existingIntegrationId?: string, existingName?: string, status? }`
- **충돌 대상**: `spec/2-navigation/4-integration.md` §5.8 (Cafe24 자격 증명·토큰·timestamps 비노출 원칙), `spec/1-data-model.md` §2.10 Integration 엔티티 RBAC 원칙, `spec/2-navigation/4-integration.md` §9.2 `GET /api/integrations/:id` (credentials 마스킹)
- **상세**: draft는 "자격 증명·토큰·timestamps 미노출"이라고 명시하나, `existingIntegrationId`(UUID)와 `existingName`(사용자 지정 별칭) 노출은 별도 분석이 필요하다. `GET /api/integrations` 목록은 인증된 현재 workspace 의 통합만 반환하는 정상 경로가 있다. precheck가 동일 workspace 기준으로만 응답한다면 목록 API와 동일 데이터를 다른 경로로 재노출하는 것이지만, 현행 spec 어디에도 "읽기 권한이 있는 사용자라면 Integration UUID를 경량 조회 경로로 획득해도 된다"는 명시적 허용이 없다. 특히 향후 Organization-scope Integration이 도입될 경우(§3.3 Viewer 역할) Viewer가 precheck로 다른 멤버의 통합 UUID를 조회하는 경로가 열릴 수 있다.
- **제안**: (a) precheck 응답에서 `existingIntegrationId`를 제거하고 `conflict: true`와 `status`만 반환하거나, (b) `existingIntegrationId` 노출 범위를 spec에 명시(현재 workspace 의 caller가 `GET /api/integrations/:id` 로 접근 가능한 row 한정). 이후 Organization-scope 도입 시 재검토 필요 여부를 Rationale에 명기한다.

---

### 3. [WARNING] precheck throttle 60/min 과 기존 API 일반 rate limit 100/min 간 명시적 관계 부재

- **target 위치**: 변경 2 — precheck throttle 60/min
- **충돌 대상**: `spec/5-system/2-api-convention.md` "일반 API: 100 req/min (사용자 기준)"
- **상세**: API 규약은 일반 API를 100/min으로 정의한다. precheck는 60/min으로 더 낮은 throttle을 적용하는데, 이것이 (a) 일반 rate limit에 더해 적용되는 **엔드포인트별 추가 throttle**인지, (b) 일반 rate limit를 대체하는 **이 엔드포인트 전용 상한**인지 spec 어디에도 명시되지 않는다. 두 throttle이 동시 적용되면 실질 한도는 60/min, 일반 limit 대체이면 100/min 대신 60/min이 된다. 구현 일관성 위험이 있다.
- **제안**: precheck 항목에 "일반 API rate limit(100/min)에 더해 엔드포인트별 60/min 추가 제한 적용" 또는 "일반 limit 대신 이 엔드포인트는 60/min" 중 하나를 명확히 기술한다. `spec/5-system/2-api-convention.md`에 "엔드포인트별 throttle 오버라이드" 정책이 없으면 해당 규약 문서에도 패턴을 추가하는 것을 권장한다.

---

### 4. [INFO] `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 에러 코드 이름과 확장 의미 간 명명 비일관성

- **target 위치**: 변경 3 — §9.4 errors `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 행 신규 설명
- **충돌 대상**: `spec/conventions/swagger.md` §2-4 (에러 코드 명명 원칙), `spec/2-navigation/4-integration.md` Rationale "CAFE24_PRIVATE_APP_ALREADY_CONNECTED 의 mall_id 비교 경로"
- **상세**: draft는 "코드 이름의 `PRIVATE` 토큰은 historical artifact"라고 Rationale에 설명하고 클라이언트는 코드 이름이 아닌 의미로 분기해야 한다고 명시한다. 그러나 API 에러 코드는 클라이언트 코드에 하드코딩되는 계약 식별자다. 코드 이름이 의미와 다르다는 것을 spec Rationale에서만 설명하고 코드 자체를 유지하면, 향후 유지보수 시 잘못된 이해를 야기할 수 있다. 또한 swagger.md는 에러 코드 명명 원칙에 대한 별도 기술이 없어 이 코드가 규약 예외인지 일반 패턴인지 불분명하다.
- **제안**: INFO 수준이므로 차단 불필요. 단, Rationale에 "이 코드는 Public/Private 양쪽을 커버하도록 의미가 확장되었으나 하위 호환을 위해 코드값을 유지한다"는 명시적 결정 문장을 추가하는 것을 권장한다. 더 나아가 `CAFE24_MALL_ALREADY_CONNECTED` 등 중립 명칭으로의 rename(deprecation alias 병행)도 장기 검토 대상으로 기록한다.

---

### 5. [INFO] §9.2 표의 라우트 선언 순서 주의사항 — spec 위치 적합성

- **target 위치**: 변경 4 Rationale "precheck endpoint — mall_id 입력 단계 사전 감지 UX" 항 — "라우트 선언 순서 주의" 문단
- **충돌 대상**: `spec/5-system/2-api-convention.md` (NestJS 라우팅 규약), `spec/0-overview.md` §2.4 (계층 책임 — backend 구현 세부)
- **상세**: Rationale에 NestJS 라우트 선언 순서(`@Get('cafe24/precheck')` vs `@Get(':id')`)를 spec 문서에 직접 기술한 것은 spec보다 구현 주석 영역에 해당하는 내용이다. 현행 spec 규약에서 "구현 세부는 spec 아닌 코드 주석에" 라는 명시적 원칙은 없으나, 특정 NestJS 데코레이터 선언 순서를 spec Rationale에 박는 것은 다른 영역(data-flow, auth 등) 의 Rationale 서술 수준과 일관성이 낮다.
- **제안**: Rationale 문단을 "정적 경로(`cafe24/precheck`)가 동적 경로(`:id`)보다 먼저 선언되어야 한다" 수준의 API 설계 원칙으로 요약하고, NestJS 데코레이터 명시는 코드 주석으로 이동한다. draft가 "controller 코드 주석에 회귀 안전망으로 명시"라고 이미 언급하고 있으므로 spec 본문에서는 원칙만 남기고 구현 세부를 제거하면 충분하다.

---

### 6. [INFO] `spec/data-flow/5-integration.md` 변경 없음 주장 — precheck 쿼리 흐름 미반영 여부

- **target 위치**: 변경 사항 "영향 분석" 표 — `spec/data-flow/5-integration.md` 변경 없음
- **충돌 대상**: `spec/data-flow/5-integration.md` §1.4 OAuth 만료 스캐너 / Integration 도메인 흐름
- **상세**: `spec/data-flow/5-integration.md`는 Integration 도메인의 SELECT/INSERT/UPDATE 흐름을 관리한다. precheck는 `(workspace_id, mall_id)` 조건으로 Integration 테이블을 SELECT하는 새 흐름이다. 현행 data-flow spec이 "precheck SELECT 흐름"을 명시적으로 다루지 않아도 구현상 문제는 없지만, spec 단일 진실 원칙에 따르면 새 SELECT 경로가 data-flow spec에 기록되어야 한다. draft의 "변경 없음" 주장은 이 gap을 인식하지 못하거나 의도적으로 생략한 것일 수 있다.
- **제안**: data-flow spec에 "precheck SELECT" 항목을 추가하거나, draft의 영향 분석 표에 "data-flow spec — precheck SELECT 흐름 추가 권장" 주석을 달아 후속 업데이트 필요성을 명시한다.

---

## 요약

Cross-Spec 일관성 관점에서 이번 draft는 기존 spec과 직접 모순되는 CRITICAL 항목은 없다. 데이터 모델(`mall_id`, `status` Enum, V045/V046 부분 UNIQUE)·에러 코드(`CAFE24_PRIVATE_APP_ALREADY_CONNECTED`)·swagger 규약(409 충돌) 등 핵심 계약은 기존 spec과 부합한다. 다만 WARNING 3건이 존재한다: (1) begin 행의 Public/Private 가드 조건 비대칭이 하나의 ※ 문구 안에 혼재해 독자가 흐름별 차단 조건을 혼동할 수 있고, (2) precheck 응답의 `existingIntegrationId` 노출이 Organization-scope 도입 후 정보 최소화 원칙과 충돌할 잠재 위험이 있으며, (3) precheck throttle 60/min과 일반 API rate limit 100/min의 중첩 적용 여부가 불명확하다. 이 세 항목은 spec 채택 전 명확히 해소하거나 draft에 결정 근거를 추가해야 구현 팀과 미래 유지보수자 간 혼선을 방지할 수 있다.

---

## 위험도

MEDIUM

---

*생성 시각: 2026-05-16 | 검토 대상: `plan/in-progress/spec-draft-cafe24-public-dup-guard.md` → `spec/2-navigation/4-integration.md`*
