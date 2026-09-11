# 문서화(Documentation) 리뷰 — details[].code 배선 + botToken MinLength + 메시지 상수화

## 발견사항

- **[WARNING]** `spec/5-system/15-chat-channel.md` 의 "배선 전 관측값" 안내 문구가 이 PR 로 stale 해지는데, 이 PR 은 그 파일을 갱신하지 않는다 (`spec_impact: none`)
  - 위치: `spec/5-system/15-chat-channel.md:375`(§5.4.1 "토큰 변경 (rotation)" 행), `:411-416`(§5.4.1.2), `:426`(§5.4.1.1 "회전 (rotation)" 행)
  - 상세: 세 자리 모두 동일한 패턴으로 *"`details[].code` 는 **현재** … 서비스 가드 갈래라 싣지 않는다 … 계약값은 `INVALID_FIELD` 다 … 배선은 뒤따르는 developer PR 이 한다. 그 PR 이 머지되기 전까지 이 문단은 '아직 안 실린다'를 서술할 뿐 '싣지 않기로 했다'가 아니다"* 라고 적혀 있다. 이 문구는 명시적으로 **"뒤따르는 developer PR"** — 즉 지금 이 PR — 이 머지되면 갱신되어야 함을 스스로 예고한 문장이다. 그런데 실제로 `triggers.service.ts` 의 diff 는 `botTokenRef`·`inboundSigningRef`·`inboundSigning`·`botToken`·`inboundSigningPlaintext`(5곳 모두, `inboundSigningPlaintext` 는 5개 하위 분기 전부) 서비스 가드 throw 자리에 `code: 'INVALID_FIELD'` 를 추가해, 정확히 이 문단이 "관측값"이라 부르던 상태(서비스 가드 갈래 = flat + `code` 없음)를 뒤집는다. 머지 후에는 "현재는 … 싣지 않는다"가 거짓이 되지만, 이번 diff 17개 파일 중 `spec/5-system/15-chat-channel.md` 는 포함되어 있지 않다.
  - 이번 턴의 `--impl-prep` consistency-check(`review/consistency/2026/09/11/10_28_52`, INFO #3 / plan_coherence)는 `chatChannel`/`provider` 필드가 §5.4.1 표·`2-trigger-list.md` 에 "미등재"라는 **다른** 트래커 항목만 짚었을 뿐, 이 세 곳의 "관측값 vs 계약값" 예고 문구 자체가 배선 완료로 stale 해진다는 점은 다루지 않았다 — 그래서 이 갭이 그물을 빠져나갔다.
  - 제안: (developer 는 `spec/` 을 자유롭게 못 고친다 — 이 문구를 쓴 것은 이 세션이 아니라 `#1315`/`#1316` planner 턴이므로 자기-반증형 소정정 5조건 중 조건 1(자신이 쓴 문장)이 성립하지 않는다) planner 턴으로 세 자리 모두 "관측값이었다 → 2026-09-11 이 PR 로 배선 완료, 두 갈래 모두 `code: 'INVALID_FIELD'`" 로 갱신. 그전까지는 이 PR 의 plan/커밋 본문에 "spec 의 이 세 문단은 아직 배선-전 상태를 서술한다 — 후속 planner 턴 필요"를 한 줄 남겨 다음 세션이 "예고문이 실제로 지켜졌는지" 검증 없이 넘어가지 않게 한다.

- **[WARNING]** 이번 PR 의 두 동작 변경(응답 payload 신규 `code` 키 15곳, `botToken` 빈 문자열 거부)이 `CHANGELOG.md` 에 기록되지 않았다
  - 위치: 저장소 루트 `CHANGELOG.md` (이번 diff 17개 파일에 미포함)
  - 상세: 이 저장소의 `CHANGELOG.md` 는 "선언과 구현이 어긋났다"류 항목을 `## Unreleased — …` 로 촘촘히 기록해 온 곳이다(예: `OpenAPI 선언과 TS 타입이 어긋난 9곳`, `AlertRuleDto.threshold 가 number 라고 했지만 wire 는 문자열이었다`, 바로 직전 커밋 `fad828884`). 이번 PR 의 item **C** — `@ApiProperty({ minLength: 1 })` 가 광고하는데 검증 체인에 `@MinLength` 이 없어 `botToken: ''` 가 통과하고 빈 시크릿이 먼저 저장되던 결함 — 은 정확히 이 장르에 속하고, item **A** 는 15곳의 에러 응답 payload 형태 변경(신규 `details[].code` 키)으로 API 소비자에게 보이는 wire 변경이다. 두 항목 모두 plan(`plan/in-progress/impl-details-code-wiring.md`)의 계획/체크리스트에 CHANGELOG 항목이 언급되지 않는다.
  - 제안: 저장소 관례를 따라 `## Unreleased — botToken 빈 문자열이 시크릿을 먼저 지우고 있었다 (+ details.code 배선)` 류 항목 추가를 검토. 이 저장소에 명문화된 강제 규칙은 없어(WARNING) 차단 사유는 아니다.

- **[INFO]** `chat-channel-config.dto.ts` 의 공개 Swagger JSDoc(`botTokenRef` 등)이 이번 PR 이후 두 층 모두에서 안정적 계약이 된 `details[].code` 를 언급하지 않는다
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:196-203` (`botTokenRef` JSDoc — `introspectComments` 로 공개 OpenAPI `description` 에 그대로 실리는 자리, 같은 파일 368-369행 주석 참고)
  - 상세: 이 JSDoc 은 "`details.field='chatChannel.botTokenRef'` — 비어있지 않은 값일 때. `null`/`''` 는 … flat `'botTokenRef'` 로 거부된다" 라고 두 갈래의 `field` shape 차이는 정확히 서술하지만, `code` 필드는 이전에도 이후에도 언급하지 않는다. 이 PR 이전에는 파이프 갈래만 `code` 를 실었으니 언급을 생략해도 그럴듯했지만, 이 PR 로 두 갈래 모두 `code: 'INVALID_FIELD'` 를 싣게 되어 이제는 "안정적으로 존재하는데 공개 문서에 없는 필드"가 된다. 사실을 틀리게 말하는 것은 아니라 WARNING 이 아니라 INFO.
  - 제안: 여유가 있을 때 "두 갈래 모두 `details[].code='INVALID_FIELD'` 를 함께 싣는다" 한 문장 추가.

- **[INFO]** `validatePasswordStrength` 독스트링이 이번에 추가된 `details[].code` 를 언급하지 않는다
  - 위치: `codebase/backend/src/common/utils/password.util.ts:53-56`
  - 상세: "정책에 위배되면 `BadRequestException`(VALIDATION_ERROR)을 던진다" 까지만 서술하고 `details` 배열 shape(`field`/`message`/`code`)은 원래도 서술 대상이 아니었다. 이 PR 이 `code` 를 추가했지만 독스트링 범위 밖이라 오류는 아니다 — 완전성 관점의 경미한 개선 여지.
  - 제안: 필요 시 "details 는 `{ field, message, code }` 를 싣는다" 한 줄 추가. 우선순위 낮음.

## 확인했으나 문제 없음 (양성 대조)

- `chat-channel-rejection-messages.const.ts` 신규 파일의 헤더 주석 — SoT 인용(`15-chat-channel.md` R-CC-21 · §5.4.1 "토큰 변경 (rotation)" 행)이 실측(`grep`)과 정확히 일치한다.
- `chat-channel-config.dto.ts` 의 `swagger.md:315` 정적 줄-번호 인용이 절 참조(`§3 주석/설명 톤` 취지)로 정정됐고, `codebase/` 전체에 `swagger.md:NNN` 류 잔존 인용이 0건임을 직접 grep 으로 재확인했다(plan 체크리스트의 주장과 일치).
- `password.util.spec.ts`·`trigger-dto-validation.spec.ts`·`triggers.service.spec.ts` 의 신규 테스트에 붙은 JSDoc 이 뮤테이션 근거(어떤 단언이 왜 뚫렸는지)까지 상세히 남아 있어, 왜 이 테스트가 필요한지 다음 사람이 코드만 보고 재구성할 필요가 없다 — 이 저장소가 반복 강조해 온 "GREEN 은 증거가 아니다" 원칙이 주석에도 반영됨.
- `plan/in-progress/impl-details-code-wiring.md` 체크리스트가 트래커 항목을 줄 번호(`L2237` 등)가 아니라 **인용 문구**로 지목한다 — consistency checker(`plan_coherence.md`)의 제안은 줄 번호 병기였지만, 발화한 대로 채택하지 않고 이 저장소가 이미 학습한 "`:NNN` 인용은 다음 편집에 깨진다" 교훈을 앞세운 것으로, 문서 위생 관점에서 오히려 더 나은 선택이다.
- e2e 스펙(`chat-channel-trigger-create.e2e-spec.ts`)에 추가된 인라인 주석이 "이 단언이 §5.3 규약의 유일한 실제 wire 증거"라는 근거를 명시해, 왜 굳이 5곳에 같은 주석을 반복했는지 설명한다.

## 요약

이번 PR 은 신규 코드에 대한 JSDoc·인라인 주석·plan 문서화 수준이 전반적으로 높다(특히 뮤테이션 근거·SoT 인용·문구 앵커링). 다만 두 가지 문서 드리프트가 남는다: (1) `spec/5-system/15-chat-channel.md` 세 곳이 "이 PR 이 머지되면 갱신돼야 한다"고 스스로 예고했던 "배선 전 관측값" 문구가 실제 배선 완료로 stale 해졌는데 이 PR 의 diff 에 그 spec 파일이 없어 갱신되지 않았고(WARNING, planner 턴 필요), (2) 저장소가 관례적으로 유지해 온 `CHANGELOG.md` 에 이번 두 동작 변경(응답 payload `code` 키 신설, `botToken` 빈 문자열 거부)이 기록되지 않았다(WARNING, 비강제). 그 외 DTO/유틸 독스트링의 `code` 필드 미언급은 완전성 수준의 INFO 로, 차단 사유는 아니다. README·설정 문서·예제 코드 갱신은 이번 변경 범위(내부 에러 코드 배선·검증 강화·상수화)에 새 기능/환경변수/엔드포인트가 없어 해당 없음으로 판단했다.

## 위험도

MEDIUM
