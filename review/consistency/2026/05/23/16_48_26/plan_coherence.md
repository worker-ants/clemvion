# Plan 정합성 검토 — spec-harness-impl-coverage

검토 대상: `plan/in-progress/spec-harness-impl-coverage.md`
검토 모드: spec draft (--spec)
검토일: 2026-05-23

---

## 발견사항

### [INFO] `0-unimplemented-overview.md` 의 plan 목록이 target plan 을 반영하지 않음
- target 위치: `plan/in-progress/spec-harness-impl-coverage.md` (본 파일 전체)
- 관련 plan: `plan/in-progress/0-unimplemented-overview.md` §plan 문서 목록
- 상세: `0-unimplemented-overview.md` 는 인덱스 역할을 하며 in-progress plan 목록을 열거한다. target plan 이 신설되었으나 이 인덱스에는 아직 등록되지 않았다. 또한 target plan 에서 예고된 후속 plan 5건(`developer-partial-impl-discipline.md`, `spec-frontmatter-rollout.md`, `user-guide-reverse-coverage.md`, `plan-stale-audit.md`, `spec-coverage-slash-command.md`)도 인덱스에 미등록 상태다.
- 제안: target plan 의 본 PR 머지 후 `0-unimplemented-overview.md` §plan 문서 목록의 "follow-up·정합화 묶음" 구역에 `spec-harness-impl-coverage.md` 및 후속 plan 5건을 추가한다.

### [INFO] `harness-i18n-userguide-gap.md` (complete) 와의 관계 명시 없음
- target 위치: target plan §배경 구조적 원인 표
- 관련 plan: `plan/complete/harness-i18n-userguide-gap.md`
- 상세: target plan 은 "기존 harness 는 모두 change-triggered 이며 standing audit 이 부재"라고 진단하면서, 이미 완료된 `harness-i18n-userguide-gap.md` 와의 관계를 명시하지 않는다. `harness-i18n-userguide-gap.md` 는 유사하게 `developer/SKILL.md` §4 와 `PROJECT.md` 를 갱신했으며 `spec/conventions/i18n-userguide.md` 를 신설했다. target plan 의 결정 D 와 결정 E 가 같은 파일들(`developer/SKILL.md` §4, `PROJECT.md` 매핑 표)을 또 갱신하는 구조다. 이전 변경과 중복·충돌 여부 검토가 필요하다. 단, `harness-i18n-userguide-gap.md` 는 이미 complete 상태이므로 active 경합 위험은 없고, 내용 충돌 여부만 사전 확인이 필요하다.
- 제안: target plan §3 side-effect 점검 또는 §의식적 결정 포인트에 "기존 `i18n-userguide.md` 규약 및 `developer/SKILL.md` §4 의 기존 매핑표와 target 결정 D·E 가 중복·충돌 없는지" 확인 항목을 추가한다.

### [INFO] `ai-presentation-tools.md` 가 `spec/conventions/conversation-thread.md` 미완료 상태로 남긴 항목과 target plan 의 user-guide-evidence 간 무관계 확인 필요
- target 위치: target plan 결정 B `spec/conventions/user-guide-evidence.md` 신설
- 관련 plan: `plan/in-progress/ai-presentation-tools.md` §4.1 — `spec/conventions/conversation-thread.md §1.2` 갱신 미완료 (`[ ]`)
- 상세: `ai-presentation-tools.md` 는 `spec/conventions/conversation-thread.md §1.2` 를 아직 미완료(`[ ]`)로 남겨두고 있다. target plan 은 `spec/conventions/user-guide-evidence.md` 를 신설할 뿐이며 `conversation-thread.md` 에는 손대지 않으므로 직접 파일 경합은 없다. 그러나 target plan 결정 A 가 `spec/conventions/spec-impl-evidence.md` 신설과 대상 spec 파일 전체에 frontmatter 추가를 정의하는데, `spec/conventions/conversation-thread.md` 도 대상 spec 파일 (`spec/conventions/**.md`) 에 해당한다. 즉 `spec-frontmatter-rollout.md` (후속 plan 2) 가 실행될 때 `ai-presentation-tools.md` 가 아직 `conversation-thread.md` 를 수정 중이라면 frontmatter 삽입과 §1.2 갱신이 같은 파일에서 경합할 가능성이 있다.
- 제안: 후속 plan `spec-frontmatter-rollout.md` 착수 전에 `ai-presentation-tools.md` 의 `conversation-thread.md` 관련 항목이 완료됐는지 확인한다. target plan 의 §후속 구현 plan 표에 "의존 확인: `ai-presentation-tools.md` 의 `conversation-thread.md` 미완료 항목이 spec-frontmatter-rollout 착수 전 merge 됐는지 확인" 을 메모로 추가하는 것이 권장된다.

### [INFO] target plan 이 `spec/conventions/**.md` 전체를 frontmatter 대상으로 규정하는데, 현재 진행 중인 convention 신설 plan 들이 이를 인지하지 못하고 있음
- target 위치: 결정 A — `spec/conventions/**.md` 도 frontmatter 대상 파일로 명시
- 관련 plan: `plan/in-progress/ai-presentation-tools.md` (conversation-thread.md 갱신), `plan/in-progress/spec-telegram-chat-channel-ui-polish.md` (chat-channel-adapter.md 갱신), `plan/in-progress/cafe24-backlog-residual.md` (spec/conventions/swagger.md 참조)
- 상세: 결정 A 확정 후 `spec/conventions/` 파일에 frontmatter 를 일괄 삽입하는 작업(후속 plan 2 `spec-frontmatter-rollout.md`)이 시작될 텐데, 위 plan 들이 같은 기간 동안 convention 파일을 수정하고 있다면 git 충돌 또는 frontmatter 미적용 파일이 발생할 수 있다. 하지만 이는 후속 plan 2 의 착수 시점 문제이지 현재 target plan 의 spec 정의 자체에서 발생하는 충돌은 아니다.
- 제안: 후속 plan `spec-frontmatter-rollout.md` frontmatter 에 "착수 전에 `spec/conventions/` 를 손대는 active worktree 목록 확인" 을 의존 항목으로 명시한다. target plan 자체는 spec 정의만 이므로 현 단계에서는 조치 불필요.

---

## 미해결 결정 우회 검토

target plan 이 참조하는 다른 in-progress plan 의 미해결 결정과 충돌하는지 확인했다.

- `ai-agent-tool-connection-rewrite.md` 의 미결 결정(도구 등록 모델 등 5개 TBD)과 target plan 결정 B·C 는 직접 충돌하지 않는다. target plan 은 AI Agent 도구 연결 설계를 건드리지 않는다.
- `ai-presentation-tools.md` 의 미완료 spec 항목들과 target plan 의 `spec/conventions/` 신설은 같은 파일을 동시에 손대지 않으므로 직접 충돌 없다.
- 기타 in-progress plan 은 target plan 이 다루는 `spec/conventions/spec-impl-evidence.md`, `spec/conventions/user-guide-evidence.md`, `.claude/docs/plan-lifecycle.md`, `.claude/skills/developer/SKILL.md §4`, `PROJECT.md` 매핑 표를 동시에 수정하지 않는다.

## worktree 충돌 검토

target plan 의 worktree 는 `.claude/worktrees/harness-spec-impl-coverage-befc2f/` 이다. 동일 spec/conventions 파일을 현재 수정 중인 다른 active worktree(`ai-presentation-tools-9b7c5c`, `telegram-chat-channel-spec-polish-49c49b` 등)는 각각 `spec/conventions/conversation-thread.md`, `spec/conventions/chat-channel-adapter.md` 를 대상으로 한다. target plan 이 신설하는 `spec/conventions/spec-impl-evidence.md` 와 `spec/conventions/user-guide-evidence.md` 는 신규 파일이므로 기존 worktree 와 git 충돌이 발생하지 않는다. `developer/SKILL.md §4` 와 `PROJECT.md` 도 다른 active worktree 가 현재 수정 중인 파일이 아닌 것으로 확인됐다.

---

## 요약

target plan `spec-harness-impl-coverage.md` 는 다른 진행 중 plan 에서 미결로 남긴 설계 결정을 우회하지 않으며, 동일 파일을 동시에 수정하는 active worktree 충돌도 없다. 신설하는 두 convention 파일(`spec-impl-evidence.md`, `user-guide-evidence.md`)은 신규이므로 git 경합 위험이 전혀 없다. 다만 후속 plan 2(`spec-frontmatter-rollout.md`)가 착수될 시점에 `ai-presentation-tools.md` 와 `spec-telegram-chat-channel-ui-polish.md` 등이 `spec/conventions/` 파일을 아직 수정 중일 가능성이 있어, 해당 시점에 순서를 조율할 필요가 있다. 또한 결정 D·E 가 수정하는 `developer/SKILL.md §4` 및 `PROJECT.md` 매핑 표는 완료된 `harness-i18n-userguide-gap.md` 가 먼저 손댄 파일이므로, 구현 단계 착수 전 기존 내용과의 중복 여부를 확인하는 것이 권장된다. 전체적으로 현 시점의 plan 정합성 위험도는 낮다.

---

## 위험도

LOW
