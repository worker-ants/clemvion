# Plan 정합성 검토 — spec-telegram-chat-channel-ui-polish

검토 일시: 2026-05-23
검토 대상: `plan/in-progress/spec-telegram-chat-channel-ui-polish.md`
검토 모드: spec draft (--spec)

---

## 발견사항

### [WARNING] chat-channel-visual-ssr-png.md 가 `text_only` 를 여전히 SoT 로 참조

- **target 위치**: 결정 3 — `uiMapping.visualNode` enum 변경 (`text_only` → `text` rename + `auto` 신설). 본 plan 이 `spec/conventions/chat-channel-adapter.md §2.3` 의 enum 을 `"photo" | "text_only"` → `"text" | "photo" | "auto"` 로 교체하고, 이것을 SoT 삼는다.
- **관련 plan**: `plan/in-progress/chat-channel-visual-ssr-png.md` — 결정 항목 #2 권장 옵션 (b) 서술에서 "`visualNode: 'text'` 신설", `visualNode: 'text_only'` 를 현재 유효 enum 값으로 전제. 또한 §"v1 동작을 의도적으로 끄는 방법" 항목이 "`uiMapping.visualNode: 'text_only'` 설정 시" 라고 명시 (line 93). PR #261 이후 운영 코드·spec 에 `text_only` 가 v1 공식 enum 값으로 남아있는 상태를 전제하고 작성된 plan.
- **상세**: target plan 이 `text_only` → `text` rename 을 완료하면 `chat-channel-visual-ssr-png.md` 문서 내 `text_only` 참조가 모두 stale 된다. 특히 권장 옵션 (b) 가 이미 교체된 `text` enum 을 별도로 신설하는 것처럼 기술되어 있어, target plan 머지 후 다음 진입자가 혼란을 겪을 수 있다. target plan 후속 조항 §"후속 plan" 항목 3 에서 "`chat-channel-visual-ssr-png.md` 를 본 plan 머지 직후 1 commit 으로 갱신" 을 명시하고 있어 인지는 하고 있으나, plan 문서 자체에는 정확히 어떤 줄을 갱신해야 하는지 기재가 없다.
- **제안**: target plan 후속 조항 항목 3 에 갱신 대상 라인을 구체화하거나, `chat-channel-visual-ssr-png.md` 에 "본 문서의 `text_only` 참조는 `spec-telegram-chat-channel-ui-polish` 머지 후 `text` 로 일괄 교체 예정" 주석을 선제적으로 추가한다. 어느 쪽이든 target plan 자체는 진행 가능하나, 후속 갱신 commit 을 누락하면 backlog plan 이 stale 상태로 장기 방치될 위험이 있다.

---

### [WARNING] chat-channel-visual-ssr-png.md 의 미해결 결정과 target 결정 3 의 관계 명시 부족

- **target 위치**: 결정 3 — 노드타입 × enum × 버전 완전 매트릭스. 특히 `photo v2` / `auto v2` 열의 SSR PNG 동작.
- **관련 plan**: `plan/in-progress/chat-channel-visual-ssr-png.md` — 결정 항목 #1 (SSR 라이브러리 선정) 및 결정 항목 #2 (fallback 정책) 이 여전히 "사용자 escalate" 상태 (미해결). 라이브러리 결정에 따라 carousel v2 의 collage PNG 동작이나 table row cap 이 달라질 수 있다.
- **상세**: target plan 의 매트릭스는 `photo v2` 열에 "1~5장 collage PNG `sendPhoto`", "satori SVG → PNG `sendPhoto`", "표 PNG `sendPhoto`" 등 구체적인 구현 동작을 spec 에 확정하는 형태다. 이는 `chat-channel-visual-ssr-png.md` 의 미해결 결정 #1/#2 (라이브러리·fallback 정책) 와 직접 충돌하지는 않지만 — target plan 은 spec 동작 정의만 하고 구현은 별도 plan 에 위임 — 그 경계가 plan 문서에서 충분히 명시되지 않는다면 후속 developer 가 target plan 의 매트릭스를 이미 확정된 SSR 구현 명세로 오독할 가능성이 있다.
- **제안**: 결정 3 의 매트릭스 직후 또는 "별 plan 와의 scope 경계" 항목에 "`photo v2` / `auto v2` 열의 SSR 라이브러리 선정 (satori vs puppeteer vs 기타) 과 fallback 정책 세부는 `chat-channel-visual-ssr-png.md` 결정 항목 #1/#2 에서 확정" 를 명시하면 경계가 더 명확해진다. target plan 현행에도 "scope 경계" 설명이 있으나 라이브러리 미결 사항과의 연결이 생략되어 있다.

---

### [WARNING] spec-fix-isactive-drawer-toggle.md worktree 미실재 — 동일 spec 파일 충돌 가능성 잔존

- **target 위치**: 결정 1 — `spec/2-navigation/2-trigger-list.md §2.3.1` 에 chatChannel 관련 9개 row 추가. 머지 순서 합의 §에서 `spec-fix-isactive-drawer-toggle.md` 와의 순서를 명시.
- **관련 plan**: `plan/in-progress/spec-fix-isactive-drawer-toggle.md` — frontmatter `worktree: trigger-drawer-cleanup-f6a707`. 그러나 git worktree 목록에 `trigger-drawer-cleanup-f6a707` 가 존재하지 않는다 (현재 활성 worktree: `telegram-chat-channel-spec-polish-49c49b` 만 관련). 즉 해당 worktree 가 이미 삭제(또는 미생성) 상태다.
- **상세**: `spec-fix-isactive-drawer-toggle.md` 의 worktree 가 실제로 없다는 것은 (a) 해당 작업이 아직 시작되지 않았거나 (b) 이미 완료 후 worktree 정리된 것 중 하나다. spec 파일의 내용을 보면 `§2.3.1 isActive` 행이 아직 "edit (토글 버튼)" 으로 남아있어 변경이 완료된 것으로 보이지 않는다. 두 plan 이 `spec/2-navigation/2-trigger-list.md §2.3.1` 동일 섹션을 수정하므로, `spec-fix-isactive-drawer-toggle` 가 활성화될 경우 동일 파일 동시 수정 위험이 발생한다. target plan 은 이미 이 위험을 "머지 순서 합의" 로 관리하려 하나, 상대 worktree 가 비활성이라 현재 시점 실질 충돌은 없다.
- **제안**: target plan 의 "머지 순서 합의" §를 보존한 채로 진행 가능. 단, `spec-fix-isactive-drawer-toggle.md` 가 향후 활성화될 때 해당 plan 진입자가 target plan 의 §2.3.1 9 row 추가를 기반 베이스로 rebase 해야 함을 plan 문서에 주석을 추가하면 좋다. 현재 target plan 의 §"머지 순서" 항목 2 ("본 plan 이 먼저 머지되면 ... rebase 시 sweep 필요") 가 이 내용을 커버하고 있어 기존 기술이 적절하다.

---

### [INFO] chat-channel-secret-store-infra.md 의 미결 인프라 결정과의 관계

- **target 위치**: 결정 2 — `hasBotToken` derived 필드 정의, `botTokenRef` 응답 제외. "이미 spec 에 채택된 `SecretResolver` + `secret://` ref 패턴을 그대로 활용 (충돌 없음)" 으로 명시.
- **관련 plan**: `plan/in-progress/chat-channel-secret-store-infra.md` — secret store 인프라 (AWS Secrets Manager / Vault / pgcrypto) 선정이 미결. 현재 v1 stub (plaintext config JSONB) 상태.
- **상세**: target plan 은 이미 spec 에 `botTokenRef` 가 존재하는 것을 전제하고 `hasBotToken` 을 derived 필드로 신설한다. 이는 `SecretResolver` 인프라가 없는 v1 stub 환경에서도 `botTokenRef IS NOT NULL → hasBotToken: true` 논리가 동작하는 범위이므로 인프라 미결과 직접 충돌하지는 않는다. `chat-channel-secret-store-infra.md` 의 미결 사항 (Phase 3 — botToken 마이그레이션) 은 target plan 의 spec 변경 이후에도 독립적으로 진행 가능하다.
- **제안**: 별도 조치 불필요. target plan 의 배경 서술("충돌 없음") 이 이미 적절하다. 단, 후속 developer plan 이 `hasBotToken` 필드를 구현할 때 v1 stub 과 v2 secret store 경로 양쪽을 처리해야 함을 plan 에 명시하면 유용하다.

---

### [INFO] chat-channel-dispatcher-split.md 의 backlog 상태와 target plan 영향 없음 확인

- **target 위치**: 배경 §"관련 in-progress plan 과의 관계" — `chat-channel-dispatcher-split.md` 와 영향 없음으로 명시.
- **관련 plan**: `plan/in-progress/chat-channel-dispatcher-split.md` — 상태 `backlog`, trigger 조건(2nd provider 도입) 미충족. 담당 spec 영역 (`spec/5-system/15-chat-channel.md §3.1·§3.2`) 은 target plan 변경 영역 (§5.4 신설, §5.5 신설) 과 섹션 단위로 분리.
- **상세**: target plan 의 서술이 정확하다. 충돌 없음.
- **제안**: 불필요.

---

### [INFO] 다른 활성 worktree 와의 spec 파일 충돌 — 없음

현재 활성 git worktree 는 다음과 같다:
- `ai-agent-render-button-user-message-521f33`
- `ai-agent-turn-fail-finalize-a22724`
- `cafe24-backlog-residual-batch`
- `cafe24-bg-refresh-tuning-fb72d5`
- `cafe24-spec-polish-f2-f3`
- `integration-action-required-ui`
- `llm-retry-after-5a7d63`
- `redis-bullmq-env-hardening-7a47dc`
- `render-presentation-button-click-fix-683f3a`
- `telegram-chat-channel-spec-polish-49c49b` (본 target)

위 활성 worktree 중 어느 것도 target plan 이 변경하는 5개 spec 파일 (`spec/2-navigation/2-trigger-list.md`, `spec/5-system/15-chat-channel.md`, `spec/5-system/12-webhook.md`, `spec/conventions/chat-channel-adapter.md`, `spec/4-nodes/7-trigger/providers/telegram.md`) 을 건드리지 않는다. `spec-fix-isactive-drawer-toggle.md` 의 worktree (`trigger-drawer-cleanup-f6a707`) 는 git worktree 목록에 없어 실질 경합 없음.

---

## 요약

target plan 은 네 가지 spec 공백 (UI 가시성, bot token single-path, visualNode enum, inbound HTTP contract) 을 명확히 정의하며, 이미 알고 있는 인접 plan 과의 관계도 배경 서술에서 대부분 커버하고 있다. 주요 위험은 두 가지다. 첫째, `chat-channel-visual-ssr-png.md` 가 `text_only` enum 값을 여전히 현행으로 전제하고 있어 target plan 머지 후 해당 plan 문서가 stale 된다. target plan 은 이를 인지하고 후속 1 commit 갱신을 명시했지만 구체적인 갱신 라인 지정이 없어 누락 위험이 있다. 둘째, `chat-channel-visual-ssr-png.md` 의 결정 항목 #1/#2 (SSR 라이브러리, fallback 정책) 가 미결 상태인데 target plan 의 결정 3 매트릭스가 `photo v2` 열의 구현 동작을 구체적으로 기술하여 후속 진입자가 해당 내용을 이미 확정된 구현 명세로 오독할 여지가 있다. 현행 in-progress plan 중 target 과 동일 spec 파일을 동시에 수정하는 활성 worktree 는 없으며, `spec-fix-isactive-drawer-toggle.md` 의 worktree 가 미실재 상태라 현재 시점 실질 worktree 충돌은 발생하지 않는다. Critical 등급 발견사항은 없으며, 두 WARNING 항목은 target plan 진행을 차단하지 않고 사후 갱신 commit 또는 문서 보강으로 해소 가능하다.

---

## 위험도

LOW
