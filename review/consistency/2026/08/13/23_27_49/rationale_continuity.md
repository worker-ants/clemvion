# Rationale 연속성 검토 결과

## 검토 대상 재확인

프롬프트의 `## Target 문서` 절은 컨텍스트 예산 초과로 실제 diff 본문이 전부 생략돼 있었다
(`<git diff origin/main...HEAD -- code_areas>` 자체가 생략 목록). 워킹트리에서
`git diff origin/main...HEAD`를 직접 실행해 실제 변경분을 확인했다.

`spec/5-system/` 본문 자체는 이번 diff 에서 **변경되지 않았다**(0건). 실제 변경은
`UPDATE`/`DELETE ... RETURNING` raw 쿼리가 TypeORM 0.3.31+pg 에서 `[rows, rowCount]` 튜플을
반환하는데 7~8곳이 행 배열로 오인해 온 버그를 고친 코드 PR이다
(`codebase/backend/src/common/utils/update-returning-rows.ts` 신설 +
`execution-engine.service.ts`/`knowledge-base.service.ts`/`auth-oauth.service.ts` 적용,
`plan/in-progress/update-returning-tuple-shape.md` 가 근거 문서). 이 PR은 발생을 인지하자마자
소급 영향을 조사해 `plan/in-progress/ie-resume-turn-boundary-cancel.md`·
`plan/in-progress/retry-turn-terminal-guard.md` 두 개의 과거 "수렴 종료" 결론에 소급 정정
배너를 붙였다 — 이 배너 자체가 이번 diff 의 일부이므로 Rationale 연속성 검토 대상이다.

## 발견사항

- **[WARNING]** `retry-turn-terminal-guard.md`의 소급 정정 배너가 "spec 각주 갱신이 이미
  planner 위임 항목에 등재돼 있다"고 주장하나, 실제로는 어디에도 등재돼 있지 않다
  - target 위치: `plan/in-progress/retry-turn-terminal-guard.md:42-43` (2026-08-13 신설 배너,
    커밋 `f56334c10`)
  - 과거 결정 출처: 인용 대상은 `spec/conventions/node-cancellation.md:198` §2.4
    "retry 재진입 종결 경로 terminal 가드" 행의 "✓ mutation 13/13 검증" 서술
  - 상세: 배너 원문은 "`spec/conventions/node-cancellation.md:198` §2.4 의 '✓ mutation 13/13
    검증' 서술도 이 mock 경계 안쪽만 반영한다 — **각주 갱신은 planner 위임 항목에 등재돼
    있다**"이다. 그러나 직전 문장이 가리키는 근거 문서
    `plan/in-progress/update-returning-tuple-shape.md` 를 열어 그 문서의 `[planner 위임]`
    항목(줄 193-208)을 확인하면, 실제로 등재된 spec 파일은 `spec/5-system/4-execution-engine.md`
    §1.1 · `spec/5-system/8-embedding-pipeline.md` §7.3 · `spec/5-system/10-graph-rag.md` 동시
    호출 표 · `spec/data-flow/2-auth.md` OAuth state 소비 **4건뿐**이고
    `spec/conventions/node-cancellation.md` 는 언급조차 없다(`grep -n "node-cancellation"
    update-returning-tuple-shape.md` → 0건). node-cancellation.md 의 §6/§2.4 표를 단일
    진실로 추적하는 전용 문서 `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md`
    도 확인했으나 이 튜플 버그·"mutation N/N" 재검증 관련 항목은 0건이다(`#8`/`#9`/`#10` 은
    2026-07-28 에 이미 종결된 별개 SPEC-DRIFT 건). 즉 "각주 갱신은 등재돼 있다"는 문장은
    검증 가능한 사실 주장인데 검증 결과 **거짓**이다.
  - 이 사실은 같은 커밋(`f56334c10`, 커밋 메시지: "'두 plan 모두' 라 써 놓고 한 곳만 고쳤다 —
    네 번째 반복")이 스스로 인정하는 바로 그 결함 클래스("완료/등재 선언이 실제보다 앞섬")의
    재발로 읽힌다 — 그 커밋은 "네 번째"라고 자인했지만, 지금 확인한 이 특정 문장은 그 커밋이
    고친 결과물 안에 남아 있는 **다섯 번째**로 보인다.
  - 제안: `retry-turn-terminal-guard.md:42-43` 의 "등재돼 있다"를 사실대로 "미등재 — planner
    가 `spec-update-node-cancellation-shutdown-classification.md`에 신규 항목으로 추가해야
    한다"로 정정하거나, 지금 이 세션에서 실제로 그 문서에 신규 위임 항목을 추가해 문장을
    사실과 맞출 것. `plan/complete/` 이동 전 필수 체크리스트에도 "spec 각주 갱신 등재 확인"을
    별도 항목으로 추가해 다음 라운드가 같은 착시를 반복하지 않게 할 것.

- **[INFO]** 같은 근본 결함(`updateExecutionStatus`의 `persisted` 상시 `true`)에 의존하는
  §2.4 표의 다른 행(park↔resume 짝 전이 · AI turn 경계 가드)은 소급 정정 배너의 명시 대상에서
  빠져 있다
  - target 위치: `plan/in-progress/ie-resume-turn-boundary-cancel.md` 상단 배너(범위를
    "6~8차 라운드"로만 서술, spec 특정 행을 지목하지 않음) / `spec/conventions/node-cancellation.md:196-197`
  - 과거 결정 출처: `spec/conventions/node-cancellation.md` §2.4 표 — 196행 "AI multi-turn turn
    경계 cancel 가드"("mutation 검증 완료"), 197행 "park↔resume 짝 전이 terminal
    가드"("mutation 6/6 검증")
  - 상세: `ai-turn-orchestrator.service.ts`의 JSDoc(`assertLinkedTransitionApplied` 바로 위,
    "re-park/첫 turn park/retry-last-turn RUNNING 재claim/turn 경계 가드는
    `updateExecutionStatus`(짝 전이 choke point, FOR UPDATE)의 반환값을... 그대로
    전달한다")이 명시하듯, 196·197행의 가드도 198행(retry-turn)과 **동일하게**
    `updateExecutionStatus`의 반환값에 의존한다. `ai-turn-orchestrator.service.spec.ts`도
    driver 경계에서 `updateExecutionStatus`를 `mockResolvedValue(true)`로 고정한 뒤
    개별 테스트에서 `mockResolvedValueOnce(false)`로 재무장하는 동일한 boundary-mock
    패턴을 쓴다 — retry-turn 과 같은 계층 구조. `updateExecutionStatus` 자신의 버그는
    이번 PR에서 근원적으로 고쳐졌고 `execution-engine.service.spec.ts`에 새 테스트가
    추가돼 그 자체는 이제 올바르다. 다만 **과거에 "mutation 검증 완료"·"6/6 검증"으로
    닫혔던 라운드들이 실제로는 같은 mock 경계 안쪽만 봤을 가능성**은 retry-turn 과
    다르지 않은데, 두 소급 배너 중 어느 쪽도 196·197행을 명시적으로 지목하지 않는다(참고로
    `ie-resume-turn-boundary-cancel.md`는 자기 문서의 6~8차 라운드 전체를 재검증 대상으로
    포괄적으로 지정했으므로 실질적으로는 커버될 여지가 있으나, spec 표 자체의 "mutation 6/6"
    각주와 명시적으로 연결돼 있지는 않다).
  - 제안: planner 위임 시 node-cancellation.md §2.4 표의 195~198행 전체(또는 최소 196·197행)를
    "mock 경계 안쪽 검증"으로 각주하거나, 재검증 완료 후 일괄 갱신하는 편이 197행만 빠뜨리는
    사고를 막는다.

## 요약

target(코드 diff)이 실제로 바꾼 로직 — admission gate 조건부 UPDATE, KB CAS 락, OAuth
one-shot DELETE — 은 모두 spec Rationale 이 이미 선언한 원자성 설계(`spec/5-system/4-execution-engine.md`
"동시성 cap admission gate" · `spec/data-flow/2-auth.md` "OAuth state 의 one-shot DELETE" 등)를
재도입·번복하는 것이 아니라, TypeORM 튜플 shape 을 놓쳐 그 설계가 구현에서 사문화돼 있던 버그를
원복하는 수정이다 — 이 부분은 Rationale 연속성 위반이 없다. 다만 이 PR이 스스로 벌인 "소급
정정" 작업의 산출물(plan 배너) 안에서, `retry-turn-terminal-guard.md`가 "spec 각주 갱신이 이미
planner 위임 항목에 등재돼 있다"고 쓴 문장이 실측 결과 거짓으로 확인됐다 — 같은 세션이 이미
"완료/등재 선언이 사실보다 앞선" 패턴을 4회 자인한 직후 나온 사실상 5번째 사례다. 코드 자체의
Rationale 정합성에는 문제가 없으나, spec 문서(`node-cancellation.md`)의 "mutation N/N 검증"
각주를 실제로 정정할 추적 고리가 끊어져 있어 방치하면 stale 한 검증 주장이 spec 에 영구
잔류할 위험이 있다.

## 위험도

MEDIUM
