# 테스트(Testing) 리뷰

## 발견사항

- **[WARNING]** `findById` 의 `nodeExecutions[].error` copy-on-change 최적화가 참조 동일성(reference identity)으로 검증되지 않는다 — 최적화를 무효화하는 회귀가 스위트를 통과한다
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:627-636` (구현) / `codebase/backend/src/modules/executions/executions.service.spec.ts:1031-1057`(`⑤-b` 테스트)
  - 상세: 구현은 `ne.error == null ? ne : {...ne, error: redactStoredErrorForResponse(ne.error)}` 로, `error` 가 없는 행(정상 종료 행 = 절대다수)은 **원본 참조를 그대로** 반환해 불필요한 shallow-copy 를 피한다. 이 자체가 `17_12_34` 라운드의 performance WARNING(`nodeExecutions` 무조건 spread) 을 고친 결과이고, 주석도 "이 조회에는 `take` 상한이 없어 … 대규모 ForEach 실행에서 불필요한 shallow-copy 가 행 수만큼 쌓인다" 며 성능 근거를 명시한다. 그런데 이를 지키는 유일한 테스트(`⑤-b nodeExecutions 의 다른 필드는 보존한다`)는 `expect(result.nodeExecutions[0]).toMatchObject({...})` 로 **값**만 비교한다. 삼항 조건을 지우고 항상 `{...ne, error: redactStoredErrorForResponse(ne.error)}` 로 되돌리는 뮤턴트를 넣어도 필드 값은 동일하므로 이 테스트는 그대로 GREEN 이다 — 즉 "이 최적화가 실제로 적용되고 있는지"를 검증하는 테스트가 스위트에 없다. 방금 review round(`17_12_34`)에서 지적·수정된 항목이라 회귀 위험이 특히 크다.
  - 제안: `⑤-b` 또는 별도 케이스에서 `error: null` 인 노드에 대해 `expect(result.nodeExecutions[0]).toBe(theOriginalNodeExecObject)` 형태로 참조 동일성을 단언한다(테스트가 넘겨준 fixture 객체를 보관해두고 비교). 이렇게 하면 "항상 spread" 로 되돌리는 회귀를 RED 로 잡는다.

- **[INFO]** `stop()` 마스킹 커버리지가 `stopInternal` 의 4개 반환 지점 중 `WAITING_FOR_INPUT` 분기를 거치지 않는다
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:805-850`(`stop`/`stopInternal`, JSDoc 이 "반환 지점이 **넷**" 이라고 명시) / `codebase/backend/src/modules/executions/executions.service.spec.ts:935`(`④ stop`), `:962`(`④-b affected=0`) — 둘 다 초기 상태가 `RUNNING` 이라 원자 UPDATE 분기(`affected=1`/`affected=0`)만 실행되고, `WAITING_FOR_INPUT → engine.cancelWaitingExecution → updated ?? execution`(라인 830-850) 경로는 새 "표면 전수" describe 블록에서 마스킹이 직접 단언되지 않는다.
  - 상세: `stop()` 이 `stopInternal()` 의 반환값을 **바깥 단일 지점**(`toResponseExecution`)에서 감싸므로 어느 내부 분기를 타든 마스킹 자체의 기능적 위험은 낮다. 다만 이 함수의 JSDoc 이 "반환 지점 넷" 을 근거로 리팩터링 이유를 설명하는데, 신설 describe 블록(`Execution.error 응답 마스킹 — 표면 전수`)의 취지 자체가 "독립 표면 넷 + 재사용 둘을 각각 겨눈다" 이므로 문서가 명시한 분기 수와 실제 커버된 분기 수가 어긋난다.
  - 제안: 필수는 아니나, `waiting` 상태 fixture + `engine.cancelWaitingExecution` 성공 경로에서도 `error` 마스킹을 단언하는 케이스를 하나 추가하면 "표면 전수" 주장과 테스트가 정확히 일치한다.

## 요약

핵심 신규 로직(`redactStoredErrorForResponse` 및 4개 소비처 — `findById`/`findByWorkflow`/`getChain`/`stop`, `background-runs.service.ts`의 `toNodeExecutionDto`)에 대한 테스트는 전반적으로 충실하다. 특히 `redact-stored-error.spec.ts` 는 null/undefined 정규화, 비변이(non-mutation) 보장, JSDoc 이 약속한 레거시 문자열·숫자 통과, 그리고 "보장의 경계"(자격증명 없는 문자열·평범한 메시지는 무변화)를 캐너리 테스트로 고정해 향후 패턴 확장이 조용히 넓어지는 것을 막는 등 모범적이다. `executions.service.spec.ts` 의 신규 `describe` 블록은 "한 헬퍼를 한 번만 검증하면 자매 표면 하나가 빠져도 초록"이라는 이 저장소의 반복 결함 형태를 정확히 겨냥해 4개 표면(`findById`/`findByWorkflow`/`getChain`/`stop`)과 형제 필드 우회(`nodeExecutions[].error`)를 각각 독립적으로 단언하고, `stop()` 의 캐시·`affected=0` 분기까지 구분해 테스트한다. `eW-ok` 테스트의 `toBe`→`toMatchObject`+`not.toMatchObject` 치환도 원래 단언 의도(참조가 아니라 "stale 값이 아님")를 정확히 보존한 등가 교체다. 유일한 실질 갭은 이번 라운드에 직접 수정된 성능 최적화(copy-on-change)가 값 비교만으로는 판별되지 않는다는 점이며, 참조 동일성 단언 하나로 메울 수 있는 좁은 범위다.

## 위험도

LOW
