## 발견사항

### [WARNING] `isContainerAncestor` 예외가 포트명을 검증하지 않음
- **위치**: `shadow-workflow.ts:252-260`, `addEdge` 메서드
- **상세**: 예외 처리 조건이 "자식 → 조상 컨테이너" 구조 자체만 검사하고, target 포트가 실제로 `emit` 같은 iteration 제어 포트인지 확인하지 않음. 예를 들어 `child.out → loop.body` (자식에서 컨테이너의 입력 포트로 역방향 연결)도 동일하게 허용됨. 스펙에서는 "iteration back-edge"를 의도하고 있지만, 구현은 모든 포트에 대해 열려 있음.
  ```typescript
  // 현재: target_port 가 무엇이든 ancestor이면 예외
  if (!this.isContainerAncestor(sourceId, targetId)) {
    if (this.wouldCreateCycle(sourceId, targetId)) { ... }
  }
  ```
- **제안**: `isContainerAncestor` 호출 조건에 `targetPort`가 반복 제어 포트 집합(`emit`, `next` 등)에 속하는지 추가 검사를 고려. 단, 스펙 §4.4가 포트 목록을 명시하지 않으므로 스펙 보완이 선행되어야 함.

---

### [WARNING] `wouldCreateCycle` 내 기존 back-edge 스킵이 교차-컨테이너 간접 순환을 탐지하지 못할 수 있음
- **위치**: `shadow-workflow.ts:331-337`
- **상세**: 탐색 중 `isContainerAncestor(edge.sourceNodeId, edge.targetNodeId)`인 에지를 전부 건너뜀. 이로 인해 "허용된 back-edge + forward edge"의 조합이 실행 그래프 관점에서 순환을 형성하더라도 탐지가 안 되는 경우가 발생. 예: `A → Container → B → (back) → Container` 구조에서 `Container → A`를 추가하면 `wouldCreateCycle`은 B → Container back-edge를 스킵해 "container는 'a'에 도달 불가"로 판단하고 허용 — 실제 실행 흐름은 Container → A → Container로 순환.
  - 단, 이는 **설계상 의도된 동작**으로 보임. 실행 엔진이 back-edge를 containerId 기반으로 분리 처리하므로 forward-only 그래프에서의 DAG 보장이 스펙 목표임.
- **제안**: 스펙 §4.4에 "교차 컨테이너 간 forward edge와 back-edge의 조합이 만드는 순환은 허용 범위인가?"를 명시적으로 기술해 의도를 문서화할 것.

---

### [INFO] `isContainerAncestor` — 무한루프 보호는 정상
- **위치**: `shadow-workflow.ts:343-356`
- **상세**: `visited` 셋으로 containerId 체인의 자기 참조 순환을 보호하고 있으며 올바르게 구현됨. 손상된 데이터에서도 무한루프 없음.

---

### [INFO] 공개 API·시그니처 변경 없음
- **위치**: `ShadowWorkflow` 클래스 전체
- **상세**: `apply()`, `snapshot()` 등 공개 메서드 시그니처와 `ShadowResult` 인터페이스는 변경 없음. `isContainerAncestor`와 수정된 `wouldCreateCycle`은 모두 `private`. 기존 호출자에 대한 인터페이스 부작용 없음.

---

### [INFO] 스펙 문서(`4-ai-assistant.md`) 변경이 구현과 정합
- **위치**: `spec/3-workflow-editor/4-ai-assistant.md:229`
- **상세**: §4.4 검증 규칙에 back-edge 예외 조항이 추가되었고, 구현과 설명이 일치함. 문서 부작용 없음.

---

### [INFO] 테스트 파일 — 전역 상태·파일시스템·네트워크 부작용 없음
- **위치**: `shadow-workflow.spec.ts:319-553`
- **상세**: 새 `describe` 블록은 모두 로컬 `ShadowWorkflow` 인스턴스를 생성해 독립적으로 실행됨. 기존 테스트에 영향 없음. 추가된 4개 케이스가 커버하는 경계 조건(직접 컨테이너, 조상 컨테이너, 무관 컨테이너, top-level regression)은 논리적으로 충분함.

---

## 요약

이번 변경의 핵심 부작용은 **의도된 행동 변화**다 — `addEdge`가 "자식 → 조상 컨테이너" 에지를 순환으로 차단하지 않게 되었고, `wouldCreateCycle`이 이미 허용된 back-edge를 DFS 탐색에서 제외한다. 공개 API, 전역 상태, 파일시스템, 네트워크에 대한 비의도적 부작용은 없다. 주요 리스크는 back-edge 예외가 포트 검증 없이 컨테이너의 모든 포트로 확대 적용된다는 점이나, 이는 스펙 §4.4의 명시적 범위 제한 부재에서 오는 설계 결정 사항이다.

## 위험도

**LOW**