# Plan 정합성 검토 — spec/5-system (chatChannel PATCH 비밀 차단, impl-chat-channel-patch-token)

## 검토 범위 요약

- target: `spec/5-system` (이번 diff 의 spec 델타는 0개 파일 — 코드 전용 PR, 정상)
- 구현 diff: 7 파일 / 1414줄 (`chat-channel-config.dto.ts` · `update-trigger.dto.ts` ·
  `triggers.controller.ts` · `triggers.service.ts` · 관련 spec/e2e 3종)
- 이 diff 의 목적: `plan/in-progress/spec-draft-nullable-notation-followups.md` 가 등재한 두
  CRITICAL(① chatChannel PATCH 의 bot-token single-path 우회, ② `ChatChannelCard` 편집-저장
  상시 400)을 `plan/complete/spec-draft-chat-channel-patch-token.md` 의 D-1/D-2/D-3 설계로 닫는
  `plan/in-progress/impl-chat-channel-patch-token.md` 의 구현.

## 발견사항

- **[WARNING]** 후속 plan(`spec-draft-nullable-notation-followups.md`)의 두 CRITICAL 항목이
  구현으로 해소됐는데 체크박스가 아직 미체크
  - target 위치: (spec 변경 없음 — 코드 diff `triggers.service.ts` `assertPatchCarriesNoSecrets` /
    `ChatChannelUpdateConfigDto` / canary `trigger-workflow-ref.e2e-spec.ts` case E)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:1894`
    (`CRITICAL: chatChannel PATCH 가 bot token single-path 를 우회한다`) 및 `:1991`
    (`버그: ChatChannelCard 편집-저장이 항상 400 이다`) — 둘 다 여전히 `- [ ]`.
  - 상세: `impl-chat-channel-patch-token.md` 는 "무엇을 닫는가" 절에서 이 두 CRITICAL 을 명시적
    목표로 선언했고, 구현·테스트·리뷰(`/ai-review` CRITICAL 1/WARNING 6 전부 조치)가 체크리스트
    상 완료로 표시돼 있다. diff 도 실제로 두 항목을 해소하는 형태다 — `ChatChannelUpdateConfigDto`
    (`@IsEmpty` on `botToken`/`inboundSigningPlaintext`)가 `ChatChannelCard` 가 실제로 보내는
    바디(`{provider, uiMapping, rateLimitPerMinute, languageLocale}`)를 통과시키도록 만들고,
    `trigger-dto-validation.spec.ts` 의 `cardBody()` 기반 3-provider 양성 테스트가 그것을 확인한다.
    `trigger-workflow-ref.e2e-spec.ts` case E docstring 도 "이 바디가 200 이 되는 것 자체가 두
    CRITICAL 이 닫혔다는 신호" 라고 스스로 적는다. 그런데 정작 그 결함을 최초 등재한
    `spec-draft-nullable-notation-followups.md` 쪽 체크박스는 갱신되지 않았다 — 다음 세션이 그
    파일만 보면 "아직 열린 CRITICAL" 로 오판해 중복 조사에 들어갈 위험이 있다(memory
    `feedback_plan_checkbox_actual_state`: 체크박스 = 실제 상태, 체크와 정리는 한 동작이어야 함).
  - 제안: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 두 항목을 이 구현
    완료(및 이 `--impl-done` 통과)에 맞춰 체크 처리하고 `impl-chat-channel-patch-token.md` 로
    교차 링크한다. `impl-chat-channel-patch-token.md` 자체의 체크리스트도 마지막 항목
    (`/consistency-check --impl-done`)이 이 리뷰로 닫히면 마무리 커밋에서 함께 갱신할 것.

- **[INFO]** PATCH 로 `chatChannel` 최초 부착 차단 + provider 변경 차단이 §5.4.1 표에 명시 행 없이 신설
  - target 위치: `spec/5-system/15-chat-channel.md` §5.4.1 (표 1행 "최초 트리거 생성" 만 서술,
    "기존 webhook 트리거에 PATCH 로 chatChannel 을 처음 붙이는 경우"에 대한 행 없음)
  - 관련 plan: `plan/in-progress/impl-chat-channel-patch-token.md` (D-2 설계) — 코드:
    `triggers.service.ts` 신설 `assertChatChannelAlreadySetUp` (`chatChannel` 미보유 트리거의
    PATCH 는 400 `VALIDATION_ERROR(field='chatChannel')`, provider 전환 시도는 400
    `field='provider'`).
  - 상세: 이 차단은 D-1(PATCH 가 비밀을 못 나른다)의 구조적 귀결이자 `2-trigger-list.md` `R-12`
    ("provider 변경은 삭제·재생성")의 기존 정책을 정합하게 강제하는 것으로, diff 코드 주석도 그
    근거를 정확히 인용한다 — 새로운 독자적 product 결정이 아니라 이미 결정된 두 규칙(D-1 구조적
    필연 + 기존 R-12)의 조합으로 도출됐다. 다만 이 동작 자체는 §5.4.1 표에 정식 행으로 등재돼
    있지 않아, 표만 읽는 다음 사람은 "PATCH 로 최초 chatChannel 부착이 가능한가"를 판단할 근거가
    없다. `spec_impact: none` 선언과 이번 diff 의 spec 델타 0 은 일관되지만(발동 조건이 이미 결정된
    두 규칙의 파생이라 신규 결정이 아니라는 판단), 표 자체에는 이 파생을 반영하는 각주/행이
    없어 spec 문면이 구현 뒤로 처진다.
  - 제안: 별도 CRITICAL 은 아님(신규 결정이 아니라 기존 결정의 결과) — planner 후속으로
    §5.4.1 표에 "chatChannel 최초 부착(기존 webhook 트리거에 PATCH 로) — 400, 생성 POST 전용"
    행과 "provider 전환 — 400, R-12 delete·recreate" 각주를 추가하는 것을 권장. 급하지 않으므로
    `spec-draft-nullable-notation-followups.md` 또는 그 후속 트래커에 항목으로만 남겨도 충분.

## 정합성이 확인된 항목 (참고 — 문제 아님)

- `spec-draft-nullable-notation-followups.md:2046` 의 "§5.4.1 표 2행(활성화 PATCH 의 setupChannel
  재호출)이 구현과 어긋날 수 있다" 미확정 항목은 target 스스로가 §5.4.1 표 안에 **동일 문구로
  인라인 콜아웃**을 이미 달아 두었고(정확한 plan 파일명 교차 참조 포함), 이번 diff 는 그 행을
  건드리지 않는다(`D-2` 가 그 불확실성 때문에 이 행을 선례로 인용하지 않음을 plan 이 명시) —
  선행 미해결 사안을 정확히 유예 상태로 유지한 사례.
- `details.field` nested-path 실측(`chatChannel.<field>` 5필드 전수)이 이번 diff 의 유닛 테스트
  (`trigger-dto-validation.spec.ts` `[실측]` 케이스)로 확정됐지만, target §5.4.1/§5.4.1.1 의
  "미확정 — 후속 e2e 확인 대기" placeholder 는 그대로 두었다 — spec 갱신은 developer 권한 밖이라
  planner 후속으로 명시적으로 넘겼고(`impl-chat-channel-patch-token.md` "이 턴에 실측해 planner
  로 넘길 것"), spec_impact: none 과 일치.
- R-CC-21 의 "PATCH 는 비밀을 쓰지 않는다"는 산문이 telegram server-issued 축까지 과확장해
  읽힐 위험은 target 자체에 2026-09-10 caveat 로 이미 반영돼 있고(플래너 PR #1313, `plan/complete/
  spec-draft-telegram-signing-carveout.md`), 이번 diff 의 `storeUserSuppliedSecrets` 게이팅도
  세 번째 쓰기 지점(telegram `issuedInboundSigning`)을 명시적으로 무조건 유지해 그 caveat 와
  정합한다.
- canary e2e (`trigger-workflow-ref.e2e-spec.ts` case E) 의 낡은 "이 바디는 판정된 결함을 재현한다"
  경고 블록은 plan 이 "결함이 닫히면 정리 대상"이라 명시한 대로 이번 diff 에서 해소 기록으로
  교체됐다 — 후속 누락 없음.
- Discord/Slack/SSR v2 백로그 plan(`chat-channel-discord-gateway.md` 등, 전부 `status: backlog`,
  진입 조건에 "사용자 결정 필요" 명시)은 이번 PATCH-token 수정과 무관한 축이라 영향 없음.
- 두 상위 planner 결정 plan(`spec-draft-chat-channel-patch-token.md`,
  `spec-draft-telegram-signing-carveout.md`)은 이미 `plan/complete/` 로 이동돼 있어, 이번 developer
  구현이 아직 열린 planner 결정을 우회하는 형태가 아니다.

## 요약

이번 diff 는 `spec-draft-nullable-notation-followups.md` 가 등재한 두 CRITICAL 을 완료된 planner
결정(D-1/D-2/D-3, `plan/complete/spec-draft-chat-channel-patch-token.md`)대로 정확히 구현했고,
선행 미해결 사안(§5.4.1 표 2행 등)은 건드리지 않고 유예 상태를 유지했으며, telegram carve-out 등
인접 planner 결정과도 정합한다 — 새로 검토가 필요한 "미해결 결정 우회"는 발견되지 않았다. 다만
그 CRITICAL 들을 최초 등재한 followups plan 의 체크박스가 아직 갱신되지 않아 상태 드리프트
위험(WARNING)이 있고, PATCH 최초-부착/provider 전환 차단이라는 파생 규칙이 §5.4.1 표에 명시
행으로 반영되지 않은 문서 갭(INFO)이 남아 있다. 둘 다 이 PR 을 막을 사유는 아니며 마무리 커밋·
planner 후속 턴에서 처리하면 된다.

## 위험도

LOW
