# RESOLUTION — makeshop catalog (V-06/V-08) ai-review (session 07_33_31)

risk CRITICAL (Critical 1 + Warning 1 + INFO 17). **Critical #1 은 진짜 버그로 git/소스 검증 후 코드 수정**, Warning #1 수용(헬퍼 추출), INFO 는 수정/자연해소/백로그로 분류.

## 조치 항목

| # | 카테고리 | 판정 | 근거·조치 |
|---|----------|------|-----------|
| Critical #1 | Requirement (기능 버그) | **수정 완료 (진짜 버그)** | `tryTranslateLabel` 이 `t("makeshopCatalog.makeshop.shop.get-authority")` 호출 → i18n `resolve()` (core.ts L23-30) 가 `key.split(".")` 로 **모든 점**을 분리해 nested 순회 → `dict["makeshopCatalog"]["makeshop"]` = undefined (flat dict 는 `"makeshop.shop.get-authority"` 전체가 단일 키) → null → 라벨 렌더 불가. makeshopCatalog dict 가 채워져도 V-08 가 작동 안 함을 git/core.ts 로 확인. **수정**: makeshop/cafe24 분기에서 `t()` 대신 flat-dict 직접 lookup 헬퍼 `resolve{Makeshop,Cafe24}OperationLabel(locale, key)` 사용 (기존 makeshop 노드 드롭다운이 쓰는 동일 우회 — makeshop-extras.ts L43 주석이 명시). `tryTranslateLabel(catalogKey, locale)` 시그니처 변경, `renderApiCell`·`ActivityTab` 에 `useLocale()` 주입. |
| Warning #1 | Maintainability (중복) | **수정 완료 (수용)** | `getServiceCatalog` cafe24/makeshop 이중 분기를 module-scope 헬퍼 `buildOperationCatalog(provider, ops)` 로 추출 — `key`/`labelKey` 동일성·`descriptionKey` suffix 규칙 단일화. 새 provider 는 분기 한 줄만 추가. |
| INFO #6/#10/#11 | 보안(low)/유지보수 | **자연 해소** | Critical fix 로 `t()` + `fullKey` 이중 prefix 구조가 제거되고 flat-dict 헬퍼로 대체돼 — i18n 키 조립(#6)·else-if namespace 체인(#10)·fullKey 주석(#11) 모두 무관화. |
| INFO #13/#16 | 테스트/문서 | **수정 완료** | cafe24·makeshop catalog 테스트에 `descriptionKey === \`${key}.description\`` 단언 추가(#13). controller Swagger·service JSDoc·테스트 주석에 `makeshop-api-metadata.md §2` 참조 추가(#16). |
| INFO #1 | SPEC-DRIFT | **spec 영역 — consistency-check 위임** | spec §9.3 본문 표(L816)는 이미 "cafe24·makeshop 만 채워 반환"으로 정확(코드 일치). Rationale L1147 "왜 초기엔 cafe24 만 응답하나" 는 makeshop 도입 전 작성된 역사 서술 — developer 는 spec read-only 라 `/consistency-check --impl-done` 결과에 따라 처리(BLOCK 시 planner 위임). |
| INFO #2 | Requirement (pre-existing) | **백로그** | spec §9.3 "미지원 `:type` 은 일반 404" 미반영 — 코드는 빈 배열 200. 본 PR 변경 아님(makeshop 추가는 이 분기 불변). 별도 백로그: 미등록 type `NotFoundException`. |
| INFO #3/#5/#7/#15 | 보안(low)/문서 (pre-existing) | **백로그** | previewTest 에러 메시지 입력 반사(#3), `@Param('type')` whitelist pipe(#5), oauthBegin clientSecret audit 마스킹(#7), `appUrl` JSDoc "cafe24 한정" 표현(#15) — 모두 본 PR 무관 pre-existing·저위험. integrations 모듈 정리 백로그. |
| INFO #4 | 보안(low) | **백로그** | 테스트 픽스처 `ya29-secret` 시크릿 스캐너 오탐 — 기존 픽스처, 본 PR 무관. 더미 형식 교체 백로그. |
| INFO #8/#9/#17 | 유지보수/문서 | **수용(현행)** | `serviceType: string` 느슨(#8 — 헬퍼는 `'cafe24'\|'makeshop'` union 사용, 공개 메서드 계약은 string 유지가 NestJS `@Param` 과 정합), `@ApiParam example:'cafe24'`(#9 — description 이 양쪽 명시, example 은 대표값 하나로 충분), JSDoc `@see` glob 경로(#17 — 기존 프로젝트 관례) — 현행 유지. |
| INFO #12/#14 | 테스트 | **백로그** | frontend `tryTranslateLabel`/`renderApiCell` 단위 테스트(#12 — page.tsx 내부 비공개 함수 추출 선행 필요. 핵심 flat-lookup 로직은 `resolve{Cafe24,Makeshop}OperationLabel` 의 기존 테스트로 커버됨), `integrations.controller.spec.ts` 신설(#14) — 테스트 강화 백로그. |

## TEST 결과

- backend build : 통과 (nest build)
- backend unit  : 통과 (getServiceCatalog 3 passed — cafe24/makeshop/unsupported, descriptionKey 단언 포함)
- frontend lint : 통과 (eslint page.tsx)
- frontend tsc  : 통과 (전체 0 error, packages dist 부트스트랩 후)

## 후속·백로그 항목

- INFO #2 (미지원 type 404), #3/#5/#7/#15 (integrations 모듈 보안/문서 pre-existing), #4 (테스트 픽스처), #12/#14 (frontend·controller 단위 테스트) — 별도 백로그. 본 PR 은 V-06/V-08 makeshop catalog 범위로 한정.
