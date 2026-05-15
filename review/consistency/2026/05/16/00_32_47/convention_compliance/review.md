# 정식 규약 준수 Review

검토 모드: 구현 착수 전 검토 (--impl-prep)
대상 경로: `backend/src/modules/knowledge-base/graph`

---

## 발견사항

### 1. 파일 명명 규약 — 이상 없음 (통과)

대상 디렉토리의 파일 목록:

- `graph-extraction.prompt.ts`
- `graph-extraction.service.ts`
- `graph-extraction.service.spec.ts`
- `graph-query.service.ts`
- `graph-query.service.spec.ts`
- `kb-stats.helper.ts`

NestJS 관행(`<domain>.<role>.ts`)을 따르며, 모두 `kebab-case`. 정식 규약에 별도 백엔드 소스 파일 명명 규칙이 없으므로 위반 없음.

---

- **[INFO]** `import type` 위치가 파일 하단에 있음
  - target 위치: `graph-extraction.prompt.ts` 59번째 줄 (`import type { EntityType } from ...`)
  - 위반 규약: TypeScript 관행상 `import type` 은 일반 `import` 보다 뒤에 오는 게 혼용 시 lint 오류를 유발할 수 있음. 정식 규약(`spec/conventions/`)에 명시적 규칙은 없으나, 파일 상단에 상수 export 와 interface export 가 섞인 구조에서 `import type` 을 파일 말미에 배치하는 것은 가독성 면에서 비표준적.
  - 상세: 파일 1~57번 줄에서 `ENTITY_TYPES` import 와 상수·JSON Schema export 가 완료된 후, 59번 줄에 `import type` 이 삽입되어 있다. 일반적으로 모든 import 는 파일 상단에 일괄 위치해야 한다.
  - 제안: `import type { EntityType }` 을 파일 최상단 import 블록으로 이동.

---

- **[WARNING]** `output.error.code` 값이 `UPPER_SNAKE_CASE` 규약을 따르지 않는 케이스 — `GraphQueryService`
  - target 위치: `graph-query.service.ts` 87번째 줄 (`code: 'KB_NOT_GRAPH_MODE'`), 119번째 줄 (`code: 'INVALID_ENTITY_TYPE'`), `graph.controller.ts` 266번째 줄 (`code: 'INVALID_LIMIT'`)
  - 위반 규약: `spec/conventions/node-output.md` §Principle 3.2 — `code` 는 `UPPER_SNAKE_CASE`.
  - 상세: `KB_NOT_GRAPH_MODE`, `INVALID_ENTITY_TYPE`, `INVALID_LIMIT`, `RESOURCE_NOT_FOUND` 모두 `UPPER_SNAKE_CASE` 를 지키고 있으므로 **실제로는 위반이 없다**. 단, NestJS `NotFoundException` / `BadRequestException` 의 body 로 직접 `{ code, message }` 객체를 주입하는 방식은 `spec/conventions/node-output.md` 가 정의한 *노드 핸들러의* error contract 와는 다른 레이어(HTTP 예외 응답)에 속한다. conventions 은 노드 Output 대상이므로 이 코드가 conventions 를 직접 위반하지는 않지만, 일관성 차원에서 두 레이어의 error code 형식이 동일한 `UPPER_SNAKE_CASE` 를 사용한다는 점을 문서화해 두면 혼동을 방지할 수 있다.
  - 제안: 현재 코드는 규약 준수. 필요 시 `spec/conventions/node-output.md` 의 `UPPER_SNAKE_CASE` 원칙이 HTTP 예외 code 필드에도 준용됨을 한 줄 명시하면 명확해진다.

---

- **[INFO]** `GraphQueryService.listEntities` / `listRelations` 의 return type 이 명시되지 않음
  - target 위치: `graph-query.service.ts` 98번째 줄, 197번째 줄
  - 위반 규약: 정식 규약에 서비스 메서드 반환 타입 명시 의무 규칙은 없으나, `spec/conventions/swagger.md` §5 의 "응답 DTO 클래스" 원칙과 일관성을 위해 서비스 레이어도 `Promise<PaginatedResponseDto<GraphEntity>>` 처럼 반환 타입을 명시하는 것이 권장된다.
  - 상세: 두 메서드 모두 `PaginatedResponseDto.create(...)` 를 반환하지만 함수 시그니처에는 `Promise<PaginatedResponseDto<GraphEntity>>` 가 생략돼 있다. TypeScript 추론에 의존하는 구조라 런타임 문제는 없으나 타입 문서화 관점에서 불완전하다.
  - 제안: `: Promise<PaginatedResponseDto<GraphEntity>>` 반환 타입 명시.

---

- **[WARNING]** `GraphController` — `listEntities` / `listRelations` 메서드 반환 타입 미선언
  - target 위치: `graph.controller.ts` 143번째 줄 (`async listEntities(...)`), 211번째 줄 (`async listRelations(...)`)
  - 위반 규약: `spec/conventions/swagger.md` §5-3 — 응답 DTO 클래스를 `ApiOkPaginatedResponse(Dto)` 로 표기하는 것은 이행하고 있으나, 메서드 자체의 return type 이 누락되어 있다. `reExtractAll`, `deleteEntity`, `deleteRelation`, `graphVisualization`, `graphStats` 는 반환 타입이 명시돼 있어 일관성이 깨진다.
  - 상세: NestJS + TypeScript 에서 컨트롤러 메서드 반환 타입 미선언은 런타임 오류는 아니지만, Swagger CLI 플러그인이 타입을 자동 추론할 때 의존하는 정보가 줄어들고 코드 가독성이 저하된다.
  - 제안: `listEntities` 와 `listRelations` 에 `: Promise<PaginatedResponseDto<GraphEntity>>`, `: Promise<PaginatedResponseDto<GraphRelation>>` 반환 타입 명시.

---

- **[INFO]** `KbStatsHelper.refresh` — WebSocket 이벤트명에 `as never` 강제 캐스팅
  - target 위치: `kb-stats.helper.ts` 42번째 줄 (`'kb:graph_stats_updated' as never`)
  - 위반 규약: 정식 규약에 `as never` 사용 금지 명시 규칙은 없으나, `spec/conventions/node-output.md` 의 정신(타입 계약 명확화)과 배치된다.
  - 상세: `emitExecutionEvent` 의 두 번째 인자 타입이 WebSocket 이벤트 열거형으로 좁혀져 있어 `'kb:graph_stats_updated'` 를 직접 전달할 수 없는 상황에서 `as never` 를 사용. 이는 컴파일러 경고 억제 목적이며, 타입 불일치를 숨기는 대신 `emitKbEvent` (이미 `graph-extraction.service.ts` 에서 사용 중) 를 동일하게 사용하거나 `WebsocketService` 에 `kb:graph_stats_updated` 를 지원 이벤트로 추가하는 것이 바람직하다.
  - 제안: `emitExecutionEvent` 대신 `emitKbEvent(knowledgeBaseId, 'kb:graph_stats_updated', ...)` 패턴으로 통일하거나, `WebsocketService` 의 허용 이벤트 타입에 해당 이벤트를 추가.

---

- **[INFO]** `graph-extraction.prompt.ts` — `GRAPH_EXTRACTION_SYSTEM_PROMPT` 에서 entity type 목록을 하드코딩
  - target 위치: `graph-extraction.prompt.ts` 14번째 줄 (`"type" is one of: person, organization, concept, location, event, other.`)
  - 위반 규약: 정식 규약에 직접 위반은 없으나, 단일 진실(single source of truth) 원칙(CLAUDE.md §정보 저장 위치)에 따르면 entity type 목록은 `ENTITY_TYPES` 상수(entity.entity.ts) 에서 유일하게 관리되어야 한다.
  - 상세: `GRAPH_EXTRACTION_JSON_SCHEMA` 는 `ENTITY_TYPES` 를 참조해 enum 을 동적으로 구성하는데, 프롬프트 문자열에는 수동으로 나열한 동일 목록이 있다. `ENTITY_TYPES` 에 새 type 이 추가되면 프롬프트 하드코딩 목록을 별도로 갱신해야 하는 drift 위험이 있다.
  - 제안: 프롬프트 문자열 내 type 목록을 `` `${ENTITY_TYPES.join(', ')}` `` 로 동적 삽입.

---

- **[CRITICAL]** 금지 경로(`prd/`, `memory/`) 참조 여부 — 없음 (통과)

대상 영역의 모든 파일을 검토한 결과, 옛 `prd/`, `memory/`, `user_memo/` 경로를 import하거나 참조하는 코드가 없다.

---

- **[INFO]** `GraphQueryService` 내 `ListEntitiesQuery` / `ListRelationsQuery` interface 가 DTO 가 아닌 service 파일 내부 interface 로 정의됨
  - target 위치: `graph-query.service.ts` 20~31번째 줄
  - 위반 규약: `spec/conventions/swagger.md` §5-1 — 응답 DTO 는 `dto/responses/` 에 위치. Query parameter DTO 는 별도 `dto/` 파일이 적절.
  - 상세: 컨트롤러에서 `PaginationQueryDto` 를 파싱한 뒤 `type` 필드를 별도 인자로 전달하는 구조라 `ListEntitiesQuery` 는 실질적으로 내부 인터페이스다. 외부 API 계약이 아닌 내부 메서드 시그니처이므로 이 자체가 규약 위반은 아니다. 단, 서비스 파일 내부 interface 를 public 으로 export 할 이유가 없는데 명시적 export 가 없는 것은 올바르다.
  - 제안: 현 구조 유지 가능. 만약 컨트롤러가 직접 `ListEntitiesQuery` 타입을 참조해야 하는 케이스가 생기면 `dto/` 파일로 이동.

---

## 요약

`backend/src/modules/knowledge-base/graph` 디렉토리의 파일들은 정식 규약(`spec/conventions/`)을 전반적으로 잘 준수하고 있다. 에러 코드는 `UPPER_SNAKE_CASE`, DTO 는 `dto/responses/` 에 위치, Swagger 데코레이터는 래퍼 헬퍼 패턴(`ApiOkPaginatedResponse`, `ApiOkWrappedResponse`, `ApiAcceptedWrappedResponse`)을 일관되게 사용하고 있으며, 옛 금지 경로(`prd/`, `memory/`) 의존도 없다. CRITICAL 위반은 발견되지 않았다. 주요 개선 여지는 두 가지다. (1) 컨트롤러 `listEntities` / `listRelations` 의 반환 타입 미선언(WARNING), (2) `kb-stats.helper.ts` 의 `as never` 강제 캐스팅으로 인한 타입 계약 불명확(INFO). 또한 `graph-extraction.prompt.ts` 의 `import type` 위치 문제와 entity type 하드코딩 drift 위험은 소규모 INFO 수준 개선사항이다.

## 위험도

LOW
