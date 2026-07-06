### 발견사항

- **[INFO]** `errorResult` 의 5번째 파라미터 `errorDelta` 가 4번째 `extra?: Record<string, unknown>` 뒤에 위치, JSDoc 도 파라미터가 아니라 인자 선언 사이에 끼워져 있음
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.ts` `errorResult(toolCallId, code, message, extra?, errorDelta?)`
  - 상세: 이미 4개의 positional/optional 파라미터가 있는 상태에서 5번째 optional 파라미터를 추가해, 호출부에서 `undefined` 를 명시적으로 채워 넣는 자리채움(`errorResult(..., undefined, { ... })`, `mcp-tool-provider.ts` 464행대)이 발생한다. 파라미터가 늘어날수록 호출부 가독성이 떨어지고 순서를 착각하기 쉽다.
  - 제안: 이번 diff 범위를 넘는 리팩터이므로 이번 PR 필수는 아니나, 다음 확장 시 `{ extra?, errorDelta? }` 형태의 options 객체로 전환 권장. (RESOLUTION.md 에 follow-up 백로그로 이미 기록됨 — 조치 완료로 간주)

- **[INFO]** call-phase `mcpErrorDelta` 생성 로직이 4개 provider(`mcp-tool-provider.ts`, `cafe24-mcp-tool-provider.ts`, `makeshop-mcp-tool-provider.ts` catch 블록 2곳)에서 거의 동일한 shape(`{ integrationId, phase: 'tools/call', code, message }`)로 반복
  - 위치: `cafe24-mcp-tool-provider.ts` 516-533행/567-575행, `makeshop-mcp-tool-provider.ts` 516-533행/565-573행, `mcp-tool-provider.ts` catch 블록들
  - 상세: 동일 패턴이 provider 간 복붙되어 있어, 향후 `McpDiagnosticError` 필드가 추가되면 4곳을 모두 고쳐야 하는 산탄식 수정(shotgun surgery) 위험이 있다.
  - 제안: `buildCallPhaseErrorDelta(integrationId, phase, code, message)` 공통 헬퍼로 추출 권장. RESOLUTION.md 에 이미 follow-up 백로그로 기록되어 있어 이번 PR 에서는 조치 불요로 판단됨.

- **[INFO]** `mcp-client.service.ts` 의 `timedOut` boolean 클로저 변수
  - 위치: `codebase/backend/src/modules/mcp/mcp-client.service.ts` `connectInner` 부근 (`let timedOut = false;`)
  - 상세: `setTimeout` 콜백이 외부 변수를 mutate 하고 catch 블록이 이를 읽는 패턴은 함수가 커질수록 상태 추적이 어려워질 수 있으나, 현재 함수 범위(단일 try/catch, 10줄 내외)에서는 가독성 저하가 경미하다. 주석(`Track whether the abort was fired by *our* deadline...`)이 의도를 잘 설명해 이해에 무리 없음.
  - 제안: 현재 규모에서는 조치 불요. 향후 이 함수에 추가 분기가 늘어나면 `AbortController` 를 감싸는 작은 클래스/헬퍼로 승격 고려.

- **[INFO]** `redactMcpSecrets` 의 정규식 내 매직 넘버 `{8,}` (bearer 토큰 최소 길이)
  - 위치: `codebase/backend/src/modules/mcp/mcp-error-codes.ts` 317-320행
  - 상세: 하드코딩된 길이 하한이지만 인접 주석(`실제 토큰(대개 수십자+)만 노리고 'Bearer of' 같은 평문 오탐을 피하는 하한`)이 근거를 설명하고 있어 매직넘버로 인한 이해 저해는 낮다.
  - 제안: 이미 근거 주석이 추가된 상태(RESOLUTION.md INFO #5 해소 기록과 일치)로 추가 조치 불요.

- **[INFO]** `META_PHASE` 매핑 테이블과 기존 `META_LIST_RESOURCES` 등 상수 선언이 파일 상단에 흩어져 있음
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.ts` 43-56행
  - 상세: `Record<...>` 타입에 4개 리터럴 유니온을 나열하는 방식이 다소 장황하지만, 컴파일 타임에 매핑 누락을 방지하는 이점이 있어 실용적인 트레이드오프로 보인다. 네이밍(`META_PHASE`)도 기존 `META_LIST_RESOURCES` 류 네이밍 컨벤션과 일관됨.
  - 제안: 조치 불요.

- **[INFO]** 3항 연산자 중첩(`code = err instanceof TimeoutError ? ... : isAuthFailure(...) ? ... : ...`)
  - 위치: `mcp-tool-provider.ts` 1124-1129행
  - 상세: 중첩 삼항 연산자 2단이지만 들여쓰기와 주석으로 각 분기 의미가 명확히 구분되어 있어 가독성 저해가 크지 않다. 순환복잡도 소폭 증가(분기 3개) 수준.
  - 제안: 조치 불요. 분기가 하나라도 더 늘어나면 명시적 if/else 또는 lookup 함수로 전환 권장.

### 요약
이번 변경은 기존 코드베이스의 확립된 패턴(`ragDiagnosticsDelta` 대칭 설계, `McpErrorPhase` 유니온 확장, provider별 `classifyError`/`codeForStatus` 구조)을 일관되게 따르고 있고, 각 파일의 diff 는 국소적이며 함수 길이·중첩 깊이 모두 양호한 수준이다. 네이밍(`mcpErrorDelta`, `TimeoutError`, `META_PHASE`, `redactMcpSecrets`)은 목적을 명확히 드러내고, 주석은 "왜"를 설명하는 데 충실하다(특히 `timedOut` 클로저, redaction 정규식 하한, mcpErrorDelta 의 client-side 배제 근거). 다만 provider 4곳에 반복되는 delta 생성 로직과 `errorResult` 의 계속 늘어나는 positional optional 파라미터는 향후 확장 시 유지보수 비용을 키울 수 있는 잠재적 부채이며, 이미 이전 리뷰(RESOLUTION.md)에서 동일 항목이 식별되어 follow-up 백로그로 명시적으로 이연된 상태다. 신규로 발견된 Critical/Warning 급 유지보수성 이슈는 없다.

### 위험도
LOW
