# API 계약(API Contract) 리뷰

## 발견사항

### [WARNING] OAuthBeginResultDto 응답 스키마 — 다형 분기 구조로 인한 명시적 discriminator 누락
- 위치: `backend/src/modules/integrations/dto/responses/integration-response.dto.ts` (파일 7), `OAuthBeginResultDto` 클래스
- 상세: 기존 응답은 `{ authorizeUrl: string, state: string }` (required 필드 2개)이었으나, 이번 변경으로 `authorizeUrl`, `state`, `integrationId`, `appUrl`, `callbackUrl`, `scopesAdded` 가 모두 `optional` 로 바뀌고 `mode?: 'cafe24_private_pending'` 가 추가되었다. 이는 두 가지 API 계약 문제를 동시에 유발한다.
  1. **Breaking change**: 기존 클라이언트는 `authorizeUrl`과 `state`가 항상 존재한다고 가정하고 있다. 두 필드가 optional 로 전환됨으로써 일반 흐름(google/github/cafe24 Public)에서도 TypeScript 타입 레벨에서 `undefined` 가능성을 처리해야 한다. API 스키마 버전이 올라가지 않은 상태에서 response shape 이 변경되었으므로 기존 클라이언트 코드가 런타임 오류 없이 동작하더라도 계약 위반이다.
  2. **Discriminator 부재**: 두 분기(`mode` 유무)를 구분하는 공식 discriminator 가 Swagger/OpenAPI 레벨에서 선언되어 있지 않다. `@ApiProperty({ required: false, enum: ['cafe24_private_pending'] })` 만으로는 OpenAPI `oneOf` / `discriminator` 객체가 생성되지 않는다. Swagger 문서를 소비하는 클라이언트(자동 생성 SDK 등)는 두 분기를 구별하는 방법을 알 수 없다.
- 제안:
  - `OAuthBeginResultDto` 를 두 개의 별도 DTO (`OAuthRedirectResultDto`, `Cafe24PrivatePendingResultDto`)로 분리하고, 컨트롤러 반환 타입에 `@ApiResponse({ type: OAuthRedirectResultDto })` / `@ApiExtraModels` + `@ApiResponse({ schema: { oneOf: [...], discriminatorProperty: ... } })` 를 사용해 OpenAPI discriminator 를 명시한다.
  - 또는 최소한 `mode` 필드가 분기 지시자임을 Swagger 상에 `@ApiResponse` 복수 정의 형태로 문서화하고, 프론트엔드 클라이언트에서 `mode === 'cafe24_private_pending'` 로 분기하도록 타입 가드를 추가한다.
  - 하위 호환을 유지하려면 일반 흐름에서는 `authorizeUrl`과 `state`가 항상 채워짐을 보장하는 런타임 assertion 또는 response interceptor 레벨 검증을 추가한다.

### [INFO] 유효성 검증 오류 메시지 언어 전환 (Ko → En) — 에러 응답 계약에 영향 없음이나 클라이언트 파싱 주의
- 위치: 파일 20~83 (node schema `warningRules.message` 필드 전수 변경)
- 상세: 26개 이상 노드 핸들러의 `warningRules[].message` 가 한국어에서 영어로 전환되었다. 이 메시지는 `handler.validate()` 반환값의 `errors` 배열에 포함되어 API 응답(노드 검증 엔드포인트)으로 전달될 수 있다. 클라이언트가 에러 메시지 문자열을 직접 비교해 분기하는 경우 breaking change 가 된다. 변경된 메시지 예: `'실행할 코드를 입력해야 합니다.'` → `'Body of the code to run must be entered.'`.
  - 코드 주석(`metadata-validation.ts`)에 "frontend `getConfigSummary` translates them via `WARNING_KO` for the ko locale" 라 명시되어 있어, 번역 레이어가 프론트엔드에 존재함을 시사한다. 번역 누락 시 한국어 사용자에게 영어 메시지가 노출된다.
- 제안: API 응답에서 에러 메시지를 직접 문자열 비교하는 프론트엔드 코드가 없는지 확인한다. 있다면 message ID(`id` 필드)를 기준으로 분기하도록 리팩토링한다. 프론트엔드 `WARNING_KO` 맵에 신규 영어 키가 빠짐없이 등록되었는지도 검증이 필요하다.

### [INFO] `ThirdPartyOAuthController` / `integration-oauth.service.ts` diff 미포함 — 컨트롤러 레벨 검증 불가
- 위치: 파일 13 (`integration-oauth.service.ts`), 파일 17 (`third-party-oauth.controller.ts`) — diff omitted due to prompt size limit
- 상세: `OAuthBeginResultDto` 를 실제 반환하는 컨트롤러와 서비스 구현의 diff 가 프롬프트 크기 제한으로 누락되었다. `cafe24_private_pending` 분기에서 `authorizeUrl` / `state` 가 undefined 로 반환되는 경로, HTTP 상태 코드(200 vs 201 vs 202), `@UseGuards` / `@Roles` 데코레이터 적용 여부를 확인하지 못했다.
- 제안: 별도 리뷰 사이클에서 컨트롤러 diff 를 포함시켜 인증/인가 데코레이터와 HTTP 상태 코드 일관성을 추가로 검토한다.

## 요약

이번 변경에서 API 계약 관점의 핵심 이슈는 `OAuthBeginResultDto` 의 응답 스키마 변경이다. 일반 흐름에서 필수였던 `authorizeUrl`·`state` 를 optional 로 전환하고 Cafe24 Private 전용 필드를 추가함으로써 기존 클라이언트에 잠재적 breaking change 가 발생했으며, OpenAPI discriminator 가 선언되지 않아 자동 생성 SDK 의 타입 안전성이 저하된다. 나머지 변경(마이그레이션 추가, 노드 경고 메시지 영문화, 인프라 빌드 수정)은 API 계약에 직접적인 영향이 없으나, 경고 메시지 언어 전환은 메시지 문자열에 의존하는 클라이언트 코드 존재 여부 확인이 필요하다.

## 위험도

MEDIUM
