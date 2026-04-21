### 발견사항

- **[WARNING]** `clear_plan` 호출 시 프론트엔드에 SSE 이벤트 미발행
  - 위치: `workflow-assistant-stream.service.ts`, `clear_plan` 처리 블록
  - 상세: `clear_plan`이 실행되어도 `kind === 'edit' || kind === 'explore'` 조건에서 제외되어 `tool_call` SSE 이벤트가 클라이언트로 전송되지 않는다. 프론트엔드는 현재 턴에서 active plan이 해제됐다는 사실을 실시간으로 알 수 없으며, 다음 턴의 시스템 프롬프트가 바뀌기 전까지 Plan 카드 UI 상태(진행 중 배지, 체크박스 등)가 stale하게 유지된다.
  - 제안: 의도적 설계라면 spec §5.3 이벤트 테이블에 "`clear_plan` 은 SSE 미발행, 다음 턴에 카드 소멸"을 명시해 프론트엔드 구현자가 암묵적 계약을 모르는 문제를 방지해야 한다. 또는 `{ event: 'plan_cleared', data: { reason } }` 같은 전용 이벤트를 추가하는 방안을 검토할 수 있다.

- **[INFO]** `clear_plan` 응답 스키마 `additionalProperties: false` 적용 시 `reason` 미필수화
  - 위치: `tool-definitions.ts`, `clear_plan` parameters 정의
  - 상세: `reason` 파라미터가 선택 필드(`required` 배열 없음)로 정의되어 있어 LLM이 이유 없이 호출할 수 있다. description에 "Stored for the audit trail"이라고 명시되어 있으나, 실제 저장은 `assistant_message.toolCalls` JSON 필드에 인라인으로 처리될 뿐 별도 감사 로그 테이블이 없다. 운영 중 감사 추적이 필요하다면 구현 보완이 필요하다.

- **[INFO]** `buildSystemPrompt` 시그니처 변경 — 하위 호환
  - 위치: `system-prompt.ts:24`
  - 상세: `activePlanContext: ActivePlanContext | null = null` 기본값이 있어 기존 호출부는 수정 없이 동작한다.

- **[INFO]** `propose_plan` 계약 명세 보강
  - 위치: `spec/3-workflow-editor/4-ai-assistant.md`, §4.2
  - 상세: 활성 plan이 있을 때 `propose_plan`을 다시 호출하면 **교체(replace)** 된다는 동작이 처음 명문화됐다. 기존 구현에서도 동일하게 동작했으나 계약 문서에 누락된 상태였다. 이번에 명시화한 것은 긍정적이며 breaking change가 아니다.

---

### 요약

이번 변경은 LLM 대화 레이어의 내부 계약(tool definitions, system prompt 조립)에 집중된 것으로, 프론트엔드가 직접 소비하는 REST/SSE API 구조에 대한 파괴적 변경은 없다. 신규 `clear_plan` 도구는 additive 추가이고 `buildSystemPrompt` 시그니처 변경도 기본값으로 하위 호환된다. 다만 `clear_plan` 실행이 SSE 이벤트 없이 침묵하는 설계는 프론트엔드와의 암묵적 계약으로, spec §5.3 이벤트 테이블에 이 동작이 명시되지 않아 구현자 혼란의 여지가 있다.

### 위험도

LOW