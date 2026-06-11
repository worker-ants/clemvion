# 부작용(Side Effect) 리뷰 — auth-refresh-rotation-atomic

## 발견사항

### [INFO] `generateTokens` 시그니처 변경 — 기존 호출처 무영향 확인
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/auth-refresh-rotation-atomic/codebase/backend/src/modules/auth/auth.service.ts` `generateTokens()` 파라미터 목록
- 상세: `manager?: EntityManager` 가 5번째 optional 파라미터로 추가됐다. 기존 호출처(`login`, `verifyEmail`, `registerWithInvitation`, `issueTokensAfterMfa`, `refresh`의 reuse 분기)는 모두 4개 인자 이하로 호출하므로 JavaScript/TypeScript optional 파라미터 의미론상 기존 동작이 그대로 유지된다. 시그니처 변경이 호출자에게 미치는 부작용은 없다.
- 제안: 없음. 단, 향후 호출처 추가 시 `manager` 미전달이 의도인지 주석으로 확인하도록 JSDoc을 보강하는 것이 예방책이 된다.

### [INFO] `generateTokens` 내부 — `refreshTokenRepository` 와 `manager.getRepository(RefreshToken)` 의 상태 분리
- 위치: `auth.service.ts` lines ~1850–1862 (`refreshRepo` 로컬 변수 분기)
- 상세: `manager` 전달 시 `manager.getRepository(RefreshToken)` 을 사용해 INSERT 한다. 이 repo 인스턴스는 TypeORM 트랜잭션 컨텍스트에 귀속된 별도 객체로, 모듈 수준 `this.refreshTokenRepository` 와 공유 상태를 갖지 않는다. `create()` 호출도 단순 엔티티 객체 생성으로 DB 상태를 변경하지 않으며, `save()` 만이 트랜잭션 경계 안에서 쓰기를 수행한다. 의도치 않은 공유 상태 변경 없음.
- 제안: 없음.

### [INFO] `dataSource.transaction` 콜백 내 `resolveTokenWorkspaceContext` — 트랜잭션 컨텍스트 밖 읽기 쿼리 발생
- 위치: `auth.service.ts` `generateTokens()` 내 `resolveTokenWorkspaceContext` 호출 — `dataSource.transaction` 콜백 진입 후 실행
- 상세: `resolveTokenWorkspaceContext` 는 최대 3회의 DB read 쿼리를 수행한다. 이 쿼리들은 전달된 `manager` 를 사용하지 않고 내부적으로 별도의 커넥션(또는 풀에서 새로 획득한 커넥션)을 통해 실행된다. 트랜잭션 격리 수준에 따라 이 read 쿼리들이 커밋 전 상태를 볼 수 있어 읽기 일관성 이슈가 이론적으로 존재하나, 이 쿼리들이 읽는 데이터(workspace 컨텍스트)는 refresh 회전과 무관한 메타데이터이므로 실제 부작용 위험은 낮다. 다만 트랜잭션 hold time이 불필요하게 연장되는 부수 효과는 있다.
- 제안: 심각한 부작용은 아니나, `resolveTokenWorkspaceContext` 를 트랜잭션 콜백 밖에서 선계산한 뒤 결과만 콜백에 전달하면 hold time 단축과 커넥션 이중 점유 해소 두 가지를 동시에 얻을 수 있다. 현 규모에서는 수용 가능.

### [INFO] `refresh()` — `loginHistory.record` 미호출이 의도된 상태 비변경
- 위치: `auth.service.ts` `refresh()` 메서드 전체
- 상세: 기존 구현에서도 `refresh()` 정상 회전 분기는 `loginHistory.record` 를 호출하지 않았다. 이번 변경 이후에도 동일하게 미호출이다. `login`, `verifyEmail`, `registerWithInvitation` 등이 이벤트를 기록하는 것과 대비되나, 이는 의도된 설계(spec §1.4 — refresh 회전은 보안 이벤트가 아님)이므로 부작용이 아니다. 코드 주석에 미호출 근거("spec §1.4 의도")가 명시돼 있어 미래 유지보수자의 실수 가능성도 낮다.
- 제안: 없음.

### [INFO] 테스트 mock 변경 — `refreshTokenRepo.update` 기본값 `{ affected: 1 }` 로 변경
- 위치: `auth.service.spec.ts` line 38 (`update: jest.fn().mockResolvedValue({ affected: 1 })`)
- 상세: 기존에는 `mockResolvedValue(undefined)` 였던 mock 이 `{ affected: 1 }` 로 변경됐다. 이는 기존 테스트가 `result.affected` 를 읽지 않았기 때문에 무해했던 값이 이제 의미를 갖는 것으로, 기존 테스트들의 동작에는 영향을 주지 않는다(`affected` 결과를 단언하는 기존 테스트가 없으므로). `affected: 0` 케이스는 `mockResolvedValueOnce` 로 오버라이드되므로 테스트 간 상태 누출도 없다.
- 제안: 없음.

### [INFO] 트랜잭션 mock 라우팅 — `entity === RefreshToken` 비교로 공유 repo 참조
- 위치: `auth.service.spec.ts` lines ~52–60 (`getRepository` mock 내 `entity === RefreshToken` 분기)
- 상세: 트랜잭션 내부에서 `mockRefreshTokenRepo` 를 반환함으로써, 트랜잭션 콜백과 외부 테스트 코드가 동일한 mock 객체 참조를 공유한다. 이는 의도된 설계(단언을 위해)이지만, 테스트 간 `beforeEach` 로 mock 이 새로 생성되므로 테스트 간 상태 오염은 발생하지 않는다. 단일 테스트 내에서 트랜잭션 안팎의 호출이 동일 mock 에 누적되는 것도 의도한 동작이다.
- 제안: 없음. 다만 `beforeEach` 내부 `mockRefreshTokenRepo` 선언이 `DataSource` mock 보다 먼저 위치해야 클로저 캡처가 올바르게 동작한다는 순서 의존성이 암묵적으로 존재한다. 주석으로 명시하면 유지보수 시 실수를 예방할 수 있다.

### [INFO] 전역 변수 도입 없음
- 위치: 변경된 전 파일
- 상세: 이번 변경에서 모듈 스코프 또는 전역 스코프의 새로운 변수가 도입되지 않았다. 추가된 import(`EntityManager`, `MoreThan`)는 타입/유틸리티 import 로 런타임 상태를 보유하지 않는다.
- 제안: 없음.

### [INFO] 파일시스템·환경 변수·네트워크·이벤트 부작용 없음
- 위치: 변경된 전 파일
- 상세: 이번 변경은 DB 트랜잭션 경계 조정과 그에 따른 repository 선택 로직 변경에 국한된다. 파일시스템 접근, 환경 변수 읽기/쓰기, 외부 HTTP 호출, 이벤트 발행 패턴의 변경이 없다. `loginHistory.record` 미호출은 기존 동작 유지이므로 이벤트 부작용 변경으로 볼 수 없다.
- 제안: 없음.

## 요약

이번 변경(`refresh` 토큰 회전의 revoke + INSERT 원자화)은 부작용 관점에서 매우 안전하다. `generateTokens` 의 optional `EntityManager` 파라미터 추가는 기존 호출처 전부를 무변경으로 흡수하며, 신규 트랜잭션 경로는 `this.refreshTokenRepository` 공유 상태를 건드리지 않고 별도 repo 인스턴스를 사용한다. 전역 변수 도입, 파일시스템 부작용, 환경 변수 조작, 외부 네트워크 호출 변경은 없다. 유일하게 주목할 점은 `resolveTokenWorkspaceContext` 가 트랜잭션 콜백 안에서 실행돼 커넥션을 이중 점유하고 hold time을 연장한다는 것이나, 읽기 전용 쿼리이고 refresh 회전과 무관한 데이터를 읽으므로 실질적 부작용은 미미하다. 테스트 mock 변경(`affected: 1` 기본값)도 기존 테스트 동작에 영향을 주지 않는다.

## 위험도

LOW

STATUS: SUCCESS
