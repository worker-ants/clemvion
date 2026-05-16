# API 계약(API Contract) Review

## 발견사항

### [WARNING] `OAuthBeginResultDto` 단일 DTO → 두 개 분리 DTO 로의 breaking change (클라이언트 영향)
- 위치: `backend/src/modules/integrations/dto/responses/integration-response.dto.ts`, `integrations.controller.ts`
- 상세: 기존 `OAuthBeginResultDto` 는 모든 필드를 optional 로 선언한 단일 DTO였다. 이번 변경으로 `OAuthBeginPopupResultDto` 와 `OAuthBeginCafe24PendingResultDto` 두 개의 DTO 로 분리되었고, 각각의 필드가 required(`!`) 로 변경되었다. Swagger 스키마가 `{ data: <ref> }` 단일 $ref 에서 `{ data: { oneOf: [...] } }` 로 바뀌므로 Swagger 문서를 기반으로 클라이언트 타입을 자동 생성(예: openapi-generator)하는 환경에서는 breaking change 에 해당한다. 런타임 응답 shape 자체는 기존 클라이언트가 optional 필드로 처리하고 있었다면 실질적 영향은 없으나, API 스펙 수준에서 변경이 크다.
- 제안: 해당 엔드포인트의 API 버전 명시 또는 changelog 주석을 컨트롤러에 추가하고, 기존 클라이언트(특히 프론트엔드의 OAuth begin 응답 타입)가 새 분기형 타입을 올바르게 반영하는지 확인. 동시에 기존 필드명 `authorizeUrl` → (삭제되고) `authUrl` 로 변경된 점도 주의: 기존 코드가 `authorizeUrl` 을 참조하고 있었다면 런타임 오류 발생.

### [WARNING] 기존 `authorizeUrl` 필드 제거 — 잠재적 런타임 breaking change
- 위치: `integration-response.dto.ts` diff (라인 569-570 삭제)
- 상세: 기존 `OAuthBeginResultDto` 의 `authorizeUrl?: string` 필드가 제거되고 `OAuthBeginPopupResultDto` 의 `authUrl!: string` 으로 대체되었다. 필드 이름이 `authorizeUrl` 에서 `authUrl` 로 변경된 것이므로, 프론트엔드나 다른 클라이언트가 `authorizeUrl` 을 참조하고 있다면 런타임에서 `undefined` 를 받게 된다. diff 에서 서비스 레이어가 반환하는 실제 객체 키를 확인할 수 없으므로, `integration-oauth.service.ts` 의 popup 분기 리턴값이 `authUrl` 키를 사용하는지 명시적으로 검증이 필요하다.
- 제안: `integration-oauth.service.ts` 에서 popup 분기 반환값의 키 이름을 `authUrl` 로 통일했는지 확인. 프론트엔드 코드에서 `authorizeUrl` 참조를 검색해 일괄 변경 여부를 점검.

### [INFO] `oneOf` 스키마에 OpenAPI `discriminator` 선언 없음
- 위치: `backend/src/common/swagger/api-wrapped.ts` — `wrapOneOfDataSchema` 함수
- 상세: `oneOf` 를 사용하는 경우 OpenAPI 3.0 권고사항은 `discriminator` 필드를 함께 선언해 클라이언트 코드 생성기가 타입 분기를 정확히 파악하도록 하는 것이다. 현재 구현에서는 `discriminator` 없이 `oneOf` 배열만 선언하고 있어, 자동 생성 클라이언트에서 분기 처리가 명시적이지 않다. 주석에서 "각 DTO 가 `discriminator` 역할의 필드(예: `mode`)를 자체적으로 강제한다"고 설명하지만, 스키마 수준에서 OpenAPI `discriminator` 로 명시되지 않으면 일부 도구에서 활용하지 못한다.
- 제안: `wrapOneOfDataSchema` 에 선택적으로 `discriminatorPropertyName` 파라미터를 추가하고, 전달된 경우 `{ oneOf: [...], discriminator: { propertyName: '...' } }` 형태로 스키마를 생성하는 오버로드를 제공하는 것을 검토.

### [INFO] 세 개의 OAuth 엔드포인트에서 `scopesAdded?` 포함 여부 설명 불일치
- 위치: `integrations.controller.ts` 라인 798, 815, 832 (각 `@ApiOkWrappedOneOfResponse` 의 `description`)
- 상세: `beginOAuth` 엔드포인트의 description 에는 `scopesAdded?` 가 포함되어 있고, `reauthorize` 엔드포인트 description 에는 포함되지 않으며, `requestScopes` 엔드포인트 description 에는 `scopesAdded` (non-optional 표기)로 나와 있다. 실제 DTO(`OAuthBeginCafe24PendingResultDto`)에서 `scopesAdded` 는 optional 이므로, 세 description 사이의 일관성이 없다.
- 제안: 세 엔드포인트의 description 에서 `scopesAdded?` 표기를 일관되게 맞추거나, 각 엔드포인트별 실제 채워지는 조건을 명확히 기술.

## 요약

이번 변경의 핵심은 OAuth 시작 응답 DTO 를 단일 optional-field DTO 에서 분기별 required-field DTO 쌍(`OAuthBeginPopupResultDto` / `OAuthBeginCafe24PendingResultDto`)으로 분리하고, Swagger 스키마를 `oneOf` 형태로 문서화한 것이다. Swagger 문서 정확성은 크게 개선되었으나, 기존 `authorizeUrl` 필드가 `authUrl` 로 이름이 변경된 부분이 런타임 breaking change 가 될 수 있어 프론트엔드 연동부 점검이 필요하다. 또한 `wrapOneOfDataSchema` 에 OpenAPI `discriminator` 선언이 없어 일부 자동 생성 클라이언트에서 분기 처리가 불명확할 수 있다. DB 마이그레이션 설정 파일·테스트 파일·주석 영문화 변경 등 나머지 파일들은 API 계약과 직접 관련이 없다.

## 위험도

MEDIUM
