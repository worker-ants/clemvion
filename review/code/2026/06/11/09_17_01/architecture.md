# Architecture Review — auth-refresh-rotation-atomic (re-review)

## 발견사항

### **[INFO]** `generateTokens` 의 optional `EntityManager` 파라미터 — 제한적 DIP 트레이드오프, 이전 리뷰 이후 JSDoc 보강 완료
- 위치: `codebase/backend/src/modules/auth/auth.service.ts` `generateTokens` 시그니처
- 상세: 이전 리뷰(08_45_18)에서 제기된 아키텍처 INFO 항목이다. `manager?: EntityManager` 가 TypeORM 인프라 구현체에 직접 결합되는 제한적 DIP 위반임은 유지되나, RESOLUTION 에 따라 JSDoc `@internal` 및 `@param manager` 설명이 추가되어 trust boundary 명문화가 이루어졌다. `private` 가시성 + JSDoc 문서화의 조합으로 현 시점 수용 가능한 트레이드오프다.
- 제안: 현 상태 수용. 향후 5-파라미터 positional 시그니처를 `GenerateTokensOptions` 인터페이스로 묶을 때 함께 검토한다.

### **[INFO]** `AuthService` 단일 클래스 응집도 — 본 변경의 영향 없음
- 위치: `codebase/backend/src/modules/auth/auth.service.ts` 전체
- 상세: `AuthService` 가 인증 도메인의 모든 흐름(register, verifyEmail, login, refresh, logout, 비밀번호 재설정, MFA 등)을 한 클래스에 통합하고 있다. 이번 `refresh` 원자화 변경은 기존 응집도 구조를 악화시키지 않는다. NestJS 모듈-서비스 단위 관행 범위 내이며 즉각적 분리 필요는 없다.
- 제안: 향후 토큰 발급 경로가 복잡해지면 `TokenIssuanceService` 분리 검토 가능. 본 PR 범위 밖.

### **[INFO]** `refreshTokenRepository.manager.getRepository(User)` — 기존 패턴, 본 변경 도입 아님
- 위치: `codebase/backend/src/modules/auth/auth.service.ts` `findUserByVerifyToken` / `findUserByResetToken` 부근
- 상세: `RefreshToken` 리포지토리의 `manager` 를 빌려 `User` 를 조회하는 패턴은 이번 변경이 도입한 것이 아니라 기존 코드다. 모듈 경계 불명확 신호이지만 본 PR 범위를 넘어서므로 별도 이슈로 추적이 적합하다.
- 제안: `@InjectRepository(User)` 직접 주입으로 의존성 경로 명확화. 별도 backlog.

### **[INFO]** `resolveTokenWorkspaceContext` 가 트랜잭션 콜백 내부에서 실행 — 레이어 책임 경계 주의
- 위치: `codebase/backend/src/modules/auth/auth.service.ts` `generateTokens` → `resolveTokenWorkspaceContext` 호출
- 상세: `refresh()` 의 `dataSource.transaction` 콜백이 `generateTokens(manager)` 를 호출하고, `generateTokens` 내부에서 `resolveTokenWorkspaceContext` (최대 3회 직렬 DB 쿼리)가 `manager` 와 무관한 자체 서비스 리포지토리를 통해 실행된다. 트랜잭션 콜백 안에서 비트랜잭션 DB 작업이 섞이는 것은 레이어 책임 경계를 흐린다. 코드 주석("JWT sign 은 DB 무관이라 트랜잭션 밖 선계산")은 의도를 설명하지만, workspace 조회가 여전히 트랜잭션 hold time 안에 있다는 사실과 불일치한다. 단, `resolveTokenWorkspaceContext` 는 read-only 성격이라 정합성에는 문제 없다.
- 제안: `resolveTokenWorkspaceContext` 결과를 트랜잭션 콜백 밖에서 미리 계산하거나, `generateTokens` 를 (1)계산 단계 + (2)INSERT 단계로 분리해 트랜잭션 hold time 을 최소화하는 것이 레이어 책임 측면에서 더 명확하다. RESOLUTION 에서 후속 backlog 로 기록됨 — 수용.

### **[INFO]** 테스트 모크의 `entity === RefreshToken` 런타임 동일성 비교
- 위치: `codebase/backend/src/modules/auth/auth.service.spec.ts` DataSource mock 내 `getRepository` 분기
- 상세: `entity === RefreshToken` 비교로 mock 리포지토리를 라우팅한다. 클래스 동일성 비교라 엔티티 클래스가 래핑/상속되면 비교가 깨질 수 있다. `stubInvitationFriendlyDataSource` 는 이 분기 없이 동작하는데, 초대 등록 경로에서 `RefreshToken` INSERT 가 트랜잭션 manager 를 사용하지 않는다는 가정이 암묵적으로 포함되어 있다. 이 가정을 주석으로 명시하면 유지보수성이 높아진다.
- 제안: `stubInvitationFriendlyDataSource` 에 "invitation 경로는 트랜잭션 내부에서 RefreshToken 을 직접 사용하지 않는다" 근거 주석 추가.

### **[INFO]** `loginHistory.record` 미호출 의도 명시 — RESOLUTION 에서 주석 추가 확인
- 위치: `codebase/backend/src/modules/auth/auth.service.ts` `refresh()` 메서드
- 상세: `login`, `verifyEmail`, `registerWithInvitation` 경로와 달리 `refresh` 정상 회전에는 `loginHistory.record` 가 없다. 이번 RESOLUTION 에서 "spec §1.4 의도" 주석이 추가됐다. 아키텍처 관점에서는 감사 이벤트 레이어와 트랜잭션 레이어의 분리가 일관되게 유지되고 있다.
- 제안: 조치 완료.

## 요약

이번 변경(`refresh` 토큰 회전 원자화, 05 C-1)은 아키텍처 관점에서 최소 범위의 정확한 수정이다. `dataSource.transaction` 으로 revoke + INSERT 를 원자화하는 설계는 레이어 책임(서비스 레이어의 DB 트랜잭션 경계 직접 제어)과 모듈 경계(AuthModule 내부 단일 서비스) 측면에서 NestJS + TypeORM 생태계의 관용적 패턴 범위 안에 있다. `generateTokens` 의 optional `EntityManager` 는 제한적 DIP 트레이드오프이나 JSDoc `@internal` 명문화로 trust boundary 가 보강됐다. 주요 아키텍처 우려사항(refreshTokenRepository.manager 를 통한 User 조회, AuthService 응집도, resolveTokenWorkspaceContext 트랜잭션 hold 문제)은 이번 변경이 도입한 것이 아니라 기존 설계에서 기인하며, 이번 변경이 그 구조를 악화시키지 않는다. 전반적으로 기존 아키텍처와의 일관성을 유지하면서 원자성 결함을 보정한 변경으로 평가한다.

## 위험도

LOW
