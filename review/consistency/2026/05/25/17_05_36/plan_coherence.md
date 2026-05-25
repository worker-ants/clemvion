# Plan 정합성 검토 결과

검토 대상: `plan/in-progress/spec-draft-chat-channel-template-render-outbound.md`
검토 모드: spec draft (--spec)
검토 일시: 2026-05-25

---

## 발견사항

### [CRITICAL] Convention §3.1 섹션 번호 충돌 — 이미 점유된 절에 신규 내용 추가 시도

- **target 위치**: target 문서 `## Spec 갱신안 > A. spec/conventions/chat-channel-adapter.md > §1.3 (신설)` 및 `§3 — 매핑 표 > §3.1 신설 — ChatChannelInternalEvent → renderPresentationNode 매핑`
- **관련 plan**: `plan/in-progress/spec-draft-chat-channel-error-notify.md` (worktree `chat-channel-error-notify-6d37ec`) — §2b: "`§3.1 Execution Failed 분류 알고리즘`" 신설 (PR MERGED, 현재 `spec/conventions/chat-channel-adapter.md` line 253 에 실재)
- **상세**: target 이 `chat-channel-adapter.md §3.1` 을 `ChatChannelInternalEvent → renderPresentationNode` 매핑 표로 신설하려 한다. 그러나 `chat-channel-error-notify` PR 이 이미 main 에 머지되어 `§3.1 Execution Failed 분류 알고리즘` (`classifyExecutionFailure` pure function 시그니처 + 카테고리 매핑 표) 이 해당 섹션을 점유 중이다. 동일 section anchor 에 두 내용이 충돌한다.
- **제안**: target spec 갱신안에서 `ChatChannelInternalEvent` 매핑 표의 섹션 번호를 `§3.2` (또는 `§3.3`) 로 변경해야 한다. target plan 을 작성할 시점에 chat-channel-error-notify 가 draft 단계였기 때문에 §3.1 이 비어 있을 것으로 가정한 것으로 보이나, 이미 MERGED 상태이므로 재번호화 필수.

---

### [CRITICAL] 6함수 인터페이스 확장 — MERGED Rationale R-CCA-5 의 명시적 기각 우회

- **target 위치**: target 문서 `## Spec 갱신안 > A. §1.1 — 6함수 → 7함수 표 확장` — `renderPresentationNode` 행 추가
- **관련 plan**: `plan/in-progress/spec-draft-chat-channel-error-notify.md` / `plan/in-progress/chat-channel-error-notify.md` (worktree MERGED) — MERGED spec 의 `chat-channel-adapter.md` Rationale `R-CCA-5` 대안 2: "**기각** 어댑터 인터페이스에 `renderError(event)` 신설 — R2 의 인터페이스 최소화 원칙 적용 — 6함수 인터페이스 (§1) drift 발생. 새 함수 추가는 모든 provider 어댑터의 contract 변경."
- **상세**: MERGED 상태의 R-CCA-5 Rationale 이 "새 함수 추가는 6함수 인터페이스 drift" 를 명시적 기각 사유로 확정했다. target 은 이 결정이 내려진 직후 `renderPresentationNode` 라는 새 7번째 함수를 §1.1 에 추가하는 결정을 일방적으로 내리고 있다. 비록 `renderPresentationNode` 의 입력이 `EiaEvent` 가 아닌 `ChatChannelInternalEvent` 라는 차이가 있지만, "새 함수 추가 → 모든 provider 어댑터 contract 변경" 의 논거는 동일하게 적용된다. MERGED Rationale 이 명시적으로 "새 함수 추가는 drift" 라고 못 박은 직후, 동일 논리 구조를 가진 새 함수를 추가하는 결정은 합의되지 않은 우회에 해당한다.
- **제안**: R-CCA-5 대안 2의 기각 논거를 상세히 다시 검토한 뒤, `renderPresentationNode` 가 `renderNode` 와 어떻게 차별화되며 6함수 인터페이스의 "최소화 원칙" 을 위반하지 않는지를 target plan 의 `## 결정 > 결정 1` Rationale 에 명시적으로 논증해야 한다. 대안으로 `renderNode` 를 ChatChannelInternalEvent 를 받을 수 있도록 signature 오버로드하거나, 새 함수를 어댑터 인터페이스가 아닌 dispatcher 계층의 내부 헬퍼로 배치하는 방안도 검토해야 한다.

---

### [WARNING] `EiaAiMessageEvent.presentations?` 필드 누락 — MERGED 상태의 spec 에서 이미 반영되었는지 확인 필요

- **target 위치**: target 문서 `## Spec 갱신안 > A. §1.2 — EiaEvent union 5종 유지 + EiaAiMessageEvent 에 presentations? 추가`
- **관련 plan**: target 이 참조하는 EIA §6.5 line 536 (`presentations?: PresentationPayload[]` 약속) 은 `spec/5-system/14-external-interaction-api.md` 에 현재 실재. 그러나 `chat-channel-adapter.md` 의 `execution.ai_message` union variant (현 line 89) 에는 `presentations?` 필드가 누락 상태. 이는 target 이 정확히 식별한 drift.
- **상세**: target 이 이 drift 를 catch-up 하는 것은 올바른 방향이나, `chat-channel-error-notify` MERGED PR 이 `execution.ai_message` 행 (`§3` 매핑 표) 을 갱신할 때 (execution.failed 행 격상) `presentations?` 를 추가하지 않았다. 이는 target 이 적용하려는 `§1.2` 의 EiaAiMessageEvent variant 갱신과 `§3` 매핑 표의 ai_message 행 갱신이 여전히 유효한 변경임을 의미한다. 단 target 이 §3 매핑 표에서 `execution.ai_message` 행을 갱신할 때, 이미 MERGED 된 `§3.1 Execution Failed 분류 알고리즘` (현재 line 253) 의 anchor 와 섹션 구조를 손상시키지 않도록 주의해야 한다.
- **제안**: target spec 갱신안 `§3 — 매핑 표` 의 `execution.ai_message` 행 갱신은 그대로 진행 가능. 단 섹션 번호 충돌 (CRITICAL #1) 해소 후 적용.

---

### [WARNING] `spec/conventions/chat-channel-adapter.md §3.1` 신규 섹션이 기존 cross-link 를 깨뜨릴 위험

- **target 위치**: target 문서 `## Spec 갱신안 > A. §3 > §3.1 신설` — ChatChannelInternalEvent 매핑 표를 `§3.1` 로 신설
- **관련 plan**: 현재 `spec/5-system/15-chat-channel.md` 여러 곳에서 `Convention §3.1` 을 `classifyExecutionFailure` 의 anchor 로 직접 인용 (line 94, line 155, line 221, line 662 등). 만약 target 이 §3.1 에 새 내용을 추가하면 기존 anchor 가 다른 내용을 가리키게 된다.
- **상세**: CRITICAL #1 과 동일 원인의 후속 영향. target 이 §3.1 섹션을 점유하면 15-chat-channel.md 의 기존 cross-link 7건 이상이 잘못된 내용을 가리킨다.
- **제안**: 위 CRITICAL #1 해소(섹션 번호를 §3.2 이상으로 변경) 로 자동 해소된다.

---

### [WARNING] CCH-AD-05 (NotificationDispatcher after-commit EventEmitter) vs CCH-AD-07 (WebsocketService.executionEvents$ Subject) 구독 경로 불일치

- **target 위치**: target 문서 `## Spec 갱신안 > B. spec/5-system/15-chat-channel.md > §3.1 — CCH-AD-07 신설` — "WebsocketService.executionEvents$ Subject 를 단일 구독 (R8 catch-up 결정 경로)"
- **관련 plan**: 현 `spec/5-system/15-chat-channel.md §3.2 어댑터 구독` (line 182): CCH-AD-05 는 "**NotificationDispatcher 의 after-commit EventEmitter** 에 in-process listener 로 attach" 로 명시. 동 R8 (line 548): "Fan-out source = `WebsocketService.executionEvents$` RxJS Subject — 모든 후속 listener 의 공통 진입" + ChatChannelDispatcher 는 "in-process subscription, chat-channel 전담".
- **상세**: 현 spec 기준 CCH-AD-05 의 구독은 NotificationDispatcher EventEmitter 를 통하지만, target 의 CCH-AD-07 설명에서는 직접 `WebsocketService.executionEvents$` Subject 를 구독한다고 기술한다. R8 에 따르면 ChatChannelDispatcher 는 이미 executionEvents$ 를 직접 구독하는 구조이므로 CCH-AD-07 의 경로는 기술적으로 맞다. 그러나 CCH-AD-05 의 공식 텍스트 ("NotificationDispatcher EventEmitter") 와 CCH-AD-07 의 경로 ("WebsocketService.executionEvents$") 가 용어 불일치를 유발해 spec 정합성을 해친다. 두 ID 간에 동일 fan-out source 를 다르게 설명하는 것은 향후 구현자에게 혼란을 준다.
- **제안**: CCH-AD-07 신설 시 구독 경로 설명을 CCH-AD-05 + R8 의 용어와 정합시킨다. 예: "ChatChannelDispatcher 가 `WebsocketService.executionEvents$` Subject (R8 fan-out source) 에 대한 기존 module-level 단일 구독에서 presentation 노드 한정 sub-filter 를 추가로 적용" — 새 구독 경로를 여는 게 아니라 기존 구독의 필터 확장임을 명시.

---

### [WARNING] `spec/5-system/14-external-interaction-api.md §R10` 보강 — chat-channel-internal listener 가 R10 원칙을 어떻게 만족하는지 논거 보강 필요

- **target 위치**: target 문서 `## Spec 갱신안 > C. §R10 본문 보강` — "sub-filter 로 추가 구독하는 것은 R10 허용 범위 — 단일 sink 자체는 WebsocketService.emit* 이며 어댑터는 그 sink 의 consumer 한정"
- **관련 plan**: `spec/5-system/14-external-interaction-api.md R10` 현 본문 (line 909): "Chat Channel adapter (2026-05-21)" 항목이 이미 추가되어 있으며, ChatChannelDispatcher 가 NotificationDispatcher 와 "동일 facade 계층" 에 위치한다고 기술함.
- **상세**: EIA §R10 에는 이미 Chat Channel 어댑터에 대한 설명이 있다. target 이 보강하려는 내용 ("sub-filter 로 추가 구독하는 것은 R10 허용 범위") 은 기존 R10 텍스트와 의미상 중복되거나 부분 보완에 해당한다. 이는 WARNING 수준이나, 실제 보강 전에 현 R10 본문과 중복/모순이 없는지 재확인 필요.
- **제안**: C 항목의 R10 보강은 기존 R10 Chat Channel adapter 설명 뒤에 `execution.node.completed` 이벤트에 대한 sub-filter 구독이 추가 sink 도입이 아님을 1-2줄로 append 하는 방식으로 제한. 기존 R10 Chat Channel 항목 전체를 재작성하거나 의미 변경하지 않도록 주의.

---

### [INFO] chat-channel-error-notify plan 은 stale worktree 로 skip — 그러나 plan 파일이 in-progress 로 남아있어 정리 필요

- **target 위치**: `plan/in-progress/chat-channel-error-notify.md` (worktree `chat-channel-error-notify-6d37ec`), `plan/in-progress/spec-draft-chat-channel-error-notify.md` (동일 worktree)
- **관련 plan**: PR 이 MERGED 된 stale worktree. 그러나 plan 파일 자체는 `plan/in-progress/` 에 잔존 중 (stale 판정 cascade Step 2: PR state = MERGED).
- **상세**: worktree 충돌 검토에서 stale 처리. 그러나 plan 파일 두 건이 `plan/in-progress/` 에 남아있어 다음 검토자가 active plan 으로 오해할 위험. 해당 plan 은 `plan/complete/` 로 `git mv` 해야 한다. target 과의 직접 충돌이 아닌 운영 정리 이슈.
- **제안**: `plan/in-progress/chat-channel-error-notify.md` 및 `plan/in-progress/spec-draft-chat-channel-error-notify.md` 를 `plan/complete/` 로 이동. 이후 cleanup-worktree-all.sh 로 stale worktree 정리.

---

### [INFO] chat-channel-outbound-still-broken, fix-chat-channel-dispatcher-and-cafe24-warn, telegram-carousel-button-click, telegram-chat-channel-spec-polish — stale worktree, skip

- **상세**: 위 4개 worktree 는 Step 1 (ancestor 검사) 에서는 ACTIVE 이나 Step 2 (GitHub PR state) 에서 모두 MERGED 확인 → stale 판정으로 §5번 worktree 충돌 검토에서 제외.
- **제안**: `./cleanup-worktree-all.sh --yes --force` 실행으로 stale worktree 5건 (chat-channel-error-notify-6d37ec / chat-channel-outbound-still-broken-afe293 / fix-chat-channel-dispatcher-and-cafe24-warn-68da78 / telegram-carousel-button-click-5b52c1 / telegram-chat-channel-spec-polish-49c49b) 정리 권장.

---

### [INFO] target plan 의 `spec/4-nodes/7-trigger/providers/telegram.md §7 변경 관리` cross-ref 추가 의무 미세화 필요

- **target 위치**: target 문서 `## 영향 평가` — "spec/4-nodes/7-trigger/providers/telegram.md §5.4 — 현재 정의된 CCH-MP-04 v1 fallback 이 그대로 적용. §7 변경 관리 의무에 따라 동반 갱신 — CCH-MP-06 / CCH-AD-07 cross-ref 추가"
- **관련 plan**: `plan/in-progress/chat-channel-visual-ssr-png.md` 는 telegram.md §5.4 의 v2 격상을 예고하고 있으나 backlog 상태 (active worktree 없음). 충돌 없음.
- **상세**: target 이 telegram.md §5.4 에 cross-ref 한 줄만 추가하는 범위는 적절하다. 단 `## Spec 갱신안` 섹션에 이 변경이 D (CHANGELOG) 항목 외에 별도 문서로 기술되어 있지 않으므로 구현 시 누락 위험.
- **제안**: `## Spec 갱신안` 에 `E. spec/4-nodes/7-trigger/providers/telegram.md` 항목을 추가해 §5.4 cross-ref 변경 내용을 명시적으로 기재할 것을 권장.

---

## Stale 으로 skip 한 worktree (의무 보고)

worktree 충돌 후보 검토 중 §worktree stale 판정 cascade 로 skip 된 항목:

| worktree | branch | Step 1 | Step 2 (PR state) | 판정 |
|---|---|---|---|---|
| `chat-channel-error-notify-6d37ec` | `claude/chat-channel-error-notify-6d37ec` | ACTIVE (not ancestor) | MERGED | **stale** |
| `chat-channel-outbound-still-broken-afe293` | `claude/chat-channel-outbound-still-broken-afe293` | ACTIVE (not ancestor) | MERGED | **stale** |
| `fix-chat-channel-dispatcher-and-cafe24-warn-68da78` | `claude/fix-chat-channel-dispatcher-and-cafe24-warn-68da78` | ACTIVE (not ancestor) | MERGED | **stale** |
| `telegram-carousel-button-click-5b52c1` | `claude/telegram-carousel-button-click-5b52c1` | ACTIVE (not ancestor) | MERGED | **stale** |
| `telegram-chat-channel-spec-polish-49c49b` | `claude/telegram-chat-channel-spec-polish-49c49b` | ACTIVE (not ancestor) | MERGED | **stale** |
| `chat-channel-template-render-outbound-2f8164` (target 자신) | `claude/chat-channel-template-render-outbound-2f8164` | **STALE** (Step 1 ancestor 확인) | — | stale (활성 작업 중인 worktree 는 `claude/undici-autoselectfamily-b938d3` 로 다름) |

비고: target 문서의 frontmatter `worktree: chat-channel-template-render-outbound-2f8164` 가 가리키는 branch (`claude/chat-channel-template-render-outbound-2f8164`) 자체는 Step 1 에서 STALE 판정. 현재 이 worktree 에서 실제 작업하는 branch 는 `claude/undici-autoselectfamily-b938d3` 로 확인됨. worktree 는 active 하지만 branch 명이 frontmatter 와 불일치 — plan frontmatter 갱신 필요.

stale worktree 5건이 활성으로 남아있을 이유가 없으므로 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

target spec draft 는 두 가지 CRITICAL 발견으로 현 상태에서 spec 본문 반영을 차단해야 한다. 첫째, `spec/conventions/chat-channel-adapter.md §3.1` 이 이미 MERGED PR (`chat-channel-error-notify`) 에 의해 `classifyExecutionFailure` 알고리즘 섹션으로 점유되었는데, target 이 같은 §3.1 에 `ChatChannelInternalEvent → renderPresentationNode` 매핑 표를 추가하려 해 섹션 번호 충돌이 발생한다 — 섹션 번호를 §3.2 이상으로 변경해야 한다. 둘째, 동 MERGED 스펙의 Rationale R-CCA-5 가 "새 함수 추가 = 6함수 인터페이스 drift" 를 명시 기각했음에도 target 이 `renderPresentationNode` 라는 7번째 함수를 §1.1 에 추가하는 결정을 합의 없이 내리고 있어, R-CCA-5 대안 2의 기각 논거를 정면으로 반박하는 추가 논증이 선행되어야 한다. 두 CRITICAL 외에 CCH-AD-05 와 CCH-AD-07 의 구독 경로 용어 불일치 (WARNING), R10 보강 중복 위험 (WARNING) 도 수정이 필요하다. worktree 충돌 후보 6건 중 stale 5건 skip, active 0건 분석 (target 자신의 plan worktree 불일치는 INFO 보고).

---

## 위험도

**HIGH**

— CRITICAL 2건이 모두 MERGED spec 결정을 직접 우회·충돌하는 사안이라 spec 본문 반영 전 해소 필수.

STATUS: OK
