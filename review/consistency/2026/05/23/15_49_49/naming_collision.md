# Naming Collision 검토 — form option backfill slug 정합화

**STATUS**: PASS

## 검토 대상

- target draft: `plan/in-progress/spec-fix-form-option-backfill-slug.md`
- 영향 식별자: `backfillFormOptionValues` (함수명), `#form-option-value-backfill-2026-05-23` (anchor), `opt-{fieldIdx}-{optIdx}` (값 형식)

## Naming 충돌 점검

### 1. 함수명 충돌
- `backfillFormOptionValues` 는 backend `render-tool-provider.ts` 의 단일 export 함수 — 본 정합화로 함수명 변경 없음. 충돌 없음.
- `backfillButtonUuids` (step 3) 와 평행 명명 유지.

### 2. Anchor 충돌
- `#form-option-value-backfill-2026-05-23` anchor 유지 — CHANGELOG cross-ref 깨지지 않음.
- `#buttonid-backfill-도입-2026-05-23` (step 3 Rationale) 과 의미·anchor 모두 distinct.

### 3. 값 형식 (fallback value) 충돌
- 새 SoT 값 형식 `opt-{fieldIdx}-{optIdx}`:
  - `button.id` (UUID v4) 와 prefix `opt-` 로 명확 구분 → 동일 키 공간 (LLM tool payload 안) 에서 충돌 불가.
  - `name` (필드 식별자, `4-form.md` §1) 과는 별도 슬롯 (`fields[].options[].value`) — 충돌 없음.
  - graph 노드 본체의 form 노드 `options[].value` 사용자 입력값과는 layer 분리 (LLM tool 모드 한정 backfill) — 충돌 없음.

### 4. 제거된 slug variant 형식
- `opt-{fieldIdx}-{slug(label)}` 형식이 spec 에서 제거되되 §Rationale·§CHANGELOG 에 "제거 사유" 로만 잔존 — 정합화 메타 라인이므로 안전.

## 결론

**STATUS**: PASS — BLOCK:NO. 함수명·anchor·값 형식 모두 충돌 없음.
