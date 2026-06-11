# 문서화(Documentation) 리뷰 결과

## 발견사항

### [INFO] `IntegrationMeta` JSDoc이 makeshop 추가를 반영하지 않음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/makeshop-catalog-labels/codebase/backend/src/modules/integrations/integrations.service.ts`, `IntegrationMeta` 인터페이스 JSDoc
- 상세: 현재 JSDoc에 "Only Cafe24 currently emits anything here."라는 문구가 있으나, makeshop도 이제 `INTEGRATION_DERIVED_REGISTRY`에 등록되어 `appUrl`을 방출한다. `appType` 필드는 여전히 makeshop에서 null이지만 `appUrl`은 makeshop도 생성하므로 주석이 오도적이다.
- 제안: "Only Cafe24 currently emits anything here." 부분을 "Cafe24 emits `appType`; makeshop emits `appUrl` when an installToken is present." 등으로 수정.

### [INFO] `PublicIntegration.appUrl` JSDoc이 cafe24 전용으로 표현됨
- 위치: 동일 파일, `PublicIntegration` 타입의 `appUrl` 필드 JSDoc
- 상세: "Cafe24 Private 통합 한정의 actionable URL. ... 그 외 통합은 항상 `null`." 이라고 명시되어 있으나 makeshop도 이제 `appUrl`을 생성한다. 테스트("builds the makeshop ShopStore install App URL")가 이를 검증하고 있으나 DTO 문서는 갱신되지 않았다.
- 제안: "Cafe24 Private 및 MakeShop 통합의 actionable URL. `${APP_URL}/api/3rd-party/{cafe24,makeshop}/install/:installToken` 형식이며, 그 외 통합은 항상 `null`." 으로 수정.

### [INFO] `buildOperationCatalog` provider 타입 리터럴이 확장 가능성 미반영
- 위치: 동일 파일, `buildOperationCatalog` 함수 JSDoc
- 상세: JSDoc에 "새 provider 추가 시 분기 한 줄만 늘리면 된다"고 언급하나 함수 시그니처의 `provider: 'cafe24' | 'makeshop'` 타입 리터럴은 새 provider 추가 시 이 함수 자체도 수정해야 함을 강제한다. JSDoc 설명과 실제 시그니처 사이에 약간의 불일치가 있다. 이는 기능적 결함은 아니나 문서 정확성 관점에서 혼동을 줄 수 있다.
- 제안: JSDoc에 "provider 타입 리터럴도 함께 확장할 것" 한 줄 추가 또는 `provider: string`으로 완화.

### [INFO] `tryTranslateLabel` JSDoc의 `@see` 링크가 cafe24 전용 plan 문서만 참조
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/makeshop-catalog-labels/codebase/frontend/src/app/(main)/integrations/[id]/page.tsx`, `tryTranslateLabel` 함수 JSDoc
- 상세: `@see plan/in-progress/cafe24-catalog-i18n.md` 한 항목만 있다. makeshop dict는 이미 채워진 상태이므로 관련 spec 참조(`spec/conventions/makeshop-api-metadata.md §2`) 또는 구현 증거가 없다. cafe24 follow-up과 달리 makeshop은 현재 완성 상태임을 명시하면 독자가 현황을 빠르게 파악할 수 있다.
- 제안: `@see` 섹션에 makeshop dict 완료 상태 주석 또는 관련 spec 참조 한 줄 추가.

### [INFO] `spec-code-cross-audit-2026-06-10.md` plan 업데이트는 적절하나 V-08 수정 내용이 추상적
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/makeshop-catalog-labels/plan/in-progress/spec-code-cross-audit-2026-06-10.md`
- 상세: "tryTranslateLabel provider-prefix 일반화"라고 기재되어 있으나, 실제로 `locale` 기반 flat dict lookup 방식으로 i18n 전략 자체가 변경된 것(`t()` nest-traversal → `resolve*OperationLabel` flat lookup)이 핵심이다. 변경 이력 추적 측면에서 약간 더 구체적인 기술이 도움이 된다.
- 제안: "tryTranslateLabel: t() i18n 의존 제거 → locale 기반 flat dict lookup(resolve{Cafe24,Makeshop}OperationLabel) 일반화" 정도로 상세화. 낮은 우선순위 — plan 문서는 추적용이며 코드 정확성에 영향 없음.

## 요약

이번 변경은 makeshop catalog 지원을 백엔드/프론트엔드에 추가한 기능 확장이다. Swagger API 문서(`@ApiOperation`, `@ApiParam`)는 즉시 `cafe24 · makeshop` 지원으로 정확하게 갱신되었고, 백엔드 `getServiceCatalog` 메서드 JSDoc도 makeshop 추가를 반영한다. 신규 `buildOperationCatalog` 헬퍼와 `tryTranslateLabel` 변경 모두 인라인 주석이 충분하다. 다만 `IntegrationMeta` JSDoc의 "Only Cafe24 currently emits" 문구와 `PublicIntegration.appUrl` JSDoc의 "그 외 통합은 항상 null" 표현이 makeshop이 appUrl을 생성하는 현실과 불일치하여 독자에게 오도적이다. 이 두 곳은 INFO 수준이지만 향후 코드 독자 혼란을 방지하기 위해 수정이 권장된다. 전반적으로 문서화 품질은 양호하며 CHANGELOG나 별도 README 갱신이 필요한 공개 API 계약 변경은 없다.

## 위험도

LOW
