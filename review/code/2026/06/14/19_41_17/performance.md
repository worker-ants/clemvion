# 성능(Performance) 리뷰

## 발견사항

- **[INFO]** `reconcileTerminalRevocations` — `revokeAllForExecution` 내부 직렬 Redis SET
  - 위치: `interaction-token.service.ts`, `revokeAllForExecution` 메서드 (lines 1212-1218)
  - 상세: `revokeAllForExecution` 는 execution 의 jti 목록을 순회하며 `revokePerExecution` 를 직렬(await) 호출한다. 대부분의 execution 은 iext 토큰이 1~2건이라 실제 영향은 미미하지만, 이론적으로 한 execution 에 발급된 토큰이 다수(예: 잦은 refresh)인 경우 Redis round-trip 이 직렬로 누적된다. `reconcileTerminalRevocations` 는 이미 execution 단위로 `RECONCILE_CONCURRENCY(20)` 병렬 처리를 적용했으나, execution 내 jti 레벨은 직렬로 남아 있다.
  - 제안: 현 운영 시나리오(jti 1~2건)에서는 문제 없음. 필요 시 `Promise.all` 또는 `redis.pipeline()`/`mset` 을 사용해 per-jti SET 을 일괄 처리할 수 있으나, 변경 대비 효과가 작아 지금 당장 필수 사항은 아님.

- **[INFO]** `refreshPerExecution` — JWT 이중 검증(verify 두 번)
  - 위치: `interaction-token.service.ts`, `refreshPerExecution` 메서드 (lines 1153-1186)
  - 상세: `refreshPerExecution` 는 먼저 `verifyPerExecution` 을 호출해 JWT 를 검증·디코딩하고, 이후 `decoded.exp` 추출을 위해 동일 토큰에 대해 `verify` 를 한 번 더 호출한다. HMAC-SHA256 서명 검증이 두 번 수행되는 셈이다. 토큰 갱신 경로는 high-frequency 가 아니라 실질적 성능 영향은 낮지만, 불필요한 중복 연산이다.
  - 제안: `verifyPerExecution` 가 `exp` 등 추가 클레임을 반환하거나, `refreshPerExecution` 내에서 단일 `verify` 결과를 재사용하도록 리팩토링하면 이중 검증을 제거할 수 있다.

- **[INFO]** `DEV_EPHEMERAL_SECRET` — 모듈 로드 시 `randomBytes(32)` 즉시 실행
  - 위치: `interaction-token.service.ts`, 모듈 최상위 (line 922)
  - 상세: `const DEV_EPHEMERAL_SECRET = randomBytes(32).toString('hex');` 는 파일 import 시점에 동기 `randomBytes` 를 즉시 실행한다. Node.js `crypto.randomBytes` 는 동기 호출 시 블로킹이지만, 32바이트 생성은 수 마이크로초 수준으로 성능 영향은 무시 가능하다. 주석에 명시된 대로 prod 에서는 이 경로에 도달하지 않는다.
  - 제안: 현재 규모에서 문제 없음. 개선이 필요하다면 클래스 초기화 시 lazy 생성(생성자 내 조건부 할당)으로 이동할 수 있으나, 실질적 이득이 없어 변경 불필요.

- **[INFO]** `revokeAllForExecution` — 직렬 Redis SET (N+1 유사 패턴)
  - 위치: `interaction-token.service.ts`, `revokeAllForExecution` (lines 1212-1218)
  - 상세: `for ... of tokens` 루프 내에서 `await this.revokePerExecution(...)` 를 직렬 호출한다. 토큰 수가 보통 1~2건이고 execution 단위 병렬화(`RECONCILE_CONCURRENCY`)로 스루풋을 보상하고 있으므로 실제 영향은 제한적이다. 단, 같은 루프 내 `continue` 분기(만료 jti 스킵) 이후만 await 가 발생해 최악 케이스도 작다.
  - 제안: 현 설계로 충분. 토큰 수가 늘어날 경우 `Promise.all` 또는 Redis `multi()/exec()` 파이프라이닝을 도입하면 된다.

- **[INFO]** `getFailedDegradedThreshold` 등 함수 형태 임계값 — 매 호출마다 `process.env` 파싱
  - 위치: `system-status.constants.ts` (lines 1984-2011)
  - 상세: `getFailedDegradedThreshold`, `getDelayedDegradedThreshold`, `getFailedWindowMinutes`, `getFailedScanCap` 이 매 호출마다 `Number(process.env.*)` 를 파싱한다. 주석에 "성능 영향은 무시 가능"이라 명시되어 있으며, 시스템 상태 폴링 빈도가 높지 않아 실제 영향은 없다. 이 파일의 변경 내용 자체는 단순 import 경로 변경으로 성능 영향 없음.
  - 제안: 현 수준에서 문제 없음.

## 요약

이번 변경은 대부분 리팩토링(큐 이름 상수를 별도 types 파일로 분리, Swagger 데코레이터 교체, dev secret hardcoding 제거)과 테스트 보강으로 이루어져 있으며, 런타임 성능에 직접적인 영향을 주는 신규 코드 경로는 거의 없다. 가장 주목할 부분은 `reconcileTerminalRevocations` 의 bounded-concurrency 병렬 처리(`RECONCILE_CONCURRENCY=20` chunk + `Promise.allSettled`)로, 기존 N+1 직렬 왕복 문제를 이미 의도적으로 완화한 설계다. `revokeAllForExecution` 내 per-jti 직렬 Redis SET 과 `refreshPerExecution` 의 이중 JWT 검증은 소규모 개선 여지가 있으나 운영 시나리오에서 실질적 병목이 되지 않는다. 전체적으로 성능 위협 요소는 없다.

## 위험도

NONE
