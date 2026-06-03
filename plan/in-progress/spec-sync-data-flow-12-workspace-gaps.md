---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
---

# data-flow/12-workspace — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). data-flow 문서라 frontmatter status 강제 대상은 아니나, 본문이 현재형으로 약속한 미구현 surface 를 분리 추적한다.
> 관련 spec: spec/data-flow/12-workspace.md

## 미구현 항목
- [ ] 워크스페이스 전환 플로우(§1.5) — `POST /api/auth/workspaces/:id/switch` 엔드포인트·`switchWorkspace` 서비스·프론트 호출 전부 부재. 전환=토큰 재발급 모델 미구현 (현재는 `X-Workspace-Id` 헤더로만 컨텍스트 지정).
- [ ] JWT payload 워크스페이스 클레임 필드명 정합 — spec 이 가정한 `activeWorkspaceId` 는 코드에 없고 실제는 `workspaceId`. 전환 모델 구현 시 명명 확정 필요.
- [ ] `(owner_id, type) UNIQUE` DB 레벨 강제 — 현재 TypeORM `@Unique` 데코레이터만 존재, 마이그레이션 SQL 에 대응 제약 없음. personal workspace 중복 방지를 DB 제약으로 추가할지 결정 필요.
- [ ] 워크스페이스 액션 audit 적재 범위 — 현재 `workspace.transfer_ownership` 1건만 기록. create/delete/rename/member 변경 등 audit 적재 여부 결정 필요(과거 spec 은 `workspace.*` 전체 적재로 약속).

## 비고
- 각 항목의 근거(claim→코드부재)는 audit findings/data-flow/data-flow__12-workspace.md 참조.
- 본문은 위 항목들을 "미구현 (Planned)" 또는 "현재 미적재/미강제" 로 명시 표기하도록 이미 패치됨.
