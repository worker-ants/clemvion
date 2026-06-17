# 아키텍처(Architecture) 리뷰 결과

## 발견사항

### [WARNING] 엔진 ↔ 추출 서비스 양방향 forwardRef 순환 DI — 구조적 부채 잔류
- 위치: `/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 생성자, `form-interaction.service.ts`, `button-interaction.service.ts` 생성자
- 상세: `ExecutionEngineService`는 `FormInteractionService`와 `ButtonInteractionService`를 `forwardRef`로 주입받고, 두 서비스는 `ENGINE_DRIVER` 토큰(= `ExecutionEngineService`)을 다시 주입받는다. 이 양방향 순환은 `AiTurnOrchestrator` 선례를 답습한 의도된 패턴이지만, 결합 방향이 역전되지 않은 채 단순히 `useExisting` alias로 포장된 상태다. 구현체가 `ENGINE_DRIVER`이기 때문에 런타임에 실제로 순환 참조가 존재하며 `forwardRef`는 NestJS DI 해소 시점을 지연시킬 뿐 결합 구조를 개선하지 않는다. strangler-fig 진행 중 임시 상태이나, 모든 신규 서비스가 동일 패턴을 누적하면 DI 그래프가 복잡해져 이후 분리가 더 어려워진다.
- 제안: strangler-fig 완료 단계에서 엔진이 서비스를 주입받는 방향을 제거하고 서비스를 직접 caller로부터 호출받도록 설계 전환 계획을 백로그에 등록한다. 단기적으로는 `EngineDriver` 인터페이스에 "이 순환은 C-1 step3 임시 구조, 엔진 슬림화 완료 시 제거 예정"이라는 주석을 달아 의도를 명시화한다.

### [INFO] `EngineDriver` 인터페이스 — 추출 서비스들과 공유되는 단일 계약, 범위 확장 위험
- 위치: `/codebase/backend/src/modules/execution-engine/engine-driver.interface.ts`
- 상세: `EngineDriver`는 원래 `AiTurnOrchestrator` 전용으로 설계됐고 7개 메서드를 노출한다. `FormInteractionService`와 `ButtonInteractionService`가 실제로 사용하는 메서드는 `stageDurableResumeSnapshot`, `updateExecutionStatus`, `contextKeyOf` 3개다. 나머지 4개(`buildRetryReentryState`, `buildResumeCheckpoint`, `isCheckpointEligibleNodeType`, `applyPortSelection`)는 이 서비스들에는 불필요하지만 동일 인터페이스를 통해 노출된다. 인터페이스 분리 원칙(ISP) 관점에서 클라이언트가 사용하지 않는 메서드에 의존하게 된다.
- 제안: 당장 인터페이스를 분리하기보다는, `EngineDriver`에 각 소비자가 실제로 사용하는 메서드 그룹을 주석으로 구분해 문서화한다. 추후 god-class 분해가 더 진행되면 `ParkLifecycleDriver`(snapshot+status+contextKey) 등 소비자별 부분 인터페이스로 분리한다.

### [INFO] 두 인터랙션 서비스의 생성자 시그니처 중복 — 공통 의존성 추상화 부재
- 위치: `form-interaction.service.ts` 생성자, `button-interaction.service.ts` 생성자
- 상세: `FormInteractionService`와 `ButtonInteractionService`는 동일한 5개 의존성(`ExecutionContextService`, `ConversationThreadService`, `ExecutionEventEmitter`, `NodeExecution` Repository, `EngineDriver`)을 가진다. 두 서비스의 책임이 형제 관계임에도 공통 기반 클래스나 추상화 없이 독립적으로 병렬 정의됐다.
- 제안: 현 상태는 "공유 코드 없다"는 의도적 결정(커밋 메시지 W-3 참조)으로 수용 가능하다. 단, 향후 세 번째 인터랙션 타입이 추가될 경우 `BaseInteractionService` 추상 클래스나 공통 mixin 도입을 고려한다.

### [INFO] `processButtonResumeTurn` 내 payload 타입 — 비즈니스 레이어에 `unknown` 캐스팅 직접 노출
- 위치: `button-interaction.service.ts` L762-766 (`processButtonResumeTurn` 파라미터 `payload: unknown` → 내부 타입 단언)
- 상세: 메서드 시그니처가 `payload: unknown`을 받고 내부에서 `as { type: string; buttonId?: string }` 캐스팅으로 처리한다. 타입 가드나 유효성 검증 없이 캐스팅하는 구조는 런타임 오류를 컴파일 타임에 잡을 수 없다. `FormInteractionService`는 `isFormSubmittedSentinel` 정적 헬퍼로 이를 처리하는 반면 버튼 쪽은 직접 캐스팅한다.
- 제안: `ButtonClickPayload` discriminated union 타입을 정의하고 타입 가드 함수로 입력 검증 후 처리하도록 개선한다. 이는 테스트에서 `{ type: 'something_else' }` fallback을 검증하는 케이스가 이미 있어 런타임 다양성이 실재함을 보여준다.

### [INFO] `WaitingInteractionType` 미이동 — 모듈 경계 내 타입 잔류
- 위치: `execution-engine.service.ts` (커밋 메시지 "WaitingInteractionType 미이동" 명시)
- 상세: 인터랙션 타입 열거/유니온이 추출된 서비스가 아닌 엔진에 잔류한다. `FormInteractionService`와 `ButtonInteractionService`는 `'form'`, `'buttons'` 문자열 리터럴을 직접 사용하는데, 이 값들의 canonical 정의가 이 서비스들과 같은 파일에 없다. 나중에 타입 추가 시 엔진 파일을 수정해야 한다.
- 제안: 중기적으로 `WaitingInteractionType`을 `engine-driver.interface.ts` 또는 별도 `interaction-types.ts` 공유 파일로 이동시켜 추출 서비스들이 직접 참조할 수 있게 한다.

## 요약

이번 변경은 strangler-fig 패턴으로 god-class `ExecutionEngineService`를 8,411줄에서 7,499줄로 감축하며 Form과 Button 블로킹 인터랙션 생명주기를 전담 서비스로 추출했다. `EngineDriver` 인터페이스를 통해 엔진 잔류 능력을 DI 경계로 한정하는 설계는 `AiTurnOrchestrator` 선례와 일관되고, verbatim 이동으로 동작 보존을 보장하며 테스트 커버리지를 서비스 단위 격리 테스트로 이관한 점은 긍정적이다. 주된 아키텍처 우려는 엔진-서비스 간 양방향 forwardRef 순환 DI가 누적되고 있다는 점으로, 이는 strangler-fig 진행 중 불가피한 과도적 상태이나 EngineDriver 인터페이스의 ISP 위반과 함께 향후 분리를 위한 계획적 부채 관리가 필요하다.

## 위험도

LOW

STATUS: SUCCESS
