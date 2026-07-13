# Resolution — edge §4.1 엣지 분할 ai-review 3회차 (2026-07-13 19:18)

원 위험도 **MEDIUM** (CRITICAL 0 + WARNING 3). disk-write gap(architecture/requirement/user_guide_sync) journal 복구 → architecture=LOW(비원자성=2회차와 동일 구조적 관심), requirement=NONE(spec §4.1 정합 재확인), user_guide_sync=NONE. 숨은 CRITICAL 없음.

## Warning

| # | 카테고리 | 발견 | 조치 |
|---|----------|------|------|
| 1 | testing | 삽입 1회가 undo 스냅샷 2개를 소비(phantom) — `buildAndAddNode` 의 명시적 `pushUndo` + 내부 `addNode` 의 `pushUndo` 이중 호출. "Ctrl+Z 1회 완전 취소" 는 성립하나 그 뒤 phantom no-op 슬롯이 남음(§1.2 도 공유하던 잠재 결함) | **반영(근본 수정)** — `buildAndAddNode` 의 중복 `pushUndo` 제거 → `addNode`(store) 의 pushUndo 하나만 단일 체크포인트. `editor-store.test.ts` 에 "삽입 후 undo 1회 → undoStack 정확히 0 + 노드/엣지 완전 복원" 통합 테스트 추가로 lock. 팔레트 추가·§1.2 자동연결도 함께 정상화(단일 스냅샷). |
| 2 | side_effect/architecture | `removeEdge`→`onConnect`×2 비원자적(3단 독립 mutation) — by-construction 안전하나 향후 `evaluateConnection` 확장 시 반쪽 그래프 잠재 | **문서화 유지 + lock** — CRITICAL(1회차) 수정 + 원본 body/emit 제외로 두 onConnect 가 거부 분기에 걸릴 수 없어 안전. plain 분할 원자성(최종 엣지 2개)을 store 통합 테스트가 assertion 으로 고정. 개발모드 console.error fail-loud 가드는 by-construction 안전 + 테스트 lock 으로 현시점 불요(reviewer도 "선택")이라 이월. |
| 3 | documentation | `buildEdgeSplitPlan` 원자성 전제(거부 분기 = body/emit 뿐)의 커플링이 `detectContainerConflict` 쪽·spec 에 forward-pointer 로 없음 | **반영** — `detectContainerConflict` JSDoc + spec §Rationale R-3 에 "새 거부 분기 추가 시 `buildEdgeSplitPlan` 제외 규칙 동반 검토" 상호 forward-pointer 기록. |

## INFO(반영/이월)
- (testing #3) onDrop DOM/배선 통합 자동 테스트 부재 → canvas RTL 하네스 부재 기존 합의(비차단). 배선 회귀는 store 시퀀스 통합 3건으로 최대한 커버.
- (maint #2) 기본 파라미터 가독성·`SplitConnection`↔`Connection` 중복·onDrop 오케스트레이션 누적 → `task_78c80fec`(훅 추출) 이월.
- (security #1) DOM hit-test same-origin 전제·(testing #4) null 방어 분기·(scope #6) 스코프 정상·(doc #5 리뷰이력 개수 검산) → 조치 불요.

## 검증
- tsc `--noEmit` clean · edge-utils+editor-store **157 passed**(undo 라운드트립 추가) · eslint 0 errors(잔여 1 warning=기존 aria) · e2e 44 suites/253(재검증, buildAndAddNode 공유 변경) · fresh `/ai-review` 4회차로 수렴 확인.
