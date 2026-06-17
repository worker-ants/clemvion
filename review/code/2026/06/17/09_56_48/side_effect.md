# 부작용(Side Effect) 리뷰 결과

## 발견사항

### 발견사항 1
- **[INFO]** `ConversationThreadService` 의존성이 엔진에서 제거됨
  - 위치: `execution-engine.service.ts` diff, `-    private readonly conversationThreadService: ConversationThreadService,`
  - 상세: 엔진 생성자에서 `conversationThreadService` 가 제거됐다. 기존에 엔진이 직접 갖던 상태(DI 인스턴스)가 사라지고, 이제 `FormInteractionService` / `ButtonInteractionService` 가 각각 독립적으로 같은 싱글톤 인스턴스를 주입받는다. NestJS DI 컨테이너 내에서는 동일 싱글톤이므로 런타임 공유 상태 불일치는 없다. 테스트에서도 이를 인지하고 `module.get<ConversationThreadService>()` 로 싱글톤을 직접 획득해 spy 하도록 수정됐다.
  - 제안: 현행 대응이 적절하다. 추가 조치 불필요.

### 발견사항 2
- **[INFO]** `withInteractionMeta` / `ButtonConfig` import 가 엔진에서 제거됨
  - 위치: `execution-engine.service.ts` diff, `-import { RehydrationError, withInteractionMeta }` / `-import { ButtonConfig }`
  - 상세: 두 심볼이 이제 실제 사용 위치(각 interaction 서비스)로만 import 된다. 엔진 내에서 제거된 메서드 본문이 유일한 사용처였으므로 dead import 제거다. 엔진 외부로 re-export 되던 심볼이 아니므로 public API 영향 없음.
  - 제안: 해당 없음.

### 발견사항 3
- **[WARNING]** `ENGINE_DRIVER` forwardRef 순환 DI — 초기화 순서에 따른 미초기화 드라이버 호출 가능성
  - 위치: `execution-engine.service.ts` (엔진 생성자), `form-interaction.service.ts` L946, `button-interaction.service.ts` L622
  - 상세: 두 신규 서비스가 `@Inject(ENGINE_DRIVER)` 로 엔진을 주입받고, 엔진도 `@Inject(forwardRef(() => FormInteractionService))` 로 두 서비스를 주입받는다. NestJS forwardRef 는 프록시를 먼저 삽입하고 실제 인스턴스를 나중에 채우는 방식이다. `AiTurnOrchestrator` 가 동일 패턴(PR2 선례)으로 검증됐으므로 프레임워크 지원 범위이며 기술적으로 안전하다. 그러나 `FormInteractionService` / `ButtonInteractionService` 쪽 `ENGINE_DRIVER` 주입에는 `forwardRef` 래퍼가 없다. 두 서비스가 엔진보다 먼저 초기화 되려 할 때 `ENGINE_DRIVER` 프로바이더가 아직 resolve 되지 않으면 런타임 에러가 발생할 수 있다. `useExisting` 바인딩이 동일 모듈 내이므로 실제로는 문제가 없을 가능성이 높지만, `AiTurnOrchestrator` 의 `ENGINE_DRIVER` 주입 방식과 일관성이 다르다.
  - 제안: `form-interaction.service.ts` 및 `button-interaction.service.ts` 의 `@Inject(ENGINE_DRIVER)` 에도 `@Inject(forwardRef(() => ENGINE_DRIVER_SYMBOL))` 형태를 검토하거나, 적어도 `AiTurnOrchestrator` 의 동일 주입 패턴과 일관성을 확인하라. `AiTurnOrchestrator` 도 `@Inject(ENGINE_DRIVER)` 만 사용한다면 현행 패턴이 검증된 선례이므로 INFO 수준으로 낮출 수 있다.

### 발견사항 4
- **[INFO]** `isFormSubmittedSentinel` 정적 메서드가 엔진에서 `FormInteractionService` 로 이동
  - 위치: `execution-engine.service.ts` 에서 삭제 / `form-interaction.service.ts` L3039
  - 상세: `private static` 이므로 외부 공개 API가 아니다. 엔진 내부에서만 `processFormResumeTurn` 이 호출하는 헬퍼였고, 해당 메서드 전체가 이동했으므로 이 정적 메서드도 사용처와 함께 이동된 것이다. 호출자 영향 없음.
  - 제안: 해당 없음.

### 발견사항 5
- **[INFO]** `processFormResumeTurn` / `processButtonResumeTurn` / `waitForFormSubmission` / `waitForButtonInteraction` 이 엔진 public/private API 에서 제거됨
  - 위치: `execution-engine.service.ts` 메서드 삭제 구간 (diff 기준 `-3774` 이후)
  - 상세: 이 4개 메서드는 엔진의 `private` 메서드로 존재했다. 외부 공개 API 가 아니므로 인터페이스 변경의 외부 영향은 없다. 단, 테스트 코드에서 `as unknown as { processButtonResumeTurn: ... }` 방식으로 private 접근하던 패턴이 이번 변경으로 대상 인스턴스가 각 interaction 서비스 인스턴스로 교체됐다. 이 부분은 테스트 파일 diff 에서 올바르게 대응됐다.
  - 제안: 해당 없음.

### 발견사항 6
- **[INFO]** 엔진 `dispatch loop` 의 park/resume 위임 — `this.formInteraction.X` / `this.buttonInteraction.X` 로 교체
  - 위치: `execution-engine.service.ts` 여러 위치 (`runNodeDispatchLoop`, `executeInline`, `driveResumeAwaited` 등)
  - 상세: 6곳의 `this.waitForFormSubmission` / `this.waitForButtonInteraction` / `this.processFormResumeTurn` / `this.processButtonResumeTurn` 호출이 각 서비스 위임 호출로 교체됐다. 메서드 본문은 verbatim 이동(this.X → this.driver.X 재배선만)이므로 실행 경로·부작용은 동일하다. 내부 상태(nodeOutputCache, conversationThread 등)는 모두 파라미터로 전달되는 `ExecutionContext` 와 `Execution` 객체를 통해 흐르므로 위임 후에도 동일 컨텍스트 인스턴스가 변경된다.
  - 제안: 해당 없음.

### 발견사항 7
- **[INFO]** 테스트에서 `processFormResumeTurn — 4 branches` describe block 이 엔진 spec 에서 제거되고 `form-interaction.service.spec.ts` 로 이전됨
  - 위치: `execution-engine.service.spec.ts` diff `-describe('processFormResumeTurn — 4 branches (SUMMARY W1)'` 블록 전체 삭제
  - 상세: 대규모 테스트 블록(약 420줄)이 삭제됐다. 동일 케이스가 `form-interaction.service.spec.ts` 에 신설됐으므로 커버리지 공백은 없다. 단, 엔진 spec 의 (b) non-sentinel warn 폴백 케이스는 `service2` 인스턴스의 `logger` 를 직접 spy 하는 방식이었는데, 이제 `FormInteractionService` 인스턴스의 `logger` 를 spy 하도록 위임 인스턴스가 바뀌었다. 엔진 spec 의 non-sentinel warn 통합 테스트는 `formInteraction` 인스턴스 logger 를 spy 하도록 수정됐다.
  - 제안: 해당 없음.

### 발견사항 8
- **[INFO]** `NodeHandlerOutput` import 가 엔진에서 제거됨
  - 위치: `execution-engine.service.ts` diff `-  NodeHandlerOutput,` (line ~2034)
  - 상세: `processButtonResumeTurn` 본문에서 `updatedStructured: NodeHandlerOutput` 타입 어노테이션에 사용되던 import 가 메서드 이동과 함께 제거됐다. `button-interaction.service.ts` 에서 새로 import 한다. 엔진 외부에는 영향 없음.
  - 제안: 해당 없음.

---

## 요약

이번 변경은 `ExecutionEngineService` god-class 에서 Form/Button 블로킹 인터랙션 생명주기를 `FormInteractionService` / `ButtonInteractionService` 두 서비스로 strangler-fig 추출하는 리팩터링이다. 메서드 본문은 verbatim 이동이며, 엔진 잔류 메서드는 `EngineDriver` 토큰 경유로 재배선됐다. 전역 변수 도입 없음, 파일시스템 부작용 없음, 환경 변수 변화 없음, 네트워크 호출 변화 없음, 이벤트/콜백 발생 순서도 동일하다. 핵심 주의점은 forwardRef 순환 DI 초기화 순서인데, `AiTurnOrchestrator` 의 동일 패턴(PR2 선례)이 이미 검증돼 있어 실질적 위험은 낮다. 공유 상태인 `ConversationThreadService` 는 NestJS 싱글톤으로 모든 서비스가 동일 인스턴스를 공유하며 테스트도 이를 반영했다. 전체적으로 의도치 않은 부작용은 없다.

## 위험도

LOW
