# 테스트(Testing) 리뷰 — WebAuthn credential 동시 삭제 (아홉 번째/마지막 자리) + 리뷰 라운드 3 후속

## 검증 방법

`codebase/backend/src/modules/auth/webauthn/webauthn.service.ts`·`webauthn.service.spec.ts`·
`codebase/backend/test/webauthn-credential-delete-concurrency.e2e-spec.ts` 를 저장소에서 직접 Read
로 전문 열람했다(뮤테이션 없음, 저장소에 아무것도 쓰지 않음). 이번 라운드가 직전 세 리뷰
(`review/code/2026/09/21/18_03_54`·`18_31_57`·`18_58_48` 의 각 `testing.md`) 대비 실제로 추가한
변경분을 `git show 15da527e7 -- codebase/backend/src/modules/auth/webauthn/webauthn.service.ts`
로 직접 대조했다 — 그 커밋은 `throwCredentialNotFound()` JSDoc 의 `verifyAuthentication(:403)`
줄 번호 인용을 메서드명 참조로 바꾼 **주석 1줄짜리 변경**뿐이고, 테스트 파일은 이번 라운드에서
변경되지 않았다. `_test_logs/unit-20260921-191002.log`(Tests: 전부 `X passed, X total`, FAIL
없음)와 `_test_logs/e2e-20260921-191354.log`(`PASS test/webauthn-credential-delete-concurrency.e2e-spec.ts`,
`Tests: 378 passed, 378 total`)를 직접 grep 해 커밋 메시지가 주장하는 수치와 실측이 일치함을
확인했다.

## 발견사항

- **[INFO]** 이번 라운드의 실제 diff 는 테스트에 영향 없는 JSDoc 주석 정정뿐 — 새로 검토할
  테스트 커버리지 변화 없음
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts` 함수
    `throwCredentialNotFound` 의 JSDoc 블록 (`git show 15da527e7`)
  - 상세: 직전 라운드(`18_58_48`)가 이미 핵심 로직(`deleteCredential` 의 `affected === 0`
    명시 비교, DELETE 조건절 `userId` 스코프)과 그 단위·e2e 테스트를 검토해 위험도 NONE 으로
    판정했다. 이번 라운드가 추가한 유일한 코드 변경은 그 판정 대상이 아니었던 주석의 줄 번호
    인용(`:403`)을 메서드명(`verifyAuthentication()`)으로 바꾼 것으로, 실행 경로·분기·단언
    어디에도 영향을 주지 않는다. `plan/in-progress/webauthn-dup-delete.md` 도 같은 종류의
    인용 정정이며 코드가 아니다. 새 커버리지 갭도, 새 회귀 위험도 없다.
  - 제안: 없음.

- **[INFO]** 핵심 회귀 테스트(`describe('동시 삭제')`)의 판별력이 여전히 견고함을 재확인
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.spec.ts:516-562`
    (`it('소유자로 스코프한 DELETE 를 친다')`:517, `it('진 쪽은 404...')`:529,
    `it.each([[undefined], [null]])(...)`:550)
  - 상세: `it.each([[undefined], [null]])` 대조군은 `affected === 0` 명시 비교와 `!affected`
    truthy 판정을 실제로 갈라내는 입력이다 — `!undefined`·`!null` 은 모두 `true` 이므로 판정을
    `!affected` 로 되돌리는 뮤턴트는 이 두 케이스에서 정상 삭제(`{ remaining: 1 }`)를 404 로
    뒤집어 즉시 RED 가 된다(같은 저장소가 `#1371` 에서 이 대조군 부재로 32개 뮤턴트를 놓친
    전례가 docstring 에 명시돼 있고, 지금 코드는 그 재발을 막는 형태다). `credentialRepo.delete`
    를 호출한 뒤 진 쪽 테스트가 `count`·`usersService.update` 가 **호출되지 않음**을 단언해
    "404 는 던지는데 부수 쓰기는 실행되는" 형태의 회귀도 함께 막는다. `toMatchObject({ response:
    { code: ... } })` 패턴은 `NotFoundException` 이 `HttpException` 생성자에서 `this.response
    = response` 로 공개 필드를 채우는 실제 동작과 일치하고(`node_modules/.pnpm/@nestjs+common.../http.exception.js`
    로 직접 확인), 같은 파일의 기존 테스트(`:355-357`)가 쓰는 동일 패턴과도 일관된다.
  - 제안: 없음 — 이미 견고함, 새 조치 불요.

- **[INFO]** e2e 두 케이스 모두 실제 행 락으로 인터리빙을 강제하고 공허성(vacuity) 가드로
  겹침을 관측한 뒤 단언하는 구조 — 판별력 있는 회귀 테스트
  - 위치: `codebase/backend/test/webauthn-credential-delete-concurrency.e2e-spec.ts:52-118`
    (`it('두 DELETE 가 겹쳐도...')`), `:150-227` (`it('서로 다른 credential 두 개를...')`)
  - 상세: 두 테스트 모두 `locker` 커넥션이 대상 행(들)에 `SELECT ... FOR UPDATE` 를 건 뒤
    `Promise.race` 로 1.5초 시점에 `pending` 상태임을 먼저 단언하고(`expect(raced).toBe('pending')`),
    그 다음 `COMMIT` 해 실제 겹침을 만든다. 이 가드가 없다면 두 요청이 우연히 순차 처리돼도
    조용히 통과할 수 있었는데(직전 라운드 `18_31_57/testing.md` 가 정확히 이 결함을 WARNING 으로
    지적했고 `89566e3d5` 로 두 번째 테스트에 동일 가드가 추가됐음을 `git show` 로 직접 확인),
    지금은 두 테스트 모두 겹침을 관측 없이 통과시키지 않는 형태다. 첫 번째 테스트는 대상
    credential 하나 + survivor 하나를 심어 "감사 중복"만 판별자로 좁혔고, 두 번째 테스트는
    복구 코드를 SQL 로 직접 세팅한 뒤 **세팅됐음을 먼저 단언**(`:172-176`)해 마지막
    `toBeNull()` 단언이 공허하지 않음을 보장한다.
  - 제안: 없음.

- **[INFO]** 회귀 안전성 — 기존 `deleteCredential`/`renameCredential` 테스트가 새 `affected`
  판정 분기와 충돌하지 않음
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.spec.ts` 전역
    `beforeEach` 의 `credentialRepo.delete = jest.fn().mockResolvedValue({ affected: 1 })`
    기본값, `describe('deleteCredential')` 기존 3건(`:480, :491, :499`)
  - 상세: 기존 테스트들은 `delete` 반환값을 직접 세팅하지 않으므로 기본 `{ affected: 1 }` 를
    받아 새로 추가된 `if (affected === 0) throwCredentialNotFound()` 분기를 타지 않고 그대로
    통과한다 — 이번 diff 가 기존 계약(`{ remaining }` 반환, 존재하지 않거나 소유자가 다르면
    404)을 깨지 않았음을 실측으로 확인했다.
  - 제안: 없음.

- **[INFO]** (재확인, 비차단) `findOne` 이 진짜 `null` 을 반환하는 "credential 자체가 존재하지
  않음" 분기가 단위 테스트로 직접 커버되지 않음 — 이번 PR 이전부터 있던 갭이며 `18_58_48/testing.md`
  가 이미 동일 내용을 INFO 로 등재해 비차단 판정 완료
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts` 함수
    `deleteCredential`(`if (!credential || credential.userId !== userId)`) /
    `renameCredential`(분리된 `if (!credential)`·`if (credential.userId !== userId)`)
  - 상세: 기존·신규 테스트 모두 "존재하지만 소유자가 다름" 케이스만 재현하고, `findOne` 이
    `null` 을 반환하는 케이스를 명시적으로 세팅하는 테스트가 없다. 이번 diff 는 이 조건 구조
    자체를 바꾸지 않았고(단지 인라인 `throw` 를 `throwCredentialNotFound()` 호출로 추출했을
    뿐) 새로 도입된 회귀도 아니므로, 이전 두 라운드의 판정을 그대로 유지한다 — 재지적이 아니라
    재확인이다.
  - 제안: 필수 아님 — 다음에 이 영역을 만질 때 `credentialRepo.findOne.mockResolvedValue(null)`
    케이스를 `deleteCredential`·`renameCredential` 양쪽에 추가하는 것을 고려.

## 요약

이번 라운드(19_18_43)가 검토하는 diff 의 실질 내용은 이전 세 라운드가 이미 검증한 핵심 결함
수정(`affected === 0` 명시 비교, DELETE 조건절 `userId` 스코프)과 그 단위·e2e 테스트 그대로이며,
새로 추가된 코드 변경은 JSDoc 주석의 줄 번호 인용을 메서드명으로 바꾼 것뿐이라 테스트 관점에서
영향이 없다. 핵심 회귀 테스트는 대조군(`affected` `undefined`/`null` vs `0`)으로 판정 조건의
정확한 형태를 잠그고, 진 쪽의 부수 쓰기 생략을 음성 단언으로 확인하며, e2e 두 건 모두 실제 행
락으로 인터리빙을 강제하고 공허성 가드로 겹침을 관측한 뒤 단언해 판별력이 높다. 회귀 위험도
없음을 기존 테스트가 새 분기와 충돌하지 않는 것으로 실측 확인했다. 유일하게 남은 항목(`findOne`
→ `null` 분기의 명시적 단위 테스트 부재)은 이번 PR 이전부터 있던 사전 존재 갭으로, 이미 두 차례
전 라운드에서 비차단 INFO 로 판정됐고 이번 라운드가 새로 만든 문제가 아니다. 테스트 관점에서
이번 PR 을 막을 사유는 없다.

## 위험도

NONE
