# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `OAuthBeginResultDto` 클래스 삭제 및 `OAuthBeginPopupResultDto` / `OAuthBeginCafe24PendingResultDto` 로 분리 — 공개 DTO 인터페이스 변경
  - 위치: `backend/src/modules/integrations/dto/responses/integration-response.dto.ts` 파일 4 (전체 diff)
  - 상세: 기존 단일 클래스 `OAuthBeginResultDto` 가 두 개의 별도 클래스로 교체되었다. `integration-oauth.service.ts` 의 반환 타입이 이 DTO 를 직접 참조하고 있었다면 컴파일 오류가 발생하지만, diff 범위 내에서 서비스 파일(파일 7)은 반환 타입 어노테이션보다 구현 로직 리팩토링만 포함하고 있다. 컨트롤러(파일 8)는 이미 `OAuthBeginPopupResultDto` / `OAuthBeginCafe24PendingResultDto` 를 임포트하도록 변경되었다. 단, 이 diff 범위 밖의 다른 임포터(예: e2e 테스트, 타입 단언 코드)가 `OAuthBeginResultDto` 를 여전히 참조하는 경우 런타임 오류 없이 컴파일 오류만 발생한다 — 즉각적인 런타임 부작용은 없으나 빌드 단계에서 확인이 필요하다.
  - 제안: `grep -r 'OAuthBeginResultDto'` 로 전체 레포지터리 참조를 확인하고, 남은 임포트가 없는지 검증한다.

- **[INFO]** `OAuthBeginResultDto` 의 필드 `authorizeUrl` → `authUrl` 으로 이름 변경
  - 위치: `integration-response.dto.ts` diff, `-  authorizeUrl?: string;` → `+  authUrl!: string;` (파일 4)
  - 상세: 기존 optional `authorizeUrl` 필드가 `OAuthBeginPopupResultDto` 에서 required `authUrl` 로 바뀌었다. 클라이언트 코드(프론트엔드)가 `authorizeUrl` 키를 직접 접근하고 있다면 `undefined` 를 반환하는 런타임 부작용이 생긴다. 이 변경은 API 응답 shape 의 변경이므로 프론트엔드 소비자에게 영향을 미친다.
  - 제안: `frontend/` 전체에서 `authorizeUrl` 참조를 검색하고 `authUrl` 로 일괄 교체되었는지 확인한다. API 계약 변경이므로 프론트엔드 팀과의 조율 혹은 e2e 테스트로 검증한다.

- **[WARNING]** `OAuthBeginResultDto` 의 필드가 모두 `optional` → `required` 로 변경 — 기존 직렬화 호환성 저하
  - 위치: `integration-response.dto.ts` diff (파일 4), `OAuthBeginCafe24PendingResultDto` 의 `integrationId`, `appUrl`, `callbackUrl`, `mode`
  - 상세: 이전 DTO 는 모든 분기 필드를 optional 로 선언해 단일 클래스로 두 분기를 수용했다. 이제 각 DTO 의 분기 전용 필드는 required(`!`) 로 선언되었다. 서비스 레이어(`integration-oauth.service.ts`)가 실제로 두 분기를 올바르게 채우지 않으면 런타임에 `undefined` 필드가 직렬화될 수 있다. TypeScript 타입 시스템이 컴파일 시점에 잡아주지만, `as` cast 가 포함된 경로(파일 6, `result as Record<string, unknown>`)는 타입 검사를 우회한다.
  - 제안: `integration-oauth.service.ts` 의 두 분기 반환 객체가 각 DTO 의 required 필드를 모두 채우는지 단위 테스트로 명시적으로 단언한다. 현재 추가된 테스트(파일 6)는 반대 방향(없어야 할 필드 부재)만 단언하므로, 있어야 할 필드 존재 여부도 같이 단언하면 더 안전하다.

- **[INFO]** `integrations.controller.ts` 에서 Swagger 데코레이터 `@ApiOkWrappedResponse(OAuthBeginResultDto)` → `@ApiOkWrappedOneOfResponse([...])` 로 교체 — Swagger 런타임 스키마 레지스트리 변경
  - 위치: `integrations.controller.ts` diff (파일 8), 세 엔드포인트 모두
  - 상세: `@ApiExtraModels` 에 등록되는 모델 목록이 변경된다. NestJS/Swagger 는 애플리케이션 부트스트랩 시점에 `@ApiExtraModels` 로 전달된 클래스를 OpenAPI 스키마 레지스트리에 추가한다. 이는 런타임 모듈 초기화 단계의 사이드이펙트이며, 이전에 등록되던 `OAuthBeginResultDto` 가 더 이상 등록되지 않고 두 새 클래스가 등록된다. 다른 엔드포인트가 `OAuthBeginResultDto` 를 `@ApiExtraModels` 없이 `$ref` 로 참조하고 있다면 Swagger 문서에서 해당 `$ref` 가 깨질 수 있다.
  - 제안: 전체 컨트롤러 파일에서 `OAuthBeginResultDto` 참조를 검색해 완전히 제거되었는지 확인한다.

- **[INFO]** `integration-oauth.service.ts` 의 `tryRecoverFromHmacMismatch` 에서 `urlToken` 비구조화 제거
  - 위치: `integration-oauth.service.ts` diff (파일 7), 라인 1356-1719
  - 상세: `const { urlToken, query } = params;` 에서 `const { query } = params;` 로 변경되어 `urlToken` 로컬 변수가 제거되었다. 함수 내부에서 `urlToken` 를 실제로 사용하지 않았다면 이 변경은 동작에 영향이 없다. 단, 주석에서 "kept on the params type for caller-side documentation" 이라고 명시하고 있으므로 매개변수 타입 자체는 유지된다 — 함수 시그니처 변경은 없다.
  - 제안: 이슈 없음. 불필요한 로컬 변수 제거로 순수한 리팩토링이다.

- **[INFO]** `formUrlEncode` 함수 내부 리팩토링 — 괄호 추가로 반환식 재구성
  - 위치: `integration-oauth.service.ts` diff (파일 7), `formUrlEncode` 함수
  - 상세: `return encodeURIComponent(value).replace(...)...` 에서 `return ( encodeURIComponent(value).replace(...)... )` 로 변경. 동작은 동일하며 포맷터(Prettier)에 의한 스타일 변경이다. 부작용 없음.
  - 제안: 이슈 없음.

- **[INFO]** `cafe24-token-refresh.processor.spec.ts` — 중복 테스트 케이스 제거 (TEST-C2 첫 번째 인스턴스)
  - 위치: `cafe24-token-refresh.processor.spec.ts` diff (파일 17)
  - 상세: diff 에서 `-` 로 제거된 it 블록(`propagates refreshAccessToken failure`)은 전체 파일 컨텍스트를 보면 파일 하단에 동일한 내용의 테스트가 그대로 남아 있다. 즉 중복 케이스 중 하나를 제거한 것이며, 커버리지 손실은 없다. 부작용 없음.
  - 제안: 이슈 없음. 단, 중복 제거 의도를 커밋 메시지에 명시하면 추후 이력 추적에 도움이 된다.

- **[INFO]** Flyway `.conf` 파일에 주석 추가 (`executeInTransaction=false` 설정 설명)
  - 위치: `backend/migrations/V050__integration_cafe24_connected_rotated_idx.conf` (파일 1)
  - 상세: 실제 설정값(`executeInTransaction=false`)은 변경되지 않고 주석만 추가되었다. Flyway 는 `.conf` 파일에서 `#` 으로 시작하는 줄을 주석으로 처리하므로 동작에 영향이 없다. 파일시스템 부작용 없음.
  - 제안: 이슈 없음.

- **[INFO]** 테스트 케이스 이름에서 "Korean" 제거 — 다수 `.spec.ts` 파일
  - 위치: 파일 3, 10, 12, 14, 15, 16, 18, 19, 20, 21, 22, 23, 25, 26, 27, 29, 31, 32, 33, 35
  - 상세: `it('emits Korean warnings ...')` → `it('emits warnings ...')` 형태의 이름 변경. 실제 테스트 로직·단언(assertion) 은 전혀 변경되지 않았다. 부작용 없음.
  - 제안: 이슈 없음.

- **[INFO]** `node-component.interface.ts` JSDoc 주석 변경 — "Returns Korean messages" → "Returns warning messages"
  - 위치: `backend/src/nodes/core/node-component.interface.ts` (파일 13)
  - 상세: 인터페이스 본문 및 시그니처 변경 없음. 문서 주석만 변경. 부작용 없음.
  - 제안: 이슈 없음.

- **[INFO]** `llm-provider-rule.ts` 파일 주석 추가 ("Language SoT" 섹션)
  - 위치: `backend/src/nodes/ai/llm-provider-rule.ts` (파일 11)
  - 상세: `AI_NO_LLM_PROVIDER_MESSAGE` 상수 값 자체는 변경되지 않았다. 주석만 추가됨. 부작용 없음. 단, 주석이 "영문 원본을 바꿀 때 `WARNING_KO` 의 매핑 키도 동시 갱신해야 한다"고 명시한다 — 이는 미래 부작용을 방지하는 문서화 목적이다.
  - 제안: 이슈 없음. 단, `frontend/src/lib/i18n/backend-labels.ts` 의 `WARNING_KO` 맵에 현재 영문 키(`'LLM provider or model must be selected...'`)가 등록되어 있는지 사전 확인을 권장한다.

- **[INFO]** `wrapOneOfDataSchema` / `ApiOkWrappedOneOfResponse` 신규 함수 추가 — 공개 모듈 인터페이스 확장
  - 위치: `backend/src/common/swagger/api-wrapped.ts` (파일 2)
  - 상세: 기존 함수를 수정하지 않고 새 함수 두 개를 추가했다. 기존 호출자는 영향을 받지 않는다. `ApiOkWrappedOneOfResponse` 는 `applyDecorators` 를 통해 NestJS DI 컨텍스트 밖에서도 호출 가능한 순수 데코레이터 팩토리다. 모듈 로드 시점에 `getSchemaPath(d)` 를 호출하는데, 이는 Swagger 스키마 레지스트리에서 참조를 조회하는 순수 함수로 외부 상태 변경이 없다.
  - 제안: 이슈 없음.

- **[INFO]** `integration-expiry-scanner.service.spec.ts` 에 TypeORM 내부 구조(`_value._value`)를 직접 검사하는 테스트 추가
  - 위치: `integration-expiry-scanner.service.spec.ts` diff (파일 5), REQ-C1 테스트
  - 상세: `statusOp._value._value` 처럼 TypeORM 내부 구현 세부사항에 의존하는 단언을 추가했다. 이는 TypeORM 버전 업그레이드 시 내부 구조가 변경되면 테스트가 false-fail 할 수 있는 부서지기 쉬운(brittle) 패턴이다. 직접적인 런타임 부작용은 없지만 유지보수 위험이 있다.
  - 제안: 내부 `_value` 접근 대신 실제 쿼리 결과나 mock 동작을 검증하는 방향으로 테스트를 개선하는 것을 검토한다.

- **[INFO]** `if-else.schema.ts` / `variable-declaration.schema.ts` 에서 문자열 리터럴 따옴표 스타일 변경
  - 위치: 파일 24 (`if-else.schema.ts`), 파일 34 (`variable-declaration.schema.ts`)
  - 상세: `'First condition\'s field must be entered.'` → `"First condition's field must be entered."` 형태의 escape 제거. 런타임 문자열 값은 동일하다. 부작용 없음.
  - 제안: 이슈 없음.

## 요약

이번 변경의 핵심 부작용 위험은 `OAuthBeginResultDto` → `OAuthBeginPopupResultDto` / `OAuthBeginCafe24PendingResultDto` 분리에 따른 **공개 API shape 변경**이다. 특히 `authorizeUrl` 필드가 `authUrl` 로 이름이 바뀐 점은 프론트엔드 소비자에게 런타임 `undefined` 부작용을 줄 수 있으므로, 프론트엔드 전체에서 `authorizeUrl` 참조가 남아 있지 않은지 반드시 확인해야 한다. 나머지 변경은 대부분 Prettier 포맷팅, 테스트 케이스 이름 언어 정규화, 주석 추가, 중복 테스트 제거, 신규 Swagger 헬퍼 함수 추가로, 의도하지 않은 부작용이 없다. `TypeORM _value._value` 내부 구조에 직접 의존하는 테스트 단언은 장기적으로 유지보수 위험이 있어 주의가 필요하다.

## 위험도

LOW
