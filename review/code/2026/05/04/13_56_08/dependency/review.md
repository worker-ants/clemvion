### 발견사항

- **[INFO]** 신규 외부 npm 패키지 없음
  - 위치: 전체 diff
  - 상세: 모든 신규 import 는 기존 내부 모듈(`modules/mcp`, `modules/integrations`) 또는 이미 사용 중인 패키지(`@nestjs/common`, `@tanstack/react-query`, `lucide-react`)에서 가져온다. `package.json` 변경 없음 → 버전 충돌·라이선스·번들 크기 리스크 없음.

- **[WARNING]** `withTimeout` 유틸리티 의도적 중복 선언
  - 위치: `mcp-tool-provider.ts` — `withTimeout` 함수
  - 상세: 파일 내 주석에서 `McpTestConnectionService`에 동일 구현이 있음을 명시하고 "두 provider가 나중에 다른 방향으로 발전할 수 있다"며 중복을 정당화한다. 그러나 abort signal 지원이나 재시도 전략이 필요해질 경우 두 곳을 함께 수정해야 한다.
  - 제안: `modules/mcp/utils/with-timeout.ts`와 같은 공유 유틸로 추출하고 두 파일이 이를 re-export하는 방식이 바람직하다. "나중에 다를 수 있다"는 근거가 현실화될 때 분기하면 충분하다.

- **[WARNING]** `process.env` 모듈 최상위에서 직접 읽기 (NestJS ConfigService 우회)
  - 위치: `mcp-tool-provider.ts` — `MAX_RESPONSE_BYTES`, `CALL_TIMEOUT_MS`, `LIST_TIMEOUT_MS`
  - 상세: 세 상수가 모듈 import 시점에 평가된다. NestJS `ConfigModule`이 비동기로 로딩되거나 테스트에서 `process.env`를 늦게 설정하면 의도한 값이 반영되지 않는다. 프로젝트의 다른 설정값들이 `ConfigService`를 통해 DI로 주입되는 패턴과도 일관성이 없다.
  - 제안: `McpToolProvider` 생성자에서 `ConfigService`를 주입받거나, 상수를 `McpClientService.connect()` 옵션으로 전달하는 구조로 이동한다.

- **[INFO]** `McpToolProvider` 클래스 JSDoc과 실제 생명주기 불일치
  - 위치: `mcp-tool-provider.ts` 클래스 JSDoc — "One `McpToolProvider` instance is **shared across every AI Agent execution** in the process"
  - 상세: `ai-agent.component.ts`의 `createHandler`가 실행마다 `new McpToolProvider(...)`를 호출한다. 인스턴스는 싱글턴이 아니며, 이 경우 `sessionsByExecution` Map의 `executionId` 키잉은 실질적으로 무의미(항상 단일 항목)하다. 문서와 구현 의도가 불일치하면 미래 기여자가 Map을 전역 캐시처럼 오해할 수 있다.
  - 제안: 실제 생명주기(per-handler-call 인스턴스)를 JSDoc에 반영하거나, 싱글턴 동작이 의도라면 `McpModule`에서 `McpToolProvider`를 provider로 등록하고 핸들러 팩토리에 주입한다.

- **[INFO]** 프론트엔드 `McpServerRef` 타입이 백엔드 `mcpServerRefSchema`를 수동 미러링
  - 위치: `mcp-server-selector.tsx` — `McpServerRef` interface
  - 상세: 주석에서 "백엔드 Zod 추론에 의존하지 않으려 별도 정의"라고 명시하지만, 백엔드 스키마에 `enabledTools`·`toolOverrides` 등 필드가 추가/변경될 때 프론트엔드 타입이 조용히 drift된다. `toolOverrides.description`이 `optional`인데 프론트엔드 인터페이스도 동일하게 선언되어 현재는 일치하지만 추적 지점이 두 곳으로 늘었다.
  - 제안: 스펙 문서(`spec/5-system/11-mcp-client.md`) 또는 주석에 "백엔드 `mcpServerRefSchema` 필드 변경 시 동기화 필요" 경고를 명시적으로 추가한다.

- **[INFO]** `ExecutionEngineModule`에 `McpModule`을 `forwardRef` 없이 추가
  - 위치: `execution-engine.module.ts` — imports 배열
  - 상세: `WebsocketModule`은 `forwardRef(() => WebsocketModule)`로 추가되어 있어 순환 의존성이 존재함을 알 수 있다. `McpModule`이 현재 `ExecutionEngineModule`을 임포트하지 않는다면 문제없지만, 향후 `McpModule` 내부에서 `ExecutionEngineService`를 참조하는 경우 NestJS 모듈 초기화 순환 오류가 발생한다.
  - 제안: `McpModule`이 `ExecutionEngineModule`을 참조하지 않음을 명시하는 주석을 추가하고, 참조가 생기면 `forwardRef`로 감싼다.

- **[INFO]** 테스트 mock이 `McpClientService` 인터페이스를 부분적으로만 구현
  - 위치: `execution-engine.service.spec.ts` — `McpClientService` mock
  - 상세: `{ connect: jest.fn() }` 만 제공한다. `McpClientService`가 다른 public 메서드를 갖고 있다면 테스트 경로가 그쪽으로 분기될 때 `TypeError: ... is not a function`이 발생하며 실제 오류와 구분하기 어렵다.
  - 제안: `jest.createMockFromModule` 또는 `@golevelup/ts-jest`의 `createMock<McpClientService>()`를 사용해 전체 인터페이스를 타입 안전하게 mock한다.

---

### 요약

이번 변경은 신규 외부 npm 패키지를 전혀 도입하지 않았고 기존 내부 모듈(`McpModule`, `IntegrationsModule`)을 재사용하는 구조로 의존성 위험은 낮다. 주요 지적 사항은 두 가지다. 첫째, `withTimeout` 유틸리티가 두 파일에 중복되어 향후 동기화 비용이 발생할 수 있다. 둘째, 세 개의 환경변수 상수가 모듈 로딩 시점에 `process.env`에서 직접 읽혀 NestJS의 DI 기반 설정 패턴을 우회한다. 나머지는 주석/문서 정확성 및 테스트 mock 완성도에 관한 INFO 수준이다.

### 위험도
**LOW**