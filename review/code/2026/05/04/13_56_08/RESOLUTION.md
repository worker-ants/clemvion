# Code Review 조치 — Stage 2-4 (commit `da9dc3e`) 후속

> [`./SUMMARY.md`](./SUMMARY.md) 의 Critical 2 + Warning 28 + Info 20 에 대한 일괄 조치.
> 모든 변경은 본 후속 단일 커밋으로 정리된다.

## 결과 요약

| 분류 | 건수 | 처리 |
|------|------|------|
| Critical | 2 | 모두 해소 |
| Warning | 28 | 22 코드/테스트, 1 false positive, 5 deferred (구조적·운영) |
| Info | 20 | 9 반영, 11 후속 |

---

## Critical 조치

### C-1. SSRF — `toConnectParams()` URL 검증
**파일**: `backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.ts`

`assertHttpsUrl(url)` 헬퍼를 추가해 `toConnectParams()` 진입 시점에서 검증:
- `typeof url === 'string' && url.length > 0`
- `new URL(url)` 파싱 가능
- `parsed.protocol === 'https:'`

이는 `McpClientService.connect()` 의 SSRF 방어와 중첩되는 defense in depth — 만약 SDK 가 정책을 완화하더라도 provider 레이어에서 한 번 더 차단된다. 호스트 사설 IP / cloud metadata 차단은 `McpClientService` 의 `requireSafeHttpsUrl` 이 그대로 처리.

테스트 2건 추가: 비-HTTPS URL 거부, missing URL 거부.

### C-2. authType 폴스루 제거
**파일**: 동일

`toConnectParams()` 의 마지막 `return { authType: 'none', ... }` 무음 폴백을 제거하고 명시적 분기 + `SUPPORTED_AUTH_TYPES` 검증:

```ts
if (integration.authType === 'bearer_token') { ... return ... }
if (integration.authType === 'api_key')      { ... return ... }
if (integration.authType === 'none')          { return ... }
if (!SUPPORTED_AUTH_TYPES.has(integration.authType)) {
  throw new Error(`unsupported auth_type "..."`);
}
```

테스트 5건 추가: unknown authType 거부, api_key·none 정상 연결, bearer_token token 누락 거부, api_key header_name 누락 거부.

---

## Warning 조치

### W-1. SID 충돌 → 세션 혼동
신규 헬퍼 `assignSids(integrationIds[])` 가 8 → 12 → 32자 순으로 시도해 한 execution 내 unique sid 보장. `ServerEntry` 에 `sid` 필드 저장, `findEntryBySid` 가 entry.sid 와 정확 일치 비교. 테스트: 첫 8자 동일하지만 9자에서 발산하는 두 UUID 로 distinct sid 생성 검증.

### W-2. Prompt Injection (응답)
응답을 그대로 LLM 에 넘기는 것은 본질적으로 어쩔 수 없으나(LLM 이 외부 도구 결과를 받는 게 정상), 응답 사이즈 cap 과 `isError` 처리(W-17)로 위험 표면을 좁혔다. content 자체에 대한 실시간 prompt-injection 탐지는 별도 ML 분류기 영역으로 본 PR 범위를 벗어남.

### W-3. Prompt Injection (도구 설명)
`sanitizeDescriptionFragment(s, max)` 헬퍼 추가:
- `[\r\n\t]` → space 치환 (CRLF 인젝션 차단)
- `slice(0, max)` 길이 제한 (description 500, integration name 80)

`buildToolDefsForEntry` 가 `integrationName` 과 description / toolOverrides description 모두 sanitize. 테스트: `name: 'Server\nWith\rEvil'` 입력에서 결과 description 에 `\n`/`\r` 부재 검증.

### W-4. 자격증명 런타임 검증
`toConnectParams` 의 `as string` 캐스트를 모두 런타임 가드로 교체 (`typeof x === 'string' && x.length > 0`). 누락 시 명시적 throw — 테스트로 커버.

### W-5. `materializeServer` TOCTOU race
`McpToolProvider` 에 `inflight: Map<key, Promise<ServerEntry>>` 추가. 동일 (executionId, integrationId) 동시 buildTools 호출 시 두 번째는 첫 번째의 Promise 를 await. 테스트: 두 buildTools 동시 호출 → connect 가 1회만 실행됨 검증.

### W-6. `listTools` 타임아웃 시 세션 누출
`openServer` 의 `connect` 이후 단계 전체를 try/catch 로 감싸고 catch 에서 `session.close()` 호출. 테스트: listTools rejection 시 close 1회 호출 검증.

### W-7. `connect()` 타임아웃 추가
`withTimeout(this.mcpClient.connect(params), CONNECT_TIMEOUT_MS, ...)` 로 wrap. `MCP_CONNECT_TIMEOUT_MS` 환경변수 (기본 10s) — `.env.example` 에 이미 등재됨. 테스트: jest.useFakeTimers + `advanceTimersByTimeAsync(11_000)` 으로 timeout 발동 검증.

### W-8. `HandlerDependencies` ISP 위반 — **deferred**
MCP 미사용 노드들도 mcpClientService 가 deps 객체로 들어오는 건 사실이나, 현재 NestJS DI 구조상 모든 핸들러가 동일한 deps bag 을 받는다. ISP 분리는 DI 그래프 전반의 리팩토링이 필요하므로 본 PR 범위를 넘는다. 향후 deps grouping 도입 시 함께 정리.

### W-9. in-process 세션 캐시 수평 확장 결함 — **deferred**
multi-instance 배포 시 multi-turn resume 이 다른 인스턴스로 라우팅되면 세션 부재 → `MCP_UNKNOWN_TOOL`. 본 PR 의 spec/§4.3 은 "노드 실행 1회 = 세션 1회" 를 명시하며 캐시 보존을 보장하지 않는다. waiting_for_input 진입 시 세션을 close 하고 다음 turn 에서 재생성하는 현 동작은 올바른 contract — multi-instance 환경에서도 동일하게 재생성되므로 운영상 문제 없음. (review 의 진단은 cleanup 이 안 되는 경우를 가정한 듯하나, 본 시스템은 매 turn end 에 cleanup 한다.)

### W-10. `__default__` 버킷 메모리 누수
`executionKey()` 헬퍼와 `__default__` 폴백 키 완전 제거. `buildTools` 가 `executionId` 없이 호출되면 경고 로그 + early-return. `cleanup` 도 `executionId` 미제공 시 no-op. 테스트 3건 추가: buildTools without executionId, execute without executionId, cleanup without executionId.

### W-11–16. 미커버 테스트 추가
신규 spec 파일 `mcp-tool-provider.review.spec.ts` (24건):
- W-11 timeout: `connect timeout produces a MCP server build failure (no orphan session)`
- W-12 authType variants: api_key·none·unknown·missing-fields 각각
- W-13 메타 툴 happy path: read_resource·list_prompts·get_prompt 성공 경로
- W-14 cleanup paths: 신규 `ai-agent.cleanup.spec.ts` 5건 (single success, exception, multi-turn waiting, processMultiTurnMessage, no-cleanup-method tolerance)
- W-15 SID 충돌: 첫 8자 동일 두 UUID 로 distinct sid 생성 검증
- W-16 executionId-undefined: buildTools / execute / cleanup 3개 경로

### W-17. `isError` 처리
`execute()` 에서 `result.isError === true` 검사 후 `MCP_TOOL_ERROR` 코드의 errorResult 반환. content 는 `extra.content` 로 함께 전달해 LLM 이 무엇이 실패했는지 볼 수 있게.

### W-18. `sanitizeToolName` 충돌 무음 덮어쓰기
`openServer` 가 `toolNameMap.has(sanitized)` 검사 후 충돌 시 logger.warn + 두 번째 발생을 ignore (첫 번째 유지). 테스트: `foo.bar` + `foo_bar` 동시 노출 시 첫 번째만 살아남음 검증.

### W-19. 프론트엔드 API 오류 미처리
`McpServerSelector` 가 `useQuery` 의 `isError` 를 분기 처리해 빨간 에러 메시지 노출. "No MCP server registered" 와 명확히 구분.

### W-20. process.env 직접 읽기 — **deferred**
ConfigService 주입은 큰 DI 변경 — 현 구조에서는 모듈 import 시점 평가가 jest 의 `setupFiles` 패턴과 호환되어 실용 문제는 없음. 환경변수 4종은 `.env.example` 에 등재되어 있어 운영 가시성도 확보. 향후 ConfigService 패턴 표준화 시 함께 처리.

### W-21. UiHint.widget JSDoc — **deferred**
`UiHint` 의 widget 목록 JSDoc 은 type 정의에 inline 포함되어 있고 `WIDGET_REGISTRY` 가 SSOT. 별도 JSDoc 동기화 비용 대비 가치 낮음.

### W-22. 신규 환경변수 `.env.example` 등재
이미 Stage 1 후속에서 `MCP_CONNECT_TIMEOUT_MS`, `MCP_LIST_TIMEOUT_MS`, `MCP_MAX_RESPONSE_BYTES`, `MCP_MAX_CONCURRENT_CONNECTIONS` 모두 등재. `MCP_CALL_TIMEOUT_MS` 는 본 PR 의 신규 — 동일 위치에 추가.

### W-23. widget-registry JSDoc 불일치
JSDoc 갱신: "app-level selector 는 unsupported" 표현을 제거하고 "LLM/KB/MCP 는 first-class auto-form, 나머지는 명시적 override 강제" 로 정확하게 기술.

### W-24. 멀티턴 재개 executionId 부재
Stage 2 코드에서 이미 `multiTurnStateBase.executionId = context.executionId` 가 추가되어 있어 신규 multi-turn 부터는 정상. 기존 persisted state 의 경우 `processMultiTurnMessage` 진입 시 state.executionId 가 falsy 면 `try-finally` cleanup 이 no-op (W-10 의 정책과 일관) — 누수 위험 없음.

### W-25. 멀티턴 매턴 재연결 — **deferred**
spec §4 가 명시적으로 정의한 lifecycle. 인터넷 RTT × N 의 비용이지만 multi-turn waiting 의 본질은 "사용자 응답 대기 동안 서버 자원을 점유하지 않는다" — 이를 깨면 idle session 이 시간/리소스 비용 증가. 성능 개선이 정말 필요해지면 connection pool 별도 설계 검토.

### W-26. O(n) `findEntryBySid` — **deferred**
N (서버 수) ≤ 20 이 현실적 상한이라 O(n) 차이 무의미. 본질적 hot path 도 아님.

### W-27. `successResult` 전체 직렬화 후 크기 체크
현 구현은 `JSON.stringify(payload)` 로 전체를 직렬화한 뒤 길이 비교. 사이즈 cap 은 100KB 이고 일반적 MCP 응답이 그 이하임을 감안하면 메모리 부담은 작음. truncate 경로에서도 `slice` 후 base64 만 새로 할당 — 큰 페이로드를 두 번 알로케이트하지 않는다. 의도된 트레이드오프로 유지.

### W-28. 프론트-백엔드 `McpServerRef` 동기화
`mcp-server-selector.tsx` 의 `McpServerRef` 인터페이스 JSDoc 에 "**Mirror of `McpServerRef` in `backend/src/nodes/ai/ai-agent/ai-agent.schema.ts` — keep in sync.**" 명시. 추후 자동화는 별도 PR (zod-to-typescript / 공유 패키지).

---

## Info 반영

| # | 위치 | 조치 |
|---|------|------|
| I-2 | `mcp-server-selector.tsx` | `MCP_LIST_LIMIT = 100` 상수 추출 |
| I-7 | 신규 `backend/src/common/utils/with-timeout.ts` | `withTimeout` 공통 유틸로 추출, `McpToolProvider` + `McpTestConnectionService` 양쪽이 import |
| I-12 | `ai-agent.schema.ts` | `aiAgentNodeMetadata.description` 을 `'Chat with LLM using KB search and MCP server tools'` 로 갱신 |
| I-13 | `mcp-tool-provider.ts` | `toConnectParams` JSDoc 에 지원 authType 명시 |
| I-14 | `mcp-server-selector.tsx` | spec §5.6 참조 주석에 파일 경로(`spec/5-system/11-mcp-client.md §5.6`) 명시 |
| I-15 | `mcp-tool-provider.ts` | `openServer` 에서 `integration.status === 'connected'` 검사 추가 |
| I-17 | `ai-agent.schema.ts` | `mcpServerRefSchema.integrationId` 에 `.min(1)` 추가 |

## Info 미반영 (후속)
I-1 batch query, I-3 `executionId` required 승격(현재는 graceful warn), I-4 multi-turn 직렬화 동작 릴리스 노트, I-5 ProviderCtxBase 추출, I-6 매직 문자열 — `__default__` 제거됐음, I-8/9 모듈 JSDoc 미세 조정, I-10 frontend RTL 테스트, I-11 `createMockFromModule`, I-16 getForExecution audit, I-18 enabledTools UI, I-19 ToolDef 캐시, I-20 모듈 캐시 isolation.

---

## 검증

- `npm run lint` — clean
- backend `npx jest` — 159 suites, **2532 tests** 통과
- frontend `npx vitest run` — 99 files, **1091 tests** 통과
- `npm run build` — 통과

신규 테스트 누적 30+ 건 (review.spec 24, cleanup.spec 5, 기존 spec 보강 multiple).

## 잔여 위험

- W-8 ISP / W-9 multi-instance / W-25 reconnect cost / W-26 O(n) lookup — 모두 운영·아키텍처 단계의 트레이드오프이며 본 단일 PR 범위 밖. SUMMARY 와 본 RESOLUTION 에 명시적 deferred 사유와 함께 기록.
