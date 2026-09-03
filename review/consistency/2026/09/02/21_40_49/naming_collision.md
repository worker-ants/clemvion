# 신규 식별자 충돌 검토 — `spec/5-system/` (--impl-prep)

## 검토 범위 확정

번들 target 은 `spec/5-system/` 전체(15개 파일은 컨텍스트 예산 초과로 본문 생략)이지만, 실제로 이번
라운드에서 **새로 도입된 식별자**는 워킹트리 미커밋 diff 로 좁혀진다 (`git status`/`git diff` 로 확인):

- `spec/5-system/1-auth.md`
- `spec/5-system/3-error-handling.md`
- `spec/conventions/error-codes.md`
- `spec/2-navigation/9-user-profile.md`

이 diff 는 `plan/in-progress/auth-change-password-oauth-only-code-split.md` (결정 기록 D) ·
`plan/in-progress/spec-draft-change-password-code-alignment.md` 가 이미 확정한 "`changePassword`
실패 코드를 형제 흐름과 정렬" 작업을 spec 에 반영한 것이다. 그 외 `spec/5-system/` 하위 나머지
파일·`2-api-convention.md` 는 diff 없음(순수 컨텍스트) — 신규 식별자 충돌 대상이 아니다.

## 발견사항

이번 diff 가 실제로 새로 발행되게 만드는 값은 `PASSWORD_REQUIRED`·`PASSWORD_INVALID` 뿐이며, 둘
다 **기존에 이미 존재하던 동일 의미의 코드를 새 발행 지점(`UsersService.changePassword`)에서
재사용**하는 것이지 새 식별자를 만드는 것이 아니다. 전수 조사 결과 CRITICAL/WARNING 없음.

- **[INFO]** `PASSWORD_NOT_SET` 신규 채택 회피 — 이미 올바르게 처리됨, 재발 방지 확인만
  - target 신규 식별자: (검토된 안이었으나 **채택되지 않음**) `PASSWORD_NOT_SET`
  - 기존 사용처: `codebase/backend/src/modules/auth/auth.service.ts:330` — `login_history.failure_reason` 감사값으로 이미 발행 중 (`failureReason: 'PASSWORD_NOT_SET'`)
  - 상세: 원안(B) 은 `changePassword` 의 OAuth-only 미설정 조건에 신규 wire 코드 `PASSWORD_NOT_SET` 을 부여하려 했다. 채택되었다면 `INVALID_PASSWORD` 가 현재 겪고 있는 것과 동일한 **wire 코드 vs 감사 사유값 동명 충돌**을 그대로 재생산했을 것이다. 이 충돌은 이전 라운드 naming_collision(INFO#5)이 지적했고, 이번 target(결정 D, 신규 코드 0)이 `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 재사용으로 회피했다 — `spec/conventions/error-codes.md:175`, `plan/in-progress/spec-draft-change-password-code-alignment.md:2429-2437` 에 근거가 명시돼 있다.
  - 제안: 조치 불필요 — 이미 올바르게 회피됨. 향후 `PASSWORD_*` 근접 명명을 늘리려는 시도가 있으면 이 사례를 선례로 재확인할 것.

- **[INFO]** `INVALID_PASSWORD` 은퇴 후 wire/audit 동명 잔존 — 문서화 완결성 확인
  - target 신규 식별자: 없음 (기존 식별자 `INVALID_PASSWORD` 의 스코프가 wire → audit-only 로 축소)
  - 기존 사용처: `spec/1-data-model.md:710` (`login_history.failure_reason` enum) · `spec/data-flow/2-auth.md:76` (로그인 실패 시퀀스) · `codebase/backend/src/modules/auth/auth.service.ts:347`
  - 상세: `error-codes.md §5` 신규 행이 "제거 = wire 발행 중단" 이며 감사 사유값은 별도 레이어로 존속한다고 명시하고, `1-auth.md:339`·`3-error-handling.md:69`(취소선 처리)에서도 동일하게 주석 처리돼 있어 동명 잔존이 실수가 아니라 의도임이 세 곳에서 일관되게 확인된다. `codebase/backend/src/modules/users/users.service.ts:284,292` 는 아직 구현 미착수 상태(여전히 `INVALID_PASSWORD` 발행) — spec 이 codebase 보다 앞서가는 정상적인 --impl-prep 상태다.
  - 제안: 조치 불필요. developer 턴에서 `users.service.ts` 를 `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 로 전환할 때, `login_history` 관련 코드(`auth.service.ts:347`, `users` 모듈은 `login_history` 미사용)는 손대지 않아야 한다는 경계가 이미 spec 에 명시돼 있음을 재확인.

- **[INFO]** 헤딩 앵커 슬러그 변경(`3-error-handling.md §1.2.1`) — 역참조 정합 확인
  - target 신규 식별자: 앵커 슬러그 `#121-2fa--webauthn--재인증비밀번호-재확인-코드-도메인-spec-참조` (구 `#121-2fa--webauthn--재인증-코드-도메인-spec-참조` 에서 헤딩 텍스트 변경으로 파생)
  - 기존 사용처: 구 슬러그를 참조하던 곳은 `spec/5-system/1-auth.md` (§2.3 note, §5 note) 및 `plan/complete/auth-reauth-spec-accuracy.md`·`plan/complete/catalog-residual-codes.md` (완료 아카이브, SoT 아님)
  - 상세: `1-auth.md` 내 2개 참조 링크가 diff 안에서 신규 슬러그로 동시 갱신됐음을 확인(`grep` 으로 구 슬러그의 활성 `spec/` 잔존 0건). `plan/complete/` 잔존은 라이프사이클 관례상 문제 아님.
  - 제안: 조치 불필요 — 이미 동기화됨. 새 식별자 충돌은 아니며 참고로만 기록.

## 요약

이번 target(spec/5-system/1-auth.md·3-error-handling.md·conventions/error-codes.md·2-navigation/9-user-profile.md diff)이 실제로 새로 발행시키는 에러 코드는 `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 뿐이며, 둘 다 `AuthService.verifyPasswordForUser` 가 이미 동일 의미로 발행하던 기존 코드를 `UsersService.changePassword` 새 발행 지점에서 그대로 재사용한 것으로 신규 식별자 도입이 아니다. 원래 검토됐던 신규 코드안(`PASSWORD_NOT_SET`)은 `login_history.failure_reason` 감사값과의 동명 충돌을 이유로 명시적으로 기각됐고 그 근거가 spec·plan 세 곳에 일관되게 기록돼 있다(이전 naming_collision 라운드의 INFO#5 피드백을 target 이 직접 반영). `INVALID_PASSWORD` 의 wire 은퇴 후 audit 사유값 동명 잔존도 "레이어가 다르다" 는 설명과 함께 세 문서에 일관되게 주석 처리돼 있어 혼선 위험이 낮다. 전 레포 grep 으로 대조한 결과 `PASSWORD_REQUIRED`/`PASSWORD_INVALID`/`INVALID_PASSWORD`/`PASSWORD_NOT_SET` 어느 것도 이번 변경으로 인해 서로 다른 의미가 같은 이름에 걸리는 CRITICAL/WARNING 사례를 만들지 않았다.

## 위험도

NONE
