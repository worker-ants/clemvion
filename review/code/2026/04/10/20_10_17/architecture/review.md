### 발견사항

---

- **[CRITICAL]** `isDuplicateLabel` 계산에서 반응성 누락 (React Anti-pattern)
  - 위치: `frontend/src/components/editor/settings-panel/node-settings-panel.tsx:130-136`
  - 상세: `useMemo` 내부에서 `useEditorStore.getState().nodes`를 직접 호출하고 있음. `getState()`는 Zustand 스토어 구독을 생성하지 않으므로, **다른 노드의 라벨이 변경되어도 이 컴포넌트는 재렌더되지 않음**. 결과적으로 동일 패널을 열어두는 동안 다른 노드가 같은 이름으로 변경되더라도 중복 감지가 작동하지 않음.
  - 제안: 컴포넌트 최상단에서 `const nodes = useEditorStore((s) => s.nodes)`로 구독하고, `useMemo` 내부에서는 해당 변수를 참조.

---

- **[WARNING]** 레이블 중복 방지 정책과 중복 허용 안전망 사이의 아키텍처적 모순
  - 위치: `nodes.service.ts`, `workflows.service.ts` (강제 차단) vs `disambiguate-labels.ts` (중복 허용 처리)
  - 상세: 백엔드는 `assertLabelUnique`, `validateUniqueLabels`를 통해 중복 라벨을 차단하는 정책을 강제하지만, `buildDisambiguatedKeys`는 중복이 **실제로 존재하는 경우** `#N` 접미사로 처리하는 로직을 구현함. 이 두 정책은 같은 레이어(서비스)에서 서로 다른 가정(중복 불가 vs 중복 가능)을 기반으로 동작함. 의도는 "강제 + 방어적 안전망"이나, 코드만 보면 불일치처럼 읽힘.
  - 제안: `disambiguate-labels.ts` 및 사용 지점에 명시적 주석으로 "정책상 중복은 금지되나, 데이터 마이그레이션/외부 API 유입 등 경계 케이스를 위한 방어 로직"임을 명시. 스펙 문서(`5-expression-language.md`)에 이미 이 의도가 반영되어 있으나 코드 레벨에서도 명확히 할 필요가 있음.

---

- **[WARNING]** 라벨 중복 방지 명명 규칙 불일치
  - 위치: `generate-unique-label.ts` (프론트엔드) vs `disambiguate-labels.ts` (expression-engine)
  - 상세: 프론트엔드 캔버스에서 노드 추가 시 중복 방지 포맷은 `"HTTP Request 2"` (공백+숫자), 실행 컨텍스트의 `$node` 키 중복 처리는 `"HTTP Request#2"` (`#`+숫자)로 서로 다름. 두 메커니즘은 다른 목적(UI 라벨 생성 vs 표현식 참조 키 생성)으로 의도적으로 분리된 것이나, 동일한 개념("중복 구분")에 다른 포맷을 사용하면 유지보수 중 혼동 가능성이 있음.
  - 제안: 두 유틸리티의 사용 목적 차이(`generateUniqueLabel` = 저장되는 라벨명 생성, `buildDisambiguatedKeys` = 런타임 표현식 키 생성)를 문서화하여 의도적 분리임을 명확히 함.

---

- **[WARNING]** `bulkCreate`의 체크-저장 비원자성 (Race Condition)
  - 위치: `backend/src/modules/nodes/nodes.service.ts:55-80`
  - 상세: 기존 노드를 조회한 뒤(`findByWorkflow`) 중복 검사를 수행하고 저장하는 흐름이 트랜잭션 없이 수행됨. 동시 요청 시 두 요청 모두 중복 없음을 확인한 뒤 같은 라벨로 동시 저장될 수 있음. `create` 메서드의 `assertLabelUnique`도 동일한 문제.
  - 제안: DB 레벨의 유니크 제약(workflow_id + label composite unique index)을 추가하고, ConflictException을 DB 제약 위반에서도 처리하는 방어 코드 추가.

---

- **[INFO]** `buildDisambiguatedKeys`의 패키지 위치 적절성
  - 위치: `packages/expression-engine/src/disambiguate-labels.ts`
  - 상세: 함수 자체는 표현식 평가와 무관한 순수 유틸리티임. `expression-engine` 패키지 이름이 이 함수의 존재를 암시하지 않아, 신규 개발자가 이 유틸리티의 위치를 찾기 어려울 수 있음. 다만 프론트/백엔드 공유를 위해 shared 패키지가 현재 이것 외에 없다면 현실적 선택.
  - 제안: 패키지 내부를 `core/`, `utils/` 등으로 구분하거나, 추후 `@workflow/shared-utils` 패키지 분리를 고려.

---

- **[INFO]** `nodesWithOutput` 2회 순회
  - 위치: `backend/src/modules/execution-engine/expression/expression-resolver.service.ts:28-42`
  - 상세: `nodeMap`을 두 번 순회하여 `nodesWithOutput` 빌드 후 다시 `$node` 맵을 구성함. 단일 순회로 통합 가능.
  - 제안: 기능상 문제는 없으나 가독성 개선 목적으로 단일 순회로 리팩터링 가능.

---

### 요약

이번 변경은 노드 라벨 고유성 정책을 프론트엔드(캔버스 추가/설정 패널)와 백엔드(create/update/saveCanvas) 전 레이어에 일관성 있게 적용하고, 표현식 엔진에 `$node["Label"]` 중복 라벨 안전망(`#N` 접미사) 및 UUID 폴백을 도입한 체계적인 변경이다. `disambiguate-labels.ts`를 공유 패키지에 배치하여 프론트/백엔드 재사용을 확보하고, `resolvedKey` 필드로 라벨과 표현식 키를 분리한 설계는 적절하다. 다만 **`node-settings-panel.tsx`의 `useEditorStore.getState()` 오용으로 인한 반응성 버그**가 치명적이며 즉시 수정이 필요하다. 또한 `bulkCreate`의 비원자적 중복 검사는 DB 레벨 제약 없이는 동시성 문제에 취약하다.

### 위험도

**MEDIUM** (Critical 1건 포함 — 반응성 버그는 런타임 오작동으로 이어지나 데이터 손실은 아님)