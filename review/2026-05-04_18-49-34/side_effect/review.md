## 발견사항

### [WARNING] provider.execute() 예외가 묵시적으로 흡수됨
- **위치**: `ai-agent.handler.ts` — `runProviderTool` catch block
- **상세**: 기존에는 `provider.execute()` throw가 상위로 전파되어 노드 실행 실패로 처리됐다. 변경 후에는 catch 블록이 예외를 `status: 'error'`인 tool result로 변환해 LLM이 다음 turn을 계속한다. 의도적 설계이지만, 이전에 노드 오류로 감지·알림되던 provider 실패가 이제 "LLM이 사과 메시지를 반환하는 정상 완료"로 보일 수 있다. 모니터링/알림 체계가 이 동작 변화를 반영하지 않으면 오류가 드러나지 않을 수 있다.
- **제안**: `status: 'error'`인 tool trace를 핸들러 레벨에서 로깅(Logger.warn)하거나, 노드 메타에 `toolErrorCount` 필드를 추가해 run-results UI에서 노출.

---

### [WARNING] `ai_message` 스냅샷 교체 후 툴 상태 정보 소실
- **위치**: `use-execution-events.ts` — `handleAiMessage`, `messagesToConversationItems` 호출부
- **상세**: `execution.tool_call_completed` → `updateToolItem`으로 채워진 `toolStatus`/`durationMs`/`error`가 이후 `ai_message` 이벤트로 `setConversationMessages`가 호출될 때 사라진다. `handleAiMessage` 내부의 `messagesToConversationItems` 호출에 `toolStatusByCallId`가 전달되지 않기 때문이다. 테스트(`ai_message replaces conversationMessages`)도 이 필드를 검증하지 않는다.
- **제안**: `handleAiMessage`에서 `payload.messages` 배열을 받을 때, 직전 `conversationMessages`에서 `toolCallId → { toolStatus, durationMs, error }` 맵을 추출해 `messagesToConversationItems`의 `toolStatusByCallId` 옵션으로 전달. 이로써 live 이벤트로 채워진 상태가 스냅샷 교체 후에도 보존됨.

---

### [WARNING] `execution.waiting_for_input` 핸들러 의존성 배열 불일치
- **위치**: `use-execution-events.ts` — `useCallback` 의존성 배열 diff (line `-addConversationMessage, +setConversationMessages`)
- **상세**: 내부적으로 `setConversationMessages(items)`를 호출하도록 바뀌었고 의존성 배열도 업데이트됐다. 그런데 같은 handler 블록 안에서 `addConversationMessage`를 더 이상 호출하지 않으므로 이전 참조가 stale closure를 만들 가능성은 없다. 하지만 `handleAiMessage`의 의존성 배열에는 legacy fallback 경로용 `addConversationMessage`가 여전히 남아 있어 두 콜백 간에 패턴이 불일치한다.
- **제안**: `handleAiMessage` 의존성 배열에서 `addConversationMessage` 제거. legacy fallback이 없어지는 것이 아니라면, fallback 함수를 별도 `useCallback`으로 분리해 명확히 할 것.

---

### [INFO] `tryParseJson` 중복 정의
- **위치**: `use-execution-events.ts` (신규 추가), `conversation-utils.ts` (기존)
- **상세**: 동일 로직의 함수가 두 모듈에 독립 정의돼 있다. `conversation-utils.ts`의 함수는 현재 모듈-private이라 직접 재사용할 수 없는 구조.
- **제안**: `conversation-utils.ts`에서 export하거나, 공통 util 파일로 분리.

---

### [INFO] `nodeId: ''` 폴백으로 WS 이벤트 발행
- **위치**: `ai-agent.handler.ts` — `runProviderTool` 호출부 (`context.nodeId ?? ''`, `(state.nodeId as string | undefined) ?? ''`)
- **상세**: `nodeId`가 없을 때 빈 문자열이 WS 이벤트 payload에 포함된다. 프론트엔드가 `nodeId`를 디버깅 표시용으로만 사용한다면 영향은 없지만, 향후 nodeId 기반 필터링이 추가될 경우 예상치 못한 동작을 낳을 수 있다. 실제로 `execution-engine.service.ts`에서 `nodeId`를 context에 주입하므로 정상 경로에서는 빈 문자열이 되지 않는다.
- **제안**: 폴백이 필요한 경우를 명시적으로 문서화하거나, `nodeId`가 없으면 WS emit 자체를 skip하는 guard 추가 검토.

---

### [INFO] `parseHistoryMessages` 출력 형태 변경 — 기존 소비자 영향
- **위치**: `conversation-utils.ts`
- **상세**: 기존에는 `role: 'tool'` 메시지를 skip했다. 이제 `type: 'tool'` ConversationItem을 반환한다. `conversation-inspector.tsx`와 `conversation-timeline-item.tsx`는 이미 `tool` 타입을 처리하므로 현재 소비자에는 문제 없다. 단, 해당 함수를 사용하는 다른 컴포넌트가 있다면 추가 tool 항목이 렌더링에 영향을 줄 수 있다.
- **제안**: 해당 없음 (현재 소비자 기준 안전). 단, 타 소비자 존재 여부 확인 권장.

---

## 요약

이번 변경의 핵심 부작용 위험은 두 가지다. 첫째, `provider.execute()` 예외 흡수로 인해 이전에는 노드 실패로 드러나던 tool provider 오류가 이제 정상 완료로 처리될 수 있어 운영 모니터링 체계 보완이 필요하다. 둘째, `ai_message` 스냅샷 교체 시 `toolStatusByCallId`가 전달되지 않아 live 이벤트로 채워진 success/error/pending 상태가 스냅샷 도착 후 사라지는 UX 회귀가 있다. 나머지 변경(`nodeId` context 전파, WS enum 추가, store 신규 액션, `parseHistoryMessages` 리팩터)은 모두 additive하거나 backward compatible하며 기존 동작에 실질적 부작용을 유발하지 않는다.

## 위험도

**MEDIUM**