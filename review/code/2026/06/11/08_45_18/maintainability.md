# 유지보수성(Maintainability) 리뷰

## 발견사항

### auth.service.ts

- **[INFO]** `generateTokens` 시그니처에 `manager?: EntityManager` 추가 — optional 파라미터 위치
  - 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/auth/auth.service.ts` line 1826
  - 상세: `manager` 가 파라미터 목록 마지막에 위치한 것은 올바르다. 다만 positional 파라미터 5개가 쌓이면서 (`user`, `rememberMe`, `familyId`, `ctx`, `manager`) 호출 시 순서 파악이 어렵다. 현재 호출처가 많지 않아 즉각 문제는 없으나, 인자 수가 늘어날 경우 options 객체 패턴으로 리팩터링이 권장된다.
  - 제안: 단기적으로는 현행 유지 허용. 다음 시그니처 변경 시점에 `GenerateTokensOptions` 인터페이스로 묶는 것 권장.

- **[INFO]** `refreshRepo` 로컬 변수의 이중 사용 — 가독성 양호
  - 위치: line 1850–1862
  - 상세: `manager ? manager.getRepository(RefreshToken) : this.refreshTokenRepository` 패턴이 명확하고 한 곳에만 있어 중복 없음. 네이밍 `refreshRepo` 도 의도를 잘 나타낸다.
  - 제안: 없음.

- **[INFO]** 매직 넘버 `900` (access token TTL)
  - 위치: line 1838 (`expiresIn: 900`)
  - 상세: 15분을 초 단위로 표현한 하드코딩 값이 숫자로만 남아 있다. 같은 파일에서 `BCRYPT_ROUNDS` 는 상수로 추출되어 있으나 이 값은 인라인이다. 나쁜 패턴이 이미 있는 것은 아니고 이 변경에서 새로 추가된 것도 아니지만, 기존 불일치를 주목할 필요가 있다.
  - 제안: `const ACCESS_TOKEN_TTL_SECONDS = 900;` 으로 상수 추출 (기존 코드 정리 기회).

- **[INFO]** `refresh()` 내부 트랜잭션 콜백 — 함수 길이 허용 범위 내
  - 위치: line 1683–1691
  - 상세: 트랜잭션 콜백이 2줄로 간결하고 `generateTokens` 위임으로 책임이 명확히 분리되어 있다. 가독성 양호.
  - 제안: 없음.

- **[WARNING]** 주석 언어 혼용 — 코드베이스 내 영/한 혼용
  - 위치: line 1677–1681 (한국어 블록 주석), line 1689 (영어 인라인 주석), line 1823–1826 (한국어 블록 주석)
  - 상세: `generateTokens` 함수 내 기존 영어 주석(`// Create refresh token`, `// 15 minutes`)과 이번 변경에서 추가된 한국어 주석(`// 05 C-1 — refresh 회전 시…`)이 같은 함수 안에 혼재한다. 코드베이스 전반적으로 한국어 주석을 사용하는 추세이나, 함수 단위 내 혼용은 읽기 흐름을 방해한다.
  - 제안: 같은 함수 내 주석 언어를 통일하거나 영어 인라인 주석을 한국어로 맞춤.

### auth.service.spec.ts

- **[INFO]** `mockRefreshTokenRepo` 스코프 — 클로저 의존 패턴 명확함
  - 위치: line 161–171 (`beforeEach` 내부 `mockRefreshTokenRepo` 선언), line 244–263 (DataSource mock 내 참조)
  - 상세: `mockRefreshTokenRepo` 가 `beforeEach` 내부에 선언되고 `DataSource.transaction` mock 이 동일 클로저를 참조한다. 이 패턴은 의도적이며 주석(`05 C-1`)으로 잘 설명되어 있다. 그러나 이 의존 관계가 `beforeEach` 내부 변수 선언 순서에 암묵적으로 결합되어 있어, 미래 리팩터 시 순서를 바꾸면 silent 버그가 발생할 수 있다.
  - 제안: 주석에 "DataSource mock 은 이 변수를 클로저로 캡처함 — 선언 순서 변경 시 주의" 한 줄 추가로 의존성 명시.

- **[INFO]** 테스트 데이터 중복 — `refreshTokenRepo.findOne` mock 값
  - 위치: line 58–65, 80–87, 634–641, 649–656, 670–677, 689–694
  - 상세: `refresh` describe 블록 내 4개 테스트 중 3개가 동일한 `findOne` mock 값(`id: 'rt-1'`, `userId`, `familyId: 'family-1'`, `isRevoked: false`, `expiresAt: now+86400000`, `user: mockUser`)을 반복 설정한다. 이번 변경에서 추가된 2개 케이스(`rotates revoke + issue`, `propagates failure`)도 동일 패턴이다.
  - 제안: `refresh` describe 의 `beforeEach` 에 공통 `findOne` mock 을 추출하고, reuse-detection 케이스만 `isRevoked: true` 로 오버라이드. 테스트 의도가 더 명확해지고 중복이 제거된다.

- **[INFO]** 테스트 이름 길이 및 스타일 일관성
  - 위치: line 57 (`rotates revoke + issue inside a single transaction (05 C-1 atomicity)`), line 79 (`propagates failure (transaction rolls back) when issuing the new token fails`)
  - 상세: 기존 테스트 이름은 `should ...` 패턴(`should refresh tokens with valid refresh token`, `should revoke family on reuse detection`)인데, 추가된 두 케이스는 현재 시제 동사(`rotates`, `propagates`)를 사용한다. 기능적 차이는 없으나 스타일 불일치가 있다.
  - 제안: 기존 패턴(`should rotate revoke + issue inside a single transaction`) 또는 현재 패턴 중 하나로 통일. 어느 쪽이든 일관성 확보가 우선.

- **[INFO]** `86400000` 매직 넘버 (24시간을 밀리초로)
  - 위치: line 63, 85, 639, 655, 674, 692
  - 상세: `Date.now() + 86400000` 패턴이 파일 전체에 걸쳐 반복 사용된다. 이번 변경에서 새로 도입된 것은 아니나, 추가된 케이스들도 같은 패턴을 반복한다.
  - 제안: 테스트 파일 상단에 `const ONE_DAY_MS = 24 * 60 * 60 * 1000;` 상수 추출 (기존 코드 포함 일괄 정리 기회).

### spec/data-flow/2-auth.md

- **[INFO]** 원자성 노트의 구현 세부사항 노출 수준
  - 위치: line 2054–2060 (추가된 `> **회전 원자성 (05 C-1)**` 블록)
  - 상세: spec 문서가 `generateTokens` 함수명과 `optional EntityManager` 매개변수 이름 등 구현 내부 세부사항을 직접 참조한다. spec 의 목적이 "무엇을" 보장하는지 서술하는 것이라면, 구현 메커니즘(`optional EntityManager`)보다는 동작 계약("revoke 와 INSERT 는 원자적") 수준이 더 적합하다. 현재 서술은 spec 과 구현이 강결합되어 구현 리팩터 시 spec 업데이트 부담이 생긴다.
  - 제안: 구현 수단(`generateTokens optional EntityManager`) 언급을 제거하고 "구현: `auth.service.ts refresh()`" 수준의 코드 참조만 남기는 것 권장.

### plan/in-progress/auth-refresh-rotation-atomic.md

- **[INFO]** 변경 기술 수준 적절 — 구현/테스트/spec 체크리스트 항목 명확
  - 상세: plan 문서의 체크리스트가 코드·테스트·spec·review 단계를 명시하고 Rationale 이 설계 결정을 뒷받침한다. 유지보수성 문제 없음.

---

## 요약

이번 변경(`auth.service.ts`의 refresh 회전 원자화 + 테스트 추가 + spec 업데이트)은 전반적으로 유지보수성이 양호하다. 핵심 로직 변경(`refresh()` 트랜잭션 래핑, `generateTokens` optional manager)은 작고 명확하며 기존 호출처를 변경하지 않는다. 주요 개선 기회는 세 가지다: (1) 테스트 파일 내 `refreshTokenRepo.findOne` mock 값의 반복을 `beforeEach` 로 추출, (2) 테스트 이름 스타일(`should ...` vs 현재시제) 통일, (3) `generateTokens` 내 영/한 주석 혼용 정리. spec 문서가 구현 내부 세부사항(함수 파라미터명)을 직접 노출하는 것은 장기적으로 spec-impl 결합도를 높이므로 주의가 필요하다.

## 위험도

LOW
