# Convention Compliance Review — spec/5-system/12-webhook.md

## 발견사항

### 1. [WARNING] Overview 내 하위 섹션 번호와 본문 섹션 번호 충돌

- **target 위치**: `## Overview (제품 정의)` → `#### 3.1 Webhook 엔드포인트` (line 46) 과 `## 3. API 명세` → `### 3.1 Webhook 수신 엔드포인트` (line 172)
- **위반 규약**: project-planner SKILL.md §Spec 문서 구조 (3섹션 권장) — Overview / 본문 / Rationale 3계층을 명확히 분리해야 한다. CLAUDE.md "단일 진실 원칙"에서도 동일하게 명시.
- **상세**: Overview 섹션 내 요구사항 표가 `### 3. 요구사항` → `#### 3.1 Webhook 엔드포인트` 구조를 쓰고, 본문도 `## 3. API 명세` → `### 3.1 Webhook 수신 엔드포인트` 구조를 쓴다. 양측이 "3.1" 번호를 공유하면 Markdown 앵커(`#31-webhook-엔드포인트` 등)가 충돌한다. 실제로 문서 내부 cross-link 가 `#3-요구사항`, `#31-webhook-엔드포인트` 형태로 쓰일 경우 렌더러에 따라 첫 번째 섹션만 매핑된다.
- **제안**: Overview 내 요구사항 하위 섹션 번호를 `#### R3.1`, `#### R3.2` 등 Requirement-prefix 방식으로 구분하거나, Overview 내 번호 계층을 알파벳(`#### 3.a`) 등 본문 번호와 충돌하지 않는 체계로 변경한다.

---

### 2. [WARNING] §6 내 PublicWebhookThrottleGuard SoT 귀속 모호성

- **target 위치**: `## 6. 구현 파일 구조` (line 341) — `(SoT: [Spec 웹채팅 보안 §4](../7-channel-web-chat/4-security.md))`
- **위반 규약**: CLAUDE.md "정보 저장 위치 (단일 진실 원칙)". 한 feature 의 SoT 는 단일 문서여야 한다.
- **상세**: 본 webhook spec §6 은 `publicWebhook.startupPerMinute`, `publicWebhook.hourlyNewMax`, `DEFAULT_MAX_BODY_BYTES` 등 config 키 이름과 기본값을 직접 정의하고 있다. 동시에 `(SoT: [Spec 웹채팅 보안 §4])` 라고 표기해 channel-web-chat/4-security 를 SoT 로 지목한다. 그런데 channel-web-chat/4-security §4 에는 해당 config 키 이름들이 존재하지 않는다 — `분당 10/IP`, `시간당 ≤20` 수치와 Guard 이름만 기술되어 있다. 즉 실질 SoT(config 키·기본값·에러코드 정의)는 webhook spec 안에 있으나, SoT 레이블은 channel-web-chat 를 가리키는 불일치가 존재한다. 3-error-handling §1.7 은 올바르게 `정의·트리거 조건의 SoT 는 [Spec Webhook]` 로 귀속하고 있어 내부 일관성도 깨진다.
- **제안**: `(SoT: ...)` 표기를 제거하거나, `(채널 웹챗 보안 §4 에서 정책 출처; config 키·에러코드 SoT 는 본 §6)` 식으로 역할 분리를 명확히 한다. 또는 webhook spec 이 해당 rate-limit feature 의 단일 SoT 임을 선언하고 channel-web-chat/4-security §4 가 이를 cross-link 하도록 방향을 정리한다.

---

### 3. [INFO] WH-EP-02, WH-MG-02 에서 `endpoint_path` (snake_case) 와 `endpointPath` (camelCase) 혼재

- **target 위치**: `#### 3.1 Webhook 엔드포인트` WH-EP-02 (line 51), WH-MG-02 (line 90)
- **위반 규약**: spec/conventions/audit-actions.md §1 "토큰 구분자" — 필드 식별자 표기는 실제 코드/DB 네이밍 레이어를 따른다. 하이픈·혼합케이스는 금지.
- **상세**: WH-EP-02 의 URL 템플릿 `{base_url}/api/hooks/{endpoint_path}` 는 snake_case, WH-MG-02 는 산문에서 "endpoint_path 자동 생성" 으로 쓴다. 반면 데이터 모델 §2.1 표, API 명세 §3.1, 처리 흐름 §7 전체에서 `endpointPath` (camelCase) 를 일관되게 쓴다. URL 템플릿 내 `{endpoint_path}` 는 플레이스홀더 표기 관례이므로 스타일 선택으로 볼 수 있으나, WH-MG-02 요구사항 문구("endpoint_path 자동 생성")는 동일 필드를 부르는 방식이 불일치한다.
- **제안**: WH-MG-02 의 산문 내 `endpoint_path` 를 `endpointPath` 로 통일한다. URL 템플릿 플레이스홀더 `{endpoint_path}` 는 관례상 허용 가능하나, 주석에서 `(:endpointPath)` 같이 실제 NestJS 라우트 파라미터 이름을 명시하면 혼동을 줄일 수 있다.

---

### 4. [INFO] §3.1 성공 응답 스키마 설명 방식 — swagger.md 래퍼 헬퍼 언급 없음

- **target 위치**: `### 3.1 Webhook 수신 엔드포인트` (line 184-213)
- **위반 규약**: spec/conventions/swagger.md §5-3 "새 엔드포인트 체크리스트" — 202 응답에 `ApiAcceptedWrappedResponse(Dto)` 헬퍼 사용 권장.
- **상세**: §3.1 의 성공 응답 설명은 직접 JSON 스키마를 인라인 기술하며, 대응하는 API 문서 래퍼 데코레이터 패턴(`@ApiAcceptedWrappedResponse`)을 언급하지 않는다. swagger.md 는 "빈 껍데기 인라인 스키마" 를 레거시로 분류하고 DTO 기반 래퍼 사용을 의무로 규정한다(§6 레거시 패턴 제거). Spec 문서가 DTO 패턴을 언급하지 않으면 구현자가 인라인 방식을 택할 수 있다.
- **제안**: §3.1 성공 응답 설명에 `WebhookResponseDto` 또는 기존 `webhook-response.dto.ts` 참조와 함께 `@ApiAcceptedWrappedResponse(WebhookResponseDto)` 사용을 권장 또는 명시한다. 단, spec 문서가 API 데코레이터 구현 세부까지 정의하는 것이 부담이라면 code 경로(`webhook-response.dto.ts`)를 cross-link 하는 것으로 충분하다.

---

## 요약

`spec/5-system/12-webhook.md` 는 frontmatter 필드(`id`, `status`, `code:`, `pending_plans:`) 를 `spec-impl-evidence.md` 규약에 맞게 보유하고 있으며, 에러 코드 명명(`UPPER_SNAKE_CASE`), 응답 봉투 형식(`{ data: ... }`), API convention 참조 모두 정식 규약을 따른다. Rationale 섹션도 충실히 존재한다. 다만 Overview 내부 요구사항 번호 체계(`3.1`, `3.2`)가 본문 API 명세 섹션 번호(`## 3. API 명세 → ### 3.1`)와 동일한 번호를 사용해 앵커 충돌 가능성이 있으며, §6 의 PublicWebhookThrottleGuard SoT 귀속 표기가 실제 config 키·에러코드 정의 위치와 어긋나는 모호함이 존재한다. 이 두 항목은 단일 진실 원칙과 문서 구조 규약 측면에서 정리가 필요하다.

## 위험도

LOW
