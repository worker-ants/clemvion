# Consistency Check SUMMARY — Cafe24 Node UX Phase 2 (impl-prep)

**일자**: 2026-05-16
**대상**: Phase 2 백엔드 + 프런트 구현 (extras payload). spec 변경 없음.
**worktree**: cafe24-node-ux-impl-9d3e1a

## 5 checker 결과

| checker | status | issues | 위험도 | 보고서 |
|---|---|---|---|---|
| cross_spec | success | 5 | LOW | [cross_spec/review.md](cross_spec/review.md) |
| naming_collision | success | 5 | MEDIUM→해소 | [naming_collision/review.md](naming_collision/review.md) |
| rationale_continuity | success | 2 | LOW | [rationale_continuity/review.md](rationale_continuity/review.md) |
| plan_coherence | success | 5 | LOW | [plan_coherence/review.md](plan_coherence/review.md) |
| convention_compliance | success | 4 | LOW | [convention_compliance/review.md](convention_compliance/review.md) |

## Critical 해소 내역

naming_collision 의 CRITICAL 1건:

- **`Cafe24PlannedOperation` 동명이의** — backend internal (`planned.ts`) 의 `{id, label, paginated?}` 와 frontend wire shape (`types.ts`) 의 `{status: "planned", id, label, paginated}` 가 같은 이름을 다른 shape 로 사용.
- **해소**: backend internal 타입을 `Cafe24PlannedOperationEntry` 로 리네임. frontend `Cafe24PlannedOperation` (wire shape) 이 canonical 이름으로 남음. `public-meta.ts` 의 import + buildCafe24Extras() 의 인자 타입 모두 동기 갱신. backend jest 250 통과.

## 추가 적용 권고

- `Cafe24FieldType` / `Cafe24FieldLocation` 가 backend (`metadata/types.ts`) 와 frontend (`node-definitions/types.ts`) 양쪽에 동일 정의로 존재 (WARNING). frontend 가 backend 를 import 하지 않는 monorepo 경계 때문에 코드 통합은 비용 대비 효과 낮음. 대신 frontend 측에 "backend SoT 와 동기 유지" 주석 추가 — `node-definitions/types.ts` 에 JSDoc 한 줄로 명시.
- INFO/WARN 잔존 7건은 모두 향후 발생 가능성 알림 (drift 모니터링, ApiPropertyOptional swagger 표기 검증, doc cross-reference 보강). 본 PR 차단 사유 아님.

## 잔존 권고 (post-merge)

- frontend 의 `Cafe24*` 타입군이 `spec/conventions/cafe24-api-metadata.md` SoT 와 sync 검증되는 별도 가드 (eslint custom rule 또는 backend 와 동일 shape 강제 테스트) 도입 검토 — Phase 4 트랙 후보.

## BLOCK: NO

CRITICAL 0 (해소). MEDIUM/INFO 는 본 PR 차단 사유 없음.
