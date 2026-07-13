# 요구사항(Requirement) Review — §3.2 엣지 실행 상태 스타일 (3회차 fresh review)

대상: `CHANGELOG.md`, `globals.css`, `custom-edge.tsx`, `use-edge-execution-state.ts`(+test),
`workflow-canvas.tsx`, `edge-utils.ts`(+test), mdx 사용자 문서(ko/en) 2건×2페이지,
`plan/in-progress/spec-sync-edge-gaps.md`, `spec/3-workflow-editor/2-edge.md`,
그리고 `review/code/2026/07/13/{14_20_12,14_42_20}/*`(직전 2회 ai-review 세션 산출물, 이번에
커밋되어 diff 에 포함됨).

본 리뷰는 직전 2회 ai-review(`14_20_12` MEDIUM → `14_42_20` LOW → 해소)가 실제로 코드에
반영됐는지 독립적으로 재검증했다(코드 Read, `git log`, `vitest run` 실제 실행, `tsc --noEmit`
실제 실행, spec 본문 대조).

## 발견사항

- **[INFO]** spec 본문(§3.2)과 구현이 line-level 로 일치 확인
  - 위치: `spec/3-workflow-editor/2-edge.md` §3.2 표 + "현재 구현" 노트 vs `codebase/frontend/src/lib/utils/edge-utils.ts`(`resolveEdgeExecutionState`, `FLOWING_EDGE_CLASS='edge-flowing'`, `COMPLETED_EDGE_CLASS='edge-completed'`), `use-edge-execution-state.ts`, `custom-edge.tsx`(`buildEdgeStyle`)
  - 상세: 우선순위(`inactive > flowing/completed`), 트리거 조건(`status==='running' && source==='completed' && target==='running'` → flowing; `source==='completed' && target==='completed'` → completed, `executing` 무관), 필드명(`edge.className`, `edge.data.edgeInactive`), 스타일 값(opacity 0.4 + `stroke-dasharray:"6 4"`, `#22c55e` flash)이 spec 서술과 정확히 대응한다. 3개 파일 모두 독립적으로 Read 해 대조했고 불일치 없음.
  - 제안: 없음(확인 완료).

- **[INFO]** 실제 테스트 실행·타입체크로 "테스트 80개 통과" 주장 검증
  - 위치: `codebase/frontend/src/lib/utils/__tests__/edge-utils.test.ts`, `codebase/frontend/src/components/editor/canvas/__tests__/use-edge-execution-state.test.ts`
  - 상세: `npx vitest run` 을 두 파일에 대해 직접 실행 → **80/80 통과**(edge-utils 73 + hook 7, CHANGELOG/plan 이 주장하는 `resolveEdgeExecutionState` 9 + `buildEdgeStyle` 5 + hook 7 과 일치). `npx tsc --noEmit -p tsconfig.json` 도 0 진단으로 clean. 회귀 없음.
  - 제안: 없음(확인 완료).

- **[INFO]** 직전 라운드에서 지적된 성능 결함(전 엣지 재생성)이 실제로 해소됐음을 코드 레벨에서 재확인
  - 위치: `use-edge-execution-state.ts:32-40`(`disabledKey` = disabled id 정렬 join, `nodes` 참조가 아니라 값에 의존), `:60-84`(per-edge bail-out: `className === edge.className && state.inactive === prevInactive` 이면 원본 참조 반환)
  - 상세: `workflow-canvas.tsx` 에서 `edges`/`nodes` 는 raw store 값(`useEditorStore`)이고, `executionEdges`/`enhancedEdges` 는 로컬 파생값으로 store 에 다시 쓰이지 않음(피드백 루프 없음) — 확인함. 따라서 bail-out 비교 대상(`edge.className`)이 이 훅 자신이 이전에 부여한 값과만 비교되어 안전하다.
  - 제안: 없음(확인 완료).

- **[INFO]** 잔존 이월 항목(직전 2회 리뷰에서 이미 판단·이월된 것과 동일, 새 문제 아님)
  - 위치: `edge-utils.ts` `resolveEdgeExecutionState` ctx 의 `nodeStatusById: ReadonlyMap<string, string>` (store 실제 타입 `NodeExecutionStatus` 대신 `string` 으로 widening)
  - 상세: 오타(`"compelted"` 등)가 있어도 컴파일 타임에 잡히지 않는 잠재적 사각지대이나, 두 차례 리뷰에서 "store 의존 회피 트레이드오프로 유지"로 이미 판단 완료된 항목이고 이번 diff 도 이 지점을 변경하지 않았다. 기능 결함 아님.
  - 제안: 없음(기존 결정 유지, 재차 참고로만 기록).

- **[INFO]** `flowing` 판정은 `status==='running'` 에만 게이트 — `waiting_for_input` 중인 다른 병렬 분기는 spec 침묵 영역
  - 위치: `use-edge-execution-state.ts:27`(`executing = s.status === 'running'`) vs `execution-store.ts`(`ExecutionStatus = 'idle'|'running'|'completed'|'failed'|'waiting_for_input'`)
  - 상세: 어떤 노드가 폼 입력을 기다리는 동안(`status:'waiting_for_input'`) 이론상 무관한 다른 분기가 source-completed/target-running 상태라도 `executing` 이 false 라 flowing 이 표시되지 않는다. spec §3.2 본문도 "실행 중(`status==='running'`)"으로만 정의해 이 케이스를 다루지 않으므로 구현이 spec 을 정확히 따른 것 — 판단이 모호한 회색지대(디자인 결정 여부는 spec 밖)라 SPEC-DRIFT 도 아니고 코드 결함도 아니다.
  - 제안: 조치 불요. 병렬 분기 중 waiting_for_input 이 실제로 발생 가능한지·발생 시 UX 가 의도대로인지는 별도 확인 과제로만 참고.

## 요약

§3.2(엣지 실행 상태 스타일) 구현은 순수 판정 함수(`resolveEdgeExecutionState`) → 상태 어댑터 훅(`useEdgeExecutionState`) → 프레젠테이션(`custom-edge.tsx`/`globals.css`)의 3계층으로 정확히 구현돼 있으며, spec 본문(`spec/3-workflow-editor/2-edge.md` §3.2)과 함수 시그니처·필드명·className·우선순위·색상값까지 line-level 로 일치함을 직접 Read 로 재검증했다. 직전 2회 ai-review(MEDIUM→LOW)에서 지적된 성능(전 엣지 재생성)·테스트 부재·주석-구현 불일치·CSS 접두사 불일치·국문 어휘 오류가 모두 실제 코드에 반영돼 있음을 코드/CSS/문서 대조로 확인했고, `vitest run`(80/80 통과) 과 `tsc --noEmit`(0 진단)을 직접 실행해 회귀가 없음을 검증했다. TODO/FIXME/HACK/XXX 류의 미완성 표식은 없고, 모든 분기(`resolveEdgeExecutionState`)가 완전한 boolean 조합을 반환해 undefined 누락도 없다. 이번 라운드에서 새로 발견된 CRITICAL/WARNING 은 없으며, 남은 항목은 전부 이전 라운드에서 이미 판단·이월된 것과 동일한 INFO(타입 widening, spec 침묵 영역)뿐이다. `review/code/2026/07/13/{14_20_12,14_42_20}/*` 리뷰 산출물이 이번 diff 에 커밋된 것은 이 저장소의 기존 관례(리뷰 아티팩트도 커밋)와 일치하며 기능 요구사항과 무관하다.

## 위험도
NONE
