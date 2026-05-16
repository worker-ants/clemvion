# Consistency Check SUMMARY — Cafe24 Node UX Phase 3 (impl-prep)

**일자**: 2026-05-16
**대상**: Phase 3 프런트 Cafe24Config 재작성 (Resource → Operation → 동적 fields → 조건부 pagination). spec/backend 변경 없음.
**worktree**: cafe24-node-ux-frontend-f5a3b8

## 5 checker 결과

| checker | status | issues | 위험도 | 보고서 |
|---|---|---|---|---|
| cross_spec | success | 4 | LOW | [cross_spec/review.md](cross_spec/review.md) |
| naming_collision | success | 2 | NONE | [naming_collision/review.md](naming_collision/review.md) |
| rationale_continuity | success | 2 | LOW | [rationale_continuity/review.md](rationale_continuity/review.md) |
| plan_coherence | success | 7 | HIGH→해소 | [plan_coherence/review.md](plan_coherence/review.md) |
| convention_compliance | success | 2 | LOW | [convention_compliance/review.md](convention_compliance/review.md) |

## Critical 해소 내역

plan_coherence 의 CRITICAL 1건:

- **i18n dict 모놀리식 파일 충돌** — PR #82 (2026-05-16 머지) 가 `frontend/src/lib/i18n/dict/{ko,en}.ts` 모놀리식 두 파일을 `dict/{ko,en}/<namespace>.ts` 22개로 split 했다. Phase 3 worktree 는 12 commits behind 상태에서 옛 파일을 수정하고 있었다.
- **해소**: `git stash -u` → `git rebase origin/main` → 충돌 발생 (DU: 옛 파일들이 main 에서 삭제됨) → `git rm` 으로 옛 파일 폐기 → 신규 i18n 키 12개를 `dict/{ko,en}/nodeConfigs.ts` 의 동일 namespace 위치에 재적용 → 옛 키 (`cafe24OperationPlaceholder`, `cafe24OperationHint`, `cafe24FieldsKeyPlaceholder`, `cafe24FieldsValuePlaceholder`, `cafe24Fields`) 제거 → frontend vitest 1392/1392 통과 + tsc 통과.

## WARNING 잔존

plan_coherence 의 2건:

- **plan frontmatter 의 worktree 필드 미갱신** — Phase 3 worktree (`cafe24-node-ux-frontend-f5a3b8`) 가 frontmatter 에 없었음. **해소**: frontmatter 를 `worktree: cafe24-node-ux-frontend-f5a3b8 (Phase 3, active)` 로 갱신.
- **Phase 2 체크리스트 미체크** — plan 본문의 Phase 2 항목들이 `[ ]` 인 채로 남아 있었음. **해소**: Phase 2 체크리스트 전체를 `[x]` 로 갱신하며 실제 산출물 (`public-meta.ts`, `planned.ts`, `catalog-sync.spec.ts` 확장, frontend types 등) 매핑.

## INFO/잔존 권고

- **spec/4-nodes/4-integration/4-cafe24.md §9.9 (Fields 편집 버퍼 분리 rationale)** — PR #77 이 추가한 절. 본 Phase 3 가 KeyValueEditor 와 그 내부 버퍼 패턴을 완전히 폐기하므로 §9.9 의 적용 대상이 사라졌다. 단 본 PR 은 frontend 만 다루므로 spec 갱신은 후속 project-planner 트랙에 위임 — Phase 4 후속 항목으로 추가.
- **`SelectField.options[].disabled?` 확장** — optional 추가라 기존 call site 영향 없음. 향후 다른 노드도 disabled 옵션 패턴을 채택할 수 있음 (cross_spec INFO).
- **i18n parity 테스트** — PR #82 split 이후 ko ↔ en parity 단위 테스트가 도입되어 있음 (`harness-i18n-userguide-gap` plan). Phase 3 의 12 키 양쪽 추가는 parity 테스트로 검증됨 (vitest 통과).

## BLOCK: NO

CRITICAL 1건 (i18n split rebase) 해소, WARNING 2건 해소. 잔존 INFO 는 본 PR 차단 사유 아님.
