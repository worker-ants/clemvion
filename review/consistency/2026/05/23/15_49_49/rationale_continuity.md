# Rationale Continuity 검토 — form option backfill slug 정합화

**STATUS**: PASS

## 검토 대상

- target draft: `plan/in-progress/spec-fix-form-option-backfill-slug.md`
- 정합화되는 §Rationale 라인: `0-common.md` §Rationale "form option value backfill (2026-05-23)" 의 "왜 UUID v4 가 아닌 결정적 값" 단락 마지막 bullet

## Rationale 연속성 점검

### 1. 결정 근거 보존 여부
원 Rationale 의 핵심 결정 ("UUID 가 아닌 결정적 값" + "key 만 회복하면 됨" + "cap 이후 적용") 은 **모두 보존**. slug variant 제거는 결정 근거의 **부정**이 아니라 결정의 **세부 코드 경로 단순화** — 동일 결정 (결정적 값으로 backfill) 안에서 (slug 가능 분기 + slug 비면 분기) 라는 2단계 코드 경로를 (인덱스 단일) 로 축소.

### 2. 변경 사유 명문화 여부
- §Rationale (492 line) 에 신규 bullet "**slug 기반 variant (`opt-{fieldIdx}-{slug(label)}`) 를 채택하지 않는 이유**" 가 추가됨 — 다국어 label 의 빈 slug 귀결 + 코드 경로 단순화 명시.
- §9 CHANGELOG 신규 라인이 정정 이력 + ai-review 출처 (`review/code/2026/05/23/15_27_41/` W#1) 를 박아 audit trail 보존.

### 3. 결정 history 단절 위험
- 본 변경은 "이전 결정의 변경" 이 아닌 "이전 결정의 코드 경로 세부 축약" — 결정 자체는 PR #279 의 backfill 단계 SoT 그대로.
- 단, 원 Rationale 의 (490) bullet 이 slug variant 를 결정인 듯 명시했던 것은 spec drift — 구현 (`f40d6130`) 은 처음부터 인덱스 단일 형식만 적용. 본 정합화는 spec 를 구현 (의도된 결정) 에 맞추는 정정.

### 4. ai-review W#1 audit trail
- §9 CHANGELOG 의 신규 라인이 ai-review session (`review/code/2026/05/23/15_27_41/`) W#1 documentation drift 정정 출처를 명시 — 결정 history 단절 없이 audit trail 유지.

## 결론

**STATUS**: PASS — BLOCK:NO. Rationale 연속성·audit trail 모두 보존. 결정 자체는 변하지 않고 코드 경로 세부만 축약됨을 명문화.
