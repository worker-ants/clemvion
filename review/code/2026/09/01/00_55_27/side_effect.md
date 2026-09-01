# 부작용(Side Effect) 코드 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)

## 발견사항

- **[WARNING]** `avatarUrl` 변경 → S3 정리 불변식이 `UsersService.update()` 단일 진입점에만 있고, `AuthOAuthService.resolveUser()` 가 raw `QueryBuilder` 로 같은 컬럼을 직접 써서 그 경로를 완전히 우회한다
  - 위치: `codebase/backend/src/modules/auth/auth-oauth.service.ts` — `resolveUser()` 메서드(약 375행), 특히 390~401행의 `createQueryBuilder().update(User).set({ …, avatarUrl: byEmail.avatarUrl ?? profile.avatarUrl ?? undefined })`. 대응하는 정상 경로는 `codebase/backend/src/modules/users/users.service.ts` 의 `update()`(234행) — `'avatarUrl' in data` 일 때만 옛 URL 을 조회해 값이 바뀌면 `deletePreviousAvatarObject`(169행)를 호출한다.
  - 상세: 이번 PR 은 "avatarUrl 이 실제로 바뀌면 옛 S3 객체를 정리한다"는 불변식을 `UsersService.update()` 한 곳에 새로 심었다(이전에는 이 정리 자체가 없었다 — `git diff origin/main` 확인). 그런데 `auth-oauth.service.ts` 의 OAuth 계정 연동 경로는 이 서비스 메서드를 거치지 않고 `DataSource.getRepository(User).createQueryBuilder().update(User)...execute()` 로 직접 `avatarUrl` 컬럼을 쓴다 — 이 PR 이전부터 있던 코드이며 이번 diff 의 대상이 아니다. 오늘은 `byEmail.avatarUrl ?? profile.avatarUrl` 우선순위 때문에 이미 자체 업로드한 아바타가 있으면 그 값이 그대로 유지되어(변경이 안 일어남) 고아 객체가 생기지 않는다. 하지만 이 우선순위가 바뀌거나(예: OAuth 공급자 사진을 우선하도록) 이 경로가 확장되면, 방금 업로드된 S3 객체가 **정리 호출 없이** 영구 고아로 남는 새로운 side-effect 갭이 조용히 열린다 — `update()` 를 통해서만 걸리는 불변식이라 이 경로에서는 원천적으로 감지되지 않는다.
  - 이 PR이 이미 이 사실을 `codebase/backend/src/modules/users/users-avatar.service.spec.ts` 의 "OAuth 연동 경로가 아바타 정리를 우회한다 — 캐너리" 테스트로 소스 캐너리 처리해 disclose 했고("오늘은 고아가 생기지 않는다" 는 설명과 함께), 실제 런타임 단언으로는 두 분기를 가를 수 없다는 이유(OAuth stub 모드 제약)까지 문서화돼 있다 — 즉 발견 자체는 이미 인지·기록된 상태다.
  - 제안: 현재로선 추가 조치가 필요하지 않을 수 있으나(캐너리가 우선순위 변경을 잡아준다), 부작용 관점에서 남기는 근본 해법은 "avatarUrl 컬럼에 쓰는 모든 경로가 정리 로직을 거치게" 만드는 것이다 — 예: `UsersService` 에 `setAvatarUrl(id, url)` 같은 단일 쓰기 API 를 만들고 `auth-oauth.service.ts` 도 그걸 쓰게 하거나, 최소한 이 우회의 존재를 `plan/in-progress/spec-sync-user-profile-gaps.md` 같은 트래커에도 명시해 다음 사람이 캐너리 테스트 파일 안까지 읽지 않아도 알 수 있게 한다.

- **[INFO]** `UsersService.update()` (17개 호출부 공유 메서드)가 시그니처 변화 없이 새 side effect(조건부 SELECT + S3 DELETE 네트워크 호출)를 얻었다
  - 위치: `codebase/backend/src/modules/users/users.service.ts:234` (`async update(id: string, data: Partial<User>): Promise<User>`)
  - 상세: 이 메서드는 `totp.service.ts`·`webauthn.service.ts`·`auth.service.ts` 등 인증 계열 17개 호출부가 공유한다(그중 `grep` 으로 확인한 실제 호출부는 `totp.service.ts` 4곳, `auth.service.ts` 7곳, `webauthn.service.ts` 4곳, `users.controller.ts` 1곳). 이번 변경으로 `data` 페이로드에 `avatarUrl` 키가 있으면 사전 `findOne` SELECT 를 추가로 실행하고, 값이 실제로 바뀌었으면 `deletePreviousAvatarObject` 를 통해 S3 `delete` 네트워크 호출까지 트리거한다. 현재 이 세 파일(`totp.service.ts`/`auth.service.ts`/`webauthn.service.ts`) 어디에서도 `avatarUrl` 을 페이로드에 넣지 않음을 확인했으므로(`grep -n avatarUrl` 결과 없음) 기존 17개 호출부에 즉시 영향은 없다. 다만 이는 "`data` 객체에 특정 키가 있는지"에 의존하는 암묵적 계약이라, 향후 누군가 엔티티나 넓은 DTO 를 그대로 스프레드해 `update()` 에 넘기면(예: `{ ...partialUser }`) 의도치 않게 S3 DELETE 호출이 섞여 들어갈 수 있다.
  - 제안: 이미 JSDoc(220~233행)과 전용 테스트(`users-avatar.service.spec.ts` 의 `UsersService.update — PATCH 로 아바타를 바꿔도 옛 객체를 정리한다` describe 블록)로 의도와 경계가 잘 문서화돼 있어 즉각적인 조치는 불필요하다. 다만 향후 `update()` 호출부가 늘어날 때, 이 암묵적 side effect(“avatarUrl 키가 있으면 외부 스토리지 삭제가 일어날 수 있다”)를 리뷰 체크리스트에 남겨 두는 것을 권한다.

- **[INFO]** `docker-compose.yml`/`docker-compose.e2e.yml` 의 `mc anonymous set-json` 은 버킷 정책을 **통째로 교체**하는 명령이라, 나중에 다른 기능이 같은 `createbuckets` 스크립트에 두 번째 `mc anonymous set-json` 을 추가하면 이번에 적용한 `avatars-public-read.json` 정책을 덮어쓸 수 있다
  - 위치: `docker-compose.yml:75`, `docker-compose.e2e.yml:96` (`mc anonymous set-json /policy/avatars-public-read.json local/workflow-storage;`)
  - 상세: 이번 PR 이전에는 `workflow-storage` 버킷에 `mc anonymous` 계열 명령이 전혀 없었음을 확인했다(`grep`으로 사전 이력 없음). 즉 이번이 최초 적용이라 지금은 문제가 없다. 다만 `set-json` 은 추가(append)가 아니라 버킷의 anonymous 정책 문서 전체를 교체하므로, 같은 버킷을 쓰는 다른 프리픽스(예: KB 문서)에 대해 향후 별도 공개 정책이 필요해지면 이 한 줄을 그대로 복붙해 실수로 이번 avatars 정책을 지워버릴 위험이 있다.
  - 제안: 실제 문제는 아니므로 조치 불요. 다음에 두 번째 anonymous 정책이 필요해지면 하나의 JSON 파일에 Statement 배열을 합쳐 단일 `set-json` 호출로 관리하라는 코멘트를 스크립트 근처에 남겨 두면 재발을 막을 수 있다.

- **[INFO]** `changePassword`/`verifyEmailChange` 의 `@Req()`/`@Res()` 파라미터 타입이 `Express.Request/Response` → `ExpressNS.Request/Response` 로 바뀌었다 (순수 타입 레벨, 런타임 무변화)
  - 위치: `codebase/backend/src/modules/users/users.controller.ts:220-221` (`changePassword`), `:307-308` (`verifyEmailChange`). import 이름 변경은 `:60` (`import ExpressNS from 'express';`).
  - 상세: 아바타 업로드가 `import Express from 'express'` 가 전역 `Express` 네임스페이스를 가려 `Express.Multer.File` 타입을 쓸 수 없었던 문제(실측: `Namespace 'e' has no exported member 'Multer'`)를 해결하려고 import 이름을 바꾸면서, 같은 파일의 기존 두 메서드 파라미터 타입 표기도 함께 바뀌었다. `ExpressNS.Request`/`Response` 는 원래의 `Express.Request`/`Response` 와 구조적으로 동일한 타입이라 컴파일 타임 표기만 바뀌고 런타임 동작·호출자 시그니처에는 영향이 없다. 이 메서드들은 NestJS 라우팅이 호출하는 것이라 "다른 코드가 이 시그니처를 직접 참조"할 일도 없다.
  - 제안: 조치 불요 — 참고용 기록.

## 그 외 점검 결과 (문제 없음)

- **전역 변수**: 새 전역 변수 도입이나 기존 전역 변수 수정 없음. `s3.config.ts` 의 `resolvePublicBaseUrl`/`shouldWarnPublicBaseIsPrivate` 는 `env: NodeJS.ProcessEnv` 를 인자로 받는 순수 함수이고, 기존 `production-guards.ts` 의 `env: NodeJS.ProcessEnv = process.env` 패턴과 동일한 관례를 따른다.
- **환경 변수**: `main.ts` 가 `process.env` 를 `ConfigService` 우회로 직접 읽는 것은 기존 `assertProductionConfig(process.env)`/`isSwaggerEnabled(...)` 호출부와 같은 기존 관례다 — 새로운 패턴이 아니다.
- **DI 시그니처 변경**: `UsersService` 생성자에 `s3Service: S3Service` 필수 의존성이 추가됐다(`users.service.ts:24-28`). `new UsersService(...)` 직접 인스턴스화는 저장소 전체에서 0건(`grep` 확인) — 전부 NestJS DI/테스트 `useValue` 경유라 이 시그니처 변경의 실제 파급은 없다. `users.module.ts:24` 의 provider 등록, `users.service.spec.ts` 의 강제-throw stub 추가로 정합성이 맞춰져 있다.
- **파일시스템 부작용**: `docker-compose*.yml` 의 새 볼륨 마운트(`./scripts/minio/avatars-public-read.json:/policy/...:ro`)는 read-only 이고 컨테이너 내부 경로에만 영향, 호스트 파일시스템에 쓰기 없음.
- **네트워크 호출**: 신규 `S3Service.getPublicUrl()` 은 순수 문자열 조립이라 네트워크 호출이 없다. `updateAvatar` 가 만드는 `upload`/`delete` S3 호출은 기능상 필수이며 기존 `S3Service` 인터페이스를 그대로 재사용한다. `mc anonymous set-json` 은 버킷 정책이라는 인프라 상태를 바꾸지만 배포 스크립트가 의도한 provisioning 동작이며 애플리케이션 코드 경로가 임의로 트리거하는 것이 아니다.
- **이벤트/콜백**: 새로 추가된 EventEmitter/WS emit 없음. 감사 로그(`AuditLogsService.record`)는 `changePassword`/`verifyEmailChange` 와 달리 `uploadAvatar` 에서 호출되지 않는데, 이는 `updateMe`(기존 프로필 수정 엔드포인트) 역시 감사 로그를 남기지 않는 기존 패턴과 일치해 새로운 비대칭이 아니다.
- **인터페이스 변경(공개 API)**: `POST /api/users/me/avatar` 는 신규 엔드포인트 추가일 뿐 기존 엔드포인트의 요청/응답 계약을 변경하지 않는다.

## 요약

이번 변경의 핵심 side effect(파일 업로드·아바타 URL 갱신·구 객체 삭제)는 의도된 기능이며, 정합성(컬럼 단위 UPDATE 로 lost update 방지, DB 저장 뒤 삭제 순서, 실패 삼킴+로그)이 꼼꼼히 문서화·테스트돼 있다. 가장 눈에 띄는 부작용 리스크는 두 가지다 — (1) `UsersService.update()` 라는 17곳 공유 메서드가 `avatarUrl` 키의 유무에 암묵적으로 반응해 외부 S3 delete 호출까지 낼 수 있게 됐고(현재는 안전하지만 향후 호출부 확장 시 함정), (2) `auth-oauth.service.ts` 의 raw QueryBuilder 쓰기가 이 PR 이 새로 도입한 "avatarUrl 변경 → S3 정리" 불변식을 완전히 우회한다(오늘은 값 우선순위 덕에 무해하지만, 그 우선순위가 바뀌면 고아 객체가 조용히 쌓인다). 둘 다 이 PR 자체가 만든 갭이라기보다 이 PR 이 새로 심은 불변식이 저장소 전역에 균일하게 적용되지 않는다는 지점이며, (2)는 이미 캐너리 테스트로 disclose 돼 있다. 그 외 DI 시그니처 변경(신규 `S3Service` 필수 의존성)·컨트롤러 타입 리네임(`Express`→`ExpressNS`)·docker-compose 볼륨 마운트·env 변수 읽기 패턴은 모두 기존 관례를 따르고 실질적 부작용이 없음을 확인했다.

## 위험도

MEDIUM
