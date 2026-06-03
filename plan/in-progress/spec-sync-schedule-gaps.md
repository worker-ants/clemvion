---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
---

# schedule — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). 본 spec 을 `partial` 로 강등하며 분리한 미구현 항목 추적.
> 관련 spec: spec/2-navigation/3-schedule.md

## 미구현 항목
- [ ] 스케줄 목록 항목의 더보기(⋮) 오버플로 메뉴 + "실행 이력" 항목 (§2.1). 현재 UI 는 인라인 버튼(Run/Toggle/Edit/Delete)만 제공.
- [ ] 더보기 메뉴의 "트리거에서 보기" (→ Trigger 목록에서 해당 트리거로 이동) (§2.1).
- [ ] 연결된 워크플로우 이름 클릭 시 에디터로 이동하는 링크 (§2.1). 현재는 단순 텍스트.
- [ ] 타임존 미지정 시 워크스페이스 설정 기반 기본값 (§2.2). 현재 서버는 `'Asia/Seoul'` 하드코딩 fallback 이며, 워크스페이스에 timezone 설정 자체가 없음.
- [ ] GET /api/schedules 의 `sort`/`order` 쿼리 반영 (§4). DTO 는 받지만 `findAll` 이 무시하고 `created_at DESC` 고정 정렬.

## 비고
- 각 항목의 근거(claim→코드부재)는 audit findings 참조.
- §4 의 `PATCH /:id/toggle` 는 별도 라우트가 아니라 `PATCH /:id` + `{ isActive }` 로 이미 동작 — spec 본문에서 정정 완료(미구현 아님).
- §5 실행 출처 기록 규약(cron=schedule, run-now=manual)은 코드와 정확 일치 — 변경 없음.
