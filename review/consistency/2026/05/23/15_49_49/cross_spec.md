# Cross-Spec 일관성 검토 — form option backfill slug 정합화

**STATUS**: PASS

## 검토 대상

- target draft: `plan/in-progress/spec-fix-form-option-backfill-slug.md`
- target spec: `spec/4-nodes/6-presentation/0-common.md` §10.5 step 4 본문 + §Rationale "form option value backfill (2026-05-23)" + §9 CHANGELOG
- 영향 cross-ref: `spec/4-nodes/6-presentation/4-form.md` §1 `options[].value` 비고

## 검토 결과

### 1. 데이터 모델 충돌
- `option.value` 의 backfill 규칙은 본 SoT (`0-common.md` §10.5 step 4) 한 곳만 정의. data model 측면의 충돌 없음.
- form `Option` 타입 정의 (`4-form.md` §1) 의 `{ label, value }` shape 은 본 변경 영향권 밖.

### 2. API 계약 충돌
- LLM tool 모드 `render_form` 의 input schema 는 zod schema (`backend/.../form/form.schema.ts`) 가 SoT. slug variant 제거는 schema 변경이 아닌 backfill helper 의 fallback 형식 명문화 — API 계약 무변경.

### 3. 요구사항 ID 충돌
- 본 변경은 신규 요구사항 ID 부여 없음.

### 4. 상태 전이 충돌
- 상태 머신과 무관 (presentation tool 페이로드 정규화 layer).

### 5. 권한·RBAC 모델 충돌
- 무관.

### 6. 계층 책임 충돌
- backend `render-tool-provider.ts` 의 `backfillFormOptionValues` (실행 보장) + frontend `dynamic-form-ui.tsx` (defense-in-depth) 의 4-layer SSOT 정렬 라인 (§Rationale 의 마지막 단락) 유지. 책임 분할 변경 없음.

## 결론

cross-impact 없는 단일 1줄 문구 정합화. 다른 영역에서 `slug(label)` 의 의존이 발견되지 않았다 (전역 `grep -rn 'slug(label)' spec/` 결과는 정합화 메타 라인 2건만 남음).

**STATUS**: PASS — BLOCK:NO
