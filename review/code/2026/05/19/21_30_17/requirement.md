# 요구사항(Requirement) 리뷰

## 리뷰 대상 변경

- `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts`
  - `resolveTokenExpiry` 함수에 JWT `exp` claim 최우선 소스 추가
- `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.spec.ts`
  - TZ 버그 시나리오 회귀 테스트 추가
- `codebase/backend/src/nodes/integration/cafe24/cafe24-token-refresh.processor.spec.ts`
  - processor short-circuit 무력화 검증 테스트 추가

---

## 발견사항

- **[INFO]** `resolveTokenExpiry` — JWT exp 최우선 소스 삽입 위치 적절
  - 위치: `cafe24-api.client.ts` L1460-1468
  - 상세: `parseJwtExp(creds.access_token)` 반환값이 `null` 이 아니면 즉시 return, 기존 `tokenExpiresAt` → `credentials.expires_at` fallback chain은 그대로 유지. 로직 순서가 의도(JWT exp → DB column → JSONB mirror)와 일치.
  - 제안: 특이사항 없음.

- **[INFO]** `refreshAccessToken` — 새 토큰 저장 시 JWT exp 우선 채택
  - 위치: `cafe24-api.client.ts` L865-881
  - 상세: `jwtExpMs !== null` 이면 새 `access_token` 의 JWT exp 를 `expiresAt` 으로 채택. `expires_in` → normalized `expires_at` ISO → 2h 기본값으로 폴백하는 체인이 코드에 명시되어 있으며, 이는 플랜의 요구사항("precedence: JWT exp → expires_in → expires_at ISO → 2h default")과 정확히 일치.
  - 제안: 특이사항 없음.

- **[INFO]** `Cafe24TokenRefreshProcessor.process` — `reactive_401` short-circuit 우회
  - 위치: `cafe24-token-refresh.processor.ts` L117-128
  - 상세: `source !== 'reactive_401'` 조건에서만 `resolveTokenExpiry` short-circuit 판정. `resolveTokenExpiry` 가 이미 JWT exp 를 최우선으로 읽으므로, `proactive` / `background` source 도 TZ-bugged tokenExpiresAt 에 속지 않고 JWT exp 만료를 정확히 탐지. 두 계층의 방어가 서로 보완.
  - 제안: 특이사항 없음.

- **[INFO]** `credentials` 가 `null` 또는 `undefined` 인 경우
  - 위치: `cafe24-api.client.ts` L1464
  - 상세: `(integration.credentials ?? {}) as Cafe24Credentials` 처리로 null/undefined 방어. `creds.access_token` 이 `string` 이 아닌 경우 `parseJwtExp(null)` 이 호출되어 `null` 반환 후 fallback chain 으로 안전하게 진행.
  - 제안: 특이사항 없음.

- **[INFO]** 비-JWT access_token (불투명 문자열) 처리
  - 위치: `codebase/backend/src/modules/integrations/jwt-exp.ts` L28-30
  - 상세: `parseJwtExp` 는 3-segment 구조가 아니면 `null` 을 반환. Cafe24 가 JWT 형식이 아닌 access_token 을 반환하는 경우에도 fallback chain 이 정상 동작.
  - 제안: 특이사항 없음.

- **[INFO]** 기존 `creds` 변수 선언 중복 제거 확인
  - 위치: diff 기준 `resolveTokenExpiry` 내부 L1475 이전 라인 삭제
  - 상세: 기존 코드에서 `const creds = ...` 가 fallback chain 중간에 선언되어 있던 부분이 함수 상단으로 이동. 중복 선언 제거로 코드 정합성 향상. 로직 변경 없음.
  - 제안: 특이사항 없음.

- **[INFO]** 테스트 커버리지 — TZ 버그 시나리오
  - 위치: `cafe24-api.client.spec.ts` L1061-1123, `cafe24-token-refresh.processor.spec.ts` L120-138
  - 상세: 두 파일 모두 `makeFakeJwt({ exp: 과거 epoch })` 으로 만료된 JWT 를 생성하고, `tokenExpiresAt` / `credentials.expires_at` 를 미래(+9h)로 설정한 상태에서 refresh 가 발동됨을 검증. 플랜의 "버그 체인 3단계"를 명시적으로 회귀 방지.
  - 제안: 특이사항 없음.

- **[INFO]** 테스트 커버리지 — refresh 응답의 JWT exp 우선 채택
  - 위치: `cafe24-api.client.spec.ts` L1133-1185
  - 상세: 응답 body 의 `expires_at` (2h 후) 과 JWT `exp` (1h 후) 가 다를 때 JWT exp 가 `tokenExpiresAt` 로 저장됨을 검증. 피처 동작의 핵심 케이스.
  - 제안: 특이사항 없음.

- **[WARNING]** 신규 JWT exp 토큰이 저장된 후 `resolveTokenExpiry` 재호출 시 동작 변화 주의
  - 위치: `cafe24-api.client.ts` L1456-1483 (`resolveTokenExpiry`)
  - 상세: refresh 이후 `integration.credentials.access_token` 이 새 JWT 로 교체되면, 다음 `resolveTokenExpiry` 호출이 새 JWT 의 exp 를 반환. 이는 의도한 동작이나, 만약 Cafe24 가 JWT 형식이 아닌 새 토큰을 반환하는 케이스에서는 fallback chain 으로 내려간다. `refreshAccessToken` 이 `expiresAt` 을 DB 에 명시적으로 기록하므로 이 경우 `tokenExpiresAt` fallback 이 올바른 값을 들고 있어 안전. 단, Cafe24 가 향후 불투명 토큰으로 전환하는 경우 의도와 동작이 일치하는지 재검토 필요.
  - 제안: 현재 코드에서 추가 조치 불필요. 향후 Cafe24 토큰 형식 변경 시 `parseJwtExp` null fallback 이 정상 작동함을 회귀 테스트로 보장할 것.

- **[INFO]** TODO/FIXME/HACK/XXX 주석 없음
  - 변경 범위 전체 확인 완료. 미완성 작업을 시사하는 주석 없음.

- **[INFO]** 빌드·단위 테스트·e2e 테스트 통과 확인
  - 위치: `_test_logs/build-20260519-212718.log`, `_test_logs/unit-20260519-212701.log`, `_test_logs/e2e-20260519-212743.log`
  - 상세: 빌드 성공, 단위 테스트 통과 (로그에서 관련 테스트 출력 정상), e2e 16개 suite 93개 테스트 전부 PASS. `lint-20260519-211359.log` 에서 `eslint: command not found` 오류가 있으나 이는 로컬 PATH 문제로, 린트 규칙 위반이 아님.

---

## 요약

이번 변경은 `resolveTokenExpiry` 함수에 Cafe24 access_token 의 JWT `exp` claim 을 최우선 만료 소스로 추가하는 단일 목적의 수정이다. 기존 `tokenExpiresAt` DB 컬럼과 `credentials.expires_at` JSONB 미러는 구 코드의 KST→UTC 오해석으로 실제 만료보다 최대 9h 미래로 기록될 수 있어, JWT 의 불변 exp 를 ground truth 로 삼는 것이 근본 해결책이다. 구현은 플랜의 요구사항("JWT exp → expires_in → expires_at ISO (TZ-less 정규화) → 2h default" 우선순위)을 정확히 따르며, null-safety·비-JWT 토큰 폴백·`reactive_401` short-circuit 우회와의 상호작용 모두 견고하게 처리된다. 회귀 테스트가 TZ 버그 시나리오와 신규 토큰 저장 우선순위를 명시적으로 검증하고 있어 기능 완전성이 충분히 확보됐다.

---

## 위험도

LOW
