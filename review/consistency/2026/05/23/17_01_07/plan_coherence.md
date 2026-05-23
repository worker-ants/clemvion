# Plan 정합성 검토 — spec-harness-impl-coverage

검토 모드: `--spec`
대상: `plan/in-progress/spec-harness-impl-coverage.md`
worktree: `harness-spec-impl-coverage-befc2f`
검토 일시: 2026-05-23

---

## 발견사항

### [CRITICAL] `.claude/skills/developer/SKILL.md` 동시 수정 worktree 충돌

- **target 위치**: `plan/in-progress/spec-harness-impl-coverage.md §결정 D`, §산출물 위치 (`메타 갱신` 항목), §검증 단계 2
- **관련 plan/worktree**:
  - `claude/ai-agent-turn-fail-finalize-a22724` — `.claude/skills/developer/SKILL.md` 를 main 대비 이미 수정 (§4 DOCUMENTATION 업데이트 항목 갱신, `user-guide-writer` 위임 제거, model 필드 제거)
  - `claude/ai-agent-render-button-user-message-521f33` — 동일 파일 수정 중
  - `worktree-cafe24-backlog-residual-batch`, `claude/cafe24-bg-refresh-tuning-fb72d5`, `worktree-cafe24-spec-polish-f2-f3`, `worktree-integration-action-required-ui`, `claude/llm-retry-after-5a7d63`, `claude/redis-bullmq-env-hardening-7a47dc`, `claude/consistency-check-4-nodes-3b2cd2`, `worktree-multiturn-error-preserve`, `claude/render-form-options-and-state-fix-d72e6d`, `claude/render-presentation-button-click-fix-683f3a`, `claude/telegram-chat-channel-spec-polish-49c49b`, `claude/telegram-guide-realign-14fa1e` — 동일 파일 수정 중
- **상세**: target plan 의 결정 D-1 은 `.claude/skills/developer/SKILL.md §4` 본문에 `partial-implementation 분리` 한 줄 추가를 명시한다. 그러나 `ai-agent-turn-fail-finalize-a22724` 브랜치가 이 파일의 §4 항목을 이미 다르게 개정하고 있으며 (user-guide-writer 위임 구문 제거 등), 12개 이상의 worktree 에 동일 파일 수정이 산재한다. PR 머지 순서에 따라 target 의 §4 추가가 stale 기준에 덮어쓰여질 수 있다.
- **제안**: target plan spec PR 머지 시점까지 `.claude/skills/developer/SKILL.md` 변경이 포함된 위 worktree 들이 먼저 머지·정리되거나, 또는 target plan 이 해당 파일 수정을 `developer-partial-impl-discipline.md` (후속 plan 1) 범위로만 두어 현재 PR 에서 직접 갱신하지 않음을 명시해야 한다.

---

### [CRITICAL] `CLAUDE.md` §정보 저장 위치 표 동시 수정 충돌

- **target 위치**: `plan/in-progress/spec-harness-impl-coverage.md §결정 E-6`
- **관련 plan/worktree**:
  - `claude/ai-agent-turn-fail-finalize-a22724` — `CLAUDE.md` 의 `정보 저장 위치` 표에서 기존 행 하나를 **삭제**하는 변경이 이미 커밋됨 (루트 레벨 `spec/0-overview.md` cross-cutting 행 제거)
  - `worktree-cafe24-backlog-residual-batch`, `claude/cafe24-bg-refresh-tuning-fb72d5`, `worktree-cafe24-spec-polish-f2-f3`, `worktree-integration-action-required-ui`, `claude/llm-retry-after-5a7d63`, `claude/redis-bullmq-env-hardening-7a47dc` — 동일 CLAUDE.md 버전을 베이스로 수정 중
- **상세**: target plan 의 결정 E-6 은 `CLAUDE.md §정보 저장 위치 표` 에 `Spec-impl coverage standing audit 산출물 → review/consistency/coverage/<YYYY>/...` 신규 행을 추가한다. 그런데 `ai-agent-turn-fail-finalize-a22724` 브랜치는 `CLAUDE.md` 의 동일 표에서 루트 레벨 `spec/0-overview.md` 행을 이미 제거했다 (diff 확인). 두 브랜치가 동일 파일 표 부분을 반대 방향(행 추가 vs 행 삭제)으로 편집 중이므로 머지 충돌이 확실하다.
- **제안**: 위 CRITICAL 브랜치들이 main 에 먼저 도달한 후 target plan 을 리베이스하거나, target plan 의 E-6 CLAUDE.md 변경을 별도 post-merge 정합 커밋으로 분리하여 충돌을 명시적으로 처리한다.

---

### [CRITICAL] `PROJECT.md` 동시 수정 충돌

- **target 위치**: `plan/in-progress/spec-harness-impl-coverage.md §결정 E` 전체 (E-1 ~ E-5)
- **관련 plan/worktree**:
  - `claude/ai-agent-turn-fail-finalize-a22724` — `PROJECT.md` 의 §빌드·린트·테스트 명령 표 재구성, §e2e 실행 원칙 절 전체 삭제, §변경 유형 → 갱신 위치 매핑 표 일부 편집을 포함하는 대규모 개편이 이미 커밋됨
  - `worktree-cafe24-backlog-residual-batch`, `claude/cafe24-bg-refresh-tuning-fb72d5`, `worktree-cafe24-spec-polish-f2-f3`, `worktree-integration-action-required-ui`, `claude/llm-retry-after-5a7d63`, `claude/redis-bullmq-env-hardening-7a47dc` — 동일 PROJECT.md 개편 버전을 베이스로 추가 수정 중
- **상세**: target plan 의 결정 E 는 `PROJECT.md §변경 유형 → 갱신 위치 매핑 표` 에 신규 row 2개(E-1), `§자주 누락되는 항목` 에 신규 항목 2개(E-2), `§DOCUMENTATION 단계 종료 사전 체크리스트` 에 신규 체크박스(E-3), `§자동 가드` 표에 신규 row 7개(E-4), `§유저 가이드 파일 컨벤션 SoT 문서 인덱스` 에 신규 row 2개(E-5)를 추가한다. `ai-agent-turn-fail-finalize-a22724` 가 이미 PROJECT.md 에서 이 절들을 재편했으므로 target plan 이 편집할 행 번호·구조 자체가 달라진 상태다.
- **제안**: PROJECT.md 의 현재 다수 브랜치 수정이 먼저 정리되어 main 에 반영된 후, target plan 의 E 변경이 새로운 파일 구조 기준으로 작성되어야 한다.

---

### [CRITICAL] `.claude/agents/user-guide-writer.md` 동시 수정 충돌

- **target 위치**: `plan/in-progress/spec-harness-impl-coverage.md §결정 B`, §산출물 위치 (`메타 갱신` 항목의 `user-guide-writer.md` 갱신)
- **관련 plan/worktree**:
  - `claude/ai-agent-turn-fail-finalize-a22724` — `.claude/agents/user-guide-writer.md` 파일을 **완전히 삭제**하는 커밋이 이미 있음 (diff 확인: 파일 전체 삭제)
  - `worktree-cafe24-backlog-residual-batch`, `claude/cafe24-bg-refresh-tuning-fb72d5`, `worktree-cafe24-spec-polish-f2-f3`, `worktree-integration-action-required-ui`, `claude/llm-retry-after-5a7d63`, `claude/redis-bullmq-env-hardening-7a47dc` — 동일 삭제 커밋 포함
- **상세**: target plan 의 결정 B 는 `user-guide-writer` sub-agent 의 자가 검증 체크리스트에 "GUI 흐름 절에 `<ImplAnchor>` 동반" 항목을 추가하는 것이다. 그런데 `ai-agent-turn-fail-finalize-a22724` 브랜치는 해당 파일을 완전히 삭제했다. 파일이 삭제된 상태에서 target plan 이 해당 파일을 수정하면 머지 불가 충돌이 발생한다.
- **제안**: `user-guide-writer.md` 의 삭제 여부와 결정 B 의 자가 검증 체크리스트 추가가 공존 가능한지 먼저 결정해야 한다. 삭제가 올바른 방향이라면 target plan 의 결정 B 강제력 확보 항목 3번을 다른 파일 (예: `developer/SKILL.md` 내 user-guide 작성 절) 에 반영하도록 수정한다.

---

### [WARNING] `spec/conventions/conversation-thread.md` 미완료 의존 — ai-presentation-tools plan 선행 조건

- **target 위치**: `plan/in-progress/spec-harness-impl-coverage.md §후속 구현 plan` plan 2 (`spec-frontmatter-rollout.md`), 주석 `"착수 전 ai-presentation-tools.md 의 conversation-thread.md 관련 항목 완료 확인 (plan_coherence I-11)"`
- **관련 plan**: `plan/in-progress/ai-presentation-tools.md` — `spec/conventions/conversation-thread.md §1.2 갱신` 항목이 `[ ]` (미완료) 로 남아 있음
- **상세**: target plan 이 명시한 대로 후속 plan 2 (`spec-frontmatter-rollout.md`) 는 `ai-presentation-tools.md` 의 `conversation-thread.md` 관련 항목 완료 후 착수해야 한다. 현재 `ai-presentation-tools.md` 에 해당 체크박스가 미완료 상태이고, 해당 worktree (`ai-presentation-tools-9b7c5c`) 는 git worktree 목록에서 발견되지 않는다 (worktree 제거되었을 수 있음). 만약 ai-presentation-tools worktree 가 사라졌다면 plan 이 고아 상태가 되어 conversation-thread.md 미완 항목이 영구 누락될 위험이 있다.
- **제안**: `ai-presentation-tools.md` 의 `spec/conventions/conversation-thread.md §1.2 갱신` 등 미완 spec 항목의 완료 여부 및 worktree 상태를 확인한다. worktree 가 없다면 plan 을 다른 worktree 에서 인계받아 완료하거나 해당 항목의 완료 기준을 명시한다.

---

### [WARNING] `0-unimplemented-overview.md` 인덱스 등록 시점 모호

- **target 위치**: `plan/in-progress/spec-harness-impl-coverage.md §후속 구현 plan` (마지막 줄: `plan/in-progress/0-unimplemented-overview.md 인덱스에도 등록 (plan_coherence I-9 반영)`)
- **관련 plan**: `plan/in-progress/0-unimplemented-overview.md` — 현재 `spec-harness-impl-coverage.md` 에 대한 인덱스 항목 없음, 후속 plan 5건도 미등록
- **상세**: target plan 은 "본 spec PR 머지 후 enumerate" 라고 명시하면서 동시에 `0-unimplemented-overview.md` 인덱스 등록도 요구한다. 그러나 현재 `0-unimplemented-overview.md` 에 본 plan 과 후속 5개 plan 이 한 줄도 등록되어 있지 않다. plan_coherence I-9 를 반영하겠다고 명시했으나 아직 실제 등록이 이루어지지 않았다.
- **제안**: `0-unimplemented-overview.md` 에 `spec-harness-impl-coverage.md` 본 plan 과 예정 후속 5건을 stub 으로 등록하거나, "본 spec PR 머지 후" 시점에 일괄 등록하는 체크박스를 본 plan 에 명시해 누락 위험을 줄인다.

---

### [WARNING] `spec-overview-followups-2026-05-18.md` 의 CLAUDE.md 미머지 PR 와 target 의 CLAUDE.md 변경 중복 위험

- **target 위치**: `plan/in-progress/spec-harness-impl-coverage.md §결정 E-6`
- **관련 plan**: `plan/in-progress/spec-overview-followups-2026-05-18.md` §4 — `CLAUDE.md §정보 저장 위치 표` 루트 레벨 행 추가, `[ ] PR + merge` 4건 모두 미머지 상태
- **상세**: `spec-overview-followups-2026-05-18.md` §4 의 CLAUDE.md 변경은 이미 worktree 내 커밋으로 적용됐으나 PR 이 미머지 상태다 (해당 worktree `spec-overview-followups-bundle` 은 현재 git worktree 목록에서 발견되지 않음, 즉 작업 중단 또는 PR 만 남은 상태). target plan 이 같은 표에 행을 추가하므로 머지 순서에 따라 CLAUDE.md 충돌 가능성이 있다. 단, CRITICAL 등급의 `ai-agent-turn-fail-finalize-a22724` 충돌이 먼저 해소되면 이 항목은 자동으로 흡수될 수 있다.
- **제안**: `spec-overview-followups-2026-05-18.md` 의 PR 4건이 완료·머지된 후 target plan 의 CLAUDE.md 변경을 수행한다.

---

### [INFO] `ai-agent-tool-connection-rewrite.md` 의 미결 디자인 결정과 후속 plan 2 (`spec-frontmatter-rollout.md`) 착수 시 주의

- **target 위치**: `plan/in-progress/spec-harness-impl-coverage.md §후속 구현 plan` plan 2 설명
- **관련 plan**: `plan/in-progress/ai-agent-tool-connection-rewrite.md` §1 — 도구 등록 모델 / 시그니처 / 실행 컨텍스트 / 결과 라우팅 / ND-AG-21 우선순위 규칙 5개 항목이 모두 TBD (사용자 합의 대기)
- **상세**: `spec-frontmatter-rollout.md` (후속 plan 2) 가 spec 파일 60여 개에 frontmatter 를 일괄 추가할 때, `spec/4-nodes/3-ai/1-ai-agent.md` 의 `status:` 를 무엇으로 설정할지 결정해야 한다. 해당 spec 에는 tool connection 재작성 예정 박스가 있으므로 `partial` 또는 `spec-only` 가 적절한데, `ai-agent-tool-connection-rewrite.md` 의 5개 디자인 결정이 미결이면 `pending_plans:` 에 등록할 plan 경로도 확정하기 어렵다.
- **제안**: spec-frontmatter-rollout 착수 시 `ai-agent-tool-connection-rewrite.md` 의 결정 기록 절이 채워졌는지 확인하고, 미결 상태라면 `spec/4-nodes/3-ai/1-ai-agent.md` 를 `status: partial` + `pending_plans: [plan/in-progress/ai-agent-tool-connection-rewrite.md]` 로 먼저 설정한 뒤 추후 갱신하는 절차를 명시한다.

---

### [INFO] `spec-overview-followups-2026-05-18.md` 의 4개 미머지 PR 이 spec-frontmatter-rollout (후속 plan 2) 의 `spec/0-overview.md` frontmatter 결정에 영향 가능

- **target 위치**: `plan/in-progress/spec-harness-impl-coverage.md §결정 A` — 대상 spec 파일 범위 (`spec/0-overview.md` 는 `단순 overview` 로 제외됨)
- **관련 plan**: `plan/in-progress/spec-overview-followups-2026-05-18.md` §3 — `spec/0-overview.md` 말미 `## Rationale` 섹션 신설 (`[x]` 완료, 미머지)
- **상세**: target plan 결정 A 는 `spec/0-overview.md` 를 frontmatter 대상에서 제외하는데, 이는 단순 overview 파일이기 때문이다. `spec-overview-followups` §3 은 `spec/0-overview.md` 에 Rationale 섹션을 추가하는 변경이 미머지 상태이다. 직접 충돌은 없으나 두 변경이 같은 파일을 손대므로 머지 후 파일 구조 변화를 후속 plan 2 착수 전 확인하는 것이 권장된다.
- **제안**: 추적 메모로 충분. spec-frontmatter-rollout 착수 전 `spec/0-overview.md` 의 최신 상태를 확인한다.

---

## 요약

target plan `spec-harness-impl-coverage.md` 은 5개 결정(A~E)을 단일 spec PR 로 묶은 포괄적 변경으로, 구조적으로는 잘 설계되어 있다. 그러나 현재 실행 환경에서 4개 CRITICAL 충돌이 존재한다. 핵심은 `.claude/skills/developer/SKILL.md`, `CLAUDE.md §정보 저장 위치 표`, `PROJECT.md`, `.claude/agents/user-guide-writer.md` 의 4개 파일을 동시에 수정 중인 worktree 가 최소 6개(최대 12개)이며, 그 중 `ai-agent-turn-fail-finalize-a22724` 는 이미 main 대비 대규모 개편(PROJECT.md §e2e 실행 원칙 절 전체 삭제, CLAUDE.md 행 삭제, `user-guide-writer.md` 파일 완전 삭제)을 커밋한 상태다. target plan 이 이 파일들을 동시에 편집하면 머지 시 결정적 충돌이 발생한다. 위 CRITICAL 충돌을 해소(경쟁 브랜치 선머지 또는 target plan 의 해당 파일 수정 범위 조정)하기 전까지 target plan 의 spec/conventions 신설과 후속 plan 5건의 구조적 설계는 문제없으나, 메타 파일(CLAUDE.md/PROJECT.md/SKILL.md/user-guide-writer.md) 변경 부분은 착수가 차단되어야 한다.

## 위험도

CRITICAL
