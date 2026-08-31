# 변경 범위(Scope) 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)

## 발견사항

- **[WARNING]** `ExpressNS` 리네임 근거 주석이 사실상 중복으로 두 문단 남아 있다
  - 위치: `codebase/backend/src/modules/users/users.controller.ts:53-61`
  - 상세: 53~56행("`Express` 로 default import 하면 **전역 `Express` 네임스페이스를 가린다**…아바타 업로드가 그 지점을 처음 밟아서 이름을 바꾼다")과 57~61행("`Express` 가 아니라 `ExpressNS` 인 이유: default import 이름이 `Express` 면 **전역 `Express` 네임스페이스를 가려서**…")이 같은 사실(전역 `Express` 네임스페이스 shadowing → `@types/multer` 의 `Express.Multer.File` 사용 불가 → 실측 에러 메시지 `Namespace 'e' has no exported member 'Multer'`)을 사실상 그대로 반복한다. `git log -S`로 추적하면 두 문단은 서로 다른 커밋에서 생겼다 — 1문단은 `Express`→`ExpressModule` 리네임 커밋에서, 2문단은 최신 커밋 `ecaa785bd`("리뷰 5R")에서 "리네임 이유가 커밋 메시지에만 있었다 → import 위에 실측 오류 메시지와 함께 적는다"는 의도로 **기존 1문단을 지우지 않고 그 위에 새로 추가**됐다. 2문단이 덧붙이는 신규 정보(다른 컨트롤러 4곳은 안 건드림, 전역 컨벤션 승격 시 `spec/conventions/` 선행 필요)는 유효하지만, 그 앞의 반복된 설명(네임스페이스 가림 메커니즘 + 동일한 실측 에러 문자열)은 불필요한 주석 중복이다 — 반복 편집 라운드가 새 문단을 이전 문단과 병합하지 않고 누적시킨 흔적이다.
  - 제안: 두 문단을 하나로 합친다 — "왜 이름을 바꿨는지"(네임스페이스 shadowing + 실측 에러)를 한 번만 서술하고, 2문단의 신규 정보(다른 컨트롤러 미적용 범위·컨벤션 승격 선행조건)만 이어 붙인다.

- **[INFO]** `ExpressNS` 리네임이 기능과 무관한 두 기존 엔드포인트의 파라미터 타입 표기를 함께 바꾼다 (이전 라운드 스코프 리뷰에서 이미 지적·disclose됨, 재확인만)
  - 위치: `codebase/backend/src/modules/users/users.controller.ts` — `changePassword`(`@Req() req: ExpressNS.Request`, `@Res() res: ExpressNS.Response`), `verifyEmailChange`(동일 패턴). `grep -n "ExpressNS\." codebase/backend/src/modules/users/users.controller.ts` 로 확인: 222-223행·309-310행.
  - 상세: 이번 작업의 목적은 아바타 업로드 신설인데, `import Express from 'express'` 가 전역 `Express` 네임스페이스를 가려 `@types/multer` 의 `Express.Multer.File` 을 새 엔드포인트에서 쓸 수 없었다는 실측에 의해 import 식별자를 바꿨고, 그 부수효과로 이미 존재하던 `changePassword`·`verifyEmailChange` 두 메서드의 파라미터 타입 표기(순수 타입 레벨, 런타임 무변화)까지 함께 바뀌었다.
  - 제안: 실질 문제 아님 — CHANGELOG·`plan/in-progress/spec-sync-user-profile-gaps.md` 양쪽에 이유와 영향 범위가 명시적으로 disclose 돼 있다. 이전 라운드(`review/code/2026/08/31/22_12_54/scope.md`)에서 이미 같은 판정(LOW, 실질 문제 아님)이 내려졌고 이번 라운드까지 재점검한 결과도 동일하다.

## 그 외 점검 결과 (문제 없음)

- **파일 목록**: `git diff origin/main...HEAD --stat`(review/ 산출물 제외)로 확인한 27개 파일 전부가 "아바타 이미지 업로드 (공개 버킷 + 공개 URL)" 단일 기능에 직접 연결된다 — 컨트롤러/서비스/모듈/설정(`s3.config.ts`)/테스트(unit·e2e)/인프라(`docker-compose*.yml`, `k8s/**`, `scripts/minio/**`)/문서(`CHANGELOG.md`, `README.md`, `.env.example`, `k8s/README.md`)/plan 2건. `package.json`·lockfile 등 의존성 변경, 무관 모듈 변경은 없다.
- **`toProfileData` 사설 헬퍼 추출** (`users.controller.ts`): `getMe`·`updateMe`·`uploadAvatar` 세 엔드포인트가 동일한 프로필 응답 봉투를 만들어야 해서 공통 헬퍼로 추출됐다 — 신규 엔드포인트가 기존 두 엔드포인트와 같은 모양을 내야 하는 데서 필연적으로 나온 변경이며, 그 이상의 무관한 리팩토링은 없다(기존 두 메서드의 필드·순서·기본값 로직은 그대로 옮겨졌을 뿐 변경되지 않았다).
- **`UsersService.update()`(PATCH 경로) 정리 로직 추가**: `avatarUrl` 이 페이로드에 있고 값이 바뀐 경우에만 옛 S3 객체를 정리하도록 확장됐다. `PATCH /users/me` 로도 `avatarUrl` 을 설정/교체할 수 있었던 기존 경로이므로, 업로드 경로(`updateAvatar`)와 같은 "옛 객체 정리" 불변식을 적용하는 것은 이 기능의 정합성 범위 안이다 — over-engineering 이 아니다.
- **설정/인프라 변경**: `S3_PUBLIC_BASE_URL` 신규 env 전파(`.env.example`, `README.md`, `docker-compose.yml`, `docker-compose.e2e.yml`, `k8s/base/configmap.yaml`, `k8s/overlays/{local,prod,staging}/*`)와 버킷 정책 파일(`scripts/minio/avatars-public-read.json`) 추가는 전부 공개 URL 서빙 전략이 요구하는 배포 선행 조건이며, 새 기능이 만든 신규 env 변수 하나의 자연스러운 동반 전파다. 무관한 다른 env 나 설정 값을 건드리지 않았다.
- **포맷팅/임포트**: diff 전반에 걸쳐 의미 없는 공백·개행 변경이나 무관한 import 정리는 관찰되지 않는다. `main.ts` 는 기존 `isPrivateHost`(ssrf.util) 를 재사용했을 뿐 신규 유틸을 손으로 다시 짜지 않았다.
- **spec 쓰기 권한 경계**: `spec/2-navigation/9-user-profile.md` 의 "미구현 (Planned)" 배지 flip 은 developer 가 직접 고치지 않고 별도 planner 트랙(`plan/in-progress/spec-update-avatar-upload-implemented.md`)으로 위임됐다 — 자기-반증형 소정정 예외에도 해당하지 않는다는 판단까지 plan 문서에 명시돼 있어 권한 경계가 지켜졌다.
- **review/ 산출물**: 이번 diff 에 포함된 `review/code/2026/08/31/22_12_54/**`·`22_44_14/**`·`23_19_39/**`·`23_46_40/**`·`review/code/2026/09/01/00_11_39/**` 는 이 PR 의 이전 리뷰 라운드가 생성한 산출물이며, 프로젝트 컨벤션상 `review/` 는 gitignore 대상이 아니라 커밋되는 것이 정상이다 — developer 코드 스코프의 creep 으로 보지 않는다.

## 요약

전체 diff(27개 코드/설정/문서 파일, review/ 산출물 제외)는 "아바타 이미지 업로드(공개 버킷 + 공개 URL)"라는 단일 기능에 필요한 구현·테스트·인프라·문서로 정확히 좁혀져 있고, 의존성 변경·무관 모듈 수정·불필요한 리팩토링·기능 확장(over-engineering)은 관찰되지 않는다. `ExpressNS` 리네임이 기존 두 엔드포인트의 타입 표기에 부수효과를 낸 것은 CHANGELOG·plan 양쪽에 명시적으로 disclose 된 실측 기반 변경이라 문제 삼지 않는다(이전 라운드 스코프 리뷰와 동일 판정). 다만 그 리네임 근거를 코드 주석으로 옮긴 최신 커밋(`ecaa785bd`, "리뷰 5R")이 기존 주석 문단을 지우지 않고 거의 동일한 내용을 한 번 더 추가해, `users.controller.ts` 상단에 사실상 중복된 두 문단이 남아 있다 — 반복 리뷰 라운드 편집이 누적되며 생긴 사소한 정리 누락으로, 기능 영향은 없으나 병합 정리가 필요하다.

## 위험도

LOW
