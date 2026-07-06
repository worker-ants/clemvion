### 발견사항

- **[INFO]** Cafe24/Makeshop `mcpErrorDelta` 는 4xx(401/404) 케이스만 검증, `codeForStatus` 의 5xx 분기는 delta 관점에서 미검증
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/cafe24-mcp-tool-provider.spec.ts` (신규 401 테스트), `codebase/backend/src/nodes/ai/ai-agent/tool-providers/makeshop-mcp-tool-provider.spec.ts` (신규 404 테스트), 구현측 `cafe24-mcp-tool-provider.ts:517-528` / `makeshop-mcp-tool-provider.ts:519-531` (`status === 'error'` → `result.status >= 400` 모두 대상, `codeForStatus(result.status)`)
  - 상세: `mcpErrorDelta` 는 `result.status >= 400` 전 구간에서 채워지지만 신규 테스트는 각각 한 상태코드만 exercise 한다. `codeForStatus` 자체는 이번 diff 범위 밖(재사용 기존 로직)이라 회귀 리스크는 낮지만, 5xx 응답이 4xx 와 다른 코드 문자열을 반환하는 로직이라면 delta.code 값이 실제로 그 분기를 반영하는지는 확인되지 않는다.
  - 제안: 필수는 아님(이전 리뷰 라운드에서 이미 INFO 로 식별·follow-up 백로그 처리됨). 추가 여력이 있다면 `it.each`로 400/401/404/500 등 대표 상태코드별 `mcpErrorDelta.code` 를 검증.

- **[INFO]** `redactMcpSecrets` idempotency 및 다중 패턴 중첩 케이스 미검증
  - 위치: `codebase/backend/src/modules/mcp/mcp-error-codes.spec.ts`
  - 상세: 이미 redact 된 `***` placeholder 가 재적용 시 다시 매칭되어 변형되지 않는지, URL userinfo + query token 이 한 문자열에 동시에 나타날 때 두 패턴이 서로 간섭하지 않는지에 대한 케이스가 없다. 정규식 유지보수 시 회귀가 발생하기 쉬운 지점이나 현재 커버리지(5개 패턴 + clamp 경계 + null 처리)가 이미 탄탄해 중대성은 낮다.
  - 제안: 선택 사항. 여력이 있으면 `it.each` 로 idempotency/중첩 2케이스 추가.

- **[INFO]** `ai-turn-executor.spec.ts` 신규 테스트가 call-phase 만 단독 검증, build-phase(`serverSummaries`)와의 병합 시나리오는 없음
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.spec.ts` L291-368 신규 `it`
  - 상세: choke point(`executeProviderToolBatch`)가 `execResult.mcpErrorDelta` 를 `mcpDiagnosticsAcc.errors` 로 push 하는 로직은 정확히 격리되어 검증된다. 다만 동일 턴에서 build-phase 실패(`ctx.mcpDiagnosticErrors` 경유)와 call-phase 실패가 함께 발생해 `errors[]` 에 병합되는 케이스는 별도로 없다 — 각 관심사가 이미 분리 테스트돼 있어 critical 하지는 않다.
  - 제안: 선택 사항, 회귀 방지용 통합 케이스 1건 추가 고려.

- **[INFO]** 신규 fake-timer 테스트(`mcp-client.service.spec.ts`)와 `META_PHASE` `it.each` 확장(`mcp-tool-provider.spec.ts`)은 이전 리뷰 라운드(23_20_02)의 WARNING #1/#2 를 정확히 해소함 — 검증 완료
  - 위치: `codebase/backend/src/modules/mcp/mcp-client.service.spec.ts` L183-243 (`connect — timeout classification`), `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.spec.ts` L925-1041 (`it.each` 4종 메타도구)
  - 상세: (a) fake-timer 테스트는 `jest.useFakeTimers()` + `advanceTimersByTimeAsync(10_000)` 로 실제 `connectTimeoutMs` 기본값(`DEFAULT_CONNECT_TIMEOUT_MS = 10_000`, `mcp-client.service.ts:190`)과 정확히 일치시켜 `abort()` 이벤트 발동 → `TimeoutError` throw 를 실제 타이머 경합으로 검증하고, 비-timeout 실패(원본 에러 그대로 전파, `TimeoutError` 아님) 분기도 별도 케이스로 커버한다 — 두 분기(`timedOut=true`/`false`) 모두 커버됨. (b) `it.each` 는 4개 메타도구(`list_resources`→`resources/list`, `read_resource`→`resources/read`, `list_prompts`→`prompts/list`, `get_prompt`→`prompts/get`) 전수에 대해 `META_PHASE` lookup 오류(예: phase 스왑)를 잡아낼 수 있도록 파라미터화되어 있다. 실제 `npx jest` 실행 결과 관련 7개 스위트 208 테스트 전부 통과 확인.
  - 제안: 해당 없음(확인용 기록).

- **[INFO]** 테스트 가독성·의도 표현 양호
  - 위치: 전체 신규/변경 테스트
  - 상세: 각 `it()` 설명이 스펙 섹션(`§8.1`, `§8.2`, `§9`)을 인용하고, "client-side 는 delta 를 보고하지 않는다"는 negative case 를 명시적으로 별도 테스트화(`cafe24-mcp-tool-provider.spec.ts`, `makeshop-mcp-tool-provider.spec.ts`, `mcp-tool-provider.spec.ts` 의 `INVALID_TOOL_ARGUMENTS`/`*_MISSING_FIELDS` 케이스)해 "무엇을 하지 않아야 하는가"까지 회귀 방지 대상으로 다룬다. mock(`makeSession`/`makeCall`/`fullMock`)이 실제 SDK/provider 인터페이스 shape 을 정확히 흉내내고 있어 mock-실동작 괴리가 낮다.

- **[INFO]** 테스트 격리 양호
  - 상세: 신규 테스트 모두 `mockResolvedValueOnce`/`mockRejectedValueOnce`/`mockImplementationOnce` 를 사용해 다른 테스트에 상태가 누수되지 않는다. fake-timer 테스트는 `try/finally` 로 `jest.useRealTimers()` 복원을 보장해, 실패 시에도 이후 테스트에 fake timer 가 잔류하지 않도록 방어되어 있다.

### 요약

이번 변경분(연결 타임아웃 분류, call-phase `mcpErrorDelta` 도입, 에러 메시지 redaction, test-connection 서비스의 `MCP_TIMEOUT` 소비)은 각 코드 경로에 대응하는 단위 테스트가 신규로 충실히 추가됐고, 특히 이전 리뷰 라운드에서 지적된 두 WARNING(connect 의 실제 abort/타이머 경합 미검증, `META_PHASE` 4종 중 1종만 검증)이 이번 diff 에서 fake-timer 테스트와 `it.each` 파라미터화로 정확히 해소된 것을 코드 레벨에서 직접 확인했다(관련 7개 스위트 208 테스트 로컬 재실행 통과). 남은 갭은 Cafe24/Makeshop 5xx `codeForStatus` 분기의 delta 미검증, redaction 함수의 idempotency/다중패턴 중첩 미검증, build+call phase 병합 통합 테스트 부재 정도로 모두 INFO 수준이며 기존 리뷰에서 이미 follow-up 백로그로 식별되어 있어 본 PR 을 막을 사안은 아니다. client-side vs server-side 실패의 구분을 negative test 로 명시하는 패턴, spec 섹션 인용 네이밍, mock 격리 모두 양호하다.

### 위험도
LOW
