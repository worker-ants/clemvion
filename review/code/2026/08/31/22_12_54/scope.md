# 변경 범위(Scope) 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)

## 발견사항

- **[INFO]** `Express` → `ExpressModule` 리네임이 기능과 무관한 두 엔드포인트의 파라미터 타입을 함께 바꾼다
  - 위치: `codebase/backend/src/modules/users/users.controller.ts:213-214`(`changePassword`), `:300-301`(`verifyEmailChange`) — `@Req() req: Express.Request` → `ExpressModule.Request`, `@Res() res: Express.Response` → `ExpressModule.Response`
  - 상세: 이번 작업의 목적은 아바타 업로드 신설인데, `import Express from 'express'` 가 전역 `Express` 네임스페이스를 가려 `@types/multer` 의 `Express.Multer.File` 을 새 엔드포인트에서 쓸 수 없었다는 실측(`Namespace 'e' has no exported member 'Multer'`)에 의해 import 이름을 바꿨고, 그 부수효과로 이미 존재하던 `changePassword`·`verifyEmailChange` 두 메서드의 파라미터 타입 표기까지 바뀌었다. 순수 타입 레벨 리네임이라 런타임 동작 변화는 없지만, diff 상으로는 기능과 무관한 두 메서드 시그니처가 함께 수정된 것으로 보인다.
  - 제안: 실질적인 문제는 아님 — CHANGELOG(`부수로 users.controller.ts 의 import Express from 'express' 를 ExpressModule 로 개명했다…`)와 `plan/in-progress/spec-sync-user-profile-gaps.md`(`부수 — Express 네임스페이스 shadowing`) 양쪽에 그 이유와 범위(사용처 4곳 동반)가 명시적으로 disclose 돼 있어, "의도 이상의 변경이 조용히 섞여 있다"는 우려에는 해당하지 않는다. 다만 리뷰어가 diff만 보면 무관한 곳을 건드린 것으로 오인할 수 있으므로 참고용으로 기록한다.

## 요약

CHANGELOG·`.env.example`·`s3.config.ts`·`s3.service.ts`·`users-avatar.service.spec.ts`(신규)·`users.controller.ts`·`users.module.ts`·`users.service.spec.ts`·`users.service.ts`와 2개의 plan 문서 총 11개 파일 모두 "아바타 이미지 업로드(공개 버킷 + 공개 URL)" 라는 단일 기능에 직접 연결된다. `users.service.spec.ts`에 추가된 `S3Service` 강제-throw 스텁, `users.module.ts`의 provider 등록, `s3.config.ts`/`.env.example`의 `S3_PUBLIC_BASE_URL` 은 전부 새 생성자 의존성·신규 env 변수로 인해 필연적으로 따라오는 변경이라 scope creep 이 아니다. 유일하게 짚을 만한 지점은 `ExpressModule` 리네임이 기능과 무관한 기존 두 엔드포인트의 파라미터 타입 표기를 함께 바꾼 것인데, 이는 실측된 컴파일 차단(전역 네임스페이스 가림)을 해소하기 위한 순수 타입 레벨 부수효과이며 CHANGELOG·plan 양쪽에 명시적으로 disclose 돼 있다. spec 배지 flip("미구현 (Planned)" 해제)은 developer 가 직접 고치지 않고 별도 planner 트랙(`spec-update-avatar-upload-implemented.md`)으로 정확히 위임했다 — 권한 경계도 지켜졌다. 불필요한 리팩토링·기능 확장(over-engineering)·무관한 파일 수정·포맷팅 잡음·불필요한 주석/임포트 변경은 관찰되지 않았다.

## 위험도

LOW
