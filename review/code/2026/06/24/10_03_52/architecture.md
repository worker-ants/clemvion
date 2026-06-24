# Architecture Review — M-3 3단계: AssistantTurnPersistenceService 분리

## 발견사항

### [INFO] SRP 준수 — 명확한 단일 책임 분리
- 위치: `/codebase/backend/src/modules/workflow-assistant/tools/assistant-turn-persistence.service.ts`
- 상세: `WorkflowAssistantStreamService` 에서 세션/메시지 영속 책임이 `AssistantTurnPersistenceService` 로 완전히 분리됐다. 신규 서비스는 DB append + title derive 라는 단일 관심사만 보유하며, stream orchestration 로직과 섞이지 않는다. M-3 시리즈의 1단계(`AssistantToolRouter`) · 2단계(`AssistantFinishGuard`) 와 동일 패턴으로 일관성이 유지된다.
- 제안: 없음.

### [INFO] DIP 준수 — 생성자 주입으로 의존성 역전
- 위치: `AssistantTurnPersistenceService` 생성자 (L76–78), `workflow-assistant.module.ts` providers
- 상세: `WorkflowAssistantSessionService` 를 생성자 주입으로 수신해 NestJS IoC 컨테이너가 의존성을 제어한다. 모듈 providers 에 플랫 등록되어 DI 그래프 변경이 최소이며, 테스트에서도 직접 주입으로 실증된다.
- 제안: 없음.

### [INFO] 무상태 Collaborator 패턴 — 응집도/결합도 균형 양호
- 위치: `workflow-assistant-stream.service.ts` — `streamMessage` 내 위임 호출부 4곳
- 상세: turn-scoped 상태(누적 텍스트·toolCalls·plan·`totalStallCount`)는 `streamMessage` 에 잔류하고, collaborator 는 스냅샷만 받아 DB write 를 수행한다. 상태 소유권과 영속 실행이 분리되어 공유 가변 상태가 없다. persist 4개 호출 지점이 모두 `await this.turnPersistence.persistAssistantTurn(...)` 로 균일하게 위임돼 코드 중복이 제거됐다.
- 제안: 없음.

### [WARNING] `makeResumeMeta` 가 `stream.service.ts` 에서도 직접 import — 캡슐화 경계 부분 관통
- 위치: `workflow-assistant-stream.service.ts` L41–48
- 상세: `makeResumeMeta` 는 persist 모듈 파일(`assistant-turn-persistence.service.ts`)에 정의된 헬퍼이지만, 스트림 서비스가 직접 import 해 turn-scoped stall 카운터를 `ResumeMeta` 로 변환한 뒤 `persistAssistantTurn` 에 넘긴다. 주석에 의도가 명시돼 있어 의도적 결합임은 이해하나, persist 서비스 내부 헬퍼가 외부 caller 에 노출된다는 점에서 인터페이스 분리 원칙(ISP)의 경미한 위반이다. 향후 `makeResumeMeta` 시그니처가 변경되면 스트림 서비스도 함께 수정해야 한다.
- 제안: 중기적으로 `persistAssistantTurn` 이 `stallRounds: number` 를 직접 받아 내부에서 `makeResumeMeta` 를 호출하는 오버로드를 추가하거나, `stallRounds` 파라미터 형태로 시그니처를 확장해 caller 가 raw 카운터만 전달하도록 변경하면 경계를 완전히 닫을 수 있다. 현 단계에서는 의도 주석으로 충분하며 블로커 아님.

### [INFO] `finishReason` 파라미터 타입이 `string` 으로 넓음 — 의도된 pre-existing 계약
- 위치: `assistant-turn-persistence.service.ts` L120 — `finishReason: string`
- 상세: provider 원본(`'stop'`/`'tool_calls'`/`'length'`/`'content_filter'`/`'aborted'`)과 서버 합성 마커(`'error'`/`'auto_resume_pending'`)를 모두 수용해야 하므로 strict union 으로 좁히면 오히려 누락 케이스가 생긴다. entity 컬럼도 `string | null` 이라 계층 간 일관성은 유지된다. JSDoc 에 근거가 명시되어 있다. verbatim 이동된 pre-existing 계약이므로 본 단계의 신규 결함은 아니다.
- 제안: 향후 별건 타입 정련 시 `'stop' | 'tool_calls' | string` narrowing hint 형태로 IDE 자동완성 지원을 추가하는 정도로 충분. 현 단계 강제 조치 불필요.

### [INFO] `UsageSnapshot` / `ResumeMeta` 인터페이스 추출 — ISP 개선
- 위치: `assistant-turn-persistence.service.ts` L14–30
- 상세: `UsageSnapshot` 과 `ResumeMeta` 가 persist 서비스 파일에서 export interface 로 선언돼 있다. `AssistantStreamEvent`의 `'usage'` 이벤트 data 와 `UsageSnapshot` 이 동형이므로 diverge 위험이 잠재한다. 현재는 이미 추출된 상태(이번 변경에서 개선됨)이므로 추가 조치는 불필요하나, `UsageSnapshot` 을 스트림 이벤트 타입 파일과 공유하는 방향을 장기 과제로 고려할 수 있다.
- 제안: `AssistantStreamEvent` 의 `'usage'` data 타입을 `UsageSnapshot` 참조로 교체하면 양쪽 shape 동기화 보장. 현 단계 블로커 아님.

### [INFO] 모듈 경계 명확 — `tools/` 하위 배치 및 providers 등록 일관성
- 위치: `workflow-assistant.module.ts` L24, L55
- 상세: `AssistantTurnPersistenceService` 가 `AssistantToolRouter`, `AssistantFinishGuard` 와 같은 `tools/` 디렉터리에 배치되고 모듈 providers 에 동일 순서로 등록됐다. `WorkflowAssistantModule` 이 단일 모듈로 내부 서비스를 집약하는 구조가 유지된다. export 목록은 `WorkflowAssistantSessionService` 만으로 유지되어 외부 모듈 노출을 최소화한다.
- 제안: 없음.

### [INFO] 테스트 Mock 이 `as never` 캐스팅 — 인터페이스 부재 반영
- 위치: `assistant-turn-persistence.service.spec.ts` L58 — `new AssistantTurnPersistenceService(sessionService as never)`
- 상세: `WorkflowAssistantSessionService` 에 대한 별도 추상 인터페이스 없이 구체 클래스에 직접 의존하기 때문에 테스트에서 `as never` 캐스팅이 필요하다. 기존 통합 spec 전반의 관행과 일치해 신규 문제는 아니며 현 규모에서 실용적이다. DI 토큰 + 인터페이스 도입 시 자연히 해소된다.
- 제안: 중기적으로 `IWorkflowAssistantSessionService` 인터페이스 정의 시 `as Pick<...>` 형태 mock 으로 교체하면 가독성 및 mock 형태 변경 감지 향상. 현 단계 선택 사항.

## 요약

이번 변경은 M-3 시리즈 세 번째 단계로 `WorkflowAssistantStreamService` 에서 세션·메시지 영속 책임을 `AssistantTurnPersistenceService` 무상태 collaborator 로 분리하는 behavior-preserving 리팩터이다. SRP · DIP 준수, 낮은 결합도, 무상태 원칙 보존, 단위 테스트 격리 구조 모두 양호하며 1·2단계 패턴과의 일관성도 잘 유지된다. 주목할 아키텍처 약점은 `makeResumeMeta` 가 persist 모듈 경계 밖(스트림 서비스)에서 직접 import 돼 캡슐화 경계가 부분적으로 노출된다는 점이며, `persistAssistantTurn` 에 `stallRounds` 를 직접 수용하는 오버로드를 추가하면 해소될 수 있다. 전체적으로 기존 분리 패턴을 일관되게 적용해 확장성과 유지보수성을 개선한 바람직한 리팩터링이다.

## 위험도

LOW

---

STATUS: SUCCESS
