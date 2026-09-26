# 부작용(Side Effect) 리뷰

## 검증 방법

디프만으로는 "OpenAPI 데코레이터 추가는 런타임 불변" 이라는 코드 내 주석·plan 서술이 사실인지 확신할 수 없어, 저장소를 뮤테이션하지 않고 다음을 직접 열어 확인했다(모두 읽기 전용 — `git status --short` 결과 변경 없음):

- `codebase/backend/node_modules/@nestjs/swagger/dist/decorators/api-body.decorator.js`, `api-consumes.decorator.js` — 두 데코레이터 모두 `createMixedDecorator`/`createParamDecorator` 로 Reflect 메타데이터만 쓰고, 가드·인터셉터·바디 파서 설정을 건드리지 않는다. 즉 `@ApiBody`/`@ApiConsumes` 는 순수 문서 메타데이터다.
- `codebase/backend/src/common/pipes/validation.pipe.ts` — `CustomValidationPipe.toValidate()` 는 `metatype` 이 `Object`(등 primitive)면 `false` 를 반환해 `transform` 이 원본 `value` 를 그대로 반환한다. 세 라우트(`rotateBotToken`/`continueExecution`/`receiveWebhook`) 의 `@Body()` 파라미터 타입은 이번 diff 후에도 인라인 타입(`{ newBotToken?: string }`/`{ formData?: unknown }`/`unknown`) 그대로라, 파이프 진입 여부는 변하지 않는다.
- `codebase/backend/src/modules/triggers/triggers.controller.ts` 실제 파일(`sed -n '260,330p'`) — `rotateBotToken` 핸들러 시그니처가 `@Body() body: { newBotToken?: string }` 로 diff 전과 동일함을 직접 확인.

## 발견사항

- **[INFO]** `bodyParamDesignType` 헬퍼가 `@nestjs/common` 의 비공개(non-exported) 내부 API 에 의존한다
  - 위치: `codebase/backend/src/shared/testing/swagger-probe.ts:141`~`164` (게이트 141|~164|, 신설 함수 `bodyParamDesignType`)
  - 상세: `ROUTE_ARGS_METADATA`(`@nestjs/common/constants`)와 `RouteParamtypes`(`@nestjs/common/enums/route-paramtypes.enum`)는 `@nestjs/common` 의 공개 export 표면이 아니라 서브패스 직접 import 로 끌어온 내부 구현 상수다. 지금은 정상 동작하지만, 이 캐너리 세 스펙(`executions-continue-body.spec.ts`, `triggers-rotate-bot-token-body.spec.ts`, `hooks-webhook-body.spec.ts`)이 서 있는 "여기가 RED 면 계약이 깨진 것" 이라는 보장은 향후 NestJS 버전이 이 내부 경로·enum 값을 바꾸면(프로덕션 코드 변경 없이) 조용히 무너질 수 있다 — 실제 계약 위반이 아니라 헬퍼 자체의 붕괴인데도 같은 RED 로 보인다.
  - 제안: 당장 막을 필요는 없으나(테스트 전용 헬퍼, 프로덕션 런타임에 영향 없음), 이 함수가 깨지면 "헬퍼 전제 붕괴" 메시지를 이미 던지도록 방어적으로 짜여 있어 원인 파악은 가능하다. 후속으로 CI 에서 `@nestjs/common` 마이너 업데이트 시 이 스펙 파일들을 우선 확인하라는 메모를 남겨도 좋다.

- **[INFO]** OpenAPI 문서 자체가 하나의 공개 인터페이스라, 이번 변경이 하위 소비자(코드 생성기)에 영향을 줄 수 있다
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts` — `rotateBotToken` 메서드의 `@ApiBody({ type: ChatChannelRotateBotTokenRequestDto })` (게이트 287|, `@Post(':id/chat-channel/rotate-bot-token')` 데코레이터 블록)
  - 상세: `@ApiBody` 에 `required` 를 명시하지 않으면 `@nestjs/swagger` 의 `defaultBodyMetadata`(`{ type: String, required: true }`)가 적용된다(위 "검증 방법" 항목에서 소스로 확인). `ChatChannelRotateBotTokenRequestDto.newBotToken` 도 옵셔널 마커 없이 필수로 선언돼 있어 두 값이 일치한다 — 런타임 검증(핸들러의 `INVALID_BOT_TOKEN` 수동 체크)은 그대로지만, 이 엔드포인트는 이전엔 OpenAPI 상 `requestBody` 자체가 없었다. 이 스펙으로 클라이언트 SDK 를 재생성하는 외부 도구가 있다면, 이제 `newBotToken` 을 필수 필드로 인식해 생성 코드가 바뀐다. plan/CHANGELOG 가 말하는 "런타임 불변" 은 서버 쪽 얘기이고, 문서 소비자(코드 생성기) 쪽 변화는 이 작업의 명시적 목적이자 의도된 결과이므로 결함은 아니다 — 다만 "불변" 이라는 문구가 그 경계까지 보장한다고 오독되지 않도록 기록해 둔다.

- **[NONE]** `@ApiConsumes('application/json', 'application/x-www-form-urlencoded')` 추가(`hooks.controller.ts` 게이트 135|)는 실제 body-parser/Content-Type 강제와 무관 — 문서용 메타데이터일 뿐이며 웹훅이 실제로 받아들이는 Content-Type 목록을 바꾸지 않는다(위 "검증 방법" 소스 확인). 정상.

- **[NONE]** 컨트롤러 3곳(`executions.controller.ts`/`hooks.controller.ts`/`triggers.controller.ts`)의 `@Body()` 파라미터 시그니처와 반환 타입은 diff 전후 동일 — 기존 호출자(서비스 계층, 테스트)에 영향 없음. 새 DTO 두 개(`ContinueExecutionRequestDto`, `ChatChannelRotateBotTokenRequestDto`)는 `@Injectable` 이 아닌 순수 데이터 클래스이며 어디에도 `@Body()` 타입으로 쓰이지 않아 DI 컨테이너·글로벌 파이프·클래스 변환기 스캔에 편입되지 않는다.

- **[NONE]** 전역 변수·환경 변수 읽기/쓰기, 파일시스템 부작용, 네트워크 호출, 이벤트/콜백 변경 — 이번 diff(11개 코드/문서 파일)에 해당 사항 없음. `hooks.controller.ts` 의 기존 `process.env` 참조는 이번 diff 범위 밖(변경되지 않음).

## 원복 확인

리뷰 중 저장소 트리에 아무것도 쓰거나 고치지 않았다(전부 `Read`/`grep`/`sed -n` 읽기 전용, node_modules 소스 확인 포함). `git status --short` 결과 `review/code/2026/09/26/17_55_14/` 외 변경 없음 — 이는 다른 fan-out reviewer 의 산출물이며 본 리뷰가 만든 뮤테이션이 아니다.

## 요약

이번 diff 는 문서 전용(`@ApiBody`/`@ApiConsumes`/`@ApiProperty`) 데코레이터 추가와 그를 지키는 캐너리 테스트로 구성돼 있고, "런타임 계약은 그대로" 라는 코드 내 주석·plan 서술을 `@nestjs/swagger` 데코레이터 소스와 `CustomValidationPipe.toValidate()` 로 직접 대조해 확인했다 — 세 라우트의 `@Body()` 파라미터 타입이 여전히 인라인이라 전역 검증 파이프는 이번에도 우회되고, `@ApiConsumes` 도 실제 Content-Type 수용 여부를 바꾸지 않는다. 의도치 않은 상태 변경·전역 변수·파일시스템·시그니처·네트워크·이벤트 부작용은 발견되지 않았다. 새 테스트 헬퍼(`bodyParamDesignType`)가 NestJS 비공개 내부 API 에 의존하는 점과, 이번에 처음 광고되는 OpenAPI `requestBody` 가 하위 클라이언트 코드 생성기 결과를 바꿀 수 있다는 점만 INFO 로 기록한다(둘 다 차단 사유 아님).

## 위험도
LOW
