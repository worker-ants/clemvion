---

### 발견사항

- **[INFO]** 외부 패키지 신규 추가 없음
  - 위치: `ai-agent.handler.ts` (imports), `ai-agent.schema.ts` (imports)
  - 상세: 변경된 세 파일 모두 기존 패키지만 사용한다. `@nestjs/common`, `zod`는 이미 `package.json`에 등록되어 있고, 나머지는 전부 프로젝트 내부 모듈이다.
  - 제안: 없음

---

- **[INFO]** `zod@^4.3.6` — caret 범위 적절
  - 위치: `package.json:73`, `ai-agent.schema.ts:1`
  - 상세: 스키마가 `z.meta()`, `z.toJSONSchema()`(주석 참조) 등 Zod v4 전용 API를 사용한다. `^4.3.6`은 마이너·패치 자동 업그레이드를 허용하므로 v4 메이저 경계 안에서 안전하다. v4→v5 major break는 caret으로 막혀 있다.
  - 제안: 없음 — 현재 범위 적절

---

- **[INFO]** `WebsocketService` — 선택적 소프트 의존
  - 위치: `ai-agent.handler.ts:249`
  - 상세: `websocketService?: WebsocketService` 로 optional 파라미터 처리되어 있다. 테스트 픽스처는 주입 없이도 동작하며(`'does nothing for the WS service...'` 케이스), 프로덕션 경로에서도 `?.` 로 방어된다.
  - 제안: 없음

---

- **[INFO]** MCP SDK — 핸들러는 직접 import 없음, 프로바이더 인터페이스로 격리
  - 위치: `ai-agent.handler.ts:1300–1327` (`buildTools`)
  - 상세: `@modelcontextprotocol/sdk@^1.29.0`은 핸들러가 직접 임포트하지 않는다. `AgentToolProvider[]` 인터페이스를 통해 주입받으며, MCP SDK 의존은 `mcp-tool-provider.ts`에만 국소화되어 있다. 멀티턴 state에 `mcpServers`를 스프레드하는 코드(`handler.ts:734`)가 있지만, 이는 순수한 config 값 전달이고 SDK를 참조하지 않는다. 의존 방향이 단방향으로 깨끗하다.
  - 제안: 없음

---

- **[WARNING]** 단위 테스트가 실행 엔진 내부 모듈을 직접 임포트
  - 위치: `ai-agent.handler.spec.ts:4` — `import { adaptHandlerReturn } from '../../../modules/execution-engine/handler-output.adapter'`
  - 상세: AI Agent 단위 테스트가 실행 엔진 레이어의 `adaptHandlerReturn`을 직접 의존한다. `adaptHandlerReturn`의 검증 로직이 변경되면 AI Agent 구현과 무관하게 이 단위 테스트가 실패할 수 있고, 실패 원인 추적 범위가 넓어진다. 테스트 의도 자체('production-strict validation 통과 여부 확인')는 정당하나, 이 의존이 계층 경계를 넘는 결합을 형성한다.
  - 제안: 회귀 테스트 목적이 "핸들러 출력이 엔진 계약을 만족하는가"라면 해당 케이스를 통합 테스트 또는 별도 `adapter.spec.ts`로 분리하는 것이 바람직하다. 단기적으로는 현재 코드를 유지하되, `adaptHandlerReturn` 시그니처 변경 시 본 spec도 함께 갱신해야 함을 주석으로 명시하는 것도 방법이다.

---

- **[INFO]** `mcpServerRefSchema` 내부 `toolOverrides` — 제거 대상과 다른 개념
  - 위치: `ai-agent.schema.ts:43–50`
  - 상세: plan 문서에서 "제거된 `toolOverrides`"는 워크플로 노드 연결 레벨 필드이고, `mcpServerRefSchema.toolOverrides`는 MCP 서버 단위 도구 설명 override다. 혼동의 여지가 있으나 실제로는 별개 개념이며 제거 대상이 아니다.
  - 제안: 혼동 방지를 위해 필드명을 `toolDescriptionOverrides` 등으로 구분하는 것을 재작성 시 함께 고려할 수 있다(현재 즉각 변경 불필요).

---

### 요약

리뷰 대상 파일 전체에서 신규 외부 패키지 추가는 없으며, 기존 의존성(`@nestjs/common`, `zod`, 내부 모듈)의 활용 방식도 적절하다. `AgentToolProvider` 인터페이스를 통한 MCP·KB 프로바이더 격리는 핸들러의 의존 경계를 명확히 유지한다. 유일한 실질적 우려는 단위 테스트에서 실행 엔진 내부 모듈(`handler-output.adapter`)을 직접 임포트하는 점으로, 레이어 경계를 넘는 결합이 생겼으나 회귀 가드 의도 자체는 타당하다. 전반적으로 의존성 관리 상태는 양호하다.

### 위험도

**LOW**