# 정식 규약 준수 검토 결과

target: `spec/5-system/14-external-interaction-api.md`
mode: spec draft 검토 (--spec)

---

## 발견사항

### [INFO] 문서 구조 — Overview 섹션 헤딩 번호 혼용
- target 위치: 파일 시작부 `## Overview (제품 정의)` 내부에 `### 1. 개요`, `### 2. 사용 시나리오`
- 위반 규약: CLAUDE.md 정보 저장 위치 — spec 문서는 Overview / 본문 / Rationale 3섹션 구성 권장
- 상세: Overview 섹션 내에 별도 번호(1. 개요, 2. 사용 시나리오)가 부여돼 있고, 이후 본문의 `## 3. 요구사항` 이 번호를 이어받는다. `## Overview` 가 섹션이면서 동시에 번호 체계가 혼재하여 Overview 와 본문의 경계가 헤딩만 봐서는 불분명하다.
- 제안: Overview 섹션 내부 하위 제목들을 번호 없는 형태로 두거나, 전체 번호 체계에서 Overview 섹션 헤딩을 unnumbered 로 분리. 단순 형식 문제이며 의미 위반 없음.

### [INFO] 에러 응답 포맷 — requestId 필드 예시 범위 불명확
- target 위치: §5.1 에러 응답 표 이후 §5.2~§5.5 섹션
- 위반 규약: `spec/5-system/2-api-convention.md §5.3` — 에러 응답은 `{ "error": { "code", "message", "requestId", "details" } }` 형식. requestId 는 모든 에러 응답에 항상 포함.
- 상세: §5.1 에러 응답 예시 JSON 에 `"requestId": "3f2a…"` 가 포함돼 있어 해당 예시는 준수한다. 하지만 §5.2~§5.5 의 에러 시나리오 서술에는 body 예시 없이 HTTP 상태 코드만 나열돼 있어 requestId 포함 여부가 암묵적이다.
- 제안: §5.1 에러 표 상단이나 §5 전문에 "모든 에러 응답은 api-convention §5.3 의 requestId 필드를 포함한다" 를 note 로 추가.

### [INFO] Swagger — 202 Accepted 응답에 ApiAcceptedWrappedResponse 헬퍼 명시 누락
- target 위치: §10.1 Swagger / API 문서 섹션
- 위반 규약: `spec/conventions/swagger.md §5-2` — 202 Accepted 응답은 `ApiAcceptedWrappedResponse(Dto)` 헬퍼 사용.
- 상세: §10.1 이 swagger.md §5-2 를 참조하지만, /interact 와 /cancel 이 202 Accepted + body 를 반환하는 구조임에도 ApiAcceptedWrappedResponse 를 써야 한다는 점이 명시적으로 언급되지 않는다.
- 제안: §10.1 내에 "202 Accepted 엔드포인트는 ApiAcceptedWrappedResponse(Dto) 헬퍼를 사용한다" 를 명시 추가.

### [INFO] API endpoint URL 케밥 케이스 — 준수 확인
- target 위치: §3.2 EIA-IN-05, §3.3 EIA-AU-05/07, §5.4, §5.5
- 위반 규약: `spec/5-system/2-api-convention.md §2.2` — URL 은 케밥 케이스, RPC-style sub-channel action 허용.
- 상세: /api/external/executions/:id/refresh-token, /api/triggers/:id/notification/rotate-secret, /api/triggers/:id/interaction/revoke-token 모두 케밥 케이스이며 §2.2 RPC-style 허용 패턴에 부합. 위반 없음.
- 제안: 없음.

### [WARNING] 에러 코드 — EIA 전용 에러 코드들이 3-error-handling.md 카탈로그에 미등재
- target 위치: §5.1 에러 표 전체 — STATE_MISMATCH, IDEMPOTENCY_KEY_CONFLICT, EXECUTION_TERMINATED, TOO_MANY_CONNECTIONS, TOKEN_REVOKED, TOKEN_SCOPE_MISMATCH, TOKEN_AUDIENCE_MISMATCH, MESSAGE_TOO_LONG
- 위반 규약: `spec/conventions/error-codes.md §1` 적용 범위 ("프로젝트 전체의 에러 코드 문자열"). `spec/5-system/3-error-handling.md §1.5` — WS 코드를 카탈로그 가시성 목적으로 등재하는 선례.
- 상세: EIA 전용 8개 에러 코드가 14-external-interaction-api.md §5.1 및 Rationale §R13/R14 에만 정의돼 있고 3-error-handling.md 의 에러 코드 카탈로그에 등재되지 않았다. 3-error-handling.md §1.5 는 WS-only 에러 코드를 카탈로그 가시성을 위해 별도 절로 등재한다. EIA REST 전용 코드도 동일 패턴으로 카탈로그에 등재되는 것이 일관적이다. 구현 invariant 를 직접 깨지는 않으나 코드 발견성 및 에러 코드 관리 일관성 측면에서 보완이 필요하다.
- 제안: spec/5-system/3-error-handling.md 에 §1.6 EIA REST 전용 에러 코드 절을 추가하고 STATE_MISMATCH(409), EXECUTION_TERMINATED(410), IDEMPOTENCY_KEY_CONFLICT(409), TOO_MANY_CONNECTIONS(429), TOKEN_REVOKED(401), TOKEN_SCOPE_MISMATCH(401), TOKEN_AUDIENCE_MISMATCH(401), MESSAGE_TOO_LONG(400) 을 등재. spec 변경이므로 project-planner 처리.

### [WARNING] 출력 포맷 — execution.ai_message SSE wire 필드명 drift 가 §11 매핑 표에 미반영
- target 위치: §6.5 "SSE wire 필드" note vs §11 이벤트 매핑 표
- 위반 규약: 출력 포맷 규약 관점 — spec 문서 내 이벤트 매핑 표는 완전한 정보를 담아야 한다.
- 상세: SSE wire 의 execution.ai_message 이벤트가 어시스턴트 텍스트를 `message` 필드로 전송하는 반면(WS 와 다름) 이 사실이 §6.5 note 에만 언급되고, §11 이벤트 매핑 표에서 execution.ai_message 행에는 해당 drift 에 대한 cross-ref 가 없다. 매핑 표만 보는 구현자가 필드명 차이를 놓칠 수 있다.
- 제안: §11 의 execution.ai_message 행에 "SSE data: message 필드 (WS 와 필드명 다름 — §6.5 SSE wire 필드 note 참조)" 처럼 footnote 또는 column 추가.

---

## 요약

`spec/5-system/14-external-interaction-api.md` 는 전반적으로 정식 규약을 잘 준수한다. 파일 명명(14- prefix), API endpoint URL 케밥 케이스 및 RPC-style sub-channel 허용 패턴, Bearer scheme 분리(interaction-token 스킴 신설), 에러 응답 봉투 포맷(error.code/message/requestId/details), Swagger 규약 참조, Rationale 섹션 구조 모두 규약에 부합한다. 보완이 필요한 두 항목은 다음과 같다: (1) EIA 전용 에러 코드 8종이 `3-error-handling.md` 카탈로그에 미등재돼 error-codes.md §1 의 "프로젝트 전체" 적용 범위 원칙과 3-error-handling.md §1.5 의 도메인별 등재 선례와 일관성이 떨어지며, (2) `execution.ai_message` SSE wire 필드명(`message`)과 WS 필드명의 drift 가 §6.5 note 에만 기술되고 §11 매핑 표에 cross-ref 가 없어 구현자가 필드명 차이를 놓칠 여지가 있다. 두 항목 모두 구조적 invariant 를 직접 깨는 수준은 아니지만 spec 문서의 완전성을 위해 WARNING 등급으로 보완을 권장한다.

---

## 위험도

LOW
