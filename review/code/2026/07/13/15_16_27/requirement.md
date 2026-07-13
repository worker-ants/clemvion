### 발견사항

- **[INFO]** spec `3-workflow-editor/2-edge.md` §3.2 "구현됨" 승격이 실제 HEAD 소스와 line-level 로 일치함(검증 완료)
  - 위치: `spec/3-workflow-editor/2-edge.md` §3.2 표 3행 + "현재 구현" 단락 ↔ `codebase/frontend/src/components/editor/canvas/use-edge-execution-state.ts`, `codebase/frontend/src/lib/utils/edge-utils.ts` (`resolveEdgeExecutionState`, `EdgeExecutionState`, `FLOWING_EDGE_CLASS`/`COMPLETED_EDGE_CLASS`), `codebase/frontend/src/app/globals.css` (`edge-flow`/`edge-complete-flash` keyframes, `#22c55e`), `codebase/frontend/src/components/editor/canvas/custom-edge.tsx`
  - 상세: spec 이 서술하는 3가지 조건을 코드와 직접 대조했다. (1) "inactive 우선" — `resolveEdgeExecutionState` 가 `disabledNodeIds.has(source||target)` 를 최우선 분기로 즉시 반환(`flowing:false, completed:false`), spec 의 "상호배타 우선순위 inactive > flowing/completed" 와 일치. (2) "flowing = 실행 중 + source completed + target running" — 코드 `ctx.executing && sourceStatus==='completed' && targetStatus==='running'` 와 정확히 일치. (3) "completed = 둘 다 completed" — 코드 `sourceStatus==='completed' && targetStatus==='completed'` 와 일치. CSS 클래스명(`edge-flowing`/`edge-completed`)·keyframe 이름(`edge-flow`/`edge-complete-flash`)·색상(`#22c55e`)도 spec 서술과 정확히 일치. `plan/in-progress/spec-sync-edge-gaps.md` §3.2 체크박스(`[x]`)의 서술도 동일 내용으로 3자(spec/plan/code) 정합.
  - 제안: 조치 불요(확인용 기재).

- **[INFO]** testing.md(15_01_46 라운드) 가 지적한 2건의 실 WARNING("드래그 참조 안정성 테스트 부재", "재활성화 토글 테스트 부재")이 이후 커밋(`c6f094ebb`)에서 실질적으로 해소됨을 코드로 재확인
  - 위치: `codebase/frontend/src/components/editor/canvas/__tests__/use-edge-execution-state.test.ts` 신규 2케이스("노드 드래그로 nodes 참조가 바뀌어도... 결과 배열 참조를 유지한다", "비활성 노드를 다시 켜면 edgeInactive 가 해제된다")
  - 상세: 두 신규 테스트를 `use-edge-execution-state.ts` 실제 구현(`disabledKey` → `disabledNodeIds` → outer `useMemo` 의존성 체인)과 대조 검증했다. 첫 테스트는 `nodes` 배열을 새 참조(새 position)로 교체하되 `isDisabled` 집합을 불변으로 유지 — `disabledKey`(정렬 join 문자열) 가 동일해 `disabledNodeIds` memo 가 재계산되지 않고, 그 결과 outer `useMemo` 의 의존성 배열(`[edges, disabledNodeIds, nodeStatusById, executing]`) 이 전부 참조 불변이라 재실행 자체가 스킵되어 이전 렌더 결과와 `toBe` 동일함이 보장된다 — vacuous 테스트가 아니라 실제 메커니즘(disabledKey 안정성)을 정확히 겨냥한다. 두 번째 테스트는 `isDisabled: true→false` 토글로 `disabledKey` 값이 바뀌어(`"a"`→`""`) memo 재계산이 트리거되고, 비활성·실행 상태가 모두 없으면 이른 반환(원본 `edges` 참조)이 일어나는 경로를 정확히 검증한다. 두 케이스 모두 "회귀 가드" 라는 커밋 메시지 주장과 실제 동작이 일치한다.
  - 제안: 조치 불요(확인용 기재).

- **[INFO]** `plan/in-progress/spec-sync-edge-gaps.md` §3.2 체크박스와 실제 구현 상태 일치, §4/§5 는 정직하게 미체크 유지
  - 위치: `plan/in-progress/spec-sync-edge-gaps.md` 26-30행
  - 상세: §3.2 는 `[x]` 로 표시되고 서술이 코드(우선순위·className·keyframe·테스트 개수 9+5+9)와 정확히 일치한다. §4/§5(엣지 호버 데이터 미리보기, 엣지 중간 노드 드롭 삽입)는 여전히 `[ ]` 로 남아 spec 의 "미구현 (Planned)" 표기와 대칭 — 완료 항목을 미완료로, 혹은 그 반대로 오기재하는 사례 없음.
  - 제안: 조치 불요.

- **[INFO]** 이번 라운드에 리뷰 대상으로 노출된 3개 파일(`security.md`/`side_effect.md`/`testing.md`)은 코드가 아니라 직전(15_01_46) ai-review 라운드의 산출물(markdown) 자체이며, 그 안의 발견사항 서술이 당시 HEAD 기준으로 사실관계와 부합함을 별도 검증
  - 위치: `review/code/2026/07/13/15_01_46/{security,side_effect,testing}.md`
  - 상세: `side_effect.md`/`testing.md` 가 인용하는 테스트 케이스 수치("resolveEdgeExecutionState 9케이스", "buildEdgeStyle 5케이스", "renderHook 7케이스")를 `edge-utils.test.ts`/`use-edge-execution-state.test.ts` 실제 `it(` 개수로 직접 카운트해 대조했다 — `edge-utils.test.ts` 의 `resolveEdgeExecutionState`+`buildEdgeStyle` describe 블록 합계 14건(9+5) 일치. `use-edge-execution-state.test.ts` 는 보고서 작성 시점(15_01_46, 7케이스) 대비 HEAD 시점(9케이스)으로 늘었는데, 이는 같은 커밋(`c6f094ebb`)이 testing.md 커밋과 테스트 추가 커밋을 동시에 포함하기 때문이며 `review/.../RESOLUTION.md` 에 그 차이(7→9)가 명시적으로 기록돼 있어 3-파일 세트(보고서+RESOLUTION+실제 테스트) 간 서술 불일치가 아니다.
  - 제안: 조치 불요.

## 요약

이번 diff 는 (1) §3.2 엣지 실행 상태 스타일 기능이 "구현됨" 으로 전환된 spec 본문(`spec/3-workflow-editor/2-edge.md`)과, (2) 그 구현을 3라운드에 걸쳐 검증한 직전 ai-review 산출물(security/side_effect/testing.md) 커밋으로 구성된다. spec 본문의 우선순위 규칙(inactive > flowing/completed)·조건식(source/target 상태 조합)·className/keyframe/색상 표기를 실제 `resolveEdgeExecutionState`/`globals.css`/`custom-edge.tsx` 소스와 line-level 로 대조한 결과 불일치가 발견되지 않았으며, plan 체크박스도 실제 구현 상태와 정확히 대칭이다. testing.md 가 지적한 두 실 WARNING(드래그 참조 안정성·재활성화 토글 테스트 부재)은 이후 커밋에서 정확히 해당 메커니즘을 겨냥한 비-vacuous 테스트로 해소됐음을 코드 레벨에서 재확인했다. 요구사항 충족·spec fidelity 관점에서 CRITICAL/WARNING 사유는 발견되지 않았다.

## 위험도

NONE
