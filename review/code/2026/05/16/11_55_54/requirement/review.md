# 요구사항(Requirement) Review

대상 세션: `review/code/2026/05/16/11_55_54`
분석 파일 수: 42개

---

## 발견사항

### 파일 5: integration-expiry-scanner.service.spec.ts — REQ-C1 테스트의 TypeORM 내부 구조 의존

- **[WARNING]** TypeORM 내부 `_value` 프로퍼티 직접 검사로 구현 세부사항에 결합
  - 위치: `integration-expiry-scanner.service.spec.ts` — `excludes pending_install from the run() candidate query (REQ-C1)` it 블록
  - 상세: `statusOp._value._value` 경로를 통해 TypeORM의 `Not(In([...]))` 연산자 내부 구조를 검사하고 있다. 이 접근법은 TypeORM 마이너 버전 업그레이드 시 내부 직렬화 구조가 변경되면 테스트가 false-negative로 깨질 수 있다. RESOLUTION.md의 I8 항목에서 이미 인식하고 있으나, `expect.arrayContaining` 어설션이 `pending_install` 이 배열 안에 있는지만 확인하며 `Not` 래핑 자체(즉 제외 의도)는 _value 체이닝에 의존하므로 위험이 잔존한다.
  - 제안: TypeORM operator 내부 구조 대신 `find()` 호출 결과 자체를 검증하거나, 서비스 메서드 레벨에서 `pending_install` 상태인 integration이 실제로 처리되지 않음을 검증하는 e2e 또는 통합 테스트를 추가한다.

### 파일 6: integration-oauth.service.cafe24.spec.ts — Cafe24 Public 분기 단언의 DTO 타입 캐스트 취약성

- **[WARNING]** `result as Record<string, unknown>` 캐스트를 통한 DTO 분기 필드 부재 검증은 컴파일 타임 보호를 제공하지 않음
  - 위치: `integration-oauth.service.cafe24.spec.ts` — Public/Private 분기 단언 블록 (L673-677, L689-691)
  - 상세: `beginOAuth`의 반환 타입이 `OAuthBeginPopupResultDto | OAuthBeginCafe24PendingResultDto`로 분기되었을 경우, `as Record<string, unknown>` 캐스트로 필드 부재를 검증하는 패턴은 런타임에서만 의미가 있다. 만약 반환 타입이 이후 `any` 또는 `object`로 느슨해지면 단언이 항상 통과하여 회귀를 잡지 못한다. 또한 `authUrl`이 `authorizeUrl`에서 이름 변경된 사실을 고려할 때, 구 필드명으로 검사하는 잔여 코드가 없는지 확인이 필요하다.
  - 제안: `instanceof` 타입 가드 또는 `discriminator` 필드(`mode`)를 기반으로 분기를 단언하여 컴파일 타임 안전성을 확보한다.

### 파일 4: integration-response.dto.ts — `OAuthBeginPopupResultDto`의 `authUrl` 필드명과 wire format 정합 검증 필요

- **[WARNING]** RESOLUTION.md W1에서 `authorizeUrl` → `authUrl` 수정이 "DTO/wire 불일치 버그 해소"로 기술되어 있으나, 해당 변경이 controller 반환값 매핑에도 반영되었는지 diff에서 직접 확인 불가
  - 위치: `integration-response.dto.ts` — `OAuthBeginPopupResultDto.authUrl` (L546)
  - 상세: diff에는 DTO 클래스 추가만 포함되어 있고, 실제 서비스 레이어(`integration-oauth.service.ts`)에서 반환 객체를 구성할 때 `authUrl` 필드가 올바르게 채워지는지에 대한 검증은 이번 변경 범위에서 명시적으로 확인되지 않는다. 기존 `authorizeUrl`로 세팅하던 코드가 남아있다면 런타임에 `authUrl`이 `undefined`가 된다.
  - 제안: `integration-oauth.service.ts`에서 popup 결과 반환 시 `authUrl` 키를 명시적으로 사용하는지 확인하고, 단위 테스트에서 `result.authUrl`이 URL 문자열임을 단언한다.

### 파일 17: cafe24-token-refresh.processor.spec.ts — `propagates refreshAccessToken failure` 테스트 이동 후 중복 여부

- **[INFO]** 삭제된 테스트 블록(L1292-1307)과 파일 하단에 동일 내용이 재위치(L1418-1432)하여 기능 보존은 확인되나, 삭제 diff가 추가 diff보다 위에 있어 리뷰어에게 혼란을 줄 수 있음
  - 위치: `cafe24-token-refresh.processor.spec.ts` diff — 삭제된 it 블록 (L1292-1307) / 잔류한 it 블록 (L1418-1432)
  - 상세: RESOLUTION.md W7에서 "중복 제거"로 기술하고 있으나, 실제로는 파일 순서 재배치처럼 보인다. 원래 위치에 있던 테스트가 삭제되고 더 아래에 동일 내용이 그대로 남아 있으므로, 실제로 중복이 제거되었는지 아니면 순서가 조정된 것인지 불명확하다. 전체 파일 컨텍스트를 보면 파일 끝에 동일 it 블록이 있으므로 기능 보존은 되어 있으나 설명과 실제 동작의 차이가 존재한다.
  - 제안: RESOLUTION.md의 W7 설명을 "중복 제거"에서 "테스트 위치 재배치"로 정정하거나, 실제로 중복이 있었다면 어느 것을 제거했는지 명시한다.

### 파일 7: integration-oauth.service.ts — `urlToken` 파라미터 미사용 처리

- **[INFO]** `urlToken`을 파라미터에서 구조 분해하지 않도록 변경하면서 JSDoc 수준의 설명을 인라인 주석으로 남겼으나, 이는 향후 오해의 소지가 있음
  - 위치: `integration-oauth.service.ts` — L1715-1719
  - 상세: `urlToken`이 파라미터 타입에는 존재하지만 함수 본문에서 사용하지 않기 때문에 TypeScript strict 모드에서는 unused variable 경고가 발생할 수 있다(실제로는 구조 분해에서 제외했으므로 괜찮다). 다만 "caller-side documentation" 목적으로 타입에 남겨두는 패턴은 의도와 구현의 괴리처럼 보일 수 있으며, 향후 개발자가 해당 파라미터를 실수로 삭제하거나 사용하려 할 때 혼란을 준다.
  - 제안: `_urlToken` 접두사를 사용하거나, JSDoc에서 caller-side documentation 목적임을 명시하는 주석을 파라미터 타입 정의 쪽에 추가한다.

### 파일 2: api-wrapped.ts — `wrapOneOfDataSchema`의 빈 배열 입력 미처리

- **[WARNING]** `dtos`가 빈 배열로 전달될 경우 `oneOf: []`인 스키마가 생성되어 Swagger 상 아무 타입도 매칭되지 않는 무효 스키마가 된다
  - 위치: `api-wrapped.ts` — `wrapOneOfDataSchema` 함수 (L154-166)
  - 상세: `dtos.map(...)` 는 빈 배열이 들어오면 `oneOf: []`를 반환한다. OpenAPI 스펙에서 `oneOf: []`는 유효하지 않으며(적어도 하나의 서브스키마가 있어야 한다), 일부 Swagger 파서에서 예외가 발생하거나 빈 응답 타입으로 표시될 수 있다. 또한 `ApiExtraModels(...dtos)`에서도 빈 spread가 전달된다.
  - 제안: `wrapOneOfDataSchema` 상단에 `if (dtos.length === 0) throw new Error('wrapOneOfDataSchema requires at least one DTO')` 가드를 추가한다. `ApiOkWrappedOneOfResponse`도 동일하게 처리한다.

### 파일 41: plan/in-progress/spec-update-cafe24-background-refresh.md — 기능 완전성 미결 항목

- **[WARNING]** `enqueueCafe24BackgroundRefresh` 흐름이 구현은 완료되었으나 spec에 문서화되지 않은 상태로 이 PR에서 해소되지 않는다
  - 위치: `plan/in-progress/spec-update-cafe24-background-refresh.md` — "진행 상태" 섹션 (모든 체크박스 미체크)
  - 상세: BullMQ `cafe24-background-refresh` job이 실제로 구현되어 운영 환경에서 동작 중이나, `spec/2-navigation/4-integration.md §11`에는 3개 job만 기술되어 있어 spec과 구현이 불일치한다. 이 plan 문서가 생성되었으나 모든 항목이 미완료 상태다. RESOLUTION.md에서 W9 항목으로 기록되어 project-planner 위임 대기 중이지만, 구현과 spec의 불일치가 언제까지 허용될지 명시되어 있지 않다.
  - 제안: 이 PR이 병합되기 전에 spec 갱신이 선행되거나, 아니면 spec 갱신 PR을 후속 작업으로 즉시 생성하여 추적 가능한 상태를 만든다. 현재 plan의 미체크 항목이 있으므로 `plan/complete/`로 이동하면 안 된다.

### 파일 29: parallel.schema.spec.ts — 단일 테스트의 두 독립 어설션 유지

- **[INFO]** `branchCount: 1` 입력에 대해 `warningRules` 발생 메시지와 `validateConfig` 발생 메시지를 동일 it 블록에서 함께 단언함
  - 위치: `parallel.schema.spec.ts` — branchCount out-of-range it 블록 (L625-633)
  - 상세: `branchCount must be 2 to 16.`(warningRule)과 `branchCount must be a value between 2 and 16.`(validateConfig) 두 메시지가 서로 다른 경로에서 발생하는 것을 하나의 it에서 확인한다. 포맷 정리(줄바꿈 제거)만 이루어졌으며 로직 변화는 없다. 두 메시지가 거의 동일한 의미를 전달하므로 사용자에게 중복 경고가 노출될 가능성이 있다.
  - 제안: `warningRules` 메시지와 `validateConfig` 메시지의 중복 여부를 명시적으로 결정하고, 동일 의미의 메시지라면 하나를 제거하거나 두 경로 간 우선순위를 spec에 명시한다.

### 파일 1: V050 마이그레이션 conf — `executeInTransaction=false` 위험성 대응 미흡

- **[INFO]** 주석에서 트랜잭션 비활성화의 이유를 잘 설명하지만, 마이그레이션 실패 시 부분 적용 상태에서의 롤백 전략이 언급되지 않음
  - 위치: `V050__integration_cafe24_connected_rotated_idx.conf` — 전체 파일
  - 상세: `CREATE INDEX CONCURRENTLY` 는 실패 시 "invalid" 상태의 인덱스를 남길 수 있다. Flyway가 트랜잭션을 사용하지 않으므로 실패 시 Flyway 체크섬은 실패로 기록되지만 부분 상태의 인덱스가 DB에 남아 후속 실행에서 `CONCURRENTLY` 재시도도 불가능하다(invalid 인덱스 먼저 삭제 필요). 주석이 이 위험을 언급하지 않는다.
  - 제안: 주석에 "실패 시 `DROP INDEX CONCURRENTLY IF EXISTS <index_name>;` 수동 실행 후 Flyway repair 필요" 안내를 1줄 추가한다.

---

## 요약

이번 변경셋은 크게 세 관심사를 처리한다. (1) OAuth 응답 DTO를 단일 union 클래스에서 `OAuthBeginPopupResultDto` / `OAuthBeginCafe24PendingResultDto` 두 개의 명시적 분기 클래스로 분리하고 Swagger `oneOf` 스키마로 문서화, (2) 영문 SoT 전환에 따른 테스트·주석의 "Korean warning" 문구 일괄 제거, (3) 기존 리뷰(11_04_17) 지적사항 조치. 기능 완전성 측면에서는 대부분 요구사항이 충실히 반영되어 있으나, `wrapOneOfDataSchema`의 빈 배열 미검증(요구사항상 항상 2개 이상의 DTO가 전달되어야 의미있는 oneOf가 됨), `OAuthBeginPopupResultDto.authUrl`의 실제 wire 연결 여부 확인 누락, TypeORM 내부 구조에 의존한 `pending_install` 제외 테스트, 그리고 `enqueueCafe24BackgroundRefresh`의 spec 미문서화가 남은 위험 요소다. 특히 spec과 구현의 불일치(파일 41)는 SDD 원칙상 이 PR과 함께 해소되어야 하지만 현재 후속 plan으로 위임된 상태다.

---

## 위험도

MEDIUM
