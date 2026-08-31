# Cross-Spec 일관성 검토 — 아바타 업로드 공개 URL (impl-done, scope=spec/5-system)

## 검토 개요

이번 PR 은 `spec/5-system/` 자체에는 델타가 없다(정상 — 코드 전용 PR). 구현 diff(15 파일)는
`POST /api/users/me/avatar` 신설(공개 버킷 + 공개 URL 서빙)이며, target 스코프인
`spec/5-system/3-error-handling.md` 를 포함한 여러 영역과의 정합성을 실제 워킹트리
(`git -C ".../avatar-upload-public-url-be6022" show HEAD:...`)와 `spec/**` 를 직접 대조해 확인했다.

## 발견사항

- **[WARNING]** 아바타 S3 키 구조가 `spec/0-overview.md` §2.7 의 명시적 Rationale 결정과 정면 모순
  - target 위치: 구현 diff `codebase/backend/src/modules/users/users.service.ts`
    (`avatarKeyPrefix(userId) = "avatars/${userId}/"`, 실제 키
    `avatars/{userId}/{uuid}.{ext}` — 매 업로드마다 신규 UUID 오브젝트 생성 후 옛 오브젝트
    best-effort 삭제)
  - 충돌 대상: `spec/0-overview.md` §2.7 버킷 구조 트리(`{workspaceId}/avatars/{userId}.{ext}`
    — "계획") + 하단 표("Form 노드 업로드 / Avatar: `{workspaceId}/avatars/...` — 계획
    (코드 미구현)") + 같은 문서 Rationale "S3 객체 키 prefix 설계"(**"Form/Avatar 영역은 §2.7
    의 키 구조와 같이 이 패턴(workspaceId prefix)을 따른다"**로 명시 채택) + `spec/data-flow
    /4-file-storage.md` §1.2/§2.1("`<workspaceId>/avatars/<userId>.<ext>`" · "spec 정의,
    미구현") · §2.2(`user.avatar_url`: "현재는 외부 URL 또는 빈 값. S3 직접 업로드 도입 시
    prefix 정의 필요")
  - 상세: 실제 구현은 (1) `workspaceId` prefix 를 의도적으로 배제(User 는 워크스페이스
    종속 리소스가 아니므로), (2) 파일명을 고정 `{userId}.{ext}` 대신 업로드마다 새 UUID 로
    생성, (3) 비공개(백엔드 매개 다운로드)가 아니라 **익명 GET 허용 공개 버킷**으로 서빙한다
    — 세 축 모두 위 문서들이 서술하는 계획과 다르다. 이 spec 이 그대로 SoT 로 남아 있는 동안
    운영자가 이를 근거로 버킷 정책을 `{workspaceId}/avatars/` 접두로 설계하면 실제 오브젝트
    (`avatars/...`)에는 정책이 걸리지 않아 **"업로드는 성공, 이미지는 403"** 이 되는 실패가
    재현된다 — 이는 `plan/in-progress/spec-update-avatar-upload-implemented.md` 자신이
    "왜 이게 Critical 인가" 절에서 이미 지목한 정확히 그 리스크다.
  - 제안: `spec/0-overview.md §2.7`(본문 트리·표·Rationale)과 `spec/data-flow
    /4-file-storage.md §1.2/§2.1/§2.2` 를 실제 키 패턴·공개 접근 모델로 갱신. 이미
    project-planner 소유의 pending plan(`plan/in-progress
    /spec-update-avatar-upload-implemented.md`)이 존재하므로 신규 위임 대신 그 plan 실행을
    우선순위로 권장.

- **[WARNING]** `spec/2-navigation/9-user-profile.md` 가 이미 구현·e2e 검증된 기능을
  "미구현 (Planned)" 으로 계속 서술 (spec-impl drift)
  - target 위치: 구현 diff 전체 — `users.controller.ts` `POST me/avatar`(`uploadAvatar`),
    `users.service.ts` `updateAvatar`, e2e `test/users-avatar-upload.e2e-spec.ts`(업로드 →
    공개 URL 200 확인까지 커버)
  - 충돌 대상: `spec/2-navigation/9-user-profile.md` §2.1 필드 표(":아바타 | O | 인라인
    토글 | ... **이미지 파일 업로드는 미구현 (Planned)** — 전용 업로드 엔드포인트(§6.1 참조)
    부재") + §6.1 API 표("`~~POST~~` `~~/api/users/me/avatar~~` ... **미구현 (Planned)**")
  - 상세: 이 문서만 읽는 사람은 아바타 이미지 업로드가 없다고 믿게 되지만, 실제로는 완전한
    엔드포인트·검증(용량·확장자 화이트리스트)·정리 로직(lost-update 방지 컬럼 단위 update,
    옛 오브젝트 best-effort 삭제)·e2e 가 이미 존재한다. 이 gap 은 개발자 자신도 인지하고
    있다 — `s3.config.ts` 코드 주석: "그 §6.1 은 이 글을 쓰는 시점에 아직 '미구현
    (Planned)' 로 남아 있다 — spec 쓰기가 planner 트랙이라 배지 flip 을 분리했다."
  - 제안: `plan/in-progress/spec-update-avatar-upload-implemented.md` (이미 존재,
    project-planner owner) 실행 — 배지 flip + §6.1 엔드포인트 계약(multipart/form-data,
    2MB, 허용 확장자) 반영. 아래 finding(공개 버킷 속성)도 같은 갱신에 함께 반영 필요.

- **[WARNING]** 공개 버킷(anonymous GET) 접근 모델과 신규 `S3_PUBLIC_BASE_URL`/
  `publicBaseUrl` 설정 키가 어떤 spec 문서에도 문서화되지 않음
  - target 위치: `codebase/backend/src/common/config/s3.config.ts`
    (`resolvePublicBaseUrl`, `shouldWarnPublicBaseIsPrivate`), `s3.service.ts`
    (`getPublicUrl`), `.env.example` 신규 `S3_PUBLIC_BASE_URL`
  - 충돌 대상: `spec/data-flow/4-file-storage.md` §2.3 "ConfigService" 매핑 표 — 이 표가
    S3 관련 설정 키의 SoT 를 자처하는데(`s3.bucket`/`endpoint`/`region`/`accessKey`/
    `secretKey` 5개만 나열) 이번 PR 이 6번째 키(`s3.publicBaseUrl`)를 추가하고도 표를 갱신
    하지 않음. 또한 `spec/0-overview.md §2.7`(Object Storage 개요)는 "공개/비공개" 접근
    모델 구분 자체를 언급하지 않는다 — 지금까지 유일한 소비처인 KB 문서는 백엔드 매개
    다운로드(비공개)였는데, 아바타가 **최초로** 익명 공개 읽기 모델을 도입했다.
  - 상세: `S3Service` 를 공유하는 두 소비처(KB, 아바타)가 서로 다른 접근 통제 모델(비공개
    vs 공개+UUID 은닉)을 갖게 됐는데, 이 차이·전제(버킷 정책이 `ListBucket` 은 반드시 닫아야
    한다는 것 등)가 코드 주석(`.env.example`, `s3.service.ts` JSDoc)에만 있고 spec 레벨
    SoT 가 없다.
  - 제안: `data-flow/4-file-storage.md §2.3` 에 `publicBaseUrl`/`S3_PUBLIC_BASE_URL` 행
    추가 + "공개 vs 비공개 오브젝트" 구분을 §1 또는 신규 절에 명시. 배포 선행조건(버킷 정책의
    `avatars/` 익명 GET 허용 + ListBucket 차단)도 함께 — `plan/in-progress
    /spec-update-avatar-upload-implemented.md` 의 "반드시 함께 적어야 하는 것" 절이 이미
    이 요구를 명시.

- **[INFO]** 신규/재사용 에러 코드 `FILE_REQUIRED`·`INVALID_FILE_TYPE` 이 target 문서
  (`spec/5-system/3-error-handling.md`) §1.3 카탈로그에 미등재
  - target 위치: `spec/5-system/3-error-handling.md` §1.3 (유효성 검증 에러) — 이번 리뷰의
    target 문서 본문
  - 충돌 대상: `codebase/backend/src/modules/users/users.service.ts` `updateAvatar`(신규
    `FILE_REQUIRED`·`INVALID_FILE_TYPE` throw) + `codebase/backend/src/modules
    /knowledge-base/knowledge-base.service.ts`(기존 `INVALID_FILE_TYPE` 재사용 — 이 PR 이
    만든 문제는 아니지만 두 번째 도메인이 같은 코드를 재사용하며 격차가 굳어짐)
  - 상세: `3-error-handling.md` Overview 는 "도메인 spec 에 SoT 가 있는 코드는 §1 에
    공용 카탈로그 가시성을 위해 등재만 한다" 는 규약을 스스로 선언하는데, 이번 PR 이 추가한
    두 코드는 어느 카탈로그에도 없다. `INVALID_FILE_TYPE` 는 이제 KB 문서(txt/md/pdf/csv)와
    아바타 이미지(png/jpg/jpeg/webp/gif) 두 도메인이 같은 이름·같은 400 을 쓰는데 그 사실도
    문서화되어 있지 않다 — 세 번째 소비처가 우연히 다른 의미로 이 이름을 재사용해도 잡을
    SoT 가 없다.
  - 제안: `spec/5-system/3-error-handling.md §1.3` 에 두 코드 등재.
    `plan/in-progress/spec-update-avatar-upload-implemented.md` 가 이미 이 항목을 todo 로
    갖고 있다.

- **[INFO]** 신규 plan 이 영향받는 4개 문서 중 어디의 frontmatter `pending_plans` 에도
  등재되지 않음
  - target 위치: `spec/2-navigation/9-user-profile.md`, `spec/0-overview.md`, `spec
    /data-flow/4-file-storage.md`, `spec/5-system/3-error-handling.md` 의 frontmatter
  - 충돌 대상: `plan/in-progress/spec-update-avatar-upload-implemented.md` 자신이 위
    4개 문서를 명시 대상으로 삼지만, `9-user-profile.md` 의 `pending_plans:` 는 다른
    plan(`spec-sync-user-profile-gaps.md`) 만 가리키고, `0-overview.md`/`4-file-storage.md`
    는 frontmatter 자체가 없으며, `3-error-handling.md` 는 frontmatter 는 있으나
    `pending_plans` 필드가 없다.
  - 상세: 사소하지만 `pending_plans` 는 이 프로젝트에서 "이 문서가 곧 바뀔 것" 을 다음
    독자에게 알리는 신호다. 4곳 중 하나도 신규 plan 을 가리키지 않으면 그 문서만 단독으로
    여는 사람은 이 gap 의 존재를 모른다.
  - 제안: 최소 `9-user-profile.md` 의 `pending_plans` 목록에 이 plan 을 추가하고, 나머지
    3개 문서도 frontmatter 를 갖고 있다면(`0-overview.md`/`4-file-storage.md` 는 현재
    frontmatter 자체가 없음) 같은 필드를 추가.

### 확인했으나 충돌 아님 (기록)

- **body-parser 한도 분리**: 전역 JSON/urlencoded 한도(100KB, `GLOBAL_MAX_BODY_BYTES`)는
  `express.json()`/`express.urlencoded()` 에만 적용되고 `multipart/form-data` 는 별도
  스트림으로 `FileInterceptor`(multer, `AVATAR_MAX_BYTES` 2MB)가 처리한다 — 두 한도는
  서로 다른 content-type 경로라 충돌하지 않는다.
- **RBAC**: `POST /users/me/avatar` 는 컨트롤러 레벨 `@UseGuards(JwtAuthGuard)` 만
  요구하며 형제 엔드포인트(`GET/PATCH /users/me`)와 동일 — 새 권한 구조 도입 없음.
- **계층 책임**: `S3Service` 를 `UsersModule` 의 지역 provider 로 둔 것은 KB 모듈과 동일한
  기존 패턴(공용 모듈이 아니라 `common/services` 의 stateless 클래스를 지역 주입)이라
  기존 결정과 일치.

## 요약

이번 PR 은 `spec/5-system/` 자체를 변경하지 않았고, 도입한 에러 처리·인증·권한 표면은
기존 `spec/5-system` 정의와 실제로 충돌하지 않는다. 그러나 구현이 새로 만든 아바타 공개
버킷·키 구조는 `spec/0-overview.md §2.7`(및 그 Rationale 의 명시적 채택 문장)·`spec
/data-flow/4-file-storage.md` 가 서술하는 계획(`{workspaceId}/avatars/{userId}.{ext}`,
비공개 접근)과 정면으로 다르고, `spec/2-navigation/9-user-profile.md` 는 이 기능을 여전히
"미구현" 으로 서술한다. 다행히 이 gap 은 이미 저장소 안에
`plan/in-progress/spec-update-avatar-upload-implemented.md` 로 상세히 포착·추적되고
있어(위험 분석 포함) 새로운 발견이라기보다 "실행이 남아 있는 이미 알려진 항목" 에 가깝다.
에러 코드 카탈로그 미등재와 frontmatter `pending_plans` 동기화는 상대적으로 경미하다.

## 위험도

MEDIUM — 코드 자체의 자기정합성은 높고 상세한 pending plan 이 이미 존재하지만, 4개 spec
문서가 실제 아키텍처와 어긋난 채로 SoT 를 자처하고 있고(그중 하나는 명시 Rationale 결정과
정면 모순) 방치 시 운영 사고(버킷 정책 오설정 → 이미지 403) 로 이어질 실제 경로가 있다.
