# Consistency Check (impl-prep) 통합 보고서

**BLOCK: NO** — Plan A 는 즉시 착수 가능. Plan B 는 `eia-trigger-edit-ui` 머지 후 진행.

> mode: 구현 착수 전 (--impl-prep)
> scope: `spec/2-navigation/`
> 검토일: 2026-05-22
> session: `review/consistency/2026/05/22/12_17_08/`

## Critical

없음.

## 주요 WARNING

| # | Checker | 위배 | 영향 | 처리 |
|---|---------|------|------|------|
| W-1 | Cross-Spec | Trigger `name` 의 (workspace_id, name) UNIQUE 가 `spec/1-data-model.md §2.8` 에 미반영 | Plan B PATCH 의 409 가 실제 emit 되지 않을 수 있음 | Plan B 구현 시 백엔드 unique 검증을 application-level 로 추가하거나, 후속 data-model spec 정비 PR 에서 DB 제약 추가. **Plan A 영향 없음** |
| W-2 | Cross-Spec | v1.1 예약 `/auth/rotate-secret` 가 api-convention §2.2 채널 목록에 미등재 | v1.1 endpoint 신설 시 convention 동시 갱신 필요 | TBD 상태이므로 현재 차단 없음. 별 plan 에서 처리 |
| W-3 | Convention Compliance | `2-trigger-list.md §3 PATCH /toggle` "idempotent" 표현이 어색 | spec 표현 정밀화 | 본 PR 외 별 chore commit 으로 정정 |
| W-4 | Plan Coherence | `eia-trigger-edit-ui.md` frontmatter worktree slug placeholder | Plan B 직렬화 추적 어려움 | Plan B 착수 전 확인. **Plan A 영향 없음** |
| W-5 | Plan Coherence | `eia-secret-rotation-revoke-api.md` 미결 결정 — Plan B 수용 기준에 차단 항목 없음 | v1.1 scope 유입 위험 | Plan B 수용 기준에 체크리스트 추가 |

## INFO (10건)

요약: 다른 spec 의 `## Rationale` 누락, dashboard subworkflow 표시 여부, error 응답 `details` 형식 정밀화 등 — 본 plan A 와 무관.

## Plan A 착수 판정

- 변경 대상 파일 (`page.tsx` + 신규 `TriggerDeleteDialog`/`DropdownMenu`) 은 다른 worktree 와 경합 없음.
- backend 의 `DELETE /api/triggers/:id` 는 이미 구현 완료 (controller editor+, 204 응답, audit log).
- i18n dict 기존 키 `triggers.deleted` / `triggers.deleteFailed` 그대로 재사용.
- 기존 `triggers.deleteConfirm` flat 키는 type 분기 모달로 대체 — 사용처 일괄 이행.

**판정**: 즉시 착수.

## 처리 메타

- skip 된 checker 없음 (5/5 모두 실행, STATUS=success)
- 재시도/wake 사이클 없음
