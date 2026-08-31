# 변경 범위(Scope) 리뷰

대상: 아바타 이미지 업로드(`POST /api/users/me/avatar`, 공개 버킷 + 공개 URL 서빙) 구현 PR. 26개 파일(backend 코드/테스트, docker-compose, k8s manifest, docs, plan, minio 정책) 전수 검토.

## 발견사항

- **[INFO]** `import Express from 'express'` → `import ExpressNS from 'express'` 전역 rename 이 avatar 업로드와 무관한 두 메서드(`changePassword`·`verifyEmailChange`)의 시그니처까지 건드린다
  - 위치: `codebase/backend/src/modules/users/users.controller.ts:53` (import 변경), `codebase/backend/src/modules/users/users.controller.ts:217-218` (`changePassword` 의 `@Req() req: ExpressNS.Request` / `@Res() res: ExpressNS.Response`), `codebase/backend/src/modules/users/users.controller.ts:304-305` (`verifyEmailChange` 동일 패턴)
  - 상세: default import 는 파일 전체에 한 바인딩만 가능하므로, `Express.Multer.File` 타입을 쓰려면 기존 `Express` 바인딩을 다른 이름으로 옮길 수밖에 없다 — 즉 새 엔드포인트가 요구하는 side effect 로, 다른 두 메서드는 동작 변경 없이 타입 참조 표기만 바뀐다. CHANGELOG(`CHANGELOG.md:51-54`)와 plan(`plan/in-progress/spec-sync-user-profile-gaps.md` "부수 — Express 네임스페이스 shadowing" 절)에 명시적으로 "부수"로 기록돼 있고, 리뷰 라운드에서 `ExpressModule` 후보명이 `@Module()` 과 표기 충돌한다는 지적을 받아 `ExpressNS` 로 조정한 이력까지 남겼다. 다른 4개 컨트롤러의 `import Express` 는 의도적으로 건드리지 않았다고 명시 — scope 확산을 스스로 억제한 흔적.
  - 제안: 조치 불필요. 필요·불가피한 side effect 이고 문서화도 충분하다. 참고용 기록.

- **[INFO]** `UsersService.update()` — avatar 업로드와 직접 관련 없는 범용 PATCH 경로(호출부 17곳)의 쓰기 동작이 확장됐다
  - 위치: `codebase/backend/src/modules/users/users.service.ts:232-246` (`update` 메서드 — `previousUrl` 조회 + `deletePreviousAvatarObject` 호출 추가)
  - 상세: `POST /me/avatar` 신설이 요청의 핵심이지만, `PATCH /users/me` 로 `avatarUrl` 을 직접 바꿀 때 옛 S3 객체가 정리되지 않으면 업로드 경로에서만 청소가 되어 고아 객체가 남는다는 논리로 범용 메서드까지 확장했다. `'avatarUrl' in data` 가드로 나머지 16개 호출부에 SELECT 를 추가하지 않도록 스코프를 좁혔고, 값 비교(바뀐 경우만 정리)로 OAuth 재연동 시 오탐도 막았다(테스트로 고정: `users-avatar.service.spec.ts` "PATCH 로 아바타를 바꿔도 옛 객체를 정리한다" 스위트). plan 문서에 리뷰 W8/W9 로 "정리 불변식을 한 곳으로 모으자"는 구조 개선 제안이 있었으나 이번 PR 범위 밖으로 명시적으로 유예했다.
  - 제안: 조치 불필요. 같은 기능(아바타 생애주기)의 정합성 버그를 막기 위한 필연적 확장이고, 유예 판단도 plan 에 근거와 함께 기록돼 있다.

- **[INFO]** `main.ts` production 부트스트랩에 `S3_PUBLIC_BASE_URL` 사설 호스트 경고 로직 신규 추가 — 엔드포인트 구현의 최소 범위를 넘는 방어적 추가
  - 위치: `codebase/backend/src/main.ts:152-172` (NODE_ENV=production 분기 신규 블록), import 추가는 `codebase/backend/src/main.ts:52`
  - 상세: "avatar 업로드 엔드포인트 신설"이라는 요청 범위를 엄밀히 보면 이 startup 가드는 필수 요구사항이 아니다. 다만 손으로 짠 판정이 아니라 기존 정본 `isPrivateHost`(SSRF 가드)를 재사용했고, `warn` 만 남기고 `throw` 하지 않는 이유가 기존 `ALLOW_PRIVATE_HOST_TARGETS` 패턴과 동일하다고 CHANGELOG/코드주석에 근거를 남겼다. 실제로 이 PR 작업 중 k8s prod/staging overlay patch 를 빠뜨릴 뻔했다는 사후 근거(리뷰 3라운드)까지 제시돼 있어, 방금 도입한 신규 env var 하나에 국한된 좁은 가드다.
  - 제안: 조치 불필요. 새 config 값 하나에 국한되고 기존 유틸을 재사용해 신규 로직 표면이 작다 — over-engineering 으로 보기 어렵다.

- **[INFO]** `UsersController.toProfileData()` 추출 리팩터링이 기존 `getMe` 응답 조립부까지 함께 바꾼다
  - 위치: `codebase/backend/src/modules/users/users.controller.ts:84-93`(신규 private 메서드), `codebase/backend/src/modules/users/users.controller.ts:113`(`getMe` 의 리터럴 객체 → `...this.toProfileData(user)` 치환)
  - 상세: 새 엔드포인트가 기존 `getMe`/`updateMe` 와 동일한 프로필 응답 모양을 세 번째로 필요로 하게 되면서, 리터럴 중복을 막기 위해 추출한 것으로 보인다. `getMe` 쪽 코드가 동작 변경 없이 호출부만 바뀌었고 테스트(`users.controller.spec.ts`)도 그대로 통과하는 리팩터링이라 위험은 낮다.
  - 제안: 조치 불필요. 세 번째 사용처가 생겨서 발생한 통상적인 중복 제거로, "관련 없는 리팩터링"으로 보기 어렵다.

## 요약

26개 파일 전부가 "아바타 이미지 업로드(공개 버킷+공개 URL)"라는 단일 기능으로 추적 가능하다 — backend 구현/테스트, S3 public URL 설정, docker-compose·k8s 배포 설정, MinIO 버킷 정책, CHANGELOG·plan 문서까지 모두 이 기능의 구현·배포·회귀방지에 직접 연결된다. 범위를 벗어난 것처럼 보일 수 있는 네 지점(Express 네임스페이스 rename, 범용 `update()` 확장, `main.ts` production 가드, `toProfileData` 추출)은 전부 새 엔드포인트가 강제하는 필연적 side effect이거나 같은 기능의 정합성을 지키기 위한 좁게 스코프된 확장이며, CHANGELOG·plan 문서에 근거와 함께 명시적으로 기록돼 있다. 무관한 파일 수정, 의미 없는 포맷팅/공백 변경, 미사용 임포트, 설명 없는 설정 변경은 발견되지 않았다. `auth-oauth.service.ts` 처럼 같은 문제(아바타 정리 불변식 우회)가 있는 인접 코드를 건드리지 않고 캐너리 테스트 + plan 유예 항목으로 남긴 것도 scope 자제의 근거로 볼 수 있다.

## 위험도
LOW
