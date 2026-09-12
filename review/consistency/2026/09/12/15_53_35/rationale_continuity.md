# Rationale 연속성 검토 — spec/5-system/ (--impl-prep, chat-channel-rules-cleanup)

대상: `spec/5-system/15-chat-channel.md` (전문) + Rationale (R1~R9, R-K, R-CC-10~23) + 관련 spec
(`2-navigation/2-trigger-list.md`, `1-data-model.md`, `4-nodes/7-trigger/providers/*` 등)의
Rationale 발췌. 실행 컨텍스트로 `plan/in-progress/chat-channel-rules-cleanup.md` (developer 구조
정리 plan, `spec_impact: none`)와 현재 `codebase/backend/src/modules/triggers/`
(`chat-channel-input-rules.ts` / `chat-channel-rejection-messages.const.ts` /
`dto/chat-channel-config.dto.ts` / `triggers.controller.ts`)를 대조했다.

## 발견사항

- **[WARNING]** `rotateBotToken` swagger 응답 DTO 신설 시 R-CC-22 가 고친 누락이 4번째로 재발할 수 있다
  - target 위치: `plan/in-progress/chat-channel-rules-cleanup.md` 「작업 #6」(`triggers.controller.ts` —
    `@ApiNotFoundResponse` + `@ApiOkWrappedResponse` 추가)
  - 과거 결정 출처: `spec/5-system/15-chat-channel.md` `## Rationale` §R-CC-22
    (`triggers/` 안의 chat-channel 구현 경로를 `code:` 에서 glob 으로 잡는다)
  - 상세: R-CC-22 는 "이 모듈은 파일이 계속 늘어난다 — 증가가 예정된 집합은 열거가 아니라
    술어로 잡는다" 는 원칙 아래, frontmatter `code:` 를 `codebase/backend/src/modules/triggers/dto/
    chat-channel-*.dto.ts` 글롭으로 좁혔다(근거: `#1317`·`#1319`·`#1320` 세 번 연속 신규 파일
    누락). 그런데 `rotateBotToken` 의 응답 shape(`{ rotatedAt, triggerId, chatChannelHealth,
    botIdentity }`, `triggers.service.ts:985` 인라인 타입)에 대응하는 DTO 클래스가 현재
    저장소에 **존재하지 않는다** (실측: `dto/` 안에 `chat-channel-config.dto.ts` 만 해당 필드를
    부분적으로 가짐, `dto/responses/trigger-response.dto.ts` 는 `chatChannelHealth` 만 있고
    `botIdentity`/`rotatedAt` 조합은 없음 — 둘 다 `code:` 글롭 밖). `@ApiOkWrappedResponse(Dto)`
    관례([`conventions/swagger.md` §"단일 객체 200 OK"])를 따르려면 새 DTO 클래스가 필요한데,
    `chat-channel-` 접두 없이 새 파일(예: `dto/responses/rotate-bot-token-response.dto.ts`)로
    만들면 기존 세 glob(`chat-channel-*.ts` / `chat-channel-*.dto.ts` / `trigger-callback-url*.ts`)
    중 어느 것도 매칭하지 못해 `review_guard` 의 spec-linked 판정에서 빠진다 — R-CC-22 가
    "다시는 안 나게" 고친 바로 그 실패 형태(파일이 `code:` 밖 → `--impl-done` 요구 자체가
    발동하지 않음)가 이번엔 **DTO 층**에서 재현된다. plan 자체는 `spec_impact: none` 이라
    frontmatter 를 developer 가 넓힐 권한도 없다(그 예외는 §자기-반증형 소정정 5조건에도
    해당 안 됨 — 예고 문장의 정정이 아니라 신규 표면 추가이므로).
  - 제안: 새 DTO 가 필요하면 (a) 기존 `chat-channel-config.dto.ts` 안에 클래스를 추가하거나
    (b) 파일을 분리해야 한다면 이름을 `chat-channel-` 접두로 시작(`chat-channel-rotate-token-
    response.dto.ts` 등)해 기존 glob 이 자동으로 덮게 한다. 접두를 못 지키는 사정이 있다면
    developer 는 착수 전에 `ESCALATE=spec` 로 planner 턴을 태워 frontmatter `code:` 항목을
    같이 넓혀야 한다 — R-CC-22 가 이미 "신규 파일은 사람이 안 챙긴다" 고 실측으로 못박은
    자리이므로, 이번만 예외로 믿고 진행하면 같은 결함이 4번째로 반복된다.

- **[INFO]** R-CC-23 의 "구현 정정은 developer 후속이다" 서술이 이미 완료된 상태를 반영하지 못함
  - target 위치: `spec/5-system/15-chat-channel.md` `## Rationale` §R-CC-23 하단
    ("같은 턴에 고친 두 번째 사실… 구현 정정은 developer 후속이다")
  - 과거 결정 출처: 동일 문서 §R-CC-23 (2026-09-12 결정, §5.4 를 400→502 로 실제 구현 정정 예고)
  - 상세: 이 문장은 "§5.4 는 502 라 적었지만 구현은 두 분기 모두 400 을 돌려줬다 — 구현 정정은
    developer 후속" 이라고 **미래형**으로 서술한다. 그런데 같은 날짜대의 커밋
    `8964a7114`(docs) → `e4e259530`(feat, `setupChannel 실패를 code 로 선언하고 502 를 실현`)
    이 이미 그 후속을 완료했고, 코드도 그렇게 동작한다(`chat-channel-input-rules.ts`
    `translateSetupChannelError` 가 `BadGatewayException` 반환, `triggers.controller.ts` 에
    `@ApiBadGatewayResponse` 존재 확인됨). 결정 자체가 번복된 것은 아니고 오히려 이행됐으므로
    Rationale 내용과 모순은 아니지만, "developer 후속이다" 라는 현재형처럼 읽히는 서술이 이미
    지나간 일이라는 점에서 다음 독자가 "아직 안 됐다" 로 오독할 여지가 있다.
  - 제안: 차단 사항 아님 — 이번 plan 은 `spec_impact: none` 이라 이 문서를 건드릴 필요가 없다.
    다음에 이 spec 을 만지는 planner 턴에서 "(완료: `e4e259530`)" 주석 한 줄만 추가하면 충분하다.

## 확인했으나 문제 없음 (근거만 기록)

- `throwInvalidField(field, message)` 로 3번째 `code` 인자를 두지 않는 plan 의 설계 판단은
  `chat-channel-input-rules.ts` 실측(11개 throw 지점 전부 `details.code: ErrorCode.INVALID_FIELD`)
  및 `2-api-convention.md §5.3`/`#1317` 배선("field 를 실으면 code 도 싣는다")과 정합 — 새 Rationale
  이 필요 없는 순수 리팩터.
- plan 설계 판단 (2) "파일을 쪼개지 않는다 — §7 파일 트리는 planner 축" 은 R6(`conventions/
  chat-channel-adapter.md` 의 3분할 구조)과 §7 안내문("code: 는 기계 술어, 트리는 사람이 읽는
  열거… 새 파일은 손으로 채워야")을 정확히 인용해 자기 경계를 지키고 있다 — 위반 아님.
- plan 설계 판단 (3) "`incoming.provider &&` falsy-guard 를 도달 불가로 실측하고도 남긴다" 는
  `assertChatChannelAlreadySetUp` 의 실제 메시지("provider 는 PATCH 로 바꿀 수 없어요")가
  DTO 우회 호출자에게 거짓 정보를 주지 않기 위한 방어이며, 새 결정이 아니라 `R-CC-21`/
  `2-trigger-list.md R-12`(provider 변경 금지)의 기존 결론을 실제 도달 경로까지 정직하게
  넓히는 것 — 번복 아님.
- `chat-channel-rejection-messages.const.ts`/`dto/chat-channel-config.dto.ts` 의 stale
  `TriggersService` 귀속 주석 3곳 정정은 실제 이동 이력(`#1319`/`#1320`, R-CC-22 본문이 그
  이동을 직접 서술)과 일치하는 사실 정정이며 새 결정이 아니다.

## 요약

이번 turn 이 계획한 리팩터(헬퍼 추출·주석 정정·테스트 보강)는 spec 을 건드리지 않고
(`spec_impact: none`) 응답 형태·에러 코드·검증 순서를 한 바이트도 바꾸지 않는 순수 구조 정리로,
설계 판단 세 가지 모두 관련 Rationale(R-CC-21, R6, R-CC-10/R-12)을 인용하며 스스로 경계를
지키고 있어 기각된 대안의 재도입이나 무근거 번복은 발견되지 않았다. 유일한 실질 위험은
작업 #6(swagger 응답 문서화)이 새 DTO 파일을 만들 경우 R-CC-22 가 세 번의 실측 끝에 확정한
"신규 파일은 `chat-channel-` 접두 glob 으로만 자동 포착된다" 는 불변식을 몰이해하게 깨뜨려
같은 결함 클래스를 4번째로 재발시킬 수 있다는 점이다 — 착수 전 파일명 선택으로 예방 가능하며
그 외에는 CRITICAL 급 위반이 없다.

## 위험도
LOW
