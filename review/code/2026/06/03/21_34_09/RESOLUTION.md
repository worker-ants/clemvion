# RESOLUTION — 21_34_09

대상 커밋: `721e832b` — feat(makeshop): Phase 0 — operation metadata 레이어 (161 REST op)

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| #1 | 코드/테스트 | `432bfe1e` | `constraint-validator.spec.ts` 신규 — 4종 constraint, 경계값, 다중 첫위반, 미지kind throw (15 tests) |
| #2 | 코드/테스트 | `432bfe1e` | `public-meta.spec.ts` 신규 — method/path 미노출, labelKey 포맷, paginated 기본값, JSON 직렬화, 전resource 키 (13 tests) |
| #3 | 코드 (defer) | — | constraint-validator DRY — Phase 0에서 즉각 강제 아님(SUMMARY 원문 인용). 코드 변경 없음, Phase 2 착수 전 공통레이어 추출 계획 |
| #4 | 코드 (defer) | — | SECTION_SCOPE per-operation 전환 — Phase 3(OAuth) 연기. 코드 변경 없음 |
| #5 | SPEC-DRIFT | `432bfe1e` | `spec/conventions/makeshop-api-metadata.md §5` — Phase 0 완료 반영. 미래형→과거형 갱신 |
| #6 | SPEC-DRIFT | `432bfe1e` | `spec/4-nodes/4-integration/5-makeshop.md §2` — Phase 0 완료 반영. 미래형 bullet 갱신 |
| #7 | 문서 | `432bfe1e` | `_overview.md §4` Coverage Matrix 확인 — `권한 그룹` 컬럼은 x-scope 그룹 요약(per-row `scope`와 별개), 변경 불필요. §6 heading만 완료 문구로 갱신 |

## 추가 조치 (strongly-flagged INFO)

| INFO # | 분류 | 조치 commit | 비고 |
|--------|------|-------------|------|
| INFO3 | 코드 | `432bfe1e` | `types.ts` scopeType 주석 — "read-style" 표현 제거. POST=write Phase 0 규칙 명시, Phase 3 확정 사항 명기 |
| INFO6 | 코드 | `432bfe1e` | `types.ts` "Three kinds:" → "Four kinds:" (impliesValue 4번째) |
| INFO12 | 코드 | `432bfe1e` | `public-meta.ts` — `PUBLIC_MAKESHOP_EXTRAS` 모듈 상수 메모이제이션, `buildMakeshopExtras()`는 래퍼로 유지 |
| INFO15 | 문서 | `432bfe1e` | 7개 섹션 파일(benefit/board/cpik/member/order/product/shop) 상단 1행 JSDoc 추가 |

## TEST 결과

- lint  : 통과 (38s)
- unit  : 통과 — backend 296 suites / 5729 tests passed; 신규 makeshop 57 tests (constraint-validator: 15, public-meta: 13, catalog-sync + metadata 기존 포함)
  - **프리-이그지스팅 실패 (본 변경과 무관)**: `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter.test.ts` 444건 (222 cafe24-api-catalog field-level 파일의 id/status frontmatter 부재, origin/main 기준 기존 실패); `schedules-page.test.tsx` 1건 (frontend UI 무관)
- build : (unit 통과, build는 lint+unit 범위 내 추가 미실행 — 코드 변경이 ts type-check를 포함한 lint에서 통과됨)
- e2e   : 면제 (화이트리스트: Phase 0 노드 미등록 — 런타임 표면 없음. 노드 핸들러/라우터 미구현, MakeShop 노드가 `NodeHandlerRegistry`에 미등록. e2e 시나리오 없음. 본 변경은 metadata 레이어 + 테스트 + spec 문서만 포함)

## 보류·후속 항목

- INFO 항목 (자동 수정 대상 아님):
  - INFO1: `default?: unknown` → 스칼라 유니언 타입 좁히기 — Phase 2 핸들러 구현 시
  - INFO2: `redirect_url`/`redirect_fail_url` 도메인 화이트리스트 — Phase 2 핸들러 구현 시
  - INFO4: `listAllMakeshopOperations` 반환 타입 별칭 추출 — Phase 2 착수 전
  - INFO5: `findMakeshopOperation` `resource: string` → `MakeshopResource` 타입 강화 — Phase 2 착수 전
  - INFO7: cpik.ts timestamp description 스타일 통일
  - INFO8: `Object.entries` 캐스팅 패턴 헬퍼 함수 추출
  - INFO9: 테스트 단언 패턴 통일
  - INFO10: `resolveRepoRoot()` 7단계 fallback 주석 추가
  - INFO11: `loadCatalog()` beforeAll 이동
  - INFO13: 커밋 메시지 `listAllMakeshopOperations` 미기재 (코드 변경 불필요)
  - INFO14: `cells.length < REST_HEADERS.length` 조건 강화
  - INFO16: `PublicMakeshopExtras` 인터페이스 JSDoc 추가
  - INFO17: 섹션 카탈로그 frontmatter pending_plans Phase 0 항목 정리
  - INFO18: `index.ts` 모듈 JSDoc에 `MAKESHOP_RESOURCES` re-export 언급 추가
- W3 defer: constraint-validator DRY — Phase 2 착수 전 `packages/` 또는 `_base/` 공통 레이어 추출
- W4 defer: SECTION_SCOPE per-operation 전환 — Phase 3(OAuth) 착수 전 계획 수립
