# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 결과

## 발견사항

- **[WARNING]** docs MDX 예시 operation ID 가 제거된 operation 을 여전히 참조
  - 변경 파일: `codebase/backend/src/nodes/integration/cafe24/metadata/customer.ts` (+ `application.ts`, `category.ts`, `promotion.ts`, `store.ts`)
  - 매트릭스 항목:
    - `integration-provider-change` (semantic) — target: `codebase/frontend/src/content/docs/06-integrations-and-config/<provider>.{mdx,en.mdx} + dict 키`
    - `node-schema-change` (glob: `codebase/backend/src/nodes/**`) — target: `codebase/frontend/src/content/docs/02-nodes/<cat>.mdx 의 FieldTable`, `dict/{ko,en}/<section>.ts 의 해당 키`
  - 누락된 동반 갱신:
    - `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-g3l-remove-docsabsent/codebase/frontend/src/content/docs/06-integrations-and-config/cafe24.mdx` (line 85)
    - `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-g3l-remove-docsabsent/codebase/frontend/src/content/docs/06-integrations-and-config/cafe24.en.mdx` (line 84)
  - 상세: 두 파일 모두 **Operation** 필드 설명 열에 `customer_update` 를 예시 operation ID 로 나열한다. 이번 PR 에서 `customer_update` 는 Cafe24 공식 docs 에 미등재된 seed operation 으로 확정돼 metadata 에서 제거됐다. 사용자가 유저 가이드의 예시를 보고 `customer_update` 를 실제 operation 으로 시도하면 "operation not found" 류 오류를 마주하게 된다. 스타일 상 사용 예시이므로 즉각 기능 파괴는 아니나, 문서가 stale 상태로 남는다.
  - 제안: `cafe24.mdx` line 85 및 `cafe24.en.mdx` line 84 의 `customer_update` 를 실제 지원·문서화된 operation (예: `customer_list` 또는 `customer_delete`) 으로 교체한다. 두 파일을 동시에 갱신해 ko/en parity 를 유지한다.

## i18n parity 점검 결과 (이상 없음)

- `codebase/frontend/src/lib/i18n/dict/ko/cafe24Catalog.ts` — 변경 set 에 포함
- `codebase/frontend/src/lib/i18n/dict/en/cafe24Catalog.ts` — 변경 set 에 포함
- 제거된 9개 operation(`applications_list`, `webhooks_list`, `customer_get`, `customer_update`, `coupon_get`, `coupon_delete`, `mains_update`, `mains_delete`, `socials_apple_settings_get`) 모두 ko/en 양쪽에서 동시에 제거됨. i18n parity 유지됨.

## backend-labels.ts 점검 결과 (이상 없음)

- 제거된 operation 들에 대한 `WARNING_KO` / `ERROR_KO` 매핑 잔여분 없음. `backend-labels.ts` 동반 갱신 불필요.

## 신규 섹션 디렉토리 점검 결과 (해당 없음)

- `codebase/frontend/src/content/docs/` 신규 디렉토리 생성 없음. `locale.ts` 갱신 불필요.

## 요약

매트릭스 17개 row 중 2개 trigger 가 매칭됐다 (`node-schema-change` glob + `integration-provider-change` semantic). 제거된 9개 undocumented seed operation 에 대해 cafe24Catalog dict (ko/en 양쪽), backend-labels.ts 는 모두 정합하게 갱신됐다. 단, 유저 가이드 docs MDX 2개 파일(`cafe24.mdx` + `cafe24.en.mdx`)이 이번에 제거된 `customer_update` 를 예시 operation 으로 계속 참조하고 있어 문서 stale 1건이 발견됐다. 신규 error/warning code 추가 없음, 신규 섹션 디렉토리 없음.

## 위험도

LOW
