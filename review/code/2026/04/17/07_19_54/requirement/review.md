Now I have enough context for a thorough requirements review.

---

## 발견사항

### **[WARNING] `parallel` 노드가 schema-driven auto-form 대신 OVERRIDE_REGISTRY에 등록됨**
- **위치:** `override-registry.ts:63`, `logic-configs.tsx:509-544`
- **상세:** 주석은 `// split, map, foreach, merge are migrated to auto-form (schema-driven)` 이라고 명시하나, `parallel`은 auto-form이 아닌 `ParallelConfig` 커스텀 컴포넌트로 등록되었음. `parallel.schema.ts`에 정성껏 작성된 `label`, `hint`, `widget` 메타가 실제 UI에서 전혀 사용되지 않음. `widget: 'switch'`(존재하지 않는 위젯)가 `waitAll`에 명시된 것도 이 무관성을 보여줌.
- **제안:** 다른 스키마 마이그레이션 노드들과 일관성을 위해 OVERRIDE_REGISTRY에서 제거하고 auto-form 경로로 전환하거나, `widget: 'switch'` → `widget: 'checkbox'`로 수정 후 명시적으로 override가 필요한 이유를 주석에 기재.

---

### **[WARNING] `widget: 'switch'`가 `UiWidget` 타입에 미정의**
- **위치:** `parallel.schema.ts:35`, `node-component.interface.ts:UiHint.widget`
- **상세:** `waitAll` 필드의 메타에 `widget: 'switch'`가 선언되어 있으나 백엔드 `UiHint.widget`과 프론트엔드 `UiWidget` 어디에도 `'switch'`가 없음. zod `.meta()`가 loosely typed이므로 컴파일 오류는 없으나, auto-form이 이 위젯을 렌더링할 수 없어 fallback 처리됨.
- **제안:** `widget: 'checkbox'`로 수정하거나 두 타입 정의에 `'switch'` 추가.

---

### **[WARNING] `waitAll=false` 동작이 요구사항과 불일치 (스펙 §10)**
- **위치:** `execution-engine.service.ts:runParallel`, `parallel-executor.ts`
- **상세:** 스펙 §10은 `waitAll=false` 시 "각 분기 독립적으로 완료 시 다음 노드 진행"을 요구함. 현재 구현은 항상 `Promise.allSettled()`로 전체 완료를 대기하며, 백엔드 경고 로그만 출력함. UI의 안내 텍스트는 있으나, `waitAll=false`로 저장한 사용자가 Phase P2 이전에 실제 동작 차이를 기대할 수 있음.
- **제안:** `waitAll=false` 설정 시 validate에서 명시적 경고를 반환하거나, UI에 Phase P1 제한 배너를 더 명확하게 표시.

---

### **[WARNING] `PARALLEL_ENGINE` 기본값 `'off'` — 병렬 실행이 기본 비활성화**
- **위치:** `execution-engine.service.ts:973`
- **상세:** 스펙은 Parallel 노드가 "여러 분기를 동시에(병렬로) 실행"한다고 정의하나, 환경변수 `PARALLEL_ENGINE=v1`이 없으면 기존 순차 루프로 동작함. 운영 배포 시 env var 미설정 시 Parallel 노드는 브랜치를 순서대로 실행하며, 이는 사용자가 기대하는 동작과 다름.
- **제안:** 배포 문서 또는 `.env.example`에 `PARALLEL_ENGINE=v1` 설정을 명시하고, 미설정 시 노드 실행 경고 로그를 추가.

---

### **[WARNING] `MergeHandler.validate()`에 `partialOnTimeout` 검증 누락**
- **위치:** `merge.handler.ts:19-38`
- **상세:** `MergeConfig` 인터페이스에 `partialOnTimeout?: boolean`이 선언되어 있고 `execute()`에서 사용되나, `validate()`에는 해당 필드 타입 검증이 없음. 비boolean 값이 들어와도 validate 통과.
- **제안:** `if (config.partialOnTimeout !== undefined && typeof config.partialOnTimeout !== 'boolean') { errors.push('...') }` 추가.

---

### **[WARNING] Parallel 노드 `summaryTemplate` 미정의**
- **위치:** `parallel.schema.ts:56-66`
- **상세:** 다른 노드들(`foreach`, `loop`, `merge` 등)은 `summaryTemplate`을 통해 캔버스 카드에 설정 요약을 표시함. `parallelNodeMetadata`에는 `summaryTemplate`이 없어 캔버스에서 설정 내용이 전혀 표시되지 않음.
- **제안:** `summaryTemplate: '{{branchCount}} branches'` 추가.

---

### **[WARNING] `executeParallelBranchBody`에서 빈 브랜치 포트에 대한 로깅 없음**
- **위치:** `execution-engine.service.ts:executeParallelBranchBody`
- **상세:** `planParallelBody`에서 특정 `branch_N` 포트에 연결된 엣지가 없으면 `sortedNodeIds.length === 0`으로 조기 반환함. 사용자가 브랜치를 연결하지 않아도 에러나 경고 없이 조용히 건너뜀. 설정 오류를 감지하기 어려움.
- **제안:** 빈 브랜치 발생 시 `this.logger.warn()` 로깅 또는 validate 단계에서 미연결 브랜치 포트를 경고.

---

### **[INFO] `ParallelConfig.waitAll` 필드가 `ParallelExecutor`에서 미사용**
- **위치:** `parallel-executor.ts:execute()`
- **상세:** `ParallelConfig` 인터페이스에 `waitAll: boolean`이 있으나 executor 내부에서 읽지 않음. Phase P1 제약이므로 의도적이나, 향후 Phase P2 구현 시 누락 위험.
- **제안:** `// Phase P2: waitAll=false 지원 예정` 주석 추가로 명시.

---

### **[INFO] 통합 테스트의 `setTimeout(200ms)` 기반 완료 대기 — 타이밍 의존적**
- **위치:** `execution-engine.service.spec.ts:2644`
- **상세:** `await new Promise((r) => setTimeout(r, 200))`로 비동기 완료를 기다리는 방식은 CI 부하 시 flaky 테스트가 될 수 있음.
- **제안:** 기존 `flushPromises()` 헬퍼를 활용하거나 `service.execute()` 반환 Promise를 직접 await.

---

## 요약

Parallel 실행 Phase P1 구현은 핵심 동시성 로직(`ParallelExecutor`, `planParallelBody`, `executeParallelBranchBody`)을 충실히 구현했고, 에러 정책·concurrency 제한·context isolation 등 스펙 요구사항의 대부분을 충족한다. 다만 `PARALLEL_ENGINE=v1` 미설정 시 병렬 실행이 비활성화되어 기본 동작이 스펙과 다른 점, `waitAll=false`가 설정 가능하지만 실제 동작하지 않는 점, `parallel` 노드가 schema-driven 경로를 우회하는 점이 요구사항 관점의 주요 갭이다.

## 위험도

**MEDIUM**