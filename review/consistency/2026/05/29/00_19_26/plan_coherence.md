# Plan 정합성 검토 결과

target: `plan/in-progress/spec-draft-chat-channel-form-native-modal.md`
검토 모드: spec draft (--spec)
검토 일시: 2026-05-29

---

## 발견사항

### [INFO] target plan 의 base plan (`chat-channel-form-native-modal.md`) 이 in-progress 에 잔존
- target 위치: `plan/in-progress/spec-draft-chat-channel-form-native-modal.md` (frontmatter)
- 관련 plan: `plan/in-progress/chat-channel-form-native-modal.md`
- 상세: target spec draft 는 `chat-channel-form-native-modal` 의 spec 변경 단계이다. 그런데 base plan (`chat-channel-form-native-modal.md`) 이 `status: backlog` / `worktree: (assigned at impl-start)` 로 여전히 `in-progress/` 에 있다. 이것은 이상이 아니고 정상 플로우 (spec draft 먼저, impl plan 은 spec draft 완료 후 active 됨). 단, base plan 내 "진입 조건 (Convention 변경 필요)" 체크박스 3개가 아직 미체크 상태이고 target spec draft 가 그 결정을 내리고 있다 — 즉, target spec draft 가 base plan 의 체크박스를 "대신" 닫는 문서임을 명시적으로 기재하지 않았다.
- 제안: target spec draft 의 성공적인 `--spec` consistency-check 통과 후 base plan (`chat-channel-form-native-modal.md`) 의 진입 조건 체크박스 3개를 target spec draft 결과를 인용하여 체크. plan lifecycle 상 별도 조치 불필요 (프로세스 자체는 정상).

---

### [WARNING] `languageHints.formOpenLabel` 신규 키가 `§4.1.1` KO/EN default 표에 반영 누락
- target 위치: `변경 1 — 1-C §2.2 ChannelMessage`, `변경 4 — 변경 4 시스템 15-chat-channel.md` (해당 변경 미포함)
- 관련 plan: 현재 main 에 merge 된 `spec-draft-chat-channel-error-notify` 결과 (`spec/5-system/15-chat-channel.md §4.1.1`) — PR #323, #343 완료 상태
- 상세: target spec draft 의 변경 1-C 는 `ChannelMessage.body` 에 `form_modal` variant 를 신설하고 `openLabel: string` 필드를 도입한다. 그 라벨이 사용하는 언어는 `languageHints.formOpenLabel` (default "양식 작성하기"/"Open form") 로 설명문에 언급되어 있다. 그러나:
  1. `spec/conventions/chat-channel-adapter.md §2.3 ChatChannelConfig.uiMapping` 에 `formOpenLabel` 을 새 `languageHints` 키로 명시하는 갱신이 target 변경 1에 포함되어 있지 않다.
  2. `spec/5-system/15-chat-channel.md §4.1` 의 `languageHints` JSONB 예시에 `"formOpenLabel": "양식 작성하기"` default 행 추가가 포함되어 있지 않다.
  3. `spec/5-system/15-chat-channel.md §4.1.1` 의 KO/EN default 12-키 표에 `formOpenLabel` 의 KO/EN default 값이 포함되어 있지 않다.
  `§4.1.1` 의 주석("CCH-ERR-* 6 키의 default 문구 …. 기존 5 키 (`groupChatRefusal` 등) 의 EN default 화는 본 spec 범위 밖 — 별 plan 추적")은 기존 키 추가를 별 plan 으로 미뤘지만, 신규 키 `formOpenLabel` 은 본 target spec draft 가 도입하는 것이므로 동일 table 에 추가되어야 한다. 누락 시 어댑터 lookup 순서 "(1) override → (2) locale default → (3) ko fallback" 에서 (2) 경로가 동작 불가.
- 제안: target spec draft 의 변경 4 (`15-chat-channel.md` 갱신) 범위를 확장해 §4.1 JSONB 예시 + §4.1.1 default 표에 `formOpenLabel` KO/EN default 행 추가. 변경 1 의 §2.3 `formMode` 주석에도 `languageHints.formOpenLabel` key 언급 추가.

---

### [WARNING] `spec-draft-chat-channel-error-notify.md` plan 이 in-progress 에 잔존 (stale)
- target 위치: target spec draft `target_specs` — `spec/4-nodes/7-trigger/providers/slack.md`, `spec/4-nodes/7-trigger/providers/discord.md`
- 관련 plan: `plan/in-progress/spec-draft-chat-channel-error-notify.md` (worktree: `chat-channel-error-notify-6d37ec`)
- 상세: `spec-draft-chat-channel-error-notify.md` 는 동일한 spec 파일 두 개 (`slack.md`, `discord.md`) 를 target_specs 로 포함한다. 그러나 이 plan 의 worktree branch `claude/chat-channel-error-notify-6d37ec` 는 이미 PR #323 (MERGED) + PR #343 (MERGED) 로 main 에 반영됐다. git worktree 디렉토리도 더 이상 존재하지 않는다. plan 파일만 `in-progress/` 에 남아 있어 후속 검토자에게 active 작업처럼 보인다. 실질적 충돌은 없으나 plan stale 로 인한 혼동 위험.
- 제안: `plan/in-progress/spec-draft-chat-channel-error-notify.md` 를 `plan/complete/` 로 `git mv` 이동.

---

### [WARNING] `spec-telegram-chat-channel-ui-polish.md` plan 이 in-progress 에 잔존 (stale)
- target 위치: target spec draft 변경 1-D `uiMapping.formMode` enum 확장 (현재 spec: `"multi_step"` 단일값)
- 관련 plan: `plan/in-progress/spec-telegram-chat-channel-ui-polish.md` (worktree: `telegram-chat-channel-spec-polish-49c49b`)
- 상세: `spec-telegram-chat-channel-ui-polish.md` 의 결정 1에서 `uiMapping.formMode` 의 enum 값을 `"multi_step"` (단일) 로 spec 에 등재했고 이것은 PR #281 (MERGED) 로 반영돼 있다. target spec draft 는 이를 `"multi_step" | "native_modal" | "auto"` 로 확장한다. 확장 자체는 R4 의 v2 옵션 실현이며 기존 결정과 충돌하지 않는다. 단, `spec-telegram-chat-channel-ui-polish.md` plan 의 branch `claude/telegram-chat-channel-spec-polish-49c49b` 가 git 어디에도 존재하지 않고 PR #281 이 이미 merge 됐으므로 이 plan 은 stale 이다.
- 제안: `plan/in-progress/spec-telegram-chat-channel-ui-polish.md` 를 `plan/complete/` 로 `git mv` 이동.

---

### [INFO] `chat-channel-outbound-still-broken.md` plan worktree 실존 여부 확인 권장
- target 위치: 관련 없음 (직접 target 과 충돌 없음)
- 관련 plan: `plan/in-progress/chat-channel-outbound-still-broken.md` (worktree: `.claude/worktrees/chat-channel-outbound-still-broken-afe293`)
- 상세: 이 plan 은 `spec/5-system/15-chat-channel.md` 와 `spec/5-system/14-external-interaction-api.md` 를 `related_specs` 로 보유하나 target spec draft 와는 별개 영역 (outbound EIA shape 변환 회귀 fix) 이다. 단, worktree 디렉토리가 `.claude/worktrees/` 목록에 없으므로 실제로 제거됐을 가능성이 높다. PR #318, #319 등이 이미 merge 됐고 모든 체크박스가 `[x]` 이지만 step 10 (PR 생성·push) 만 미체크. 이 plan 도 complete 이동 대상일 수 있다.
- 제안: `chat-channel-outbound-still-broken.md` 의 step 10 PR 상태 확인 후 complete 이동 검토.

---

### [INFO] Discord modal 필드 타입 제약 (select/checkbox/date 다단계 fallback) — `chat-channel-discord-gateway.md` 후속 작업과 연계
- target 위치: target spec draft `변경 3 — discord.md §5.3` — "Discord modal 은 TEXT_INPUT 만 지원 — SELECT_MENU 는 modal 밖. → Discord modal 제약 명시: select/radio/checkbox/date 가 포함된 form 은 modal 부적합 → 다단계 fallback"
- 관련 plan: `plan/in-progress/chat-channel-discord-gateway.md` (status: backlog)
- 상세: target spec draft 는 Discord 모달에서 SELECT/checkbox/date 를 text fallback 으로 처리하는 제약을 discord.md §5.3 에 명시한다. 이 결정은 후속 Discord Gateway plan (`chat-channel-discord-gateway.md`) 이 사용자 입력 수신 경로를 변경할 때 인지해야 할 제약이다. Gateway plan 은 현재 backlog 이고 이 영역을 언급하지 않는다.
- 제안: target spec draft 의 Discord §5.3 에 기재하는 "SELECT_MENU modal 제약" 메모를 `discord.md` 의 Discord Gateway plan 후속 작업 cross-ref 로 연결 (`plan/in-progress/chat-channel-discord-gateway.md` 참조). 또는 Gateway plan 의 "위험/의존성" 절에 이 제약을 추가. 어느 쪽이든 plan 갱신으로 처리 가능 (spec draft 자체 차단 아님).

---

### [INFO] `ai-form_render` silent 정책과 신규 `form_modal` 경로의 관계 명시 필요
- target 위치: target spec draft 변경 1 §4.1 native modal 경로
- 관련 plan: (현재 main 에 반영된 R-CCA-6 — `spec/conventions/chat-channel-adapter.md §3 매핑 표`)
- 상세: `spec/conventions/chat-channel-adapter.md §3` 의 `execution.waiting_for_input (interactionType=ai_form_render)` 행은 현재 "**빈 array** — ai_conversation 과 동일 경로. v2 의 chat channel form 인라인 처리는 별 plan" 으로 정의되어 있다. target spec draft 가 신설하는 `form_modal` 경로는 `interactionType=form` (EIA §6.2 의 blocking form 노드) 경로이며, `ai_form_render` (ai-agent 의 render_form blocking sub-state) 와는 별개다. 그러나 §3 매핑 표에서 `ai_form_render` 행의 "v2 의 chat channel form 인라인 처리는 별 plan" 주석이 target spec draft 로 실현되는 것인지 아닌지 불명확하다.
- 제안: target spec draft 완료 후 `spec/conventions/chat-channel-adapter.md §3` 의 `ai_form_render` 행 주석을 "v2 의 chat channel form 인라인 처리는 별 plan" → "EIA blocking form 노드의 native modal 처리는 §4.1 (R-CCA-8) 로 실현. ai-agent render_form (ai_form_render interactionType) 의 인라인 modal 처리는 별도 미결 plan" 으로 갱신. target spec draft 의 변경 1에 §3 매핑 표 `ai_form_render` 행 주석 갱신을 추가하거나, "변경 1 side-effect 점검 대상" 에 이 행 갱신을 명시.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 검토 결과:

- `chat-channel-form-native-modal-c021b9` (branch `claude/chat-channel-form-native-modal-c021b9`) — Step 1 ancestor check: branch HEAD (76a07c6a) == main HEAD (76a07c6a) → STALE. `git merge-base --is-ancestor` 결과 exit 0. 이 worktree 는 target spec draft 를 담은 current worktree 자신이며, 아직 신규 commit 이 없는 초기 상태 (main 과 동일 HEAD). spec draft 반영 후 commit 하면 ACTIVE 가 된다. 현재 시점에서는 단순 미작성 상태.

- `triggers-auth-column-a80393` (branch `claude/triggers-auth-column-a80393`) — Step 1: ACTIVE (main HEAD 와 3개 commit 차이). 이 branch 는 `spec/2-navigation/2-trigger-list.md` (trigger list 인증 열 + R-15) 만 변경하며 target 의 target_specs 4개와 겹치지 않는다. worktree 충돌 해당 없음.

worktree 충돌 후보 2건 중 stale 1건 skip, active 1건 (비충돌로 확인).

`claude/chat-channel-form-native-modal-c021b9` worktree 는 현재 빈 상태 (no new commits). cleanup 불필요 — 작업 진행 중인 worktree 의 초기 상태.

---

## 요약

target spec draft (`spec-draft-chat-channel-form-native-modal.md`) 는 plan 정합성 관점에서 전반적으로 건전하다. R4 의 "native UI 분기는 v2 옵션" 텍스트가 현재 spec 에 실재하므로 R-CCA-8 신설은 합법적 번복이 아닌 예고된 실현이다. 미해결 결정 우회는 없으며, 동일 target_specs 를 손대는 active worktree 충돌도 없다. 주요 주의 사항은 두 가지다: (1) `languageHints.formOpenLabel` 신규 키의 KO/EN default 문구가 `§4.1.1` 표와 `§4.1` JSONB 예시에 누락되어 어댑터 lookup 경로 (2)번이 동작 불가 상태가 되는 실질적 결함; (2) `spec-draft-chat-channel-error-notify.md` 와 `spec-telegram-chat-channel-ui-polish.md` 두 plan 이 이미 merge 된 PR 의 결과임에도 `in-progress/` 에 잔존해 혼동을 유발한다. worktree 충돌 후보 2건 중 stale 1건 (초기 상태 chat-channel-form worktree) skip, active 1건 (triggers-auth-column, 비충돌 영역).

---

## 위험도

LOW
