# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [INFO] generateTokens 시그니처에 optional 파라미터 추가
- 위치: `codebase/backend/src/modules/auth/auth.service.ts` — `generateTokens` 메서드
- 상세: `manager?: EntityManager` 파라미터가 추가되었다. 기본값 미전달 시 기존의 `this.refreshTokenRepository`를 사용하도록 구현되어 있어, 모든 기존 호출처(`login`, `verifyEmail`, `registerWithInvitation`, `loginWithTotp`, `issueTokensAfterMfa`, `issueTokensForOauthUser`)는 변경 없이 동작한다. `generateTokens`는 `private` 메서드이므로 외부 공개 API 영향 없음. 부작용 위험: NONE.
- 제안: 현재 구현 유지.

### [INFO] refresh() 내부 revoke+INSERT 흐름이 dataSource.transaction으로 이동
- 위치: `codebase/backend/src/modules/auth/auth.service.ts` — `refresh()` 메서드 (~line 1683)
- 상세: 기존에는 `this.refreshTokenRepository.update(...)` → `this.generateTokens(...)` 순서로 두 개의 독립 DB 작업이 순차 실행되었다. 변경 후에는 두 작업이 단일 트랜잭션 콜백 안에서 실행된다. 동작상 observable 부작용은 없다. 단, `generateTokens` 내에서 호출되는 `resolveTokenWorkspaceContext`(`findPersonalWorkspace`, `listForUser`, `findOrCreatePersonalWorkspace`)는 트랜잭션 `manager`에 포함되지 않고 기존의 TypeORM connection을 직접 사용한다. 이 조회들은 read-only 성격이므로 트랜잭션 격리 범위를 벗어나도 데이터 정합성에는 문제가 없다. 의도된 설계임이 주석에서 확인된다("JWT sign 은 DB 무관이라 트랜잭션 밖").
- 제안: 현재 설계 유지.

### [WARNING] loginHistory.record()가 트랜잭션 밖에서 호출되지 않음 (refresh 경로)
- 위치: `codebase/backend/src/modules/auth/auth.service.ts` — `refresh()` 전체
- 상세: 변경 전후 모두 `refresh()` 정상 회전 경로에는 `loginHistory.record()` 호출이 없다. 기존 코드에도 없었으므로 이번 변경이 도입한 회귀는 아니다. 다만 reuse 탐지 분기에는 `loginHistory.record(event: 'token_reuse_detected')`가 존재한다. 이 호출은 `dataSource.transaction` 블록 밖에 있어서 트랜잭션 롤백과 무관하게 항상 실행된다. 정상 회전 성공 이벤트를 login_history에 기록하지 않는 설계는 plan 문서 및 spec에 명시된 의도("loginHistory 는 트랜잭션 밖에 유지")와 일치하므로 부작용이 아닌 의도된 생략이다.
- 제안: 정상 회전 성공 감사 이벤트 요건이 추후 추가되는 경우, `dataSource.transaction()` 반환 후에 추가하면 된다. 현 상태는 기존과 동일.

### [INFO] mockDataSource.transaction 의 getRepository routing 변경 (테스트 파일)
- 위치: `codebase/backend/src/modules/auth/auth.service.spec.ts` — DataSource mock (`beforeEach`)
- 상세: 기존에는 `mockManager.getRepository`가 항상 `{ update: jest.fn() }` 단일 객체를 반환했다. 변경 후에는 `entity === RefreshToken`이면 `mockRefreshTokenRepo`(외부 단언에서 사용하는 spy 포함)를 반환하고, 그 외는 기존 generic mock을 반환한다. 이 변경은 테스트 범위에만 한정되며 프로덕션 코드에 영향을 주지 않는다. 다만 `register(invitationToken)` 테스트 케이스(`stubInvitationFriendlyDataSource`)는 `beforeEach`에서 이 routing 변경이 적용된 mock을 먼저 세팅한 후 `mockDataSource.transaction.mockImplementation`으로 재정의한다. 순서상 `beforeEach`(routing mock) → `stubInvitationFriendlyDataSource`(override)이므로 invitation 테스트는 독립 mock을 사용하며 충돌 없다.
- 제안: 현재 구조 유지.

### [INFO] 새 테스트에서 refreshTokenRepo.save mock이 공유 상태 변경 가능
- 위치: `codebase/backend/src/modules/auth/auth.service.spec.ts` — `propagates failure` 테스트 케이스 (~line 590)
- 상세: `refreshTokenRepo.save.mockRejectedValueOnce(...)` 사용으로 한 번만 실패 주입이 적용되고 이후 호출은 기본 `mockResolvedValue`로 복원된다. `mockRejectedValueOnce`는 `beforeEach`에서 매 테스트마다 mock이 재생성되므로 테스트 간 상태 오염 없다.
- 제안: 현재 구조 유지.

### [INFO] EntityManager import 추가
- 위치: `codebase/backend/src/modules/auth/auth.service.ts` — import 라인
- 상세: `import { DataSource, EntityManager, Repository } from 'typeorm'` — 기존 `DataSource, Repository`에서 `EntityManager`가 추가되었다. 모듈 레벨 import 변경이며 런타임 부작용 없음.
- 제안: 현재 구조 유지.

---

## 요약

이번 변경의 핵심은 `auth.service.ts`의 `refresh()` 메서드에서 구 토큰 revoke(UPDATE)와 신규 토큰 INSERT를 단일 `dataSource.transaction` 블록으로 원자화한 것이다. `generateTokens` 에 `manager?: EntityManager` optional 파라미터가 추가되었으나 기본값 미전달 시 기존 repository를 사용하는 하위 호환 설계이므로 기존 6개 호출처에 대한 시그니처 파괴 없다. `resolveTokenWorkspaceContext`(read-only 조회)가 트랜잭션 manager 밖에서 실행되지만 이는 의도된 설계이고 데이터 정합성에 영향을 주지 않는다. 전역 변수 도입, 파일시스템 부작용, 환경 변수 변경, 의도치 않은 네트워크 호출은 없다. 테스트 파일의 mock routing 변경은 테스트 격리 범위에 한정된다.

## 위험도

LOW
