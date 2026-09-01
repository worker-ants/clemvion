# 요구사항(Requirement) 코드 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL) · 8라운드

## 컨텍스트

이 diff 는 `origin/main`(`07d322c92`) 대비 누적 8커밋(`d51954999`~`f24584a35`, 7라운드 코드
리뷰 이력 포함)을 담는다. `review/code/2026/08/31/*`·`review/code/2026/09/01/00_*` 하위
파일들은 이전 리뷰 세션의 산출물이지 이번 기능의 코드가 아니므로, 요구사항 충족 여부는
실제 구현 파일(`users.controller.ts`·`users.service.ts`·`users-login-attempts.service.spec.ts`·
`s3.service.ts`·`s3.config.ts`·`main.ts`·`users-avatar.service.spec.ts`·
`users-avatar-swagger-sync.spec.ts`·`users-avatar-upload.e2e-spec.ts`)를 직접 Read 하고, 관련
spec(`spec/2-navigation/9-user-profile.md`)을 grep 해 현재 상태 기준으로 검증했다. 저장소
파일은 건드리지 않았다(`git status --short` 로 확인 — 이 세션의 산출물 디렉터리 외 변경 없음).

이번 라운드가 처음 보는 최신 커밋(`f24584a35`)은 직전 라운드(`00_55_27`)의 CRITICAL 1건
(`incrementLoginAttempts` 가 여전히 스냅샷 전체 `save(user)` 라 아바타 업로드가 정리한 S3
객체를 가리키는 URL 로 DB 가 되돌아갈 수 있었다)에 대한 수정이다. 아래는 그 수정이 실제로
해소됐는지에 대한 독립 재확인이다.

## 발견사항

- **[SPEC-DRIFT]** `spec/2-navigation/9-user-profile.md` 가 `POST /api/users/me/avatar` 를
  여전히 "미구현 (Planned)" 으로 서술한다 — 구현은 완료됐고 유닛+e2e 회귀 테스트로
  뒷받침된다. (이전 라운드부터 반복 지적, 이번 라운드도 미해소 상태 그대로 재확인 — spec 쓰기
  권한은 developer 밖이라 정상.)
  - 위치: `spec/2-navigation/9-user-profile.md:334`(엔드포인트 표, 취소선 처리된 행)
    · `:136`(아바타 인라인 토글 행, "이미지 파일 업로드는 미구현 (Planned)")
  - 상세: `users.controller.ts` 의 `uploadAvatar`(`POST me/avatar`, `@HttpCode(200)`),
    `users.service.ts` 의 `updateAvatar` 가 실제로 존재하고, `users-avatar.service.spec.ts`
    (유닛)·`users-avatar-swagger-sync.spec.ts`(Swagger 산문↔상수 드리프트 가드)·
    `users-avatar-upload.e2e-spec.ts`(e2e 6건 — 익명 GET 200·목록 403·SVG 400·413·교체 후
    404 를 실 MinIO 로 고정)로 뒷받침된다. `plan/in-progress/spec-update-avatar-upload-implemented.md`
    가 정확한 대상 줄 번호(`:334`, `:136`)와 함께 planner 트랙 할 일로 이미 등록돼 있다 —
    developer 권한 경계도 지켜졌다(제품 정의 서술이라 자기-반증형 소정정 예외 대상 아님).
  - 제안: 코드 유지. 위 plan 문서의 체크리스트대로 planner 턴에서 `:334`·`:136` 배지를
    뒤집고 §6.1 에 엔드포인트 계약(멀티파트 필드명·2MB 상한·허용 확장자·응답 봉투)을 채운다.

- **[SPEC-DRIFT]** 스토리지 키 레이아웃이 spec 과 실제 구현에서 어긋난다 — `workspaceId`
  접두 유무와 파일명 형태 둘 다 다르다. (이전 라운드부터 반복 지적, 미해소 상태 재확인.)
  - 위치: `spec/0-overview.md`(스토리지 트리·"Form 노드 업로드 / Avatar" 표 행
    `{workspaceId}/avatars/...` = "계획 (코드 미구현)") · `spec/data-flow/4-file-storage.md`
    (§2.1 키 패턴 표 `<workspaceId>/avatars/<userId>.<ext>` = "spec 정의, 미구현", §2.3 설정
    매핑에 `s3.publicBaseUrl` 미등재)
  - 상세: 실제 구현 키는 `avatars/{userId}/{uuid}.{ext}` 다(`users.service.ts` 의
    `avatarKeyPrefix`). `workspaceId` 부재·UUID 파일명 둘 다 의도된 접근 통제 설계다. 이
    drift 는 운영 위험이다 — `4-file-storage.md` 를 SoT 삼아 `{workspaceId}/avatars/` 접두로
    버킷 정책을 설계하면 실제 객체(`avatars/{userId}/...`)가 정책 밖에 있어 업로드는 성공하고
    이미지만 403 이 된다. 실제 정책 파일 `scripts/minio/avatars-public-read.json` 은 구현 키를
    정확히 따르고 있어 코드/인프라는 일치하고 spec 만 어긋나 있다.
  - 제안: 코드 유지. `plan/in-progress/spec-update-avatar-upload-implemented.md` 의 "같은
    사실을 말하는 다른 SoT 문서" 섹션에 이미 두 문서 모두 대상으로 등재돼 있다 — planner
    턴에서 실제 키 패턴·`s3.publicBaseUrl` 설정 필드로 갱신.

- **[SPEC-DRIFT]** 신규 에러 코드 `FILE_REQUIRED`·아바타 컨텍스트의 `INVALID_FILE_TYPE` 이
  중앙 에러 카탈로그에 미등재. (이전 라운드부터 반복 지적, 미해소 상태 재확인.)
  - 위치: `spec/5-system/3-error-handling.md` §1 (두 코드 모두 grep 0건) ↔ 코드는
    `users.service.ts` `updateAvatar` 의 throw 지점(`:95`, `:115` 부근)
  - 상세: 코드 자체는 `{ code, message }` 표준 봉투를 지킨다. 카탈로그 미등재는 문서 부채이지
    런타임 결함은 아니다.
  - 제안: 코드 유지. 같은 plan 문서에 이미 등재됨 — planner 턴에서 함께 처리.

## 이번 라운드 재확인 사항 — `incrementLoginAttempts` CRITICAL 수정

직전 라운드가 지적한 반대 방향 lost-update(`incrementLoginAttempts` 의 `findOneOrFail` →
필드 수정 → `save(user)` 가, 아바타 업로드가 정리한 S3 객체를 가리키는 옛 `avatarUrl` 로 DB
를 되돌릴 수 있던 문제)가 실제로 해소됐는지 소스를 직접 열어 확인했다:

- `users.service.ts:346-373` — `incrementLoginAttempts` 가 이제 `findOneOrFail`/`save` 를
  전혀 쓰지 않고, `login_attempts`·`locked_until` 두 컬럼만 SET 하는 단일 원자
  `UPDATE ... RETURNING` 문(`updateReturningRows` 규약 준수)이다. 잠금 시각도 앱 시계가 아닌
  DB `NOW()` 로 계산해 다중 인스턴스 시계 드리프트 문제도 함께 없앴다. 빈 결과(`rows.length
  === 0`)면 종전 `findOneOrFail` 과 동일하게 `NotFoundException({code:'USER_NOT_FOUND',
  message:'User not found'})` 를 던져, 반환값 계약도 유지된다.
- `users-login-attempts.service.spec.ts` 6건이 "이 메서드가 자기 컬럼 둘 말고는 아무것도
  쓰지 않는다"(SET 절 컬럼 집합 정확 비교, `avatar_url` 미포함 단언), "사전 조회·엔티티
  저장이 없다"(`findOne`/`findOneOrFail`/`save` 호출 시 throw 하는 stub), "임계값·잠금
  분(分) 이 파라미터로 전달된다", "잠금 시각이 `NOW()` 다", "없는 사용자면 NotFoundException"
  을 각각 고정한다 — 직전 라운드가 지적한 "이 메서드는 테스트가 하나도 없었다"(유일한
  참조가 `auth.service.spec.ts` 의 mock)는 갭도 함께 메워졌다.
- `plan/in-progress/spec-sync-user-profile-gaps.md:83-118` — TOCTOU 유예 노트의 "데이터
  정합성은 깨지지 않는다" 근거가 이 CRITICAL 에 의해 반증됐던 이력과, 수정 후 재확인한 전제
  표(스냅샷 전체 `save()` 를 쓰는 다른 지점이 없음)가 함께 기록돼 있다 — 반증 이력을 지우지
  않고 남긴 것도 확인했다.
- 자매 메서드 `resetLoginAttempts`(`:375-380`)는 이미 컬럼 단위 `update()` 였다는 주석 서술도
  소스와 일치한다.

이 CRITICAL 은 실제로 해소된 것으로 판단한다 — 새로운 문제는 발견하지 못했다.

## 그 외 점검 결과 (문제 없음)

- **413 enforcement 갭 해소**: 직전 라운드 WARNING(2MB 상한이 문서화만 되고 실제 초과
  전송 → 413 을 검증하는 테스트가 없었음)이 `users-avatar-upload.e2e-spec.ts:118-133`
  (`2MB 를 넘으면 413 이고 아무것도 올라가지 않는다`)로 메워졌음을 직접 확인했다.
- **핵심 비즈니스 규칙 3축 유지**: (1) 키의 UUID 접근 통제, (2) `Content-Type` 확장자 기반
  강제(클라이언트 `mimetype` 불신, `hasOwnProperty.call` 로 프로토타입 오염 방어), (3) DB
  저장 뒤에만 옛 객체 정리 — 이번 라운드 diff 가 건드리지 않은 부분이며 소스 재확인 결과
  변경 없이 그대로 유지된다.
- **`updateAvatar` lost-update(정방향) 재확인**: `userRepository.update(userId, {
  avatarUrl })` 컬럼 단위 갱신 유지, `Object.keys(patch)` 를 `['avatarUrl']` 로 정확히
  비교하는 테스트(`users-avatar.service.spec.ts:355-397`) 유지.
- **컨트롤러 위임·응답 정확성**: `uploadAvatar` 가 `payload.sub` 와 파일을 그대로 서비스에
  넘기고 `toProfileData()` 로 `getMe`/`updateMe` 와 동일한 응답 포맷을 씀을
  `users.controller.spec.ts` 신규 스위트가 고정한다. `@HttpCode(200)` 도 리플렉션 테스트로
  고정된다.
- **TODO/FIXME/HACK/XXX**: 이번 라운드가 건드린 소스 파일(`users.service.ts`,
  `users-login-attempts.service.spec.ts`) grep 0건.
- **에러 시나리오·반환값**: `incrementLoginAttempts` 의 빈 결과 케이스(`NotFoundException`),
  정상 케이스(`RETURNING` 값 반환) 모두 명시적으로 테스트되고 모든 경로에서 적절한 값을
  반환함을 확인했다.

## 요약

`POST /api/users/me/avatar` 신설이라는 요구사항은 코드·테스트 양쪽에서 완전하게 구현돼
있고, 8라운드에 걸친 리뷰가 반복적으로 찾아낸 CRITICAL(정방향 lost-update)·WARNING(반대
방향 lost-update, 2MB 상한 미검증)이 전부 실제로 해소됐음을 이번 라운드에서 소스를 직접 열어
독립 재확인했다. 특히 이번 라운드가 처음 보는 커밋(`f24584a35`)은 `incrementLoginAttempts`
를 read-modify-write(`save(user)`) 에서 단일 원자 `UPDATE ... RETURNING` 으로 바꿨고, 이
메서드가 이전까지 테스트가 전무했다는 사실까지 함께 드러내 신규 회귀 6건으로 메웠다 — 코드
수정과 테스트 커버리지 확장이 정확히 일치한다. 남은 이슈는 전부 spec 문서 3곳(엔드포인트
구현 상태 배지, 스토리지 키 레이아웃, 에러 카탈로그)이 구현을 따라가지 못한 SPEC-DRIFT이며,
넷 다 이전 라운드부터 `plan/in-progress/spec-update-avatar-upload-implemented.md` 에 정확한
대상 줄 번호와 함께 planner 트랙으로 위임돼 있어 developer 권한 경계도 지켜졌다. 코드 측
CRITICAL/WARNING 신규 발견 없음.

## 위험도

LOW
