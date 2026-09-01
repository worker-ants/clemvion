# 아키텍처(Architecture) 리뷰

## 발견사항

- **[WARNING]** "SoT 는 config 한 곳" 을 표방한 `publicBaseUrl` 폴백 규칙이 실제로는 3곳에
  독립 구현되어 있고, 그중 `main.ts` 사본은 나머지 둘과 **다른 최종값**을 낸다.
  - 위치:
    - `codebase/backend/src/common/config/s3.config.ts:23-26` (SoT 로 지칭되는 원본 — `S3_PUBLIC_BASE_URL ?? S3_ENDPOINT ?? 'http://localhost:9000'`)
    - `codebase/backend/src/common/services/s3.service.ts:40-41` (2차 방어로 명시적으로 문서화된 사본 — `?? endpoint`, 두 값 다 없을 때 `endpoint` 로)
    - `codebase/backend/src/main.ts:160-161` (`const publicBase = process.env.S3_PUBLIC_BASE_URL || process.env.S3_ENDPOINT || '';`)
  - 상세: `s3.service.ts` 의 사본은 "이 분기는 s3Config 가 로드된 경로에서는 절대 타지 않는다" 는
    전제와 함께 주석·테스트(`s3.service.spec.ts` "s3.publicBaseUrl 이 없으면 endpoint 로 떨어진다")로
    묶여 있어 drift 를 잡을 장치가 있다. 반면 `main.ts` 의 세 번째 사본은 어떤 테스트도 없고,
    두 env 변수가 **모두** 비어 있을 때 `''` 로 떨어진다 — SoT(`s3.config.ts`)는 같은 상황에서
    `'http://localhost:9000'` 을 낸다. `if (publicBase && isPrivateHost(publicBase))` 조건에서
    빈 문자열은 falsy 라 **이 가드는 정확히 이 시나리오(둘 다 미설정 → 실제로는 loopback 으로
    구동)에서 경고를 내지 않는다** — 바로 이 PR 이 주석에서 "k8s overlay 에 patch 를 빠뜨려
    localhost 기본값이 실릴 뻔했다" 며 막으려던 그 실패 모드다. 실제 배포 구성에서
    `S3_ENDPOINT` 가 대체로 함께 설정되므로 오늘 당장 트리거되진 않지만, 세 번째 사본이 SoT
    주장과 조용히 어긋난다는 사실 자체가 이 PR 이 반복해서 경계하는 "동작은 하는데 잘못된 채로
    동작" 패턴을 그 가드 자신 안에 재도입한 것이다.
  - 제안: `main.ts` 의 부트스트랩 시점에도 `ConfigService`(이미 `app` 생성 이후 시점이라 접근
    가능할 개연성이 높다)를 통해 `s3Config().publicBaseUrl` 을 읽거나, 최소한 세 번째 사본의
    최종 폴백값을 SoT 와 동일하게(`'http://localhost:9000'`) 맞추고 회귀 테스트를 추가한다.

- **[INFO]** `UsersService` 가 프로필 CRUD/인증 부가 로직에 더해 S3 오케스트레이션(업로드 키
  생성, 옛 객체 정리, URL 파싱)까지 지게 되어 SRP 가 흐려지는 중 — 무관한
  `users.service.spec.ts` 조차 `S3Service` mock 을 짊어져야 한다.
  - 위치: `codebase/backend/src/modules/users/users.service.ts:27`(생성자 주입),
    `:79-147`(`updateAvatar`), `:167-194`(`deletePreviousAvatarObject`)
  - 상세: 이 항목은 리뷰팀이 이미 인지하고 있다 — `plan/in-progress/spec-sync-user-profile-gaps.md`
    "리뷰 3라운드의 구조 제안 처분" 항목이 `UserAvatarService` 분리를 명시적으로 제안했고,
    "아바타 외에 S3 를 쓰는 사용자-스코프 리소스가 하나 더 생길 때" 라는 측정 가능한 재개
    신호와 함께 **의도적으로 유예**했다. 재조사가 아니라 확인 차원에서 기재한다 — 유예 근거
    자체는 타당하다(소비자가 하나뿐인 상태에서 분리하면 얕은 추상만 남는다, YAGNI).
  - 제안: 새로 조치할 것 없음. 재개 신호가 트리거되면 그때 분리.

- **[INFO]** URL **생성**(`S3Service.getPublicUrl`)과 **역산**(`UsersService.deletePreviousAvatarObject`
  의 `decodeURIComponent`+`split(/[?#]/)`)이 서로 다른 클래스에 나뉘어 있어, URL 인코딩 규칙에
  대한 지식이 도메인 레이어로 새어 나간다.
  - 위치: `codebase/backend/src/common/services/s3.service.ts:86`(`getPublicUrl` 정의) ↔
    `codebase/backend/src/modules/users/users.service.ts:183`(`decodeURIComponent(previousUrl.slice(at))`)
  - 상세: 역산 쪽이 `publicBaseUrl`/`bucket` 세그먼트를 무시하고 `avatars/{userId}/` 마커만
    찾는 설계라 base 변경에는 강하지만("base 가 바뀐 뒤의 옛 URL 에서도 복원"), **인코딩
    규칙**(세그먼트 단위 `encodeURIComponent`, `?`/`#` 절단)은 여전히 build 쪽 지식을 손으로
    복제한 것이다. 이 또한 plan 의 "기각 — avatarUrl 에 URL 대신 key 를 저장하자" 항목 말미에
    "역산 로직을 S3Service 로 옮겨 build/parse 를 대칭으로 두자는 부분(W7 후반·W19)" 으로 이미
    포착되어 위 SRP 분리 항목과 함께 보기로 유예되어 있다.
  - 제안: `UserAvatarService` 분리 시점에 `S3Service` 에 `extractKeyFromPublicUrl(url, prefix)`
    같은 대칭 메서드를 추가해 build/parse 지식을 한 클래스에 모은다.

- **[INFO]** `S3Service` 가 소비 모듈(`UsersModule`, 주석상 KB 모듈)마다 지역 provider 로 각각
  등록된다 — 공유 인프라 서비스를 export 하는 모듈이 없어, 새 소비자가 생길 때마다 배선을
  반복해야 한다.
  - 위치: `codebase/backend/src/modules/users/users.module.ts:22-24`
  - 상세: 코멘트가 "KB 모듈과 같은 방식" 이라고 명시하므로 이번 PR 이 새로 만든 패턴이 아니라
    기존 관례를 따른 것이다. `S3Service` 가 stateless 라 인스턴스 중복 자체의 실질적 비용은
    낮지만, 두 번째 소비자가 이미 있다는 사실 자체가 공유 `S3Module`(export) 로 승격할 때가
    가까워졌다는 신호다.
  - 제안: 새 조치 불요. 세 번째 소비 모듈이 생기면 공유 모듈 승격을 검토.

- **[INFO]** `UsersController` 가 `UsersService.AVATAR_MAX_BYTES` 를 **정적 클래스 멤버**로
  직접 참조한다 — 일반적인 생성자 주입/설정 모듈 경로가 아니라 클래스 간 컴파일타임 상수
  결합이다.
  - 위치: `codebase/backend/src/modules/users/users.controller.ts:159`
    (`limits: { fileSize: UsersService.AVATAR_MAX_BYTES }`)
  - 상세: 같은 모듈 내부라 실질 위험은 낮고, 코드 주석이 "직접 참조라 드리프트가 구조적으로
    불가능" 이라고 정확히 설명하며, Swagger 산문의 하드코딩 리터럴은 별도 동기화 테스트
    (`users-avatar-swagger-sync.spec.ts`)로 고정되어 있다. 다만 컨트롤러가 서비스의 *인스턴스*
    가 아니라 *static* 멤버에 의존하는 것은 일반적인 계층 간 의존 관례(DI)와 다른 결합
    형태라는 점은 남는다.
  - 제안: 상수가 여러 계층에서 더 늘어난다면(예: 프런트엔드도 같은 한도를 참조해야 한다면)
    `avatar.constants.ts` 같은 독립 모듈로 옮겨 양쪽이 그 모듈을 import 하게 하는 편이 더
    명시적이다. 지금 크기에서는 필수는 아니다.

- **[INFO]** `auth-oauth.service.ts` 의 `resolveUser()` 가 raw `QueryBuilder` 로
  `avatarUrl` 을 직접 써 `UsersService.update()` 한 곳에 심어 둔 "avatarUrl 변경 시 옛 S3
  객체 정리" 불변식을 우회한다.
  - 위치: `codebase/backend/src/modules/auth/auth-oauth.service.ts`(`resolveUser`, 이번 diff
    에는 포함되지 않아 정확한 줄 번호를 알 수 없음 — `users-avatar.service.spec.ts` 의 캐너리
    테스트가 `avatarUrl: byEmail.avatarUrl ?? profile.avatarUrl ?? undefined,` 문자열을 고정)
  - 상세: 쓰기 경로가 하나로 강제되지 않아 "불변식은 한 진입점에만 있다" 는 것이 이 코드베이스의
    일반 패턴(모듈 경계를 관통하는 도메인 불변식은 리포지토리 서브스크라이버/도메인 이벤트 없이
    호출부마다 손으로 지켜야 함)의 한계를 보여준다. PR 자신이 이를 "오늘은 우선순위 때문에
    무해하다" 로 캐너리 테스트로 감시하며 plan 문서(W8·W9)에 명시적으로 유예해 두었다 —
    새 발견이 아니라 기존 추적 확인.
  - 제안: 새 조치 불요. 위 `UserAvatarService`/이벤트 기반 정리로 통합될 때 함께 해소될 항목.

## 요약

이 PR 은 아바타 업로드를 위해 `UsersModule` 에 `S3Service` 를 로컬 provider 로 연결하고
컨트롤러→서비스→인프라의 계층 분리를 대체로 지킨다. 순환 의존성은 없고, 프로필 응답 봉투를
`toProfileData()` 하나로 모아 3개 엔드포인트의 중복을 제거한 점, `avatarKeyPrefix()` 로
키 생성/복원의 접두어를 한 곳에 묶은 점은 응집도 측면에서 좋은 선택이다. 가장 실질적인 아키텍처
결함은 "폴백 규칙의 SoT 는 config 한 곳" 이라는 주석상 주장과 달리 그 규칙이 `s3.config.ts`·
`s3.service.ts`·`main.ts` 세 곳에 독립 구현되어 있고, 그중 테스트가 없는 `main.ts` 사본이
실제로 SoT 와 다른 최종값(`''` vs `'http://localhost:9000'`)을 내 특정 상황에서 이 PR 이
막으려던 바로 그 실패(비공개 주소가 프로덕션에 조용히 실림)를 감지하지 못할 수 있다는 것이다.
나머지 발견(`UsersService` 의 책임 확장, URL build/parse 비대칭, `S3Service` 지역 provider
반복, OAuth 경로의 불변식 우회)은 대부분 팀이 이미 `plan/in-progress/spec-sync-user-profile-gaps.md`
에서 스스로 짚고 측정 가능한 재개 신호와 함께 의도적으로 유예한 항목들로, 근거가 타당해 재조사
없이 확인만 하고 넘어갔다.

## 위험도

LOW
