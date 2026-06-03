# 정식 규약 준수 검토 — spec-draft-exec-intake-queue.md

검토 대상: `plan/in-progress/spec-draft-exec-intake-queue.md` (파일은 prompt_file 내 인라인 포함)
검토 모드: spec draft 검토 (--spec)
검토 일시: 2026-06-04

---

## 발견사항

### [CRITICAL] 파일이 실제로 존재하지 않음 — plan/in-progress/ 에 파일 없음

- **target 위치**: 문서 전체
- **위반 규약**: `plan-lifecycle.md §1` — "새 plan 은 항상 `plan/in-progress/`에서 생성"
- **상세**: `plan/in-progress/spec-draft-exec-intake-queue.md` 파일이 실제 repo에 존재하지 않는다. prompt_file에 내용이 인라인으로 포함되어 있지만, plan 문서는 저장소에 실제로 존재해야 plan-lifecycle 가드(`plan-stale-audit`, `spec-pending-plan-existence.test.ts`)가 동작할 수 있다.
- **제안**: 해당 경로에 파일을 실제로 생성해야 한다.

---

### [CRITICAL] Frontmatter — `worktree` 필드명 불일치

- **target 위치**: 문서 상단 frontmatter
  ```yaml
  ---
  worktree: spec-exec-intake-queue
  started: 2026-06-04
  owner: project-planner
  ---
  ```
- **위반 규약**: `plan-lifecycle.md §4 Frontmatter 스키마` — `worktree: <task_name>-<slug>` 형식 의무
- **상세**: `spec-exec-intake-queue` 는 `<task_name>-<slug>` 패턴에는 부합하나, worktree 디렉토리 이름과 일치해야 한다. 현재 실행 worktree 는 `.claude/worktrees/spec-exec-intake-queue` 이므로 값 자체는 정합하다. 다만 `spec-exec-intake-queue` 는 `<task_name>` + `<slug>` 가 결합된 형태로, `spec` 이 task_name 이고 `exec-intake-queue` 가 slug 인 구조로 해석되며 패턴 적합성은 OK.
- **상세**: 이 항목은 정합 — CRITICAL 취소, INFO 강등.

---

### [WARNING] plan 문서에 `owner` 필드 사용 — 정식 스키마에 없는 필드

- **target 위치**: 문서 상단 frontmatter (`owner: project-planner`)
- **위반 규약**: `plan-lifecycle.md §4` — 공식 frontmatter 스키마는 `worktree` / `started` 두 필드만 정의. `owner` 는 스키마에 없다.
- **상세**: `owner` 필드를 추가하는 것은 스키마를 벗어나는 확장이다. 일관성 문제를 일으키지 않는 수준이지만, 공식 스키마에 없는 필드다.
- **제안**: (a) `owner` 필드를 삭제하고 frontmatter 를 스키마에 맞추거나, (b) `plan-lifecycle.md §4` 를 갱신해 `owner` 를 선택 필드로 추가. 여러 plan 에서 `owner` 필드를 공통으로 쓴다면 규약 갱신이 적절.

---

### [WARNING] 후속 항목 체크리스트 — 미완료 항목 포함 (plan lifecycle 기대 상태)

- **target 위치**: `## 후속` 섹션
  ```markdown
  - [ ] `/consistency-check --spec plan/in-progress/spec-draft-exec-intake-queue.md` 통과 (BLOCK: NO)
  - [ ] spec 본문 반영 (§4 / §7.1 / §7.2 / §7.4-7.5 / §8 + 0-overview §2.4/§2.6/Rationale)
  - [ ] side-effect 점검 ...
  - [ ] 구현 추적 plan 신설 ...
  ```
- **위반 규약**: `plan-lifecycle.md §2` — 미체크 체크박스가 하나라도 있으면 `in-progress/` 에 위치해야 한다. 이 자체는 규약 준수(이 문서가 `in-progress/` 임)이나, consistency-check 가 선행 통과 조건으로 지정된 항목이 현재 이 reviewrun 에서 수행 중임.
- **상세**: 구조 자체는 plan-lifecycle 에 부합하나, `(BLOCK: NO)` 표기가 consistency-check 통과 여부를 미래 체크박스로 남긴 것인지 이미 통과됐다는 표기인지 불명확하다. `BLOCK: NO` 가 "이 항목은 현재 BLOCK 아님(optional)"을 뜻하면 OK. "아직 BLOCK 여부 미결" 이라면 순환 참조 구조.
- **제안**: 체크리스트 항목 옆 주석 의미를 명확히 할 것. `BLOCK: NO` → `(완료 시 체크)` 또는 `(필수, 선행조건)` 으로 의도 명시 권장.

---

### [WARNING] 문서 구조 — 3섹션(Overview / 본문 / Rationale) 구성이 CLAUDE.md 권장과 일치하나 spec draft plan 내 구성임에 주의

- **target 위치**: 문서 전체 구조
- **위반 규약**: CLAUDE.md — "정보 저장 위치" 규약. spec draft 의 실제 내용은 `spec/<영역>/<file>.md` 본문이어야 하며, plan 문서는 *어떤* spec 을 *어떻게* 변경할지 기술하는 작업 추적 문서다.
- **상세**: 이 plan 문서는 실질적인 spec 내용(§4 / §7.1 / §8 등 전체 재정의 본문)을 담고 있어, spec 문서(`spec/5-system/4-execution-engine.md`) 에 위치해야 할 내용이 plan 에 작성된 상태다. plan 문서가 spec draft 를 인라인으로 담는 패턴은 "일회성 편의" 로 허용 가능하나, spec 본문 반영 전까지는 단일 진실 원칙 위반 위험이 있다.
- **제안**: `## 후속` 의 "spec 본문 반영" 체크리스트 항목이 이를 해소하므로 현재 구조는 허용 가능하다. 단, spec 반영 후 이 plan 에서 중복 내용을 제거하거나 plan 을 `complete/` 로 이동해야 한다.

---

### [INFO] 섹션 번호 `0.` 에서 시작 — spec 문서 섹션 관행과 일치

- **target 위치**: `## 0. 변경 요지`
- **위반 규약**: 없음 — 단순 일관성 관찰
- **상세**: spec 문서들은 통상 `## 1.` 부터 시작하나, 이 plan 에서는 `## 0.` 변경 요지 + `## 1.` ~ `## 7.` + `## 후속` 구성이다. `0.` 섹션은 "개요/변경 요지" 역할로, 관행과 미묘한 차이가 있으나 가독성에 기여하므로 규약 위반은 아니다.
- **제안**: 사소한 형식 일관성 의견이므로 조치 불필요.

---

### [INFO] `triggerKind` 값 열거 — 단일 따옴표·파이프 구분자 혼용

- **target 위치**: `§4.2 job 메시지` JSON 블록의 `"triggerKind": "manual | trigger | schedule"` 와 §4.3 표의 설명
- **위반 규약**: `spec/conventions/node-output.md` 등 — 값 열거 시 일관된 표기 (파이프 `|` vs 콤마 `,`) 를 정식 규약이 명시하지 않으므로 직접 위반은 아님
- **상세**: JSON 예시에서 `"manual | trigger | schedule"` 는 *값* 이 아니라 *타입 표기* 인데, JSON 내에서 파이프로 표현하면 실제 값과 혼동 가능. spec 문서에서는 통상 코드 블록 외부에 `manual | trigger | schedule` 로 표기하거나, TypeScript 유니언 형으로 별도 표기하는 것이 관행.
- **제안**: JSON 예시를 `"triggerKind": "manual"  // "manual" | "trigger" | "schedule"` 형태로 주석 처리하거나, 표 아래에 별도 열거 설명을 두는 것이 가독성에 유리.

---

### [INFO] `execution-run` 큐 이름 — kebab-case 일관성

- **target 위치**: 문서 전반 (`execution-run`, `execution-continuation`, `background-execution`)
- **위반 규약**: 없음 — 기존 큐 이름(`execution-continuation`, `background-execution`) 이 kebab-case 로 일관됨
- **상세**: 신규 큐 `execution-run` 도 kebab-case 를 따라 일관성 유지. 정식 규약 위반 없음.
- **제안**: 조치 불필요.

---

### [INFO] `EXECUTION_RUN_WORKER_CONCURRENCY` 환경변수명 — SCREAMING_SNAKE_CASE 일관성

- **target 위치**: `§4.3 수평 확장` 표
- **위반 규약**: 없음 — 기존 `CONTINUATION_WORKER_CONCURRENCY` 패턴과 동일 명명 규칙 준용
- **상세**: 기존 env 패턴(§7.4 기준) 과 일관하여 정식 규약 위반 없음.
- **제안**: 조치 불필요.

---

## 요약

`plan/in-progress/spec-draft-exec-intake-queue.md` 는 plan-lifecycle §4 frontmatter 스키마(추가 `owner` 필드), 그리고 파일이 실제로 저장소에 존재하지 않는다는 CRITICAL 문제를 제외하면 정식 규약을 대체로 준수한다. 문서 구조(변경 요지 / 섹션 본문 / Rationale / 후속 체크리스트)는 CLAUDE.md 의 3섹션 권장 패턴에 준하며, spec 반영 대상 파일·섹션이 명확히 명시되어 있다. 큐 이름·환경변수·상태 전이 표기 등 명명 규약은 기존 관행과 일관한다. 가장 시급한 조치는 (1) 파일을 `plan/in-progress/spec-draft-exec-intake-queue.md` 경로에 실제로 생성하는 것과 (2) `owner` 필드를 스키마에 맞게 제거하거나 규약을 갱신하는 것이다.

## 위험도

MEDIUM
