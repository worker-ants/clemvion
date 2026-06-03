# Testing Review — Makeshop Phase 0 Metadata Layer

## 발견사항

### [WARNING] `constraint-validator.ts` 에 대한 전용 단위 테스트 없음
- 위치: `/codebase/backend/src/nodes/integration/makeshop/metadata/constraint-validator.ts`
- 상세: `validateMakeshopConstraints` 와 내부 `checkOne` 함수는 `metadata.spec.ts` / `catalog-sync.spec.ts` 어디에서도 직접 호출·검증되지 않는다. Cafe24 대응 파일(`cafe24/metadata/constraint-validator.spec.ts`)에는 `oneOf`/`allOrNone`/`implies`/`impliesValue` 4종 constraint, 경계값(null/undefined/''/0/false), 다중 constraint 순서, 첫 위반만 반환 등 총 14개 테스트가 있다. MakeShop constraint-validator 는 코드가 동일(verbatim copy)함에도 불구하고 하나도 없다. 현재 `metadata.spec.ts` 의 constraints 테스트(`constraints reference only declared fields`)는 메타데이터 row 정합성만 검사할 뿐 constraint-validator 의 런타임 동작(pass/fail 판단)을 커버하지 않는다.
- 제안: `constraint-validator.spec.ts` 를 `metadata/` 디렉토리에 추가하고 Cafe24 버전과 동일한 테스트 세트를 `validateMakeshopConstraints` 대상으로 작성한다. `isAbsent`(0/false/[] 처리), `oneOf` 전체 absent 실패, `allOrNone` 부분 absent 실패, `implies` if-absent 패스, `impliesValue` 값 불일치 패스, 다중 constraint 첫 위반 반환, 미지 kind throw 검사를 포함해야 한다.

### [WARNING] `public-meta.ts` (`toPublicMakeshopOperation`, `buildMakeshopExtras`) 에 대한 테스트 없음
- 위치: `/codebase/backend/src/nodes/integration/makeshop/metadata/public-meta.ts`
- 상세: Cafe24 대응 파일(`public-meta.spec.ts`)은 `toPublicSupportedOperation`/`buildCafe24Extras` 에 대해 총 8개 테스트(method/path 미노출 확인, labelKey 포맷, required 플래그, location 보존, enum/default 보존, paginated 기본값 false, JSON 직렬화, method/path 키 부재 등)를 보유한다. MakeShop 측에는 대응 spec 파일이 없다. `toPublicMakeshopOperation` 의 핵심 보안 불변(`method`/`path` 미노출)과 `labelKey` 포맷(`makeshop.<resource>.<id>`)은 명시적으로 검증되지 않는다.
- 제안: `public-meta.spec.ts` 를 추가하고 최소한 다음을 검증한다: (1) `method`/`path` 가 public payload 에 없음, (2) `labelKey` 가 `makeshop.${resource}.${op.id}` 포맷, (3) `required` 플래그가 `requiredFields` 기준 정확, (4) `paginated` 기본값 false(`undefined`인 경우), (5) `buildMakeshopExtras` 가 MAKESHOP_RESOURCES 모든 resource 키 포함, (6) 결과가 JSON 직렬화 가능.

### [INFO] `catalog-sync.spec.ts` — module-level에서 `loadCatalog()` 호출 (테스트 격리 주의)
- 위치: `/codebase/backend/src/nodes/integration/makeshop/metadata/catalog-sync.spec.ts` line 586
- 상세: `const catalog = loadCatalog()` 가 `describe` 블록 안이지만 `beforeAll` 없이 모듈 평가 시점에 실행된다. 카탈로그 파일 읽기 실패 시 모듈 로드 자체가 실패해 에러 메시지가 Jest가 아닌 모듈 레벨 예외로 보고된다. 이는 cafe24 `catalog-sync.spec.ts` 도 동일한 패턴이므로 의도된 설계이나, 테스트 실행 환경에서 `spec/conventions/makeshop-api-catalog/*.md` 경로가 없을 경우 디버그가 어렵다.
- 제안: 필수 대응은 아니나, `beforeAll(() => { catalog = loadCatalog(); })` 패턴으로 전환하면 파일 읽기 실패 시 명확한 Jest 테스트 실패 메시지를 얻을 수 있다.

### [INFO] `catalog-sync.spec.ts` — `parseCatalogFile` 내부 파싱 로직 자체에 대한 단위 테스트 없음
- 위치: `/codebase/backend/src/nodes/integration/makeshop/metadata/catalog-sync.spec.ts` lines 475-572
- 상세: `parseHeaderCells`, `buildColumnIndex`, `isRestHeader`, `cellOr`, `parseCatalogFile` 등 내부 파싱 헬퍼가 테스트 코드 내에 인라인 정의되어 있고, 이들 자체에 대한 단위 테스트는 없다. 테이블 파싱 로직이 틀릴 경우(`headerSeen` 상태 기계 오류, `✓` 매핑, footnote 제거 regex 등) 동기 검증 자체가 무력화된다. Cafe24 `catalog-sync.spec.ts` 도 동일한 구조이므로 기존 관례와 일치하지만, 파싱 함수의 엣지 케이스(빈 파일, 헤더-separator 없는 표, 셀 수가 REST_HEADERS.length 미만인 row)는 암묵적으로 처리됨에 주의한다.
- 제안: 파싱 함수를 별도 유틸리티로 분리하고 단위 테스트를 추가하는 것이 장기적으로 안전하나 Phase 0 범위에서는 INFO 수준이다.

### [INFO] `metadata.spec.ts` — 총 operation 수 161 하드코딩
- 위치: `/codebase/backend/src/nodes/integration/makeshop/metadata/metadata.spec.ts` line 1334
- 상세: `expect(total).toBe(161)` 은 operation 수 추가 시 의도적으로 실패(회귀 방지 역할)하도록 설계된 것으로 보이나, 실패 메시지에 어떤 resource/section 에서 수가 변경됐는지 맥락이 없다.
- 제안: 실패 메시지에 현재 값을 포함(`expect(total).toBe(161)` 유지하되 실패 시 `toEqual` 형태)하거나 per-resource 수까지 검증하면 회귀 원인 파악이 빠르다. 필수 변경은 아니다.

### [INFO] `constraint-validator.ts` — 미사용 `constraints` 필드지만 미래 대비 로직 커버 필요
- 위치: `/codebase/backend/src/nodes/integration/makeshop/metadata/constraint-validator.ts`
- 상세: `types.ts`의 `constraints?: MakeshopFieldConstraint[]` 주석에 "Empty for all rows today" 라고 명시되어 있다. 즉, 현재 161개 operation 중 constraints 를 실제로 선언한 row가 없어 런타임에서 이 함수가 호출되지 않는다. 코드 경로가 전혀 실행되지 않는 상태임에도 테스트도 없다. Phase 2(handler 연결) 이전에 미지 kind throw 경로(`_exhaustive: never`)는 물론이고 4개 kind 전부에 대한 테스트가 없으면 handler 연결 시 버그 위험이 높다.
- 제안: WARNING 항목과 동일 — 전용 spec 파일 추가.

---

## 요약

이번 변경은 `metadata.spec.ts` (metadata 구조 불변 검증, 26개 중 일부)와 `catalog-sync.spec.ts` (카탈로그 ↔ 메타데이터 양방향 동기 검증)를 포함해 데이터 레이어 정합성 측면은 잘 커버된다. 그러나 두 핵심 로직 모듈인 `constraint-validator.ts`와 `public-meta.ts`에 대한 단위 테스트가 전혀 없다. Cafe24 대응 모듈에는 각각 `constraint-validator.spec.ts`(14개 테스트)와 `public-meta.spec.ts`(8개 테스트)가 존재하므로, MakeShop 측도 동일한 커버리지를 갖춰야 한다. 특히 `constraint-validator.ts` 는 코드가 verbatim copy 임에도 불구하고 `isAbsent` 경계값 처리(`0`/`false`/`[]` 를 present 로 인식), 다중 constraint 순서, 미지 kind throw 경로가 검증되지 않는다. Phase 2 에서 handler/MCP bridge 연결 시 이 함수들이 런타임에서 호출되기 전에 테스트가 추가되어야 한다.

---

## 위험도

**MEDIUM** — 데이터 정합성(catalog-sync, metadata shape) 테스트는 충분하나 런타임 로직(`constraint-validator`, `public-meta` 프로젝션)에 대한 테스트 공백이 있어 Phase 2 handler 연결 시 무증상 버그 위험이 존재한다.

STATUS: SUCCESS
