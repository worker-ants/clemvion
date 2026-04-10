### 발견사항

- **[WARNING]** `NodesService.bulkCreate`의 TOCTOU(Time-Of-Check-Time-Of-Use) 경쟁 조건
  - 위치: `nodes.service.ts` - `bulkCreate` 메서드
  - 상세: `findByWorkflow`로 기존 라벨을 조회한 후, `nodeRepository.save` 호출 전 사이에 다른 요청이 동일 라벨로 노드를 생성할 수 있습니다. 두 요청이 동시에 중복 검사를 통과하면 모두 저장됩니다.
  - 제안: DB 수준의 유니크 제약(unique constraint on `(workflowId, label)`)을 추가하여 마지막 방어선을 DB에 두거나, 트랜잭션 내에서 `SELECT FOR UPDATE` 또는 advisory lock을 사용하세요.

- **[WARNING]** `NodesService.create` / `assertLabelUnique`의 TOCTOU 경쟁 조건
  - 위치: `nodes.service.ts` - `assertLabelUnique` → `create`
  - 상세: `findOne`으로 중복 확인 후 `save` 사이에 다른 요청이 같은 라벨을 먼저 저장하면 중복이 발생합니다. 이 두 연산은 원자적이지 않습니다.
  - 제안: 동일하게 DB 유니크 제약 추가. `ConflictException`이 이미 throw되도록 설계되어 있으나, `findOne` + `save`는 한 트랜잭션이 아니므로 실제 충돌을 막지 못합니다.

- **[WARNING]** `node-settings-panel.tsx`의 `useMemo` 내에서 `useEditorStore.getState()` 직접 호출
  - 위치: `node-settings-panel.tsx:135-140`
  - 상세: `useMemo` 내에서 `useEditorStore.getState()`를 직접 호출합니다. 이는 React의 렌더링 사이클 외부에서 스토어 상태를 읽는 것으로, 스토어 상태가 변경되어도 `useMemo`는 재계산되지 않습니다(`nodeId`, `label`이 deps로 있어도, 다른 노드의 라벨 변경은 감지 못함). 즉, 다른 노드 라벨이 변경되면 `isDuplicateLabel`이 stale 값을 반환할 수 있습니다.
  - 제안: `useEditorStore((s) => s.nodes)`를 컴포넌트 상단에서 구독하여 사용하세요:
    ```ts
    const nodes = useEditorStore((s) => s.nodes);
    const isDuplicateLabel = useMemo(() => 
      nodes.some((n) => n.id !== nodeId && (n.data as any).label === label),
      [nodes, nodeId, label]
    );
    ```

- **[INFO]** `buildDisambiguatedKeys`의 `nodeMap` 반복 순서 의존성
  - 위치: `expression-resolver.service.ts:30-43`
  - 상세: `Map` 반복 순서는 삽입 순서가 보장되지만, `nodeMap`이 위상 정렬 순서로 구성되지 않은 경우 동일 라벨의 `#N` 번호가 비결정적이 됩니다. 병렬 실행 환경에서 실행 완료 순서가 삽입 순서와 달라질 수 있습니다.
  - 제안: `nodeMap` 구성 시 위상 정렬 순서를 명시적으로 보장하거나, 노드 생성 시간(`createdAt`) 기반으로 정렬하는 것을 권장합니다.

- **[INFO]** `workflows.service.ts`의 `validateUniqueLabels`와 `saveCanvas` 트랜잭션 외부 검증
  - 위치: `workflows.service.ts:275-276`
  - 상세: `validateUniqueLabels`는 트랜잭션 시작 전에 호출됩니다. 동시 요청 시 두 요청 모두 검증을 통과할 수 있으나, `saveCanvas`는 전체 캔버스를 덮어쓰는 방식이므로 실제 저장 시에는 마지막 요청이 이기게 됩니다. 중복 데이터가 DB에 남는 위험보다는 덮어쓰기로 인한 데이터 손실 위험이 더 큽니다.
  - 제안: 현재 구조에서 큰 문제는 없으나, 버전 번호(`currentVersion`) 기반 낙관적 잠금(optimistic locking)을 활용하면 동시 저장 충돌을 방지할 수 있습니다.

---

### 요약

이번 변경사항은 주로 노드 라벨 유니크 정책 적용과 중복 라벨 disambiguate 로직 추가에 관한 것입니다. 핵심 동시성 이슈는 `NodesService`의 `assertLabelUnique`와 `bulkCreate`에서 발생하는 TOCTOU 경쟁 조건입니다. 두 요청이 거의 동시에 같은 라벨로 노드 생성을 시도하면 애플리케이션 수준의 중복 검사를 모두 통과해 실제 중복 저장이 가능하며, 이를 해결하려면 DB 수준 유니크 제약이 필수입니다. 프론트엔드의 `useMemo + getState()` 패턴도 반응성 문제를 야기하므로 수정이 필요합니다.

### 위험도
**MEDIUM**