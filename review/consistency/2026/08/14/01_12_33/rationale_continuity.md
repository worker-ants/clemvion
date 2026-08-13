# Rationale 연속성 검토 결과

### 발견사항

- **[CRITICAL] Target diff 부재 — 검토 대상(EIA r8 cache-scope, spec/5-system/)이 이 워크트리에 존재하지 않는다 (worktree/브랜치 불일치, 직전 라운드에서도 동일 판정)**
  - target 위치: 프롬프트가 지목한 `spec/5-system/**` 전체 (`--impl-done`, diff-base `origin/main`)
  - 과거 결정 출처: 해당 없음 — 비교할 diff 자체가 없어 판정 표면이 없음. (같은 세션의 직전 라운드 `review/consistency/2026/08/14/00_00_45/rationale_continuity.md` 가 이미 동일 사유로 CRITICAL·HIGH 로 보고했다.)
  - 상세(재검증 결과, 여전히 동일 상태):
    - `git rev-parse HEAD origin/main` → `f5ab3040c`(HEAD, 브랜치 `claude/raw-query-audit-followups`) vs `598dca9ab`(origin/main). `git diff origin/main...HEAD --stat -- spec/` → **0줄**. HEAD 가 origin/main 대비 앞선 14개 커밋은 전부 `codebase/backend/src/modules/{auth,execution-engine,knowledge-base}`·`codebase/backend/src/common/utils`·`plan/`·`review/` 이며 `spec/` 를 전혀 건드리지 않는다.
    - `git worktree list` 로 확인: 이 프롬프트가 가리키는 워크트리 `eia-r8-cache-scope-4ae434` 는 `claude/raw-query-audit-followups` 를 체크아웃 중이고, EIA r8 관련 실제 작업은 **별도 워크트리** `eia-spec-r8-alignment-fff754`(브랜치 `claude/eia-spec-r8-alignment-fff754`)에서 진행 중이다.
    - `plan/in-progress/spec-draft-eia-r8-alignment.md` (frontmatter `worktree: eia-spec-r8-alignment-fff754`, status: in-progress)가 그 작업의 실제 소재지를 재확인해 준다 — 이 plan 은 여전히 "in-progress" 로 남아 있어, 직전 라운드가 지적한 "이미 origin/main 에 반영된 것으로 보이는 델타 0 가능성" 이 아직 planner 쪽에서 재판정·정리되지 않았다.
    - 결론: 이번 sub-agent 호출이 실행되는 시점의 워크트리 상태는 EIA r8 cache-scope target 과 무관하며, orchestrator 의 워크트리 라우팅이 여전히 잘못돼 있다(같은 세션 내 최소 2회 연속 재현).
  - 제안:
    1. 이 리뷰의 "spec/5-system Rationale 위반 0건"을 EIA r8 작업에 대한 실제 보증으로 해석하지 말 것.
    2. Orchestrator 는 `prompt_file`/`output_file` 이 참조하는 워크트리 경로(`eia-r8-cache-scope-4ae434`)를 EIA r8 작업 워크트리로 다시 매핑하거나, 실제 작업 워크트리(`eia-spec-r8-alignment-fff754`)를 대상으로 이 checker 를 재호출해야 한다.
    3. `plan/in-progress/spec-draft-eia-r8-alignment.md` 는 담당자가 실제 델타(있다면)를 재산정한 뒤 `plan/complete/` 로 이동하거나 폐기 처리해야 한다(메모리 교훈: "델타 0 이면 PR 올리지 말고 폐기").

- **[INFO] 이 워크트리에 실제로 존재하는 diff(UPDATE/DELETE RETURNING 튜플 shape 버그 수정) 는 기존 Rationale 을 위반하지 않고 오히려 복원한다**
  - target 위치: `codebase/backend/src/modules/auth/auth-oauth.service.ts`, `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`, `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts`, 신규 `codebase/backend/src/common/utils/update-returning-rows.ts` (HEAD `f5ab3040c` vs `origin/main`)
  - 과거 결정 출처:
    - `spec/data-flow/2-auth.md` `## Rationale` "OAuth state 의 one-shot DELETE" — "동시 callback 경합에서도 정확히 한 요청만 state 를 얻게" (단일 원자 `DELETE...RETURNING`).
    - `spec/5-system/4-execution-engine.md` `## Rationale` "동시성 cap admission gate — consumer-side + cancelled(timeout) (PR2b)" 및 본문 §1.1 노트("선점이 관측되면 어느 쪽도 쓰지 않고 `false` 를 반환한다. 호출부는 이때 park/terminal 이벤트 emit 을 건너뛰고...").
    - `spec/5-system/8-embedding-pipeline.md` `## Rationale` "V024 reembed_status ... `UPDATE ... WHERE reembed_status='idle' RETURNING id` 으로 race-free."
    - `spec/5-system/10-graph-rag.md` §비기능(동시 호출 표) — "re-extract 동시 호출: DB 컬럼 atomic compare-and-swap 으로 차단, 409 `KB_REEXTRACT_IN_PROGRESS`".
  - 상세: TypeORM 0.3.31+pg 가 `UPDATE`/`DELETE`(RETURNING 포함) 결과를 `[rows, rowCount]` 튜플로 반환하는데, 위 4개 지점이 그 결과를 행 배열로 다뤄 `length===0`/`length===1`/`.map` 판정이 상수처럼 고정돼 있었다(`plan/in-progress/update-returning-tuple-shape.md` 실측). 그 결과 위 Rationale 이 요구하는 "race-free"·"정확히 한 요청만"·"선점 시 이벤트 skip" 불변식이 수개월간 **런타임에서 한 번도 발동하지 않았다**(대신 admission 은 §7.5 rehydration 경로로 결과만 맞게 우회, OAuth 콜백은 정상 로그인까지 `OAUTH_STATE_MISMATCH` 로 상시 실패, KB CAS 락은 동시 재추출/재임베딩을 거절하지 못함). 이번 diff 는 `updateReturningRows()` 헬퍼로 튜플을 정확히 해석해 이 4개 지점의 판정을 spec 이 이미 문서화한 대로 복원한다 — **새 결정도, 기각된 대안의 재도입도 아니며, 과거 결정을 뒤집는 것도 아니다.** 오히려 과거 결정이 코드 레벨에서 조용히 무력화돼 있던 것을 바로잡는 방향.
  - 제안: 해당 plan(`plan/in-progress/update-returning-tuple-shape.md`)의 `[planner 위임]` 항목("소급 각주 — 대상이 한 문서가 아니다": `spec/5-system/4-execution-engine.md`·`8-embedding-pipeline.md`·`10-graph-rag.md`·`spec/data-flow/2-auth.md`·`spec/conventions/node-cancellation.md` 5곳)이 아직 미실행 상태로 남아 있다. project-planner 턴에서 각 문서의 관련 Rationale 절에 "이 불변식은 YYYY-MM 까지 튜플 shape 오독으로 런타임에 미발동이었고 #<PR> 에서 복원됨" 류의 소급 각주를 붙이는 것을 권고한다(이미 plan 에 등재돼 있으므로 신규 발견이 아니라 완료 확인 차원).

### 요약

이번 호출의 명시 target(`spec/5-system/`, diff-base `origin/main`, EIA r8 cache-scope)은 실행 시점의 워크트리 상태에서 origin/main 과 완전히 동일해 판정 표면이 없었다 — 같은 세션의 직전 라운드(`00_00_45`)가 보고한 워크트리/브랜치 라우팅 불일치가 이번 라운드에도 그대로 재현됐다(HEAD 는 origin/main 대비 14개 커밋 선행하지만 전부 `spec/` 밖 코드 변경). 대신 이 워크트리에 실제로 존재하는 diff(UPDATE/DELETE RETURNING 튜플 shape 버그를 auth-oauth/execution-engine/knowledge-base 4개 지점에서 수정)를 관련 Rationale(OAuth state one-shot DELETE, 동시성 cap admission gate, KB CAS 락 race-free 서술)과 대조한 결과, 기각된 대안의 재도입이나 원칙 위반은 없었고 오히려 수개월간 조용히 무력화돼 있던 기존 invariant 를 복원하는 방향이었다 — 다만 그 사실을 spec 에 소급 반영하는 planner 위임 작업은 아직 미완료로 남아 있다(이미 별도 plan 에 등재됨). 종합하면 이번 checker 실행의 "CRITICAL 0(EIA 관련)"을 EIA r8 작업의 정합성 보증으로 읽어서는 안 되며, 근본 원인은 spec 내용 결함이 아니라 오케스트레이터의 워크트리 라우팅 문제다.

### 위험도
HIGH
