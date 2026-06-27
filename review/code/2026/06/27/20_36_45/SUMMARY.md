# Code Review 통합 보고서

## 전체 위험도
**LOW** — docs 부재 확정 9개 Cafe24 seed operation 제거 작업. Critical 발견 없음. WARNING 2건(MDX 유저 가이드 stale 예시, 퍼시스트 워크플로 실패 모드 변경)이 있으나 기능 파괴 수준은 아님.

## Critical 발견사항

해당 없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | DOCS_STALE | 유저 가이드 MDX 2개 파일이 이번 PR 에서 제거된 `customer_update` 를 예시 operation ID 로 계속 참조. 사용자가 가이드를 보고 해당 op 를 시도하면 "operation not found" 오류를 마주함. | `codebase/frontend/src/content/docs/06-integrations-and-config/cafe24.mdx` line 85, `cafe24.en.mdx` line 84 | `customer_update` 를 실제 지원·문서화된 operation(`customer_list` 또는 `customer_delete`)으로 교체. ko/en 동시 갱신으로 parity 유지. |
| 2 | SIDE_EFFECT | DB 에 퍼시스트된 워크플로/Integration 노드가 제거된 9개 operation ID 를 참조할 경우 실패 모드가 "Cafe24 404" → "operation not found(`undefined`)" 로 변경됨. plan 에서 인지한 위험이며 해당 ops 가 이미 비동작 상태였으므로 사용자 영향은 미미하나, 런타임 에러 메시지·분기가 달라질 수 있음. | `codebase/backend/src/nodes/integration/cafe24/metadata/application.ts`, `category.ts`, `customer.ts`, `promotion.ts`, `store.ts` | 배포 전 DB에 저장된 Integration 노드 설정에서 9개 operation ID 참조 여부를 조회하는 마이그레이션 체크 실행. 참조 존재 시 삭제 또는 사용자 경고 처리 로직 확인. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SECURITY | 테스트 파일 내 `resolveRepoRoot()` 의 `console.warn` 이 `__dirname` 기반 7단계 상위 절대경로를 출력할 수 있음. 프로덕션 번들 비포함. CI 로그 외부 공개 시 경미한 경로 노출 가능. | `codebase/backend/src/nodes/integration/cafe24/metadata/catalog-docs-drift.spec.ts` | warn 메시지에서 절대경로 힌트 제거 또는 상수 메시지로 교체(선택적). |
| 2 | TESTING | `metadata.spec.ts` describe 블록 이름 "Core categories have CRUD coverage" 가 customer 축소 후 의미 불일치. customer 는 이제 list 하나만 포함. 테스트 로직 자체는 정확함. | `codebase/backend/src/nodes/integration/cafe24/metadata/metadata.spec.ts` line 233 | describe 이름을 "Core categories have minimum required operations" 등으로 갱신하거나 블록 내 주석으로 G-3l 컨텍스트 명시. |
| 3 | TESTING | `cafe24-catalog-sync.spec.ts` 가 dict→catalog 방향(orphan 키)을 검증하지 않음. 이번 변경은 KO↔EN parity 테스트가 보호하나 향후 양쪽에서 동시에 잉여 키를 남기면 통과. | `codebase/frontend/src/lib/i18n/__tests__/cafe24-catalog-sync.spec.ts` | `Object.keys(cafe24CatalogKo).filter(k => !expectedKeysSet.has(k))` 형태의 orphan 검출 assertion 추가(향후 백로그). |
| 4 | MAINTAINABILITY | op 카운트(`485`)가 두 파일의 JSDoc 주석에 중복 존재 — 단일 진실 부재. 이번 PR 에서는 두 곳 모두 정확히 갱신됨. | `activity-label.ts` L7, `page.tsx` L740 | 공유 export 상수(`CAFE24_OPERATIONS_COUNT`)로 단일화하거나 테스트가 수치를 검증하는 구조로 개선(백로그 수준). |
| 5 | MAINTAINABILITY | `KNOWN_DOCS_ABSENT` 빈 Set 에 `size === 0` 고정 테스트 조합의 의도가 히스토리 미숙지자에게 혼란을 줄 수 있음. JSDoc 이 이미 완화함. | `catalog-docs-drift.spec.ts` | JSDoc 에 "향후 docs 부재 op 가 다시 지원 대상에 포함될 경우를 위한 확장 지점" 명시 한 줄 추가(선택적). |
| 6 | SIDE_EFFECT | 과거 활동 로그(activity log)에 DB 저장된 9개 제거된 op ID 를 참조하는 레코드가 있을 경우 UI 가 human-friendly 라벨 대신 endpoint fallback 렌더링으로 표시됨. 기능 회귀 아님. | `codebase/frontend/src/lib/i18n/dict/ko/cafe24Catalog.ts`, `en/cafe24Catalog.ts` | 허용 가능하면 현 상태 유지. 과거 데이터 라벨 보존 필요 시 별도 legacy 항목 유지 고려(필요성 낮음). |
| 7 | TESTING | `catalog-docs-drift.spec.ts` fallback 경로 계산(`join(__dirname, '..'.repeat(7))`)이 CI 환경에서 git 부재·디렉토리 구조 상이 시 잘못된 CATALOG_DIR 산출 가능. `docsOps.size > 450` sanity floor 가 이미 보호 중. | `catalog-docs-drift.spec.ts` lines 28-43 | 조치 불필요. 기존 sanity floor 가 보호. 주석 수준 메모. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 테스트 파일 console.warn 경로 노출(INFO, 프로덕션 무관) |
| requirement | success | plan G-3l 의도 정합 |
| scope | NONE | 21개 파일 전체 plan G-3l 의도 정합, 범위 이탈 없음 |
| side_effect | LOW | 퍼시스트 워크플로 실패 모드 변경(WARNING), 과거 activity log 라벨 degradation(INFO) |
| maintainability | LOW | op 카운트 주석 중복(INFO), 빈 Set 가독성(INFO) — 긍정적 변경 전반 |
| testing | LOW | MDX customer_update 예시 잔존(INFO), describe 이름 불일치(INFO), orphan 키 미검증(INFO) |
| documentation | NONE | 모든 문서 동기화 정합, JSDoc 이력 우수 |
| user_guide_sync | LOW | cafe24.mdx + cafe24.en.mdx customer_update 예시 stale(WARNING) |

## 권장 조치사항

1. **(WARNING — 즉시)** `cafe24.mdx` line 85 및 `cafe24.en.mdx` line 84 의 `customer_update` 예시를 `customer_list` 또는 `customer_delete` 로 교체. ko/en 동시 갱신.
2. **(WARNING — 배포 전)** DB 에 저장된 Integration 노드 설정에서 9개 제거된 operation ID 참조 여부를 조회하는 마이그레이션 체크 실행. 필요 시 사용자 경고 또는 삭제 처리.
3. **(INFO — 백로그)** `metadata.spec.ts` describe 블록 이름 "CRUD coverage" → "minimum required operations" 또는 유사 표현으로 갱신.
4. **(INFO — 백로그)** `cafe24-catalog-sync.spec.ts` 에 orphan 키 검출 assertion 추가.
5. **(INFO — 백로그)** op 카운트(`485`) 를 공유 상수로 단일화하여 두 파일 주석 중복 해소.

## 라우터 결정

routing_status=done (router 가 선별):

- **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `user_guide_sync` (8명)
- **제외**: `performance`, `architecture`, `dependency`, `database`, `concurrency`, `api_contract` (6명)
- **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명)
