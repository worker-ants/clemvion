### 발견사항

---

**[WARNING] `evaluateFinishGuard` 파라미터 과잉 (7개)**
- 위치: `workflow-assistant-stream.service.ts:716`
- 상세: 함수 시그니처가 `history, planForTurn, pendingToolCalls, finishBlockCount, editsSinceLastFinishBlock, planClearedThisTurn, pendingUserRequest` 7개로 늘어났다. 각 파라미터는 호출 지점에서 생성·관리되며 guard 로직이 확장될수록 시그니처가 계속 늘어나는 구조다.
- 제안:
  ```typescript
  interface FinishGuardContext {
    finishBlockCount: number;
    editsSinceLastFinishBlock: number;
    planClearedThisTurn: boolean;
    pendingUserRequest: string;
  }
  ```
  로 묶으면 파라미터 변경이 인터페이스 변경만으로 격리된다.

---

**[WARNING] 백엔드-프론트 행동 규약이 타입 계약 없이 관례로만 유지됨**
- 위치: `system-prompt.ts` (프롬프트 지시) ↔ `assistant-store.ts:532` (hint 주입)
- 상세: "plan-only 턴에서는 LLM 이 prose 를 생략한다 → 클라이언트가 hint 를 자동 주입한다" 는 분산 계약이다. 백엔드가 실제로 prose 를 억제했는지 검증하는 타입이나 SSE 필드가 없다. `done` 이벤트에 `planOnly: boolean` 플래그 하나가 없으므로 클라이언트는 `plan 존재 && !approved && !hasEdit && !content` 라는 4중 조건으로 역추론해야 한다. 프롬프트가 바뀌거나 LLM 이 규약을 지키지 않을 때 힌트가 무음으로 빠질 위험이 있다.
- 제안: `done` 이벤트 페이로드에 `turnKind: 'plan-only' | 'execution' | 'clarify'` 를 서버가 명시적으로 포함하면 클라이언트 추론이 불필요해진다.

---

**[WARNING] 힌트 우선순위 주석과 코드 순서 불일치**
- 위치: `assistant-store.ts:507` 주석 vs 실제 `if-else` 순서
- 상세: 주석은 `error > stalled > planApprove > completed` 순서를 선언하지만 코드는 `stalled → completed → planApprove` 순으로 검사한다. 현재는 세 조건이 상호 배타적이라 결과는 동일하지만, 향후 `summarizePlanState` 반환값이 바뀌면 completed/planApprove 우선순위 충돌이 발생할 수 있다.
- 제안: 주석을 실제 코드 순서(`error > stalled > completed > planApprove`)로 정정하거나, 우선순위를 코드에 직접 반영하기 위해 순서를 맞춘다.

---

**[INFO] `finishBlockCount`·`editsSinceLastFinishBlock` 카운터 쌍의 불변식이 분산됨**
- 위치: `workflow-assistant-stream.service.ts:287–296` (block 처리) 및 `:451–459` (진척 카운트)
- 상세: "block 시 카운터 리셋, 성공 시 카운터 증가" 라는 불변식이 루프 내 두 곳에 흩어져 있다. 추후 새로운 block 경로가 추가될 경우 리셋을 빠뜨리기 쉽다.
- 제안: 두 카운터를 `class FinishBlockTracker { block(); recordProgress(); canEscape(): boolean }` 형태로 캡슐화하면 불변식을 한 곳에서 관리할 수 있다.

---

**[INFO] `assistant.planApproveConfirm` i18n 키의 이중 역할**
- 위치: `assistant-store.ts` `approveActivePlan` (서버 전송 메시지) ↔ `handleSseEvent` done 분기 (UI hint)
- 상세: 동일한 i18n 키가 서버로 보내지는 승인 메시지 텍스트와 클라이언트 힌트 텍스트에 동시 사용된다. LLM 이 "계획대로 진행해 주세요." 를 승인 신호로 파싱하는 프롬프트 규약과 결합되어 세 곳이 묵시적으로 연결된다.
- 제안: `assistant.planApproveHint`(UI 전용)와 `assistant.planApproveMessage`(서버 전송)로 분리하면 독립적으로 변경 가능하다.

---

**[INFO] 힌트 주입 조건 분기의 확장성**
- 위치: `assistant-store.ts:515–548`
- 상세: 현재 `if → else if → else if` 체인은 세 종류의 hint 를 처리한다. 각 추가마다 동일 블록을 수정해야 하므로 OCP 위반이 누적된다.
- 제안: 우선순위를 선언적으로 관리하는 패턴을 검토할 수 있다:
  ```typescript
  const hintRules: Array<{ when: (m) => boolean; hint: () => SystemHint }> = [
    { when: isStalled, hint: ... },
    { when: isCompleted, hint: ... },
    { when: isPlanOnly, hint: ... },
  ];
  updated.systemHint = hintRules.find(r => r.when(updated))?.hint();
  ```
  단, 현재 스코프에서는 변경 필요성이 낮으므로 INFO 수준.

---

### 요약

이번 변경은 "plan-only 턴 prose 생략 + 클라이언트 hint 자동 주입"과 "진척 기반 finish 가드 강화"라는 두 독립적인 정책을 올바르게 구현했다. 핵심 로직(서비스 루프, 평가 함수, 프론트 이벤트 핸들러)은 각자의 레이어에 배치되어 있고, 백엔드 서비스 테스트와 프론트 스토어 테스트 모두 경계 조건을 충분히 커버한다. 다만 두 가지 구조적 약점이 있다: ① 백엔드·프론트가 공유하는 "plan-only" 계약이 타입이 아닌 관례와 프롬프트로만 유지되어 불명시적이고, ② `evaluateFinishGuard` 의 파라미터 수와 루프 내 분산된 카운터 불변식이 향후 가드 로직 확장 시 유지보수 부담을 높일 수 있다.

### 위험도

**LOW**