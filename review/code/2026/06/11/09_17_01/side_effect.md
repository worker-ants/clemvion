# 부작용(Side Effect) 리뷰 — refresh 토큰 rotation 원자화 (05 C-1)

## 발견사항

### [INFO] `generateTokens` 시그니처 변경 — 기존 호출처 영향 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/auth-refresh-rotation-atomic/codebase/backend/src/modules/auth/auth.service.ts` `generateTokens()` 시그니처
- 상세: `manager?: EntityManager` 파라미터가 마지막 위치에 optional 로 추가됐다. `private` 메서드이므로 외부 API 변경은 없으며, 기존 호출처(`login`, `registerWithInvitation`, `issueTokensAfterMfa`, `verifyEmail` 경로 등)는 `manager` 를 전달하지 않아 기존 `this.refreshTokenRepository` 경로를 그대로 사용한다. 기본값 분기(`manager ? manager.getRepository(RefreshToken) : this.refreshTokenRepository`)가 명시적으로 처리되어 호출처 동작 변경은 없다.
- 제안: 없음. 설계 의도대로 구현됨.

### [INFO] `loginHistory.record` 미호출 — 의도된 부작용 생략
- 위치: `auth.service.ts` `refresh()` 정상 회전 분기 (트랜잭션 콜백 포함)
- 상세: `login`, `verifyEmail`, `registerWithInvitation` 은 성공 후 `loginHistory.record()` 를 호출해 감사 로그를 남기는 공유 부작용이 있다. `refresh()` 는 정상 회전 시 해당 호출이 없다. spec §1.4 가 이를 의도하는 것으로 문서화되어 있어(plan 문서 참조) 누락이 아닌 의도된 설계다. 이번 변경에서 이 동작을 바꾸지 않았다.
- 제안: 없음. 단, `refresh()` 함수에 "정상 회전은 login_history 미기록(spec §1.4 의도)" 주석을 명시해두면 향후 혼동을 예방할 수 있다.

### [INFO] `resolveTokenWorkspaceContext` 트랜잭션 내부 실행 — DB 연결 점유 연장
- 위치: `auth.service.ts` `generateTokens()` → `resolveTokenWorkspaceContext()` 호출, `refresh()` 의 `dataSource.transaction` 콜백 안에서 간접 실행
- 상세: `resolveTokenWorkspaceContext` 는 최대 3회 순차 DB read 를 수행한다. `refresh()` 가 `generateTokens` 를 트랜잭션 콜백 내부에서 호출하므로, 이 read 들이 트랜잭션 hold time 안에 포함되어 DB 연결을 추가로 점유한다. 이는 기존 `login` 경로에서는 존재하지 않던 트랜잭션 포함 부작용이다. 빈도와 hold time이 작아 현재 규모에서 실측 영향은 미미하지만, 이전 구현 대비 트랜잭션 범위가 늘어났다는 점에서 의도치 않은 성능 부작용으로 볼 수 있다.
- 제안: `resolveTokenWorkspaceContext` 호출을 트랜잭션 콜백 밖(`return this.dataSource.transaction(...)` 이전)으로 이동하면 트랜잭션 hold time 을 최소화할 수 있다. 단, 이는 본 PR 범위의 후속 개선 사항이다.

### [INFO] `DataSource` import 추가 — `MoreThan`, `EntityManager` 신규 심볼
- 위치: `auth.service.ts` import 라인 (`DataSource, EntityManager, MoreThan, Repository`)
- 상세: `MoreThan` 은 TypeORM Find Options 연산자이며, `EntityManager` 는 트랜잭션 콜백 타입 파라미터용이다. 두 심볼 모두 기존에 없던 전역 import 지점이지만, 모듈 수준 side effect(전역 상태 변경, 환경 변수 접근 등)를 동반하지 않는 순수 TypeORM 타입/유틸리티다.
- 제안: 없음.

### [INFO] 테스트 mock `update` 기본값 변경 — `undefined` → `{ affected: 1 }`
- 위치: `auth.service.spec.ts` `mockRefreshTokenRepo.update` 기본 mock 반환값
- 상세: 이전에는 `update: jest.fn().mockResolvedValue(undefined)` 였으나 `{ affected: 1 }` 로 변경됐다. 이는 `refresh()` 의 `!result.affected` 조건 분기가 정상 케이스에서 통과하도록 맞춘 것으로, 기존 `update` 를 단언하는 테스트들에 대해 반환값의 구체적 내용을 단언하지 않는 한 행동 변화가 없다. 그러나 `update` 반환값을 명시적으로 사용하는 기존 테스트가 있다면 잠재적 영향이 있을 수 있다.
- 제안: 기존 테스트가 `update` 반환값을 사용하지 않는지 확인 완료(변경된 diff 범위 기준). 신규 케이스의 `affected: 0` 오버라이드(`mockResolvedValueOnce`)가 기본값과 충돌 없이 올바르게 동작한다.

### [INFO] `DataSource.transaction` mock 내부 `getRepository` 라우팅 변경
- 위치: `auth.service.spec.ts` `mockDataSource.transaction` 내부 `mockManager.getRepository` 구현
- 상세: 이전 mock 은 `getRepository` 호출 시 `{ update: jest.fn().mockResolvedValue(undefined) }` 를 단일 반환했다. 변경 후에는 `entity === RefreshToken ? mockRefreshTokenRepo : { update: ... }` 분기로 `RefreshToken` 을 외부 단언 가능한 `mockRefreshTokenRepo` 에 라우팅한다. 이로 인해 트랜잭션 내부에서 `RefreshToken` 외의 엔티티 리포지토리를 가져올 경우 generic `{ update: ... }` 가 반환된다. 현재 `refresh()` 트랜잭션 안에서 `RefreshToken` 이외의 엔티티를 직접 조작하지 않으므로 다른 테스트에 영향을 주지 않는다. 단, `entity === RefreshToken` 비교는 클래스 참조 동일성에 의존하므로, 모듈 경계 변경 시 silent failure 가능성이 있다.
- 제안: 없음 (현재 범위에서 안전).

## 요약

이번 변경(`auth.service.ts` refresh 회전 원자화, `auth.service.spec.ts` 테스트 추가)은 부작용 관점에서 전반적으로 안전하다. `generateTokens` 의 `manager?` optional 파라미터 추가는 기존 호출처(login/OAuth/verifyEmail 등 6개 경로)의 동작을 변경하지 않으며, `private` 경계 유지로 외부 API 노출 없음이 확인된다. 의도치 않은 전역 상태 변경, 파일시스템 부작용, 환경 변수 접근, 외부 네트워크 호출은 발견되지 않았다. 유일한 주목할 부작용은 `resolveTokenWorkspaceContext`(최대 3 DB read)가 `dataSource.transaction` 콜백 내부에 포함되어 이전 구현 대비 트랜잭션 hold time 이 약간 늘어난 것으로, 성능 영향은 미미하나 의도되지 않은 트랜잭션 범위 확장이다. `loginHistory.record` 미호출은 의도된 설계(spec §1.4)로 새로운 부작용이 아니다.

## 위험도

LOW

STATUS: SUCCESS
