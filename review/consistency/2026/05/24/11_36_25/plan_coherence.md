# Plan 정합성 검토 결과

검토 대상: `plan/in-progress/spec-chat-channel-inbound-signing-rename.md`
검토 모드: spec draft (--spec)
검토 일시: 2026-05-24

---

## 발견사항

### [WARNING] `chat-channel-secret-store-infra.md` Phase 4 가 구 필드명 `secretToken`/`secretTokenRef` 를 참조 — 이름 변경 후 무효화

- **target 위치**: target plan §1 산출물 표 — `spec/conventions/chat-channel-adapter.md` `secretTokenRef?` 제거 + `inboundSigningRef?: string` 추가
- **관련 plan**: `plan/in-progress/chat-channel-secret-store-infra.md` §Phase 4 — "`chat-channel.secretToken` 마이그레이션 (후속 — webhook 검증)" 절, `TelegramClient` / `TelegramAdapter` resolve 경로 변경 항목
- **상세**: `chat-channel-secret-store-infra.md` Phase 4 는 `secretToken` 과 `secretTokenRef` 를 명시적 마이그레이션 대상으로 기술하고 있다. target plan 이 `secretTokenRef` 를 `inboundSigningRef` 로 rename 하면 Phase 4 의 변수명·코드 경로 기술이 구 명칭을 가리키게 되어 후속 진입자가 혼동할 수 있다. 인프라 plan 자체는 backlog 이며 진입 전 사용자 결정이 필요하므로 작업 차단은 아니지만, spec 변경 완료 후 plan 문서를 `inboundSigningRef` / `inbound-signing` 으로 갱신해야 한다.
- **제안**: target plan Phase 5 (commit + plan complete) 완료 후 `chat-channel-secret-store-infra.md` Phase 4 본문의 `secretToken`/`secretTokenRef` 참조를 `inboundSigning`/`inboundSigningRef` 로 갱신하는 1-commit 정리를 후속 항목으로 §4 후속 impl plan 에 추가.

---

### [WARNING] `trigger-list-chat-channel-ui.md` 가 codebase 에 `secretTokenRef` 를 직접 참조 — impl plan 갱신 필요

- **target 위치**: target plan §2 영역 권한 — `codebase/**` Read only, 후속 impl plan `chat-channel-telegram-inbound-signing-rename-impl.md` 에 rename 위임
- **관련 plan**: `plan/in-progress/trigger-list-chat-channel-ui.md` Commit 1 항목 — `botTokenRef` / `secretTokenRef` 는 응답에서 strip" (백엔드 DTO 처리)
- **상세**: `trigger-list-chat-channel-ui.md` 의 Commit 1 작업표에 `secretTokenRef` 라는 구 필드명이 직접 기술되어 있다. 해당 plan 의 PR 은 이미 MERGED (Step 2 판정 stale) 상태이므로 실제 구현에 미치는 영향은 없다. 그러나 plan 문서가 in-progress/ 에 남아 있고 아직 complete/ 로 이동되지 않았기 때문에, 이후 참조하는 진입자가 구 필드명을 코드 SoT 로 오인할 수 있다. target plan 완료 후 해당 plan 이 complete/ 로 이동될 때 문서 본문의 `secretTokenRef` 참조가 구 명칭임을 Changelog 또는 완료 노트에 명기하거나, 이미 MERGED 된 plan 이므로 즉시 `git mv plan/in-progress/trigger-list-chat-channel-ui.md plan/complete/` 로 이동하는 것이 권장된다.
- **제안**: `trigger-list-chat-channel-ui.md` 를 `plan/complete/` 로 즉시 이동. PR 이미 MERGED 됨. 이동 후 plan 문서 내 `secretTokenRef` 참조는 역사 기록으로 남아도 무방 (complete/ 문서는 현행 SoT 가 아님).

---

### [WARNING] 선행 plan `plan/complete/spec-slack-discord-chat-channel.md` 가 존재하지 않음 — 전제 참조 파일 부재

- **target 위치**: target plan §0 배경 — "`plan/complete/spec-slack-discord-chat-channel.md` 완료 직후 사용자 검토에서 발견된 naming 비일관성을 해소" 라고 명시
- **관련 plan**: target plan 전체 (전제 참조)
- **상세**: target plan 이 직접 전제로 삼는 `plan/complete/spec-slack-discord-chat-channel.md` 파일이 실제로 존재하지 않는다. `find plan/` 에서 해당 경로 없음. 또한 target plan 이 갱신 대상으로 지정한 `spec/4-nodes/7-trigger/providers/slack.md` 와 `spec/4-nodes/7-trigger/providers/discord.md` 도 현재 파일시스템에 존재하지 않는다 (`spec/4-nodes/7-trigger/providers/` 에는 `telegram.md` 만 있음). target plan 의 §1 산출물 표에는 이 두 파일의 `§6 의 signingSecretRef / publicKeyRef → inboundSigningRef` 갱신이 명시되어 있다.

  이 상황은 두 가지 해석이 가능하다:
  - (a) Slack/Discord provider spec 파일을 본 rename plan 이 **신규 생성**하면서 처음부터 `inboundSigningRef` 를 사용하는 방식 (사실상 rename 이 아닌 first-draft). 이 경우 §0 배경의 "완료 직후" 표현이 오해를 유발할 수 있다.
  - (b) 선행 Slack/Discord spec plan 이 아직 별도로 수행되지 않아 파일이 없는 상태에서 rename plan 이 먼저 생성된 경우 — 선행 plan 의 완료가 실제 선결 조건.

  현재 target plan 이 진행 중인 worktree (`spec-slack-discord-chat-channel-bb4d35`) 의 branch 에 이 파일들이 이미 생성되어 있을 수 있으나, main 기준으로는 부재 상태이다. target plan 의 §0 배경 기술과 실제 파일 상태 사이에 불일치가 있다.
- **제안**: target plan §0 배경을 실제 상황 (Slack/Discord provider spec 을 본 plan 에서 신규 생성하면서 처음부터 generic naming 을 적용하는 방식) 에 맞게 재기술하거나, 선행 Slack/Discord spec plan 의 완료 여부를 확인 후 본 plan 진입. 선행 plan 파일이 존재하지 않는 경우 §0 배경의 "직후" 표현을 "본 plan 에서 Slack/Discord provider spec 신규 작성 시 처음부터 generic naming 적용" 으로 교체.

---

### [WARNING] `chat-channel-dispatcher-split.md` 의 backlog 진입 조건이 본 plan 으로 인해 충족될 수 있음 — 계획 갱신 미반영

- **target 위치**: target plan §1 산출물 표 — `slack.md`, `discord.md` 를 신규 작성하거나 갱신 (Slack/Discord provider spec 도입)
- **관련 plan**: `plan/in-progress/chat-channel-dispatcher-split.md` — 진입 조건: "Telegram 외 두 번째 chat channel provider (Slack / KakaoTalk 등) 도입 결정 시 본 plan 으로 진입"
- **상세**: `chat-channel-dispatcher-split.md` 는 두 번째 provider 가 도입될 때 backlog → active 로 전환하는 계획이다. target plan 이 Slack 과 Discord provider spec 을 도입하면 이 trigger 조건이 형식적으로 충족된다 (spec 수준에서 2개 추가 provider 가 정의됨). 다만 spec 도입 ≠ 구현 도입이므로, 실질 trigger 는 `NotificationDispatcher` 코드 수준에서 provider 가 2개 이상 등록될 때이다. target plan 은 §2 영역 권한에서 `codebase/**` Read only 임을 명시하므로 직접 구현 trigger 는 아니지만, Slack/Discord 의 impl plan 진입 시 이 plan 의 진입 조건을 검토해야 한다는 추적이 누락되어 있다.
- **제안**: target plan §4 후속 impl plan 에 "Slack/Discord impl plan 진입 시 `chat-channel-dispatcher-split.md` 의 trigger 조건 (2nd provider 도입) 충족 여부 재검토" 항목 추가. `chat-channel-dispatcher-split.md` 의 trigger 조건 본문에도 "spec 도입이 아닌 구현 도입 시점" 임을 명확히 하는 편집 권장.

---

### [INFO] `spec-telegram-chat-channel-ui-polish.md` 가 `chat-channel-adapter.md §2.3` 을 갱신했고 해당 worktree PR 은 MERGED — plan 문서가 in-progress/ 에 잔류

- **target 위치**: target plan §1 산출물 표 — `spec/conventions/chat-channel-adapter.md §2.3` 갱신
- **관련 plan**: `plan/in-progress/spec-telegram-chat-channel-ui-polish.md` (worktree `telegram-chat-channel-spec-polish-49c49b`, PR MERGED)
- **상세**: `spec-telegram-chat-channel-ui-polish.md` 는 `chat-channel-adapter.md §2.3` 의 `visualNode` enum 을 갱신하는 작업이었으며, 해당 plan 의 worktree branch PR (#281) 이 이미 MERGED 상태이다. 이 plan 은 target plan 과 동일 파일을 건드리지만, 갱신 대상 필드가 다르다 (`visualNode` vs `secretTokenRef`/`signingSecretRef`/`publicKeyRef`). 따라서 내용 충돌 위험은 없다. 단, `spec-telegram-chat-channel-ui-polish.md` plan 이 in-progress/ 에 잔류 중이므로 cleanup 필요 (stale plan 정리).
- **제안**: `plan/in-progress/spec-telegram-chat-channel-ui-polish.md` 를 `plan/complete/` 로 즉시 이동 (`git mv`). worktree `telegram-chat-channel-spec-polish-49c49b` 도 물리적으로 존재하지 않으므로 (Step 2 MERGED) cleanup 대상.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보 분석:

**실제 물리 worktree (git worktree list 기준):**
1. `apply-brand-logo-049314` (branch `claude/apply-brand-logo-049314`) — Step 1 ACTIVE, Step 2 PR #274 **CLOSED**. stale 로 skip. 이 worktree 가 `spec/conventions/chat-channel-adapter.md`, `spec/conventions/secret-store.md`, `spec/5-system/15-chat-channel.md` 등 target plan 동일 파일을 diff 에 포함하지만, PR CLOSED 이므로 실제 경합 없음.

**plan frontmatter worktree 참조 (물리 worktree 미존재):**
2. `telegram-chat-channel-spec-polish-49c49b` (branch `claude/telegram-chat-channel-spec-polish-49c49b`) — Step 1 ACTIVE, Step 2 PR #281 **MERGED**. stale 로 skip. plan 이 in-progress/ 에 잔류 중이나 worktree 는 물리적으로 존재하지 않음.

3. `trigger-list-chat-channel-ui-d0c4a3` (branch `claude/trigger-list-chat-channel-ui-d0c4a3`) — Step 1 ACTIVE, Step 2 PR **MERGED**. stale 로 skip. plan 이 in-progress/ 에 잔류 중이나 worktree 는 물리적으로 존재하지 않음.

worktree 충돌 후보 3건 중 stale 3건 skip, active 0건.

stale plan 정리 권장:
- `plan/in-progress/spec-telegram-chat-channel-ui-polish.md` → `plan/complete/`
- `plan/in-progress/trigger-list-chat-channel-ui.md` → `plan/complete/`
- `.claude/worktrees/apply-brand-logo-049314/` — `./cleanup-worktree-all.sh --yes --force` 또는 수동 `git worktree remove` 로 정리 권장.

---

## 요약

target plan `spec-chat-channel-inbound-signing-rename.md` 는 전반적으로 정합 구조를 갖추고 있다. 미해결 결정 우회 (관점 1) 나 active worktree 경합 (관점 5) 은 없다. 주요 문제는 세 가지다: (1) 선행 plan `plan/complete/spec-slack-discord-chat-channel.md` 가 존재하지 않아 §0 배경의 전제 기술이 파일 상태와 불일치 — plan 서술 수정 또는 선행 작업 확인 필요 (WARNING). (2) `chat-channel-secret-store-infra.md` Phase 4 와 `trigger-list-chat-channel-ui.md` Commit 1 이 구 필드명 `secretTokenRef` 를 참조하고 있어 rename 완료 후 갱신 필요 (WARNING). (3) Slack/Discord provider 도입으로 `chat-channel-dispatcher-split.md` 의 backlog 진입 trigger 조건이 형식적으로 충족되나 추적 연결이 없음 (WARNING). 추가로, spec-telegram-chat-channel-ui-polish 및 trigger-list-chat-channel-ui 두 plan 이 in-progress/ 에 잔류 중이나 실제 PR 은 MERGED 된 stale 상태 (INFO). worktree 충돌 후보 3건 중 stale 3건 skip, active 0건 분석.

---

## 위험도

**MEDIUM**

선행 파일 부재 (WARNING, 관점 3) 로 인해 Slack/Discord provider spec 파일의 존재 여부와 신규 생성 vs rename 의 의미 차이가 정확히 해소되어야 한다. 작업 자체는 spec only 이고 codebase 충돌·미해결 결정 우회는 없으므로 CRITICAL 이나 HIGH 는 아니다.

STATUS: OK
