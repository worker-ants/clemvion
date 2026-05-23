# Plan 정합성 검토 결과

**검토 모드**: `--impl-prep` (구현 착수 전 검토)
**Target**: `spec/5-system/15-chat-channel.md`
**실제 변경 주체**: worktree `telegram-chat-channel-spec-polish-49c49b` 의 uncommitted 변경 (plan: `spec-telegram-chat-channel-ui-polish.md`)
**검토 일시**: 2026-05-23

---

## 발견사항

### [WARNING] SSR PNG 백로그 plan 의 미결 결정을 우선 채택

- **target 위치**: `spec-telegram-chat-channel-ui-polish.md` §결정 3 (`uiMapping.visualNode` enum 및 v1 fallback), 그리고 이 결정이 반영되는 `spec/5-system/15-chat-channel.md` §3.3 CCH-MP-04·§4.1 config JSONB 예시, `spec/conventions/chat-channel-adapter.md` §2.3
- **관련 plan**: `plan/in-progress/chat-channel-visual-ssr-png.md` — "결정 항목 #2 — fallback 정책 (사용자 escalate)"
- **상세**: `chat-channel-visual-ssr-png.md` 의 "결정 항목 #2" 는 `visualNode` enum 과 default 값 을 **사용자 escalate** (미결 상태) 로 남겨 두었다. 해당 plan 은 두 옵션 — (a) PNG default + graceful degrade, (b) `uiMapping.visualNode` 명시적 분기 — 을 제시하며 권장안으로 (a) 를 언급한다. target plan (결정 3) 은 이를 사용자 결정 없이 독자적으로 (b) 변형(`text | photo | auto`, default `auto`) 으로 채택하고 `spec/conventions/chat-channel-adapter.md` §2.3 을 변경한다. `auto` 기본값은 SSR plan 이 권장한 PNG default 와 다르다. target plan 은 "본 plan 머지 직후 `chat-channel-visual-ssr-png.md` 의 결정 항목 #2 를 갱신" 을 follow-up 으로 기재하나, SSR plan 의 "사용자 escalate" 표기가 해소된 기록이 없다.
- **제안**: target plan 을 진행하기 전에 `chat-channel-visual-ssr-png.md` 의 "결정 항목 #2" 에 사용자 결정 (option b, default='auto') 이 채택되었음을 명시적으로 기록하거나, target plan 이 그 결정을 포함하는 구조로 편집한다. SSR plan 의 해당 절을 "결정 완료 — spec-telegram-chat-channel-ui-polish PR 참조" 로 갱신한 후 머지가 바람직하다.

---

### [INFO] `chat-channel-secret-store-infra.md` "결정 필요" 는 이미 해소된 상태 — plan 문서만 미갱신

- **target 위치**: `spec/5-system/15-chat-channel.md` §4.1 (`botTokenRef`, `secretTokenRef`) — 이미 main 에 `SecretResolver` + `secret://` ref 패턴으로 명세됨 (PR #264)
- **관련 plan**: `plan/in-progress/chat-channel-secret-store-infra.md` — frontmatter `status: backlog`, "결정 항목 (사용자 escalate)" (AWS SM / HashiCorp Vault / DB 암호화 중 선택)
- **상세**: target spec 의 CCH-SE-03 는 이미 `SecretResolver` + `secret://` ref + backend AES-256-GCM (DB 옵션 C) 으로 구현 완료 (PR #264, main 반영). target plan 의 spec 변경은 이 결정과 충돌하지 않는다. 그러나 `chat-channel-secret-store-infra.md` 가 여전히 `status: backlog` 이고 세 옵션이 미결인 것처럼 기술되어 있어 신규 developer 가 혼동할 수 있다.
- **제안**: `chat-channel-secret-store-infra.md` 의 상태를 "결정 완료 — option C (DB AES-256-GCM, PR #264) 채택 + Phase 1~3 구현 완료" 로 갱신하거나 `plan/complete/` 로 이동. 본 target plan 의 진행을 차단하지는 않음.

---

### [INFO] CCH-MP-01 이 AI Agent `render_*` presentations 처리를 미정의

- **target 위치**: `spec/5-system/15-chat-channel.md` §3.3 CCH-MP-01 ("AI Multi Turn 의 `execution.ai_message` → 채널 텍스트 메시지")
- **관련 plan**: `plan/in-progress/ai-presentation-tools.md` — 이미 완료 (PR #269 등 main 반영). `spec/5-system/6-websocket-protocol.md` §4.4 에 `execution.ai_message` 페이로드에 `presentations?: PresentationPayload[]` 가 추가됨.
- **상세**: `ai-presentation-tools` 는 이미 main 에 반영되어 `execution.ai_message` 이벤트가 `presentations?: PresentationPayload[]` 를 동봉할 수 있다. 그러나 Chat Channel 어댑터 spec (CCH-MP-01) 은 여전히 "텍스트 메시지 변환" 만 기술하며, AI Agent 가 `render_*` 도구를 호출했을 때 (`presentationTools` 활성화) 어댑터가 `presentations[]` 페이로드를 어떻게 처리해야 하는지 정의되지 않았다. target plan 도 이를 다루지 않는다.
- **제안**: 후속 developer plan (또는 본 target plan 범위 확대) 에서 CCH-MP-01 에 presentations[] 처리 정책(무시 / 텍스트 fallback / render_* 도구를 Chat Channel 에서 비활성화 권장 등)을 명시하는 것을 추적 항목으로 등록한다. 현재 구현 차단은 아님.

---

### [INFO] `spec-fix-isactive-drawer-toggle.md` worktree 는 비활성 — 중복 경합 없음

- **target 위치**: `spec/2-navigation/2-trigger-list.md` §2.3.1 (target plan 결정 1 에서 9개 row 추가)
- **관련 plan**: `plan/in-progress/spec-fix-isactive-drawer-toggle.md` — worktree `trigger-drawer-cleanup-f6a707` 명시
- **상세**: `spec-fix-isactive-drawer-toggle.md` 의 worktree(`trigger-drawer-cleanup-f6a707`) 는 `git worktree list` 에서 확인되지 않으며 (디렉토리 삭제됨), 해당 branch 의 변경 내용에 `spec/2-navigation/2-trigger-list.md` 가 포함되지 않는다. 현재 시점에서 병렬 경합 없음. target plan 은 이 가능한 충돌을 문서에서 이미 언급하고 머지 순서를 명문화했다 — 주의 수준으로 기록.
- **제안**: 추가 조치 불필요. 다만 `spec-fix-isactive-drawer-toggle.md` plan 이 향후 재활성화될 경우 target plan PR 의 §2.3.1 변경 이후 rebase 확인 필요.

---

## 요약

Target (`spec-telegram-chat-channel-ui-polish.md`) 은 전반적으로 기존 chat-channel plan 군(`chat-channel-dispatcher-split`, `chat-channel-secret-store-infra`, `chat-channel-visual-ssr-png`) 과의 경계를 인지하고 있으며, 활성 worktree 간 직접적인 파일 경합은 없다. 주요 우려는 `chat-channel-visual-ssr-png.md` 의 "결정 항목 #2" 가 여전히 **사용자 escalate** 상태인데도 target plan 이 enum + default 값을 독자적으로 결정하고 spec 에 반영하는 점이다. SSR plan 의 해당 결정 기록이 갱신되지 않은 채 spec 이 먼저 변경되면 두 문서 간 정합성 손상 및 SSR plan 재진입 시 혼란이 생긴다. 이는 진행을 차단하지는 않으나 plan 문서 갱신이 선행되어야 한다.

## 위험도

MEDIUM
