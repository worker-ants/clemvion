---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
---

# user-profile — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). 본 spec 을 `partial` 로 강등하며 분리한 미구현 항목 추적.
> 관련 spec: spec/2-navigation/9-user-profile.md

## 미구현 항목

> **구현 진척 (2026-06-14, impl-user-profile-gaps PR)**: 테마 System(항목 4) backend 구현. 나머지는 대형 신규
> 기능 또는 frontend: avatar 업로드는 S3 공개 URL 서빙 전략(S3Service getUrl 부재) 설계 선행, 알림 설정은 신규
> entity+migration+모듈, 슬러그 라우팅은 frontend.

- [ ] 아바타 이미지 **파일 업로드** 엔드포인트 (§6.1 `POST /api/users/me/avatar`) — **대형(스토리지 서빙)**: S3Service.upload 는 key 만 반환하고 공개 URL 메서드가 없어, 업로드 + 서빙 GET 엔드포인트(key→URL) 전략 설계 선행. 별도 PR.
- [ ] 알림 설정 조회/수정 (§6.2 `GET/PATCH /api/notifications/settings`) — **대형(신규 entity)**: NotificationSettings entity + migration + 모듈/서비스/컨트롤러/DTO 신설. 별도 PR.
- [ ] 이메일 일일 요약 토글 (§5.3) — 위 알림 설정 저장소에 종속(별도 PR).
- [x] 테마 `System` (OS 자동 추종) 옵션 (§2.0/§2.1) — **backend 완료**: `UpdateMeDto.USER_THEMES` 에 `'system'` 추가(`['light','dark','system']`). User.theme varchar(10) default 'light' 라 migration 불요. dto 검증 테스트 추가. **frontend 잔여**: 테마 토글 UI 의 System 옵션 + `prefers-color-scheme` 적용(별도 frontend PR).
- [ ] 워크스페이스 전환 시 슬러그 URL 라우팅 (§3 `/w/[slug]/...`) — **frontend**: `/w/[slug]` 라우트 구조(Next.js app router) 신설. 별도 frontend PR.

## 비고
- §6.1 세션 단건 종료는 spec 의 `DELETE .../:familyId` 가 아니라 실제 `POST .../:familyId/revoke` 로 구현됨 — 이는 의도된 설계(프록시 DELETE 바디 제거 회피)라 spec 본문을 코드에 맞게 정정만 했고 미구현 항목은 아님.
- `profile/alerts` 페이지는 알림 채널 on/off 가 아니라 별개의 알림 규칙(failure_rate/duration/llm_cost 임계치) 관리 화면 — §5 의 미구현과 무관.
- 각 항목의 근거(claim→코드부재)는 audit findings/2-navigation.md 참조.
