### 발견사항

---

**[WARNING]** `SUB_WORKFLOW_TIMEOUT` async 경로의 통합 테스트 누락
- 위치: `workflow.handler.spec.ts` — `execute - error propagation` describe 블록
- 상세: `mapSubWorkflowError`의 timeout 분기는 sync 경로만 통합 테스트로 커버됨(`executeInline` reject). `executeAsync`가 timeout 메시지로 reject하는 경우 — async 경로에서도 `buildSubWorkflowError`를 타지만 해당 경로의 통합 테스트가 없음. unit 테스트는 패턴 매칭만 검증하므로 `buildSubWorkflowError` 호출까지의 전체 경로가 미검증
- 제안:
  ```ts
  it('maps "timed out" → SUB_WORKFLOW_TIMEOUT (async path)', async () => {
    mockExecutor.executeAsync.mockRejectedValue(
      new Error('Sub-workflow execution timed out after 300000ms'),
    );
    const result = (await handler.execute(
      {},
      { workflowId: 'sub-wf-1', mode: 'async' },
      context,
    )) as unknown as ErrorResult;
    expect(result.port).toBe('error');
    expect(result.output.error.code).toBe(ErrorCode.SUB_WORKFLOW_TIMEOUT);
  });
  ```

---

**[WARNING]** `SUB_WORKFLOW_QUEUE_FAILED` sync 경로의 통합 테스트 누락
- 위치: `workflow.handler.spec.ts` — `execute - error propagation` describe 블록
- 상세: 큐 실패 케이스는 async 경로만 통합 테스트로 커버됨. `buildSubWorkflowError`는 공유 메서드라 sync 경로에서도 호출 가능하지만, sync에서 queue 관련 오류가 발생하는 시나리오에 대한 통합 테스트 없음. 대칭성 검증이 불완전함
- 제안: async 경로 테스트와 대칭이 되도록 sync 경로 케이스를 추가하거나, 주석으로 "semantic하게 async 전용" 임을 명시해 의도적 생략임을 문서화

---

**[WARNING]** spec §5.3 JSON 예시와 구현 불일치
- 위치: `spec/4-nodes/2-flow/1-workflow.md` §5.3 Case JSON 블록
- 상세: 예시 JSON은 `"code": "SUB_WORKFLOW_FAILED"`, `"message": "Workflow not found: wf_uuid_9999"`를 보여주지만, 새 `mapSubWorkflowError` 구현에 따르면 이 메시지는 `SUB_WORKFLOW_NOT_FOUND`로 매핑됨. spec 예시가 구현과 상반된 동작을 문서화
- 제안: spec §5.3 JSON 예시의 `code`를 `"SUB_WORKFLOW_NOT_FOUND"`로 수정

---

**[INFO]** 비-Error 객체 throw 시 `buildSubWorkflowError` 동작 미검증
- 위치: `workflow.handler.ts:175` / `workflow.handler.spec.ts`
- 상세: `buildSubWorkflowError`는 `err instanceof Error ? err.message : String(err)`로 처리하지만, `throw 'plain string'` 또는 `throw { code: 'x' }` 같은 비-Error 케이스에 대한 테스트 없음. 실제로 발생 가능한 경로임
- 제안:
  ```ts
  it('handles non-Error thrown values gracefully', async () => {
    mockExecutor.executeInline.mockRejectedValue('plain string error');
    const result = (await handler.execute(
      {},
      { workflowId: 'sub-wf-1', mode: 'sync' },
      context,
    )) as unknown as ErrorResult;
    expect(result.port).toBe('error');
    expect(result.output.error.message).toBe('plain string error');
  });
  ```

---

**[INFO]** `mapSubWorkflowError` — `"queue error occurred"` 경계 미문서화
- 위치: `workflow.handler.spec.ts` — `mapSubWorkflowError (unit)` describe 블록
- 상세: 구현은 `queue` + (`failed` | `enqueue` | `reject`) 조합을 요구함. `"queue error occurred"`는 `queue`는 포함하나 실패 마커(`failed`/`enqueue`/`reject`)가 없으므로 `SUB_WORKFLOW_FAILED`를 반환함. 이 경계가 직관적이지 않을 수 있으나 테스트에 문서화되어 있지 않음
- 제안: 기존 `"queue is full and idle"` 테스트 옆에 `"queue error occurred"` 케이스를 추가해 경계를 명확히 문서화

---

**[INFO]** 태스크 참조 주석이 테스트 코드에 잔류
- 위치: `error-codes.spec.ts:28`, `workflow.handler.spec.ts` 다수
- 상세: `// Sub-workflow specific codes added in Phase 1 A-3.`, `// D-1: sync result is wrapped...`, `// A-2: async output is enriched...` 등 태스크/Phase 번호를 참조하는 주석이 테스트 코드에 포함됨. CLAUDE.md 규약("현재 작업·수정·호출자를 참조하지 않는다")에 위배되며 시간이 지나면 의미 없어짐
- 제안: 태스크 번호 제거, 불변적인 설계 의도만 남김. 예: `// D-1:` → 없애거나 `// 서브 워크플로우 출력은 shape 불변성을 위해 result 키로 1단 래핑`

---

**[INFO]** `undefined` 반환 케이스 미커버
- 위치: `workflow.handler.spec.ts` — `wraps even primitive / null sub-workflow outputs`
- 상세: `null`은 테스트하지만 `executeInline`이 `undefined`를 반환하는 경우는 없음. TypeScript 타입상 허용 범위이며, `{ result: undefined }`와 `{ result: null }`은 JSON 직렬화 시 다르게 처리됨
- 제안: 낮은 우선순위이나 대칭 케이스로 추가 가능

---

### 요약

전체적으로 테스트 커버리지는 우수하다. `mapSubWorkflowError`를 별도 export해 unit 테스트를 분리한 설계는 올바르며, `ErrorResult` 타입 추출로 중복 캐스팅을 제거한 점도 명확성을 높인다. 핵심 갭은 **async/sync 경로의 통합 테스트 대칭성**으로, `SUB_WORKFLOW_TIMEOUT`은 sync만, `SUB_WORKFLOW_QUEUE_FAILED`는 async만 통합 테스트로 검증되어 있다. 단일 `buildSubWorkflowError` 메서드를 공유하므로 실제로는 양쪽 다 동작하지만, 회귀 방지망이 절반만 설치된 상태다. spec §5.3 JSON 예시의 에러코드 불일치는 테스트가 아닌 문서 레벨 버그이므로 함께 수정이 필요하다.

### 위험도

**LOW** — unit/통합 테스트 모두 존재하며 핵심 동작은 검증됨. 미커버 경로는 대칭 케이스와 엣지 케이스에 국한되고, 실제 패턴 매칭 로직은 unit 테스트로 완전히 커버됨.