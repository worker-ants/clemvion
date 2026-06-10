# 정식 규약 준수 검토 결과

검토 대상: `spec/2-navigation/` (구현 완료 후 검토, diff-base=origin/main)
검토 기준: `spec/conventions/**`, `CLAUDE.md`, `.claude/skills/project-planner/SKILL.md`

---

## 발견사항

### 1. **[WARNING]** `14-execution-history.md` — `## Overview (제품 정의)` 섹션 중복 구조
- **target 위치**: `spec/2-navigation/14-execution-history.md` 라인 17 (`## Overview (제품 정의)`) 및 라인 91 (`## 1. 개요`)
- **위반 규약**: `.claude/skills/project-planner/SKILL.md §Spec 문서 구조 (3섹션 권장)` — `## Overview (제품 정의)` / 본문 / `## Rationale` 3섹션. 본문의 기술 명세 안에 또 `## 1. 개요` 가 별도 섹션으로 중첩됨
- **상세**: 이 파일에는 `## Overview (제품 정의)` 제목 하위에 요구사항(§1.1 배경, §1.2 목표, §3 요구사항 ID 표)이 있고, 그 뒤에 다시 `## 1. 개요` → `## 2. 실행 내역 목록 페이지` 등 본문 기술 섹션이 이어진다. 다른 `spec/2-navigation/` 파일들(0-dashboard, 10-auth-flow, 11-error-empty-states 등)은 `## Overview` 없이 바로 번호 있는 기술 섹션(`## 1. 개요` 또는 `## 1. 화면 구조`)으로 시작하는 패턴을 따른다. `spec/2-navigation/` 디렉터리에는 이미 `_product-overview.md` 가 있어 제품 정의를 담당하므로, `14-execution-history.md` 가 내부에 Overview 섹션을 자체 포함하는 것은 `_product-overview.md` 위임 패턴과 어긋난다.
- **제안**: 3섹션 패턴이 "권장"이므로 CRITICAL 이 아니나, 동일 영역 내 파일 간 구조 불일치가 발생한다. `## Overview (제품 정의)` 내용을 `_product-overview.md` 의 해당 절로 통합하거나, 또는 본 파일의 Overview 섹션 표기를 다른 파일과 동일한 번호 없는 첫 섹션(예: 번호 없이 "배경·목표" 제목으로)으로 정리하는 것이 일관성 측면에서 권장된다.

### 2. **[INFO]** `2-trigger-list.md`, `3-schedule.md` — `## Overview` 섹션 미보유
- **target 위치**: `spec/2-navigation/2-trigger-list.md` (Overview 섹션 없음), `spec/2-navigation/3-schedule.md` (Overview 섹션 없음)
- **위반 규약**: `.claude/skills/project-planner/SKILL.md §Spec 문서 구조 (3섹션 권장)` — Overview / 본문 / Rationale 3섹션 권장
- **상세**: `2-trigger-list.md` 는 Rationale 는 있으나 `## Overview` 가 없고, `3-schedule.md` 는 Rationale 와 Overview 모두 없다. 단, `spec/2-navigation/_product-overview.md` 에 두 화면의 PRD 가 통합 기재되어 있으므로, 다중 spec 파일 영역의 정상 위임 패턴(Overview → `_product-overview.md`)에 해당할 수 있다. 3섹션은 "권장"이고 영역 레벨에서 이미 _product-overview.md 로 위임됐다면 개별 spec 파일의 Overview 생략은 허용 범위다. `3-schedule.md` 는 추가로 `## Rationale` 도 없다.
- **제안**: `3-schedule.md` 에 `## Rationale` 섹션 추가 권장(현재 완전 미비). `2-trigger-list.md` 는 Rationale 있으므로 INFO 수준. 두 파일 모두 Overview 미보유는 _product-overview.md 위임으로 정당화 가능.

### 3. **[INFO]** `14-execution-history.md` — 목록 API 응답 예시 래퍼 규약 불일치 가능성
- **target 위치**: `spec/2-navigation/14-execution-history.md` §5 "목록 API 응답 형식" JSON 예시 (라인 1655~1686)
- **위반 규약**: `spec/5-system/2-api-convention.md §5.2 목록 응답` — 최상위 래퍼 `{ data: [...], pagination: {...} }`. `spec/conventions/swagger.md §5-2` — `ApiOkPaginatedResponse` 사용 시 `{ data: { data: <Dto>[], pagination: {...} } }` 이중 래퍼
- **상세**: `14-execution-history.md` 의 목록 응답 예시는 최상위에 `{ "data": [...], "pagination": {...} }` 를 기재한다. `api-convention.md §5.2` 와는 일치하지만, `swagger.md §5-2` 의 `ApiOkPaginatedResponse` 는 `{ data: { data: [...], pagination: {...} } }` 로 data 가 한 겹 더 감싸진다. 두 규약이 다른 레이어(API 직접 반환 형태 vs Swagger 헬퍼 응답 스키마)를 다루므로 반드시 오류는 아니나, `1-workflow-list.md §3` 에서 `api-convention §5.2` 를 준수한다고 명시하는 것과 동일하게 `14-execution-history.md §5` 에도 참조 링크가 있어 명시적 정합이 확인 가능하다. 실제 `TransformInterceptor` 가 다시 `{ data: ... }` 로 감싸므로 페이지네이션 응답은 `{ data: { data: [...], pagination: {...} } }` 가 실제 HTTP 응답이다. 본 예시가 `data` 최상위 래퍼 미포함 형태라면 문서가 내부 구조만을 표현한다는 명시가 없어 혼동 가능성 있음.
- **제안**: 예시 앞에 `// 아래는 TransformInterceptor 가 감싸기 전 service 반환값` 또는 `// HTTP 실제 응답은 { data: { data: [...], pagination: {...} } }` 등 주석 추가 권장. 또는 `0-dashboard.md §7` 과 같이 "`data` 내부 형태"라는 문구를 명시.

### 4. **[INFO]** `16-agent-memory.md` — `id` frontmatter 값이 파일명과 불일치
- **target 위치**: `spec/2-navigation/16-agent-memory.md` frontmatter `id: nav-agent-memory`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — `id` 는 "kebab-case. 파일 basename 기반 권장"
- **상세**: 파일명은 `16-agent-memory.md`(basename `16-agent-memory`)이나, frontmatter `id` 는 `nav-agent-memory` 다. 다른 파일들은 basename 기반 id(`dashboard`, `workflow-list`, `auth-flow`, `execution-history` 등)를 따르는데, 본 파일만 `nav-` prefix 가 붙는다. spec-impl-evidence 는 "권장"이므로 빌드 차단은 아니지만, 영역 내 일관성이 깨진다.
- **제안**: `id: agent-memory` 또는 `id: nav-agent-memory` 중 하나로 통일. 파일명 기반 규칙을 따르면 `agent-memory` 가 자연스럽다. 단, 동일 id 가 타 영역에 이미 있다면 `nav-agent-memory` 구별자 유지가 합리적이다.

### 5. **[INFO]** `10-auth-flow.md` §8 API 목록 — 에러 코드 표기 형식 혼용
- **target 위치**: `spec/2-navigation/10-auth-flow.md` §7.3 로그아웃 설명 및 `spec/2-navigation/2-trigger-list.md` §2.3.1 필드 권한 매트릭스
- **위반 규약**: `spec/conventions/error-codes.md §3 Historical-artifact 예외 레지스트리` — `invitation_not_found` 등 `lower_snake_case` 는 초대 흐름 전용 historical artifact
- **상세**: `10-auth-flow.md` §2.6 에서 `invitation_email_mismatch`, `invitation_expired`, `invitation_already_used` 를 `lower_snake_case` 로 기재한다. 이는 `error-codes.md §3` 에 명시된 historical artifact 예외 레지스트리에 등재된 코드들이므로 위반이 아니다. 확인 차원의 INFO — 신규 에러 코드가 추가될 때 같은 패턴을 따르지 않아야 한다는 점을 문서에서 강조해 둘 필요는 있다.
- **제안**: 현재 기재는 규약 준수 (historical artifact 예외 등재). 향후 신규 에러 코드 추가 시 `UPPER_SNAKE_CASE` 사용 요건 명시 주석 권장.

---

## 요약

`spec/2-navigation/` 파일들은 전반적으로 정식 규약을 양호하게 준수하고 있다. 파일명에 `_` prefix(`_layout.md`, `_product-overview.md`)와 숫자 prefix(`0-`, `1-`, ...) 를 올바르게 사용하며, frontmatter `id`/`status`/`pending_plans` 의무 필드도 대부분 충족한다. 주요 문제는 두 가지다: (1) `14-execution-history.md` 가 동일 영역의 다른 파일들과 다른 문서 구조(중첩 Overview 섹션)를 갖는다는 점, (2) `16-agent-memory.md` 의 frontmatter `id` 가 파일명 기반 권장 패턴에서 벗어난다는 점. 두 항목 모두 WARNING/INFO 수준이며 채택 시 invariant 를 깨지는 않는다. 에러 코드 표기(`invitation_*` lowercase)는 error-codes.md §3 의 historical artifact 예외 레지스트리에 정식 등재된 사항으로 위반이 아님을 확인했다.

---

## 위험도

LOW
