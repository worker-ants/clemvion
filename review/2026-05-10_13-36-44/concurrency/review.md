## 발견사항

- **[INFO]** `_executedNodes` Set 공유 변이 — 병렬 노드 컨텍스트에서의 잠재 위험
  - 위치: `workflow.handler.ts` — `executeInline` 호출부 (`executedNodes: context._executedNodes`)
  - 상세: `context._executedNodes`(`Set<string>`)는 부모 실행 컨텍스트와 인라인 서브 워크플로우가 동일 참조를 공유한다. `parallel` 노드처럼 여러 브랜치를 `Promise.all`로 동시에 실행하는 경우, 브랜치 안에 Workflow(sync) 노드가 있으면 여러 `executeInline` 호출이 동일 Set에 동시적으로 항목을 추가한다. Node.js의 단일 스레드 특성 덕분에 Set 연산 자체는 atomic하지만, **"Set 멤버십 확인 → await → Set 삽입"** 패턴이 await 경계에서 인터리브되면 엔진의 "이미 실행된 노드 건너뛰기" 로직이 오탐할 수 있다.
  - 제안: 이번 변경에서 도입된 로직은 아니며, 본 PR의 범위 밖이다. 단, sync 서브 워크플로우를 병렬 실행할 가능성이 있는 엔진 경로에서는 `new Set(context._executedNodes)`로 Set을 격리하거나, 엔진 레벨에서 병렬 브랜치별로 독립된 Set 슬라이스를 사용하는 방안을 검토할 것을 권장한다.

- **[INFO]** `mapSubWorkflowError` — 메시지 기반 분류의 구조적 취약성
  - 위치: `workflow.handler.ts:mapSubWorkflowError`
  - 상세: executor가 던지는 plain `Error` 메시지의 문자열 패턴에 의존한다. executor 내부 메시지가 리팩토링되면 `SUB_WORKFLOW_FAILED` fallback으로 강등되어 오진단이 발생한다. 동시성 이슈는 아니지만 분류 함수가 exported되어 있으므로 향후 executor가 구조화된 에러 타입을 노출할 때 이 함수를 교체 지점으로 명확히 마킹해두는 것이 좋다.
  - 제안: 주석에 이미 "until the executor exposes a structured error type"라고 명시되어 있어 의도는 명확하다. 추가 조치 없이 현 상태 유지 가능.

---

## 요약

변경된 코드(`error-codes.ts` 상수 추가, `mapSubWorkflowError` 순수 함수, sync 출력 1단 래핑, async 출력 필드 보강)는 모두 불변값 반환 또는 로컬 스코프 연산이며 공유 가변 상태를 신규 도입하지 않는다. Node.js 단일 스레드 환경에서 `await` 가 올바르게 사용되고 있고, `buildSubWorkflowError`는 동기 메서드로 적절히 호출된다. 유일한 잠재 위험인 `_executedNodes` Set 공유는 이번 PR 이전부터 존재하던 설계이며, 이번 변경이 해당 위험을 악화시키지는 않는다.

### 위험도
**LOW**