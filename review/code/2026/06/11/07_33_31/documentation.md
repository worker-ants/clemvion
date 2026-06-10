# 문서화(Documentation) 리뷰

## 발견사항

### [INFO] getServiceCatalog JSDoc 의 spec 참조가 업데이트됐으나 `IntegrationDerivedFields.appUrl` JSDoc 은 cafe24 전용 설명으로 잔존
- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/integrations/integrations.service.ts` — `PublicIntegration.appUrl` 필드 JSDoc (라인 2491~2500 전후)
- 상세: `appUrl` JSDoc 본문이 `"Cafe24 Private 통합 한정의 actionable URL"` 이라고 명시하면서 cafe24 전용 URL 형식만 예시로 기재하고 있다. 그러나 이번 PR 로 makeshop 도 `appUrl` 을 `buildMakeshopInstallUrl` 로 채우게 됐으므로, "Cafe24 Private 통합 한정" 이라는 표현이 사실과 불일치한다. `INTEGRATION_DERIVED_REGISTRY` 의 makeshop 엔트리 주석(`// makeshop — no app_type...`)은 올바르게 설명하고 있으나 `PublicIntegration` 의 공개 API 필드 JSDoc 은 갱신되지 않았다.
- 제안: `appUrl` 필드 JSDoc 을 "cafe24 Private 또는 makeshop(ShopStore 설치 URL)이 채울 수 있는 actionable URL" 로 확장하거나, 최소한 "Cafe24 Private 통합 한정" 표현을 제거하고 서비스별 URL 형식을 나열해야 한다.

### [INFO] `ApiParam` example 이 `cafe24` 만 가리킴 — makeshop 지원 추가 후 예제 업데이트 미완
- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/integrations/integrations.controller.ts` — `@ApiParam` 의 `example: 'cafe24'` (라인 43)
- 상세: `description` 은 `cafe24 · makeshop (operations 목록 반환)` 으로 갱신됐으나 `example` 값은 여전히 `'cafe24'` 다. Swagger UI 에서 Try it out 클릭 시 makeshop 이 default 예시로 노출되지 않아 신규 지원 범위를 확인하기 어렵다. 사소하나 API 문서 관점에서 일관성 결여.
- 제안: `example: 'makeshop'` 또는 description 과 동일하게 `'cafe24'` 유지하되 note 를 추가하거나, Swagger `examples` 맵으로 두 값을 함께 노출하는 것을 검토.

### [INFO] 테스트 케이스 주석의 spec 참조 섹션 번호가 부분적으로 갱신됨
- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/integrations/integrations.service.spec.ts` — 새로 추가된 `'returns makeshop operations as …'` 케이스 (라인 652~657)
- 상세: 해당 테스트 인라인 주석 `// makeshop catalog key/labelKey = … spec §9.3 초기 응답 정책.` 은 spec 섹션만 가리키고 `spec/conventions/makeshop-api-metadata.md §2` 로의 참조가 누락돼 있다. 이미 `getServiceCatalog` JSDoc 이나 controller 의 `@ApiOperation` 설명에는 두 spec 참조가 모두 포함돼 있다.
- 제안: 주석에 `spec/conventions/makeshop-api-metadata.md §2` 를 추가해 테스트 독자가 기대 동작의 근거를 빠르게 찾을 수 있도록 한다.

### [INFO] `tryTranslateLabel` JSDoc 에서 `@see` 참조 경로가 파일명 없이 플래인 텍스트로 표기
- 위치: `/Volumes/project/private/clemvion/codebase/frontend/src/app/(main)/integrations/[id]/page.tsx` — `tryTranslateLabel` 함수 JSDoc (라인 3527~3536)
- 상세: `SoT: dict/{ko,en}/{cafe24,makeshop}Catalog.ts` 는 glob 문법으로 표기되어 있어 IDE 에서 파일로 바로 이동이 불가하다. 또한 `@see plan/in-progress/cafe24-catalog-i18n.md` 가 plan 파일 절대경로 없이 상대 경로로 기재되어 있어 레포 루트 기준 경로가 불분명하다.
- 제안: 실제 i18n dict 파일 경로를 개별로 열거하거나, `@see` 태그를 VSCode/TypeScript LSP 에서 탐색 가능한 절대 레포 경로(`/codebase/frontend/src/lib/i18n/dict/...`)로 교체한다.

### [INFO] plan 파일 체크리스트 항목 업데이트는 적절하나 변경 이력 이중 기술 가능성 존재
- 위치: `/Volumes/project/private/clemvion/plan/in-progress/spec-code-cross-audit-2026-06-10.md`
- 상세: V-06·V-08 해소 항목이 추가됐고 잔여 목록이 올바르게 좁혀졌다. 문서화 관점에서 특이 사항은 없다. 다만 동일 해소 사실이 plan 파일과 향후 CHANGELOG/리뷰 산출물 양쪽에 동시에 기록될 경우 중복 관리 부담이 발생할 수 있음을 INFO 로 기재.
- 제안: plan 파일은 진행 상태 추적용으로 현재 수준 유지 적합. CHANGELOG 가 별도 존재한다면 동기화 규칙 명시 고려.

## 요약

이번 PR 의 문서화 품질은 전반적으로 양호하다. `@ApiOperation` 설명·`@ApiParam` 설명·`getServiceCatalog` JSDoc 주석 모두 makeshop 지원 추가를 반영해 갱신됐으며, `tryTranslateLabel` 함수 JSDoc 도 provider-prefix 분기 로직을 명확히 설명한다. 개선 여지는 주로 세부 일관성 수준이다: (1) `PublicIntegration.appUrl` 의 JSDoc 이 "Cafe24 Private 전용" 이라고 오해를 유발하는 표현을 여전히 포함하고, (2) `@ApiParam` 의 `example` 값이 description 갱신과 맞지 않으며, (3) 새 테스트 케이스 주석의 spec 참조가 불완전하다. 이 세 항목 모두 런타임 동작에 영향을 주지 않는 문서 일관성 문제이므로 INFO 등급으로 분류한다.

## 위험도

LOW
