# Plan 정합성 검토 — spec/5-system/ (1-auth.md · 3-error-handling.md)

## 발견사항

없음.

## 조사 근거

target 변경은 `change-password`(`UsersService.changePassword`) 실패 코드를 형제 흐름
(`AuthService.verifyPasswordForUser` / `SessionsService.verifyReauth`)과 정렬하는 작업
(`INVALID_PASSWORD` wire 코드 은퇴 → `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 공유)과, 같은
문서 §5 note 의 "순환 의존" 설계 근거를 `--impl-done` 실측으로 반증해 취소선 보존 + 정정한
자기-반증형 소정정(commit `5232a5540`) 두 갈래로 구성된다.

1. **미해결 결정과의 충돌 — 없음.** `PASSWORD_NOT_SET` 신설 여부는
   [`plan/complete/auth-change-password-oauth-only-code-split.md`](../../../../plan/complete/auth-change-password-oauth-only-code-split.md)
   에서 사용자 결정(2026-09-02, "D. 형제와 완전 정렬" 채택 · 옵션 B 기각)으로 이미 닫혔고,
   target 은 그 결정을 그대로 구현한다 — 일방적 결정 아님. 이 plan 이 이미
   `plan/in-progress/` 에서 `plan/complete/`(`status: complete`)로 이동돼 있어(현재 worktree
   staged), target 착수 시점 plan 이 "미해결" 로 남겨 둔 항목이 없다.

2. **선행 plan 미해소 — 없음.** `spec/conventions/error-codes.md` §3(`INVALID_PASSWORD` 행)의
   등재는 선행 작업(`#1268`, `2ff000a6a`)이 완료해 뒀고, target(§5 은퇴 처리)이 그 뒤를 잇는다.
   `9-user-profile.md`(spec_impact 4번째 항목)도 diff 에 포함돼 함께 갱신됐다(`change-password`
   OAuth-only 안내 문구) — spec_impact 선언과 실제 diff 가 일치.

3. **후속 항목 누락 — 없음.** 교차 참조 전수 확인:
   - `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` 의
     `auth-change-password-oauth-only-code-split.md` 링크가 `./`→`../complete/` 로 갱신됨
     (plan 이동에 맞춰 dangling link 방지).
   - `spec/conventions/error-codes.md` §5 행의 plan 링크도 동일하게 `../../plan/complete/...`
     로 갱신됨.
   - `spec/data-flow/2-auth.md`·`spec/1-data-model.md` 의 `INVALID_PASSWORD` 잔존 언급은
     `login_history.failure_reason`(로그인 실패 감사값) 문맥이며, target 이 명시한 "문자열은
     `login_history` 감사값으로 남는다" 정합과 일치 — stale 아님.
   - `PASSWORD_NOT_SET` 문자열은 `login_history.failure_reason` 감사값으로 이미 예약돼 있어
     (target 근거 문단이 언급) wire 코드로 재사용하지 않은 판단도 다른 plan 과 충돌하지 않음.
   - `plan/complete/auth-change-password-oauth-only-code-split.md` 에 남아 있던 유일한
     미완료 항목(`User.passwordHash` 타입이 `nullable: true` 대비 non-null)은 범위를
     "46건짜리 클래스" 로 재실측해 신규 plan
     [`plan/in-progress/entity-nullable-column-type-mismatch.md`](../../../../plan/in-progress/entity-nullable-column-type-mismatch.md)
     로 명시적으로 분리·이관됐다(`spec_impact: none`, 독립 항목이라 target 과 충돌 없음).
   - `spec/5-system/1-auth.md` §5 note 의 자기-반증형 소정정(원문 취소선 보존 + `--impl-done`
     WARNING 인용 + 실측 3점 근거)은 CLAUDE.md "자기-반증형 소정정" 5조건(① 문장을 developer
     자신이 같은 문서에 썼음(git blame: commit `1950e5773`) ② 근거 문장이지 제품 정의/API 계약
     아님 ③ `forwardRef` 34개 파일 실측으로 반증 ④ 그 문장에 국한, 인접 서술 불변 ⑤ commit
     본문에 실측 기록 + `--impl-done` 게이트 통과)을 모두 충족 — plan 우회 아님.

target 이 가정한 다른 plan 의 사전 조건이나, 이 변경이 무효화·신규 필요하게 만드는 다른
plan 의 후속 항목은 발견되지 않았다.

## 요약

`spec/5-system/1-auth.md`·`3-error-handling.md` 변경은 이미 사용자 결정으로 닫힌 plan
(`auth-change-password-oauth-only-code-split.md`)의 실행이며, spec_impact 선언 범위(4개
파일)가 실제 diff 와 일치하고 plan 이동에 따른 상호 링크(ws-token-expired plan ·
error-codes.md §5)도 함께 갱신됐다. 유일한 잔여 항목(`passwordHash` 타입 좁음)은 별도
plan 으로 정식 이관됐고 스코프 충돌이 없다. 미해결 결정 우회·선행 plan 미해소·후속 항목
누락 어느 관점에서도 문제를 찾지 못했다.

## 위험도

NONE
