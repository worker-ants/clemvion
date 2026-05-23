# 유지보수성(Maintainability) 리뷰

## 발견사항

### [WARNING] `buttonDefSchema` 중복 정의 — 4개 파일에 동일 코드 반복
- 위치: `carousel/carousel.schema.ts`, `chart/chart.schema.ts`, `table/table.schema.ts`, `template/template.schema.ts` 각각 `const buttonDefSchema = z.object({...})`
- 상세: `id`, `label`, `type`, `url`, `style`, `userMessage` 6개 필드로 구성된 `buttonDefSchema`가 4개 스키마 파일에 완전히 동일하게(또는 거의 동일하게) 반복 정의되어 있다. 이번 PR에서 `userMessage` 필드를 추가할 때 4개 파일을 각각 편집해야 했으며, 향후 ButtonDef 필드 추가/변경 시에도 동일한 산포 편집이 반복된다.
- 제안: `button.types.ts` 에 이미 `ButtonDef` 인터페이스와 유틸 함수들이 모여 있는 것처럼, Zod `buttonDefSchema` 도 `_shared/button.schema.ts` (또는 `button.types.ts` 내부)로 추출해 단일 정의하고 각 노드 스키마에서 import하여 사용한다. `validateButtons` 의 공유 패턴이 이미 이 방향을 지지한다.

---

### [WARNING] `carousel.schema.ts` vs 나머지 3개 파일의 `placeholder` 문자열 불일치 — 무언의 분기
- 위치:
  - `carousel/carousel.schema.ts` 줄 `placeholder`: `'클릭 시 chat 발화 텍스트 (생략 시 자동 합성: "{item.title} → {label}")'`
  - `chart/chart.schema.ts`, `table/table.schema.ts`, `template/template.schema.ts` 줄 `placeholder`: `'클릭 시 chat 발화 텍스트 (생략 시 자동 합성: label)'`
- 상세: carousel은 per-item fallback 형식(`{item.title} → {label}`)을 명시하고, 나머지 세 노드는 `label`만 표기한다. 이는 실제 동작 차이를 반영하는 의도적 분기이지만, 스키마 코드가 복사-수정 방식으로 관리되기 때문에 이 차이가 코드 상에서 드러나지 않는다. 중앙 공유 스키마로 추출 시 carousel 전용 placeholder를 명시적으로 override하는 구조가 강제되어 의도가 더 명확해진다.
- 제안: 공유 스키마 추출 후 carousel 전용 옵션(placeholder override)을 명시적 파라미터로 노출.

---

### [WARNING] `findButtonContext` 반환 타입의 인라인 익명 타입 — 재사용 불가
- 위치: `assistant-presentations-block.tsx` `findButtonContext` 함수 반환 타입 (인라인 `| { button: { id?: string; label?: string; type?: string; userMessage?: string }; item?: Record<string, unknown> } | undefined`)
- 상세: 반환 타입이 함수 시그니처 안에 인라인으로 선언되어 있어 `composeUserMessage`의 `ctx` 파라미터 타입과 약간 다르게(필드 구성이 유사하지만 별개 리터럴로) 선언되어 있다. 현재는 구조 호환이 맞지만, 향후 필드 추가 시 두 곳을 따로 수정해야 한다.
- 제안: `ButtonContext` (또는 `ButtonClickContext`)로 named 타입 또는 인터페이스로 추출하여 `findButtonContext`와 `composeUserMessage` 모두 동일 타입을 참조하게 한다.

---

### [INFO] `findButtonContext` 함수 — 단일 함수가 3가지 검색 경로를 순차 처리하는 복합 책임
- 위치: `assistant-presentations-block.tsx` `findButtonContext` 내부 (약 55줄)
- 상세: 함수가 (1) static per-item 검색, (2) dynamic itemButtons 검색, (3) global/runtime buttons 검색의 세 로직 경로를 순차 실행한다. 주석으로 각 단계가 잘 구분되어 있고 길이도 허용 범위 내이나, `dynamicMatch` / `dynamicIdx` / `dynamicItem` 계산이 함수 상단에 선제적으로 수행되어 실제 사용 여부와 무관하게 매번 실행된다. 코드 추적 시 "왜 맨 위에서 이걸 계산하지?" 라는 의문을 유발할 수 있다.
- 제안: `dynamicItem` 계산을 실제로 필요한 분기(경로 2, 3) 직전으로 이동하거나 lazy getter 패턴으로 처리하면 읽기 흐름이 자연스러워진다. 현재 상태도 기능상 문제는 없으므로 INFO 수준.

---

### [INFO] 테스트 파일 내 `as unknown as { ... }` 타입 단언 패턴 4회 반복
- 위치:
  - `carousel.schema.spec.ts` `'exposes userMessage in JSON Schema...'` 테스트
  - `chart.schema.spec.ts`, `table.schema.spec.ts`, `template.schema.spec.ts` 각 `buttonDefSchema — userMessage` 테스트
- 상세: `z.toJSONSchema(...)` 결과를 사용하기 위해 동일한 이중 타입 단언 + 인라인 구조 타입이 4개 테스트 파일에 반복된다. 테스트 코드이므로 중복 허용 범위이나, 공통 헬퍼 `expectButtonUserMessageInSchema(schema: ZodType)` 형태로 추출하면 향후 노드 추가 시 즉시 재사용 가능하다.
- 제안: `__tests__/helpers/button-schema-assertions.ts` 또는 동일 spec 파일 최상단 공유 유틸로 추출 (선택적 개선).

---

### [INFO] `button.types.ts`의 `validateButtons`가 `userMessage` 필드를 검증하지 않음 — 암묵적 무검증
- 위치: `codebase/backend/src/nodes/presentation/_shared/button.types.ts` `validateButtons` 함수
- 상세: 새로 추가된 `userMessage` 필드에 대한 유효성 검사가 `validateButtons` 에 없다. 빈 문자열 처리는 frontend에서 "빈 문자열은 무시하고 fallback 적용"으로 정의되어 있으나, backend 검증 레이어에서는 `userMessage: ""` 입력이 그대로 통과된다. 의도적 설계(optional이고 빈 문자열도 허용)라면 명시적 주석이 있어야 향후 유지보수자가 "누락"이 아님을 알 수 있다.
- 제안: `validateButtons` 내부 또는 `userMessage` JSDoc에 "빈 문자열은 frontend에서 무시, backend는 검증하지 않음(의도적)"이라는 한 줄 주석 추가.

---

## 요약

이번 변경은 `ButtonDef.userMessage` 옵션 필드 추가와 클릭 시 user message 합성 로직(`findButtonContext` + `composeUserMessage`)을 도입한다. 함수명·변수명·주석 품질이 전반적으로 높고, 우선순위 로직이 테스트로 잘 명세되어 있다. 가장 큰 유지보수성 위험은 `buttonDefSchema`가 4개 노드 스키마 파일에 각각 복사-정의되어 있다는 점으로, 이번 PR에서 4파일을 동시 편집해야 했던 것이 이를 증명한다. `_shared/button.types.ts`에 이미 공유 검증 로직이 있으므로 Zod 스키마도 같은 방향으로 중앙화가 필요하다. frontend의 `findButtonContext` 반환 타입을 named 타입으로 추출하는 것도 중장기 유지보수성에 기여할 수 있다.

## 위험도

MEDIUM
