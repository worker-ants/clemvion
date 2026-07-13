# Resolution — edge §4.1 엣지 분할 ai-review 4회차 (2026-07-13 19:42)

원 위험도 **LOW** (CRITICAL 0 + WARNING 1). disk-write gap(requirement) journal 복구 → requirement=LOW(단, 그 WARNING 은 harness diff-list 가 구현 코드를 누락했다는 review-infra 이슈로 코드 결함 아님 — 직접 파일 대조로 §4.1 line-level 정합·모든 선행 WARNING 해소 재확인).

## Warning

| # | 카테고리 | 발견 | 조치 |
|---|----------|------|------|
| 1 | 아키텍처 | 원자성 보장이 `detectContainerConflict`(거부) ↔ `buildEdgeSplitPlan`(제외) 두 파일의 암묵적 대응(사람이 관리하는 JSDoc forward-pointer)에만 의존 — 컴파일러 미강제 hidden coupling | **반영(SoT 상수화)** — 컨테이너 경계 핸들을 `edge-utils.ts` `CONTAINER_BODY_HANDLE`/`CONTAINER_EMIT_HANDLE` 단일 export 상수로 추출. `isContainerBoundaryEdge`/`CONTAINER_SOURCE·TARGET_HANDLES`/`RESERVED_INPUT_HANDLE_IDS`(edge-utils)와 `detectContainerConflict`/`propagateContainerOnConnect`(editor-store)가 **함께 import** → 핸들 값 커플링이 compile-time 으로 묶임(backend `CONTAINER_LOOPBACK_PORTS` 전례와 동형). behavior-preserving(editor-store container 테스트 전수 통과). JSDoc·spec R-3 갱신. |

## INFO(반영/이월)
- (#3 side_effect) mid-insert 가 `onConnect` 2회 발생 → **spec §4.1 명시**(리스너 추가 시 회귀 예방).
- (#5 documentation) R-3 "노드)덕에" 오탈자 → **정정**("노드) 덕에").
- (#7 side_effect) `buildEdgeSplitPlan(edge, id, null/undefined)` 방어 분기 → **테스트 추가**.
- (#1 testing) "노드 복제"(우클릭) 경로의 동일 phantom-undo(중복 pushUndo)는 §4.1 스코프 밖 → **별도 backlog task(`task_89a0d3a2`)** 로 전환(pushUndo 호출부 전수 감사 + 회귀 테스트).
- (#2 architecture) `withUndoCheckpoint` 상위 헬퍼로 undo 경계 중앙화 → 장기 개선(`task_89a0d3a2` 에 포함).
- (#4 testing) onDrop DOM 배선 통합/e2e → canvas RTL 하네스 부재 기존 합의(이월).
- (#6 documentation) 0-canvas↔2-edge 상호참조 각주 → consistency INFO 로 이미 등재(비차단 이월).
- (requirement) harness diff-list 누락 = review-infra 이슈, 코드 무관.

## 검증
- tsc `--noEmit` clean · edge-utils+editor-store **158 passed**(null 방어 추가) · eslint 0 errors(잔여 1 warning=기존 aria) · e2e 44 suites/253(재검증, editor-store container 로직 변경) · fresh `/ai-review` 5회차로 수렴 확인.
