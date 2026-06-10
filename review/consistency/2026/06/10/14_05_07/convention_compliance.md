# Convention Compliance Review — `spec/2-navigation/`

**검토 모드**: `--impl-prep` (scope=`spec/2-navigation/`)
**검토 일시**: 2026-06-10
**검토 대상**: `spec/2-navigation/` 전체 (16개 파일)

---

## 발견사항

### [WARNING] `14-execution-history.md` — `## Rationale` 섹션 누락
- **target 위치**: `/Volumes/project/private/clemvion/.claude/worktrees/trigger-schedule-sync-f88604/spec/2-navigation/14-execution-history.md` 전체 (파일 끝까지 `## Rationale` 없음)
- **위반 규약**: `CLAUDE.md` §정보 저장 위치 ("결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`"), `.claude/skills/project-planner/SKILL.md §Spec 문서 구조 (3섹션 권장)` — Overview / 본문 / Rationale
- **상세**: `14-execution-history.md` 는 `## Overview (제품 정의)` 섹션을 갖추어 3섹션 구성을 시작했지만 `## Rationale` 섹션이 존재하지 않는다. 같은 영역의 다른 파일들(0-dashboard, 1-workflow-list, 2-trigger-list, 4-integration, 5-knowledge-base 등)은 모두 `## Rationale` 를 보유한다. 특히 이 파일에는 EH-DETAIL-10 (Re-run), 실행 목록 API 설계(N+1 회피), LLM Usage 탭 구조 등 주요 설계 결정 근거를 남길 내용이 충분히 있다.
- **제안**: 파일 끝에 `## Rationale` 섹션 추가. 최소 내용: ① `GET /api/executions/workflow/:workflowId` 에서 nodeExecutions 를 제외한 이유(N+1 회피), ② LLM Usage / Response / Request 탭 평탄화 결정, ③ `## Overview` 아래에 요구사항(EH-LIST/EH-DETAIL/EH-NAV) ID를 두는 PRD-like 구조 채택 근거.

---

### [WARNING] `14-execution-history.md` — `## Overview` + `## 1. 개요` 이중 섹션 구조
- **target 위치**: `/Volumes/project/private/clemvion/.claude/worktrees/trigger-schedule-sync-f88604/spec/2-navigation/14-execution-history.md` 라인 17–91
- **위반 규약**: `.claude/skills/project-planner/SKILL.md §Spec 문서 구조 (3섹션 권장)` — 3섹션은 `## Overview` / 본문(##2 이하 혹은 ## 1) / `## Rationale`. 본문 섹션과 별개로 `## 1. 개요` 를 중복 배치하는 패턴은 규정에 없음
- **상세**: 이 파일에는 최상위 레벨 섹션 `## Overview (제품 정의)` 하위에 `### 1. 개요`, `### 2. 페이지 구조`, `### 3. 요구사항` 이 있고, 그 뒤에 다시 `## 1. 개요`, `## 2. 실행 내역 목록 페이지` ... 가 나온다. `## 1. 개요` 가 두 번(Overview 내 `### 1.`과 독립 `## 1.`) 등장해 헤딩 앵커 충돌 위험이 있고(spec-link-integrity 테스트에서 감지 가능), 독자가 어느 섹션이 "제품 정의" 이고 어느 것이 "기술 명세" 인지 구분하기 어렵다.
- **제안**: 두 가지 중 하나 선택. (A) `## Overview (제품 정의)` 아래의 `### 1. 개요`, `### 2. 페이지 구조`, `### 3. 요구사항` 를 그대로 두고, 기술 명세 섹션을 `## 1.` 이 아니라 `## 기능 명세` 또는 `## 2. 실행 내역 목록` 으로 번호 계속(Overview 내의 `### 3.` 이후로 이어서 `## 4.`)하여 중복을 없앤다. (B) `## Overview` 섹션을 폐기하고 요구사항 ID 표를 `## 1. 개요` 하위 subsection 으로 흡수한다(다른 파일들과 동일 패턴).

---

### [WARNING] `3-schedule.md`, `7-statistics.md` — `## Rationale` 섹션 누락
- **target 위치**: `/Volumes/project/private/clemvion/.claude/worktrees/trigger-schedule-sync-f88604/spec/2-navigation/3-schedule.md` 전체, `7-statistics.md` 전체
- **위반 규약**: `CLAUDE.md §정보 저장 위치` ("결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`"), `project-planner/SKILL.md §Spec 문서 구조 (3섹션 권장)`
- **상세**: `3-schedule.md` 는 `status: partial` 이고 설계상 주목할 결정(Schedule 타입 트리거를 Schedule 화면에서만 생성, Trigger 자동 생성 규칙 등)이 있음에도 Rationale 섹션이 없다. `7-statistics.md` 는 `status: implemented` 이며 API 설계·집계 기준 등 결정 배경이 기록되어 있지 않다. 이 두 파일은 같은 영역 내 비일관성을 만든다.
- **제안**: 각 파일 끝에 `## Rationale` 추가. 최소 항목: `3-schedule.md` — "Schedule 타입 트리거 생성 경로 제한 이유" + "cron 자동 발화 시 trigger_id 필수 기록 이유". `7-statistics.md` — "LLM Usage API 분리 이유", "top-workflows 기준 등 집계 설계 결정".

---

### [INFO] `16-agent-memory.md` — `id` 가 basename 에서 벗어남
- **target 위치**: `/Volumes/project/private/clemvion/.claude/worktrees/trigger-schedule-sync-f88604/spec/2-navigation/16-agent-memory.md` frontmatter `id:` 라인
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — `id | string (kebab-case) | 파일 basename(확장자 제외) 기반 권장`
- **상세**: 파일명은 `16-agent-memory.md` 이고, 숫자 prefix 를 제외한 basename 은 `agent-memory` 이다. 그런데 `id` 는 `nav-agent-memory` 로 선언되어 있다. 이 패턴은 영역 prefix(`nav-`)를 의도적으로 추가한 것이지만, 같은 영역의 다른 파일들은 모두 영역 prefix 없이 basename 기반 id 를 사용한다(예: `0-dashboard` → `id: dashboard`, `1-workflow-list` → `id: workflow-list`). id 는 spec 내부 교차참조 식별자로 쓰이므로 일관성 유지를 권장한다. 규약이 "권장" 수준이므로 build 차단 대상은 아니다.
- **제안**: `id: agent-memory` 로 통일하거나, 이 영역이 `nav-` prefix 를 쓰기로 결정했다면 규약 문서에 예외 사유를 등재한다. 현재 다른 파일들이 prefix 없이 사용하므로 `agent-memory` 로 통일하는 것이 자연스럽다.

---

## 긍정 확인 사항 (위반 없음)

- **Frontmatter 필수 필드 (`id`/`status`) 준수**: 검토 대상 모든 파일에 `id`(kebab-case)와 `status`(valid enum: implemented/partial/backlog) 가 있다.
- **`status: partial` 시 `pending_plans:` 의무 준수**: `1-workflow-list.md`(pending_plans 있음), `3-schedule.md`(pending_plans 있음), `6-config.md`(pending_plans 있음), `9-user-profile.md`(pending_plans 있음) — 모두 의무 충족.
- **spec-area-index 가드 통과**: `spec/2-navigation/` 의 모든 15개 sibling 파일이 index 문서(`_product-overview.md`, `_layout.md`, `0-dashboard.md` 중 적어도 하나)에서 링크되어 있다.
- **에러 코드 표기 규약 (`UPPER_SNAKE_CASE`) 준수**: `VALIDATION_ERROR`, `RESOURCE_CONFLICT`, `DUPLICATE_NODE_LABEL`, `TRIGGER_ENDPOINT_PATH_CONFLICT` 등 검토 파일 내 에러 코드 모두 규약 준수. 초대 관련 historical artifact(`invitation_not_found` 등 lowercase)는 `spec/conventions/error-codes.md §3` 에 등재된 허가 예외.
- **API endpoint 명명 (kebab-case 경로)**: 검토 파일 내 모든 API 경로 (`/api/executions/workflow/:workflowId`, `/api/triggers/:id/chat-channel/rotate-bot-token` 등) kebab-case 준수.
- **응답 포맷 규약 (`{ "data": [...], "pagination": {...} }`)**: `14-execution-history.md §5` 의 목록 API 응답 예시가 `spec/5-system/2-api-convention.md §5.2` 와 정확히 일치한다.
- **`code:` glob 파일 존재**: `14-execution-history.md` 의 `codebase/backend/src/modules/executions/dto/query-execution.dto.ts` 및 `utils/*.ts` 경로가 실존한다.
- **`status: implemented` 파일의 `pending_plans:` 없음**: 정상. `status: implemented` 는 `pending_plans` 가 없어야 한다.
- **파일 명명 (숫자-prefix-kebab-case)**: 모든 파일이 `<숫자>-<kebab-case>.md` 패턴을 따른다 (숫자 prefix 는 섹션 내 정렬용, 규약 위반 아님).
- **API 문서 규약 (swagger.md)**: spec 문서 계층에서 DTO 파일 경로를 `code:` frontmatter 에 명시하는 패턴은 `swagger.md §5-1` 의 DTO 위치 규약(`dto/responses/*-response.dto.ts`)과 정합한다.

---

## 요약

`spec/2-navigation/` 는 전반적으로 정식 규약을 잘 준수하고 있다. frontmatter 의무 필드, 에러 코드 표기, API endpoint 명명, 응답 포맷, spec-area-index 가드 모두 통과 수준이다. 주요 개선점은 `14-execution-history.md` 의 구조 문제 두 가지: (1) `## Rationale` 섹션 누락 — 설계 결정 근거가 기록되지 않아 3섹션 구성이 불완전하고, (2) `## Overview (제품 정의)` + `## 1. 개요` 중복 배치 — 타 파일과 다른 비일관 구조로 헤딩 앵커 충돌 위험이 있다. 추가로 `3-schedule.md`, `7-statistics.md` 의 Rationale 누락과 `16-agent-memory.md` 의 id 비일치는 권장 수준 개선 사항이다. CRITICAL 위반은 발견되지 않았다.

---

## 위험도

**LOW**

> CRITICAL 규약 위반은 없다. 발견된 WARNING 두 건(`14-execution-history.md` 의 Rationale 누락 및 이중 섹션 구조)은 기능 구현의 correctness 에 직접 영향을 미치지 않으나, spec 문서 품질 일관성과 장기 유지보수성에 영향을 준다. 구현 착수를 차단하는 수준은 아니다.
