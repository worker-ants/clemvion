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
- [x] 알림 설정 조회/수정 (§6.2 `GET/PATCH /api/notifications/settings`) — **완료 (2026-07-08)**. **재검증: store 는 이미 존재**(`user.notification_preferences` JSONB V010, `integrationExpiryEmail`) — 신규 entity 아님. 구현: 엔드포인트 신설(GET get-or-default·PATCH 부분머지) + prefs shape 확장(`executionFailedEmail`/`scheduleFailedEmail`) + DTO + **caller-side opt-out enforcement**(execution/schedule 실패 dispatch 가 `resolveOptOutEmailChannels` 로 채널 계산 — "channel 계산=호출자 책임" 불변식 보존). 응답=기본값 해소값(FE 오독 방지). spec §6.2 flip·§5.1 캡션/각주·§5.3 갱신. unit(notifications+schedule+execution dispatch)·lint·build.
  - **impl-prep 반영**: enforcement 중앙화(notify 내부)는 8-notifications "호출자 책임" 불변식 위반(CRITICAL) → caller-side 유지. `marketplace_update`(§5.1 인앱 only·opt-in·미발사)·`integration_expired`(기존 opt-in) 는 opt-out 집합 제외.
  - [ ] **(후속) in_app 채널 뮤팅** (§5.1 "채널별" — 인앱 알림 항상 표시, 뮤팅 미구현).
  - [ ] **(후속, planner) 4-integration §11.2/§11.3 필드명 동기화** — 옛 `notifyIntegrationExpiryByEmail`→`integrationExpiryEmail` (코드/9-user-profile 는 이미 `integrationExpiryEmail`; 기본값 서술은 이미 정합) + §11.3 stale 클래스명 `NotificationDispatcher` 정정.
- [ ] 이메일 일일 요약 토글 (§5.3) — 저장소는 존재하나 **집계·발송 job + 전용 토글** 미구현(별도 PR).
- [x] 테마 `System` (OS 자동 추종) 옵션 (§2.0/§2.1) — **backend + frontend 완료**: backend `UpdateMeDto.USER_THEMES`·`UserProfileDto` enum 에 `'system'` 추가(User.theme varchar(10) default 'light' — migration 불요). frontend `ServerTheme` 타입·profile sync guard·`ProfilePreferencesCard` 라벨/토글 옵션·i18n(ko/en `themeSystem`) 추가 — theme-store 는 이미 `prefers-color-scheme` 적용 보유. dto 검증 7건 테스트. (ai-review 가 frontend ripple WARNING 3건을 잡아 동반 구현으로 완결.)
- [x] 워크스페이스 전환 시 슬러그 URL 라우팅 (§3 `/w/[slug]/...`) — **frontend 완료** (`plan/in-progress/workspace-slug-routing.md`, phase 1): `(main)/w/[slug]` 라우트 구조 신설(26페이지 이동)·slug 해소 layout(reconcile URL 우선)·`(main)/[...rest]` catch-all·`buildWorkspaceHref` 링크 헬퍼·switchWorkspace 네비게이션화. §3 flip·data-flow-12 Rationale·10-auth-flow §7.2·_layout §2.2/§3.1 반영. editor(`/workflows/[id]`)·docs(`/docs`)는 phase 1 slug 밖(후속).

## 비고
- §6.1 세션 단건 종료는 spec 의 `DELETE .../:familyId` 가 아니라 실제 `POST .../:familyId/revoke` 로 구현됨 — 이는 의도된 설계(프록시 DELETE 바디 제거 회피)라 spec 본문을 코드에 맞게 정정만 했고 미구현 항목은 아님.
- `profile/alerts` 페이지는 알림 채널 on/off 가 아니라 별개의 알림 규칙(failure_rate/duration/llm_cost 임계치) 관리 화면 — §5 의 미구현과 무관.
- 각 항목의 근거(claim→코드부재)는 audit findings/2-navigation.md 참조.
