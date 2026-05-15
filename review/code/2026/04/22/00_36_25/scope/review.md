## 발견사항

- **[INFO]** `MAX_TOOL_CALLS_PER_TURN` 16 → 32 증가
  - 위치: `workflow-assistant-stream.service.ts:69`
  - 상세: PLAN_NOT_COMPLETE 기능이 완전한 plan 실행을 허용하므로 한 턴에 더 많은 tool call이 필요해진 것은 논리적인 결과다. 단 2배 증가는 `ASSISTANT_TOO_MANY_TOOL_CALLS` 에러 진입 임계값이 배로 늦어진다는 의미이며, spec(`4-ai-assistant.md §10`)과 함께 동기화된 변경이므로 의도된 범위 내.
  - 제안: 이슈 없음, 다만 spec 변경과 함께 검토 완료됐음을 PR 설명에 명시.

- **[INFO]** `system-prompt.ts` 프롬프트 볼륨이 상당히 증가
  - 위치: `system-prompt.ts` 전체 diff (+47줄 순증)
  - 상세: 네 가지 규칙 블록("Workflow assembly rules"), 두 개의 new few-shot 예시(trigger connectivity, dynamic-ports branch), PLAN_NOT_COMPLETE 응답 스타일 지침이 추가됨. 각각 별도 기능(dynamic-ports, entry-point, openQuestions gating, finish guard)에 대한 지침으로 변경 세트 전체와 직결되어 있다.
  - 제안: 이슈 없음. 단, 프롬프트 토큰 증가가 비용에 영향을 줄 수 있으므로 실제 토큰 수 모니터링 권장.

- **[INFO]** 신규 `system-prompt.spec.ts` 파일 추가
  - 위치: `backend/src/modules/workflow-assistant/prompts/system-prompt.spec.ts` (전체 신규)
  - 상세: `buildSystemPrompt`의 계약 문자열을 테스트로 고정하는 파일. 실제 기능 구현과 함께 추가되었고 세 가지 guard rail이 프롬프트에 존재함을 검증한다. 의도된 범위 내.
  - 제안: 이슈 없음.

- **[INFO]** `plan-card.tsx`의 openQuestions 섹션 렌더링이 단순 표시 → 인라인 답변 UI로 확장
  - 위치: `plan-card.tsx:72~115`
  - 상세: 기존 코드는 `openQuestions` 목록을 텍스트로만 나열했으나, 이번 변경에서 `textarea + Send 버튼` 입력 UI를 추가했다. 이는 `openQuestions gating` 규칙(시스템 프롬프트 + spec)과 직접 연결된 의도적인 기능 확장이며 out-of-scope가 아니다.
  - 제안: 이슈 없음.

- **[INFO]** `AssistantToolCallKind`에 `'finish'` 추가
  - 위치: `workflow-assistant-message.entity.ts:14`
  - 상세: blocked finish 호출을 DB에 persist할 때 `kind: 'finish'`가 필요하다. `evaluateFinishGuard`에서 blocked finish도 `pendingToolCalls`에 push되므로 타입 정합성을 위한 최소 변경.
  - 제안: 이슈 없음.

---

## 요약

전체 변경 세트는 서로 긴밀하게 연결된 네 가지 LLM 행동 개선(PLAN_NOT_COMPLETE finish guard, dynamic-ports 마커, entry-point 연결 강제, openQuestions 인라인 답변 UI)을 하나의 PR에 묶어 구현했다. 각 파일 수정은 해당 기능을 구현하거나 검증하거나 문서화하는 역할을 명확히 하고 있으며, 의도된 범위 밖에 해당하는 순수 리팩토링, 무관한 파일 수정, 불필요한 포맷팅 변경은 발견되지 않는다. `MAX_TOOL_CALLS_PER_TURN` 증가와 시스템 프롬프트 볼륨 확대는 주요 기능의 직접적인 결과이며 spec과 동기화되어 있다.

## 위험도

**NONE**