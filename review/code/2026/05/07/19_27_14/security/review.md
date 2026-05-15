## 보안 코드 리뷰 결과

### 발견사항

---

**[WARNING] RAG 검색 실패 시 원시 예외 메시지가 LLM tool_result에 포함**
- **위치**: `kb-tool-provider.ts` — `execute()` 메서드, search 실패 catch 블록
- **상세**:
  ```typescript
  const msg = e instanceof Error ? e.message : String(e);
  return {
    content: JSON.stringify({
      error: 'search_failed',
      message: msg,   // ← 원시 예외 메시지 그대로 포함
      ...
    }),
  ```
  `ragSearchService.search()`가 던지는 예외의 `message`(DB 연결 문자열, 내부 호스트명, pgvector 상세 오류 등)가 가공 없이 LLM의 tool_result content에 포함된다. handler의 `sanitizeToolError()`는 `runProviderTool` 외부 catch에서만 동작하므로, provider가 정상 반환(throw 없이 return)하는 이 경로에는 적용되지 않는다. LLM이 이 메시지를 사용자 응답에 인용하면 내부 인프라 정보가 노출될 수 있다.
- **제안**: `message: msg` 대신 `message: sanitizeToolError(e)` 또는 고정 문자열 `'KB search is temporarily unavailable'`을 사용한다. 전체 원시 메시지는 서버 로그(`KbToolProvider.logger.warn`)에만 기록하는 현재 패턴을 tool_result에도 동일하게 적용.

---

**[INFO] LLM이 발급한 toolCallId를 신뢰하여 메시지 매칭에 사용**
- **위치**: `ai-agent.handler.ts` — `providerBatchResults` 처리 루프 및 `providerTruncated` 루프
- **상세**: `call.id`는 LLM 응답에서 직접 오는 값이며, 이를 `messages.push({ toolCallId: call.id })` 형태로 다음 LLM 호출의 messages 배열에 그대로 삽입한다. 악성 프롬프트 인젝션이나 LLM 응답 위변조 시나리오에서 중복/충돌 ID가 공급될 수 있다. 현재 구현에서는 ID를 인가 목적으로 사용하지 않고 Anthropic API의 tool_use ↔ tool_result 매칭용으로만 사용하므로 실제 피해는 제한적이다.
- **제안**: 설계상 허용된 수준이며 즉각적인 수정보다 모니터링이 적절하다. 향후 tool_result ID를 기반으로 로직 분기가 생길 경우 UUID 형식 검증 추가를 권장.

---

**[INFO] LLM 쿼리가 RAG 검색에 직접 전달되는 구조 (Prompt-to-RAG Injection)**
- **위치**: `kb-tool-provider.ts` — `parseKbArgs()`, `ragSearchService.search(args.query, ...)`
- **상세**: LLM이 생성한 `query`가 임베딩 검색으로 바로 전달된다. `MAX_KB_QUERY_LENGTH = 2000` 제한, `.trim().slice()` 처리, 타입 검증이 모두 적용되어 있고, 검색은 parameterized pgvector 쿼리를 사용하므로 SQL 인젝션은 차단된다. 임베딩 쿼리 자체는 비용 상한이 있으며, topK(최대 50)/threshold(0-1 범위) 파라미터도 경계 검증이 있다. 현재 구현으로 충분히 완화되어 있다.
- **제안**: 현재 방어가 적절하다. 향후 쿼리 길이 로깅을 추가하면 비정상 쿼리 패턴 탐지에 유용하다.

---

**[INFO] 병렬 실행 중단 시 부분 실패 격리 확인됨 (긍정 사례)**
- **위치**: `ai-agent.handler.ts` — `Promise.all(providerToRun.map(...))` 패턴
- **상세**: `runProviderTool` 내부에 try/catch가 있어 개별 KB 호출 실패가 `Promise.all` 전체를 거부(reject)하지 않는다. 실패한 호출은 `status: 'error'`로 마킹되어 LLM에 에러 content가 전달되고, 나머지 성공 결과는 정상 누적된다. 이 격리 설계는 보안/안정성 측면에서 올바르다.

---

### 요약

전반적으로 입력 검증(`MAX_KB_QUERY_LENGTH`, topK/threshold 범위 체크), 에러 새니타이징(`sanitizeToolError`), 워크스페이스 스코핑, parameterized DB 쿼리 등 적절한 방어 레이어가 구비되어 있다. 주요 위험 요소는 `KbToolProvider.execute()` 내 검색 실패 경로에서 원시 예외 메시지(`message: msg`)가 LLM의 tool_result에 포함되는 점으로, handler 레벨의 `sanitizeToolError` 가드가 이 경로를 커버하지 못한다. LLM이 내부 오류 상세를 사용자 응답에 그대로 반영하면 인프라 정보가 노출될 수 있어 수정이 권장된다.

### 위험도

**LOW**