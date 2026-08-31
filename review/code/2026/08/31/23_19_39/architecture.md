# 아키텍처(Architecture) 리뷰 — 아바타 업로드(공개 버킷 + 공개 URL)

## 발견사항

- **[WARNING]** `avatarUrl` 컬럼이 **완성된 공개 URL 전체**(base+bucket+key)를 저장한다 — 도메인/영속 데이터가 서빙 전략(현재의 `publicBaseUrl`)에 결합됐다.
  - 위치: `codebase/backend/src/modules/users/users.service.ts:122-124`(빌드: `previousUrl = user.avatarUrl` → `key` 생성 → `s3Service.upload`), `:136-137`(`avatarUrl = this.s3Service.getPublicUrl(key)` 후 그 값을 그대로 컬럼에 저장), `:149-194`(`deletePreviousAvatarObject` — 저장된 URL 에서 다시 key 를 복원)
  - 상세: 캐노니컬 식별자는 S3 키인데, 실제로 영속화하는 값은 그 키로부터 파생된 프레젠테이션 값(URL)이다. 그 결과 `deletePreviousAvatarObject` 가 `avatars/{userId}/` 문자열 앵커 + `decodeURIComponent` 로 URL 에서 key 를 역산하는 워크어라운드가 필요해졌고, JSDoc 이 스스로 인정하듯 "base URL 이 배포 환경에 따라·시간에 따라 달라진다"는 문제를 이 역산 로직으로 방어하고 있다. 이는 키가 아니라 URL 을 저장했기 때문에 생긴 문제다. 서빙 전략이 나중에 바뀌면(예: signed URL 전환) 저장된 URL 자체가 무효화되고, 마이그레이션이 필요해진다.
  - 제안: `avatarUrl` 컬럼(혹은 별도 컬럼)에 **S3 key** 를 저장하고, 읽기 시점에 `S3Service.getPublicUrl(key)` 로 파생시키는 편이 base URL 변경·서빙 전략 변경 모두에 강건하다. 지금 구조를 유지한다면 최소한 "URL→key" 역산 로직을 `S3Service` 쪽으로 옮겨 build/parse 대칭을 맞추는 것을 고려(아래 INFO 항목 참조).

- **[WARNING]** `UsersService.update()`(호출부 17곳의 범용 부분 갱신 메서드)가 `avatarUrl` 필드 하나만을 위한 도메인 특화 부수효과(S3 정리)를 내장했다 — OCP 위반 소지.
  - 위치: `codebase/backend/src/modules/users/users.service.ts:232-246` (`'avatarUrl' in data` 분기 + `deletePreviousAvatarObject` 호출)
  - 상세: 범용 업데이트 경로 안에 특정 필드 이름을 하드코딩해 검사하는 방식은, 향후 다른 필드에도 "변경 시 정리"류 부수효과가 필요해질 때마다 이 메서드를 계속 확장해야 하는 구조다. 실제로 이 설계의 "닫힘"이 완전하지 않다는 증거가 이미 plan 문서에 등재돼 있다 — `auth-oauth.service.ts` 의 `resolveUser()` 는 raw `QueryBuilder` 로 `avatarUrl` 을 직접 써서 이 메서드를 우회한다(`plan/in-progress/spec-sync-user-profile-gaps.md` "OAuth 연동 경로가 아바타 정리를 우회한다 — 캐너리" 절 참조). 오늘은 값 우선순위 때문에 무해하지만, 우선순위가 뒤집히면 조용히 고아 객체가 생기고 이 PR 의 회귀 테스트 중 어느 것도 잡지 못한다고 개발자 스스로 명시했다.
  - 제안: "avatarUrl 변경 시 정리"라는 불변식을 단일 범용 메서드의 필드 검사가 아니라, (a) 리포지토리/데이터 계층에 위임하거나 (b) 도메인 이벤트(`UserAvatarChanged`) 구독자로 분리해 모든 쓰기 경로(향후의 raw QueryBuilder 포함)가 같은 지점을 통과하도록 강제하는 편이 더 닫힌 설계다. 지금 상태는 이미 캐너리 테스트로 드리프트를 감지하도록 문서화돼 있어 당장 위험하지는 않으나, 구조적 부채로 남는다.

- **[WARNING]** `UsersService` 의 책임이 계속 커진다 — 사용자 CRUD/인증 부수 로직에 이어 이번 PR 이 S3 오케스트레이션(업로드·키 생성·공개 URL 조립 호출·구 객체 정리)까지 얹었다.
  - 위치: `codebase/backend/src/modules/users/users.service.ts:43-194` (`AVATAR_CONTENT_TYPES`/`AVATAR_MAX_BYTES`/`avatarKeyPrefix`/`updateAvatar`/`deletePreviousAvatarObject`)
  - 상세: 이 클래스는 이미 비밀번호 변경, OAuth 조회, 부분 갱신 등 여러 축을 갖고 있었는데, 파일 검증(확장자 화이트리스트 프로토타입 체인 방어)·S3 업로드 오케스트레이션·URL 조립 호출·정리(cleanup) 로직까지 더해졌다. 부수효과로, 이 도메인과 무관한 기존 테스트(`users.service.spec.ts`)조차 이제 `S3Service` mock 을 강제로 주입해야 한다(diff 참조) — 응집도 낮은 의존이 무관한 테스트 스위트까지 새어나간 신호다.
  - 제안: 아바타 관련 검증·키 관리·정리 로직을 `UserAvatarService` 같은 별도 클래스로 추출하고 `UsersService` 는 그것을 주입받아 위임하는 편이 SRP 관점에서 더 낫다. 지금 규모에서 당장 필수는 아니지만, 다음 파일-업로드류 기능(예: 다른 리소스의 이미지 업로드)이 이 패턴을 그대로 복제하면 격리가 더 어려워진다.

- **[INFO]** URL 조립(`S3Service.getPublicUrl`)과 URL→key 역산(`UsersService.deletePreviousAvatarObject`)의 책임이 서로 다른 클래스/레이어에 분산돼 있다.
  - 위치: `codebase/backend/src/common/services/s3.service.ts:86-95`(빌드: `getPublicUrl`) vs `codebase/backend/src/modules/users/users.service.ts:149-194`(파싱: `deletePreviousAvatarObject`)
  - 상세: `{base}/{bucket}/{key}` 라는 URL 형태에 대한 지식이 `S3Service`(빌드 방향)와 `UsersService`(파싱 방향, `indexOf` + `decodeURIComponent`)에 나뉘어 존재한다. `S3Service` 가 URL 형태를 바꾸면(예: 세그먼트 순서·인코딩 방식) `UsersService` 의 역산 로직이 조용히 어긋날 수 있다 — 현재는 `avatars/{userId}/` 앵커링으로 상당 부분 이 위험을 피하고 있지만(문서화된 의도), 대칭 연산이 한 클래스에 모여 있지 않다는 점 자체는 응집도 관점의 개선 여지다.
  - 제안: `S3Service` 에 `extractKeyFromPublicUrl(url, anchorPrefix)` 류의 대칭 메서드를 두어 URL 형태에 대한 지식을 한 클래스에 캡슐화하는 것을 고려.

- **[INFO]** `S3Service` 가 공유 모듈에서 export 되는 대신 `UsersModule` 의 지역(local) provider 로 재선언된다(주석상 KB 모듈과 동일 패턴을 답습).
  - 위치: `codebase/backend/src/modules/users/users.module.ts:22-24`
  - 상세: 여러 모듈이 각자 `S3Service` 를 지역 provider 로 선언하면 NestJS DI 스코프상 모듈마다 별개 인스턴스(및 별개 `S3Client`)가 생성된다. 이 PR 이 새로 도입한 패턴은 아니고 기존 KB 모듈 관례를 그대로 따른 것이라 이 diff 자체의 회귀는 아니지만, `S3Service` 소비 모듈이 늘어날수록 반복될 구조적 비용이다.
  - 제안: 향후 S3Service 소비 모듈이 3개 이상으로 늘면, 전역/공유 `StorageModule` 에서 한 번만 provide 하고 각 모듈은 import 만 하는 형태로 정리하는 것을 검토.

- **[INFO]** 아바타 관련 비즈니스 상수(`AVATAR_CONTENT_TYPES`, `AVATAR_MAX_BYTES`)가 `UsersService` 의 `public static` 멤버로 노출되고, 컨트롤러·별도 spec 파일이 DI 를 우회해 클래스 자체를 정적 네임스페이스처럼 직접 참조한다.
  - 위치: 선언 `codebase/backend/src/modules/users/users.service.ts:43-52`; 소비 `codebase/backend/src/modules/users/users.controller.ts`(`FileInterceptor` 의 `limits: { fileSize: UsersService.AVATAR_MAX_BYTES }`, diff 게이트 156 부근) 및 `users-avatar-swagger-sync.spec.ts`
  - 상세: 서비스 클래스를 "주입 가능한 비즈니스 로직 컨테이너"와 "정적 상수 모음"이라는 두 가지 역할로 동시에 쓰고 있다. 상수만 필요한 소비자(컨트롤러 데코레이터, swagger 동기화 테스트)가 서비스 클래스 전체를 import 하게 되어, 두 모듈 간 결합 표면이 실제 필요보다 넓다.
  - 제안: `avatar.constants.ts` 같은 별도 파일로 상수를 추출해 컨트롤러·서비스·테스트가 공통으로 import 하면, "컨트롤러가 서비스 구현을 import 한다"는 결합이 사라진다. 우선순위는 낮음 — 값 자체가 실질적으로 컴파일 타임 상수라 런타임 위험은 없다.

- **[INFO]** `UsersService` 가 `S3Service` 라는 구체 클래스에 직접 의존한다(포트/인터페이스 추상화 없음) — DIP 관점에서는 결합이지만, 저장소 전반의 기존 관례(포트/어댑터 패턴 미사용)와 일관된다.
  - 위치: `codebase/backend/src/modules/users/users.service.ts:27` (생성자 주입)
  - 상세: CHANGELOG 가 언급하듯 서빙 전략은 세 가지 대안(공개 URL/서명 URL/백엔드 프록시) 중 하나를 선택한 것이며, 그 선택이 서비스 계층에 직접 박혀 있다. 향후 서빙 전략이 바뀌면(예: 서명 URL) `S3Service` 자체 수정 + `UsersService` 호출부 재배선이 필요하다 — 전략 패턴/인터페이스로 감싸져 있었다면 구현체 교체만으로 끝났을 변경이다.
  - 제안: 지금 당장 인터페이스를 도입할 필요는 없다(YAGNI — 기존 코드베이스 전반이 concrete-class-as-DI-token 관례). 다만 서빙 전략이 실제로 바뀌는 시점에는 이 결합이 전환 비용으로 드러날 것을 인지하고 있으면 된다.

## 긍정적 관찰 (참고)

- `UsersController.toProfileData()` 추출로 `getMe`/`updateMe`/`uploadAvatar` 세 엔드포인트의 응답 봉투 조립 로직이 한 곳으로 모였다 — 중복 제거 및 드리프트 방지(`users.controller.ts` diff 게이트 84-93).
- `UsersService.avatarKeyPrefix()` 를 키 생성(`updateAvatar`)과 키 복원(`deletePreviousAvatarObject`) 양쪽이 공유해, 접두 문자열이 SoT 하나로 고정됐다(`users.service.ts:59-61`).
- `ExpressNS` 리네임은 실제로 문제가 된 지점(`Multer.File` 타입 필요)에만 좁게 적용하고 무관한 다른 컨트롤러는 건드리지 않았다 — 최소 변경 원칙 준수.
- `S3Service` 를 `UsersModule` 에 추가해도 순환 의존은 생기지 않는다(`common/services` 는 `UsersModule` 을 참조하지 않음) — 확인됨.
- `s3.config.ts` SoT 와 `s3.service.ts` 의 2차 방어 폴백(`?? endpoint`) 관계를 주석에서 명확히 구분해 설명하고, 이전 판의 부정확한 주장("폴백은 config 한 곳")을 실측 기반으로 정정한 점은 좋은 self-correction 사례다.

## 요약

이번 PR 은 기존 컨벤션(concrete-class DI, controller→service→S3Service 계층 분리, 모듈 지역 provider 패턴)을 대체로 일관되게 따르고 있고, 순환 의존이나 레이어 붕괴 같은 구조적 결함은 없다. 다만 세 가지는 향후 유지보수 관점에서 짚어둘 만하다 — (1) 캐노니컬 키가 아니라 파생된 공개 URL 을 영속화해 base URL 변경에 대한 방어 로직이 별도로 필요해진 점, (2) 범용 `update()` 메서드가 `avatarUrl` 필드 하나를 위해 특별 분기를 갖게 되어 OCP 관점에서 닫히지 않았고 실제로 우회 경로(OAuth raw QueryBuilder)가 이미 존재한다는 점(단, 캐너리 테스트로 드리프트는 감지됨), (3) `UsersService` 의 책임 범위가 계속 넓어지고 있어 무관한 기존 테스트까지 S3Service mock 의존을 지게 된 점. 셋 다 당장 병합을 막을 결함은 아니며 문서화·테스트로 상당 부분 완충돼 있으나, 다음 유사 기능(파일 업로드 확장) 착수 전에 재고할 가치가 있다.

## 위험도

MEDIUM
