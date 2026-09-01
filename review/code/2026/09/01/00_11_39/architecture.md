# 아키텍처(Architecture) 리뷰

## 발견사항

- **[INFO]** `resolvePublicBaseUrl` 폴백 규칙의 SoT 단일화가 실제로 적용됐음을 확인 — 직전 라운드(23_46_40) WARNING 이 해소됨.
  - 위치: `codebase/backend/src/common/config/s3.config.ts` (`resolvePublicBaseUrl` 정의, `s3Config` 가 그 결과를 `publicBaseUrl` 로 노출) / `codebase/backend/src/main.ts` (`import { resolvePublicBaseUrl } from './common/config/s3.config';` 및 production 부팅 가드에서 `resolvePublicBaseUrl(process.env)` 호출)
  - 상세: 직전 라운드는 같은 폴백 규칙(`S3_PUBLIC_BASE_URL → S3_ENDPOINT → localhost`)이 `s3.config.ts`·`s3.service.ts`·`main.ts` 세 곳에 독립 구현돼 있고, `main.ts` 사본만 마지막 항이 `''`라 SoT와 다른 최종값을 냈다고 지적했다(WARNING). 현재 diff는 `main.ts`가 규칙을 손으로 다시 적지 않고 `s3.config.ts`의 순수 함수를 직접 호출하도록 바뀌었고, `s3.config.spec.ts`에 `resolvePublicBaseUrl` 자체를 대상으로 한 유닛 테스트(둘 다 미설정 시 `localhost`, `||` vs `??` 구분)가 추가돼 규칙의 SoT가 실제로 한 곳으로 좁혀졌다. `s3.service.ts`의 `?? endpoint`는 여전히 별도 레이어(ConfigService 부분 mock 방어)로 남아 있으나, 그 경계는 주석·전용 테스트(`s3.service.spec.ts` "s3.publicBaseUrl 이 없으면 endpoint 로 떨어진다")로 명시돼 있어 "SoT는 하나"라는 주장과 실제 구현이 다시 어긋나지 않는다.
  - 제안: 조치 불요 — 확인 목적으로 기재.

- **[INFO]** `UsersService`가 프로필 CRUD/인증 부가 로직에 더해 S3 오케스트레이션(업로드 키 생성, 옛 객체 정리, URL 문자열 파싱)까지 맡아 SRP가 흐려지는 추세가 이번 diff에서도 유지된다.
  - 위치: `codebase/backend/src/modules/users/users.service.ts` — `updateAvatar()`, `deletePreviousAvatarObject()`, `avatarKeyPrefix()`, `AVATAR_CONTENT_TYPES`/`AVATAR_MAX_BYTES` 정적 멤버
  - 상세: 도메인 서비스가 (a) HTTP 계층에 노출되는 컨트롤러 계약 상수, (b) S3 키 네이밍 규칙, (c) 공개 URL 문자열의 역파싱(anchor 기반 key 복원)까지 함께 갖고 있다. `users.service.spec.ts`가 무관한 케이스에서도 `S3Service`를 mock해야 하는 것이 이 결합의 직접적 증상이다. 다만 이는 새 발견이 아니라 `plan/in-progress/spec-sync-user-profile-gaps.md`에 `UserAvatarService` 분리안으로 이미 등재돼 있고, "아바타 외 S3를 쓰는 사용자-스코프 리소스가 하나 더 생길 때"라는 측정 가능한 재개 신호와 함께 의도적으로 유예된 상태다. 소비자가 하나뿐인 현재 시점에 분리하면 얕은 추상(껍데기 클래스)만 남을 위험이 있어 유예 근거 자체는 타당하다.
  - 제안: 새 조치 불요 — 재개 신호(두 번째 S3 소비 사용자-리소스 등장) 발생 시 분리.

- **[INFO]** URL **생성**(`S3Service.getPublicUrl`)과 **역산**(`UsersService.deletePreviousAvatarObject`의 `decodeURIComponent` + `split(/[?#]/)`)이 서로 다른 클래스에 비대칭으로 나뉘어 있다.
  - 위치: `codebase/backend/src/common/services/s3.service.ts` `getPublicUrl()` ↔ `codebase/backend/src/modules/users/users.service.ts` `deletePreviousAvatarObject()`
  - 상세: build 쪽(`getPublicUrl`)의 인코딩 규칙(세그먼트 단위 `encodeURIComponent`)에 대한 지식을 parse 쪽이 손으로 복제해 되짚는다. 역산이 `avatars/{userId}/` 마커 앵커 방식이라 base/bucket 변경에는 강건하지만, 인코딩 규칙 자체는 두 클래스에 각각 존재한다. Rationale에도 "역산 로직을 `S3Service`로 옮겨 build/parse를 대칭으로 두자"는 안이 이미 유예 항목(W7 후반)으로 기록돼 있어 새 발견은 아니다.
  - 제안: 위 `UserAvatarService`/키 역산 대칭 메서드(`extractKeyFromPublicUrl`) 도입 시점에 함께 정리.

- **[INFO]** `S3Service`가 소비 모듈(`UsersModule`, `KnowledgeBaseModule`)마다 지역 provider로 각각 등록돼, `S3Client`(및 내부 커넥션 풀)가 모듈별로 중복 인스턴스화된다. 공유 provider를 export하는 전용 모듈이 없다.
  - 위치: `codebase/backend/src/modules/users/users.module.ts:24` (`providers: [UsersService, S3Service]`)
  - 상세: 주석이 "KB 모듈과 같은 방식"이라고 명시하듯 이 PR이 새로 만든 패턴이 아니라 기존 관례를 그대로 따른 것이다. `S3Service`가 stateless라 중복 비용은 낮지만, 소비 모듈이 이제 둘이 됐다는 사실 자체가 공유 `S3Module`(export)로 승격을 검토할 시점이 가까워졌다는 신호다.
  - 제안: 새 조치 불요 — 세 번째 소비 모듈이 생기면 공유 모듈 승격 검토.

- **[INFO]** `UsersController.uploadAvatar`의 `FileInterceptor` 옵션이 `UsersService.AVATAR_MAX_BYTES`라는 **정적 클래스 멤버**를 컴파일타임에 직접 참조한다 — 일반적인 DI/설정 모듈 경로가 아니라 클래스 간 static 결합.
  - 위치: `codebase/backend/src/modules/users/users.controller.ts:159` (`limits: { fileSize: UsersService.AVATAR_MAX_BYTES }`)
  - 상세: 같은 모듈 내부 결합이라 실질 위험은 낮고, drift가 구조적으로 불가능하다는 주석 근거도 타당하다. Swagger 산문의 하드코딩 리터럴(`최대 2MB`, 확장자 나열)은 별도 동기화 테스트(`users-avatar-swagger-sync.spec.ts`)가 전수 매칭으로 고정하고 있어 이 계층의 "값이 갈릴 수 있는" 표면은 모두 회귀 가드로 덮여 있다.
  - 제안: 조치 불요 — 다른 계층(예: 프런트엔드)이 같은 한도를 참조해야 하는 시점이 오면 독립 상수 모듈로 승격 검토.

- **[INFO]** 순환 의존성 없음 — `S3Service`(common/services) → `s3.config`(common/config) 방향의 단방향 의존만 존재하고, `UsersModule`이 `S3Service`를 로컬 provider로 소비하는 것도 단방향이다. `main.ts`가 `s3.config`와 `ssrf.util`을 직접 import하는 것도 부트스트랩 코드가 설정/유틸 레이어를 참조하는 정상적인 하향 의존이다.

## 요약

이번 diff는 4라운드에 걸친 리뷰-수정 사이클의 최종 상태로, 컨트롤러(`UsersController`)→서비스(`UsersService`)→인프라(`S3Service`) 계층 분리가 대체로 잘 지켜진다. 가장 중요한 이전 라운드 WARNING — "폴백 규칙 SoT가 실제로는 3곳에 독립 구현돼 있고 `main.ts` 사본만 다른 값을 낸다" — 은 `resolvePublicBaseUrl` 순수 함수로 추출되어 `s3.config.ts`와 `main.ts`가 공유하는 형태로 실제로 해소되었고, 전용 유닛 테스트로 회귀가 고정되어 있음을 확인했다. 남은 항목(`UsersService`의 S3 오케스트레이션 책임 확장, URL build/parse 비대칭, `S3Service` 지역 provider 반복, static 상수 결합)은 모두 팀이 `plan/in-progress/spec-sync-user-profile-gaps.md`에서 스스로 짚고 측정 가능한 재개 신호와 함께 의도적으로 유예한 것들로, 지금 규모(단일 S3 소비 사용자-리소스)에서 억지로 분리하면 얕은 추상만 남는다는 유예 근거가 타당하다. 새로운 아키텍처 결함은 발견되지 않았다.

## 위험도

LOW
