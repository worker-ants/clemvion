# Rationale 연속성 검토 보고서

## 검토 범위 참고

`_prompts/rationale_continuity.md` 는 `spec/5-system/14-external-interaction-api.md` 와 실제
`git diff origin/main...HEAD -- code_areas` 본문을 컨텍스트 예산 초과로 절단했다. 절단된 근거는
워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434`, 절대경로)를
직접 열어 보강했다.

**실측**: `git diff origin/main...HEAD --stat -- spec/` → **0줄**. HEAD 는 origin/main 대비 16개 커밋
선행하지만 전부 `codebase/backend/src/{common/utils, modules/{auth,execution-engine,knowledge-base}}`·
`codebase/backend/test/`·`plan/`·`CHANGELOG.md`·`review/` 이며 `spec/` 를 전혀 건드리지 않는다.

**메타 노트 (신규 이슈 아님)**: 프롬프트의 "EIA r8 cache-scope" 타깃 서술은 이 워크트리의 실제 내용과
무관하다 — `git branch --show-current` → `claude/raw-query-audit-followups`. 이 워크트리
(`eia-r8-cache-scope-4ae434`)가 재사용되며 디렉터리명이 갱신되지 않은 상태이고, 이미 같은 세션의
직전 라운드(`00_00_45`·`01_12_33`)가 이를 CRITICAL 로 보고했으며, 개발자가 이를 실측·진단해
`plan/in-progress/update-returning-tuple-shape.md`(commit `103dee234`)에 근본 원인(stale 워크트리
이름)과 "워크트리 rename 은 훅 파손 전례로 보류" 결정을 이미 기록했다. 따라서 이 라운드에서는
그 메타 이슈를 재차 CRITICAL 로 반복하지 않고, 이 워크트리에 **실제로 존재하는 diff**를 대상으로
spec/5-system 및 관련 Rationale 과 대조했다.

이번 diff 는 `TypeORM 0.3.31 + pg` 의 raw `UPDATE`/`DELETE ... RETURNING` 쿼리가 `[rows, rowCount]`
튜플을 반환하는데 8개 호출부가 이를 행 배열로 오인해 온 결함을 `updateReturningRows()` 공용 헬퍼로
일괄 수정하는 것이 전부다(`auth-oauth.service.ts`, `execution-engine.service.ts`,
`knowledge-base.service.ts`, 신규 `update-returning-rows.ts`/`assert-row-array.ts` 갱신, 테스트·
가드 스크립트 `source-scan.ts`).

## 발견사항

- **[INFO]** 이번 diff 는 기존 spec Rationale 을 위반하지 않고 오히려 **복원**한다
  - target 위치: `codebase/backend/src/modules/auth/auth-oauth.service.ts`(OAuth state 소비),
    `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
    (`admitExecutionOrDefer` §8 admission gate, `updateExecutionStatus` 종결 UPDATE),
    `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts`(CAS 락·재큐)
  - 과거 결정 출처:
    - `spec/data-flow/2-auth.md` `## Rationale` "OAuth state 의 one-shot DELETE" — 단일 원자
      `DELETE ... RETURNING` 으로 "동시 callback 경합에서도 정확히 한 요청만 state 를 얻는다".
    - `spec/5-system/4-execution-engine.md` §8 "admission gate 원자성(TOCTOU)" 본문 +
      `## Rationale` "동시성 cap admission gate — consumer-side + cancelled(timeout) (PR2b,
      2026-07-04)" — advisory lock + 조건부 `UPDATE ... RETURNING` 으로 카운트→비교→전이를
      원자화하고, 성공 시 `recordRunningSegmentStart` + `EXECUTION_STARTED` emit 이 뒤따른다는
      계약.
    - `spec/5-system/3-error-handling.md` §1.8 — `KB_REEXTRACT_IN_PROGRESS`/`KB_REEMBED_IN_PROGRESS`
      (409) 를 "`reextract_status`/`reembed_status` 컬럼 atomic compare-and-swap 으로 차단" 한다는
      명시적 invariant([10-graph-rag.md §5.1](spec/10-graph-rag.md)·
      [8-embedding-pipeline.md §7.3](spec/8-embedding-pipeline.md) 위임).
  - 상세: 코드·plan(`plan/in-progress/update-returning-tuple-shape.md`) 실측 근거를 직접 대조한
    결과, 수정 전 코드는 위 invariant 들을 **런타임에서 조용히 어기고 있었다** — OAuth 콜백은
    정상 사용자까지 `OAUTH_STATE_MISMATCH` 로 상시 실패, admission gate 의 `if (admitted)` 블록
    (`recordRunningSegmentStart`·`EXECUTION_STARTED` emit)이 영구 미실행(대신 §7.5 rehydration
    경로로 결과만 우연히 맞음 — 매 실행 2s 지연, e2e 실측 4191ms→2242ms 로 확인), KB CAS 락은
    거절 분기가 한 번도 발동하지 않아 동시 재추출/재임베딩을 막지 못했다. 이번 diff 는 파싱
    로직만 고쳐 이미 spec 이 문서화한 의도된 동작으로 되돌린다 — **새 설계 도입도, 기각된
    대안의 재채택도, 과거 결정의 무근거 번복도 아니다.** `AuthOAuthStateRow`(snake_case) 타입
    분리도 `spec/1-data-model.md`/`spec/data-flow/2-auth.md` 의 `remember_me` 컬럼 서술과
    정합한다.
  - 제안: 없음(문제 없음, 기록 목적). `plan/in-progress/update-returning-tuple-shape.md` §후속의
    `[planner 위임]` 항목(아래 참조)이 실행되면 이 관측이 spec 에도 반영된다.

- **[INFO]** 소급 Rationale 각주(5개 spec/convention 문서) — 이미 plan 에 위임 등재, 미실행
  - target 위치: `plan/in-progress/update-returning-tuple-shape.md` §후속 `[planner 위임]` 3항목
    (raw SQL shape 를 convention 으로 승격 / 대상 문서 5곳에 소급 각주 / 3회 반복된 결함
    클래스를 invariant 로 명문화), `plan/in-progress/retry-turn-terminal-guard.md` 의
    "[planner 위임] 소급 각주 5번째 항목"(`spec/conventions/node-cancellation.md:196-198` §2.4
    "mutation 13/13 검증" 서술이 이 튜플 버그로 인해 프로덕션에서 한 번도 발동하지 않은 방어를
    검증했다고 과다 서술).
  - 과거 결정 출처: 없음(신규 발견 아님) — 직전 라운드(`00_54_07` INFO 2, `01_12_33` INFO)가 이미
    동일 취지로 제안했고, 개발자가 `update-returning-tuple-shape.md`(`spec_impact` frontmatter에
    `4-execution-engine.md`·`8-embedding-pipeline.md`·`10-graph-rag.md`·`data-flow/2-auth.md`·
    `conventions/node-cancellation.md` 5건 명시) 및 `retry-turn-terminal-guard.md` 로 이미
    project-planner 위임 처리했다(`status: in-progress`, "완료 처리하지 말 것" 가드 문구 포함).
  - 상세: 이는 target 이 Rationale 을 위반하는 것이 아니라, "spec 에 아직 반영되지 않은 코드
    레벨 발견"이 정상적인 role-분리 절차(developer→project-planner 위임)를 밟고 있는 상태다.
    CLAUDE.md 의 "구현 중 spec 변경 필요 시 developer 는 멈추고 project-planner 위임" 원칙에
    부합한다. 다만 이 위임이 실행되지 않은 채 plan 이 `complete/` 로 이동하면 "결정의 무근거
    번복"(카테고리 3)이 성립할 수 있으므로 완료 전 반드시 반영돼야 한다 — plan 자체가 이미 그
    가드(`[ ] 미완료 시 이동 금지`)를 갖고 있다.
  - 제안: project-planner 턴에서 위 5개 문서에 "이 invariant 는 YYYY-MM 까지 raw SQL RETURNING
    튜플 shape 오독으로 런타임 미발동이었고 이번 PR 에서 복원됨" 류의 소급 각주 추가를 권고
    (이미 plan 에 등재돼 있으므로 완료 확인 차원의 재확인).

## 요약

이번 diff 는 `spec/5-system/` 을 포함해 `spec/` 전체를 1줄도 바꾸지 않는 순수 코드 버그 수정
(raw SQL `UPDATE`/`DELETE ... RETURNING` 튜플 shape 오독, 8개 지점)이다. 관련 spec Rationale
(OAuth state one-shot DELETE 원자성, execution admission gate TOCTOU 원자화 + emit 계약, KB CAS 락
race-free invariant)을 전수 대조한 결과 기각된 대안의 재도입이나 합의 원칙 위반은 없었고, 오히려
수개월간 조용히 무력화돼 있던 기존 invariant 들을 spec 서술과 일치하도록 복원하는 방향이다. 유일한
잔여 항목은 이 발견을 spec 에 소급 반영하는 project-planner 위임 작업으로, 이미 별도 plan
(`update-returning-tuple-shape.md`·`retry-turn-terminal-guard.md`)에 명시적으로 등재돼 완료 전
차단 가드까지 걸려 있어 "무근거 번복" 위험은 낮다. 프롬프트의 "EIA r8 cache-scope" 타깃 서술은
이 워크트리의 실제 diff 와 무관한 stale 네이밍이며, 이는 개발자가 이미 진단·기록한 별개의
오케스트레이터 라우팅 이슈이지 이 diff 의 Rationale 연속성 결함이 아니다.

## 위험도

NONE
