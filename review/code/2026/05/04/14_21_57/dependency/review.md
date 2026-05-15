## 의존성 코드 리뷰

### 발견사항

- **[INFO]** `'MCP_AUTH_FAILED'` 문자열 리터럴이 공유 상수 없이 두 모듈에 중복 정의됨
  - 위치: `mcp-tool-provider.ts:391`, `integrations.service.ts:516`
  - 상세: `McpToolProvider`가 생성한 에러 코드를 `IntegrationsService.logUsage`가 소비하는 구조인데, 두 파일이 동일 문자열을 각자 리터럴로 보유. 한쪽을 변경하면 스펙 위반이 런타임에서만 드러남
  - 제안: `backend/src/modules/integrations/mcp-error-codes.ts` 같은 공유 상수 파일로 추출하거나, 최소한 `integrations.service.ts` 쪽에 `import`할 수 있는 `export const MCP_AUTH_FAILED = 'MCP_AUTH_FAILED'` 상수를 두고 양측이 참조

- **[INFO]** 메타 도구(`list_resources`, `read_resource`, `list_prompts`, `get_prompt`) 호출이 `logUsage` 대상에서 누락됨
  - 위치: `mcp-tool-provider.ts` — `executeMeta` 메서드 전체
  - 상세: 일반 도구 경로(`callTool`)는 성공/실패 모두 사용 로그를 기록하지만, 메타 도구 경로는 기록하지 않음. 인테그레이션 Activity 탭에서 리소스·프롬프트 호출이 집계에서 빠져 사용 통계가 불완전해질 수 있음
  - 제안: 정책적으로 "메타 도구는 추적 불필요"라면 주석으로 의도를 명시. 추적이 필요하다면 `executeMeta`에도 `callStartedAt` / `logUsage` 호출 추가

- **[INFO]** `logUsage` 호출의 이중 에러 삼킴(double swallowing)
  - 위치: `mcp-tool-provider.ts` — `private async logUsage(...)` 래퍼
  - 상세: `IntegrationsService.logUsage`가 내부적으로 이미 try-catch로 삼키고, `McpToolProvider.logUsage`도 다시 try-catch로 감쌈. 주석으로 의도가 설명되어 있어 문제는 아니지만, `IntegrationsService.logUsage`의 내부 삼킴 정책이 향후 변경될 경우(예: 특정 오류 재throw) 이 래퍼가 의도치 않게 그것을 차단할 수 있음
  - 제안: 현 상태 유지 가능하나, 이 래퍼가 존재하는 이유("외부 MCP 실행이 usage tracking 실패로 중단되어서는 안 된다")를 주석으로 더 명확히 기술하면 유지보수성 향상

- **[INFO]** 인증 실패 판별 정규식이 외부 메시지 포맷에 암묵적으로 의존
  - 위치: `mcp-tool-provider.ts:391` — `/\b40[13]\b|unauthori[sz]ed|forbidden/i`
  - 상세: 이 패턴이 MCP SDK 에러 메시지 포맷에 의존하는 구조. SDK 의존성 버전이 올라가거나 서버 구현체가 달라지면 탐지 실패 또는 오탐이 발생할 수 있음. 외부 라이브러리의 에러 메시지 포맷이 사실상 숨겨진 의존성으로 작동
  - 제안: MCP SDK가 구조화된 에러 타입을 노출한다면 그쪽을 우선 확인하고, 문자열 매칭은 fallback으로 유지

- **[WARNING]** `McpToolProvider` → `IntegrationsService` 의존 범위 확장
  - 위치: `mcp-tool-provider.ts` — 생성자, `private logUsage` 메서드
  - 상세: 기존에는 `getForExecution`만 사용했으나 이번 변경으로 `logUsage`까지 사용. `McpToolProvider`가 연결 관리 외에 사용 로그 기록 책임도 가지게 됨. 현재는 문제없지만, 향후 `logUsage` 시그니처가 변경되면 provider 레이어도 함께 수정 필요
  - 제안: 현 수준의 결합은 허용 범위 내이나, `IntegrationsService` 중 provider가 필요한 메서드만 추출한 인터페이스(예: `IntegrationUsageTracker`)를 `agent-tool-provider.interface.ts` 인근에 두면 테스트 시 `Object.assign` 해킹 없이 타입 안전한 목킹이 가능하고 의존 범위도 명시적으로 제한됨

---

### 요약

이번 변경은 **외부 패키지 추가 없이** 기존 내부 모듈 간 의존 관계만 확장한 내용으로, 의존성 관점의 구조적 위험은 낮다. `McpToolProvider`의 `IntegrationsService` 의존 범위가 `getForExecution` → `logUsage`까지 확대된 점이 가장 주목할 변화이며, 현재 수준에서는 문제없다. 다만 `'MCP_AUTH_FAILED'` 리터럴이 두 모듈에 중복되어 있고, 인증 실패 탐지가 외부 에러 메시지 포맷에 암묵적으로 의존하는 점은 장기 유지보수 시 취약점이 될 수 있다. 메타 도구의 사용 로그 누락은 기능 완전성 측면의 선택 사항이나, 의도를 코드에 명시하는 것이 바람직하다.

### 위험도

**LOW**