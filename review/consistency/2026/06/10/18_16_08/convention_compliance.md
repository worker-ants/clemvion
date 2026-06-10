# Convention Compliance Review — spec/2-navigation/

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/2-navigation/, diff-base=origin/main)
검토 일시: 2026-06-10

---

## 발견사항

### [INFO] `id: nav-agent-memory` — basename 기반 권장 규칙과 비일치
- target 위치: `spec/2-navigation/16-agent-memory.md` frontmatter, line 2
- 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1` — "`id` 필드는 파일 basename(확장자 제외) 기반 권장"
- 상세: 파일명은 `16-agent-memory` 이므로 권장 id 는 `agent-memory` (또는 `16-agent-memory`) 인데, `nav-agent-memory` 로 불필요한 `nav-` 접두사가 붙어 있다. 다른 `spec/2-navigation/` 문서들(`dashboard`, `trigger-list`, `schedule`, `workflow-list`, `auth-flow`, `error-empty-states`, `user-guide`, `execution-history`, `system-status`)은 모두 basename 기반 id 를 사용한다.
- 제안: `id: agent-memory` 로 변경. 단 `id` 는 build 가드가 파일-basename 을 "강제" 하지 않고 "권장" 하므로 현행 값이 기술적으로 valid 하다 — 가드 통과를 유지하면서 일관성을 높이려면 rename.

---

### [INFO] `spec/2-navigation/14-execution-history.md` — 이중 구조 (Overview 섹션 내 번호 재시작)
- target 위치: `spec/2-navigation/14-execution-history.md` §Overview (제품 정의) 및 §1. 개요
- 위반 규약: CLAUDE.md §정보 저장 위치 — "제품 정의·요구사항: `spec/<영역>/_product-overview.md` 또는 진입 문서의 `## Overview`". 권장 3섹션 구조(Overview / 본문 / Rationale)에서 Overview 뒤 본문 섹션이 별도 `## 1. 개요` 로 다시 시작.
- 상세: `## Overview (제품 정의)` 아래 `### 1. 개요` / `### 2. 페이지 구조` / `### 3. 요구사항` 을 두고, `---` 구분 뒤 다시 `## 1. 개요` 로 번호 재시작한다. 이로 인해 Overview 내의 §1~§3 과 본문의 §1~§7 이 혼재하여 앵커 링크 충돌 가능성 및 문서 구조 혼란이 있다. 다른 `spec/2-navigation/` 문서들은 이 이중 구조를 사용하지 않는다.
- 제안: Overview 내 개요·배경·목표·페이지 구조·요구사항을 `_product-overview.md` 로 추출하거나, Overview 블록을 제거하고 본문 번호체계를 통일한다. 이 파일은 이번 diff 에서 변경되지 않았으므로 현재 PR 범위 밖이나 후속 정리 대상으로 등록할 것을 권장.

---

### [INFO] `spec/2-navigation/3-schedule.md` — `sort`/`order` 파라미터 설명에서 "`whitelist` 기반" 표현
- target 위치: `spec/2-navigation/3-schedule.md §3 API 표`, GET `/api/schedules` 행 설명 (diff 변경 줄)
- 위반 규약: 명시적 규약 위반은 아님. `spec/conventions/` 에 API 쿼리 파라미터 설명 어법을 강제하는 규약 없음.
- 상세: 변경된 줄에서 "whitelist 기반으로 반영" 이라는 구현 세부(코드 레벨 용어)가 spec 본문에 노출된다. spec 은 계약을 기술해야 하며 구현 수단은 Rationale 에 두는 것이 원칙.
- 제안: "`sort`/`order` 는 허용 값 집합(`created_at`, `updated_at`, `name`) 내에서 반영, 기본 `created_at DESC`" 처럼 계약 기술로 변경. 구현 상세(whitelist 필터 코드 패턴)는 필요 시 Rationale 에 이동.

---

### [WARNING] `spec/2-navigation/2-trigger-list.md` frontmatter `code:` — origin/main 대비 backend 경로 누락
- target 위치: `spec/2-navigation/2-trigger-list.md` frontmatter `code:` 목록 (현재 worktree 파일 1~8줄)
- 위반 규약: `spec/conventions/spec-impl-evidence.md §3` — `status: implemented` 인 spec 의 `code:` 는 ≥1 글로브 매치 의무. 더불어 §2.1 — `code:` 는 "본 spec 이 약속한 surface 의 구현 경로"
- 상세: origin/main 의 `2-trigger-list.md` frontmatter 에는 아래 경로들이 있었으나 현재 worktree 파일에는 없다:
  ```
  - codebase/backend/src/modules/triggers/triggers.controller.ts
  - codebase/backend/src/modules/triggers/triggers.service.ts
  - codebase/backend/src/modules/triggers/triggers.module.ts
  - codebase/backend/src/modules/triggers/dto/**
  - codebase/packages/chat-channel-validation/src/index.ts
  ```
  이번 diff(`git diff origin/main -- spec/2-navigation/2-trigger-list.md`)는 본문 1줄만 변경하고 frontmatter 를 건드리지 않으므로, 이 누락은 diff 이전에 이미 존재한 문제거나 중간 커밋에서 제거된 것이다. 실제로 이번 구현은 `triggers.service.ts` 에 `syncScheduleActivation()` 을 추가했는데, spec 의 `code:` 에서 해당 파일이 빠져 있으면 `spec-code-paths.test.ts` 가 backend service 경로를 evidence 로 인식하지 못한다.
- 제안: `code:` 에 아래를 복구하거나 현행 worktree 파일이 이미 이 상태로 커밋된 것이라면 즉시 추가:
  ```yaml
  - codebase/backend/src/modules/triggers/triggers.service.ts
  - codebase/backend/src/modules/triggers/triggers.controller.ts
  - codebase/backend/src/modules/triggers/dto/**
  ```

---

### [INFO] `spec/data-flow/10-triggers.md` — frontmatter 없음 (범위 외, 참고)
- target 위치: `spec/data-flow/10-triggers.md` 파일 상단
- 위반 규약: `spec/conventions/spec-impl-evidence.md §1` 적용 대상은 `spec/2-navigation/**`, `spec/3-workflow-editor/**`, `spec/4-nodes/**`, `spec/5-system/**`, `spec/7-channel-web-chat/**`, `spec/conventions/**` 에 한정
- 상세: `spec/data-flow/` 는 frontmatter 의무 대상 inclusive list 에 포함되지 않으므로 frontmatter 부재는 규약 위반이 아니다.
- 제안: 없음. 현행 상태 유지 가능. 다만 이번 diff 에서 `spec/data-flow/10-triggers.md` 에 Rationale 성격의 §역방향 동기화 이유 절이 추가됐는데, 이는 정식 규약을 위반하지 않는다.

---

### [INFO] `spec/2-navigation/` 내 일부 파일 — `## Rationale` 없음
- target 위치: `spec/2-navigation/15-system-status.md` (있음), `spec/2-navigation/16-agent-memory.md` (있음), `spec/2-navigation/13-user-guide.md` (있음)
- 위반 규약: CLAUDE.md — "결정의 배경·근거: 해당 spec 문서 끝의 `## Rationale`" 은 **권장** 구조이며 mandatory 강제 규약이 아님
- 상세: 모든 파일이 Rationale 섹션을 가질 필요는 없다. 검토 대상 파일들 중 `0-dashboard.md`, `10-auth-flow.md`, `11-error-empty-states.md`, `1-workflow-list.md`, `2-trigger-list.md`, `3-schedule.md`, `13-user-guide.md`, `14-execution-history.md`, `15-system-status.md`, `16-agent-memory.md` 모두 Rationale 이 있거나 없음이 자유이며, 이번 diff 변경 파일들은 기존 Rationale 이 있는 파일을 수정했다.
- 제안: 없음.

---

## 요약

이번 diff(`spec/2-navigation/2-trigger-list.md`, `spec/2-navigation/3-schedule.md`, `spec/data-flow/10-triggers.md`) 의 변경 내용 자체는 정식 규약을 직접 위반하지 않는다. 변경된 3줄은 기존 spec 본문에 구현 사실(BullMQ `removeJob` 호출, `syncScheduleActivation()`, 양방향 동기화 완료)을 반영한 사실 기술로, 명명 규약·출력 포맷 규약·문서 구조 규약 모두 저촉되지 않는다.

가장 주목할 사항은 **WARNING** 1건: `spec/2-navigation/2-trigger-list.md` frontmatter 의 `code:` 목록에서 backend 경로(특히 이번 구현의 핵심인 `triggers.service.ts`)가 빠져 있어, `spec-code-paths.test.ts` 가 이 spec 의 구현 evidence 를 온전히 인식하지 못할 수 있다. 이는 이번 PR 에서 수정이 권장된다. 나머지 발견사항은 INFO 등급으로 기존 구조의 일관성 제안이며 채택 여부는 자유다.

## 위험도

LOW
