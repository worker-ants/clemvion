# 아키텍처(Architecture) 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL), 8라운드

## 컨텍스트

이 기능은 7라운드에 걸친 리뷰-수정 사이클을 거쳤고, 아키텍처 관점은 5·6·7라운드(2026-08-31
`23_46_40`·`00_11_39`·`00_35_24`) 연속으로 **LOW · CRITICAL/WARNING 0** 으로 수렴한 상태였다.
가장 최근 커밋(`f24584a35`, "리뷰 7R — 내가 고친 경쟁이 반대 방향으로 그대로 있었다")은
`incrementLoginAttempts` 를 read-modify-write(`findOneOrFail`→`save(user)`)에서 원자적
단일 `UPDATE … RETURNING` 으로 바꾼 동시성 수정이다. 이번 라운드는 그 변경 이후 상태를
`s3.config.ts`·`s3.service.ts`·`users.service.ts`·`users.controller.ts`·`users.module.ts`·
`main.ts` 원본을 직접 읽어 재검증했다.

## 발견사항

- **[INFO]** `incrementLoginAttempts` 의 원자적 재작성이 기존 컬럼-스코프 쓰기 관례
  (`updateAvatar`→`repository.update()`, `resetLoginAttempts`→`repository.update()`)와
  일관된 방향으로 수렴했다 — 새 우려 아님.
  - 위치: `codebase/backend/src/modules/users/users.service.ts` (`incrementLoginAttempts`,
    raw `UPDATE ... RETURNING`)
  - 상세: 이 메서드만 이전에는 스냅샷 전체 `save(user)` 였고, 그로 인해 `updateAvatar`
    가 "정리는 저장 뒤" 로 막은 lost-update 를 **반대 방향**(로그인 카운터 쪽이 아바타
    변경을 되돌림)으로 재현하고 있었다. 지금은 두 메서드 모두 자기 컬럼만 건드리는
    형태로 일치한다. raw SQL 사용은 `updateReturningRows` 유틸을 통해 이미
    `execution-engine.service.ts`·`auth-oauth.service.ts`·`knowledge-base.service.ts` 에서도
    쓰이는 저장소 전역 관례이므로, TypeORM 리포지토리 추상화를 우회하는 것 자체는 이
    기능이 새로 도입한 패턴이 아니다.
  - 제안: 조치 불요.

- **[INFO]** (기존 지적 재확인, 신규 아님) `UsersService` 가 사용자 CRUD/인증 부가 로직에
  더해 S3 오케스트레이션(업로드 키 생성·정리·URL 역파싱)까지 겸해 SRP 가 흐려지는 상태가
  이번 diff 에서도 유지된다.
  - 위치: `codebase/backend/src/modules/users/users.service.ts` (`updateAvatar`,
    `deletePreviousAvatarObject`, `avatarKeyPrefix`, `AVATAR_CONTENT_TYPES`/`AVATAR_MAX_BYTES`)
  - 상세: `plan/in-progress/spec-sync-user-profile-gaps.md:179-181` 에 `UserAvatarService`
    분리안이 측정 가능한 재개 신호("아바타 외에 S3 를 쓰는 사용자-스코프 리소스가 하나 더
    생길 때")와 함께 여전히 등재돼 있음을 직접 확인했다. 소비자가 하나뿐인 현재 시점의
    조기 분리는 얕은 추상만 남길 위험이 있어 유예 근거는 여전히 유효하다.
  - 제안: 새 조치 불요 — 재개 신호 발생 시 분리.

- **[INFO]** (기존 지적 재확인) URL **생성**(`S3Service.getPublicUrl`)과 **역산**
  (`UsersService.deletePreviousAvatarObject` 의 `decodeURIComponent`+`split(/[?#]/)`)이
  서로 다른 클래스에 비대칭으로 남아 있다.
  - 위치: `codebase/backend/src/common/services/s3.service.ts` `getPublicUrl()` ↔
    `codebase/backend/src/modules/users/users.service.ts` `deletePreviousAvatarObject()`
  - 상세: `avatars/{userId}/` 마커 앵커 방식이라 base/bucket 변경에는 강건하지만, 인코딩
    규칙(세그먼트 단위 `encodeURIComponent`) 지식은 두 클래스에 나뉘어 있다. 같은 plan
    문서에 유예 항목(역산 로직을 `S3Service` 로 옮겨 `extractKeyFromPublicUrl` 같은 대칭
    메서드 도입)으로 이미 기록돼 있다.
  - 제안: 위 `UserAvatarService` 분리 시점에 함께 정리.

- **[INFO]** (기존 지적 재확인) `S3Service` 가 소비 모듈(`UsersModule`, `KnowledgeBaseModule`)
  마다 지역 provider 로 각각 등록돼 `S3Client` 가 모듈별로 중복 인스턴스화된다 — 공유
  `S3Module`(export) 부재.
  - 위치: `codebase/backend/src/modules/users/users.module.ts`
    (`providers: [UsersService, S3Service]`, 주석에 "KB 모듈과 같은 방식" 명시)
  - 상세: stateless 라 실질 비용은 낮지만 소비 모듈이 둘이 된 시점이라 승격 신호에
    가까워졌다는 관찰은 유효하다. 이번 diff 가 새로 만든 패턴이 아니라 `knowledge-base.module.ts`
    의 기존 관례를 그대로 따른 것임을 직접 대조해 재확인했다.
  - 제안: 세 번째 소비 모듈이 생기면 공유 모듈 승격 검토.

- **[INFO]** 레이어 분리(Presentation → Business → Infra)·순환 의존성 없음 — 확인.
  - 위치: `UsersController.uploadAvatar` → `UsersService.updateAvatar` →
    `S3Service`/`s3.config.ts` (`resolvePublicBaseUrl`) → `ssrf.util.ts` (`isPrivateHost`)
  - 상세: 컨트롤러는 인증 컨텍스트(`payload.sub`)와 파일을 그대로 위임하고 응답 봉투
    조립(`toProfileData`)만 맡는다. 도메인 규칙(키 UUID화·Content-Type 화이트리스트·
    컬럼 단위 update·저장-후-정리 순서)은 서비스에, S3 프로토콜 세부는 인프라 서비스에
    있다. `main.ts`(부트스트랩)가 `s3.config`·`ssrf.util`(설정/유틸 레이어)을 import 하는
    것은 정상적인 하향 의존이며, `s3.config.ts` ↔ `s3.service.ts` ↔ `users.module.ts` 사이
    역방향 참조는 없다. `isPrivateHost` 를 SSRF 방지(outbound 차단)와 부팅 경고
    (`shouldWarnPublicBaseIsPrivate`) 양쪽에서 재사용하는 것도 "사설/루프백 IP 판정" 이라는
    같은 추상 수준의 순수 함수를 두 호출부가 공유하는 정상적인 DRY 이지 계층 누수가 아니다.
  - 제안: 조치 불요.

- **[INFO]** 폴백 규칙 단일 SoT(`resolvePublicBaseUrl`)가 여전히 유지된다 — 6라운드에
  해소된 WARNING(SoT 3중화·`main.ts` 사본이 다른 최종값을 냄)의 재발 없음을 재확인.
  - 위치: `codebase/backend/src/common/config/s3.config.ts` (`resolvePublicBaseUrl`,
    `shouldWarnPublicBaseIsPrivate`) / `codebase/backend/src/main.ts`
    (동일 함수 import·호출, 손으로 규칙을 재구현하지 않음)
  - 제안: 조치 불요.

## 요약

이번 라운드에서 아키텍처 관점의 새로운 CRITICAL/WARNING 은 없다. 직전 라운드가 남긴 CRITICAL
(`incrementLoginAttempts` 의 read-modify-write 가 아바타 업로드의 컬럼-스코프 쓰기 보장을
반대 방향으로 무효화)은 동시성 문제였지만, 그 수정이 결과적으로 이 서비스의 여러 쓰기
경로(아바타 URL 갱신·로그인 카운터 증가·잠금 해제)를 전부 "자기 컬럼만 건드리는 원자적
쓰기"로 통일시켰다는 점에서 아키텍처적으로도 개선이다 — 스냅샷 전체 `save()` 라는, 이 서비스
안에 남아 있던 마지막 불일치 패턴이 제거됐다. 레이어 분리(Controller→Service→Infra)와 단방향
의존 구조는 계속 유지되며 순환 의존성은 없다. 남아 있는 항목(`UsersService` 의 S3 오케스트레이션
겸임, URL build/parse 비대칭, `S3Service` 지역 provider 중복)은 전부 신규 발견이 아니라
`plan/in-progress/spec-sync-user-profile-gaps.md` 에 팀이 스스로 측정 가능한 재개 신호와 함께
기록해 둔 기존 유예 항목이며, 이번 라운드에 그 항목들이 문서에 그대로 남아 있음을 직접 대조해
확인했다. 단일 S3 소비 사용자-리소스만 있는 현재 규모에서 조기 분리는 얕은 추상만 남길 위험이
있다는 유예 근거는 여전히 유효하다.

## 위험도

LOW
