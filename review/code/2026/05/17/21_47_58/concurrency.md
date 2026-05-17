### 발견사항

- **[WARNING]** `nodeExec` 객체의 비원자적(non-atomic) 변경 후 저장
  - 위치: `execution-engine.service.ts` diff `@@ -2131` 추가 블록 (라인 370-378)
  - 상세: `nodeExec.outputData`를 인메모리에서 직접 변경(`nodeExec.outputData = withInteractionMeta(...)`)한 뒤 `await this.nodeExecutionRepository.save(nodeExec)`를 호출한다. `nodeExec`는 이전 코드 경로에서 로드된 참조 객체이며, multi-turn 흐름에서 동일 `executionId`에 대해 `continueAiConversation`이 짧은 간격으로 두 번 이상 호출될 경우(사용자 빠른 연속 입력, 혹은 재연결 클라이언트의 중복 호출), 두 코루틴이 같은 `nodeExec` 참조를 동시에 변경하여 마지막 write가 앞선 turn의 누적 메시지를 덮어쓸 수 있다. Node.js 단일 이벤트 루프에서 순수 동기 작업은 경쟁하지 않지만, `await` 경계 이후 재개 시점에 다른 `continueAiConversation` 호출이 이미 `nodeExec.outputData`를 변경했을 수 있다. `adaptedNext` 기반의 스프레드 복사(`{ ...adaptedNext }`)는 입력 스냅숏으로는 안전하지만, `nodeExec` 레퍼런스 자체가 공유 상태이므로 `await` 전후 일관성이 깨질 수 있다.
  - 제안: `nodeExec` 를 해당 블록 직전에 fresh로 조회(`findOneBy({ id: nodeExec.id })`)하거나, TypeORM `update(id, { outputData: ... })` 단일 쿼리로 대체해 인메모리 객체 변경 없이 DB를 갱신한다. 후자가 불필요한 DB 왕복을 줄이고 경쟁 위험을 원천 차단한다.

- **[INFO]** `flushPromises` 기반 테스트의 비결정적 타이밍
  - 위치: `execution-engine.service.spec.ts` 추가 테스트 케이스 (라인 83-84, 89-90)
  - 상세: `await service.execute(...)` 후 `await flushPromises()`를 호출하고, `service.continueAiConversation(...)` 이후 또 `await flushPromises()`를 사용한다. `flushPromises`는 `setImmediate`로 구현되어 microtask queue가 비워지는 시점을 기다리지만, 내부적으로 `setTimeout`이나 추가 비동기 체인이 있을 경우 실제 완료 전에 assertion이 실행될 수 있다. 이는 경쟁 조건이 아닌 테스트 신뢰성 문제이나, 간헐적 false-positive 원인이 된다. 또한 `service.continueAiConversation`이 `await` 없이 호출되므로(라인 89), 반환 Promise를 무시한 채 `flushPromises`로만 완료를 보장하는 패턴이다.
  - 제안: `service.continueAiConversation`이 Promise를 반환한다면 `await`로 직접 대기하는 것을 권장한다. 구현 내부가 `setImmediate`/`setTimeout` 기반이 아닌 순수 Promise 체인이라면 `await flushPromises()` 대신 `await service.continueAiConversation(...)` 직접 호출로 변경해 테스트 신뢰성을 높인다.

- **[INFO]** `continueAiConversation` await 누락 (테스트)
  - 위치: `execution-engine.service.spec.ts` 라인 89
  - 상세: `service.continueAiConversation(executionId, 'hi')` 호출 시 반환 Promise에 `await`가 없다. 이후 `await flushPromises()`로 완료를 우회하지만, 예외가 발생할 경우 unhandled rejection으로 소실되어 테스트가 통과한 것처럼 보일 수 있다.
  - 제안: 프로덕션 코드가 아닌 테스트 코드이므로 영향은 제한적이나, `await service.continueAiConversation(executionId, 'hi')` 형태로 수정해 에러 노출을 보장한다.

### 요약

이번 변경의 동시성 관련 핵심은 `execution-engine.service.ts`에 추가된 multi-turn follow-up waiting 분기의 `NodeExecution` 영속 로직이다. `await` 경계가 포함된 코루틴 흐름에서 `nodeExec` 인메모리 참조를 직접 변경한 뒤 저장하는 패턴은 Node.js 단일 이벤트 루프 환경에서도 동일 실행에 대한 연속 `continueAiConversation` 호출이 경합할 경우 last-write-wins 문제를 유발할 수 있다. 나머지 변경(코드 포맷팅 리포맷, `catalog-sync.spec.ts` 경로 수정)은 동시성과 무관하다. 테스트 파일에서 `await` 누락 및 `flushPromises` 의존 패턴은 비결정적 타이밍 문제를 내포한다. 전체적으로 즉각적인 데이터 손실 위험보다는 특정 조건(빠른 연속 입력, 동일 execution 중복 resume)에서 발현되는 잠재적 경쟁 조건으로 평가된다.

### 위험도
MEDIUM
