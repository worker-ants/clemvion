---
worktree: render-form-options-and-state-fix-d72e6d
started: 2026-05-23
completed: 2026-05-23
owner: resolution-applier
---
# Spec Fix Draft — form option value backfill slug 구절 정합화

## 원본 발견사항

SUMMARY#1 (W#1): spec `0-common.md` line 308 의 fallback 형식 "label 이 slug 가능하면 `opt-{fieldIdx}-{slug(label)}` 우선, slug 가 비면 `opt-{fieldIdx}-{optIdx}`" 2단계와 구현(`backfillFormOptionValues` — `opt-{fieldIdx}-{optIdx}` 단일 형식) 간 drift.

위치: `spec/4-nodes/6-presentation/0-common.md` line 308 vs `codebase/backend/src/nodes/ai/ai-agent/tool-providers/render-tool-provider.ts` `backfillFormOptionValues`

## 배경

구현 PR (`f40d6130`) 에서 의도적으로 slug 기반 fallback 을 채택하지 않고 인덱스 기반 `opt-{fieldIdx}-{optIdx}` 단일 형식을 선택했다. 근거:

1. **결정성(determinism)**: `slug(label)` 은 특수문자·다국어(한글 등) label 에서 비어 있거나 충돌 가능 → 동일 필드에 "주문 문의"/"교환/환불" 같은 한글 label 이면 slug 가 빈 문자열로 귀결돼 인덱스 fallback 과 동일.
2. **단순성**: 인덱스 전용 단일 코드 경로가 테스트·유지보수 부담이 적다.
3. **LLM 의미 보존**: 인덱스 기반 값(`opt-0-1`)도 LLM 이 정의 배열 인덱스를 의미 매핑할 수 있어 Rationale 의 "최소 키 회복" 목표를 충족한다.

spec 에 slug 우선 구절이 남아 있으므로 spec 을 구현에 맞게 정합화해야 한다.

## 제안 변경

`spec/4-nodes/6-presentation/0-common.md` line 308 의 step 4 에서:

**변경 전 (현재)**:
```
fallback 형식은 `opt-{fieldIdx}-{optIdx}` (label 이 slug 가능하면 `opt-{fieldIdx}-{slug(label)}` 우선, slug 가 비면 `opt-{fieldIdx}-{optIdx}`)
```

**변경 후 (제안)**:
```
fallback 형식은 `opt-{fieldIdx}-{optIdx}` — 결정적 인덱스 단일 형식. slug 기반 variant 는 다국어 label (한글 등) 에서 빈 slug 로 귀결되어 충돌이 재발하므로 채택하지 않는다.
```

## 조치 방법

1. `project-planner` 가 consistency-check --spec 후 spec 본문 수정.
2. 별도 코드 변경 불필요 (구현이 이미 정합).
3. plan 파일은 spec 반영 완료 후 `plan/complete/` 로 이동.

## Closeout (2026-05-23)

**상태**: 완료

**적용된 변경**:

- `spec/4-nodes/6-presentation/0-common.md`
  - §10.5 step 4 본문 — slug variant 언급 제거, "결정적 인덱스 단일 형식. slug 기반 variant 는 다국어 label (한글 등) 에서 빈 slug 로 귀결되어 충돌이 재발하므로 채택하지 않는다" 로 정합화.
  - §Rationale "form option value backfill (2026-05-23)" 의 "왜 UUID v4 가 아닌 결정적 값" 단락 — 결정적 값 bullet 을 인덱스 단일 형식으로 갱신 + 신규 bullet "**slug 기반 variant 를 채택하지 않는 이유**" 추가.
  - §9 CHANGELOG — 2026-05-23 정정 라인 추가 (ai-review `review/code/2026/05/23/15_27_41/` W#1 출처 명시).

- `spec/4-nodes/6-presentation/4-form.md`
  - §1 `options[].value` 비고 — cross-ref 라인의 fallback 형식을 인덱스 단일 형식으로 정합화.

**Consistency check 세션**: `review/consistency/2026/05/23/15_49_49/` — 5 perspective 모두 PASS, BLOCK:NO.

**Cross-impact**: 없음 (spec/ 전역 `slug(label)` 의존 사전 확인 — 본 정정 라인 외 의존 없음). 구현 (`backfillFormOptionValues`) 은 PR #279 부터 인덱스 단일 형식만 사용 — 코드 변경 불필요.

**연관 작업**:
- ai-review 출처: `review/code/2026/05/23/15_27_41/SUMMARY.md` W#1 (Documentation / Spec Drift).
- 상위 plan: `plan/in-progress/render-form-options-and-state-fix.md` — PR #279 후속 작업.
