# 부작용(Side Effect) 리뷰 — `change-password` 실패 코드 정렬 (3라운드 누적, 커밋 `1950e5773`+`139115d34`+`5232a5540`)

## 검토 방법

`origin/main..HEAD` 누적 diff(46개 파일 나열, 코드 파일은 11개)를 프롬프트 게이트 번호로 대조하고,
핵심 소스(`password.util.ts`/`auth.service.ts`/`sessions.service.ts`/`users.service.ts`)와
`spec/5-system/1-auth.md`·`plan/in-progress/auth-change-password-oauth-only-code-split.md` 는
저장소에서 직접 열어(Read) 현재 상태와 대조했다. 이 changeset 은 이미 2라운드 side-effect 리뷰
(`review/code/2026/09/02/22_07_21/side_effect.md` LOW, `review/code/2026/09/03/10_45_22/side_effect.md`
LOW)를 거쳤고, 이번 3라운드 대상에는 그 두 라운드 이후 추가된 `fix` 커밋(`5232a5540`, "구조적으로
불가능하다"는 근거 정정)이 포함된다. `git show 5232a5540 -- <path>` 로 라운드 간 델타를 별도로
확인했다. 저장소 트리에는 아무것도 쓰지 않았다 — `git status --short` 결과 이 세션이 만든 변경은
`review/code/2026/09/03/11_05_01/**`(이 리포트의 출력 디렉터리)뿐이다.

## 발견사항

- **[WARNING]** "자기반증형 소정정" 이 `spec/` 파일에서는 원문 취소선 보존 조건을 지키지 않았다 —
  같은 커밋 안에서 `plan/` 파일은 지켰다
  - 위치: `spec/5-system/1-auth.md` §2.3 "민감 동작 비밀번호 재확인 코드" note (커밋
    `5232a5540`이 수정한 문단 — 게이트 대상 diff 밖이라 `git show 5232a5540 -- spec/5-system/1-auth.md`
    로 직접 확인)
  - 상세: `CLAUDE.md` "자기반증형 소정정" 예외는 developer 가 자신이 그 spec 문서에 써 넣은
    예고 문장을 실측으로 반증했을 때 5개 조건을 **전부** 충족해야 직접 고칠 수 있다고 규정하고,
    조건 4는 "정정은 그 문장에 국한된다 — **원문은 취소선으로 남기고**, 인접 서술은 건드리지
    않는다" 다. 실제로 확인해 보니:
    - `git log -S "헬퍼는 다르지만(순환 의존으로 재사용 불가)" -- spec/5-system/1-auth.md` →
      해당 문장은 developer 자신이 이 changeset 의 `feat` 커밋(`1950e5773`)에서 처음 써 넣었다
      (조건 1 충족).
    - `--impl-done` 이 그 문장이 거짓임을 반증했고(측정: `UsersModule` 이 이미
      `forwardRef(() => AuthModule)` 을 import, `forwardRef` 사용 파일 34개) 커밋 메시지에 그
      실측이 기록돼 있다(조건 3 충족).
    - 그런데 `git show 5232a5540 -- spec/5-system/1-auth.md` 의 실제 diff 는 "헬퍼는
      다르지만(순환 의존으로 재사용 불가) 코드는 공유한다" 문장 전체를 **취소선 없이 통째로
      대체**했다 — `grep -n '~~' spec/5-system/1-auth.md` 결과 이 파일에 취소선 마크업이
      0건이다. 조건 4가 요구하는 "원문 보존" 이 지켜지지 않았다.
    - 같은 커밋이 **같은 사실을** `plan/in-progress/auth-change-password-oauth-only-code-split.md`
      에서는 정확히 요구된 형태로 처리했다 — `> ~~UsersService 는 AuthService 를 주입할 수
      없으므로(순환) 헬퍼 통합이 아니라 코드 상수 공유로 간다.~~ — **이 근거는 틀렸다**
      (`--impl-done` WARNING, 2026-09-03).` (해당 파일 `:111-112`). 같은 커밋 안에서 두 파일이
      같은 정정을 다루면서 한쪽(plan)은 취소선을 남기고 다른 쪽(spec)은 남기지 않아 처리가
      비일관하다.
  - 왜 side-effect 관점 문제인가: `spec/` 는 이 저장소에서 `project-planner` 가 소유하는 SoT 이고,
    developer 의 직접 편집은 이 예외 하나로만 좁게 허용된다. 그 예외의 유일한 감사(audit) 장치가
    "틀렸던 원문을 취소선으로 남긴다" 인데, 그게 사라지면 다음 사람은 이 문장이 처음부터 옳게
    쓰였는지 — 아니면 검증 없이 썼다가 나중에 조용히 고쳐졌는지 — spec 파일만 봐서는 구분할 수
    없다. `--impl-done` 실측(`git blame`/`git log -S`)으로만 복원 가능한데, 이 리뷰가 방금 그
    복원을 수행해서야 드러났다 — 정확히 이 예외 조항이 막으려던 상황이다. 코드 실행에 영향은
    없지만(spec 은 런타임에 로드되지 않음), "예상 외의 공유 문서(SoT) 상태 변경" 이자 이 저장소가
    명시한 감사-트레일 요구를 우회한 부작용이다.
  - 제안: `spec/5-system/1-auth.md` 의 해당 문단을 plan 파일과 같은 패턴으로 재정정 —
    `~~헬퍼는 다르지만(순환 의존으로 재사용 불가) 코드는 공유한다.~~ — 이 근거는 틀렸다
    (`--impl-done` WARNING, 2026-09-03). ...` 형태로 원문을 취소선으로 남기고 정정 사유를 이어
    붙인다. Blocking 은 아니다(코드 실행 경로에 영향 없음) — 다음 `--impl-done`/`consistency-check`
    라운드에서 함께 정리해도 무방하다.

- **[정보/확인 완료]** `sessions.service.ts`/`auth.service.ts` — 리터럴→공유 상수 치환만, 런타임
  응답 값 불변 (1R 부터 반복 확인)
  - 위치: `codebase/backend/src/modules/auth/sessions.service.ts` (`comparePassword` 실패 분기,
    `PASSWORD_VERIFY_CODES.INVALID` 사용), `codebase/backend/src/modules/auth/auth.service.ts`
    (`verifyPasswordForUser`, `PASSWORD_VERIFY_CODES.REQUIRED`/`.INVALID` 사용)
  - 상세: 두 파일 모두 diff 이전부터 이미 `'PASSWORD_REQUIRED'`/`'PASSWORD_INVALID'` 리터럴을
    쓰고 있었고, 이번 변경은 그 리터럴을 같은 값의 공유 상수 참조로 바꿀 뿐이다. 문자열 값 자체가
    바뀌지 않으므로 이 두 파일이 발행하는 wire 코드는 부작용 없이 그대로다. `verifyReauth` 가
    던지는 예외 이전에 실행되는 부수 동작(`refreshTokenRepository.update`·`loginHistory.record`)도
    `verifyReauth` 의 `throw` 로 여전히 정상적으로 스킵됨을 호출부(`revokeFamily`/`revokeOtherFamilies`)
    코드로 확인했다 — 조건 재배치·early-return 변경 없음.

- **[정보/확인 완료]** 실질 wire 계약 변경은 `UsersService.changePassword` 하나뿐 — 이미
  governance 완료된 breaking change (인터페이스 변경)
  - 위치: `codebase/backend/src/modules/users/users.service.ts` (`changePassword`, OAuth-only
    분기 → `PASSWORD_VERIFY_CODES.REQUIRED`, 불일치 분기 → `PASSWORD_VERIFY_CODES.INVALID`)
  - 상세: `POST /users/me/change-password` 가 이전에는 두 서로 다른 실패 조건(비밀번호 미설정
    OAuth-only / 현재 비밀번호 불일치)에 동일 코드 `INVALID_PASSWORD` 를 응답했는데, 이 diff 로
    코드가 갈린다. 함수 시그니처(파라미터·반환 타입)는 불변 — 예외 바디의 `code`/`message` 필드
    값만 바뀐다. 이 엔드포인트는 워크스페이스 JWT 로 호출 가능한 내부 REST 라 저장소 밖 호출자를
    원리적으로 배제할 수 없다(`error-codes.md §5` 등급 B 자기 인정)는 잔여 위험이 있으나, 이미
    `spec/conventions/error-codes.md §5`(등급 B, 사용자 결정 2026-09-02)·`CHANGELOG.md`·
    1st-party FE grep(0건, `axiosMessage` 로 서버 message 그대로 노출) 3중으로 governance 절차를
    거쳤고 이전 두 라운드(api_contract.md·security.md·documentation.md, 09/02·09/03)가 각각
    독립적으로 이 사실을 확인했다. 이번 라운드에서 재확인해도 동일 결론 — 신규 발견 아님.
  - 에러 메시지 텍스트도 두 분기 모두 동일 문자열('Current password is incorrect', 영문)에서
    분기별 한국어 문구로 갈린다. FE 가 `error.code` 가 아니라 서버 `message` 를 그대로 노출하므로
    이 텍스트 변경이 실제 사용자 화면에 직접 반영되는 side effect 이나, `password-and-sessions.mdx`
    ko/en 양쪽 가이드가 그에 맞춰 함께 갱신돼 있어 의도된 변경이다(문서 리뷰어가 이미 확인).

- **[정보/확인 완료]** 신규 공유 모듈 상수 `PASSWORD_VERIFY_CODES` — 전역 가변 상태 아님
  - 위치: `codebase/backend/src/common/utils/password.util.ts:30-35`
  - 상세: `AuthService`·`SessionsService`·`UsersService` 세 곳이 같은 모듈-레벨 객체를 import 한다.
    `as const` 로 타입 레벨 불변이나 `Object.freeze()` 는 미적용 — 다만 같은 파일의 기존
    `BCRYPT_ROUNDS` 도 동일 패턴이라 이 changeset 이 새로 도입한 위험 유형이 아니며, 실제 재할당
    코드는 저장소 어디에도 없다(1R·2R 에서 이미 확인, 이번 라운드도 재확인 결과 동일). 값 자체가
    문자열 리터럴이라 mutation 표면이 사실상 없다.

- **[정보/확인 완료]** 신규 e2e 테스트의 DB 직접 `UPDATE` — 격리 확인 완료 (2R 부터 반복 확인)
  - 위치: `codebase/backend/test/users-change-password.e2e-spec.ts` — `it('OAuth-only 계정
    (password_hash NULL) → 401 PASSWORD_REQUIRED', ...)` 내부
    `db.query('UPDATE "user" SET password_hash = NULL WHERE id = $1', [oauthUser.userId])`
  - 상세: 애플리케이션 정상 경로가 아니라 테스트가 DB 행을 직접 변형하지만, `WHERE id = $1`
    조건이 그 `it` 가 `registerAndLogin(..., uniqueEmail('pwchg-oauth'), db)` 로 새로 만든 전용
    계정에만 국한된다. 같은 파일의 다른 두 `it`(`pwchg`/`pwchg-x` 접두)와 이메일이 분리돼 있어
    상호 오염 없음 — 신규 side effect 아님.

- **[정보/확인 완료]** 함수 시그니처·공개 인터페이스(코드 레벨) 불변
  - 위치: `AuthService.verifyPasswordForUser`, `SessionsService.verifyReauth`,
    `UsersService.changePassword` 세 함수 전부
  - 상세: 파라미터·반환 타입 어디도 바뀌지 않았다. `sessions.service.spec.ts`/
    `users.service.spec.ts` 에 추가된 `rejectionOf()`/인라인 가드-outside-catch 패턴은 테스트
    전용 헬퍼로, 프로덕션 코드 경로·전역 상태·이벤트 발행에 영향이 없다(순수 mock 기반 unit 테스트).

- **[정보/확인 완료]** 파일시스템·환경 변수·네트워크·이벤트/콜백 — 해당 없음
  - `review/code/2026/09/03/11_05_01/**`(이 리포트 산출) 외 diff 에 포함된 신규 파일은
    `review/code/**`·`review/consistency/**`·`plan/complete/**` 로, 모두 이 저장소가 규정한
    표준 산출 경로(코드 리뷰·일관성 검토·plan lifecycle)와 정확히 일치한다 — 예기치 못한 파일
    생성이 아니다. `.env`/`process.env` 참조 신규 도입 없음, `fetch`/`axios`/외부 SDK 호출
    신규 도입 없음, EventEmitter/WS 이벤트 발행부 변경 없음.

## 뮤테이션 검증

이번 라운드는 정적 대조(`Read`/`grep`/`git show`/`git log -S`)만으로 결론에 도달했다. 저장소
트리에 쓰기 작업 없음 — `git status --short` 확인 결과 이 세션이 만든 변경은 이 리포트 파일뿐이다.

## 요약

핵심 wire 계약 변경(`UsersService.changePassword` 의 `INVALID_PASSWORD` → `PASSWORD_REQUIRED`/
`PASSWORD_INVALID` 분리)은 이미 두 라운드에 걸쳐 검토·governance(등급 B, 사용자 결정, spec/CHANGELOG
동기화, 1st-party 영향 0 실측)를 완료한 의도된 breaking change 이며, 이번 라운드에서도 함수
시그니처·전역 변수·파일시스템·환경 변수·네트워크·이벤트 어느 것도 새로 건드리지 않음을 재확인했다.
`sessions.service.ts`/`auth.service.ts` 는 실제 응답 값 변경 없는 리터럴→상수 치환뿐이고, 신규 공유
상수는 기존 컨벤션과 일치하는 읽기 전용 도입이다. 이번 라운드에서 새로 발견한 것은 하나뿐이다 —
직전 라운드(2R)의 `--impl-done` fix 커밋(`5232a5540`)이 "순환 의존이라 불가능하다" 는 거짓 근거를
세 곳에서 정정하면서, `plan/` 파일에서는 CLAUDE.md 가 요구하는 "원문 취소선 보존" 을 정확히
지켰지만 **`spec/` 파일(`1-auth.md`)에서는 취소선 없이 문장을 통째로 교체**해 같은 커밋 안에서
처리가 비일관했다. 이는 developer 가 `spec/` 을 직접 고칠 수 있는 유일한 예외(자기반증형 소정정)
자체의 감사-트레일 조건을 완전히 충족하지 못한 것으로, 런타임 동작에는 영향이 없으나 "예상 외의
공유 SoT 상태 변경" 성격의 부작용이라 WARNING 으로 기록한다.

## 위험도

LOW
