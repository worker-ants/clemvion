# Naming Collision Review — Cafe24 Node UX Phase 2

Checker: naming_collision
Date: 2026-05-16
Scope: New identifiers introduced by Phase 2 (code-only, no spec changes)

---

### 발견사항

- **[CRITICAL]** `Cafe24PlannedOperation` — 동일 이름이 두 파일에서 다른 shape 로 정의됨
  - target 신규 식별자: `Cafe24PlannedOperation` (backend `planned.ts` line 15) — internal catalog shape: `{ id, label, paginated? }`
  - 기존 사용처: `public-meta.ts` line 52 에서 내보내는 `PublicCafe24OperationPlanned` 와 구별되지만, `public-meta.ts` 가 `planned.ts` 의 `Cafe24PlannedOperation` 을 import 해 `PublicCafe24OperationPlanned` 로 변환한다. 문제는 frontend `types.ts` line 227 에서도 `Cafe24PlannedOperation` 이란 동일 이름을 다른 shape (`{ status: "planned"; id; label; paginated }`) 로 정의한다는 점이다.
  - 상세: backend `planned.ts` 의 `Cafe24PlannedOperation` 은 `status` 필드가 없다. backend `public-meta.ts` 의 `PublicCafe24OperationPlanned` 는 `status: 'planned'` 를 가진다. frontend `types.ts` 의 `Cafe24PlannedOperation` 은 `status: "planned"` 를 가진다 — 따라서 frontend 타입은 backend `PublicCafe24OperationPlanned` 와 일치한다. 그러나 식별자 `Cafe24PlannedOperation` 이 두 레이어에서 다른 것을 지칭한다. backend 내부에서도 `public-meta.ts` 가 `planned.ts` 에서 `Cafe24PlannedOperation` 을 import 해 사용하는데, 같은 파일이 `PublicCafe24OperationPlanned` 를 별도로 export 한다. 이름이 다르니 컴파일 오류는 없지만, "planned operation" 개념을 지칭하는 이름이 3개 존재하는 혼란 상황이다: `Cafe24PlannedOperation` (internal, no status), `PublicCafe24OperationPlanned` (public backend, has status), `Cafe24PlannedOperation` (frontend, has status). 동일 식별자가 레이어별로 다른 shape 를 뜻하는 것은 사용자 혼선을 유발한다.
  - 제안: backend `planned.ts` 의 내부 타입을 `Cafe24PlannedOperationMeta` 또는 `Cafe24PlannedOperationEntry` 로 변경해 frontend 의 `Cafe24PlannedOperation` (= public wire shape) 과 명확히 구분한다. 또는 `PublicCafe24OperationPlanned` 를 frontend 미러 타입명과 일치시켜 `Cafe24PlannedOperation` 으로 통일하고, backend internal 타입에 다른 이름을 부여한다.

- **[WARNING]** `Cafe24FieldType` — backend 와 frontend 에서 동일 이름·동일 값·다른 파일로 중복 정의
  - target 신규 식별자: `Cafe24FieldType` (frontend `types.ts` line 196)
  - 기존 사용처: backend `backend/src/nodes/integration/cafe24/metadata/types.ts` line 10 에서 이미 동일 이름·동일 리터럴 유니온으로 정의됨.
  - 상세: 값과 의미는 완전히 동일하다 (`'string' | 'number' | 'boolean' | 'array' | 'object' | 'enum'`). frontend 가 backend 를 import 하지 않으므로 런타임 충돌은 없다. 그러나 미래에 backend 쪽에 `'date'` 등 새 타입이 추가될 경우 frontend 정의가 자동 동기화되지 않아 조용한 drift 가 발생할 수 있다. 현재 이미 spec `cafe24-api-metadata.md` 가 SSOT 인데, 코드에 두 개의 별도 정의가 생겼다.
  - 제안: 현 구조 (frontend never imports backend) 를 유지한다면, 두 파일에 "이 타입은 `spec/conventions/cafe24-api-metadata.md` §FieldType 과 반드시 동기화해야 한다" 는 JSDoc 을 추가한다. 혹은 shared package (`@workflow/types`) 를 두어 단일 정의로 통합한다 (장기 옵션).

- **[WARNING]** `Cafe24FieldLocation` — `Cafe24FieldType` 과 동일한 중복 패턴
  - target 신규 식별자: `Cafe24FieldLocation` (frontend `types.ts` line 204)
  - 기존 사용처: backend `backend/src/nodes/integration/cafe24/metadata/types.ts` line 18 에서 동일 이름·동일 리터럴 유니온 (`'path' | 'query' | 'body'`).
  - 상세: `Cafe24FieldType` 항목과 동일한 drift 위험. 값이 동일하므로 현재는 무해하나, 한쪽 변경이 다른 쪽에 자동 반영되지 않는다.
  - 제안: `Cafe24FieldType` 과 함께 처리. JSDoc 동기화 주석 추가 또는 shared package 통합.

- **[INFO]** `extras` 필드 — `NodeDefinitionDto`, `NodeDefinitionView`, `NodeComponent` 에 추가됨; `NodeDto`(`node-response.dto.ts`) 와 혼동 가능
  - target 신규 식별자: `extras?` on `NodeDefinitionDto` (line 123), `NodeDefinitionView` (line 30), `NodeComponent` interface (line 306), `NodeDefinition` frontend (line 257)
  - 기존 사용처: `NodeDto` (같은 `node-response.dto.ts` 내, 워크플로우 인스턴스 노드 응답) 에는 `extras` 필드가 없다. 별개 DTO 이므로 직접 충돌은 아니다. 프론트엔드 `custom-node.test.tsx` line 52 의 `extras` 는 테스트 헬퍼 파라미터 이름이며 `NodeDefinition.extras` 와 다른 문맥이다.
  - 상세: 현재 `extras` 를 가진 타입은 정의(definition)-경로(`NodeComponent` → `NodeDefinitionView` → `NodeDefinitionDto` → `NodeDefinition`) 에만 한정되어 있다. 인스턴스 경로(`NodeDto`, `CreateNodeDto`, `UpdateNodeDto`) 에는 없다. 현재 상태는 일관적이다.
  - 제안: `extras` 가 definition-only 임을 명확히 하는 네이밍 또는 JSDoc 한 줄로 유지하면 충분하다. 현재 JSDoc 이 이미 그 역할을 한다. 추가 조치 불필요.

- **[INFO]** `CAFE24_PLANNED_BY_RESOURCE` — `CAFE24_OPERATIONS_BY_RESOURCE` 와 병렬 상수; 명명 패턴은 일관적이나 등록 위치가 다름
  - target 신규 식별자: `CAFE24_PLANNED_BY_RESOURCE` (`planned.ts` line 21)
  - 기존 사용처: `CAFE24_OPERATIONS_BY_RESOURCE` 는 `metadata/index.ts` line 34 에 정의됨. 두 상수는 다른 파일에 위치한다.
  - 상세: `CAFE24_OPERATIONS_BY_RESOURCE` 는 `index.ts` (re-export hub)에, `CAFE24_PLANNED_BY_RESOURCE` 는 `planned.ts` 에 있다. 직접 충돌은 없으나, `index.ts` 가 `planned.ts` 를 re-export 하지 않으면 소비자가 `planned.ts` 를 직접 import 해야 한다. `public-meta.ts` 는 `planned.ts` 를 직접 import 하고 있어 현재는 동작한다.
  - 제안: 일관성을 위해 `CAFE24_PLANNED_BY_RESOURCE` 를 `metadata/index.ts` 에서 re-export 하는 것을 고려한다 (선택 사항).

---

### 요약

Phase 2 신규 식별자 중 런타임·컴파일 오류로 이어질 즉각적인 충돌은 없다. 그러나 `Cafe24PlannedOperation` 이 backend internal(`planned.ts`, `status` 없음)과 frontend(`types.ts`, `status: "planned"`) 에서 동일 이름으로 다른 shape 를 지칭하는 CRITICAL 혼선이 존재한다. backend `public-meta.ts` 는 이 둘의 중간에서 `PublicCafe24OperationPlanned` 라는 세 번째 이름을 도입해 변환 책임을 지지만, 결과적으로 동일 개념을 가리키는 이름이 세 가지가 되었다. `Cafe24FieldType`·`Cafe24FieldLocation` 은 값은 동일하나 frontend/backend 양쪽에 중복 정의되어 미래 drift 위험이 있다(WARNING). `extras` 필드는 definition 경로에만 일관되게 적용되었고 인스턴스 DTO 와의 충돌 없이 깔끔하게 격리되어 있다(INFO).

### 위험도

MEDIUM
