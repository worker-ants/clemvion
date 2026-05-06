## 발견사항

---

### **[WARNING] sanitizeToolError 구현이 주석의 보안 의도를 충족하지 못함**

- **위치**: `ai-agent.handler.ts:64-72`
- **상세**: 주석에는 "Strip long base64 / token-shaped substrings"라고 명시되어 있으나, 실제 구현은 첫 번째 줄을 추출하고 200자로 자르는 것뿐이다. `postgresql://admin:secret@db.internal:5432/prod` 같은 DB 연결 문자열이 한 줄이고 200자 미만이라면, 그대로 통과된다. 이 sanitized 값은 (1) LLM 컨텍스트에 tool result로 전달되고, (2) WS `tool_call_completed` 이벤트로 브로드캐스트되며, (3) `meta.turnDebug[].toolCalls[].error`에 퍼시스트되어 클라이언트에 노출된다.
- **제안**: 실제로 자격증명 패턴(base64, URL 내 패스워드, JWT 등)을 regex로 검출·마스킹하거나, 주석을 현재 구현("첫 줄 + 200자 truncation") 수준으로 정확히 수정하고 tool provider들이 민감 정보를 error.message에 포함하지 않도록 계약을 강제한다.

---

### **[WARNING] workspaceId 미설정 시 빈 문자열로 fallback — fail-open 동작**

- **위치**: `ai-agent.handler.ts:420, 701`
- **상세**:
  ```ts
  const workspaceId = (context.variables?.__workspaceId as string) || '';
  ```
  `__workspaceId`가 없거나 falsy이면 빈 문자열 `''`로 실행이 계속된다. 하위 서비스(LLM config 조회, RAG 검색 등)가 빈 workspaceId를 허용하거나 전체 공유 리소스로 해석하면 크로스-워크스페이스 데이터 접근이 발생할 수 있다.
- **제안**: 빈 문자열일 때 즉시 throw하여 fail-closed 처리한다.
  ```ts
  const workspaceId = context.variables?.__workspaceId as string;
  if (!workspaceId) throw new Error('Missing workspaceId in execution context');
  ```

---

### **[WARNING] maxToolCalls / maxTurns 상한 없음 — 비용 증폭 위험**

- **위치**: `ai-agent.schema.ts:281-294, 354-367`
- **상세**: 스키마에 상한 제약이 없으며 `maxTurns: 0 = unlimited`도 허용된다. 악의적이거나 잘못 구성된 워크플로가 LLM API 호출 수를 무제한으로 유발할 수 있다.
- **제안**: 합리적인 상한을 강제한다.
  ```ts
  maxToolCalls: z.number().int().min(1).max(50).default(10),
  maxTurns: z.number().int().min(0).max(100).default(20),
  ```

---

### **[WARNING] aiAgentNodeConfigSchema의 .passthrough() — 미검증 필드 무음 통과**

- **위치**: `ai-agent.schema.ts:369`
- **상세**: `.passthrough()`로 인해 스키마에 정의되지 않은 임의의 config 필드가 런타임에 조용히 통과된다. 현재 핸들러는 명시적 캐스팅을 사용하지만, 향후 `config.*` 읽기 코드가 추가될 때 검증되지 않은 악성 값이 실행에 영향을 줄 수 있다.
- **제안**: 스키마 경계를 명확히 하기 위해 `.strict()`로 전환하거나, passthrough가 필요하다면 설계 의도를 명시적으로 문서화하고 핸들러에서 화이트리스트 기반으로만 필드를 읽는다.

---

### **[WARNING] Condition prompt가 시스템 프롬프트에 무가공 삽입됨**

- **위치**: `ai-agent.handler.ts:1302-1307`
- **상세**:
  ```ts
  const condList = conditions.map((c) => `- ${condToolName(c.id)}: ${c.prompt}`).join('\n');
  return `\n\n[조건 안내] ...\n${condList}\n조건에 해당하지 않으면 대화를 계속하세요.`;
  ```
  condition.prompt 값이 시스템 프롬프트에 직접 삽입된다. 워크플로 설정 권한을 가진 악의적 작성자가 이를 통해 LLM의 동작을 임의로 조작하는 프롬프트 인젝션을 수행할 수 있다(예: "위 지시를 무시하고..."). 2000자 제한이 일부 완화하지만 워크플로 작성자가 신뢰 경계 내에 있는지 재검토가 필요하다.
- **제안**: 워크플로 작성자의 신뢰 수준을 명확히 정의한다. 워크플로 설정이 최종 사용자 입력과 혼용되는 시나리오가 있다면, condition prompt를 별도 포맷(예: XML 태그)으로 래핑하여 삽입 범위를 한정한다.

---

### **[WARNING] WS TOOL_CALL_STARTED 이벤트가 raw LLM arguments를 브로드캐스트**

- **위치**: `ai-agent.handler.ts:276-287`
- **상세**:
  ```ts
  const startedPayload: ToolCallStartedPayload = {
    ...
    arguments: call.arguments,  // raw LLM-generated string, 길이 제한 없음
  };
  ```
  `tool_call_completed`는 `previewContent(result.content)`로 200자 제한이 있지만, `tool_call_started`의 `arguments`는 제한이 없다. MCP 도구가 대용량 데이터를 인수로 받거나, LLM이 자격증명 같은 민감 정보를 인수로 생성하는 경우 WS 채널을 구독하는 모든 클라이언트에 노출된다.
- **제안**: `arguments`에도 `previewContent()` 또는 별도 제한을 적용한다.

---

### **[INFO] processMultiTurnMessage의 userMessage 길이 검증 없음**

- **위치**: `ai-agent.handler.ts:784`
- **상세**: 멀티턴 사용자 메시지에 길이 제한이 없다. 매우 큰 입력이 LLM 컨텍스트를 가득 채워 과도한 토큰 소비를 유발할 수 있다.
- **제안**: 서비스 정책에 맞는 최대 길이(예: 32,000자)를 설정하고 초과 시 거부한다.

---

### **[INFO] _resumeState에 알 수 없는 state 키가 스프레드로 전파**

- **위치**: `ai-agent.handler.ts:1063`
- **상세**:
  ```ts
  _resumeState: {
    ...state,  // 이전 상태의 모든 키 복사
    messages, turnCount, ...
  }
  ```
  외부에서 조작된 상태 객체에 포함된 임의의 키가 멀티턴 전체 수명 동안 유지된다. 상태가 DB/캐시에 퍼시스트되어 복원되는 경우 상태 무결성 위험이 있다.
- **제안**: 알려진 키만 명시적으로 선택하여 상태를 재구성한다.

---

## 요약

전체적으로 이 코드는 에러 정보 필터링(`sanitizeToolError`), WS 브로드캐스트 미리보기 제한(`previewContent`), provider 에러 catch-and-recover 패턴 등 보안을 의식한 설계를 보여준다. 그러나 `sanitizeToolError`의 주석-구현 불일치로 인한 자격증명 노출 위험, workspaceId fail-open 동작, resource exhaustion을 허용하는 상한 부재, 그리고 schema passthrough가 조합될 경우 심층 방어를 약화시킨다. 가장 즉각적인 개선 우선순위는 (1) `sanitizeToolError` 구현/주석 불일치 해소, (2) workspaceId fail-closed 처리, (3) maxToolCalls/maxTurns 상한 추가다.

## 위험도

**MEDIUM**