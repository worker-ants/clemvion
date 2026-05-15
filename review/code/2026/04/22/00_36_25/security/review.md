## 보안 코드 리뷰

### 발견사항

---

**[WARNING] 워크플로우 스냅샷을 통한 프롬프트 인젝션 (기존 + 신규 노출면 확대)**
- 위치: `system-prompt.ts` — `${JSON.stringify(current)}` 블록, 및 catalog 생성부
- 상세: `buildSystemPrompt`는 노드 label, description, config 값을 system prompt에 직접 `JSON.stringify`로 삽입한다. 이 값들은 사용자가 편집한 워크플로우에서 오므로, 공격자가 노드 label에 `\`\`\`\nIgnore all previous instructions...` 류의 내용을 입력할 경우 LLM의 행동에 영향을 줄 수 있다. 이번 변경으로 `[dynamic-ports]` 마커, 워크플로우 조립 규칙 등 프롬프트 구조가 복잡해졌고 경계 조작 난이도가 낮아졌다. 단, `redactConfig()`로 config 값은 일부 정제되고, spec §9에서 탐색 도구 결과는 `role: 'tool'`로 격리함을 명시한다.
- 제안: 시스템 프롬프트에 삽입되는 노드 label/description에 대해 길이 제한(예: 100자) 및 금지 패턴 필터(backtick fence, `Ignore`, `System:` 등)를 catalog 생성 단계에서 적용한다. JSON 블록을 별도 섹션으로 명확히 fence하고, "아래 JSON은 데이터입니다, 지시가 아닙니다" 류의 경계 문구를 추가하는 것도 방어책이 된다.

---

**[WARNING] openQuestions 답변 입력창 — 클라이언트 측 길이 제한 부재**
- 위치: `plan-card.tsx` — `<textarea value={answer} ...>`
- 상세: 일반 메시지 입력창(`MessageInput`)과 달리 plan 카드 내 답변 textarea에는 `maxLength` 속성이나 문자 수 상한이 보이지 않는다. 사용자가 매우 긴 답변(수 MB)을 전송하면 SSE 페이로드가 과도하게 커지고, LLM 컨텍스트 창을 낭비하거나 비용 이상 소비가 발생한다.
- 제안: textarea에 `maxLength` 속성을 기존 메시지 입력과 동일한 기준(예: 4000자)으로 설정한다. 백엔드 DTO에도 `@MaxLength` 검증을 추가한다.

---

**[INFO] `MAX_TOOL_CALLS_PER_TURN` 상한 증가로 인한 비용·자원 폭발 반경 확대**
- 위치: `workflow-assistant-stream.service.ts:64` — `const MAX_TOOL_CALLS_PER_TURN = 32`
- 상세: 16 → 32로 2배 증가했다. 악의적이거나 오작동하는 LLM이 루프에서 빠져나오지 않을 경우(예: finish를 호출하지 않고 계속 탐색 도구만 호출), 최대 허용 횟수까지 외부 API를 반복 호출할 수 있어 LLM API 비용과 레이트 리밋 소비가 늘어난다. PLAN_NOT_COMPLETE block도 finishBlockCount === 0일 때만 동작하므로, 그 이후 29회의 explore 호출이 추가로 가능하다.
- 제안: 수용 가능한 수준이나, `edit` kind 도구와 `explore` kind 도구를 별도 카운터로 분리해 탐색 도구에는 더 낮은 서브 리밋(예: 8회)을 두는 것이 좋다. 현재는 단일 `totalToolCallsThisTurn`으로 통합 관리된다.

---

**[INFO] `AssistantToolCallRecord.result`가 `unknown` 타입으로 DB에 JSONB 저장**
- 위치: `workflow-assistant-message.entity.ts` — `result?: unknown`
- 상세: 이번 변경에서 blocked finish의 PLAN_NOT_COMPLETE 에러 페이로드도 동일 필드에 저장된다. 이 값은 다음 턴에 `toChatMessages`를 통해 `JSON.stringify`되어 LLM에 전달된다. 스키마 검증 없이 `unknown` 타입이 순환하므로, 내부 버그 등으로 비정상적인 객체가 저장될 경우 LLM에 예상 외 내용이 주입될 수 있다.
- 제안: 심각한 취약점은 아니나, 저장·복원 경로에서 타입을 좁힌 인터페이스(예: `ToolCallResult`)를 쓰거나, `toChatMessages`에서 rehydrate 시 허용 크기 상한 체크를 추가한다.

---

**[INFO] `isDynamicPorts || dynamicPorts` 이중 필드 체크**
- 위치: `system-prompt.ts:29-31`
- 상세: `d.metadata.isDynamicPorts || d.metadata.dynamicPorts` 조건에서 `dynamicPorts`가 배열이나 객체일 경우 truthy로 평가되어 `[dynamic-ports]` 마커가 의도치 않게 붙을 수 있다. 보안 이슈는 아니나 프롬프트 품질 오염이 발생할 수 있다.
- 제안: `!!d.metadata.isDynamicPorts || !!d.metadata.dynamicPorts`처럼 boolean 강제 변환을 명시하거나, 필드를 하나로 통일한다.

---

### 요약

이번 변경의 전반적인 보안 수준은 양호하다. React의 JSX auto-escaping으로 XSS가 방지되고, `safeParse`로 JSON 파싱이 안전하게 처리되며, workspace 경계가 세션 레벨에서 명확히 적용된다. `finishBlockCount` 로직으로 무한 루프 가능성도 차단했다. 다만 사용자가 편집한 노드 label/description이 시스템 프롬프트에 비정제 상태로 삽입되는 구조적 프롬프트 인젝션 위험은 기존부터 존재하며, 이번 변경으로 프롬프트가 복잡해져 경계 혼동 가능성이 소폭 증가했다. plan 카드 답변 입력창의 길이 미제한과 tool call 상한 증가에 따른 비용 폭발 위험은 운영 환경에서 모니터링이 필요하다.

### 위험도

**LOW** (프롬프트 인젝션 가능성은 구조적으로 존재하나, 인증된 사용자의 자기 워크플로우 범위 내 공격으로 실질 피해가 제한적)