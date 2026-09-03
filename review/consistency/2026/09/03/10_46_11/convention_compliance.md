# 정식 규약 준수 검토 — `spec/5-system/1-auth.md` · `spec/5-system/3-error-handling.md`

검토 모드: `--impl-done` (scope=`spec/5-system/`, diff-base=`origin/main`)
실제 델타: `spec/5-system/1-auth.md`, `spec/5-system/3-error-handling.md` (2 파일) + 구현 diff 10 파일/417줄
(`INVALID_PASSWORD` → `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 형제 코드 정렬, `#auth-change-password-oauth-only-code-split`)

## 발견사항

- **[INFO]** `error-codes.md` §5 Rename 이력 표의 `PR` 컬럼 값 형식 불일치
  - target 위치: `spec/conventions/error-codes.md` §5 "Rename 이력 (Retired codes)" 표, `INVALID_PASSWORD` 행
  - 위반 규약: 없음(정식 규약 문서화된 제약은 아님) — 같은 표 안의 관행(implicit) 과의 불일치
  - 상세: 같은 표의 다른 행들은 `PR` 컬럼에 `PR4b`·`#1193`·`#566` 처럼 PR/이슈 식별자를 쓰는데, 신규 `INVALID_PASSWORD` 행만 `[auth-change-password-oauth-only-code-split.md](../../plan/in-progress/...)` 로 plan 파일 링크를 넣었다. 컬럼 헤더가 `PR` 인데 값의 종류가 행마다 달라 표를 스캔하는 사람이 "이 컬럼이 무엇을 가리키는가" 를 행마다 다시 판단해야 한다. 미병합 브랜치라 PR 번호가 아직 없는 사정은 이해되나(옳은 근거), 그 경우 헤더를 `PR/근거` 로 일반화하거나 각주로 "PR 번호 없으면 plan 링크" 규칙을 명시하는 편이 다음 행 추가자에게 더 명확하다.
  - 제안: (a) 이 표의 헤더를 `근거`/`PR·plan` 등으로 일반화해 이런 혼재를 정식 허용하거나, (b) PR이 열리는 시점에 값을 실제 PR 번호로 교체. 규약 위반은 아니므로 필수 조치는 아니다.

## 요약

`spec/5-system/1-auth.md`·`3-error-handling.md` 의 이번 변경(`changePassword` 실패 코드를 `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 로 형제 흐름과 정렬)은 `spec/conventions/error-codes.md` 의 명명·rename 안정성·historical-artifact 예외 레지스트리 규약을 정확히 따른다 — 신규 코드를 만들지 않고 기존 코드를 재사용했고, §5 에 "등급 B(잔여 위험 인수)" 로 명시 등재하며 사용자 결정 시점·근거(대안 `PASSWORD_NOT_SET` 이 이미 `login_history.failure_reason` 값으로 존재한다는 주장 — `auth.service.ts:331` 확인 완료)까지 실측 가능하게 기록했다. `error.code` 는 `UPPER_SNAKE_CASE` 를 유지하고, `login_history.failure_reason` 잔존 `INVALID_PASSWORD` 와 wire 코드 은퇴 사실을 레이어별로 명확히 분리해 §1.2.1 각주에 정리했다. Swagger 데코레이터(`@ApiUnauthorizedResponse`)는 코드 문자열을 하드코딩하지 않아 `swagger.md` §2-4 패턴을 그대로 따르며 드리프트가 없다. 함께 갱신된 `codebase/frontend/.../password-and-sessions.mdx`·`.en.mdx` 는 `i18n-userguide.md` Principle 5(KO canonical + frontmatter, EN sibling 무-frontmatter)·Principle 6(해요체)·Principle 6-B(내부 SoT 비노출)를 모두 준수한다. `audit-actions.md` 대상인 `user.password_changed` 액션은 이번 변경으로 신설·변경되지 않아 영향이 없다. 문서 3섹션(Overview/본문/Rationale) 구조도 두 파일 모두 유지된다. 발견된 항목은 표 컬럼 서식에 관한 INFO 1건뿐이며 CRITICAL/WARNING 은 없다.

## 위험도
NONE
