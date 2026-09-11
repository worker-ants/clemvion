# Rationale 연속성 검토 — spec/5-system/ (--impl-prep, T2: chat-channel-binder 추출)

## 컨텍스트 요약

검토 시점의 실제 작업은 `plan/in-progress/impl-chat-channel-binder-t2.md` (T2) —
`TriggersService.setupChatChannel` / `teardownChatChannel` (secret 쓰기 + ref 보존 로직, 외부
`this.*` 6개 의존)을 신규 `modules/triggers/chat-channel-binder.service.ts`
(`ChatChannelBinderService`, `triggers/` 모듈 내부)로 옮기고, `buildCallbackUrl` 은 순수 함수
`trigger-callback-url.ts` 로 분리하는 **순수 코드 이동**(`spec_impact: none`, 동작 보존 주장)이다.
프롬프트 번들은 `spec/5-system/15-chat-channel.md` 본문이 예산 초과로 생략되어 있어, 대상 spec
파일과 `spec/conventions/`·`spec/data-flow/` 의 직접 연관 파일을 `Read`로 직접 열어 확인했다.

이 턴은 같은 트래커의 직전 완료 작업 `plan/complete/impl-chat-channel-binder.md` (T1)의 **직접
후속(이월분)**이다. T1은 `--impl-prep`(`14_59_33`, BLOCK: NO)에서 정확히 이 이동이 만들 결과를
실측해 두었으므로, 아래 발견사항은 T1이 세운 처리 원칙과 T2가 얼마나 정합한지를 본다.

## 발견사항

- **[WARNING] `setupChatChannel` 이동이 만드는 spec SoT 포인터 stale 화를 T2 plan 이 다루지 않는다**
  - target 위치: `plan/in-progress/impl-chat-channel-binder-t2.md` 전체 (특히 "체크리스트" 섹션 —
    spec 귀속 갱신/등재 항목이 없다). 계획대로면 `setupChatChannel`이
    `codebase/backend/src/modules/triggers/triggers.service.ts` 밖, 신규
    `chat-channel-binder.service.ts` 의 `ChatChannelBinderService` 로 이동한다.
  - 과거 결정 출처: `plan/complete/impl-chat-channel-binder.md`(T1, 동일 트래커, `owner: developer`)
    의 "실측 — 무엇이 옮겨질 수 있는지는 의존 방향이 정한다" 절 + "`--impl-prep` 이 설계를
    바꿨다" 절. T1 은 `--impl-prep`(`14_59_33`) WARNING 1·2 를 받아 **"이동이 spec 의 귀속
    서술을 stale 하게 만드는데 developer 는 `spec/` 쓰기 권한이 없다"** 는 원칙을 확정하고,
    이동 대상 심볼마다 spec 귀속 위치를 전수 실측했다. 그 표에 `setupChatChannel` 은
    **"9곳"**(`15-chat-channel.md` 2 · `secret-store.md` 3 · `chat-channel-adapter.md:369` ·
    `data-flow/14-chat-channel.md` 3)으로 명시돼 있고, T1 자신은 이 심볼을 옮기지 않으므로
    "이 PR 이 안 옮긴다 → 영향 없음" 으로 스스로 면제했다 — 즉 **"실제로 옮기는 PR(T2)이 이
    stale 화를 처리해야 한다"** 는 전제가 T1 문서 안에 이미 깔려 있다.
  - 상세: 실제 파일을 열어 9곳 중 최소 **3곳**이 함수명이 아니라 **클래스/파일 경로로 특정된
    SoT 포인터**임을 확인했다 — 이동 후 문자 그대로 거짓이 된다.
    - `spec/conventions/chat-channel-adapter.md:369` — *"caller
      (`TriggersService.setupChatChannel`) 가 즉시 `SecretResolver.rotate(...)` 로 보관"* —
      클래스 한정 표기.
    - `spec/data-flow/14-chat-channel.md:29` — *"`codebase/backend/src/modules/triggers/
      triggers.service.ts` — `setupChatChannel` / `rotateBotToken` /
      `cleanupRotatedChatChannelTokens`"* — 파일 경로 귀속 목록.
    - `spec/conventions/secret-store.md:146` — *"`triggers.service.ts.setupChatChannel`
      구현체 모두 `rotate()` 사용"* — 파일.메서드 점 표기.
    나머지 6곳(`15-chat-channel.md:432,801`, `data-flow/14-chat-channel.md:139,150`,
    `secret-store.md` 의 예시 코드 2곳)은 함수명만 인용하거나 예시 pseudocode 라 이동 후에도
    "실질은 참"으로 남는다 — T1이 `assertInboundSigningPlaintextByProvider`(5곳 중 2곳만 stale)
    에 적용한 것과 **같은 판정 패턴**이다.
    T2 plan 은 이 3곳을 언급하지 않고, `spec_impact: none`(이 자체는 T1 선례상 정당 — "편집하지
    않는 파일을 `spec_impact` 에 적으면 목록이 거짓" 원칙과 일치)이라고만 적은 뒤 durable
    tracker(`plan/in-progress/spec-draft-nullable-notation-followups.md`) 등재 계획을 체크리스트에
    두지 않았다. 실제로 해당 트래커 항목(§2270-2308, T1이 직접 갱신한 자리)을 열어봐도 T2가
    만들 이 3곳의 stale 화는 아직 기록돼 있지 않다.
  - 제안: T2 완료 커밋(또는 착수 전 plan 갱신)에서 위 3곳을 T1 이 `assertInboundSigningPlaintextByProvider`
    에 했던 것과 동일한 방식으로 처리한다 — (a) 전수 재실측(이동 후 실제 코드 위치)
    (b) `spec-draft-nullable-notation-followups.md` 의 "chat-channel 도메인 규칙이…" 항목(§2270)에
    `setupChatChannel` 이동으로 새로 stale 해진 3개 포인터를 명시적으로 추가 등재
    (c) `spec_impact: none` 은 그대로 두되 체크리스트에 "spec 귀속 drift 등재" 항목을 넣어
    누락을 방지. 이는 새 spec 결정을 요구하지 않으며, T1이 이미 세운 절차를 반복 적용하는 것뿐이다.

- **[INFO] `spec/5-system/15-chat-channel.md` §7 "구현 파일 구조" 다이어그램이 이동 후 stale 해진다 (본문, Rationale 아님 — 경계 참고용)**
  - target 위치: 위와 동일 (T2 plan 전체).
  - 과거 결정 출처: `spec/5-system/15-chat-channel.md` §7 (Rationale 절 밖의 본문 섹션) —
    `triggers/` 하위 파일 목록에 `triggers.service.ts`(`# 기존 — setupChannel / teardownChannel /
    rotateBotToken 호출 추가`) 만 있고 `chat-channel-binder.service.ts`,
    `trigger-callback-url.ts` 는 없다. 다만 이 절 자체가 "C-2: chat-channel 에서 이전" 같은
    파일 단위 이력 주석을 이미 담고 있어 **파일 신설/이동을 반영하는 관례**가 문서 안에
    선례로 있다(`chat-channel-token-rotator.service.ts` 도 그렇게 등재됨).
  - 상세: 이 절은 `## Rationale` 이 아니라 본문(§7)이라 이 checker의 엄격한 스코프(spec의
    `## Rationale`) 밖일 수 있다 — 다른 구조/코드-동기화 검토자가 이미 다루고 있을 가능성이
    높다. 다만 T2가 만든 두 신규 파일이 이 다이어그램에 반영되지 않으면 "C-2" 처럼 향후
    독자가 파일 지도를 신뢰할 때 낡은 상태로 남는다.
  - 제안: 위 WARNING 항목과 같은 트래커 등재에 §7 다이어그램 갱신도 함께 묶어 후속 planner
    턴에서 처리하도록 명시. 이 턴에서 developer 가 직접 고칠 필요는 없다(자기-반증형
    소정정 5조건 미충족 — 이 문장은 developer 가 쓴 것이 아니다).

## 검토 통과 항목 (참고 — Rationale 정합이 확인된 지점)

- **R-CC-21 "PATCH 는 비밀을 쓰지 않는다"**: T2 plan 의 뮤테이션 대상(`storeUserSuppliedSecrets`
  게이팅 / `inboundSigningRefSurvives` 술어 / 실패 경로 `fallbackConfig`)이 R-CC-21 이 지킨 세
  invariant 와 정확히 일치한다. R-CC-21 이 명시적으로 기각한 대안(`SecretResolver.rotate` 에 빈
  값 가드 추가, `botToken` optional 처리 후 침묵 무시)은 T2 plan 어디에도 재도입되지 않는다.
- **모듈 경계 (R2/R8 및 §7 C-2 선례)**: `ChatChannelBinderService` 를 `chat-channel/` 이 아니라
  `triggers/` 안에 두는 결정은 `#676`(`e827ed2a7`, chat-channel↔triggers `forwardRef` 순환 제거)
  선례 및 §7 의 "C-2" 이관 이력과 같은 방향이다 — `chat-channel/` 로 옮기면 끊어 둔 순환이
  되살아난다는 점을 T1/T2 plan 모두 실측으로 확인했다.
- **`buildCallbackUrl` 순수 함수 분리 결정**: 기각한 대안 3가지(binder 가 public 소유 / 호출자
  인자 전달 / 양쪽 private 사본)에 각각 반증 가능한 근거를 붙였고, 어느 것도 기존 spec
  Rationale 의 원칙과 충돌하지 않는다(SoT 단일화 — R-CC-21 의 "SoT 를 둘로 쪼갠다" 기각
  패턴과 동일 정신).

## 요약

핵심 대상 파일(`spec/5-system/15-chat-channel.md`)의 `## Rationale`(R1~R9, R-CC-10~21) 자체에
대해서는 T2 계획이 기각된 대안을 재도입하거나 invariant를 우회하는 지점이 없다 — 오히려
R-CC-21의 세 가지 보호 invariant를 뮤테이션 테스트로 재확인하도록 설계되어 있어 continuity가
양호하다. 유일하게 남는 간극은 Rationale 절이 아니라 spec 본문의 SoT 코드-포인터
(`chat-channel-adapter.md:369`, `data-flow/14-chat-channel.md:29`, `secret-store.md:146`)이며,
이 간극은 정확히 직전 완료 작업(T1)이 스스로 실측하고 "다음 이동 PR이 처리해야 한다"고 암묵적으로
넘긴 것을 T2 plan이 아직 인수하지 않은 상태다. 새로운 spec 결정이 필요한 문제는 아니며, T1이
이미 쓴 절차(전수 재실측 + durable tracker 등재)를 그대로 반복 적용하면 해소된다.

## 위험도

LOW
