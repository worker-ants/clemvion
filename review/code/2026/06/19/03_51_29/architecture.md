# 아키텍처(Architecture) Review

## 발견사항

### [INFO] 순수함수 추출 — 단일 책임 및 테스트 가능성 개선
- 위치: `button-interaction.service.ts` — `resolveButtonInteraction`, `buildResumedStructuredOutput` (모듈 레벨 export)
- 상세: 기존 `processButtonResumeTurn` 메서드 내의 결정 로직(포트 선택, output 구성, structuredInteraction 파생)을 부수효과 없는 순수함수 두 개로 추출했다. I/O 의존성(driver, repository, eventEmitter, contextService)을 받지 않고 순수 값만 입력받아 결과를 반환하므로 SRP 관점에서 올바른 방향이다. 추출된 함수들은 `describe('resolveButtonInteraction')`, `describe('buildResumedStructuredOutput')` 블록에서 완전히 격리하여 검증한다.
- 제안: 현 상태 유지.

### [INFO] 판별유니온 타입 도입 — 타입 안전성 향상
- 위치: `button-interaction.service.ts` L1239–1241 (`ButtonClickPayload`), `isButtonClickPayload` 가드
- 상세: 이전 `payload as { type; buttonId?; action? }` 캐스팅을 판별유니온(`ButtonClickPayload`)과 타입 가드(`isButtonClickPayload`)로 대체했다. `action?` 필드가 실제로 읽히지 않으므로 의도적으로 제외한 점이 문서화됐다. `buttonId?` 가 optional 이므로 런타임에 누락 시 `find` miss → `INVALID_BUTTON_ID` throw — 기존 `buttonId!` 의 동작이 보존된다. 이 행위는 spec 파일 테스트 케이스 "button_click(buttonId 누락) → INVALID_BUTTON_ID throw"로 못박혔다.
- 제안: 현 상태 유지.

### [WARNING] `StructuredInteraction` 타입 위치 — 모듈 경계 불명확
- 위치: `button-interaction.service.ts` L1276–1283
- 상세: `StructuredInteraction` 인터페이스는 버튼 인터랙션에 국한되지 않는 통합 상호작용 형태(CONVENTIONS §4.5)이며, type union에 `form_submitted`, `message_received` 도 포함된다. 그러나 현재 `button-interaction.service.ts` 에 module-level export로 정의되어 있다. `FormInteractionService` 나 향후 다른 상호작용 서비스가 이 타입을 재사용해야 할 경우 `button-interaction.service`에 대한 순환·결합 의존이 발생할 수 있다.
- 제안: `StructuredInteraction`(및 연관 타입)을 `codebase/backend/src/shared/` 또는 `execution-engine/types/` 하위의 공용 타입 파일로 이동하고, `button-interaction.service.ts`와 `form-interaction.service.ts`가 그것을 임포트하도록 역전시킨다. 이는 의존성 역전(DIP) 관점에서 타입의 소유권을 사용처가 아닌 도메인 계약 레이어에 두는 것이다.

### [INFO] `buildResumedStructuredOutput`의 Array 입력 분기 — 잠재적 데이터 모양 불일치
- 위치: `button-interaction.service.ts` L1466–1475, spec 파일 `buildResumedStructuredOutput` (b) 케이스
- 상세: `rawPrevOutput`이 배열(`Array.isArray`)인 경우 `Object.fromEntries` strip 분기를 우회하고, `{ ...array }` spread로 인덱스 키(`'0'`, `'1'` …)가 output에 펼쳐진다. 이 동작은 테스트에서 명시적으로 문서화됐으나("인덱스 spread"), 실제 production에서 prevStructured.output이 배열인 케이스가 어느 노드에서 발생하는지 주석이나 spec 참조가 없다. 방어 코드가 있지만 미문서화된 케이스를 조용히 처리하는 안티패턴이다.
- 제안: 배열 입력이 실제 발생 가능한 케이스라면 해당 노드 타입과 스펙 섹션을 주석으로 명시한다. 발생하지 않는다면 가드를 제거하고 예외를 throw하여 숨겨진 상태를 드러낸다.

### [INFO] `processButtonResumeTurn` — `payload as ButtonClickPayload` 캐스팅 잔류
- 위치: `button-interaction.service.ts` L2201 (`payload as ButtonClickPayload`)
- 상세: 메서드 시그니처가 `payload: unknown`을 받는 것은 엔진 호출자 인터페이스 호환을 위한 의도적 선택(주석으로 설명됨)이나, 내부에서 다시 `as ButtonClickPayload`로 단언하는 패턴이 남는다. `resolveButtonInteraction`의 파라미터가 이미 `ButtonClickPayload`를 받으므로, 이 캐스팅은 타입 경계를 메서드 진입점에서 한 단계 안으로 밀어넣는 것이다.
- 제안: 현 상태에서는 허용 가능하나, `processButtonResumeTurn` 시그니처를 `payload: ButtonClickPayload`로 변경하고 호출자(엔진/레지스트리)에서 타입 가드를 적용하는 것이 DIP/ISP 관점에서 더 엄격한 경계를 형성한다. 단, 이는 호출자 인터페이스 변경을 수반하므로 별도 PR에서 검토 권장.

### [INFO] `ButtonInteractionResolution.updatedOutput` — `Record<string, unknown>` 과도한 유연성
- 위치: `button-interaction.service.ts` L1270, `resolveButtonInteraction` 반환값
- 상세: `updatedOutput`은 실제로 `{ type, buttonId?, buttonLabel?, clickedAt, selectedItem?, nodeOutput, _selectedPort }` 형태를 갖지만 인터페이스에서 `Record<string, unknown>`로만 타이핑된다. 이는 `structuredInteraction`이 명시적 인터페이스(`StructuredInteraction`)를 가지는 것과 대비된다. flat output 포맷은 레거시 wire-shape이라는 점이 주석에 명시되어 있으나, 향후 소비자가 필드를 타입 안전하게 접근할 수 없다.
- 제안: `FlatNodeOutput` 같은 명시적 타입을 정의하거나, 최소한 주요 필드를 `Partial<{...}>` 형태로 선언하여 구조를 문서화한다. 레거시 필드임을 `@deprecated` 주석으로 표기하면 의도가 명확해진다.

### [INFO] 테스트 내 `structuredOutputCache` 직접 캐스팅 접근
- 위치: `button-interaction.service.spec.ts` L519–521 (`(ctx as { structuredOutputCache: ... }).structuredOutputCache`)
- 상세: `seedButtonContext` 헬퍼가 `ExecutionContext`의 `structuredOutputCache`를 강제 캐스팅으로 접근한다. 이는 `ExecutionContextService`가 해당 필드를 public API로 노출하지 않거나 타입 정의에서 optional/private임을 의미하며, 테스트가 구현 세부사항에 결합되어 있다.
- 제안: `ExecutionContextService` 또는 `ExecutionContext` 타입에서 `structuredOutputCache`를 명시적으로 접근 가능하게 하거나, 테스트용 seed 헬퍼(`seedStructuredOutput`)를 서비스 API를 통해 구성하도록 리팩터링한다. 현재는 경미한 문제이지만 구현 변경 시 테스트가 타입 오류 없이 잘못된 상태를 주입할 위험이 있다.

## 요약

이번 변경은 `ButtonInteractionService` 내 god-class 분해의 일환으로, 부수효과 있는 `processButtonResumeTurn`에서 순수 결정 로직(`resolveButtonInteraction`, `buildResumedStructuredOutput`)을 분리하는 Strangler Fig 패턴을 충실히 적용했다. SOLID 관점에서 SRP/DIP 방향이 올바르며, `EngineDriver` 인터페이스를 통한 DI 경계도 `FormInteractionService`와 동일한 선례를 따른다. 가장 주목할 구조적 문제는 `StructuredInteraction` 타입이 버튼 전담 서비스 파일에 정의되어 있다는 점으로, form/button/message 공통 계약임에도 불구하고 소유권이 구체 구현에 위치한다. 이를 공용 타입 파일로 이동하면 향후 상호작용 서비스 확장 시 순환 의존 위험을 제거할 수 있다. 나머지 발견사항은 레거시 호환 유지를 위한 의도적 선택이 대부분이며, 코멘트로 충분히 문서화되어 있다.

## 위험도

LOW
