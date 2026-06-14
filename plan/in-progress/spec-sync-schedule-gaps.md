---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
---

# schedule — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). 본 spec 을 `partial` 로 강등하며 분리한 미구현 항목 추적.
> 관련 spec: spec/2-navigation/3-schedule.md

## 미구현 항목

> **구현 진척 (2026-06-14, impl-schedule-gaps PR)**: §2.2 타임존 워크스페이스 fallback **backend** 구현
> (workspace settings.timezone + schedules.service resolveTimezone). §2.1 의 더보기 메뉴·트리거 링크·워크플로
> editor 링크는 **frontend UI cluster**(schedules/page.tsx) 로 묶여 별도 PR. §2.2 의 timezone **설정 UI**
> (workspace settings 폼)도 frontend cluster 와 함께.

- [ ] 스케줄 목록 항목의 더보기(⋮) 오버플로 메뉴 + "실행 이력" 항목 (§2.1). **frontend cluster** (schedules/page.tsx).
- [ ] 더보기 메뉴의 "트리거에서 보기" (§2.1). **frontend cluster**.
- [ ] 연결된 워크플로우 이름 클릭 시 에디터 링크 (§2.1). **frontend cluster**.
- [x] 타임존 미지정 시 워크스페이스 설정 기반 기본값 (§2.2) — **backend 완료**: `UpdateWorkspaceSettingsDto.timezone`(IANA 검증) + `workspaces.service` settings.timezone 병합/조회 + `schedules.service.resolveTimezone`(명시값 > workspace settings.timezone > 'Asia/Seoul'). 테스트 6건. **frontend 잔여**: workspace 설정 폼의 timezone 입력 UI (frontend cluster).
- [x] GET /api/schedules 의 `sort`/`order` 쿼리 반영 (§4). — 구현 완료 확인 (schedules.service.ts:37-52 whitelist 기반 orderBy, 2026-06-10 impl-prep 검토에서 검증). spec §4 경고 문구도 동일 시점 제거.

## 비고
- 각 항목의 근거(claim→코드부재)는 audit findings 참조.
- §4 의 `PATCH /:id/toggle` 는 별도 라우트가 아니라 `PATCH /:id` + `{ isActive }` 로 이미 동작 — spec 본문에서 정정 완료(미구현 아님).
- §5 실행 출처 기록 규약(cron=schedule, run-now=manual)은 코드와 정확 일치 — 변경 없음.
