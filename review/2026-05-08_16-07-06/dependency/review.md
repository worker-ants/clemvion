## 발견사항

### [INFO] 신규 외부 의존성 없음
- 위치: 전체 변경 파일
- 상세: 37개 파일 전체에 걸쳐 새로운 npm 패키지나 외부 라이브러리는 추가되지 않음. 순수 내부 리팩토링.
- 제안: 해당 없음.

---

### [WARNING] `ExecutionContext.rawConfig` 필드 — 인터페이스 계약 전제
- 위치: 전 파일 공통 (`context.rawConfig ?? config` 패턴)
- 상세: 37개 핸들러 모두가 `context.rawConfig`에 의존하는 구조로 변경됨. 이 필드가 `ExecutionContext` 인터페이스에 선언되어 있지 않거나 optional로 선언되지 않았다면 TypeScript 컴파일 오류 발생. `?? config` fallback은 런타임 안전망이지만, 인터페이스 계약이 선행되어야 신뢰할 수 있음.
- 제안: `node-handler.interface.ts`에서 `rawConfig?: Record<string, unknown>` 선언 여부를 확인하고, 이 PR의 변경이 해당 인터페이스 변경 이후에 적용된 것인지 검증 필요.

---

### [WARNING] `parallel.handler.ts` — `context` 파라미터 optional 처리 불일치
- 위치: `parallel.handler.ts`, `execute` 메서드 시그니처
- 상세: `context?: ExecutionContext` (optional)로 선언되어 있으나 다른 모든 핸들러는 required로 받음. `NodeHandler` 인터페이스의 `execute` 시그니처가 required `context`를 요구한다면, optional 선언은 인터페이스 계약 위반 또는 구조적 타입 mismatch를 유발.
```ts
// parallel.handler.ts — optional
async execute(input, config, context?: ExecutionContext)

// 다른 모든 핸들러 — required
async execute(input, config, context: ExecutionContext)
```
- 제안: 인터페이스 정의 확인 후 일관성 있게 required로 통일. 기존 테스트에서 `context` 없이 호출하는 케이스가 있다면 `makeContext()` 헬퍼로 교체.

---

### [WARNING] `ai-agent.handler.ts` — `state.rawConfig` 의존성이 Phase 1 구현을 전제
- 위치: `ai-agent.handler.ts`, multi-turn resume 지점
- 상세: `const turnRawConfig = (state.rawConfig as Record<string, unknown> | undefined) ?? {}` 패턴이 Phase 1에서 `state.rawConfig`를 스냅샷하는 구현이 완료됨을 전제. 주석도 "see Phase 1"로 명시. Phase 1이 미적용 상태에서 이 코드가 실행되면 항상 `{}` fallback이 사용되어 multi-turn resume의 raw echo가 무음으로 실패.
- 제안: Phase 1의 `state.rawConfig` 스냅샷 구현 여부를 확인하는 통합 테스트 또는 assertion을 추가할 것을 권장.

---

### [WARNING] `information-extractor.handler.ts` — `outputSchema` vs `schema` 필드명 불일치
- 위치: `information-extractor.handler.ts`, configEcho 구성
- 상세: 에코 필드는 `schema`로 노출하지만 rawConfig에서는 `rawConfig.outputSchema`를 읽음. raw config의 실제 키가 `outputSchema`라면 정상이나, 만약 다른 이름이라면 `undefined`로 fallback되어 평가된 값이 사용됨. 네이밍 불일치가 silent fallback을 유발.
```ts
schema: rawConfig.outputSchema ?? outputSchema,  // rawConfig 키가 'outputSchema'인지 확인 필요
```
- 제안: 스키마 정의 파일(`information-extractor.schema.ts`)에서 실제 config 필드명을 확인하고, raw config 키와 echo 필드명 간 변환이 의도적인지 주석으로 명시.

---

### [INFO] `loop.handler.ts` — 부수효과 없는 함수를 side-effect 목적으로 호출
- 위치: `loop.handler.ts`, `execute` 메서드
- 상세: `parseNumeric`은 순수 함수이며 부수효과가 없음. 주석 "parseNumeric is still invoked for its side-effect of validating the resolved values"는 사실과 다름. `void parseNumeric(count)` 호출은 실질적으로 dead code이며 유지보수 혼선을 유발.
```ts
void parseNumeric(count);  // 반환값 버림, 부수효과 없음 → 사실상 무연산
```
- 제안: 해당 라인 제거. 유효성 검증이 필요하다면 `validate()` 단계에서 처리하거나 명시적으로 결과를 사용.

---

### [INFO] `workflow.handler.ts` — `buildSubWorkflowError` 타입 희석
- 위치: `workflow.handler.ts`, `buildSubWorkflowError` 시그니처
- 상세: 메서드 입출력 타입이 `{ workflowId: string; mode: 'sync' | 'async' }`에서 `Record<string, unknown>`으로 희석됨. `details.workflowId`와 `details.mode`를 사용하는 호출 측이 타입 정보를 잃어 런타임에서만 오류 감지 가능.
- 제안: 의존성 관점의 위험도는 낮으나, `configEcho` 전용 타입 alias를 정의하여 최소한의 타입 안전성을 유지하는 것을 권장.

---

### [INFO] `chart.handler.ts` — 죽은 변수 `void` 처리
- 위치: `chart.handler.ts`, execute 메서드
- 상세: `void chartType; void title;`으로 TS unused variable 경고를 억제. 이 변수들을 선언만 하고 `rawConfig`에서 다시 읽는 구조는 불필요한 중간 변수 의존성을 만듦.
- 제안: `const chartType = ...` 선언 자체를 제거하고 `rawConfig.chartType`만 직접 사용.

---

## 요약

본 변경은 외부 패키지 의존성을 전혀 추가하지 않는 순수 내부 리팩토링으로, 의존성 관점의 핵심 위험은 **`ExecutionContext.rawConfig` 인터페이스 계약**에 집중된다. 37개 핸들러 전체가 동일한 `context.rawConfig ?? config` 패턴에 의존하므로, 이 필드가 인터페이스에 올바르게 선언되어 있는지가 전제 조건이다. `parallel.handler.ts`의 optional context 불일치, multi-turn AI agent의 Phase 1 전제 의존성, information-extractor의 `outputSchema`/`schema` 키 불일치가 추가 점검 대상이다. 나머지는 코드 품질 수준의 사항으로 빌드/런타임 안전성에 직접 영향을 주지 않는다.

## 위험도

**LOW**