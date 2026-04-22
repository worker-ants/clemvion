## 부작용 코드 리뷰

### 발견사항

---

**[WARNING] `BuildReviewChecklistInput.nodeDefs` — 기존 호출자에 대한 파괴적 인터페이스 변경**
- 위치: `review-workflow.ts` — `BuildReviewChecklistInput` 인터페이스
- 상세: `nodeDefs: NodeDefinitionView[]` 가 필수 필드로 추가되어 기존의 모든 `buildReviewChecklist()` 호출자가 이 필드를 넘겨주지 않으면 컴파일 에러나 런타임 오류가 발생한다. 현재 diff 에서는 `stream.service.ts` 와 `review-workflow.spec.ts` 두 곳이 업데이트됐지만, 테스트 외 다른 호출자(예: 별도 통합 테스트 파일, CLI 스크립트 등)가 있다면 누락 위험이 있다.
- 제안: `nodeDefs` 를 `nodeDefs?: NodeDefinitionView[]` 로 optional 처리하거나, 변경 전 전체 코드베이스에서 `buildReviewChecklist` 호출자를 전수 확인해야 한다. 빈 배열 기본값(`nodeDefs = []`)을 함수 내에서 처리하는 것도 방어적 대안이다.

---

**[WARNING] `DANGLING_OUTPUT_PORTS` 가 blocking check 로 등록 — 기존 워크플로에 소급 영향**
- 위치: `review-workflow.ts` — `buildReviewChecklist`, `stream.service.ts` — `evaluateReviewGuard`
- 상세: 기존에는 dangling 포트가 있어도 `finish` 가 통과했다. 이번 변경 후 `nodeDefs` 가 제대로 주입되는 순간부터, **이미 배포된 세션의 기존 워크플로도** 다음 edit 턴에서 `finish` 를 시도하면 `WORKFLOW_REVIEW_REQUIRED` 로 차단된다. 사용자 입장에서는 "이전에 되던 게 안 된다"는 경험이 발생할 수 있다.
- 제안: 이 동작이 의도적임을 memory 문서에 명시하고, 기존 세션에서 갑작스러운 review 루프가 발생하는 사례를 모니터링할 것. 신규 세션에만 적용하는 피처 플래그는 이번 설계 철학과 맞지 않으므로, 의도 확인 후 현행 유지.

---

**[WARNING] `finishReason` 변수 mutation 이 DB 영속에 영향**
- 위치: `stream.service.ts` — `if (planPending) finishReason = 'stop'`
- 상세: `finishReason` 은 (A) SSE `done` 이벤트 payload, (B) `persistAssistantTurn` 을 통한 DB 저장 두 곳에 사용된다. `planPending=true` 일 때 프로바이더 원문 `'tool_calls'` 를 `'stop'` 으로 덮어쓰는 것이 의도적이나, 이 값이 DB 에 저장되면 다음 턴 rehydration 에서 `finishReason='stop'` 으로 복원되어 "승인 대기" 상태 판단에 사용된다. 만약 DB persist 경로와 SSE 경로가 서로 다른 `finishReason` 을 봐야 하는 경우(예: 클라이언트가 원래 `'tool_calls'` 를 보고 싶은 경우)에는 분리 변수가 필요하다.
- 제안: 현재 설계 의도(두 곳 모두 `'stop'` 을 봐야 함)는 테스트로 검증되어 있고 memory 문서에 명시되어 있으므로 현행 유지 가능. 단, 두 용도를 분리할 필요가 생기면 `persistedFinishReason` / `emittedFinishReason` 으로 변수를 나눠야 한다.

---

**[INFO] `resolveEffectiveOutputPorts` — frontend/backend 드리프트 표면 신규 도입**
- 위치: `resolve-dynamic-ports.ts` 전체
- 상세: frontend 의 `resolve-dynamic-ports.ts` 로직을 backend 에 수동 복제하는 구조를 신규 도입했다. 두 파일이 각자 독립 스펙을 가지므로 한쪽에 새 `DynamicPortsSpec.kind` 가 추가될 때 다른 쪽을 빠뜨리면 DANGLING_OUTPUT_PORTS 에서 false positive(없는 포트를 dangling 으로 판정) 또는 false negative(dangling 인데 미감지)가 발생한다.
- 제안: memory 문서에 "양쪽 동시 업데이트" 체크리스트가 추가됐으나, CI 에서 두 파일의 `kind` 목록을 비교하는 자동화 검사가 있으면 더 안전하다.

---

**[INFO] `this.nodeRegistry.listDefinitions()` — review 발동 시마다 호출**
- 위치: `stream.service.ts` — `evaluateReviewGuard` 내 `nodeDefs: this.nodeRegistry.listDefinitions()`
- 상세: `finish` 가 review 를 발동할 때마다 레지스트리 전체 목록을 조회한다. `listDefinitions()` 가 순수 읽기 연산이라면 부작용 없음. 그러나 이 메서드 내부에서 캐시 갱신·파일 읽기·외부 호출 등이 발생하면 의도치 않은 부작용이 생긴다.
- 제안: `listDefinitions()` 가 O(1) 메모리 읽기임을 확인하고, 그렇지 않다면 서비스 초기화 시점에 한 번 캐싱하거나 캐시된 결과를 주입하도록 변경.

---

**[INFO] Ex2 예제 교체 — 기존 LLM 학습 패턴 소급 변경**
- 위치: `system-prompt.ts` — `### Ex2.` 섹션
- 상세: 이전 Ex2 는 `btn_reject` 를 미연결 상태로 두는 것을 정상 패턴으로 가르쳤다(`Leave btn_reject with no outgoing edge`). 이번 변경으로 모든 버튼 포트를 연결하도록 교체되었다. 이 변경은 의도적이고 올바르지만, 시스템 프롬프트가 업데이트되는 순간부터 LLM 은 이전 컨텍스트(히스토리에 남은 이전 어시스턴트 응답)와 새 시스템 프롬프트 사이의 불일치를 경험할 수 있다.
- 제안: 현행 유지. 히스토리 불일치는 새 세션 시작 시 자연 해소된다.

---

**[INFO] `dedupeById` — id 가 falsy 인 포트 묵시적 제거**
- 위치: `resolve-dynamic-ports.ts` — `dedupeById` 함수
- 상세: `if (!p.id || seen.has(p.id)) continue;` 로 id 가 빈 문자열이거나 undefined 인 포트를 조용히 버린다. `presentationButtonPorts` 등에서 fallback id(`items_0_btn_0` 등)를 생성하므로 실제로는 빈 id 가 나오지 않지만, 만약 새 kind 에서 id 를 명시하지 않으면 포트가 조용히 사라진다.
- 제안: `!p.id` 경로에서 `console.warn` 혹은 에러 로그를 남겨 조용한 소실 대신 가시적 경고를 제공하면 디버깅이 쉬워진다.

---

### 요약

이번 변경의 핵심 부작용 위험은 세 곳이다. 첫째, `BuildReviewChecklistInput.nodeDefs` 를 필수 필드로 추가한 파괴적 인터페이스 변경으로 미확인 호출자가 있으면 런타임 오류가 발생한다. 둘째, `DANGLING_OUTPUT_PORTS` 가 blocking check 로 등록됨으로써 기존 세션의 사용자가 의도치 않은 추가 review 루프를 경험할 수 있다. 셋째, `finishReason` 의 단일 변수 덮어쓰기가 SSE 이벤트와 DB 영속 두 채널에 동시 영향을 미치며, 두 채널이 분리된 값을 요구하는 미래 요구사항 변화에 취약하다. 나머지(레지스트리 호출, 드리프트 표면, Ex2 교체)는 낮은 수준의 관리 위험이다.

### 위험도

**LOW** — 인터페이스 변경이 파괴적이나 diff 내 확인된 호출자는 모두 업데이트됐고, 신규 blocking check 의 동작은 테스트로 충분히 검증되어 있다. 기존 호출자 전수 확인만 추가로 수행하면 된다.