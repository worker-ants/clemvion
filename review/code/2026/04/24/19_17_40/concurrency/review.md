### 발견사항

변경된 코드는 동시성·병렬 처리와 직접적인 관련이 적으나, 아래 사항을 검토하였습니다.

- **[INFO]** 모듈 스코프 expression 캐시 (`system-prompt.ts`)
  - 위치: `buildSystemPrompt` / `resetExpressionCacheForTesting`
  - 상세: `expressionSection` 생성에 사용되는 캐시가 모듈 레벨에 존재합니다. Node.js는 단일 스레드이므로 동기 코드에서 진정한 race condition은 발생하지 않습니다. 그러나 NestJS가 `worker_threads` 기반으로 실행될 경우 동일 모듈 캐시를 여러 스레드가 공유하게 됩니다. 현재 구조상 캐시는 읽기 전용에 가까운(lazy-init) 패턴이므로 실질적 위험도는 낮습니다.
  - 제안: `resetExpressionCacheForTesting`는 테스트 전용임을 타입 수준에서 강제하는 것으로 충분합니다. worker threads 도입 시점에 재검토하세요.

- **[INFO]** `ShadowWorkflow.sortedKnownTypesCache` lazy-init 패턴
  - 위치: `shadow-workflow.ts` — `getSortedKnownTypes()`
  - 상세: 인스턴스별 캐시이므로 `ShadowWorkflow`가 요청당 새로 생성되는 현재 구조에서는 공유 문제 없음. `portResolver` 클로저가 캡처하는 `defsByType`도 로컬 스코프입니다.
  - 제안: 현 구조 유지.

- **[INFO]** `mergeRecoveryGroups` 순수 함수 검증
  - 위치: `tool-call-badge.tsx`
  - 상세: 입력 배열을 읽기만 하고 새 배열을 반환하는 순수 함수입니다. `i++` skip이 배열 범위를 넘어가는 경우도 `groups[i+1]`의 `undefined` 체크(`next &&`)로 안전하게 처리됩니다. 동시성 위험 없음.

### 요약

변경된 코드 전반(`ShadowWorkflow` 런타임 포트 노출, `mergeRecoveryGroups` UI 배지 축약, 프롬프트 텍스트 업데이트)은 모두 동기적 순수 함수 변경이거나 요청-로컬 객체 수정입니다. Node.js 단일 스레드 모델에서는 동시성 위험이 없으며, `portResolver` 클로저나 `buildRuntimePorts`에 신규 공유 가변 상태가 도입되지 않았습니다. 모듈 레벨 캐시는 현재 단일 프로세스 서버 구성에서 안전합니다.

### 위험도
**NONE**