# Convention Compliance — 정식 규약 준수 검토

**Target**: `plan/in-progress/spec-chat-channel-inbound-signing-rename.md`
**검토 모드**: spec draft 검토 (--spec)
**검토일**: 2026-05-24

---

## 발견사항

### [WARNING] secret-store.md §1 예시 표에 `webhook-secret` 잔존 — plan 과 현행 규약 간 선후 관계 미명시

- **target 위치**: `§1 산출물` — `spec/conventions/secret-store.md` 항목 설명 "§1 예시 표 — 3행 삭제 후 `inbound-signing` 1행 추가"
- **위반 규약**: `spec/conventions/secret-store.md §1` URI scheme 예시 표 (현재 `webhook-secret`, `slack-signing-secret`, `discord-public-key` 3행 포함)
- **상세**: 현행 `secret-store.md §1` 예시 표는 `secret://triggers/{triggerId}/webhook-secret` 행을 여전히 포함하고 있다. plan 이 이 행을 삭제하고 `inbound-signing` 으로 통합하겠다는 의도는 명확하나, plan 자체가 _규약 미준수 상태를 유지한 채_ 실행 대기 중이다. Phase 1 이 완료되기 전까지 규약 현행본(`secret-store.md`)은 폐기 예정인 3개 URI name 을 정식 example 로 선언하고 있다. plan 이 "실행 직전 일관성 검사" 용도로 작성됐으므로 이 상태 자체는 의도적이나, plan 본문에 "현행 규약을 갱신하는 것이 이 plan 의 목적임" 을 명시적으로 기재해야 한다. 현재는 Changelog 갱신 언급이 있으나 기존 예시 행의 현행 URI 와 대체 URI 모두 plan 안에 존재하므로 혼동 가능성이 있다.
- **제안**: `§1 산출물` 의 `spec/conventions/secret-store.md` 항목에 "현행 예시 표의 `webhook-secret` / `slack-signing-secret` / `discord-public-key` 3행이 이 plan 실행 전까지 규약 현행본에 남아 있음을 인지함. 본 plan 완료 전 규약 현행본과 draft 간 일시적 불일치는 의도된 것" 과 같이 명시. (또는 Rationale 에 migration path 로 기술)

---

### [WARNING] chat-channel-adapter.md §2.3 `ChatChannelConfig` 잔존 필드와 plan 의 삭제 목록 불일치

- **target 위치**: `§1 산출물` — `spec/conventions/chat-channel-adapter.md` 항목, `§2.3 ChatChannelConfig — secretTokenRef? / signingSecretRef? / publicKeyRef? 3 필드 제거`
- **위반 규약**: `spec/conventions/chat-channel-adapter.md §2.3 ChatChannelConfig` 현재 정의
- **상세**: 현행 `chat-channel-adapter.md §2.3` 에는 `secretTokenRef?` 필드 하나만 존재한다(`signingSecretRef?`, `publicKeyRef?` 는 현재 없음). plan 은 "3 필드 제거" 라고 명시하나 실제 현행 규약에는 `secretTokenRef?` 1개 필드만 있다. `signingSecretRef?` 와 `publicKeyRef?` 는 현행 규약에 추가되지 않은 상태이므로, plan 의 "3 필드 제거" 설명은 부정확하거나 Slack/Discord provider 의 미반영 결과일 수 있다.
- **제안**: Phase 2 설명을 현행 `chat-channel-adapter.md §2.3` 의 실제 상태 기반으로 교정. "현행 `secretTokenRef?` 필드를 `inboundSigningRef?` 로 rename" 으로 표현하거나, 만약 Slack/Discord spec 이 별 convention 파일에서 `signingSecretRef?` / `publicKeyRef?` 를 정의하고 있다면 그 경로를 산출물 목록에 명시. 현행 규약 단일 진실(`spec/conventions/chat-channel-adapter.md §2.3`) 과 plan 설명이 일치하도록 갱신.

---

### [INFO] plan frontmatter `owner` 값 — 역할 명시 규약 부합, 단 `planner` 표기 통일 권장

- **target 위치**: frontmatter `owner: planner`
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4` Frontmatter 스키마 — `owner: <역할/이름>` (planner / developer / 사용자 본인 등)
- **상세**: `planner` 는 plan-lifecycle 예시 값과 일치. 문제 없음. 단, 다른 plan 들에서 `project-planner` 또는 `planner` 가 혼용될 수 있으므로 통일 권장.
- **제안**: `owner: project-planner` 또는 `owner: planner` 중 프로젝트 내 표준을 따름. 현행 plan-lifecycle 예시는 `planner` 이므로 현재 값이 적합. 조치 불필요.

---

### [INFO] `§4 후속 impl plan` 의 plan 경로 — `plan/in-progress/` prefix 없이 파일명만 기재

- **target 위치**: `## 4. 후속 impl plan` — `plan/in-progress/chat-channel-telegram-inbound-signing-rename-impl.md`
- **위반 규약**: CLAUDE.md 정보 저장 위치 표 — "진행 중 작업: `plan/in-progress/<name>.md`"
- **상세**: 후속 impl plan 파일명은 올바르게 `plan/in-progress/` 경로로 명기되어 있다. 단, `(status: backlog, optional)` 표기가 plan 파일 frontmatter 의 `status` 필드와 별개 메모로 기재되어 있다. `spec/conventions/spec-impl-evidence.md §3` 의 status 라이프사이클 (backlog / spec-only / partial / implemented / archived) 은 spec 문서 frontmatter 에 적용되는 것이지만, plan 파일의 상태를 plan 본문 안에 인라인 메모로 표기하는 것은 plan-lifecycle 규약상 기술된 frontmatter 스키마 밖의 패턴이다. 혼동 우려 낮으나 참고.
- **제안**: 후속 plan 파일이 실제로 생성될 경우 frontmatter 에 `owner` / `started` / `worktree` 를 명시 (plan-lifecycle §4 준수). 인라인 `(status: backlog)` 메모는 삭제하거나 괄호 안 설명을 "아직 생성되지 않은 backlog plan" 으로 명확화.

---

### [INFO] `§5 Phase 4` 에서 sub-agent 호출을 "5 sub-agent 병렬 호출" 로 명시 — 단 수량 검증 필요

- **target 위치**: `### Phase 4 — /consistency-check --spec 실행`, "5 sub-agent 병렬 호출"
- **위반 규약**: `.claude/skills/consistency-checker/SKILL.md` (간접 참조)
- **상세**: `/consistency-check --spec` 의 실제 sub-agent 수는 consistency-checker SKILL.md 정의에 따른다. "5 sub-agent" 라는 수량이 현행 harness 와 일치하는지 plan 작성 시점의 SKILL.md 를 재확인하는 것이 권장된다. 숫자가 틀려도 consistency-check 자체는 harness 가 올바르게 호출하므로 실행에는 영향 없으나 문서 정확성 차원.
- **제안**: "5 sub-agent" 표기를 SKILL.md 현행 harness 정의와 맞추거나, 숫자를 생략하고 "`/consistency-check --spec` 실행" 으로 단순화.

---

## 요약

target 문서(`plan/in-progress/spec-chat-channel-inbound-signing-rename.md`)는 plan frontmatter 스키마(worktree / started / owner), plan 경로 규약(`plan/in-progress/`), commit 메시지 형식 제안, Changelog 갱신 계획 등 주요 정식 규약 항목을 전반적으로 준수하고 있다. 단, 가장 중요한 위험은 plan 이 삭제·교체하겠다고 명시한 기존 규약 필드(`secretTokenRef?` 등 3개) 의 현행 실제 개수가 plan 기술 내용(3개)과 일치하지 않는다는 점이다. 현행 `chat-channel-adapter.md §2.3` 에는 `secretTokenRef?` 1개만 존재하므로, plan 을 그대로 실행하면 존재하지 않는 2개 필드(`signingSecretRef?` / `publicKeyRef?`)를 삭제하려는 불필요 작업 또는 오해가 발생할 수 있다. secret-store.md 쪽 3행 삭제 계획도 현행 예시 표에 해당 3행(`webhook-secret` / `slack-signing-secret` / `discord-public-key`)이 실제로 있는지 확인 후 실행해야 한다. 현재 `secret-store.md §1` 에는 `webhook-secret` 만 예시 행으로 존재하며 나머지 두 행은 없으므로 동일한 불일치가 있다.

---

## 위험도

MEDIUM
