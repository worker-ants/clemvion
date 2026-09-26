# 정식 규약 준수 검토 — rotate-bot-token-body (--impl-prep)

검토 대상: `plan/in-progress/rotate-bot-token-body.md` (요청 본문 스키마가 없는 라우트 3곳에
문서 전용 DTO + `@ApiBody` 추가) 및 그 착수 전 scope 로 묶인 `spec/5-system/15-chat-channel.md`
(주 target) + `spec/conventions/swagger.md` 등.

번들이 컨텍스트 예산으로 절단된 4개 파일(`2-trigger-list.md`·`3-execution.md`·`12-webhook.md`·
`13-replay-rerun.md`)과 실제 컨트롤러(`triggers.controller.ts`·`hooks.controller.ts`)·기존 DTO
선례(`execute-workflow.dto.ts`·`chat-channel-config.dto.ts`)는 절대경로로 직접 Read 해 대조했다.

## 발견사항

- **[WARNING]** `newBotToken` 요청 필드에 `writeOnly: true` 누락 위험
  - target 위치: `plan/in-progress/rotate-bot-token-body.md` §실측 표 (`ChatChannelRotateBotTokenRequestDto`
    행) / 대응 계약은 `spec/5-system/15-chat-channel.md` §5.4 "요청 (body)" (`newBotToken`)
  - 위반 규약: `spec/conventions/swagger.md` §1-5 — "**의무**: secret store 입력 plaintext
    (e.g. `botToken`, `inboundSigningPlaintext`) 필드는 항상 `writeOnly: true` 동반"
  - 상세: `newBotToken` 은 `SecretResolver.rotate()` 로 secret store 에 저장되는 bot token
    plaintext 로, §1-5 가 예시로 든 카테고리(`botToken`)와 정확히 같은 자원이다. 같은 모듈의
    `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts` 는 `botToken` ·
    `inboundSigningPlaintext` · 그 blocked-field 변형까지 **전부** `writeOnly: true` 를
    붙여 이 의무를 지키고 있다(라인 185, 288, 394, 408). 그런데 plan 문서·실측 표 어디에도
    `writeOnly` 언급이 없다. 신규 DTO 가 request-only 클래스라 응답 스키마에서 실제로 제외될
    필드가 없어 **시각적 효과가 없어 보이지만**, §1-5 문면은 "필드는 항상 writeOnly 동반"이라
    적어 클래스가 request 전용인지 여부로 예외를 두지 않는다.
  - 제안: `ChatChannelRotateBotTokenRequestDto.newBotToken` 의 `@ApiProperty`(Optional) 에
    `writeOnly: true` 를 명시. 캐너리(모듈별 3종 중 하나)에 "필드가 writeOnly 를 선언한다"는
    assertion 을 추가하면 `chat-channel-config.dto.ts` 와 같은 층에서 검증된다. 만약 request-only
    클래스는 의도적으로 면제한다고 판단하면, 그 판단 자체를 §1-5 본문에 "request-only DTO 는
    예외"로 명시하는 편집을 함께 고려(현재는 그런 범위 제한이 규약에 없다).

- **[WARNING]** 선례(`ExecuteWorkflowDto`)의 class-level JSDoc 내부 서사를 그대로 복제하면
  swagger.md §3 위반 표면이 1곳 → 3곳으로 확대
  - target 위치: `plan/in-progress/rotate-bot-token-body.md` §방향 — "`workflows.execute`
    선례(`ExecuteWorkflowDto`)를 그대로 따른다"
  - 위반 규약: `spec/conventions/swagger.md` §3 — "JSDoc 은 공개 OpenAPI 로 나간다 — 내부
    서사를 담지 않는다"(정정 경위·리뷰 참조·"왜 이렇게 바꿨는지"는 `/** */` 가 아니라 바로 위
    `//` 주석에 적는다)
  - 상세: `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts` 의 class JSDoc
    `/** ... */` 는 "왜 `@Body()` 파라미터 타입이 아닌가"에 대한 설계 결정·두 갈래 비교 표·
    캐너리 파일명(`workflows-execute-body.spec.ts`)까지 담은 긴 내부 서사이며, `nest-cli.json`
    의 `introspectComments: true` 플러그인 아래에서 이 전문이 그대로 공개 OpenAPI
    `description` 이 된다(`swagger.md §3` 자신의 서술 · `dto-jsdoc-citation-guard` 가 전제하는
    사실과 동일). plan 이 이 패턴을 "그대로" 따르라고 명시하므로, `ChatChannelRotateBotTokenRequestDto`
    /`ContinueExecutionRequestDto` 에도 같은 형태(설계 결정 서사가 `/** */` 안)가 복제될 위험이
    있다. 이 gap — §3 규칙이 필드 JSDoc과 클래스 JSDoc을 명시적으로 가르지 않는다는 점 —은 이미
    `plan/in-progress/spec-draft-nullable-notation-followups.md` (라인 1258~1281, `Ref` DTO
    클래스 JSDoc 리뷰 인용 잔존 항목)에 open item 으로 등재된 알려진 리스크다. 현재 자동 가드
    (`dto-jsdoc-citation-guard`)는 `dto/responses/**` 만 스캔하고 "리뷰 인용" 패턴만 잡아,
    `dto/` 최상위의 `execute-workflow.dto.ts` 류나 "인용은 아니지만 내부 서사인" 설계-결정 산문은
    범위 밖이다 — 자동 회귀 가드가 이 두 신규 파일도 잡아주지 않는다.
  - 제안: 새 DTO 의 class `/** */` 에는 "이 요청 본문이 무엇인지"만 소비자 관점으로 남기고,
    "왜 `@Body()` 타입이 아닌지"의 설계 결정·비교 표·캐너리 참조는 바로 위 `//` 라인 주석으로
    옮길 것. 혹은 이번 PR 에서 `spec-draft-nullable-notation-followups.md` 의 해당 open item(§3
    표가 필드/클래스를 가르는지)을 함께 결정해 규약 문서에 명문화.

- **[INFO]** `*RequestDto` 접미사 명명이 swagger.md 본문에 명시적으로 규약화돼 있지 않음
  - target 위치: `plan/in-progress/rotate-bot-token-body.md` §실측 표 —
    `ChatChannelRotateBotTokenRequestDto` · `ContinueExecutionRequestDto`
  - 위반 규약: `spec/conventions/swagger.md` §1-7 (요청 DTO 명명 규약)은 `Update<Entity>Dto`
    접두만 표로 다루고, action 전용 요청 바디의 `<Domain><Action>RequestDto` 형태는 규약 문서에
    없다. 저장소에는 `AssistantMessageRequestDto`·`ReRunRequestDto`·`EmailChangeRequestDto`
    선례가 있어 사실상 관례이므로 plan 의 명명 자체는 기존 코드베이스와 **일치**하고 위반은
    아니다.
  - 상세: 다만 §1-7 은 스스로 "규칙에 범위를 함께 적습니다 — 접두 집합과 로컬-패턴 집합 중
    어디에 거는지를 적지 않으면 오독이 반복됩니다"라고 명시하는데, `Request` 접미사 관례는 그
    표에 없어 다음 사람이 "top-level 요청 바디는 `Update` 접두가 전부"로 오독할 여지가 있다.
    plan 자체도 §48 에서 "swagger.md 에 요청 본문 규칙이 없다(§1-7 은 이름만)"고 이미 인지하고
    있어 새로 발견한 사실은 아니다.
  - 제안: 이번 PR 범위는 아니나, plan 이 이미 등재하기로 한 "전역 가드 후속" 트래커 항목에
    "§1-7 표에 `<Domain><Action>RequestDto` 행 추가"를 함께 묶는 것을 고려(planner 턴).

## 요약

`15-chat-channel.md` 자체는 Overview/본문(§1~8)/Rationale 3섹션 구조, ID 네이밍(`CCH-*`),
`secret://` ref 형식, 감사 액션 명명(§5.4.1 각주가 스스로 `audit-actions.md` 위반을 과거에
잡아 정정한 이력) 등에서 이미 다수 라운드의 컨벤션 정합화를 거친 상태로 확인됐고, 이번
`rotate-bot-token-body` plan 이 참조하는 요청 계약(`newBotToken`, `POST .../continue` 의
form data)도 spec 본문과 정확히 일치한다. 발견된 두 WARNING 은 모두 "문서만 바꾸고 런타임은
불변"이라는 plan 의 원칙 자체에 대한 반박이 아니라, 그 문서화 단계에서 기존에 확립된 두 규약
— §1-5 secret plaintext `writeOnly` 의무, §3 JSDoc 공개-노출 원칙 — 을 새 DTO 두 개에도 놓치지
않고 적용해야 한다는 사전 체크리스트 성격이다. INFO 는 이미 plan 이 인지한 문서 갭의 재확인이다.
치명적(CRITICAL) 발견은 없다.

## 위험도

LOW
