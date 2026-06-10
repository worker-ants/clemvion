# Code Review 통합 보고서

## 전체 위험도
**CRITICAL** — 프론트엔드 `tryTranslateLabel` 의 MakeShop i18n 분기가 `t()` nested-key 순회와 flat dotted-key 구조 충돌로 인해 Activity 탭 MakeShop 라벨이 실제로 렌더되지 않음. 배포 전 수정 필요.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 요구사항(기능 버그) | `tryTranslateLabel` 이 MakeShop 키(`makeshop.*`)에 대해 `t(fullKey)` 를 호출하면 `dict["makeshopCatalog"]["makeshop"]` 경로를 순회하나, `makeshopCatalog` dict 는 `"makeshop.shop.get-authority"` 를 **flat 단일 JS 객체 키**로 저장해 `undefined` 반환 → `null` fallback → 라벨 렌더 불가. 기존 `resolveMakeshopOperationLabel` 이 이미 flat dict 직접 lookup 으로 우회한다는 사실이 `makeshop-extras.ts` 주석에 명시되어 있음에도 `tryTranslateLabel` 은 같은 우회 없이 `t()` 를 그대로 사용 | `codebase/frontend/src/app/(main)/integrations/[id]/page.tsx` L830–841 (`tryTranslateLabel`) | `makeshop.*` 키에 대해 `t()` 대신 `resolveMakeshopOperationLabel(locale, catalogKey)` 를 직접 호출하도록 수정. 또는 `makeshopCatalog` 를 page.tsx 로 직접 import 해 flat dict lookup 인라인 수행 |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 유지보수성(중복 로직) | `getServiceCatalog` 의 cafe24/makeshop 두 분기가 `listAll<X>Operations()` 호출 + `provider.${resource}.${operation.id}` 키 조립 외 동일 로직을 복붙. 세 번째 provider 추가 시 shotgun surgery 발생 | `codebase/backend/src/modules/integrations/integrations.service.ts` L1167–1191 | 공통 헬퍼 `mapOperationsToCatalog(provider, ops)` 추출 또는 `provider → listFn` Map 디스패치로 리팩토링 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `integrations.controller.ts` Swagger `@ApiOperation.description` 이 "초기엔 cafe24 만" → "cafe24·makeshop" 으로 갱신됨. spec §9.3 은 이미 두 타입 모두 명시하므로 코드·spec 일치 상태. (Swagger 갱신이 spec 을 따라잡은 것) | `integrations.controller.ts` L37, L43 | spec §9.3 에 "초기엔 cafe24 만" 잔존 문구가 있다면 삭제 필요 — spec 갱신 여부 확인 |
| 2 | 요구사항(pre-existing) | spec §9.3 "미지원 `:type` 은 일반 404" 를 미반영 — 현재 코드는 미등록 타입에도 빈 배열 200 반환. 이번 PR 변경 사항 아님 | `integrations.service.ts` L1191 | 별도 백로그: 미등록 타입에 `NotFoundException` 반환 |
| 3 | 보안(low) | `previewTest` 에러 메시지에 `serviceType`/`authType` 사용자 입력 반사. 현재는 저위험이나 미래 확장 시 선례 | `integrations.controller.ts` L226–229 | 에러 메시지를 고정 문자열로 교체하거나 whitelist 검증 명시 |
| 4 | 보안(low) | 테스트 픽스처 `ya29-secret` 패턴이 gitleaks/truffleHog 등 시크릿 스캐너 false positive 유발 가능 | `integrations.service.spec.ts` | 픽스처를 `fake-access-token`, `test-client-secret` 등 명시적 더미 형식으로 교체 |
| 5 | 보안(low) | `getServiceCatalog` `@Param('type')` 에 whitelist validation pipe 없음. 현재는 문자열 동등 비교로 안전하나 미래 확장 시 위험 | `integrations.controller.ts` L196–198 | `@IsIn(['cafe24', 'makeshop'])` 또는 동등 validation pipe 추가 |
| 6 | 보안(low) | 프론트엔드 `tryTranslateLabel` — `catalogKey` 가 i18n 키에 직접 조립됨. 카탈로그는 정적 메타데이터에서 빌드되므로 저위험 | `page.tsx` `tryTranslateLabel` | 서버에서 `key`/`labelKey` 포맷 검증(`/^[a-z0-9_.]+$/i`) 확인 |
| 7 | 보안(low) | `oauthBegin` 에서 MakeShop `clientSecret` 이 `providerMeta` 로 전달 시 audit log 마스킹 여부 미확인 | `integrations.controller.ts` L267–274 | `oauthService.begin()` 하위 audit 경로에서 `client_secret` 마스킹 처리 검증 |
| 8 | 유지보수성 | `getServiceCatalog` `serviceType` 파라미터 타입이 `string` 으로 느슨 | `integrations.service.ts` L1166 | `ServiceType` union 타입으로 좁히거나 JSDoc 유효값 열거 |
| 9 | 유지보수성 | `@ApiParam` `example: 'cafe24'` 가 갱신 안 됨 — description 은 cafe24·makeshop 양쪽 언급하나 example 은 cafe24 고정 | `integrations.controller.ts` L43 | `example: 'makeshop'` 으로 교체 또는 `examples` 객체로 두 값 노출 |
| 10 | 유지보수성 | `tryTranslateLabel` namespace 선택이 else-if 체인으로 provider 추가마다 수동 확장 필요 | `page.tsx` L3539–3543 | `CATALOG_NAMESPACE: Record<string, string>` 맵 상수로 교체 |
| 11 | 유지보수성 | `fullKey = \`${namespace}.${catalogKey}\`` 이중 prefix 구조(`makeshopCatalog.makeshop.*`)가 코드 주석에 설명 없음 | `page.tsx` L3545 | 함수 JSDoc 또는 인라인 주석에 fullKey 형식 예시 추가 |
| 12 | 테스트 | `tryTranslateLabel` / `renderApiCell` 순수 함수 단위 테스트 전무. 분기 로직 3단계로 확장됐으나 커버 없음 | `page.tsx` / `[id]/__tests__/` | `activity-helpers.test.ts` 신설 (makeshop·cafe24·unknown prefix·i18n miss 케이스 최소 5개) |
| 13 | 테스트 | `getServiceCatalog('makeshop')` 서비스 레이어 테스트에 `descriptionKey` 포맷 및 `operations.length === 161` 단언 없음 | `integrations.service.spec.ts` | `expect(sample.descriptionKey).toBe(\`${sample.key}.description\`)` 및 length 단언 추가 |
| 14 | 테스트 | `integrations.controller.spec.ts` 미존재 — 컨트롤러 레이어 회귀 안전망 없음 | `integrations.controller.ts` | 백로그 등록: `type='cafe24'·'makeshop'·'unknown'` 세 케이스 NestJS 컨트롤러 단위 테스트 |
| 15 | 문서화 | `PublicIntegration.appUrl` JSDoc 이 "Cafe24 Private 통합 한정" 이라고 오해 유발 — makeshop 도 `appUrl` 채움 | `integrations.service.ts` L2491~2500 전후 | "cafe24 Private 또는 makeshop(ShopStore 설치 URL)이 채울 수 있는 URL" 로 확장 |
| 16 | 문서화 | 새 테스트 케이스 주석의 spec 참조에 `spec/conventions/makeshop-api-metadata.md §2` 누락 | `integrations.service.spec.ts` 신규 테스트 | 주석에 해당 spec 참조 추가 |
| 17 | 문서화 | `tryTranslateLabel` JSDoc `@see` 참조 경로가 glob 문법·상대경로로 IDE 탐색 불가 | `page.tsx` `tryTranslateLabel` JSDoc | 절대 레포 경로(`/codebase/frontend/src/lib/i18n/dict/...`)로 교체 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | CRITICAL | `tryTranslateLabel` MakeShop i18n nested-key vs flat dict 충돌로 Activity 탭 라벨 렌더 불가 |
| security | LOW | 테스트 픽스처 `ya29-secret` 시크릿 스캐너 false positive, 에러 메시지 입력 반사 패턴 등 INFO 4건 |
| maintainability | LOW | `getServiceCatalog` 이중 분기 중복(WARNING 1건), Swagger example·타입 느슨함 등 INFO 3건 |
| testing | LOW | `tryTranslateLabel`·`renderApiCell` 프론트엔드 단위 테스트 전무, descriptionKey 검증 누락 등 INFO 4건 |
| documentation | LOW | `appUrl` JSDoc "Cafe24 전용" 오해 표현, ApiParam example 미갱신 등 INFO 5건 |
| scope | NONE | 모든 변경이 단일 목적에 집중, 무관 파일 수정 없음 |
| side_effect | NONE | 전역 상태 변경 없음, 공개 API 시그니처 변경 없음, 후방 호환 유지 |
| api_contract | NONE | breaking change 없음, 기존 DTO 스키마 일관성 유지, 하위 호환성 완전 보존 |

## 발견 없는 에이전트

- **scope** — 모든 변경이 의도된 범위 내, over-engineering 없음
- **side_effect** — 런타임 부작용 없음, 공개 API 시그니처 변경 없음
- **api_contract** — API 계약 위반 없음, breaking change 없음

## 권장 조치사항

1. **[필수/배포 차단]** `tryTranslateLabel` 의 MakeShop 분기에서 `t()` 대신 `resolveMakeshopOperationLabel(locale, catalogKey)` 직접 호출로 교체 — i18n nested-key 순회와 flat dotted-key 구조 충돌 해소
2. **[권장]** `getServiceCatalog` 의 cafe24/makeshop 이중 분기를 공통 헬퍼 또는 Map 디스패치로 리팩토링 — 세 번째 provider 추가 시 shotgun surgery 방지
3. **[권장]** `tryTranslateLabel` 단위 테스트 신설 (`activity-helpers.test.ts`) — makeshop·cafe24·unknown prefix·i18n miss 최소 5 케이스
4. **[권장]** `getServiceCatalog('makeshop')` 서비스 레이어 테스트에 `descriptionKey` 포맷 및 `operations.length === 161` 단언 추가
5. **[마이너]** `@ApiParam example: 'cafe24'` → `'makeshop'` 또는 `examples` 맵으로 양쪽 노출
6. **[마이너]** `PublicIntegration.appUrl` JSDoc "Cafe24 Private 통합 한정" 표현 수정 — makeshop 도 포함하도록 확장
7. **[마이너]** 테스트 픽스처 `ya29-secret` → `fake-access-token` 등 시크릿 스캐너 오탐 방지 더미 형식으로 교체
8. **[백로그]** spec §9.3 "미지원 `:type` 은 일반 404" 미반영 pre-existing 이슈 — `NotFoundException` 반환 추가
9. **[백로그]** `integrations.controller.spec.ts` 신설 — NestJS 컨트롤러 단위 테스트 (cafe24·makeshop·unknown 3케이스)

## 라우터 결정

라우터가 선별 실행함.

- **실행 (forced / router_safety)**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `api_contract` (8명 전원 강제 포함)
- **제외**: `performance`, `architecture`, `dependency`, `database`, `concurrency`, `user_guide_sync` (6명)

| 제외된 reviewer | 이유 |
|------------------|------|
| performance | router_safety 강제 목록에 미포함 (변경이 정적 메타데이터 반환 분기 추가로 성능 영향 없음으로 판단) |
| architecture | router_safety 강제 목록에 미포함 |
| dependency | router_safety 강제 목록에 미포함 |
| database | router_safety 강제 목록에 미포함 |
| concurrency | router_safety 강제 목록에 미포함 |
| user_guide_sync | router_safety 강제 목록에 미포함 |

- **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명) + `api_contract` (라우터 실행 포함)