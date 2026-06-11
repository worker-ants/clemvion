# 정식 규약 준수 검토 결과

검토 대상: `spec/4-nodes/4-integration/` (0-common.md, 1-http-request.md, 2-database-query.md, 3-send-email.md, 4-cafe24.md — 일부, 카탈로그 파일 포함)
검토 기준: `spec/conventions/node-output.md`, `spec/conventions/spec-impl-evidence.md`, `spec/conventions/error-codes.md`, CLAUDE.md 명명 규약

---

## 발견사항

### 1. [WARNING] `node-output.md Principle 3.1` 과 D4 결정의 SSRF 분류 불일치

- **target 위치**: `1-http-request.md §5.8`, `0-common.md §4.2 D4 결정`, `2-database-query.md §4 SSRF 가드`, `3-send-email.md §4 step 7`
- **위반 규약**: `spec/conventions/node-output.md Principle 3.1` — "Pre-flight 에러 (config 오류, credential 누락, **SSRF 차단** 등) → `throw` → 엔진이 실행 실패로 마킹"
- **상세**: Principle 3.1 은 SSRF 차단을 명시적으로 "Pre-flight 에러" (`throw`) 로 분류한다. 그러나 D4 결정은 SSRF 차단(`HTTP_BLOCKED`, `EMAIL_HOST_BLOCKED`, DB `INTEGRATION_CALL_FAILED`) 모두를 `port: 'error'` 라우팅으로 재정의했다. 1-http-request.md §5.8 은 "종전 throw 였으나 D4 이후 본 경로" 를 명시하고 있으나, CONVENTIONS 문서 자체의 Principle 3.1 예시 문구("SSRF 차단 등")는 갱신되지 않은 상태다. 이 divergence 는 향후 규약을 참조하는 새 노드가 잘못된 선례를 따를 위험을 만든다.
- **제안**: target 문서가 직접 위반한 것이 아니라 **conventions 자체가 갱신되어야 한다** — `spec/conventions/node-output.md Principle 3.1` 의 "Pre-flight 에러" 예시에서 "SSRF 차단"을 제거하거나 "(단, D4 이후 Integration 노드의 execute() 안 SSRF 차단은 Runtime 에러 경로로 라우팅 — `node-output.md §3.1` 예외)" 각주를 추가. 또는 target 문서에 "본 결정이 Principle 3.1 의 Pre-flight 분류 예외임" 을 명시 (Rationale 내 기재).

---

### 2. [WARNING] `2-database-query.md §5.8` 에 `INTEGRATION_NOT_FOUND` 코드 언급 — `0-common.md §4.2` 불일치

- **target 위치**: `2-database-query.md §5.8` — "execute() 안의 모든 IntegrationError / 파라미터 파싱 실패" 목록에 `INTEGRATION_NOT_FOUND` 코드 열거
- **위반 규약**: `spec/conventions/node-output.md Principle 3.2` (UPPER_SNAKE_CASE 에러 코드 표준), `spec/4-nodes/4-integration/0-common.md §4.2` — "별도의 `INTEGRATION_NOT_FOUND` 코드는 현재 코드에 존재하지 않는다"
- **상세**: `0-common.md §4.2` 는 "integrationId 부재/소속 오류 시 `requireEntity` 가 `NotFoundException({ code: 'RESOURCE_NOT_FOUND' })` 를 throw → IntegrationError 가 아니므로 `INTEGRATION_CALL_FAILED` 로 surface. 별도의 `INTEGRATION_NOT_FOUND` 코드는 현재 코드에 존재하지 않는다" 고 명확히 기술한다. 그러나 `2-database-query.md §5.8` 은 `execute()` 가 라우팅하는 코드 목록에 `INTEGRATION_NOT_FOUND` 를 포함하고, `§6.2` 에러 코드 표의 `INTEGRATION_*` 항목 설명도 `INTEGRATION_NOT_FOUND` 를 surface 가능한 것처럼 나열한다. 이는 공통 규약 SoT 와 개별 노드 문서 간 모순이다.
- **제안**: `2-database-query.md §5.8` 및 `§6.2` 의 `INTEGRATION_NOT_FOUND` 언급을 제거하고, `0-common.md §4.2` 와 동일하게 "integrationId 부재는 `INTEGRATION_CALL_FAILED` 로 흡수" 로 통일. 또는 0-common.md 에 준하는 각주("현재 `INTEGRATION_NOT_FOUND` 코드는 미존재") 삽입.

---

### 3. [INFO] `0-common.md §3` — "CONVENTIONS Principle 7 / §3" 참조 표기 부정확

- **target 위치**: `0-common.md §3 공통 출력 구조` 첫 문장
- **위반 규약**: `spec/conventions/node-output.md` — Principle 7 은 config echo 원칙, §3 이라는 절 번호는 `node-output.md` 내에 없음 (Principle 3 = 에러 컨트랙트)
- **상세**: "CONVENTIONS Principle 7 / §3 의 nested envelope" 문구에서 "§3" 이 모호하다. `node-output.md` 는 절(section) 번호 체계를 쓰지 않고 "Principle N" 체계를 사용한다. 의도가 Principle 0 (5필드 invariant) + Principle 7 (config echo) 복합 참조였다면 표기를 "CONVENTIONS Principle 0 · Principle 7" 로 수정해야 명확하다. 현재 "§3" 은 `0-common.md` 자신의 §3 절을 가리키는 것처럼 읽힌다.
- **제안**: `0-common.md §3` 첫 문장을 "CONVENTIONS Principle 0 (5필드 invariant) · Principle 7 (config echo) 를 따른다" 로 수정.

---

### 4. [INFO] `0-common.md` — `## Rationale` 섹션 미존재

- **target 위치**: `spec/4-nodes/4-integration/0-common.md` 전체
- **위반 규약**: CLAUDE.md "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`"; `project-planner/SKILL.md §Spec 문서 구조 (3섹션 권장)` — Overview / 본문 / Rationale 3섹션 권장
- **상세**: `0-common.md` 는 `## Rationale` 절 없이 `## 7. 출력 구조 색인` 으로 끝난다. `§6.1 meta.durationMs 명명 통일` 이 Breaking change 결정이고, `§4.2 D4 결정` 도 주요 아키텍처 결정이다. 두 결정에 대한 근거가 본문 inline 비고로만 기술되고 Rationale 섹션으로 격리되지 않았다. 다른 노드 문서(1-http-request.md §8, 2-database-query.md Rationale, 3-send-email.md §8)는 모두 Rationale 절을 보유한다.
- **제안**: `0-common.md` 끝에 `## Rationale` 절을 추가하고, `§6.1 meta.durationMs 통일` 결정과 `D4 전 인증 방식 공통 SSRF/error-port 라우팅` 결정 근거를 이전.

---

### 5. [INFO] `spec/conventions/cafe24-api-catalog/application/appstore-orders.md` — `order` wrapper 설명 오류

- **target 위치**: `application/appstore-orders.md` §Operations "GET…" 응답 표 첫 행 `order` 필드 설명
- **위반 규약**: `spec/conventions/cafe24-api-catalog/_overview.md §7.2` — "property list 에 없는 wrapper 는 `(응답 객체)`/`(목록)`" 형식
- **상세**: `order` wrapper 행의 `설명` 컬럼이 "(응답 객체)" 대신 "정렬 순서 asc : 순차정렬 · desc : 역순 정렬" 로 잘못 채워졌다. `order` 는 응답 최상위 래퍼 객체로 `order` (정렬 방향) 필드와 동명이지만 다른 개념이다. `POST /appstore/orders` 응답 표의 `order` 행도 동일 오류다. 이는 `_overview.md §7.2` 의 "property list 에 없는 wrapper 는 `(응답 객체)`/`(목록)`" 규약 위반이다.
- **제안**: `application/appstore-orders.md` 의 두 응답 표에서 wrapper `order` 행 설명을 "(응답 객체)" 로 정정.

---

## 요약

`spec/4-nodes/4-integration/` 의 핵심 spec 문서(0-common ~ 3-send-email)는 전반적으로 `spec/conventions/node-output.md` 의 5필드 invariant·config echo·에러 컨트랙트 규약을 올바르게 참조하고 있다. frontmatter `id`/`status`/`code`/`pending_plans` 도 `spec-impl-evidence.md` 규약에 부합한다. 주요 우려 사항은 두 가지다: (1) D4 결정이 `node-output.md Principle 3.1` 의 "SSRF 차단 → Pre-flight throw" 분류 예시와 충돌하는데 conventions 문서 자체가 갱신되지 않은 상태로 규약 불일치가 잠재 — conventions 갱신이 필요하다. (2) `2-database-query.md` 가 `INTEGRATION_NOT_FOUND` 코드를 surface 가능한 것처럼 기술하나 `0-common.md §4.2` SoT 는 해당 코드가 미존재함을 명시 — 노드 문서가 공통 SoT 를 잘못 따른 단독 오류다. 카탈로그 필드 문서(application/appstore-orders.md)에 wrapper 행 설명 오류 1건이 있으나 카탈로그는 생성기 산출물 특성상 이 오류가 파싱 시점에 혼입된 것으로 보인다.

## 위험도

LOW
