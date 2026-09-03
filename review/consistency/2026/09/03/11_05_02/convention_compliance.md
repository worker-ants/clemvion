# 정식 규약 준수 검토 — `spec/5-system/1-auth.md` · `spec/5-system/3-error-handling.md`

검토 모드: `--impl-done` (diff-base `origin/main`, HEAD 워킹트리 기준)
관련 구현: `change-password` 실패 코드 형제 정렬 (`INVALID_PASSWORD` → `PASSWORD_REQUIRED`/`PASSWORD_INVALID`)

## 발견사항

- **[INFO]** `error-codes.md §5` Rename 이력 표의 신규 행이 `PR` 열에 PR 번호 대신 plan 문서 링크를 사용
  - target 위치: `spec/conventions/error-codes.md` §5 "Rename 이력" 표, `INVALID_PASSWORD` 행
  - 위반 규약: 없음 — 명시적 규약 위반은 아니다. 같은 표의 다른 행(`LLM_CONFIG_NOT_FOUND`→`PR4b`, `INVALID_INPUT`→`#1193`, `WORKSPACE_REQUIRED`→`#566`)은 모두 PR 번호/태그를 쓰는데, 이 행만 `[auth-change-password-oauth-only-code-split.md](../../plan/in-progress/...)` 링크다.
  - 상세: 헤더가 "PR" 인 열에 PR 참조가 아니라 in-progress plan 링크가 들어가 표 열의 의미가 국소적으로 갈린다. PR 이 아직 생성/머지되지 않은 시점의 작업이라 불가피한 임시 표기로 보이며, 다른 행들도 실제로는 작업 완료 후 PR 번호로 소급 기재됐을 가능성이 있다(현재 값들이 실제 PR 번호인지 별도 확인은 하지 않았다).
  - 제안: 해당 plan 이 `plan/complete/` 로 이동하고 실제 PR 번호가 확정되면 그 시점에 `PR` 열을 번호로 갱신. 지금 단계에서는 blocking 사유 아님 — INFO 로만 남긴다.

- **[INFO]** §1.2.1 신규 서술과 §1.2 catalog 정리가 규약이 요구하는 "spec 문서화 → 카탈로그 등재" 순서를 정확히 따름 (문제 아님, 강점으로 기록)
  - target 위치: `spec/5-system/3-error-handling.md` §1.2(표에서 `INVALID_PASSWORD` 행 제거) · §1.2.1(두 코드 발행처에 `changePassword` 추가) · Rationale 마지막 bullet(취소선 정정 이력)
  - 확인 내용: `error-codes.md §5` 의 "Retired codes" 흡수 요건(등급 B, `PR`/plan 링크, "제거는 wire 발행 중단을 뜻한다" 각주, B 등급 카운트 문단 갱신)이 신규 행에 전부 반영되어 있고, `login_history.failure_reason` 잔존 문자열에 대한 레이어 구분도 각 문서(§1.2.1 note, `1-auth.md` §2.3 note, `error-codes.md §5` 행)에 일관되게 명시됨. 관련 anchor(`#121-2fa--webauthn--재인증비밀번호-재확인-코드-도메인-spec-참조`)도 새 제목과 정확히 일치.
  - 상세: 별도 조치 불요.

## 점검한 관점별 결과

1. **명명 규약** — `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 는 기존 형제 흐름(`AuthService.verifyPasswordForUser`, `SessionsService.verifyReauth`)이 이미 쓰던 `UPPER_SNAKE_CASE` 코드를 재사용한 것으로, `error-codes.md §1`(의미 기반 명명)·§2(rename 대신 신설/재사용 원칙)와 정확히 부합한다. 새 코드를 만들지 않고 기존 의미-정확 코드로 흡수한 것은 §2 Rationale("이름 정확성 향상만을 위한 rename 은 하지 않는다")의 취지에도 맞다 — 이번 변경은 단순 rename 이 아니라 **두 조건의 분리**(의미 분기)이므로 §2 예외 사유("의미가 분기되거나 새 조건이 생기면 새 코드를 신설")에 해당하고, 마침 그 코드가 이미 존재해 신설 없이 흡수했다. 코드 상수 `PASSWORD_VERIFY_CODES`(`common/utils/password.util.ts`) 명명도 기존 `MCP_ERROR_CODES`·`INTEGRATION_LOCALIZED_ERROR_CODES` 등 `<도메인>_CODES` 패턴과 일치.
2. **출력 포맷 규약** — 봉투 형식(`{ code, message }` → `UnauthorizedException`)은 변경 없이 유지, 값만 조건별로 분기했다. `node-output.md §3.2`(UPPER_SNAKE_CASE) 준수. API 레벨 에러코드이므로 node `output.error.code` 규율(§4.1/§4.2) 대상은 아니며 스코프 오분류 없음.
3. **문서 구조 규약** — `1-auth.md`(Overview: L80 / 본문 / Rationale: L578), `3-error-handling.md`(Overview: L967 / 본문 / Rationale: L1497) 모두 Overview/본문/Rationale 3섹션 구조 유지. frontmatter `id`/`status`/`code:` 필드 정상.
4. **API 문서 규약** — 이번 diff 는 `UsersController.changePassword` 의 DTO·swagger 데코레이터를 건드리지 않았다(`@ApiUnauthorizedResponse({ description: '현재 비밀번호 불일치 또는 인증 실패' })` 는 조건-불문 일반 서술이라 코드 분리와 무관하게 여전히 유효). swagger.md 관례 위반 없음.
5. **금지 항목** — `error-codes.md §2` 가 금지하는 "정확성 향상만을 위한 rename" 은 아님(위 1번 참조). §5 은퇴 표의 "제거 = 코드베이스에서 완전 제거" 라는 머리말 전제가 이번 행(감사값으로 문자열 존속)에는 그대로 성립하지 않는데, 이를 문서가 스스로 각주("제거는 wire 발행 중단을 뜻한다…")로 미리 일반화해 둔 상태라 규약 위반이 아니라 규약이 예견한 케이스로 정확히 흡수됨.

## 교차 확인
- `spec/`, `plan/` 전수 grep 으로 `INVALID_PASSWORD` 잔존 참조를 확인 — 남은 참조는 전부 `login_history.failure_reason`(로그인 실패 감사값) 레이어로 올바르게 한정되어 있고, wire 코드로 오인될 수 있는 dangling 참조는 없음.
- 코드(HEAD 워킹트리, 절대경로 확인): `common/utils/password.util.ts`(`PASSWORD_VERIFY_CODES` 신설) · `auth.service.ts` · `sessions.service.ts` · `users.service.ts` 가 모두 공용 상수를 참조하도록 정렬되어 spec 서술과 실제 발행 코드가 일치.
- role-based 쓰기 권한: `plan/in-progress/auth-change-password-oauth-only-code-split.md` 의 `owner: planner` + "developer 턴 완료" 구분 기재로, `spec/**` 수정이 planner 트랙(consistency-check `--spec` 산출물 동반, `review/consistency/2026/09/02/21_26_05`·`21_40_49`)을 거쳤음을 확인 — CLAUDE.md 의 role 경계(§Skill 체계) 위반 아님.

## 요약
`spec/5-system/1-auth.md`·`3-error-handling.md`(및 함께 갱신된 `spec/conventions/error-codes.md`, `spec/2-navigation/9-user-profile.md`)는 에러 코드 명명·안정성·문서 구조 규약을 매우 높은 정합도로 준수한다. `INVALID_PASSWORD` 은퇴 처리는 `error-codes.md §5` 가 스스로 정의한 "등급 B(잔여 위험 인수)" 흡수 절차·표 형식·각주 요건을 빠짐없이 따랐고, 감사값 레이어 잔존까지 각 문서에서 일관되게 구분해 서술한다. 코드 레벨(diff)도 spec 서술과 1:1 대응하며 role 경계(planner=spec, developer=codebase) 위반도 없다. 유일한 지적은 `error-codes.md §5` 표의 `PR` 열에 아직 PR 번호 대신 plan 링크가 들어간 것으로, 규약 위반이 아닌 사소한 표기 완결성 이슈(INFO)다.

## 위험도
NONE
