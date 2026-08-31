# 부작용(Side Effect) Review — 아바타 업로드(공개 버킷 + 공개 URL)

## 발견사항

- **[WARNING]** `UsersService.update()` 에 새로 붙은 S3 정리(orphan cleanup) 불변식이, 같은 필드(`avatarUrl`)를 직접 쓰는 **기존 코드 경로를 우회**한다.
  - 위치: `codebase/backend/src/modules/auth/auth-oauth.service.ts` `resolveUser()` — `dataSource.getRepository(User).createQueryBuilder().update(User).set({ ..., avatarUrl: byEmail.avatarUrl ?? profile.avatarUrl ?? undefined }).where('id = :id AND oauth_provider IS NULL', ...)` (약 390~401줄). 이 파일은 이번 PR의 diff 에 **포함되지 않은** 기존 코드다.
  - 대조 위치: `codebase/backend/src/modules/users/users.service.ts:185~199` `update()` — `'avatarUrl' in data` 이고 값이 실제로 달라졌을 때만 `deletePreviousAvatarObject()`(196번째 줄)를 호출해 옛 S3 오브젝트를 정리한다.
  - 상세: 이번 PR 의 CHANGELOG/plan 문서는 "교체 시 옛 객체를 지우되 DB 저장 뒤에 한다"를 세 가지 고정한 위험 축 중 하나로 명시하고, 그 보장을 `UsersService.update()` 한 곳에만 심었다. 그런데 OAuth 계정 연동(`resolveUser`, 최초 1회 링크 시점)은 `UsersService.update()` 를 거치지 않고 raw `QueryBuilder` 로 `avatarUrl` 을 직접 쓴다. 지금 당장은 `byEmail.avatarUrl ?? profile.avatarUrl ?? undefined` 의 우선순위 때문에 **기존 avatarUrl 이 있으면 그 값을 그대로 유지**하므로 실제 값 교체가 일어나지 않아 orphan 이 생기지 않는다 — 즉 오늘 시점 재현 가능한 버그는 아니다. 하지만 이는 "정리 불변식은 `UsersService.update()` 한 곳에만 있다"는 이번 구현의 전제가 코드베이스 전체에 대해 성립하지 않는다는 뜻이다. 이 우선순위 로직이 나중에 바뀌거나("최신 OAuth 프로필 사진을 반영하자" 같은, 그 자체로는 합리적인 변경) 다른 코드가 같은 패턴(raw update/QueryBuilder 로 `avatarUrl` 직접 기록)을 따라 하면, 새로 추가된 13건의 회귀 테스트는 전부 `UsersService.update()`/`updateAvatar()` 를 통해서만 검증하므로 이 우회 경로의 orphan 을 잡아내지 못한다.
  - 제안: (a) `resolveUser()` 의 계정 연동도 `UsersService.update()` 를 통하도록 리팩터하거나, (b) 최소한 이 라우트 근처에 "`avatarUrl` 을 직접 쓰는 다른 경로가 생기면 S3 정리 불변식이 깨진다"는 경고 주석과, 우선순위가 뒤집혀도 안전한지 확인하는 캐너리 테스트를 추가한다.

- **[INFO]** `S3Service` 생성자의 `publicBaseUrl` 폴백이 자신의 주석과 모순된다(동작에는 영향 없음, 문서·의도 불일치).
  - 위치: `codebase/backend/src/common/services/s3.service.ts:32~35` — 주석: "미설정 시 `endpoint` 폴백은 `s3.config.ts` 가 한다 — 여기서 다시 폴백하면 폴백 규칙이 두 곳이 되어 갈라진다." 바로 다음 줄: `this.publicBaseUrl = this.configService.get<string>('s3.publicBaseUrl') ?? endpoint;`
  - 상세: `s3.config.ts:19~22` (`process.env.S3_PUBLIC_BASE_URL || process.env.S3_ENDPOINT || 'http://localhost:9000'`) 는 항상 truthy 문자열을 반환하므로 프로덕션 경로에서 `?? endpoint` 는 도달하지 않는 죽은 코드다. 다만 이 두 번째 폴백이 실질적으로 동작하는 경우가 있다 — 테스트/다른 소비자가 `ConfigService` 를 부분적으로 mock 해 `s3.publicBaseUrl` 키를 빠뜨리면(`get()` → `undefined`) 이 자리에서 조용히 `endpoint` 로 대체된다. 즉 주석이 "폴백 규칙은 한 곳"이라고 선언하고 있는데 실제로는 두 곳이며, 그 차이가 드러나는 시점은 정확히 이 주석이 막으려던 "config mock 이 값을 안 줬을 때"다.
  - 제안: 주석을 "프로덕션에서는 도달하지 않지만 부분 mock 방어용으로 유지한다"로 정정하거나, 정말 단일 소스로 만들 것이면 `?? endpoint` 를 제거하고 `s3.config.ts` 를 신뢰한다(그 경우 테스트 더블에 `s3.publicBaseUrl` 누락 시 `undefined` 가 그대로 새어 나가 실패가 더 빨리, 더 크게 드러나는 트레이드오프가 생긴다는 점을 인지).

- **[INFO]** `UsersService.update()` 는 시그니처가 그대로지만(`update(id, data): Promise<User>`), **페이로드 형태에 따라 새로운 부작용(추가 SELECT + 조건부 S3 네트워크 DELETE 호출)이 암묵적으로 붙는** 공개 인터페이스 변경이다.
  - 위치: `codebase/backend/src/modules/users/users.service.ts:185~199`
  - 상세: 이 메서드는 저장소 comment 기준 17곳에서 호출되는 공유 메서드다(대부분 auth/totp/webauthn 의 hot path). 이번 PR 에서 확인한 실제 17곳 호출부(`auth.service.ts` 6곳, `totp.service.ts` 3곳, `webauthn.service.ts` 4곳, `users.controller.ts` PATCH 1곳)는 전부 `avatarUrl` 을 페이로드에 넣지 않으므로 오늘 시점 회귀는 없다. 다만 `'avatarUrl' in data` 조건은 값이 `undefined` 로 명시돼 있어도 참이 되므로, 향후 어떤 호출자가 스프레드 등으로 `avatarUrl` 키를 무심코 포함시키면 — 값이 실제로 안 바뀌어도 — 매 호출마다 추가 `findOne` SELECT 가 발생한다(구현·테스트가 이미 인지하고 있는 트레이드오프이므로 버그는 아니고, 인터페이스 소비자 관점에서 "값이 있으면 비용이 생긴다"는 것을 알아야 한다는 점만 기록).
  - 제안: 별도 조치 불요. 다만 이 메서드에 새 호출자를 추가할 때 이 암묵적 비용/부작용을 알 수 있도록 JSDoc 은 이미 잘 설명돼 있음 — 유지.

## 검증 메모

- `import Express from 'express'` → `import ExpressNS from 'express'` 개명이 파일 내 모든 사용처(`@Req()/@Res()` 2쌍, `Express.Multer.File` 1곳)에 일관되게 반영됐는지 `grep` 으로 직접 확인함(`users.controller.ts`) — 남은 `Express.` 참조 없음, `ExpressNS.` 참조 4곳 모두 정상. 순수 타입 별칭 변경이라 런타임 부작용 없음.
- `toProfileData()` 로의 `getMe`/`updateMe`/`uploadAvatar` 공통화가 기존 두 엔드포인트의 응답 필드(특히 `pendingEmail` 포함 여부)를 그대로 보존하는지 diff 대조로 확인함 — 동작 보존 리팩터로 판단.
- `S3Service` 를 `UsersModule` 의 지역 provider 로 추가한 것은 `knowledge-base.module.ts` 가 이미 쓰는 동일 패턴(`grep` 으로 확인)이라 새로운 관례 위반이 아님. `S3Service` 는 stateless 라 모듈별 별도 인스턴스가 기능적 문제를 만들지 않음.
- `UsersService.update()` 의 17개 호출부 전수(auth.service.ts·totp.service.ts·webauthn.service.ts·users.controller.ts)를 `grep` 으로 열어 `avatarUrl` 페이로드 포함 여부를 확인함 — 전부 미포함.
- 저장소 트리에 뮤테이션 없이 `Read`/`Grep`/`Bash(grep)` 만 사용했고, `git status --short` 로 작업 트리에 변경이 없음을 재확인함(남은 항목은 이 리뷰 세션 산출물 디렉터리뿐).

## 요약

핵심 부작용 위험은 명세대로 잘 억제돼 있다 — 새로 추가된 `S3Service.getPublicUrl`/`UsersService.updateAvatar`/`UsersService.update()` 의 정리 로직은 트랜잭션 순서(저장 후 삭제), 키 앵커링(자기 userId 접두, 남의 키 불가침), best-effort 실패 흡수(try/catch + warn)까지 테스트로 고정돼 있고, 전역 상태·환경 변수 오·오남용도 관찰되지 않는다. 다만 이번 PR 이 심은 "avatarUrl 이 바뀌면 옛 S3 객체를 정리한다"는 불변식이 **`UsersService.update()` 라는 단일 진입점에만** 있고, 이번 diff 밖의 기존 코드(`auth-oauth.service.ts` 의 OAuth 계정 연동 raw QueryBuilder 쓰기)는 그 진입점을 우회한다 — 오늘은 값 우선순위 덕에 트리거되지 않지만, 그 우선순위가 바뀌는 순간 새 테스트 13건 중 어느 것도 잡지 못하는 조용한 orphan 경로가 된다. 이 한 가지가 이번 리뷰에서 가장 무게 있는 부작용 발견이며, 나머지는 주석-코드 불일치(INFO)와 공유 메서드의 암묵적 비용(INFO) 수준이다.

## 위험도

MEDIUM
