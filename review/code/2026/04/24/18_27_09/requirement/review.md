## 발견사항

### [INFO] `labelLookalikeHint` 내 `safeValue`/`safeLabel` 중복 sanitize
- **위치**: `shadow-workflow.ts` — `labelLookalikeHint` 메서드
- **상세**: 함수가 `node.label === value` 조건에서만 진입하므로, `sanitizeLlmProvidedString(value, ...)` 와 `sanitizeLlmProvidedString(node.label, ...)` 는 항상 동일한 값을 생성한다. 두 번 계산하나 결과가 같다.
- **제안**: 단순화 가능하지만 의도를 명확히 하는 코드이므로 필수 수정은 아님.

---

### [INFO] `add_edge` — source/target 모두 label 실수인 케이스 미테스트
- **위치**: `shadow-workflow.spec.ts`, `NODE_NOT_FOUND label-lookalike hint` describe
- **상세**: `source_id = 'LabelA'`, `target_id = 'LabelB'` 처럼 양측 모두 label을 UUID 자리에 넣는 시나리오가 없다. 구현은 source hint가 우선(`source 쪽 우선` 주석 참조)이지만 이 경로가 미검증 상태다.
- **제안**: 아래 케이스를 추가하면 의도가 명문화된다.
  ```ts
  it('add_edge: when both source and target are labels, shows source hint only', () => { ... });
  ```

---

### [INFO] `update_node`/`remove_node` — cascading 실패 이후 label 실수 조합 미테스트
- **위치**: `shadow-workflow.spec.ts`
- **상세**: `addEdge`에는 cascading queue vs. label-lookalike 우선순위 테스트가 있지만, `update_node`/`remove_node`에는 cascading queue가 채워진 상태에서 label 실수를 하는 시나리오가 없다. 이 두 도구는 cascading 로직 자체가 없으므로 항상 `labelLookalikeHint`만 사용하는데, 그 독립성을 확인하는 테스트도 없다.
- **제안**: 필수는 아니나 명시적 회귀 방어로 유용.

---

### [WARNING] 시스템 프롬프트가 hint 형식을 명시하지만 정확한 매칭 검증 없음
- **위치**: `system-prompt.ts` 신규 블록 / `system-prompt.spec.ts` 신규 테스트
- **상세**: 프롬프트는 `"Value X matches the label of node Y (id: …)"` 형태의 hint를 언급한다. 실제 `labelLookalikeHint` 구현도 동일 포맷을 사용해 일치하지만, 스펙 테스트는 hint 포맷 자체는 검증하지 않는다. 향후 hint 문자열이 변경되면 LLM 교육 내용과 실제 에러 응답이 어긋날 수 있다.
- **제안**: shadow-workflow 테스트에서 `result.hint`가 `'Value "SendEmail" matches the label'` 패턴을 정확히 포함하는지 assertion 추가 검토.

---

### [INFO] `source_id === target_id` 가 모두 label일 때 `CYCLE_DETECTED` 반환
- **위치**: `shadow-workflow.ts` `addEdge`, 라인 ~464
- **상세**: `sourceId === targetId` 체크가 node 존재성 확인보다 먼저 수행되므로, 동일한 label 문자열을 양측에 넣으면 `NODE_NOT_FOUND + hint` 대신 `CYCLE_DETECTED`를 반환한다. 기존 동작이라 이번 변경이 도입한 문제는 아니지만, hint가 없어 LLM이 실수 원인을 파악하기 어려울 수 있다.
- **제안**: 현재 범위 밖이므로 별도 태스크로 관리.

---

## 요약

이번 변경은 LLM이 `update_node({id: "SendEmail", ...})` 처럼 node label을 UUID 자리에 잘못 넣는 패턴을 (1) 시스템 프롬프트 contracts 블록에서 사전 교육하고, (2) 런타임에서 `labelLookalikeHint`로 자동 감지해 다음 라운드에서 즉시 정정 가능한 hint를 돌려주는 두 레이어 방어를 구현한다. 보안 sanitization(개행·꺾쇠 중화), cascading hint 우선순위 로직, 프롬프트 테스트와 런타임 테스트의 이중 고정 등 요구사항 충족도가 높다. 발견된 사항은 모두 INFO/WARNING 수준이며, 기능적 버그나 요구사항 누락은 없다.

## 위험도

**LOW**