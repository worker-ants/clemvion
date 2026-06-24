# Architecture Review — M-3 3단계: AssistantTurnPersistenceService 분리

## 발견사항

### [INFO] SRP 준수 — 명확한 단일 책임 분리
- 위치: `/codebase/backend/src/modules/workflow-assistant/tools/assistant-turn-persistence.service.ts`
- 상세: `WorkflowAssistantStreamService` 에서 세션/메시지 영속 책임을 분리해 `AssistantTurnPersistenceService` 가 DB append + title derive 라는 단일 관심사만 소유한다. 기존 1단계(`AssistantToolRouter`) · 2단계(`AssistantFinishGuard`) 와 동일 패턴으로 일관성 있다.
- 제안: 없음.

### [INFO] DIP 준수 — 생성자 주입으로 의존성 역전
- 위치: `AssistantTurnPersistenceService` 생성자
- 상세: `WorkflowAssistantSessionService` 를 생성자 주입(constructor injection)으로 받아 NestJS IoC 컨테이너가 의존성을 제어한다. 테스트에서도 `new AssistantTurnPersistenceService(sessionService as never)` 로 직접 주입해 인터페이스 없이도 교체 가능성을 실증한다.
- 제안: 없음.

### [INFO] 무상태 Collaborator 패턴 — 응집도/결합도 균형 양호
- 위치: `workflow-assistant-stream.service.ts` 의 `streamMessage` 위임 호출부
- 상세: `planPersisted ? null : planForTurn` 평가, SSE 순서(`persist → auto_resume`), turn-scoped 카운터(`totalStallCount`) 소유권이 `streamMessage` 에 잔류해 무상태 서비스 원칙을 지킨다. 협력자(collaborator)는 스냅샷만 받아 DB write 를 수행하므로 상태 누수 없음.
- 제안: 없음.

### [WARNING] `finishReason` 파라미터 타입이 `string` 으로 너무 넓음
- 위치: `assistant-turn-persistence.service.ts` L97 — `persistAssistantTurn(... finishReason: string ...)`
- 상세: `finishReason` 은 실제로 `'stop' | 'tool_calls' | 'error' | 'auto_resume_pending'` 등 유한 집합이지만 시그니처가 `string` 이다. 잘못된 문자열이 DB 에 저장돼도 컴파일 타임에 차단되지 않는다. 엔티티 레벨에서 이미 string 으로 선언된 경우라도 persist 진입점에서 union 타입을 선언하면 caller 측 오타를 조기 차단할 수 있다.
- 제안: `FINISH_REASON_AUTO_RESUME_PENDING` 상수처럼 엔티티 파일에서 `FinishReason` union 타입을 export 하고 `persistAssistantTurn` 의 `finishReason` 파라미터에 적용. 또는 최소한 `'stop' | 'tool_calls' | 'error' | string` 형태로 narrowing hint 를 주어 IDE 자동완성을 지원.

### [INFO] `makeResumeMeta` 가 module-level 자유 함수로 export — 적절한 추상화
- 위치: `assistant-turn-persistence.service.ts` L22–39
- 상세: `makeResumeMeta` 는 순수 함수(입력 → 출력, 부수효과 없음)이므로 클래스 정적 메서드가 아닌 모듈 자유 함수로 두는 것이 적절하다. `streamMessage` 에서 `import { makeResumeMeta }` 로 직접 소비하면서 persist 서비스와 논리적으로 한 파일에 배치해 공유 지점을 단일화했다. 과도한 추상화 없이 적정 수준.
- 제안: 없음.

### [INFO] `usage` 파라미터 인라인 타입 — 인터페이스 분리 기회
- 위치: `assistant-turn-persistence.service.ts` L87–96
- 상세: `persistAssistantTurn` 의 `usage` 파라미터 타입이 인라인 객체 리터럴로 선언되어 있다. 동일 shape 이 `AssistantStreamEvent` 의 `'usage'` 이벤트 data 와 중복될 가능성이 있다. 현 시점에서는 단일 사용처이므로 큰 문제는 아니나, 두 곳의 shape 이 diverge 할 위험이 있다.
- 제안: `UsageSnapshot` 인터페이스를 엔티티 파일 또는 별도 types 파일에 선언해 `AssistantStreamEvent` 와 `persistAssistantTurn` 양쪽에서 참조하면 타입 일관성을 보장할 수 있다.

### [INFO] 테스트 Mock 이 인터페이스 없이 `as never` 캐스팅 사용
- 위치: `assistant-turn-persistence.service.spec.ts` L92 — `new AssistantTurnPersistenceService(sessionService as never)`
- 상세: 별도 인터페이스 없이 구체 클래스에 직접 의존하기 때문에 테스트에서 `as never` 로 타입을 우회한다. 현재 규모에서는 허용 범위이나 `IAssistantSessionService` 같은 인터페이스가 있으면 테스트 가독성 및 향후 세션 서비스 교체 시 영향 범위 제어가 쉬워진다.
- 제안: 중기적으로 `WorkflowAssistantSessionService` 의 `appendMessage` / `setTitleIfEmpty` 메서드를 포함하는 인터페이스를 정의하고 DI 토큰에 바인딩하는 방향을 고려. 단, 현 시점에서 강제 조치는 불필요.

### [INFO] 모듈 경계 명확 — `tools/` 하위 배치 일관성 유지
- 위치: `workflow-assistant.module.ts` providers 목록
- 상세: `AssistantTurnPersistenceService` 가 `AssistantToolRouter`, `AssistantFinishGuard` 와 같은 `tools/` 디렉터리에 배치되고 모듈 providers 에 동일 위치에 등록됐다. `WorkflowAssistantModule` 이 단일 모듈로 모든 내부 서비스를 소유하는 구조가 유지된다.
- 제안: 없음.

## 요약

이번 변경은 M-3 시리즈(`AssistantToolRouter` → `AssistantFinishGuard` → `AssistantTurnPersistenceService`)의 세 번째 단계로, `WorkflowAssistantStreamService` 에서 세션·메시지 영속 책임을 무상태 collaborator 로 분리하는 behavior-preserving 리팩터다. SRP · DIP 준수, 낮은 결합도, 무상태 원칙 보존, 단위 테스트 격리 구조 모두 양호하다. 주목할 아키텍처 관점의 약점은 `finishReason` 파라미터가 `string` 으로 넓게 선언되어 타입 안전성이 약하다는 점과, `usage` shape 가 인라인 타입으로 중복 선언될 위험이 있다는 점이며, 둘 다 중간 수준의 개선 기회(blockers 아님)다. 전체적으로 기존 분리 패턴을 일관되게 적용해 확장성과 유지보수성을 개선한 바람직한 리팩터링이다.

## 위험도

LOW
