# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 없음. architecture 가 원자성 보장의 hidden-coupling(SoT 부재) WARNING 1건을 제기했고, 나머지는 전부 INFO(대부분 "확인됨/조치 불요"). 단, `requirement` reviewer 는 status=success 로 보고됐으나 **출력 파일이 디스크에 존재하지 않아**(disk-write gap) 내용을 반영하지 못했다 — 재시도 필요.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 아키텍처 | 엣지 분할 원자성 보장이 `detectContainerConflict`(editor-store.ts) 거부 분기와 `buildEdgeSplitPlan`(edge-utils.ts) 제외 규칙, 두 파일에 흩어진 암묵적 대응 관계(사람이 관리하는 JSDoc 상호 forward-pointer)에만 의존 — 컴파일러/런타임이 강제하지 않는 hidden coupling. 한쪽만 변경되면 "removeEdge 후 onConnect 반쪽 실패"로 그래프가 조용히 손상될 수 있음 | `spec/3-workflow-editor/2-edge.md` §4.1(~1109행), Rationale R-3(~1209행); `codebase/frontend/src/lib/stores/editor-store.ts` `detectContainerConflict`, `codebase/frontend/src/lib/utils/edge-utils.ts` `buildEdgeSplitPlan` | "분할 제외/거부 대상 핸들 집합"(`{source:'body', target:'emit'}`)을 `edge-utils.ts` 에 단일 명명 상수로 추출해 양쪽이 import 하도록 통합 (참고: backend `shadow-workflow.ts` 의 `CONTAINER_LOOPBACK_PORTS` 와 유사 패턴 전례 있음) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 | 동일 phantom-undo 결함 클래스("호출부 `pushUndo()` + `addNode` 내부 `pushUndo()` 중복")가 "노드 복제"(우클릭 컨텍스트 메뉴) 경로에 여전히 잔존 — 2회 연속 리뷰(19_18_01, 이번 라운드)에서 재확인됐으나 아직 backlog 미전환 | `workflow-canvas.tsx` `handleNodeMenuAction` `case "duplicate"`(~449-473행), `editor-store.ts:836` `addNode` | 별도 plan/이슈 등록: (1) 중복 `pushUndo()` 제거 (2) "우클릭 복제→undo 1회→완전복원" 회귀 테스트 추가. `grep -n "pushUndo()" workflow-canvas.tsx` 전수 감사 권고 |
| 2 | 아키텍처 | undo 체크포인트 중복 push 버그가 이번 changeset(§1.2, §4.1) 내에서도 재발했던 사실은, "계층마다 개별적으로 pushUndo 호출"하는 설계가 구조적으로 재발하기 쉬운 패턴임을 시사 | Rationale R-3 "undo 단일 체크포인트 실측 보강(ai-review 3회차)" | `withUndoCheckpoint(fn)` 류 상위 헬퍼로 undo 경계를 중앙화해 이 버그 클래스를 구조적으로 예방 (차단 사유 아님, 장기 개선) |
| 3 | 사이드이펙트 | 단일 드롭 제스처당 `onConnect` 콜백이 2회 순차 호출됨(기존 구현) — `onConnect` 에 훅을 건 다른 소비자가 "제스처당 1회"를 전제하면 이중 호출로 의도치 않은 재실행 가능 | spec §4.1 "연결·불변식(원자성)", R-3 | §4.1 에 "mid-insert 는 onConnect 를 2회 발생시킨다"는 문장을 명시해 향후 리스너 추가 시 회귀 예방 |
| 4 | 테스트 | `onDrop`(workflow-canvas.tsx) 자체의 DOM 배선(hit-test→split-plan→store-mutation) 통합/e2e 테스트 부재 — canvas RTL 하네스 부재로 기존에 이미 합의·이월된 부채, 이번 changeset 이 새로 만든 갭 아님 | `workflow-canvas.tsx:709-746` `onDrop` | canvas RTL 하네스 마련 시 함께 커버 (RESOLUTION.md 18_59_13 #2 기존 합의 유지) |
| 5 | 문서화 | Rationale R-3 본문 사소한 띄어쓰기 오류: "노드)덕에" → "노드) 덕에" | `spec/3-workflow-editor/2-edge.md` Rationale R-3 | 정정(차단 사유 아님) |
| 6 | 문서화 | consistency-check 가 이미 non-blocking INFO 로 분류한 상호참조 각주 2건(0-canvas §3.3 ↔ 2-edge §4, 컨테이너 포트 "보라색" 표현의 emit-핸들 vs body-기원 엣지 구분)이 아직 미반영 | `spec/3-workflow-editor/0-canvas.md` §3.3, `1-node-common.md`/`2-edge.md` §3.1 | 여유 있을 때 각주 추가(이미 SUMMARY 권장 조치사항에 등재, 중복 트래킹 불필요) |
| 7 | 사이드이펙트 | `buildEdgeSplitPlan(edge, newNodeId, null/undefined)` 최상위 방어 분기를 직접 단언하는 단위 테스트 부재 — 실사용 경로(`onDrop`→`buildAndAddNode` 조기반환)에서는 도달 불가해 리스크 낮음 | `edge-utils.ts` `buildEdgeSplitPlan` | 조치 불요(비차단), 여유 있을 때 방어적 회귀 가드 1건 추가 권장 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| architecture | LOW | 원자성 보장의 hidden-coupling(SoT 부재) WARNING 1건, undo 재발 패턴 INFO, 레이어 분리(R-2) 재사용은 양호 확인 |
| requirement | **재시도 필요** | status=success 로 보고됐으나 출력 파일(`requirement.md`)이 디스크에 부재 — disk-write gap. 내용 미반영 |
| side_effect | NONE | 이번 라운드 실행 코드 diff 없음(리뷰 산출물·spec 문서만). onConnect 2회 호출·frontmatter pending_plans 변경·`_retry_state.json` 절대경로 전부 의도된 동작으로 확인 |
| testing | NONE | §4.1 이 주장하는 테스트(undo 통합, 순수함수 단위) 소스 대조로 정확함 검증. 유일한 실질 이슈는 "노드 복제" 경로의 잔존 phantom-undo(위 INFO #1) |
| documentation | LOW | 오탈자 1건 + 기존 non-blocking 각주 미반영 재확인. spec↔코드 정합, JSDoc 상호 forward-pointer, CHANGELOG, 사용자가이드 MDX(ko/en), plan 라이프사이클 전부 정합 확인 |

## 발견 없는 에이전트

해당 없음 — 실행된 5개 에이전트(architecture, requirement, side_effect, testing, documentation) 중 4개(architecture/side_effect/testing/documentation)는 모두 최소 INFO 이상을 보고했고, requirement 는 출력 파일 부재로 재시도 필요.

## 권장 조치사항

1. **requirement reviewer 재실행** — 출력 파일(`requirement.md`)이 disk-write gap 으로 부재. 재시도 후 SUMMARY 갱신 필요.
2. **[WARNING] 원자성 보장 SoT 확립** — `detectContainerConflict` 와 `buildEdgeSplitPlan` 이 공유하는 "분할 제외 핸들 집합"을 단일 명명 상수로 추출해 hidden coupling 제거.
3. **"노드 복제"(우클릭) duplicate-pushUndo 결함을 별도 backlog 로 전환** — 2회 연속 리뷰에서 재확인됐음에도 미추적 상태. `pushUndo()` 호출부 전수 감사 + 회귀 테스트 추가.
4. onDrop DOM 배선 통합/e2e 커버리지는 canvas RTL 하네스 마련 시 함께 처리(기존 합의 유지, 이번 changeset 범위 아님).
5. §4.1 에 "mid-insert 는 onConnect 를 2회 발생시킨다" 문장 명시(향후 리스너 회귀 예방).
6. R-3 오탈자 정정 및 0-canvas/2-edge 상호참조 각주 추가(여유 있을 때, 비차단).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `architecture, requirement, side_effect, testing, documentation` (5명)
  - **제외**: 표 (9명)
  - **강제 포함(router_safety)**: `architecture, documentation, requirement, side_effect, testing` (5명 전원)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | security | 라우터 선별에서 비관련 영역으로 판단, 제외 |
  | performance | 라우터 선별에서 비관련 영역으로 판단, 제외 |
  | scope | 라우터 선별에서 비관련 영역으로 판단, 제외 |
  | maintainability | 라우터 선별에서 비관련 영역으로 판단, 제외 |
  | dependency | 라우터 선별에서 비관련 영역으로 판단, 제외 |
  | database | 라우터 선별에서 비관련 영역으로 판단, 제외 |
  | concurrency | 라우터 선별에서 비관련 영역으로 판단, 제외 |
  | api_contract | 라우터 선별에서 비관련 영역으로 판단, 제외 |
  | user_guide_sync | 라우터 선별에서 비관련 영역으로 판단, 제외 |