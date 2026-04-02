### 발견사항

---

**[INFO] `carousel.handler.ts`: 모드 분기 로직의 중복**
- 위치: `validate()` (L21)와 `execute()` (L57) — 모두 `const mode = (config.mode as string) ?? 'dynamic'` 를 독립적으로 읽음
- 상세: `mode` 파싱 로직이 두 메서드에 걸쳐 중복됨. 현재는 단순하지만, 유효 모드 목록이 늘어날 경우 양쪽을 모두 수정해야 함
- 제안: `private getMode(config): 'static' | 'dynamic'` private 메서드로 추출

---

**[INFO] `carousel.handler.ts`: Strategy 패턴 미적용**
- 위치: `execute()` L58–L86 (모드별 분기)
- 상세: 두 개의 독립적인 실행 경로(static/dynamic)가 단일 메서드 안에 `if/else`로 공존함. 현재 복잡도에서는 허용 가능하나, 세 번째 모드 추가 시 OCP를 위반하게 됨
- 제안: 즉각적인 리팩토링은 불필요하나, 모드가 추가된다면 `CarouselItemBuilder` 전략 인터페이스 도입 권장

---

**[WARNING] `carousel.handler.ts`: static 모드에서 null 입력 시 config.items 미검증 크래시 가능성**
- 위치: `execute()` L62 — `const configItems = config.items as Array<{...}>`
- 상세: `validate()`가 `items` 누락을 검증하지만, 실행 엔진이 `validate()` 호출을 보장하지 않는 경우(또는 validate를 건너뛰는 경로가 생기는 경우) `configItems.map(...)` 에서 TypeError 발생. `validate()`와 `execute()` 사이의 암묵적 선조건 결합
- 제안: `execute()` 내에서 `if (!Array.isArray(config.items)) return Promise.resolve({ type: 'carousel', items: [], ... })` 방어 처리 추가

---

**[WARNING] `execution-engine.service.spec.ts`: 구현 내부 상태에 직접 접근**
- 위치: L576–L579, L644–L647 — `(service as any)['contextService']`
- 상세: 테스트가 서비스의 private 멤버를 직접 접근하여 구현 세부사항에 강결합됨. `contextService` 필드명 변경 또는 리팩토링 시 테스트가 조용히 깨짐. eslint-disable 라인 수를 줄인 것은 개선이지만 근본 문제는 미해결
- 제안: `TestingModule`에서 `ExecutionContextService`를 jest spy factory로 제공하거나, `createContext`를 public API로 테스트 가능하게 설계 재검토

---

**[WARNING] `presentation-configs.tsx`: 인덱스를 key로 사용**
- 위치: L48 — `{items.map((item, i) => (<div key={i} ...>)`
- 상세: 아이템 삭제/순서 변경 시 React 재조정 오류 발생 가능. 특히 `removeItem(i)`는 인덱스 기반 삭제라 key와 조합 시 DOM 상태가 이전 아이템에 잔류할 수 있음
- 제안: `items` 각 항목에 `id` 필드 추가(`crypto.randomUUID()` 등), 또는 `addItem` 시 `{ ...item, _id: Date.now() }` 부여 후 `key={item._id}` 사용

---

**[INFO] `carousel.handler.ts`: `toStr()` 유틸리티의 모듈 범위 노출**
- 위치: L7–L14
- 상세: 다른 핸들러에서도 동일한 변환이 필요한 경우(예: TableHandler, ChartHandler) 동일 함수가 각 파일에 복제될 위험. 현재는 단일 파일에 존재하므로 low severity
- 제안: `handlers/utils/type-coercion.ts` 등 공유 유틸 모듈로 이동 검토 (다른 핸들러에서도 사용되기 시작하면 즉시 이동)

---

**[INFO] `carousel.handler.ts`: `_context` 미사용 파라미터**
- 위치: L58 — `// eslint-disable-next-line @typescript-eslint/no-unused-vars` + `_context`
- 상세: `NodeHandler` 인터페이스 준수를 위한 불가피한 패턴이나, static 모드에서 "표현식 해석은 실행 엔진이 사전 처리"한다는 스펙과 일치함. 다만 미래에 context 의존성이 생길 경우 이 억제 패턴을 제거해야 함
- 제안: 인터페이스에 `context?: ExecutionContext` 옵셔널 시그니처 고려 또는 현재 상태 유지

---

**[INFO] Frontend-Backend 암묵적 Config 계약**
- 위치: `carousel.handler.ts` config 구조 ↔ `presentation-configs.tsx` config 구조
- 상세: 양측이 `mode`, `items`, `titleField` 등 동일한 키 이름을 문자열 리터럴로 공유하나 공유 타입 정의가 없음. 필드 이름 변경 시 런타임까지 오류 발견이 지연됨
- 제안: 단기적으로 스펙 문서(현재 갱신됨)가 계약 역할을 대신하므로 허용 가능. 중기적으로 `shared/types/carousel-config.ts` 도입 검토

---

### 요약

이번 변경은 Carousel 노드에 static/dynamic 이중 모드를 추가한 기능 확장으로, 스펙-핸들러-UI 세 계층이 일관되게 갱신된 점은 긍정적이다. 핸들러는 `NodeHandler` 인터페이스를 준수하고, 유틸리티 함수 추출 및 타입 강화가 이루어졌다. 주요 아키텍처 리스크는 두 가지다: (1) 테스트 코드가 private 멤버를 직접 접근하는 구조적 결합 — 이는 이번 변경 범위를 넘어서는 기존 이슈지만 해결이 권장되고, (2) React 컴포넌트의 인덱스 기반 key — 아이템 삭제 시 DOM 상태 오염을 유발하는 실질적 버그다. static 모드에서의 방어 처리 누락은 validate-execute 선조건 결합을 강화하는 경고 수준의 구조 이슈다. 전반적으로 단일 핸들러 내 모드 분기는 현재 규모에서 적절하며, 과도한 추상화 없이 스펙을 충실히 구현했다.

### 위험도

**LOW**