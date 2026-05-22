# 정식 규약 준수 검토 결과

**검토 대상**: `spec/conventions/cafe24-api-metadata.md`
**검토 모드**: 구현 착수 전 (--impl-prep), scope=spec/conventions/cafe24-api-metadata.md
**변경 요약**: `Cafe24OperationMetadata.constraints?: Cafe24FieldConstraint[]` 신설 (kind 3종: `oneOf` / `allOrNone` / `implies`)

---

## 발견사항

### [WARNING] `Cafe24McpBridge` vs `Cafe24McpToolProvider` 이름 혼용
- **target 위치**: §2 "constraints 의 의미" 내 "노드 핸들러 / MCP execute 시 runtime 검증" 단락 및 예시 주석 (`Cafe24McpToolProvider.buildTools`), §7 pseudo-code (`Cafe24McpBridge.listTools()`), §5.3 (`Cafe24McpBridge.listTools()`)
- **위반 규약**: `spec/conventions/cafe24-api-metadata.md` 자체 컨벤션 — §7 제목이 "MCP Bridge 와의 매핑"이며 `Cafe24McpBridge`를 canonical class 명으로 사용해왔음. 신규 추가 단락은 `Cafe24McpToolProvider` 라는 다른 이름을 사용.
- **상세**: §2 에 새로 추가된 "constraints 의 의미" 단락은 `Cafe24McpToolProvider.buildJsonSchema()`, `Cafe24McpToolProvider.execute()`, `Cafe24McpToolProvider.buildTools` 를 사용하지만, §5.3, §7 기존 텍스트와 §7 pseudo-code 주석(`constraintToSuffixLine`)은 `Cafe24McpBridge`를 사용한다. 예시 MCP tool description 주석도 `Cafe24McpToolProvider.buildTools` 를 쓴다. 동일 문서 안에서 같은 컴포넌트를 두 가지 이름으로 지칭하면 구현자가 혼란을 겪는다.
- **제안**: 두 이름이 동일 class 라면 §2 신규 단락의 `Cafe24McpToolProvider` 를 기존 canonical 명 `Cafe24McpBridge` 로 통일. 또는 두 이름이 실제로 다른 class 라면 §7 에 레이어 구분 설명을 추가하고 각각의 역할을 명시한다. 어느 쪽이든 본 컨벤션 문서 내에서는 단일 이름을 사용해야 한다.

---

### [WARNING] §6 step 7 bullet 위치가 `metadata.spec.ts` 검증임에도 `catalog-sync.spec.ts` 목록에 혼재
- **target 위치**: §6 "신규 endpoint 추가 절차" step 7 목록, 새로 추가된 bullet: `` `constraints[*]` 가 참조하는 모든 필드명이 `fields` 키 부분집합인지 (§2 의 `constraints` invariant 참고) ``
- **위반 규약**: `spec/conventions/cafe24-api-metadata.md` §2 invariant 설명 — "**invariant** — `metadata.spec.ts` 가 검증"이라고 명시. 반면 step 7 의 앞뒤 bullet 들은 `catalog-sync.spec.ts` 가 담당하는 항목이다 (양방향 동기, restricted 컬럼 동기 등).
- **상세**: 새 bullet 은 `catalog-sync.spec.ts` 관련 bullet 들 사이에 삽입되어 있어, 독자가 `constraints` 필드 검증도 `catalog-sync.spec.ts` 가 담당하는 것으로 오해할 수 있다. `(§2 의 constraints invariant 참고)` 주석이 단서를 주지만 명시적으로 테스트 파일을 구분하지 않는다.
- **제안**: 해당 bullet 뒤에 `(metadata.spec.ts 담당 — catalog-sync.spec.ts 의 검증 대상 아님)` 을 괄호 안에 추가하거나, 또는 `requiredFields` / `path placeholder` bullet 과 같은 위치(앞쪽, `catalog-sync.spec.ts` 관련 bullet 이전)로 이동해 분리한다.

---

### [INFO] `implies.then` TypeScript 타입과 invariant 의 최소 길이 불일치
- **target 위치**: §2 TypeScript 타입 정의 (`| { kind: 'implies'; if: string; then: string[] }`) 및 invariant 2번 (`implies.then 은 길이 1 이상`)
- **위반 규약**: 해당 컨벤션 파일 자체 — invariant 는 `then` 의 최소 길이를 1 이상으로 명시하지만, TypeScript 타입은 `string[]` 으로 빈 배열을 허용한다.
- **상세**: `oneOf.fields` 와 `allOrNone.fields` 는 inline 주석(`// length >= 2`)으로 제약을 표시했지만 `implies.then` 은 동일한 inline 주석이 없다. 타입 레벨에서는 `[string, ...string[]]` 으로 선언하거나, 최소한 `// length >= 1` 주석을 추가하면 invariant 와의 일관성이 높아진다.
- **제안**: 타입 정의를 `then: [string, ...string[]]` 으로 변경하거나 (TypeScript tuple), 또는 `// then: length >= 1` inline 주석을 추가해 `oneOf`/`allOrNone` 와 일관된 패턴을 유지한다.

---

### [INFO] §9 CHANGELOG 2026-05-16 entry 가 현행 §6 를 "§5" 로 지칭 (역사적 불일치)
- **target 위치**: §9 CHANGELOG 표, 2026-05-16 행 ("§5 (옛 §4) 추가 절차에...")
- **위반 규약**: 해당 없음 — CHANGELOG 는 당시 섹션 번호를 기록하는 역사적 문서이며, 2026-05-18 entry 가 "+1 이동" 을 명시했으므로 의도적 선택임.
- **상세**: 새 §2 추가 후에도 섹션 번호가 변경되지 않았으므로 (§2 에 필드가 추가됐을 뿐 새 섹션이 생기지 않음) 기존 CHANGELOG 항목의 섹션 참조는 영향 없음. 추가 정보로만 언급.
- **제안**: 수정 불필요. CHANGELOG 가 역사적 기록이라는 점에서 허용. 그러나 독자 편의를 위해 "현재 §6 에 해당" 같은 (informative) 주석을 2026-05-18 entry 옆에 유지하면 더 명확하다 (이미 "+1 이동" 이 기술되어 있어 충분).

---

## 규약별 점검 결과 요약

| 관점 | 결과 | 비고 |
|---|---|---|
| 1. 명명 규약 | 준수 | `constraints`, `Cafe24FieldConstraint`, `kind`, `oneOf`/`allOrNone`/`implies` — snake_case / camelCase 일관. 단, `Cafe24McpBridge` vs `Cafe24McpToolProvider` 명 혼용 (WARNING 1) |
| 2. 출력 포맷 규약 | 준수 | `CAFE24_MISSING_FIELDS` 에러 코드 재사용 (신규 코드 미추가) — `spec/conventions/node-output.md` Principle 3 의 `UPPER_SNAKE_CASE` 에러 코드 규약 일치. constraint suffix 포맷 (`Constraint: at least one of ...`) 도 일관된 영문 패턴 |
| 3. 문서 구조 규약 | 준수 | `spec/conventions/<name>.md` 위치. Overview 전문 + 본문 (§1-§8) + CHANGELOG + `## Rationale` 3-섹션 구조 유지. `_product-overview.md` / `0-` prefix 대상 아님 (conventions 폴더 파일) |
| 4. API 문서 규약 | 해당 없음 | 본 파일은 Swagger/OpenAPI DTO 가 아닌 TypeScript interface 정의 컨벤션 문서. `spec/conventions/swagger.md` 의 DTO 패턴과 무관 |
| 5. 금지 항목 | 준수 | `catalog-sync.spec.ts` 검증 확장 없음 (constraints 는 `metadata.spec.ts` 별도 검증으로 분리). catalog 컬럼 미추가 (단일 SoT 원칙 유지). 신규 에러 코드 미추가. `spec/` write 는 project-planner 역할 규약에 따라 처리됨 |

---

## 요약

`spec/conventions/cafe24-api-metadata.md` 에 추가된 `constraints?: Cafe24FieldConstraint[]` 신설은 전반적으로 기존 컨벤션 패턴(`restrictedApproval` 도입 선례)을 충실히 따른다. 문서 구조(3섹션), 에러 코드 재사용, catalog 컬럼 미노출 결정, invariant 명시, MCP/JSON Schema 매핑 설명의 SoT 분리 모두 컨벤션 규약에 부합한다. 다만 동일 문서 내에서 `Cafe24McpBridge` 와 `Cafe24McpToolProvider` 두 가지 이름을 혼용하는 점(WARNING)과 §6 step 7 의 `constraints` 검증 bullet 이 `catalog-sync.spec.ts` 관련 항목 사이에 혼재하는 점(WARNING)은 구현 착수 전에 정리하는 것이 권장된다. `implies.then` 의 TypeScript 타입과 invariant 간 미세한 불일치는 INFO 수준이며 `metadata.spec.ts` 에서 runtime 검증으로 보호된다.

---

## 위험도

**LOW**

CRITICAL 위반 없음. WARNING 2건은 구현 명확성(어떤 class 명을 사용할지, 어떤 테스트 파일이 검증하는지) 에 관한 것이며, 컨벤션 자체의 invariant 를 깨지 않는다. 구현자가 WARNING 을 인지하고 코드에서 class 이름을 통일하면 된다.
