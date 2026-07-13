# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — CRITICAL 은 없으며, 코드 변경(직전 ai-review 11_04_21 세션의 HIGH 지적사항 반영) 자체는 정확하고 비례적으로 완료됐다. 다만 (1) 이번에 신설된 undo 단일화(`skipUndo`) 로직과 컴포넌트 실배선이 테스트로 전혀 검증되지 않고, (2) §1.2 신규 동작(빈 영역 드롭 → 자동 팝업+연결)을 반영해야 할 유저 가이드 2개 페이지가 stale 상태로 남아 사용자에게 잘못된 안내가 노출된다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | `editor-store.ts` `onConnect` 의 신규 `opts?.skipUndo` 옵션이 어떤 테스트로도 검증되지 않음 — `!` 누락·오타 등으로 조건이 깨지면 원래 버그(고아 노드/undo 불가)가 무음 재발 | `codebase/frontend/src/lib/stores/editor-store.ts:91`(시그니처), `:723`(`if (!opts?.skipUndo) get().pushUndo();`); 소비처 `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx:616` | `editor-store.test.ts` 에 `onConnect — skipUndo (§1.2)` describe 추가: (1) opts 미지정 시 `undoStack` +1, (2) `{skipUndo:true}` 시 `undoStack` 불변, 2개 단언 |
| 2 | testing | `workflow-canvas.tsx` 실제 배선(`onConnectEnd`→`connectionDragSource`/`pointerClientPosition`, `handleAddNodeFromSearch`→`buildAutoConnectConnection`→`onConnect`)이 컴포넌트/e2e 테스트로 전혀 exercise 되지 않음 — 순수 함수 로직은 vitest 57건으로 잘 커버되나 "조합(호출 순서·인자 전달)이 옳다"는 보증되지 않음 | `workflow-canvas.tsx` `onConnectEnd`(L140-154), `handleAddNodeFromSearch`(L597-621); `workflow-canvas.test.tsx`/e2e 스펙 부재 | React Testing Library + `@xyflow/react` mock 으로 "드래그 종료 → 팝업 오픈 → 노드 선택 → `onConnect` 호출 인자" 검증하는 최소 통합 테스트 1개를 §1.3 착수 전 추가 권고 |
| 3 | user_guide_sync | 유저 가이드 `connecting-nodes.mdx`(+`.en.mdx`) "빈 영역 드롭 = 아무 일도 일어나지 않음" 서술이 신규 §1.2 동작(노드 추가 팝업+자동 엣지 연결)과 불일치(stale) — frontmatter `code:` 가 이번에 변경된 `workflow-canvas.tsx` 를 가리켜 registry 상 연결 대상 확인됨 | `codebase/frontend/src/content/docs/03-workflow-editor/connecting-nodes.mdx`(+`.en.mdx`) "연결선 긋기" 3번 항목 | "출력 포트 드래그 후 빈 영역에 드롭하면 노드 추가 검색 팝업이 열리고, 노드 선택 시 자동 연결(대상에 입력 포트 없으면 노드만 생성)"으로 갱신. 다른 무효 target(출력끼리·같은 노드)의 "아무 일도 안 일어남" 서술은 유지 |
| 4 | user_guide_sync | 유저 가이드 `canvas-basics.mdx`(+`.en.mdx`) "노드를 추가하는 세 가지 방법" 목록에 §1.2 신규 네 번째 방법(출력 포트 드래그→빈 영역 드롭, 유일하게 엣지까지 자동 연결)이 누락 | `codebase/frontend/src/content/docs/03-workflow-editor/canvas-basics.mdx`(+`.en.mdx`) "## 노드를 추가하는 세 가지 방법" `<Steps>` | `<Steps>` 목록에 네 번째 항목 추가(또는 보충 문단), 자동 연결·트리거 등 입력 포트 없는 노드는 연결 생략됨을 명시 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | architecture | `onConnect` 원시 액션에 호출자-종속 제어 플래그(`opts.skipUndo`)를 얹는 방식으로 undo 중복 해소 — 전용 합성 액션(`addNodeWithConnection`) 대신 옵션 스레딩 선택. 옵션 객체 형태·기본값 false·단일 호출부라 즉각 위험은 낮음 | `editor-store.ts` `EditorState.onConnect(connection, opts?)` | §1.3 등 "생성+연결" 류 합성 제스처가 늘어나면 전용 합성 액션으로 승격 재고 |
| 2 | architecture / maintainability | `workflow-canvas.tsx` God Component 팽창 우려는 미해소지만 plan §1.3 이월 항목 (a)로 명시적으로 추적됨(임의 묵살 아님). 팝업 오픈 3중 중복은 `openNodeSearchPopupAt` 공용 헬퍼로 실질 해소 | `workflow-canvas.tsx` 전체; `plan/in-progress/spec-sync-edge-gaps.md` §1.3 | §1.3 착수 시 오케스트레이션 훅 추출 재검토(이미 plan 기록) |
| 3 | requirement / side_effect | `buildAndAddNode`(`pushUndo()`) + store `addNode`(내부 `get().pushUndo()`) 이중 push 는 이 PR 이전부터 존재하는 pre-existing 패턴(`duplicate` 액션도 동일). undo 스택 1칸을 낭비해 다음 Ctrl+Z 가 사실상 no-op 이 되지만, "Ctrl+Z 1회로 노드+엣지 함께 취소"라는 이번 PR 의 목표 자체는 실제로 달성됨 | `editor-store.ts` `addNode`(L747-748), `workflow-canvas.tsx` `buildAndAddNode` | 이번 PR 스코프 밖. `buildAndAddNode`/`duplicate`/`addNode` 전반의 이중 pushUndo 정리는 별건 hygiene 이슈로 백로그 고려 |
| 4 | maintainability | `firstInputHandleId`/`buildAutoConnectConnection` 의 "컨테이너 충돌 미발생" 가정이 코드 가드 없이 JSDoc 으로만 방어됨(직전 WARNING #7 부분 반영) — 현재 노드 정의 데이터로는 실제 발생하지 않음을 재확인 | `edge-utils.ts` `buildAutoConnectConnection` JSDoc | 신규 컨테이너형 노드 정의 추가 PR 에서 첫 입력 포트가 예약 포트(`emit` 등) 아닌지 체크리스트로 확인 |
| 5 | maintainability | `edge-utils.ts` 신규 헬퍼 5종의 파일 내 배치가 기존 기능 그룹과 약간 어긋나며 섹션 구분 주석이 없음 | `edge-utils.ts` | §1.3 착수 시 섹션 헤더 주석(`// --- §1.2 자동 연결 ---`) 추가 고려 |
| 6 | maintainability | `screenToFlowPosition(...) ?? {x:0,y:0}` 좌표 변환 로직이 `onPaneClick`/`onConnectEnd` 두 곳에 여전히 복제됨(`openNodeSearchPopupAt` 이 흡수하지 못함) | `workflow-canvas.tsx` | §1.3 착수 시 헬퍼가 `clientX/clientY` 를 받아 내부에서 변환하도록 확장 고려 |
| 7 | testing | `connectionDragSource` 의 `fromHandle` 이 `undefined` 인 극단 케이스 자체는 직접 테스트되지 않음(옵셔널 체이닝으로 안전, 리스크 낮음) | `edge-utils.ts` `connectionDragSource`; `edge-utils.test.ts` | 향후 헬퍼 수정 시 함께 추가 고려 |
| 8 | documentation | spec `## Rationale` 섹션에 "대상 노드에 입력 포트가 없으면 자동 연결 생략" 설계 근거가 미등재 — 직전 라운드에서 이미 선택 사항으로 분류, 기능적 영향 없음 | `spec/3-workflow-editor/2-edge.md` `## Rationale`(R-1, R-2만 존재) | 선택 사항, 필수 아님 |
| 9 | 전 리뷰어 공통 | 직전 ai-review(`review/code/2026/07/13/11_04_21`, HIGH: CRITICAL 1 + WARNING 6) 산출물 및 `RESOLUTION.md` 신규 커밋 — 저장소 관례(`review/` 는 gitignore 대상 아님, SUMMARY·RESOLUTION 도 커밋) 부합, 코드 결함 아님 | `review/code/2026/07/13/11_04_21/*` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신규 리스크 없음. `onConnect` 직접 호출은 store 내부 재검증으로 실질 우회 아님, 순수 헬퍼는 인젝션 표면 없음 |
| architecture | LOW | 직전 리뷰 WARNING/INFO 4건 중 3건 실질 해소(팝업 통합, spec 정합, naming), `skipUndo` 옵션 플래그 방식은 향후 재검토 여지 |
| requirement | LOW | 직전 CRITICAL(spec stale) line-level 해소 확인, 나머지는 pre-existing 잔존 이슈로 이번 스코프 아님 |
| scope | NONE | 요청 범위를 벗어난 리팩토링·무관한 변경·over-engineering 없음 |
| side_effect | LOW | `skipUndo` 는 undo push 만 스킵, 다른 부수효과(검증·isDirty)엔 무영향. 이중 pushUndo 는 pre-existing |
| maintainability | LOW | WARNING 1건 + INFO 3건 중 3건 코드로 완전 반영, 잔여는 경미하고 이미 §1.3 이월 추적 중 |
| testing | MEDIUM | 신규 `skipUndo` 로직 및 컴포넌트 실배선이 테스트로 검증되지 않는 회귀 사각지대 2건 |
| documentation | LOW | 직전 CRITICAL·WARNING 전건 코드/문서 실측 대조로 해소 확인, `skipUndo` 테스트 부재는 INFO 로 별도 기록 |
| user_guide_sync | MEDIUM | §1.2 신규 동작을 반영 못한 유저 가이드 2개 페이지(ko/en) stale |

## 발견 없는 에이전트

- **security**: 전건 INFO(실질 위험 없음 확인)로, 조치가 필요한 발견사항 없음.
- **scope**: 전건 INFO(의도 부합 확인)로, 스코프 이탈 발견사항 없음.

## 권장 조치사항
1. `connecting-nodes.mdx`/`connecting-nodes.en.mdx`, `canvas-basics.mdx`/`canvas-basics.en.mdx` 4개 유저 가이드 페이지를 §1.2 신규 동작(빈 영역 드롭 → 자동 팝업 + 연결)에 맞게 갱신한다(WARNING #3, #4).
2. `editor-store.test.ts` 에 `skipUndo` 옵션 회귀 테스트(opts 미지정 시 push, `{skipUndo:true}` 시 미push) 2건을 추가한다(WARNING #1).
3. §1.3 착수 전, `workflow-canvas.tsx` 의 `onConnectEnd`→`handleAddNodeFromSearch`→`onConnect` 실배선을 검증하는 최소 통합 테스트 1개를 추가한다(WARNING #2).
4. 그 외 INFO 항목(합성 액션 승격, God Component 훅 추출, 이중 pushUndo 정리, 헬퍼 배치 정리)은 이미 plan §1.3 이월로 추적 중이므로 해당 착수 시점에 재확인한다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `user_guide_sync` (9명)
  - **제외**: 표 참고 (5명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | diff 가 순수 프런트엔드 UI 로직(순수 헬퍼·store 옵션 플래그·문서 동기화)에 한정되어 성능 민감 경로 변경 없음 |
  | dependency | 신규/변경 패키지 의존성 없음 |
  | database | DB 스키마·쿼리 변경 없음 |
  | concurrency | 서버측 동시성/락 로직 변경 없음, 클라이언트 로컬 편집 상태만 다룸 |
  | api_contract | 신규/변경 API 엔드포인트·DTO·wire 계약 없음 |