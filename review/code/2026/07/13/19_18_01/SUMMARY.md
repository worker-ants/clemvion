# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — CRITICAL 없음. 확인된 6개 reviewer 에서 WARNING 3건(undo 스택 phantom 스냅샷 실측 재현, onDrop 비원자적 오케스트레이션, 원자성 전제의 문서 커플링 부재). 여기에 더해 **architecture/requirement/user_guide_sync 3개 reviewer 는 manifest 상 `success` 로 기록됐으나 산출 파일이 디스크에 존재하지 않아(disk-write gap) 내용을 확인할 수 없음** — 이 중 architecture·requirement 는 router 가 강제 포함(`agents_forced`)한 필수 관점이라 재확인 전까지 이번 리뷰를 "완료"로 간주해서는 안 됨.

## Critical 발견사항

없음 (확인된 6개 reviewer 기준).

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | "Ctrl+Z 1회로 삽입 전체 취소"라는 이번 PR 의 핵심 UX 계약이 실제 `undo()` 호출로 검증된 적이 없음. 직접 재현 결과 `buildAndAddNode` 의 명시적 `pushUndo()` 와 `addNode` 내부의 `pushUndo()` 가 중복 호출되어 undo 스택에 동일 스냅샷이 2개 쌓이는 것을 확인 — 삽입 1회가 undo 슬롯 2칸을 소비해, 삽입 직후 Ctrl+Z 를 두 번 누르면 두 번째가 겉보기엔 no-op 이 되고 세 번째에야 그 이전 편집이 취소됨 | `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx:620,627` (명시적 `pushUndo()` → `addNode` 호출), `codebase/frontend/src/lib/stores/editor-store.ts:830-831` (`addNode` 내부 자체 `pushUndo()`) | `editor-store.test.ts` "엣지 분할 store 시퀀스" describe 에 `pushUndo→addNode→removeEdge(skipUndo)→onConnect(skipUndo)×2→undo()` 왕복 후 "undoStack 정확히 0" 을 고정하는 통합 테스트 추가. 근본 원인(중복 `pushUndo()`, "노드 복제"에도 동일 패턴 존재)은 이 diff 범위 밖이나 `addNode` 호출부의 명시적 `pushUndo()` 제거를 별도 이슈로 고려 |
| 2 | side_effect | `onDrop` 이 "엣지 제거 + 신규 엣지 2개 연결"을 store 의 독립 public 액션 3회 순차 호출(비원자적)로 오케스트레이션. 현재는 `buildEdgeSplitPlan` 이 컨테이너 경계·컨테이너 새 노드를 사전 배제해 "항상 성공"이 by-construction 으로 성립하지만, 이는 store 트랜잭션이 아니라 호출 순서가 우연히 항상 성공한다는 암묵적 계약. 향후 `evaluateConnection` 규칙이 확장돼 이 계약이 깨지면 원본 엣지는 이미 제거된 채 두 번째 `onConnect` 가 조용히 mutation 을 건너뛰고 맥락에 안 맞는 `toast.error` 만 표시되며, 실패를 감지·기록하는 방어 코드가 없어 부분 그래프가 조용히 지속될 수 있음 | `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx:736-740`, `codebase/frontend/src/lib/stores/editor-store.ts:748-756` | 즉시 조치 불요(현재 스코프 안전, RESOLUTION 에 이미 수용된 사안과 동일 지점). 최소한 두 번째 `onConnect` 실패 시 개발 모드 `console.error` assertion 을 남기는 fail-loud 가드를 향후 고려 |
| 3 | documentation | `buildEdgeSplitPlan` 의 "원자성(by construction)" 보장은 `detectContainerConflict` 의 거부 분기 목록(source `body`/target `emit` 두 가지)이 고정돼 있다는 암묵적 전제에 의존하는데, 이 "함께 갱신해야 한다"는 커플링이 `detectContainerConflict` 쪽 JSDoc·spec Rationale 어디에도 forward-pointer 로 기록돼 있지 않고 리뷰 산출물(`review/**`)에만 적혀 있음. 향후 `detectContainerConflict` 에 새 거부 분기가 추가되면 `edge-utils.ts` 를 열어보지 않는 한 이 불변식이 조용히 깨질 수 있음 | `codebase/frontend/src/lib/stores/editor-store.ts` `detectContainerConflict`(~240-280행) ↔ `codebase/frontend/src/lib/utils/edge-utils.ts` `buildEdgeSplitPlan` JSDoc | `detectContainerConflict` JSDoc 끝에 "새 거부 분기 추가 시 `buildEdgeSplitPlan`(§4.1) 원자성 가정이 깨질 수 있으니 함께 검토" 한 줄 추가 + `spec/3-workflow-editor/2-edge.md` `## Rationale` R-3 말미에도 동일 취지 명시 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | DOM 클래스 기반 hit-test(`findEdgeIdAtPoint`)가 "신뢰할 수 없는 `.react-flow__edge` 요소가 DOM 에 주입되지 않는다"는 same-origin 전제에 의존 (이론상 별도 XSS 성립 후에나 의미 있는 시나리오, 이 기능이 새로 만든 공격 표면 아님) | `codebase/frontend/src/lib/utils/edge-utils.ts` `findEdgeIdAtPoint` | 조치 불요 |
| 2 | maintainability | 2회차에서 지적된 INFO 3건(줄바꿈된 3항 연산자 기본 파라미터 가독성, `SplitConnection` 타입이 `@xyflow/react` `Connection` 과 구조적으로 동일해 재선언, `onDrop` 인라인 오케스트레이션 ~30줄 누적)이 동일 상태로 잔존 — 새 이슈 아님, `task_78c80fec` 로 이월 추적 중 | `edge-utils.ts:323-330, 250, 235-236`, `workflow-canvas.tsx` `onDrop` | 다음 엣지 조작 기능 추가 시 3건 함께 정리 권장 |
| 3 | testing | `onDrop` 의 DOM/배선 통합(hit-test→`buildEdgeSplitPlan`→`removeEdge`/`onConnect` 시퀀스) 자체는 여전히 자동 테스트 미실행 — canvas RTL 하네스 부재로 1·2회차부터 이월된 기존 합의(비차단) | `workflow-canvas.tsx:715-738` | 조치 불요, 향후 canvas RTL 하네스 마련 시 커버 |
| 4 | testing | `buildEdgeSplitPlan(edge, id, null/undefined)` 최상위 방어 분기 직접 테스트 부재 — 실사용 경로에서 도달 불가라는 기존 판단 유효, 우선순위 낮음 | `edge-utils.ts` `buildEdgeSplitPlan` | 조치 불요 |
| 5 | documentation | 2회차 documentation 리뷰 파일 자체의 테스트 개수 검산이 CHANGELOG 실제 합계와 2건 어긋남(신규 store 통합 테스트 2건 누락) — 리뷰 이력 파일이라 실질 영향 없음 | `review/code/2026/07/13/18_59_13/documentation.md` | 조치 불요(참고용) |
| 6 | scope | 47개 변경 파일 전부가 기능(§4.1)과 그 필수 프로세스 산출물(impl-prep consistency-check, ai-review 1·2회차, plan lifecycle 이동)로 정확히 귀속 — over-engineering·무관 파일 수정·스코프 크리프 없음 | `review/**`, `plan/complete/spec-sync-edge-gaps.md`, `spec/3-workflow-editor/2-edge.md` | 조치 불요 |

## 재확인 필요 — Disk-write gap (3건)

아래 3개 reviewer 는 workflow manifest 상 `status=success` 로 보고되었으나, 지정된 `output_file` 이 디스크에 존재하지 않아 **내용을 확인할 수 없었다** (`ls` 로 직접 확인: `architecture.md`/`requirement.md`/`user_guide_sync.md` 부재, `_retry_state.json`/`meta.json` 에도 성공 산출물 없음). 알려진 "sub-agent success 인데 output 파일 부재 → summary 가 조용히 clean 으로 오집계" 결함 패턴과 일치하므로, **"문제 없음"으로 간주하지 않고 재실행/재확인이 필요한 상태로 명시 처리**한다.

| reviewer | 상태 | 비고 |
|----------|------|------|
| architecture | 재시도 필요 (파일 부재) | router 강제 포함(`agents_forced`) 대상 — 1·2회차에서 store 비원자성/훅 추출 관련 WARNING 제기 이력 있음, 이번 라운드 재확인 불가 |
| requirement | 재시도 필요 (파일 부재) | router 강제 포함(`agents_forced`) 대상 — spec §4.1 요구사항 정합 여부 이번 라운드 미확인 |
| user_guide_sync | 재시도 필요 (파일 부재) | router 선별 포함 — mdx 유저가이드 갱신분(§4.1 관련) 정합 여부 이번 라운드 미확인 |

**권고**: 이 3개 reviewer 를 동일 `session_dir`(`19_18_01`)로 재호출해 실제 산출 파일을 확보한 뒤 본 SUMMARY 를 갱신할 것. 그 전까지는 documentation/maintainability/testing/side_effect/security/scope 6개 관점의 결과만으로 부분적 결론임을 감안해야 한다.

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | CRITICAL/WARNING 없음. DOM hit-test same-origin 전제 INFO 1건 |
| scope | NONE | 47개 파일 전부 기능+필수 프로세스 산출물로 귀속, 스코프 이탈 없음 |
| side_effect | LOW | onDrop 3단 비원자적 오케스트레이션 WARNING 1건(by-construction 안전, 향후 대비) |
| maintainability | LOW | 1·2회차 CRITICAL/WARNING 전부 코드 대조로 해소 확인, 잔존 INFO 3건(이월 중) |
| testing | MEDIUM | undo 스택 phantom 스냅샷(이중 pushUndo) 실측 재현 WARNING 1건 |
| documentation | LOW | 원자성 전제의 문서 커플링 부재 WARNING 1건(예방적) |
| architecture | **미확인** | 산출 파일 부재(disk-write gap) — 재시도 필요 |
| requirement | **미확인** | 산출 파일 부재(disk-write gap) — 재시도 필요 |
| user_guide_sync | **미확인** | 산출 파일 부재(disk-write gap) — 재시도 필요 |

## 발견 없는 에이전트

security, scope — CRITICAL/WARNING 없음(INFO 만 존재).

## 권장 조치사항

1. **[최우선]** architecture/requirement/user_guide_sync 3개 reviewer 를 재호출해 disk-write gap 을 해소하고, 특히 architecture(store 비원자성 구조적 대안)·requirement(spec §4.1 정합) 결과를 확보한 뒤 이번 SUMMARY 를 갱신할 것.
2. `editor-store.test.ts` 에 `pushUndo→addNode→removeEdge(skipUndo)→onConnect(skipUndo)×2→undo()` 전체 왕복을 검증해 "undo 이후 undoStack 정확히 0" 을 고정하는 통합 테스트 추가 (testing WARNING #1). 근본 원인인 `buildAndAddNode`/`addNode` 이중 `pushUndo()` 호출 제거는 별도 이슈로 후속 조치 고려.
3. `detectContainerConflict`(editor-store.ts) JSDoc 과 spec `2-edge.md` Rationale R-3 에 "새 거부 분기 추가 시 `buildEdgeSplitPlan` 원자성 가정이 깨질 수 있다" 는 상호 참조 주석 추가 (documentation WARNING #3).
4. (선택, 비차단) `onDrop` 의 두 번째 `onConnect` 실패 시 개발 모드 `console.error` 가드 추가해 "항상 성공" 불변식이 실제로 깨지는 순간을 fail-loud 하게 감지 (side_effect WARNING #2).
5. (선택, 낮은 우선순위) maintainability INFO 3건(기본 파라미터 가독성/`Connection` 타입 재선언/`onDrop` 훅 추출)을 `task_78c80fec` 이월 방침대로 다음 엣지 조작 기능 착수 시 함께 정리.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, user_guide_sync` (9명)
  - **강제 포함(router_safety)**: `architecture, documentation, maintainability, requirement, scope, security, side_effect, testing` (8명 — 소스 코드/spec/문서 변경에 따른 표준 강제 규칙 적용)
  - **제외**: 아래 표 (5명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단(prompt 에 세부 사유 미제공) — 순수 클라이언트 로컬 상태 조작 기능으로 성능 영향 표면 낮음으로 추정 |
  | dependency | 라우터 판단(prompt 에 세부 사유 미제공) — 신규 패키지/버전 변경 없음 |
  | database | 라우터 판단(prompt 에 세부 사유 미제공) — 백엔드/DB 변경 없는 순수 프런트엔드 changeset |
  | concurrency | 라우터 판단(prompt 에 세부 사유 미제공) — 서버측 동시성 표면 없음 |
  | api_contract | 라우터 판단(prompt 에 세부 사유 미제공) — REST/DTO 등 API 계약 변경 없음(전 reviewer 공통 확인 사항과 일치) |