# 변경 범위(Scope) 코드 리뷰

## 개요

이 PR 은 "아바타 이미지 업로드(공개 버킷 + 공개 URL)" 기능 단일 목적의 구현이다. 21개 파일,
+980/-24 줄. `S3Service.getPublicUrl` 신설 → `POST /api/users/me/avatar` 엔드포인트 → 배포
전 환경(docker-compose·docker-compose.e2e·k8s base/overlay·README·.env.example)의
`S3_PUBLIC_BASE_URL` 전파 → 회귀 테스트(뮤테이션 6축) → plan 갱신 + spec 위임 plan 신설까지,
기능 하나를 배포 가능한 상태로 완결하는 데 필요한 변경들로 구성돼 있다. 아래는 그중 "새
엔드포인트" 범위를 좁게 잡았을 때 경계에 걸치는 두 지점이다 — 둘 다 CHANGELOG/코드 주석에
근거가 명시돼 있어 은폐된 변경은 아니다.

## 발견사항

- **[INFO]** `UsersController.toProfileData()` 추출 리팩토링이 기존 `getMe`/`updateMe` 두
  엔드포인트의 응답 조립 코드를 함께 변경한다
  - 위치: `codebase/backend/src/modules/users/users.controller.ts:84-93`(신설 private 메서드),
    `:113`(`getMe` 가 인라인 객체 리터럴 대신 `...this.toProfileData(user)` 사용),
    `:140`(`updateMe` 가 `return { data: this.toProfileData(updated) };` 로 교체)
  - 상세: 요청 범위는 "아바타 업로드 엔드포인트 신설"이다. 새 `uploadAvatar` 가 같은 프로필
    응답 모양을 내야 하므로 세 번째 중복을 만들지 않고 기존 두 곳(`getMe`, `updateMe`)의
    인라인 객체 리터럴까지 공통 메서드로 뽑아냈다 — 새 엔드포인트가 직접 요구하지 않는 기존
    코드 영역(두 기존 핸들러의 응답 조립부)을 수정한 셈이다. 동작 자체는 동일(순수 추출,
    `getMe` 는 여전히 `pendingEmail` 을 스프레드로 별도 추가)하고 diff 도 작아, 실질 위험은
    낮다.
  - 제안: 의도적 DRY 리팩토링이면 문제 없음. 다만 "새 엔드포인트만" 이 엄격한 범위였다면
    커밋 메시지/PR 설명에 이 추출을 별도로 언급해 리뷰어가 `getMe`/`updateMe` diff 를
    "동작 미변경 리팩토링"으로 식별하기 쉽게 하는 편이 낫다.

- **[INFO]** `import Express from 'express'` → `import ExpressNS from 'express'` 개명이
  아바타 업로드와 무관한 기존 2개 핸들러(`changePassword`, `verifyEmailChange`)의 파라미터
  타입까지 바꾼다
  - 위치: `codebase/backend/src/modules/users/users.controller.ts:57`(신규 import),
    `:214-215`(`changePassword` 의 `@Req()/@Res()` 타입), `:301-302`(`verifyEmailChange` 의
    `@Req()/@Res()` 타입)
  - 상세: `Express` 를 default import 하면 전역 `Express` 네임스페이스가 가려져
    `@types/multer` 가 augment 한 `Express.Multer.File` 을 새 `uploadAvatar` 파라미터에 쓸 수
    없다(CHANGELOG·코드 주석에 실측 에러 메시지까지 명시). import 이름을 바꾸는 순간 그
    이름을 참조하던 기존 2개소도 컴파일이 깨지므로 동반 수정은 **선택이 아니라 필수** —
    스코프 이탈이라기보다 새 기능이 노출시킨 잠재 버그의 최소 봉합에 가깝다. CHANGELOG 에도
    "부수" 항목으로 명시적으로 분리 기재돼 있어 은폐되지 않았다.
  - 제안: 처리 방식 자체는 적절함(대안은 없음 — named import 로 바꾸는 것도 동일한 범위의
    수정이 필요했을 것). 조치 불요, 참고로만 기록.

- **[INFO]** `UsersService.update()`(호출부 17곳의 공용 메서드)에 아바타 정리 로직이
  추가돼, 새 엔드포인트가 아니라 기존 `PATCH /api/users/me` 경로의 동작이 확장된다
  - 위치: `codebase/backend/src/modules/users/users.service.ts:185-199`
  - 상세: 요청 범위가 "`POST /api/users/me/avatar` 신설"이었다면, 기존 범용 `update()` 를
    바꾸는 것은 그 경계를 넘는다. 다만 이 확장은 이 PR 자체의 핵심 위험(공개 버킷의 고아
    객체)을 위해 직접 필요한 조치다 — `POST me/avatar` 로만 정리하면 `PATCH me` 로 아바타를
    다시 덮을 때 고아가 남는 회귀가 남는다는 점을 PR 자체가 테스트로 고정하고 있다
    (`users-avatar.service.spec.ts:221-276`). 변경은 `'avatarUrl' in data` 가드로 나머지
    16개 호출부에는 부작용이 없도록 좁혀져 있다.
  - 제안: 조치 불요. "아바타 업로드"라는 제품 기능의 완결성 관점에서 정당한 확장이며,
    가드·회귀 테스트·주석 근거가 모두 갖춰져 있다.

- **[INFO]** `S3_PUBLIC_BASE_URL` 환경변수가 5개 인프라 파일
  (`docker-compose.yml`, `docker-compose.e2e.yml`, `k8s/base/configmap.yaml`,
  `k8s/overlays/local/configmap-patch.yaml`, `README.md`, `.env.example`)에 반복 등재된다
  - 상세: 코드 자체보다 넓어 보일 수 있으나, 새 config 값이 실제로 동작하려면 모든 배포
    경로에 값이 있어야 하고 없으면 "업로드는 성공하고 이미지만 403" 이라는 조용한 실패가
    난다는 점을 CHANGELOG·plan 이 반복 경고한다. 각 파일의 변경은 1~3줄의 단일 키 추가뿐이고
    포맷·구조 변경이 없다. 스코프 이탈이 아니라 배포 가능성을 위한 필수 전파로 판단.
  - 제안: 조치 불요.

- **[INFO]** `plan/in-progress/spec-update-avatar-upload-implemented.md` 신설(spec 배지
  flip 을 planner 트랙으로 위임하는 plan)
  - 상세: `spec/` 쓰기는 developer 권한 밖이므로, 자기-반증형 소정정 예외에도 해당하지
    않는다고 스스로 판단해 별도 plan 으로 위임했다(CLAUDE.md 규약과 일치). `plan/**` 쓰기는
    developer 허용 범위이며, 새 파일 생성이 이번 기능과 직접 연관돼 있다. 무관한 파일·영역
    수정 아님.
  - 제안: 조치 불요.

## 요약

포맷팅 노이즈, 무관 파일 수정, 요청하지 않은 기능 확장(over-engineering), 불필요한 임포트
정리, 설정 드리프트 같은 전형적 스코프 이탈 패턴은 관측되지 않았다. 경계에 걸치는 세 지점
(`toProfileData` 추출, `Express`→`ExpressNS` 개명, `update()` 확장)은 모두 새 엔드포인트가
직접 만든 필요·위험에서 파생된 최소 조치이며 CHANGELOG·plan·테스트 주석에 근거가 명시돼
투명하게 드러나 있다. 인프라 파일 5곳의 env var 전파도 배포 가능성을 위한 필수 동반 변경으로
판단된다. 리팩토링성 두 항목(`toProfileData`, `Express` rename)은 "새 엔드포인트만"이라는
엄격한 스코프 기준으로는 언급할 가치가 있어 INFO 로 기록했으나, 둘 다 실질적 리스크는 낮다.

## 위험도

LOW
