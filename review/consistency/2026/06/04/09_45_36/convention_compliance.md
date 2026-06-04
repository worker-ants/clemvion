# 정식 규약 준수 검토 — spec-update-exec-intake-queue-pr1.md

검토 대상: `plan/in-progress/spec-update-exec-intake-queue-pr1.md` (draft, 미생성 상태)
검토 모드: spec draft (--spec)
검토 일시: 2026-06-04

---

## 발견사항

### [INFO] plan frontmatter `worktree` 값 형식 적합
- target 위치: frontmatter line 2 (`worktree: impl-exec-intake-queue`)
- 위반 규약: `.claude/docs/plan-lifecycle.md §4` — `worktree: <task_name>-<slug>` 형식 요구
- 상세: `impl-exec-intake-queue` 는 실제 존재하는 worktree 디렉토리명이며 규약 형식(`<task_name>-<slug>`)과 일치. 이상 없음.
- 제안: 없음 (준수).

### [INFO] plan frontmatter 필수 3 필드 완비
- target 위치: frontmatter lines 1-5
- 위반 규약: `.claude/docs/plan-lifecycle.md §4` — `worktree` / `started` / `owner` 3 필드 필수
- 상세: `worktree`, `started`, `owner` 모두 존재. `started: 2026-06-04` 는 ISO 날짜, `owner: resolution-applier` 는 역할 표기로 적합. 이상 없음.
- 제안: 없음 (준수).

### [WARNING] 적용 절차 §2 — `/consistency-check --spec` 선행 실행을 plan 단계로 명기했으나 실행 주체·결과 확인 방법이 불명확
- target 위치: `## 적용 절차` 섹션, step 2
- 위반 규약: CLAUDE.md §Skill 체계 — `project-planner` 는 `spec/` 쓰기 직전 `consistency-check --spec` 의무; `spec/` 쓰기 권한은 `project-planner` 에만 있음
- 상세: step 1 에서 "`project-planner` 가 본 draft 를 검토·승인" 을 명시한 뒤 step 2 에서 `/consistency-check --spec ...` 실행 후 "BLOCK:NO 확인" 을 적는데, 해당 step 의 실행 주체가 명기되지 않았다. `resolution-applier`(본 plan 의 owner)가 `/consistency-check` 를 호출하는 것인지 `project-planner` 가 승인 과정 안에 포함하는 것인지 모호. `spec/` 쓰기 주체·순서 혼동을 유발할 수 있다.
- 제안: step 2 를 `project-planner` 가 승인 전(또는 승인 직후) 실행하도록 주체를 명기. 예: "2. `project-planner` 가 `/consistency-check --spec spec/5-system/4-execution-engine.md` 실행 → BLOCK:NO 확인".

### [WARNING] 적용 절차 step 4 — `resolution-applier 재호출` 표현이 호출 규약 미준수
- target 위치: `## 적용 절차` 섹션, step 4
- 위반 규약: `.claude/docs/subagent-call-contract.md` (subagent 호출 규약); CLAUDE.md §외부 LLM 호출 정책 — 허용 경로는 `Agent` tool 또는 `Workflow` tool만
- 상세: "spec 갱신 commit 후 `resolution-applier` 재호출" 이라는 표현은 호출 주체·도구가 명기되지 않아, 독자가 직접 `subprocess.run(["claude", ...])` 등을 연상할 여지가 있다. 실질적으로는 main Claude 가 `Agent` tool 로 호출해야 하며, 이 경우 plan 단계 설명에서 허용 경로를 명시하는 것이 규약 취지에 부합한다.
- 제안: "4. spec 갱신 commit 후 orchestrator(main Claude)가 `Agent` tool 로 `resolution-applier` sub-agent 를 재호출 (동일 `session_dir`)" 형태로 명기.

### [INFO] `## 분류` 섹션에서 `SPEC-DRIFT` 표기는 비공식 레이블
- target 위치: `## 분류` 섹션 첫 줄 (`SPEC-DRIFT (코드 개선을 spec 에 반영)`)
- 위반 규약: `spec/conventions/spec-impl-evidence.md §3` — `status` enum 값은 `backlog` / `spec-only` / `partial` / `implemented` / `archived`; `SPEC-DRIFT`는 정의되지 않은 값
- 상세: `SPEC-DRIFT`는 plan 문서 내 **분류 레이블**로 사용되고 있어, spec frontmatter `status` 값이 아니라는 것이 맥락상 명확하다. plan 문서 내에서 변경 성격을 서술하는 자유 레이블로서 규약 위반이 아니다. 단, 추후 이 레이블이 spec frontmatter 의 `status` 위치에 오해를 일으킬 수 있으므로 표기 차이를 명확히 할 것을 권고한다.
- 제안: "분류: `SPEC-DRIFT`" 대신 "변경 성격: spec-drift (SPEC-DRIFT — 코드 개선 반영)" 과 같이, 이 레이블이 plan 내부 서술임을 더 명확히 하는 표현 고려. 필수 수정은 아님.

### [INFO] plan 파일명 kebab-case 준수 여부
- target 위치: 파일 경로 `plan/in-progress/spec-update-exec-intake-queue-pr1.md`
- 위반 규약: `.claude/docs/plan-lifecycle.md §1` — `plan/in-progress/<name>.md`; CLAUDE.md 정보 저장 위치 표
- 상세: 파일명은 `spec-update-exec-intake-queue-pr1` 으로 kebab-case 이며, 다른 in-progress plan 파일들의 명명 패턴(`spec-update-execution-context-options-bag.md` 등)과 일치. `pr1` suffix 는 비규범적이지만 다른 spec 문서와 구분하기 위한 명시적 suffix 로, 규약을 직접 위반하지 않는다. 이상 없음.
- 제안: 없음.

### [INFO] 문서 구조 — Overview / 본문 / Rationale 3섹션 권장 미적용
- target 위치: 문서 전체 구조
- 위반 규약: CLAUDE.md §정보 저장 위치 — "결정의 배경·근거: 해당 spec 문서 끝의 `## Rationale`"; Skill 참고 "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)"
- 상세: 본 target 은 **plan 문서**이며, 3섹션 구성은 `spec/` 문서에 대한 권장이다. plan 문서에 대한 별도 구조 규약(`plan-lifecycle.md §4`)에는 frontmatter + 자유형식이 허용되므로 이 항목은 위반이 아니다. 참고 정보로 기록.
- 제안: 없음 (plan 문서에 적용 비대상).

### [INFO] 제안 변경 내용 — spec 문서 `## Rationale` 절 갱신 여부 미언급
- target 위치: `## 제안 변경` 전체 섹션
- 위반 규약: CLAUDE.md §정보 저장 위치 — "결정의 배경·근거: 해당 spec 문서 끝의 `## Rationale`"
- 상세: `spec/5-system/4-execution-engine.md` 의 §4 배너·§9.3·§11 세 곳을 변경하면서, 해당 spec 문서에 `## Rationale` 절이 있고 이번 변경(PR1 구현 완료로 stale 배너 갱신)의 의사결정 배경을 기록해야 한다면 그 부분도 갱신 대상으로 포함해야 한다. 본 draft 에는 `## Rationale` 갱신에 대한 언급이 없다.
- 제안: 적용 절차 step 3 에 "§ Rationale 갱신 필요 여부 확인" 단계를 추가하거나, `## 범위 외` 섹션에 Rationale 비변경 사유를 명시하면 완결성이 높아진다.

---

## 요약

target plan 문서(`spec-update-exec-intake-queue-pr1.md`)는 frontmatter 필수 필드(`worktree`/`started`/`owner`)를 모두 충족하고, 파일명·경로 규약을 준수하며, plan 내 서술 구조도 기존 in-progress plan 패턴과 일관된다. 주요 우려점은 두 가지다: (1) 적용 절차 step 2 에서 `/consistency-check --spec` 실행 주체가 불명확해 `spec/` 쓰기 권한 규약(`project-planner` 전담)과 충돌 여지가 있고, (2) step 4 의 "`resolution-applier` 재호출" 표현이 허용 LLM 호출 경로(Agent tool / Workflow tool)를 명기하지 않아 규약(CLAUDE.md §외부 LLM 호출 정책)의 취지가 희석된다. 두 항목 모두 WARNING 수준이며 채택 전 수정을 권고한다. Critical 위반은 없다.

---

## 위험도

LOW
