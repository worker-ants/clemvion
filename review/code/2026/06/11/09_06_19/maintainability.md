# 유지보수성(Maintainability) 리뷰

## 발견사항

### auth.service.ts

- **[WARNING]** 주석 언어 혼용 — 동일 함수 내 영/한 혼재
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/auth-refresh-rotation-atomic/codebase/backend/src/modules/auth/auth.service.ts` `generateTokens()` — 기존 `// Create refresh token`, `// 15 minutes` (영어 인라인) + 신규 `// 05 C-1 — refresh 회전 시…` (한국어 블록)
  - 상세: 코드베이스 전반이 한국어 주석 추세로 이행 중이나 `generateTokens` 함수 내부에서 기존 영어 인라인 주석과 이번 변경으로 추가된 한국어 블록 주석이 혼재한다. 같은 함수 안에서 언어가 섞이면 독자가 맥락 전환 비용을 치르게 되어 가독성을 저해한다.
  - 제안: `generateTokens` 내 기존 영어 인라인 주석(`// Create refresh token`, `// 15 minutes`)을 한국어로 통일하거나, 적어도 신규 추가 주석은 기존 스타일을 따르는 방향을 일관 적용할 것.

- **[INFO]** `generateTokens` positional 파라미터 5개 — 호출 시 순서 추론 부담
  - 위치: `auth.service.ts` `generateTokens(user, rememberMe, familyId, ctx, manager?)` 시그니처
  - 상세: `user`, `rememberMe`, `familyId`, `ctx`, `manager` 순으로 5개의 positional 파라미터가 나열된다. 이번 변경에서 `manager`가 마지막에 추가돼 기존 호출처가 변경되지 않은 점은 올바른 선택이다. 그러나 현재 시그니처에서 3번째 `familyId?`와 5번째 `manager?`가 모두 optional이어서 호출처에서 인수 개수를 세야 의도를 파악할 수 있다. 호출처가 6곳으로 제한적이어서 즉각 문제는 없으나, 향후 파라미터가 추가될 경우 무음 버그 위험이 있다.
  - 제안: 다음 시그니처 변경 시점에 `GenerateTokensOptions` 인터페이스(`{ rememberMe?, familyId?, ctx?, manager? }`)로 묶는 것을 권장. 단기적으로는 현행 유지 허용.

- **[INFO]** 매직 넘버 `900` (access token TTL)
  - 위치: `auth.service.ts` line ~768 (`expiresIn: 900`)
  - 상세: 15분을 초 단위로 표현한 `900`이 인라인에 하드코딩되어 있고, 옆 주석(`// 15 minutes`)으로 의미를 보완하고 있다. 같은 파일에서 `BCRYPT_ROUNDS` 등은 명명 상수로 관리되어 있으나 이 값은 그렇지 않다. 이번 변경이 이 값을 도입한 것은 아니지만, 추후 TTL 정책 변경 시 숫자와 주석 양쪽을 수동으로 동기화해야 하는 부담이 생긴다.
  - 제안: `const ACCESS_TOKEN_TTL_SEC = 900;` 으로 상수 추출 (기존 코드 정리 기회, 이번 PR 필수 아님).

- **[INFO]** `refreshRepo` 지역 변수 — 이중 사용 패턴 명확
  - 위치: `auth.service.ts` `generateTokens` 내 lines ~780-792
  - 상세: `manager ? manager.getRepository(RefreshToken) : this.refreshTokenRepository` 삼항 패턴이 한 곳에만 있고, `refreshRepo`라는 명명이 의도를 잘 전달한다. `create` + `save` 양쪽에서 동일 변수를 사용해 중복 없이 일관적이다.
  - 제안: 없음.

- **[INFO]** `if (!result.affected)` 분기 — falsy 체크 범위
  - 위치: `auth.service.ts` line ~602 (`if (!result.affected)`)
  - 상세: TypeORM의 `UpdateResult.affected`는 `number | null | undefined`일 수 있다. `!result.affected`는 `0`, `null`, `undefined` 모두를 "영향 없음"으로 처리하는데, 이 의미론적 처리가 의도적인지 명시되어 있지 않다. `null`/`undefined`가 반환되는 드라이버(예: MySQL에서 조건 없이 업데이트)에서 오탐(false rejection)이 발생할 수 있다.
  - 제안: `result.affected === 0`으로 명시적 비교하거나, `affected` 값이 falsy 전체를 거부하는 의도를 주석으로 명시할 것. 예: `// affected=null/undefined 은 드라이버가 행 수를 보고하지 않는 경우로, 여기서는 보수적으로 거부한다`.

---

### auth.service.spec.ts

- **[WARNING]** `mockRefreshTokenRepo` 클로저 의존 — 선언 순서 결합 취약성
  - 위치: `auth.service.spec.ts` `beforeEach` 내부 lines ~56-68 (변수 선언), lines ~142-161 (DataSource mock 내 클로저 참조)
  - 상세: `mockRefreshTokenRepo`가 `beforeEach` 지역 변수로 선언되고, 이후에 구성되는 `DataSource.transaction` mock이 동일 클로저를 암묵적으로 캡처한다. 이 의존 관계는 두 블록 사이의 선언 순서에 결합되어 있어, 향후 `beforeEach` 내 코드 순서가 바뀌거나 변수가 재선언되면 `getRepository` 분기 로직이 의도치 않게 구 참조를 물고 있는 silent 버그로 이어질 수 있다.
  - 제안: `DataSource` mock 객체 구성 바로 위에 `// DataSource.transaction mock 은 위 mockRefreshTokenRepo 를 클로저로 캡처함 — 이 변수보다 나중에 선언해야 함` 한 줄 주석으로 의존성을 명시할 것.

- **[INFO]** `refreshTokenRepo.findOne` mock 값 반복 — 4개 테스트 중 3개에 동일 setup
  - 위치: `auth.service.spec.ts` 신규 추가된 테스트 케이스 및 기존 케이스 내 `findOne.mockResolvedValue({...})` 패턴
  - 상세: `describe('refresh')` 블록 내 다수 테스트가 `id: 'rt-1'`, `userId: mockUser.id`, `familyId: 'family-1'`, `isRevoked: false`, `expiresAt: Date.now() + 86400000`, `user: mockUser`를 반복 정의한다. 이번 변경에서 추가된 케이스 3개(`rotates`, `does not open a transaction`, `propagates failure`)도 동일 패턴을 재현한다. 중복 setup은 엔티티 구조 변경 시 수정 지점을 분산시킨다.
  - 제안: `refresh` describe 블록의 `beforeEach`에 공통 `findOne` mock을 추출하고, reuse-detection 케이스만 `isRevoked: true`로 오버라이드. 변경 최소화로 테스트 의도가 더 명확해진다.

- **[INFO]** `86400000` 매직 넘버 — 테스트 전반에 반복
  - 위치: `auth.service.spec.ts` — 이번 변경으로 추가된 케이스 포함, `Date.now() + 86400000` 패턴 다수
  - 상세: 24시간을 밀리초로 표현한 `86400000`이 테스트 파일 전반에 걸쳐 인라인으로 반복된다. 숫자 자체로는 의미가 즉시 파악되지 않는다.
  - 제안: 테스트 파일 상단에 `const ONE_DAY_MS = 24 * 60 * 60 * 1000;` 상수 추출 (기존 코드 포함 일괄 정리 기회).

- **[INFO]** 테스트 이름 스타일 불일치 — `should ...` vs 현재 시제 동사
  - 위치: `auth.service.spec.ts` — 기존: `should refresh tokens with valid refresh token`, 신규: `rotates revoke + issue inside a single transaction (05 C-1 atomicity)`, `rejects without issuing a token when...`, `does not open a transaction for...`, `propagates failure when...`
  - 상세: 기존 테스트 이름은 `should + 동사` 패턴을 사용하는 반면, 이번 변경에서 추가된 4개 케이스는 현재 시제 동사(`rotates`, `rejects`, `does not`, `propagates`)를 사용한다. 기능적 차이는 없으나 같은 describe 블록 안에서 스타일이 섞이면 일관성이 떨어진다.
  - 제안: 신규 케이스를 `should rotate revoke + issue inside a single transaction`, `should reject without issuing a token when...` 등 기존 패턴으로 통일하거나, 이번 기회에 describe 블록 전체를 현재 시제 패턴으로 마이그레이션할 것. 어느 방향이든 블록 단위 일관성이 우선이다.

- **[INFO]** 회귀 가드 주석 패턴 미적용 — 일부 테스트 본문
  - 위치: `auth.service.spec.ts` 신규 `it` 블록들
  - 상세: 이번 추가된 테스트 케이스 중 일부는 `it` 설명(description)에 `(05 C-1 atomicity)` 참조가 있으나, 블록 첫 줄 인라인 주석(`// 05 C-1 회귀 가드:`)은 존재하는 케이스와 없는 케이스가 혼재한다. 코드베이스에서 이 패턴이 이미 관용적으로 사용되고 있어 미적용 시 독자가 맥락을 `it` 설명만으로 파악해야 한다.
  - 제안: 모든 신규 `it` 블록 첫 줄에 `// 05 C-1 회귀 가드: <한 줄 설명>` 형식으로 일관 적용할 것.

---

### spec/data-flow/2-auth.md

- **[INFO]** 원자성 노트의 구현 내부 세부사항 노출
  - 위치: `spec/data-flow/2-auth.md` §1.4 회전 원자성 blockquote
  - 상세: 추가된 노트가 `generateTokens` 함수명이나 `optional EntityManager` 같은 구현 내부 용어를 참조하는 경우, spec 문서가 구현 메커니즘에 직접 결합된다. spec의 역할은 "무엇을" 보장하는지를 서술하는 것이므로, 구현 수단보다 동작 계약("revoke와 INSERT는 단일 트랜잭션 안에서 원자적으로 수행된다") 수준의 서술이 적합하다. 구현 리팩터 시 spec 업데이트 부담이 생기는 spec-impl 강결합의 신호다.
  - 제안: 구현 수단(`optional EntityManager` 등) 언급을 제거하고 `auth.service.ts refresh()` 코드 참조 수준만 유지할 것.

---

## 요약

이번 변경(`auth.service.ts` refresh 회전 원자화 + 테스트 추가 + spec 업데이트)은 전반적으로 유지보수성 수준이 양호하다. 핵심 로직 변경(트랜잭션 래핑, optional manager)이 작고 명확하며, 기존 호출처 6곳을 건드리지 않은 점이 특히 올바른 설계다. 주요 개선 기회는 세 가지다: (1) `generateTokens` 함수 내 영/한 주석 혼용 정리(WARNING), (2) `mockRefreshTokenRepo` 클로저 의존 관계를 주석으로 명시해 선언 순서 결합 취약성 차단(WARNING), (3) `it` 블록 내 `findOne` mock 중복 setup을 `beforeEach`로 추출. 테스트 이름 스타일 불일치와 `86400000` 매직 넘버는 기존 코드로부터 계승된 사안으로 이번 변경 전용 이슈는 아니지만, 신규 추가된 케이스들이 기존 패턴을 계속 답습하고 있어 정리 기회임을 지적한다. spec 문서의 구현 세부사항 노출은 spec-impl 결합도 관점에서 장기적으로 관리가 필요한 지점이다.

## 위험도

LOW
