# Performance Review — auth-refresh-rotation-atomic (05 C-1)

## 발견사항

- **[INFO]** `resolveTokenWorkspaceContext` (최대 3회 순차 DB 쿼리)가 트랜잭션 콜백 내부에서 실행됨
  - 위치: `codebase/backend/src/modules/auth/auth.service.ts` — `generateTokens()` 내 `resolveTokenWorkspaceContext` 호출, `dataSource.transaction` 콜백에서 `generateTokens` 를 호출하는 경로 (`refresh()` L242–262)
  - 상세: `refresh()` 정상 회전 분기에서 `dataSource.transaction(async (manager) => { ... return this.generateTokens(user, false, stored.familyId, ctx, manager); })` 구조상, `generateTokens` 내부의 `resolveTokenWorkspaceContext` 호출(workspace 조회, 최대 3회 순차 SELECT)이 트랜잭션 콜백 안에서 실행된다. TypeORM 의 `DataSource.transaction` 은 커넥션 풀에서 하나의 커넥션을 획득해 콜백이 끝날 때까지 점유한다. 따라서 `resolveTokenWorkspaceContext` 의 순차 쿼리들이 트랜잭션 커넥션을 붙잡고 있는 시간만큼 hold time 이 늘어나고, 동시 요청이 많을 경우 커넥션 풀 고갈 압력이 증가한다. 실제로 `resolveTokenWorkspaceContext` 는 DB write 와 무관한 read-only 조회이므로 트랜잭션 밖에 있어야 할 이유가 더 많다. 현재 refresh 빈도와 워크스페이스 수가 낮다면 실측 영향은 미미하지만, 트래픽이 커지면 커넥션 병목 지점이 될 수 있다.
  - 제안: `generateTokens` 를 "계산 단계(JWT sign + workspace context 조회)"와 "INSERT 단계(DB write)"로 분리하거나, `refresh()` 의 트랜잭션 콜백을 `revoke UPDATE + RefreshToken INSERT` 만으로 좁히고 JWT sign 및 workspace 조회는 트랜잭션 진입 전에 선계산한다. 예: `const context = await this.resolveTokenWorkspaceContext(user); const { accessToken, rawRefreshToken } = this.buildTokenPayload(user, context, ...); await this.dataSource.transaction(async (manager) => { /* revoke + insert only */ });`

- **[INFO]** `findOne` → `UPDATE` 사이의 조건부 UPDATE 패턴 — 불필요한 사전 조회 잔존 가능성
  - 위치: `codebase/backend/src/modules/auth/auth.service.ts` `refresh()` L577 이전 `findOne` 호출
  - 상세: 코드는 (1) `refreshTokenRepository.findOne` 으로 토큰을 조회한 뒤 (2) `reuse` 분기 / `expired` 분기를 애플리케이션 레벨에서 처리하고 (3) 정상 회전 분기에서 `manager.getRepository(RefreshToken).update({ id, isRevoked: false, expiresAt: MoreThan(now) }, ...)` 를 수행한다. 정상 회전 경로는 `findOne` 에서 이미 읽은 `isRevoked` 와 `expiresAt` 을 다시 `WHERE` 조건으로 사용하는 이중 검증이라 DB 왕복이 하나 더 발생한다. 단, `findOne` 은 `user` relation 과 `familyId` 등 UPDATE 만으로는 얻을 수 없는 정보를 가져오므로 완전히 제거할 수는 없다. 또한 TOCTOU 차단을 위해 조건부 UPDATE 가 의도된 설계이므로 이 자체는 올바르다. 추가 왕복이 허용 가능한 수준이며 현재 구조에서 제거 방법도 제한적이다.
  - 제안: 현행 유지 허용. 다만 `findOne` 쿼리에서 `user` relation 을 `select` 범위 최소화(필요 컬럼만)하거나 `user` 를 eager 가 아닌 명시 join 으로 조회해 조회 비용을 줄이는 것을 장기 검토 대상으로 등록할 수 있다.

- **[INFO]** `generateTokens` 내 `manager.getRepository(RefreshToken)` — 반복 호출 비용 미미
  - 위치: `codebase/backend/src/modules/auth/auth.service.ts` `generateTokens()` L788–823
  - 상세: `manager ? manager.getRepository(RefreshToken) : this.refreshTokenRepository` 패턴이 `create` 와 `save` 두 번에 걸쳐 `refreshRepo` 라는 지역 변수로 이미 캐싱되어 있다. `getRepository` 는 TypeORM 내부 레지스트리 조회이므로 비용이 미미하고, 현재 구현이 이를 한 번만 호출해 지역 변수에 저장하는 구조라 추가 최적화 불필요.
  - 제안: 없음.

- **[INFO]** 테스트 파일의 `Date.now() + 86400000` 반복 — 런타임 비용 무관, 가독성 한정
  - 위치: `codebase/backend/src/modules/auth/auth.service.spec.ts` 신규 테스트 케이스 내 `expiresAt: new Date(Date.now() + 86400000)` 반복 패턴
  - 상세: 테스트 코드이므로 성능 영향 없음. 단, 동일 값을 여러 `it` 블록에서 반복 계산하는 구조라 상수 추출 시 가독성 향상 가능. 성능 관점 이슈 아님.
  - 제안: 테스트 파일 상단에 `const ONE_DAY_MS = 24 * 60 * 60 * 1000;` 상수 추출(maintainability 범주).

## 요약

이번 변경의 핵심 성능 우려는 `resolveTokenWorkspaceContext`(최대 3회 순차 DB 쿼리)가 `dataSource.transaction` 콜백 내부에서 실행되어 트랜잭션 커넥션 hold time 이 불필요하게 연장된다는 점이다. 이 조회는 DB write 와 무관한 read-only 작업이므로 트랜잭션 진입 전으로 이동하는 것이 바람직하다. 그 외 N+1 쿼리나 메모리 누수, 블로킹 I/O, 비효율적 알고리즘은 없다. `findOne` + 조건부 `UPDATE` 의 2회 왕복은 TOCTOU 차단 요구사항상 불가피한 설계 트레이드오프이며 허용 가능한 수준이다. 현재 refresh 트래픽 규모에서는 즉각 차단 사안이 없고, 트랜잭션 hold time 개선은 트래픽 증가 시의 후속 최적화 항목으로 등록할 것을 권장한다.

## 위험도

LOW
