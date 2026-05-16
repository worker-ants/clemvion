# Convention Compliance Review — Cafe24 Node UX Phase 2

**대상 PR**: Cafe24 node UX overhaul Phase 2 (backend + frontend impl)
**검토 일시**: 2026-05-16
**검토자**: convention-compliance sub-agent

---

## 발견사항

### **[WARNING]** `cafe24.component.ts` 의 상대경로 import 에 `.js` 확장자 누락

- **target 위치**: `backend/src/nodes/integration/cafe24/cafe24.component.ts` — 1~9행
- **위반 규약**: `spec/conventions/cafe24-api-metadata.md` §1 및 프로젝트 tsconfig (`"module": "nodenext"`, `"moduleResolution": "nodenext"`) — nodenext 모드에서는 상대경로 `.ts` 파일을 `.js` 확장자로 import 해야 런타임 ESM 해석이 정확하다.
- **상세**: `cafe24.component.ts` 의 다음 import 들은 `.js` 확장자가 없다.
  ```
  import { Cafe24Handler } from './cafe24.handler';
  import { NodeComponent } from '../../core/node-component.interface';
  import { ... } from './cafe24.schema';
  import { buildCafe24Extras } from './metadata/public-meta';
  ```
  동일 패키지의 `cafe24.handler.ts`, `cafe24.schema.ts`, `cafe24.schema.ts` 내 다른 파일들, 그리고 새로 추가된 `public-meta.ts` / `planned.ts` / `catalog-sync.spec.ts` / `public-meta.spec.ts` 내 상대경로 import 는 일관되게 `.js` 를 붙이고 있다. `cafe24.component.ts` 만 누락됐다. 기존 파일에서 물려받은 패턴이지만, 신규 파일과 불일치가 확대된다.
- **제안**: `cafe24.component.ts` 의 네 곳 상대경로 import 에 `.js` 확장자를 추가한다. 단, 이 파일은 이번 PR 에서 일부만 변경됐으므로 `cafe24.schema.ts` 등 같은 디렉토리 파일 전체를 함께 정리하는 것이 이상적이다. 규약을 별도 spec 으로 명문화하려면 `spec/conventions/` 에 TypeScript ESM import 규칙 문서를 추가하는 것을 권장한다.

---

### **[WARNING]** `NodeDefinitionDto.extras` 필드의 Swagger 타입이 실제 shape 와 불일치

- **target 위치**: `backend/src/modules/nodes/dto/responses/node-response.dto.ts` — 116~123행
- **위반 규약**: `spec/conventions/swagger.md` §5-1 ("엔티티를 그대로 노출하지 말고 API 응답 형태에 맞춰 별도 DTO 를 만듭니다"), §1-4 ("dynamic: `@ApiProperty({ type: 'object', additionalProperties: true })`")
- **상세**: `extras` 는 `@ApiPropertyOptional({ type: 'object', additionalProperties: true })` 로 선언됐다. Swagger 규약상 dynamic/union 타입에는 이 패턴이 허용된다. 그러나 JSDoc 주석에 "shape 는 노드 타입별로 다르므로 unknown" 이라고 기술하면서 TypeScript 타입은 `Record<string, unknown>` 으로 선언돼 있다. 실제 런타임 값은 `PublicCafe24Extras` (두 개의 nested Record) 이며, 런타임 구조를 완전히 숨기는 것은 Swagger 문서 소비자 입장에서 자기설명성이 떨어진다.
- **제안**: `additionalProperties: true` 를 유지하되, JSDoc 에 "cafe24 node 의 경우 `operationsByResource` / `plannedByResource` 두 키를 가지는 객체" 임을 명시하거나, `cafe24` 전용 응답 DTO(예: `NodeDefinitionWithCafe24ExtrasDto`)를 별도로 만들고 `ApiExtraModels` 로 등록하는 방안을 검토한다. 단, shape 가 노드 타입별로 다양하므로 현행 `unknown` 처리도 설계상 정당하다면 규약 문서에 "동적 shape DTO 예외 케이스" 로 명시적으로 기술해 향후 같은 의문이 반복되지 않도록 한다.

---

### **[INFO]** `planned.ts` 의 `Cafe24PlannedOperation` interface — `scopeType` / `responseShape` 필드 없음

- **target 위치**: `backend/src/nodes/integration/cafe24/metadata/planned.ts` — 15~19행
- **위반 규약**: `spec/conventions/cafe24-api-metadata.md` §2 (`Cafe24OperationMetadata` 형식) — 완전한 metadata 행에는 `scopeType`, `method`, `path` 등이 포함돼야 한다.
- **상세**: `Cafe24PlannedOperation` 은 `{ id, label, paginated? }` 만 가진다. 이는 의도적 subset 이다 — 아직 구현되지 않은 operation 에는 `method` / `path` / `scopeType` 이 결정되지 않을 수 있다. `catalog-sync.spec.ts` 의 §7 테스트도 `planned` row 에는 `method/path/scope` 의 구체화를 요구하지 않는다. 따라서 규약을 *직접* 위반하지는 않지만, `cafe24-api-metadata.md` §2 에 나열된 형식이 `supported` 전용임을 명시하는 설명이 없어 혼동 가능성이 있다.
- **제안**: `spec/conventions/cafe24-api-metadata.md` §2 에 "아래 형식은 `status: supported` 행에 적용된다. `status: planned` 행에는 `id` / `label` / `paginated?` 만 필수이며, 나머지 필드는 구현 시 추가한다" 는 주석을 한 줄 추가한다. 코드 변경은 불필요하다.

---

### **[INFO]** `NodeDefinitionDto` 에서 `NodeCategoryMeta` 필드 `id` 이름이 `NodeCategoryDto.category` 와 불일치

- **target 위치**: `backend/src/modules/nodes/dto/responses/node-response.dto.ts` — 127~143행 (`NodeCategoryDto`)
- **위반 규약**: `spec/conventions/swagger.md` §1-1 (한국어 JSDoc + 일관된 필드명)
- **상세**: `NodeCategoryDto` 가 `category: NodeCategory` 필드를 갖는 반면, frontend 의 `NodeCategoryMeta` 타입은 `id: NodeCategory` 를 사용한다. 동일 개념에 `category` (backend DTO) vs `id` (frontend type) 두 이름이 쓰여 직렬화 경계에서 혼동 가능성이 있다. 이번 PR 이 이 필드를 변경한 것은 아니나, `NodeCategoryMeta` 가 이번 PR 에서 frontend 타입에 명시적으로 참조된 시점에서 drift 가 관찰된다.
- **제안**: backend `NodeCategoryDto.category` 를 `id` 로 통일하거나, frontend `NodeCategoryMeta.id` 를 `category` 로 바꾸거나 — 둘 중 하나로 정렬한다. `normalizeResponse` 에서 `raw.categories` 를 그대로 `categories` 에 설정하므로, 현재는 API 응답 JSON key 가 `category` 이면 frontend store 에서 `meta.id` 로 접근할 때 `undefined` 가 된다. 런타임 버그 가능성이 있으나 이번 PR 의 신규 변경 범위 외이므로 INFO 로 분류한다. 별도 이슈로 추적 권장.

---

### **[INFO]** `PublicCafe24Extras` 형식이 `spec/conventions/cafe24-api-metadata.md` 에 미등재

- **target 위치**: `backend/src/nodes/integration/cafe24/metadata/public-meta.ts` — 63~72행
- **위반 규약**: `spec/conventions/cafe24-api-metadata.md` 전반 — 새로운 public 타입을 도입했으나 해당 컨벤션 문서에 언급 없음
- **상세**: `PublicCafe24Extras`, `PublicCafe24Operation`, `PublicCafe24Field`, `PublicCafe24OperationSupported`, `PublicCafe24OperationPlanned` 등 5개의 신규 공개 인터페이스가 추가됐다. 이 타입들은 frontend 계약의 일부이며, `cafe24-api-metadata.md` §2 의 `Cafe24OperationMetadata` 와 구분되어야 한다. 현재 해당 컨벤션 문서에 이 public shape 에 대한 설명이 없으므로, 다른 개발자가 frontend 계약을 변경할 때 컨벤션 문서만 보고는 `public-meta.ts` 의 존재를 알 수 없다.
- **제안**: `spec/conventions/cafe24-api-metadata.md` 에 §8 또는 §9 를 추가해 "frontend payload shape (`PublicCafe24Extras`)" 항목을 기술한다. 또는 `spec/4-nodes/4-integration/4-cafe24.md` §9.3 에 이미 언급이 있다면 cross-reference 를 추가한다. 코드 변경은 불필요하다.

---

## 적합성 확인 항목 (이슈 없음)

다음 항목은 규약을 올바르게 준수하고 있다.

1. **카탈로그 우선 절차 (cafe24-api-metadata.md §4)**: `planned.ts` 추가는 spec catalog 파일에 `status: planned` 행이 먼저 존재하는 것을 전제로 동작하며, `catalog-sync.spec.ts` 의 양방향 동기 테스트가 이를 강제한다. 절차 준수 확인됨.

2. **Node Output shape 불변 (node-output.md Principle 0)**: Phase 2 는 metadata payload 전달 전용이며 핸들러 `output` shape 변경 없음. `cafe24.component.ts` 의 `outputSchema` 는 기존 `cafe24NodeOutputSchema` 를 그대로 사용한다. 위반 없음.

3. **Swagger DTO 위치 및 JSDoc (swagger.md §5-1, §1-1)**: `node-response.dto.ts` 가 `dto/responses/` 에 위치하며, 모든 필드에 한국어 JSDoc 주석과 적절한 `@ApiProperty` / `@ApiPropertyOptional` 데코레이터가 있다. `additionalProperties: true` 사용 패턴도 §1-4 에 부합한다.

4. **TS 명명 규칙**: `PublicCafe24Operation`, `PublicCafe24Field`, `buildCafe24Extras`, `toPublicSupportedOperation`, `Cafe24PlannedOperation`, `CAFE24_PLANNED_BY_RESOURCE` 등 모두 프로젝트의 PascalCase(인터페이스/타입) / camelCase(함수) / SCREAMING_SNAKE_CASE(상수) 규약을 준수한다.

5. **테스트 파일 명명**: `public-meta.spec.ts`, `catalog-sync.spec.ts` 는 backend 규약(`*.spec.ts`)을 준수한다. frontend 변경 파일에는 새 테스트 파일이 없으나, 변경 범위(타입 추가 + store propagation)가 런타임 로직 변경이 아닌 타입 및 매핑이므로 WARNING 수준은 아니다.

6. **금지 항목 (claude -p, SDK 직접 호출, prd/memory/user_memo 경로)**: 변경된 파일 전체에서 금지 패턴 미발견.

7. **extras 전파 (node-component.registry.ts → NodeDefinitionView → frontend store)**: `extras?: () => unknown` (interface) → `extras?.()` (registry) → `extras?: Record<string, unknown>` (DTO) → `extras: raw.extras` (normalizeResponse) 경로가 일관되게 연결되어 있다. 타입 안전성은 `unknown` 에서 `Record<string, unknown>` 으로의 암묵적 cast 가 한 군데 있으나, 런타임에는 serialize 된 JSON 이므로 실질적 문제없음.

---

## 요약

Phase 2 구현은 전반적으로 프로젝트 정식 규약을 잘 준수하고 있다. CRITICAL 위반은 없다. 주요 주의사항은 두 가지다. 첫째, `cafe24.component.ts` 가 nodenext ESM 모드에서 요구하는 `.js` 확장자를 상대경로 import 에 붙이지 않아, 신규 추가된 `public-meta.ts` / `planned.ts` 등과 불일치한다(WARNING). 둘째, `NodeDefinitionDto.extras` 의 Swagger 표현이 `additionalProperties: true` 로만 처리돼 실제 cafe24 payload shape 가 Swagger 문서에서 자기설명적이지 않다(WARNING). 두 INFO 항목은 규약 문서에 해설이 부족한 부분으로, 코드 변경 없이 spec 문서 보완으로 해소 가능하다.

---

## 위험도

**LOW**

CRITICAL 위반 없음. WARNING 2건은 코드 동작에 영향을 주지 않으나(ESM 해석은 NestJS 빌드 파이프라인이 처리, Swagger는 문서 정확성 문제) 규약 정합성 관점에서 후속 정리를 권장한다.
