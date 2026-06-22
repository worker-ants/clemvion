# 정식 규약 준수 검토 결과

**검토 대상**: `spec/2-navigation` (전체 .md 파일)
**검토 모드**: 구현 완료 후 (--impl-done, scope=spec/2-navigation, diff-base=origin/main)
**검토 일시**: 2026-06-23

---

## 발견사항

### [INFO] `14-execution-history.md` — Overview 섹션 있으나 다른 파일들은 생략
- **target 위치**: `spec/2-navigation/14-execution-history.md` §Overview (제품 정의) vs `spec/2-navigation/0-dashboard.md`, `1-workflow-list.md`, `2-trigger-list.md` 등 나머지
- **위반 규약**: CLAUDE.md "문서 구조 규약" — "Overview / 본문 / Rationale 3섹션 권장"
- **상세**: `14-execution-history.md` 는 CLAUDE.md 가 권장하는 `## Overview (제품 정의)` + 본문 + `## Rationale` 3섹션 구조를 완전히 갖추고 있다. 반면 `0-dashboard.md`, `1-workflow-list.md`, `2-trigger-list.md`, `11-error-empty-states.md`, `15-system-status.md`, `16-agent-memory.md`, `10-auth-flow.md`, `13-user-guide.md` 는 `## Overview` 섹션 없이 바로 `## 1. ...` 또는 `## 1. 화면 구조` 로 시작한다. Rationale 섹션은 대부분 있다. 3섹션은 "권장" 사항이므로 강제 위반은 아니다.
- **제안**: 강제 사항이 아니므로 즉시 수정 불필요. 다만 `14-execution-history.md` 처럼 PRD 수준 배경(배경·목표·요구사항)이 있는 문서는 `## Overview` 섹션으로 명시화하는 편이 일관성에 도움이 된다. 향후 문서 작성 시 동일 구조를 유지하면 좋다.

---

### [INFO] `16-agent-memory.md` — `id` frontmatter 가 basename 과 불일치하나 의도된 패턴
- **target 위치**: `spec/2-navigation/16-agent-memory.md` frontmatter `id: nav-agent-memory`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — "id: 파일 basename(확장자 제외) 기반 권장. 같은 basename 이 영역을 달리해 중복될 때는 후발 문서가 영역 prefix 로 충돌을 회피한다"
- **상세**: `spec/5-system/17-agent-memory.md` 가 이미 `agent-memory` id 를 점유하고 있으므로 `spec/2-navigation/16-agent-memory.md` 가 `nav-agent-memory` 로 충돌 회피한 것은 `spec-impl-evidence.md §2.1` 의 **의도된 패턴**으로 명시적으로 허용된다. 규약 위반이 아니다.
- **제안**: 해당 없음 — 규약이 이 패턴을 명시적으로 허용하며 예시로 언급한다.

---

### [INFO] `15-system-status.md` — `## Overview` 섹션 없이 본문 진입, Rationale 앞 `---` 구분자 없음
- **target 위치**: `spec/2-navigation/15-system-status.md` — 파일 전체 구조
- **위반 규약**: CLAUDE.md "문서 구조 규약" — Overview / 본문 / Rationale 3섹션 권장
- **상세**: `15-system-status.md` 는 `## 1. 화면 구조` 로 바로 시작해 Overview 섹션이 없다. `## Rationale` 은 존재하지만 앞에 `---` 수평선 구분자가 없다 (다른 파일들은 Rationale 앞에 `---` 구분자를 두는 경향이 있으나 이는 강제 규약이 아니다). 권장 사항 미준수 수준.
- **제안**: 강제 사항이 아니므로 즉시 수정 불필요.

---

### [WARNING] `2-trigger-list.md` — `status: implemented` 이지만 일부 기능이 Planned/partial 상태 선언
- **target 위치**: `spec/2-navigation/2-trigger-list.md` frontmatter `status: implemented`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §3` — "`implemented`: 모든 약속 구현 완료. `pending_plans:` 없음"
- **상세**: 파일 frontmatter 는 `status: implemented` 이지만, 본문 곳곳에 미구현 surface 에 대한 언급이 존재한다. 예를 들어 §2.3.1 매트릭스에서 `workflowId` 는 "v1 은 잠금 (Rationale R-1)", `httpMethod`/`contentType` 은 "v1 은 POST 고정 / v1 은 application/json 고정" 등 미완 명시가 있다. 단, 이러한 v1 제약들은 "미구현" 이 아니라 "의도적으로 고정된 설계" 이므로 `implemented` 상태가 정확하다고 볼 여지도 있다. 핵심은 `pending_plans:` 가 없어 build-time 가드는 통과한다. 다만 `spec-impl-evidence.md §3` 의 `implemented` 정의("모든 약속 구현 완료")에 비춰 본문의 "미정의 (Rationale R-16 참고)", "v1 미채택" 류 표현이 혼재함은 독자에게 혼란을 줄 수 있다.
- **제안**: v1 제약(의도적 설계 결정)과 실제 미구현 gap 을 명확히 구분 기술 필요. 진짜 미구현 surface 가 있다면 `status: partial` + `pending_plans:` 로 명시하거나, v1 제약임을 Rationale 에서 더 명확히 기술하는 것을 검토.

---

### [INFO] `10-auth-flow.md` — OAuth 에러 코드의 `lower_snake_case` historical artifact 레지스트리 등재 cross-reference 정합
- **target 위치**: `spec/2-navigation/10-auth-flow.md` §5.4 OAuth 에러 처리
- **위반 규약**: `spec/conventions/error-codes.md §1` — UPPER_SNAKE_CASE 원칙
- **상세**: `invalid_state` · `token_exchange_failed` · `email_required` · `server_error` 는 `lower_snake_case` 로 `UPPER_SNAKE_CASE` 규약과 어긋난다. 단, `spec/conventions/error-codes.md §3 Historical-artifact 예외 레지스트리` 에 해당 코드들이 명시적으로 등재되어 있으며, "redirect URL query param 값이라 envelope 코드 체계와 레이어가 다르다"는 근거로 예외 처리됐다. `10-auth-flow.md §5.4` 에도 `[에러 코드 규약 §3 historical-artifact 레지스트리](../conventions/error-codes.md#3-historical-artifact-예외-레지스트리) 등재` 라는 cross-reference 주석이 정확히 있다. 규약 위반이 아니라 의도된 예외다.
- **제안**: 해당 없음.

---

### [INFO] `14-execution-history.md` §5 API 응답 예시 — pagination 래퍼 구조
- **target 위치**: `spec/2-navigation/14-execution-history.md` §5 목록 API 응답 형식 JSON 예시
- **위반 규약**: `spec/conventions/swagger.md §5-2` — 공용 래퍼 헬퍼 `ApiOkPaginatedResponse` 의 스키마: `{ data: { data: <Dto>[], pagination: { page, limit, totalItems, totalPages } } }`
- **상세**: 응답 예시가 `{ "data": [...], "pagination": { ... } }` 형태로 기술되어 있다. 이는 swagger 컨벤션의 `PaginatedResponseDto` 형태(`{ data: { data: [], pagination: {} } }` — 외부 `data` 봉투 + 내부 `data`+`pagination`)가 아니라 외부 봉투 없이 `data`·`pagination` 가 병렬로 기술된 것이다. 단, 해당 응답 예시 직전에 "응답 본문은 공통 래퍼(`{ data: ... }`)로 감싸진다. 아래 예시는 data 내부 형태다" 라는 주석이 명시적으로 있다. 따라서 이 형식은 래퍼를 제외한 내부 형태를 보여주는 의도적 표기이며, swagger.md 위반이 아니다.
- **제안**: 해당 없음. 이미 주석으로 컨텍스트 명확히 기술됨.

---

### [INFO] `spec/conventions/cafe24-api-catalog/application/apps.md` — frontmatter `id`/`status` 없음 (제외 대상)
- **target 위치**: `spec/conventions/cafe24-api-catalog/application/apps.md` frontmatter
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §1` — `spec/conventions/**.md` 대상 frontmatter 의무
- **상세**: `apps.md` 의 frontmatter 는 `resource`/`entity`/`cafe24_docs`/`source` 로만 구성되어 있으며 `id`/`status` 가 없다. 단, `spec-impl-evidence.md §1` 제외 규정에 `spec/conventions/<name>-api-catalog/<resource>/**/*.md` (카탈로그 디렉토리 뒤 세그먼트 1개 이상)가 명시적으로 면제 대상에 포함된다. `application/apps.md` 는 이 패턴에 해당하므로 정식 규약 위반이 아니다.
- **제안**: 해당 없음.

---

### [INFO] `spec/conventions/cafe24-api-catalog/application.md` — `## Field-level 상세 카탈로그` 섹션 불규칙
- **target 위치**: `spec/conventions/cafe24-api-catalog/application.md` 하단 Field-level 섹션
- **위반 규약**: CLAUDE.md "문서 구조 규약" — Overview / 본문 / Rationale
- **상세**: `application.md` 는 Rationale 섹션이 없다. `_overview.md` 에 카탈로그 규약이 집중되어 있으므로 개별 resource 파일에 Rationale 이 없는 것은 자연스럽다. 권장 사항 미준수이나 이 종류의 카탈로그 파일에 Rationale 을 강제하는 규약은 없다.
- **제안**: 해당 없음.

---

### [INFO] `2-trigger-list.md` — `code:` 에 glob 패턴 `codebase/frontend/src/components/triggers/*.tsx` 사용
- **target 위치**: `spec/2-navigation/2-trigger-list.md` frontmatter `code:` 항목
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — `code:` glob 허용
- **상세**: `codebase/frontend/src/components/triggers/*.tsx` 형태의 glob 이 사용되어 있으며, 이는 `spec-impl-evidence.md §2.1` 에서 "glob 허용"으로 명시 허용된 패턴이다. 위반 아님.
- **제안**: 해당 없음.

---

### [INFO] `13-user-guide.md` — `spec/conventions/user-guide-evidence.md` 에 대한 cross-reference
- **target 위치**: `spec/2-navigation/13-user-guide.md` §8 공용 MDX 컴포넌트 `<ImplAnchor>` 설명
- **위반 규약**: 없음 — 단순 정합 확인
- **상세**: `<ImplAnchor>` 컴포넌트 설명에서 `SoT: spec/conventions/user-guide-evidence.md` 로 정확히 cross-reference 하고 있다. 규약 준수.
- **제안**: 해당 없음.

---

## 요약

`spec/2-navigation` 전체는 정식 규약과 대체로 잘 정합하고 있다. 주요 관찰: (1) `spec-impl-evidence.md` 의 frontmatter 요구사항(`id`/`status`/`code:`)을 모든 대상 파일이 충족하며, lifecycle 가드 통과가 확인된다. (2) `error-codes.md` 의 historical-artifact 예외(`lower_snake_case` OAuth 콜백 파라미터)는 `10-auth-flow.md` 에 정확히 교차 참조되어 있다. (3) `14-execution-history.md` 만이 CLAUDE.md 권장 3섹션(Overview/본문/Rationale) 구조를 완전히 갖추었고 다른 파일들은 Overview 섹션이 없으나 이는 권장 사항이지 강제 규약이 아니다. (4) CRITICAL 급 규약 직접 위반은 발견되지 않았다. `2-trigger-list.md` 의 `status: implemented` 선언과 본문 내 "v1 제약" 표현 혼재는 독자 혼란 우려가 있어 WARNING 으로 분류했으나, `pending_plans:` 부재·build 가드 통과 상태라 구조적 문제는 없다.

---

## 위험도

LOW
