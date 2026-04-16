## 발견사항

### [WARNING] 공유 `context.nodeOutputCache` 변이 (의도적이나 문서화 필요)
- **위치**: `execution-engine.service.ts`, `runParallel()` 내
- **상세**: `runParallel`이 완료된 후 `context.nodeOutputCache[parallelNode.id]`에 `_selectedPort: PARALLEL_DISPATCHED_PORT`를 직접 삽입합니다. 이 변이는 `branchParentContext`의 shallow spread를 통해 모든 브랜치 컨텍스트와 공유되는 원본 캐시 객체를 수정합니다. 설계상 의도적이지만, 컨텍스트를 사후에 읽는 코드에 예기치 않은 `_selectedPort` 값이 노출됩니다.
- **제안**: 주석을 추가하거나, 가능하면 캐시를 복사 후 수정하여 원본 오염을 방지하세요.

---

### [WARNING] 병렬 브랜치 간 `executedNodes` Set 공유
- **위치**: `execution-engine.service.ts`, `executeParallelBranchBody()` 및 `runParallel()`
- **상세**: `executedNodes: Set<string>`이 모든 병렬 브랜치에 동일 참조로 전달됩니다. `planParallelBody`의 배타적 바디 보장(exclusive body guarantee)으로 동일 노드 ID 충돌은 방지되지만, Node.js 이벤트 루프의 비동기 특성상 복합 연산(check → add) 사이에 다른 브랜치의 add가 끼어들 수 있습니다. 현재 로직에서는 실제 문제가 발생할 가능성은 낮지만 fragile한 구조입니다.
- **제안**: 브랜치별로 local `executedNodes` Set을 생성하고, 완료 후 메인 Set에 병합하는 구조를 검토하세요.

---

### [WARNING] `mockConfigService` 테스트 격리 누락
- **위치**: `execution-engine.service.spec.ts`, 마지막 `describe('Parallel execution ...')` 블록
- **상세**: `mockConfigService.get.mockImplementation(...)` 호출 후 `afterEach`에서 복원하지 않습니다. Jest가 `clearMocks: true`로 설정되지 않았다면, 이 `describe` 블록이 다른 `describe` 블록보다 앞에 위치할 때 ConfigService 상태가 후속 테스트에 누출됩니다.
- **제안**: 해당 `it` 블록 내에 `afterEach(() => mockConfigService.get.mockReset())` 또는 `mockRestore()`를 추가하세요.

---

### [WARNING] `runParallel` 이후 `continue` 없음 — 이중 `propagateReachability` 실행
- **위치**: `execution-engine.service.ts`, 메인 실행 루프 내 parallel 처리 블록
- **상세**: `await this.runParallel(...)` 완료 후 `continue` 없이 다음 코드로 흘러 `waiting_for_input` 체크 및 `propagateReachability`가 다시 호출됩니다. `PARALLEL_DISPATCHED_PORT` 센티넬이 브랜치 재활성화를 막고, join 노드는 이미 `reachable`에 추가되어 있어 현재는 이중 호출의 실질적 부작용이 없습니다. 그러나 향후 `propagateReachability` 로직이 변경될 때 silent regression 위험이 있습니다.
- **제안**: `await this.runParallel(...)` 이후 명시적 `continue`(또는 early return 구조)를 추가하여 의도를 명확히 하세요.

---

### [INFO] `parallel` 노드를 OVERRIDE_REGISTRY에 추가하면서 스키마에는 `widget: 'switch'` 선언
- **위치**: `override-registry.ts`, `parallel.schema.ts`
- **상세**: `parallel.schema.ts`의 `waitAll` 필드는 `widget: 'switch'`로 선언되어 있으나, auto-form 렌더러가 지원하지 않아 OVERRIDE_REGISTRY에 수동 UI를 등록했습니다. 스키마 메타데이터와 실제 렌더링 방식이 불일치합니다. 스키마를 보는 도구나 문서화 시스템이 `switch` 위젯으로 오해할 수 있습니다.
- **제안**: 스키마의 `widget`을 `'checkbox'`로 수정하거나, 주석으로 `switch` 위젯 지원 예정임을 명시하세요.

---

### [INFO] `parallel.schema.ts`의 `widget: 'switch'`는 `UiHint` 인터페이스에 미등록
- **위치**: `node-component.interface.ts`, `UiHint.widget` 유니온 타입
- **상세**: `UiHint.widget`의 허용 값 목록에 `'switch'`가 포함되어 있지 않습니다. 타입스크립트 컴파일 시 오류가 발생하거나 무시될 수 있습니다.
- **제안**: `UiHint.widget` 유니온에 `'switch'`를 추가하거나 `'checkbox'`로 변경하세요.

---

### [INFO] `backend/package.json` transformIgnorePatterns 확장
- **위치**: `package.json`, `jest.transformIgnorePatterns`
- **상세**: `p-limit`과 `yocto-queue`가 ESM-only 패키지이므로 ts-jest가 변환하도록 예외 패턴을 추가한 것은 올바른 조치입니다. 다른 ESM 패키지가 추가될 때도 동일하게 패턴을 갱신해야 합니다. 부작용 없음.

---

## 요약

이번 변경은 Parallel 노드의 동시 실행을 지원하는 `ParallelExecutor`를 도입하고, 기존 `executionPath` 경쟁 조건을 `executionPathChain` 직렬화로 해소한 점에서 전반적으로 잘 설계되어 있습니다. 주요 부작용 위험은 병렬 브랜치 간 공유 참조(`nodeOutputCache`, `executedNodes`)에서 발생하나, `planParallelBody`의 배타적 노드 집합 보장으로 현재 시나리오에서는 실질적 충돌이 억제됩니다. 그러나 `runParallel` 이후 `continue` 누락, `mockConfigService` 테스트 격리 부재, `widget: 'switch'` 타입 불일치 등 향후 회귀 가능성이 있는 구조적 취약점이 존재합니다.

## 위험도

**MEDIUM**