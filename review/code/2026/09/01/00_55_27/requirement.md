# 요구사항(Requirement) 코드 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)

## 컨텍스트

이 diff 는 `origin/main` 대비 누적 변경 전체(7커밋, 6라운드 코드 리뷰 이력 포함:
`d51954999`~`4d32e0734`)를 담는다. `review/code/2026/08/31/*`·`review/code/2026/09/01/00_*`
하위 파일들은 이전 리뷰 세션의 산출물이지 이번 기능의 코드가 아니므로, 요구사항 충족
여부는 실제 구현 파일(`users.controller.ts`·`users.service.ts`·`s3.service.ts`·
`s3.config.ts`·`main.ts`·관련 테스트·인프라 설정)을 직접 Read 하고, 관련 spec
(`spec/2-navigation/9-user-profile.md`, `spec/5-system/3-error-handling.md`)을 grep 해
현재 상태 기준으로 검증했다. 최신 커밋(`4d32e0734`, 이번 라운드가 처음 보는 diff)이 바꾼
`s3.config.ts`/`main.ts`/`users.controller.ts`(주석 중복 정리)는 직전 라운드
(`review/code/2026/09/01/00_35_24`)의 WARNING 2건에 대한 대응이며, 소스 재확인 결과 둘 다
해소됨을 확인했다. 검증용으로 관련 스펙 6개 파일을 `jest --silent` 로 직접 실행했다
(96/96 통과, 저장소 파일은 건드리지 않음 — `git status --short` 로 확인, 세션 산출물
디렉터리 외 변경 없음).

## 발견사항

- **[SPEC-DRIFT]** `spec/2-navigation/9-user-profile.md` 가 `POST /api/users/me/avatar` 를
  여전히 "미구현 (Planned)" 으로 서술한다 — 구현은 완료됐고 유닛+e2e 회귀 테스트로
  뒷받침된다.
  - 위치: `spec/2-navigation/9-user-profile.md:334`(엔드포인트 표, 취소선 처리된 행)
    · `:136`(아바타 인라인 토글 행, "이미지 파일 업로드는 미구현 (Planned)")
  - 상세: 코드가 옳고 spec 만 낡았다. `users.controller.ts` 의 `uploadAvatar`(`POST
    me/avatar`, `@HttpCode(200)`), `users.service.ts` 의 `updateAvatar` 가 실제로 존재하고,
    `users-avatar.service.spec.ts`(유닛, 뮤테이션 6축 전부 RED)·
    `users-avatar-swagger-sync.spec.ts`(Swagger 산문↔상수 드리프트 가드)·
    `users-avatar-upload.e2e-spec.ts`(e2e 5건 — 익명 GET 200·목록 403·교체 후 404 를 실
    MinIO 로 고정)로 뒷받침된다. `plan/in-progress/spec-update-avatar-upload-implemented.md`
    가 정확한 대상 줄 번호(`:334`, `:136`)와 함께 planner 트랙 할 일로 이미 등록해
    두었다 — developer 권한 경계도 지켜졌다(자기-반증형 소정정 예외 대상 아님, 제품 정의
    서술이라 본인이 developer 로서 직접 못 고침).
  - 제안: 코드 유지. 위 plan 문서의 체크리스트대로 planner 턴에서 `:334`·`:136` 배지를
    뒤집고 §6.1 에 엔드포인트 계약(멀티파트 필드명·2MB 상한·허용 확장자·응답 봉투)을 채운다.

- **[SPEC-DRIFT]** 스토리지 키 레이아웃이 spec 과 실제 구현에서 어긋난다 — `workspaceId`
  접두 유무와 파일명 형태 둘 다 다르다.
  - 위치: `spec/0-overview.md`(스토리지 트리·"Form 노드 업로드 / Avatar" 표 행
    `{workspaceId}/avatars/...` = "계획 (코드 미구현)") · `spec/data-flow/4-file-storage.md`
    (§2.1 키 패턴 표 `<workspaceId>/avatars/<userId>.<ext>` = "spec 정의, 미구현", §2.2
    `avatar_url` 서술 "현재는 외부 URL 또는 빈 값", §2.3 설정 매핑에 `s3.publicBaseUrl`
    미등재)
  - 상세: 실제 구현 키는 `avatars/{userId}/{uuid}.{ext}` 다(`users.service.ts` 의
    `avatarKeyPrefix` 및 `updateAvatar` 의 키 조립부). `workspaceId` 부재는 의도다 —
    `User` 는 워크스페이스 종속 리소스가 아니다. 파일명이 UUID 인 것도 의도다 — 공개
    버킷에서 키가 곧 접근 통제라 `{userId}.{ext}` 처럼 예측 가능하면 열거 공격에
    노출된다. 이 drift 는 단순 서술 차이가 아니라 **운영 위험**이다 — `4-file-storage.md`
    를 SoT 삼아 `{workspaceId}/avatars/` 접두로 버킷 정책을 설계하면 실제 객체
    (`avatars/{userId}/...`)가 정책 밖에 있어 업로드는 성공하고 이미지만 403 이 된다.
    실제 정책 파일 `scripts/minio/avatars-public-read.json` 은 구현 키를 정확히 따르고
    있어 코드/인프라는 일치하고 spec 만 어긋나 있음을 확인했다.
  - 제안: 코드 유지. `plan/in-progress/spec-update-avatar-upload-implemented.md` 의 "같은
    사실을 말하는 다른 SoT 문서" 섹션에 이미 두 문서 모두 대상으로 등재돼 있다 — planner
    턴에서 실제 키 패턴·`s3.publicBaseUrl` 설정 필드로 갱신.

- **[SPEC-DRIFT]** 신규 에러 코드 `FILE_REQUIRED`·아바타 컨텍스트의 `INVALID_FILE_TYPE` 이
  중앙 에러 카탈로그에 등재되지 않았다.
  - 위치: `spec/5-system/3-error-handling.md` §1 (두 코드 모두 grep 0건. `INVALID_FILE_TYPE`
    은 `spec/data-flow/4-file-storage.md:52` 에 KB 문맥으로만 존재) ↔ 코드는
    `users.service.ts` `updateAvatar` 의 `FILE_REQUIRED`(파일 부재/빈 버퍼)·
    `INVALID_FILE_TYPE`(확장자 불허) throw 지점
  - 상세: 코드 자체는 `{ code, message }` 표준 봉투를 지키고, 형제 엔드포인트(`getMe`·
    `updateMe`)의 `USER_NOT_FOUND` 처리와 동일하게 `NotFoundException` 에도 `message`
    를 채운다(이전 라운드 WARNING 이던 message 누락은 해소됨을 재확인). 카탈로그 미등재는
    문서 부채이지 런타임 결함은 아니다.
  - 제안: 코드 유지. 같은 plan 문서에 이미 등재됨 — planner 턴에서 함께 처리.

## 그 외 점검 결과 (문제 없음 — 소스 직접 재확인)

- **핵심 비즈니스 규칙 3축**: (1) 키의 UUID 접근 통제, (2) `Content-Type` 확장자 기반 강제
  (클라이언트 `mimetype` 불신, `hasOwnProperty.call` 로 프로토타입 오염도 방어), (3) DB
  저장 **뒤**에만 옛 객체 정리 — 셋 다 코드에 정확히 반영되고 `users-avatar.service.spec.ts`
  의 뮤테이션 6축이 전부 RED 로 고정한다. 저장 실패 시 정리가 스킵되는지, best-effort
  정리 실패(옛 URL 퍼센트 인코딩 깨짐 포함)가 업로드 자체를 깨뜨리지 않는지 등 경계
  케이스가 명시적으로 테스트됨을 직접 확인했다.
- **lost-update CRITICAL 해소 재확인**: `updateAvatar` 가 `userRepository.save(user)`
  (엔티티 전체 스냅샷 저장) 대신 `userRepository.update(userId, { avatarUrl })` 컬럼 단위
  갱신을 쓴다. `update()`(PATCH 경로)도 동일 패턴. S3 업로드가 도는 수백 ms~수 초 사이
  다른 요청이 바꾼 로그인 실패 카운터·계정 잠금 등의 컬럼이 조용히 되돌아가는 경쟁이 이
  변경으로 성립하지 않는다 — CHANGELOG 서술과 일치. `users-avatar.service.spec.ts` 가
  `Object.keys(patch)` 를 `['avatarUrl']` 로 정확히 비교하고 `repo.save` 미호출을
  단언한다.
- **`S3_PUBLIC_BASE_URL` 3단 폴백 + 부팅 경고**: `resolvePublicBaseUrl(env)` 이 유일한 SoT
  이고 `s3.config.ts`·`main.ts` 양쪽이 그 함수를 호출한다(문자열 재구현 없음, 최신 커밋
  `4d32e0734` 로 `shouldWarnPublicBaseIsPrivate` 순수 함수까지 분리). `s3.config.spec.ts`
  에 두 env 모두 미설정 시 경고가 나는지(4라운드까지 놓쳤던 케이스), 서브도메인 함정
  (`localhost.evil.com`)·미치환 sentinel(`REPLACE_ME.cloudfront.net`)에 오탐하지 않는지가
  `it.each` 로 고정됨을 확인. 직접 실행한 결과 96/96 GREEN.
- **k8s 배포 오버라이드**: `k8s/base/configmap.yaml` 기본값은 `localhost` 지만 `prod`·
  `staging` 오버레이 둘 다 `S3_PUBLIC_BASE_URL` 을 명시적으로 덮어씀을 확인 — CHANGELOG 가
  경고하는 "근접사고" 재발 방지가 실제로 두 오버레이 모두에 반영돼 있다.
- **버킷 정책 e2e**: `users-avatar-upload.e2e-spec.ts` 가 익명 GET 200·목록 조회 403·교체 후
  옛 객체 404·SVG 400·응답 200 을 실 MinIO 컨테이너 기준으로 검증한다. 이 기능의 유일한
  실질 접근 통제(버킷 정책)를 유닛 mock 이 가릴 수 없는 지점에서 고정한 설계다.
- **컨트롤러 위임 정확성**: `uploadAvatar` 가 `payload.sub`(현재 사용자)와 파일을 그대로
  서비스에 넘기고, 응답이 `toProfileData()` 로 `getMe`/`updateMe` 와 동일한 포맷을 쓰며
  `pendingEmail` 을 싣지 않음을 `users.controller.spec.ts` 신규 스위트가 고정한다.
  `@HttpCode(200)` 도 `users-avatar-swagger-sync.spec.ts` 의 리플렉션 테스트로 Swagger
  문서(200)와 런타임 일치가 고정된다.
- **동시성 TOCTOU 잔여 항목**: `avatarUrl` 컬럼 자체에 대한 동시 교체 경합(패자의 신규 S3
  객체가 고아로 남을 수 있음)은 여전히 남아 있으나, `plan/in-progress/spec-sync-user-profile-gaps.md`
  에 측정 가능한 재개 신호(`avatars/` 접두 객체 수가 사용자 수를 유의미하게 초과할 때)와
  함께 명시적으로 유예 등재돼 있다. 데이터 정합성 파괴는 없다(최종 상태는 well-defined) —
  스토리지 누수에 그치는 저위험 항목으로, 새로운 결함이 아니라 이미 처리된 트레이드오프다.
- **TODO/FIXME/HACK/XXX**: 변경된 소스 파일(`s3.config.ts`·`s3.service.ts`·
  `users.controller.ts`·`users.service.ts`·`users.module.ts`·`main.ts`) grep 0건 — 미완성
  작업을 시사하는 마커 없음.
- **에러 시나리오 반환값**: 파일 부재/빈 버퍼(`FILE_REQUIRED`)·잘못된 확장자
  (`INVALID_FILE_TYPE`)·사용자 없음(`USER_NOT_FOUND`, message 포함)·DB 저장 실패 시 정리
  스킵·S3 정리 실패의 best-effort 흡수 — 모든 분기가 명시적으로 테스트되고 모든 경로에서
  적절한 값 또는 표준 `{code, message}` 에러 봉투를 반환함을 확인했다.

## 요약

`POST /api/users/me/avatar` 신설이라는 요구사항은 코드·테스트 양쪽에서 완전하게 구현돼
있다. 세 가지 핵심 비즈니스 규칙(키 UUID 접근 통제·서버 강제 Content-Type·저장 후 정리
순서)이 코드에 정확히 반영되고 뮤테이션 테스트로 고정됐으며, 이전 라운드에서 CRITICAL이던
lost-update(엔티티 전체 `save()`)는 컬럼 단위 `update()` 로 실제로 해소됐다. 이번 라운드가
처음 보는 최신 커밋(`4d32e0734`)은 직전 라운드 WARNING(부팅 경고 조합 판정이 어떤 테스트로도
안 물림·`ExpressNS` 주석 중복)에 대한 대응이며, 순수 함수 추출(`shouldWarnPublicBaseIsPrivate`)
+ 11개 테스트로 실제 해소를 직접 확인했다(96/96 GREEN, 저장소 무변경 확인). 남은 이슈는
전부 spec 문서 4곳(`9-user-profile.md`·`0-overview.md`·`data-flow/4-file-storage.md`·
`5-system/3-error-handling.md`)이 구현을 따라가지 못한 SPEC-DRIFT이며, 코드가 아니라 spec
이 낡은 경우다 — 넷 다 이미 `plan/in-progress/spec-update-avatar-upload-implemented.md` 에
정확한 대상 줄 번호와 함께 planner 트랙으로 위임돼 있어 developer 권한 경계도 지켜졌다.
동시 교체 TOCTOU(고아 객체)도 측정 가능한 재개 신호와 함께 별도 트래커에 정상 유예돼 있어
새로운 미완결 항목이 아니다. 코드 측 CRITICAL/WARNING 신규 발견 없음.

## 위험도

LOW
