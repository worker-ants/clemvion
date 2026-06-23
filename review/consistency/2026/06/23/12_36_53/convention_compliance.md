# 정식 규약 준수 검토 결과

검토 대상: `spec/2-navigation` (구현 완료 후 검토, diff-base=origin/main)
검토 일시: 2026-06-23

---

## 발견사항

### [INFO] `14-execution-history.md` — Overview/본문/Rationale 3섹션 구성 불일치
- target 위치: `spec/2-navigation/14-execution-history.md` — 파일 전반 구조
- 위반 규약: CLAUDE.md §정보 저장 위치 — "Overview / 본문 / Rationale 3섹션 권장"
- 상세: 대부분의 `spec/2-navigation/` 문서는 한국어 `## 1. 개요` 등 본문 섹션을 바로 시작하는데, `14-execution-history.md` 만 `## Overview (제품 정의)` 라는 별도 영문 헤딩 절을 본문 앞에 두고 있다. 다른 파일들(`0-dashboard.md`, `1-workflow-list.md`, `10-auth-flow.md` 등)은 이 별도 Overview 절 없이 바로 본문으로 진입하며, `_product-overview.md` 가 PRD 제품 정의를 담당하도록 역할 분리되어 있다. 이 파일만 제품 정의 섹션을 인라인으로 포함하는 구조가 영역 내 불일치를 만든다.
- 제안: `## Overview (제품 정의)` 절의 배경·목표·요구사항 내용을 `spec/2-navigation/_product-overview.md` 에 이관하고, 본 파일은 기술 명세(`## 1. 개요` 이하)만 보유하도록 통일한다. 또는 반대로 다른 파일들도 Overview 절을 도입하는 방향으로 영역 규약을 갱신해야 한다.

---

### [INFO] `15-system-status.md` — 문서 구조에서 `## Overview` 섹션 누락
- target 위치: `spec/2-navigation/15-system-status.md` — 파일 전체
- 위반 규약: CLAUDE.md §정보 저장 위치 — "Overview / 본문 / Rationale 3섹션 권장"
- 상세: `15-system-status.md` 는 `## 1. 화면 구조` 로 바로 시작하며 별도 Overview 절이 없다. CLAUDE.md 는 Overview / 본문 / Rationale 3섹션을 권장한다. 파일 상단의 한 줄 산문("전체 시스템(BullMQ 큐)이 정상 운영 중인지를 집계 지표로 보여주는 읽기 전용 status 화면")이 개요 역할을 하지만 공식 `## Overview` 헤딩이 없다. `14-execution-history.md` 처럼 명시적 Overview 절을 갖거나, 영역 컨벤션상 인라인 산문으로 허용하는지 명시가 필요하다.
- 제안: INFO 수준이므로 즉시 수정 필수는 아님. 규약 갱신(영역 내 Overview 생략 허용 명시) 또는 해당 파일에 `## Overview` 헤딩 추가 중 선택.

---

### [INFO] `16-agent-memory.md` — frontmatter `id` 가 basename 불일치 패턴 (의도 확인 권장)
- target 위치: `spec/2-navigation/16-agent-memory.md` frontmatter `id: nav-agent-memory`
- 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1` — "id: 파일 basename(확장자 제외) 기반 권장. 같은 basename 이 영역을 달리해 중복될 때는 후발 문서가 영역 prefix 로 충돌을 회피한다"
- 상세: `spec-impl-evidence.md §2.1` 은 이 패턴을 명시적으로 허용하며 `nav-agent-memory` 예시까지 들고 있다 (`spec/5-system/17-agent-memory.md` 가 `agent-memory` 를 점유 → `spec/2-navigation/16-agent-memory.md` 는 `nav-agent-memory`). 따라서 규약 위반이 아니라 의도된 패턴이다.
- 제안: 이미 spec-impl-evidence 에 명시된 허용 패턴이므로 변경 불필요. 확인 목적의 INFO.

---

### [INFO] `14-execution-history.md §5` 목록 응답 예시 — `pagination` 래퍼 구조 추가 확인 필요
- target 위치: `spec/2-navigation/14-execution-history.md §5` "목록 API 응답 형식" 코드 블록 (lines 1643–1677)
- 위반 규약: `spec/5-system/2-api-convention.md §5.2` 목록 응답 — `{ "data": [...], "pagination": { ... } }`
- 상세: `14-execution-history.md §5` 의 응답 예시는 `{ "data": [...], "pagination": { "page", "limit", "totalItems", "totalPages" } }` 구조를 보여주며 API 규약 §5.2 와 일치한다. swagger 헬퍼 `ApiOkPaginatedResponse` 의 스키마도 `{ data: { data: [...], pagination: ... } }` 가 아닌 `{ data: [...], pagination: ... }` 이어야 한다(`swagger.md §5-2` — `ApiOkPaginatedResponse` 는 `{ data: <Dto>[], pagination: { page, limit, totalItems, totalPages } }` 형태). 두 사양이 일치하므로 실질 위반 없음. 다만 swagger.md §5-2 의 `ApiOkPaginatedResponse` 설명에서 "응답 wrapping" 항이 `{ data: { data: <Dto>[], pagination: ... } }` 로 두 번 중첩된 것처럼 읽힐 수 있어 혼동 가능성이 있다.
- 제안: 14-execution-history.md 응답 예시 자체는 규약 준수. swagger.md §5-2 의 `ApiOkPaginatedResponse` 설명 문구가 "이중 data 래퍼" 처럼 읽히는 부분은 swagger.md 내에서 명확화 고려(본 검토 target 밖 이슈이므로 INFO로 기록).

---

### [INFO] `10-auth-flow.md §5.4` OAuth error query param — historical-artifact 레지스트리 등재 확인
- target 위치: `spec/2-navigation/10-auth-flow.md §5.4` OAuth 에러 처리, 인라인 노트
- 위반 규약: `spec/conventions/error-codes.md §1` — 에러 코드 `UPPER_SNAKE_CASE` 표기
- 상세: `10-auth-flow.md §5.4` 의 `invalid_state`·`token_exchange_failed`·`email_required`·`server_error` 는 `lower_snake_case` 이다. 그러나 이 파일 자체에서 "응답 봉투의 `error.code` 가 아닌 redirect URL query param 값"임을 명시하고 `spec/conventions/error-codes.md §3` historical-artifact 레지스트리에 이미 등재되어 있다(`[에러 코드 규약 §3 historical-artifact 레지스트리](../conventions/error-codes.md#3-historical-artifact-예외-레지스트리) 등재`). 따라서 규약 위반이 아니라 의도적 예외 등록이다.
- 제안: 이미 처리된 상태. 변경 불필요. 확인 목적의 INFO.

---

### [INFO] `13-user-guide.md` — 3섹션 중 `## Rationale` 가 단일 항목만 포함
- target 위치: `spec/2-navigation/13-user-guide.md §Rationale`
- 위반 규약: CLAUDE.md §정보 저장 위치 — Rationale 섹션 권장
- 상세: `13-user-guide.md` 는 `## Rationale` 에 `R-1` 하나만 포함한다. CLAUDE.md 는 Rationale 섹션을 권장하며 이 파일은 이미 준수하고 있다. INFO 기록용.
- 제안: 변경 불필요.

---

## 요약

`spec/2-navigation` 영역의 spec 문서들은 전반적으로 정식 규약(frontmatter `id`/`status`/`code:`, `_product-overview.md`·`_layout.md` 구조, API 응답 형식, 에러 코드 표기, swagger DTO 명명 패턴)을 잘 준수하고 있다. CRITICAL 또는 WARNING 등급의 규약 직접 위반은 발견되지 않았다. 주요 관찰 사항은 두 가지다: (1) `14-execution-history.md` 가 제품 정의 Overview 절을 파일 본문에 인라인으로 포함한 반면 나머지 파일들은 그렇지 않아 영역 내 문서 구조 일관성이 떨어지며, (2) `15-system-status.md` 의 개요가 공식 `## Overview` 헤딩 없이 단문으로만 제공된다. 두 항목 모두 권장 3섹션 구성에서의 소소한 불일치이며, 에러 코드 lower_snake_case, `id` prefix 충돌 회피 등 규약 예외로 보일 수 있는 패턴들은 이미 해당 convention 문서에 명시적으로 등재·허용되어 있다.

## 위험도

LOW
