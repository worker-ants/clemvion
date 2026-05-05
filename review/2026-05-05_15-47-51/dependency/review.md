### 발견사항

- **[INFO]** 외부 패키지 추가 없음
  - 위치: 변경된 모든 파일
  - 상세: 이 변경셋은 신규 `npm` 의존성을 전혀 도입하지 않는다. `zod`, `@workflow/node-summary`, 내부 모듈(`../../core/...`) 모두 기존 의존 그래프에 이미 존재한다.
  - 제안: 해당 없음.

- **[INFO]** `keyValueSchema` / `optionSchema` 공개 API 표면(export) 확장
  - 위치: `http-request.schema.ts` L14, `form.schema.ts` L14
  - 상세: 두 스키마가 `export` 키워드를 얻음으로써 모듈의 공개 계약에 편입된다. 현재 소비자는 각자의 `.spec.ts` 뿐이지만, 일단 공개되면 다른 모듈이 암묵적으로 의존할 수 있어 이후 시그니처 변경 비용이 증가한다.
  - 제안: 테스트 목적만이라면 barrel(`index.ts`) 없이 직접 import 하는 현 구조는 적절하다. 향후 타 노드에서 재사용할 경우 `@workflow/node-schema` 같은 공유 패키지로 격상(promote)할 시점을 별도로 검토한다.

- **[WARNING]** `passthrough()` 추가로 인한 다운스트림 소비자 동작 변경
  - 위치: `http-request.schema.ts` L19, `form.schema.ts` (기존에 이미 `.passthrough()` 적용되어 있었으므로 `optionSchema`는 신규 아님)
  - 상세: `keyValueSchema`에 `.passthrough()`가 추가되면서 이 스키마를 통해 파싱된 객체는 이제 선언되지 않은 필드를 그대로 전달한다. 스키마를 소비하는 핸들러·직렬화 레이어가 입력을 신뢰하고 불필요한 키를 자동으로 걸러낸다고 가정하고 있었다면, 예상치 못한 키가 하위 시스템(HTTP 클라이언트, 로깅, 직렬화)으로 흘러들 수 있다. 현재 `http-request.handler`가 `headers`·`queryParams` 배열을 어떻게 소비하는지 확인이 필요하다.
  - 제안: 핸들러에서 `keyValueSchema`를 통해 파싱된 배열을 사용할 때 `{ key, value }` 이외 필드를 명시적으로 구조 분해(destructure)하거나 무시하는 코드가 있는지 검토한다. 없다면 핸들러 측에서 `pick(['key', 'value'])`류 처리를 추가해 passthrough 필드가 실제 HTTP 헤더에 전달되지 않도록 보장한다.

- **[INFO]** `value: z.unknown().optional()` → `z.unknown().default('')` 변경의 내부 타입 계약 영향
  - 위치: `form.schema.ts` L16
  - 상세: `optional()`이 제거되고 `default('')`가 적용되어 파싱 결과 타입이 `unknown | undefined` → `unknown`(항상 존재)으로 좁아진다. 이를 소비하는 코드가 `value === undefined` 분기를 가지고 있다면 dead code가 될 수 있다.
  - 제안: `formFieldSchema`의 `options` 배열을 소비하는 핸들러·프론트엔드 enricher에서 `value` 누락 방어 코드가 있으면 제거 또는 주석 처리하여 코드베이스 혼란을 줄인다.

---

### 요약

이번 변경셋은 외부 의존성을 전혀 추가하지 않는 순수한 내부 리팩토링이다. 의존성 관점의 실질적 변화는 두 스키마를 공개 API로 승격시킨 것과, `keyValueSchema`에 `.passthrough()`를 적용해 파싱 시 미선언 필드가 보존되도록 동작을 바꾼 점이다. `passthrough` 정책이 이미 `form.schema.ts`의 `optionSchema`에 선행 적용되어 있으므로 일관성 측면은 개선되었으나, 다운스트림 HTTP 핸들러가 passthrough 필드를 실제 HTTP 헤더·쿼리스트링에 그대로 전달하지 않는지 단 한 번의 소비 경로 추적이 필요하다.

### 위험도

**LOW**