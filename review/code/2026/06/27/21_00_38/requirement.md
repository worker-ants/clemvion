# 요구사항(Requirement) Review

## 발견사항

관련 spec 을 확인하여 line-level 대조를 수행했다:
- `/Volumes/project/private/clemvion/.claude/worktrees/swagger-passthrough-crossref/spec/conventions/swagger.md` (§5-2 표, §2-5, §5 Rationale)
- `/Volumes/project/private/clemvion/.claude/worktrees/swagger-passthrough-crossref/spec/5-system/2-api-convention.md` (§5.2)
- `/Volumes/project/private/clemvion/.claude/worktrees/swagger-passthrough-crossref/codebase/backend/src/common/dto/paginated-response.dto.ts` (PaginationMeta, PaginatedResponseDto)

CRITICAL/WARNING 발견사항 없음.

- **[INFO]** drift-guard 테스트의 `as` 타입 단언이 런타임 null-guard 를 우회
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/swagger-passthrough-crossref/codebase/backend/src/common/swagger/api-wrapped.spec.ts` L193–196 (`pagination` 단언)
  - 상세: `wrapPaginatedSchema(SampleDto).properties?.pagination as { properties: Record<string, unknown>; required: string[] }` 형태로 강타입 단언을 사용한다. `wrapPaginatedSchema` 의 반환 리터럴이 항상 완전한 `pagination` 객체를 갖는 한 문제가 없지만, `properties?.pagination` 가 `undefined` 일 경우 `Object.keys(undefined)` 는 런타임 오류를 발생시킨다. 테스트 코드이고 실제로 `undefined` 가 될 수 없는 경로이므로 심각도는 낮다. 기능 결함이 아닌 방어 코딩 선택의 문제.
  - 제안: `const pagination = schema.properties?.pagination; if (!pagination) throw new Error('pagination property missing');` 등 명시적 null-guard 로 보강하거나 (`!`) non-null assertion 사용을 고려할 수 있다. 현행 수준도 실용적으로 허용 범위.

- **[INFO]** drift-guard `required` 단언은 모든 PaginationMeta 필드가 required 임을 암묵적으로 가정
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/swagger-passthrough-crossref/codebase/backend/src/common/swagger/api-wrapped.spec.ts` L198 (`[...pagination.required].sort()`)
  - 상세: 테스트는 스키마 `required` 배열이 런타임 pagination 키 전체와 일치해야 한다고 단언한다. 향후 `PaginationMeta` 에 선택적(optional) 필드가 추가될 경우 런타임 키는 늘어나지만 스키마 `required` 는 늘어나지 않아 테스트가 실패하게 된다. 이는 의도된 drift 검지 — optional 필드 추가도 스키마 갱신을 강제한다 — 이므로 설계상 합리적이다. 단, 개발자가 "optional 필드를 추가했는데 왜 테스트가 깨지나" 를 이해하려면 NOTE/주석에 "모든 필드가 스키마 required 로 동기화되어야 한다" 는 의도를 명시해 두면 좋다. 현행 코드는 주석이 "키 대조" 수준에 그친다.
  - 제안: 테스트 주석에 "required 배열도 전체 키와 동일해야 한다 — PaginationMeta 는 optional 필드를 허용하지 않는 정책" 한 줄 추가 (선택).

## 상세 항목별 점검

### 1. 기능 완전성

**`api-wrapped.spec.ts` 변경:**
- `wrapItemsSchema` 테스트에 `schema.type`·`schema.required` 단언 추가: 구현 반환값 `{ type: 'object', required: ['data'], properties: { data: { type: 'array', ... } } }` 와 정확히 일치. 4헬퍼 테스트 패리티 완성.
- drift-guard 테스트 신규 추가: `PaginatedResponseDto.create([], 0, 1, 1)` 으로 런타임 pagination 키를 획득 후 스키마 리터럴 `properties` 키·`required` 배열 양쪽과 대조. RESOLUTION 에서 요구한 drift-guard 기능을 완전히 구현.

**`api-wrapped.ts` 변경 (JSDoc NOTE 추가):**
- 기능 변경 없음. NOTE 가 테스트 이름("pagination keys stay in sync with PaginatedResponseDto runtime shape")을 정확히 명시 — 테스트 파일과 크로스레퍼런스 완전.

### 2. 엣지 케이스

- `PaginatedResponseDto.create([], 0, 1, 1)`: `create(data, totalItems, page, limit)` 시그니처 상 `totalItems=0, page=1, limit=1`, `totalPages=Math.ceil(0/1)=0`. 테스트는 키만 검사하므로 값은 무관 — 정확.
- `.sort()` 호출로 키 순서 독립성 확보 — 올바른 비교 방식.
- `[...pagination.required].sort()`: 원본 배열 변경 없이 복사본 정렬 — 불변성 유지.

### 3. TODO/FIXME

신규 코드에 TODO, FIXME, HACK, XXX 주석 없음.

### 4. 의도와 구현 간 괴리

- 테스트 케이스 이름 "wrapPaginatedSchema pagination keys stay in sync with PaginatedResponseDto runtime shape" 와 실제 로직(런타임 키 ↔ 스키마 키 대조) 일치.
- JSDoc NOTE 참조 테스트 이름이 실제 `it()` 문자열과 정확히 일치.
- `wrapItemsSchema` 테스트 설명 "builds { data: array($ref) }" 와 단언 내용 일치.

### 5. 에러 시나리오

변경 범위 내 새 에러 경로 없음. 테스트 코드 전용 변경.

### 6. 데이터 유효성

테스트 코드 — 출력 shape 검증. 프로덕션 입력 유효성 검증 대상 아님.

### 7. 비즈니스 로직 / spec fidelity

| 구현 | spec 근거 | 일치 여부 |
|------|-----------|-----------|
| drift-guard 가 비교하는 pagination 필드 4개(page·limit·totalItems·totalPages) | `PaginationMeta` 클래스 필드 + `swagger.md §5-2` 표 | 일치 |
| `wrapItemsSchema` 반환 `{ type:'object', required:['data'], data:array }` | `swagger.md §5-2` `ApiOkWrappedArrayResponse → { data: <Dto>[] }` | 일치 |
| `wrapPaginatedSchema` 스키마 리터럴 4필드 | `PaginationMeta` `@ApiProperty example`(1, 20, 123, 7) | 일치 |
| NOTE 참조 테스트명 | `api-wrapped.spec.ts` `it(...)` 문자열 | 정확 일치 |

`swagger.md §5 Rationale` 및 `spec/5-system/2-api-convention.md §5.2` 모두 single-wrap(`data`·`pagination` top-level)을 명시하며 구현과 일치. SPEC-DRIFT 없음.

### 8. 반환값

변경 범위 내 프로덕션 함수 로직 무변경. 모든 경로에서 `SchemaObject` 반환.

### 9. spec fidelity 종합

- `swagger.md §5-2` 헬퍼 표 + `§2-5` pass-through + `§Rationale §5` single-wrap SoT 와 코드 구현이 line-level 로 일치.
- `spec/5-system/2-api-convention.md §5.2` 신규 cross-ref 블록쿼트(이전 세션 커밋)와 JSDoc NOTE 내용이 정합.
- SPEC-DRIFT 없음. CRITICAL/WARNING 없음.

## 요약

이번 변경(fresh review 대상)은 이전 ai-review RESOLUTION 에 따른 두 가지 코드 조치 — drift-guard 테스트 추가(`api-wrapped.spec.ts`)와 JSDoc NOTE 보강(`api-wrapped.ts`) — 를 완전히 구현했다. drift-guard 테스트는 `PaginatedResponseDto.create()` 런타임 pagination 키를 `wrapPaginatedSchema` 스키마 리터럴의 `properties` 키·`required` 배열과 양방향 대조하여 PaginationMeta 필드 변경 시 한쪽만 고치면 테스트가 깨지는 구조를 만든다. `wrapItemsSchema` 테스트에 추가된 `type`·`required` 단언도 구현 반환값과 정확히 일치하며, 4헬퍼 테스트 패리티를 완성한다. 관련 spec(`swagger.md §5-2`·`§Rationale §5`, `api-convention §5.2`)과의 line-level 불일치 없음. 발견사항은 모두 INFO 등급(type 단언 방어 코딩, required 가정 주석 보강)이며 차단 사항 없음.

## 위험도

NONE
