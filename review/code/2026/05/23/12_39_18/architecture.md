# 아키텍처(Architecture) 리뷰 — AI Agent render_* 버튼 클릭 user-message 합성

## 발견사항

### [WARNING] buttonDefSchema 중복 정의 — DRY 위반 및 drift 위험

- 위치: `codebase/backend/src/nodes/presentation/carousel/carousel.schema.ts`, `chart/chart.schema.ts`, `table/table.schema.ts`, `template/template.schema.ts` 각 파일 내 로컬 `buttonDefSchema`
- 상세: 각 presentation 노드 스키마 파일마다 `buttonDefSchema` 가 독립적으로 정의되어 있으며, 이번 변경에서 `userMessage` 필드를 4곳 모두에 동일하게 복사·추가했다. `_shared/button.types.ts` 에 `ButtonDef` 인터페이스와 `validateButtons` 함수는 공유되어 있으나, Zod 스키마 자체는 공유되지 않는다. 이 구조에서 향후 `ButtonDef` 에 필드가 또 추가될 경우 4곳을 또 동시에 수정해야 하며, 한 곳이 누락되면 스키마 불일치로 LLM 이 다른 노드 타입에서는 해당 필드를 제공받지 못한다.
- 제안: `_shared/schemas.ts` 또는 `_shared/button.schema.ts` 에 단일 공유 `buttonDefSchema` 를 정의하고 각 노드 스키마가 이를 import 하도록 리팩터. 이미 `_shared/button.types.ts` 에 `ButtonDef` 인터페이스와 `validateButtons` 가 집중되어 있으므로 Zod 스키마도 같은 파일 또는 `_shared/button.schema.ts` 로 이동하는 것이 자연스럽다.

---

### [WARNING] ButtonDef 인터페이스 + Zod 스키마 이중 진실 — 단일 책임 분산

- 위치: `codebase/backend/src/nodes/presentation/_shared/button.types.ts` (TypeScript 인터페이스 `ButtonDef`), 각 노드 로컬 `buttonDefSchema` (Zod 스키마)
- 상세: `userMessage` 필드의 "정규 타입 정의" 가 두 곳에 존재한다. `button.types.ts` 의 `ButtonDef` 인터페이스와 각 노드의 `buttonDefSchema`. 이 둘은 `z.infer<>` 로 연결되지 않고 수동 동기화 상태다. Zod 스키마에서 `z.infer<typeof buttonDefSchema>` 를 `ButtonDef` 로 export 하거나, 반대로 `ButtonDef` 에서 Zod 스키마를 파생하는 방향으로 단일 진실을 확보해야 한다. 현재 구조는 미래에 두 정의가 drift 할 수 있다.
- 제안: 공유 `buttonDefSchema` 를 정의하고 `export type ButtonDef = z.infer<typeof buttonDefSchema>` 로 타입을 파생. `button.types.ts` 의 수기 `ButtonDef` 인터페이스를 삭제. 이로써 `validateButtons` 의 `Record<string, unknown>` 기반 수기 검증도 Zod 파싱으로 점진 대체 가능해진다.

---

### [INFO] findButtonContext 의 3-단계 검색 로직 — 프레젠테이션 레이어 내부 데이터 구조 지식 집중

- 위치: `codebase/frontend/src/components/editor/run-results/renderers/assistant-presentations-block.tsx` — `findButtonContext` 함수
- 상세: 이 함수는 carousel static 모드(`items[].buttons`), dynamic 모드(`config.itemButtons` + `__item_{idx}` suffix), global 버튼(`config.buttonConfig.buttons`) 의 세 가지 데이터 레이아웃을 모두 알고 있다. 이는 캐러셀의 internal data shape 에 대한 강한 의존성이다. carousel 데이터 구조가 변경될 경우 이 렌더러 코드도 함께 수정해야 한다. 다만 현재 코드베이스 규모와 해당 함수의 테스트 커버리지(unit + integration)를 감안하면 즉시 리팩터링이 필수적인 수준은 아니다.
- 제안: 향후 button lookup 로직을 `conversation-utils.ts` 또는 `button-context.ts` 헬퍼로 분리하고, 각 presentation 타입의 데이터 구조 해석 책임을 해당 타입의 렌더러 혹은 데이터 어댑터에 위임하는 방향을 고려. 현재는 단일 함수 + JSDoc 으로 충분히 문서화되어 있어 수용 가능한 수준.

---

### [INFO] `findButtonContext` / `composeUserMessage` 의 `export` 노출 범위 — 모듈 경계 관점

- 위치: `codebase/frontend/src/components/editor/run-results/renderers/assistant-presentations-block.tsx` 61행, 470행
- 상세: 두 함수 모두 `@internal` JSDoc 마커를 달고 있으나 `export` 로 공개되어 있다. 테스트가 직접 import 하기 위한 선택이다. 이 패턴은 테스트 편의를 위해 모듈 경계를 완화하는 일반적인 타협이며, `@internal` 표시로 의도가 문서화되어 있어 수용 가능하다. 다만 향후 해당 함수들이 다른 모듈에서 실제로 사용될 경우 설계 의도(`@internal`) 와 충돌한다.
- 제안: 필요시 함수를 별도 `button-context.utils.ts` 파일로 분리하면 `export` 범위를 명확히 관리할 수 있다.

---

### [INFO] `validateButtons` — Zod 스키마와 병렬 imperative 검증 이중 경로 유지

- 위치: `codebase/backend/src/nodes/presentation/_shared/button.types.ts` — `validateButtons` 함수
- 상세: `userMessage` 필드가 `ButtonDef` 인터페이스에 추가됐지만 `validateButtons` 의 imperative 검증 로직에는 `userMessage` 에 대한 어떤 검증도 없다. 이는 의도적인 설계(옵션 필드라 별도 검증 불필요)이며 적절하다. 그러나 `validateButtons` 가 `Record<string, unknown>` 을 받아 수기로 필드를 체크하는 방식은 Zod 스키마와 중복되는 검증 계층을 형성한다. 장기적으로 두 검증 경로 간 drift 가 발생할 수 있다.
- 제안: cross-field 검증(예: `type: "port"` 인데 `url` 이 있는 경우)처럼 Zod 의 선언적 DSL 로 표현하기 어려운 규칙만 `validateButtons` 에 남기고, 나머지는 Zod 스키마로 이관 검토.

---

## 요약

이번 변경은 `ButtonDef` 에 `userMessage` 옵션 필드를 추가하고 frontend 클릭 핸들러에서 4단계 우선순위 합성 로직(`findButtonContext` + `composeUserMessage`)을 도입한 것으로, 레이어 책임 분리(데이터 정의: backend schema, 합성 로직: frontend 렌더러, 발화: chat input)가 명확하며 spec SoT 참조도 충실하다. 핵심 아키텍처 우려사항은 `buttonDefSchema` 가 carousel·chart·table·template 4곳에 중복 정의되어 있다는 점으로, 이번 `userMessage` 추가가 그 중복을 4배로 증폭시켰다. `_shared/button.types.ts` 에 인터페이스 수준의 단일 진실은 존재하지만 Zod 스키마 단위 공유가 없어 향후 필드 추가마다 동일한 패턴으로 4곳을 수정해야 하는 구조적 부채가 있다. 확장성 관점에서 공유 `buttonDefSchema` 도입이 권고된다.

## 위험도

LOW
