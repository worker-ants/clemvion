## 유지보수성 코드 리뷰

### 발견사항

---

- **[WARNING]** `mock.calls[1][1]` 위치 기반 mock 접근 — 취약한 어서션
  - 위치: `workflow-assistant-stream.service.spec.ts` — `scrubs the leaked JSON` 및 `ignores non-plan JSON-like prose` 테스트
  - 상세: `mocks.sessionService.appendMessage.mock.calls[1][1]`처럼 mock 호출 순서를 하드코딩하면, `appendMessage`의 호출 횟수나 순서가 리팩토링으로 바뀌는 순간 테스트가 잘못된 대상을 검증하면서도 통과한다.
  - 제안: `appendMessage.mock.calls.find(call => call[1]?.role === 'assistant')` 처럼 의미 기반으로 호출을 탐색하거나, Jest의 `toHaveBeenCalledWith` 매처를 활용해 순서에 의존하지 않도록 작성.

---

- **[WARNING]** `VALID_STEP_ACTIONS`가 TypeScript 타입과 연결되지 않음
  - 위치: `recover-leaked-plan.ts:26-33`
  - 상세: `action` 필드의 유효값 목록이 `AssistantPlanRecord['steps'][number]['action']` 유니온 타입과 별개로 `Set<string>`으로 선언되어 있다. 새 action 타입이 추가될 때 이 Set을 수동으로 동기화해야 하는데, 컴파일러가 누락을 감지하지 못한다.
  - 제안:
    ```ts
    const VALID_STEP_ACTIONS: ReadonlySet<AssistantPlanRecord['steps'][number]['action']> = new Set([...]);
    ```
    로 선언하면 유니온에서 값이 빠지거나 추가될 때 타입 에러가 발생한다.

---

- **[WARNING]** 테스트 파일 크기 — `workflow-assistant-stream.service.spec.ts` 2450줄+
  - 위치: `workflow-assistant-stream.service.spec.ts` 전체
  - 상세: 이번 추가로 148줄이 더해져 2450줄을 넘겼다. 단일 파일에 모든 시나리오가 담겨 있어 특정 케이스를 찾거나 수정할 때 컨텍스트 파악이 어렵다.
  - 제안: `propose_plan` leak recovery처럼 독립적인 관심사는 `workflow-assistant-stream.leak-recovery.spec.ts`로 분리하거나, 기존 `describe` 트리를 별도 `*.spec.ts`로 분할. `recover-leaked-plan.spec.ts`를 별도 파일로 이미 분리한 일관성과 맞닿는다.

---

- **[INFO]** `describe('propose_plan JSON leak recovery (option B)')` — 구현 세부사항이 테스트 이름에 노출
  - 위치: `workflow-assistant-stream.service.spec.ts:2303`
  - 상세: "option B"는 내부 설계 문서의 분류이다. 구현 전략이 바뀌거나 option 명칭이 달라지면 테스트 이름이 실제 동작과 어긋난다.
  - 제안: `describe('server-side plan leak recovery')` 처럼 What(무엇을) 기술하는 이름 사용.

---

- **[INFO]** `STATIC_BLOCK_1_ROLE_AND_TURN_OP` 상수 계속 성장
  - 위치: `system-prompt.ts:117-145 (신규 self-check 섹션)`
  - 상세: 이미 수백 줄에 달하는 템플릿 리터럴에 섹션이 계속 추가되고 있다. 전체 상수를 읽지 않으면 어느 섹션이 어느 규칙을 담당하는지 파악하기 어렵고, 섹션 간 순서 의존성 테스트(`5-block structural layout`)가 이미 그 복잡도를 방증한다.
  - 제안: 즉각 리팩토링이 필요하진 않지만, 각 섹션을 별도 `const SELF_CHECK_SECTION = ...`으로 분리하고 최종 조립에서 concatenate하면 섹션별 독립 수정·테스트가 용이해진다.

---

- **[INFO]** `recover-leaked-plan.ts` — 단일 따옴표(`'`) 문자열 처리가 JSON 컨텍스트에서 불필요
  - 위치: `recover-leaked-plan.ts:63-64` (`findMatchingBrace` 내 `inString` 처리)
  - 상세: JSON 스펙은 단일 따옴표를 문자열 구분자로 허용하지 않는다. `'` 분기는 dead code에 가깝다. 실제로는 `"` 만 처리해도 정확히 동일하게 동작하면서 코드 의도가 더 명확해진다.
  - 제안: 단일 따옴표 처리 분기 제거. JSON 전용임을 나타내도록 함수명을 `findMatchingBraceInJson`으로 변경하거나 주석 보강.

---

- **[INFO]** `system-prompt.spec.ts` — 프롬프트 텍스트 계약 어서션이 지나치게 관대
  - 위치: `system-prompt.spec.ts:523-525` (신규 테스트)
  - 상세: `/BAD|❌|wrong/i`와 `/GOOD|✅|correct/i`는 셋 중 하나만 존재하면 통과한다. 프롬프트 편집 시 의도한 대비 구조가 사라져도 테스트가 잡지 못한다.
  - 제안: `BAD ❌`와 `GOOD ✅`처럼 실제 프롬프트에서 사용하는 복합 리터럴을 어서션으로 고정하거나, 두 조건이 동시에 만족되는지 확인하도록 단일 정규식으로 합산.

---

- **[INFO]** `String(leak.args.title).slice(0, 60)` — 불필요한 캐스트
  - 위치: `workflow-assistant-stream.service.ts` (leak 복구 블록 내 logger.warn 호출)
  - 상세: 바로 아래 줄에서 `this.buildPlanFromArgs(leak.args)`가 호출되고, `buildPlanFromArgs` 내부에서 이미 `asString(args.title, 'Plan')`으로 타입을 보장한다. 로거에서만 `String()` 캐스트가 필요하다면 `asString(leak.args.title, 'Plan').slice(0, 60)`을 사용해 일관성 유지.

---

### 요약

이번 변경은 LLM의 plan JSON text leak이라는 실제 장애를 프롬프트 강화(option A)와 서버 사이드 복구(option B)로 이중 방어한 작업으로, 전반적인 설계 의도와 코드 품질은 양호하다. `recover-leaked-plan.ts`는 순수 함수로 잘 분리되었고 테스트 커버리지도 충분하다. 주요 유지보수 위험은 두 가지로, ① mock 호출 순서에 의존하는 위치 기반 어서션(`mock.calls[1][1]`)이 리팩토링 시 무음 실패 가능성을 만들고, ② `VALID_STEP_ACTIONS`와 타입 유니온 간의 수동 동기화 부담이 새 action 추가 시 누락될 수 있다. 그 외는 INFO 수준의 코드 성장 관련 경고이다.

### 위험도

**LOW**