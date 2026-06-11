# Code Review 통합 보고서

## 전체 위험도
**LOW** — refresh 토큰 회전 원자화(05 C-1) 구현은 기능적으로 올바르며 새로운 Critical 취약점은 없음. 테스트 커버리지 갭 2건(WARNING) 과 보안/유지보수 관련 WARNING 4건이 존재하나 즉각 차단 사안은 아님.

## Critical 발견사항

_없음_

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `generateTokens` 시그니처에 `optional manager?: EntityManager` 추가로 trust boundary 확장 — 현재 `private` 경계 내에서는 안전하나 향후 승격 시 의도치 않은 트랜잭션 컨텍스트에서 토큰 INSERT 위험 | `auth.service.ts` `generateTokens()` | 트랜잭션 경로를 별도 `private generateTokensInTransaction(manager, ...)` 메서드로 분리하거나, JSDoc `@internal` 명시로 승격 억제 문서화 |
| 2 | Security | 만료 검증이 트랜잭션 밖에서 수행되어 TOCTOU 창 존재 — 만료 경계에서 이론적 경쟁 조건 가능 | `auth.service.ts` `refresh()` — `new Date() > stored.expiresAt` 비교 후 트랜잭션 진입 | UPDATE WHERE 절에 `AND is_revoked = false AND expires_at > NOW()` 조건 추가 후 `affected = 0` 시 토큰 무효 처리 |
| 3 | Testing | 만료된 refresh token 경로에서 트랜잭션이 호출되지 않음을 검증하는 테스트 케이스 부재 | `auth.service.spec.ts` — 만료 토큰 분기 미커버 | `expiresAt < now` 케이스 추가: `expect(mockDataSource.transaction).not.toHaveBeenCalled()` 단언 포함 |
| 4 | Testing | `resolveTokenWorkspaceContext` 실패 시(refresh rotation 경로) 동작 테스트 부재 — workspace 조회 실패가 트랜잭션 전 발생해 DB 롤백 불필요함을 테스트로 문서화 필요 | `auth.service.ts` `generateTokens` 내 `resolveTokenWorkspaceContext` 호출 | workspace 조회 실패 시 시나리오 테스트 추가 (트랜잭션이 열리기 전 실패하므로 DB 롤백 없음을 명시) |
| 5 | Maintainability | 코드베이스 내 영/한 주석 혼용 — 같은 함수(`generateTokens`) 안에 기존 영어 인라인 주석과 신규 한국어 블록 주석 혼재 | `auth.service.ts` lines 1677–1681, 1689, 1823–1826 | 같은 함수 내 주석 언어 통일 (한국어로 맞추거나 영어로 통일) |
| 6 | Testing | 롤백 시나리오 테스트("propagates failure") 가 단언과 주석 불일치 — "is_revoked=false 유지"를 주장하지만 unit mock에서 실제 DB 롤백 불가로 직접 증명 불가 | `auth.service.spec.ts` lines 79–96 | 테스트 주석에 "단위 mock에서는 실제 DB 롤백 불가 — 에러 전파만 검증, 실제 롤백은 integration 테스트 필요" 명시 또는 `refreshTokenRepo.update` 호출 여부 단언 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Performance | `resolveTokenWorkspaceContext`(최대 3회 순차 DB 쿼리)가 트랜잭션 내부에서 실행되어 트랜잭션 hold time 연장 및 커넥션 이중 점유 | `auth.service.ts` `generateTokens` → `resolveTokenWorkspaceContext` | JWT sign + workspace 조회를 트랜잭션 콜백 밖으로 선계산 이동 또는 `generateTokens` 를 계산 단계/INSERT 단계로 분리 |
| 2 | Architecture | `generateTokens` 의 optional `EntityManager` 파라미터 — TypeORM 인프라 구현체에 직접 결합(제한적 DIP 위반). NestJS+TypeORM 관용구로 수용 가능하나 ORM 교체 시 변경 비용 진입점 | `auth.service.ts` line ~1826 | 현 규모에서 리팩토링 불필요. JSDoc으로 "트랜잭션 컨텍스트 전파 전용" 명시 |
| 3 | Architecture | `refreshTokenRepository.manager.getRepository(User)` 로 User 조회 — RefreshToken 리포지토리가 User 조회 게이트웨이 역할 겸임 (모듈 경계 불명확) | `auth.service.ts` lines ~1911–1921 `findUserByVerifyToken` / `findUserByResetToken` | `@InjectRepository(User)` 직접 주입으로 의존성 경로 명확화. 이번 PR 범위 밖으로 별도 이슈 추적 |
| 4 | Architecture | `refresh()` 에서 `loginHistory.record()` 미호출 — login/verifyEmail 등은 성공 이벤트 기록하나 refresh 정상 회전은 기록 안 함 | `auth.service.ts` `refresh()` | 코드 주석에 "refresh 회전 성공은 login_history 에 기록하지 않는다 (spec §1.4 의도)" 한 줄 추가 |
| 5 | Requirement | `refresh()` 정상 회전 분기에서 `stored.user` null 체크 부재 — reuse 분기(`if (stored.user)`)와 처리 불일관 | `auth.service.ts` `refresh()` lines 577, 585 | `if (!stored.user)` 가드 추가 또는 reuse 분기와 동일한 방어 패턴 적용 |
| 6 | Testing | 테스트 이름 스타일 불일치 — 기존 `should ...` 패턴 vs 신규 현재 시제 동사 패턴(`rotates`, `propagates`) | `auth.service.spec.ts` lines 57, 79 | 기존 패턴(`should rotate ...`) 또는 현재 패턴으로 통일 |
| 7 | Testing | `refreshTokenRepo.findOne` mock 값 반복 — refresh describe 내 3개 테스트가 동일 setup 반복 | `auth.service.spec.ts` lines 58–65, 80–87, 634–641 등 | `refresh` describe 의 `beforeEach` 에 공통 `findOne` mock 추출, reuse-detection 케이스만 오버라이드 |
| 8 | Testing | `registerWithInvitation` 내 `generateTokens` 가 `manager` 없이 호출 — user 생성 성공 + refresh token INSERT 실패 시 부분 성공 가능성 (05 C-1 철학과 불일관) | `auth.service.ts` line 1251 | 현 변경 범위 밖. 후속 plan 아이템으로 등록 권장 |
| 9 | Maintainability | `generateTokens` positional 파라미터 5개 (`user`, `rememberMe`, `familyId`, `ctx`, `manager`) — 호출 시 순서 파악 어려움 | `auth.service.ts` line 1826 | 다음 시그니처 변경 시점에 `GenerateTokensOptions` 인터페이스로 묶는 것 권장 |
| 10 | Maintainability | `spec/data-flow/2-auth.md` 원자성 노트가 구현 내부 세부사항(`optional EntityManager` 파라미터명) 직접 참조 — spec-impl 강결합 | `spec/data-flow/2-auth.md` lines 2054–2060 | 구현 수단 언급 제거, `auth.service.ts refresh()` 코드 참조 수준만 유지 |
| 11 | Documentation | `generateTokens` private 메서드 및 `refresh()` 메서드에 JSDoc 부재 — `manager` 전달 여부 실수 방지를 위한 최소 주석 필요 | `auth.service.ts` `generateTokens` / `refresh()` 시그니처 | JSDoc 블록 추가 (최소 `@param manager` 설명 + 세 분기 요약) |
| 12 | Documentation | 테스트 신규 케이스에 기존 패턴의 맥락 주석(`// 05 C-1 회귀 가드:`) 미적용 | `auth.service.spec.ts` 신규 `it` 블록 | 각 `it` 블록 첫 줄에 `// 05 C-1 회귀 가드:` 형식 주석 추가 |
| 13 | Security | 트랜잭션 실패 시 일반 `Error` 가 클라이언트에 원문 노출될 가능성 — 글로벌 예외 필터 적용 여부 확인 필요 | `auth.service.ts` `refresh()` `dataSource.transaction` reject 전파 | 글로벌 예외 필터에서 `Error.message` 가 클라이언트에 직렬화되지 않도록 보장 (이번 변경 범위 밖) |
| 14 | Documentation | `plan/in-progress/auth-refresh-rotation-atomic.md` spec 경로 표기가 상대 경로 스타일 (`data-flow/2-auth.md §1.4`) — 규약은 `spec/` 루트 기준 전체 경로 | `plan/in-progress/auth-refresh-rotation-atomic.md` L28 | `spec/data-flow/2-auth.md §1.4` 로 통일 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | TOCTOU 창(트랜잭션 밖 만료 검증), `generateTokens` trust boundary 확장 — 새로운 Critical 취약점 없음 |
| performance | LOW | `resolveTokenWorkspaceContext` 최대 3회 쿼리가 트랜잭션 hold time 연장 및 커넥션 이중 점유 |
| architecture | LOW | `generateTokens` optional EntityManager DIP 트레이드오프, `refreshTokenRepository.manager` 경유 User 조회 |
| requirement | LOW | 요구사항(C-1 원자화) 완전 충족. `stored.user` null 체크 불일관(INFO) |
| scope | NONE | 4개 파일 모두 plan 정의 범위에 정확히 부합, 불필요한 변경 없음 |
| side_effect | LOW | 기존 6개 호출처 동작 변경 없음. `resolveTokenWorkspaceContext` 트랜잭션 밖 실행은 의도된 설계 |
| maintainability | LOW | 영/한 주석 혼용, 테스트 이름 스타일 불일치, spec 구현 내부 노출 |
| testing | LOW | 만료 토큰 경로 트랜잭션 비호출 검증 부재(WARNING), 롤백 단언-주석 불일치(WARNING) |
| documentation | LOW | `generateTokens` / `refresh()` JSDoc 부재, 신규 테스트 맥락 주석 미적용 |

## 발견 없는 에이전트

- **scope**: 이슈 없음. 변경 범위가 plan 정의와 1:1 대응.

## 권장 조치사항

1. **(WARNING — Security)** `refresh()` UPDATE 쿼리에 `AND is_revoked = false AND expires_at > NOW()` 조건 추가로 TOCTOU 창 제거. `affected = 0` 시 토큰 무효 처리.
2. **(WARNING — Testing)** 만료 토큰 경로 테스트 케이스 추가 — `mockDataSource.transaction` 미호출 단언 포함.
3. **(WARNING — Testing)** 롤백 시나리오 테스트 주석 수정 — "단위 mock에서는 실제 DB 롤백 불가" 명시, 또는 `refreshTokenRepo.update` 호출 여부 단언 추가.
4. **(WARNING — Security/Maintainability)** `generateTokens` 에 JSDoc `@internal` 또는 `@param manager` 설명 추가로 trust boundary 명문화.
5. **(WARNING — Maintainability)** `generateTokens` 내 영/한 주석 혼용 정리 — 한국어 통일 권장.
6. **(INFO — Performance)** `resolveTokenWorkspaceContext` 호출을 트랜잭션 콜백 밖으로 이동하거나 `generateTokens` 를 계산/INSERT 단계로 분리해 트랜잭션 hold time 최소화.
7. **(INFO — Architecture)** `refresh()` 에 `loginHistory.record()` 미호출 근거 주석 한 줄 추가 ("spec §1.4 의도").
8. **(INFO — Requirement)** `stored.user` null 가드를 정상 회전 분기에도 추가해 reuse 분기와 방어 패턴 통일.
9. **(INFO — Testing)** `refresh` describe 의 `beforeEach` 에 공통 `findOne` mock 추출로 반복 제거.
10. **(INFO — Testing)** `registerWithInvitation` 에서 `generateTokens` 가 트랜잭션 없이 호출되는 부분 성공 가능성을 후속 plan 아이템으로 등록.

## 라우터 결정

라우터가 실행됨(`routing=done`).

- **실행** (9명): `security`, `performance`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`
- **강제 포함(router_safety)** (7명): `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`
- **제외** (5명):

| 제외된 reviewer | 이유 |
|------------------|------|
| dependency | 라우터 선별 제외 |
| database | 라우터 선별 제외 |
| concurrency | 라우터 선별 제외 |
| api_contract | 라우터 선별 제외 |
| user_guide_sync | 라우터 선별 제외 |