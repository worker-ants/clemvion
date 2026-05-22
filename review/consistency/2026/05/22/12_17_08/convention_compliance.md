# 정식 규약 준수 검토 결과

검토 모드: 구현 착수 전 (`--impl-prep`)
검토 범위: `spec/2-navigation/`
검토 일시: 2026-05-22

---

## 발견사항

### [INFO] `14-execution-history.md` — 문서 3섹션 구조 혼용

- target 위치: `spec/2-navigation/14-execution-history.md` 전체 구조
- 위반 규약: `CLAUDE.md` §정보 저장 위치 — "결정의 배경·근거는 해당 spec 문서 끝의 `## Rationale`" + 각 SKILL.md 의 "3섹션 권장(Overview / 본문 / Rationale)"
- 상세: `14-execution-history.md` 는 PRD 를 흡수한 경위로 `## Overview (제품 정의)` 섹션이 문서 상단에 있고, 그 아래 다시 `## 1. 개요` 로 기술 명세 본문이 시작된다. 3섹션 권장(Overview / 본문 / Rationale)에서 Overview 와 본문이 `## Overview` + `## 1. 개요` 두 개의 헤더로 중복 분리되어 있어 읽는 이에게 혼동을 줄 수 있다.
- 제안: `## Overview (제품 정의)` 블록을 `## 1. 개요` 로 통합하거나, 혹은 PRD 출처임을 인라인 callout 으로 처리하고 헤더 레벨을 통일한다. 단, 현재 구조는 기능적으로 동작하므로 우선순위는 낮다.

---

### [INFO] `12-workflow-version-history.md` — `## Rationale` 섹션 미존재

- target 위치: `spec/2-navigation/12-workflow-version-history.md` 전체
- 위반 규약: `CLAUDE.md` §정보 저장 위치 — "결정의 배경·근거는 해당 spec 문서 끝의 `## Rationale`"
- 상세: 문서에 주목할 만한 설계 결정(캔버스 저장 시 자동 버전 생성, 불변 스냅샷, `ON DELETE CASCADE` 정책 등)이 포함되어 있으나 `## Rationale` 섹션이 없다. 결정 근거가 본문 산문 안에 흩어져 있다.
- 제안: 캔버스 저장과 버전 생성의 원자성 보장 방식, `ON DELETE CASCADE` 선택 이유 등 결정적 설계 사항을 `## Rationale` 로 분리하여 추가한다.

---

### [INFO] `13-user-guide.md` — `## Rationale` 섹션 미존재

- target 위치: `spec/2-navigation/13-user-guide.md` 전체
- 위반 규약: `CLAUDE.md` §정보 저장 위치 — "결정의 배경·근거는 해당 spec 문서 끝의 `## Rationale`"
- 상세: 주목할 만한 설계 결정(외부 docs 사이트 대신 `/docs` 내장, FAQ `99-faq` prefix 로 항상 최하단 배치 등)이 있으나 `## Rationale` 섹션이 없다.
- 제안: `/docs` 경로를 외부 사이트 대신 제품 내장으로 선택한 이유, `99-faq` prefix 규칙의 근거 등을 `## Rationale` 로 분리한다.

---

### [INFO] `11-error-empty-states.md` — `## Rationale` 섹션 미존재

- target 위치: `spec/2-navigation/11-error-empty-states.md` 전체
- 위반 규약: `CLAUDE.md` §정보 저장 위치 — "결정의 배경·근거는 해당 spec 문서 끝의 `## Rationale`"
- 상세: 사이드바 표시/숨김 결정(401 은 숨김, 403/404/500 은 표시) 같은 설계 판단이 포함되어 있으나 근거 섹션 없음.
- 제안: 사이드바 표시 분기 이유 등을 `## Rationale` 로 분리한다.

---

### [WARNING] `2-trigger-list.md` §3 API — `DELETE /api/triggers/:id` 응답 코드 명시 누락

- target 위치: `spec/2-navigation/2-trigger-list.md` §3 API 표 + §4.4 결과·에러
- 위반 규약: `spec/conventions/swagger.md` §2-4 "상태 코드 응답 규칙" — DELETE 성공은 `204 No Content` 를 `@ApiNoContentResponse` 로 명시해야 함
- 상세: §4.4 에 "성공: `204 No Content` (응답 본문 없음, 표준 패턴)" 이 산문 형태로 기술되어 있으나, §3 API 표의 `DELETE /api/triggers/:id` 행에는 응답 코드가 명시되어 있지 않다. 구현 시 개발자가 §4.4 를 별도로 확인해야 하는 정보 분산이 발생한다.
- 제안: §3 API 표의 DELETE 행에 "응답: 204 No Content" 를 비고 컬럼에 명시하거나, 또는 §3 에 응답 코드 컬럼을 추가하여 GET/POST/PATCH/DELETE 를 일관되게 표기한다. 기존 다른 spec 문서(예: `1-workflow-list.md`)가 응답 코드를 표에 미포함하고 있으므로 규약 자체 강화가 필요하면 `spec/conventions/swagger.md` 에 "spec 문서 API 표 형식" 절을 추가하는 것도 검토한다.

---

### [WARNING] `2-trigger-list.md` §3 — `PATCH /api/triggers/:id/toggle` 멱등성 기술 불일치

- target 위치: `spec/2-navigation/2-trigger-list.md` §3 API 본문 주석 + Rationale R-4
- 위반 규약: 직접적으로 위반하는 규약 파일은 없으나, `spec/conventions/swagger.md` §2-4 의 HTTP method 의미론 — PATCH 는 부분 갱신이며 멱등(idempotent) 이 아님
- 상세: §3 본문 주석에 "`/toggle` 은 … idempotent — 매 호출마다 부정 토글이 아니라 백엔드가 현재 상태와 반대로 set" 이라고 기술되어 있다. 그러나 `/toggle` 에 PATCH 메서드를 사용하면서 "매 호출마다 현재 상태의 반대로 set" 한다면 이는 멱등성이 아니다 (True → False → True 연속 호출 시 결과가 달라짐). 이는 R-4 의 "idempotent" 표현과 모순된다.
- 제안: `PATCH /api/triggers/:id/toggle` 본문 설명에서 "idempotent" 표현을 제거하거나 "현재 상태와 반대로 토글 (non-idempotent)" 로 명확히 정정한다. 또는 toggle 동작을 `{ isActive: boolean }` 명시적 body 를 요구하는 방식으로 변경하여 실제로 멱등하게 만들고 그 내용을 spec 에 반영한다.

---

### [WARNING] `14-execution-history.md` §5 — 목록 API 응답 형식이 `spec/5-system/2-api-convention.md` 위임과 불일치 가능

- target 위치: `spec/2-navigation/14-execution-history.md` §5 "목록 API 응답 형식" JSON 예시
- 위반 규약: `spec/2-navigation/14-execution-history.md` §5 자체에서 "[API 규약 §5.2](../5-system/2-api-convention.md#52-목록-응답) 준수" 를 명시하면서도, 동일 섹션에 독자적인 응답 JSON 예시를 제공하고 있어 `spec/conventions/swagger.md` §5-2 `ApiOkPaginatedResponse` 래퍼 스키마(`{ data: { data: <Dto>[], pagination: { page, limit, totalItems, totalPages } } }`)와의 정합을 별도 검증해야 함
- 상세: §5 의 응답 예시는 `{ "data": [...], "pagination": { ... } }` 구조다. `spec/conventions/swagger.md` §5-2 는 `ApiOkPaginatedResponse` 가 `{ data: { data: <Dto>[], pagination: { ... } } }` — 즉 `data` 안에 다시 `data` 와 `pagination` 을 감싸는 이중 구조임을 보여준다. 만약 `TransformInterceptor` 가 `{ data: <serviceReturn> }` 로 감싸는 구조라면 서비스 반환값 `{ data: [], pagination: {} }` 이 최종적으로 `{ data: { data: [], pagination: {} } }` 가 된다. 현재 §5 예시는 이 이중 래핑이 없는 형태로 되어 있어, 실제 API 응답 최상위 구조를 단일 계층으로 가정하고 있는지 이중 계층인지가 불분명하다.
- 제안: `spec/5-system/2-api-convention.md §5.2` 의 정확한 응답 shape 를 §5 예시에서도 동일하게 표기하거나, "응답 형식은 API 규약 §5.2 를 따르므로 별도 예시 생략" 처리하여 단일 진실을 유지한다. 두 곳에 서로 다른 표현이 남으면 구현 시 혼동이 생긴다.

---

### [INFO] `2-trigger-list.md` §2.3 — 삭제 confirmation 이름 타이핑 패턴을 convention 으로 끌어올리는 추적 항목

- target 위치: `spec/2-navigation/2-trigger-list.md` §4.2 "오삭제 방지" 문단
- 위반 규약: 직접 위반은 아님. `CLAUDE.md` §정보 저장 위치 — "정식 규약은 `spec/conventions/<name>.md`"
- 상세: §4.2 본문에 "(본 spec 이 이 패턴을 최초 도입; 후속 spec 정비 PR 에서 `spec/2-navigation/_layout.md` 또는 별 convention 으로 끌어올린다)" 라는 TODO 주석이 인라인으로 포함되어 있다. 이 패턴은 현재 이 문서에서만 로컬 규약으로 존재하며, 다른 곳에서 같은 UI 패턴이 중복·불일치 구현될 수 있다.
- 제안: 이 TODO 가 실행 전에 구현이 시작되면 `_layout.md` 또는 신규 convention 파일이 없는 상태에서 개발자가 패턴을 임의로 해석할 수 있다. 구현 착수 전에 `spec/2-navigation/_layout.md` 의 "위험 행동 확인 다이얼로그" 절에 이름 타이핑 패턴을 추가하도록 `project-planner` 에 위임하는 것을 권장한다.

---

### [INFO] `0-dashboard.md` — `## Rationale` 섹션 미존재

- target 위치: `spec/2-navigation/0-dashboard.md` 전체
- 위반 규약: `CLAUDE.md` §정보 저장 위치 — 문서 끝 `## Rationale` 권장
- 상세: 설계 결정 사항(요약 카드 4종 선정 기준, Recent Executions 10건 표시 한도 등)이 있으나 Rationale 섹션 없음.
- 제안: 주요 설계 결정 근거를 `## Rationale` 로 분리하거나, 간단한 문서면 생략 가능 (INFO 등급이므로 blocking 아님).

---

### [INFO] `10-auth-flow.md` — `GET /api/auth/verify-email` vs `POST /api/auth/verify-email` 메서드 불일치

- target 위치: `spec/2-navigation/10-auth-flow.md` §2.5 "이메일 인증 링크 클릭 → `GET /api/auth/verify-email?token={token}`" 와 §8 API 표의 `POST /api/auth/verify-email`
- 위반 규약: 단일 진실 원칙 (`CLAUDE.md` §정보 저장 위치)
- 상세: §2.5 본문에서는 "이메일 인증 링크 클릭 → `GET /api/auth/verify-email?token={token}`" 으로 GET 메서드를 기술하고, §8 API 표에서는 동일 경로에 `POST` 메서드를 기술한다. 같은 문서 내에서 동일 엔드포인트의 HTTP 메서드가 일치하지 않는다.
- 제안: 이메일 클라이언트 링크 클릭은 일반적으로 GET 요청이므로 §8 의 `POST` 를 `GET` 으로 수정하거나, token 을 query string 이 아닌 request body 로 받는 의도라면 §2.5 본문을 `POST` 로 수정하고 링크 클릭 → JS 처리 흐름을 명시한다.

---

## 요약

`spec/2-navigation/` 전체 문서를 `spec/conventions/` 의 정식 규약 관점에서 검토한 결과, 규약을 직접 깨는 CRITICAL 위반은 발견되지 않았다. 주요 발견사항은 두 가지 WARNING 과 여섯 가지 INFO 이다.

WARNING 수준으로는 (1) `2-trigger-list.md` 의 `/toggle` 엔드포인트에 "idempotent" 라는 잘못된 표현이 있어 구현 시 혼동 가능성이 있고, (2) `14-execution-history.md` 의 목록 API 응답 JSON 예시가 `spec/conventions/swagger.md §5-2` 의 `ApiOkPaginatedResponse` 이중 래퍼 구조와 정합하는지 확인이 필요하다. INFO 수준에서는 `0-dashboard.md`, `11-error-empty-states.md`, `12-workflow-version-history.md`, `13-user-guide.md` 등 여러 spec 문서에 `## Rationale` 섹션이 없고, `10-auth-flow.md` 내에 동일 엔드포인트의 HTTP 메서드가 GET/POST 로 이중 기술되어 있다.

`2-trigger-list.md` 는 이번 구현 대상(`triggers-edit-delete-suite`)과 직접 연관된 문서로, `/toggle` 멱등성 표현 오류(WARNING)와 `DELETE` 응답 코드 표기 분산(WARNING)을 구현 착수 전에 정정하면 구현·테스트 단계에서의 혼동을 예방할 수 있다.

---

## 위험도

**LOW**
