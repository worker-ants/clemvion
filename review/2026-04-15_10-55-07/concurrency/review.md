### 발견사항

- **[INFO]** `listDefinitions()`의 반복적 JSON Schema 직렬화
  - 위치: `node-component.registry.ts` — `listDefinitions()` 메서드
  - 상세: 매 HTTP 요청마다 전체 컴포넌트 목록에 대해 `z.toJSONSchema()`를 호출함. 컴포넌트 정의는 `bootstrap()` 이후 불변(immutable)이므로 반복 연산은 낭비임. Node.js 단일 스레드 환경이라 경쟁 조건은 없지만, 고트래픽 상황에서 이벤트 루프에 불필요한 부하를 줌.
  - 제안: `bootstrap()` 완료 시점에 직렬화 결과를 `private readonly definitions: NodeDefinitionView[]`로 캐싱하고, `listDefinitions()`는 캐시를 반환하도록 변경.

- **[INFO]** `bootstrap()` 중복 호출 방어 로직 부재
  - 위치: `node-component.registry.ts` — `bootstrap()` 메서드
  - 상세: `bootstrap()`는 컴포넌트 단위로 중복을 검사하지만, 메서드 자체가 두 번 호출되는 경우(예: 모듈 재초기화, 테스트 환경 재사용)를 막는 가드가 없음. Node.js 단일 스레드 모델에서 `onModuleInit` 단계에 한 번만 호출되므로 현재 프로덕션 경로에서는 문제 없음.
  - 제안: `private bootstrapped = false` 플래그를 두고, 두 번 호출 시 즉시 에러를 던지도록 명시적 가드 추가.

---

### 요약

변경된 코드는 NestJS의 `onModuleInit` 단계에서 `bootstrap()`을 1회 호출하여 `components` Map을 초기화하고, 이후 요청 처리 시에는 읽기만 수행하는 구조다. Node.js의 단일 스레드 이벤트 루프 특성상 초기화 완료 전에 요청이 처리될 수 없으므로, 경쟁 조건·데드락·스레드 안전성 관련 실질적 위험은 없다. 단, `listDefinitions()`가 매 요청마다 전체 컴포넌트의 JSON Schema를 재직렬화하는 점은 불필요한 CPU 낭비이며 초기화 시점에 캐싱하는 것이 적절하다.

### 위험도

LOW