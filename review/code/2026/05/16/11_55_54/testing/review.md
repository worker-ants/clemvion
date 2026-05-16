# 테스트(Testing) 리뷰

## 발견사항

### 테스트 존재 여부 / 커버리지 갭

- **[WARNING]** `wrapOneOfDataSchema` / `ApiOkWrappedOneOfResponse` 함수 자체에 대한 단위 테스트 없음
  - 위치: `backend/src/common/swagger/api-wrapped.ts` (신규 함수 2개)
  - 상세: `wrapOneOfDataSchema`는 `dtos` 배열을 받아 `$ref` 배열로 변환하고, `ApiOkWrappedOneOfResponse`는 `applyDecorators` 조합을 반환한다. `wrapDataSchema` 등 기존 유사 함수도 단위 테스트가 없다면 프로젝트 전반적인 swagger helper 테스트 정책상 일관성 있는 누락이나, 새 함수 추가 시점에 동작을 검증하는 테스트를 추가하는 것이 권장된다.
  - 제안: `wrapOneOfDataSchema(['Dto1', 'Dto2'])` 호출 시 `{ type: 'object', required: ['data'], properties: { data: { oneOf: [...] } } }` 형태를 반환하는지 검증하는 단위 테스트를 `api-wrapped.spec.ts`(신규)에 추가. 빈 배열, 단일 dto, 복수 dto 케이스를 모두 포함.

- **[WARNING]** `formUrlEncode` 함수(파일 7, `integration-oauth.service.ts`) 변경에 대한 전용 단위 테스트 없음
  - 위치: `backend/src/modules/integrations/integration-oauth.service.ts`, `formUrlEncode` 함수 (diff line 1602)
  - 상세: 이 변경은 코드 포맷팅 변경이어서 동작 변경은 없으나, `formUrlEncode` 함수 자체는 Java URLEncoder 호환을 목표로 하는 중요 보안 로직이다. 현재 `.spec.ts` 파일에 이 함수에 대한 단위 테스트가 존재하는지 확인이 필요하다. `!`, `'`, `(`, `)`, `~` 등 특수 문자 처리 정확성을 검증하는 테스트가 없으면 회귀 위험이 있다.
  - 제안: `integration-oauth.service.cafe24.spec.ts` 또는 별도 파일에서 `formUrlEncode`를 export하거나 테스트 가능한 구조로 리팩터링 후, `!abc` → `%21abc`, 공백 → `+`, `~` → `%7E` 등 케이스를 단위 테스트로 추가.

- **[INFO]** `V050__integration_cafe24_connected_rotated_idx.conf` 변경은 설정 파일 주석 추가이므로 테스트 추가 불필요
  - 위치: `backend/migrations/V050__integration_cafe24_connected_rotated_idx.conf`
  - 상세: 순수 주석 추가이며, `backend/src/migrations.spec.ts`의 `.conf` 파일 네이밍 컨벤션 검사에서 자동으로 커버된다.
  - 제안: 해당 없음.

### Mock 적절성

- **[WARNING]** `integration-expiry-scanner.service.spec.ts`의 TypeORM 내부 구조(`_value._value`) 직접 검사
  - 위치: `backend/src/modules/integrations/integration-expiry-scanner.service.spec.ts`, `excludes pending_install from the run() candidate query (REQ-C1)` 테스트 (diff line +636~645)
  - 상세: `Not(In([...]))` 연산자의 내부 구현인 `statusOp._value._value`를 직접 단언하고 있다. TypeORM 내부 구조는 공개 API가 아니므로 TypeORM 버전 업그레이드 시 `_value` 필드명이나 중첩 구조가 변경될 경우 테스트가 오탐(false failure)을 일으킬 수 있다.
  - 제안: 실제 DB 쿼리 결과 또는 실제 엔티티를 여러 status로 insert 후 `run()`의 반환값을 검증하는 integration 테스트를 작성하거나, TypeORM의 `FindOperator`를 type-safe하게 검사하는 헬퍼 함수를 통해 구조 의존성을 캡슐화. 대안으로 `integrationRepo.find.mock.calls[0][0]`의 `where.status` 필드에 직접 `Not(In([...pending_install...]))` 팩토리 함수로 생성한 값을 `expect.objectContaining` 으로 비교.

### 엣지 케이스 테스트

- **[WARNING]** `wrapOneOfDataSchema`의 빈 배열 입력 케이스 미검증
  - 위치: `backend/src/common/swagger/api-wrapped.ts`, `wrapOneOfDataSchema` 함수
  - 상세: `dtos`가 빈 배열일 때 `{ oneOf: [] }`를 생성하며 이는 유효한 JSON Schema 이나 Swagger UI에서 아무 모델도 표시되지 않는다. 이 케이스에 대한 명시적 테스트나 가드가 없다.
  - 제안: 함수 내부에 `if (dtos.length === 0) throw new Error(...)` 가드를 추가하고 해당 엣지 케이스를 테스트. 또는 의도적 허용임을 주석으로 명시.

- **[INFO]** `OAuthBeginPopupResultDto` / `OAuthBeginCafe24PendingResultDto` DTO 분리에 따른 직렬화 엣지 케이스
  - 위치: `backend/src/modules/integrations/dto/responses/integration-response.dto.ts`
  - 상세: 기존 단일 `OAuthBeginResultDto`(모든 필드 optional)를 두 개의 전용 DTO로 분리했다. 분리 후 서비스 레이어가 잘못된 DTO 타입을 반환하거나 두 분기가 혼재될 경우의 런타임 동작은 `integration-oauth.service.cafe24.spec.ts`에서 `toBeUndefined()` 단언으로 부분 커버된다. 다만 class-validator 데코레이터가 두 DTO에 추가되지 않아 validation pipeline 통과 테스트가 없다.
  - 제안: e2e 테스트에서 `/oauth/begin` 엔드포인트의 실제 응답 shape을 검증하는 케이스를 추가하거나, controller 레벨 unit 테스트에서 응답 DTO 구조 일치를 검증.

### 테스트 격리

- **[INFO]** `migrations.spec.ts`의 `beforeAll`에서 실제 파일시스템 읽기
  - 위치: `backend/src/migrations.spec.ts`, `beforeAll(() => { entries = readdirSync(MIGRATIONS_DIR); })`
  - 상세: 실제 `backend/migrations/` 디렉토리를 읽는 테스트는 빌드 환경에 따라 경로가 달라지거나 디렉토리 구조 변경 시 실패할 수 있다. 그러나 이 테스트의 의도 자체가 "실제 마이그레이션 파일 목록에 대한 컨벤션 가드"이므로 설계상 의도된 결합이다.
  - 제안: 문서화 수준의 개선. 테스트 상단에 "이 테스트는 빌드 환경에 실제 migrations/ 디렉토리가 존재해야 통과한다"는 주석을 추가해 CI 환경 요건을 명시.

### 테스트 가독성

- **[INFO]** `cafe24-token-refresh.processor.spec.ts`에서 `propagates refreshAccessToken failure` 테스트가 삭제 후 재추가됨
  - 위치: `backend/src/nodes/integration/cafe24/cafe24-token-refresh.processor.spec.ts`
  - 상세: diff에서 이 테스트가 제거되었다가 전체 파일 컨텍스트(line 1422~1432)에 다시 등장한다. diff에서의 삭제는 해당 테스트가 파일 내 다른 위치로 이동된 것으로 보인다. 테스트 자체의 의도(`TEST-C2`, propagation invariant)와 주석은 명확하게 표현되어 있다.
  - 제안: 테스트 파일 내 순서 재배치 시 git diff가 "삭제 + 재추가"처럼 보이지 않도록 최소 이동 원칙을 유지. 기능상 이슈는 없음.

- **[INFO]** 다수 테스트 파일의 `it` 설명에서 "Korean" 제거 (`emits Korean warnings` → `emits warnings`)
  - 위치: 파일 10, 12, 14~16, 18~19, 21~23, 25~27
  - 상세: 메시지 언어가 영어로 변경된 것을 반영한 테스트 설명 일괄 갱신이다. 변경 내용은 일관성이 있고 의도를 잘 표현한다.
  - 제안: 없음. 올바른 처리.

### 회귀 테스트

- **[WARNING]** `integration-oauth.service.ts`에서 `urlToken` 비구조화 제거에 대한 명시적 테스트 없음
  - 위치: `backend/src/modules/integrations/integration-oauth.service.ts`, `findPendingInstallForRecovery` 함수 (diff line 1714~1719)
  - 상세: `const { urlToken, query } = params` → `const { query } = params`로 변경하여 `urlToken`을 사용하지 않게 되었다. 주석에는 "urlToken is kept on the params type for caller-side documentation"이라고 명시하지만, 실제로 `urlToken`을 무시하는 것이 회복(recovery) 로직에 영향이 없음을 직접 검증하는 테스트가 없다. `urlToken`이 과거에 사용되었다면 그 로직이 제거되었음을 검증하는 회귀 테스트가 필요하다.
  - 제안: `findPendingInstallForRecovery` 함수에 대한 단위 테스트에서 `urlToken`을 다양하게 변경해도 결과가 동일함을 확인하는 케이스 추가. 또는 함수 시그니처에서 `urlToken`을 완전히 제거하거나 `_urlToken`으로 명명하여 "의도적 미사용"을 타입 레벨에서 표현.

### 테스트 용이성

- **[INFO]** `ApiOkWrappedOneOfResponse` 데코레이터는 NestJS `applyDecorators` 패턴을 따르므로 단위 테스트가 복잡
  - 위치: `backend/src/common/swagger/api-wrapped.ts`
  - 상세: NestJS 데코레이터 조합은 클래스 메서드에 적용해야 효과를 검증할 수 있어 단위 테스트가 번거롭다. 그러나 `wrapOneOfDataSchema`(순수 함수)는 의존성 없이 단독 테스트 가능하다. 두 함수가 책임을 명확히 분리한 구조는 테스트 용이성 측면에서 양호하다.
  - 제안: `wrapOneOfDataSchema`를 최우선으로 테스트하고, 데코레이터 통합은 e2e/swagger-spec snapshot 테스트로 커버.

---

## 요약

이번 변경은 주로 (1) OAuth DTO 분리(`OAuthBeginResultDto` → `OAuthBeginPopupResultDto` + `OAuthBeginCafe24PendingResultDto`), (2) Swagger helper 함수 추가(`wrapOneOfDataSchema`, `ApiOkWrappedOneOfResponse`), (3) 메시지 언어 SoT 영문 전환에 따른 테스트 설명 일괄 갱신으로 구성된다. 메시지 언어 변경에 따른 테스트 설명 갱신은 전파가 완전하고 일관성 있게 처리되었다. DTO 분리 후 서비스 레이어의 분기 별 필드 부재를 검증하는 테스트(`toBeUndefined`)가 새로 추가된 점은 긍정적이다. 다만 신규 swagger helper 함수에 대한 단위 테스트가 없고, TypeORM 내부 구조를 직접 참조하는 `_value._value` 단언은 라이브러리 버전 의존성 위험을 내포하며, `urlToken` 비구조화 제거에 대한 명시적 회귀 테스트가 누락되어 있다. 전체적으로 테스트 커버리지는 허용 가능한 수준이나 swagger helper와 `formUrlEncode`에 대한 직접 검증을 보강하면 더 견고해진다.

## 위험도

MEDIUM
