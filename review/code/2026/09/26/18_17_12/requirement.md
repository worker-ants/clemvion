# 요구사항(Requirement) 충족 검토 — rotate-bot-token-body (2R)

이 세션은 `18_17_12` 라운드(직전 `/ai-review` 1R 조치 커밋 `7d03bdfb1`까지 반영된 전체 diff)를 독립적으로
재검증했다. 실제 코드 3파일(`triggers.controller.ts`, `executions.controller.ts`, `hooks.controller.ts`)과
`CustomValidationPipe`, `bodyParamDesignType`, 관련 spec 3곳(`spec/5-system/15-chat-channel.md` §5.4,
`spec/5-system/12-webhook.md` WH-EP-04/05, `spec/conventions/swagger.md` §1-5/§3/§1-7)을 직접 열어
line-level로 대조했다.

## 검증한 사실

- `triggers.controller.ts` `rotateBotToken`: `@Body() body: { newBotToken?: string }` 인라인 유지,
  `if (!body?.newBotToken || typeof body?.newBotToken !== 'string') throw BadRequestException({ code: 'INVALID_BOT_TOKEN', ... })`
  — `ChatChannelRotateBotTokenRequestDto` JSDoc("없거나 문자열이 아니면 400 `INVALID_BOT_TOKEN`")과 정확히
  일치하고, `spec/5-system/15-chat-channel.md` §5.4 요청 body 표(`newBotToken` 필수 · 400 `INVALID_BOT_TOKEN`)와도
  line-level로 일치.
- `executions.controller.ts` `continueExecution`: `@Body() body?: { formData?: unknown }` — `spec/data-flow/3-execution.md:174`
  "body `{ formData? }` 만 받으며" 문장과 정확히 일치. `ContinueExecutionRequestDto` 의 "FIRST 오류만" JSDoc도
  같은 문서가 인용하는 §7.5.1/§4 form 검증 규칙과 부합.
- `hooks.controller.ts` `receiveWebhook`: `@ApiConsumes('application/json', 'application/x-www-form-urlencoded')` +
  `@ApiBody({ required: false, schema: {} })` — `spec/5-system/12-webhook.md` WH-EP-04("JSON, form-urlencoded 요청
  본문 수신")·WH-EP-05("본문 전체를 워크플로우 입력으로")와 일치. 파라미터 타입 `unknown` 은 diff 에 나타나지 않음(런타임 불변 실측).
- `CustomValidationPipe.toValidate()` 는 `[String, Boolean, Number, Array, Object]` 를 검증 스킵 대상으로 두어,
  `bodyParamDesignType` 이 `Object` 를 확인하는 캐너리 전제와 정확히 맞물린다(공허하지 않음).
- `bodyParamDesignType` 의 `ROUTE_ARGS_METADATA` 읽기 방식(`Reflect.getMetadata(ROUTE_ARGS_METADATA, controller, method)`)과
  `RouteParamtypes.BODY === 3`(node_modules 실측)이 Nest 데코레이터의 실제 키 포맷(`${paramtype}:${index}`)과 일치해
  `twoBodies`(`@Body('a')`/`@Body('b')`) 테스트가 실제로 2건을 세는 경로를 탄다.
- 직전 라운드 WARNING #1(`bodyParamDesignType` 에러 분기 무테스트)은 `fafc6b8ac` 로 해소됐음을
  `swagger-probe.spec.ts` 를 직접 읽어 확인 — `@Body()` 부재, 2개 이상, `design:paramtypes` 부재 세 분기 모두
  전용 스텁으로 트리거하는 테스트가 존재한다.
- `swagger.md` §1-5("secret store 입력 plaintext 는 항상 `writeOnly: true` 의무")·§3("JSDoc 은 공개 OpenAPI 로
  나간다 — 내부 서사를 담지 않는다")를 원문 대조 — 두 신규 DTO 모두 정확히 준수.
- TODO/FIXME/HACK/XXX 검색 결과 신규 파일 전체에서 0건.

## 발견사항

- **[INFO]** 이 PR이 "닫는다"고 선언한 트래커 항목이 아직 미해결
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:2459`(`- [ ]` 미체크, 직접 확인),
    `plan/in-progress/rotate-bot-token-body.md` 체크리스트 마지막 3줄(`/ai-review`·`--impl-done`·`트래커 항목 닫기` 미체크)
  - 상세: 직전 라운드 documentation reviewer 가 WARNING 으로 지적했던 항목과 동일 지점이다. 그러나
    `review/code/2026/09/26/17_55_14/RESOLUTION.md` 가 이를 "마무리 커밋에서 닫는다"고 명시적으로 처분했고,
    plan 자신의 체크리스트도 이 세 항목을 아직 미완료로 정직하게 표시하고 있어 — 상태 서술과 실제 상태가
    어긋나지 않는다(과장된 완료 주장이 없다). 코드 결함이 아니라 워크플로 진행 단계 표시일 뿐이므로 CRITICAL/WARNING
    으로 올리지 않는다.
  - 제안: 이번 세션이 이미 계획한 대로 `--impl-done` 직전 마무리 커밋에서 트래커 항목 체크 + 처방 문구
    정정(`요청 DTO 승격` → `문서 전용 DTO + @ApiBody`) + `swagger.md §1-7` 명명 규약 후속 등재를 함께 수행할 것.

- **[INFO]** `swagger.md` §1-7 은 `Update` 접두 규칙만 다루고 `<Domain><Action>RequestDto` 형태의 명명은
  규약화돼 있지 않음(직접 확인)
  - 위치: `spec/conventions/swagger.md` §1-7(라인 543 부근, "Update 접두의 범위" 표제만)
  - 상세: 신규 클래스명(`ChatChannelRotateBotTokenRequestDto`, `ContinueExecutionRequestDto`)은 저장소 기존
    관례(`ReRunRequestDto` 등)와는 일치하지만 §1-7 표 자체에는 이 패턴이 없다 — spec 의 침묵 영역(회색지대)이므로
    INFO. spec 결함이라기보다 plan 이 이미 후속 등재를 예고한 갭.
  - 제안: spec 수정 권한은 `project-planner` — plan 이 예고한 "전역 가드 후속 트래커 등재" 시 §1-7 표에
    행 추가를 함께 반영.

CRITICAL/WARNING 급 신규 결함은 발견되지 않았다. 직전 라운드가 지적한 WARNING 3건 중 코드 성격의
W1(테스트 무커버리지)은 실측 확인상 해소됐고, 나머지(W2 rule-of-three 미충족·W3 트래커 미체크)는 plan/
RESOLUTION 이 이미 의도적으로 유예/예정한 항목으로 이번 라운드에서 재차 경고를 올릴 근거가 없다.

## 요약

세 라우트(`rotateBotToken`/`continueExecution`/`receiveWebhook`)에 OpenAPI `@ApiBody` 문서 스키마를
추가하면서 런타임 계약(검증 로직·에러 코드·응답 형태)을 전혀 바꾸지 않는다는 의도가 실제 컨트롤러 코드,
`CustomValidationPipe` 분기 조건, 캐너리 테스트, 그리고 관련 spec 3문서(`15-chat-channel.md` §5.4,
`12-webhook.md` WH-EP-04/05, `spec/data-flow/3-execution.md`)와 line-level 로 정확히 일치함을 직접
소스·spec 원문 대조로 재확인했다. 직전 `/ai-review` 라운드가 지적한 테스트 커버리지 WARNING 은 실제
커밋(`fafc6b8ac`)에서 해소됐음을 파일을 열어 확인했다. 남은 항목(트래커 체크박스·§1-7 명명 규약 공백)은
plan 이 이미 "마무리 커밋"으로 명시적으로 유예한 워크플로 단계이지 코드 결함이 아니다. 신규 CRITICAL/WARNING
없음.

## 위험도

LOW
