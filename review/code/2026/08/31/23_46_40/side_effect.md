# 부작용(Side Effect) 리뷰

## 발견사항

- **[WARNING]** 공유 메서드 `UsersService.update()` 에 조건부 부작용(추가 SELECT + 외부 S3 삭제 호출)이 새로 붙었다 — 15개 이상 호출부가 암묵적으로 이 계약에 걸린다
  - 위치: `codebase/backend/src/modules/users/users.service.ts:232-246` (`update` 메서드)
  - 상세: `update(id, data)` 는 이제 `data` 에 `'avatarUrl' in data` 가 참이면 (a) 갱신 전 `findOne` 으로 옛 `avatarUrl` 을 미리 읽고, (b) 갱신 후 값이 달라졌으면 `deletePreviousAvatarObject()` 를 호출해 **S3 네트워크 삭제**를 수행한다. 이 메서드는 `auth.service.ts`(7곳: 662, 702, 749, 834, 897, 962, 979 근방), `totp.service.ts`(4곳: 84, 113, 122, 146), `webauthn.service.ts`(4곳: 257, 475, 536, 554) 를 포함해 최소 15개 비-아바타 호출부가 공유한다. `git grep` 으로 전수 확인한 결과 이 호출부들은 전부 리터럴 객체(`{ passwordResetToken, ... }` 등)를 넘기고 `avatarUrl` 키를 갖지 않으므로, **현재 코드베이스 기준으로는 의도치 않은 트리거가 실제로 발생하지 않는다.** 다만 이 가드는 “`data` 객체에 `avatarUrl` 키가 존재하는가”라는 구조적 조건이라, 향후 누군가 이 메서드에 spread(`{ ...partial, avatarUrl: x }` 또는 `{ ...userDto }`)로 페이로드를 구성하면 그 즉시 — 별다른 경고 없이 — 추가 SELECT 와 외부 S3 delete 호출이 붙는다. 인증/2FA/webauthn 같은 뜨거운 경로에 걸리는 메서드이므로 이 암묵적 확장은 향후 유지보수자가 놓치기 쉽다.
  - 제안: 현재 구현을 바꿀 필요는 없지만(테스트로 이미 "avatarUrl 없는 페이로드는 findOne 조차 안 한다" 를 고정해 뒀다 — `users-avatar.service.spec.ts:298`), `update()` JSDoc 에 이미 있는 설명 외에 "이 메서드에 `avatarUrl` 을 넣으면 S3 부작용이 함께 실행된다" 는 점을 호출부 관점에서도 눈에 띄게(예: 파라미터 타입을 좁히거나 별도 메서드로 분리) 남기는 것을 고려할 것 — plan 문서(`spec-sync-user-profile-gaps.md`)가 이미 "정리 불변식을 쓰기 경로 한 곳으로 모은다"(W8·W9)는 후속 항목으로 이 구조적 위험을 인지하고 있다.

- **[WARNING]** 이 PR 이 새로 세운 "avatarUrl 변경 시 옛 S3 객체 정리" 불변식이 전체 쓰기 경로를 덮지 못한다 — OAuth 재연동 경로가 raw QueryBuilder 로 우회한다
  - 위치: `codebase/backend/src/modules/auth/auth-oauth.service.ts:375-401` (`resolveUser`, 특히 398행 `avatarUrl: byEmail.avatarUrl ?? profile.avatarUrl ?? undefined`)
  - 상세: `resolveUser()` 는 기존 사용자를 OAuth 계정에 바인딩할 때 `this.dataSource.getRepository(User).createQueryBuilder().update(User).set({ ..., avatarUrl: ... })` 로 **직접** DB 를 갱신한다. 이 경로는 `UsersService.update()` 를 거치지 않으므로 위에서 추가된 S3 정리 로직이 전혀 실행되지 않는다. 지금은 `byEmail.avatarUrl ?? profile.avatarUrl` 우선순위 때문에 이미 올린 아바타가 있으면 그 값이 그대로 유지돼 실질적인 값 변경이 없어 증상이 드러나지 않지만, 이 우선순위가 뒤바뀌면(예: 공급자 프로필 사진을 우선) 업로드된 S3 객체가 조용히 고아로 남는다 — 즉 "이벤트/부작용이 발생해야 하는데 발생하지 않는" 케이스다.
  - 제안: 이미 PR 자신이 `users-avatar.service.spec.ts` 의 "OAuth 연동 경로가 아바타 정리를 우회한다 — 캐너리" 테스트(소스 문자열 고정)와 `plan/in-progress/spec-sync-user-profile-gaps.md` 의 "아바타 정리 불변식을 쓰기 경로 한 곳으로 모은다"(W8·W9) 항목으로 이 갭을 인지·추적하고 있다. 새로운 결함은 아니며 이미 유예 처리돼 있으므로 별도 조치는 불필요하지만, side-effect 리뷰 관점에서 이 경로가 실제로 존재함을 재확인한다 — 문서가 stale 해지지 않았는지 향후 라운드에서 재확인할 것.

- **[INFO]** `PATCH /api/users/me` 의 부작용 범위가 넓어졌다 — 단순 필드 갱신이 아니라 조건부 외부 스토리지 삭제를 수행하게 됨(문서화·테스트는 완료)
  - 위치: `codebase/backend/src/modules/users/users.service.ts:232-246`, `codebase/backend/src/modules/users/users.controller.ts` (`updateMe` 의 `@ApiOperation description`, 대략 121-128행 부근)
  - 상세: `avatarUrl` 을 다른 값으로 바꾸는 `PATCH /users/me` 호출은 이제 이전에 업로드된 S3 객체를 best-effort 로 삭제한다. `avatars/{userId}/` 접두 매칭으로 남의 키·외부 URL(Gravatar 등)은 건드리지 않도록 가드돼 있고, Swagger `description` 에도 명시적으로 고지돼 있어 숨겨진 부작용은 아니다. 그래도 기존에는 순수 컬럼 갱신이던 엔드포인트가 외부 네트워크 I/O 를 수반하게 됐다는 점은 인터페이스 계약의 실질적 확장이므로 기록해 둔다.
  - 제안: 조치 불필요(이미 문서화·테스트됨). 참고용 기록.

- **[INFO]** `main.ts` 부트스트랩에 새 시작 시점 부작용(경고 로그) 추가 — 의도된 것이나 §8 관점 기록
  - 위치: `codebase/backend/src/main.ts` (신설 블록, diff 기준 152-172행 부근, `if (process.env.NODE_ENV === 'production') { ... isPrivateHost(publicBase) ... logger.warn(...) }`)
  - 상세: `NODE_ENV==='production'` 일 때 `S3_PUBLIC_BASE_URL`(또는 폴백 `S3_ENDPOINT`)이 사설/loopback 주소면 `logger.warn()` 을 낸다. `isPrivateHost()` 는 동기 문자열/IP 파싱만 하고 DNS 조회 등 네트워크 호출은 하지 않음을 소스로 확인했다(`ssrf.util.ts:14-54`). 기존 `ALLOW_PRIVATE_HOST_TARGETS` 경고와 동일 패턴이라 새로운 부작용 종류를 도입하지 않는다.
  - 제안: 조치 불필요. 관측 목적의 기록.

- **[INFO]** `docker-compose.yml`/`docker-compose.e2e.yml` 의 `createbuckets` 서비스가 기동 시 MinIO 버킷 정책(anonymous ACL)을 추가로 mutate 한다
  - 위치: `docker-compose.yml:66-67,75`, `docker-compose.e2e.yml:87-88,96`
  - 상세: `mc anonymous set-json /policy/avatars-public-read.json local/workflow-storage` 가 `docker compose up` 마다(또는 e2e 기동마다) 실행돼 버킷의 익명 접근 정책을 설정한다. 로컬/e2e 인프라 상태를 바꾸는 부작용이지만, 목적이 명시적으로 문서화돼 있고 멱등(`set-json` 은 덮어쓰기)이라 문제로 보지 않는다. 기록용.
  - 제안: 조치 불필요.

- **[INFO]** `S3Service` 가 `UsersModule` 에도 지역 provider 로 추가돼, 앱 전체에서 `S3Client`(AWS SDK) 인스턴스가 하나 더 생긴다 — 다만 이는 이 PR 이 도입한 패턴이 아니라 기존 `KnowledgeBaseModule` 과 동일한 기존 관례를 따른 것
  - 위치: `codebase/backend/src/modules/users/users.module.ts:19-25`
  - 상세: `grep` 으로 확인한 결과 `knowledge-base.module.ts` 도 동일하게 `S3Service` 를 지역 provider 로 두고 있어(66행), 모듈마다 별도 `S3Client` 가 생성되는 것은 이 PR 이전부터 있던 설계다. 새로운 부작용이 아니라 기존 패턴의 재사용임을 확인했다.
  - 제안: 조치 불필요.

## 요약

핵심 신규 코드(`S3Service.getPublicUrl`, `s3.config.ts` 의 `publicBaseUrl` 폴백, 컨트롤러의 `uploadAvatar`)는 순수 함수/설정 읽기 위주라 부작용 표면이 작고, 저자가 직접 CHANGELOG·plan 문서·인라인 주석으로 위험을 상세히 선(先)고지해 둔 점이 리뷰를 크게 수월하게 했다. 다만 이번 변경이 **공유 메서드 `UsersService.update()`** 에 조건부(구조적 키 존재 여부 기반) 부작용을 심은 것은 실질적인 블라스트 반경 확장이다 — `git grep` 전수 확인으로 현재 15개 이상 호출부(auth/totp/webauthn) 는 안전함을 검증했지만, 이 안전성은 "우연히 아무도 `avatarUrl` 을 넘기지 않는다"는 사실에 의존하고 있어 향후 회귀 위험으로 남는다. 또한 이 PR 이 새로 세운 "avatarUrl 변경 시 S3 정리" 불변식이 OAuth 재연동의 raw QueryBuilder 경로에는 적용되지 않는데, 이는 저자 스스로 캐너리 테스트와 plan 유예 항목으로 이미 추적 중이라 새로운 결함으로 보긴 어렵다. 파일시스템·전역 변수·환경 변수 읽기/쓰기·네트워크 호출은 전부 의도가 명시적으로 문서화돼 있고 실제 코드도 그 문서와 일치함을 확인했다(main.ts 경고, docker-compose 정책 적용, k8s overlay 3종 전수 패치 등). 시그니처 변경(`createService(overrides)`, `Express`→`ExpressNS` 리네임)은 하위 호환·타입 전용이라 런타임 영향이 없다.

## 위험도

MEDIUM
