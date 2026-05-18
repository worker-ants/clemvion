# Testing Review — Cafe24 JWT exp fix

## 발견사항

---

### 1. 테스트 존재 여부

- **[INFO]** `parseJwtExp` 헬퍼 함수에 대한 전용 단위 테스트(`jwt-exp.spec.ts`)가 신규 추가됨
  - 위치: `codebase/backend/src/modules/integrations/jwt-exp.spec.ts` (신규)
  - 상세: 20개 이상의 케이스를 커버하며 정상 경로, 비정상 입력, null/undefined, 타입 에러 등을 망라함. 변경 코드 대비 테스트 커버리지가 충분히 확보됨.
  - 제안: 이미 적절함. 추가 조치 불필요.

- **[INFO]** `hasTimezoneDesignator` 함수(integration-oauth.service.ts 내 private 함수)와 `normalizeCafe24IsoTimezone` 함수(cafe24-api.client.ts 내 private 함수)에 대한 직접 단위 테스트가 없음
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts` 내 `hasTimezoneDesignator`, `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts` 내 `normalizeCafe24IsoTimezone`
  - 상세: 두 함수 모두 module-private 이라 직접 export 되지 않으나, 동일 정규식(`/Z$|[+-]\d{2}:?\d{2}$/`)을 각 파일에 중복 구현하고 있음. 간접 테스트(TZ-less ISO 케이스)는 상위 테스트에서 커버되고 있어 실질적 리스크는 낮음.
  - 제안: 현재 커버리지로 충분하나, 향후 정규식 변경 시 두 곳 모두 수정해야 함을 인지할 것. 동일 로직 중복은 아래 WARNING 참조.

---

### 2. 커버리지 갭

- **[WARNING]** `hasTimezoneDesignator` 정규식과 `normalizeCafe24IsoTimezone` 정규식이 두 파일에 중복 존재하나, 두 함수의 경계값 케이스가 각 파일의 테스트에서 대칭적으로 검증되지 않음
  - 위치: `integration-oauth.service.ts` (`hasTimezoneDesignator`, 라인 ~536) / `cafe24-api.client.ts` (`normalizeCafe24IsoTimezone`, 라인 ~1389)
  - 상세: `cafe24-api.client.spec.ts`의 refresh 경로에서 TZ-less ISO는 하나의 구체적인 케이스(`'2026-12-21T07:09:50.000'`)만 검증함. 반면 `integration-oauth.service.cafe24.spec.ts`는 동일 케이스를 동일 문자열로 검증. 두 테스트 파일이 사실상 같은 단일 케이스만 공유하며, 경계값 예시(`+09:00` 이미 포함된 경우, `Z` suffix, `±HHMM`(콜론 없는 형식) 등)가 `cafe24-api.client.spec.ts` refresh 경로에서는 검증되지 않음.
  - 제안: `cafe24-api.client.spec.ts`의 refresh 경로에 `+09:00` 이미 있는 ISO와 `Z` suffix ISO가 double-normalization 없이 올바르게 처리되는지 케이스 1~2개 추가를 권장.

- **[WARNING]** `refreshAccessToken` 내 `normalizeCafe24IsoTimezone` 적용 후 `Date.parse` 가 NaN을 반환하는 경로(완전히 잘못된 ISO 문자열)에 대한 테스트 없음
  - 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts` refresh 응답 expiresAt 계산 블록
  - 상세: `normalizeCafe24IsoTimezone` 적용 후 `Date.parse(normalized)` 가 `NaN`이면 2h default로 폴백하는 코드 경로(`expiresAtStr && Number.isFinite(Date.parse(normalizeCafe24IsoTimezone(expiresAtStr))) ? ... : new Date(Date.now() + 2 * 60 * 60 * 1000)`)가 있으나, 해당 폴백 분기가 실제로 동작하는지 검증하는 테스트가 없음.
  - 제안: `expires_at`가 완전히 비파싱 가능한 문자열일 때 2h default가 적용됨을 확인하는 케이스 추가.

- **[INFO]** `parseTokenExpiresAt`의 `expires_in` 분기(Cafe24 미래 forward-compat)에 대한 테스트 없음
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts` `parseTokenExpiresAt`, cafe24 분기 2단계
  - 상세: 함수 주석에 "Cafe24가 향후 표준 준수 가능성 대비 backward-compatible"로 기재되어 있으나, 해당 경로(`expiresIn` 있을 때)는 `integration-oauth.service.cafe24.spec.ts`에서 검증되지 않음. 신규 추가된 3개 케이스는 JWT exp 우선 / JWT 비정상 ISO fallback / TZ-less ISO에 집중됨.
  - 제안: 낮은 우선순위. JWT exp 가 최우선이므로 이 분기가 실제 트리거되는 시나리오가 현재 없음. 기존 다른 provider 테스트로 간접 검증되는 것도 아님을 인지할 것.

---

### 3. 엣지 케이스 테스트

- **[INFO]** `parseJwtExp`에서 `exp` 가 정확히 `1`(최소 유효 양수 정수)인 케이스 테스트 없음
  - 위치: `jwt-exp.spec.ts`
  - 상세: `exp=0`은 null 반환(falsy reject)으로 검증되어 있고, `exp=-1`도 null로 검증됨. `exp=1`(1970-01-01 00:00:01 UTC)은 기술적으로 양수 finite 이므로 `1000`을 반환해야 하나, 이는 의미상으로는 사실상 만료된 토큰. 현재 구현상 `exp <= 0` 가드이므로 `exp=1`은 `1000`을 반환함. 이 동작이 의도된 것인지 명시적 케이스가 없음.
  - 제안: `exp = 1` 케이스를 `1000` 반환 예상으로 테스트에 추가하거나, 또는 과거 만료 시각(ex: `exp < Date.now()/1000`)에 대한 처리 정책을 코드와 테스트에 명시할 것. 현재 caller(`parseTokenExpiresAt`)가 이미 과거인 exp를 별도 처리하지 않으므로, 최소한 문서화로 의도를 명확히 할 것.

- **[INFO]** `reactive_401` 경로에서 `waitUntilFinished` 타임아웃이 발생했을 때의 동작 테스트 없음
  - 위치: `cafe24-api.client.spec.ts` 내 reactive 자가 회복 케이스
  - 상세: 신규 테스트(`401 reactive 자가 회복 — performAuthRefresh 가 reactive_401 source 로 enqueue + retry 성공`)는 성공 경로만 커버. `waitUntilFinished` reject 시(타임아웃 등) 어떻게 되는지 기존 테스트에서 커버되는지 확인 필요.
  - 제안: 타임아웃 실패 경로는 기존 `refresh 401 marks Integration as auth_failed` 계열 테스트에서 간접 커버될 수 있으나, `reactive_401` source 특화 에러 경로 케이스 명시를 권장.

---

### 4. Mock 적절성

- **[INFO]** `integration-oauth.service.cafe24.spec.ts`의 세 신규 테스트에서 `global.fetch`를 직접 교체하고 `finally`에서 복원하는 패턴 사용
  - 위치: `integration-oauth.service.cafe24.spec.ts` 라인 ~199, ~279, ~366
  - 상세: `(global as { fetch: jest.Mock }).fetch = fetchMock;` / `global.fetch = originalFetch;` 패턴이 이미 파일 내 다른 테스트에서도 사용 중이므로 일관된 접근. `finally` 블록으로 원복 보장도 되어 있음. 단, 테스트 실행 중 `handleCallback`이 throw하면 `integrationRepo.save.mock.calls[0]` 접근이 undefined일 수 있는 구조적 취약성이 있음.
  - 상세 보완: 첫 번째 케이스(`JWT exp 우선 채택`)에서 `expect(saved.tokenExpiresAt)`를 `try` 블록 안에서 직접 접근하므로, `handleCallback`이 에러 발생 시 save mock이 호출되지 않아 `mock.calls[0]`가 undefined가 되어 테스트가 모호한 에러로 실패할 수 있음.
  - 제안: `expect(integrationRepo.save).toHaveBeenCalledTimes(1)` 선행 어서션을 `mock.calls[0]` 접근 전에 추가하여 실패 원인을 명확히 할 것.

- **[INFO]** `cafe24-api.client.spec.ts` 신규 reactive 케이스에서 `refreshedAt` 변수가 테스트 상단에서 정의된 것으로 보이나 diff 컨텍스트에서 확인 불가
  - 위치: `cafe24-api.client.spec.ts` 라인 ~1190 (`refreshedAt.toISOString()`)
  - 상세: diff에서 `refreshedAt`이 어디서 정의되는지 보이지 않음. 기존 테스트 파일 내 공통 픽스처로 추정되나, 별도 확인 필요.
  - 제안: 리뷰어 메모. 구현 확인 후 이슈 없으면 무시.

---

### 5. 테스트 격리

- **[INFO]** 세 신규 서비스 테스트 모두 `process.env.OAUTH_STUB_MODE`를 `delete` 후 `finally`에서 `'true'`로 복원하는 패턴이 중복됨
  - 위치: `integration-oauth.service.cafe24.spec.ts` 신규 3개 케이스
  - 상세: 각 테스트가 독립적으로 환경변수를 관리하고 있어 격리는 보장되나, `beforeEach`/`afterEach`로 일괄 관리하지 않으므로 한 케이스에서 `finally` 이전에 프로세스가 종료되는 극단적 경우를 제외하면 실질적 문제 없음. 기존 파일의 패턴을 따르고 있어 일관성 유지.
  - 제안: 현재 패턴 유지 가능. 향후 해당 describe 블록에 `afterEach(() => { process.env.OAUTH_STUB_MODE = 'true'; })` 추가를 고려할 수 있으나 필수는 아님.

- **[INFO]** `cafe24-api.client.spec.ts` reactive 케이스에서 `process.env.CAFE24_CLIENT_ID` / `CAFE24_CLIENT_SECRET` 설정/삭제를 `try/finally` 없이 함수 말미에서 삭제
  - 위치: `cafe24-api.client.spec.ts` 라인 ~1090~1091, ~1145~1146
  - 상세: 테스트 실패 시 `delete process.env.CAFE24_CLIENT_ID` 라인에 도달하지 못해 다른 테스트에 환경변수가 누출될 수 있음. 기존 다른 케이스(라인 ~1026)도 동일 패턴을 사용하고 있으므로 기존 코드베이스 관행과 일관됨.
  - 제안: 가능하면 `try/finally`로 감싸거나, `afterEach`에서 cleanup하는 패턴으로 개선 권장. 기존 패턴과의 일관성 vs 격리 신뢰성 트레이드오프를 고려해 결정.

---

### 6. 테스트 가독성

- **[INFO]** `jwt-exp.spec.ts`의 `makeJwt` 헬퍼와 `integration-oauth.service.cafe24.spec.ts`의 `makeFakeJwt`, `cafe24-api.client.spec.ts`의 `makeFakeJwt` — 세 파일에 동일 목적의 JWT 빌더 헬퍼가 중복 정의됨
  - 위치: 세 테스트 파일 각각
  - 상세: 세 구현이 동일한 base64url 인코딩 로직을 포함. 코드 중복이지만 테스트 파일들이 공유 테스트 유틸리티 파일을 갖지 않는 기존 패턴을 따르는 것으로 보임. 가독성상 문제는 없으나 유지보수 부담이 있음.
  - 제안: 장기적으로는 `test-helpers/jwt-builder.ts` 같은 공유 테스트 유틸리티로 추출 가능. 현재 변경 범위에서는 기존 패턴을 따르는 합리적 선택.

- **[INFO]** `cafe24-api.client.spec.ts` reactive 케이스의 테스트 이름이 다소 장문
  - 위치: `'401 reactive 자가 회복 — performAuthRefresh 가 reactive_401 source 로 enqueue + retry 성공'`
  - 상세: 내용은 명확하나 테스트 이름이 구현 세부사항(enqueue source)을 과도하게 노출. 테스트 리포트에서 식별하기는 쉬움.
  - 제안: 무시 가능. 현재 작성 수준이 회귀 보호 의도를 명확히 전달하는 데 충분함.

---

### 7. 회귀 테스트

- **[INFO]** `Cafe24TokenRefreshProcessor.spec.ts`에서 `source='proactive'` 일 때 short-circuit 이 여전히 동작하는지 검증하는 케이스가 신규 추가 `reactive_401` 케이스와 함께 명시적으로 존재하는지 확인 필요
  - 위치: `cafe24-token-refresh.processor.spec.ts`
  - 상세: diff에서 `reactive_401` 케이스 두 개가 추가됨. 기존 `proactive` 경로의 short-circuit 유지 케이스(plan에서 명시된 "source='proactive' 일 때 종전 short-circuit 유지")가 신규 테스트로 추가되었는지, 아니면 기존 테스트로 커버되는지 diff만으로는 확인 불가.
  - 제안: diff 범위 내에서는 `reactive_401` short-circuit skip과 status guard 유지 회귀 케이스가 잘 추가되어 있음. plan 항목에 기재된 `proactive` short-circuit 유지 케이스가 기존 파일에 있었다면 충분하나, 없다면 추가 권장.

- **[INFO]** `removeOnComplete` 옵션의 동작 — `{ age: 0 }` vs `{ age: 60 }` — 을 실제로 검증하는 단위 테스트가 있음
  - 위치: `cafe24-api.client.spec.ts` reactive 회귀 케이스 `addCall[2]` matcher
  - 상세: `expect(addCall[2]).toMatchObject({ removeOnComplete: { age: 0 } })`으로 enqueue 옵션을 직접 검증함. BullMQ 동작은 mock이라 실제 dedup 동작은 e2e에서만 검증 가능하지만, 인터페이스 수준 회귀 방지는 충분히 커버.
  - 제안: 현재 적절함.

---

### 8. 테스트 용이성

- **[INFO]** `parseJwtExp`가 순수 함수로 구현되어 DI 의존성 없이 단독 import 후 테스트 가능한 구조
  - 위치: `codebase/backend/src/modules/integrations/jwt-exp.ts`
  - 상세: export된 단일 함수, NestJS 컨테이너 불필요, 외부 의존 없음. 테스트 용이성 측면에서 이상적인 설계.
  - 제안: 이미 적절함.

- **[INFO]** `hasTimezoneDesignator`(integration-oauth.service.ts)와 `normalizeCafe24IsoTimezone`(cafe24-api.client.ts)이 module-private 함수로 export되지 않아 직접 단위 테스트 불가
  - 위치: 두 파일 각각
  - 상세: 같은 정규식 로직이 두 파일에 분리 구현됨. 공유 유틸리티(`jwt-exp.ts` 패턴처럼)로 추출하면 단위 테스트 가능성과 재사용성이 동시에 개선될 수 있음. 현재는 상위 통합 테스트로 간접 커버되고 있음.
  - 제안: 향후 `normalizeCafe24IsoTimezone`을 `jwt-exp.ts` 또는 별도 `cafe24-token-utils.ts`로 추출하여 export하면 중복 제거와 직접 단위 테스트 가능성을 동시에 얻을 수 있음. 현재 변경 범위에서 강제할 필요는 없으나 중기 리팩토링 고려 대상.

---

## 요약

이번 변경은 Cafe24 JWT exp 기반 토큰 만료 추출이라는 단일 회귀 수정에 대해 테스트 계층을 충실히 구성했다. `jwt-exp.spec.ts`는 신규 헬퍼 함수의 모든 입력 분류를 망라하며 20개 이상의 케이스를 독립적으로 검증한다. `integration-oauth.service.cafe24.spec.ts`와 `cafe24-api.client.spec.ts`는 JWT 우선 / ISO fallback / TZ-less 정규화 세 핵심 회귀 경로를 각 레이어에서 교차 검증하고, `cafe24-token-refresh.processor.spec.ts`는 `reactive_401` source의 short-circuit 우회 동작과 status guard 유지를 함께 검증한다. 주요 아쉬운 점은 (1) `hasTimezoneDesignator`/`normalizeCafe24IsoTimezone`의 동일 정규식 로직이 두 파일에 중복되어 있어 직접 단위 테스트가 불가하고, (2) `cafe24-api.client.ts` refresh 경로에서 TZ-less ISO의 경계값 케이스(이미 TZ 있는 ISO, Z suffix 등)가 검증되지 않으며, (3) `cafe24-api.client.spec.ts` 신규 케이스에서 환경변수 정리가 `try/finally` 없이 처리되어 테스트 실패 시 격리 위험이 있는 점이다. 전반적으로 테스트 품질은 양호하며 핵심 회귀 경로는 충분히 커버된다.

## 위험도

LOW