---
title: "아바타 업로드가 구현됐다 — `9-user-profile.md` 의 \"미구현 (Planned)\" 배지 flip"
worktree: (unstarted)
started: 2026-08-31
owner: project-planner
status: in-progress
priority: P3
---

## Overview

`POST /api/users/me/avatar` 가 구현됐다(2026-08-31,
[`spec-sync-user-profile-gaps.md`](./spec-sync-user-profile-gaps.md) §6.1 항목). 그런데
[`spec/2-navigation/9-user-profile.md`](../../spec/2-navigation/9-user-profile.md) 는 여전히
**미구현**으로 서술한다:

- `:334` — ~~`POST /api/users/me/avatar`~~ … **미구현 (Planned)**. 현재는 `PATCH /api/users/me`
  의 `avatarUrl` 로 URL 설정/제거만 가능
- `:136` — 아바타 행: *"이미지 파일 업로드는 미구현 (Planned) — 전용 업로드 엔드포인트(§6.1 참조) 부재"*
- `§5.1` 구현 상태 배너의 범위 서술

`spec/` 쓰기라 **planner 트랙**이다. developer 는 권한 밖이고, 자기-반증형 소정정 예외에도
해당하지 않는다 — 그 문장은 developer 가 쓴 **예고**가 아니라 제품 정의 서술이다.

선례: `spec-sync-websocket-protocol-gaps.md` 의 `notification.new` 배지 flip 도 같은 방식으로
planner 에 위임됐다.

## 할 일

- [ ] `:334` 표 행 — 취소선·"미구현 (Planned)" 해제, 구현 형태 반영
- [ ] `:136` 아바타 행 — "이미지 파일 업로드는 미구현" 서술 정정
- [ ] `§6.1` 에 **엔드포인트 계약**을 적는다 — `multipart/form-data` `file`, 최대 2MB,
      허용 확장자 `png/jpg/jpeg/webp/gif`, 응답은 `PATCH /users/me` 와 동일한 프로필 봉투
- [ ] 착수 시 `/consistency-check --spec` (planner 의무 게이트)

## 반드시 함께 적어야 하는 것 — 배지만 뒤집으면 안 된다

서빙 전략이 **공개 버킷 + 공개 URL**(사용자 결정 2026-08-31)이라는 사실이 spec 에 없다.
이건 구현 세부가 아니라 **제품 속성**이다:

- **아바타 이미지는 URL 을 아는 누구나 접근할 수 있다.** 워크스페이스 멤버 전용이 아니다.
- 완화는 키의 UUID(추측 불가능성)뿐이고, 그건 **접근 통제의 일부**다 — "그냥 유니크한 이름"
  으로 서술하면 다음 사람이 예측 가능한 키로 바꿔도 된다고 읽는다.
- **SVG 는 의도적으로 제외**한다(스크립트를 품을 수 있어 저장형 XSS 표면).
- **배포 선행 조건**: `avatars/` 접두에 익명 GET 을 허용하는 **버킷 정책**이 필요하다.
  없으면 업로드는 성공하고 **이미지만 403** 이 된다 — 증상이 업로드가 아니라 표시에서 난다.
  `S3_PUBLIC_BASE_URL` 도 함께 문서화 대상이다(`S3_ENDPOINT` 와 다른 값일 수 있다).

이 셋을 빼고 배지만 뒤집으면 spec 이 "파일 업로드가 된다" 까지만 말하고 **공개된다는 사실을
숨기게 된다.** 그게 이 항목의 실제 무게다.

## 관련

- 구현: `plan/in-progress/spec-sync-user-profile-gaps.md` §6.1 항목 (완료 기록·뮤테이션 실측)
- 코드: `users.controller.ts` `uploadAvatar` · `users.service.ts` `updateAvatar` ·
  `common/services/s3.service.ts` `getPublicUrl`
- 회귀: `codebase/backend/src/modules/users/users-avatar.service.spec.ts` (13건, 3축)
