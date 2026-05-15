### 발견사항

---

**[WARNING]** `logUsage` 가 사용 로깅과 상태 전이를 동시에 수행 — SRP 위반
- **위치**: `integrations.service.ts:508–519`
- **상세**: `logUsage`는 이름상 사용 기록 삽입이 책임이나, `MCP_AUTH_FAILED` 분기에서 `integration.status`와 `statusReason`을 직접 변경한다. 메서드 이름만 읽으면 상태 전이 부작용이 전혀 드러나지 않는다. 향후 다른 에러 코드(HTTP 401, DB 인증 실패 등)에도 동일 패턴이 추가되면 `logUsage`는 감춰진 도메인 상태 머신이 되어 추론이 어려워진다.
- **제안**: 상태 전이 로직을 별도 메서드(`handleAuthFailure(integration, errorCode)`)로 추출하거나, `logUsage` 내부에서 이벤트를 발행하고 도메인 서비스가 구독하는 방식으로 관심사를 분리할 것. 최소한 메서드 JSDoc에 "may mutate integration.status" 를 명시해야 한다.

---

**[WARNING]** 두 클래스에 걸친 암묵적 문자열 코드 결합
- **위치**: `mcp-tool-provider.ts:375–382` ↔ `integrations.service.ts:514–516`
- **상세**: `McpToolProvider`가 에러를 `MCP_AUTH_FAILED` 코드로 분류하고, `IntegrationsService.logUsage`가 이 코드를 읽어 상태를 전이하는 구조다. 두 클래스 간 계약이 문자열 리터럴 하나뿐이므로, 어느 한쪽이 코드명을 변경하면 테스트가 없으면 조용히 깨진다. 현재 테스트는 코드명을 각각 검증하지만 두 클래스 간의 계약 자체는 검증하지 않는다.
- **제안**: 공유 상수(`MCP_ERROR_CODES.AUTH_FAILED`)를 별도 파일(`mcp-error-codes.ts`)에 정의하고 양쪽에서 import 하거나, `IntegrationsService`가 검사할 코드 목록을 설정으로 받도록 한다.

---

**[WARNING]** 에러 메시지 문자열 파싱으로 인증 실패를 판별하는 취약한 휴리스틱
- **위치**: `mcp-tool-provider.ts:370–372` (`/\b40[13]\b|unauthori[sz]ed|forbidden/i`)
- **상세**: SDK마다 에러 포맷이 다르고(일부는 상태 코드를 숫자로만 포함, 일부는 포함하지 않음), "403 Forbidden"과 "401 Unauthorized" 외의 인증 실패(예: 세션 만료 시 200 + 에러 바디 반환)는 탐지하지 못한다. 반면 비인증 오류 메시지에 "unauthorized" 단어가 포함되면 오탐한다. 이 로직이 `integration.status`를 `error`로 전환시키는 트리거이므로 오탐/미탐의 도메인 영향이 크다.
- **제안**: MCP SDK가 구조화된 에러(HTTP 상태 코드 등)를 전파하는 경우 그것을 우선 사용하고, 문자열 파싱은 fallback으로만 쓸 것. 또는 인증 실패 판별 로직을 `McpClientService`나 별도 유틸로 캡슐화해 단일 책임화한다.

---

**[WARNING]** `ProviderExecCtx`에 실행 엔진 인프라 필드 누출
- **위치**: `agent-tool-provider.interface.ts:65–72`
- **상세**: `nodeExecutionId`, `workflowId`는 실행 엔진(execution layer)의 추적 관심사인데, `AgentToolProvider`의 공용 실행 컨텍스트 인터페이스에 직접 추가됐다. 현재 두 필드를 실제로 사용하는 provider는 `McpToolProvider`뿐이다. 이 구조는 다른 provider 구현체(`KbToolProvider` 등)까지 실행 엔진 컨텍스트를 알아야 하는 것처럼 강제한다.
- **제안**: usage logging을 위한 컨텍스트를 `ProviderExecCtx`의 선택적 서브타입(`usageCtx?: { nodeExecutionId: string; workflowId: string }`)으로 분리하거나, 더 나아가 `McpToolProvider`가 `logUsage` 콜백을 생성 시 주입받도록 설계하면 인터페이스 오염 없이 책임 분리가 가능하다.

---

**[WARNING]** Multi-turn resume의 `nodeExecutionId` 타입 미검증
- **위치**: `ai-agent.handler.ts:769–771` (`state.nodeExecutionId as string | undefined`)
- **상세**: `state`는 런타임에 역직렬화된 객체로 보이는데, `as string | undefined` 캐스팅만으로는 실제 타입을 보장하지 못한다. 잘못된 타입이 들어오면 `logUsage`에 `nodeExecutionId`로 비문자열 값이 전달될 수 있고, 이는 DB 레이어에서 에러를 유발하거나 조용히 잘못된 데이터를 기록할 수 있다. 해당 주석도 "acceptable" 이라고만 기술하며 명확한 근거가 없다.
- **제안**: 재개 상태 타입을 명시적으로 정의(`interface AgentResumeState { nodeExecutionId?: string; workflowId?: string; ... }`)하고, 역직렬화 시 zod 등으로 검증할 것.

---

**[INFO]** `logUsage` 예외 스왈로가 두 레이어에 중복 존재
- **위치**: `mcp-tool-provider.ts:399–407` + `integrations.service.ts:527–531`
- **상세**: `McpToolProvider.logUsage`가 try/catch로 감싸고, 내부의 `IntegrationsService.logUsage`도 자체적으로 swallow 한다. 이중 방어는 안전하지만, `McpToolProvider`의 catch 블록이 실제로는 "code bug in our wrapper" 경우만 받게 된다고 주석에 명시되어 있는데, 이 경우가 실제로 존재하는지 불분명하다. 운영 로그에서 두 warn이 모두 출력될 경우 원인 추적이 어려워진다.
- **제안**: `IntegrationsService.logUsage`가 이미 완전히 swallow 한다는 신뢰가 있다면 `McpToolProvider`의 try/catch는 제거해도 무방하다. 신뢰가 없다면 `IntegrationsService`의 swallow를 제거하고 책임을 상위로 올릴 것.

---

**[INFO]** 스펙 문서 업데이트 적절
- **위치**: `spec/4-nodes/3-ai-nodes.md:29`
- **상세**: "Stage 2에서 핸들러 통합 예정" 문구 제거는 구현 완료 사실과 정합하며, 스펙이 현재 상태를 정확히 반영하게 되었다. 스펙-코드 정합성 원칙에 부합한다.

---

### 요약

이번 변경은 MCP 도구 호출의 사용 로그 기록과 인증 실패 시 통합 상태 자동 전이라는 실용적인 기능을 추가했으며, 전반적인 설계 방향은 타당하다. 그러나 핵심 설계 문제가 두 가지다. 첫째, `IntegrationsService.logUsage`가 로깅과 도메인 상태 전이를 하나의 메서드에 혼합하여 메서드 계약이 불투명해졌다. 둘째, 인증 실패 판별 로직이 에러 메시지 문자열 파싱에 의존하면서 코드명(`MCP_AUTH_FAILED`)이라는 암묵적 문자열 계약으로 두 클래스를 느슨하게 결합시켰다. 두 문제 모두 현재 테스트로는 통과하지만, 시스템이 성장하면서 동일 패턴이 HTTP/DB/Email 등 다른 통합에도 복사·적용될 경우 `logUsage`가 통제할 수 없는 상태 머신으로 변질될 위험이 있다.

### 위험도
**MEDIUM**