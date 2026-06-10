# 정식 규약 준수 검토 결과

- 검토 대상: branch `claude/spec-sync-audit-998544` 변경분 (spec/plan/review ~80파일)
- 검토 기준: `spec/conventions/spec-impl-evidence.md` · `spec/conventions/cafe24-api-catalog/_overview.md` · `CLAUDE.md` 명명 컨벤션
- 검토일: 2026-06-10

---

## 발견사항

### [WARNING] `spec/1-data-model.md` — `status: implemented` + 비어있지 않은 `pending_plans` 불일치

- **target 위치**: `/spec/1-data-model.md` frontmatter
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §3` — `implemented` = "모든 약속 구현 완료", `pending_plans:` 없음
- **상세**: 현재 frontmatter 에 `status: implemented` 이면서 `pending_plans: [plan/in-progress/exec-park-durable-resume.md]` 가 동시에 선언되어 있다. `spec-impl-evidence.md §3` 표에서 `implemented` 행의 `pending_plans:` 칸은 "없음" 이고, `§5.3` 완성 머지 예시도 `pending_plans` 를 제거한다. `exec-park-durable-resume.md` 는 실행 엔진 레벨 미완 기능이므로 `spec/1-data-model.md` 의 status 를 `partial` 로 낮추거나, `pending_plans` 링크를 `spec/5-system/4-execution-engine.md` 로 옮겨야 정합적이다. `1-data-model.md` 는 `EXCLUDE_BASENAMES` 에 포함돼 build guard 가 검증하지 않으므로 CI 상 실패는 없으나 문서 읽는 사람에게 혼동을 준다.
- **제안**: `status: partial` + `pending_plans: [plan/in-progress/exec-park-durable-resume.md]` 로 교정. 또는 `exec-park` plan 이 data-model 변경이 아니라면 `pending_plans` 를 제거하고 `status: implemented` 유지.

---

### [WARNING] `plan/in-progress/spec-sync-common-gaps.md` — `worktree` 필드가 존재하지 않는 worktree 참조

- **target 위치**: `plan/in-progress/spec-sync-common-gaps.md` frontmatter `worktree: spec-sync-audit`
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4` — `worktree: <task_name>-<slug>` 실존 디렉토리 이름 또는 sentinel `(unstarted)`. `plan-frontmatter.test.ts` 는 worktree 가 `(unstarted)` 가 아닐 경우 실존 worktree 와 일치 여부를 `plan_coherence` 로 검증한다.
- **상세**: 현재 실존하는 worktree 는 `spec-sync-audit-998544` 뿐이며 `spec-sync-audit` 는 어떤 worktree 목록에도 없다. 이 불일치는 `plan_coherence` checker 가 이 plan 파일을 고아(orphan) 항목으로 오탐할 수 있다. 본 plan 이 이전 spec-sync-audit 작업에서 만들어진 carry-over 라면 worktree 를 현재 작업 worktree 인 `spec-sync-audit-998544` 로 갱신하거나, 완전히 완료된 plan 이면 `plan/complete/` 로 이동해야 한다.
- **제안**: `worktree: spec-sync-audit-998544` 로 갱신. 미완 항목이 남아있어 in-progress 가 맞으나 현 worktree 에서 진행 중이라면 이 값이 정확하다.

---

### [INFO] `spec/conventions/execution-context.md` — `status: implemented` 에 불필요한 `pending_plans: []` 선언

- **target 위치**: `spec/conventions/execution-context.md` frontmatter
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §3` — `implemented` 시 `pending_plans:` 는 "없음" (칸 자체 생략 권장, `§5.3` 예시 참조)
- **상세**: `status: implemented` 인 spec 에 `pending_plans: []` 빈 배열을 명시해도 `spec-pending-plan-existence.test.ts` 는 통과하지만(빈 배열 = 검증 대상 없음), `§5.3` 완성 머지 예시는 키 자체를 생략한다. 형식 일관성 차원에서 키 자체를 제거하는 것이 권장 패턴이다.
- **제안**: `pending_plans: []` 줄 삭제.

---

### [INFO] `spec/conventions/spec-impl-evidence.md` — Overview 단락 내 guard 건수 교정 (`5건` → `4건`) 적절

- **target 위치**: `spec/conventions/spec-impl-evidence.md` Overview 단락, `§4 의 frontmatter-evidence 가드(4건)` 문장
- **위반 규약**: 해당 없음 (규약 준수 수정)
- **상세**: 이전 버전의 "5건" 은 §4 표의 실제 가드 행 수(4개: `spec-frontmatter.test.ts` / `spec-code-paths.test.ts` / `spec-status-lifecycle.test.ts` / `spec-pending-plan-existence.test.ts`)와 불일치했다. 본 브랜치에서 "4건" 으로 교정하고 "§4.0" → "§4.2" cross-reference 도 실제 섹션 번호로 교정한 것은 규약 내부 일관성을 높이는 올바른 변경이다.

---

### [INFO] `spec/data-flow/` 영역 — frontmatter 없음이 정상 (적용 대상 외)

- **target 위치**: `spec/data-flow/*.md` 전체
- **위반 규약**: 해당 없음 (정상)
- **상세**: `spec-impl-evidence.md §1` 의 frontmatter 의무 대상은 `spec/2-navigation/**`, `spec/3-workflow-editor/**`, `spec/4-nodes/**`, `spec/5-system/**`, `spec/7-channel-web-chat/**`, `spec/conventions/**` 6개 경로이다. `spec/data-flow/` 는 이 목록에 없으므로 frontmatter 없음이 규약에 부합한다. 신규 생성된 `13-agent-memory.md` / `14-chat-channel.md` / `15-external-interaction.md` 도 동일하게 적용 대상 외이다.

---

### [INFO] `spec/data-flow/0-overview.md` — 신규 파일 3개 링크 정상 확인

- **target 위치**: `spec/data-flow/0-overview.md` 본문 테이블
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §4.2` `spec-area-index.test.ts` — index 문서가 모든 sibling spec 을 링크해야 함
- **상세**: 신규 추가된 `13-agent-memory.md` / `14-chat-channel.md` / `15-external-interaction.md` 세 파일 모두 `0-overview.md` 의 테이블에서 링크된다. `spec-area-index.test.ts` 의 인덱스 문서 패턴 (`0-*.md`)에 해당하는 `0-overview.md` 가 이 역할을 수행하므로 가드 통과 예상.

---

### [INFO] `spec/4-nodes/0-overview.md` — `EXCLUDE_BASENAMES` 제외 대상이나 frontmatter 보유 (정상)

- **target 위치**: `spec/4-nodes/0-overview.md` frontmatter
- **위반 규약**: 해당 없음 (정상)
- **상세**: basename `0-overview.md` 는 `EXCLUDE_BASENAMES` 에 등재되어 frontmatter 요건 검사에서 제외되지만, frontmatter 를 보유해도 규약 위반이 아니다. 해당 파일은 `status: partial` + `pending_plans: [marketplace-and-plugin-sdk.md]` (실존 확인)로 내부 일관성 유지. 가드는 이 파일을 건너뛰므로 build 에 영향 없음.

---

## 요약

본 브랜치의 ~80개 spec/plan/review 변경 파일 중 정식 규약(`spec/conventions/spec-impl-evidence.md` · `plan-lifecycle.md` · CLAUDE.md 명명 컨벤션) 관점의 위반은 CRITICAL 단계가 없다. **WARNING 2건**이 있다: (1) `spec/1-data-model.md` 가 `status: implemented` 이면서 `pending_plans` 에 미완 plan 을 나열하는 논리적 불일치(EXCLUDE_BASENAMES 예외라 build 차단 없음), (2) `plan/in-progress/spec-sync-common-gaps.md` 의 `worktree` 필드가 현존하지 않는 worktree 이름을 가리켜 `plan_coherence` 오탐 가능성. **INFO 4건**은 형식 일관성 권고 수준이다. 신규 data-flow 3개 파일(13·14·15)의 index 링크는 정상이고, frontmatter 필수 대상 경로 변경 파일 전체에 frontmatter 가 존재하며 status/code/pending_plans 구성도 규약 준수다.

## 위험도

LOW
