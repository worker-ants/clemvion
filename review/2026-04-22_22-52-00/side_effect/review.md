## 발견사항

### WARNING: `assistantText` 전체 누적분에 대해 recovery 실행

- **위치**: `workflow-assistant-stream.service.ts` — recovery block (`if (planForTurn === null && assistantText)`)
- **상세**: `assistantText`는 while 루프 전체 라운드에 걸쳐 누적된다. Recovery는 루프가 끝날 때(turn 종료 직전) 이 전체 누적 텍스트에 대해 실행된다. 다음 시나리오에서 오탐 가능:
  - Round 1: LLM이 "이런 shape의 plan JSON을 예시로 들면..." 형태의 prose를 출력하면서 우연히 `propose_plan` shape을 만족하는 JSON 포함 + tool_call 발행 → 루프 계속
  - Round 2: LLM이 text만 출력하고 clean finish → `planForTurn === null` 상태로 recovery 진입
  - Round 1에서 누적된 텍스트의 JSON이 탐지되어 spurious `plan` SSE 이벤트 발행

  `isProposePlanShape`의 엄격한 검증이 대부분 막아주지만, 완전 배제는 아님.
- **제안**: `roundText`(현재 라운드의 텍스트)만을 recovery 대상으로 한정하거나, recovery 대상을 "마지막 라운드에서 새로 생성된 텍스트"로 명시적으로 좁힐 것. 예: `lastRoundText` 변수를 별도로 추적.

---

### INFO: 시스템 프롬프트 내 BAD 예시 JSON과 `recoverLeakedPlan`의 잠재적 상호작용

- **위치**: `system-prompt.ts` — `STATIC_BLOCK_1_ROLE_AND_TURN_OP`의 새 self-check 섹션
- **상세**: 시스템 프롬프트에 `{ "title": "설문조사 플로우", "summary": "...", "steps": [...] }` 형태의 BAD 예시가 포함된다. 이 텍스트는 `assistantText`(LLM 응답)에 포함되지 않고 system message로 분리되므로 `recoverLeakedPlan`의 탐지 대상이 아니다. 현재 설계상 문제 없음. 그러나 LLM이 시스템 프롬프트의 BAD 예시를 그대로 echo하여 응답에 포함할 경우 false positive가 발생할 수 있음.
- **제안**: 현재 `isProposePlanShape`의 엄격한 검증(실제 steps 배열과 step 필드 타입 검사)이 충분한 방어 역할을 한다. 추가 조치 불필요.

---

### INFO: `String.replace` 단일 치환으로 중복 leak 제거 불완전

- **위치**: `workflow-assistant-stream.service.ts` — `assistantText = assistantText.replace(leak.matched, '')`
- **상세**: 정규식 없이 문자열 인자를 사용하는 `replace`는 첫 번째 occurrence만 제거한다. `recoverLeakedPlan`이 첫 번째 매치만 반환하므로 두 번째 동일 JSON이 텍스트에 남을 수 있음. 실제로는 동일 JSON이 두 번 나타나는 경우가 극히 드물어 영향 없음.
- **제안**: 현재 동작으로 충분. 다만 명시적으로 `replaceAll` 또는 `replace(new RegExp(escapeRegExp(leak.matched), 'g'), '')`을 쓰면 의도가 더 명확해진다.

---

### INFO: 합성 tool call의 `result.recovered: true` 필드

- **위치**: `workflow-assistant-stream.service.ts` — `result: { ok: true, planId, recovered: true }`
- **상세**: 실제 `propose_plan` 호출의 결과는 `{ ok: true, planId }`이다. 합성 레코드에 `recovered: true`가 추가되어 `AssistantToolCallRecord`의 `result` 타입과 형태가 다르다. 클라이언트가 `result`를 직접 파싱하지 않는다면 문제 없지만, 타입 불일치로 인해 future consumer가 혼란을 겪을 수 있다. 현재 consumer는 `ok` 필드만 확인하므로 실제 영향 없음.
- **제안**: 문서나 주석으로 `recovered: true`가 추가 필드임을 명시하거나, 별도 타입 가드를 추가.

---

## 요약

이번 변경은 LLM이 `propose_plan` 도구 대신 plan JSON을 텍스트 채널에 직접 출력하는 실사례 버그에 대한 이중 방어(프롬프트 강화 + 서버 사이드 recovery)를 구현한다. `recoverLeakedPlan` 자체는 순수 함수로 side effect가 없으며, 시스템 프롬프트 변경도 기존 인터페이스에 영향을 주지 않는다. 핵심 risk는 recovery가 현재 라운드가 아닌 turn 전체 누적 텍스트를 대상으로 동작한다는 점이며, 이는 다중 라운드 turn에서 오탐 가능성을 열어둔다. `isProposePlanShape`의 엄격한 검증이 대부분의 오탐을 차단하지만, 완전한 보장은 아니다. 나머지 발견사항은 모두 경미하거나 현재 설계 범위 내의 트레이드오프다.

## 위험도

**LOW**