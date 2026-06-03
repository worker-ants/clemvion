# 정식 규약 준수 검토 결과

**대상 문서**: `spec/4-nodes/4-integration/5-makeshop.md`
**검토 모드**: spec draft 검토 (--spec)
**검토일**: 2026-06-03

---

## 발견사항

### [WARNING] frontmatter `status` 값이 유효 enum 밖의 값 (`planned`)

- **target 위치**: 문서 최상단 frontmatter `status: planned`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §3` — `status` 허용 값은 `backlog` / `spec-only` / `partial` / `implemented` / `archived` 의 5종
- **상세**: `planned` 는 spec-impl-evidence 가 정의한 status enum 에 없는 값이다. `spec-frontmatter.test.ts` 가드는 이 파일을 `spec/4-nodes/**.md` 에 속하는 의무 대상으로 보고 status 를 검증한다. 현재 값은 enum 정의를 위반하며 build fail 대상이다.
- **제안**: 본 노드는 구현 의도가 결정됐으나 아직 코드가 없으므로 `status: spec-only` 가 적합하다. `code: []` 로 설정하면 90일 TTL 가드가 적용된다. 구현 plan(`plan/in-progress/makeshop-integration.md`)이 이미 존재하므로 `pending_plans:` 에 등록해 `spec-only` → `partial` 전이 준비도 함께 할 수 있다. (또는 구현 착수 전 장기 로드맵 성격이면 `backlog` 로 시작 후 plan 작성 시 `spec-only` 승격.)

---

### [WARNING] frontmatter `code:` 필드 누락

- **target 위치**: 문서 frontmatter — `id`, `status` 만 있고 `code:` 없음
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — `id`, `status` 는 의무; `code:` 는 `status ∈ {partial, implemented}` 시 ≥1 파일 매치 의무. `spec-only`/`backlog` 일 때도 필드 자체는 관례적으로 선언 (빈 배열 허용)
- **상세**: 현재 frontmatter 에 `code:` 키가 아예 없다. status 값이 `spec-only` 로 수정되더라도 `code:` 필드 선언 자체가 없으면 `spec-code-paths.test.ts` 가드가 파싱 오류로 처리할 수 있다. 최소한 `code: []` 를 명시해야 한다.
- **제안**: frontmatter 에 `code: []` 추가.

---

### [INFO] §5.3 (에러 케이스) 출력 JSON 예시 누락

- **target 위치**: `## 5. 출력 구조` — `### 5.3 Case: API 에러 또는 Transport 실패 (port error)`
- **위반 규약**: `spec/conventions/node-output.md Principle 11` — 각 노드 문서의 "Output" 섹션은 Case별로 JSON 예시 블록을 포함해야 한다
- **상세**: `§5.1` 은 JSON 예시 + 필드 표가 완비돼 있으나 `§5.3` 은 산문 설명으로만 구성되고 JSON 예시 블록이 없다. Principle 11 은 성공/에러/재개 Case 각각 JSON 블록을 요구한다.
- **제안**: `§5.3` 에 `output.error.{code, message, details}` + `output.response` (서버 응답 body 보존) 구조를 JSON 예시 블록으로 추가한다. `details` 에 `shopUid`·`resource`·`operation` 포함 구조도 예시에 반영한다.

---

### [INFO] §4 실행 로직 단계 번호가 Integration 공통 §4 6단계 계약을 초과

- **target 위치**: `## 4. 실행 로직` — 단계 1~12 (12단계)
- **위반 규약**: `./0-common.md#4-handler-실행-세멘틱` 의 6단계 계약 참조 (target 문서 스스로 "6단계 계약을 따른다"고 선언)
- **상세**: 본 문서는 첫 줄에서 "6단계 계약을 따른다"고 선언하지만 실제 단계는 1~12로 12개다. 공통 계약의 단계 번호와 본 문서 단계 번호 간 대응 관계가 명시되지 않아 독자(또는 구현자)가 어느 단계가 공통 계약의 어느 단계에 해당하는지 유추해야 한다. Cafe24 §4 구조와도 일치 여부를 확인할 수 없다.
- **제안**: "6단계 계약의 각 단계를 다음 12 세부 단계로 전개한다" 와 같이 공통 계약 → 세부 단계 매핑을 명시하거나, 단계 도입부 문구를 "공통 계약 기반 세부 실행 흐름" 으로 수정한다. 오해를 유발하는 "6단계 계약을 따른다" 와 12 단계 목록의 불일치를 해소해야 한다.

---

### [INFO] §8.1 도구 이름 매핑 표의 `resource='cart'` 오기

- **target 위치**: `### 8.1 도구 이름 매핑` 표 2번째 행
- **위반 규약**: `spec/conventions/makeshop-api-metadata.md §1` (resource enum: `shop`, `product`, `order`, `member`, `benefit`, `board`, `cpik`), `spec/conventions/makeshop-api-catalog/_overview.md §3` (operationId 예시: `post-cart-create` 는 `cpik` 섹션)
- **상세**: 표 2행에 `resource='cart'(cpik)` 라고 적혀 있으나 `cart` 는 유효한 resource enum 값이 아니다. 올바른 resource 는 `cpik` 이다. `post-cart-create` 는 CPIK 섹션의 operationId 이므로 `resource='cpik'` 여야 한다. 괄호 안에 `(cpik)` 라고 부연했으나 실제 값이 `'cart'` 로 적힌 것은 오기다.
- **제안**: `resource='cart'(cpik)` → `resource='cpik'`, `operation='post-cart-create'` 로 수정.

---

### [INFO] §2 설정 UI 에서 `planned` 행 표기 정책이 현재 catalog 상태와 불일치

- **target 위치**: `## 2. 설정 UI` — "Operation 후보: catalog 의 `planned` 행 표기 정책은 Cafe24 §2 동일"
- **위반 규약**: `spec/conventions/makeshop-api-catalog/_overview.md` (주의 — cafe24 와 달리 `status`/`planned` 컬럼이 없음, 순수 레퍼런스)
- **상세**: MakeShop API Catalog 는 현재 `status` 컬럼이 없어 `planned`/`supported` 구분이 없다. (`_overview.md` 에 명시: "status/paginated/restricted 컬럼 없이 순수 외부 API 레퍼런스로 시작"). 따라서 "catalog 의 `planned` 행 표기 정책" 을 참조하는 본 문장은 현재 시점에서 적용 불가 상태다. 독자가 catalog 에서 `planned` 행을 찾으려 하면 혼란이 생긴다.
- **제안**: "(구현 착수 시 catalog 에 status 컬럼 도입 후 적용 — 현재 catalog 은 status 컬럼 미보유)" 라는 주석을 추가하거나, Cafe24 §2 와의 차이점으로 명시한다.

---

## 요약

`spec/4-nodes/4-integration/5-makeshop.md` 는 전체적으로 node-output.md Principle 체계(5필드 invariant, config echo, 에러 코드 UPPER_SNAKE_CASE 등)와 error-codes.md 의미 기반 명명 원칙을 충실히 준수하고, makeshop-api-metadata.md 및 makeshop-api-catalog 규약과도 정합한다. 그러나 frontmatter `status` 값이 spec-impl-evidence.md 가 정의한 5종 enum 밖의 `planned` 를 사용하고 있어 build-time 가드 (`spec-frontmatter.test.ts`) 위반이 예상된다. `code:` 필드도 누락돼 있다. 이 두 항목은 다른 시스템(빌드 가드)의 invariant 를 직접 깨므로 수정이 필요하다. 나머지 발견사항(§5.3 JSON 예시 누락, 단계 수 불일치 표현, 도구 이름 매핑 오기, catalog planned 정책 주석)은 문서 명확성과 일관성 차원의 INFO 수준이다.

## 위험도

MEDIUM
