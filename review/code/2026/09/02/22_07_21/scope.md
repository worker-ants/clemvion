# 변경 범위(Scope) 리뷰 — `change-password` 실패 코드 정렬 (commit `93146d2f2`)

## 검토 방법

`git log --oneline origin/main..HEAD` 로 이 브랜치가 단일 커밋(`93146d2f2`)임을 확인하고,
`git diff origin/main..HEAD -M --stat`/`--summary` 로 46개 프롬프트 파일 전체를 rename 탐지
포함해 재대조했다. 커밋 메시지 전문을 읽어 진술된 목적("`change-password` 실패 코드를 형제
흐름과 정렬")과 실제 diff 를 파일 단위로 대조했다.

## 발견사항

- **[WARNING]** 무관한 plan-lifecycle 정리(WS `auth.token_expired` 배지 flip 트래커 종결)가
  이 커밋에 편입됨
  - 위치: `plan/complete/spec-draft-ws-badge-flip-tracker-close.md` (신설, 파일 11) /
    `plan/in-progress/spec-draft-ws-badge-flip-tracker-close.md` (삭제, 파일 15) — 실제로는
    `git diff -M` 이 `rename plan/{in-progress => complete}/spec-draft-ws-badge-flip-tracker-close.md
    (96%)` 로 인식하는 **하나의 이동**이다.
  - 상세: 이 파일이 다루는 대상(`spec/5-system/6-websocket-protocol.md` 를 `implemented` 로
    승격, `2-api-convention.md §10.4` 예외 위임)은 실측 결과 이미 `origin/main` 에 병합된
    별개 PR(`#1267`, 커밋 `7e6a4bc3e docs(spec): WS 트래커 종결 — implemented 승격 + §10.4
    예외 위임 (#1267)`)에서 spec 본문까지 전량 반영이 끝나 있었다. 이번 커밋은 `spec/5-system/
    6-websocket-protocol.md`·`2-api-convention.md` 어느 쪽도 건드리지 않는다(diffstat 확인).
    즉 `#1267` 이 spec 은 다 고쳐 놓고 그 근거였던 `plan/in-progress/` 문서 하나만 `complete/`
    로 옮기지 않고 남겨 둔 것을, 완전히 무관한 이번 `change-password` 코드 정렬 커밋이 대신
    치워 준 것이다. 커밋 메시지 전문(무엇이 문제였나/신규 코드 0/drift 원인/ratchet/유저
    가이드/spec/검증 7개 절)을 전수 확인했지만 WS·websocket·배지·`#1266`(다른 문맥으로 1회
    언급)·`#1267` 어디에도 이 변경을 설명하는 문장이 없다 — PR 이 스스로 진술하는 범위 밖의
    변경이다. 기능적 위험은 낮다(코드 0줄, `plan/complete/**` 로 이동되는 산문 문서 5줄
    변경뿐)지만, 이 커밋의 `git log -S`/`git blame` 이력을 이 PR과 무관한 WS 트래커 종결
    사유로 오염시키고, 리뷰어가 "이 커밋이 WS 프로토콜에도 손을 댔나?" 라고 오판할 여지를
    만든다. `git add -A` 류의 일괄 스테이징이 원인일 가능성이 높다(동일 worktree 세션에서
    선행 planner 턴이 만든 파일이 커밋 경계 없이 섞여 들어간 형태).
  - 제안: 이 rename+banner 추가를 별도의 작은 정리 커밋(`docs(plan): WS 배지 flip 트래커
    잔여 이동`)으로 분리하거나, 최소한 커밋 메시지에 "겸사겸사 무관한 WS 트래커 정리 포함"
    임을 한 줄로 명시해 `git blame` 조사자의 혼선을 막는다.

## 관련 없다고 확인한 항목 (오탐 방지용 기록)

- `plan/complete/spec-draft-api-convention-status-and-password-codes.md` (파일 10/13, rename):
  커밋 메시지가 명시적으로 인용하는 선행 draft(`#1268` → `INVALID_PASSWORD` §3 등재)의 후속
  종결이라 **직접 관련**. `INVALID_PASSWORD` 가 이 PR 에서 §5 로 은퇴하며 그 선행 draft 가
  등재했던 문제의 원인이 사라졌다는 종결 배너 내용도 diff 와 정확히 일치한다.
- `review/consistency/2026/09/02/{21_12_35,21_26_05,21_40_49}/**` (파일 16~41, 3라운드,
  약 700줄): 전부 이번 spec draft(`spec-draft-change-password-code-alignment.md`) 또는
  `spec/5-system/` 구현 착수 전 검토(`--impl-prep`) 를 대상으로 한다 — CLAUDE.md 가 명시하는
  "developer 는 구현 착수 직전 `consistency-check --impl-prep` 의무" + "`project-planner` 는
  `spec/` 쓰기 직전 `consistency-check --spec` 의무" 를 그대로 이행한 증적이며, 이 저장소의
  기존 관례(선행 커밋들도 동일 패턴)와 일치한다. 분량은 크지만 무관한 리팩토링이 아니라
  이 작업 자체가 요구하는 프로세스 산출물이다.
- `scripts/backend-typecheck-baseline.json` (파일 42, `total: 199→198`,
  `users.service.spec.ts` 항목 제거): 이번 커밋이 추가한 `oauthOnlyUser()` 캐스트 팩토리가
  기존에 테스트마다 흩어져 있던 타입 캐스트를 한 곳으로 모으면서 선재 타입 오류 1건을
  해소한 결과로, 커밋 메시지("baseline 을 199/38 → 198/37 로 낮췄다")와 정확히 일치한다.
  ratchet 값을 낮추는 방향이라(느슨화 아님) 정책 위반도 아니다.
- `spec/2-navigation/9-user-profile.md`(파일 43)·`codebase/frontend/.../password-and-
  sessions.{mdx,en.mdx}`(파일 8~9): plan 파일(`auth-change-password-oauth-only-code-split.md`)
  이 이번 라운드에서 `spec_impact`·체크리스트에 명시적으로 추가한 항목이고, 커밋 메시지의
  "유저 가이드가 반대로 적고 있었다" 절이 정확히 이 두 mdx 파일의 사실 오류 정정을 설명한다
  — 신규 기능 확장이 아니라 이번 작업이 노출한 인접 문서 결함의 동반 수정.
- codebase 소스 7개 파일(파일 1~7, `password.util.ts`·`auth.service.ts`·
  `sessions.service.ts`·`users.service.ts`·관련 spec/e2e): `PASSWORD_VERIFY_CODES` 상수
  신설과 3개 발행처 정렬은 커밋이 명시한 "drift 의 원인을 구조로 막았다" 목표와 1:1로
  대응하며 범위를 벗어나는 헬퍼 추출·불필요 리팩토링은 없다. `sessions.service.ts` 의 import
  재정렬도 신설 상수 추가에 따른 필연적 변경이다. 포맷팅만 바뀐 줄, 주석만 바뀐 줄, 미사용
  임포트, 의도 없는 설정 변경은 발견되지 않았다.

## 요약

이 커밋(`93146d2f2`)은 자신이 진술한 목적 — `UsersService.changePassword` 의 두 실패 조건을
형제 흐름(`AuthService.verifyPasswordForUser`)과 같은 코드로 정렬 — 에 거의 정확히 부합한다.
코드·테스트·문서·spec·consistency-check 산출물 사이의 대응 관계를 실측으로 하나하나 대조한
결과, 유일하게 범위를 벗어난 것은 `plan/complete/spec-draft-ws-badge-flip-tracker-close.md`
로의 rename 이다 — 이미 별개 PR(`#1267`)에서 종결된 WebSocket `auth.token_expired` 트래커의
plan 파일 정리가, 완전히 무관한 이번 커밋에 편입됐다. 기능적 위험은 없지만 커밋 경계가
갖는 "하나의 변경 = 하나의 이유" 원칙을 깨고 이력 추적을 혼란시키므로 WARNING 으로 기록한다.
그 외 방대한 분량(46개 파일)은 대부분 이 저장소가 의무화하는 SDD 프로세스 증적(consistency
check 3라운드)과 이번 작업이 직접 요구하는 spec/plan/문서 동반 수정이라 범위 위반이 아니다.

## 위험도

LOW
