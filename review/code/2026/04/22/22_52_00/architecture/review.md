---

## 아키텍처 코드 리뷰

### 발견사항

---

- **[WARNING]** `VALID_STEP_ACTIONS`가 엔티티 타입과 분리된 중복 정의
  - 위치: `recover-leaked-plan.ts:26-33`
  - 상세: `AssistantPlanStep['action']` 의 권위 있는 정의는 `entities/workflow-assistant-message.entity.ts:50`의 유니언 타입이다. `VALID_STEP_ACTIONS`는 동일 목록을 런타임 `Set`으로 복사한 것인데, 새 action 타입이 엔티티에 추가될 때 이 Set을 수동 동기화해야 한다. 이 파일은 엔티티 타입을 import하지 않으므로 컴파일러가 불일치를 잡아주지 못한다.
  - 제안: 엔티티에서 action 유니언을 export하고, `VALID_STEP_ACTIONS`를 그 타입에서 파생하거나, `type AssistantStepAction`을 shared constants로 분리한다.

    ```ts
    // entities/workflow-assistant-message.entity.ts
    export const PLAN_STEP_ACTIONS = ['add_node', 'update_node', 'remove_node', 'add_edge', 'remove_edge', 'note'] as const;
    export type AssistantStepAction = typeof PLAN_STEP_ACTIONS[number];

    // recover-leaked-plan.ts
    import { PLAN_STEP_ACTIONS } from '../entities/...';
    const VALID_STEP_ACTIONS = new Set(PLAN_STEP_ACTIONS);
    ```

---

- **[WARNING]** `recoverLeakedPlan`이 멀티-라운드 누적 텍스트 전체를 스캔
  - 위치: `workflow-assistant-stream.service.ts:648-649`
  - 상세: `assistantText`는 같은 턴 안의 모든 LLM 라운드 텍스트를 누적한다 (`assistantText += ev.delta`). 최종 라운드에서 `recoverLeakedPlan(assistantText)`를 호출하면, 이전 라운드에서 LLM이 설명 목적으로 emit한 JSON-like 문자열(예: 에러 설명 예시, node config 인라인 묘사)이 최종 라운드의 무관한 텍스트보다 먼저 탐지될 수 있다. `isProposePlanShape` 검증이 오탐을 많이 차단하지만, 이전 라운드의 plan-shaped JSON이 남아있는 상황에서 실제 final round는 다른 내용일 때 복구가 잘못 발동할 수 있다.
  - 제안: `roundText`(현재 라운드 텍스트)만 대상으로 스캔하거나, 스캔 대상을 `assistantText`의 마지막 라운드 이후 구간으로 한정한다.

---

- **[INFO]** 복구 블록이 서비스 메서드에 인라인 (~45 lines)
  - 위치: `workflow-assistant-stream.service.ts:640-683`
  - 상세: 복구 블록은 탐지 → plan 구성 → ID 생성 → tool call 기록 → 텍스트 스크럽 → SSE yield 등 6가지 부수 효과를 순차 처리한다. `streamMessage`가 이미 거대한 메서드이고(700줄+), 이 인라인 블록은 테스트에서 독립적으로 검증하기 어렵다.
  - 제안: `private applyLeakRecovery(assistantText, pendingToolCalls): AsyncGenerator<...>` 또는 결과를 반환하는 private 메서드로 추출. `recoverLeakedPlan` 자체는 이미 잘 분리되어 있으므로 호출 측 로직만 추출하면 된다.

---

- **[INFO]** `findMatchingBrace`가 single-quoted 문자열을 JSON 파서처럼 처리
  - 위치: `recover-leaked-plan.ts:66-68`
  - 상세: JSON 스펙에서 문자열 구분자는 오직 double-quote이다. Single-quote를 `inString` 추적에 포함시키면 `{ "it's": 1 }` 처럼 값 내부에 apostrophe가 있을 때 brace depth 계산이 오염될 수 있다. 실제로 `'it'` 형식의 key는 JSON.parse가 실패하므로 오탐은 거의 없지만, 논리적 불일치가 존재한다.
  - 제안: `inString` 추적에서 `"'"` case 제거. JSON 파싱 전 brace boundary 탐지이므로 double-quote만 처리하면 충분하다.

---

- **[INFO]** `assistantText.replace(leak.matched, '')` — 첫 번째 출현만 제거
  - 위치: `workflow-assistant-stream.service.ts:669`
  - 상세: `String.prototype.replace(string, '')` 은 첫 번째 매칭만 제거한다. LLM이 동일 JSON 블록을 두 번 emit하거나 code fence 외부/내부에 동시에 존재하는 극단적 케이스에서 두 번째 출현이 persist된 `content`에 남는다.
  - 제안: 허용 가능한 리스크이지만 의도를 명확히 하려면 `replace` 대신 `replaceAll` 또는 주석으로 "first occurrence only" 의도를 명시한다.

---

### 요약

이번 변경의 핵심 아키텍처 결정인 **프롬프트 방어(Option A) + 서버 복구(Option B)** 이중 방어선은 올바른 defense-in-depth 패턴이다. `recoverLeakedPlan`을 부수 효과 없는 순수 함수로 분리한 것은 SRP를 잘 준수하며, 테스트 커버리지(순수 JSON, prose 포함, code fence, 오탐 케이스 포함)도 계약을 적절히 고정한다. 다만 `VALID_STEP_ACTIONS`가 엔티티 타입과 별도로 유지되는 구조는 향후 action 타입 확장 시 조용한 불일치를 만들 수 있고, 복구 함수가 단일 라운드가 아닌 전체 누적 텍스트를 스캔하는 점은 멀티-라운드 시나리오에서 잠재적 오탐 경로가 된다.

### 위험도

**LOW**