# 정식 규약 준수 검토 결과

**대상**: `spec/2-navigation/` (구현 완료 후 검토, diff-base=origin/main)
**검토일**: 2026-06-11

---

## 발견사항

### 문서 구조 규약

- **[WARNING]** `spec/2-navigation/14-execution-history.md` — `## Overview (제품 정의)` 섹션이 비표준 구조
  - target 위치: `14-execution-history.md` 행 18 (`## Overview (제품 정의)`)
  - 위반 규약: CLAUDE.md §정보 저장 위치 — 문서 3섹션 구성 권장 (Overview / 본문 / Rationale). `_product-overview.md` 에 제품 정의를 두거나 진입 문서 `## Overview` 로 써야 한다. 개별 spec 파일이 내부에 `## Overview (제품 정의)` 라는 최상위 섹션을 두고 그 아래 `### 1. 개요` / `### 2. 페이지 구조` / `### 3. 요구사항` 로 하위 계층을 구성하며, 이어서 본문에서 `## 1. 개요` 를 다시 시작하는 이중 계층 구조
  - 상세: 파일 내에 `## Overview (제품 정의)` 블록(§1~§3.3)과 `## 1. 개요`(본문 시작) 가 분리되어 있어 같은 파일에 "제품 개요" 와 "기술 명세 본문" 이 혼재한다. 다른 `spec/2-navigation/` 파일들은 단일 계층 `## 1. 개요 ~ ## N. ... ~ ## Rationale` 패턴을 따르는데, 이 파일만 `## Overview (제품 정의)` 섹션을 앞에 두어 일관성이 깨진다
  - 제안: `## Overview (제품 정의)` 블록을 `_product-overview.md` 의 관련 섹션으로 이동하거나, 해당 내용을 `## 1. 개요` 에 통합하고 `## Overview (제품 정의)` 최상위 섹션을 제거하여 다른 파일과 동일한 구조로 통일한다

- **[INFO]** `spec/2-navigation/15-system-status.md` / `spec/2-navigation/16-agent-memory.md` — `## Overview` 섹션 없이 바로 `## 1.` 로 시작
  - target 위치: `15-system-status.md` 및 `16-agent-memory.md` 각 파일 상단
  - 위반 규약: CLAUDE.md §정보 저장 위치 — "Overview / 본문 / Rationale 3섹션 권장"
  - 상세: `15-system-status.md` 는 전체 목적 설명 없이 `## 1. 화면 구조` 로 곧장 진입하고, `16-agent-memory.md` 도 별도 `## Overview` 없이 인트로 단락(2문장)만 있다. `14-execution-history.md` 는 반대로 Overview 블록이 과도하게 분리되어 있는 반면, 이 두 파일은 Overview 를 갖지 않는다 — 영역 내 3섹션 적용이 파일마다 불일치
  - 제안: 해결을 강제할 CRITICAL 사안은 아니나 일관성을 위해 `## Overview` (또는 `## 개요`) 를 추가하고 1-2 문단 목적 설명을 배치하는 것을 권장한다. 규약 자체를 "권장"으로 명시하고 있으므로 강제 수정 불필요

### 출력 포맷 규약 (API 응답 형식)

- **[WARNING]** `spec/2-navigation/14-execution-history.md` §5 목록 API 응답 예시 — `{ "data": [...], "pagination": {...} }` 구조가 `spec/conventions/swagger.md §5-2` 의 `ApiOkPaginatedResponse` 규약과 부분 불일치
  - target 위치: `14-execution-history.md` §5 "목록 API 응답 형식" JSON 예시 (라인 약 1655-1687)
  - 위반 규약: `spec/5-system/2-api-convention.md §5.2` — 목록 응답은 `{ data: [...], pagination: { page, limit, totalItems, totalPages } }` 구조. `spec/conventions/swagger.md §5-2` — `ApiOkPaginatedResponse` 헬퍼 결과는 `{ data: { data: <Dto>[], pagination: { page, limit, totalItems, totalPages } } }` (이중 래핑) 임을 명시
  - 상세: spec 예시는 `{ "data": [...], "pagination": {...} }` 로 `data` 와 `pagination` 이 최상위에 함께 있다. 그러나 `swagger.md §5-2` 헬퍼 주석에 따르면 실제 응답은 `{ data: { data: <Dto>[], pagination: {...} } }` (TransformInterceptor 가 전체를 한 번 더 `{ data: ... }` 로 감싼다). 같은 파일 §3 의 본문 설명에서는 "응답 형식은 API 규약 §5.2 준수" 라고 참조하며, `api-convention.md §5.2` 의 예시 자체는 `{ data: [...], pagination: {...} }` 이므로 헬퍼 이중 래핑 여부에 혼동이 생기는 지점이다. 최소한 spec 내 JSON 예시와 본문 설명이 실제 서버 응답 포맷과 일치하는지 재확인이 필요하다
  - 제안: `api-convention.md §5.2` 의 예시가 최종 wire-format 인지, TransformInterceptor 래핑 이전 서비스 레이어 shape 인지를 명확히 한다. 명확화 후 `14-execution-history.md` 의 응답 예시가 실제 클라이언트가 받는 포맷을 정확히 반영하도록 조정한다. 이는 spec 내 참조(§3 → `api-convention.md §5.2`) 와 인라인 예시가 다른 계층을 기술하고 있어 생기는 문서 내 불일치다

- **[INFO]** `spec/2-navigation/14-execution-history.md` §5 목록 API 쿼리 파라미터 — `sort` 기본값이 `started_at` 인데 `api-convention.md §4.1` 기본값은 `created_at`
  - target 위치: `14-execution-history.md` §5 쿼리 파라미터 표 (`sort` 행, `started_at` 기본값)
  - 위반 규약: `spec/5-system/2-api-convention.md §4.1` — 기본 `sort` 는 `created_at`
  - 상세: API 규약의 기본값은 `created_at` 이지만 실행 내역은 도메인 특성상 `started_at` 기본 정렬이 합리적이다. 이 차이가 spec 주석이나 Rationale 에서 명시적으로 설명되지 않아 규약 위반인지 의도적 예외인지 판별 불가
  - 제안: `## Rationale` 에 "실행 내역 정렬 기본값은 `started_at` 으로, API 규약 §4.1 기본값(`created_at`) 의 의도적 예외" 임을 한 줄 추가한다. 규약을 갱신할 필요는 없으며 개별 spec 에 예외 근거만 명시하면 족하다

### 명명 규약

- **[INFO]** `spec/2-navigation/16-agent-memory.md` frontmatter `id: nav-agent-memory` — 다른 `spec/2-navigation/` 파일들과 id prefix 불일치
  - target 위치: `16-agent-memory.md` frontmatter `id: nav-agent-memory`
  - 위반 규약: 명시적 id 명명 규약은 `spec/conventions/` 에 없으나, 동일 폴더 내 파일들(`id: dashboard`, `id: workflow-list`, `id: trigger-list`, `id: auth-flow` 등)은 모두 prefix 없는 짧은 slug 를 사용한다
  - 상세: `nav-` prefix 가 붙어 다른 파일들과 패턴이 다르다. `spec-impl-evidence.md` 등의 `id` 필드를 파싱하는 도구가 있을 경우 필터링 결과가 달라질 수 있다
  - 제안: 도구 영향이 없다면 INFO 수준에서 `agent-memory` 로 통일하는 것을 고려한다. 단 breaking 변경이 아니므로 즉각 수정 의무는 없다

### 금지 항목 확인

- **[INFO]** `spec/2-navigation/10-auth-flow.md` §5.4 에러 코드 — `invalid_state`, `token_exchange_failed`, `email_required`, `server_error` 가 `lower_snake_case`
  - target 위치: `10-auth-flow.md` §5.4 OAuth 에러 처리 표
  - 위반 규약: `spec/conventions/error-codes.md §1` — 에러 코드는 `UPPER_SNAKE_CASE`. 단, `§3` Historical-artifact 예외 레지스트리에 OAuth 흐름 에러가 등록되어 있는지 여부 확인 필요
  - 상세: `spec/conventions/error-codes.md §3` 예외 레지스트리에는 초대 흐름의 `invitation_*`, `forbidden`, `rate_limited` 만 등록되어 있고, OAuth 콜백 에러 코드(`invalid_state`, `token_exchange_failed`, `email_required`, `server_error`)는 등록되어 있지 않다. 이 코드들이 실제로 클라이언트가 분기에 사용하는 값이라면 Historical-artifact 레지스트리에 등록이 누락된 것이다
  - 제안: (a) 해당 OAuth 에러 코드들이 `lower_snake_case` 로 클라이언트(`/callback` 페이지)가 분기에 사용한다면 `spec/conventions/error-codes.md §3` 예외 레지스트리에 등록한다. (b) 아직 프론트엔드 문자열 비교가 없다면 UPPER_SNAKE_CASE 로 정규화한다

---

## 요약

`spec/2-navigation/` 의 대부분 파일은 명명·API 엔드포인트 경로·응답 래퍼(`{ "data": ... }`) 등 주요 정식 규약을 잘 준수하고 있다. 주된 우려 사항은 두 가지다. 첫째, `14-execution-history.md` 가 `## Overview (제품 정의)` 최상위 섹션과 기술 명세 본문을 동일 파일에 중첩하여 다른 파일들과 문서 구조가 불일치한다(WARNING). 둘째, OAuth 콜백 에러 코드(`invalid_state` 등)가 `lower_snake_case` 이면서 `spec/conventions/error-codes.md §3` 예외 레지스트리에 미등록 상태라 규약 준수 여부가 불명확하다(INFO, 사용 확인 후 WARNING으로 상향 가능). API 응답 포맷 예시의 이중 래핑 불일치(WARNING)는 실제 와이어 포맷을 재확인하여 해소해야 한다. CRITICAL 위반은 발견되지 않았다.

---

## 위험도

LOW
