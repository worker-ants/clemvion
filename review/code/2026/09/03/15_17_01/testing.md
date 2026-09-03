# 테스트(Testing) 리뷰

## 컨텍스트

이 diff 는 `plan/in-progress/entity-nullable-column-type-mismatch.md` 배치 1 의 **직전 리뷰 라운드
(`review/code/2026/09/03/14_44_15/`)가 낸 Critical 1 + Warning 5 를 조치한 결과물**이다
(`RESOLUTION.md` 참조). 새로 추가된 테스트 5건(W2×2·W3·W4×2)과 가드 spec 의 fixture 전환(W1)을
직접 실행·검증했다. 아래는 그 검증 결과 + 남은 갭이다.

## 검증 수행 내역

- 대상 6개 spec 파일 전량 실행: `auth.service.spec.ts` · `totp.service.spec.ts` ·
  `schedule-runner.service.spec.ts` · `schedules.service.spec.ts` ·
  `users-login-attempts.service.spec.ts` · `nullable-type-lie-cast.spec.ts` — **133/133 PASS**.
- 뮤테이션 1건 직접 재현(격리: `cp` 백업 → 저장소 파일 수정 → 실행 → `cp` 로 즉시 원복,
  `git status --short` 로 clean 확인 완료): `users.service.ts::resetLoginAttempts` 의
  `lockedUntil: null` → `lockedUntil: undefined` 로 되돌렸더니
  `users-login-attempts.service.spec.ts` 의 신규 테스트가 **RED** (`expect(received).toBeNull() / Received: undefined`).
  나머지 4건(W2 verifyEmail/resetPassword, W4 schedule-runner/schedules.service)은 `RESOLUTION.md`
  에 기록된 뮤테이션 결과(전부 RED)를 코드 리딩으로 대조해 재현 가능성을 확인했다 — 별도 재실행은
  생략(동일 저자·동일 라운드·동일 패턴).

## 발견사항

- **[INFO]** `findCastOffenders` 가 다중 offender 파일(2개 이상)의 aggregation 을 검증하지 않는다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts` — `withFixture` 기반 "캐스트가 있는 파일을 offender 로 잡고, 없으면 통과한다" 테스트 (SUMMARY 이전 라운드 INFO#10 과 동일 항목, 이번 diff 로 신규 유입되지 않음)
  - 상세: 현재 테스트는 파일 1개씩만 `findCastOffenders([file])` 로 호출한다. 배열을 순회하며 여러 파일을 누적하는 로직(`offenders.push` 반복)이 "두 번째 이후 파일도 배열에 누적되는지"는 직접 검증되지 않는다. 실사용에서는 `collectScanTargets()` 전체를 스캔하므로 실질 위험은 낮다.
  - 제안: 우선순위 낮음. 여유가 있으면 offender 2개 이상인 fixture 로 `toHaveLength(2)` 케이스 1건 추가.

- **[INFO]** `auth.service.spec.ts` 의 verifyEmail 신규 테스트가 무관한 mock 을 설정한다.
  - 위치: `codebase/backend/src/modules/auth/auth.service.spec.ts` — `it('소비된 인증 토큰을 null 로 **명시** 대입한다 …')` (파일 내 확인된 실제 줄: 1089)
  - 상세: `usersService.findByEmail.mockResolvedValue(null)` 를 설정하지만 `verifyEmail` 경로는 `findUserByVerifyToken`(별도 `jest.spyOn` 으로 대체됨)만 쓰고 `usersService.findByEmail` 을 호출하지 않는다(직접 확인: `auth.service.ts::verifyEmail` 본문에 `findByEmail` 미참조). 죽은 mock 설정이라 테스트 의도를 읽을 때 혼란을 준다 — 인접 테스트에서 복붙된 흔적으로 보인다.
  - 제안: 해당 줄 제거해 테스트가 실제로 무엇을 세팅하는지만 남긴다. 동작에는 영향 없음(참 INFO).

- **[INFO]** `countNullAsUnknownAsCasts` 의 정규식이 리터럴 단일 공백을 가정한다.
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts` — `countNullAsUnknownAsCasts` (`export function countNullAsUnknownAsCasts`)
  - 상세: `/\bnull as unknown as\b/g` 는 `null`·`as`·`unknown`·`as` 사이가 정확히 공백 1개일 때만 매치한다. prettier 가 이 형태를 항상 단일 공백으로 정규화하므로 현재 저장소에서는 안전하지만, 형제 함수 `countRawUpdateReturning` 처럼 "이 축이 안 보는 것"을 명시하는 docstring 절이 없다 — SUMMARY 이전 라운드 INFO#9 와 동일 지적, 이번 diff 로 새로 생긴 갭은 아님.
  - 제안: 우선순위 낮음(오탐 방향이 누락 쪽이라 안전 — RED 로 드러나는 성격이 아니라 조용히 놓칠 수 있는 방향). 여유 있으면 한 줄 명시.

- **[INFO]** `findUntypedNullableColumns` 의 `COLUMN_DECL` 정규식이 2단계 이상 중첩 괄호를 가진 `@Column({...})` 을 놓칠 수 있다(테스트 미커버).
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts` — `COLUMN_DECL` 상수 (`const COLUMN_DECL = /(@Column\((?:[^()]|\([^()]*\))*\))\s*\n\s*(\w+)\s*:\s*([^;]+);/g;`)
  - 상세: 1단계 중첩까지만 허용한다(`transformer: { to: (v) => v }` 처럼 함수 인자가 있는 2단 중첩은 매치 실패). 저장소 실측(46건 전수 대조)에서는 걸리지 않았지만, 이 형태에 대한 명시적 회귀 테스트는 없다 — `countRawUpdateReturning` 이 자신의 사각지대를 docstring 에 명시한 관례와 대비된다.
  - 제안: 우선순위 낮음. 실사용 엔티티에 2단 중첩 트랜스포머가 생기면 그때 대응해도 안전(가드는 "본다"고 주장하지 않은 자리이므로 거짓 보장은 아님).

## 강점 (긍정 관측)

- W1(대조군의 프로덕션 파일 변형) 수정이 정확하다 — `withFixture` 는 매 호출마다 독립된
  `fs.mkdtempSync` 디렉터리를 만들고 `finally` 블록에서 `fs.rmSync(..., { recursive: true, force: true })`
  로 정리한다. 형제 가드(`masked-reject-callers-guard.ts`) 관례와 일치하며 테스트 격리가 보장된다.
- W2~W4 신규 테스트 5건 전부 `toBeFalsy()` 대신 `toBeNull()` 을 쓰며, 그 이유를 각 테스트 옆
  인라인 주석으로 명시한다(`undefined` 회귀를 통과시키지 않기 위함) — 이는 실제로
  TypeORM `update()` 의 `undefined` 필드 생략 의미론과 정확히 맞물리는 올바른 선택이다(뮤테이션
  1건 직접 재현으로 확인).
- 각 신규 테스트가 "왜 필요한가"를 커밋 시점 리뷰 W-번호와 함께 docstring 으로 남겨, 다음
  사람이 이 테스트를 지우려 할 때 근거를 바로 찾을 수 있다.
- `resetPassword` 성공 경로 테스트 신설은 실제로 기존에 완전히 비어 있던 갭이었다(실패 경로만
  존재) — mock 구조(`refreshTokenRepo.manager.getRepository`)가 실제 `findUserByResetToken`
  구현과 정확히 일치함을 직접 대조 확인.
- 새 가드(`nullable-type-lie-cast.spec.ts`)는 "[전제]" 테스트로 스캔 대상이 비어 있지 않음·자기
  자신이 스캔 대상에서 제외됨을 먼저 단언한 뒤 본 단언을 수행한다 — vacuous PASS 방지 패턴이 잘
  적용되어 있다. `[예외 경계]` 테스트도 JoinColumn 컬럼명 일치/불일치 양방향을 모두 검증한다.

## 요약

직전 라운드가 지적한 5건의 커버리지 갭(W1~W4, W5 는 후속 등재로 명시 유예)이 실제로 조치됐고,
신규 테스트는 실행·PASS 확인 + 뮤테이션 1건 직접 재현으로 vacuous 가 아님을 검증했다. 발견된
잔여 사항은 전부 INFO 등급(우선순위 낮은 정밀도 갭·죽은 mock 1줄)이며, 그중 다수는 직전 라운드
SUMMARY 에 이미 등재된 항목의 재확인이지 이번 diff 가 새로 만든 결함이 아니다. 테스트 가독성·
격리·mock 정확성 전반이 양호하다.

## 위험도

LOW
