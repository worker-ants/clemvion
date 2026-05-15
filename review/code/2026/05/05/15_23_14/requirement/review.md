### 발견사항

- **[WARNING]** Resolver와 Handler 간 port id trim 불일치
  - 위치: `resolve-dynamic-ports.ts:88` vs `text-classifier.handler.ts:buildCategoryPortIds`
  - 상세: resolver는 `c.id` (untrimmed)를 port id로 반환하고, handler는 `c.id.trim()`을 라우팅 키로 사용. schema regex(`/^[a-zA-Z0-9_-]+$/`)가 공백을 막으므로 정상 경로에서는 무해하지만, 스키마를 우회한 레거시 데이터나 직접 DB 삽입이 있을 경우 resolver가 공백 포함 port id를 발급하고 handler는 trimmed 키로 라우팅해 edge가 끊어진다.
  - 제안: resolver도 `c.id.trim()`으로 반환하거나, handler와 동일한 `c.id.trim()` 패턴 통일. 참고로 `aiAgentConditionalPorts`는 `.trim()` 없이 `c.id.length > 0` 검사만 하므로 세 컴포넌트가 모두 다른 패턴 — 별도 헬퍼 함수로 단일화 권장.

- **[INFO]** 카테고리 id 중복 유효성 검증 부재
  - 위치: `text-classifier.schema.ts:categoryDefSchema`, `validateTextClassifierConfig`
  - 상세: 두 카테고리가 동일한 `id`를 가지면 resolver는 동일한 port id를 두 번 발급하고 `dedupeById`가 첫 번째만 남긴다. handler는 `findIndex`로 매칭하므로 나중 카테고리의 매칭 결과도 첫 번째 카테고리의 port id로 라우팅된다. `switch.caseDefSchema`에도 동일한 제약이 없으므로 일관성은 있지만, 런타임에서 조용히 잘못된 분기가 발생한다.
  - 제안: `validateTextClassifierConfig`에 id 중복 검사 추가 (`Set`으로 순회).

- **[INFO]** 시스템 프롬프트에서 `information_extractor` 오분류 수정
  - 위치: `system-prompt.ts` 변경 전
  - 상세: 이번 변경이 기존 버그(`information_extractor`가 `config.conditions[*].id` 필드를 쓴다고 잘못 안내)를 올바르게 수정한다. `information_extractor`는 `conditions` 필드 자체가 없고 `outputSchema`를 사용한다 — 정확한 수정.

- **[INFO]** 단일 라벨 테스트 "routes to category.id when set" — 기본 mock에 의존
  - 위치: `text-classifier.handler.spec.ts:493`
  - 상세: 테스트가 기본 mock(`"Billing"` 반환)에 암묵적으로 의존. `cat_refund`로 라우팅되는 이유가 `Billing`이 index 0이기 때문임이 테스트 코드만 봐서는 불명확하다. 기능 동작은 정확하나 테스트 의도가 다소 불투명.
  - 제안: mock을 명시적으로 설정하거나 주석 추가로 의도 명확화.

---

### 요약

핵심 기능인 `categories[*].id` 안정 포트 라우팅은 schema, handler, resolver, 시스템 프롬프트, spec 문서까지 일관되게 구현되어 있으며 `switch.caseDefSchema` 패턴을 올바르게 미러링한다. 테스트 커버리지도 단일/멀티 라벨 양 모드에 걸쳐 custom id·fallback·whitespace-only를 모두 검증한다. 다만 resolver와 handler 간 `trim()` 불일치가 존재해 스키마 우회 데이터에서는 port id 불일치가 발생할 수 있고, 카테고리 id 중복 시나리오에 대한 런타임 보호가 없다.

### 위험도

**LOW**