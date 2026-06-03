# 문서화(Documentation) 리뷰 결과

## 발견사항

### [INFO] 섹션별 operation 파일 (benefit.ts / board.ts / cpik.ts / member.ts / order.ts / product.ts / shop.ts) — 모듈 레벨 독스트링 없음
- 위치: `codebase/backend/src/nodes/integration/makeshop/metadata/benefit.ts` (및 동일 패턴의 6개 파일)
- 상세: 각 섹션 파일은 `MakeshopOperationMetadata[]` 배열을 export 하는 것이 전부이며, 파일 최상단에 모듈 레벨 JSDoc 이 없다. `index.ts` 의 모듈 JSDoc 이 "7 section files" 를 언급하지만 개별 파일이 어느 MakeShop 섹션을 담당하는지, 총 몇 개의 operation 을 포함하는지 파일 안에서 알 수 없다.
- 제안: 각 파일 상단에 `/** MakeShop Shop API — <섹션명> 섹션 (<N> operations). SoT: spec/conventions/makeshop-api-catalog/<섹션>.md */ ` 형태의 1행 JSDoc 추가. 경량 변경으로 일관성 확보.

### [INFO] `cpik.ts` — `post-cpik_member-check` / `post-cpik_member-login` scopeType 불일치 가능성 (주석 부재)
- 위치: `codebase/backend/src/nodes/integration/makeshop/metadata/cpik.ts` (lines ~960, ~1051)
- 상세: `types.ts` 의 JSDoc 은 "CPIK member check/login POST 는 read-style" 이라고 명시하지만, `cpik.ts` 내부 두 operation(`post-cpik_member-check`, `post-cpik_member-login`)은 `scopeType: 'write'` 로 선언되어 있다. catalog `cpik.md` 에도 `scope: write` 로 표기된다. 이 결정(read-style POST 를 write 로 처리)에 대한 이유가 해당 파일 어디에도 주석으로 없어 나중에 혼란을 줄 수 있다.
- 제안: 해당 두 operation 옆에 `// NOTE: member check/login 은 의미상 read 이지만 MakeShop OAuth scope 가 write 그룹에 묶여 write 로 분류 (types.ts 참고)` 형태의 인라인 주석 추가. 또는 `types.ts` 의 주석과 실제 값을 일치시키거나(read 로 변경), `types.ts` 의 주석 문구를 수정해 혼동을 제거.

### [INFO] `_overview.md` — Coverage Matrix (§4) 미업데이트
- 위치: `spec/conventions/makeshop-api-catalog/_overview.md` §4 Coverage Matrix
- 상세: diff 에서 §4 Coverage Matrix 행이 변경되지 않았다. 신규 컬럼(`scope`, `paginated`, `status`)이 섹션 파일에는 추가됐지만 `_overview.md` §4 표에는 반영됐는지 확인할 수 없다. `권한 그룹` 컬럼이 섹션별 표에서 제거되고 `scope` 로 교체됐으므로 Coverage Matrix 의 `권한 그룹` 컬럼 설명도 맞춰야 한다.
- 제안: `_overview.md` §4 의 Coverage Matrix 헤더/설명 컬럼이 이번 변경과 일치하는지 확인하고, 필요시 `scope` 컬럼 설명 추가.

### [INFO] `index.ts` — `MAKESHOP_RESOURCES` export 미언급
- 위치: `codebase/backend/src/nodes/integration/makeshop/metadata/index.ts` 모듈 JSDoc
- 상세: 모듈 JSDoc 은 "aggregate export of all 7 section files" 와 `MAKESHOP_OPERATIONS_BY_RESOURCE`, `findMakeshopOperation`, `scopeForOperation` 을 언급하지만, `MAKESHOP_RESOURCES` (re-exported from `types.ts`) 가 외부 소비자(특히 `catalog-sync.spec.ts`) 의 진입점으로 사용된다는 사실을 언급하지 않는다.
- 제안: 모듈 JSDoc 에 `MAKESHOP_RESOURCES` 가 re-export 되는 것과 용도(all resource keys enumeration) 를 1줄 추가.

### [INFO] `public-meta.ts` — `PublicMakeshopExtras` 인터페이스 JSDoc 없음
- 위치: `codebase/backend/src/nodes/integration/makeshop/metadata/public-meta.ts` line ~646
- 상세: `PublicMakeshopField`, `PublicMakeshopOperation` 은 인라인 주석이 있으나 `PublicMakeshopExtras` 인터페이스에는 JSDoc 이 전혀 없다. 이 타입이 `buildMakeshopExtras()` 의 반환 타입이자 `GET /nodes/definitions` 응답 페이로드와 직접 연결되는 공개 API 형태인데 설명이 없다.
- 제안: `PublicMakeshopExtras` 위에 `/** GET /nodes/definitions 응답 내 makeshop node extras 페이로드. buildMakeshopExtras() 반환값. */` 추가.

### [INFO] `catalog-sync.spec.ts` — `parseCatalogFile` 함수 JSDoc 없음
- 위치: `codebase/backend/src/nodes/integration/makeshop/metadata/catalog-sync.spec.ts` line ~510
- 상세: 파일 모듈 레벨 JSDoc 은 매우 상세하게 작성되어 있으나 `parseCatalogFile`, `loadCatalog`, `buildColumnIndex`, `isRestHeader`, `cellOr`, `parseHeaderCells` 등 핵심 파싱 헬퍼 함수에 함수 레벨 JSDoc 이 없다. 이 중 `parseCatalogFile` 은 테스트 전체의 데이터 소스이므로 "어떤 포맷을 파싱하는지, 어떤 경우에 row 를 skip 하는지" 를 함수 주석으로 설명하면 유지보수성이 높아진다.
- 제안: 최소한 `parseCatalogFile` 에 `@param filePath` + 파싱 포맷/skip 조건 설명 추가. 나머지 소형 헬퍼는 이름이 자명하므로 생략 가능.

### [INFO] `constraint-validator.ts` — `checkOne` 함수 접근성(visibility) 주석 보완
- 위치: `codebase/backend/src/nodes/integration/makeshop/metadata/constraint-validator.ts` line ~834
- 상세: `checkOne` 은 모듈-private helper (`export` 없음)이며 JSDoc 은 있다. 단, JSDoc 의 첫 줄("Validate one constraint…") 과 마지막 블록("allOrNone semantics…") 이 두 separate 블록으로 분리되어 있는데, 실제로는 `checkOne` 의 JSDoc 이 두 단락으로 나뉘어야 하는 게 맞는지 아니면 합쳐야 하는지 코드 상에서 불명확하다. 두 번째 `/**` 블록 (`allOrNone semantics`) 이 `checkOne` 을 설명하는 것인지 독립 주석인지 혼동될 수 있다.
- 제안: `allOrNone semantics` 주석을 `checkOne` JSDoc 안으로 합치거나, 명확하게 해당 `if` 블록 바로 위 인라인 `//` 주석으로 내리기.

### [WARNING] `_overview.md` — 이전 주의 문구(구현 전 단계 안내)가 `sync 승격` 문구로 교체됐으나 §4 Coverage Matrix 의 `권한 그룹` 컬럼 설명 잔류 가능성
- 위치: `spec/conventions/makeshop-api-catalog/_overview.md` §3 (컬럼 설명 표)
- 상세: diff 에서 `권한 (x-scope)` 컬럼이 `scope` + `paginated` + `status` 로 교체됐고 §3 표도 업데이트됐다. 그러나 diff 범위 밖(`... (diff omitted) ...`) 에서 §4 Coverage Matrix 의 `권한 그룹` 열이 여전히 존재하는지 확인이 필요하다. 만약 §4 에 `권한 그룹` 컬럼 참조가 남아 있으면 오래된 주석이 된다.
- 제안: `_overview.md` §4 Coverage Matrix 의 컬럼 제목/설명을 확인해 `권한 그룹` 을 `scope group` 으로 업데이트.

### [INFO] 섹션 카탈로그 파일 — `pending_plans:` frontmatter 미업데이트
- 위치: `spec/conventions/makeshop-api-catalog/benefit.md`, `board.md`, `cpik.md`, `member.md`, `order.md`, `product.md`, `shop.md` 각 frontmatter
- 상세: 각 파일이 "구현 전 단계" 문구에서 "Phase 0 sync 완료" 로 전환됐음에도, `pending_plans:` frontmatter 값이 변경됐는지 diff 에서 확인 불가(헤더 10줄은 생략). 만약 `pending_plans:` 에 "메타데이터 구현" 관련 항목이 남아 있다면 완료 처리가 필요하다.
- 제안: 각 섹션 파일의 `pending_plans:` frontmatter 에서 Phase 0 관련 항목을 완료 처리(제거 또는 완료 표기).

### [INFO] `makeshop-api-metadata.md` 스펙 문서 — 이번 커밋과 대응 내용 확인 필요
- 위치: `spec/conventions/makeshop-api-metadata.md` (diff 미포함)
- 상세: 커밋 메시지가 `metadata/index.ts` JSDoc 에서 `spec/conventions/makeshop-api-metadata.md §6` 을 "추가 절차" 레퍼런스로 언급한다. 실제로 이 spec 문서가 Phase 0 구현과 동기화됐는지(§4 scope format, §5 timezone placeholder, §6 endpoint 추가 절차, §7 MCP sanitize) 이번 변경에서 업데이트됐는지 확인 불가.
- 제안: `makeshop-api-metadata.md` 가 Phase 0 구현을 반영하고 있는지 별도 확인. 특히 §4 wire scope format, §6 추가 절차가 실제 구현과 일치하는지 점검.

---

## 요약

이번 변경은 MakeShop API 메타데이터 레이어(161개 operation)를 신규 추가하고 카탈로그 spec 문서와 양방향 동기를 구축한 대형 Phase 0 작업이다. 문서화 품질은 전반적으로 양호하다. `constraint-validator.ts`, `index.ts`, `public-meta.ts`, `types.ts` 의 핵심 공개 API 에는 상세한 JSDoc 이 작성되어 있고, `catalog-sync.spec.ts` 의 모듈 레벨 설명도 6개 검증 규칙을 명확히 기술한다. `_overview.md` 의 "구현 전 단계" 경고문이 정확히 "sync 승격 완료" 메시지로 교체된 것도 올바른 문서 갱신이다. 주요 미비점은 (1) 섹션별 operation 파일 7개의 모듈 레벨 JSDoc 부재, (2) `cpik.ts` 의 read-style POST 에 대한 설명 부재로 `types.ts` 주석과의 표면적 불일치, (3) `_overview.md` §4 Coverage Matrix 의 구 `권한 그룹` 컬럼 잔류 가능성 등이다. 이들은 모두 낮은 위험도의 개선 사항이며 런타임 동작에는 영향을 미치지 않는다.

---

## 위험도

LOW
