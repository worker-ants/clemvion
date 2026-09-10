# Rationale 연속성 검토 — impl-chat-channel-patch-token

검토 대상: `spec/5-system` (scope 델타 0 — 이번 브랜치는 spec 을 바꾸지 않음) 기준
구현 diff (`origin/main...HEAD`, 16 files / backend `triggers`·`chat-channel` 모듈 + 프론트 docs).
1차 SoT: `spec/5-system/15-chat-channel.md` §5.4.1 / §5.4.1.1 및 그 `## Rationale` 의
R-CC-10 · R-CC-21, 보조로 `spec/2-navigation/2-trigger-list.md` R-2/R-12/R-14.

## 발견사항

- **[INFO]** 신규 검증 분기 2건이 §5.4.1 표 / trigger-list PATCH 에러 표에 아직 미등재
  - target 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` 의
    `assertChatChannelAlreadySetUp` (chatChannel 최초 부착 차단 → `details.field='chatChannel'`,
    provider 전환 차단 → `details.field='provider'`) — `triggers.controller.ts` 의
    `@ApiBadRequestResponse` 문서화는 이 diff 에서 추가됨
  - 과거 결정 출처: `spec/5-system/15-chat-channel.md` §5.4.1 표 1행("최초 트리거 생성에서만
    botTokenRef 신설") + `spec/2-navigation/2-trigger-list.md` R-12("provider 변경하려면 삭제·재생성")
  - 상세: 이번 diff 가 추가한 두 400 케이스는 R-CC-21 의 취지("실패가 조용한 형태로 바뀌는 것을
    막는다")와 R-12 의 기존 원칙(provider 전환은 삭제·재생성)에 **부합하는 새 결정**이며 기각된
    대안을 되살리거나 원칙을 어기는 것은 아니다. 다만 이 두 분기는 아직 `spec/5-system/15-chat-channel.md`
    §5.4.1 표 자체나 `2-trigger-list.md` 의 PATCH 에러 표에는 반영돼 있지 않다. Rationale 은
    코드 주석(`R-CC-21 / D-1`, `§5.4.1 표 1행`)에만 존재하고 spec 본문에는 아직 없다.
  - 제안: 신규 결정은 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에
    planner 후속 항목으로 등재돼 있다(`--impl-done review/consistency/2026/09/11/00_21_57` W3 인용).
    새로 등재할 필요는 없음 — 다음 planner 턴에서 §5.4.1 표 + `2-trigger-list.md` 에러 표
    동시 갱신만 확인하면 된다.

- **[WARNING]** 동시 PATCH 레이스가 R-CC-21 이 막 닫은 fail-open 을 다른 경로로 되살릴 수 있음 (이미 추적 중)
  - target 위치: `triggers.service.ts` `update()` → `setupChatChannel()` 구간 — 요청 시작 시점
    `trigger.config` 스냅샷(`previousInboundSigningRef`)을 트랜잭션·낙관적 잠금 없이 신뢰
  - 과거 결정 출처: `spec/5-system/15-chat-channel.md` R-CC-21 — "PATCH 는 비밀을 쓰지 않는다
    / inbound signing ref 가 사라지면 서명 검증이 fail-open 한다"는 바로 그 invariant
  - 상세: 이 PR 이 도입한 `previousInboundSigningRef` 보존 로직은 순차 요청에서는
    fail-open 을 정확히 막지만, 동시에 겹치는 PATCH 두 건이 있으면 나중에 커밋되는 쪽이 먼저
    반영된 `inboundSigningRef` 를 옛 스냅샷으로 덮어써 **이번 PR 이 닫은 것과 동일한 형태의
    fail-open** 이 동시성 경로로 재발할 수 있다. 이 레이스 자체는 diff 가 새로 만든 설계가
    아니라 기존 CCH-SE-01 best-effort 2단계 커밋 위에 새 상태를 얹은 것이라는 점은 diff 작성자도
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 스스로 명시했다
    (`/ai-review review/code/2026/09/10/23_55_23` concurrency W1 인용, 미해결 `[ ]` 항목으로 등재됨).
  - 제안: 별도 fix PR 필요 — advisory lock 또는 `SELECT … FOR UPDATE` 또는 `config` 낙관적 버전
    비교. Rationale 연속성 관점에서는 **새 Rationale 이 필요하다기보다 R-CC-21 의 invariant 가
    동시성 조건에서 아직 완전히 보장되지 않는다는 사실**을 그 fix PR 이 R-CC-21 에 caveat 으로
    추가해야 한다. 현재 plan 항목이 이미 그 필요성을 정확히 짚고 있어 추가 조치는 불요 — 병합 전
    반드시 완료돼야 하는 항목은 아님(현재 diff 의 스코프 밖).

## 요약

target(`spec/5-system`)는 이번 브랜치에서 변경되지 않았고, 구현 diff 는 이미 spec 에 존재하는
R-CC-10(bot token single-path) · R-CC-21(PATCH 는 비밀을 쓰지 않는다, D-1/D-2/D-3)을 코드 레벨에서
충실히 구현한다. R-CC-21 이 명시적으로 기각한 대안들 — "botToken 을 optional 로 두고 무시",
"SecretResolver.rotate 에 빈 값 가드만 추가", "telegram 도 별도 rotate-inbound-signing API 로 분리",
"telegram adapter 가 기존 서명을 재사용해 값 불변을 위장", "chatChannel PATCH 에서 setupChannel 을
아예 안 부름" — 중 어느 것도 이번 diff 에 재도입되지 않았다. `storeUserSuppliedSecrets` 플래그가
bot token / provider-issued signing 만 게이팅하고 telegram 의 server-issued 재발급-재저장은
게이팅하지 않는 것도 R-CC-21 의 caveat(telegram 은 이 결정의 대상이 아님)과 정확히 일치한다.
provider 전환·최초-attach 차단은 R-12(트리거 삭제·재생성) 원칙과 정합하는 새 결정이나 아직 spec
표에 반영 전이며, 이미 후속 planner 항목으로 추적 중이다(INFO). 유일하게 남는 리스크는 동시 PATCH
레이스가 R-CC-21 이 닫은 fail-open 을 다른 경로로 되살릴 수 있다는 점인데, 이는 diff 작성자 스스로
발견해 별도 backlog 항목으로 이미 등재해 두었다(WARNING, 조치는 이 PR 스코프 밖). 종합적으로
Rationale 연속성 위반은 발견되지 않았다.

## 위험도
LOW
