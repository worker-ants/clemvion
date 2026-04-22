### 발견사항

- **[WARNING]** `recoverLeakedPlan` 내보내기 함수에 함수 레벨 JSDoc 누락
  - 위치: `recover-leaked-plan.ts:45` (`export function recoverLeakedPlan`)
  - 상세: 파일 상단에 모듈 레벨 설명이 있지만, 공개 함수 자체에는 `@param text`, `@returns RecoveredPlan | null` 설명이 없음. 현재는 파일 설명에서 유추해야 함.
  - 제안:
    ```ts
    /**
     * @param text LLM text-channel output to inspect for leaked propose_plan JSON.
     * @returns RecoveredPlan if a valid propose_plan payload is detected, null otherwise.
     */
    export function recoverLeakedPlan(text: string): RecoveredPlan | null {
    ```

- **[WARNING]** `workflow-assistant-stream.service.spec.ts` 모듈 레벨 JSDoc에 새 테스트 그룹 미반영
  - 위치: 파일 최상단 `/** These tests drive the conversation loop... */` 블록
  - 상세: 기존 JSDoc은 커버하는 시나리오를 열거하고 있으나, 새로 추가된 `propose_plan JSON leak recovery (server-side, option B)` describe 그룹이 목록에 포함되지 않음. 향후 유지보수 시 누락된 것처럼 보일 수 있음.
  - 제안: 목록 마지막에 `- propose_plan JSON leak recovery → synthetic plan SSE event, text scrub, non-duplication guard` 추가.

- **[WARNING]** `WorkflowAssistantStreamService.streamMessage` 클래스 JSDoc의 처리 흐름 설명이 새 단계를 반영하지 않음
  - 위치: `workflow-assistant-stream.service.ts` 클래스 바로 위 `/** Workflow AI Assistant의 대화 한 턴을 처리한다. */` 주석의 5단계 흐름
  - 상세: 현재 흐름은 4. LLM 루프 → 5. persist 로 기술되어 있으나, 4와 5 사이에 "4.5 propose_plan leak 감지 및 합성 plan 이벤트 발행" 단계가 추가되었음. 인라인 주석에만 설명이 있고 클래스 수준 요약에는 없어 전체 흐름을 보는 독자에게 불완전함.
  - 제안: 5번 앞에 아래 항목 추가:
    ```
    *  4.5 turn 종료 직전 propose_plan leak 감지 → 합성 tool call 로 변환 (option B)
    ```

- **[INFO]** `system-prompt.spec.ts` 파일 최상단 JSDoc에 새 테스트 목적이 미반영
  - 위치: `system-prompt.spec.ts:6–13` `/** buildSystemPrompt 는 ... */` 블록
  - 상세: 기존 JSDoc은 1) 동적 포트 표시, 2) P0 가드레일 유지 두 항목만 나열. 이번에 추가된 "propose_plan JSON leak self-check 고정" 케이스가 3번째 목적이지만 명시되지 않음. 정보성 수준이므로 필수는 아님.

- **[INFO]** `tryParseObject`, `VALID_STEP_ACTIONS` — 비공개 헬퍼에 주석 없음
  - 위치: `recover-leaked-plan.ts:80`, `:27`
  - 상세: 이 둘은 미노출(non-exported) 이고 이름이 직관적이라 문제는 없음. 다만 `VALID_STEP_ACTIONS`가 `propose_plan` 스키마의 허용 action 목록임을 나타내는 한 줄 주석이 있으면 후속 유지보수 시 "여기에 새 action 추가해야 하나?" 질문을 줄일 수 있음.

---

### 요약

전반적으로 문서화 품질은 양호하다. 실사례 배경(`GPT-4o` 오동작)이 파일·테스트·인라인 주석 세 곳 모두에 일관되게 기술되어 있고, `recover-leaked-plan.ts`의 파일 레벨 JSDoc은 설계 원칙까지 명시하는 등 의도를 충분히 전달한다. 다만 공개 함수 `recoverLeakedPlan`에 함수 레벨 JSDoc이 없고, 서비스 클래스 및 두 spec 파일의 상단 요약 주석이 새 단계/시나리오를 반영하지 않아 전체 흐름을 처음 읽는 개발자 기준으로 약간의 간극이 있다. 운영·보안 위험이 없는 문서 갱신 누락이므로 위험도는 낮다.

### 위험도

**LOW**