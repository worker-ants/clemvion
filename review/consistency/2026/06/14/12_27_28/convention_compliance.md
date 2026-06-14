# Convention Compliance Review

**Target**: `spec/5-system/14-external-interaction-api.md`
**Mode**: spec draft 검토 (--spec)
**Date**: 2026-06-14

---

## 발견사항

### [INFO] frontmatter `id` 값이 파일 basename 과 불일치
- **target 위치**: frontmatter 1행 `id: external-interaction-api`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — "`id`: 파일 basename(확장자 제외) 기반 권장"
- **상세**: 파일명은 `14-external-interaction-api.md` 이므로 basename 은 `14-external-interaction-api`. 현재 `external-interaction-api` 로 숫자 prefix 가 생략됐다. 규약은 basename 기반을 "권장"(강제 아님)이므로 빌드 가드에 걸리지는 않으나, 같은 basename 충돌 회피 목적의 숫자 prefix 포함 여부가 프로젝트 전반 관행과 일치하는지 확인 필요.
- **제안**: 다른 spec 들도 숫자 prefix 를 `id` 에서 생략하므로 변경 불필요. 프로젝트 전반 일관성을 원하면 `id: 14-external-interaction-api` 로 통일 가능.

---

### [WARNING] API 문서 규약 — `§10.1` Swagger 절에서 응답 DTO·공용 래퍼 헬퍼 의무에 대한 cross-link 누락
- **target 위치**: `§10.1 Swagger / API 문서`
- **위반 규약**: `spec/conventions/swagger.md §5-2·§5-4` — "모든 성공 응답은 응답 DTO 클래스 + 공용 래퍼 헬퍼를 사용", "새 엔드포인트 체크리스트: 응답 DTO 가 `dto/responses/` 에 있는지 / `ApiAcceptedWrappedResponse` 등 적절한 래퍼 사용"
- **상세**: `§10.1` 은 `@ApiBearerAuth('interaction-token')` 등록 방법만 기술하고, 응답 DTO 위치(`dto/responses/*-response.dto.ts`) 및 공용 래퍼 헬퍼(`ApiAcceptedWrappedResponse(Dto)`, `ApiOkWrappedResponse(Dto)` 등)의 사용 의무를 언급하지 않는다. `swagger.md §5-4` 체크리스트는 구현자가 반드시 따라야 할 사항이므로, 본 spec 에서 cross-link 없이 구현에 들어가면 해당 헬퍼 패턴이 누락될 위험이 있다.
- **제안**: `§10.1` 끝에 한 줄 추가: `> 응답 DTO 위치·공용 래퍼 헬퍼 패턴은 [Spec Swagger 규약 §5](../conventions/swagger.md#5-응답-dto-규약) 참조.`

---

### [WARNING] 에러 코드 — 신규 코드 `MESSAGE_TOO_LONG` 에 도메인 prefix 없어 전역 공용 vs EIA-전용 범주 모호
- **target 위치**: `§5.1 에러 응답 표` 행 `400 Bad Request` / `MESSAGE_TOO_LONG`
- **위반 규약**: `spec/conventions/error-codes.md §1` — "도메인 prefix(권장): 도메인 범주화가 의미 있는 코드는 `<DOMAIN>_<CONDITION>` 으로 그룹화"; "신규 코드는 처음부터 의미 정확한 이름을 부여해 후속 rename 압력을 만들지 않는다"
- **상세**: `MESSAGE_TOO_LONG` 은 EIA `submit_message` 진입점 전용 코드다. WS 표면의 `EXECUTION_MESSAGE_TOO_LONG`(평면 ack)과 다른 이름을 채택한 이유가 있지만, `error-codes.md §1` 은 "도메인 범주화가 의미 있는 코드는 prefix 권장"이라 하므로 `EIA_MESSAGE_TOO_LONG` 이 더 정확하다. 반면 `VALIDATION_FAILED`·`INVALID_COMMAND` 같은 범용 코드들은 prefix 없이 사용되는 기존 패턴과 일치한다. `MESSAGE_TOO_LONG` 이 범용으로 재사용 가능한지 EIA-전용인지를 spec 또는 `error-codes.md` 에 명시하지 않은 것이 모호성의 핵심이다.
- **제안**: (a) `EIA_MESSAGE_TOO_LONG` 으로 명명하거나, (b) `MESSAGE_TOO_LONG` 을 시스템 전역 공용 코드로 확정하고 `error-codes.md §1` 에 "시스템 전역 공용" 예시로 등재하라. 신규 코드이므로 rename 비용 없이 지금 수정 가능.

---

### [WARNING] 출력 포맷 규약 — `§5.1` 의 `202 Accepted` 응답 body 기술과 `§5` 서두의 "no-content" 설명이 상충
- **target 위치**: `§5` 서두 주석 "§5.1(interact)는 성공 시 `202 Accepted` + body 없음(no-content path)" 및 `§5.1` 본문의 `202 Accepted` 응답 body `{ "executionId", "accepted", "currentStatus" }`
- **위반 규약**: `spec/conventions/swagger.md §2-4·§2-5` — 상태 코드별 응답 규칙 / 응답 wrapping; `spec/conventions/swagger.md §5-2` — 응답 DTO 클래스 + 공용 래퍼 헬퍼 의무
- **상세**: `§5` 서두가 `§5.1` 을 "봉투 언랩 해당 없음" 예외로 분류한 근거는 body 없음이다. 그러나 `§5.1` 에는 `202 Accepted` 응답 body `{ "executionId": "uuid", "accepted": true, "currentStatus": "running" }` 가 명시돼 있다. 두 기술이 직접 모순되어, 구현자가 body 를 반환해야 하는지 여부를 spec 만으로 결정할 수 없다. 또한 body 가 있다면 `ApiAcceptedWrappedResponse` 헬퍼가 적용돼야 한다.
- **제안**: 아래 둘 중 하나로 통일. (a) 실제 body 를 반환한다면 `§5` 서두의 "body 없음" 예외 설명을 삭제하고 `{ "data": { "executionId", "accepted", "currentStatus" } }` wire format 으로 명시. (b) body 없이 `204 No Content` 를 쓴다면 `§5.1` 의 응답 JSON 블록을 제거하라.

---

### [INFO] 상호 참조 내 anchor 미지정 — `[Spec API 규칙 §5.3](./2-api-convention.md)`
- **target 위치**: `§5.1 에러 응답` 설명 라인 `"응답 body 형식은 [Spec API 규칙 §5.3](./2-api-convention.md) 의 ..."`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §4.2` 표 `spec-link-integrity.test.ts` 관행; 문서 내 다른 cross-link 는 모두 anchor 포함
- **상세**: 동일 문서 내 다른 링크들(`[Spec Webhook §3.1](./12-webhook.md#31-webhook-수신-엔드포인트)`, `[Spec WS §4.1](./6-websocket-protocol.md#41-실행-이벤트-server--client)` 등)은 모두 `#anchor` 를 포함하나, 이 링크만 anchor 가 없다. `spec-link-integrity` 가드는 anchor 없는 링크를 검사하지 않으므로 빌드 차단은 없지만 일관성이 깨진다.
- **제안**: `[Spec API 규칙 §5.3](./2-api-convention.md#53-에러-응답)` 으로 anchor 추가.

---

### [INFO] 문서 구조 — Overview 내부 소절 번호가 본문 최상위 섹션 번호와 연속되어 계층 경계 모호
- **target 위치**: 문서 구조: `## Overview (제품 정의) > ### 1. 개요 > ### 2. 사용 시나리오 > (--- 구분선 후) ## 3. 요구사항`
- **위반 규약**: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" — 명시적 경계 권장
- **상세**: `### 1.`·`### 2.` 가 Overview 내부 소절이고 `## 3.` 이 본문 시작이다. `---` 구분선이 있으나 번호 연속성 때문에 독자가 Overview 범위를 혼동할 수 있다. 단, 이 패턴은 다른 spec 파일에서도 사용되는 기존 관행이다.
- **제안**: `## Overview (제품 정의)` 내 소절을 `### §1 개요`·`### §2 사용 시나리오` 처럼 `§` prefix 로 표기하거나, 본문 섹션을 `## 본문` 시작으로 구분하면 계층이 명확해진다. 강제 변경 불필요하나 신규 spec 작성 지침에 이 패턴을 명시하면 향후 일관성 향상.

---

## 요약

`spec/5-system/14-external-interaction-api.md` 는 전반적으로 정식 규약을 준수한다. frontmatter 구조(`id`/`status: partial`/`code:`/`pending_plans:`)는 `spec-impl-evidence.md` 규약을 충족하며, 문서 3섹션(Overview/본문/Rationale) 구성과 `## Rationale` 위치도 올바르다. `spec/conventions/swagger.md §2-1` 에 따른 `@ApiBearerAuth('interaction-token')` 별도 scheme 등록 명시, 에러 코드의 `UPPER_SNAKE_CASE` 준수, API 응답 봉투(`{ "data": ... }`) 명시 등 주요 규약 항목은 준수 중이다.

주요 개선 대상은 세 가지다: (1) `§10.1` Swagger 절에 응답 DTO·공용 래퍼 헬퍼 cross-link 누락(WARNING), (2) 신규 에러 코드 `MESSAGE_TOO_LONG` 에 도메인 prefix 없어 전역 공용 vs EIA-전용 범주가 모호(WARNING), (3) `§5.1` 의 응답 body 기술과 `§5` 서두의 "no-content" 설명 직접 모순(WARNING). 이 세 항목이 해소되면 규약 준수 상태는 충분하다.

---

## 위험도

**LOW**
