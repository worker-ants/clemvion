# 부작용(Side Effect) 코드 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)

## 발견사항

- **[WARNING]** `UsersService.update()` — 공유 진입점(17개 호출부)에 새로 붙은 "avatarUrl 이 바뀌면 옛 S3 객체를 정리한다" 불변식을, 이번 diff 밖의 기존 코드(`AuthOAuthService.resolveUser()`)가 raw `QueryBuilder` 쓰기로 우회한다.
  - 위치: `codebase/backend/src/modules/users/users.service.ts` `update()` (약 234~248행) — `'avatarUrl' in data` 이고 값이 실제로 달라졌을 때만 `deletePreviousAvatarObject()`를 호출해 S3 `DeleteObjectCommand`(네트워크 호출)를 낸다.
    대조: `codebase/backend/src/modules/auth/auth-oauth.service.ts` `resolveUser()` (약 390~401행) — `this.dataSource.getRepository(User).createQueryBuilder().update(User).set({ ..., avatarUrl: byEmail.avatarUrl ?? profile.avatarUrl ?? undefined }).where('id = :id AND oauth_provider IS NULL', ...)` 로 `avatarUrl` 을 DB 에 직접 쓴다 — `UsersService.update()` 를 전혀 거치지 않는다.
  - 상세: 이번 PR 의 CHANGELOG·plan(`plan/in-progress/spec-sync-user-profile-gaps.md`)이 "교체 시 옛 객체를 지우되 DB 저장 뒤에 한다"를 세 가지 고정 축 중 하나로 명시하고, 그 보장을 `UsersService.update()` **한 곳에만** 심었다. `resolveUser()` 는 OAuth 최초 계정 연동 시점에 같은 `avatarUrl` 컬럼을 직접 쓰는 별도 경로이고, 이 진입점을 우회한다. 지금은 `byEmail.avatarUrl ?? profile.avatarUrl ?? undefined` 우선순위 때문에 기존 `avatarUrl` 이 있으면 그 값이 그대로 유지되어 실제 값 교체가 일어나지 않으므로 오늘 시점 재현 가능한 orphan 은 아니다. 하지만 그 우선순위가 바뀌거나("최신 OAuth 프로필 사진을 반영하자" 같은 그 자체로 합리적인 변경) 다른 코드가 같은 패턴(raw update 로 `avatarUrl` 직접 기록)을 따라 하면, 이번 PR 이 추가한 회귀 테스트(`users-avatar.service.spec.ts`)는 전부 `UsersService.update()`/`updateAvatar()` 경유만 검증하므로 이 우회 경로의 orphan 생성을 잡아내지 못한다. `auth-oauth.service.spec.ts` 등 관련 spec 을 확인했으나 이 우회를 지키는 회귀 테스트(캐너리)는 실제로는 존재하지 않는다(grep 0건) — plan 문서의 "캐너리로 감지 중" 서술은 실측 가능한 자동 가드가 아니라 "알려진 위험으로 추적 중"이라는 서술적 표현이다.
    이 항목은 이미 `plan/in-progress/spec-sync-user-profile-gaps.md` "리뷰 3라운드의 구조 제안 처분" 절에 재개 신호("아바타 외에 S3 를 쓰는 사용자-스코프 리소스가 하나 더 생길 때")와 함께 **의도적으로 유예**돼 있다 — 새 결함이 아니라 이미 인지·기록된 트레이드오프다.
  - 제안: 유예 결정 자체는 근거가 있어 보이지만, 최소한 (a) `resolveUser()` 근처에 "`avatarUrl` 을 직접 쓰는 다른 경로가 생기면 S3 정리 불변식이 깨진다"는 경고 주석을 남기거나, (b) 우선순위가 뒤집혀도 안전한지(즉 orphan 이 생기지 않는지) 확인하는 캐너리 테스트를 `auth-oauth.service.spec.ts` 에 하나 추가해 두는 편이, "재개 신호가 올 때까지 아무도 모르고 지나간다"는 위험을 줄인다.

- **[INFO]** `UsersService.update()` 는 시그니처(`update(id, data): Promise<User>`)가 그대로지만, 페이로드에 `avatarUrl` 키가 있으면 **암묵적으로 추가 `SELECT` + 조건부 S3 `DeleteObjectCommand` 네트워크 호출**이 붙는 공개 인터페이스 변경이다.
  - 위치: `codebase/backend/src/modules/users/users.service.ts` `update()` (약 234~239행, `'avatarUrl' in data` 분기)
  - 상세: 저장소 주석 기준 17곳 호출부(auth.service.ts 6곳·totp.service.ts 3곳·webauthn.service.ts 4곳·users.controller.ts PATCH 1곳) 중 오늘 시점에 `avatarUrl` 을 페이로드에 넣는 곳은 `updateMe`(PATCH `/users/me`) 뿐이라 즉각적인 회귀는 없다. 다만 `'avatarUrl' in data` 조건은 값이 `undefined` 로 명시돼도 참이 되므로, 향후 어떤 호출자가 스프레드(`{ ...dto }`)로 무심코 그 키를 포함시키면 값이 실제로 안 바뀌어도 매 호출마다 추가 SELECT 가 발생한다. 코드 JSDoc 이 이 트레이드오프를 이미 설명하고 있어 문서화는 되어 있으나, 이 메서드를 "단순 partial update 헬퍼"로 알고 새 호출자를 추가하는 사람은 그 비용/부작용을 시그니처만 보고는 알 수 없다.
  - 제안: 별도 조치 불요(이미 JSDoc 로 고지). 새 호출자 추가 시 이 문서를 참조하도록 유지.

- **[INFO]** `S3Service` 생성자의 `publicBaseUrl` 2차 폴백(`?? endpoint`)이 정상 부팅 경로에서는 죽은 코드이지만, `ConfigService` 를 부분 mock 하는 조립(주로 테스트)에서는 **조용히 `endpoint`(내부 SDK 주소)로 대체**되는 실제 분기다.
  - 위치: `codebase/backend/src/common/services/s3.service.ts` 생성자 (약 40~41행, `this.publicBaseUrl = this.configService.get<string>('s3.publicBaseUrl') ?? endpoint;`)
  - 상세: `s3.config.ts` 의 `resolvePublicBaseUrl`은 항상 truthy 문자열을 반환하므로 정상 NestJS 부트 경로에서는 이 `?? endpoint` 가 타지 않는다(주석도 이를 "2차 방어"로 명시). 다만 `ConfigService` 를 완전히 대체하지 않고 `s3.publicBaseUrl` 키만 빠뜨린 부분 mock 이 주입되면, `getPublicUrl()` 이 만드는 URL 이 조용히 `endpoint`(예: `http://minio:9000`, 컨테이너 내부 호스트명)로 바뀐다 — 브라우저가 도달 못 하는 주소가 응답에 실린다는 뜻이다. 이번 PR 이 추가한 `s3.service.spec.ts` 의 "s3.publicBaseUrl 이 없으면 endpoint 로 떨어진다" 테스트가 이 분기 자체는 고정했으나, 그 분기가 **의도한 프로덕션 경로가 아니라는 사실**은 architecture.md 가 이미 WARNING 으로 짚었다. side-effect 관점에서는 심각도가 낮다 — 실제 프로덕션 조립(`ConfigModule.forRoot`)에서는 도달 불가능하고, 도달 조건(부분 mock)은 테스트 환경에 국한된다.
  - 제안: architecture.md 의 제안(주석 정정 또는 `?? endpoint` 제거)에 동의. 별도 side-effect 조치는 불요.

## 검증 메모 (읽기 전용, 저장소 트리 뮤테이션 없음)

- `updateAvatar()` 의 DB 반영이 `userRepository.save(user)`(엔티티 전체 저장)가 아니라 `userRepository.update(userId, { avatarUrl })`(컬럼 단위)로 되어 있는지 `users.service.ts` 를 직접 열어 확인함 — **확인됨**. 이전 리뷰 라운드(`review/code/2026/08/31/22_44_14/concurrency.md`)가 CRITICAL 로 지적한 "S3 업로드 대기 중 다른 요청의 컬럼 변경을 통째로 되돌리는 lost update"는 이 커밋(`a1b381678`)에서 이미 해소됐다.
- `import Express from 'express'` → `import ExpressNS from 'express'` 개명이 파일 내 모든 사용처(`@Req()/@Res()` 2쌍, `Express.Multer.File` 1곳)에 일관 반영됐는지 `Read` 로 `users.controller.ts` 전체를 열어 확인함 — 잔여 `Express.` 참조 없음, 순수 타입 레벨 변경이라 런타임 부작용 없음.
- `S3_PUBLIC_BASE_URL` 이 `docker-compose.yml`·`docker-compose.e2e.yml`·`k8s/base/configmap.yaml`·`k8s/overlays/{local,prod,staging}` 전부에 실제로 값이 채워졌는지(문서에서 주장하는 "근접사고" 가 지금은 해소됐는지) `k8s/overlays/*` 를 전수 확인함 — 세 overlay 모두 값이 있음, 방치된 환경 없음.
- `avatars-public-read.json` 정책이 실제로 `s3:GetObject` 만 허용하고(`s3:ListBucket` 미포함) `avatars/*` 접두로 스코프됐는지 파일을 직접 열어 확인함 — 확인됨. 이 정책을 적용하는 `mc anonymous set-json` 은 버킷 전체 익명 정책을 **교체**하지만, dev/e2e `createbuckets` 스크립트가 매번 신규 버킷을 만드는 시점에 적용되므로 기존에 다른 용도로 열려 있던 익명 정책을 덮어쓰는 부작용은 없음(grep 으로 기존 `mc anonymous` 호출 부재 확인).
- `UsersModule` 이 `S3Service` 를 지역 provider 로 추가한 것이 `KnowledgeBaseModule`(이미 `AppModule` 에 무조건 로드됨)과 같은 패턴인지 확인 — `S3Service` 생성자의 필수 env 검증(부재 시 throw)은 이번 PR 이전에도 KB 모듈을 통해 앱 전체 부팅에 이미 강제되고 있었으므로, `UsersModule` 추가가 **새로운** 부팅 요구사항을 만들지는 않음(인스턴스가 하나 더 생기는 자원 중복은 performance.md 기존 지적과 동일 범주).
- `git status --short` 로 작업 트리에 미커밋 변경이 없음을 재확인함 — 리뷰 중 저장소 파일을 고치지 않았음.

## 요약

핵심 부작용 위험은 대체로 잘 억제돼 있다. 가장 무거웠던 문제 — S3 업로드 대기 중 다른 요청(로그인 실패 카운터·계정 잠금 등)의 컬럼 변경을 `save(user)` 전체 저장이 조용히 되돌리는 lost update — 는 컬럼 단위 `update()` 로 이미 고쳐졌음을 코드에서 직접 확인했다. 전역 변수 신설, 예상 밖 파일시스템 변경, 인증되지 않은 네트워크 호출은 관찰되지 않으며, 신규 env(`S3_PUBLIC_BASE_URL`)는 docker-compose·k8s 전 환경에 일관 배선돼 있고 버킷 정책도 `GetObject` 로만 스코프돼 있다. 다만 이번 PR 이 `UsersService.update()`(17개 호출부를 가진 공유 진입점)에 심은 "avatarUrl 변경 시 S3 정리" 불변식이 diff 밖의 기존 코드(`AuthOAuthService.resolveUser()` 의 raw QueryBuilder 쓰기)를 우회한다는 점은 여전히 유효한 관찰이다 — 오늘은 값 우선순위 덕에 트리거되지 않지만 그 우선순위가 바뀌면 새 회귀 테스트 어느 것도 잡아내지 못하는 조용한 orphan 경로가 된다. 이 사실 자체는 plan 문서에 재개 신호와 함께 이미 유예로 기록돼 있어 "발견되지 않은 결함"은 아니지만, 이를 지키는 캐너리 테스트가 실제로는 없다는 점은 재확인할 가치가 있다. 나머지는 문서-코드 사소한 불일치(INFO) 수준이다.

## 위험도

MEDIUM
