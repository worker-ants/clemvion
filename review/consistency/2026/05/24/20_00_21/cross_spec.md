# Cross-Spec 일관성 검토 결과

검토 모드: --impl-done  
대상: `spec/5-system/15-chat-channel.md` + PR #300 구현 변경 사항  
기준 브랜치: origin/main  
검토일: 2026-05-24

---

## 발견사항

### [WARNING] CCH-AD-01 과 providers/_overview.md §1 간 "지원 상태" 기술 불일치

- **target 위치**: `spec/5-system/15-chat-channel.md` §3.1 CCH-AD-01 (line 35)
- **충돌 대상**: `spec/4-nodes/7-trigger/providers/_overview.md` §1 Supported providers 표
- **상세**:  
  `15-chat-channel.md` CCH-AD-01 은 `"v1 supported: telegram / v1 spec-defined: slack, discord — impl pending"` 이라고 기술한다. 그러나 `providers/_overview.md` §1 은 이미 `telegram`, `slack`, `discord` 세 provider 모두를 `supported (v1)` 로 분류하고 있으며 `spec-defined / impl-pending` 섹션은 비어 있다. 이번 PR #300 의 구현이 이미 어댑터 구현 + registry 등록 + e2e 테스트를 완료하여 `_overview.md` 가 갱신되었음에도, `15-chat-channel.md` CCH-AD-01 의 인라인 주석이 과거 상태(impl pending)를 반영하는 채로 남아 있다.  
  두 spec 이 동일 fact("v1 지원 여부")를 다르게 기술하고 있어 독자·개발자 혼동을 유발한다.
- **제안**: `15-chat-channel.md` CCH-AD-01 의 인라인 주석을 `"v1 supported: telegram / slack / discord"` 로 갱신. `providers/_overview.md §1` 이 단일 진실이므로 15-chat-channel.md 는 그 참조만 유지하면 충분.

---

### [INFO] `spec/conventions/chat-channel-adapter.md` 변경 이력(Changelog) 미기록

- **target 위치**: `spec/conventions/chat-channel-adapter.md` Changelog 절
- **충돌 대상**: PR #300 구현 범위 (slack/discord provider 추가)
- **상세**:  
  본 PR 이 slack.md / discord.md spec 과 함께 Slack/Discord 어댑터를 정식 `supported (v1)` 로 승격시켰으나, `chat-channel-adapter.md` Changelog 에는 2026-05-24 날짜로 `inboundSigningRef` rename 기록만 있다. Adapter Registry §5 의 `provider` 목록 (`"telegram"`, `"slack"`, `"kakao-talk"` 예시) 과 §4 변경 관리 절에 "신규 provider 추가 시 본 catalog 도 함께 갱신" 의무가 있는데, 이번 provider 2종 등록 완료 사실 자체는 convention Changelog 에 기록되어 있지 않다.  
  기능 충돌이 아닌 문서화 누락이므로 INFO 등급.
- **제안**: `chat-channel-adapter.md` Changelog 에 한 줄 추가 — "2026-05-24: Slack/Discord adapter v1 impl 완료 — `providers/_overview.md §1` supported 승격 (PR #300)".

---

### [INFO] `spec/2-navigation/2-trigger-list.md` §2.3.1 Chat Channel 카드의 `provider` read-only 메모 미갱신

- **target 위치**: `spec/2-navigation/2-trigger-list.md` §2.3.1 Chat Channel 행 (line 99)
- **충돌 대상**: `providers/_overview.md §1` (telegram / slack / discord 모두 v1 supported)
- **상세**:  
  `2-trigger-list.md` §2.3.1 의 `provider` read-only 행 비고란에 `"v1 은 telegram 만"` 이라고 명시되어 있다. 이번 PR 로 slack/discord 도 v1 supported 로 승격되었으므로 이 문구가 사실과 다르다.  
  UI 렌더링에 직접 영향을 주는 기술은 아니지만(provider read-only 자체는 동일), 명세 독자가 v1 지원 범위를 잘못 이해할 수 있다.
- **제안**: 해당 비고란을 `"v1 은 telegram / slack / discord. 변경하려면 트리거 삭제·재생성"` 으로 갱신.

---

### [INFO] 사용자 가이드 Telegram setup 절 — API 예제 curl 의 `config.chatChannel` 위치 표기

- **target 위치**: `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` (Telegram 설정 방법 §3 API 예제) + `triggers.en.mdx`
- **충돌 대상**: `spec/5-system/15-chat-channel.md §4.1` ("chatChannel 은 top-level — config 안에 nested 면 setupChatChannel 자동 호출 skip"), `codebase/backend/src/modules/triggers/dto/create-trigger.dto.ts` line 121
- **상세**:  
  이번 PR 에서 갱신된 사용자 가이드의 "Telegram 설정 방법" §3 에 남아 있는 curl 예제는 `config.chatChannel` 키 아래에 챗 채널 설정을 넣는 형식으로 되어 있을 가능성이 있다(diff 에서 해당 curl body 상세가 잘려 있어 직접 확인이 필요). e2e spec 의 SoT 주석 (`"chatChannel 은 top-level — config 안에 nested 면 setupChatChannel 자동 호출 skip"`) 과 다를 경우 사용자가 API 를 직접 호출할 때 setupChannel 이 자동으로 동작하지 않는 혼동을 겪는다.  
  spec 자체의 충돌은 아니고 가이드 문서 내 예제의 정확성 문제이므로 INFO 등급. diff 에서 chatChannel 이 이미 top-level 로 올바르게 표기되었다면 무시.
- **제안**: 가이드의 API 예제를 직접 확인하여 `chatChannel` 이 request body 의 top-level 에 위치함을 확인.

---

## 요약

Cross-Spec 일관성 관점에서 이번 PR #300 구현은 전반적으로 spec 과 정합하다. `spec/conventions/secret-store.md §5.5`, `chat-channel-adapter.md §2.3`, `providers/slack.md §6`, `providers/discord.md §6` 의 `inboundSigningPlaintext` 두 경로 계약(server-issued Telegram vs provider-issued Slack/Discord)이 DTO, service, e2e 에 일관되게 반영되었다. RBAC/API 계약/상태 전이/데이터 모델 슬롯(`inboundSigningRef`)도 spec 정의와 어긋나지 않는다. 단 `15-chat-channel.md` CCH-AD-01 인라인 주석이 "impl pending" 과거 상태를 그대로 유지하고 있어 `providers/_overview.md §1` (telegram/slack/discord 모두 supported) 과 사실 충돌이 발생한다(WARNING). 이외 두 건은 명세 문서화 동기화 미흡으로 운영 블로킹 없는 INFO 수준이다.

---

## 위험도

LOW
