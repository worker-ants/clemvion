# Convention Compliance Review — `spec/2-navigation/`

검토 모드: 구현 착수 전 검토 (--impl-prep, scope=spec/2-navigation/)
검토 일자: 2026-06-10

---

## 발견사항

### 1. 문서 구조 규약

- **[WARNING]** `14-execution-history.md` — Overview 섹션 구조 이중화
  - target 위치: `spec/2-navigation/14-execution-history.md` 의 `## Overview (제품 정의)` 블록 (prompt 내 lines 1242–1314)
  - 위반 규약: CLAUDE.md "문서 구조 규약" — spec 문서는 Overview / 본문 / Rationale 3섹션 권장. 정보 저장 위치 표: "제품 정의·요구사항 → `_product-overview.md` 또는 진입 문서의 `## Overview`"
  - 상세: `14-execution-history.md` 는 `## Overview (제품 정의)` 제목 아래 §1~§3 요구사항(EH-LIST-*, EH-DETAIL-*, EH-NAV-*) 블록을 두고, 그 아래 다시 `## 1. 개요`~`## 7. 라우팅` 구조의 본문 섹션을 반복한다. 결과적으로 문서 내에 두 개의 "§1 개요"(Product-level 과 Spec-level)가 공존한다. 다른 파일(0-dashboard.md, 10-auth-flow.md 등)은 Overview 섹션 없이 직접 본문을 시작한다.
  - 제안: Product-level 요구사항(Overview 섹션 내 §1~§3)은 `_product-overview.md` 로 이동하거나, 본 파일 안에서 `## Overview` 하나로 통합 후 본문과 구분선만 사용한다. 동일 번호의 `## 1.` 섹션이 두 번 나타나지 않도록 섹션 번호를 재정리한다.

- **[INFO]** `spec/2-navigation/` 일부 파일 — Rationale 섹션 누락
  - target 위치: `spec/2-navigation/16-agent-memory.md` — `## Rationale` 있음(단락형). `spec/2-navigation/15-system-status.md` — `## Rationale` 있음(R-1~R-3). `spec/2-navigation/13-user-guide.md` — `## Rationale` 있음(R-1). 단, `spec/2-navigation/11-error-empty-states.md` 는 `## Rationale` 있음.
  - 위반 규약: CLAUDE.md "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`" (권고)
  - 상세: 모든 파일에 Rationale 섹션이 있으므로 준수. INFO 등급으로 기록만 함.
  - 제안: 현재 준수 중. 추가 조치 불필요.

---

### 2. Frontmatter 규약 (spec-impl-evidence)

- **[CRITICAL]** `spec/2-navigation/14-execution-history.md` — `status: implemented` 이지만 실제로는 `## Overview` 안 요구사항 구조가 spec-only 단계의 산물처럼 잔존
  - target 위치: `spec/2-navigation/14-execution-history.md` frontmatter
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §3` — `status: implemented` 는 "모든 약속 구현 완료" 를 의미하며 `pending_plans:` 가 없어야 한다. 반면 `status: partial` 이면 `pending_plans:` 가 의무.
  - 상세: 현재 frontmatter 의 `status: implemented` 와 `pending_plans:` 부재는 규약에 부합한다. 그러나 이것은 CRITICAL 이 아니라 아래의 별도 WARNING 항목으로 재분류한다. (본 CRITICAL 항목은 삭제, 아래 WARNING 으로 처리.)

  실제로 frontmatter 위반은 발견되지 않았다. 위 CRITICAL 초안을 취소한다.

- **[WARNING]** `spec/2-navigation/1-workflow-list.md` — `pending_plans` 경로가 현재 유효한지 확인 필요
  - target 위치: `spec/2-navigation/1-workflow-list.md` frontmatter `pending_plans: - plan/in-progress/spec-sync-workflow-list-gaps.md`
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §4` — `spec-pending-plan-existence.test.ts` 가드: `pending_plans:` 의 모든 path 가 `plan/in-progress/` 또는 `plan/complete/`(in-progress→complete 치환) 에 실존 의무.
  - 상세: 이 검토는 정적 파일 내용 확인이므로 `plan/in-progress/spec-sync-workflow-list-gaps.md` 실존 여부는 build 가드가 강제하나, 구현 착수 전 검토 시점에 해당 plan 파일이 실제로 존재하는지 확인이 필요하다.
  - 제안: `plan/in-progress/spec-sync-workflow-list-gaps.md` 파일 존재를 확인. 미존재 시 `plan/complete/` 로 이동됐거나 삭제됐다면 frontmatter 경로 갱신 필요.

---

### 3. API 응답 포맷 규약

- **[WARNING]** `spec/2-navigation/14-execution-history.md` — 목록 API 응답 예시의 페이지네이션 구조가 `spec/conventions/swagger.md §5-2` 공용 래퍼와 불일치
  - target 위치: `spec/2-navigation/14-execution-history.md §5` 목록 API 응답 형식 JSON 예시 (prompt lines 1655–1687)
  - 위반 규약: `spec/conventions/swagger.md §5-2` `ApiOkPaginatedResponse` 헬퍼 반환 스키마: `{ data: { data: <Dto>[], pagination: { page, limit, totalItems, totalPages } } }` (공용 `PaginatedResponseDto` 형태). 또한 `spec/2-navigation/1-workflow-list.md §3` 에서 "페이지네이션 응답 형식은 [API 규약 §5.2](../5-system/2-api-convention.md#52-목록-응답) 준수" 로 명시.
  - 상세: `14-execution-history.md §5` 의 응답 예시는:
    ```json
    {
      "data": [...],
      "pagination": { "page":1, "limit":20, "totalItems":87, "totalPages":5 }
    }
    ```
    이 형태는 `{ data: { data: <Dto>[], pagination: {...} } }` 이 아니라 최상위에 `data` 배열과 `pagination` 객체가 나란히 있는 구조다. `TransformInterceptor` 가 응답을 `{ data: ... }` 로 감싸면 실제 wire 포맷은 `{ data: { data: [...], pagination: {...} } }` 가 된다. spec 예시가 이미 래퍼 안의 형태를 보여주는 것인지 (다른 문서들이 "아래 예시는 `data` 내부 형태다" 라는 주석을 달듯이) 명시가 없어 독자가 혼동할 수 있다.
  - 제안: `0-dashboard.md §7` 처럼 "응답 본문은 공통 래퍼(`{ \"data\": ... }`)로 감싸진다. 아래 예시는 `data` 내부 형태다." 안내 문구를 추가하거나, 예시를 `ApiOkPaginatedResponse` 스키마(`{ data: { data:[...], pagination:{...} } }`)의 전체 형태로 표기한다.

- **[INFO]** `spec/2-navigation/0-dashboard.md §7` — 응답 예시 래퍼 안내 명시적으로 기재됨 (규약 준수 확인)
  - target 위치: `spec/2-navigation/0-dashboard.md §7` 상단 주석
  - 위반 규약: 없음. 규약 준수 상태.
  - 상세: `"> 응답 본문은 공통 래퍼(`{ "data": ... }`)로 감싸진다. 아래 예시는 `data` 내부 형태다."` 로 명확히 안내. 다른 파일들도 이 패턴을 따르도록 권장.

---

### 4. 에러 코드 명명 규약

- **[WARNING]** `spec/2-navigation/1-workflow-list.md §3.1` — 에러 코드 `RESOURCE_CONFLICT` 와 세부 코드 `TRIGGER_ENDPOINT_PATH_CONFLICT` 가 다른 파일에 혼재
  - target 위치: `spec/2-navigation/2-trigger-list.md §2.3.1` 내 `TRIGGER_ENDPOINT_PATH_CONFLICT` (prompt lines 1982)
  - 위반 규약: `spec/conventions/error-codes.md §1` — "에러 코드 이름은 조건의 의미를 기술한다." UPPER_SNAKE_CASE. 세부 코드(`TRIGGER_ENDPOINT_PATH_CONFLICT`)는 도메인 prefix + 조건 형식으로 의미 명확.
  - 상세: `TRIGGER_ENDPOINT_PATH_CONFLICT` 는 규약 §1 의 "도메인 prefix `<DOMAIN>_<CONDITION>`" 패턴을 따르므로 명명 자체는 적합하다. 단, `spec/2-navigation/1-workflow-list.md §3.1` 의 폴더 삭제 409 에러는 `RESOURCE_CONFLICT` 로만 표기되어 있어, 동일 계층의 에러 코드 명시 수준이 파일마다 다르다.
  - 제안: 규약 위반은 아니나, 상세 코드(`세부 코드` 형식)를 선택적으로 노출하는 정책을 spec 문서에서 일관되게 처리. 현재 상태는 WARNING 수준.

---

### 5. 명명 규약 (파일명·식별자)

- **[INFO]** `spec/2-navigation/` 파일 prefix 규약 준수 여부
  - target 위치: 디렉토리 파일 목록
  - 위반 규약: CLAUDE.md "정보 저장 위치" — `_product-overview.md` (밑줄 prefix = layout/index 성격) 및 `0-` prefix(cross-cutting 진입) 규약.
  - 상세: `_product-overview.md`, `_layout.md` 는 밑줄 prefix 규약 준수. `0-dashboard.md` 는 `0-` prefix 사용. 숫자 prefix 파일명(`1-workflow-list.md`, `2-trigger-list.md` 등)은 CLAUDE.md 에 명시적 금지 규칙이 없으며, `0-` 이외 순서 번호 prefix 사용도 타 영역(`spec/4-nodes/`, `spec/5-system/`) 에서 동일하게 사용된다. 규약 위반 없음.
  - 제안: 현재 준수. 추가 조치 불필요.

- **[INFO]** Frontmatter `id` 값과 파일명 일치 여부
  - target 위치: 검토 대상 모든 파일의 frontmatter `id:` 필드
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1` — "`id`: spec 식별자. 파일 basename(확장자 제외) 기반 권장"
  - 상세: `0-dashboard.md` → `id: dashboard`, `1-workflow-list.md` → `id: workflow-list`, `10-auth-flow.md` → `id: auth-flow`, `11-error-empty-states.md` → `id: error-empty-states`, `13-user-guide.md` → `id: user-guide`, `14-execution-history.md` → `id: execution-history`, `15-system-status.md` → `id: system-status`, `16-agent-memory.md` → `id: nav-agent-memory`, `2-trigger-list.md` → `id: trigger-list`.
  - `16-agent-memory.md` 의 경우 `id: nav-agent-memory` 로 파일명 `16-agent-memory` 와 약간 다르다(`nav-` prefix 추가). 이는 규약("파일 basename 기반 **권장**")의 권고 수준 위반이므로 강제 위반은 아니나 불일치.
  - 제안: `id: agent-memory` 또는 `id: nav-agent-memory` 중 일관성을 위해 파일명 기반인 `agent-memory` 로 통일 고려. 단 build 가드 통과에는 영향 없음.

---

### 6. API 문서 규약 (Swagger/OpenAPI)

- **[INFO]** 응답 DTO 위치 참조 일관성
  - target 위치: `spec/2-navigation/0-dashboard.md §7` — `DashboardSummaryDto` 참조
  - 위반 규약: `spec/conventions/swagger.md §5-1` — 응답 DTO 위치는 `codebase/backend/src/modules/<module>/dto/responses/*-response.dto.ts`
  - 상세: `0-dashboard.md` frontmatter `code:` 에 `codebase/backend/src/modules/dashboard/dto/responses/dashboard-response.dto.ts` 가 명시되어 있어 규약에 부합. `14-execution-history.md` frontmatter `code:` 에도 `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts` 포함. 규약 준수.
  - 제안: 현재 준수. 추가 조치 불필요.

---

## 요약

`spec/2-navigation/` 의 대부분 문서는 정식 규약(`spec/conventions/`)을 전반적으로 준수하고 있다. Frontmatter `id`/`status`/`code:` 구조는 `spec-impl-evidence.md` 규약에 부합하고, `_product-overview.md`·`_layout.md` 파일 명명도 CLAUDE.md 규약을 따른다. 다만 두 가지 주요 유의점이 있다: `14-execution-history.md` 는 `## Overview (제품 정의)` 와 `## 1. 개요` 가 중복 구조로 공존하여 타 파일과 구조가 불일치하고(WARNING), `14-execution-history.md §5` 의 목록 API 응답 예시는 공용 PaginatedResponse 래퍼 안내 문구가 누락되어 `TransformInterceptor` 래핑 여부가 불명확하다(WARNING). `16-agent-memory.md` 의 `id: nav-agent-memory` 는 파일명 기반 권장 규약과 소폭 불일치한다(INFO). 구현 착수 전 차단 요소는 없으며 CRITICAL 위반은 없다.

## 위험도

LOW
