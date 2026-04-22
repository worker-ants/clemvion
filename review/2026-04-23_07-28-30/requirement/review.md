### 발견사항

---

**[INFO] `MAX_DANGLING_PORTS` 조기 반환 시 동일 노드의 포트가 불완전하게 보고될 수 있음**
- 위치: `review-workflow.ts` — `collectDanglingOutputPorts`, `if (dangling.length >= MAX_DANGLING_PORTS) return dangling;`
- 상세: 상한(20)이 노드 경계 중간에 도달하면 한 노드의 일부 포트만 `details` 요약에 포함된다. 예: 21개 케이스를 가진 단일 switch 노드라면 `case_0`~`case_19`만 보고되어 1회 교정 후 다시 `DANGLING_OUTPUT_PORTS`를 받게 된다. 동작 자체는 의도적이지만 JSDoc이나 `details` 메시지에 "최대 20개 — 교정 후 재검토 시 추가 포트가 보일 수 있다"는 언급이 없어 LLM이 "전부 고쳤는데 왜 또 나오지?" 혼란을 겪을 수 있다.
- 제안: `details` 문자열 끝에 `(showing first ${MAX_DANGLING_PORTS} of ${totalCount})` 형태 문구 추가. 또는 `MAX_DANGLING_PORTS` 상한 도달 시 `truncated: true` 필드를 `data`에 포함.

---

**[INFO] `parallel-branches` — `branchCount`가 `undefined`일 때 기본값 2가 테스트로 고정되지 않음**
- 위치: `resolve-dynamic-ports.spec.ts` — `parallel-branches` describe 블록
- 상세: 구현은 `typeof config.branchCount === 'number' ? config.branchCount : 2`로 기본값 2를 보장하지만, spec에는 `branchCount`를 아예 생략한 케이스(`resolveEffectiveOutputPorts({}, def)`)가 없다. 클램핑 경계값 테스트(100→16, 1→2)는 있지만 "config가 빈 객체일 때 branch 2개" 케이스는 미고정 상태.
- 제안: `it('defaults to 2 branches when branchCount is not provided', ...)` 추가.

---

**[INFO] `classifier-categories` — 빈 카테고리 배열 시 `isUserConfigured=false` 포트만 남아 체크가 무의미해지는 경로 미문서화**
- 위치: `resolve-dynamic-ports.ts` — `classifierCategoriesPorts`
- 상세: `categories: []`이면 `catPorts`가 비어 `[fallback, error]`만 반환되고 두 포트 모두 `isUserConfigured: false`라 DANGLING 체크에서 아무것도 잡히지 않는다. 이는 의도된 동작이나, classifier 노드에 카테고리가 하나도 없는 상태(=설정 미완성)가 `PENDING_USER_CONFIG_UNMENTIONED` 체크로는 포착되는지 보장이 필요하다. 두 체크 간 커버리지 겹침 또는 갭이 발생할 수 있다.
- 제안: 빈 카테고리 classifier가 `PENDING_USER_CONFIG_UNMENTIONED`에서 잡히는지 통합 테스트 케이스 추가 또는 memory 문서에 명시.

---

**[INFO] `DANGLING_OUTPUT_PORTS`와 `ORPHAN_NODES`가 동일 노드에 동시 발동 시 LLM 교정 비용 증가**
- 위치: `review-workflow.ts` — `buildReviewChecklist` 순서 (ORPHAN_NODES → DANGLING_OUTPUT_PORTS)
- 상세: 고아 노드가 dangling 포트도 갖고 있으면 두 checklist 항목에 모두 등장한다. 현재 순서상 LLM은 ORPHAN_NODES를 먼저 수정한 후 DANGLING_OUTPUT_PORTS를 수정해야 하는데, 두 번째 `finish` 이후 양쪽이 동시에 해소되는 경우 문제없다. 하지만 ORPHAN_NODES를 수정하는 `add_edge`가 dangling 포트 중 하나를 해소시킬 수도 있어 "이미 해소된 포트도 DANGLING_OUTPUT_PORTS에 보임" 패턴이 발생할 수 있다.
- 제안: 동작은 올바르므로 코드 변경 불필요. system-prompt의 self-review 교육에 "두 항목이 동시에 뜨는 경우 ORPHAN_NODES 교정이 DANGLING_OUTPUT_PORTS 중 일부를 동시 해소한다"는 1문장 힌트 추가 고려.

---

**[INFO] `workflow-assistant-stream.service.spec.ts` — DANGLING 테스트의 `mocks.nodeRegistry` mock 설정 의존성 확인 필요**
- 위치: `workflow-assistant-stream.service.spec.ts` — `describe('WORKFLOW_REVIEW_REQUIRED — DANGLING_OUTPUT_PORTS')`
- 상세: 테스트가 `mocks.nodeRegistry.listDefinitions.mockReturnValue([...])` 를 사용하고 있다. `makeService()` 헬퍼가 `nodeRegistry`를 mock으로 노출하는지 코드에서 직접 확인 가능하나, 만약 `listDefinitions`가 기본값(예: 빈 배열 `[]`)으로 설정되어 있고 테스트에서 override하지 않는 다른 케이스들이 있다면 `DANGLING_OUTPUT_PORTS` 체크가 silent skip된다. 현재 `baseInput`에 `nodeDefs: []` 기본값을 주입하는 패턴과 동일하게 서비스 수준에서도 기본 registry가 빈 배열로 mock된다면 다른 기존 테스트들은 영향받지 않음이 보장된다. 이 부분이 `makeService()` 내부 설정과 일치하는지 검증 필요.
- 제안: `makeService()` 의 기본 `listDefinitions` 반환값을 확인하여 빈 배열(`[]`)임을 spec 주석으로 명시. 이미 그렇다면 no-op.

---

**[INFO] system-prompt 테스트 — `Ex2` 에서 `add_edge` 4개 존재 여부를 직접 검증하지 않음**
- 위치: `system-prompt.spec.ts` — `'Ex2 demonstrates wiring every button port (no dangling by design)'`
- 상세: 테스트는 4개 btn 슬러그(`btn_korean`, `btn_western`, `btn_chinese`, `btn_other`)가 프롬프트에 등장하는지와 "Leave ... with no outgoing edge" 부정 패턴만 검증한다. `source_port: "btn_korean"` 형태의 `add_edge` 호출이 실제로 4개 명시되어 있는지는 검증하지 않아, Ex2 텍스트가 btn 슬러그를 단순 언급만 해도 테스트가 통과한다.
- 제안: `expect(prompt).toMatch(/source_port.*btn_korean/s)` 류의 패턴을 추가해 edge 배선 교육이 실제로 포함됐음을 고정.

---

### 요약

이번 변경은 `DANGLING_OUTPUT_PORTS` 탐지 기능을 신규 도입하고, 이전 리뷰(WARNING #1~#3, INFO #2·#4·#5·#9)의 권고사항을 모두 반영한 구현이다. `isPlanPendingApproval` 헬퍼 추출, lazy 평가, PAA 거부 검증 단언, `appendMessage` finishReason 영속 검증이 모두 포함되어 있다. `resolve-dynamic-ports.ts`의 6종 DynamicPortsSpec 처리 로직은 프론트엔드 거울 구현으로서 `isUserConfigured` 플래그를 통해 strong/weak 포트를 올바르게 구분한다. 발견된 항목은 모두 테스트 커버리지 보강·문서화 수준의 INFO이며 기능 정확성에는 이상이 없다.

### 위험도
**LOW**