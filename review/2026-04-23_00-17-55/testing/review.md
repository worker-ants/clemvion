### 발견사항

**[WARNING]** `aliasHit`이 `NODE_TYPE_ALIASES`에 있지만 `knownNodeTypes`에 없는 경우 미테스트
- 위치: `shadow-workflow.ts` → `buildUnknownNodeTypeResult`, `shadow-workflow.spec.ts`
- 상세: `aliasHit && this.knownNodeTypes.has(aliasHit)` 분기에서 별칭은 있지만 해당 타입이 등록되지 않았을 때 Levenshtein fallthrough가 발생한다. 이 경로에 대한 테스트가 없다.
- 제안:
  ```ts
  it('UNKNOWN_NODE_TYPE: alias target not in knownTypes → falls through to Levenshtein', () => {
    const sw = new ShadowWorkflow(baseSnapshot(), new Set(['http_request']));
    // 'template' is an alias target but NOT in knownTypes
    const result = sw.apply({ name: 'add_node', arguments: { type: 'error_message', label: 'X', position: { x: 0, y: 0 }, config: {} } });
    expect(result.suggestedType).not.toBe('template');
  });
  ```

**[WARNING]** `FAKE_STEP_COMPLETION`이 `planStepIds`(배열) 경로를 테스트하지 않음
- 위치: `review-workflow.spec.ts`, `review-workflow.ts:collectFakeStepCompletion`
- 상세: 구현부는 `tc.planStepId === step.id || (Array.isArray(tc.planStepIds) && tc.planStepIds.includes(step.id))`를 처리하지만, `planStepIds` 배열 경로에 대한 테스트 케이스가 없다.
- 제안: `planStepIds: ['s1']`을 사용하는 케이스 추가 필요.

**[WARNING]** `PLAN_NOT_COMPLETE` skip 테스트가 실제로 plan guard가 발동됐는지 명시적으로 검증하지 않음
- 위치: `workflow-assistant-stream.service.spec.ts` → `'skips review when PLAN_NOT_COMPLETE already fired'`
- 상세: 테스트는 `chatStream`이 2회 호출됐음만 확인한다. Round 1에서 PLAN_NOT_COMPLETE가 실제로 발동됐는지, 아니면 다른 이유로 2라운드가 됐는지 구분할 수 없다. Round 1의 finish tool_result에 `error: 'PLAN_NOT_COMPLETE'`가 포함됐는지 확인하는 assertion이 없다.
- 제안:
  ```ts
  const firstRoundMessages = mocks.llmService.chatStream.mock.calls[1][1].messages;
  const finishResult = firstRoundMessages.find(m => m.toolCallId === 'fin_1');
  expect(JSON.parse(finishResult.content)).toMatchObject({ error: 'PLAN_NOT_COMPLETE' });
  ```

**[WARNING]** `update_node` / `remove_node` / `remove_edge` 회복 감지 미테스트
- 위치: `review-workflow.spec.ts` → `UNRESOLVED_FAILED_CALLS`
- 상세: `isRecoveredLater`는 `add_node`(label 매칭)와 `add_edge`(튜플 매칭)는 테스트됐지만, `update_node` · `remove_node` · `remove_edge`의 id 기반 회복 경로가 테스트되지 않는다.
- 제안: `update_node`가 실패 후 같은 id로 재시도 성공하는 케이스 추가.

**[INFO]** `system-prompt.spec.ts` 정규식 테스트의 포맷 취약성
- 위치: `system-prompt.spec.ts` → `/second[\s\S]{0,20}finish[\s\S]{0,40}NOT re-reviewed/i`
- 상세: 프롬프트 문구의 사소한 리워딩("The second `finish` is NOT re-reviewed" → "The second finish call will NOT be re-reviewed")에도 테스트가 깨질 수 있다. 의미 단어만 매칭하는 것이 더 안정적이다.
- 제안: `/second[^.]*finish[^.]*not re-reviewed/i` 또는 핵심 단어만 개별 체크.

**[INFO]** `PENDING_USER_CONFIG_UNMENTIONED`의 대소문자 민감성 미테스트
- 위치: `review-workflow.spec.ts`
- 상세: 구현의 `text.includes(node.label)`은 대소문자 구분이다. 어시스턴트가 `sendEmail`이라고 썼는데 노드 레이블이 `SendEmail`이면 미감지된다. 이 동작이 의도적인지 여부가 테스트로 문서화되지 않았다.

**[INFO]** `levenshtein` 함수의 독립적 단위 테스트 부재
- 위치: `shadow-workflow.ts` 하단 모듈 함수
- 상세: `closestKnownType`을 통해 간접 테스트되지만, 동일 Levenshtein 거리의 복수 후보에서 사전순 첫 번째를 반환하는 동률 처리 로직이 직접 검증되지 않는다.

**[INFO]** `schemaCache`의 `typeArg`가 빈 문자열일 때 캐시 bypass 경로 미테스트
- 위치: `workflow-assistant-stream.service.ts:461`
- 상세: `parsed.type`이 string이 아닐 때 `typeArg = ''`가 되고 캐시를 우회한다. 이 방어 코드의 동작을 검증하는 테스트가 없다.

---

### 요약

전체적으로 테스트 커버리지 수준은 높다. 신규 `review-workflow.ts`는 5가지 체크리스트 항목 각각에 대해 happy path·recovery·edge case를 충실히 검증하고, `shadow-workflow`의 오류 풍부화 로직도 4가지 시나리오를 잘 커버한다. 스트림 서비스의 2-stage finish 테스트는 핵심 skip 조건(단순 턴, PLAN_NOT_COMPLETE 이후, clear_plan 이후)을 모두 테스트한다. 주요 갭은 `planStepIds` 배열 경로, alias-without-knownType fallthrough, `update_node`/`remove_node` 회복 감지로, 이 경로들이 실패해도 비교적 눈에 잘 띄지 않는다는 점에서 낮은 수준의 위험성이 있다.

### 위험도

**LOW**