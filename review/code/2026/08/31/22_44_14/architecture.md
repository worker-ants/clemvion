# 아키텍처(Architecture) 리뷰 — 아바타 업로드(공개 버킷 + 공개 URL)

## 발견사항

- **[WARNING]** `S3Service` 생성자의 `publicBaseUrl` 폴백이 주석의 주장과 다르게 **두 곳에 갈라져 있다** (SSOT 위반)
  - 위치: `codebase/backend/src/common/services/s3.service.ts:32-35`
  - 상세: 주석은 "미설정 시 `endpoint` 폴백은 `s3.config.ts` 가 한다 — 여기서 다시 폴백하면 폴백 규칙이 두 곳이 되어 갈라진다" 고 적어 두었지만, 바로 다음 줄의 코드는 `this.configService.get<string>('s3.publicBaseUrl') ?? endpoint` 로 **그 자리에서 다시 폴백한다**. `s3.config.ts` 의 `registerAs('s3', …)` 팩토리는 `publicBaseUrl` 을 `S3_PUBLIC_BASE_URL || S3_ENDPOINT || 'http://localhost:9000'` 로 이미 항상 truthy 문자열로 채우므로, 정상 NestJS 부트 경로에서 `configService.get('s3.publicBaseUrl')` 이 `undefined` 가 되는 경우는 없다 — 즉 `?? endpoint` 분기는 사실상 도달 불가능한 방어 코드다. 문제는 그 자체가 아니라, **주석이 "폴백은 한 곳" 이라 단언하는데 코드는 두 번째 폴백을 갖고 있다는 점**이다. `s3.service.spec.ts` 의 mock 도 `'s3.publicBaseUrl'` 을 항상 채워 두므로 이 분기는 테스트로도 커버되지 않는다(뮤테이션 검증 없이 남은 근거).
  - 제안: `?? endpoint` 를 제거하고 `configService.get<string>('s3.publicBaseUrl')!`(non-null assertion) 또는 `as string` 로 단일 SoT(즉 `s3.config.ts`)를 실제로 강제하거나, 정말 두 번째 방어선을 두고 싶다면 주석을 "이중 방어" 로 정정한다. 이대로면 다음 사람이 "폴백은 config 한 곳" 이라는 주석을 믿고 `s3.config.ts` 만 고쳤다가, 이 생성자의 `endpoint` 폴백이 (거의 발생하지 않지만) 여전히 살아있다는 사실을 놓칠 수 있다.

- **[WARNING]** 옛 아바타 키 복원 로직이 `S3Service` 가 만든 URL 형식을 역산하면서, 그 지식을 `UsersService` 에 중복 배치한다 (레이어 경계 누수)
  - 위치: `codebase/backend/src/modules/users/users.service.ts:120-147` (`deletePreviousAvatarObject`)
  - 상세: `S3Service.getPublicUrl(key)` 는 `${base}/${bucket}/${encodedKey}` 형태로 URL 을 조립하는 유일한 지점이다(`common/services/s3.service.ts:80-89`). 그런데 그 URL 에서 키를 복원하는 로직(`avatars/{userId}/` 마커로 `indexOf` 후 `decodeURIComponent`)은 `S3Service` 가 아니라 `UsersService` 안에 있다 — URL 조립 지식과 URL 역산 지식이 서로 다른 클래스에 흩어져 있다. 게다가 이 역산은 **버킷 세그먼트를 무시**한다: `S3Service.delete(key)` 는 항상 `this.bucket`(현재 설정된 버킷)을 대상으로 삭제하는데, `users-avatar.service.spec.ts:130-137` 테스트는 URL 안의 버킷이 `other-bucket` 이어도 정상 동작함을 고정한다 — 즉 "버킷이 바뀌어도 복원된다" 가 아니라 "**버킷 불일치를 그냥 무시하고 현재 버킷에서 지운다**" 는 뜻이다. 도메인/CDN 전환(base URL 변경)은 의도적으로 처리하지만, 버킷 자체가 바뀐 경우엔 현재 버킷에 같은 키가 실제로 존재하지 않으면 조용히 무효 삭제가 되거나, 우연히 같은 키 경로의 다른 객체를 지울 잠재 위험이 있다(현재는 발생 가능성이 낮지만 인코딩됨).
  - 제안: `S3Service` 에 `extractKeyFromPublicUrl(url, expectedPrefix?)` 같은 대응 메서드를 두어 URL↔key 매핑 지식을 한 클래스에 모으고, `UsersService` 는 그 메서드를 호출하도록 바꾸는 편이 결합도를 낮춘다. 버킷 불일치를 허용할지(현재 설계)는 명시적으로 문서화해 두는 게 좋다 — 현재는 "base 도메인 변경 대응" 의도만 적혀 있고 "버킷 세그먼트는 검증하지 않는다" 는 트레이드오프는 코드/plan 어디에도 명시돼 있지 않다.

- **[INFO]** `UsersService` 가 계속 다책임(SRP 경계 완화) 방향으로 성장한다
  - 위치: `codebase/backend/src/modules/users/users.service.ts` (클래스 전체 — `changePassword`, `emailTakenByOther`, `incrementLoginAttempts`, `updateAvatar`, `deletePreviousAvatarObject` 공존)
  - 상세: 이번 변경으로 `UsersService` 는 프로필 CRUD·비밀번호 변경·로그인 시도 카운터에 더해 "파일 검증 → S3 업로드 → DB 저장 → 옛 오브젝트 정리" 라는 스토리지 오케스트레이션까지 떠맡는다. 기존 파일이 이미 여러 책임을 갖고 있어(선례 `changePassword` 도 리팩터 04 로 로직을 옮겨온 이력) 이번 추가가 새 패턴을 만든 것은 아니지만, 누적되는 방향이다.
  - 제안: 지금 당장 분리를 요구할 정도는 아니나, 다음에 파일 업로드류 기능(워크스페이스 로고 등)이 하나 더 생기면 `UserAvatarService`/`AvatarStorageService` 로 분리해 `UsersService` 가 순수 프로필 CRUD 로 남도록 하는 편을 고려할 만하다.

- **[INFO]** `toProfileData()` 추출은 3곳(`getMe`/`updateMe`/`uploadAvatar`)의 응답 매핑을 한 곳에 모아 좋은 DRY 개선이다
  - 위치: `codebase/backend/src/modules/users/users.controller.ts:84-93`
  - 상세: 이 변경 전에는 동일한 필드 매핑이 두 곳(getMe/updateMe)에 중복돼 있었고, 이번에 `uploadAvatar` 가 세 번째 소비처로 추가되면서 헬퍼로 추출했다. 필드가 늘 때 세 곳을 따로 고치다 갈리는 문제를 미리 차단한 것으로, 아키텍처 관점에서 긍정적인 리팩터다. (발견사항이 아니라 참고로 남긴다.)

## 요약

이번 변경은 기존 NestJS 컨트롤러/서비스/인프라-서비스(S3Service) 레이어 구조를 그대로 따르고, `UsersModule` 이 `S3Service` 를 지역 provider 로 두는 방식도 기존 KB 모듈 컨벤션과 일치해 새로운 순환 의존성이나 모듈 경계 위반은 없다. `getPublicUrl(key)` 를 아바타에 국한하지 않은 범용 메서드로 설계한 점, 응답 매핑을 `toProfileData()` 로 통합한 점은 확장성·응집도 측면에서 좋은 선택이다. 다만 두 지점에서 결합도/추상화 경계가 흐릿하다 — (1) `publicBaseUrl` 폴백을 "config 한 곳" 이라 주석에 못박았지만 실제로는 서비스 생성자에도 방어적 폴백이 남아 있어 SoT 주장과 코드가 어긋나고, (2) 옛 아바타 키를 URL 에서 복원하는 로직이 `S3Service` 가 만든 URL 포맷 지식을 역산해 `UsersService` 에 재구현하면서 버킷 불일치를 조용히 무시한다. 둘 다 즉각적인 장애를 일으키진 않지만, 다음 유지보수자가 "폴백 SoT" 나 "URL↔key 대응" 을 잘못 이해하게 만들 수 있는 문서-코드 드리프트다. `UsersService` 의 책임 누적은 아직 경보 수준은 아니나 다음 파일-업로드 기능 추가 시 분리를 검토할 만하다.

## 위험도

MEDIUM
