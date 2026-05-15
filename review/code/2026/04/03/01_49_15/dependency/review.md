### 발견사항

- **[INFO]** 내부 스크립트 경로 의존성 변경
  - 위치: `.agents/commands/ai-review.md:8`, `.claude/settings.json:3`
  - 상세: `.claude/plugins/skills/code-review-agents` → `.claude/skills/code-review-agents` 경로 변경. 런타임에 해당 경로에 파일이 존재해야 하는 파일시스템 의존성.
  - 제안: 실제 파일이 새 경로에 존재하는지 확인 필요.

- **[WARNING]** `TemplateHandler`와 표현식 엔진 간 암묵적 순서 의존성 발생
  - 위치: `template.handler.ts:20-24`, `execution-engine.service.ts:530-568`
  - 상세: 기존에는 `TemplateHandler`가 자체적으로 `{{ name }}` 패턴을 처리했으나, 이제 `config.template`이 이미 해석된 상태라고 가정함. `ExpressionResolverService`가 반드시 먼저 실행되어야 하는 암묵적 선제 조건이 생겼으나, 타입 시스템으로 강제되지 않음. `TemplateHandler.execute()`를 직접 호출하면 미해석 표현식이 그대로 출력됨.
  - 제안: 주석이 의존성을 설명하고 있으나, 인터페이스 수준에서 이 계약을 문서화하거나, `NodeHandler` 인터페이스에 `requiresPreResolvedConfig?: boolean` 같은 플래그를 두는 것을 고려.

- **[WARNING]** 엔진이 특정 노드 타입(`template`)에 대한 특수 분기 로직 보유
  - 위치: `execution-engine.service.ts:549-560`
  - 상세: `ExecutionEngineService`가 `node.type === 'template'`를 직접 참조하여 입력 데이터를 루트 레벨 변수로 확산함. 핸들러 추상화 패턴을 깨는 결합(coupling)이 발생함. 다른 핸들러 타입이 유사한 동작을 필요로 할 경우 엔진에 특수 케이스가 계속 누적될 위험이 있음.
  - 제안: 이 동작을 핸들러 메타데이터(`handler.spreadInputToContext?: boolean`)나 전용 인터페이스 메서드로 표현하여 엔진이 노드 타입을 하드코딩하지 않도록 개선.

- **[INFO]** `ExecutionContext` 임포트 제거
  - 위치: `template.handler.ts:1`
  - 상세: `execute()` 메서드가 더 이상 `context`를 사용하지 않으므로 임포트 제거는 올바름. 의존성 표면이 축소된 긍정적 변화.

- **[INFO]** `websocket.gateway.spec.ts`의 타입 캐스팅 수정
  - 위치: `websocket.gateway.spec.ts:203`
  - 상세: `mockEngine.continueExecution`을 `jest.Mock`으로 명시적 캐스팅. `ExecutionEngineService` mock 타입 정의에 jest 관련 타입이 포함되지 않는 구조에서 발생한 타입 의존성 문제를 수정한 것.
  - 제안: mock 생성 시 `jest.mocked()` 유틸리티를 활용하면 더 일관된 타입 안전성 확보 가능.

- **[INFO]** 새로운 외부 패키지 의존성 없음
  - 상세: 모든 변경이 내부 모듈 재구성에 해당하며, `package.json` 변경 없음.

---

### 요약

이번 변경은 새로운 외부 의존성을 도입하지 않으므로 라이선스, 취약점, 번들 크기 측면의 위험은 없음. 핵심 의존성 이슈는 내부 모듈 결합 구조에 있음: `TemplateHandler`가 표현식 엔진 사전 실행에 암묵적으로 의존하게 되었고, `ExecutionEngineService`가 특정 노드 타입(`template`)을 하드코딩하여 핸들러 추상화 계층을 침식함. 현재 코드베이스 범위에서는 동작하지만, 핸들러 확장 시 유사 패턴이 반복될 경우 유지보수 부채가 누적될 수 있음.

### 위험도

**LOW**