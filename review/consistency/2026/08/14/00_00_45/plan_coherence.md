STATUS=success plan_coherence — CRITICAL 0 / WARNING 2

===REPORT_MARKDOWN_BELOW===

# Plan 정합성 검토 — `spec/5-system/` (impl-done)

대상 코드는 `plan/in-progress/update-returning-tuple-shape.md`(현재 worktree
`eia-r8-cache-scope-4ae434`)가 커밋 `8332d9a20`(+후속 fixup)으로 반영한 "UPDATE/DELETE
RETURNING 이 `[rows, count]` 튜플인데 7~8곳이 행 배열로 다뤘다" 결함 수정이다. 이 plan
자체는 `ie-resume-turn-boundary-cancel.md`·`retry-turn-terminal-guard.md` 두 자매 plan에
대해 "그 plan 이 검증했다고 종결한 것이 실제로는 상수화된 버그 위에서 GREEN 이었다"는
소급 정정을 이미 수행했다(모범적). 그런데 같은 결함 클래스(`admitExecutionOrDefer`)가
영향을 준 **세 번째 plan** 에는 같은 소급 조사가 미치지 않았다.

## 발견사항

- **[WARNING]** `exec-intake-followups.md` 의 "완료" 항목이 같은 tuple-shape 버그로
  검증된 것인데 소급 정정 대상에서 빠졌다
  - target 위치: `plan/in-progress/update-returning-tuple-shape.md` "## 소급 영향" 절
    (92~136행) — `ie-resume-turn-boundary-cancel.md`·`retry-turn-terminal-guard.md` 두
    plan만 조사·배너 처리했다. 같은 절의 "## 무엇이 깨져 있었나" 표 1번째 행은
    `execution-engine` `admitExecutionOrDefer` / `rows.length === 1` / **"항상 거짓 →
    admission 영영 실패"** 다.
  - 관련 plan: `plan/in-progress/exec-intake-followups.md:20-21`
    - `20행` "**admission 회귀 보강** — 완료(2026-07-04). unit(admitExecutionOrDefer):
      원자 UPDATE 파라미터 순서·cap 매핑 … production 코드 무변경. … ai-review 8-reviewer
      Critical/Warning 0."
    - `21행` "**orphan pending backstop** — 완료(2026-07-04). `recoverStuckExecutions`에
      `recoverOrphanPendingExecutions` 추가 …"
  - 상세: `git show origin/main:codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`
    를 직접 확인한 결과, PR2b 당시 admission 테스트가 `admitExecutionOrDefer` 의 조건부
    UPDATE 결과를 `.mockResolvedValueOnce([{ id: 'eSQL' }])`(INSERT 형태, 4582행 주변)로
    세워 뒀다 — 정확히 `update-returning-tuple-shape.md` 가 "왜 아무도 못 봤나" 절에서
    지적한 바로 그 오형 mock 이다. 즉 `exec-intake-followups.md` 가 2026-07-04 "완료"로
    닫은 admission 게이트 unit 검증은 이 PR 이 고친 것과 동일한 버그를 그대로 통과시키는
    mock 위에서 GREEN 이었다. e2e(`orphan pending backstop`, `execution-concurrency-cap`
    계열)는 실 DB 를 쓰지만, `update-returning-tuple-shape.md` 자신이 "e2e 는 최종 상태만
    봤다 … 결과만 맞고 경로가 틀렸다"고 확인한 것과 같은 마스킹 패턴이 이 admission 경로
    자체에도 적용된다 — 버그가 있던 동안 admission 은 사실상 **항상 deferred**(허위 판정이
    아니라 늘 같은 방향)였고, 실제 승인(happy-path: `recordRunningSegmentStart`·
    `EXECUTION_STARTED` emit)은 프로덕션에서 한 번도 그 경로로 발화하지 않았다. 이건
    `ie-resume-turn-boundary-cancel.md`/`retry-turn-terminal-guard.md` 에 적용한 것과
    정확히 같은 "종결은 코드가 아니라 문서의 상태였다" 패턴이며, `exec-intake-followups.md`
    는 아직 그 정정을 받지 못했다.
  - 제안: `update-returning-tuple-shape.md` 의 "## 소급 영향" 조사를
    `exec-intake-followups.md` 로 확장하고, 20~21행에 동일한 소급 정정 배너(무엇이 실제로는
    검증되지 않았는지, 8332d9a20 이전 실제 프로덕션 동작이 무엇이었는지)를 추가할 것.
    부수적으로 `plan/complete/exec-intake-queue-impl.md`·`plan/complete/orphan-pending-backstop.md`
    도 같은 admission 경로에 의존하는지 확인 대상(완료 이관본이라 우선순위는 낮음).

- **[WARNING]** 신규 spec 위임 5건이 이 PR 계열이 확립한 단일 집결 티켓에 등재되지 않았다
  - target 위치: `plan/in-progress/update-returning-tuple-shape.md:214-236`
    ("**[planner 위임]** 소급 각주 — 대상이 한 문서가 아니다")
  - 관련 plan: `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md`
    (developer 의 `spec/` 위임을 모으는 SoT 티켓, `#6`~`#11` 항목 보유)
  - 상세: 자매 plan `ie-resume-turn-boundary-cancel.md`(체크리스트 (D), 188~192행)와
    `retry-turn-terminal-guard.md`(§project-planner 위임, 947~957행)는 developer 가
    `spec/` 쓰기 권한이 없을 때 반드시 `spec-update-node-cancellation-shutdown-classification.md`
    에 새 번호 항목(`#7`, `#10`)으로 등재하는 관행을 확립했고, 그 문서 자신도 "#8"에서
    "**등재하지 않으면 다음 planner 스윕이 놓친다**"고 명시했다(451~459행). 그런데
    `update-returning-tuple-shape.md` 가 새로 발견한 5개 spec 각주 — 특히
    `spec/5-system/4-execution-engine.md` §1.1(admission gate·종결 이벤트) 과
    `spec/conventions/node-cancellation.md` §2.4(persisted 반환값 caveat) — 는 바로 그 SoT
    티켓이 이미 `#7`/`#8`에서 관리하던 **같은 절**인데도 새 번호 항목으로 등재되지 않고
    `update-returning-tuple-shape.md` 자신의 "후속" 절에 고립돼 있다. 추가로 이 plan은
    5개 대상 문서 중 `node-cancellation.md` 의 `pending_plans:` 등재만 명시(230행)하고
    나머지 4개 문서(`4-execution-engine.md`·`8-embedding-pipeline.md`·`10-graph-rag.md`·
    `data-flow/2-auth.md`)의 `pending_plans:` 등재는 언급이 없다(`spec-pending-plan-existence.test.ts`
    는 역방향 — `pending_plans:` 항목이 실재 파일을 가리키는지만 검사하고, `spec_impact` 목록에
    대응하는 `pending_plans:` 존재를 강제하지는 않는다 — 실측 확인). planner 가 다음 스윕에서
    확립된 SoT 티켓만 보면 이 5건 중 다수를 놓칠 위험이 있다.
  - 제안: `spec-update-node-cancellation-shutdown-classification.md` 에 `#12`(가칭)로
    이 5건을 등재하거나, 최소한 그 문서에서 `update-returning-tuple-shape.md` 를 참조하는
    포인터 한 줄을 남길 것. 아울러 `pending_plans:` 등재를 5개 대상 문서 전부로 확장할지
    (또는 SoT 티켓 등재로 대체할지) planner turn 에서 결정할 것.

## 요약

`update-returning-tuple-shape.md` 자신은 이미 이 세션에서 "완료 선언이 사실보다 앞섰다"는
패턴을 여러 차례 스스로 잡아낸 매우 꼼꼼한 plan이고, 소급 영향 조사도 두 개 자매 plan에
대해서는 모범적으로 수행했다. 다만 그 조사 범위가 `admitExecutionOrDefer` 버그의 세 번째
피해자인 `exec-intake-followups.md` 까지 미치지 못했고, 신규 spec 위임 5건도 이 PR family가
확립한 단일 집결 지점(`spec-update-node-cancellation-shutdown-classification.md`)에
등재되지 않아 고립됐다. 둘 다 활성 미해결 결정과 충돌하는 CRITICAL 은 아니며, "이 PR을
막을 필요"는 없지만 완료(`complete/`) 이관 전 또는 다음 planner 턴에서 반영돼야 한다.

## 위험도
MEDIUM
