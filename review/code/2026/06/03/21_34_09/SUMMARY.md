# Code Review 통합 보고서

대상 커밋: `721e832b` — feat(makeshop): Phase 0 — operation metadata 레이어 (161 REST op)

---

## 전체 위험도

**MEDIUM** — 데이터 정합성 및 아키텍처는 양호하나, 런타임 로직(`constraint-validator`, `public-meta`)에 대한 테스트 공백이 Phase 2 handler 연결 시 무증상 버그 위험을 내포. 복수 reviewer 가 공통 지적한 cpik scope 주석 불일치는 수정 필요.

---

## Critical 발견사항

없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `constraint-validator.ts` 전용 단위 테스트 없음. Cafe24 대응 파일은 14개 테스트 보유하나 MakeShop 측은 0개. Phase 2 handler 연결 시 `isAbsent` 경계값·4종 kind·미지 kind throw 경로가 무검증 상태로 런타임 호출됨. | `metadata/constraint-validator.ts` | `constraint-validator.spec.ts` 추가. `validateMakeshopConstraints` 대상으로 Cafe24 버전과 동일한 테스트 세트(4종 constraint, 경계값, 다중 constraint 순서, 첫 위반 반환, 미지 kind throw) 작성. |
| 2 | Testing | `public-meta.ts`(`toPublicMakeshopOperation`, `buildMakeshopExtras`) 테스트 없음. Cafe24 대응 파일은 8개 테스트 보유. `method`/`path` 미노출 불변, `labelKey` 포맷, `paginated` 기본값 등 핵심 보안·동작 불변이 미검증. | `metadata/public-meta.ts` | `public-meta.spec.ts` 추가. (1) `method`/`path` 미노출, (2) `labelKey` 포맷 `makeshop.${resource}.${id}`, (3) `required` 플래그 정합, (4) `paginated` 기본값 false, (5) 전체 resource 키 포함, (6) JSON 직렬화 가능 검증. |
| 3 | Architecture | `constraint-validator.ts`가 Cafe24 validator의 verbatim copy로 선언됨. 로직 수정·constraint 종류 확장 시 양측을 동시 수정해야 하는 DRY 위반. | `metadata/constraint-validator.ts` L8 주석 | Phase 2 이전에 `packages/` 또는 `_base/` 공통 레이어에 제네릭 함수 추출. 현 Phase 0에서는 즉각 강제 아님. |
| 4 | Architecture | `SECTION_SCOPE` 매핑이 `index.ts` 내부 private 상수로만 존재. `cpik` 리소스가 실제로 두 scope 그룹에 걸치나 `order` 하나로 고정. Phase 3 전환 시 drift 가능성. | `metadata/index.ts` L1189–L1197 | Phase 3 전환 시 per-operation `scopeGroup?` 필드 추가 또는 `SECTION_SCOPE`를 spec과 기계적으로 동기화하는 단위 테스트 추가. |
| 5 | SPEC-DRIFT | [SPEC-DRIFT] `spec/conventions/makeshop-api-metadata.md §5`가 Phase 0 완료로 낡아짐. "catalog에 `status` 컬럼을 추가하고 sync 대상으로 승격한다"는 미래형 서술이 이미 완료됨. | `spec/conventions/makeshop-api-metadata.md §5` | spec §5 본문을 "Phase 0에서 완료됨 — catalog에 `status`/`scope`/`paginated` 컬럼 추가, `catalog-sync.spec.ts` 양방향 동기 보호 도입"으로 갱신 (project-planner 위임). |
| 6 | SPEC-DRIFT | [SPEC-DRIFT] `spec/4-nodes/4-integration/5-makeshop.md §2` 마지막 bullet이 낡아짐. "구현 착수 시 catalog에 `status` 컬럼을 도입한다"는 서술이 Phase 0에서 이미 완료됨. | `spec/4-nodes/4-integration/5-makeshop.md §2` | 해당 bullet을 "Phase 0에서 catalog에 `status` 컬럼 도입 완료"로 갱신 (project-planner 위임). |
| 7 | Documentation | `_overview.md §4` Coverage Matrix의 `권한 그룹` 컬럼 참조가 이번 변경(`scope` 컬럼으로 교체)에 맞춰 업데이트됐는지 미확인. diff 범위 밖 §4가 잔류 가능성. | `spec/conventions/makeshop-api-catalog/_overview.md §4` | `_overview.md §4` Coverage Matrix 확인 후 `권한 그룹` → `scope group` 업데이트 필요 시 반영. |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `default?: unknown` 필드가 `PublicMakeshopField`를 통해 프론트엔드로 노출. 현재 어떤 operation도 `default` 선언 없어 실질 위험 없음. | `public-meta.ts` L627, `types.ts` L1785 | `default`를 `string \| number \| boolean \| null \| undefined` 스칼라 유니언으로 좁히거나, 직렬화 지점에서 화이트리스트 타입 체크 추가 권장. |
| 2 | Security | `cpik.ts` — `redirect_url`/`redirect_fail_url` 필드. 현재 메타데이터 레이어이며 런타임 핸들러 없음. | `cpik.ts` L1067–1075 | Phase 2 핸들러 구현 시 허용 도메인 화이트리스트 또는 오리진 검증 추가 필수. |
| 3 | Architecture / Consistency | `cpik.ts`의 `post-cpik_member-check`/`post-cpik_member-login`이 `scopeType: 'write'`로 등록됐으나 `index.ts` 주석(L1164)은 "read-style"이라 서술. 코드-주석 불일치. 3개 reviewer(architecture, requirement, side_effect)가 공통 지적. | `cpik.ts` L961–L984, L1051–L1085; `index.ts` L1164 | (a) `scopeType`을 `read`로 변경해 catalog·metadata·테스트 일괄 수정, 또는 (b) `index.ts` 주석에서 "read-style" 표현 제거/수정. Phase 3 OAuth 구현 전에 결정 필요. |
| 4 | Architecture | `listAllMakeshopOperations()` 반환 타입 인라인 중복. `Array<{ resource: MakeshopResource; operation: MakeshopOperationMetadata }>` 가 두 곳에 반복. | `metadata/index.ts` L1221–L1237 | `type MakeshopResourceOperation = {...}` 타입 별칭 추출. |
| 5 | Architecture | `findMakeshopOperation`의 `resource: string` 파라미터 타입 이완. `MakeshopResource` 유니언 타입 보호를 우회함. | `metadata/index.ts` L1203–L1215 | Phase 2 착수 전 overload 방식으로 정리 권장. |
| 6 | Maintainability | `types.ts` 주석 "Three kinds:" 오기. 실제 constraint kind는 4가지(`impliesValue` 추가). | `types.ts` ~L1800 | `Three kinds:` → `Four kinds:` 수정. |
| 7 | Maintainability | `cpik.ts`의 `timestamp` 필드 description 표현 방식이 4가지 스타일로 혼용됨. | `cpik.ts` (check/delete/login/join) | `'요청 시각 (Unix timestamp, 5분 유효)'`로 통일. |
| 8 | Maintainability | `Object.entries(MAKESHOP_OPERATIONS_BY_RESOURCE) as Array<[MakeshopResource, ...]>` 캐스팅 패턴이 `index.ts`와 `public-meta.ts` 두 곳에서 중복. | `index.ts`, `public-meta.ts` | `entriesOfOperationsByResource()` 헬퍼 함수로 추출. |
| 9 | Maintainability | 테스트 단언 패턴 혼용 — `throw new Error(...)` vs `expect().toBe()`. | `metadata.spec.ts` 여러 테스트 | 전체를 throw-early 또는 violations 배열 수집 후 일괄 throw 패턴으로 통일. |
| 10 | Maintainability | `resolveRepoRoot()` fallback 경로 7단계 상위 하드코딩에 의미 주석 없음. | `catalog-sync.spec.ts` ~L435 | `// 7 levels up: metadata → makeshop → integration → nodes → src → backend → codebase → repo root` 주석 추가. |
| 11 | Side Effect | `catalog-sync.spec.ts` describe 상단에서 `loadCatalog()` 모듈 평가 시점 동기 호출. | `catalog-sync.spec.ts` L586 | `beforeAll(() => { catalog = loadCatalog(); })`로 이동하면 Jest 라이프사이클과 정렬됨. 필수 아님. |
| 12 | Side Effect | `buildMakeshopExtras()`가 매 `GET /nodes/definitions` 요청마다 161개 operation을 map. 순수 함수이나 GC 압력 가능. | `public-meta.ts` L1694–1709 | `const PUBLIC_MAKESHOP_EXTRAS = buildMakeshopExtras()`로 모듈 수준 1회 계산. 요청 빈도 높을 경우 검토. |
| 13 | Scope | `listAllMakeshopOperations` 커밋 메시지 미기재. 기능 범위 밖 추가는 아님. | `index.ts` L1221–L1237 | 커밋 메시지에 명시 추가. 코드 수정 불필요. |
| 14 | Requirement | `catalog-sync.spec.ts` — `cells.length < REST_HEADERS.length` 조건이 열 수 부족 행을 조용히 skip. | `catalog-sync.spec.ts` L542 | 향후 `throw new Error(...)` 로 강화 가능. 현재 INFO. |
| 15 | Documentation | 섹션 파일 7개(benefit/board/cpik/member/order/product/shop)에 모듈 레벨 JSDoc 없음. | 각 섹션 파일 상단 | 파일 상단에 1행 JSDoc(`/** MakeShop Shop API — <섹션명> 섹션 (<N> operations). SoT: spec/conventions/makeshop-api-catalog/<섹션>.md */`) 추가. |
| 16 | Documentation | `PublicMakeshopExtras` 인터페이스 JSDoc 없음. GET /nodes/definitions 응답 페이로드와 직결되는 공개 타입. | `public-meta.ts` ~L646 | 인터페이스 위에 JSDoc 추가. |
| 17 | Documentation | 섹션 카탈로그 파일 `pending_plans:` frontmatter에 Phase 0 완료 항목이 잔류 가능성. | 각 섹션 `.md` frontmatter | Phase 0 관련 항목을 완료 처리(제거 또는 완료 표기). |
| 18 | Documentation | `index.ts` 모듈 JSDoc에서 `MAKESHOP_RESOURCES` re-export 미언급. | `index.ts` 모듈 JSDoc | JSDoc에 `MAKESHOP_RESOURCES` re-export 및 용도 1줄 추가. |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | Phase 0 메타데이터 레이어 — 런타임 공격 표면 없음. `default: unknown` 타입 좁히기 및 Phase 2 redirect URL 검증 필요. |
| architecture | LOW | OCP 구조·레이어 분리 양호. `SECTION_SCOPE` 테스트 미보호, `constraint-validator.ts` DRY 위반(WARNING 2건). |
| requirement | LOW | 161 op 완전 구현. cpik scope-주석 불일치(WARNING). spec 2곳 낡은 서술(SPEC-DRIFT 2건). |
| scope | NONE | 커밋 범위 정확. 범위 외 수정 없음. INFO 3건. |
| side_effect | LOW | 신규 파일 추가 위주, 기존 시그니처 무변경. cpik scope 의미 불일치 INFO. |
| maintainability | LOW | 구조 일관성 양호. "Three kinds" 오기, timestamp description 불일치, 캐스팅 중복 INFO. |
| testing | MEDIUM | 데이터 정합성 테스트 충분. 런타임 로직(`constraint-validator`, `public-meta`) 단위 테스트 전무(WARNING 2건). |
| documentation | LOW | 전반 JSDoc 양호. 섹션 파일 모듈 JSDoc 부재, `_overview.md §4` 컬럼 잔류 가능성(WARNING 1건). |

---

## 발견 없는 에이전트

- **scope**: 범위 위반 없음 (위험도 NONE).
- **security**: 실질 보안 취약점 없음 (전항목 INFO).

---

## 권장 조치사항

1. **(Phase 2 착수 전 필수)** `constraint-validator.spec.ts` 신규 작성 — 4종 constraint, 경계값, 미지 kind throw 포함 14개 이상 테스트. Cafe24 버전 동일 커버리지 달성.
2. **(Phase 2 착수 전 필수)** `public-meta.spec.ts` 신규 작성 — `method`/`path` 미노출, `labelKey` 포맷, `paginated` 기본값, JSON 직렬화 등 6개 이상 테스트.
3. **(즉시)** `types.ts` 주석 "Three kinds:" → "Four kinds:" 오기 수정.
4. **(즉시)** `cpik.ts`/`index.ts` scope 주석 불일치 해소 — `scopeType: 'write'` 유지 시 `index.ts` L1164 "read-style" 표현 삭제, 또는 `scopeType: 'read'` 변경 시 catalog·metadata·테스트 일괄 수정. 결정을 내리고 코드-주석 일치화.
5. **(project-planner 위임)** `spec/conventions/makeshop-api-metadata.md §5`와 `spec/4-nodes/4-integration/5-makeshop.md §2` — Phase 0 완료 반영으로 갱신.
6. **(문서)** `_overview.md §4` Coverage Matrix의 `권한 그룹` 컬럼 참조 확인 및 `scope group` 업데이트.
7. **(Phase 2 이전)** `constraint-validator.ts` 및 `public-meta.ts`의 `Object.entries` 캐스팅 패턴 — `packages/` 공통 레이어 추출 계획 수립. SECTION_SCOPE per-operation 전환 계획도 동반.
8. **(Phase 2 핸들러 구현 시)** `redirect_url`/`redirect_fail_url` 필드 허용 도메인 화이트리스트 검증 추가. `default: unknown` 타입 스칼라 유니언으로 좁히기.

---

## 라우터 결정

라우터가 reviewer 를 선별했습니다 (`routing_status=done`).

- **실행**: `security`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (8명, 전원 router_safety 강제 포함)
- **제외**: `performance`, `dependency`, `database`, `concurrency`, `api_contract`, `user_guide_sync` (6명)
- **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`

| 제외된 reviewer | 이유 |
|------------------|------|
| performance | Phase 0 정적 메타데이터 레이어 — 런타임 성능 임계 경로 없음 |
| dependency | 외부 패키지 신규 추가 없음 |
| database | DB 스키마·쿼리 변경 없음 |
| concurrency | 비동기 경쟁 조건 관련 코드 없음 |
| api_contract | 외부 공개 API 엔드포인트 변경 없음 (Phase 0) |
| user_guide_sync | 사용자 대면 기능 변경 없음 (Phase 0) |