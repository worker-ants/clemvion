# 성능(Performance) 리뷰

## 발견사항

- **[INFO]** `wrapOneOfDataSchema` 함수 내 `dtos.map(...)` 호출이 데코레이터 평가 시점마다 새 배열을 생성
  - 위치: `backend/src/common/swagger/api-wrapped.ts` L85, `wrapOneOfDataSchema` 함수 내부
  - 상세: `dtos.map((d) => ({ $ref: getSchemaPath(d) }))` 는 `ApiOkWrappedOneOfResponse` 가 호출될 때마다 새 객체 배열을 할당한다. NestJS 데코레이터는 모듈 초기화 시 한 번만 평가되므로 런타임 요청 경로에는 영향이 없다. 단, Swagger 문서 빌드 시점에 동일한 DTO 조합으로 여러 엔드포인트가 선언되어 있으면 각각 독립적인 배열이 생성된다. 현재 이 함수를 사용하는 엔드포인트 수가 소규모이므로 실질적 비용은 미미하다.
  - 제안: 성능보다 가독성이 중요한 Swagger 유틸리티 레이어이므로 현재 구현으로 충분하다. 만약 동일 DTO 조합이 다수 엔드포인트에서 반복 사용될 경우, 상수로 추출해 재사용하는 패턴을 고려할 수 있다 (예: `const OAUTH_BEGIN_DTOS = [OAuthBeginPopupResultDto, OAuthBeginCafe24PendingResultDto] as const`).

- **[INFO]** `formUrlEncode` 함수의 연쇄 `.replace()` 호출
  - 위치: `backend/src/modules/integrations/integration-oauth.service.ts` L1602-1748, `formUrlEncode` 함수
  - 상세: `encodeURIComponent(value)` 결과에 대해 6번의 `.replace()` 를 순차 체이닝한다. 각 호출이 새 문자열을 생성하므로 최대 6개의 중간 문자열 객체가 힙에 적재된다. 단, 이 함수는 HMAC 메시지 서명 시 호출되며 처리하는 문자열이 수십~수백 바이트 수준이다. 서명 연산 자체의 비용(crypto)에 비해 문자열 변환 비용은 무시할 수 있는 수준이다. 코드 리포맷(괄호 추가)은 기능 변경 없이 가독성만 개선한 것으로 성능 특성에 변화 없다.
  - 제안: 현 규모에서 최적화 불필요. 만약 매우 빈번하게 호출되는 핫패스가 된다면 단일 정규식 + `replace` callback 으로 통합할 수 있으나, 현재 HMAC 서명 경로에서는 과잉 최적화에 해당한다.

- **[INFO]** `migrations.spec.ts` 의 `readdirSync` 블로킹 I/O
  - 위치: `backend/src/migrations.spec.ts` L375-407, `beforeAll` 블록
  - 상세: `readdirSync(MIGRATIONS_DIR)` 는 동기 파일시스템 호출이다. 이 파일은 테스트 스펙으로, CI/CD 빌드 시점에만 실행된다. 테스트 환경에서의 단발성 동기 I/O 는 성능 문제가 아니며, 비동기 대안(`readdir`)으로 전환해도 실질적인 이득이 없다. 변경된 코드(코드 포맷팅 리포맷)는 기능에 영향을 주지 않는다.
  - 제안: 테스트 파일의 동기 I/O 는 허용 가능 패턴. 현재 구현 유지.

- **[INFO]** `findDuplicateVersions` 의 Set 기반 중복 탐지 알고리즘
  - 위치: `backend/src/migrations.spec.ts` L389-401, `findDuplicateVersions` 함수
  - 상세: O(n) 시간, O(n) 공간의 알고리즘으로 최적이다. 마이그레이션 파일 수가 수백 개 미만에 머물 것이 명백하므로 알고리즘 개선 여지 없음. 코드 포맷 변경만 이루어졌다.
  - 제안: 현재 구현 적절.

- **[INFO]** `OAuthBeginResultDto` 단일 클래스에서 `OAuthBeginPopupResultDto` / `OAuthBeginCafe24PendingResultDto` 두 클래스로 분리
  - 위치: `backend/src/modules/integrations/dto/responses/integration-response.dto.ts` L541-608
  - 상세: 하나의 모노리식 DTO 에 모든 필드를 optional 로 선언했던 기존 구조에서 두 개의 독립 DTO 로 분리된 변경이다. 성능 관점에서 클래스 인스턴스 크기는 실제 응답 직렬화 시 해당 분기에 필요한 필드만 포함하게 되어 불필요한 undefined 필드 직렬화가 제거된다. Swagger 메타데이터 등록(ApiExtraModels) 이 두 클래스에 대해 수행되므로 초기화 시 메모리 사용량이 소폭 증가하나, 데코레이터 메타데이터 비용은 애플리케이션 생애주기에서 무시 가능한 수준이다.
  - 제안: 성능 관점에서 중립~소폭 개선. 현 방향 유지.

- **[INFO]** `integration-expiry-scanner.service.spec.ts` 의 TypeORM operator 내부 구조(`_value`) 직접 접근
  - 위치: `backend/src/modules/integrations/integration-expiry-scanner.service.spec.ts` L636-645
  - 상세: 테스트에서 `statusOp._value._value` 와 같이 TypeORM 내부 operator 객체의 private-like 속성을 직접 검사한다. 기능적 위험(TypeORM 버전 업그레이드 시 내부 구조 변경으로 테스트 깨짐)은 별도 검토 사안이며, 성능 영향은 없다.
  - 제안: 성능 관점에서 이슈 없음.

## 요약

이번 변경 세트는 대부분 Swagger 문서화 개선, DTO 분리, 테스트 문구 리포맷, 코드 포맷팅 정규화로 구성되어 있어 성능에 직접적 영향을 주는 변경이 거의 없다. `wrapOneOfDataSchema` 의 매 호출 시 새 배열 할당과 `formUrlEncode` 의 다중 `.replace()` 체이닝은 모두 모듈 초기화 또는 저빈도 HMAC 서명 경로에서만 실행되어 운영 트래픽 경로에 실질적 부담을 주지 않는다. `readdirSync` 는 테스트 전용이므로 문제 없다. CRITICAL 또는 WARNING 등급의 성능 이슈는 발견되지 않았다.

## 위험도

NONE
