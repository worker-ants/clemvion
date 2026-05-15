### 발견사항

---

**[WARNING] `buttonConfig` 출력 형식에 `clickedBy` 필드 제거 — Breaking Change**
- 위치: `spec/4-nodes/6-presentation-nodes.md` — 버튼 포트 출력 형식 (L109)
- 상세: 기존 `"clickedBy": "user-uuid"` 필드가 `"selectedItem": { ... }`으로 교체되었다. 이미 `buttonId`, `buttonLabel`, `clickedAt`과 함께 `clickedBy`를 참조하는 다운스트림 노드(예: Code 노드, Template 노드 표현식, AI Agent 도구)가 존재할 경우 해당 노드는 `undefined` 값을 참조하게 되어 조용히 잘못된 동작을 유발할 수 있다. `selectedItem`이 추가만 된 것이 아니라 교체이므로 기존 실행 이력 데이터와도 구조 불일치 발생.
- 제안: `clickedBy`를 제거하지 않고 유지하거나, 마이그레이션 가이드를 스펙에 명시. 최소한 "하위호환 주의" 경고 기재.

---

**[WARNING] `buttonConfig.buttonItemMap` 신규 필드 추가 — 처리 코드 미반영 가능성**
- 위치: `spec/4-nodes/6-presentation-nodes.md` — Blocking Mode 실행 로직 6.2
- 상세: 아이템 버튼 ID → 아이템 인덱스 매핑을 `buttonConfig.buttonItemMap`에 저장하도록 스펙이 변경되었다. 그러나 이 필드를 실제로 읽어 아이템 버튼 클릭 시 `selectedItem`을 구성하는 실행 엔진 코드나 WebSocket 이벤트 처리 코드가 `buttonItemMap`의 존재를 인지하지 못하면, 런타임에 `selectedItem`이 항상 `undefined`로 전달되는 부작용이 발생한다. 스펙 변경과 구현 코드 간 누락 가능성이 있다.
- 제안: 실행 엔진 핸들러(`CarouselHandler`)와 인터랙션 처리 코드에서 `buttonItemMap` 조회 로직을 반드시 함께 구현해야 함을 스펙에 명시. 연관 구현 파일 경로를 스펙 하단에 참조로 기재.

---

**[WARNING] Dynamic 모드의 `source` 필드 도입 — 하위호환 실행 경로 분기**
- 위치: `spec/4-nodes/6-presentation-nodes.md` — 실행 로직 3.1
- 상세: "`source` 표현식이 설정되어 있으면 resolve된 결과를 배열로 사용. 미설정 시 입력 데이터를 직접 사용 (하위호환)"으로 기술되어 있다. 기존 워크플로우에서 `source`가 없는 Dynamic 모드 Carousel 노드는 여전히 `$input`을 사용한다. 그런데 `ExpressionResolver.resolveConfig`가 `source` 필드를 새로 해석하는 과정에서 `source: ""` (빈 문자열)나 `source: null`이 "미설정"과 다르게 처리될 경우 기존 워크플로우가 깨질 수 있다.
- 제안: `source` 필드의 "미설정" 판별 조건을 명확히 기술 (`null`, `undefined`, 빈 문자열 모두 "미설정"으로 처리하는지 여부).

---

**[WARNING] `_selectedPort` 자동 제거 동작 — 기존 pass-through 노드 동작 변경**
- 위치: `spec/5-system/4-execution-engine.md` — `_selectedPort` 메타데이터 처리
- 상세: "`_selectedPort`는 다운스트림 노드의 input으로 전달될 때 자동으로 제거(strip)된다"는 새로운 동작이 추가되었다. 만약 기존 Code 노드나 사용자 표현식에서 `$input._selectedPort`를 직접 참조하여 분기 로직을 구현한 워크플로우가 존재할 경우, 이 변경으로 인해 해당 값이 항상 `undefined`가 되어 조용한 로직 오류가 발생한다.
- 제안: 기존 워크플로우 중 `$input._selectedPort`를 사용자가 직접 참조하는 케이스가 있는지 DB 마이그레이션 전 검토. 변경 전후 호환성 노트를 스펙에 추가.

---

**[INFO] Skip Node의 `NodeExecution.error` 필드 추가 — 스키마 변경**
- 위치: `spec/5-system/3-error-handling.md` — L118
- 상세: Skip Node 시 `NodeExecution.error = { message: "..." }`가 보존되도록 변경. 기존에는 `skipped` 상태의 `error` 필드가 항상 `null`이었을 것이므로, 이를 기대하는 클라이언트 코드(예: 실행 상세 페이지에서 `skipped` 노드의 에러 표시 로직)가 예상치 못한 데이터를 렌더링할 수 있다. 특히 실행 상세 페이지의 에러 탭 조건부 노출(`show: !!selectedNode?.error`)이 `skipped` 노드에서도 활성화될 가능성이 있다.
- 제안: 프론트엔드 실행 상세 페이지에서 `skipped` 상태 노드의 에러 탭 표시 여부를 별도로 처리하는 로직 검토.

---

**[INFO] 대시보드 스펙의 행 클릭 동작 변경 — 기존 구현과 불일치 가능성**
- 위치: `spec/2-navigation/0-dashboard.md` — L79-80
- 상세: 기존 "행 클릭(성공) → 실행 상세 뷰", "행 클릭(실패) → 디버그 뷰(실패 노드 하이라이트)"가 "행 클릭 → 실행 상세 페이지로 이동"으로 단일화되었다. 기존에 "실패" 클릭 시 디버그 뷰로 이동하는 로직이 프론트엔드에 구현되어 있다면 이를 제거해야 하며, 누락 시 스펙과 구현의 이중 진입점이 혼재하게 된다.
- 제안: 대시보드 컴포넌트의 행 클릭 핸들러에서 status 분기 로직이 있는지 확인 후 제거.

---

### 요약

이번 변경의 핵심 부작용 위험은 `spec/4-nodes/6-presentation-nodes.md`에 집중된다. `clickedBy` → `selectedItem` 교체는 기존 버튼 클릭 출력 데이터를 참조하는 모든 다운스트림 노드와 실행 이력 데이터에 호환성 파괴를 일으키는 Breaking Change이며, `buttonConfig.buttonItemMap` 신규 구조를 실행 엔진이 처리하지 않으면 아이템 버튼의 `selectedItem` 출력이 런타임에 누락된다. `_selectedPort` 자동 제거 동작은 사용자가 이를 직접 참조하던 기존 워크플로우에 조용한 오류를 유발할 수 있고, Skip Node의 `error` 필드 추가는 프론트엔드 에러 탭 표시 조건에 의도치 않은 부작용을 줄 수 있다. 나머지 스펙 파일 변경과 리뷰 파일 추가는 문서 범위에 한정되어 있어 직접적인 코드 부작용은 없다.

### 위험도

**MEDIUM**