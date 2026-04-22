## 발견사항

---

### **[WARNING]** `done` 이벤트 핸들러의 우선순위 주석과 코드 순서 불일치
- **위치**: `assistant-store.ts` — `done` 분기 힌트 주입 로직
- **상세**: 주석은 `error > stalled > planApprove > completed` 우선순위를 선언하지만, 실제 `else if` 체인은 `stalled → completed → planApprove` 순서로 실행된다. `status === "completed"`가 `planApprove` 조건보다 먼저 체크된다. 실제 런타임에서는 "모든 step이 done이면서 미승인" 상태가 거의 불가능하므로 버그는 아니지만, 주석을 믿고 코드를 수정하는 개발자가 잘못된 결론을 내릴 수 있다. `spec/3-workflow-editor/4-ai-assistant.md`도 `error > stalled > planApprove > completed`라고 기술하여 같은 불일치를 반복한다.
- **제안**: 코드 순서를 주석과 일치시키거나 (`stalled → planApprove → completed`), 주석을 실제 순서로 수정한다.

---

### **[WARNING]** `evaluateFinishGuard` 인자 목록 과다 (7개)
- **위치**: `workflow-assistant-stream.service.ts` — `evaluateFinishGuard` 호출부 및 함수 선언부
- **상세**: 이번 변경으로 파라미터가 6→7개로 늘었다. `finishBlockCount`, `editsSinceLastFinishBlock`, `planClearedThisTurn`은 같은 "finish guard 상태"를 표현하는 묶음이다. 파라미터가 늘수록 호출 위치와 선언부의 순서 불일치 버그 위험이 높아지고, 향후 또 다른 guard 조건 추가 시 다시 파라미터가 늘어난다.
- **제안**:
  ```typescript
  interface FinishGuardState {
    finishBlockCount: number;
    editsSinceLastFinishBlock: number;
    planClearedThisTurn: boolean;
  }
  ```
  로 묶어 단일 객체로 전달한다.

---

### **[WARNING]** 테스트 내 복잡한 인라인 정규식 (가독성)
- **위치**: `system-prompt.spec.ts` — `'explicitly exempts plan-only turns'` 테스트 (b) 단언
- **상세**: 아래 정규식은 한 줄에 두 가지 패턴을 OR로 합쳐 가독성이 낮다:
  ```ts
  /plan[- ]only turn[s]?[^\n]*(?:do not|must not)\s+emit|(?:do not|must not)\s+emit[^\n]*plan[- ]only/
  ```
  주석 `(b)`로 의도를 설명하고 있지만, 패턴 자체가 변경되어야 할 때 수정 범위가 불명확하다.
- **제안**: 패턴을 상수로 추출하거나, 두 방향 패턴을 별도 `expect` 두 개로 분리해 각각의 의도를 명시한다.

---

### **[INFO]** 165줄 단일 테스트 케이스
- **위치**: `workflow-assistant-stream.service.spec.ts` — `'keeps blocking finish across multiple rounds'` 테스트
- **상세**: 3 라운드 mock 설정 + 2개 round message 검증이 한 `it` 블록에 집중되어 있다. 구조적으로는 논리적이지만, mock `Implementation` 순서(Round 1→2→3)와 검증 순서(Round 2→3 messages)가 뒤바뀌어 있어 처음 읽는 사람이 흐름을 역으로 추적해야 한다.
- **제안**: Round별 mock setup과 검증을 같은 순서로 정렬하거나, `describe('round N: ...')` 블록으로 나눠도 된다. 단, 현재 단일 `it`으로 3라운드 순차성을 보장하는 의도 자체는 유지할 것.

---

### **[INFO]** `addStep` 헬퍼가 테스트 케이스 내부에 정의됨
- **위치**: `workflow-assistant-stream.service.spec.ts` — 165줄 테스트 내부 `const addStep = ...`
- **상세**: `addStep`이 한 테스트에서만 사용되므로 내부 정의 자체는 문제없지만, 같은 패턴을 다른 테스트에서 반복할 경우 복제가 발생한다. 현재는 괜찮음.
- **제안**: 향후 유사한 mock builder가 2곳 이상 생기면 `describe` 스코프 밖으로 추출.

---

### **[INFO]** `editsSinceLastFinishBlock` 변수명이 길고 일부 불명확
- **위치**: `workflow-assistant-stream.service.ts` — 변수 선언 및 사용부
- **상세**: 이름이 의미를 잘 전달하지만 다소 길다. "edits since last finish block"보다 `progressSinceBlock`처럼 짧게 표현해도 주석과 함께 동등한 명확도를 제공할 수 있다. 영향은 낮음.

---

## 요약

이번 변경은 "plan-only turn 에서 prose 생략 + finish 즉시 호출" 규약을 시스템 프롬프트·서버 가드·클라이언트 힌트·스펙 문서·테스트에 걸쳐 일관되게 반영한 점에서 유지보수성 방향은 올바르다. 가장 주목할 이슈는 `done` 핸들러의 **우선순위 주석과 코드 순서 불일치**로, 스펙 문서까지 같은 불일치를 반복하고 있어 향후 수정 시 혼란을 줄 수 있다. `evaluateFinishGuard`의 파라미터 증가는 누적 부채이며 한 번 정리할 시점에 가까워지고 있다. 그 외 테스트 품질과 네이밍은 전반적으로 양호하다.

## 위험도

**LOW**