# API 계약(API Contract) 리뷰 — rotate-bot-token-body

## 범위 요약

`POST /triggers/:id/chat-channel/rotate-bot-token` · `POST /executions/:id/continue` ·
`POST /hooks/:endpointPath` 세 라우트에 OpenAPI `@ApiBody` 문서 전용 DTO(`ChatChannelRotateBotTokenRequestDto`,
`ContinueExecutionRequestDto`) 및 인라인 스키마(webhook)를 추가한 변경이다. `@Body()` 파라미터 타입은
그대로 인라인 유지되어 전역 `CustomValidationPipe`(class-validator)를 우회하며, 런타임 검증·에러 코드·
응답 스키마는 변경되지 않는다고 plan·주석·캐너리 테스트가 명시한다.

## 발견사항

- **[INFO]** 신규 요청 DTO 와 기존 응답 DTO 의 명명 비대칭
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-rotate-bot-token-request.dto.ts:14`
    (`ChatChannelRotateBotTokenRequestDto`) vs 같은 모듈
    `dto/responses/chat-channel-rotate-bot-token-response.dto.ts` 의 `ChatChannelRotateBotTokenDto`(접미사 없음)
  - 상세: 같은 엔드포인트의 요청/응답 클래스가 어간은 같은데 응답 쪽만 접미사가 없어 grep·자동완성으로
    즉시 구분되지 않는다. `ContinueExecutionRequestDto`(신규 요청) vs `ExecutionContinueResultDto`(기존 응답)도
    어간 어순이 반대(`ExecutionContinue` ↔ `ContinueExecution`)라 나란히 보면 오탈자처럼 보일 소지가 있다.
    기능적 충돌은 아니며, 동일 세션의 `--impl-prep` consistency-check(cross_spec/naming_collision, LOW)가 이미
    지적했고 파일 배치(플랫 `dto/` vs `dto/responses/`)로 request/response 를 가르는 기존 관례에 따라 처리됐다.
  - 제안: 이번 PR 범위에서 막을 근거는 없음(기록용). `swagger.md` §1-7 에 `<Domain><Action>RequestDto` 행을
    추가하는 후속 항목(plan 이 이미 트래커 등재 예정)에서 명명 대칭 규칙까지 함께 정하면 재발을 줄인다.

- **[INFO]** 세 라우트 모두 OpenAPI 스키마와 실제 런타임 검증 계층이 의도적으로 분리되어 있음
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-rotate-bot-token-request.dto.ts:1-19`,
    `codebase/backend/src/modules/executions/dto/continue-execution.dto.ts:1-17`,
    `codebase/backend/src/modules/hooks/hooks.controller.ts:135-141`
  - 상세: `@Body()` 파라미터가 DTO 클래스가 아닌 인라인 타입(`Object`)으로 남아 있어 OpenAPI 가 광고하는
    타입(예: `newBotToken: string` required)을 서버가 스키마 차원에서 강제하지 않는다 — 실제 거부는 각
    핸들러의 수동 검사(`INVALID_BOT_TOKEN`)나 엔진(`FormValidationError`)이 담당한다. 이는 계약 변경을
    피하기 위한 **의도된 설계**이며(전역 파이프 진입 시 에러 코드·여분 키 처리가 바뀜), 모듈별 캐너리
    3종(설계 타입 `Object` 확인 · 파이프 통과 확인 · 렌더 스키마 확인)이 이 분리 상태 자체를 회귀 가드로
    고정하고 있어 향후 누군가 파라미터를 DTO 로 바꾸면 캐너리가 RED 로 알린다. 결함은 아니지만, OpenAPI
    코드 생성기를 쓰는 외부 클라이언트가 "필수 string" 스키마를 신뢰해 클라이언트 측 강제(예: TS 타입)를
    걸어도, 서버가 실제로 그 형태를 스키마로 강제하지 않는다는 점은 문서 소비자가 알아야 할 특성이다.
  - 제안: 조치 불필요(현재 캐너리로 충분히 보호됨). 다만 각 DTO 의 JSDoc/description 이 이미 "핸들러가
    거부한다"고 명시하고 있어(예: `newBotToken` — "없거나 문자열이 아니면 400 INVALID_BOT_TOKEN") 문서
    소비자에게 실제 강제 주체를 알리는 최소 조치는 이미 되어 있다.

- **[INFO]** `@ApiConsumes('application/json', 'application/x-www-form-urlencoded')` 문서화가 실제
  본문 파서 구성과 일치함을 확인(과대 광고 아님)
  - 위치: `codebase/backend/src/modules/hooks/hooks.controller.ts:135`
  - 상세: `codebase/backend/src/bootstrap/hooks-body-parser.ts` 의 `buildBodyParsers()` 가 `/api/hooks/*`
    라우트에 `json()` + `urlencoded({ extended: true })` 두 파서를 실제로 등록하고 있어, 새로 추가된
    `@ApiConsumes` 선언이 런타임과 정확히 일치한다. 별도 조치 불필요, 검증만 기록.

## 확인된 양호 사항 (긍정 관측)

- `newBotToken` 은 `@ApiProperty({ writeOnly: true })` + `string`(필수, `?` 없음)으로 선언되어, 같은 세션의
  `--impl-prep` consistency-check(convention_compliance WARNING #1·#2)가 지적한 "required 광고 누락"·
  "writeOnly 누락" 위험이 실제 구현에서 모두 해소됐다(`codebase/backend/src/modules/triggers/dto/chat-channel-rotate-bot-token-request.dto.ts:14-19`).
  spec `15-chat-channel.md` §5.4("필수")·`swagger.md` §1-5(secret plaintext `writeOnly` 의무)와 정합.
- 세 라우트 모두 하위 호환성 파괴 없음 — `@Body()` 파라미터 타입 불변(런타임 검증·에러 코드·응답
  스키마 무변경), OpenAPI 문서 추가만 순수 additive.
- `ContinueExecutionRequestDto.formData`(`@ApiPropertyOptional`, `required: false`)·webhook
  `@ApiBody({ required: false, schema: {} })` 모두 실제 파라미터 선택성(옵셔널 `?`)과 정확히 일치.
- 인증/인가 데코레이터(`@Roles`, `@ApiBearerAuth`, `@Public`)는 이번 diff 에서 손대지 않았고 그대로 유지됨.
- 에러 응답 데코레이터(`@ApiBadRequestResponse` 등)는 변경되지 않았고 이번 `@ApiBody` 추가와 충돌하지 않음.

## 참고: 리뷰 중 관측한 워킹트리 상태 (본 diff 와 무관)

리뷰 도중 워킹트리 상태를 확인하는 과정에서 `codebase/backend/src/modules/triggers/dto/chat-channel-rotate-bot-token-request.dto.ts`
가 일시적으로 수정된 상태(`@ApiProperty({ writeOnly: true })` → `@ApiProperty({})`)와 동반 백업 파일
(`*.bakmut`)이 관측됐다 — 병렬 fan-out 중 다른 프로세스가 `writeOnly` 제거 뮤테이션 검증을 수행한 것으로
보인다. 본 리포트는 프롬프트 번들에 실린 원본(`writeOnly: true` 포함) 기준으로 작성했으며, 재확인 시점에는
해당 수정·백업 파일이 이미 원복/정리되어 작업 트리가 다시 clean 함(본 리뷰 산출물 디렉터리 외 변경 없음)을
확인했다. 본인은 이 DTO 파일에 어떤 Write/Edit 도 수행하지 않았다 — 관측만 기록한다.

## 요약

세 라우트에 대한 OpenAPI 요청 본문 문서화는 순수 additive 이며 런타임 계약(검증 로직·에러 코드·응답
스키마)을 전혀 바꾸지 않는다. 문서 전용 DTO 를 `@Body()` 파라미터 타입과 분리해 전역 `CustomValidationPipe`
진입을 의도적으로 차단한 설계는 타당하고, 모듈별 캐너리(설계 타입·파이프 통과·렌더 스키마)가 그 분리
상태를 회귀 가드로 고정한다. 사전 `--impl-prep` consistency-check 가 지적한 두 WARNING(`writeOnly` 누락,
required 오광고 위험)은 최종 구현에서 모두 해소되어 재확인했다. 남은 사항(DTO 명명 비대칭, 문서-검증
분리 특성)은 기능적 결함이 아닌 INFO 수준 기록이며 블로킹 사유가 없다.

## 위험도

LOW
