# Plan 정합성 검토 — spec/5-system/ (--impl-prep) × plan/in-progress/impl-chat-channel-binder.md

## 발견사항

- **[WARNING]** `15-chat-channel.md` frontmatter `code:` 목록이 이미 알려진 채로 밀려 있는데, 이번 리팩터가 그 목록을 **더 밀어낸다**
  - target 위치: `spec/5-system/15-chat-channel.md` frontmatter `code:` (직접 실측 — `triggers.service.ts`·`triggers.controller.ts`·`chat-channel-token-rotator.service.ts` 3개만 열거, glob 아님)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:2194-2196` — *"`15-chat-channel.md` frontmatter `code:` 가 이번 PR 의 배선 파일(`update-trigger.dto.ts`·`trigger-dto-validation.spec.ts`·`triggers.service.spec.ts`·`trigger-workflow-ref.e2e-spec.ts`)을 아직 안 가리킨다 — **3라운드 연속 관측**, 가드는 통과"*
  - 상세: 현재 frontmatter 를 직접 열어 확인한 결과 저 4개 파일은 여전히 미등재이고, 이미 존재하는 `chat-channel-rejection-messages.const.ts`(2026-09-11 등재된 신규 파일)도 등재돼 있지 않다 — 즉 gap 은 최소 5개로 이미 커져 있다. `impl-chat-channel-binder.md` 는 T1(`chat-channel-input-rules.ts`)·T2(`ChatChannelBinderService`, 파일명 미정이나 `triggers/` 안 신규 provider) **두 개의 새 파일을 더** 만들면서 `spec_impact: none` 을 선언한다. 이 spec 문서의 `code:` 목록은 **정확한 파일 열거**(디렉토리 glob 아님) 방식이라 새 파일은 자동으로 커버되지 않고, 이미 "3라운드 연속 관측"된 미해소 gap 에 항목 2개가 추가로 쌓인다. 이 spec 은 `spec/conventions/spec-impl-evidence.md` 의 spec-impl coverage 증거 SoT 이므로, 목록이 실제 구현 파일을 못 가리키면 그 표준 자체가 무력화된다.
  - 제안: `impl-chat-channel-binder.md` 체크리스트에 "T1/T2 신규 파일을 `15-chat-channel.md` frontmatter `code:` 에 추가" 항목을 넣거나, 최소한 이번 PR 이 그 gap 을 갱신하지 않고 넘어간다는 사실과 그 이유를 plan 에 명시한다. 이상적으로는 이미 열린 tracker 항목(4개 파일 미등재)과 **한 배치**로 묶어 planner 턴에서 6개(4+chat-channel-rejection-messages.const.ts+신규 2)를 한 번에 등재하는 편이 "발견될 때마다 한 파일씩 늘어나는" 패턴을 끊는다.

- **[WARNING]** 트래커의 열린 항목 2건이 이번 리팩터 이후 "위치" 서술이 stale 해지는데, 계획의 종결 체크리스트가 그 갱신을 포함하지 않는다
  - target 위치: `impl-chat-channel-binder.md` §계획 4단계(뮤테이션 검증) · §체크리스트 항목 7("트래커 … 항목 종결")
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:2201-2211`(동시 PATCH lost-update) · `:2213-2217`(`setupChatChannel` 관심사 분해)
  - 상세: (1) `:2201` 항목은 *"`update()` → `setupChatChannel()` 전 구간이 트랜잭션 없이 스냅샷을 신뢰한다 … **자매 패턴 `rotateChatChannelBotToken()` 도 같은 구간을 가진다**"* 라고 적는다. 실측 결과 `rotateChatChannelBotToken`은 실제로는 `rotateBotToken` 메서드(코드 내 주석에서만 그 이름으로 불림)이고, `buildCallbackUrl` 을 통해 `setupChatChannel` 과 실제로 같은 helper 를 공유한다(`triggers.service.ts:1130`·`:1554`). 이 리팩터가 `setupChatChannel`(T2)을 새 클래스로 옮기고 `rotateBotToken` 은 `TriggersService` 에 **의도적으로 잔류**시키면, 트래커가 "같은 구간"이라 부르는 두 자리는 **서로 다른 클래스**로 갈라진다 — 나중에 이 lost-update 를 고칠 사람은 advisory lock 이나 낙관적 버전 비교를 **두 provider 에 걸쳐** 조율해야 한다는 사실을 알아야 하는데, 그 사실이 어디에도 안 적힌다.
    (2) `:2213` 항목은 *"`setupChatChannel` 이 6~8가지 관심사를 한 함수에 담고 있다 … 처방: 앞쪽 절반을 `resolveChatChannelSecretWrites(...)` 로 분리"* — 처방 대상 파일이 `triggers.service.ts` 라고 전제한다. 이번 리팩터 후 그 함수는 새 파일/클래스로 이동하므로 처방 위치도 함께 이동해야 하는데, 계획의 체크리스트 항목 7 은 오직 *"chat-channel 도메인 규칙이 …"* 항목(3번째, 모듈 경계 항목)만 종결 대상으로 명시하고 이 두 항목은 언급하지 않는다.
  - 제안: 체크리스트 항목 7 을 "트래커 3개 항목(모듈 경계·동시 PATCH·관심사 분해) 중 모듈 경계만 종결, 나머지 둘은 새 파일 위치로 갱신"으로 넓히거나, 최소한 커밋/PR 본문에 두 항목이 참조하는 코드가 이동했다는 각주를 남겨 다음 사람이 옛 파일에서 헛수고하지 않게 한다.

- **[INFO]** `buildCallbackUrl` 이 T2(이동)와 `rotateBotToken`(잔류) 사이의 숨은 공유 의존성인데, 계획의 의존성 표에는 "T2 전용"처럼 등재돼 있다
  - target 위치: `impl-chat-channel-binder.md` §"실측 — 무엇이 옮겨질 수 있는지는 의존 방향이 정한다" 표(T2 행, `buildCallbackUrl` 열거)
  - 관련 plan: 없음(계획 자체 내부 정합성 — 다른 plan 과의 충돌은 아니지만 계획의 실측 표가 실제 코드와 어긋나는 지점이라 다음 라운드에 재부상할 소지가 있어 참고로 남긴다)
  - 상세: `buildCallbackUrl` 은 `triggers.service.ts:1642` 의 private 메서드이며, 실측상 호출자는 `setupChatChannel`(`:1130`, T2 대상) **뿐 아니라** `rotateBotToken`(`:1554`, "남기는 것"으로 명시된 메서드)도 포함한다. 계획 표는 이를 "T2 의 외부 `this.*` 의존 6개" 중 하나로만 적어 마치 T2 전용 의존인 것처럼 보이게 하는데, 실제로는 **잔류 메서드와 공유**되는 헬퍼다. 이 자체가 계획을 무효화하지는 않지만(13줄짜리 순수 헬퍼라 두 클래스에 복제해도 동작 보존은 유지 가능) — 계획이 세운 "T2 는 단언 무변경, 등록만 변경"이라는 증명 전략에는 어떤 처리(복제/공유 주입)를 택할지가 빠져 있어, 이번 PR 이 우려하는 "동작 델타" 판정 라운드에서 재부상할 가능성이 있다.
  - 제안: T1/T2 착수 전에 `buildCallbackUrl` 처리 방식(두 클래스에 복제 vs `TriggersService` 에 남기고 `ChatChannelBinderService` 가 그 값을 파라미터로 받음)을 계획 §설계 절에 한 문장 추가.

## 요약

`impl-chat-channel-binder.md` 는 spec 변경이 없는(`spec_impact: none`) 순수 리팩터이며, 자신이 참조하는 트래커 항목(모듈 경계, `#676` 순환 재발 위험)에 대해서는 이미 실측으로 방향을 정정해 둔 성실한 선행 확인을 갖추고 있다. 다만 같은 트래커에 걸려 있는 **다른 두 열린 항목**(동시 PATCH lost-update, `setupChatChannel` 관심사 분해)이 이번 리팩터로 위치가 이동하는데 계획이 이를 갱신 대상으로 포함하지 않았고, 더 구체적으로는 `spec/5-system/15-chat-channel.md` 의 `code:` frontmatter 가 **이미 3라운드 연속 관측된 미해소 gap**을 안고 있는 상태에서 이번 PR 이 신규 파일 2개를 더 추가해 그 gap 을 키운다. 둘 다 구현을 막을 CRITICAL 수준의 결정 충돌은 아니지만, 방치하면 "발견 → 등재 → 다음 PR 이 또 키움" 패턴이 반복돼 트래커/spec 증거 목록의 신뢰도를 깎는다.

## 위험도

MEDIUM
