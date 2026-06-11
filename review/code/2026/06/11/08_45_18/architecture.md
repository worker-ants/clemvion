# Architecture Review — auth-refresh-rotation-atomic

## 발견사항

### **[INFO]** `generateTokens` 의 optional `EntityManager` 파라미터 — 제한적 DIP 위반
- 위치: `codebase/backend/src/modules/auth/auth.service.ts` line ~1826 (`generateTokens` 시그니처)
- 상세: `generateTokens(user, rememberMe, familyId, ctx, manager?)` 는 TypeORM 인프라 구현체인 `EntityManager` 를 직접 인자로 받는다. 의존성 역전 원칙(DIP) 관점에서 서비스 레이어의 메서드가 특정 ORM 의 `EntityManager` 에 직접 결합되는 것은 추상화 누수다. 다만 이 패턴은 NestJS + TypeORM 생태계에서 "트랜잭션 전파" 를 위한 관용적 접근이고, 추상 리포지토리 레이어(Unit of Work 패턴 등)를 별도 도입하는 비용 대비 효과가 제한적이므로 구조적 결함이라기보다 인지해야 할 트레이드오프다. 미래에 ORM 교체 시 이 시그니처가 변경 비용의 진입점이 된다.
- 제안: 현 규모에서 리팩토링 필요는 없다. 단, `manager` 파라미터는 마지막 위치에 두고 JSDoc 으로 "트랜잭션 컨텍스트 전파 전용" 임을 명시해 오용을 방지한다(이미 인라인 주석이 있어 부분적으로 충족됨).

### **[INFO]** `AuthService` 의 응집도 — 단일 클래스에 다수 도메인 흐름 집중
- 위치: `codebase/backend/src/modules/auth/auth.service.ts` 전체 (~1924 LOC)
- 상세: `AuthService` 는 register / verifyEmail / login / refresh / logout / forgotPassword / resetPassword / resendVerification / checkEmail / issueTokensAfterMfa / generateTokens / resolveTokenWorkspaceContext 를 모두 보유한다. 이는 단일 책임 원칙(SRP) 의 엄격한 해석에서는 경계가 넓지만, NestJS 의 모듈-서비스 단위에서 "인증 도메인 전체" 를 하나의 서비스로 통합하는 것은 일반적이고 실용적인 선택이다. 이번 변경(`refresh` 원자화)이 새로운 응집도 문제를 도입하지는 않는다.
- 제안: 현 단계에서 분리 필요는 없다. 향후 토큰 발급 로직이 더 복잡해지면 `TokenIssuanceService` 등으로 추출하는 것을 검토할 수 있다.

### **[INFO]** `findUserByVerifyToken` / `findUserByResetToken` — `refreshTokenRepository.manager` 경유 User 조회
- 위치: `auth.service.ts` lines ~1911–1921
- 상세: `this.refreshTokenRepository.manager.getRepository(User)` 로 `User` 엔티티를 조회한다. `User` 리포지토리가 직접 주입되지 않아 `RefreshToken` 리포지토리의 `manager` 를 빌려 쓰는 간접 접근이다. 이번 변경이 이 패턴을 도입한 것은 아니지만, 레이어 책임 관점에서 `RefreshToken` 리포지토리가 `User` 조회의 게이트웨이 역할을 겸하는 것은 모듈 경계가 불명확한 신호다.
- 제안: `@InjectRepository(User)` 를 `AuthService` 에 추가해 `User` 리포지토리를 직접 주입하면 의존성 경로가 명확해진다. 이번 PR 범위를 넘어서므로 별도 이슈로 추적하는 것이 적절하다.

### **[INFO]** 테스트 모크 라우팅 — `getRepository(entity)` 분기 로직의 취약성
- 위치: `auth.service.spec.ts` lines ~41–49, ~161–171 (`mockDataSource.transaction` 내부)
- 상세: `entity === RefreshToken` 비교로 모크 리포지토리를 분기한다. 이는 런타임 클래스 동일성 비교에 의존하는 구조라, 모듈 경계가 바뀌거나 엔티티 클래스가 래핑/상속되면 비교가 깨질 수 있다. 또한 `stubInvitationFriendlyDataSource`(lines ~381–398) 는 `entity === RefreshToken` 분기 없이 동일한 generic mock 을 반환하므로, 초대 등록 흐름에서 RefreshToken INSERT 가 별도 manager 경로를 통하지 않음을 암묵적으로 가정한다 — 이 가정이 구현과 일치하는지 주석으로 명시하면 유지보수성이 높아진다.
- 제안: `stubInvitationFriendlyDataSource` 내부에도 `entity === RefreshToken` 분기를 추가하거나, "invitation 경로는 트랜잭션 내부에서 RefreshToken 을 직접 사용하지 않는다" 는 근거를 주석으로 문서화한다.

### **[INFO]** `dataSource.transaction` 범위 — `loginHistory.record` 가 트랜잭션 밖에 위치하는 것의 명시성
- 위치: `auth.service.ts` lines ~1683–1691 (`refresh` 메서드)
- 상세: 트랜잭션 이후 `loginHistory.record` 호출이 없다(refresh 회전 성공 이벤트는 기록하지 않는 설계). 이는 plan 문서와 spec 노트에 "트랜잭션 밖" 임이 명시돼 있어 의도된 설계다. 그러나 `login`, `verifyEmail`, `registerWithInvitation` 은 성공 후 `loginHistory.record` 를 호출하는 반면 `refresh` 는 하지 않아 일관성 관점에서 의문이 생길 수 있다.
- 제안: 코드 주석에 "refresh 회전 성공은 login_history 에 기록하지 않는다 (spec §1.4 의도)" 한 줄을 추가해 누락이 아님을 명시한다.

## 요약

이번 변경은 `refresh` 토큰 회전의 revoke + INSERT 를 `dataSource.transaction` 으로 원자화한 최소 범위의 정합성 수정이다. 레이어 책임과 모듈 경계 측면에서 기존 구조를 해치지 않으며, `generateTokens` 의 `optional EntityManager` 패턴은 NestJS + TypeORM 생태계 관용구로 수용 가능하다. 주요 아키텍처 우려사항은 이번 PR 이 아니라 기존 설계에서 기인하며(refreshTokenRepository.manager 를 통한 User 조회, AuthService 응집도), 이번 변경은 그 구조를 악화시키지 않는다. 테스트 모크의 엔티티 클래스 동일성 비교는 장기적으로 취약할 수 있으나 현재 범위에서는 적절하다.

## 위험도

LOW
