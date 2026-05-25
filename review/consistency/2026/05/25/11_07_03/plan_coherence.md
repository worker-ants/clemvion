# Plan 정합성 검토 — spec-draft-chat-channel-error-notify.md

검토 대상: `plan/in-progress/spec-draft-chat-channel-error-notify.md`
검토 모드: `--spec` (spec draft 검토)
검토 일시: 2026-05-25

---

## 발견사항

### [INFO] `chat-channel-outbound-still-broken` worktree — stale skip

- target 위치: target frontmatter `target_specs` — `spec/5-system/15-chat-channel.md`
- 관련 plan: `plan/in-progress/chat-channel-outbound-still-broken.md` (worktree: `.claude/worktrees/chat-channel-outbound-still-broken-afe293`)
- 상세: 해당 plan의 `related_specs` 에 `spec/5-system/15-chat-channel.md`가 포함되며 동일 파일을 건드리는 후보이나, stale 판정 cascade Step 2 에서 PR `MERGED` 확인 — squash merge로 branch HEAD가 main ancestor 검사(Step 1)를 통과 못했으나 PR 상태로 stale 판정. `.claude/worktrees/chat-channel-outbound-still-broken-afe293` 디렉토리도 실재하지 않음.
- 제안: `git worktree remove` 또는 `cleanup-worktree-all.sh --yes --force` 로 정리 권장. plan 파일은 `git mv plan/in-progress/chat-channel-outbound-still-broken.md plan/complete/` 로 이동 권장.

---

### [INFO] `fix-chat-channel-dispatcher-and-cafe24-warn` worktree — stale skip

- target 위치: target frontmatter `target_specs` — `spec/5-system/15-chat-channel.md`
- 관련 plan: `plan/in-progress/fix-chat-channel-dispatcher-and-cafe24-warn.md` (branch: `claude/fix-chat-channel-dispatcher-and-cafe24-warn-68da78`)
- 상세: `related_specs`에 `spec/5-system/15-chat-channel.md`가 포함되어 worktree 충돌 후보였으나, Step 1(ancestor 검사) 통과 못함 + Step 2 PR `MERGED` 확인 — stale 판정.
- 제안: plan 파일을 `plan/complete/`로 이동 권장.

---

### [INFO] `telegram-chat-channel-spec-polish-49c49b` worktree — stale skip

- target 위치: target `target_specs` — `spec/5-system/15-chat-channel.md`, `spec/conventions/chat-channel-adapter.md`, `spec/4-nodes/7-trigger/providers/telegram.md`
- 관련 plan: `plan/in-progress/spec-telegram-chat-channel-ui-polish.md` (branch: `claude/telegram-chat-channel-spec-polish-49c49b`)
- 상세: 이 plan은 동일한 5개 spec 파일(15-chat-channel.md, chat-channel-adapter.md, telegram.md, 12-webhook.md, 1-data-model.md)을 갱신했으나, Step 2 PR `MERGED` 확인 — stale 판정. 해당 spec 파일들에는 이미 R-CC-10 ~ R-CC-14가 반영되어 있어 target의 R-CC-15 추가와 직접적인 textual 충돌 없음.
- 제안: plan 파일을 `plan/complete/`로 이동 권장.

---

### [INFO] `workflow-resumable-execution-phase2-cont-64f537` — `3-error-handling.md` 동일 파일 접촉, 위치 분리로 충돌 없음

- target 위치: Change 6 — `spec/5-system/3-error-handling.md §1.4` 아래 Chat Channel cross-link 1행 추가
- 관련 plan: `plan/in-progress/spec-update-workflow-resumable-execution-phase2-followup.md` (worktree: `workflow-resumable-execution-phase2-cont-64f537`)
- 상세: 해당 plan의 변경 2.2가 `3-error-handling.md §1.3`에 `INVALID_EXECUTION_STATE` 역방향 cross-link를 추가했고 이는 이미 커밋(`4dd805ed`) 완료. target의 Change 6는 `§1.4` (워크플로우 실행 에러 enum 표 아래) 에 Chat Channel 분류 cross-link를 추가하는 것 — 위치가 다르고 내용도 직교적이라 충돌 없음. 단, 해당 plan의 worktree가 아직 active로 추정되는 상황(Step 1 ACTIVE, Step 2 PR 없음 — Step 3 fallback, active 처리)이므로 실제 작업이 아직 진행 중인지 확인 필요.
- 제안: 충돌 없음. 단 stale 판정 cascade Step 1/2 모두 음성. active로 처리 — 실제 stale이면 `./cleanup-worktree-all.sh --yes --force` 실행 후 재검토 권장. plan의 spec 작업이 이미 완료(모든 [x] 체크)됐으므로 plan 파일 `plan/complete/`이동이 선행되면 worktree 경합 우려가 해소됨.

---

### [INFO] `chat-channel-discord-gateway` / `chat-channel-slack-socket-mode` / `chat-channel-form-native-modal` — backlog 상태, worktree 미할당으로 실질적 경합 없음

- target 위치: Change 3/4/5 — `spec/4-nodes/7-trigger/providers/telegram.md`, `slack.md`, `discord.md` §5.6 신설
- 관련 plan: `plan/in-progress/chat-channel-discord-gateway.md`, `chat-channel-slack-socket-mode.md`, `chat-channel-form-native-modal.md`
- 상세: 세 plan 모두 `worktree: (assigned at impl-start)` — 아직 worktree가 할당되지 않은 backlog 상태. `chat-channel-discord-gateway.md`는 `discord.md`를 수정할 예정이고, `chat-channel-form-native-modal.md`는 `chat-channel-adapter.md §4`와 `slack.md §5.3`, `discord.md §5.3`을 수정할 예정. target은 각 provider spec에 `§5.6`을 신설하며 §4·§5.3과는 별개 섹션. form-native-modal plan이 향후 Convention §4 변경 시 `chat-channel-adapter.md` 에 R4 번복 관련 내용을 추가할 때, target의 R5(§3.1 위치 선택 이유)와의 번호 충돌도 없음(`R5`는 본 target이 먼저 신설하는 것이고 form-native-modal plan의 Rationale 목표는 R4 번복이라 번호 독립적임). 실질적 경합 없음.
- 제안: 추적 메모로만 기록. 해당 plan들이 활성화되면 §5.6과의 섹션 순서 및 §5.3 개정 범위 검토 권장.

---

### [INFO] `ai-agent-tool-connection-rewrite` 의 `TOOL_EXECUTION_FAILED` 미해결 결정 — target와 무관

- target 위치: Change 2b §3.1 분류 표 — error.code 에 `TOOL_EXECUTION_FAILED`가 없음
- 관련 plan: `plan/in-progress/ai-agent-tool-connection-rewrite.md` §4 "TOOL_EXECUTION_FAILED 에러 코드 복원"
- 상세: `ai-agent-tool-connection-rewrite.md`는 `TOOL_EXECUTION_FAILED` 에러 코드를 `3-error-handling.md`에 추가할 계획이나 아직 미결 (디자인 결정 대기 중). target의 Convention §3.1 분류 표는 현재 `3-error-handling.md §1.4 / §3.2` enum에 정의된 코드들만 다루며, target의 R-CC-15 (e)가 "MCP 도구 카테고리 추가 시 분류 표 행 추가 + i18n 키 검토"를 명시적으로 후속 작업으로 기록해두고 있음 — 충돌이 아니라 의도된 연장선.
- 제안: `ai-agent-tool-connection-rewrite.md`가 `TOOL_EXECUTION_FAILED`를 enum에 추가하면, 해당 시점에 Convention §3.1 분류 표에 해당 코드 행 추가와 `languageHints`에 신규 i18n 키 추가를 후속 plan으로 등록해야 함 — 현재로선 target의 범위 경계 설정이 적절함.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 중 stale 판정 cascade로 skip된 항목:

- `chat-channel-outbound-still-broken-afe293` (branch `claude/chat-channel-outbound-still-broken-afe293`) — Step 1 ACTIVE, Step 2 PR MERGED → stale
- `fix-chat-channel-dispatcher-and-cafe24-warn-68da78` (branch `claude/fix-chat-channel-dispatcher-and-cafe24-warn-68da78`) — Step 1 ACTIVE, Step 2 PR MERGED → stale
- `telegram-chat-channel-spec-polish-49c49b` (branch `claude/telegram-chat-channel-spec-polish-49c49b`) — Step 1 ACTIVE, Step 2 PR MERGED → stale

해당 worktree 디렉토리들(`chat-channel-outbound-still-broken-afe293`)은 실재하지 않거나 정리되지 않은 branch만 남아 있음. `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

`spec-draft-chat-channel-error-notify.md` target은 현재 진행 중인 plan들과 미해결 결정과의 충돌이 없다. worktree 충돌 후보 5건 중 stale 3건(chat-channel-outbound-still-broken, fix-chat-channel-dispatcher-and-cafe24-warn, telegram-chat-channel-spec-polish 모두 PR MERGED)을 skip했고, 나머지 2건(workflow-resumable-phase2-followup의 `3-error-handling.md` 접촉 / backlog plan 3개의 provider spec 접촉)은 위치·섹션이 독립적으로 분리되어 실질적 경합이 없다. `ai-agent-tool-connection-rewrite`의 미결 `TOOL_EXECUTION_FAILED` 결정은 target이 의도적으로 범위 밖으로 명시(R-CC-15 (e))하여 일방적 결정 우회가 아닌 적절한 deferrment이다. 프로바이더 파일 §5.6 신설은 backlog plan들의 §5.3·§4 수정 계획과 섹션이 분리되어 있어 충돌 없다. worktree 충돌 후보 5건 중 stale 3건 skip, active 2건 분석(충돌 없음 판정).

---

## 위험도

NONE
