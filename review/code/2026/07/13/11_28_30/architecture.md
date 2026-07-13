# 아키텍처(Architecture) 리뷰

대상: `workflow-canvas.tsx`/`editor-store.ts`/`edge-utils.ts`(+test) §1.2 ai-review(`11_04_21`) 후속 반영 커밋, `spec/3-workflow-editor/2-edge.md`·`CHANGELOG.md`·`plan/in-progress/spec-sync-edge-gaps.md` 동기화, 원 리뷰 산출물(`review/code/2026/07/13/11_04_21/*`) 커밋.

본 diff 는 신규 기능이 아니라 동일 세션(`11_04_21`) architecture 리뷰가 낸 WARNING/INFO(God Component 팽창, `source` 필드 방향성, 팝업 오픈 3중 중복, `onConnect` undo 중복 push)에 대한 해소(resolution) 커밋이다. 아래는 그 해소가 아키텍처 관점에서 온전한지에 대한 재검토다.

## 발견사항

- **[INFO]** `onConnect` 원시 액션에 호출자-종속 제어 플래그(`opts.skipUndo`)를 얹는 방식으로 undo 중복 문제를 해소 — 합성 액션 캡슐화 대신 옵션 스레딩 선택
  - 위치: `codebase/frontend/src/lib/stores/editor-store.ts` `EditorState.onConnect(connection, opts?: { skipUndo?: boolean })`, `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` `handleAddNodeFromSearch`(`onConnect(connection, { skipUndo: true })`)
  - 상세: 원 리뷰(WARNING #2, side_effect)가 제시한 대안은 "노드 생성+연결"을 단일 pushUndo 체크포인트로 묶는 전용 합성 store 액션(예: `addNodeWithConnection`) 도입이었다. 실제 채택된 해법은 그 대신 범용 원시 액션 `onConnect`에 `skipUndo` 제어 플래그를 추가하는 것이다. 이는 "두 노드를 연결한다"는 `onConnect`의 단일 책임에 "이 호출은 상위 오케스트레이션이 undo 북키핑을 이미 처리했다"는 호출자-종속 지식을 얹는 boolean-flag 소지가 있다 — 원시 mutation 게이트가 자신의 부수효과(undo 기록) 여부를 호출부 문맥에 따라 분기해야 하는 결합이 생긴다. 다만 옵션 객체(`opts?.skipUndo`, 위치 인자 아님) 형태로 도입해 향후 옵션 확장에 열려 있고, 기본값 `false`(하위 호환)를 유지하며, 현재 단일 호출부만 `true`를 쓰므로 즉각적 위험은 낮다.
  - 제안: 지금 스코프에서는 비례적인 해법이나, §1.3(역방향 재연결) 등 "생성+연결" 류 합성 제스처가 하나 더 늘어나면 각 호출부가 undo 시맨틱을 개별 추론해야 하는 부담이 재발할 수 있다. 그 시점엔 전용 합성 액션으로 승격을 재고할 것(plan 이월 항목 (a)와 함께 검토 가능).

- **[INFO]** God Component(`workflow-canvas.tsx`) 팽창 우려는 미해소지만 명시적으로 이월·추적됨 — 대신 팝업 오픈 3중 중복은 해소
  - 위치: `plan/in-progress/spec-sync-edge-gaps.md` §1.3 이월 항목 (a); `workflow-canvas.tsx` 신규 `openNodeSearchPopupAt`
  - 상세: 원 리뷰 WARNING(God Component, 오케스트레이션 전용 훅 추출 제안)은 이번 커밋에서 수행되지 않았다 — 대신 plan 문서에 "§1.3 착수 시 함께 검토"로 명시적 이월돼 향후 작업에서 유실되지 않도록 추적된다(임의 묵살이 아니라 근거 있는 defer). 한편 원 리뷰 WARNING(#6, maintainability의 팝업 오픈 3중 중복)은 `openNodeSearchPopupAt(clientX, clientY, flowPosition, dragSource?)` 공용 헬퍼로 `onPaneClick`/`handleCanvasMenuAction`/`onConnectEnd` 세 경로를 통합해 실질적으로 해소됐다 — 응집도가 개선된 방향의 리팩터.
  - 제안: 없음. 이월 결정 존중. §1.3 착수 시 계획대로 재확인 권고(이미 plan에 명시).

- **[INFO]** spec-코드 정합화 및 계층 서술이 실제 구현과 정확히 일치
  - 위치: `spec/3-workflow-editor/2-edge.md` §1.2 "현재 구현" 각주
  - 상세: 원 리뷰 CRITICAL(documentation, spec stale)에 대응해 §1.2 각주가 실제 구현(React Flow v12 `connectionState.isValid`/`fromNode`/`fromHandle`, `dragSource`, `buildAndAddNode` 반환값, `skipUndo` undo 단일화, 순수 헬퍼 4종)과 정확히 일치하도록 갱신됐고, "대상 노드에 입력 포트가 없으면 연결 생략" 이라는 엣지 케이스도 명시됐다. 코드 자체의 레이어 책임(스토어=권위 있는 mutation 게이트: 자기연결/중복/컨테이너 충돌 재검증, 컴포넌트=오케스트레이션)도 원 리뷰 시점과 동일하게 유지되어 이번 후속 변경(헬퍼 추출, 개명, 옵션 추가)으로 흐트러지지 않았다. 신규 순수 헬퍼(`connectionDragSource`/`pointerClientPosition`/`buildAutoConnectConnection`) 역시 `edge-utils.ts`의 기존 연결 판정 그룹에 자연스럽게 편입되며, `edge-utils.ts → node-definitions` 단방향 의존 외 새 순환 참조는 없다.
  - 제안: 없음.

## 검토했으나 문제 없음으로 판단한 지점 (참고)

- `dragSource` 개명(원 `source`)은 문자열 노드 ID를 뜻하는 코드베이스 관례(`Connection.source`)와의 혼동 소지를 없앤 것으로, 원 리뷰 INFO(#13)를 정확히 해소했다. 방향성 비대칭(원 리뷰 INFO #10, §1.3 확장 시 `role` 유니온 재설계 필요 가능성)은 이번 커밋에서 아직 그대로지만 필드명 변경 자체가 그 우려를 악화시키지 않는다.
- `getNodeDefinition` 이중 조회(원 리뷰 INFO)는 이번 커밋에서도 미해소(`handleAddNodeFromSearch`가 `getNodeDefinition(nodeType)`을 여전히 재조회)이나, 우선순위 낮음으로 분류돼 있었고 이번 diff의 핵심 스코프(undo/naming/테스트/spec 동기화)와 무관해 이월이 합리적이다.
- 리뷰 산출물(`RESOLUTION.md`/`SUMMARY.md`/`meta.json`/`_retry_state.json`/개별 reviewer 리포트)이 저장소에 커밋되는 것은 아키텍처 관점의 문제가 아니라 이 저장소의 확립된 프로세스 관례(`review/`는 gitignore 대상 아님, 감사 추적용)와 일치한다.

## 요약

이번 커밋은 신규 기능이 아니라 동일 세션 architecture 리뷰가 낸 지적(God Component, `source` 방향성 비대칭, 팝업 오픈 3중 중복, `onConnect` undo 중복)에 대한 표적 대응이며, 전반적으로 비례적이고 정확하다 — 팝업 오픈 로직은 공용 헬퍼로 응집도 있게 통합됐고, 순수 판정/조립 로직은 테스트 가능한 형태로 `edge-utils.ts`에 적절히 분리됐으며, spec 본문도 실제 구현과 정합화됐다. 유일하게 주목할 점은 undo 중복 문제를 전용 합성 액션 대신 원시 `onConnect`에 제어 플래그(`skipUndo`)를 얹어 해소한 선택인데, 옵션 객체 형태·단일 호출부·명시적 JSDoc으로 위험은 낮으나 유사 합성 제스처가 늘어나면 재검토가 필요할 수 있다. God Component 팽창 우려는 미해소지만 plan에 명시적으로 이월돼 추적 가능한 상태이므로 임의 묵살이 아니다. 새로운 순환 의존성이나 레이어 경계 침해는 발견되지 않았다.

## 위험도
LOW
