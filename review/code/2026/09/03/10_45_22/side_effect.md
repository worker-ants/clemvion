# 부작용(Side Effect) 리뷰 — `change-password` 실패 코드 정렬 + 1R 리뷰 반영 (origin/main..HEAD, 커밋 `1950e5773`+`139115d34`)

## 검토 방법

`git diff origin/main..HEAD --stat` 로 실제 변경 파일 59개를 확인하고, 핵심 애플리케이션 코드
(`password.util.ts`/`auth.service.ts`/`sessions.service.ts`/`users.service.ts`)와 신규 e2e/spec
테스트를 저장소에서 직접 열어 게이트 번호·현재 상태를 대조했다. 이 changeset 은 직전 라운드
(`review/code/2026/09/02/22_07_21/side_effect.md`, 위험도 LOW)에서 이미 전수 검토된 `feat` 커밋
(`1950e5773`) 위에, 그 라운드의 WARNING 4건을 조치한 `fix` 커밋(`139115d34`)이 얹힌 것이다.
따라서 이번 리뷰는 **직전 라운드 이후의 델타**(CHANGELOG 신설, `sessions.service.spec.ts`/
`users.service.spec.ts`/e2e 테스트 추가, `password.util.ts` JSDoc 3줄)에 집중했다. 저장소 트리는
`grep`/`sed -n`/`Read` 로만 읽었고 아무것도 쓰거나 고치지 않았다 —
`git status --short` 확인 결과 이 세션이 만든 변경은 `review/code/2026/09/03/**`(이 리포트의
출력 디렉터리) 뿐이다.

## 발견사항

- **[INFO]** (직전 라운드 W2 조치분) 신규 e2e 테스트가 실제 HTTP 호출 전에 대상 사용자 행을
  직접 `UPDATE` 한다
  - 위치: `codebase/backend/test/users-change-password.e2e-spec.ts` — `it('OAuth-only 계정
    (password_hash NULL) → 401 PASSWORD_REQUIRED', ...)` 블록의 `db.query('UPDATE "user" SET
    password_hash = NULL WHERE id = $1', [oauthUser.userId])` 호출
  - 상세: 애플리케이션 정상 경로가 아니라 테스트가 DB 를 직접 변형해 "OAuth-only" 상태를
    흉내낸다. 이 자체는 같은 파일의 관례(모든 `describe` 블록이 `db` 커넥션을 공유)와 일치하고,
    `WHERE id = $1` 로 이번 `it` 가 `registerAndLogin(..., uniqueEmail('pwchg-oauth'), db)` 로
    새로 만든 **자신의 사용자 행에만** 국한되어 있어 다른 테스트(`pwchg`/`pwchg-x` 접두 사용자)의
    상태를 오염시키지 않는다 — 실측: 같은 파일의 세 `it` 가 각각 `uniqueEmail('pwchg')`,
    `uniqueEmail('pwchg-oauth')`, `uniqueEmail('pwchg-x')` 로 계정을 분리해 상호 독립이다. 부작용
    관점에서 결함은 아니다.
  - 제안: 조치 불필요. 참고 기록.

- **[INFO]** `PASSWORD_VERIFY_CODES` JSDoc 갱신 — 세 번째 소비처(`SessionsService.verifyReauth`)
  명시 추가
  - 위치: `codebase/backend/src/common/utils/password.util.ts:13-16`
  - 상세: 직전 라운드가 지적한 "JSDoc 이 소비처를 둘만 열거"(INFO#1)를 텍스트로만 보강한 것이라
    런타임 동작 변경이 없다. `SessionsService.verifyReauth` 가 `.INVALID` 만 발행하고 미입력은
    `REAUTH_REQUIRED`(400)로 별도 분기한다는 서술이 `sessions.service.ts:258-262`(`REAUTH_NOT_AVAILABLE`
    분기) 실제 코드와 일치함을 대조 확인했다. 부작용 없음.

- **[INFO]** `PASSWORD_VERIFY_CODES` 는 여전히 `Object.freeze()` 미적용 (직전 라운드에서 이미
  기록, 이번 델타로 신규 도입되거나 악화되지 않음)
  - 위치: `codebase/backend/src/common/utils/password.util.ts:25-30`
  - 상세: `as const` 는 타입 레벨 불변일 뿐 런타임 재할당(`PASSWORD_VERIFY_CODES.INVALID = '...'`)을
    막지 않는다. 같은 파일의 기존 `BCRYPT_ROUNDS`(8번째 줄)도 동일 패턴이라 이 changeset 이 새로
    도입한 위험 유형이 아니며, 이번 델타에서 재확인해도 실제 재할당 코드는 없다.
  - 제안: 조치 불필요 — 기존 컨벤션과 일치.

- **[정보/확인 완료]** 신규 `sessions.service.spec.ts` 테스트는 mock 기반이라 부작용 표면 없음
  - 위치: `codebase/backend/src/modules/auth/sessions.service.spec.ts` — `it('비밀번호 불일치
    실패 코드는 PASSWORD_INVALID 다', ...)`
  - 상세: `repo.findOne.mockResolvedValue(...)` 로 TypeORM 리포지토리를 모킹하고
    `service.revokeFamily(...)` 예외의 `code` 필드만 리터럴로 단언한다. 전역 상태·파일시스템·
    네트워크·이벤트 발행 어느 것도 건드리지 않는다.

- **[정보/확인 완료]** 함수 시그니처·공개 인터페이스 불변
  - 위치: `AuthService.verifyPasswordForUser`(`auth.service.ts:67-84`),
    `SessionsService.verifyReauth`(`sessions.service.ts` 246~ 부근), `UsersService.changePassword`
    (`users.service.ts:273-306`)
  - 상세: 이번 델타(fix 커밋)는 세 함수 어디의 파라미터·반환 타입도 바꾸지 않는다. 변경은
    (a) `password.util.ts` JSDoc 텍스트, (b) 새 테스트 파일들, (c) `CHANGELOG.md`/`plan/**` 문서뿐이다.
    직전 라운드가 이미 검증한 유일한 실질 wire 변경(`UsersService.changePassword` 의 `code` 값
    `INVALID_PASSWORD` → `PASSWORD_REQUIRED`/`PASSWORD_INVALID`, `users.service.ts:291,300`)은
    이번 델타로 반복되거나 확대되지 않았다.

- **[정보/확인 완료]** `CHANGELOG.md` 신규 항목은 파일시스템 부작용이 아니라 이 저장소의 정규
  산출물
  - 위치: `CHANGELOG.md` — `## Unreleased — 비밀번호가 없는 사람에게 "현재 비밀번호가 틀렸다"
    고 말하고 있었다` 섹션(신설)
  - 상세: 직전 라운드 W3(documentation)가 지적한 누락을 조치한 것으로, 이번 커밋이 스스로
    설명하는 breaking 변경(코드 값 pair)과 내용이 정확히 대응한다. 예기치 못한 파일 생성이 아님.

## 뮤테이션 검증

이번 리뷰는 저장소 파일을 고쳐 재현할 필요가 없었다 — 정적 대조(diff·현재 소스 상태)만으로
결론에 도달했다. 저장소 트리에 쓰기 작업 없음, `git status --short` 로 확인(위 "검토 방법" 참조).

## 요약

이번 라운드에서 검토한 델타(CHANGELOG 신설, `sessions.service.spec.ts`/`users.service.spec.ts`
문구 정리, e2e OAuth-only 테스트 추가, `password.util.ts` JSDoc 보강)는 직전 side-effect 리뷰
(LOW, 09/02 22:07:21)가 이미 전수 검토·승인한 핵심 wire 계약 변경(`INVALID_PASSWORD` →
`PASSWORD_REQUIRED`/`PASSWORD_INVALID`)을 재검증하거나 보강하는 성격이며, 함수 시그니처·전역
상태·환경 변수·네트워크 호출·이벤트/콜백 어느 것도 새로 건드리지 않는다. 유일하게 눈여겨볼
지점은 신규 e2e 테스트가 대상 사용자 행을 `UPDATE` 로 직접 변형하는 것인데, `WHERE id = $1` 로
그 테스트가 새로 만든 전용 계정에만 국한돼 있어 다른 테스트를 오염시키지 않음을 확인했다.
Critical/Warning 급 부작용은 발견되지 않았다.

## 위험도

LOW
