# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [INFO] 새 export 심볼 추가 — 공개 API 확장
- 위치: `button-interaction.service.ts` 상단 (모듈 레벨)
- 상세: `ButtonClickPayload`, `ButtonInteractionResolution`, `StructuredInteraction` (타입), `isButtonClickPayload`, `resolveButtonInteraction`, `buildResumedStructuredOutput` 6개 심볼이 새로 `export` 된다. 기존 export (`ButtonInteractionService`) 는 유지되므로 breaking change 없음. 신규 심볼은 단방향 추가다.
- 제안: 이 수준의 확장은 의도적이며 문제없음. 단, 향후 이 심볼들의 시그니처를 바꿀 경우 테스트·소비자 양쪽을 함께 갱신해야 함.

### [INFO] `resolveButtonInteraction` — `cleanNodeOutput` 을 참조로 유지 (shallow copy 전달)
- 위치: `button-interaction.service.ts`, `processButtonResumeTurn` 내 `const cleanNodeOutput = { ...flatNodeOutput }`
- 상세: 호출 측에서 `cleanNodeOutput` 은 `{ ...flatNodeOutput }` 으로 shallow copy 된 뒤 `delete cleanNodeOutput.status` 등이 적용된 후 `resolveButtonInteraction` 에 전달된다. 함수 내부에서는 이 객체를 `nodeOutput: cleanNodeOutput` 형태로 `updatedOutput` 에 직접 참조로 포함한다. 이로 인해 `cleanNodeOutput` 의 이후 돌연변이(현재 코드에는 없음)가 `updatedOutput.nodeOutput` 에 반영될 수 있다. 현재 `processButtonResumeTurn` 내에서 `cleanNodeOutput` 을 `resolveButtonInteraction` 호출 이후 다시 수정하는 코드는 없으므로 실제 부작용은 발생하지 않는다.
- 제안: 현재 코드에서는 안전하나, 함수 시그니처 문서(`@param cleanNodeOutput`)에 "callee 는 이 객체를 mutations 없이 참조로만 읽는다"고 명시하면 미래 소비자가 안전성을 오인하지 않는다.

### [INFO] `buildResumedStructuredOutput` — `prevConfig` 참조 공유
- 위치: `button-interaction.service.ts`, `buildResumedStructuredOutput` 함수
- 상세: `prevConfig = prevStructured?.config ?? {}` 를 반환 객체의 `config` 필드에 그대로 참조한다. `prevStructured.config` 객체가 공유 상태(`context.structuredOutputCache`)에서 온 경우 반환된 `NodeHandlerOutput.config` 를 외부에서 돌연변이하면 캐시가 오염된다. 현재 호출자(`setStructuredOutput`)가 이를 deep-clone 하는지는 이 diff 에서 확인 불가하나, 기존 코드(`prevConfig = prevStructured?.config ?? {}`)도 동일 패턴을 사용하고 있어 동작 변화 없음 — 리팩터 전후 동일 위험 수준.
- 제안: 현재 리팩터 범위 내에서는 신규 부작용 아님. 필요 시 `ExecutionContextService.setStructuredOutput` 단에서 deep-clone 처리를 별도로 고려.

### [INFO] `payload as ButtonClickPayload` 캐스팅 — 타입 안전성 감소 없음
- 위치: `button-interaction.service.ts` L2201 (`payload as ButtonClickPayload`)
- 상세: `processButtonResumeTurn` 의 `payload: unknown` 를 `ButtonClickPayload` 로 캐스팅한다. 기존 코드도 동일하게 `payload as { type; buttonId?; action? }` 캐스팅했으므로 타입 안전성 수준이 유지된다. 다만 `ButtonClickPayload` 유니온의 fallback arm `{ type: string }` 이 어떤 객체도 수용하므로, 런타임에서 `payload` 가 비-객체(null, number 등)인 경우 `payload.type` 접근 시 예외가 발생할 수 있다. 이는 기존과 동일한 위험이다.
- 제안: 현재 리팩터 범위의 regression 없음.

### [INFO] 전역 변수·파일시스템·환경 변수·네트워크 호출 — 해당 없음
- 상세: 추가된 모듈-레벨 함수(`resolveButtonInteraction`, `buildResumedStructuredOutput`, `isButtonClickPayload`)는 전역 상태를 읽거나 쓰지 않는다. 파일 I/O, 환경 변수, 외부 네트워크 호출 없음. NestJS DI 범위 밖 싱글톤 상태도 없음.

### [INFO] 이벤트/콜백 — 부작용 패턴 변화 없음
- 위치: `processButtonResumeTurn` 전체
- 상세: `emitNode`, `emitExecution` 호출 순서·조건(`if (nodeExec)`)이 리팩터 전후 동일하게 유지된다. `setNodeOutput` → `setStructuredOutput` → `appendPresentationInteraction` → DB save → `emitNode` → `emitExecution` 순서 보존됨.

### [INFO] 시그니처 변경 — `ButtonInteractionService` 메서드 시그니처 불변
- 상세: `waitForButtonInteraction`, `processButtonResumeTurn` 의 파라미터·반환 타입이 변경되지 않았다. 기존 호출자(엔진, resume registry)에 대한 영향 없음.

## 요약

이번 변경은 `processButtonResumeTurn` 내부의 순수 결정 로직을 모듈-레벨 함수(`resolveButtonInteraction`, `buildResumedStructuredOutput`)로 추출하고 관련 타입을 export 하는 리팩터다. 부작용 관점에서 핵심 검토 항목은 모두 안전하다: 전역 상태·파일시스템·환경 변수·외부 네트워크 호출이 없고, 공개 클래스 메서드 시그니처가 변경되지 않아 기존 호출자에 영향이 없다. 신규 export 심볼은 단방향 추가(non-breaking)다. `cleanNodeOutput` 의 참조 공유와 `prevConfig` 참조 패스스루는 리팩터 이전과 동일한 동작으로 신규 위험을 도입하지 않는다. 이벤트 발생 순서도 완전히 보존된다.

## 위험도

NONE
