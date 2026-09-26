# 보안(Security) 리뷰

## 발견사항

- **[INFO]** 요청 본문 스키마 데코레이터만 추가하는 순수 문서화 변경 — 런타임 검증/인가 경로 불변 재확인
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts`(`rotateBotToken`), `codebase/backend/src/modules/executions/executions.controller.ts`(`continueExecution`), `codebase/backend/src/modules/hooks/hooks.controller.ts`(`receiveWebhook`)
  - 상세: 세 라우트 모두 `@Body()` 파라미터 타입은 그대로 인라인(`Object`)이고 `@ApiBody({ type: ... })` 로 OpenAPI 문서만 채웠다. 전역 `CustomValidationPipe` 는 `metatype === Object` 일 때 검증을 건너뛰므로 새 문서 전용 DTO(`ChatChannelRotateBotTokenRequestDto`, `ContinueExecutionRequestDto`) 도입이 실제 인증(`@Roles('editor')`, `@Public`)·인가(`verifyOwnership`)·입력 검증(`rotateBotToken` 핸들러의 수동 `typeof` 체크로 `INVALID_BOT_TOKEN`)에 아무 영향을 주지 않음을 `triggers.controller.ts` 를 직접 열어 재확인했다. 모듈별 캐너리 3종(설계 타입 `Object` 확인·파이프 통과 확인·렌더 스키마 확인)이 이 분리 상태를 회귀 가드로 고정한다. 이 결론은 직전 라운드(`review/code/2026/09/26/17_55_14/security.md`, 위험도 NONE)와 동일하며, 이번 라운드에서 재검토한 결과도 달라지지 않았다.
  - 제안: 없음(정보성).

- **[INFO]** `newBotToken` 에 `writeOnly: true` + 필수(문자열) 선언 — 시크릿 평문 필드의 OpenAPI 노출 억제 규약 준수, 예시값 없음
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-rotate-bot-token-request.dto.ts`
  - 상세: bot token 평문을 받는 필드에 `writeOnly` 가 부여되어 Swagger 문서/예시에 실제 토큰 형태가 노출될 단서가 없다. `example` 도 지정하지 않았다. 렌더 캐너리(`triggers-rotate-bot-token-body.spec.ts`)가 `writeOnly: true` 를 단언해 회귀를 막는다. `git diff` 로 하드코딩된 토큰/시크릿 리터럴이 포함되지 않았음을 확인했다.
  - 제안: 없음.

- **[INFO]** `POST /hooks/:endpointPath` 는 여전히 공개(`@Public`) 웹훅, 문서화만 추가 — 인증·속도제한 경계 변경 없음
  - 위치: `codebase/backend/src/modules/hooks/hooks.controller.ts`
  - 상세: `@ApiConsumes('application/json', 'application/x-www-form-urlencoded')` + `@ApiBody({ required: false, schema: {} })` 만 추가됐다. 본문 파라미터가 `unknown` 타입으로 전역 파이프를 타지 않는다는 사실이 주석에 정확히 반영되어 있고, 서명/시크릿 검증은 이 diff 범위 밖(`hooks.service.ts`)에 그대로 위임되어 있다. 임의 JSON 값을 스키마 `{}` 로 광고하는 것이 실제 파서 설정(`buildBodyParsers()`)과 일치함은 직전 라운드 `api_contract.md` 가 실측했다.
  - 제안: 없음.

- **[INFO]** 신규 테스트 헬퍼 `bodyParamDesignType` 은 Nest 내부(비공개) API(`ROUTE_ARGS_METADATA`, `RouteParamtypes`)와 `design:paramtypes` 리플렉션 메타데이터만 읽는다 — 사용자 입력을 처리하지 않고 프로덕션 빌드에서 제외됨
  - 위치: `codebase/backend/src/shared/testing/swagger-probe.ts`
  - 상세: 이번 라운드에서 추가된 테스트(`swagger-probe.spec.ts` 의 에러 경로 3케이스)는 `@Body()` 부재·2개·`design:paramtypes` 부재를 검증하는 순수 단위 테스트로, 외부 입력이나 네트워크 경계를 다루지 않는다. `src/shared/testing/**` 는 `tsconfig.build.json` 의 기존 `exclude` 규칙에 포함되어 프로덕션 `dist` 에 실리지 않는다(직전 라운드에서 실측 확인됨, 이번 diff 는 그 exclude 대상 파일 내부만 수정).
  - 제안: 없음.

- **[INFO]** 이번 라운드에 새로 포함된 항목(직전 리뷰 산출물·plan 문서·`--impl-prep` consistency 산출물)은 전부 마크다운/JSON 메타데이터로, 시크릿·자격증명·실행 가능한 로직을 담지 않는다
  - 위치: `plan/in-progress/rotate-bot-token-body.md`, `review/code/2026/09/26/17_55_14/**`, `review/consistency/2026/09/26/17_20_45/**`
  - 상세: `_retry_state.json`·`meta.json` 등은 로컬 절대경로와 라우팅 메타데이터만 담고 있어 민감정보 노출이 아니다. `grep -inE 'password|secret|token|api[_-]?key'` 로 하드코딩 시크릿 패턴을 스캔했고, 매치는 모두 `newBotToken`/`writeOnly`/`chat_channel_token_v2`(secret store 참조 이름) 등 기존에 알려진 식별자·주석 서술뿐이었다.
  - 제안: 없음.

뮤테이션 검증(저장소 파일 수정)은 수행하지 않았다 — `Read`/`grep`/`git diff` 만으로 판단에 충분했다. `git status --short` 로 확인한 결과 이 세션의 리뷰 산출물 디렉터리(`review/code/2026/09/26/18_17_12/`) 외에는 변경이 없었다 — 다른 reviewer 의 워킹트리 뮤테이션 흔적(`.bakmut` 등)도 관측되지 않았다.

## 요약

이번 diff(19개 파일, CHANGELOG 포함)는 3개 기존 라우트(`rotate-bot-token`, `executions/:id/continue`, `hooks/:endpointPath`)에 대한 순수 OpenAPI `@ApiBody`/`@ApiConsumes` 문서 추가이며, 문서 전용 DTO 를 `@Body()` 파라미터 타입과 의도적으로 분리해 전역 `CustomValidationPipe` 진입(=계약 변경)을 피하는 설계다. 직접 `Read` 로 컨트롤러 원본을 재확인한 결과 인증(`@Roles`, `@Public`)·인가(`verifyOwnership`)·입력 검증(`INVALID_BOT_TOKEN` 수동 체크, 웹훅 서명/속도제한)·에러 코드 계약 모두 diff 이전과 동일하다. 시크릿 필드(`newBotToken`)는 `writeOnly: true` 로 정확히 문서화되어 있고 예시값도 없어 OpenAPI 를 통한 시크릿 노출 위험이 없다. 이번 라운드에 새로 추가된 코드(swagger-probe 에러 경로 테스트)도 테스트 전용이며 프로덕션 빌드에서 제외된다. 인젝션·하드코딩 시크릿·인증 우회·안전하지 않은 암호화·민감정보 에러 노출 등 점검 관점에서 새로 도입된 취약점은 발견되지 않았으며, 이는 직전 라운드(`17_55_14`)의 자체 보안 검토 결론(NONE)과 일치한다.

## 위험도

NONE
