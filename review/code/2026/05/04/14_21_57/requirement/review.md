## 발견사항

---

### [WARNING] 메타 도구(meta tool) 호출이 UsageLog에 기록되지 않음
- **위치**: `mcp-tool-provider.ts` — `executeMeta` 메서드
- **상세**: `execute`의 일반 tool 경로는 `logUsage`를 호출하지만, `executeMeta`는 `ctx`를 파라미터로 받지 않아 `list_resources`, `read_resource`, `list_prompts`, `get_prompt` 호출이 통합 Activity 탭에 전혀 기록되지 않는다. 요구사항 주석에 "MCP call activity in the same Activity tab used by HTTP / DB / Email handlers"라고 명시되어 있으나 메타 도구는 제외된다.
- **제안**: `executeMeta(toolCallId, meta, args, entry, ctx: ProviderExecCtx)` 시그니처로 변경 후 성공/실패 경로에 `logUsage` 추가. 또는 인텐셔널 제외라면 스펙/주석에 명시.

---

### [WARNING] Multi-turn resume 로그가 원래 NodeExecution에 귀속됨
- **위치**: `ai-agent.handler.ts` 라인 ~763, 주석 참조
- **상세**: 코드 주석에 "Acceptable for activity-tab readability"라고 표기했지만, 긴 대화에서 여러 resumed turn의 MCP 호출이 모두 초기 `nodeExecutionId`로 묶이면 Activity 탭에서 동일 실행 아이디에 중복된 타임스탬프가 쌓인다. 시간 범위가 넓어지면 데이터 해석이 어려워진다.
- **제안**: 이 동작을 스펙 문서(`11-mcp-client.md` 등)에 명시하거나, resume마다 새 `nodeExecutionId`를 state에 업데이트하는 방향을 검토.

---

### [WARNING] auth 실패 감지가 휴리스틱 기반 (오탐/누락 위험)
- **위치**: `mcp-tool-provider.ts` — `/\b40[13]\b|unauthori[sz]ed|forbidden/i`
- **상세**: MCP SDK 에러 메시지는 표준화되어 있지 않다. HTTP 상태 코드 텍스트를 직접 포함하지 않는 래퍼 에러("connection refused after 401 retry")나 비영어 메시지, 숫자가 다른 문맥에 등장하는 경우(예: 에러 ID `14012`) 오작동 가능. 또한 `400` Bad Request(잘못된 인증 파라미터)는 포함하지 않는다.
- **제안**: MCP SDK가 구조화된 에러 코드를 제공한다면 해당 필드를 우선 참조. 그렇지 않다면 현재 방식이 best-effort임을 스펙에 명문화하고, 실제 운영에서 false positive/negative 발생 시 확장할 수 있도록 설계를 열어 두어야 함.

---

### [WARNING] `status: 'error'` 상태에서 성공 호출 시 자동 복구 없음
- **위치**: `integrations.service.ts` — `logUsage` 메서드
- **상세**: `MCP_AUTH_FAILED`가 발생하면 통합을 `error/auth_failed`로 전환하지만, 이후 인증이 성공해도(`status: 'success'`) `logUsage`는 `lastUsedAt`만 갱신하고 `status`를 `connected`로 되돌리지 않는다. 재인가 없이 다른 경로(예: 토큰 자동 갱신)로 인증이 해소되어도 UI는 계속 "needs reauthorization" 배지를 보여준다.
- **제안**: 인텐셔널(사용자의 명시적 재인가 필요)이라면 스펙에 명시. 자동 복구가 요구사항이라면 `status: 'success'` && `integration.status === 'error'` && `integration.statusReason === 'auth_failed'` 조건에서 `status`를 `connected`로 리셋하는 로직 추가.

---

### [INFO] `logUsage` await으로 MCP 툴 응답 레이턴시 증가
- **위치**: `mcp-tool-provider.ts` — `execute` 메서드 내 `await this.logUsage(...)`
- **상세**: 성공/실패 경로 모두 DB 쓰기(`usageLogRepository.save` + `integrationRepository.save`)를 직렬로 기다린 후 LLM에 tool_result를 반환한다. DB 레이턴시가 MCP 호출 체인 전체에 누적된다.
- **제안**: 성능이 중요한 경우 `void this.logUsage(...)` (fire-and-forget) 패턴 검토. 단, 에러 핸들링과 트랜잭션 순서 보장에 대한 트레이드오프 확인 필요.

---

### [INFO] `isError=true` 케이스에 대한 테스트 누락
- **위치**: `mcp-tool-provider.review.spec.ts` — Stage 5 테스트 블록
- **상세**: `MCP_TOOL_ERROR` 코드를 기록하는 `isError=true` 경로(`callTool` 반환값의 `isError` 플래그)에 대한 UsageLog 테스트가 없다. 해당 경로도 `logUsage`를 호출하지만 커버리지가 없다.
- **제안**: `callTool`이 `{ isError: true, content: [...] }`를 반환하는 케이스에서 `logUsage`가 `status: 'failed'`, `error.code: 'MCP_TOOL_ERROR'`로 호출됨을 검증하는 테스트 추가.

---

### [INFO] `integrations.service.spec.ts` — 비인증 실패 테스트에서 `statusReason` 검증 누락
- **위치**: `integrations.service.spec.ts` — `does NOT flip status for non-auth failures` 테스트
- **상세**: `expect.objectContaining({ status: 'connected' })`만 검증하고, `statusReason: null`이 유지되는지는 확인하지 않는다. `statusReason`이 의도치 않게 변경되어도 테스트가 통과된다.
- **제안**: `expect.objectContaining({ status: 'connected', statusReason: null })` 로 어설션 강화.

---

## 요약

이번 변경의 핵심인 **IntegrationUsageLog 통합**과 **MCP 인증 실패 시 status 전환**은 기능적으로 올바르게 구현되었다. 인터페이스 확장(`nodeExecutionId`, `workflowId`), 핸들러 연결, 서비스 레이어 상태 전환, 테스트 커버리지 모두 일관성이 있다. 그러나 **메타 도구 호출 누락**(Activity 탭 요구사항 미충족), **인증 오류 감지 휴리스틱의 신뢰도 한계**, **성공 호출 시 자동 복구 부재**는 운영 환경에서 사용자 경험에 직접 영향을 줄 수 있으므로 명시적으로 검토가 필요하다. 스펙 문서 갱신(`Stage 2 예정` 제거)은 구현 완료를 정확히 반영한다.

## 위험도

**MEDIUM** — 기능 결함은 아니나, 메타 도구 미기록과 인증 복구 누락이 사용자에게 잘못된 통합 상태를 표시할 수 있는 요구사항 갭이 존재함.