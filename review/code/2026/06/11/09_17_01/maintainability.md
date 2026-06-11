# 유지보수성(Maintainability) 리뷰

## 발견사항

### auth.service.ts

- **[WARNING]** 주석 언어 혼용 — 같은 함수 내 영/한 혼재
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/auth-refresh-rotation-atomic/codebase/backend/src/modules/auth/auth.service.ts` `generateTokens` 내부 (line 778-782)
  - 상세: 이번 변경에서 추가된 한국어 블록 주석(`// 05 C-1 — refresh 회전 시…`, `// refresh token 생성`)이 기존 영어 인라인 주석(`// 15분` 으로 번역됐으나 다른 함수 내 `// Create refresh token`, `// 15 minutes` 등 영어 주석과 혼재)과 같은 함수 안에 공존한다. `generateTokens` 파라미터 직전 인라인 주석(한국어 3행)과 함수 본문의 `// 15분`, `// refresh token 생성`(한국어)은 새로 추가된 패턴이나, 파일 전체에 걸쳐 코드베이스 기존 영어 인라인 주석들과 함께 읽을 때 흐름이 끊긴다.
  - 제안: `generateTokens` 함수 내 기존 영어 인라인 주석(`// 15 minutes` 계열)을 한국어로 맞추거나, 최소한 같은 함수 스코프 내에서는 언어를 통일. 코드베이스 전반의 주석 언어 정책(한국어 우선)을 따르는 방향이 일관적이다.

- **[INFO]** `generateTokens` positional 파라미터 5개 — options 객체 부재
  - 위치: `auth.service.ts` `generateTokens` 시그니처 (line 759-767)
  - 상세: `(user, rememberMe, familyId, ctx, manager?)` 5개 positional 파라미터는 호출 시 순서 실수를 유발하기 쉽다. 현재 호출처가 6개이고 모두 `private` 경계 내이므로 즉각 문제는 없지만, `manager` 추가로 파라미터 수가 증가해 인지 부담이 높아졌다. 특히 `familyId?: string` 과 `ctx: AuthContext = {}` 사이에서 `undefined` 를 명시적으로 전달해야 하는 호출처(`this.generateTokens(user, rememberMe, undefined, ctx)`)가 이미 존재한다.
  - 제안: 다음 시그니처 변경 시점에 `GenerateTokensOptions` 인터페이스로 묶는 것 권장. 단기 현행 유지 허용.

- **[INFO]** `refreshRepo` 지역 변수 패턴 — 명확하고 중복 없음
  - 위치: `auth.service.ts` lines 791-803
  - 상세: `manager ? manager.getRepository(RefreshToken) : this.refreshTokenRepository` 분기를 `refreshRepo` 하나로 묶어 이후 `create` / `save` 두 곳에서 재사용한다. 가독성과 DRY 모두 양호하다.
  - 제안: 없음.

- **[INFO]** 매직 넘버 `900` — 기존 불일치 지속
  - 위치: `auth.service.ts` line 779 (`expiresIn: 900, // 15분`)
  - 상세: 이번 변경에서 새로 도입된 것이 아니고, 주석으로 의미를 설명하고 있다. 그러나 같은 파일 내 `refreshExpDays * 24 * 60 * 60 * 1000` 처럼 명시적 계산식을 사용하는 패턴과 비교할 때 `900` 단독 숫자는 일관성이 부족하다. `BCRYPT_ROUNDS` 같은 파일 상단 상수와 달리 인라인으로 남아 있다.
  - 제안: `const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;` 으로 상수 추출하면 의미가 자명해진다. 기존 코드 정리 기회로 활용 가능.

- **[INFO]** `refresh()` 트랜잭션 콜백 — 간결하고 책임 분리 양호
  - 위치: `auth.service.ts` lines 601-621
  - 상세: 콜백이 `update` + `affected` 체크 + `generateTokens` 위임의 세 단계로 명확히 구분되며, 각 단계의 의도를 블록 주석이 충분히 설명한다. 함수 길이와 중첩 깊이 모두 허용 범위 내.
  - 제안: 없음.

- **[INFO]** JSDoc 내 backtick 사용 — `` `@param manager` `` 표기
  - 위치: `auth.service.ts` lines 751-757 (`generateTokens` JSDoc)
  - 상세: JSDoc 에서 `@param` 태그를 코드 블록으로 감싸(`\`@param manager\``) 표준 JSDoc 렌더링 도구에서 파라미터 연결이 끊길 수 있다. 표준 형식은 `@param manager - 설명` 이다.
  - 제안: `` `@param manager` `` → `@param manager` 로 변경해 IDE / TSDoc 파싱 호환성 확보.

### auth.service.spec.ts

- **[WARNING]** `refreshTokenRepo.findOne` mock 값 반복 — 4개 테스트 중 3개가 동일 setup
  - 위치: `auth.service.spec.ts` 신규 케이스 lines 78-85, 106-113, 143-150 (각 it 블록 내 `findOne.mockResolvedValue`)
  - 상세: 이번 변경에서 추가된 4개 테스트 케이스 중 3개(`rotates revoke + issue`, `rejects without issuing`, `propagates failure`)가 동일한 `findOne` 반환 객체(`id: 'rt-1'`, `userId: mockUser.id`, `familyId: 'family-1'`, `isRevoked: false`, `expiresAt: Date.now() + 86400000`, `user: mockUser`)를 매번 반복 설정한다. 기존 테스트(`should refresh tokens with valid refresh token` 등)도 같은 패턴을 가지고 있어 파일 전반에 걸쳐 중복이 누적되고 있다.
  - 제안: `refresh` describe 블록의 `beforeEach` 에 공통 `findOne` mock 을 추출하고, reuse-detection(`isRevoked: true`)과 만료(`expiresAt: past`) 케이스만 per-test 오버라이드. 테스트 의도가 더 명확해지고 향후 `mockUser` 구조 변경 시 한 곳만 수정하면 된다.

- **[INFO]** 매직 넘버 `86400000` — 테스트 파일 전체 반복
  - 위치: `auth.service.spec.ts` lines 84, 112, 148 (신규) + 기존 케이스 다수
  - 상세: `Date.now() + 86400000` (24시간 ms) 패턴이 이번 추가 케이스 포함 파일 전체에 6회 이상 반복 사용된다. 이번 변경이 도입한 것은 아니나 추가 케이스가 같은 패턴을 답습했다.
  - 제안: 테스트 파일 상단에 `const ONE_DAY_MS = 24 * 60 * 60 * 1000;` 상수 추출 후 일괄 치환. 기존 코드 포함 정리 기회.

- **[INFO]** 테스트 이름 스타일 불일치 — 현재시제 vs `should ...` 패턴
  - 위치: `auth.service.spec.ts` 신규 it 블록 (lines 76, 103, 122, 139)
  - 상세: 기존 테스트는 `should refresh tokens with valid refresh token`, `should revoke family on reuse detection` 처럼 `should ...` 패턴을 사용한다. 이번에 추가된 케이스들은 `rotates revoke + issue inside a single transaction`, `rejects without issuing`, `does not open a transaction`, `propagates failure` 처럼 현재시제 동사 패턴이다. 기능 차이는 없으나 같은 describe 블록 안에서 스타일이 섞이면 코드 검색과 리뷰 시 일관성이 깨진다.
  - 제안: 신규 케이스를 `should rotate ...`, `should reject without issuing ...` 등 기존 `should ...` 패턴으로 맞추거나, 반대로 describe 블록 전체를 현재시제로 통일. 일관성 확보가 우선.

- **[INFO]** `DataSource.transaction` mock 의 클로저 의존 — 암묵적 선언 순서 결합
  - 위치: `auth.service.spec.ts` lines 137-148 (DataSource mock 내 `getRepository` 구현)
  - 상세: `getRepository` mock 이 `mockRefreshTokenRepo` 를 클로저로 캡처하는데, 이 의존 관계가 `beforeEach` 내부 선언 순서에 암묵적으로 결합되어 있다. 변경에서 추가된 주석(`// 주의: 아래 DataSource.transaction mock 은 위 \`mockRefreshTokenRepo\` 를 클로저로 캡처한다`)이 의존성을 명시하고 있어 현재는 충분하나, 미래 리팩터 시 순서 변경이 silent 버그로 이어질 수 있다.
  - 제안: 주석이 이미 충분히 경고하고 있어 현행 유지 가능. 더 안전하게 하려면 `mockRefreshTokenRepo` 를 `beforeEach` 밖 describe 스코프 변수로 올리는 것을 고려.

### spec/data-flow/2-auth.md

- **[INFO]** 원자성 노트가 구현 내부 세부사항(파라미터명)을 직접 노출
  - 위치: `spec/data-flow/2-auth.md` 원자성 노트 블록
  - 상세: spec 문서가 `generateTokens` 함수명과 `optional EntityManager` 파라미터 등 구현 내부 명칭을 직접 참조한다. spec 은 "무엇을" 보장하는지를 기술해야 하며, 구현 메커니즘(`optional EntityManager`)을 명시하면 구현 리팩터 시 spec 도 함께 변경해야 하는 결합이 생긴다.
  - 제안: 구현 수단 참조 제거 후 "구현: `auth.service.ts refresh()`" 수준의 코드 참조만 남기는 것 권장. 이미 이전 리뷰(08_45_18 INFO 10)에서 `auth.service.ts` 코드 참조 수준으로 정리된 것으로 보이나, 실제 반영 여부를 최종 확인 필요.

---

## 요약

이번 변경(`refresh()` 회전 원자화 + 테스트 추가)은 유지보수성 측면에서 전반적으로 양호하다. 핵심 로직 변경(`dataSource.transaction` 래핑, `generateTokens` optional manager)은 작고 명확하며, 코드 주석이 구현 배경을 충분히 설명한다. 개선 기회는 세 가지로 압축된다: (1) `generateTokens` 내 영/한 주석 혼용(WARNING) — 같은 함수 스코프에서 언어를 통일해야 읽기 흐름이 매끄럽다; (2) 테스트 파일의 `findOne` mock 설정 반복(WARNING) — 신규 추가 케이스가 기존 중복 패턴을 답습해 `refresh` describe 내 중복이 누적됐으며 `beforeEach` 추출로 해소 가능; (3) 테스트 이름 스타일(INFO) — 같은 describe 블록에서 `should ...` 와 현재시제 동사가 혼재한다. 매직 넘버(`900`, `86400000`)와 JSDoc `@param` 형식 문제는 경미하나 기존 코드 정리 기회로 활용할 수 있다. 신규 로직 자체의 가독성, 책임 분리, 중첩 깊이는 모두 양호하다.

## 위험도

LOW
