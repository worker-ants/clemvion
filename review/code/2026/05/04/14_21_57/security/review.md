## 발견사항

### **[WARNING]** 외부 MCP 오류 메시지 무제한 저장 (잠재적 스토리지 어뷰징)
- **위치**: `integrations.service.ts:508` / `mcp-tool-provider.ts:logUsage()`
- **상세**: MCP 서버가 반환하는 오류 메시지(`e.message`)가 길이 제한 없이 `integration.lastError.message`에 그대로 저장됨. 악성 또는 손상된 MCP 서버가 수 MB 크기의 오류 문자열을 반복 반환하면 DB JSONB 컬럼을 오염시킬 수 있음.
- **제안**: `logUsage` 호출 전 `message`를 고정 길이(예: 2048자)로 잘라낼 것.

```typescript
const message = (e instanceof Error ? e.message : String(e)).slice(0, 2048);
```

---

### **[WARNING]** 외부 오류 메시지의 로그 인젝션 가능성
- **위치**: `mcp-tool-provider.ts` catch 블록 — `McpToolProvider.logger.warn(...)`
- **상세**: MCP 서버 응답에서 추출한 `message`가 필터링 없이 로거에 전달됨. ANSI 이스케이프 코드나 개행 문자가 포함된 메시지는 로그 집계 도구(Datadog, CloudWatch 등)에서 라인 파싱을 깨뜨릴 수 있음. 로그 주입 공격 벡터가 아니라, 운영 로그 신뢰도 저하와 모니터링 우회 가능성이 문제.
- **제안**: 로거에 전달하기 전 개행 문자를 제거하거나, 구조화 로깅(JSON) 사용.

```typescript
const safeMessage = message.replace(/[\r\n]/g, ' ').slice(0, 512);
McpToolProvider.logger.warn(`MCP_CALL_FAILED ...: ${safeMessage}`);
```

---

### **[WARNING]** 악성 MCP 서버에 의한 통합 상태 조작 (의도적 DoS)
- **위치**: `mcp-tool-provider.ts:365-385` / `integrations.service.ts:511-515`
- **상세**: MCP 서버가 HTTP 401 오류를 의도적으로 반환하면 `MCP_AUTH_FAILED` 코드가 생성되고, `integration.status = 'error'` / `statusReason = 'auth_failed'`로 전환됨. 사용자에게 "재인증 필요" 배지가 노출되어 해당 통합을 사용하는 모든 워크플로가 중단될 수 있음. 외부 MCP 서버(third-party)가 자신을 레지스트리에서 제거하지 않고 의도적으로 401을 반환해 통합을 디스에이블시킬 수 있음.
- **제안**: 단일 실패로 상태를 전환하는 대신 연속 실패 횟수 임계값(예: N회 연속 `MCP_AUTH_FAILED`) 또는 시간 윈도우 내 실패율 기반 전환 적용을 검토.

---

### **[INFO]** 휴리스틱 인증 실패 감지 정규식 — 오탐 가능성
- **위치**: `mcp-tool-provider.ts`
  ```typescript
  const isAuthFailure = /\b40[13]\b|unauthori[sz]ed|forbidden/i.test(message);
  ```
- **상세**: MCP SDK 오류 메시지가 표준화되지 않아 문자열 매칭에 의존. "403 rate limit" 같이 비인증 이유의 403 오류도 `MCP_AUTH_FAILED`로 분류되어 잘못된 재인증 요구가 발생할 수 있음. 반대로 비영어권 오류 메시지("인증 실패")나 커스텀 포맷은 감지되지 않음. ReDoS 위험은 없음.
- **제안**: 중요도 낮으나, HTTP status code를 직접 파싱할 수 있다면 문자열 매칭보다 신뢰도 높음. 현재로서는 코드에 "best-effort" 주석이 있어 적절히 문서화됨.

---

### **[INFO]** 메타 툴 호출이 활동 로그에서 누락됨
- **위치**: `mcp-tool-provider.ts` — `executeMeta()` 메서드
- **상세**: `list_resources`, `read_resource`, `list_prompts`, `get_prompt` 호출 시 `logUsage()`가 호출되지 않음. 정규 툴과 달리 메타 툴 사용 패턴이 Activity 탭에 표시되지 않아, 비정상적인 리소스 접근(예: 대용량 파일 반복 읽기)을 감사할 수 없음.
- **제안**: 보안 감사 요건에 따라 메타 툴에도 `logUsage()` 적용 고려.

---

### **[INFO]** Multi-turn resume 시 `as string | undefined` 타입 캐스트
- **위치**: `ai-agent.handler.ts:765-766`
  ```typescript
  nodeExecutionId: state.nodeExecutionId as string | undefined,
  workflowId: state.workflowId as string | undefined,
  ```
- **상세**: 지속된 state에서 복원하는 값에 런타임 검증 없이 타입 캐스트 사용. state가 DB에서 역직렬화될 때 필드가 누락되거나 다른 타입이면 예상치 못한 동작이 발생할 수 있음. 공격 표면은 서버 내부 상태이므로 실질 위험은 낮음.
- **제안**: `typeof state.nodeExecutionId === 'string'` 검사 또는 Zod 스키마 파싱 적용.

---

## 요약

이번 변경사항은 MCP 인증 실패를 통합 상태로 전파하는 기능으로, 전반적으로 보안 설계가 양호하다. 핵심 위험은 **외부 MCP 서버가 신뢰된 입력원이 아님**에서 발생한다. 오류 메시지 길이 제한 미적용, 로그 인젝션 가능성, 단일 실패로 통합 상태를 전환하는 설계 모두 외부 서버의 악의적 응답에 의한 영향을 과도하게 허용한다. 서버 오류 메시지에 대한 길이 클램핑과 재인증 상태 전환에 대한 실패 임계값 도입을 우선적으로 검토할 것을 권장한다.

## 위험도

**LOW** — 현재 구조에서 내부 사용자가 등록한 MCP 서버만 활용되고, 외부 공격자가 직접 `logUsage` 경로에 접근할 수 없다. 그러나 서드파티 MCP 서버 도입 시 위험도가 MEDIUM으로 상승할 수 있음.