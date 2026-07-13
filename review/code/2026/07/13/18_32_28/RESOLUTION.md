# Resolution — edge §4.1 엣지 분할 ai-review 1회차 (2026-07-13 18:32)

원 위험도 **CRITICAL** (CRITICAL 1 + WARNING 6). disk-write gap(requirement) journal 복구 → requirement=NONE(단, atomicity "무-실패" 주장이 컨테이너 새 노드 케이스를 놓쳐 side_effect/testing 이 CRITICAL 로 정확히 포착). performance·concurrency 는 router skip(문서/로직 성격).

## Critical

| # | 발견 | 조치 |
|---|------|------|
| 1 | 새 노드가 컨테이너(Loop/ForEach/Map)면 `firstOutputHandleId`→`body` 선택 → `newToTarget.sourceHandle==='body'` → `propagateContainerOnConnect` Rule 1 로 target 이 새 컨테이너 본문 자식으로 조용히 재편입(또는 conflict 거부로 반쪽 그래프). R-3 이 원본 엣지 경계만 걸렀고 "삽입 노드 자신이 컨테이너" 를 놓침 | **반영** — `buildEdgeSplitPlan` 에 `if (definition?.isContainer) return null` 가드 추가(컨테이너 새 노드는 분할 없이 노드만 추가). 회귀 테스트(컨테이너 outputs `[body,done]`+isContainer→null) 추가. spec §4.1 "컨테이너 새 노드 제외" 불릿 + R-3 후속 보강 기록. |

## Warning

| # | 카테고리 | 발견 | 조치 |
|---|----------|------|------|
| 2 | 아키텍처/부작용 | removeEdge+onConnect×2 비원자적 — onConnect best-effort 실패 시 반쪽 그래프 | **구성적 해소** — CRITICAL #1 수정(컨테이너 새 노드 제외) + 원본 body/emit 엣지 제외로 두 Connection 이 `detectContainerConflict` 의 유일 거부 분기(source `body`/target `emit`)에 걸릴 경로가 완전 소멸, 자기연결·중복도 새 노드라 불가 → onConnect 2회 **항상 성공**. 별도 store 원자 액션 불요. buildEdgeSplitPlan JSDoc·onDrop 주석·spec §4.1 "연결·불변식(원자성)" 에 by-construction 보장 명시. |
| 3 | 유지보수성 | `isContainerBoundaryEdge` 가 핸들명만 봐 Parallel Branch 의 데이터 `done` 을 컨테이너 경계로 오판→그 엣지 분할이 조용히 막힘 | **반영** — `CONTAINER_SOURCE_HANDLES` 를 `{body,done}`→`{body}` 로 축소(`done` 제거). `body`·`emit` 은 컨테이너 전용 핸들이라 핸들명만으로 정밀. 컨테이너 `done` 분할은 body 재편입 미유발이라 안전. 테스트(`done`→false) + 주석/spec 명시. |
| 4 | 테스트 | `onDrop` 통합 배선(hit-test→plan→removeEdge/onConnect) 미실행 테스트 | **부분/이월** — canvas RTL 하네스 부재는 §1.2/§1.3/§3.2 기존 갭. CRITICAL #1 이 실제 발생하는 지점인 `buildEdgeSplitPlan`(순수) 레벨에 컨테이너 새 노드 회귀 테스트 추가로 그 버그는 커버. 전체 onDrop glue e2e 는 하네스 마련 시 이월. |
| 5 | 테스트/문서 | 다중 출력 노드(If/Else) 삽입 시 `outputs[0]` 만 연결하는 동작 미검증·미명세 | **반영** — `buildEdgeSplitPlan` 다중 출력(`[true,false]`)→`newToTarget.sourceHandle==='true'` 테스트 + spec §4.1 "다중 출력 새 노드는 첫 출력만 연결, 나머지 수동" 명시. |
| 6 | 문서/유저가이드 | connecting-nodes·canvas-basics(ko/en) 에 §4.1 서술 없음 | **반영** — connecting-nodes.{mdx,en.mdx} "엣지 위에 노드 놓아 중간에 끼우기" 절 신설(제외 경우·다중출력 Callout) + canvas-basics.{mdx,en.mdx} 팔레트 드래그 문장에 한 줄 + 교차링크. |
| 7 | 문서 | spec §4.1 "(§4.2 일반 팔레트 드롭)" 가 자기 문서에 없는 §4.2 를 참조하는 것처럼 오독 | **반영** — "(`0-canvas.md` 의 일반 팔레트 드롭과 동일 fallback)" 로 정정. |

## INFO(반영/이월)
- (#12) `findEdgeIdAtPoint` data-id 부재 케이스 → **반영**(테스트 추가). 
- (#8/#10) DOM 클래스 결합·RF 버전 취약성 → 이월(e2e 스모크 후보). (#9) onDrop 인라인 오케스트레이션 누적 → 다음 엣지 기능 시 훅 추출 이월. (#11) `SplitConnection`↔`Connection` 중복 → 후속 정리. (#13) null 조합 케이스·(#15) 스코프 정상 → 조치 불요.

## 검증
- tsc `--noEmit` clean · edge-utils+editor-store **154 passed** · eslint 0 errors(잔여 1 warning=`workflow-canvas.tsx` 기존 aria, 무관) · e2e 44 suites/253(재실행) · fresh `/ai-review` 2회차로 수렴 확인.
