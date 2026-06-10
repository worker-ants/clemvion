# 정식 규약 준수 검토 결과

검토 대상: `spec/2-navigation/` (전체 파일)
검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/2-navigation/, diff-base=origin/main)

---

## 발견사항

### 문서 구조 규약

- **[WARNING]** `14-execution-history.md` — 이중 개요 섹션 구조 혼용
  - target 위치: `spec/2-navigation/14-execution-history.md`, 파일 최상단 ~ `## 1. 개요`
  - 위반 규약: CLAUDE.md §정보 저장 위치 "제품 정의·요구사항은 `_product-overview.md` 또는 진입 문서의 `## Overview`" + 3섹션 권장 구성(Overview / 본문 / Rationale)
  - 상세: 파일 내부에 `## Overview (제품 정의)` 절(배경·목표·요구사항 ID 테이블·진입점 목록)이 있고, 그 바로 아래 다시 `## 1. 개요` 절이 나온다. 결과적으로 "개요" 성격의 내용이 두 곳으로 분산되어 `## Overview` → 본문 → `## Rationale` 의 3섹션 단일 흐름을 깨고 있다. 다른 파일들(0-dashboard, 1-workflow-list 등)은 `## Overview` 없이 번호 절(§1, §2 …)만 사용하는 일관된 패턴을 지키는데, `14-execution-history.md` 만 두 패턴을 혼용한다.
  - 제안: `## Overview (제품 정의)` 절의 배경·목표·요구사항 ID 테이블·진입점 목록을 단일 진입점인 `spec/2-navigation/_product-overview.md` 로 이동하거나, 파일 내부에서 `## Overview (제품 정의)` 를 `## 1. 개요` 와 통합하여 중복 제거. 단, 이 파일이 PRD 성격의 내용(요구사항 ID·우선순위·상태)을 포함하고 있어 `_product-overview.md` 위임이 가장 규약에 부합한다. 현 상태가 의도된 것이라면 `_product-overview.md` 와의 분리 기준을 규약에 명시적으로 추가할 것을 권장.

- **[INFO]** `16-agent-memory.md` — `id` 가 파일명 기반 kebab-case 와 불일치
  - target 위치: `spec/2-navigation/16-agent-memory.md` frontmatter `id: nav-agent-memory`
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1` — `id` 는 "파일 basename(확장자 제외) 기반 권장"
  - 상세: 파일명은 `16-agent-memory` 인데 frontmatter `id` 는 `nav-agent-memory` 로 불일치. `0-dashboard.md → id: dashboard`, `14-execution-history.md → id: execution-history` 처럼 나머지 파일들은 모두 basename 에서 숫자-prefix 를 제거한 kebab-case 로 일치한다. `nav-agent-memory` 는 유효한 식별자지만 파일명 기반 권장 원칙에서 벗어난다.
  - 제안: `id: agent-memory` 로 변경. 단 이미 다른 문서나 링크에서 `nav-agent-memory` 를 참조하고 있는지 확인 후 변경.

- **[INFO]** `15-system-status.md` — `## Rationale` 이 있지만 `## Overview` 섹션 없음
  - target 위치: `spec/2-navigation/15-system-status.md` 전체 구조
  - 위반 규약: CLAUDE.md §Spec 문서 3섹션 구성 "Overview / 본문 / Rationale 3섹션 권장"
  - 상세: 파일에 `## Rationale` 은 있으나 `## Overview` 또는 `## 1. 개요` 절이 없고 파일 본문이 `## 1. 화면 구조` 로 바로 시작한다. 제품 개요(무엇을 하는 화면인지)가 서두 산문 한 줄(전체 시스템 BullMQ 큐…)로만 처리되어 있어, Overview 절이 사실상 서두 한 문장에 흡수되어 있다. 엄밀히 규약 위반은 아니나(권장 구조) 다른 파일과의 일관성이 낮다.
  - 제안: 현 서두 문장을 `## 1. 개요` 또는 `## Overview` 로 승격하여 다른 파일과 구조를 맞출 것 권장. 중요도는 낮음.

---

### 출력 포맷 규약

- **[INFO]** `14-execution-history.md` — 목록 API 응답 예시에서 `data` 래퍼 구조가 API 규약 §5.2 페이지네이션 래퍼와 불일치
  - target 위치: `spec/2-navigation/14-execution-history.md §5` (목록 API 응답 형식 JSON 예시)
  - 위반 규약: `spec/conventions/swagger.md §5-2` 공용 래퍼 헬퍼 — `ApiOkPaginatedResponse` 의 스키마는 `{ data: { data: <Dto>[], pagination: { page, limit, totalItems, totalPages } } }`. spec 본문 참조 "[API 규약 §5.2](../5-system/2-api-convention.md#52-목록-응답) 준수"
  - 상세: 응답 예시 JSON 은 `{ "data": [...], "pagination": { ... } }` 형태인데 — Swagger 래퍼 컨벤션(`ApiOkPaginatedResponse`)은 `{ "data": { "data": [...], "pagination": {...} } }` 를 명시한다. 즉 paginated 목록은 `data` 키 안에 또 `data` 배열이 있어야 하는 이중 래핑 구조다. 이 불일치가 스펙 문서의 예시 오류인지 실제 구현이 플랫(flat) 구조인지를 명확히 해야 한다.
  - 제안: 실제 구현 `ExecutionsController` 응답 구조를 확인하여 (a) 구현이 `{ data: [...], pagination: {...} }` 이면 swagger 컨벤션 §5-2 의 스키마 주석을 정정하거나, (b) 구현이 `{ data: { data: [...], pagination: {...} } }` 이면 spec 의 JSON 예시를 이중 래핑 형태로 수정. 혼동 방지를 위해 어느 쪽이 SoT 인지 명시할 것.

---

### 명명 규약

- **[INFO]** `10-auth-flow.md` — 에러 코드 `invitation_not_found` 등 lower_snake_case 사용
  - target 위치: `spec/2-navigation/10-auth-flow.md §2.6 초대 토큰을 통한 가입`, 에러 분기 목록
  - 위반 규약: `spec/conventions/error-codes.md §1` — 에러 코드는 `UPPER_SNAKE_CASE` 원칙
  - 상세: spec 문서가 `invitation_expired`, `invitation_already_used`, `invitation_email_mismatch` 를 lower_snake_case 로 표기한다. 단, 이 코드들은 `spec/conventions/error-codes.md §3 Historical-artifact 예외 레지스트리` 에 명시적으로 등재된 예외 항목이다. 따라서 이는 규약 위반이 아니라 예외 레지스트리에 따른 정상 표기다.
  - 제안: 특별한 조치 불필요. 다만 spec 문서 내 해당 코드 언급 시 "historical artifact, 예외 레지스트리 참조" 주석을 추가하면 가독성 향상.

---

### API 문서 규약 (Swagger)

- **[WARNING]** `0-dashboard.md` — 응답 DTO 파일 경로가 Swagger 규약의 응답 DTO 위치 규약에 부합하는지 직접 확인 필요
  - target 위치: `spec/2-navigation/0-dashboard.md` frontmatter `code:` — `dashboard-response.dto.ts`
  - 위반 규약: `spec/conventions/swagger.md §5-1` — 응답 DTO 위치 규약 `codebase/backend/src/modules/<module>/dto/responses/*-response.dto.ts`
  - 상세: frontmatter 경로가 `codebase/backend/src/modules/dashboard/dto/responses/dashboard-response.dto.ts` 로 규약과 완벽히 일치한다. 이 자체는 정상이다. 다만 spec 이 참조하는 DTO(`DashboardSummaryDto`)가 명시되어 있어, 이 DTO 가 엔티티를 직접 노출하지 않고 별도 DTO 클래스로 분리되어 있는지는 구현 파일 직접 확인 필요.
  - 제안: INFO 수준으로 재분류 가능. Swagger 가드 체크리스트(§5-4) 기준에서 `DashboardSummaryDto` 가 entity 직접 노출 여부를 코드 리뷰 시 확인.

---

### 금지 항목

- 점검한 모든 파일에서 conventions 에서 명시적으로 금지한 패턴(예: `spec/` 에 구현 코드 직접 삽입, frontmatter `status` 없는 대상 파일, `_*.md` 파일에 `id`/`status` frontmatter 부여, API 레퍼런스 카탈로그 아래 depth 파일에 lifecycle frontmatter 부여 등)은 발견되지 않았다.

- `_product-overview.md`, `_layout.md` 는 밑줄 prefix 규약에 따라 frontmatter 의무에서 정상 제외되어 있다.

---

## 요약

`spec/2-navigation/` 전체 파일은 정식 규약을 대체로 잘 준수하고 있다. 가장 주목할 점은 `14-execution-history.md` 가 `## Overview (제품 정의)` 절과 `## 1. 개요` 절을 동시에 가져 문서 구조 규약(3섹션 단일 흐름)을 혼용하는 WARNING 1건이다. 아울러 목록 API 응답 예시의 paginated 래퍼 형태가 Swagger 컨벤션의 이중 래핑 구조와 불일치하는 WARNING 이 있어, 실제 구현과 대조 후 어느 쪽이 SoT 인지 명확히 할 필요가 있다. `16-agent-memory.md` 의 `id` 값이 파일명 기반 권장 원칙에서 벗어나는 것은 INFO 수준이다. CRITICAL 위반은 없다.

---

## 위험도

LOW
