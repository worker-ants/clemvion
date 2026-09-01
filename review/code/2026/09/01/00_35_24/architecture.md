# 아키텍처(Architecture) 리뷰

## 발견사항

- **[INFO]** 레이어 분리(Controller → Service → Infra) 정상 유지, 순환 의존성 없음 — 확인
  - 위치: `codebase/backend/src/modules/users/users.controller.ts` `uploadAvatar()` (약 196~202행) → `codebase/backend/src/modules/users/users.service.ts` `updateAvatar()` → `codebase/backend/src/common/services/s3.service.ts`
  - 상세: `UsersController.uploadAvatar`는 인증 컨텍스트(`payload.sub`)와 업로드 파일을 그대로 서비스에 위임하고 응답 봉투(`toProfileData`) 조립만 맡는다. 도메인 규칙(키 UUID화·Content-Type 화이트리스트·컬럼 단위 update·저장-후-정리 순서)은 전부 `UsersService`에, S3 프로토콜 세부(SDK 호출·URL 조립)는 `S3Service`에 있어 3계층 책임이 diff 전체에서 깨지지 않는다. `main.ts`가 `s3.config`/`ssrf.util`을 import하는 것은 부트스트랩이 설정·유틸 레이어를 참조하는 하향 의존이며, `s3.config.ts`↔`s3.service.ts`↔`users.module.ts` 사이에 역방향 참조는 없다 — 순환 의존 없음.
  - 제안: 조치 불요.

- **[INFO]** `resolvePublicBaseUrl`을 단일 SoT 순수 함수로 추출해 `s3.config.ts`와 `main.ts`가 같은 규칙을 공유하는 설계가 유지·검증됨(직전 라운드 WARNING 해소 확인)
  - 위치: `codebase/backend/src/common/config/s3.config.ts` (`resolvePublicBaseUrl` 정의, `s3Config`가 그 값을 `publicBaseUrl`로 노출) / `codebase/backend/src/main.ts` (동일 함수 import·호출) / `codebase/backend/src/common/config/s3.config.spec.ts` (규칙 자체를 대상으로 한 유닛 테스트)
  - 상세: production 부팅 경고가 폴백 규칙을 손으로 재구현하지 않고 `resolvePublicBaseUrl(process.env)`를 그대로 호출한다 — 개방-폐쇄 관점에서 규칙 변경이 한 곳(`s3.config.ts`)의 수정만으로 전파되는 구조다. `S3Service` 생성자의 `?? endpoint`는 별도 레이어(부분 mock 조립에 대한 2차 방어)로 명확히 분리·주석·전용 테스트로 경계가 문서화돼 있어 "SoT는 하나"라는 설계 의도와 실제 구현이 다시 어긋나지 않는다.
  - 제안: 조치 불요 — 확인 목적으로 기재.

- **[INFO]** `UsersService`가 프로필 CRUD/인증 부가 로직에 더해 S3 오케스트레이션(키 네이밍·정리·URL 역파싱)까지 겸해 SRP가 흐려지는 추세가 이번 diff에서도 유지된다(신규 결함 아님)
  - 위치: `codebase/backend/src/modules/users/users.service.ts` `updateAvatar()`, `deletePreviousAvatarObject()`, `avatarKeyPrefix()`, `AVATAR_CONTENT_TYPES`/`AVATAR_MAX_BYTES` 정적 멤버
  - 상세: 도메인 서비스가 (a) 컨트롤러 계약 상수(파일 크기·확장자), (b) S3 키 네이밍 규칙, (c) 공개 URL의 역파싱(anchor 기반 key 복원)까지 함께 갖는다. `plan/in-progress/spec-sync-user-profile-gaps.md`에 `UserAvatarService` 분리안이 **측정 가능한 재개 신호("아바타 외 S3를 쓰는 사용자-스코프 리소스가 하나 더 생길 때")**와 함께 이미 등재돼 있고, 소비자가 하나뿐인 현재 시점에 분리하면 얕은 추상(껍데기 클래스)만 남을 위험이 있어 유예 근거 자체가 타당하다.
  - 제안: 새 조치 불요 — 재개 신호 발생 시 분리.

- **[INFO]** URL **생성**(`S3Service.getPublicUrl`)과 **역산**(`UsersService.deletePreviousAvatarObject`의 `decodeURIComponent`+`split(/[?#]/)`)이 서로 다른 클래스에 비대칭으로 남아 있다(신규 아님)
  - 위치: `codebase/backend/src/common/services/s3.service.ts` `getPublicUrl()` ↔ `codebase/backend/src/modules/users/users.service.ts` `deletePreviousAvatarObject()`
  - 상세: build 쪽 인코딩 규칙(세그먼트 단위 `encodeURIComponent`)에 대한 지식을 parse 쪽이 손으로 되짚는다. `avatars/{userId}/` 마커 앵커 방식이라 base/bucket 변경에는 강건하지만, "빌드"와 "파싱"이라는 상호 역함수 지식이 두 클래스에 나뉘어 있어 한쪽만 바뀌면(예: 인코딩 방식 변경) 다른 쪽이 조용히 어긋날 수 있다. `plan/in-progress/spec-sync-user-profile-gaps.md`에 이미 유예 항목(역산 로직을 `S3Service`로 옮겨 대칭 메서드 도입)으로 기록돼 있다.
  - 제안: 위 `UserAvatarService`/키 역산 대칭 메서드(`extractKeyFromPublicUrl`) 도입 시점에 함께 정리.

- **[INFO]** `S3Service`가 소비 모듈(`UsersModule`, `KnowledgeBaseModule`)마다 지역 provider로 각각 등록돼 `S3Client`(및 커넥션 풀)가 모듈별로 중복 인스턴스화된다 — 공유 `S3Module`(export) 부재(신규 아님, 기존 KB 모듈 컨벤션을 그대로 따름)
  - 위치: `codebase/backend/src/modules/users/users.module.ts` `providers: [UsersService, S3Service]` / `codebase/backend/src/modules/knowledge-base/knowledge-base.module.ts` 동일 패턴
  - 상세: `S3Service`가 stateless라 중복 비용 자체는 낮지만, 소비 모듈이 이제 둘이 됐다는 것은 공유 모듈 승격 검토 시점이 가까워졌다는 신호다. 인터페이스 분리 관점에서는 문제없다 — 각 모듈이 필요한 것만(`upload`/`getPublicUrl`/`delete`) 쓴다.
  - 제안: 새 조치 불요 — 세 번째 소비 모듈 등장 시 공유 모듈 승격 검토(직전 라운드에서 이미 같은 제안 등재).

- **[INFO]** 신규 캐너리 테스트(`users-avatar.service.spec.ts` "OAuth 연동 경로가 아바타 정리를 우회한다")가 `users` 모듈 테스트에서 `auth-oauth.service.ts` **소스 파일을 문자열로 읽어 리터럴 매칭**하는 방식으로 모듈 경계를 넘어 결합한다
  - 위치: `codebase/backend/src/modules/users/users-avatar.service.spec.ts` (`readFileSync(join(__dirname, '../auth/auth-oauth.service.ts'), ...)`, `expect(src).toContain('avatarUrl: byEmail.avatarUrl ?? profile.avatarUrl ?? undefined,')`)
  - 상세: 이 테스트는 `users` 모듈이 `auth` 모듈의 **정확한 소스 코드 텍스트**에 결합되는 새로운 형태의 테스트-레벨 커플링을 도입한다. 순수 포매팅 변경(개행·공백·세미콜론 스타일 변경)만으로도 이 테스트가 깨질 수 있어, 일반적인 런타임 동작 테스트보다 훨씬 취약하다. 다만 이는 실수가 아니라 **의도적 설계**로, 테스트 자체의 JSDoc이 "OAuth stub 모드가 `profile.avatarUrl`을 항상 `null`로 고정해 런타임 단언으로는 두 분기가 갈리지 않는다(vacuous)"는 실측 근거를 명시하고, "이 테스트가 깨지면 우선순위를 바꾸는 사람이 이 문단을 읽게 하는 것"이 목적이라고 밝히고 있다. 즉 정상적인 계약 테스트가 불가능한 상황에서 회귀 방지를 완전히 포기하는 대신 택한 차선책이며, 근거가 실측(코드로 검증 가능)에 기반해 있다.
  - 제안: 조치 불요 — 다만 향후 OAuth stub이 공급자 사진을 채우는 fixture를 지원하게 되면(스코프 밖) 소스 캐너리 대신 런타임 통합 테스트로 승격을 권장.

- **[INFO]** 순환 의존성 없음 — 확인
  - 위치: `codebase/backend/src/common/services/s3.service.ts`(→`s3.config`) / `codebase/backend/src/modules/users/users.module.ts`(→`S3Service`) / `codebase/backend/src/main.ts`(→`s3.config`, `ssrf.util`)
  - 상세: 모두 단방향 하향 의존이다. `S3Service`는 어떤 도메인 모듈도 참조하지 않고, `UsersModule`이 `S3Service`를 소비하는 방향만 존재한다.
  - 제안: 조치 불요.

## 요약

이번 diff는 다회 리뷰-수정 사이클의 후속 라운드로, 프레젠테이션(`UsersController`)/비즈니스(`UsersService`)/인프라(`S3Service`, `s3.config`) 3계층 분리와 단방향 의존 구조가 흔들림 없이 유지된다. 직전 라운드(00_11_39)가 지적한 아키텍처 관련 WARNING(폴백 규칙 SoT 분산)은 이미 `resolvePublicBaseUrl` 순수 함수 추출로 해소된 상태가 재확인됐고, 이번 라운드에서 새로 추가된 코드는 대부분 테스트 강화(OAuth 정리-우회 소스 캐너리, MinIO 정책 e2e, 빈-버퍼 분기 테스트)로 프로덕션 아키텍처 구조 자체를 바꾸지 않는다. 남아 있는 항목(`UsersService`의 S3 오케스트레이션 겸임, URL build/parse 비대칭, `S3Service` 지역 provider 중복)은 전부 팀이 스스로 측정 가능한 재개 신호와 함께 `plan/in-progress/spec-sync-user-profile-gaps.md`에 문서화해 유예한 부채이며, 현재 단일 소비자 규모에서 조기 추상화하면 오히려 얕은 추상만 남긴다는 유예 근거가 타당하다. 새로 관찰된 유일한 항목은 신규 캐너리 테스트가 모듈 경계를 넘어 다른 모듈의 소스 텍스트에 결합하는 것인데, 이는 vacuous 런타임 테스트라는 실측된 제약 아래 의도적으로 선택된 차선책으로 근거가 분명하다. 새로운 CRITICAL/WARNING급 아키텍처 결함은 발견되지 않았다.

## 위험도

LOW
