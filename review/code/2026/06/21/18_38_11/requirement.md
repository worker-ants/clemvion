# 요구사항(Requirement) Review — AiConditionEvaluator 추출 (M-1 1단계)

## 발견사항

### **[WARNING]** `buildConditionTools` — `parameters.required` 필드 누락 (spec §5.1 불일치)

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m1-condition-evaluator/codebase/backend/src/nodes/ai/ai-agent/ai-condition-evaluator.ts` L62–76 (`buildConditionTools`)
- 상세: `spec/4-nodes/3-ai/1-ai-agent.md §5.1` (line 323) 은 조건 도구 파라미터 스키마를 다음과 같이 정의한다:
  ```
  { type: "object", properties: { reason: { ... } }, required: [] }
  ```
  구현에서는 `required: []` 필드가 없다. 이는 동 파일 원본 핸들러 코드(`ai-agent.handler.ts` 의 삭제된 인라인 블록)에서도 마찬가지로 누락되어 있었으며, 이번 리팩터는 behavior-preserving 추출이므로 해당 누락이 그대로 이전되었다. 실무 영향은 제한적이다(대부분의 LLM provider 가 `required` 부재 시 선택 필드로 처리), 그러나 spec 의 명시적 필드 정의와 어긋난다.
- 제안: `buildConditionTools` 에 `required: []` 를 추가하여 spec §5.1 정의와 일치시킨다:
  ```ts
  parameters: {
    type: 'object',
    properties: { reason: { type: 'string', description: '이 조건을 선택한 이유' } },
    required: [],
  }
  ```
  이 누락은 본 리팩터 이전부터 존재한 버그이나 spec 권위 기준으로는 수정 대상(코드 fix)이다.

---

### **[INFO]** `plan/in-progress/refactor/02-architecture.md` M-1 체크박스 미갱신

- 위치: `/Volumes/project/private/clemvion/plan/in-progress/refactor/02-architecture.md` L124 (`- [ ] 미착수`)
- 상세: 커밋이 M-1 1단계(AiConditionEvaluator 추출)를 완료했음에도 plan 파일 체크박스가 `[ ]` 상태로 남아 있다. MEMORY.md 규약(`plan 체크박스 = 실제 상태`)에 따라 착수·완료 상태는 실제 진행 상태를 반영해야 한다.
- 제안: plan 파일에서 해당 체크박스를 `[x]` 로 변경하고, 완료 범위(1단계 — AiConditionEvaluator 추출)와 잔여 단계(2단계 AiMemoryManager, 3단계 AiTurnExecutor) 를 명시한다. plan 파일 갱신은 PR 커밋에 포함하는 것이 권장된다(MEMORY: plan 체크박스 = 실제 상태).

---

### **[INFO]** `condToolName` 내보내기 — 테스트 전용 export 가 public API 로 승격

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m1-condition-evaluator/codebase/backend/src/nodes/ai/ai-agent/ai-condition-evaluator.ts` L43
- 상세: `condToolName` 은 테스트 파일에서 직접 import 하기 위해 `export` 로 선언되었다. 클래스 외부 pure function 으로 export 하는 것은 기술적으로 유효하나, 향후 동일 디렉토리 외 호출자가 생길 경우 인터페이스 오염 경로가 된다. 현재 co-location 정책(`nodes/ai/ai-agent/` 하위) 덕분에 범위가 자연스럽게 제한되므로 즉각적인 문제는 없다.
- 제안: 현재 상태 유지 가능. 추후 테스트-전용 export 임을 JSDoc `@internal` 로 표시하는 것을 고려할 수 있다.

---

### **[INFO]** `buildConditionSystemPromptSuffix` — 빈 배열 시 `${condList}` 가 빈 줄로 남음

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m1-condition-evaluator/codebase/backend/src/nodes/ai/ai-agent/ai-condition-evaluator.ts` L85
- 상세: `conditions` 가 빈 배열일 때 `condList` 는 `''` 이 되어 `\n${condList}\n` 부분에서 연속 개행이 발생한다. 호출부(`ai-agent.handler.ts`)가 `conditions.length > 0` 가드 하에서만 이 메서드를 호출하므로 실제 경로에서는 발생하지 않는다. 테스트도 "빈 배열 시 항목 없는 안내문" 케이스를 커버하며 통과 처리한다. 실용적 문제는 없으나 guard 없이 직접 호출되면 형식이 어색한 출력이 생길 수 있다.
- 제안: 현재 상태 유지 가능. spec §5.1 은 "시스템 프롬프트에 조건 사용 지시를 자동 주입" 이라 명시하나 빈 배열 케이스를 별도 규정하지 않으므로 spec 침묵 영역이다.

---

## 요약

본 변경은 `AiAgentHandler` 의 조건 평가 로직을 `AiConditionEvaluator` 무상태 collaborator 로 behavior-preserving 추출한 리팩터다. 기능 완전성(분류·추출·도구 빌드·프롬프트 안내문 4개 메서드 전량 이전)과 API 계약 보존(`toolProviders` 인자화로 무상태 유지, `processMultiTurnMessage` 핸들러 잔류)은 충실히 구현되어 있다. 16개 단위 테스트가 빈 배열·빈 toolCalls·멀티바이트 절단·JSON 파싱 실패 등 주요 엣지 케이스를 커버하며, TODO/FIXME 주석은 없다. 에러 경로(JSON 파싱 실패 → 빈 문자열 반환)도 정의되어 있다.

주요 지적사항은 `buildConditionTools` 의 `parameters.required: []` 누락으로, `spec/4-nodes/3-ai/1-ai-agent.md §5.1` 명시 스키마와 어긋난다. 이 누락은 리팩터 이전 핸들러 코드에서도 동일하게 존재했던 기존 버그이나, 명세 기준 코드 fix 대상이다. 나머지 발견사항(plan 체크박스, `condToolName` export, 빈 배열 개행)은 INFO 수준이다.

## 위험도

LOW
