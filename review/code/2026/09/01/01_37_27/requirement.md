# 요구사항(Requirement) 코드 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)

## 컨텍스트

이 changeset 은 이미 8라운드의 리뷰-수정 사이클(`review/code/2026/08/31/22_12_54` ~
`2026/09/01/01_19_27`)을 거쳤다. `git status --short` 는 `review/code/2026/09/01/01_37_27/`
(이 라운드 산출물)만 untracked 로 보여 — **직전 라운드(01_19_27) 이후 코드 변경이 없다**. 그
RESOLUTION.md 는 "Critical 이 없으면 코드를 건드리지 않고 통과시킨다"는 수렴 판단을 명시했다.
본 리뷰는 그 판단을 그대로 받아들이지 않고, 실제 파일(`codebase/backend/src/modules/users/*`,
`common/services/s3.service.ts`, `common/config/s3.config.ts`, `main.ts`, e2e/unit 테스트,
관련 spec 문서 3개)을 직접 열어 독립적으로 재검증했다.

## 발견사항

- **[WARNING]** `[SPEC-DRIFT]` `spec/2-navigation/9-user-profile.md` 가 여전히
  `POST /api/users/me/avatar` 를 "미구현 (Planned)" 으로 서술한다
  — 실제로는 `users.controller.ts` 의 `uploadAvatar` 로 완전히 구현·테스트(unit +
  e2e)돼 있다.
  - 위치: `spec/2-navigation/9-user-profile.md:334`(`~~POST~~ ~~/api/users/me/avatar~~ … 미구현
    (Planned)`), `:136`(아바타 행 — "이미지 파일 업로드는 미구현 (Planned)")
  - 상세: 코드가 옳고 spec 이 낡았다 — 구현은 사용자 결정(2026-08-31, 공개 버킷+공개 URL)에
    따라 완결됐고 `plan/in-progress/spec-sync-user-profile-gaps.md:18` 의 체크박스도 `[x]`로
    실제 상태와 일치한다. developer 는 `spec/` 쓰기 권한이 없고(제품 정의/API 계약이라 자기
    반증형 소정정 예외에도 해당하지 않음) `plan/in-progress/spec-update-avatar-upload-implemented.md`
    로 planner 트랙에 정확히 위임돼 있다 — 절차 위반은 아니다. 다만 spec 본문이 아직 반영 전
    상태이므로 발견사항으로 남긴다.
  - 제안: 코드 변경 불필요. `project-planner` 턴에서 `plan/in-progress/spec-update-avatar-upload-implemented.md`
    의 할 일대로 `:334` 표 행 취소선 해제 + `:136` 서술 정정 + §6.1 엔드포인트 계약 기재.

- **[WARNING]** `[SPEC-DRIFT]` 스토리지 키 레이아웃이 spec 과 실제 구현에서 서로 다르다 —
  `workspaceId` 접두 유무와 파일명 형태(고정 vs UUID) 둘 다 어긋난다.
  - 위치: `spec/0-overview.md:276`(`Form 노드 업로드 / Avatar | {workspaceId}/avatars/... |
    계획 (코드 미구현)`), `spec/data-flow/4-file-storage.md:57-59`(§1.2 제목 "Spec 상 정의되지만
    미구현" + 자기-참조 TODO "Avatar 기능이 도입될 때 본 문서를 갱신한다"), `:71`(§2.1 키 패턴
    표 `<workspaceId>/avatars/<userId>.<ext>` — "spec 정의, 미구현"), `:78`(§2.2 `avatar_url`
    서술 "현재는 외부 URL 또는 빈 값. S3 직접 업로드 도입 시 prefix 정의 필요")
  - 상세: 실제 구현 키는 `avatars/{userId}/{uuid}.{ext}` (`users.service.ts:130`,
    `UsersService.avatarKeyPrefix`) — `workspaceId` 가 없고(User 는 워크스페이스 종속 리소스가
    아니라는 의도적 설계) 파일명이 고정 `<userId>.<ext>` 가 아니라 UUID(공개 버킷에서 키가 곧
    접근 통제이므로 추측 불가능성이 필요). §2.3 ConfigService 매핑 표에도 신규
    `s3.publicBaseUrl` 행이 없다. `4-file-storage.md:58` 의 TODO 문장 자체가 "Avatar 기능이
    도입될 때 본 문서를 갱신한다"고 예고하고 있었고, 지금이 정확히 그 트리거 시점이다. 코드가
    옳다 — spec 을 실제 키 패턴 기준으로 갱신해야 한다.
  - 제안: 코드 변경 불필요. 이미 `plan/in-progress/spec-update-avatar-upload-implemented.md`
    §"같은 사실을 말하는 다른 SoT 문서"에 세 문서·정확한 줄 번호까지 위임돼 있다 — planner
    턴에서 반영.

- **[WARNING]** `[SPEC-DRIFT]` 신규 에러 코드 `FILE_REQUIRED`·`INVALID_FILE_TYPE` 이 중앙
  에러 카탈로그에 미등재.
  - 위치: `spec/5-system/3-error-handling.md` §1 (카탈로그에 두 코드 모두 없음, grep 0건) ↔
    `codebase/backend/src/modules/users/users.service.ts:95`(`FILE_REQUIRED`),
    `:115`(`INVALID_FILE_TYPE`)
  - 상세: 코드 자체는 `{code, message}` 표준 봉투를 지키고 있고(`getMe`/`updateMe`/
    `changePassword` 와 동일 패턴), `INVALID_FILE_TYPE` 은 KB 문서 업로드
    (`data-flow/4-file-storage.md:52`)와 코드를 공유한다. 새로 만든 결함이 아니라 문서 등재
    누락이며, 이미 `plan/in-progress/spec-update-avatar-upload-implemented.md:50-52`에 추적
    중이다.
  - 제안: 코드 변경 불필요. planner 턴에서 카탈로그에 두 코드 등재.

- **[INFO]** 동시 업로드/PATCH 교차 시 "패자" 오브젝트가 영구 고아로 남는 TOCTOU — 데이터
  정합성 훼손은 없음, 기존에 측정 가능한 재개 신호와 함께 정식 유예됨.
  - 위치: `codebase/backend/src/modules/users/users.service.ts` `updateAvatar`(정리 대상 키를
    비원자적 사전 SELECT 로 캡처), `update()`(동일 패턴)
  - 상세: `plan/in-progress/spec-sync-user-profile-gaps.md:83-121` 에 "지금 안 고치는 이유"
    (advisory lock 비용 대비 효과 낮음, 주기적 orphan-sweep 이 더 적합한 도구)와 재개 신호
    (`avatars/` 접두 객체 수가 사용자 수를 유의미하게 웃돌 때)가 구체적으로 적혀 있다. 이
    유예의 전제(User 엔티티를 스냅샷 전체로 `save()`하는 다른 writer 가 없어야 함)가 7라운드에
    한 번 반증됐다가(`incrementLoginAttempts` 의 read-modify-write) 8라운드에서 원자
    `UPDATE ... RETURNING` 으로 재확인됐음을 직접 코드로 확인했다(`users.service.ts:346-373`,
    `users-login-attempts.service.spec.ts` 6건). 조치 불필요.

- **[INFO]** 파일 크기 상한(2MB) **경계값에서 성공**하는 케이스가 없다 — 초과 거부(413)만
  e2e 로 검증됨.
  - 위치: `codebase/backend/test/users-avatar-upload.e2e-spec.ts:118-133`
    (`2MB 를 넘으면 413` — `AVATAR_MAX_BYTES + 1` 만 테스트)
  - 상세: 정확히 `AVATAR_MAX_BYTES`(2 * 1024 * 1024) 바이트일 때 업로드가 성공하는지를 확인하는
    테스트가 없다. multer `limits.fileSize` 의 경계 포함/배제 동작(`<=` vs `<`)이 라이브러리
    책임이라 실질 위험은 낮지만, 상한이 off-by-one 으로 어긋나도(예: 상수가 실수로 -1 되어도)
    현재 테스트로는 못 잡는다.
  - 제안: 우선순위 낮음. 필요 시 `Buffer.alloc(AVATAR_MAX_BYTES)` 로 200 을 기대하는 케이스
    1개 추가.

## 그 외 점검 결과 (문제 없음 — 직접 확인)

- **기능 완전성**: `POST /api/users/me/avatar` — 파일 검증(부재/빈 버퍼/확장자/크기) →
  S3 업로드 → 컬럼 단위 DB 갱신 → 병렬(재조회 + 옛 객체 정리) → 프로필 봉투 반환까지
  end-to-end 로 구현되어 있고, 사용자 결정("공개 버킷 + 공개 URL")이 요구하는 세 가지
  완화(UUID 키, 서버측 Content-Type, 저장 후 삭제 순서)가 전부 코드에 있다.
- **엣지 케이스**: 빈 버퍼(파일은 있으나 내용 없음)·대문자 확장자·프로토타입 체인 이름
  (`constructor`/`__proto__`)·URL 에 쿼리스트링/프래그먼트가 붙은 옛 아바타·깨진 퍼센트
  인코딩(`%zz`)·base URL 이 바뀐 뒤의 옛 URL·다른 버킷을 가리키는 옛 URL·남의 아바타 키
  보호·업로드 자체 실패(S3 다운)까지 `users-avatar.service.spec.ts`(536줄, 다축) +
  e2e(`users-avatar-upload.e2e-spec.ts`)로 고정돼 있다.
- **TODO/FIXME/HACK/XXX**: `git diff origin/main...HEAD -- codebase/` 전수 grep 결과 0건.
- **의도와 구현 간 괴리**: `s3.service.ts:32-41` 의 `?? endpoint` 주석이 "SoT 는 config, 이
  줄은 설정 모듈 미로드 조립의 2차 방어"라고 정확히 설명하며 실제 동작과 일치한다(이전
  라운드가 "폴백은 한 곳" 이라고 잘못 단언했던 것을 이번 코드는 스스로 정정한 상태). JSDoc의
  `@throws` 목록(`FILE_REQUIRED`/`INVALID_FILE_TYPE`/`USER_NOT_FOUND`)도 실제 throw 지점과
  1:1 대응한다.
- **에러 시나리오**: 400(`FILE_REQUIRED`/`INVALID_FILE_TYPE`) · 404(`USER_NOT_FOUND`,
  message 필드 포함해 형제 엔드포인트와 일치) · 413(multer→`PayloadTooLargeException`) 모두
  unit + e2e 양쪽에서 검증됨. 업로드 실패 시 DB/S3 어느 쪽도 건드리지 않고 예외를 그대로
  전파하는 것도 테스트로 고정(`users-avatar.service.spec.ts:215-230`).
- **데이터 유효성**: 확장자 화이트리스트는 `hasOwnProperty` 로 프로토타입 오염을 막고, 클라이언트
  `mimetype` 을 신뢰하지 않고 서버가 확장자에서 `Content-Type` 을 파생한다(`users.service.ts:100-118`).
- **비즈니스 로직**: "공개 버킷+공개 URL" 결정 → 키 UUID(접근 통제) / SVG 제외(XSS 방어) /
  저장 후 삭제(orphan URL 방지) / 컬럼 단위 UPDATE(lost-update 방지) 네 축 모두 CHANGELOG·
  plan·코드 주석·테스트가 정확히 같은 근거로 정렬돼 있다.
- **반환값**: `updateAvatar` 는 모든 성공 경로에서 `Promise<User>`(재조회된 최신 엔티티)를
  반환하고, 모든 실패 경로에서 명시적 예외를 던진다 — 암묵적 `undefined` 반환 경로 없음.
  컨트롤러는 `toProfileData` 로 `getMe`/`updateMe`와 동일한 응답 봉투를 만든다
  (`locale`/`theme` 기본값 `'ko'`/`'light'` 도 일치, `users.controller.spec.ts:434-449` 로
  회귀 고정).
- **spec fidelity(그 외)**: `s3.config.ts` 의 `publicBaseUrl` 폴백 규칙과 `main.ts` 부팅 경고가
  같은 순수 함수(`resolvePublicBaseUrl`/`shouldWarnPublicBaseIsPrivate`)를 공유해 규칙 이원화
  위험이 코드 구조적으로 제거돼 있다(이전 라운드가 실측한 "규칙이 두 곳"이면 갈리는 문제의
  근본 수정).

## 요약

`POST /api/users/me/avatar` 구현은 사용자 결정("공개 버킷 + 공개 URL")이 요구하는 기능·보안·
데이터 정합성 요구사항을 완전히 충족하며, 8라운드 리뷰를 거치며 지적된 CRITICAL(로그인 카운터
read-modify-write 가 아바타 정리를 반대 방향에서 무효화하던 lost-update)은 원자적
`UPDATE ... RETURNING` 으로 실제 해소됐음을 코드 직접 확인으로 재검증했다. TODO/FIXME 잔존
없음, 모든 에러 경로에 코드·메시지가 갖춰져 있고 형제 엔드포인트와 일관되며, 반환값 누락 경로도
없다. 유일하게 남는 것은 spec 본문 3곳(`9-user-profile.md` 배지, `0-overview.md`+
`4-file-storage.md` 키 레이아웃, `3-error-handling.md` 에러 카탈로그)의 **SPEC-DRIFT**인데,
셋 다 코드가 옳고 spec 이 아직 반영 전인 상태이며 developer 권한 밖이라 planner 트랙
(`plan/in-progress/spec-update-avatar-upload-implemented.md`)으로 정확히 위임돼 있어 절차상
문제는 없다. 남은 TOCTOU 고아 객체 리스크는 데이터 정합성에 영향이 없고 측정 가능한 재개
신호와 함께 정식 유예돼 있어 조치 불필요하다.

## 위험도

LOW
