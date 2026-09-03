# Plan 정합성 검토 — `spec/5-system/` (impl-done, diff-base `origin/main`)

## 검토 범위 요약

Target 델타는 `spec/5-system/1-auth.md`·`spec/5-system/3-error-handling.md` 2개 파일 +
연쇄 편집인 `spec/2-navigation/9-user-profile.md`·`spec/conventions/error-codes.md`, 그리고
`codebase/` 구현 diff(10파일/417줄) — 전부 `change-password` 실패 코드를 형제 흐름과 정렬하는
단일 작업(`plan/in-progress/auth-change-password-oauth-only-code-split.md` +
`plan/in-progress/spec-draft-change-password-code-alignment.md`)에 속한다.

두 plan 문서(완전 내용 확보)와 diff 를 행 단위로 대조했고, 컨텍스트 예산으로 생략된 다른
`plan/in-progress/*` 파일들은 worktree 절대경로에서 직접 열어 change-password/`PASSWORD_*`/
`INVALID_PASSWORD`/`error-codes.md §5` 키워드로 교차 검색했다 (`spec-sync-auth-gaps.md`,
`spec-sync-user-profile-gaps.md`, `spec-conventions-engine-error-code-surface.md`,
`ws-token-expired-socket-lifetime-impl.md`, `spec-sync-common-gaps.md` 등).

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO]** 두 plan(`auth-change-password-oauth-only-code-split.md`,
  `spec-draft-change-password-code-alignment.md`) 이 스스로 기록한 "결정 필요"/"미결" 항목은
  전부 target 에서 해소됐고, 다른 어떤 in-progress plan 도 이 표면(`INVALID_PASSWORD`/
  `PASSWORD_REQUIRED`/`PASSWORD_INVALID`/`changePassword`)에 대해 상충하는 결정을 열어 두고
  있지 않다. `ws-token-expired-socket-lifetime-impl.md:72-80` 이 유일하게 이 코드들을 언급하는
  제3의 plan인데, 그 문서 자신이 "미설정 조건 분리 여부는 미결이라
  `auth-change-password-oauth-only-code-split.md` 로 이월했다" 고 정확히 기록해 두었고 target
  이 그 이월된 결정을 그대로 이행했다 — 충돌 아님, 정합.

- **[INFO]** `spec/conventions/error-codes.md §5` 의 "현재 B 등급 행은 2건" 이라는 카운터도
  target diff 에 포함돼 있고(`INVALID_INPUT`→`INVALID_TRIGGER_PARAMETERS` #1193 + 이번
  `INVALID_PASSWORD` 건), 다른 in-progress plan 중 동시에 §5 에 3번째 B 등급 행을 추가하려는
  것은 없다(`등급 B`/`잔여 위험 인수` 키워드로 `plan/in-progress/` 전수 검색 — 이 작업의 plan
  둘만 매치). 카운터 drift 위험 없음.

- **[INFO]** `spec/5-system/1-auth.md`·`3-error-handling.md`·`spec/conventions/error-codes.md`·
  `spec/2-navigation/9-user-profile.md` 의 실제 diff(`git diff origin/main...HEAD`)를
  `spec-draft-change-password-code-alignment.md` 의 "변경안" 표(#0~#12) 및
  `auth-change-password-oauth-only-code-split.md` 의 "결정 기록" 과 항목 단위로 대조했다 —
  wire 코드 재사용(신규 코드 0), `INVALID_PASSWORD` §3 제거 + §5 등급 B 은퇴 행 추가,
  §1.2.1 헤더·발행처 갱신, `9-user-profile.md §2.2` 단일 SoT + `:94`/`:141` 포인터 전부 계획대로
  반영됐다. 계획과 target 사이에 이탈 없음.

- **[INFO]** `error-codes.md §5` 신규 행의 `PR` 열이 여전히 plan 문서 링크
  (`plan/in-progress/auth-change-password-oauth-only-code-split.md`)를 가리키고 PR 번호가
  아니다 — 다만 이는 plan 자신이 이미 명시적으로 예정해 둔 상태다("PR 열은 병합 전이라 결정
  plan 링크를 두고, PR 생성 직후 번호로 갱신한다", 변경안 #10 INFO#2). PR 생성 시점에 갱신
  누락되지 않도록 추적 메모만 남긴다 — 이번 라운드의 결함은 아니다.

- **[INFO]** `auth-change-password-oauth-only-code-split.md` 의 `## 할 일` 마지막 두 항목 중
  "developer 턴 — backend 두 분기 + 공용 상수화 + 단위/e2e + 유저 가이드 …" 가 여전히
  `- [ ]` 미체크 상태인데, 실제로는 diff(`password.util.ts` 공유 상수, `users.service.ts`
  두 분기, `sessions.service.ts` 상수 참조, unit/e2e 신설, `password-and-sessions*.mdx` ko/en
  갱신) 로 이미 완료돼 있고 이후 `/ai-review` 1R fix 커밋(`139115d34`)까지 반영됐다. 다른
  plan 과의 충돌·선행 미해소는 아니며, 이 저장소의 표준 순서(review → consistency → 마무리
  커밋에서 체크박스 동기화 + `complete/` 이동 판단)상 본 라운드 통과 후 마무리 커밋에서
  갱신될 항목으로 보인다 — 다만 그 갱신이 빠지면 다음 사람이 "developer 턴 전" 으로 오판할
  수 있으므로 마무리 커밋에서 놓치지 않도록 메모한다.

## 요약

Target 의 두 spec 파일 변경(`1-auth.md`·`3-error-handling.md`)과 연쇄 편집
(`error-codes.md`·`9-user-profile.md`), 그리고 코드 diff 는 이 작업의 소유 plan 두 건이
2026-09-02 에 확정한 결정(D안 — 형제 코드 재사용, 신규 코드 0, `INVALID_PASSWORD` 등급 B 은퇴)을
그대로, 누락 없이 이행한다. 이 표면(`PASSWORD_REQUIRED`/`PASSWORD_INVALID`/`INVALID_PASSWORD`/
`changePassword`)을 언급하는 유일한 제3자 plan(`ws-token-expired-socket-lifetime-impl.md`)은
이미 자신의 미결 사항을 이 작업으로 정확히 이월해 둔 상태였고 target 이 그것을 이행했다. 다른
in-progress plan 중 이 spec 영역(§5-system 인증·에러, `error-codes.md §5`, `9-user-profile.md`)에
대해 상충하는 미해결 결정이나 target 이 가정하는데 아직 안 풀린 선행 조건은 발견되지 않았고,
target 변경이 무효화하거나 새로 만들어야 하는데 반영되지 않은 다른 plan 의 후속 항목도 없다.
유일한 잔여 메모는 소유 plan 자체의 체크박스 위생(마무리 커밋에서 갱신 예정으로 보이는 항목)과
§5 표의 `PR` 열 placeholder 로, 둘 다 이미 plan 이 스스로 예정해 둔 절차이며 이번 target 의
정합성 결함은 아니다.

## 위험도

NONE
