# Cross-Spec 일관성 검토 — `spec/5-system/` (impl-done, 3차 라운드)

## 검토 범위 확인

`git -C <worktree> diff origin/main...HEAD --stat -- spec/` 결과 **0건** — 이번 diff 는
`spec/**` 를 전혀 건드리지 않는다. 실제 변경은:

- `codebase/backend/src/common/utils/update-returning-rows.ts` (신규 헬퍼)
- `codebase/backend/src/modules/{auth,execution-engine,knowledge-base}/**` (7개 소비 지점 +
  최신 커밋 `443dd91a6` 이 추가한 판별 테스트 2건 + `detail` 인자 채움)
- `plan/in-progress/{update-returning-tuple-shape.md(신규), ie-resume-turn-boundary-cancel.md}`
- `review/**` (직전 두 라운드 산출물)

target(`spec/5-system/`) 자체가 무변경이므로 "target 문서가 다른 spec 영역과 충돌하는가"
라는 문자 그대로의 질문은 해당 사항이 없다. 이전 두 라운드(`20_36_36`, `22_45_25`)와 동일하게,
이번 라운드도 **코드 변경이 함의하는 동작 변화가 spec 의 다른 영역과 새로 어긋나는지**를
확인했고, 추가로 **이전 두 라운드가 보지 않은 파생 문서 한 곳(`spec/conventions/
node-cancellation.md` §2.4)** 을 직접 대조했다.

## 발견사항

이전 두 라운드가 확인한 4개 지점(admission gate·KB CAS 락 2건·OAuth state 소비)은 **재확인
결과 동일 결론**이다 — 전부 "코드가 이미 문서화된 spec 문언을 뒤늦게 따라잡는" 방향이라 새
충돌이 아니다 (`spec/5-system/4-execution-engine.md` §4.2/§7.1/§7.5/§8,
`spec/2-navigation/5-knowledge-base.md:149,216,221`, `spec/5-system/3-error-handling.md:196-197`,
`spec/5-system/10-graph-rag.md:524,565`, `spec/5-system/8-embedding-pipeline.md:264`,
`spec/data-flow/2-auth.md:122-128,274-275,388`). 반복 서술은 생략한다.

- **[WARNING] `spec/conventions/node-cancellation.md` §2.4 "retry 재진입 종결 경로 terminal
  가드" 의 "✓ mutation 13/13 검증" 이 이번 수정의 함의를 아직 반영하지 못했다 — 소급 정정
  대상 2건 중 1건만 처리됨**
  - target 위치: `spec/5-system/` 자체 diff 는 없음(파생 확인). 근거는
    `plan/in-progress/update-returning-tuple-shape.md` §"소급 영향"(77~107행) +
    `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:672`
    (`finalizeGuarded` → `this.driver.updateExecutionStatus(execution, target)`,
    `linkedNodeExec` 없이 호출 → **else 분기**, 즉 이번 PR 이 고친 튜플 버그의 대상 코드)
  - 충돌 대상: `spec/conventions/node-cancellation.md:198` (§2.4 status 표,
    "retry 재진입 종결 경로 terminal 가드 | ✓ | ... mutation 13/13 검증") +
    `spec/5-system/4-execution-engine.md:92-93` ("else 분기 guarded UPDATE" 를 이미 동작하는
    보장으로 서술) + `plan/in-progress/retry-turn-terminal-guard.md` (소급 정정 배너 부재) +
    `plan/in-progress/update-returning-tuple-shape.md` 체크리스트 161행
    ("[x] 소급 영향 조사·정정 — `ie-resume-turn-boundary-cancel.md` 배너 + 뮤턴트 오진 정정")
  - 상세: `update-returning-tuple-shape.md` 자신의 §소급 영향(94~98행)은 **동일 튜플 버그
    위에서 "닫혔다" 고 종결한 plan 이 둘**이라고 명시한다 — `ie-resume-turn-boundary-cancel.md`
    (6~8차 라운드)와 `retry-turn-terminal-guard.md`(12+ 라운드, `retry-turn.service.spec.ts:101`
    이 `updateExecutionStatus` 기본 mock 값을 `true` 로 둔다). 결론 문장(105행)도 "**두 plan
    모두에** 소급 정정 배너를 넣고" 라 명시한다. 그런데 실제로 확인하면
    `plan/in-progress/ie-resume-turn-boundary-cancel.md` 상단에는 "⚠ 소급 정정 (2026-08-13)"
    배너가 있지만, `plan/in-progress/retry-turn-terminal-guard.md` 에는 해당 배너나 이번
    버그에 대한 언급이 **전혀 없다**(grep 0건). 그럼에도 `update-returning-tuple-shape.md`
    의 체크리스트는 "소급 영향 조사·정정" 을 완료([x])로 표시하며 `ie-resume-turn-boundary-
    cancel.md` 만 근거로 든다 — 자기 본문이 지목한 두 대상 중 하나가 누락된 채 "조사·정정"
    항목 전체가 완료로 선언된 상태다.
    이것이 spec 로 새는 지점: `node-cancellation.md` §2.4 표는 retry 재진입 종결 경로가 "✓
    mutation 13/13 검증" 이라고 **캐비엇 없이** 서술한다. 그 13개 뮤턴트는
    `finalizeGuarded` 자신의 분기 로직(`driver.updateExecutionStatus` 가 true/false 를 줄 때
    각각 옳게 반응하는가)을 mock 경계에서 검증한 것으로 그 자체는 유효하지만, **실제
    `driver.updateExecutionStatus`(=`ExecutionEngineService.updateExecutionStatus` else 분기)
    가 튜플 버그로 이번 PR 전까지 `false` 를 돌려준 적이 없었다** — 즉 `finalizeGuarded` 의
    "선점 시 skip" 분기는 유닛 mock 상에서만 실행됐을 뿐, 실제 DB 배선을 통해서는 이번 PR 의
    수정 전까지 프로덕션에서 한 번도 타지 않았다. node-cancellation.md 의 "✓" 는 이 경계
    바깥(실제 driver 배선)의 검증 상태까지 함의하도록 읽히는데, 그 부분은 이번 PR 이 처음
    고쳤고 아직 통합 레벨 재검증이 없다(`update-returning-tuple-shape.md` 168행 부근이
    "그 분기를 타는 retry-turn 경로가 실제로 있는지 재검증해야 한다" 고 스스로 인정).
  - 제안: (a) `retry-turn-terminal-guard.md` 에도 `ie-resume-turn-boundary-cancel.md` 와
    동형의 소급 정정 배너를 추가해 "12+ 라운드의 mutation 13/13 검증은 `finalizeGuarded` 의
    mock 경계 안쪽만 커버하며, 실제 driver 배선은 이번 튜플 버그 수정으로 처음 정상화됐다.
    `plan/complete/` 이동 전 재검증할 것" 을 명시. (b) `update-returning-tuple-shape.md`
    체크리스트 161행을 "`ie-resume-turn-boundary-cancel.md` 배너만 완료, `retry-turn-
    terminal-guard.md` 는 미착수" 로 정정하거나 체크 해제. (c) planner 턴에서
    `node-cancellation.md:198` 의 "✓ mutation 13/13 검증" 옆에 각주로 "driver 배선(실제
    UPDATE…RETURNING shape)은 `update-returning-tuple-shape.md` 수정으로 2026-08-13
    확립, 통합 레벨 재검증 진행 중" 을 붙이는 것을 고려(developer 는 `spec/` 쓰기 권한 없음
    — 이 항목은 기존 "[planner 위임]" 각주 4곳 목록에 다섯 번째로 추가할 후보).

- **[INFO] 이력 기록·규약 승격 — 이전 라운드 권고 carry-forward, 신규 발견 없음**
  - 상세: `update-returning-tuple-shape.md` §"[planner 위임]" 이 이미 4개 spec 문서
    (execution-engine §1.1, embedding-pipeline §7.3, graph-rag 동시 호출 표, data-flow/2-auth
    OAuth state) 에 대한 Rationale 각주 추가를 planner 턴으로 위임해 뒀고, raw
    UPDATE/DELETE RETURNING 소비 규약화 여부도 동일하게 위임돼 있다. 위 WARNING 의 (c) 를
    다섯 번째 각주 대상으로 병합하는 것을 제외하면 이번 라운드에서 추가할 새 사항 없음.
    `spec_impact: none` 판단(이 PR 이 실제로 바꾸는 spec 파일 0건) 은 여전히 타당하다 —
    위 WARNING 은 "이 PR 이 spec 을 틀리게 바꿨다" 가 아니라 "이 PR 이 고친 실제 버그의
    파급이 인접 plan/spec 서술에 아직 완전히 반영되지 않았다" 는 지적이다.

## 요약

이번 라운드도 `spec/5-system/` 자체는 무변경이며, 코드 수정 4곳(admission gate·OAuth state
소비·KB CAS 락 2건)은 이미 존재하던 spec 문언과 코드를 재정합시키는 방향이라 새로운 데이터
모델·API 계약·요구사항 ID·RBAC·계층 책임 충돌은 없다. 다만 이번에 `spec/conventions/
node-cancellation.md` §2.4 의 "retry 재진입 종결 경로 terminal 가드 — ✓ mutation 13/13
검증" 서술을 직접 대조한 결과, 그 검증이 실제로 이번 PR 이 고친 driver 배선(else 분기
`updateExecutionStatus`)의 정상화를 전제하지 않은 mock 경계 안쪽 검증이었고, 같은 PR 이 자신의
plan 문서(`update-returning-tuple-shape.md`)에서 스스로 지목한 "두 plan 모두에 소급 정정
배너" 의무를 절반만 이행했다는 것을 확인했다. 기능적으로는 이번 fix 로 실제 보호가 처음
정상 작동하게 됐다고 보이므로 런타임 위험은 아니지만, "검증 완료" 선언의 범위가 실제 검증
범위보다 넓게 읽히는 상태(spec + 2 개 plan 문서에 걸친 claim-vs-evidence 불일치)라 다음
라운드/planner 턴에서 명시적으로 닫아야 한다.

## 위험도

LOW
