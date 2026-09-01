# 부작용(Side Effect) 코드 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL) · 8라운드

## 이번 라운드에서 실제로 바뀐 것

이 리뷰가 트리거된 커밋(`9b1ba58ae`)의 코드 변경분은 두 가지뿐이다 — (1) `users-avatar.service.spec.ts`
에 업로드 실패 축 테스트 1건 추가(테스트 파일, 부작용 없음), (2) `users.service.ts` `isLocked()` 에
JSDoc 주석만 추가(로직 변경 없음, `git diff` 로 확인). 즉 **직전 라운드(`01_19_27`)에서 이미 분석한
코드 상태와 런타임 동작이 동일**하고, 그 라운드의 side_effect WARNING(아래 항목 1)이 이번 커밋에서
disclose 로 해소됐다. 이 보고서는 그 해소를 확인하고, 나머지는 직전 라운드 INFO 를 독립적으로 재검증한
결과다 — 부작용 관점에서 새로 발견된 결함은 없다.

## 발견사항

- **[INFO]** (해소 확인) 로그인 잠금의 쓰기 클럭(DB `NOW()`)·읽기 클럭(앱 서버) 비대칭이 이번 커밋에서 disclose 됐다
  - 위치: `codebase/backend/src/modules/users/users.service.ts:382-396` (`isLocked` JSDoc), 대응하는 쓰기 쪽은 `:346-373` (`incrementLoginAttempts`, `locked_until = NOW() + …`)
  - 상세: 직전 라운드(`review/code/2026/09/01/01_19_27/side_effect.md`)가 "`incrementLoginAttempts` 는 DB 시계로 `locked_until` 을 쓰는데 `isLocked()` 는 여전히 앱 서버 시계로 읽어 비교한다 — 이 비대칭이 CHANGELOG/plan 어디에도 disclose 안 됨" 을 WARNING 으로 지적했다. `git show 9b1ba58ae` 로 diff 를 직접 확인한 결과, 로직 변경 없이 `isLocked()` 위에 정확히 이 비대칭·영향 범위(NTP 동기 환경에서 초 단위)·재개 조건(시계가 크게 어긋난 배포에서 DB 기준으로 전환)을 적은 JSDoc 만 추가됐다. 동작은 그대로이므로 새로 관측되는 부작용은 없고, "미기재" 상태만 해소됐다.
  - 제안: 조치 불필요 — 이 항목은 종결로 판단한다.

- **[INFO]** 공용 `UsersService.update()` 가 페이로드 모양(`'avatarUrl' in data`)에 따라 조건부로 외부 네트워크 호출(S3 delete)을 낸다
  - 위치: `codebase/backend/src/modules/users/users.service.ts:241-255` (`update`, 특히 `:243` `'avatarUrl' in data` 분기와 `:251-253` `deletePreviousAvatarObject` 호출)
  - 상세: 이 메서드는 호출부가 15곳(재확인: `auth.service.ts` 8곳, `totp.service.ts` 4곳, `webauthn.service.ts` 4곳 — grep 전수) + 컨트롤러의 `updateMe` 1곳으로 총 16곳이다. 이번 PR 로 페이로드에 `avatarUrl` 키가 있으면 사전 `SELECT` 한 번과, 값이 실제로 바뀌었으면 `S3Service.delete()`(외부 네트워크 호출)까지 추가로 실행한다. `avatarUrl` 을 실제로 넘기는 호출부는 `updateMe`(컨트롤러) 하나뿐임을 grep 으로 재확인했다 — OAuth 재연동(`auth-oauth.service.ts:398,413`)은 `dataSource.getRepository(User).createQueryBuilder().update()` 를 직접 써서 이 메서드를 우회하므로 영향 밖이다. 메서드 시그니처(`update(id, data: Partial<User>)`)만 보면 "S3 를 부를 수 있다" 는 사실이 드러나지 않아, 향후 다른 호출부가 DTO 를 통째로 스프레드하다 우연히 `avatarUrl` 을 포함시키면 예상 못한 SELECT + 네트워크 삭제를 얻는다는 점은 여전히 유효한 관찰이다. 다만 코드 JSDoc(`:227-240`)에 조건과 이유가 명시돼 있어 "의도치 않은" 부작용은 아니다.
  - 제안: 조치 불필요(이미 disclose 됨, 직전 라운드와 동일 결론). 신규 호출부 추가 시 `avatarUrl` 포함 여부를 체크리스트에 두는 것을 권장.

- **[INFO]** `UsersService` 생성자 시그니처 변경(`S3Service` 필수 의존성 추가) — 직접 인스턴스화하는 호출부 없음을 재확인
  - 위치: `codebase/backend/src/modules/users/users.service.ts:25-29` (constructor), `codebase/backend/src/modules/users/users.module.ts:8,24` (provider 등록)
  - 상세: `constructor(userRepository, s3Service)` 로 필수 의존성이 하나 늘었다. `new UsersService(` 직접 호출은 저장소 전체에 0건(재확인: grep). 모든 소비처가 Nest DI(`UsersModule.providers`) 또는 `Test.createTestingModule` 을 통해서만 인스턴스를 얻으므로 이 시그니처 변경으로 깨지는 호출부는 없다. `S3Service` 는 `UsersModule` 이 이미 무조건 import 되는 `KnowledgeBaseModule` 을 통해 부팅 시 이미 필수였던 클래스라(둘 다 `app.module.ts` 에 무조건 등록), 이번 변경이 "S3 설정 없으면 부팅 실패" 라는 새 실패 모드를 추가한 것도 아니다.
  - 제안: 조치 불필요.

## 그 외 점검 결과 (문제 없음)

- **버킷 정책 적용이 기존 공개 설정을 덮어쓰지 않는다**: `git show origin/main:docker-compose.yml`/`docker-compose.e2e.yml` 을 직접 대조한 결과, 이 PR 이전에는 `workflow-storage` 버킷에 `mc anonymous set` 류 호출이 전혀 없었다(버킷 생성만 하고 기본 private). 이번 PR 이 추가한 `mc anonymous set-json /policy/avatars-public-read.json local/workflow-storage;` 는 그 버킷의 첫 익명 정책 설정이라, 기존에 열려 있던 다른 공개 접근을 조용히 좁히거나 덮어쓰는 회귀가 아니다.
- **정책 스코프**: `scripts/minio/avatars-public-read.json` 은 `Action: s3:GetObject`, `Resource: arn:aws:s3:::workflow-storage/avatars/*` 로 좁게 스코프돼 있다 — `s3:ListBucket` 을 포함하지 않는다(CHANGELOG/README 가 설명하는 기각 근거와 코드가 일치함을 직접 확인).
- **환경변수**: `S3_PUBLIC_BASE_URL`/`S3_ENDPOINT` 는 `resolvePublicBaseUrl`(`s3.config.ts`) 단일 SoT 로만 읽힌다(쓰기 없음). `main.ts` 의 부팅 경고도 같은 함수를 재사용해 판정이 갈리지 않는다. `isPrivateHost` 는 동기 문자열/IP 판정이라 부팅 시 예기치 않은 DNS/네트워크 호출이 없다.
- **모듈 등록**: `UsersModule.providers` 에 `S3Service` 를 지역 provider 로 추가한 것은 `@Global()` 이 아니라서 다른 모듈에 영향을 주지 않는다. `exports` 에는 여전히 `UsersService` 만 있고 `S3Service` 는 노출되지 않는다.
- **공개 API 응답 shape**: `getMe`/`updateMe`/`uploadAvatar` 세 엔드포인트가 공통 `toProfileData()` 로 응답을 통일했을 뿐 필드 추가/제거는 없다(`pendingEmail` 은 여전히 `getMe` 만 스프레드로 얹는다) — 기존 클라이언트 계약 변경 없음.
- **테스트 격리**: `s3.config.spec.ts` 가 `process.env.S3_PUBLIC_BASE_URL`/`S3_ENDPOINT` 를 직접 지웠다 복원하지만 `beforeEach`/`afterEach` 로 저장·복원 쌍이 맞아 전역 오염이 남지 않는다. `users-login-attempts.service.spec.ts`/`users.service.spec.ts` 는 예상 밖 repo 메서드(`findOne`/`findOneOrFail`/`save`) 호출을 throw 로 시끄럽게 잡는 stub 을 써서, 회귀가 조용히 통과하지 않게 막아 둔 것도 확인했다.
- **k8s overlay 전파**: `local`/`prod`/`staging` 세 overlay 모두 `S3_PUBLIC_BASE_URL` 을 명시 패치한다(grep 전수 확인) — base ConfigMap 의 `localhost` 기본값이 특정 환경에만 새지 않는다.

## 요약

이 PR 의 핵심 부작용(공개 버킷 노출)은 사용자가 명시적으로 결정하고 CHANGELOG·plan 에 상세히 disclose 한 의도된 부작용이며, 버킷 정책도 기존 설정을 덮어쓰지 않고 `avatars/*` + `GetObject` 로 정확히 스코프돼 있음을 직접 대조로 확인했다. 이번 라운드(8R)의 실제 코드 변경분은 테스트 1건 추가와 JSDoc 주석 추가뿐이라 새로운 런타임 부작용은 없으며, 직전 라운드가 지적한 유일한 WARNING(로그인 잠금 판정의 쓰기/읽기 클럭 비대칭 미기재)은 이번 커밋에서 disclose 로 해소된 것을 diff 로 확인했다. 남은 관찰(공용 `update()` 의 조건부 S3 삭제 호출, `UsersService` 생성자 시그니처 변경)은 실질 반경이 좁고 이미 코드에 문서화돼 있어 INFO 로만 남긴다. 전역 변수 신설, 예기치 않은 파일시스템 쓰기, 공개 API 응답 shape 변경, 의도하지 않은 외부 서비스 호출, 기존 공개 정책의 조용한 축소는 관찰되지 않았다. 저장소 트리에 뮤테이션은 가하지 않았다(`git status --short` 로 확인, 이 리뷰 산출물 디렉터리 외 변경 없음).

## 위험도

LOW
