# Consistency Check 통합 보고서 — spec draft 검토

**BLOCK: NO (draft self-correcting)**

Critical 1건은 본 draft 가 수정하려는 기존 spec 파일(`spec/data-flow/integration.md`)이 이미 모순 상태임을 가리키며, draft 의 변경 1 + 변경 1-b 가 그 모순을 정확히 교정한다. 즉 draft 자체는 모순을 도입하지 않으며 BLOCK 사유 해소를 위해 spec write 를 진행해야 한다.

- 대상: `plan/in-progress/spec-draft-cafe24-app-url-detail.md`
- 모드: spec draft 검토 (--spec)
- 검토 일시: 2026-05-16T12:06:18
- Checker: cross_spec / rationale_continuity / convention_compliance / plan_coherence / naming_collision
- 모두 success, 재시도 없음

## 전체 위험도
**LOW–MEDIUM** — draft 가 self-correcting. plan_coherence 의 활성 worktree 경합은 merge 시점 조율.

## Critical (draft 가 해소)

| # | Checker | 위배 | draft 의 해소 |
|---|---------|------|---------------|
| 1 | cross_spec | `spec/data-flow/integration.md` line 90 `install_token=NULL` doc drift | 변경 1 + 1-b 가 line 90 + Rationale "install_token TTL 24h" 의 NULL 처리 구절 동시 정정 |

## Warning (draft 갱신 후 해소)

| # | Checker | 항목 | 조치 |
|---|---------|------|------|
| W1 | cross_spec | `install_token_issued_at` 보존 처리 미명시 | 변경 1-b 신설로 해소 (draft 갱신 완료) |
| W2 | cross_spec | `GET /api/integrations/:id` 응답 envelope (`{ data }`) 미명시 | 변경 3 본문에 `[API 규약 §5.1](../5-system/2-api-convention.md#51-단일-리소스)` 참조 추가 (draft 갱신 완료) |
| W3 | plan_coherence | `spec-update-cafe24-app-url-reuse.md` 와 동일 영역 경합 | 해당 plan 의 spec 갱신 항목은 commit `0c398fc3` 으로 이미 main 에 머지 — 영향 없음. plan/in-progress 의 미체크 박스는 별건 정리 대상 |
| W4 | plan_coherence | `cafe24-spec-sync-e2a8b9` worktree | 해당 worktree 의 spec 변경은 commit `aa1eccce` (PR #75) 로 이미 main 에 머지. 본 worktree (45432025) 가 그 commit 이후를 base 로 함 — 영향 없음 |
| W5 | plan_coherence | `cafe24-w2-spec-d9f2a3` worktree | 미머지 상태. Rationale 말미 신규 항 추가 위치 경합 가능. merge 시 추가 항 간 순서만 조정하면 되며 본질 충돌 없음. merge coordinator 가 처리 |

## INFO (별도 plan)

I1–I6: secret 로깅 규약 spec/conventions 공식화, `Integration.credentials` JSONB 스키마 spec/1-data-model 추가 등은 본 PR 범위 밖. 별도 plan 으로 분리.

## 권장 조치

1. **[draft 갱신 완료]** 변경 1 + 1-b 로 install_token / install_token_issued_at 보존 정책 동시 정정.
2. **[draft 갱신 완료]** 변경 3 에 API 규약 §5.1 envelope 참조 추가.
3. **[spec write 진행]** 위 갱신 후 spec/ 본문 반영 가능 — draft 가 BLOCK 사유 해소 방향이므로 그대로 적용.
4. **[merge 시점]** `cafe24-w2-spec-d9f2a3` 머지 후 본 worktree merge 시 Rationale 신규 항 두 개의 순서만 조정.

## Checker별 위험도

| Checker | 위험도 | 비고 |
|---------|--------|------|
| cross_spec | RESOLVED (after draft update) | Critical 1 + Warning 2 모두 draft 가 해소 |
| rationale_continuity | NONE | 5개 변경 모두 기존 Rationale 와 정합 |
| convention_compliance | LOW | Info 수준 — 별도 plan |
| plan_coherence | LOW | 경합 worktree 3건 중 2건 머지 완료, 1건 merge 시 순서 조정 |
| naming_collision | NONE | `appUrl`, `Cafe24AppUrlCard` 모두 충돌 없음 |
