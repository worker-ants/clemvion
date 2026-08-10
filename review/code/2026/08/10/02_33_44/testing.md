# 테스트(Testing) 리뷰 — plan-frontmatter.test.ts

## 발견사항

- **[WARNING]** `worktree`/`started`/`owner` 세 검사가 이 PR이 형제 검사(status·링크)에 적용한 것과 같은 "positive-only → 위반 분기 미관측(vacuous test)" 위험을 그대로 안고 있다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:112`~`139` (`` it("`worktree` is set and not a legacy placeholder") `` / `` it("`started` is an ISO date") `` / `` it("`owner` is set") ``), 특히 판정 로직 `WORKTREE_PLACEHOLDER`/`WORKTREE_SENTINEL` 선언부는 `:53`~`:55`.
  - 상세: 이 파일의 헤더 주석(`:33`~`:44`, `:57`~`:60`)은 정확히 이 실패 패턴을 두 번(`#1108`, `#1117`) 겪었다고 스스로 기록한다 — "158 tests 전량 GREEN 인데 위반 수집 분기는 한 번도 실행되지 않았다". 그래서 이번 PR은 status 판정(`findNonTerminalCompletedPlans`)과 링크 판정(`findBrokenPlanLinks`)을 `plan-scan.ts`/`spec-links.ts`로 추출해 `plan-scan.test.ts`/`spec-links.test.ts`의 합성 fixture로 negative-path를 증명했다. 그런데 같은 파일에 남아 있는 `worktree`(placeholder 정규식)·`started`(ISO 날짜)·`owner`(비어있음) 세 검사는 이 처리를 받지 못한 채 여전히 실저장소 데이터에만 의존하는 positive-only 검사다. 실제로 현재 `plan/in-progress/*.md` 전수를 확인한 결과(`worktree:`/`started:`/`owner:` grep), 어떤 plan도 `WORKTREE_PLACEHOLDER`에 매치되는 `worktree` 값·비-ISO `started` 값·빈 `owner` 값을 갖지 않는다 — 즉 세 `.toBe(false)`/실패 단언 분기는 CI에서 **한 번도 참이 된 적이 없다**. 정규식을 느슨하게 고치거나(`WORKTREE_PLACEHOLDER`), 로직을 삭제해도 이 파일의 어떤 테스트도 깨지지 않는다.
  - 제안: `WORKTREE_PLACEHOLDER`/`WORKTREE_SENTINEL` 판정과 ISO 날짜 판정을 `plan-scan.ts`(또는 신규 모듈)로 옮겨 순수 함수(`isWorktreePlaceholder(value)`, `isValidStartedDate(value)` 등)로 만들고, `plan-scan.test.ts`에 TBD/미정/착수 시/pending·비-ISO 문자열·빈 owner 같은 합성 fixture를 심어 위반이 실제로 검출되는지 양성 단언을 추가한다. 이 PR이 status/링크 검사에 적용한 것과 동일한 패턴이라 구조적 비용은 낮다.

- **[INFO]** `started`가 ISO 날짜 정규식만 통과하면 되고, 달력상 유효성(월 13, 일 32 등)은 검증하지 않는다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:124`~`131` (`ISO_DATE`, `:52`)
  - 상세: `/^\d{4}-\d{2}-\d{2}$/`는 형식만 확인하므로 `2026-13-99` 같은 값도 통과한다. 실질 피해는 낮음(사람이 직접 쓰는 필드, `git log` 상 오기 사례 없음) — 위 WARNING 항목을 처리하는 김에 검토할 만한 수준.

## 요약

새로 도입된 두 게이트 — 완료 plan `status` 모순 검사와 살아있는 plan 상대링크 무결성 검사 — 는 판정 로직을 `plan-scan.ts`/`spec-links.ts` 순수 함수로 추출하고 `plan-scan.test.ts`/`spec-links.test.ts`에서 합성 fixture로 negative-path(위반이 실제로 잡히는지, over-reach 없는지, archive/인덱스 면제, 비-문자열 status, YAML 1.1 `no` 케이스 등)를 꼼꼼히 증명한다. 실저장소 대상 `plan-frontmatter.test.ts`/새 `describe` 블록은 그 위에 discovery-only 하한 단언 + positive 위반-0건 단언을 얹는 이중 구조로, 이 파일 자신이 과거 두 번 겪은 "GREEN인데 검사가 안 도는" 실패를 이번 신규 검사에 대해서는 정확히 재발 방지했다. 다만 같은 파일에 남아있는 기존 `worktree`/`started`/`owner` 세 검사는 그 처방을 받지 못해 여전히 위반 분기가 실측상 한 번도 실행된 적 없는 positive-only 상태다 — 이 PR의 취지(정확히 이 실패 패턴을 없애는 것)에 비추어 보면 놓치기 쉬운 비대칭이라 WARNING으로 표기한다. 실행 확인 결과 관련 3개 테스트 파일(175 tests)은 전부 통과한다.

## 위험도
MEDIUM
