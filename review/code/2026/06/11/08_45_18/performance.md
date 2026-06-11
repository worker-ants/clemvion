# 성능(Performance) 리뷰 결과

## 발견사항

- **[INFO]** `generateTokens` 내 `resolveTokenWorkspaceContext` 가 트랜잭션 내부에서 호출될 수 있음
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/auth-refresh-rotation-atomic/codebase/backend/src/modules/auth/auth.service.ts` — `generateTokens` (line ~1828), `resolveTokenWorkspaceContext` (line ~1879)
  - 상세: `refresh()` 의 `dataSource.transaction` 콜백이 `generateTokens(user, false, stored.familyId, ctx, manager)` 를 호출하고, `generateTokens` 내부에서 `await this.resolveTokenWorkspaceContext(user)` 를 가장 먼저 실행한다. `resolveTokenWorkspaceContext` 는 최대 3개의 연속 DB 쿼리(`findPersonalWorkspace` → `listForUser` → `findOrCreatePersonalWorkspace`)를 발행하는데, 이 쿼리들은 `manager` 가 아닌 `workspacesService` 의 자체 repository 를 사용하므로 열려 있는 트랜잭션 커넥션과 **별도 커넥션**으로 실행된다. 이는 트랜잭션 커넥션을 풀에서 점유한 채 추가 커넥션을 소비하는 구조로, 커넥션 풀 사용량이 올라가는 부하 상황에서 커넥션 고갈(pool exhaustion) 위험이 있다. 또한 JWT sign 직전에 불필요하게 트랜잭션 hold time 을 늘린다.
  - 제안: JWT 서명과 `resolveTokenWorkspaceContext` 호출을 트랜잭션 콜백 밖으로 끌어내거나, `generateTokens` 를 (1) 워크스페이스 컨텍스트 + JWT 계산 단계와 (2) DB INSERT 단계로 분리해 트랜잭션 hold time 을 최소화한다. 코멘트에 "JWT sign 은 DB 무관이라 트랜잭션 밖에서 선계산" 이라고 명시하고 있으나, 현재 구현에서는 `resolveTokenWorkspaceContext` (DB 쿼리 최대 3회)도 트랜잭션 내부에 포함된다.

- **[INFO]** `resolveTokenWorkspaceContext` 의 순차 DB 쿼리 3-step waterfall
  - 위치: `auth.service.ts` `resolveTokenWorkspaceContext` (line ~1879)
  - 상세: personal workspace 가 없는 경우 `findPersonalWorkspace` → `listForUser` → `findOrCreatePersonalWorkspace` 를 순차 직렬로 실행한다. 이 중 `findPersonalWorkspace` 가 null 을 반환한 뒤에야 `listForUser` 가 실행되는 구조는 변경 코드에 기존부터 존재하던 패턴이며, 이번 변경과 직접 연관은 없다. 그러나 refresh 경로에서 트랜잭션 hold time 을 키우는 요인이 됨을 인지할 필요가 있다.
  - 제안: 이 함수의 결과를 캐시(예: 짧은 in-memory TTL 또는 request-scoped cache)하거나, 트랜잭션 시작 전에 미리 계산해 두는 방식으로 트랜잭션 내 DB 왕복 수를 줄이는 것이 장기적으로 유효하다.

- **[INFO]** 테스트 파일의 `mockManager.getRepository` 가 매 호출마다 새 객체를 반환
  - 위치: `auth.service.spec.ts` `beforeEach` 내 `DataSource` mock (line ~244)
  - 상세: `entity !== RefreshToken` 분기에서 `{ update: jest.fn() }` 을 호출마다 새로 생성한다. 테스트 수가 많고 `beforeEach` 마다 재생성되므로 GC pressure 가 미미하게 증가한다. 성능 임계가 낮은 CI 환경에서 미미한 영향이므로 LOW 수준이다.
  - 제안: generic repo mock 을 `beforeEach` 외부 상수 또는 동일 참조로 정의해 불필요한 객체 재생성을 줄일 수 있다. 필수는 아님.

## 요약

이번 변경(05 C-1)의 핵심인 `dataSource.transaction` 도입은 세션 소실 방지를 위한 정확한 접근이며, 변경된 코드 자체의 알고리즘 복잡도·N+1 쿼리·메모리 누수는 발생하지 않는다. 단, `generateTokens` 가 트랜잭션 콜백 내부에서 호출될 때 `resolveTokenWorkspaceContext` 의 최대 3회 직렬 DB 쿼리(워크스페이스 서비스의 자체 커넥션 사용)가 트랜잭션 hold time 을 늘리고 커넥션 점유를 이중화하는 구조적 주의 사항이 있다. 코드 주석은 "JWT sign 은 트랜잭션 밖 선계산" 을 언급하지만 워크스페이스 조회는 여전히 트랜잭션 안에 포함된다. 현재 부하 수준에서 즉각적인 병목이 될 가능성은 낮으나, 커넥션 풀 크기가 작거나 refresh 트래픽이 집중되는 환경에서는 잠재적 병목이 된다.

## 위험도

LOW
