### 발견사항

- **[INFO]** 직전 라운드(`16_20_51`) testing 리뷰가 지적한 4개 갭 — `EdgeDataModal` 무테스트, 툴팁 `onMouseEnter`/`onMouseLeave`→`onKeepAlive`/`onDismiss` 배선 미검증, `findLatestResultByNodeId` 셀렉터 무테스트, `summarizeDataForPreview`/`formatBytes` 경계값 미검증 — 이번 라운드에서 모두 실제 테스트로 해소됨(확인됨, 결함 아님)
  - 위치: `codebase/frontend/src/components/editor/canvas/__tests__/edge-data-preview.test.tsx`(`EdgeDataModal` describe 4케이스 + mouseEnter/mouseLeave 배선 1케이스), `codebase/frontend/src/lib/stores/__tests__/execution-store.test.ts`(`findLatestResultByNodeId` describe 4케이스: 정상조회·부재→undefined·Loop 다중실행 최신값·stale-index→undefined), `codebase/frontend/src/lib/utils/__tests__/edge-data-preview.test.ts`(배열 5/6개, 객체 20/21개 필드, `formatBytes` 1024/1024² 경계 각 2케이스).
  - 상세: CHANGELOG 가 주장하는 테스트 수(util 13 / hook 6 / RTL 8 / store selector 4 = 총 31)가 실제 diff 의 테스트 개수와 정확히 일치한다(직접 카운트 확인). `formatBytes` 경계 테스트도 구현(`bytes < 1024`, `bytes < 1024*1024` strict-less-than 분기)과 부호까지 정확히 맞아떨어진다(`formatBytes(1024)` → "1.0 KB", `formatBytes(1024*1024-1)` → "1024.0 KB"). stale-index 테스트는 `row?.nodeId === nodeId` 방어 분기를 raw `setState` 로 정확히 재현한다. 이전 라운드의 "고쳤다고 주장했지만 회귀 가드 없음" 패턴이 이번엔 재발하지 않았다.

- **[INFO]** `EdgeDataModal` "정상 데이터" 렌더 단언이 과도하게 느슨함(`toContain("1")`)
  - 위치: `codebase/frontend/src/components/editor/canvas/__tests__/edge-data-preview.test.tsx` — `it("정상 데이터는 JsonContent 로 축약 없이 전체를 렌더한다", ...)`
  - 상세: `expect(pre?.textContent).toContain("1")` 는 "배열이 축약 없이 전개됨"을 검증하려는 의도이나, `"1"` 은 JSON pretty-print 결과 어디에나(들여쓰기 공백 뒤 숫자, 다른 필드 값의 일부 등) 우연히 매치될 수 있어 실제로 배열 `[1, 2, 3]` 이 축약(`"[3 items]"`) 되어도 이 단언은 여전히 통과할 가능성이 있다(예: 축약 시 `"items": "[3 items]"` 문자열 안에도 다른 숫자가 없어 이 케이스에선 우연히 실패하겠지만, 값이 조금만 달라지면 오탐 없이 통과해버리는 취약한 단언이다).
  - 제안: `pre?.textContent`가 축약 마커(`"[N items]"`/`"{N fields}"`)를 **포함하지 않음**을 명시적으로 단언하거나(`expect(pre?.textContent).not.toContain("items]")`), 배열 전체가 펼쳐진 형태(`"1,\n      2,\n      3"` 또는 `JSON.stringify([1,2,3], null, 2)` 부분 문자열)를 직접 비교해 의도를 더 정확히 반영.

- **[INFO]** `useEdgeFlowData`/툴팁 소비 경로에 실행 상태(`status`)가 `"completed"` 가 아닌 경우(`"running"`/`"failed"`)에 대한 테스트가 없음
  - 위치: `codebase/frontend/src/components/editor/canvas/__tests__/edge-data-preview.test.tsx` `seedResult` 헬퍼(항상 `status: "completed"` 하드코딩), `codebase/frontend/src/components/editor/canvas/edge-data-preview.tsx` `useEdgeFlowData`(status 필터 없이 `findLatestResultByNodeId` 결과의 `outputData` 를 그대로 unwrap)
  - 상세: 실제 구현은 status 를 전혀 검사하지 않고 "가장 최근 결과의 output 유무"만으로 렌더 여부를 판단한다(코드 상 의도된 동작으로 보임 — 미실행/데이터없음만 걸러냄). 그런데 테스트는 전부 `status: "completed"` 시나리오만 다뤄, "노드가 아직 `running` 이고 부분/미확정 output 이 존재하는 상태에서 hover" 같은 실제 발생 가능한 경로(실행 중 캔버스에 hover)가 검증되지 않는다. 회귀는 아니지만 §3.2(실행 상태 스타일)와 함께 쓰이는 기능인 만큼 실행 도중 hover 시나리오 커버리지가 비어 있다.
  - 제안: `status: "running"`(output 부분 존재)·`status: "failed"`(에러만 있고 output 없음) 케이스를 1~2개 추가해 status 무관 동작이 의도된 것임을 테스트로 고정.

- **[INFO]** 빈 컬렉션(`{}`/`[]`) 데이터에 대한 `isEmpty` 판정 테스트 부재
  - 위치: `codebase/frontend/src/lib/utils/edge-data-preview.ts` `summarizeDataForPreview`(`isEmpty = value === undefined || value === null`), 테스트 `codebase/frontend/src/lib/utils/__tests__/edge-data-preview.test.ts`
  - 상세: 노드 출력이 빈 객체 `{}` 나 빈 배열 `[]` 인 경우 `isEmpty` 는 `false` 로 판정되어 툴팁이 "{}" 를 그대로 보여주는 것이 현재 동작인데, 이 경계가 테스트로 고정돼 있지 않다. UX 상 의도된 것인지(데이터가 있긴 하다) 아니면 "표시할 데이터 없음" 취급이 맞는지 spec 에 명시가 없어 판단이 필요하나, 최소한 현재 동작을 회귀 가드로 고정하는 테스트 추가를 권장.
  - 제안: `summarizeDataForPreview({}).isEmpty === false` / `summarizeDataForPreview([]).isEmpty === false` 를 명시적으로 단언하는 케이스 추가(현재 동작 문서화 목적).

- **[INFO]** `workflow-canvas.tsx` 의 hover→미리보기 배선(`onEdgeMouseEnter`/`onEdgeMouseLeave` → `edgeHoverPreview.show/scheduleHide`, `onOpenModal` 내부의 `dismiss()` 후 `setDataModalEdgeId()` 순서)은 여전히 통합 테스트 사각지대 — 신규 회귀 아님, 기존에 문서화된 갭의 연장
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx`
  - 상세: 훅(`useEdgeHoverPreview`)과 컴포넌트(`EdgeDataPreviewTooltip`/`EdgeDataModal`)는 각각 격리 단위 테스트로 잘 커버됐지만, 이 둘을 실제로 묶는 `workflow-canvas.tsx` 배선 자체(예: `event.clientX`/`clientY` 를 그대로 좌표로 사용하는지, 모달 오픈 시 `dismiss()` 를 먼저 호출해 툴팁이 사라지는지)는 캔버스 전체에 대한 RTL 하네스가 없어 검증되지 않는다. `plan/in-progress/spec-sync-edge-gaps.md` 가 이미 `workflow-canvas.tsx` God-component 문제와 캔버스 통합 테스트 하네스 부재를 별도 이월 항목으로 추적 중이므로 이번 PR 만의 신규 결함은 아니다.
  - 제안: 우선순위 낮음 — plan 에 이미 추적 중인 "§4 오케스트레이션 정리" 후속 작업 시 canvas 통합 테스트 하네스와 함께 이 배선도 포함.

### 요약

이번 라운드는 직전(`16_20_51`) testing 리뷰가 지적한 핵심 갭 4건(EdgeDataModal 무테스트·mouseEnter/leave 배선 미검증·`findLatestResultByNodeId` 무테스트·경계값 미검증)을 모두 실제 테스트로 정확히 해소했다 — CHANGELOG 가 주장하는 테스트 개수(31개)가 diff 실측과 일치하고, 각 테스트가 겨냥한 방어 로직(stale-index, 정확한 `< 1024`/`< 1024*1024` 분기, 배열/객체 정확 경계)과도 정밀하게 대응한다. mock 사용은 실제 Zustand 스토어 + `vi.useFakeTimers()` 위주로 절제돼 있고, `beforeEach`/`afterEach` 로 스토어·타이머·DOM 을 매번 초기화해 테스트 간 격리도 양호하며, 테스트명이 검증 의도(§ 섹션 참조 포함)를 한국어로 명확히 서술해 가독성도 좋다. 남은 지적은 모두 병합을 막을 수준이 아닌 INFO — 모달 테스트의 다소 느슨한 단언(`toContain("1")`), status 변형(running/failed)·빈 컬렉션(`{}`/`[]`) 같은 부차적 경계 케이스 미검증, 그리고 이미 plan 에 추적 중인 canvas 레벨 통합 테스트 하네스 부재 — 뿐이다.

### 위험도
LOW
