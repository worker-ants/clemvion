# API 계약(API Contract) 리뷰 — rotate-bot-token-body (2R)

## 범위 요약

이번 라운드(18_17_12)의 diff 는 1R(`17_55_14`)에서 이미 API 계약 관점 LOW 로 평가된 코드
(`ChatChannelRotateBotTokenRequestDto`, `ContinueExecutionRequestDto`, 세 컨트롤러의 `@ApiBody`/
`@ApiConsumes` 추가, hooks 인라인 스키마)를 그대로 포함하며, 그 위에 1R WARNING 조치 커밋
(`fafc6b8ac` — `bodyParamDesignType` 에러 경로 테스트 추가, `ecaed6534` — lint 수정)과 plan/리뷰
산출물 커밋(`e3fd2b674`, `7d03bdfb1`)이 얹혀 있다. 새로 추가된 커밋은 테스트 헬퍼
(`swagger-probe.ts`/`swagger-probe.spec.ts`)의 내부 에러 경로 테스트와 plan 문서 갱신뿐으로,
API 로 노출되는 계약(요청/응답 스키마·상태 코드·인증)에는 손대지 않는다. 실제 API 표면
(DTO 3개 파일, 컨트롤러 3개 파일)을 다시 읽어 1R 보고서(`review/code/2026/09/26/17_55_14/api_contract.md`)
의 결론이 여전히 유효함을 재확인했다.

## 발견사항

- **[INFO]** 신규 요청 DTO 와 기존 응답 DTO 의 명명 비대칭 (1R 과 동일, 재확인)
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-rotate-bot-token-request.dto.ts`
    (`ChatChannelRotateBotTokenRequestDto`) vs 같은 모듈의
    `dto/responses/chat-channel-rotate-bot-token-response.dto.ts` (`ChatChannelRotateBotTokenDto`,
    접미사 없음). `ContinueExecutionRequestDto`(요청) vs `ExecutionContinueResultDto`(응답)도 어간
    어순이 반대.
  - 상세: 기능적 충돌은 없다. `spec/conventions/swagger.md` §1-7 에 `<Domain><Action>RequestDto`
    형태가 아직 명문화되지 않은 기존 갭이며, plan(`rotate-bot-token-body.md` "안 하는 것")이 전역
    가드 후속 트래커 등재를 예고하고 있다.
  - 제안: 이번 PR 범위에서 막을 근거 없음(기록용). 후속 트래커 등재 시 명명 대칭 규칙까지 함께 정리.

- **[INFO]** 세 라우트 모두 OpenAPI 스키마와 런타임 검증 계층이 의도적으로 분리되어 있음 (1R 과 동일)
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-rotate-bot-token-request.dto.ts:14-19`,
    `codebase/backend/src/modules/executions/dto/continue-execution.dto.ts:12-17`,
    `codebase/backend/src/modules/hooks/hooks.controller.ts:135-141`
  - 상세: `@Body()` 파라미터가 인라인 `Object`/`unknown` 타입으로 남아 있어, OpenAPI 가 광고하는
    필수/타입 제약을 서버가 스키마 계층에서 강제하지 않는다 — 실제 거부는 핸들러 수동 검사
    (`INVALID_BOT_TOKEN`)나 엔진(`FormValidationError`)이 담당한다. 전역 `CustomValidationPipe` 진입을
    피하기 위한 의도된 설계이며, 모듈별 캐너리(`design:paramtypes` 가 `Object`인지 · 여분 키/비-string
    이 파이프를 통과하는지 · `@ApiBody` 대상 · 렌더 스키마)가 이 분리를 회귀 가드로 고정한다. 이번
    라운드에서 새로 추가된 `bodyParamDesignType` 에러 경로 테스트(`swagger-probe.spec.ts`)는 이 캐너리
    헬퍼 자체의 신뢰도를 더 높인다 — 헬퍼가 `@Body()` 부재·2개 이상·`design:paramtypes` 부재를 조용히
    잘못된 값(첫 파라미터 타입 등)으로 넘기지 않고 던지는지 직접 검증한다.
  - 제안: 조치 불필요. OpenAPI 코드 생성기를 쓰는 외부 클라이언트가 "필수 string" 스키마를 신뢰해도
    서버가 스키마 차원에서 강제하지 않는다는 특성은 각 DTO JSDoc 이 이미 명시하고 있다.

- **[INFO]** 하위 트래커 항목이 여전히 미체크 상태 (API 계약 자체에는 영향 없음 — documentation 리뷰
  영역과 중복이므로 참고만)
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:2459`
  - 상세: 실측 확인 결과 여전히 `- [ ]` 이고 처방 문구도 "요청 DTO 승격"으로 남아 있다. 이는 계약
    자체를 바꾸지 않으므로 API 계약 위험도에는 반영하지 않는다(문서/plan 계보 문제로, documentation
    리뷰어의 WARNING 범위).

## 확인된 양호 사항 (재확인)

- `newBotToken` — `@ApiProperty({ writeOnly: true })` + `string`(필수), spec `15-chat-channel.md`
  §5.4·`swagger.md` §1-5 와 정합. 이번 라운드 diff 에서도 값 불변.
- 세 라우트 모두 하위 호환성 파괴 없음 — `@Body()` 파라미터 타입·에러 코드·응답 스키마 무변경, 순수
  additive 문서.
- `ContinueExecutionRequestDto.formData`(선택) · webhook `@ApiBody({ required: false, schema: {} })`
  모두 실제 파라미터 선택성과 일치.
- 인증/인가 데코레이터(`@Roles`, `@ApiBearerAuth`, `@Public`), 에러 응답 데코레이터
  (`@ApiBadRequestResponse` 등)는 이번 라운드에서도 손대지 않음.
- 신규 커밋(`fafc6b8ac`)이 추가한 `bodyParamDesignType` 에러 경로 테스트는 프로덕션 API 표면이 아닌
  테스트 헬퍼 대상이라 API 계약에 영향 없음 — 다만 캐너리 신뢰도를 높여 "문서 전용 DTO가 실수로 파이프에
  연결되는" 회귀를 더 확실히 잡는다.

## 요약

이번 2R diff 에 새로 얹힌 커밋은 테스트 헬퍼 내부 에러 경로 테스트 추가와 lint 수정, plan/리뷰 산출물
갱신뿐으로 API 로 노출되는 계약(요청/응답 스키마, 상태 코드, 인증/인가, URL 설계, 페이지네이션)에는
변화가 없다. 실제 API 표면 코드(DTO 2개, 컨트롤러 3개)를 재확인한 결과 1R 결론(하위 호환성 파괴 없음,
문서-검증 의도적 분리, `writeOnly`/필수 여부 정확)이 그대로 유지된다. 남은 사항(DTO 명명 비대칭,
하위 트래커 미체크)은 기능적 결함이 아니며 블로킹 사유가 없다.

## 위험도

LOW
