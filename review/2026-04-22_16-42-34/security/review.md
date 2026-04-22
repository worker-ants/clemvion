### 발견사항

- **[INFO]** `handleSseEvent` / `summarizePlanState` 함수 export
  - 위치: `frontend/src/lib/stores/assistant-store.ts:383`, `570`
  - 상세: 단위 테스트 편의를 위해 두 내부 함수가 public export로 변경됨. 프론트엔드 store 함수라 직접적 보안 위협은 없으나, 모듈 API surface 증가로 인해 외부 코드에서 store 내부 상태를 직접 조작하는 경로가 생김.
  - 제안: 테스트 파일에서 `@vitest/spy`나 module mock을 통해 내부 상태를 간접 검증하는 방식이 surface 노출 없이 동일한 커버리지를 제공할 수 있음. 단, 현재 코드에서 실제 악용 위험은 거의 없음.

- **[INFO]** `propose_plan` 성공이 `editsSinceLastFinishBlock` 카운터를 증가시키는 설계
  - 위치: `workflow-assistant-stream.service.ts:451-458`
  - 상세: `kind === 'plan'` 조건 때문에 `propose_plan`(새 plan 발행, no canvas effect)이 성공해도 "진척"으로 카운트됨. 프롬프트 인젝션으로 LLM이 `propose_plan`(note-only step) → `finish` 루프를 반복하면 stuck-LLM 탈출 조건(`editsSinceLastFinishBlock === 0`)이 충족되지 않아 `toolCallsBudget` 한도까지 루프가 지속될 수 있음. plan에 actionable step이 없으면 guard 자체가 발동 안 하므로 실제로 루프는 발생하지 않지만, actionable step이 있는 plan을 반복 재제출(매번 새 step 추가)하는 패턴은 budget 소진을 유도할 수 있음.
  - 제안: 현재 `toolCallsBudget`(최대 200)이 절대 상한이라 무한 루프는 방어됨. 추가 방어로 `finishBlockCount` 상한(예: 5회)을 두면 stuck 탈출 조건을 더 명시적으로 제어 가능.

- **[INFO]** 기존 `userRequest` 새니타이징 — 이번 변경과 무관하나 관련 테스트 코드에서 확인됨
  - 위치: `system-prompt.spec.ts:210` (기존 테스트 `neutralizes dangerous chars in userRequest`)
  - 상세: `<script>` → `〈script〉`(전각 꺾쇠)로 치환하는 방식은 HTML 컨텍스트 이스케이핑이 아닌 Unicode 대체로, 시스템 프롬프트(순수 텍스트)에서는 인젝션 차단에 충분하나, 향후 해당 텍스트가 HTML로 렌더될 경우 전각 꺾쇠가 렌더링을 통과할 수 있음. 이번 변경에서 새니타이징 로직 자체는 수정되지 않았음.
  - 제안: 이번 PR 범위 밖이지만, `userRequest`가 UI 렌더에 그대로 노출될 경우를 대비해 `DOMPurify` 또는 표준 HTML 이스케이핑도 병행 적용 권장.

---

### 요약

이번 변경은 AI 어시스턴트의 plan-only 턴 동작 정제(LLM prose 생략 + 클라이언트 hint 자동 주입)와 finish 가드의 진척 기반 개선이 핵심이다. 신규 인젝션 경로, 하드코딩 시크릿, 인증/인가 우회, 민감 정보 노출 등 OWASP Top 10 범주의 취약점은 도입되지 않았다. 기존 프롬프트 인젝션 방어(userRequest 새니타이징, XML fence 격리)도 유지된다. 가장 주목할 점은 `propose_plan` 성공이 stuck-LLM 탈출 카운터에 포함되는 설계인데, 이는 의도된 것이며 `toolCallsBudget` 절대 상한이 안전망 역할을 하고 있다.

---

### 위험도

**LOW**