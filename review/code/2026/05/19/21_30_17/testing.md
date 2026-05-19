# Testing 리뷰

## 발견사항

### [INFO] 핵심 변경 함수 `resolveTokenExpiry` 에 대한 직접(pure-function) 단위 테스트 부재
- 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts:1456-1483`
- 상세: `resolveTokenExpiry` 는 세 가지 소스(JWT exp → tokenExpiresAt → credentials.expires_at)를 순서대로 참조하는 순수 함수이지만, 이 함수를 직접 import 해서 독립적으로 단위 검증하는 `describe('resolveTokenExpiry')` 블록이 존재하지 않는다. 새로 추가된 JWT exp 우선 로직은 통합 시나리오 테스트(`it('proactive refresh — ...')`)를 통해 간접적으로만 커버된다. `parseJwtExp` 가 `jwt-exp.spec.ts` 에서 꼼꼼히 단위 테스트되는 것과 대조적이다.
- 제안: `cafe24-api.client.spec.ts` 또는 별도 파일에 `describe('resolveTokenExpiry (pure function)')` 블록을 추가한다. 검증해야 할 케이스: (1) 유효한 JWT exp 존재 → JWT exp 반환, (2) JWT exp null (토큰 없음) + 유효한 tokenExpiresAt → tokenExpiresAt 반환, (3) JWT exp null + tokenExpiresAt null + 유효한 credentials.expires_at → expires_at 반환, (4) 세 소스 모두 null/invalid → null, (5) JWT exp 과거 + tokenExpiresAt 미래(TZ 버그) → JWT exp 반환(우선순위 검증).

---

### [INFO] TZ 버그 regression test — `expires_at` 필드도 TZ-bugged 미래 값으로 설정했으나 실제 테스트 assert 에서 활용 안 됨
- 위치: `cafe24-api.client.spec.ts:1073-1074` (새로 추가된 regression test)
- 상세: 테스트 픽스처에서 `credentials.expires_at` 도 `+9h` 미래 값으로 설정했지만, assert 는 fetch 횟수·OAuth URL·saved token 만 확인한다. `credentials.expires_at` 도 fallback 소스이므로 JWT exp 우선 로직이 이 값도 올바르게 무력화한다는 사실은 현재 순수 함수 단위 테스트 없이는 명시적으로 확인되지 않는다. 통합 테스트가 우선순위 체인 전체를 묵시적으로 커버하지만, 독자가 테스트 의도를 파악하기 위해 구현을 직접 추적해야 한다.
- 제안: 해당 integration test 의 comment 또는 assert 에 "JWT exp 가 tokenExpiresAt 과 credentials.expires_at 양쪽 미래 값을 무력화" 함을 명시적으로 표현하거나, pure function 테스트에서 세 소스 모두 충돌하는 케이스를 직접 검증한다.

---

### [INFO] processor spec regression test — `app_type` 미설정으로 인한 잠재적 커버리지 갭
- 위치: `cafe24-token-refresh.processor.spec.ts:114-142` (새로 추가된 테스트)
- 상세: 추가된 processor regression test 의 픽스처 credentials 에 `app_type` 이 없다. `performAuthRefresh` 내부에서 `app_type` 이 없으면 다른 코드 경로(혹은 에러)를 탈 수 있다. 기존 테스트들은 `app_type: 'public'` 또는 `'private'`을 명시하는 경향이 있다. 실제로는 mock 된 `cafe24ApiClient.refreshAccessToken` 이 바로 성공을 반환하므로 현재 테스트는 통과하지만, 픽스처 불완전성이 테스트 의도를 모호하게 만든다.
- 제안: processor spec 픽스처에 `app_type: 'public'` 을 명시하여 기존 테스트 패턴과 일관성을 유지하고, 독자가 "이 케이스는 public app 에서의 TZ 버그 시나리오"임을 즉시 파악할 수 있도록 한다.

---

### [INFO] `resolveTokenExpiry` 의 `access_token` 타입 체크 로직에 대한 엣지 케이스 테스트 미비
- 위치: `cafe24-api.client.ts:1465-1468`
- 상세: `typeof creds.access_token === 'string' ? creds.access_token : null` 분기가 추가됐다. `access_token` 이 숫자/boolean/객체/undefined 인 경우(즉 string 아닌 경우) `parseJwtExp(null)` 을 호출해 null 을 반환하고 fallback으로 진행되는 경로는 테스트 없이 암묵적으로 처리된다. `parseJwtExp` 자체는 null/undefined/non-string 을 처리하지만, `resolveTokenExpiry` 의 타입 가드 분기는 직접 커버되지 않는다.
- 제안: pure function 단위 테스트에서 `credentials.access_token` 이 비-string 인 경우(예: undefined, null, 0)에도 fallback 체인(tokenExpiresAt 또는 credentials.expires_at)으로 올바르게 진행됨을 확인하는 케이스를 포함한다.

---

### [INFO] 전체 test suite 실행 결과 — 모든 테스트 통과 확인
- 위치: `_test_logs/unit-20260519-212701.log`, `_test_logs/e2e-20260519-212743.log`
- 상세: unit(jest): 해당 로그에서 관련 테스트들이 포함된 suite들이 PASS. e2e: 16개 suite 93개 test 전부 통과. 기존 regression 테스트들은 변경 후에도 유효하다.
- 제안: 없음 (통과 확인).

---

### [WARNING] `makeFakeJwt` 테스트 유틸리티의 signature segment 가 고정 문자열 `sig-not-verified`
- 위치: `codebase/backend/src/modules/integrations/__test-utils__/make-fake-jwt.ts:22`
- 상세: 현재 프로덕션 코드가 signature 를 검증하지 않으므로 기능적으로 문제없다. 그러나 향후 signature 검증 로직이 추가될 경우 기존 테스트 픽스처 전체가 한꺼번에 실패한다. `sig-not-verified` 라는 명시적 주석이 있어 의도는 분명하지만, 이 유틸리티에 의존하는 테스트(client spec, processor spec, oauth service spec 등)가 증가할수록 위험이 커진다.
- 제안: 현재로서는 허용 가능. 향후 signature 검증 추가 시 `makeFakeJwt` 를 `jest-mock-jose` 같은 실제 JWT 생성 도구로 교체하는 마이그레이션 계획을 주석에 남겨두는 것을 권장한다.

---

### [INFO] lint 실패 — `eslint: command not found`
- 위치: `_test_logs/lint-20260519-211359.log`
- 상세: lint 단계가 `eslint: command not found` 로 실패했다. 이는 테스트 환경 설정 문제로 코드 품질 게이트가 작동하지 않은 상태에서 리뷰가 진행됐다. 신규 테스트 코드(`cafe24-api.client.spec.ts`, `cafe24-token-refresh.processor.spec.ts`)의 lint 통과 여부를 확인할 수 없다.
- 제안: CI 환경에서 `npm run lint` 가 정상 동작하는지 확인하고, 개발 환경의 PATH 설정(`node_modules/.bin` 포함 여부)을 점검한다. eslint 는 `devDependencies` 에 포함되어 있을 것이므로 `npx eslint` 또는 `./node_modules/.bin/eslint` 로 직접 실행하도록 `test-stages.sh` 를 보완하는 것도 고려한다.

---

## 요약

이번 변경은 `resolveTokenExpiry` 함수에 JWT `exp` 클레임을 최우선 만료 소스로 격상하는 버그 수정이며, TZ 버그(KST→UTC 9시간 스큐)로 인한 token 신선도 오판을 방어한다. 핵심 로직인 `parseJwtExp` 는 기존부터 충분한 순수 함수 단위 테스트를 보유하고 있고, 변경과 함께 client spec 과 processor spec 에 통합적 regression test 가 추가되어 실제 버그 시나리오(tokenExpiresAt+credentials.expires_at 양쪽이 미래 TZ-bugged 값이어도 JWT exp 과거면 refresh 발동)가 E2E에 가깝게 검증된다. 그러나 `resolveTokenExpiry` 함수 자체의 우선순위 체인(JWT exp → tokenExpiresAt → credentials.expires_at → null)을 직접 단위 검증하는 pure function 테스트가 없고, 이 점이 유일한 커버리지 갭이다. 전반적인 테스트 인프라(공유 유틸리티 `makeFakeJwt`, 격리된 mock 구조, 명확한 regression 주석)는 양호하며, 모든 unit/e2e 테스트가 통과한다. 위험도는 낮다.

## 위험도

LOW
