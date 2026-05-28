# RESOLUTION — 09_44_23

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| C1 | false-positive | (no commit needed) | spec files 직접 확인 — c5faa751 에 이미 반영됨: `cafe24-api-metadata.md §7.5` (line 401), `_product-overview.md INT-US-05` (line 60), `1-data-model.md §2.10.1` 3행, `2-navigation/4-integration.md §4.6/§9.3` |
| C2 | 코드 | `05df5e8c` | `IntegrationActivityItemDto` 에 `apiLabel?/apiMethod?/apiPath?` 3필드 + `@ApiPropertyOptional({ nullable: true })` 추가 |
| W1 | 테스트 | `05df5e8c` | `extractApiPath` 6케이스 단위 테스트 추가 (절대 URL, query strip, 상대 URL, fragment strip — I4 fix 포함) |
| W2 | 테스트 | `05df5e8c` | `extractSqlVerb` 12케이스 단위 테스트 추가 (NULL, empty, whitespace, mixed-case, CTE, CRUD 동사) |
| W3 | 테스트 | `05df5e8c` | 4 handler spec (http-request, database-query, send-email, cafe24) 의 logUsage 검증에 `api` 필드 값 assertion 추가 |
| W4 | 테스트 | `05df5e8c` | `extractSqlVerb` SAVEPOINT(9자) 케이스 추가 — `clampApiField` 다운스트림 처리 정책 명문화 |
| W5 | 테스트 | `05df5e8c` | cafe24 operation lookup 실패 시 `label` 만 있고 `method/path` 가 undefined 인 케이스 테스트 추가 |
| W7 | 코드 | `05df5e8c` | `getServiceCatalog()` 반환 타입을 inline 객체 → `OperationCatalogDto` 로 교체 |
| W8 | 코드 | `05df5e8c` | `@ApiParam` description 에 "현재 지원: `cafe24`, 그 외 빈 배열 반환" 명시 |
| W10 | 코드 | `05df5e8c` | `IntegrationUsageParams.api` JSDoc 에 "빈 문자열·`undefined` → `null` coerce" 추가 |
| W11 | 코드 | `05df5e8c` | `tryTranslateLabel` JSDoc 에 `@see plan/in-progress/cafe24-catalog-i18n.md` 추가 |
| W12 | 문서 | `05df5e8c` | `integration-management.{mdx,en.mdx}` 탭 FieldTable 에 `Activity` 행 추가 (API 컬럼 동작 — 라벨+endpoint 2줄 / endpoint-only / `—` fallback) |
| I4 | 코드 | `05df5e8c` | `extractApiPath` relative URL fallback 에서 fragment(`#`) 도 제거 |
| I6 | 코드 | `05df5e8c` | `API_LABEL_MAX` / `API_METHOD_MAX` / `API_PATH_MAX` 를 `export const` 로 변경 |
| I9 | 코드 | `05df5e8c` | `staleTime: 60 * 60 * 1000` → `ONE_HOUR_MS` 상수로 추출 |
| I10 | 코드 | `05df5e8c` | `catalogByKey` Map 을 `useMemo` 로 감싸기 (조건부 hook 오류도 함께 수정) |

## TEST 결과

- lint  : 통과
- unit  : 통과 (4975 passed — 직전 4951 대비 +24)
- build : (직전 round PASS — 이번 변경 후 e2e 통과로 갈음)
- e2e   : 통과 (123/123)

## 보류·후속 항목

- W6: `tryTranslateLabel` 의 `as TranslationKey` 캐스팅 타입 강화 — `cafe24-catalog-i18n` follow-up 에 위임 (`plan/in-progress/cafe24-catalog-i18n.md`)
- W9: 신규 catalog endpoint 인증 가드 e2e 검증 — 별도 PR scope (기존 컨트롤러 글로벌 JWT 가드 적용 패턴과 동일)
- I15: `IntegrationActivityItemDto` 기존 필드 (`createdAt` 등) entity drift — pre-existing, 별도 PR
- INFO #3 (clampApiField `max<=1` 엣지케이스): 방어 코드로 충분, follow-up 선택
- INFO #5 (`getServiceCatalog` well-known operation assertion): INFO 수준 유지, follow-up 선택
- INFO (frontend `renderApiCell`/`tryTranslateLabel` 단위 테스트 / ActivityTab catalog 쿼리 테스트 / e2e 신규 endpoint): plan Phase 7 follow-up
