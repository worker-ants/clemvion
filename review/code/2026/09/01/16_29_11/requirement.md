# 요구사항(Requirement) 리뷰

## 검증 방법

diff 는 이미 4라운드 코드 리뷰(`14_31_12`→`15_49_24`, Critical 0 유지, W5→W3→W2→W1)와 3라운드
consistency check(`--spec` 포함)를 거친 상태였다. 그 산출물을 그대로 신뢰하지 않고, 현재
worktree 의 **실제 소스**를 직접 `Read`/`grep`/`jest`/`tsc` 로 재검증했다(저장소에는 아무 것도
쓰지 않음 — 세션 종료 시 `git status --short` 확인, 신규 리뷰 산출물 디렉터리 외 변경 없음).

- `jest audit-action-binding audit-logs.spec business-metrics.service.spec` → **3 suites / 35 tests 전부 통과**
- `tsc --noEmit -p tsconfig.build.json` → **0 에러**
- `AuditLogsService.record()` 실제 호출자(12개 producer 파일: 9 service + 3 controller)를 전수
  grep 해 `resourceType` distinct 값을 직접 셌다 → **`user`·`trigger`·`workflow`·`schedule`·
  `member`·`workspace`·`integration`·`model_config`·`auth_config`·`execution` = 10종**,
  spec/코드 주석의 "distinct 10종" 서술과 정확히 일치. `workspace_invitation`(`workspace-invitations
  .service.ts:220`)과 `alert_rule`(`alerts-evaluator.service.ts:216`)은 실제로
  `notificationsService.notify/createMany` 호출이지 `AuditLogsService.record()` 가 아님을 직접
  코드로 확인 — "알림 값이라 여기 안 온다"는 주석 서술이 사실과 맞다.
- `triggers.service.ts`/`workflows.service.ts`/`schedules.service.ts`/`model-config.service.ts`
  4곳의 `recordAudit` 시그니처가 전부 `AuditActionFor<typeof <RESOURCE>_TYPE>` 로 이미 바인딩돼
  있었고, `auth-configs.service.ts` 만 이번 diff 로 같은 형태로 좁혀졌음을 확인 — plan/CHANGELOG
  가 주장하는 "5개 중 4개는 이미 묶여 있었고 auth_config 만 예외" 서술과 코드가 정확히 일치.

## 발견사항

- **[INFO]** `spec-draft-audit-resource-type-count.md` 는 내용상 완료됐지만 lifecycle 이동이 아직 안 됨
  - 위치: `plan/in-progress/spec-draft-audit-resource-type-count.md` (frontmatter `status` 필드, 파일 경로 자체)
  - 상세: 이 draft 의 "동반 정정" 체크리스트 5개 항목이 전부 `[x]` 이고, 대상 spec 두 문서
    (`spec/5-system/_product-overview.md` §NF-OB-07, `spec/data-flow/1-audit.md` §1.1)에 실제로
    "10종"/"12개 위치(9+3)" 서술이 반영돼 있음을 직접 열어 확인했다. `plan-lifecycle.md §5`
    자가점검("본 PR 의 변경으로 plan 의 모든 체크박스가 `[x]` 인가")은 통과하는데, frontmatter
    는 여전히 `status: in-progress` 이고 파일도 `plan/complete/` 로 옮겨지지 않았다. 같은 PR 의
    자매 draft(`spec-draft-audit-write-failed-metric.md`)는 2라운드 RESOLUTION(W1)에서 이미 이
    이동을 마쳤다 — 같은 처리가 이 두 번째 draft에는 아직 적용되지 않은 상태다. 다만 이 저장소
    관례상 "체크와 `complete/` 이동은 한 동작" 이고 "마무리 커밋은 리뷰 뒤가 정상" 이므로, 이번
    리뷰 라운드가 마지막이라면 종료 후 처리될 여지가 있어 코드 기능 결함은 아니다.
  - 제안: 이번이 최종 라운드로 확정되면 마무리 커밋에서 `status: applied` + `completed` 날짜로
    갱신하고 `git mv` 로 `plan/complete/` 이동, `spec-sync-auth-gaps.md:134` 의 상대링크를
    `../complete/spec-draft-audit-resource-type-count.md` 로 정정.

- **[INFO]** (기존에 이미 추적된 항목, 재확인만) `AuditLogsService.record()` JSDoc 이 여전히 관측 동작(카운터·4필드 로그)을 서술하지 않음
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:72-75` (docstring, 직접 `Read` 로 확인한 실제 줄 번호 — 이번 diff 의 변경 범위 밖)
  - 상세: "Failures are swallowed — audit logging must never break the primary action." 만 있고
    이번 PR 이 추가한 카운터/로그 4필드 동작은 언급이 없다. `plan/in-progress/spec-sync-auth-gaps
    .md:135` 에 "리뷰 4라운드 INFO, 미조치이며 우선순위 판단" 으로 이미 명시적으로 등재·이월된
    항목이라 새로운 결함이 아니다.
  - 제안: 추가 조치 불요 — 이미 plan 에 등재된 우선순위 판단.

- **[INFO]** (기존에 이미 추적된 항목, 재확인만) repo-guard 가 `AuditActionFor<'X'>` 의 제네릭 인자(`X`)까지는 비교하지 않음
  - 위치: `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts:152-157` (`findUnboundHelpers` — `startsWith('AuditActionFor<')` 텍스트 매칭만)
  - 상세: 예컨대 `TriggersService.recordAudit` 의 `action` 을 실수로
    `AuditActionFor<typeof WORKFLOW_RESOURCE_TYPE>` 로 적어도 이 가드는 "묶여 있다" 고 통과시킨다.
    다만 그 경우 실제 호출부(`this.recordAudit({action: AUDIT_ACTIONS.TRIGGER_CREATED, ...})`)가
    `trigger.*` 리터럴을 `AuditActionFor<'workflow'>` 파라미터에 넘기게 되어 TS2322 로 컴파일이
    깨진다 — `audit-action.const.ts` 의 `_NoCrossDomain` 컴파일 타임 캐너리가 이 방향을 별도로
    고정하고 있음을 직접 읽어 확인했다. 즉 가드의 이 경계는 실제로는 컴파일러가 메운다. 3~4라운드
    리뷰가 같은 결론(우선순위 낮음, 문서화 때문이 아니라 판단)으로 이미 처분했다.
  - 제안: 추가 조치 불요.

## 요약

`AuditLogsService.record()` 의 swallow-실패 관측성 추가(카운터 `clemvion.audit.write_failed` +
로그 4필드)와 `auth-configs.service.ts` `recordAudit` 의 리소스 바인딩 타입 수정(및 이를 전수
강제하는 `repo-guards/__tests__/audit-action-binding*` AST 가드 신설) 모두 의도한 기능을
완전하게 구현하고 있다. 핵심 계약(감사 실패가 본 요청을 깨지 않음, 관측 호출 자체도 삼킴,
`@Optional` 로 metrics 없이도 동작)이 실제 코드에 있고 각각을 discriminating fixture/뮤테이션으로
검증하는 테스트가 존재함을 직접 실행으로 재확인했다(35/35 통과, tsc 0-에러). `AuditActionFor` 로
좁힌 것이 실제로 원 결함(다른 리소스의 action 을 `auth_config` 로 기록해도 컴파일러가 못 잡던
구멍)을 닫는지도 타입 정의·호출부를 직접 대조해 확인했다. spec 본문 3곳
(`5-system/_product-overview.md` NF-OB-07 카탈로그, `data-flow/1-audit.md` §1.1 Writer 표,
`data-flow/9-observability.md` 클램핑 원칙)은 코드의 실제 producer 12파일/distinct 10종 수치와
line-level 로 정확히 일치함을 직접 재계산해 확인했다 — 이전 라운드가 잡은 SPEC-DRIFT(SD1)와
후속 12-vs-10 오기산 모두 이미 spec 에 반영·적용 완료 상태다. TODO/FIXME/HACK/XXX 는 신규 파일
전체에 0건. 남은 항목은 전부 이미 plan/이전 라운드에 우선순위 판단으로 명시 등재된 것들과, 아직
`plan/complete/` 로 이동되지 않은 draft 하나(코드 기능과 무관한 lifecycle 위생)뿐이다.

## 위험도

LOW
