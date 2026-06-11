# Architecture Review — auth-refresh-rotation-atomic (09_06_19)

## 발견사항

### [INFO] `generateTokens` optional `EntityManager` 파라미터 — 제한적 DIP 위반
- 위치: `codebase/backend/src/modules/auth/auth.service.ts` `generateTokens()` 시그니처 (5번째 파라미터 `manager?: EntityManager`)
- 상세: 서비스 레이어 메서드가 TypeORM 인프라 구현체인 `EntityManager` 를 직접 파라미터로 받는다. 의존성 역전 원칙(DIP) 관점에서 비즈니스 레이어가 특정 ORM 구현체에 직접 결합되는 것은 추상화 누수다. 다만 NestJS + TypeORM 생태계에서 트랜잭션 전파를 위한 관용적 패턴이며, Unit of Work 추상화 레이어를 별도 도입하는 비용 대비 효과가 제한적이다. ORM 교체 시 이 시그니처가 변경 비용의 진입점이 된다. 이전 리뷰(08_45_18)에서도 동일하게 INFO 로 수용된 사항이다.
- 제안: 현 규모에서 리팩터링 필요 없음. JSDoc `@internal` 과 "트랜잭션 컨텍스트 전파 전용" 명시로 오용 억제(이미 이전 RESOLUTION `98aee7fb` 에서 반영됨).

### [INFO] `AuthService` 응집도 — 단일 클래스에 다수 인증 도메인 흐름 집중
- 위치: `codebase/backend/src/modules/auth/auth.service.ts` 전체 (~1924 LOC)
- 상세: register / verifyEmail / login / refresh / logout / forgotPassword / resetPassword / issueTokensAfterMfa / generateTokens / resolveTokenWorkspaceContext 등 인증 전 흐름이 단일 서비스에 집중되어 있다. 이번 변경이 이 구조를 악화시키지는 않는다. SRP 엄격 해석 기준으로는 경계가 넓으나 NestJS 모듈-서비스 단위에서 "인증 도메인" 을 하나의 서비스로 묶는 것은 실용적 선택이다.
- 제안: 토큰 발급 로직이 더 복잡해질 경우 `TokenIssuanceService` 로 추출 검토. 현 단계 분리 필요 없음.

### [INFO] `refreshTokenRepository.manager.getRepository(User)` — RefreshToken 리포지토리가 User 조회 게이트웨이 겸임
- 위치: `codebase/backend/src/modules/auth/auth.service.ts` `findUserByVerifyToken` / `findUserByResetToken` (lines ~1911–1921, 이번 변경과 무관한 기존 코드)
- 상세: `User` 리포지토리가 직접 주입되지 않아 `RefreshToken` 리포지토리의 `manager` 를 빌려 `User` 엔티티를 조회한다. 모듈 경계 불명확의 신호이며 레이어 책임 분리 위반이다. 이번 변경이 이 패턴을 도입한 것은 아니고 기존 부채다.
- 제안: `@InjectRepository(User)` 를 `AuthService` 에 추가해 의존성 경로 명확화. 이번 PR 범위 밖이므로 별도 후속 이슈로 추적.

### [INFO] 테스트 mock 의 엔티티 클래스 동일성 비교 — 장기 취약성
- 위치: `codebase/backend/src/modules/auth/auth.service.spec.ts` `mockDataSource.transaction` 내 `getRepository` mock (`entity === RefreshToken` 분기)
- 상세: 런타임 클래스 참조 동일성(`entity === RefreshToken`)으로 mock 리포지토리를 분기하는 패턴은 현재 범위에서는 적절하다. 단, 엔티티 클래스가 래핑·상속·재익스포트될 경우 silent 실패 가능성이 있다. 또한 `stubInvitationFriendlyDataSource` 내부에는 동일 분기가 없어, invitation 경로에서 `generateTokens` 가 `manager` 없이 호출됨(트랜잭션 외부 INSERT)을 암묵적으로 가정한다 — 이 가정이 구현과 일치하는지 주석이 없어 독자가 확인해야 한다.
- 제안: `stubInvitationFriendlyDataSource` 에 "invitation 경로는 트랜잭션 내부에서 RefreshToken 직접 사용 안 함" 근거 주석 추가. 단기적으로는 현행 유지 허용.

### [INFO] `dataSource.transaction` 범위 — `resolveTokenWorkspaceContext` 가 트랜잭션 내부에서 실행
- 위치: `codebase/backend/src/modules/auth/auth.service.ts` `generateTokens` 내 `resolveTokenWorkspaceContext` 호출 (트랜잭션 콜백 안에서 실행됨)
- 상세: `resolveTokenWorkspaceContext` 는 최대 3회 순차 DB read 를 포함하는데, 이것이 `dataSource.transaction` 콜백 내부에서 실행되어 트랜잭션 hold time 이 늘어나고 커넥션을 이중 점유한다. 이전 RESOLUTION(INFO 1)에서 "refresh 빈도·트랜잭션 길이 모두 작아 실측 영향 미미, 트랜잭션 hold 최소화는 후속" 으로 수용된 사항이다. 아키텍처 관점에서는 "조회 계산 단계" 와 "쓰기 단계" 를 분리하는 것이 레이어 책임 명확화에도 유리하다.
- 제안: `resolveTokenWorkspaceContext` 호출을 트랜잭션 콜백 밖으로 이동해 hold time 최소화 + 읽기/쓰기 단계 명확 분리. 후속 plan 아이템으로 등록 권장.

### [INFO] `loginHistory.record` 미호출 — 설계 의도 명시 필요
- 위치: `codebase/backend/src/modules/auth/auth.service.ts` `refresh()` 메서드 (이전 RESOLUTION INFO 4 에서 주석 추가 조치됨)
- 상세: `login` / `verifyEmail` / `registerWithInvitation` 은 성공 후 `loginHistory.record` 를 호출하는 반면 `refresh` 정상 회전은 기록하지 않는다. spec §1.4 의도이나 패턴 불일치로 독자가 의문을 품을 수 있다. 이전 RESOLUTION 에서 주석 추가가 이미 반영(`98aee7fb`)되었으므로 현재 diff 에서는 잔여 이슈 없음.
- 제안: 이전 RESOLUTION 반영 확인. 추가 조치 불필요.

## 요약

이번 변경은 `refresh` 토큰 회전의 revoke + INSERT 를 `dataSource.transaction` 으로 원자화한 최소 범위의 정합성 수정이다. 변경 자체는 레이어 책임과 모듈 경계를 해치지 않으며, SOLID 원칙 위반을 새로 도입하지 않는다. `generateTokens` 의 `optional EntityManager` 패턴은 NestJS + TypeORM 생태계 관용구로 수용 가능하고 JSDoc 명시로 오용을 억제하는 구조를 갖추었다. 주요 아키텍처 우려사항(RefreshToken.manager 경유 User 조회 · AuthService 응집도)은 기존 부채이며 이번 변경이 악화시키지 않는다. `resolveTokenWorkspaceContext` 의 트랜잭션 내부 실행에 의한 hold time 연장은 후속 리팩터로 분리하면 읽기/쓰기 단계 책임 분리도 함께 개선된다. 이전 리뷰 세션(08_45_18) 에서 도출된 아키텍처 발견사항 모두 RESOLUTION(`98aee7fb`) 에서 적절히 수용 또는 조치되었으며, 이번 재검토에서 신규 Critical 또는 Warning 수준의 아키텍처 문제는 발견되지 않았다.

## 위험도

LOW

STATUS: SUCCESS
