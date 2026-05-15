## 발견사항

### **[WARNING]** `TriggerCell`: 미지원 `source` 값에 대한 방어 코드 부재
- 위치: `trigger-cell.tsx:12-22`
- 상세: `TRIGGER_ICON[source]`와 `TRIGGER_LABEL_KEY[source]`는 Record 타입이므로, 백엔드가 새 trigger source 값을 추가해도 TypeScript 컴파일은 통과하지만 런타임에서 `Icon`이 `undefined`가 되어 `<Icon ... />` 렌더링 시 크래시 발생.
- 제안:
  ```tsx
  const Icon = TRIGGER_ICON[source] ?? HelpCircle;
  const labelKey = TRIGGER_LABEL_KEY[source] ?? "executions.triggerSource.unknown";
  ```

---

### **[WARNING]** `dashboard.service.spec.ts`: `executor.name = null` 케이스 미검증
- 위치: `dashboard.service.spec.ts:71-103`
- 상세: `executedBy`가 설정되어 있으나 `executor.name`이 `null`인 경우(사용자 이름 미설정 계정)의 `triggerLabel` 동작이 테스트되지 않음. `deriveExecutionTrigger` 구현에 따라 `null`이 반환될 수 있고, 이 경우 UI에서 `label`이 없는 채로 `manual`만 표시됨.
- 제안: 아래 케이스 추가
  ```ts
  const r = baseFake({ id: 'e4', executedBy: 'u2', executor: { id: 'u2', name: null } });
  // triggerSource: 'manual', triggerLabel: null 임을 명시적으로 검증
  ```

---

### **[WARNING]** `getRecentExecutions`의 `innerJoinAndSelect` — Workflow 전체 컬럼 로드
- 위치: `dashboard.service.ts:145`
- 상세: `innerJoinAndSelect('e.workflow', 'w')`는 Workflow entity 전체(대형 `config` JSON 포함)를 로드함. 실제 사용 필드는 `w.name`뿐이므로 과적재(over-fetch). 같은 파일의 `getRecentWorkflows`와 `executions.service.ts`는 `select([...])` 방식으로 필요한 컬럼만 지정하는 패턴을 따름.
- 제안:
  ```ts
  .innerJoin('e.workflow', 'w')
  .addSelect(['w.id', 'w.name'])
  ```

---

### **[INFO]** `dashboard/page.tsx`: `RecentExecution` 인터페이스 로컬 정의로 인한 API 타입 이중화
- 위치: `dashboard/page.tsx:53-60`
- 상세: `RecentExecution`이 page 내부에 로컬 정의되어 있어 백엔드 `RecentExecutionDto` 변경 시 수동 동기화 필요. `triggerSource`, `triggerLabel` 필드가 이번에는 동기화됐지만 향후 누락 위험 존재.
- 제안: `@/lib/api/dashboard` 또는 `executions` 모듈에서 타입을 export하고 재사용.

---

### **[INFO]** `websocket.gateway.spec.ts`: `as never` 타입 억제
- 위치: `websocket.gateway.spec.ts:144`
- 상세: `ExecutionDetailWithTrigger` 타입이 `triggerSource`, `triggerLabel` 필드를 required로 포함하게 되어 `as never`로 억제. 테스트 동작에는 무관하나 타입 안전성이 약화됨.
- 제안: `{ id: 'exec-abc', triggerSource: 'manual' as const, triggerLabel: null } as ExecutionDetailWithTrigger`

---

### **[INFO]** `executions/page.tsx` 불필요한 빈 줄
- 위치: `executions/page.tsx` (로컬 `TriggerCell` 함수 제거 직후)
- 상세: diff에서 제거 후 공백 라인 1개 잔여. 기능 영향 없으나 정리 누락.

---

## 요약

이번 변경은 대시보드 최근 실행 위젯에 Trigger 출처 컬럼을 추가하는 요구사항을 전반적으로 충실히 구현했다. 핵심 로직(`deriveExecutionTrigger`, `loadParentWorkflowNames`)은 executions 모듈과 dashboard 모듈이 공유하도록 적절히 추출되었고, PII 보호(email 미노출), N+1 방지(부모 워크플로명 배치 로드), TypeORM orderBy 버그 재발 방지 등 부가 요구사항도 테스트로 명시되어 있다. 다만 `TriggerCell`이 미래에 추가될 trigger source 값에 대한 런타임 안전망이 없고, `getRecentExecutions`에서 Workflow config JSON을 불필요하게 전부 로드하는 점이 보완이 필요하다.

## 위험도

**LOW**