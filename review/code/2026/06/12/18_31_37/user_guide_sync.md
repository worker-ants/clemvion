# 유저 가이드 동반 갱신(User Guide Sync) Review

## 발견사항

해당 없음 — 매트릭스의 어떤 trigger 에도 누락 동반 갱신이 검출되지 않았다.

### 검토 내역

**변경 파일 중 매트릭스 trigger 와 관련 있는 파일:**

1. `codebase/frontend/src/lib/i18n/backend-labels.ts` — ERROR_KO 에 5개 chat-channel 에러 코드 신규 등록
2. `codebase/frontend/src/lib/i18n/__tests__/backend-labels.test.ts` — LOCALIZED_ERROR_CODES 에 6개 코드 추가 + test case (7)(8) 신설
3. `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` (KO) — 에러 코드 callout 문구 정정
4. `codebase/frontend/src/content/docs/02-nodes/triggers.en.mdx` (EN) — 에러 코드 callout 문구 정정 (KO 동반)
5. `spec/conventions/cafe24-api-catalog/_generator.py`, `_overview.md`, 3개 field catalog .md — cafe24 generator 버그 수정

**trigger 매칭 결과:**

- **`new-error-code`** (glob: `codebase/backend/src/nodes/core/error-codes.ts`): 변경 set 에 error-codes.ts 가 없음. backend 에는 해당 에러 코드가 이미 정의돼 있었고 이번 변경은 frontend ko 매핑 추가가 전부. trigger 발화 안 함.

- **`new-node` / `node-schema-change`** (glob: `codebase/backend/src/nodes/**`): backend nodes 경로 변경 없음. trigger 발화 안 함.

- **`new-ui-string`** (semantic: TSX 신규 한국어 리터럴): TSX 파일 변경 없음. trigger 발화 안 함.

- **`new-backend-ui-zod-value`** (semantic: LABEL_KO / HINT_KO 등): 이번 `backend-labels.ts` 추가는 ERROR_KO 테이블이며 LABEL_KO·HINT_KO·GROUP_KO·ITEM_LABEL_KO·OPTION_LABEL_KO 가 아님. 해당 trigger 대상 아님.

- **`new-warning-code`** (semantic: WARNING_KO): WARNING_KO 추가 없음. 해당 없음.

- **KO/EN i18n parity** — `triggers.mdx`(KO) 와 `triggers.en.mdx`(EN) 가 동일 변경 set 안에서 함께 갱신됨. parity 유지.

- **`spec-major-change`** (glob: `spec/conventions/**`): `spec/conventions/cafe24-api-catalog/` 하위 파일이 glob 에 매칭되나, `_generator.py` 는 Python 스크립트(frontmatter 대상 아님), `_overview.md` 는 `_` prefix 로 lifecycle guard 제외, 나머지 3개 field-catalog .md 는 `fix-spec-frontmatter-catalog` task 에서 명시적으로 lifecycle guard 에서 제외한 생성기 산출물(`^spec/conventions/[^/]+-api-catalog/[^/]+/.+\.md$`). 실질적 spec 문서의 frontmatter co-update 요건 없음.

- **`userguide-gui-flow-section`** (semantic: GUI 흐름 절 신규/변경): `triggers.mdx`/`triggers.en.mdx` 변경이 glob 에 매칭. 그러나 이번 변경은 기존 callout 의 문구 1문장 정정이며, 신규 GUI 흐름 절을 추가하거나 기존 절의 흐름을 변경한 것이 아님. `<ImplAnchor kind="ui-entry">` 동반 작성 의무는 신규·변경 GUI 흐름 절에 한정되므로 이 단순 wording 정정에는 적용되지 않음. 판정: 해당 없음.

## 요약

매트릭스 총 18개 trigger 중 이번 변경 set 에서 발화되는 trigger 0건, 누락 동반 갱신 0건. `backend-labels.ts` ERROR_KO 신규 5종 등록 + `triggers.mdx`/`triggers.en.mdx` KO·EN 동시 갱신으로 doc-sync 요건을 모두 충족. 발견사항 없음.

## 위험도

NONE
