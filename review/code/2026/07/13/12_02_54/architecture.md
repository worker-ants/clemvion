# 아키텍처(Architecture) 리뷰

대상: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx`(`onConnectEnd`/`openNodeSearchPopupAt`/`buildAndAddNode`/`handleAddNodeFromSearch`), `codebase/frontend/src/lib/stores/editor-store.ts`(`onConnect` + `opts.skipUndo`), `codebase/frontend/src/lib/utils/edge-utils.ts`(+test, 순수 헬퍼 5종), `spec/3-workflow-editor/2-edge.md` §1.2, `plan/in-progress/spec-sync-edge-gaps.md`, `CHANGELOG.md`, 4개 유저가이드 mdx. 본 diff 는 §1.2("출력 포트 드래그 → 빈 영역 드롭 → 노드 추가 팝업 + 자동 엣지 연결") 최초 구현과, 동일 세션에서 진행된 3회의 ai-review(`11_04_21` HIGH → `11_28_30` → `11_46_01`)에 대한 순차 반영 커밋들을 모두 포함하는 누적 diff다. 이미 커밋된 세 라운드의 architecture 리뷰(11_04_21, 11_28_30)와 이후 라운드(11_46_01, architecture 미트리거)의 지적·해소 이력을 코드 현재 상태와 대조해 독립적으로 재검증했다.

## 발견사항

- **[INFO]** `workflow-canvas.tsx`(978줄)의 다관심사 God Component 성향 — 미해소지만 명시적으로 이월·추적됨
  - 위치: `workflow-canvas.tsx` 전체(컨텍스트 메뉴 3종 상태머신, 검색 팝업, 키보드 단축키, DnD, 단일 노드 실행, 삭제 확인 다이얼로그, undo, 그리고 이번에 추가된 `onConnectEnd`/`openNodeSearchPopupAt`)
  - 상세: 11_04_21 라운드에서 WARNING 으로 지적된 책임 팽창은 이번 누적 diff로 근본 해소(오케스트레이션 전용 훅 추출)되지 않았다. 다만 (a) 팝업 오픈 시퀀스(`setNodeContextMenu(null)`→`setCanvasContextMenu(null)`→`setNodeSearchPopup(...)`→`setSearchQuery("")`)를 `onPaneClick`/`handleCanvasMenuAction`/`onConnectEnd` 3곳이 공유하던 중복을 `openNodeSearchPopupAt` 공용 헬퍼로 통합해 순증가 폭을 억제했고, (b) `plan/in-progress/spec-sync-edge-gaps.md` §1.3 이월 항목 (a)에 "§1.3 착수 시 전용 훅으로 추출 검토"라고 근거와 함께 명시적으로 defer 되어 있어 임의 묵살이 아니다. 실측 결과 이 판단은 여전히 유효하다.
  - 제안: 조치 불요(추적됨). §1.3(입력 포트 역방향 드래그) 착수 시 plan 에 기록된 대로 오케스트레이션 훅 추출을 재검토할 것.

- **[INFO]** `onConnect` 원시 mutation 게이트에 호출자-종속 제어 플래그(`opts.skipUndo`)를 얹는 방식으로 undo 이중 push 문제를 해소
  - 위치: `codebase/frontend/src/lib/stores/editor-store.ts` `onConnect(connection, opts?: { skipUndo?: boolean })`, `workflow-canvas.tsx` `handleAddNodeFromSearch` 의 `onConnect(connection, { skipUndo: true })` 호출
  - 상세: 11_04_21 side_effect 리뷰가 지적한 "노드 생성+연결이 undo 스택에 최소 2회 push되어 Ctrl+Z 1회로 고아 노드가 남는" 문제에 대해, 검토된 대안(전용 합성 액션 `addNodeWithConnection` 도입)이 아니라 범용 `onConnect` 에 boolean 옵션을 얹는 경로가 채택됐다. 이는 "두 노드를 연결한다"는 `onConnect`의 단일 책임에 "상위 오케스트레이션이 undo 북키핑을 이미 처리했다"는 호출자 문맥 지식이 스며드는 구조라 SRP 관점에서 약간의 트레이드오프다. 다만 위치 인자가 아닌 옵션 객체(`opts?.skipUndo`, 기본값 `false`)로 도입해 하위 호환을 유지하고 향후 확장에 열려 있으며, 현재 단일 호출부만 `true` 를 쓴다. `editor-store.test.ts` 에 `skipUndo` true/false 두 케이스가 모두 단위 테스트되어 계약이 문서·테스트 양쪽에서 뒷받침된다.
  - 제안: 지금 스코프에서는 비례적인 해법이다. §1.3(역방향 재연결) 등 "생성+연결" 류 합성 제스처가 하나 더 늘어나면 각 호출부가 undo 시맨틱을 개별 추론해야 하는 부담이 재발할 수 있으므로, 그 시점엔 전용 합성 액션으로의 승격을 재고할 것(이미 plan §1.3 이월 항목 (a)와 함께 검토 가능한 범위).

- **[INFO]** `NodeSearchPopupState.dragSource` 필드가 방향성 비대칭 — §1.3 확장 시 재설계 소지, 명명은 이미 정리됨
  - 위치: `workflow-canvas.tsx` L104-111(`NodeSearchPopupState.dragSource: { nodeId: string; handleId: string | null }`), `handleAddNodeFromSearch` L600-620
  - 상세: `dragSource` 는 항상 "출력 포트에서 시작해 새 노드의 입력으로 들어간다"는 단방향 가정만 인코딩한다. §1.3(입력 포트에서 시작하는 역방향 드래그)이 구현되면 새 노드가 `target` 이 아니라 `source` 역할이 되는 경우도 다뤄야 하므로 `role: 'source' | 'target'` 류의 유니온 재설계가 필요할 가능성이 크다. 11_04_21 라운드에서 필드명이 `source`(문자열 노드 ID 관례와 충돌 소지)에서 `dragSource` 로 개명되어 명명 혼동은 해소됐으나, 방향성 비대칭 자체는 §1.2 스코프에서는 결함이 아니고 다음 spec 항목에서 다뤄야 할 예정된 확장 지점이다.
  - 제안: §1.3 구현 착수 시 `dragSource` 를 방향 태그가 있는 유니온으로 먼저 재설계하고 §1.2 로직을 그 위에 재배치할 것. 지금 이대로 두어도 무방.

- **[INFO]** `getNodeDefinition(nodeType)` 이중 조회 — 협력 함수 간 암묵적 재조회 결합, 경미
  - 위치: `workflow-canvas.tsx` `buildAndAddNode`(L569, 내부 1회) / `handleAddNodeFromSearch`(L614, 자동 연결 분기에서 동일 `nodeType` 재조회)
  - 상세: 전역 레지스트리(Map) 조회라 실질 비용은 무시할 수준이지만, 두 협력 함수가 "이 nodeType 의 definition" 이라는 동일 정보를 각자 재조회하는 구조라 향후 definition 조회 로직이 바뀌면(예: 비동기화) 두 곳을 동시에 손봐야 한다. 3회 연속 라운드 모두 우선순위 낮음으로 이월된 잔존 이슈다.
  - 제안: `buildAndAddNode` 가 `{ id, definition }` 을 반환하거나 상위에서 1회 조회해 양쪽에 전달하도록 정리하면 암묵적 결합이 사라진다. 우선순위 낮음, 이번 스코프 필수 아님.

## 검토했으나 문제 없음으로 판단한 지점 (참고)

- **레이어 책임 분리가 온전히 유지됨**: `handleAddNodeFromSearch` 가 store 의 `onConnect` 을 직접 호출해 드래그 중 UI 힌트 전용인 `isValidConnection` 을 우회하지만, 실제 연결 유효성(자기연결·중복·컨테이너 충돌)은 전부 `onConnect` 내부에서 재검증된다. 신규 노드는 아직 어떤 컨테이너에도 속하지 않으므로 `detectContainerConflict` 도 항상 통과한다는 주석의 불변식이 실제로 성립함을 확인했다. 스토어(권위 있는 mutation 게이트) ↔ 컴포넌트(오케스트레이션) ↔ `edge-utils.ts`(순수 판정/조립 도메인 로직)의 3계층 책임 분리가 이번 다회 반영(헬퍼 추출, 개명, 옵션 추가) 과정에서도 흐트러지지 않았다.
- **순환 의존성 없음**: `edge-utils.ts` → `node-definitions`/`resolve-dynamic-ports` 단방향 의존만 확인되며, 이번에 추가된 5개 순수 헬퍼(`isConnectionDroppedOnPane`/`firstInputHandleId`/`connectionDragSource`/`pointerClientPosition`/`buildAutoConnectConnection`)도 동일 방향성을 유지한다. `editor-store.ts` ↔ `workflow-canvas.tsx` 간에도 새로운 순환은 생기지 않았다(스토어가 컴포넌트를 참조하지 않는 단방향 유지).
- **모듈 경계·응집도**: `edge-utils.ts` 는 이미 "엣지 도메인 순수 로직"을 모아두는 응집된 모듈이었고, 신규 5개 함수도 같은 도메인(연결 판정/조립)에 속해 모듈 경계를 흐트러뜨리지 않는다. 파일 내 배치 순서(포트 판정 → 연결 유효성 → §1.2 자동연결 → 그래프 유틸)에 섹션 구분 주석이 없어 그룹이 점점 늘어난다는 지적이 3회 라운드 내내 INFO 로 이월돼 있으나, 응집도 자체를 해치는 수준은 아니다.
- **디자인 패턴**: `buildAutoConnectConnection` 이 `null` 을 반환해 "대상에 입력 포트 없음(트리거 등)"을 표현하는 방식은 이 파일의 기존 관례(`isDuplicateConnection` 등 boolean/null 반환 순수 함수)와 일관되며 특별한 안티패턴은 없다. `screenToFlowPosition(...) ?? { x: 0, y: 0 }` 좌표 변환 폴백이 `onPaneClick`/`onConnectEnd` 두 곳에 복제된 점은 사소한 DRY 잔존이나, `openNodeSearchPopupAt` 이 이미 계산된 `flowPosition` 을 인자로 받는 설계 결정에서 자연히 파생된 것으로 아키텍처 결함이라기보다 유지보수성 카테고리에 가깝다(11_46_01 maintainability 리뷰가 이미 다룸).
- **확장성**: `firstInputHandleId` 가 정적 `definition.inputs` 만 참조하고 동적 포트 해석을 쓰지 않는 점은, 코드베이스 전반의 불변식(입력 포트는 동적이지 않다, 동적 포트는 출력에만 존재)과 일치해 리키 추상화가 아니다. spec §1.2 본문·CHANGELOG·plan 문서가 실제 구현과 line-level 로 일치하도록 갱신되어 차기 §1.3 작업자가 정확한 현재 상태를 SoT 로 참조할 수 있다.
- **리뷰 산출물 커밋**: `review/code/2026/07/13/{11_04_21,11_28_30,11_46_01}/*` 가 이번 diff 에 포함된 것은 아키텍처 문제가 아니라 저장소의 확립된 프로세스 관례(`review/` 는 gitignore 대상 아님, 감사 추적용)와 일치한다.

## 요약

3회 연속 ai-review(HIGH→LOW 수렴)를 거친 최종 상태를 기준으로 재검증한 결과, §1.2("출력 포트 드래그→빈 영역 드롭→노드 추가 팝업+자동 엣지 연결") 구현은 스토어(권위 있는 mutation 게이트)·컴포넌트(오케스트레이션)·`edge-utils.ts`(순수 도메인 로직)의 계층 책임 분리를 온전히 유지하고, 새로운 순환 의존성이나 모듈 경계 침해 없이 기존 컨벤션(가드절 순수 함수, §참조 JSDoc)을 일관되게 따른다. `workflow-canvas.tsx` 의 God Component 성향과 `dragSource` 필드의 방향성 비대칭은 실질적 잔존 사안이지만 둘 다 §1.3 이월 항목으로 plan 에 근거와 함께 명시적으로 추적되어 있어 임의 묵살이 아니며, undo 이중 push 문제 해소를 위해 채택된 `onConnect(opts.skipUndo)` 제어 플래그도 옵션 객체·하위호환·단위테스트를 갖춰 위험이 낮다. 차단할 CRITICAL/WARNING 급 아키텍처 결함은 발견되지 않았다.

## 위험도
LOW
