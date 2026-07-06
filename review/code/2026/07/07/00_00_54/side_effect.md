### 발견사항

- **[INFO]** `sanitizeMcpErrorMessage()` 의 출력값이 기존 호출자 모두에게 변경됨 (redaction 추가)
  - 위치: `codebase/backend/src/modules/mcp/mcp-error-codes.ts:84-106` (`sanitizeMcpErrorMessage`), 소비처 `mcp-tool-provider.ts` (logger.warn 메시지, `errorResult` message, `IntegrationUsageLog.error`, `Integration.last_error` 등 §8.2/§8.3 sink 전부)
  - 상세: 함수 시그니처(`(raw: unknown) => string`)는 그대로지만 순수 함수의 **동작이 바뀌어** 기존 모든 호출자가 영향을 받는다. 새 `redactMcpSecrets()` 가 `sanitizeMcpErrorMessage` 내부에서 clamp 전에 무조건 적용되므로, 과거엔 그대로 보존되던 에러 문자열 중 `MCP_EXTRA_SECRET_PATTERNS`(URL userinfo, bare `token=`) 또는 공용 `SECRET_LEAK_PATTERNS` 에 우연히 매치되는 비-시크릿 프로즈(예: 실제 자격증명이 아닌데 `scheme://a:b@host` 형태를 우연히 포함하는 진단 텍스트, 혹은 `...&token=none` 같은 문자열)는 예고 없이 `***` 로 마스킹된다. 이는 의도된 defense-in-depth 강화이며 diff 작성자도 이를 인지하고 있으나(`redact-후-clamp` 순서 코멘트), **로그 파서·다운스트림 알림·과거 스냅샷 테스트가 정확 문자열 매치를 하고 있었다면 조용히 깨질 수 있는 부작용**이다. 리뷰 대상 diff 안에서 이 함수의 소비처는 `mcp-tool-provider.ts` 한 곳뿐으로 확인되어(grep, 다른 서비스가 직접 import 하지 않음) 실질 파급은 낮다.
  - 제안: 현재로선 조치 불요(단일 소비 모듈, defense-in-depth 목적 부합). 향후 새 소비처가 늘어날 경우 이 함수가 "clamp 전용"이 아니라 "clamp+redact" 라는 점을 소비측 docstring/타입에서도 상기시킬 것.

- **[INFO]** `McpFailureCode`/`TestConnectionResult.code` 유니온에 `MCP_TIMEOUT` 추가 — 기존 동일 실패 상황의 반환값이 변경됨
  - 위치: `codebase/backend/src/modules/mcp/mcp-test-connection.service.ts:44-48`(`McpFailureCode`), `:102-109`(`tools/list` 타임아웃 분류), `:141-148`(`classifyConnectError`)
  - 상세: 이것은 순수 "추가"가 아니라 **기존 실패 케이스 재분류**다. 과거엔 connect/list 단계에서 timeout 이 발생하면 `MCP_CONNECT_FAILED`/`MCP_LIST_FAILED` 로 응답되던 것이, 이번 변경으로 동일 상황에서 `MCP_TIMEOUT` 이 반환된다. `McpTestConnectionService.test()` 는 컨트롤러가 그대로 HTTP 200 body 로 직렬화하는 공개 API 표면(§9, `POST /api/integrations/*/test`)이므로, 이 서비스 메서드를 호출하는 기존 프론트/외부 클라이언트가 `code === 'MCP_CONNECT_FAILED'` 로 하드코딩 분기하고 있었다면 timeout 케이스가 그 분기에서 이탈하는 동작 변경(behavioral break, 값 재분류)이 발생한다. api_contract 리뷰(INFO#10)에서 이미 프론트 grep 0건으로 확인했다고 기록되어 있어 즉각적 피해는 낮으나, 함수 시그니처 자체(파라미터/리턴 타입 shape)는 안 바뀌었어도 **동일 입력 조건에 대한 반환값(code 필드 값)이 달라지는 부작용**이라는 점은 side-effect 관점에서 명시적으로 남긴다.
  - 제안: 이미 api_contract 리뷰에서 프론트 미소비 확인 완료. 조치 불요, 기록만.

- **[INFO]** `errorResult()` private 헬퍼에 5번째 옵셔널 파라미터(`errorDelta`) 추가 — 내부 시그니처 확장, 호출자 영향 없음
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.ts:1096-1183`(`errorResult` 정의), 호출부 10곳(`:368` 등)
  - 상세: `private` 메서드이며 순수 additive(옵셔널, 끝에 추가)이므로 외부 영향은 없다. 기존 client-side 실패 경로(`INVALID_TOOL_ARGUMENTS`/`MCP_UNKNOWN_TOOL` 등, 예: `:368`, `:376`, `:389`, `:406`, `:422`)는 `errorDelta` 인자를 생략하므로 `mcpErrorDelta` 가 `undefined` 로 유지되고, `ai-turn-executor.ts` choke point(`if (execResult.mcpErrorDelta) push`)가 이를 걸러 `errors[]` 에 잘못 누적하지 않는다 — client-side 제외 규칙이 실제 코드로 확인됨. 다만 architecture 리뷰가 이미 지적했듯 포지셔널 파라미터가 2개(extra, errorDelta)로 늘어 신규 호출부에서 자리 채우기(`undefined, {...}`)가 필요해지는 유지보수 부담은 있으나 side-effect 관점의 위험은 아니다.
  - 제안: 조치 불요.

- **[INFO]** `mcpDiagnosticsAcc.errors` push 는 실행 단위 로컬 accumulator — 전역/공유 상태 아님
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:943-950` (choke point)
  - 상세: `args.mcpDiagnosticsAcc` 는 호출자(executor)가 각 turn 실행마다 새로 만들어 넘기는 로컬 객체이며(코드 상 전역/모듈 스코프 변수 아님, `AiTurnExecutor` 인스턴스 필드도 아님), `execResult.mcpErrorDelta` push 는 해당 실행의 진단 결과에만 영향을 준다. 여러 turn/요청 간 상태가 누수되거나 공유될 가능성은 diff 범위 내에서 확인되지 않음. `McpClientService.connectInner()` 의 `timedOut` 플래그도 함수 호출마다 새로 생성되는 클로저 지역 변수이고 `timer` 는 `finally` 에서 항상 `clearTimeout` 되어 타이머 누수도 없음.
  - 제안: 해당 없음(안전 확인).

- **[INFO]** `AbortController` 의 실제 fetch 취소(hard side effect)는 기존 로직 그대로, 신규 부작용 아님
  - 위치: `codebase/backend/src/modules/mcp/mcp-client.service.ts:271-301`
  - 상세: 이번 diff 는 기존에 이미 존재하던 `setTimeout(() => abort.abort(), ...)` 패턴에 `timedOut` 플래그만 얹은 것으로, "타임아웃 시 실제 in-flight HTTP 요청을 중단시킨다"는 네트워크 레벨 부작용 자체는 이번 변경으로 신규 도입된 것이 아니라 기존 동작이 유지된 것이다. `err instanceof TimeoutError` 판별을 위한 `throw new TimeoutError(...)` 는 새 에러 타입으로의 wrapping 이며, 원본 에러(`err`)는 non-timeout 케이스에서 그대로 재throw 되어 스택 트레이스/원인 정보 손실도 없다.
  - 제안: 해당 없음.

- **[INFO]** 신규 파일(`mcp-error-codes.spec.ts`)·plan 문서·`review/code/2026/07/06/23_20_02/**` 산출물은 CLAUDE.md 저장 위치 규약을 따름
  - 위치: `plan/in-progress/mcp-client-diagnostics-followups.md`(신규), `review/code/2026/07/06/23_20_02/*.md`(신규)
  - 상세: 파일시스템 부작용 관점에서 이번 diff 가 생성하는 신규 파일은 테스트 스펙 파일 1개, plan 문서 1개, 이전 리뷰 라운드 산출물 다수(SUMMARY/RESOLUTION/agent reports)로 전부 프로젝트 규약(`plan/in-progress/`, `review/code/<date>/`)이 지정한 위치에 있으며 런타임 코드가 예기치 못하게 파일을 쓰는 경우는 없다.
  - 제안: 해당 없음.

### 요약

이번 변경 세트(MCP connect timeout 분류, 에러 메시지 secret redaction, call-phase `mcpErrorDelta` 누적)는 함수 시그니처 확장이 전부 옵셔널·끝자리 추가라서 기존 호출자를 깨뜨리지 않으며, `mcpDiagnosticsAcc`/`timedOut` 같은 상태는 실행 단위 로컬 변수로 전역/공유 상태 오염이 없다. 유일하게 주목할 부작용은 (1) `sanitizeMcpErrorMessage()` 가 내부적으로 secret redaction 을 추가해 **동일 입력에 대해 반환 문자열이 조용히 달라지는 순수 함수 동작 변경**이라는 점과, (2) `McpTestConnectionService` 의 `code` 필드가 일부 기존 실패(과거 `MCP_CONNECT_FAILED`/`MCP_LIST_FAILED`)에 대해 `MCP_TIMEOUT` 으로 **재분류**되어 공개 API 응답 값이 바뀐다는 점이다. 둘 다 의도된 개선이고 소비처 확인(grep, 단일 모듈)까지 이미 이뤄져 있어 실질 리스크는 낮지만, side-effect 관점에서는 "시그니처는 안 바뀌었지만 동작/반환값이 바뀐다"는 사실 자체를 기록해 둘 가치가 있다. 전역 변수 도입, 예기치 못한 파일시스템 쓰기, 의도치 않은 네트워크 호출, 이벤트/콜백 변경은 발견되지 않았다.

### 위험도
LOW
