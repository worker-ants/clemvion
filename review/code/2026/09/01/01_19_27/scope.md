# 변경 범위(Scope) 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)

## 개요

이번 라운드는 8번째 `/ai-review` 사이클이다. `git diff origin/main...HEAD --stat` 기준 143개
파일이 바뀌었지만, 그중 `review/code/2026/08/31/**`·`review/code/2026/09/01/00_*/**`(직전
7라운드분)는 전부 이전 리뷰 라운드의 산출물이 이번 PR 커밋에 누적된 것으로, 프로젝트 규약상
`review/code/**` 는 커밋 대상 산출물이며 이번 기능 리뷰의 감사 이력 그 자체다 — 별도 기능·별도
변경 의도가 섞인 것이 아니다. 실질 코드/설정/문서 변경은 CHANGELOG·README·`.env.example`·
`s3.config.ts`(+spec)·`s3.service.ts`(+spec)·`main.ts`·`users.controller.ts`(+spec)·
`users.module.ts`·`users.service.ts`(+spec)·신규 `users-avatar.service.spec.ts`·
`users-avatar-swagger-sync.spec.ts`·`users-login-attempts.service.spec.ts`·e2e spec·
`docker-compose*.yml`·`k8s/**`·`scripts/minio/**`·plan 2건 — 전부 "아바타 이미지 업로드(공개
버킷+공개 URL)" 단일 기능으로 수렴한다.

가장 최신 커밋(`f24584a35`, "리뷰 7R — 로그인 카운터")이 이번 라운드의 신규 검토 대상인데,
`incrementLoginAttempts`(로그인 실패 카운터·계정 잠금 — 아바타와 무관한 인증 로직)를 통째로
raw SQL 원자 UPDATE 로 재작성한다. 이는 **이 PR 자신이 만든 CRITICAL 동시성 결함**
(`review/code/2026/09/01/00_55_27/concurrency.md` — `updateAvatar` 가 컬럼 단위 update 로
바뀌면서 반대 방향 경쟁이 남았다는 지적)에 대한 직접 수정이고, `plan/in-progress/spec-sync-user-profile-gaps.md`
에 반증 이력·전제 표와 함께 정확히 disclose 돼 있다 — scope creep 이 아니라 이 기능이 스스로
발견한 버그의 폐루프다.

## 발견사항

- **[INFO]** `Express` → `ExpressNS` import 개명이 아바타와 무관한 두 메서드
  (`changePassword`, `verifyEmailChange`)의 파라미터 타입 표기까지 함께 바꾼다
  - 위치: `codebase/backend/src/modules/users/users.controller.ts` — import 선언부
    (`import ExpressNS from 'express';`), `changePassword` 의 `@Req() req: ExpressNS.Request`
    / `@Res() res: ExpressNS.Response`, `verifyEmailChange` 의 동일 패턴
  - 상세: `import Express from 'express'` 가 전역 `Express` 네임스페이스를 가려
    `@types/multer` 의 `Express.Multer.File` 증강을 새 `uploadAvatar` 파라미터에 쓸 수
    없었다는 실측(`Namespace 'e' has no exported member 'Multer'`)에 근거한 기계적
    리네임이다 — 파일 안의 모든 `Express.*` 참조를 함께 고쳐야 하므로 두 기존 메서드의
    시그니처가 딸려 온다. 런타임 동작 변화는 없는 순수 타입 표기 변경이며, CHANGELOG
    (`## Unreleased — 아바타 이미지 업로드` 문단)와
    `plan/in-progress/spec-sync-user-profile-gaps.md`("부수 — `Express` 네임스페이스
    shadowing" 항목, 사용처 4곳 동반 명시)에 이유·범위가 disclose 돼 있고, 같은 문제가 없는
    다른 4개 컨트롤러는 건드리지 않아 스스로 범위를 최소화했다. 직전 3라운드
    (`review/code/2026/08/31/23_19_39/scope.md`)에서도 같은 지점을 INFO 로 확인했다.
  - 제안: 조치 불필요 — 참고용으로만 유지.

- **[INFO]** `incrementLoginAttempts` 전면 재작성(`save(user)` → raw SQL 원자 UPDATE)이
  "아바타 업로드" 기능 이름표 밖의 인증/보안 로직을 건드린다
  - 위치: `codebase/backend/src/modules/users/users.service.ts` (`incrementLoginAttempts`
    본문 — 최신 커밋 `f24584a35`), 신규 `codebase/backend/src/modules/users/users-login-attempts.service.spec.ts`
  - 상세: 로그인 실패 카운터·계정 잠금은 아바타 업로드와 도메인이 다르지만, 이 PR 이 앞서
    `updateAvatar` 를 `save(entity)` → 컬럼 단위 `update()` 로 바꾸면서 "다른 컬럼 lost-update
    를 없앴다" 고 주장한 것을, 같은 row 를 건드리는 반대편 writer(`incrementLoginAttempts`)가
    여전히 전체 스냅샷 `save()` 라서 반증했다(`review/code/2026/09/01/00_55_27/concurrency.md`
    의 CRITICAL 지적). 즉 이번 재작성은 이 PR 이 스스로 만든/노출한 결함을 이 PR 범위 안에서
    닫는 수정이지, 무관한 리팩터링이 아니다. `plan/in-progress/spec-sync-user-profile-gaps.md`
    에 반증 이력·전제표(스냅샷 전체 `save()` 가 남은 지점이 이제 없음을 실측)가 함께 등재돼
    범위·근거가 투명하다.
  - 제안: 조치 불필요 — 다만 다음 리뷰어가 "아바타 PR인데 왜 로그인 카운터가 바뀌었나" 라고
    오탐할 수 있으니 참고용으로 남긴다.

- **[INFO]** `toProfileData()` 헬퍼 추출과 `avatarUrl` 정리 로직이 `update()`(범용 PATCH,
  호출부 17곳)에 들어간 것은 이미 3라운드 scope 리뷰가 확인한 "정당화된 collateral" 이며
  이번 diff 에서도 동일 형태로 재확인된다
  - 위치: `codebase/backend/src/modules/users/users.controller.ts` (`toProfileData` 신설 +
    `getMe`/`updateMe` 교체), `codebase/backend/src/modules/users/users.service.ts` (`update()`
    의 `'avatarUrl' in data` 분기)
  - 상세: 신규 근거 추가 없이 이전 라운드 결론과 일치 — DRY 근거(3번째 소비자)와 조건부
    가드(`avatarUrl` in data + 값 변경 시에만)로 영향 범위가 최소화돼 있다.
  - 제안: 조치 불필요.

## 요약

143개 변경 파일 중 실질 코드·설정·문서·plan 파일은 전부 "아바타 이미지 업로드(공개 버킷+공개
URL)" 단일 기능의 구현·회귀 테스트·배포 설정·문서·추적으로 수렴하며, 나머지는 동일 기능에 대한
이전 리뷰 라운드 산출물(`review/code/**`, 규약상 커밋 대상)이다. 유일하게 반복 지목되는 collateral
은 `Express` 네임스페이스 리네임(무관 메서드 2곳의 타입 표기 변경, 런타임 무영향)과 이번 라운드
신규로 검토한 `incrementLoginAttempts` 전면 재작성인데, 후자는 무관한 리팩터링이 아니라 이 PR
자신의 이전 수정이 반대 방향으로 열어 둔 CRITICAL lost-update 를 이 PR 범위 안에서 닫는 수정이며
plan 문서에 반증 이력·전제·재개 조건까지 투명하게 기록돼 있다. 기능과 무관한 파일·영역 수정,
요청하지 않은 기능 확장, 의미 없는 포맷팅/주석/임포트 잡음, 의도치 않은 설정 변경은 관찰되지
않았다. spec 배지 flip(`9-user-profile.md` "미구현" 해제)도 developer 가 직접 고치지 않고
`spec-update-avatar-upload-implemented.md` planner 트랙으로 정확히 위임돼 권한 경계도 지켜졌다.

## 위험도

LOW
