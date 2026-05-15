# Code Review 조치 — Stage 5 (commit `9ba52cf`) 후속

## 결과 요약
| 분류 | 건수 | 처리 |
|---|---|---|
| Critical | 0 | — |
| Warning | 11 | 8 코드/테스트, 3 deferred (운영 정책) |
| Info | 13 | 6 반영, 7 deferred |

## Warning 조치

### W-1. `logUsage` Read-Modify-Write race
**파일**: `backend/src/modules/integrations/integrations.service.ts`

`findOne` + `save` 흐름을 `integrationRepository.update({ id }, patch)` 단일 atomic SQL 로 교체. 패치는 `lastUsedAt` 만 항상, `lastError` / `status` / `statusReason` 은 실패 시에만 포함. 동시 호출이 경쟁해도 마지막 UPDATE 가 정확히 그 호출의 의도만 반영하므로 lost update 가 사라진다.

### W-2. `logUsage` 이중 역할 / Side Effect 문서화
JSDoc 에 명시:
- "**Side effect** — `error.code === MCP_AUTH_FAILED` 시 status='error' / statusReason='auth_failed' 로 전환"
- "**Never throws** — DB 실패는 swallow + console.warn"

또 spec/5-system/11-mcp-client.md §8.4 "인증 실패 자동 status 전환" 신설.

### W-3. `await logUsage()` → fire-and-forget
**파일**: `backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.ts`

`logUsage` private 메서드를 `fireUsageLog` 로 리네임 + `void this.integrationsService.logUsage(...).catch(...)` 패턴으로 변경. execute() 의 핫패스가 즉시 응답을 반환하고, DB I/O 는 백그라운드 microtask 에서 진행. logUsage 가 reject 해도 unhandled-rejection 경고 없이 swallow. 테스트: "logUsage rejection does not bubble out of execute()".

### W-4. SDK 구조화 에러 우선
신규 `isAuthFailure(err, message)` 헬퍼:
1. `err.status` / `err.statusCode === 401|403` 우선 검사
2. `err.code` 가 'unauthorized'/'forbidden' 패턴이면 true
3. 둘 다 없으면 message regex (`/\b40[13]\b|unauthori[sz]ed|forbidden/i`) fallback

테스트: "prefers SDK structured status over message regex for auth detection".

### W-5. `MCP_AUTH_FAILED` 공유 상수
신규 `backend/src/modules/mcp/mcp-error-codes.ts` — `MCP_ERROR_CODES`, `MCP_ERROR_MESSAGE_MAX_LEN`, `sanitizeMcpErrorMessage()` 를 export. McpToolProvider 와 IntegrationsService 가 동일 상수를 import 하므로 한쪽 오타가 컴파일 에러로 즉시 발견.

### W-6. `executeMeta` 로깅 — **의도적 제외**
spec §8.3 에 "메타 도구는 외부 API 호출이라기보다 MCP 세션의 내부 discovery 흐름이며, 매 호출 기록은 Activity 탭의 신호 대비 잡음을 키운다 — 추후 별도 dashboard 가 필요해지면 분리된 trace 로 도입" 으로 명시. 테스트: "does NOT log meta tool calls (Stage 5 scope)".

### W-7. 외부 오류 메시지 길이 cap
`mcp-error-codes.ts` 의 `MCP_ERROR_MESSAGE_MAX_LEN = 2048` 상수. `sanitizeMcpErrorMessage` 가 control char 제거 + clamp. `IntegrationsService.logUsage` 의 `clampMessage()` 헬퍼가 동일 한도 적용. 테스트: "clamps very long error messages before persisting".

### W-8. 단일 실패 status 전환 — **deferred**
OAuth integration 의 기존 정책과 일관 — 임계값 도입은 spec §8.4 에서 "별도 결정" 으로 명시. 운영 데이터 누적 후 재검토.

### W-9. 자동 복구 부재 — **deferred**
spec §8.4 에 "자동 복구는 하지 않는다" 명시. 토큰 race-of-clock 시 status 깜빡임 방지가 의도. 사용자가 명시적 Rotate / Reauthorize 로 복귀.

### W-10. 테스트 갭 4건
`mcp-tool-provider.review.spec.ts` 에 신규 6건 추가:
- isError=true → MCP_TOOL_ERROR 로 logUsage failed 경로 검증
- 403/Forbidden 메시지 패턴 → MCP_AUTH_FAILED
- SDK 구조화 status=401 → message regex 우회 우선 검증
- logUsage rejection swallow (execute 가 정상 resolve)
- nodeExecutionId 미제공 시 logUsage skip
- 메타 도구 호출 시 logUsage 미호출

### W-11. `ProviderExecCtx` 인프라 필드 노출 — **deferred**
`nodeExecutionId` / `workflowId` 를 `usageCtx?` 서브타입으로 그룹화하면 인터페이스가 더 깔끔해지지만, 현재 사용처는 `McpToolProvider` 한 곳뿐이고 KbToolProvider 가 동일 ctx 를 받지만 무시한다. 인터페이스 진화는 새 provider 가 이 fields 를 활용하기 시작할 때 함께 진행.

## Info 반영

| 항목 | 조치 |
|---|---|
| I-1 logUsage JSDoc | 상태 전이 + Never throws 명시 |
| I-7 spec 갱신 | spec/5-system/11-mcp-client.md §8.3, §8.4 추가 |
| I-8 statusReason null 검증 | 테스트에서 patch.status / patch.statusReason 둘 다 undefined 검증 |
| I-9 mock 객체 격리 | `Object.assign(integrations, ...)` → `{ ...integrations, logUsage }` 스프레드 |
| I-10 어설션 통일 | `mock.calls[0][0]` → `expect.toHaveBeenCalledWith(expect.objectContaining(...))` |
| I-13 로그 개행 정제 | `sanitizeMcpErrorMessage()` 가 logger.warn 직전 적용 |

## Info 미반영 (deferred)
- I-2 `usageCtx?` 그룹화 — W-11 와 동일
- I-3 트랜잭션 — atomic UPDATE 도입으로 race 자체는 해소. `usageLog.save` + integration update 분리는 남지만 logUsage 는 비-트랜잭션 best-effort 가 정상.
- I-4 workspaceId guard — atomic update 가 `{ id }` 만 매칭하므로 cross-workspace integrationId 가 도달할 수 없는 호출 경로에서만 사용됨 (provider 내부에서 `getForExecution(id, workspaceId)` 로 미리 검증). 추가 cost 없이 안전.
- I-5 Promise.all — atomic update 후 single-SQL 이라 무관
- I-6 핸들러 주석 — multi-turn 외 single-turn 도 동일 호출 경로라 코드 자명
- I-11 multi-turn state cast 가드 — 향후 Zod resume schema 도입 시 함께
- I-12 multi-turn FK attribution — 운영 데이터 분석 후 결정

## 검증
- `npm run lint` clean
- backend 159 suites · **2543 tests** 통과 (Stage 5 review 신규 8건)
- `npm run build` clean
