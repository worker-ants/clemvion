# 문서화(Documentation) 리뷰 결과

대상: `CHANGELOG.md`, `spec/3-workflow-editor/2-edge.md`, `plan/in-progress/spec-sync-edge-gaps.md`, `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx`, `codebase/frontend/src/lib/stores/editor-store.ts`, `codebase/frontend/src/lib/utils/edge-utils.ts`(+test), `review/code/2026/07/13/11_04_21/*`(직전 리뷰 라운드 산출물)

본 라운드는 직전 리뷰(`review/code/2026/07/13/11_04_21`, 위험도 HIGH — CRITICAL 1 + WARNING 6)에 대한 해소(`RESOLUTION.md`) 이후의 fresh 리뷰다. 직전 documentation 리뷰가 지적한 CRITICAL·WARNING 을 코드/문서 실측으로 교차 검증했다.

## 발견사항

- **[INFO]** 직전 CRITICAL(SoT spec stale) — 실제로 해소됨, 서술도 구현과 정확히 일치
  - 위치: `spec/3-workflow-editor/2-edge.md` §1.2
  - 상세: 헤더 `### 1.2 빈 영역 드롭 시 (미구현 · Planned)` → `### 1.2 빈 영역 드롭 시`로 라벨 제거되었고, `> 현재 구현:` 각주가 실제 구현(React Flow v12 `connectionState.isValid`/`fromNode`/`fromHandle`, `onConnectEnd`, `NodeSearchPopupState.dragSource`, `buildAndAddNode` id 반환, `onConnect` `skipUndo`, 순수 헬퍼 4종 — `connectionDragSource`/`pointerClientPosition`/`buildAutoConnectConnection`/`firstInputHandleId`)로 정확히 갱신됨. 코드 diff(`workflow-canvas.tsx`, `edge-utils.ts`)를 직접 대조한 결과 각주 서술과 실제 구현 사이에 불일치 없음. 대상 노드에 입력 포트가 없으면 연결을 생략한다는 §1.2 신설 불릿도 `buildAutoConnectConnection`의 `null` 반환 경로와 일치. `frontmatter status: partial`은 §1.3/§3.2/§4/§5 잔여 항목 때문에 그대로 유지되어 있고 이는 타당함. 저장소 전체 grep(`edge §1.2`, `onConnectEnd`, "빈 영역 드롭") 결과 이 spec 파일 외에 §1.2를 "Planned"로 참조하는 dangling 문서는 없음 — `RESOLUTION.md`의 "self-contained라 full consistency-check 생략" 주장도 검증됨.
  - 제안: 없음(조치 완료 확인).

- **[INFO]** 직전 WARNING(CHANGELOG 미갱신) — 해소됨, 저장소 관례에 부합
  - 위치: `CHANGELOG.md` 최상단 신규 `## Unreleased — 워크플로 편집기 출력 포트 드래그→빈 영역 드롭 노드 추가 팝업 + 자동 엣지 연결 (3-workflow-editor/2-edge §1.2)` 섹션
  - 상세: 자매 항목(§2.2/§2.3) CHANGELOG 항목과 동일한 톤·상세도(핵심 동작 굵게 + 종전 상태 대비 + 구현 파일/함수명 + undo 단일화 근거 + SoT 경로)로 작성됨. 서술 내용(`onConnectEnd`, `dragSource`, `buildAndAddNode` id 반환, `skipUndo`, 4개 순수 헬퍼 + `isConnectionDroppedOnPane`, "백엔드·wire 무변경")이 실제 diff와 모두 일치.
  - 제안: 없음.

- **[INFO]** 신규 순수 헬퍼 5종(`edge-utils.ts`) JSDoc 정확·충실
  - 위치: `edge-utils.ts` `isConnectionDroppedOnPane`/`firstInputHandleId`/`connectionDragSource`/`pointerClientPosition`/`buildAutoConnectConnection`
  - 상세: 모든 함수에 목적·판정 근거·null 반환 조건(§1.2/§1.3 경계 포함)을 설명하는 JSDoc이 있고, 실제 구현과 서술이 일치한다(예: `connectionDragSource`의 "입력 포트에서 시작한 역방향 드래그는 §1.3 소관이라 배제" 서술은 `fromHandle?.type !== "source"` 가드와 정확히 대응). `buildAutoConnectConnection` JSDoc에는 직전 WARNING #7("컨테이너 포트 순서 암묵 의존") 대응으로 "컨테이너 충돌은 현재 노드 정의상 첫 입력이 데이터 포트라 발생하지 않는다"는 가정이 명시적으로 문서화됨(코드 레벨 방어는 아니고 주석 명시로 부분 반영 — RESOLUTION.md 서술과 일치).
  - 제안: 없음.

- **[INFO]** `workflow-canvas.tsx`/`editor-store.ts` 인라인 주석도 갱신된 동작과 일치
  - 위치: `NodeSearchPopupState.dragSource` 필드 주석, `openNodeSearchPopupAt`/`onConnectEnd`/`buildAndAddNode`/`handleAddNodeFromSearch` 주석, `editor-store.ts` `onConnect(connection, opts?)` 위 주석
  - 상세: `dragSource` 개명(직전 INFO #13 "source 필드명 혼동" 반영) 후 주석이 "Connection.source 문자열과 구분하려고 dragSource로 명명"이라고 개명 근거까지 명시. `onConnect`의 `opts.skipUndo` 주석("호출자가 직전에 이미 pushUndo한 경우 ... 내부 pushUndo를 건너뛴다. 기본 false")은 실제 구현(`if (!opts?.skipUndo) get().pushUndo();`)과 정확히 일치. `openNodeSearchPopupAt` 주석은 3개 호출부(`onPaneClick`/`handleCanvasMenuAction`/`onConnectEnd`) 공유 사실을 정확히 서술 — 실제로 세 곳 모두 이 헬퍼를 호출하도록 리팩터됨(직전 WARNING #6 반영 확인).
  - 제안: 없음.

- **[INFO]** `skipUndo` 계약이 주석으로는 서술되지만 이를 직접 검증하는 단위 테스트는 없음
  - 위치: `codebase/frontend/src/lib/stores/editor-store.ts` `onConnect(connection, opts)`, `codebase/frontend/src/lib/stores/__tests__/editor-store.test.ts`(본 diff에 미포함)
  - 상세: `editor-store.test.ts`의 기존 `describe("onConnect — 금지 연결 하드 차단 (§2.2)")` 3개 테스트 모두 `opts` 인자 없이 호출하며, 저장소 전체에 `skipUndo` 문자열을 검색해도 이 테스트 파일에는 등장하지 않는다. 즉 "opts.skipUndo=true면 pushUndo를 건너뛰고, 생략/false면 기존처럼 push한다"는 주석상의 계약이 자동 회귀 테스트로 뒷받침되지 않는다. `edge-utils.test.ts`에 추가된 12케이스는 `connectionDragSource`/`buildAutoConnectConnection` 등 "무엇을 연결할지" 판정 로직만 커버할 뿐, 이 값이 실제로 `onConnect(conn, {skipUndo:true})`로 전달되어 store의 undo 스택에 반영되는지는 어떤 테스트로도 검증되지 않는다(이는 순수 문서화 이슈라기보다 testing 카테고리와 접하지만, 주석이 약속하는 동작의 장기 정합성 유지 관점에서 기록).
  - 제안: `editor-store.test.ts`에 "opts.skipUndo=true면 pushUndo가 호출되지 않는다 / 생략 시 호출된다" 케이스 1~2개 추가 고려. 차단 사유는 아님(HIGH→해소 이후 라운드에서의 잔여 개선점).

- **[INFO]** spec `## Rationale` 섹션에 §1.2 엣지 케이스 근거 미등재 — 직전 리뷰에서 이미 "선택 사항"으로 분류된 항목, 여전히 미반영
  - 위치: `spec/3-workflow-editor/2-edge.md` `## Rationale`(R-1, R-2만 존재)
  - 상세: "대상 노드에 입력 포트가 없으면 자동 연결을 생략한다"는 설계 판단은 R-2와 유사한 형식의 근거 기록 대상이 될 수 있으나, 직전 라운드에서도 옵션으로 분류되었고 `RESOLUTION.md`도 이를 별도로 반영했다고 주장하지 않는다(다른 INFO 항목들만 "선택 반영"에 열거). 기능적 영향 없음.
  - 제안: 선택 사항 — 필수 아님.

## 요약

직전 리뷰(HIGH: CRITICAL 1 + WARNING 6)의 documentation 관련 지적 두 건(SoT spec stale, CHANGELOG 미갱신)은 이번 라운드에서 코드·문서 실측 대조로 정확히 해소된 것으로 확인된다 — spec §1.2 각주는 실제 구현 디테일(연결원 판정, undo 단일화, 순수 헬퍼 4종)까지 정확히 반영하고, CHANGELOG 항목도 저장소 관례와 동일한 상세도로 추가되었으며 어느 것도 코드와 어긋나지 않는다. `dragSource` 개명·`openNodeSearchPopupAt` 통합·`skipUndo` 옵션에 대한 인라인 주석도 실제 동작과 일치한다. 유일한 잔여 관찰 사항은 `skipUndo` 계약이 주석으로만 존재하고 이를 직접 검증하는 단위 테스트가 없다는 점과, 선택 사항으로 분류됐던 spec Rationale 보강이 여전히 비어 있다는 점인데 둘 다 차단 수준은 아니다.

## 위험도
LOW
