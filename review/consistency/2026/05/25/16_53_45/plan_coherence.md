# Plan 정합성 검토 — chat-channel-template-render-outbound

검토 대상: `plan/in-progress/chat-channel-template-render-outbound.md`  
검토 모드: spec draft (--spec)  
검토 일시: 2026-05-25

---

## 발견사항

### [WARNING] CCH-AD-06 요구사항 ID 충돌 — 제안 ID 가 이미 다른 의미로 사용 중

- **target 위치**: target 문서 §3.1 "CCH-AD-06 신설 (또는 CCH-AD-05 보강)" 제안
- **관련 plan**: 없음 (이미 main 에 반영된 spec 파생)
- **상세**: `spec/5-system/15-chat-channel.md §3.1` 의 `CCH-AD-06` 은 현재 **인터랙션 응답 (텔레그램 reply / inline_keyboard tap / 다단계 form answer) 도착 → `InteractionService.interact()` in-process 직접 호출** 의미로 정의되어 있다 (PR #300 이후 stable, line 60). target 이 새 in-process `execution.node.completed` listener 에 동일 ID `CCH-AD-06` 을 부여하면 ID 충돌이 발생한다. 다음 가용 ID 는 `CCH-AD-07`.
- **제안**: target spec 갱신안 §3.1 에서 "CCH-AD-06 신설" 을 "CCH-AD-07 신설" 로 교체. 본문에서 CCH-AD-06 을 참조하는 모든 위치도 동시 갱신.

---

### [WARNING] EiaEvent union 에 presentations? 미추가 — spec 약속과 구현 사이 gap 여전히 존재

- **target 위치**: target 문서 §결정 2 / §Spec 갱신안 A §1.2
- **관련 plan**: 없음 (현재 EIA §6.5 가 약속하나 chat-channel-adapter.md §1.2 미반영)
- **상세**: PR #323 이후 현재 `spec/conventions/chat-channel-adapter.md §1.2` 의 `execution.ai_message` 변형에는 `presentations?: PresentationPayload[]` 필드가 없다. target 이 이 추가를 제안하는 것은 정확한 gap 식별이며 계획 자체는 유효하다. 그러나 PR #323 이 §1.2 에서 `ai_form_render` interactionType 추가 및 §3 매핑 표 갱신을 동시에 수행했으므로, target 의 §1.2 수정안이 PR #323 에서 새로 도입된 `ai_form_render` 행 (§3) 과 충돌 없이 병합되는지 검토 필요.
- **제안**: target plan 의 spec 작성 단계 착수 전 main HEAD 기준으로 `spec/conventions/chat-channel-adapter.md` §1.2 와 §3 최신 내용을 재확인한 후 수정안을 재구성. 특히 `ai_form_render` 행과 `execution.node.completed` 행이 §3 매핑 표에서 의미상 명확히 분리되는지 확인.

---

### [WARNING] CCH-MP-01 보강안 — presentations[] 미처리 gap 는 여전히 유효하나 PR #323 상태 확인 필요

- **target 위치**: target 문서 §Spec 갱신안 B §3.3 "CCH-MP-01 보강"
- **관련 plan**: `plan/in-progress/chat-channel-error-notify.md` (PR #323 완료)
- **상세**: 현재 `spec/5-system/15-chat-channel.md` 의 `CCH-MP-01` (line 76) 은 "AI Multi Turn 의 `execution.ai_message` → 채널 텍스트 메시지 1건 이상으로 변환" 만 정의하며 `presentations?[]` 처리가 없다. target 의 보강은 유효한 gap 이다. 단, PR #323 이 `§3.5 CCH-ERR-*` 신설 시 §3.3 구조를 renumber 했을 가능성이 있어 §3.3 의 CCH-MP-01 현재 위치와 행 번호를 재검증해야 한다.
- **제안**: spec 작성 착수 전 main HEAD 의 `15-chat-channel.md §3.3` 현재 라인을 확인하고 CCH-MP-01 보강 수정안의 삽입 위치를 재정렬.

---

### [INFO] target plan 의 worktree branch 가 main 의 ancestor 로 확인됨 — 실제 작업은 아직 미착수 상태

- **target 위치**: plan frontmatter `worktree: chat-channel-template-render-outbound-2f8164`
- **관련 plan**: —
- **상세**: `git merge-base --is-ancestor claude/chat-channel-template-render-outbound-2f8164 origin/main` 가 STALE (exit 0). 브랜치에 main 대비 추가 커밋이 없고 PR 도 없다. worktree 는 생성되어 있으나 spec 수정 커밋은 0건. 따라서 현 시점에서는 spec 파일 충돌이 실제 발생하지 않았으며, 이후 착수 시 WARNING 항목들을 먼저 해소해야 한다.
- **제안**: plan 절차 체크박스 중 `[ ] /consistency-check --spec 호출 → BLOCK:NO 확인` 이 미완 상태이므로, 해당 단계를 실제 spec 파일 수정 전 반드시 실행.

---

### [INFO] chat-channel-form-native-modal plan 과의 scope 구분은 명확히 되어 있음

- **target 위치**: target 문서 §결정 2 "render_form … 별 plan chat-channel-form-native-modal 추적"
- **관련 plan**: `plan/in-progress/chat-channel-form-native-modal.md` (status: backlog, worktree: assigned at impl-start)
- **상세**: target 이 `render_form` (presentations[*].type === 'form') 을 본 결정 대상 밖으로 명시하고 별 plan 에 위임하는 것은 적절한 scope 분리. `chat-channel-form-native-modal.md` 는 backlog 상태이며 아직 worktree 미할당. 충돌 없음.
- **제안**: 추적 메모 — 향후 `chat-channel-form-native-modal` plan 착수 시 본 plan 의 `EiaAiMessageEvent.presentations?` 타입 정의가 이미 반영된 이후의 Convention §1.2 를 기반으로 시작해야 한다. plan 간 의존 순서를 `chat-channel-form-native-modal` 의 진입 조건에 명시 권장.

---

### [INFO] chat-channel-visual-ssr-png plan 과의 관계 — CCH-MP-04 fallback 재사용은 문제없음

- **target 위치**: target 문서 §결정 1 "v1 fallback (uiMapping.visualNode 분기) 그대로 적용 — CCH-MP-04 의 카드/테이블/차트 렌더링 로직 재사용. SSR PNG 는 chat-channel-visual-ssr-png plan 가 별도 추적."
- **관련 plan**: `plan/in-progress/chat-channel-visual-ssr-png.md` (status: backlog, priority: v2)
- **상세**: v1 fallback 재사용이며 v2 SSR PNG plan 은 backlog 상태. 직접 충돌 없음. target 의 결정이 SSR PNG plan 의 v2 트리거 신호 (`uiMapping.visualNode` enum) 에 의존하나, enum 자체는 `spec-telegram-chat-channel-ui-polish` plan 에서 이미 main 에 정의됨.
- **제안**: 추가 조치 불필요.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 중 stale 판정으로 skip 된 항목:

| worktree | branch | 판정 근거 |
|---|---|---|
| `chat-channel-error-notify-6d37ec` | `claude/chat-channel-error-notify-6d37ec` | Step 2 — PR #323 state: MERGED. 동일 spec 파일 (`spec/conventions/chat-channel-adapter.md`, `spec/5-system/15-chat-channel.md`) 수정 이력이 있으나 이미 main 머지 완료. 활성 충돌 아님. |
| `chat-channel-runtime-fix-ed7061` | `claude/chat-channel-runtime-fix-ed7061` | Step 2 — PR state: MERGED. 스캔 대상 spec 파일과 무관하거나 이미 main 반영. |
| `telegram-carousel-button-click-5b52c1` | `claude/telegram-carousel-button-click-5b52c1` | Step 2 — PR state: MERGED. |
| `chat-channel-template-render-outbound-2f8164` | `claude/chat-channel-template-render-outbound-2f8164` | Step 1 — ancestor of main (STALE). 브랜치 자체가 main 에 포함. 아직 spec 수정 커밋 없음. |
| `undici-autoselectfamily-b938d3` | `claude/undici-autoselectfamily-b938d3` | Step 2 — PR #325 state: MERGED. |

위 5개 worktree 모두 stale. 정리되지 않은 stale worktree 가 다수이므로 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

`update-logo-and-favicon-cb7b91` (Step 1 ACTIVE, Step 2 응답 없음 — Step 3 fallback: active 처리) 는 spec/5-system/15-chat-channel.md 및 spec/conventions/chat-channel-adapter.md 를 손대지 않으므로 §5번 검토 대상 아님.

---

## 요약

target plan (`chat-channel-template-render-outbound.md`) 이 식별한 두 가지 gap (비-blocking presentation 발화 누락 + AI Agent render_* presentations[] 미처리) 은 주요 spec 진단으로서 정확하며, 제안한 해결 방향 (in-process listener + EiaAiMessageEvent.presentations? 추가) 도 EIA §6.5 약속 및 기존 아키텍처 결정과 정합한다. 단, `CCH-AD-06` ID 가 이미 InteractionService.interact 인바운드 처리에 할당되어 있어 제안 ID 를 `CCH-AD-07` 로 교체해야 하는 WARNING 이 1건 존재한다. 또한 PR #323 이 동일 spec 파일에 대규모 변경을 마쳤으므로 spec 수정 착수 전 main HEAD 기준 §1.2 · §3 매핑 표 · §3.3 현재 상태를 재확인하는 2건의 WARNING 이 추가된다. worktree 충돌 후보 5건은 전원 stale 판정으로 skip — active worktree 충돌 0건.

---

## 위험도

**MEDIUM** — CCH-AD-06 ID 충돌은 spec 문서에서 요구사항 ID 의미 혼동을 일으킬 수 있으며, PR #323 이후 변경된 spec 파일 구조를 미확인하면 수정안 삽입 위치가 맞지 않을 수 있다. BLOCK 수준의 결정 우회나 active worktree 경합은 없음.
