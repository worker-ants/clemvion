---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
---

# user-profile — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). 본 spec 을 `partial` 로 강등하며 분리한 미구현 항목 추적.
> 관련 spec: spec/2-navigation/9-user-profile.md

## 미구현 항목
- [ ] 아바타 이미지 **파일 업로드** 엔드포인트 (§6.1 `POST /api/users/me/avatar`) — 현재는 `PATCH /users/me` 의 `avatarUrl` 로 URL 설정/제거만 가능. 파일 업로드/스토리지 경로 없음.
- [ ] 알림 설정 조회/수정 (§6.2 `GET/PATCH /api/notifications/settings`) — 라우트·설정 저장 entity 전무. §5.1 의 "채널별 on/off" 가 동작하지 않음.
- [ ] 이메일 일일 요약 토글 (§5.3 "설정 가능") — 위 알림 설정 저장소 부재로 미동작.
- [ ] 테마 `System` (OS 자동 추종) 옵션 (§2.0/§2.1) — `UpdateMeDto.USER_THEMES` 는 `['light','dark']` 만 허용.
- [ ] 워크스페이스 전환 시 슬러그 URL 라우팅 (§3 `/w/[slug]/...`) — `/w/[slug]` 라우트 부재. 현재는 `currentWorkspaceId` (localStorage) + `X-Workspace-Id` 헤더로만 전환, URL 불변.

## 비고
- §6.1 세션 단건 종료는 spec 의 `DELETE .../:familyId` 가 아니라 실제 `POST .../:familyId/revoke` 로 구현됨 — 이는 의도된 설계(프록시 DELETE 바디 제거 회피)라 spec 본문을 코드에 맞게 정정만 했고 미구현 항목은 아님.
- `profile/alerts` 페이지는 알림 채널 on/off 가 아니라 별개의 알림 규칙(failure_rate/duration/llm_cost 임계치) 관리 화면 — §5 의 미구현과 무관.
- 각 항목의 근거(claim→코드부재)는 audit findings/2-navigation.md 참조.
