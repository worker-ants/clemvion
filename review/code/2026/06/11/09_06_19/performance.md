### 발견사항

- **[WARNING]** `resolveTokenWorkspaceContext` 가 트랜잭션 콜백 내부에서 실행됨
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/auth-refresh-rotation-atomic/codebase/backend/src/modules/auth/auth.service.ts` — `generateTokens()` L758, `refresh()` 트랜잭션 콜백 L593–610
  - 상세: `generateTokens(user, false, stored.familyId, ctx, manager)` 가 트랜잭션 콜백 안에서 호출되고, 그 첫 문장이 `resolveTokenWorkspaceContext(user)` 다. 이 함수는 순차적으로 최대 3회 DB 읽기를 수행한다 (`findPersonalWorkspace` → `getMemberRole` 또는 `listForUser` → `findOrCreatePersonalWorkspace`). 트랜잭션이 커넥션을 점유한 상태에서 이 읽기들이 실행되므로, 읽기 지연이 곧 트랜잭션 hold time 증가 + 커넥션 풀 소비로 이어진다. refresh 엔드포인트는 액세스 토큰 만료마다 호출되므로 고빈도 경로다. 실제 write는 조건부 UPDATE 1회 + INSERT 1회로 최소화돼 있지만, 읽기 3회가 같은 커넥션에 묶이는 구조다.
  - 제안: `resolveTokenWorkspaceContext` 호출을 트랜잭션 콜백 밖으로 끌어내거나, `generateTokens` 를 "계산 단계(JWT sign + workspace context resolve)"와 "INSERT 단계(트랜잭션 의존)"로 분리한다. 예: `refresh()` 에서 `const context = await this.resolveTokenWorkspaceContext(user)` 를 `dataSource.transaction(...)` 앞에 선행한 뒤 `generateTokens` 에 context를 직접 전달하는 오버로드를 추가. 기존 non-transaction 호출처는 무변경 유지 가능. 단, 이전 리뷰(08_45_18/RESOLUTION.md INFO 1)에서 "refresh 빈도·트랜잭션 길이 모두 작아 실측 영향 미미"로 수용됐으므로 후속 plan 아이템으로 분류 적합.

- **[INFO]** 트랜잭션 콜백 내 `new Date()` 이중 생성
  - 위치: `auth.service.ts` L595 (`MoreThan(new Date())`) 와 L598 (`lastUsedAt: new Date()`)
  - 상세: 트랜잭션 콜백 진입 시 `new Date()` 가 두 번 생성된다. 수 밀리초 차이가 생기지만 실용적 영향은 없다. 더 큰 문제는 조건부 UPDATE 의 `expires_at > NOW()` 기준 시각과 `lastUsedAt` 스탬프의 시각이 미세하게 다를 수 있다는 점이다.
  - 제안: 콜백 상단에 `const now = new Date()` 를 한 번 선언하고 두 곳에서 재사용. 타임스탬프 일관성 + 미소 할당 감소.

- **[INFO]** `manager.getRepository(RefreshToken)` 반복 조회
  - 위치: `auth.service.ts` L594 (트랜잭션 콜백 내 UPDATE) 와 L780–782 (`generateTokens` 내 `refreshRepo` 결정)
  - 상세: `manager.getRepository(RefreshToken)` 가 트랜잭션 콜백 안에서 두 번 호출된다(한 번은 `refresh()` 콜백에서 UPDATE용, 한 번은 `generateTokens` 에서 INSERT용). TypeORM의 `getRepository`는 매번 새 Repository 인스턴스를 생성하지 않고 캐시에서 반환하므로 실질적 성능 비용은 없다. 그러나 코드 명확성 차원에서 `const refreshRepo = manager.getRepository(RefreshToken)` 를 콜백 상단에 한 번 선언하고 UPDATE와 `generateTokens` 에 모두 전달하는 방식이 가독성·추적성을 높인다. 현 구조로도 동작 상 문제 없음.

- **[INFO]** `MoreThan(new Date())` — DB 왕복 내 시각 평가 의존
  - 위치: `auth.service.ts` L595
  - 상세: `MoreThan(new Date())` 는 TypeORM이 쿼리 파라미터로 Node.js 시각을 DB에 전달해 비교한다. DB 서버와 애플리케이션 서버 간 시계 차이가 있으면 경계값 처리가 달라질 수 있다. 현재 구현에서 만료 검증(`new Date() > stored.expiresAt`)이 이미 트랜잭션 밖에서 수행되므로 실질적 이중 검증이지만, DB 레벨 시각(`NOW()`)을 직접 사용(`expiresAt > NOW()` SQL raw condition)하면 애플리케이션·DB 시각 불일치 위험을 제거하고 인덱스 활용도 동일하다. 현재 허용 가능한 수준이나 멀티 리전 환경에서는 주의.

### 요약

이번 변경은 refresh 토큰 rotation을 `dataSource.transaction` 으로 원자화하는 최소 범위 구현이다. 성능 관점에서 가장 주목할 점은 `resolveTokenWorkspaceContext`(최대 3회 순차 DB 읽기)가 트랜잭션 콜백 내부에서 실행된다는 것이다. 이 함수는 write가 아닌 read 전용이므로 트랜잭션 의미상 묶일 필요가 없으며, 트랜잭션 hold time 및 커넥션 점유를 불필요하게 연장한다. 단 이전 리뷰에서 이미 INFO로 수용(실측 영향 미미, 후속 plan 권고)됐다. 그 외 `new Date()` 이중 생성, `getRepository` 이중 호출은 사소한 수준이다. 신규 Critical·Warning 성능 이슈는 없으며, 원자화 구조 자체는 세션 소실 제거라는 정확성 이득이 미소한 트랜잭션 hold time 증가보다 명백히 우선한다.

### 위험도

LOW
