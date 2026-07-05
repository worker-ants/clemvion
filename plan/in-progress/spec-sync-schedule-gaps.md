---
worktree: fe3-schedule-ui-d7eeab
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

- [x] 스케줄 목록 항목의 더보기(⋮) 오버플로 메뉴 + "실행 이력" 항목 (§2.1). **frontend 완료** (fe3-schedule-ui PR): `schedules/page.tsx` 액션 셀에 `DropdownMenu`(triggers 페이지 패턴 복제) 추가, "실행 이력"은 기존 `TriggerHistoryDialog`(triggerId+workflowId) 재사용. 테스트: 메뉴 항목·이력 다이얼로그 오픈.
- [x] 더보기 메뉴의 "트리거에서 보기" (§2.1). **frontend 완료**: `/triggers?triggerId={id}` Link 항목(triggerId 있을 때만). ⚠ 후속(planner): `/triggers` 가 아직 inbound `?triggerId=` 를 소비해 필터/하이라이트하지 않음 — 기존 triggers→schedules 링크와 동일한 잠재 갭, 별도 follow-up.
- [x] 연결된 워크플로우 이름 클릭 시 에디터 링크 (§2.1). **frontend 완료**: workflowId 있으면 `/workflows/{id}` Link(triggers 페이지 패턴). 테스트: link href.
- [x] 타임존 미지정 시 워크스페이스 설정 기반 기본값 (§2.2) — **backend + frontend 완료**: backend(`UpdateWorkspaceSettingsDto.timezone` IANA 검증 + `schedules.service.resolveTimezone` 명시값 > workspace settings.timezone > 'Asia/Seoul'). frontend(fe3-schedule-ui PR): workspace 설정 Overview 탭에 `WorkspaceTimezoneCard`(EmbedOriginsCard 패턴 미러, free-text IANA 입력, admin-gated, GET 시드/PATCH 저장, `workspaces.ts` getSettings/updateSettings 타입에 `timezone` 추가). 테스트: 시드·저장·viewer 비활성.
- [x] GET /api/schedules 의 `sort`/`order` 쿼리 반영 (§4). — 구현 완료 확인 (schedules.service.ts:37-52 whitelist 기반 orderBy, 2026-06-10 impl-prep 검토에서 검증). spec §4 경고 문구도 동일 시점 제거.

## 잔여 (planner 후속 — spec-doc sync)
- 모든 코드 항목 구현 완료. `complete/` 이동 전 필요: spec `2-navigation/3-schedule.md` §2.1(더보기 메뉴·트리거 링크·워크플로 링크) / §2.2(timezone UI) 의 "미구현 (Planned)" 마커 제거 + `status: partial → implemented` 승격 + `pending_plans` 제거 (spec-status-lifecycle 가드). spec 편집이라 **project-planner** 담당.
- `/triggers` inbound `?triggerId=` 필터/하이라이트 follow-up (위 "트리거에서 보기" 참조).

## 비고
- 각 항목의 근거(claim→코드부재)는 audit findings 참조.
- §4 의 `PATCH /:id/toggle` 는 별도 라우트가 아니라 `PATCH /:id` + `{ isActive }` 로 이미 동작 — spec 본문에서 정정 완료(미구현 아님).
- §5 실행 출처 기록 규약(cron=schedule, run-now=manual)은 코드와 정확 일치 — 변경 없음.
