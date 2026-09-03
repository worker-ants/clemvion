# 유지보수성(Maintainability) 리뷰

## 리뷰 범위

`INVALID_PASSWORD` → `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 형제 코드 정렬 변경의 3라운드 리뷰다.
1R(`review/code/2026/09/02/22_07_21/`)·2R(`review/code/2026/09/03/10_45_22/`)에서 이미 Critical 0·
Warning 전건 조치가 완료됐고(각 RESOLUTION.md 확인), 실제 애플리케이션 코드는 두 라운드 모두 "함수
길이·중첩·매직넘버·복잡도 양호" 로 판정됐다. 이번 라운드는 그 결론이 여전히 유효한지 재확인하고,
직전 라운드가 만든 **새 테스트 헬퍼 패턴이 형제 파일에 일관되게 적용됐는지**를 추가로 점검했다.

핵심 코드 대상:

- `codebase/backend/src/common/utils/password.util.ts`
- `codebase/backend/src/modules/auth/auth.service.ts`
- `codebase/backend/src/modules/auth/sessions.service.ts`
- `codebase/backend/src/modules/auth/sessions.service.spec.ts`
- `codebase/backend/src/modules/users/users.service.ts`
- `codebase/backend/src/modules/users/users.service.spec.ts`
- `codebase/backend/src/modules/users/users.controller.spec.ts`
- `codebase/backend/test/users-change-password.e2e-spec.ts`

`plan/**`·`spec/**`·`review/consistency/**`·`review/code/2026/09/0{2,3}/**` 아래 문서/이전 리뷰
산출물은 "코드" 의 가독성·복잡도·중복 기준이 적용되는 대상이 아니라 1R·2R 과 동일하게 이번 리뷰의
핵심 범위에서 제외했다(내용은 확인했고 별도 결함 없음).

## 발견사항

- **[INFO]** 2R 이 `users.service.spec.ts` 에 만든 "가드 단언을 catch 밖으로" 헬퍼 패턴이 형제
  파일(`sessions.service.spec.ts`)에는 그대로 인라인 중복돼 있다
  - 위치: `codebase/backend/src/modules/auth/sessions.service.spec.ts:192-214` (`it('비밀번호
    불일치 실패 코드는 PASSWORD_INVALID 다', ...)`)
  - 상세: 2R RESOLUTION(`review/code/2026/09/03/10_45_22/RESOLUTION.md` #3)은 "가드 `throw` 가
    try 안에 있으면 회귀 시 진단이 거짓말을 한다" 는 결함을 `users.service.spec.ts` 에서 발견하고
    `rejectionOf()`/`codeOf()` 헬퍼로 추출해 해결했다. 그런데 `sessions.service.spec.ts` 의 새
    테스트는 **같은 결함·같은 해법**(가드 단언을 `catch` 밖으로)을 15줄짜리 인라인
    `try/catch/thrown/getResponse` 블록으로 다시 손으로 짰다 — 심지어 주석 문구
    ("가드 단언은 catch **밖**에서 한다…")도 거의 동일하게 반복돼 있어, 같은 통찰이 두 파일에
    두 가지 형태(헬퍼 vs 인라인)로 따로 존재한다는 것을 코드 자신이 증언한다. 이 저장소는 스펙
    파일 간 헬퍼 공유용 `__test-utils__` 디렉터리 컨벤션을 이미 갖고 있다
    (`codebase/backend/src/common/__test-utils__/`, `codebase/backend/src/modules/integrations/__test-utils__/`)
    — 공유할 자리가 없어서 인라인한 것은 아니다.
  - 제안: `rejectionOf`(및 필요하면 `codeOf`)를 `modules/auth`·`modules/users` 가 공유하는
    `__test-utils__`(예: 인증 모듈 공통 위치)로 옮기고 두 spec 파일이 함께 import 하게 하면, 세
    번째 소비처가 생겼을 때 같은 결함을 세 번째로 손으로 재현할 위험을 없앤다. 지금 당장은 결함이
    아니라 중복 위험(1곳뿐이라 심각도 낮음)이라 필수 조치는 아니다.

- **[INFO]** `codeOf`/`rejectionOf` 가 같은 파일 안에서도 서로의 로직을 재사용하지 않고 각자
  `try/catch/getResponse` 를 独립 구현한다
  - 위치: `codebase/backend/src/modules/users/users.service.spec.ts:149-172`
  - 상세: `rejectionOf`(149-162)와 `codeOf`(164-172)는 둘 다 "promise 를 await 하고 reject 를
    잡아 `getResponse()` 에서 값을 꺼낸다" 는 동일한 골격을 갖는데, `rejectionOf` 는 가드
    단언(`expect(thrown).toBeInstanceOf(...)`) 을 갖고 `codeOf` 는 갖지 않는다(대신 promise 가
    resolve 하면 `throw new Error(...)`로 별도 처리). 두 헬퍼가 생긴 이유(2R RESOLUTION #3: "가드
    throw 가 자기 catch 에 잡힌다")를 감안하면 `codeOf` 도 사실 같은 진단-거짓말 위험을 안고
    있었는데(단, 이쪽은 애초에 `try` 밖에 가드가 없고 `catch` 안에서 곧장 `return` 하는 구조라
    현재는 문제가 없다), 두 함수가 서로 독립이라 다음에 한쪽만 수정되면 둘의 동작이 갈릴 수 있다.
  - 제안: `codeOf` 를 `rejectionOf` 위에 얹으면(`const err = await rejectionOf(promise); return
    (err.getResponse() as { code: string }).code;`) 가드 로직이 한 곳에만 존재하게 되고 두 헬퍼
    사이의 drift 가능성이 사라진다. 사소한 개선이라 필수는 아니다.

- **[INFO]** 같은 `describe('changePassword ...')` 블록 안에서 새 테스트(한국어 제목)와 기존 테스트
  (영어 제목)가 교차 배치돼 있다
  - 위치: `codebase/backend/src/modules/users/users.service.spec.ts:133`(`'throws
    NotFoundException when user missing'`), `:174-228`(신규 한국어 제목 5건), `:231`(`'throws
    BadRequestException when new password violates strength policy'`)
  - 상세: 이 PR 이 추가한 5개 테스트는 전부 한국어 제목인데, 손대지 않은 형제 테스트 2개(133·231
    줄)는 영어 제목 그대로 남아 같은 블록 안에서 언어가 번갈아 나타난다. 같은 파일의 다른
    `describe` 블록(`:241`~)은 이미 전부 한국어라 저장소 전체가 한국어 제목으로 이행 중인 흐름과는
    맞지만, 이 PR 이 정확히 그 경계선(변경 대상 vs 비대상)을 이 블록 안에 남겨 다음 사람이 블록을
    훑을 때 제목 언어가 왜 섞여 있는지 궁금하게 만든다.
  - 제안: 이 PR 스코프는 아니다(133·231 줄은 diff 밖). 다음에 이 블록을 건드릴 기회가 있으면
    두 제목도 한국어로 맞추는 정도로 충분하며, 지금 조치가 필요한 결함은 아니다.

## 긍정적으로 확인된 점 (참고)

- 1R 마지막 라운드가 지적했던 "테스트 제목이 실제 단언보다 넓게 약속한다"(구
  `'OAuth-only 계정(passwordHash 부재)은 PASSWORD_REQUIRED 를 낸다'` 가 클래스만 단언)는 이번
  라운드에서 완전히 해소됐다 — `users.service.spec.ts:174`(클래스만 단언, 제목도 "401 로 막고
  저장하지 않는다"로 좁힘)와 `:182`(코드값 단언, 제목이 "PASSWORD_REQUIRED 다"로 정확히 대응)로
  분리됐다. 제목과 단언 범위가 1:1로 대응한다.
- `PASSWORD_VERIFY_CODES` JSDoc(`password.util.ts:10-29`)이 2R 에서 "순환 의존" 이라는 반증된
  주장을 실측(`forwardRef` 34개 파일 사용)으로 정정한 뒤에도 원문을 취소선 없이 완전히 교체하는 게
  아니라 실제로 헬퍼를 공유하지 않는 세 가지 근거(중복 조회·코드 분기·메시지 분기)로 재작성돼 있고,
  이 근거들은 실제 구현(`changePassword` 가 이미 `user` 를 들고 있음, `USER_NOT_FOUND` 유지)과
  대조해도 정확하다.
- `changePassword`/`verifyPasswordForUser`/`verifyReauth` 세 발행처 모두 조건문 중첩 1단계, 함수
  길이 20줄 내외를 유지한다. 순환 복잡도 상승 없음 — 상수 치환만 있고 분기 구조 자체는 diff 로
  바뀌지 않았다.
- `[대조군]` 접두어 테스트 명명(`users.service.spec.ts:208`)은 이 저장소가 이미 여러 파일
  (`mask-sensitive-fields.util.spec.ts`, `execution-context.service.spec.ts`,
  `node-cancellation-propagation.e2e-spec.ts` 등)에서 쓰는 기존 컨벤션과 정확히 일치한다.
- e2e 신규 테스트(`users-change-password.e2e-spec.ts:96-124`)는 기존 형제 테스트와 arrange
  패턴·타임아웃·주석 스타일이 대칭적이며, `password_hash` 를 NULL 로 만드는 SQL 도 `WHERE id = $1`
  로 테스트 전용 계정에 한정돼 있어 side effect 격리가 명확하다.

## 뮤테이션 검증

이번 라운드에서는 저장소 파일을 수정하는 검증이 필요하지 않았다(정적 분석 + 실제 소스 대조만으로
결론 도달). 저장소 트리에 쓰기 작업 없음 — `git status --short` 확인 결과 세션이 만든 신규
`review/**` 디렉터리 외 변경 없음.

## 요약

1R·2R 을 거치며 Critical/Warning 이 모두 해소된 상태에서, 이번 3R 은 실제 애플리케이션 코드
(`password.util.ts`·`auth.service.ts`·`sessions.service.ts`·`users.service.ts`)의 함수 길이·중첩·
매직넘버·복잡도가 여전히 양호함을 재확인했다. 새로 발견한 것은 전부 INFO 등급의 테스트 코드 중복
소지다 — 2R 이 `users.service.spec.ts` 에서 만든 "가드 단언을 catch 밖으로" 헬퍼 패턴이 형제 파일
`sessions.service.spec.ts` 에는 인라인으로 재구현돼 있고(저장소에 이미 `__test-utils__` 공유
컨벤션이 있음에도), 같은 파일 안의 `codeOf`/`rejectionOf` 두 헬퍼도 서로를 재사용하지 않는다. 기능
결함이 아니라 다음에 세 번째 소비처가 생겼을 때 같은 통찰을 세 번째로 손으로 재현할 위험 정도이며,
필수 조치 사항은 아니다.

## 위험도

NONE
