## 문서화 코드 리뷰

### 발견사항

---

**[WARNING]** `WorkflowAssistantStreamService` 클래스 JSDoc이 구 finish guard 동작을 기술하고 있음

- **위치**: `workflow-assistant-stream.service.ts` — 클래스 선언부 위 JSDoc 블록, `finish:` 항목
- **상세**: 변경 전 로직("finishBlockCount 로 같은 턴 2회 block 을 막아 무한 루프를 방지하고, **두 번째 finish 는 정상 탈출로 허용한다**")이 그대로 남아 있다. 새 로직은 `editsSinceLastFinishBlock` 기반의 progress-aware 가드로 교체됐으므로, "2회 block → 허용"이라는 기술은 사실과 다르다. 새 독자가 이 클래스를 읽을 때 guard 동작을 오해할 수 있다.
- **제안**:
  ```
  - finish: evaluateFinishGuard() 로 plan 완결성(남은 step, openQuestions)
    을 검사. 미완이면 `PLAN_NOT_COMPLETE` tool_result 로 되돌려 루프를
    한 번 더 돌린다. finishBlockCount 로 같은 턴 2회 block 을 막아
    무한 루프를 방지하고, 두 번째 finish 는 정상 탈출로 허용한다.
  ```
  →
  ```
  - finish: evaluateFinishGuard() 로 plan 완결성(남은 step, openQuestions)
    을 검사. 미완이면 `PLAN_NOT_COMPLETE` tool_result 로 되돌려 루프를
    한 번 더 돌린다. block 이후 LLM 이 edit/plan tool 을 추가 성공시키면
    (editsSinceLastFinishBlock > 0) 가드가 다시 발동해 끝까지 끌고 간다.
    진척 없이 다시 finish 를 호출하면 stuck 으로 판단해 탈출시킨다.
  ```

---

**[WARNING]** `spec/4-ai-assistant.md`의 "Turn completion hint" 행에 hint 우선순위 목록이 구버전임

- **위치**: `spec/3-workflow-editor/4-ai-assistant.md` — §3.2 UI 상세 표, "Turn completion hint" 셀 마지막 괄호
- **상세**: `(우선순위: error > stalled > completed)` 라고 기술되어 있으나, 이번 변경으로 `planApprove` 분기가 stalled 와 completed 사이에 추가됐다. "Plan approval hint" 행은 새로 추가됐지만, 기존 "Turn completion hint" 행의 우선순위 괄호는 갱신되지 않아 사양 내 불일치가 생긴다.
- **제안**: `(우선순위: error > stalled > planApprove > completed)` 로 수정

---

**[WARNING]** `evaluateFinishGuard` 함수 시그니처에 새 매개변수 `editsSinceLastFinishBlock` 문서 없음

- **위치**: `workflow-assistant-stream.service.ts:716` 부근, `evaluateFinishGuard` 선언
- **상세**: diff의 `evaluateFinishGuard` JSDoc(`아래 조건이면 null(정상 finish):`) 내 불릿 목록이 수정됐지만, 함수 파라미터 자체에 대한 설명은 없다. 기존 `finishBlockCount`도 설명이 없는 패턴이라 일관성은 있으나, 두 카운터의 상호작용이 비자명해 다음 기여자가 `finishBlockCount`와 `editsSinceLastFinishBlock`의 역할을 즉시 구분하기 어렵다.
- **제안**: JSDoc에 파라미터 설명 2줄 추가:
  ```
  * @param finishBlockCount 이번 턴 안에서 finish 가 block 된 누적 횟수
  * @param editsSinceLastFinishBlock 직전 block 이후 성공한 edit/plan tool 수.
  *   0 이면 stuck 으로 간주해 탈출 허용
  ```

---

**[INFO]** `system-prompt.spec.ts` 파일 상단 JSDoc이 새 테스트 케이스를 반영하지 않음

- **위치**: `system-prompt.spec.ts` 1~12행, 파일 레벨 주석
- **상세**: "두 가지 핵심 지시가 구조적으로 살아있는지 테스트로 고정한다"고 기술되어 있으나, 이번 변경으로 plan-only turn exemption, 한국어 closing 메시지 규약, 표현식 언어, 노드 config 편집 규칙 등 다양한 계약 항목이 추가됐다. "두 가지"라는 표현이 실제 커버리지를 오해하게 한다.
- **제안**: "매 턴마다 LLM에 주입되는 계약 문자열이다. 아래 항목들이 구조적으로 살아있는지 테스트로 고정한다:" 수준으로 일반화

---

**[INFO]** `assistant-store.test.ts` 헬퍼 함수 `makePlan`/`seedAssistant`에 JSDoc 없음

- **위치**: `assistant-store.test.ts` — `makePlan`, `seedAssistant` 함수
- **상세**: 두 함수 모두 테스트 fixture 역할이 자명하지만, `seedAssistant`가 `useAssistantStore.setState`를 직접 호출해 부작용이 있다는 점을 명시하면 다음 기여자가 `beforeEach` 리셋과의 관계를 즉시 파악할 수 있다.
- **제안**: 단일 줄 주석 추가: `// Resets store state; must be paired with beforeEach reset.`

---

### 요약

이번 변경은 plan-only turn 처리(LLM의 prose 생략 + 클라이언트 자동 hint 주입)와 progress-aware finish guard라는 두 가지 핵심 동작 변경을 포함하며, 전반적으로 인라인 주석과 스펙 문서(§4-ai-assistant.md)가 성실하게 갱신됐다. 그러나 `WorkflowAssistantStreamService` 클래스 JSDoc이 구 guard 동작("두 번째 finish 는 정상 탈출로 허용")을 그대로 유지하고 있어 실제 로직과 불일치하며, 스펙의 "Turn completion hint" 우선순위 표기도 `planApprove` 분기가 누락된 채 구버전으로 남아 있다. 이 두 곳이 주요 문서 부채이고, 나머지는 낮은 우선순위의 보완 사항이다.

### 위험도

**LOW** — 핵심 로직 자체의 문서화는 충분하며 테스트 커버리지도 갖춰져 있다. 다만 클래스 JSDoc의 stale 기술이 신규 기여자에게 오해를 줄 수 있으므로 빠른 갱신이 권장된다.