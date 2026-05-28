# 유저 가이드 동반 갱신(User Guide Sync) 검토 결과

검토 일시: 2026-05-28
대상 커밋: `07364df9` — feat(cafe24): Cafe24OperationMetadata.label 제거 + frontend i18n dict 일원화

## PROJECT.md 매트릭스 적재 확인

§변경 유형 → 갱신 위치 매핑 표를 읽어 현재 매트릭스를 SoT 로 적재했습니다. 표의 trigger 총 18개 항목 중 아래와 같이 매칭을 수행했습니다.

## 변경 파일 식별

리뷰 대상 변경 set(커밋 `07364df9`)에 포함된 파일:

**Backend (metadata 파일 — label 필드 제거):**
- `codebase/backend/src/nodes/integration/cafe24/metadata/application.ts`
- `codebase/backend/src/nodes/integration/cafe24/metadata/category.ts`
- `codebase/backend/src/nodes/integration/cafe24/metadata/collection.ts`
- `codebase/backend/src/nodes/integration/cafe24/metadata/community.ts`
- `codebase/backend/src/nodes/integration/cafe24/metadata/constraint-validator.spec.ts`
- `codebase/backend/src/nodes/integration/cafe24/metadata/customer.ts`
- `codebase/backend/src/nodes/integration/cafe24/metadata/design.ts`
- `codebase/backend/src/nodes/integration/cafe24/metadata/mileage.ts`
- `codebase/backend/src/nodes/integration/cafe24/metadata/notification.ts`
- `codebase/backend/src/nodes/integration/cafe24/metadata/order.ts`
- `codebase/backend/src/nodes/integration/cafe24/metadata/personal.ts`
- `codebase/backend/src/nodes/integration/cafe24/metadata/planned.ts`
- `codebase/backend/src/nodes/integration/cafe24/metadata/privacy.ts`
- `codebase/backend/src/nodes/integration/cafe24/metadata/product.ts`
- `codebase/backend/src/nodes/integration/cafe24/metadata/promotion.ts`
- `codebase/backend/src/nodes/integration/cafe24/metadata/public-meta.spec.ts`
- `codebase/backend/src/nodes/integration/cafe24/metadata/public-meta.ts`
- `codebase/backend/src/nodes/integration/cafe24/metadata/salesreport.ts`
- `codebase/backend/src/nodes/integration/cafe24/metadata/shipping.ts`
- `codebase/backend/src/nodes/integration/cafe24/metadata/store.ts`
- `codebase/backend/src/nodes/integration/cafe24/metadata/supply.ts`
- `codebase/backend/src/nodes/integration/cafe24/metadata/translation.ts`
- `codebase/backend/src/nodes/integration/cafe24/metadata/types.ts`

**Frontend:**
- `codebase/frontend/src/components/editor/settings-panel/node-configs/__tests__/cafe24-config.test.tsx`
- `codebase/frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx`
- `codebase/frontend/src/lib/node-definitions/types.ts`

**기타:**
- `plan/in-progress/cafe24-mcp-label-i18n.md`
- `review/consistency/2026/05/28/11_04_48/` (산출물 파일들)
- `spec/conventions/cafe24-api-metadata.md`

## trigger 매칭 결과

### Trigger 1: 통합/제공자 변경

매트릭스 항목: "통합 신규/제공자 변경" — `codebase/frontend/src/content/docs/06-integrations-and-config/<provider>.{mdx,en.mdx}` + dict 키

변경 파일 `codebase/backend/src/nodes/integration/cafe24/metadata/*.ts` 는 Cafe24 통합 provider 의 operation metadata 스키마 변경(label 필드 완전 제거, labelKey 도입)에 해당합니다. 이는 매트릭스 "통합 신규/제공자 변경" trigger 에 매칭됩니다.

**동반 갱신 확인:**
- `codebase/frontend/src/content/docs/06-integrations-and-config/cafe24.mdx` — 실존 확인. 변경 set 에는 포함되지 않음.
- `codebase/frontend/src/content/docs/06-integrations-and-config/cafe24.en.mdx` — 실존 확인. 변경 set 에는 포함되지 않음.
- `codebase/frontend/src/lib/i18n/dict/ko/cafe24Catalog.ts` — 이전 커밋 `e4f60f1e` 에서 500개 항목 적재 완료. 변경 set 내 존재함(선행 커밋).
- `codebase/frontend/src/lib/i18n/dict/en/cafe24Catalog.ts` — 동일, KO/EN 양쪽 500개 항목으로 parity 정상.

**MDX 갱신 필요성 평가:**

이번 변경의 본질은 사용자 가시 동작 변화가 아닌 **i18n 책임 위치 이동**입니다. 구체적으로:
- 기존: backend `Cafe24OperationMetadata.label` 에 한국어 hardcoded → API 응답에 `label` 필드로 노출
- 변경 후: backend 는 `labelKey` 만 노출, frontend `cafe24Catalog` dict 가 KO/EN 라벨을 결정

사용자가 노드 에디터에서 보는 operation 드롭다운 **라벨 텍스트 자체는 동일**합니다(동일한 한국어 라벨이 dict 에 등록되어 있음). 추가로 **영어 사용자에게 이제 영문 라벨이 올바르게 표시**되는 품질 개선이 생겼습니다.

`cafe24.mdx`는 이미 "Resource → Operation 두 번의 드롭다운" 으로 UX를 설명하고 있으며, 라벨 표시 방식(내부 i18n 구조) 이 유저 가이드에서 설명할 내용이 아닙니다. 따라서 docs MDX 갱신 누락은 **INFO** 수준으로 분류합니다 — 영문 사용자 경험 개선 사실을 가이드에 추가할 수 있으나 필수는 아닙니다.

### Trigger 2: 신규 backend zod ui.label/hint/group 값

매트릭스 항목: "신규 backend zod `ui.label` / `hint` / `group` / `itemLabel` 값" — `backend-labels.ts` 매핑 갱신

`integration-configs.tsx` 에서 새로 추가된 `resolveCafe24OperationLabel` 함수와 `useLocaleStore` 사용은 신규 UI 라벨 추가가 아닌, 기존 operation 라벨 조회 경로를 변경한 것입니다. TSX 에 새로운 한국어 하드코딩 리터럴이 추가되지 않았습니다(grep 확인). 이 trigger 는 **매칭되지 않습니다.**

### Trigger 3: i18n parity (ko/en 양쪽 등록)

`cafe24Catalog` KO/EN 양쪽 모두 500개 항목으로 정확히 parity 가 맞습니다. `codebase/frontend/src/lib/i18n/dict/ko/index.ts` 와 `dict/en/index.ts` 에도 `cafe24Catalog` 가 정상 export 됩니다.

**판정: PASS** — i18n parity 누락 없음.

### Trigger 4: 신규 warningCode/errorCode 발행

이번 변경에 새로운 warningCode 나 errorCode 추가는 없습니다. 이 trigger 는 **매칭되지 않습니다.**

### Trigger 5: 신규 섹션 디렉토리

`codebase/frontend/src/content/docs/` 하위에 새로운 섹션 디렉토리 추가 없음. 이 trigger 는 **매칭되지 않습니다.**

## 발견사항

### [INFO] cafe24 통합 docs MDX 에 영문 i18n 개선 사실 미반영

- 변경 파일: `codebase/backend/src/nodes/integration/cafe24/metadata/public-meta.ts`, `codebase/frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx`
- 매트릭스 항목: "통합 신규/제공자 변경" — `codebase/frontend/src/content/docs/06-integrations-and-config/<provider>.{mdx,en.mdx}` + dict 키
- 해당 파일: `codebase/frontend/src/content/docs/06-integrations-and-config/cafe24.mdx`, `codebase/frontend/src/content/docs/06-integrations-and-config/cafe24.en.mdx`
- 상세: 이번 변경으로 영문 로케일 사용자에게도 operation 드롭다운에 영문 라벨(`"List products"` 등)이 표시됩니다. 이전에는 한국어가 그대로 노출되던 회귀가 수정되는 것입니다. 사용자 가이드(`cafe24.mdx`)는 "Resource → Operation 두 번의 드롭다운" 만 안내하고 있어 UX 설명으로는 충분하나, 영문 가이드(`cafe24.en.mdx`)에서 영문 라벨 지원 사실을 명시하는 것이 사용자 신뢰도 향상에 도움이 됩니다. 단, **현재 docs가 틀린 정보를 담고 있지 않으므로** 필수 갱신이 아닙니다.
- 제안: 옵션 사항으로 `cafe24.en.mdx` 에 "Operation names are shown in your interface language" 수준의 한 줄 추가 가능. 긴급하지 않으므로 후속 docs polish PR 에서 처리 가능.

## 요약

PROJECT.md §변경 유형 → 갱신 위치 매핑 표에서 18개 trigger 항목을 검토한 결과, 이번 변경은 "통합 신규/제공자 변경" trigger 1개에 매칭됩니다. 핵심 동반 갱신 의무인 `cafe24Catalog` KO/EN dict(각 500개 항목)는 선행 커밋(`e4f60f1e`)에서 정상 등록되어 있고 KO/EN parity 도 맞습니다. `integration-configs.tsx` 에 신규 한국어 하드코딩 없음, backend-labels.ts 관련 변경 없음, 신규 섹션 디렉토리 없음. MDX 갱신은 사용자 가시 동작 변화(텍스트 차이)가 없어 필수가 아니며, INFO 1건만 발견됩니다.

## 위험도

NONE

STATUS=success ISSUES=0
