## 발견사항

### [WARNING] `logUsage`의 역할 이중화 — logging + 상태 전이
- **위치**: `integrations.service.ts` +508~516
- **상세**: `logUsage`는 원래 fire-and-forget 활동 로깅 전용으로 설계되었지만(메서드 JSDoc, swallow catch 패턴), 이번 변경으로 `integration.status`와 `statusReason`을 직접 변경하는 상태 전이 로직이 추가되었습니다. 이 메서드를 호출하는 다른 핸들러(미래 HTTP 핸들러, DB 핸들러 등)가 동일한 패턴으로 `logUsage`를 재사용할 경우, 상태 전이가 발생한다는 사실을 인지하지 못할 수 있습니다.
- **제안**: 의도가 명확하도록 메서드 JSDoc에 "MCP_AUTH_FAILED 코드 수신 시 integration.status를 'error'로 전이함" 명시 추가. 또는 `transitionOnAuthFailure(integration, params.error)` 같은 분리된 private 메서드로 추출.

---

### [WARNING] auth failure 감지 휴리스틱의 취약성
- **위치**: `mcp-tool-provider.ts` +390
- **상세**: `/\b40[13]\b|unauthori[sz]ed|forbidden/i` 정규식으로 MCP SDK 예외 메시지에서 인증 실패를 판단합니다. MCP SDK 구현체마다 오류 메시지 형식이 비표준이며, 미래 SDK 업데이트나 다른 MCP 서버 구현체에서 같은 숫자가 다른 맥락으로 등장할 수 있습니다. 특히 `\b40[13]\b`는 "Error 4013" 같은 커스텀 오류 코드와도 매칭될 수 있습니다.
- **제안**: 정규식에 HTTP 상태 코드 패턴을 더 명시적으로 제한(`HTTP\s+40[13]|\bstatus\s+40[13]`) 하거나, MCP SDK가 구조화된 오류 객체를 제공한다면 메시지 파싱 대신 속성 접근으로 전환.

---

### [WARNING] `executeMeta` 경로에서 usage 로깅 누락
- **위치**: `mcp-tool-provider.ts` `executeMeta` 메서드
- **상세**: `execute()`의 일반 tool 경로에는 `logUsage`가 추가되었지만, `list_resources`, `read_resource`, `list_prompts`, `get_prompt` 등 메타툴 경로(`executeMeta`)에는 `logUsage` 호출이 없습니다. Integration 상세 화면의 Activity 탭에 메타툴 호출이 기록되지 않아 실제 사용량과 표시 데이터 간의 불일치가 발생합니다.
- **제안**: 설계상 의도적 제외라면 `executeMeta` 상단에 주석으로 명시. 로깅이 필요하다면 `execute()`에서 `meta` 여부와 무관하게 `callStartedAt` 캡처 후 `executeMeta`가 완료된 뒤 `logUsage` 호출.

---

### [WARNING] 에러 코드 대소문자 불일치 — `'auth_failed'` vs `'MCP_AUTH_FAILED'`
- **위치**: `integrations.service.ts` 기존 테스트(+665~677) vs 신규 테스트(+678~696)
- **상세**: 기존 테스트 `'records lastError on failure'`는 `error: { code: 'auth_failed' }` (소문자, MCP_ 접두사 없음)를 넘겨도 `integrationRepo.save`가 호출됩니다. 그러나 status 전이는 `'MCP_AUTH_FAILED'`에만 발동합니다. 향후 핸들러가 `'auth_failed'` 코드를 사용할 경우 status 전이가 발생하지 않아 UI에 배지가 표시되지 않는 버그가 생길 수 있습니다. 두 코드 체계가 혼용될 가능성이 있습니다.
- **제안**: 어느 코드 체계를 정규 코드로 사용할지 확정하고, `logUsage` 내 조건을 `code?.toUpperCase().includes('AUTH_FAILED')` 또는 허용 코드 Set으로 명시화.

---

### [INFO] multi-turn resume 시 `nodeExecutionId` 귀속 불일치
- **위치**: `ai-agent.handler.ts` +763~770
- **상세**: resume 경로에서 `state.nodeExecutionId`(최초 waiting 시점의 NodeExecution ID)를 사용합니다. 새 턴에서 발생한 MCP 호출이 이전 NodeExecution에 귀속되어 `IntegrationUsageLog.nodeExecutionId` FK가 실제 실행 시점의 NodeExecution을 가리키지 않습니다. 코드 주석에 명시되어 있으나 DB 조인 쿼리 시 혼동을 야기할 수 있습니다.
- **제안**: 현재는 허용 가능한 트레이드오프. 추후 resume 경로도 새 `nodeExecutionId`를 부여할 수 있다면 해당 ID를 state에 저장하여 전달하는 방안 고려.

---

### [INFO] `ProviderExecCtx` 인터페이스 변경 — 기존 구현체 영향
- **위치**: `agent-tool-provider.interface.ts` +68~74
- **상세**: `nodeExecutionId?`, `workflowId?`가 optional로 추가되었으므로 `KbToolProvider` 등 기존 구현체는 영향 없습니다. 다만 `execute(call, ctx)` 호출 측 중 일부가 `ctx`를 직접 생성하는 경우, 두 필드 없이도 컴파일·동작하므로 usage 로깅이 자동으로 스킵됩니다(의도된 동작).

---

### [INFO] spec 문서 "(Stage 2에서 핸들러 통합 예정)" 제거
- **위치**: `spec/4-nodes/3-ai-nodes.md` +29
- **상세**: 구현 완료를 반영한 문서 갱신. 기술적 부작용 없음.

---

## 요약

이번 변경의 핵심 부작용은 **`logUsage`가 단순 로깅 역할을 넘어 integration 상태 머신을 전이시키는 이중 역할을 갖게 된 점**입니다. 이 전이는 try-catch로 감싸져 실행 흐름을 깨뜨리지 않으며, `MCP_AUTH_FAILED` 코드에만 한정되어 있어 과도한 상태 변경은 아닙니다. 다만 `executeMeta` 경로 로깅 누락, auth failure 정규식 휴리스틱의 취약성, `'auth_failed'`와 `'MCP_AUTH_FAILED'` 두 코드 체계의 혼용 가능성이 미래 버그의 씨앗이 될 수 있습니다. 인터페이스 변경은 모두 additive optional 추가이므로 기존 호환성을 깨지 않습니다.

## 위험도

**LOW — MEDIUM**