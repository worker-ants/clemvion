# 동시성(Concurrency) Review — auth-refresh-rotation-atomic

## 발견사항

### **[INFO]** 조건부 UPDATE의 TOCTOU 차단 — 올바른 패턴, 범위 확인 필요
- 위치: `codebase/backend/src/modules/auth/auth.service.ts` `refresh()` 트랜잭션 콜백 내 `manager.getRepository(RefreshToken).update(...)` (diff lines +247–254)
- 상세: `{ id: stored.id, isRevoked: false, expiresAt: MoreThan(now) }` 를 WHERE 조건으로 사용해 DB 수준의 원자적 CAS(Compare-And-Swap)를 구현했다. 이는 Node.js 단일 스레드 이벤트 루프에서도 `findOne → 검증 → UPDATE` 사이의 이벤트 루프 tick 사이에 다른 요청이 끼어드는 TOCTOU 창을 닫는 올바른 방법이다. `affected=0` 거부 분기도 적절하다. 다만 한 가지 미묘한 점: `expiresAt: MoreThan(now)` 의 `now` 는 트랜잭션 콜백 시작 시점(`const now = new Date()`)에 캡처된다. TypeORM 의 `MoreThan` 은 JavaScript 측에서 값을 바인딩하므로, DB 서버 시각과 애플리케이션 서버 시각이 미세하게 차이 날 경우 경계 케이스가 발생할 수 있다. 다중 앱 서버 배포 환경에서는 이 차이가 수십 ms 수준일 수 있어 만료 경계의 토큰에서 false positive(만료됐으나 통과) 또는 false negative(유효하나 거부)가 이론적으로 가능하다.
- 제안: 단일 인스턴스 환경에서는 무시 가능하다. 다중 인스턴스 + 고정밀 만료 요구 시에는 `MoreThan(now)` 대신 `() => 'expires_at > NOW()'` (DB 함수 사용)로 전환하거나, 앱-DB 시각 동기화(NTP)를 인프라 요구사항으로 명시하는 것이 권장된다.

### **[INFO]** 트랜잭션 내부에서 `generateTokens`의 `resolveTokenWorkspaceContext` 실행 — 트랜잭션 hold time 연장
- 위치: `auth.service.ts` `generateTokens()` 내 `resolveTokenWorkspaceContext(user)` 호출, `refresh()` 의 `dataSource.transaction` 콜백에서 `generateTokens` 호출 경유
- 상세: `resolveTokenWorkspaceContext`가 최대 3회의 순차 DB 읽기를 수행한다면, 해당 읽기가 트랜잭션 콜백 내부에서 실행되어 커넥션 풀의 동일 커넥션을 hold 하는 시간을 연장한다. 단일 트랜잭션의 revoke UPDATE + workspace read(최대 3) + INSERT 는 최소 5회 round-trip 이 된다. 고트래픽 시나리오에서 커넥션 풀이 포화 상태에 있을 경우, 이 hold time 증가가 다른 요청의 커넥션 대기를 야기할 수 있다. 동시성 관점에서 트랜잭션 범위를 최소화하는 것이 이상적이다.
- 제안: `resolveTokenWorkspaceContext`(읽기 전용, 트랜잭션 의미와 무관)와 JWT sign을 `dataSource.transaction` 콜백 밖에서 먼저 계산하고, 콜백 내부는 revoke UPDATE + RefreshToken INSERT만 수행하도록 분리하면 트랜잭션 hold time이 최소화된다. 이는 이전 리뷰(08_45_18)의 INFO1 항목과 동일한 지적으로, 후속 plan 아이템으로 이미 등록된 상태다.

### **[INFO]** `findOne → 트랜잭션 진입` 사이의 읽기-쓰기 간격 — 허용 범위 내
- 위치: `auth.service.ts` `refresh()` — `refreshTokenRepository.findOne` 호출 후 검증, 이후 `dataSource.transaction` 진입 (diff lines +245–265)
- 상세: `findOne`은 트랜잭션 밖에서 실행된다. `findOne → 토큰 유효성 검증 → dataSource.transaction 진입` 사이에 다른 요청이 동일 토큰으로 회전을 완료할 수 있는 이론적 창이 있다. 그러나 이 창은 조건부 UPDATE `{ isRevoked: false, expiresAt: MoreThan(now) }` 가 DB 수준에서 닫는다: 다른 요청이 먼저 회전해 `is_revoked=true`로 변경했다면 이 UPDATE 가 `affected=0` 을 반환해 거부된다. 즉 `findOne`의 결과가 stale이 되어도 트랜잭션 내 조건부 UPDATE 가 최종 방어선으로 동작하므로, 이 간격은 안전하다. 현재 구현이 이를 올바르게 처리한다.
- 제안: 없음. 현행 설계 적절.

### **[INFO]** Node.js 단일 스레드 + async/await 패턴 — await 누락 없음
- 위치: `auth.service.ts` `refresh()` 전체, `generateTokens()` 변경된 부분
- 상세: `dataSource.transaction(async (manager) => { ... })` 는 `return` 으로 Promise를 반환하고 호출 측에서 `return this.dataSource.transaction(...)` 으로 await chain에 올바르게 포함된다. `generateTokens`의 `await refreshRepo.save(...)` 도 await가 정상 적용되어 있다. async/await 누락 없음.
- 제안: 없음.

### **[INFO]** reuse 탐지 분기의 원자성 — 현행 설계 검토
- 위치: `auth.service.ts` `refresh()` — reuse 탐지 분기 (diff에서 변경 없음, 기존 코드)
- 상세: reuse 탐지 분기(`stored.isRevoked === true`)는 이번 변경에서 수정되지 않았다. 해당 분기는 family 전체 revoke를 수행하는데, 해당 revoke도 트랜잭션 밖에서 실행된다면 동시 요청과의 경쟁 조건이 존재할 수 있다. 그러나 이는 이번 변경 범위(C-1 정상 회전 원자화) 밖이고, reuse 탐지 자체가 이미 `is_revoked=true` 상태를 전제로 하므로 추가 방어가 달라지지 않는다. 본 PR이 새로 도입한 문제가 아님.
- 제안: 본 PR 범위 밖. 향후 C-1 원자성 철학을 reuse 탐지 분기에도 적용할 필요가 있는지 후속 검토 권장.

## 요약

이번 변경은 동시성 관점에서 올바르게 설계되었다. 핵심인 TOCTOU 차단 패턴(DB 수준 조건부 UPDATE + `affected=0` 거부)은 Node.js 이벤트 루프의 tick 간격을 포함한 모든 race window를 DB의 row-level lock으로 닫는다. async/await 패턴도 정상이고, 데드락 위험 구조(교차 락 획득 등)도 없다. 두 가지 주의사항이 있다: (1) 다중 인스턴스 배포 시 앱-DB 시각 차이로 인한 만료 경계 케이스는 `MoreThan(now)` 의 JS 측 시각 바인딩 특성에서 비롯되며, 단일 인스턴스 또는 NTP 동기화 환경에서는 무시 가능하다; (2) `resolveTokenWorkspaceContext`(최대 3회 read) 가 트랜잭션 hold time을 연장해 커넥션 풀 경쟁을 가중시킬 수 있으나, 이는 이미 이전 리뷰의 INFO1로 등록된 후속 개선 사항이다. 전체적으로 동시성 위험도는 LOW이다.

## 위험도

LOW
