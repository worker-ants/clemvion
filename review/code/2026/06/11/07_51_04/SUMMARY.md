# Code Review 통합 보고서

## 전체 위험도
**LOW** — 기능 추가 자체는 안전하나, spec §9.3 의 미지원 타입 404 반환 정책 미구현(이번 PR이 잘못된 동작을 테스트로 정식화) + 프론트엔드 `tryTranslateLabel` 순수 함수 단위 테스트 부재가 경고 수준.

## Critical 발견사항

_없음_

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement | `getServiceCatalog`: 완전 미지원 `:type`에 spec §9.3 명시 404 미반환 — 이번 PR이 테스트 서술을 `'unsupported service types'`로 바꾸고 `'unknown'`을 명시 포함해 잘못된 동작을 정식화함 | `integrations.service.ts` `getServiceCatalog()` (~L1199), `integrations.service.spec.ts` | `KNOWN_EMPTY` Set(http/database/email/webhook/mcp/google/github)에서 `{ operations: [] }` 반환, 그 외엔 `NotFoundException` 던지도록 분기 수정; 테스트도 `unknown` 케이스를 별도 블록에서 `NotFoundException`으로 기대하도록 분리 |
| 2 | testing | `tryTranslateLabel` provider prefix 분기 로직(makeshop→resolveMakeshop, cafe24→resolveCafe24, 그 외→null) 에 대한 직접 단위 테스트 부재 — 향후 cafe24 dict 충전 또는 새 provider 추가 시 무음 회귀 위험 | `page.tsx` `tryTranslateLabel` (~L3545–3567) | `__tests__/render-api-cell.test.ts` 또는 vitest 테스트 추가; makeshop prefix 매핑 있음/없음, cafe24 prefix, 알 수 없는 prefix(null), null apiLabel 총 4 케이스 커버 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `spec/2-navigation/4-integration.md §9.3 Rationale`의 "왜 초기엔 cafe24 만 응답하나" 단락이 makeshop 추가 이후에도 `cafe24 만`이라는 구표현 유지 — spec 본문(L816)은 이미 갱신됨 | `spec/2-navigation/4-integration.md` §9.3 Rationale (~L1147) | `project-planner` spec 갱신: `cafe24 만` → `cafe24 · makeshop` |
| 2 | architecture | `getServiceCatalog` if-chain이 `INTEGRATION_DERIVED_REGISTRY` Map 레지스트리 패턴과 불일치 — provider 3개 이상 시 shotgun surgery 위험 | `integrations.service.ts` `getServiceCatalog()` (~L1189–1206) | `CATALOG_REGISTRY: Map<string, () => OperationCatalogDto>` 패턴 도입 고려 (현재 2 provider에서는 즉각 강제 불필요) |
| 3 | architecture | `tryTranslateLabel`의 provider prefix 분기가 프레젠테이션 레이어에 잔류 — provider 추가마다 페이지 파일 수정 필요 | `page.tsx` `tryTranslateLabel` (~L3557–3567) | `lib/node-definitions/` 레이어에 `resolveOperationLabel(locale, catalogKey)` 단일 함수 중앙화 |
| 4 | architecture | `buildOperationCatalog` 타입 리터럴 유니언(`'cafe24' \| 'makeshop'`)이 OCP를 약하게 위반 | `integrations.service.ts` `buildOperationCatalog` 시그니처 | `string`으로 완화하거나 레지스트리 패턴 통합 시 자연해소 |
| 5 | documentation | `IntegrationMeta` JSDoc "Only Cafe24 currently emits anything here." — makeshop도 appUrl 생성 | `integrations.service.ts` `IntegrationMeta` JSDoc | "Cafe24 emits `appType`; makeshop emits `appUrl` when an installToken is present."으로 수정 |
| 6 | documentation | `PublicIntegration.appUrl` JSDoc "그 외 통합은 항상 `null`" — makeshop도 appUrl 생성 | `integrations.service.ts` `PublicIntegration.appUrl` JSDoc | "Cafe24 Private 및 MakeShop 통합의 actionable URL"으로 수정 |
| 7 | documentation | `tryTranslateLabel` JSDoc `@see` 링크가 cafe24 plan 문서만 참조 — makeshop dict 완료 상태 미반영 | `page.tsx` `tryTranslateLabel` JSDoc | `@see` 섹션에 makeshop dict 완료 상태 또는 `spec/conventions/makeshop-api-metadata.md §2` 참조 추가 |
| 8 | testing | `buildOperationCatalog` 헬퍼가 `export` 되지 않아 독립 단위 테스트 불가 — 현재는 `getServiceCatalog` 테스트로 간접 커버 | `integrations.service.ts` `buildOperationCatalog` | 향후 provider 추가 시 `export function buildOperationCatalog(…)` 공개 후 단위 테스트 분리 고려 |
| 9 | testing | `getServiceCatalog('makeshop')` 테스트가 `operations.length > 0`만 확인 — 정확한 161건 단언 없음 | `integrations.service.spec.ts` (~L652–663) | 필요 시 `expect(result.operations.length).toBe(161)` 추가 |
| 10 | security | `previewTest` 에러 메시지에 사용자 입력 값(`serviceType`/`authType`) 포함 — 기존 코드, 이번 변경과 무관 | `integrations.controller.ts` (~L225–230) | 에러 메시지 고정 문자열화 또는 로그 기록 시 sanitize — 현재 변경 범위 외 |
| 11 | architecture | `oauthBegin` 컨트롤러에 provider-specific `providerMeta` 조립 로직 잔류 — 기존 부채, 이번 변경 아님 | `integrations.controller.ts` `oauthBegin()` (~L256–277) | `buildProviderMeta(service, body)` 서비스 레이어 추출 고려 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인젝션·시크릿·인증 취약점 없음; previewTest 에러 메시지 INFO 기록 |
| architecture | LOW | if-chain OCP 위반·레지스트리 패턴 불일치·프레젠테이션 레이어 provider 분기 잔류 (모두 INFO) |
| requirement | LOW | 미지원 타입 404 미반환(WARNING) + SPEC-DRIFT Rationale 갱신 필요(INFO) |
| scope | NONE | 5개 파일 모두 단일 목적에 집중, 무관한 수정 없음 |
| side_effect | NONE | 순수 함수·파일 로컬 시그니처 변경·문서 수정으로 부작용 없음 |
| maintainability | NONE | buildOperationCatalog 헬퍼 추출로 DRY 개선; 모든 발견 INFO |
| testing | LOW | tryTranslateLabel 단위 테스트 부재(WARNING); 백엔드 커버리지는 양호 |
| documentation | LOW | IntegrationMeta·appUrl JSDoc 오도적 표현 (모두 INFO) |
| api_contract | NONE | breaking change 없음; OperationCatalogDto 스키마 일관 준수 |

## 발견 없는 에이전트

- **scope** — 변경 범위 이탈 없음
- **side_effect** — 의도하지 않은 부작용 없음
- **api_contract** — API 계약 위반 없음

## 권장 조치사항

1. **(WARNING-1 수정)** `getServiceCatalog` fall-through를 `KNOWN_EMPTY` Set 분기 + `NotFoundException` 으로 교체; 테스트에서 `'unknown'` 케이스를 `NotFoundException` 기대로 분리 — spec §9.3 준수 회복
2. **(WARNING-2 수정)** `tryTranslateLabel` 4개 분기 케이스(makeshop prefix 있음/없음, cafe24 prefix, 알 수 없는 prefix, null apiLabel)에 대한 순수 함수 단위 테스트 추가
3. **(SPEC-DRIFT)** `spec/2-navigation/4-integration.md §9.3 Rationale` "cafe24 만" → "cafe24 · makeshop" 갱신 (`project-planner` 위임)
4. **(INFO 문서)** `IntegrationMeta` 및 `PublicIntegration.appUrl` JSDoc에서 "Only Cafe24"/"그 외 통합은 null" 표현을 makeshop appUrl 생성 사실 반영하여 수정
5. **(INFO 아키텍처)** `CATALOG_REGISTRY` Map 패턴 도입을 tech debt 으로 기록 — provider 3개 이상 시 적용 권장

## 라우터 결정

라우터 결정 (`routing_status=done`):

- **실행**: `security`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `api_contract` (9명)
- **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명)
- **제외**: (5명)

| 제외된 reviewer | 이유 |
|-----------------|------|
| performance | 라우터 판단: 해당 없음 (정적 메타데이터 조회, 성능 임계 경로 없음) |
| dependency | 라우터 판단: 신규 외부 의존성 없음 |
| database | 라우터 판단: DB 스키마/쿼리 변경 없음 |
| concurrency | 라우터 판단: 동시성 관련 변경 없음 |
| user_guide_sync | 라우터 판단: 사용자 가이드 문서 변경 없음 |