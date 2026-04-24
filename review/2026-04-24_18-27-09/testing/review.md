### 발견사항

- **[WARNING]** `add_edge`의 `target_id` label lookalike 경로 미테스트
  - 위치: `shadow-workflow.spec.ts` — `describe('NODE_NOT_FOUND label-lookalike hint')`
  - 상세: 구현체 `addEdge`는 `sourceHint === null && !this.nodes.has(targetId)` 조건으로 `target_id`가 label인 경우도 hint를 생성한다. 하지만 테스트는 `source_id`가 label인 케이스("add_edge: hints on the source side when source_id matches a node label")만 다루고, **source가 존재하지만 target이 label인 경우**는 전혀 테스트하지 않는다.
  - 제안:
    ```typescript
    it('add_edge: hints on the target side when source exists but target_id matches a node label', () => {
      const sw = new ShadowWorkflow(snapshotWithNamedNode(), new Set(['send_email']));
      const result = sw.apply({
        name: 'add_edge',
        arguments: {
          source_id: TRIGGER_NODE.id,   // 실제 존재하는 노드
          target_id: 'SendEmail',        // label 실수
        },
      });
      expect(result.error).toBe('NODE_NOT_FOUND');
      expect(result.hint).toMatch(/SendEmail/);
      expect(result.hint).toMatch(/11111111-2222-3333-4444-555555555555/);
    });
    ```

- **[WARNING]** `system-prompt.spec.ts`의 UUID 근접성 단언이 취약함
  - 위치: `system-prompt.spec.ts:104–107` — assertion (a)
  - 상세: `/UUID/`와 `/never.*label|label.*never/i`를 독립적으로 검사하므로, 두 표현이 별개의 섹션에 있어도 통과된다. 주석에는 "인접 문맥에 있어야 한다"고 명시했지만 실제 검증은 그렇지 않다. 게다가 `UUID`는 프롬프트 다른 곳(예: 레이아웃 계산, 스냅샷 예시)에도 충분히 존재할 수 있어 신규 섹션이 빠져도 테스트가 통과될 위험이 있다.
  - 제안: 두 패턴이 같은 문단 안에 있는지 확인하거나, 신규 섹션 헤더 문구를 직접 고정하는 단언 추가:
    ```typescript
    expect(prompt).toMatch(/Tool arguments.*UUID.*never.*label|never.*label.*UUID/is);
    // 또는 신규 섹션의 구체적 문구를 pin
    expect(prompt).toMatch(/always reference a node by its UUID, never by its label/i);
    ```

- **[WARNING]** `labelLookalikeHint`에서 `safeValue`와 `safeLabel`이 항상 동일
  - 위치: `shadow-workflow.ts:671–683`
  - 상세: 메서드 진입 조건이 `node.label === value`이므로, `sanitizeLlmProvidedString`을 거쳐도 두 변수가 항상 같은 문자열을 생성한다. hint 메시지에 "Value X matches the label of node X"처럼 중복 표현이 나타나 약간 어색하다. 기능 버그는 아니지만 가독성 저하.
  - 제안: `safeLabel`을 제거하고 `safeValue`만 사용하거나, 메시지를 `Value ${safeValue} is a node label, not a UUID...`로 단순화.

- **[INFO]** 빈 문자열·공백 전용 문자열 입력 경계값 미테스트
  - 위치: `shadow-workflow.spec.ts` — `labelLookalikeHint` 관련
  - 상세: `labelLookalikeHint('')`는 falsy guard로 null 반환이 보장되나, `'   '`(공백만 포함)은 falsy가 아니어서 노드 label 순회로 진입한다. 실제 LLM이 인자에 공백 문자열을 넣을 확률은 낮지만 방어 경로가 미검증 상태다.
  - 제안: 경계값 테스트 1개 추가:
    ```typescript
    it('returns null for whitespace-only id value', () => {
      const sw = new ShadowWorkflow(snapshotWithNamedNode(), new Set(['send_email']));
      // private 메서드는 update_node를 통해 간접 검증
      const result = sw.apply({ name: 'update_node', arguments: { id: '   ', patch: {} } });
      expect(result.hint).toBeUndefined();
    });
    ```

- **[INFO]** cascading 우선순위 테스트에서 `target_id`가 unknown UUID인 이유 불명확
  - 위치: `shadow-workflow.spec.ts` — "prefers cascading failed-add_node hint over label-lookalike"
  - 상세: `source_id: 'SendEmail'`(label 실수)이면서 `target_id: '00000000-0000-0000-0000-dead0000dead'`(fabricated UUID)인 조합인데, cascading 힌트가 출력되는 이유는 `recentFailedAddNodeLabels`에 항목이 있기 때문이다. 테스트 자체는 정확하지만, 주석에 "cascading FIFO가 비어있으면 label-lookalike 힌트가 출력된다"는 반례 검증이 없어 우선순위 로직의 양면이 고정되지 않는다.
  - 제안: 별도 케이스로 "cascading FIFO가 비면 label-lookalike 힌트가 나온다"를 확인하는 단언 추가 (현재 "add_edge: hints on the source side" 테스트가 이를 암묵적으로 검증하긴 하나 명시적이지 않음).

---

### 요약

구현(`labelLookalikeHint`)과 그에 대응하는 테스트 커버리지는 전반적으로 탄탄하다. `update_node`/`remove_node`의 hint 생성, cascading 우선순위, 프롬프트 인젝션 sanitization까지 주요 경로가 모두 커버되어 있다. 그러나 `add_edge`의 **target_id가 label인 경우**(source가 존재할 때)가 테스트되지 않아 해당 fallback 분기(`targetHint`)가 회귀 보호 없이 노출되어 있고, `system-prompt.spec.ts`의 UUID 근접성 단언이 취약해 신규 섹션이 누락되어도 테스트가 통과될 여지가 있다. 나머지 사항은 의미 중복이나 경계값 수준의 개선 가능 항목이다.

### 위험도

**LOW**