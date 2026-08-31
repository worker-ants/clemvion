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

**대상은 세 문서다** — 초판에는 `9-user-profile.md` 만 적었고, 리뷰(2026-08-31)가 `0-overview.md §2.7` 과 `data-flow/4-file-storage.md` 누락을 잡았다. `spec/` 쓰기라 **planner 트랙**이다. developer 는 권한 밖이고, 자기-반증형 소정정 예외에도
해당하지 않는다 — 그 문장은 developer 가 쓴 **예고**가 아니라 제품 정의 서술이다.

선례: `spec-sync-websocket-protocol-gaps.md` 의 `notification.new` 배지 flip 도 같은 방식으로
planner 에 위임됐다.

## 할 일

- [ ] `:334` 표 행 — 취소선·"미구현 (Planned)" 해제, 구현 형태 반영
- [ ] `:136` 아바타 행 — "이미지 파일 업로드는 미구현" 서술 정정
- [ ] `§6.1` 에 **엔드포인트 계약**을 적는다 — `multipart/form-data` `file`, 최대 2MB,
      허용 확장자 `png/jpg/jpeg/webp/gif`, 응답은 `PATCH /users/me` 와 동일한 프로필 봉투
- [ ] 착수 시 `/consistency-check --spec` (planner 의무 게이트)

### 같은 사실을 말하는 다른 SoT 문서 — 리뷰(2026-08-31)가 잡은 누락

초판 위임은 `9-user-profile.md` **한 문서만** 적었다. 그런데 아바타 S3 키 패턴을 말하는
문서가 둘 더 있고, 둘 다 **실제 구현과 다른 패턴**을 정의한 채 "미구현" 으로 남아 있다.
이건 문서 흠결이 아니라 **운영자를 잘못된 버킷 정책으로 이끄는 경로**다 — 아래 §왜 이게
Critical 인가 참조.

- [ ] [`spec/0-overview.md`](../../spec/0-overview.md) §2.7 — 스토리지 레이아웃 트리의
      `avatars/` 항목과 아래 표의 `Form 노드 업로드 / Avatar` 행
      (`{workspaceId}/avatars/...` · **"계획 (코드 미구현)"**)
- [ ] [`spec/data-flow/4-file-storage.md`](../../spec/data-flow/4-file-storage.md) —
      §1.1 제목·§1.2(자기-참조 TODO "기능 도입 시 갱신하라")·§2.1 키 패턴 표의
      `<workspaceId>/avatars/<userId>.<ext>` 행(**"spec 정의, 미구현"**)·§2.2 `avatar_url`
      서술("현재는 외부 URL 또는 빈 값")·§2.3 설정 매핑에 **신규 `s3.publicBaseUrl` 행** 추가
- [ ] [`spec/5-system/3-error-handling.md`](../../spec/5-system/3-error-handling.md) §1
      에러 카탈로그에 **`FILE_REQUIRED`**(파일 누락)과 **`INVALID_FILE_TYPE`**(확장자 불허,
      knowledge-base 와 공용) 등재

**실제 구현 키는 `avatars/{userId}/{uuid}.{ext}` 다** — `workspaceId` 가 없고 파일명이 UUID 다.

- `workspaceId` 부재는 의도다. `User` 는 워크스페이스 종속 리소스가 아니다(한 사용자가 여러
  워크스페이스에 속한다). 워크스페이스별로 키를 나누면 아바타가 워크스페이스마다 갈라진다.
- UUID 파일명도 의도다. 공개 버킷에서 **키가 곧 접근 통제**라, `{userId}.{ext}` 처럼 예측
  가능하면 멤버 목록을 아는 사람이 아바타를 열거할 수 있다.

### 왜 이게 Critical 인가 — stale spec 이 만드는 실패

`4-file-storage.md` §2.1 을 SoT 삼아 버킷 정책을 `{workspaceId}/avatars/` 접두로 설계하면,
실제 객체는 `avatars/` 아래 있으므로 정책이 걸리지 않는다. 그러면 **업로드는 성공하고 이미지만
403** 이 된다 — 구현 CHANGELOG 가 반복해서 경고하는 바로 그 실패를, spec 을 믿은 대가로
재현하게 된다.

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
- 회귀: `codebase/backend/src/modules/users/users-avatar.service.spec.ts` — **30건**
  (§6.1 핵심 3축 13건 + 리뷰 1~3라운드 대응 17건). 실측: `jest --silent <file>`
