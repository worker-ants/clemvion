## 발견사항

---

### [WARNING] `arrow-*-bright` 마커가 일반 마커와 동일 색상 — 미완성 구현
- **위치**: `custom-edge.tsx` `EdgeMarkerDefs` (L184–199), `markerId` 계산 로직 (L53–56)
- **상세**: 하이라이트/선택 상태를 위한 `arrow-data-bright` 등 `-bright` 마커 4종이 일반 마커와 동일한 `PORT_TYPE_COLORS` 값으로 정의되어 있습니다. `markerId` 로직이 두 종류를 구분하지만 실제로 시각적 차이가 없어, 관련 코드가 상위 레이어(CSS `opacity`, `strokeWidth`)에서 이미 강조를 처리하고 있음에도 불구하고 중복 마커 8종이 SVG `<defs>`에 등록됩니다.
- **제안**: bright 마커를 제거하고 `markerId`를 `arrow-${portType}` 단일 패턴으로 통일하거나, 실제 밝기 차이를 적용하여 의도를 명확히 하세요.

---

### [WARNING] `getMarkerIdForPortType` 함수 — 테스트는 있으나 프로덕션 미사용
- **위치**: `edge-utils.ts` (L59–65), `edge-utils.test.ts` (L58–65)
- **상세**: 이 함수는 export되고 테스트에서 검증되지만, `custom-edge.tsx`에서는 `` `arrow-${portType}` `` 템플릿 리터럴로 마커 ID를 직접 구성합니다. 유틸리티 모듈 안에서 동일 목적의 두 가지 방식이 공존합니다.
- **제안**: `custom-edge.tsx`에서 이 함수를 호출하도록 통일하거나, 함수를 제거하고 테스트도 삭제하세요.

---

### [WARNING] 레거시 마커 `arrow`, `arrow-selected` — 실사용 여부 불명확
- **위치**: `custom-edge.tsx` `EdgeMarkerDefs` (L200–203)
- **상세**: 포트 타입 기반 마커 시스템으로 전환되었으나 "Legacy markers for backward compatibility"라는 주석과 함께 구 마커가 유지됩니다. 이번 변경의 범위 어디에도 이 마커를 참조하는 코드가 없습니다.
- **제안**: 코드베이스 전체에서 `url(#arrow)`, `url(#arrow-selected)` 참조 여부를 확인하고, 없다면 제거하세요.

---

### [INFO] `interactionWidth: 20` 추가 — 하이라이팅 범위 외 UX 변경
- **위치**: `workflow-canvas.tsx` `defaultEdgeOptions` (L399–403)
- **상세**: 엣지 클릭 히트 영역을 20px로 확장하는 변경입니다. 엣지 시각화 기능과 관련이 있으나 하이라이팅 또는 포트 색상 분류와 직접적인 연관은 없습니다. 독립된 UX 개선으로 별도 커밋으로 분리하는 것이 이력 추적에 유리합니다.

---

### [INFO] `hoveredEdgeNodes` 기반 노드 글로우 효과 — 명시적 요구사항 외 기능
- **위치**: `workflow-canvas.tsx` (L421–430)
- **상세**: 엣지 hover 시 연결된 source/target 노드에 `box-shadow` 효과를 추가합니다. 이 효과는 "엣지 하이라이팅" 범위를 넘어 노드 시각 상태까지 변경하는 것으로, 엣지 관련 변경 외에 노드 렌더링에 영향을 줍니다. 구현 방식(동적 `<style>` 태그)도 다른 리뷰어들이 아키텍처/보안 관점에서 지적한 안티패턴입니다.

---

## 요약

변경 범위는 전체적으로 엣지 포트 타입 색상화, 하이라이팅, hover 상태 관리라는 단일 맥락 안에 일관되게 집중되어 있으며, 무관한 파일 수정이나 의도 외 리팩토링은 없습니다. 다만 `-bright` 마커가 동일 색상으로 정의되어 미완성 구현이 코드에 잔류하는 점, `getMarkerIdForPortType` 유틸리티가 실제로 사용되지 않아 테스트와 구현이 따로 노는 점, 레거시 마커가 참조 없이 유지되는 점이 범위 내 코드 품질 문제로 남아 있습니다. `interactionWidth` 추가와 노드 글로우 효과는 핵심 기능 외 소폭의 범위 확장에 해당하나 치명적이지 않습니다.

## 위험도

**LOW**