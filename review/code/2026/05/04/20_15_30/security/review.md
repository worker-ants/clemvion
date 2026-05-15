## 보안 코드 리뷰: `buildAiMessageDebugFromResumeState`

---

### 발견사항

- **[WARNING]** 시스템 프롬프트가 `llmCalls.requestPayload.messages`에 포함되어 클라이언트로 전송될 수 있음
  - 위치: `execution-engine.service.ts`, `buildAiMessageDebugFromResumeState` 함수 및 호출부(diff +line ~1704)
  - 상세: `buildConversationConfigFromOutput`은 `messages.filter((m) => m.role !== 'system')`으로 시스템 메시지를 명시적으로 차단하는 반면, `buildAiMessageDebugFromResumeState`는 `lastTurnDebug.llmCalls`를 **무필터로 그대로** 클라이언트에 spread한다. `llmCalls[N].requestPayload.messages`에는 `role: 'system'`인 항목이 포함될 수 있으며, 이는 내부 비즈니스 로직·보안 지침·외부 API 호출 전략이 담긴 시스템 프롬프트를 노출시킨다. 기존 코드(`lastTurnRequest` / `lastTurnResponse` 직접 전달)에서도 동일한 문제가 존재했으나, 변경 후에는 tool loop에서 발생한 **모든** LLM 호출의 원시 페이로드가 배열로 노출되어 노출 범위가 넓어진다.
  - 제안: `llmCalls` 배열을 클라이언트로 내보내기 전에 각 `requestPayload.messages`에서 `role === 'system'`인 항목을 제거하는 sanitizer를 적용할 것. 예:
    ```typescript
    const sanitizedLlmCalls = llmCalls.map((call) => ({
      ...call,
      requestPayload: {
        ...(call.requestPayload as Record<string, unknown>),
        messages: ((call.requestPayload as any)?.messages ?? [])
          .filter((m: any) => m.role !== 'system'),
      },
    }));
    ```

- **[WARNING]** `responsePayload` 원시 데이터 무필터 전송 — 모델 내부 메타데이터 노출
  - 위치: `execution-engine.service.ts`, `buildAiMessageDebugFromResumeState`
  - 상세: `llmCalls[N].responsePayload`에는 모델이 반환하는 raw response(provider별 포맷, `model` 문자열, `usage` 상세, `stop_reason` 등)가 포함된다. 이 정보는 공격자가 사용 중인 모델 버전, 컨텍스트 창 크기, 비용 구조를 추론하는 데 활용될 수 있다.
  - 제안: 프론트엔드 디버깅에 필요한 필드(`content`, `durationMs`, `usage.input_tokens`, `usage.output_tokens`)만 선택적으로 추출해 전송하거나, 이 정보를 workspace owner/admin 역할에만 제공하는 권한 필터를 WebSocket emit 레이어에 추가할 것.

- **[INFO]** `as unknown` 타입 캐스팅으로 인한 런타임 데이터 무결성 보장 없음
  - 위치: `execution-engine.service.ts:167-178`
  - 상세: `lastTurnDebug?.llmCalls as unknown[] | undefined`, `lastTurnDebug?.totalDurationMs as number | undefined` 형태의 캐스팅은 컴파일 타임 검사만 우회할 뿐, 런타임에 실제 타입을 보장하지 않는다. `llmCalls`가 배열이 아닌 객체이거나, `totalDurationMs`가 문자열인 경우 그대로 전송된다.
  - 제안: 최소한 `Array.isArray(llmCalls)` 가드와 `typeof durationMs === 'number'` 검사를 추가할 것.

- **[INFO]** tool loop 다회 호출 시 대용량 WebSocket 페이로드 미제한
  - 위치: `spec/5-system/6-websocket-protocol.md` §4.4, 서비스 코드 emit 부분
  - 상세: spec이 "tool loop 으로 한 턴에 다회 호출되는 경우 모두 보존"을 명시하므로, 공격자가 의도적으로 많은 tool 호출을 유발할 경우 단일 `execution.ai_message` 이벤트가 수 MB에 달할 수 있다. WebSocket 메시지 크기 제한은 별도로 확인이 필요하다.
  - 제안: `llmCalls` 배열에 최대 항목 수(예: 50개) 또는 최대 총 바이트 크기 상한을 설정하거나, 초과 시 항목을 요약 형태로 축약해 전송할 것.

---

### 요약

이번 변경의 핵심 보안 위험은 **LLM 원시 요청 페이로드(`requestPayload.messages`)에 포함된 시스템 프롬프트가 필터링 없이 WebSocket 클라이언트에 전달된다는 점**이다. `buildConversationConfigFromOutput`이 시스템 메시지를 명시적으로 제거하는 기존 패턴과 일관되지 않으며, 디버깅 목적이라도 system role 메시지 필터링은 최소한의 방어선이다. WebSocket 채널이 workspace admin으로만 제한된다면 위험도는 낮아지지만, 코드 레벨에서의 보장이 없으므로 접근 제어가 완화되거나 채널 권한이 변경될 때 즉시 취약해진다. `responsePayload` 원시 전송과 페이로드 크기 무제한도 보조적 위험 요소다.

---

### 위험도

**MEDIUM**