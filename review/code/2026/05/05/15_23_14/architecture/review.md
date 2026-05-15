## 아키텍처 리뷰

---

### 발견사항

**[WARNING] 3-way 미러 패턴: 포트 id 결정 로직의 삼중 복제**
- 위치: `text-classifier.handler.ts:buildCategoryPortIds()` / `resolve-dynamic-ports.ts:classifierCategoriesPorts()` / (미관찰) `frontend/src/lib/node-definitions/resolve-dynamic-ports.ts`
- 상세: 동일한 비즈니스 규칙(trim 기반 stable port id)이 세 곳에 분산되어 있다. 파일 주석이 이 사실을 명시하고 있고, 테스트로 drift를 막으려는 의도는 분명하지만 — 규칙 변경 시 세 곳을 모두 수동 동기화해야 하는 유지보수 부채가 존재한다. `switch.cases[*].id`와 `text_classifier.categories[*].id` 두 노드만으로도 미러 지점이 늘었다.
- 제안: 핸들러가 resolver에서 `buildCategoryPortIds` 유틸을 직접 import하면 하나의 구현으로 통합할 수 있다. 현재 불가능한 이유는 `nodes/ai/text-classifier/`와 `modules/workflow-assistant/tools/`의 모듈 경계다. 두 모듈이 모두 의존할 수 있는 `shared/ports/` 유틸 모듈로 순수 함수를 추출하면 장기적으로 단일 진실 공급원을 확보할 수 있다.

---

**[WARNING] 미묘한 trim 불일치: resolver vs handler**
- 위치: `resolve-dynamic-ports.ts:89` vs `text-classifier.handler.ts:buildCategoryPortIds()`
- 상세:
  ```typescript
  // resolve-dynamic-ports.ts — c.id 원본 반환 (trim 없음)
  id: typeof c.id === 'string' && c.id.trim().length > 0 ? c.id : `class_${i}`,

  // handler.ts — c.id.trim() 반환
  typeof c.id === 'string' && c.id.trim().length > 0 ? c.id.trim() : `class_${i}`,
  ```
  앞쪽 공백이 있는 id(e.g. `" cat_refund "`)가 들어오면 resolver는 `" cat_refund "`를, handler는 `"cat_refund"`를 발행한다. `categoryDefSchema.id`의 regex(`/^[a-zA-Z0-9_-]+$/`)가 공백을 차단하므로 정상 경로에서는 문제없다. 하지만 schema를 통과하지 않은 raw config(e.g. 마이그레이션, 직접 DB 조작)가 유입되면 포트 id 불일치가 발생한다.
- 제안: resolver도 `.trim()`을 적용해 동일하게 만들거나, 두 함수 모두 검증된 slug임을 전제로 `.trim()` 없이 통일한다. 현재 비대칭이 의도된 것인지 주석으로 명시하는 것이 최소한의 조치다.

---

**[INFO] `buildCategoryPortIds`의 모듈 경계 고착**
- 위치: `text-classifier.handler.ts:15-22`
- 상세: 순수 함수 `buildCategoryPortIds`가 handler 파일에 직접 존재하는 이유는 resolver를 import하면 `nodes` 계층이 `modules/workflow-assistant`에 역방향 의존성을 갖게 되기 때문이다. 코드 주석이 이를 설명하지만, 이 함수는 현재 모듈 구조상 공유할 위치가 없다. 지금은 `switch` / `text_classifier` 두 노드에 국한되지만, 패턴이 추가 노드로 확산되면 고아 함수들이 늘어난다.
- 제안: 명시적 조치는 불필요하지만, 이 패턴이 세 번째 노드에도 반복될 때 `nodes/core/port-id-utils.ts` 같은 공유 유틸 레이어 도입을 검토할 시점이다.

---

**[INFO] `categoryDefSchema` export 범위 확대의 사이드이펙트 없음**
- 위치: `text-classifier.schema.ts:9`
- 상세: `categoryDefSchema`가 `private`에서 `export`로 변경됐다. 스펙 파일과 테스트가 직접 참조하는 구조로, 스키마 변경 시 관련 테스트가 함께 실패해 drift를 감지할 수 있다. 순환 의존성 없음.

---

**[INFO] `switch`-`classifier` 패턴 정합성 확인됨**
- 위치: `resolve-dynamic-ports.ts:switchPorts()` vs `classifierCategoriesPorts()`
- 상세: 두 함수가 이제 동일한 trim 기반 fallback 패턴을 사용한다. 신규 노드 타입 추가 시 참조할 수 있는 일관된 관용구가 형성됐다.

---

### 요약

이번 변경은 `text_classifier.categories[*].id`를 stable port id로 도입하는 기능 확장으로, `switch.cases[*].id`의 기존 패턴을 정확히 따른다. 핵심 아키텍처 위험은 포트 id 결정 로직이 backend handler, backend resolver, frontend resolver 세 곳에 분리되어 있다는 점이다. 이는 테스트로 부분적으로 완화되어 있으나, 모듈 경계 설계상 공유 추출이 현재는 불가능하다. 추가로, resolver와 handler 간 `.trim()` 적용 여부의 미묘한 불일치가 존재하며, schema 검증을 통과한 정상 입력에서는 동작 차이가 없지만 raw config 유입 경로에서 잠재적 edge case가 된다. 전체적으로 변경 범위는 잘 격리되어 있고 테스트 커버리지도 적절하다.

### 위험도

**LOW**