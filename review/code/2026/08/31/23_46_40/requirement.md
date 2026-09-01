# 요구사항(Requirement) 리뷰 — 아바타 업로드 (공개 버킷 + 공개 URL)

## 검증 방법

프롬프트 diff 26개 파일 전수 확인 + 다음을 직접 실행/대조했다 (저장소 파일은 뮤테이션하지 않음, 읽기 전용):

- `pnpm exec jest` 로 관련 6개 스펙 파일(`users-avatar.service.spec.ts`·`users-avatar-swagger-sync.spec.ts`·
  `users.controller.spec.ts`·`users.service.spec.ts`·`s3.service.spec.ts`·`s3.config.spec.ts`) 실행 —
  **75/75 통과**, `users-avatar.service.spec.ts` 단독 **30/30**(plan 문서 claim 과 일치).
- `pnpm exec tsc --noEmit` — 이 PR 이 건드린 파일(`users.controller.ts`·`users.service.ts`·`s3.service.ts`·
  `main.ts`) 관련 신규 타입 에러 **없음**(남은 에러는 전부 무관한 기존 파일, `users.service.spec.ts:124` 1건
  포함 — diff 범위(1~60줄) 밖).
- `@nestjs/platform-express` 소스(`multer.utils.js`)를 직접 열어 `LIMIT_FILE_SIZE → PayloadTooLargeException`
  자동 변환을 확인 — `@ApiPayloadTooLargeResponse` 문서화가 런타임과 일치.
- `HTTP_CODE_METADATA = '__httpCode__'` (`@nestjs/common/constants.js`) 를 확인 —
  `users-avatar-swagger-sync.spec.ts` 의 메타데이터 키가 정확.
- `spec/2-navigation/9-user-profile.md`·`spec/0-overview.md`·`spec/data-flow/4-file-storage.md`·
  `spec/5-system/3-error-handling.md` 를 직접 Read/Grep — plan 문서(`spec-update-avatar-upload-implemented.md`)가
  주장하는 stale 서술을 라인 단위로 대조.

## 발견사항

- **[SPEC-DRIFT]** `spec/2-navigation/9-user-profile.md` 가 `POST /api/users/me/avatar` 를 여전히
  "미구현 (Planned)" 으로 서술한다 — 코드는 이번 PR 로 구현 완료.
  - 위치: `spec/2-navigation/9-user-profile.md:136`(아바타 필드 행 — "이미지 파일 업로드는 미구현
    (Planned)"), `:334`(API 표 — `~~POST~~` `~~/api/users/me/avatar~~` "미구현 (Planned)")
  - 상세: 실측으로 두 위치 모두 여전히 미구현 서술임을 확인. 코드(`users.controller.ts` `uploadAvatar`,
    `users.service.ts` `updateAvatar`)는 정상 동작하고 75/75 테스트 통과 — 코드가 옳고 spec 이 낡았다.
  - 제안: 코드 변경 불필요. `plan/in-progress/spec-update-avatar-upload-implemented.md` 가 이미 이 정확한
    두 라인(§할 일 `:334`·`:136`)을 planner 트랙 작업으로 등록해 두었다 — **이미 올바르게 위임됨**, 새
    조치 불요. developer 가 `spec/` 을 직접 고치지 않은 것도 CLAUDE.md 의 "자기-반증형 소정정" 예외
    (developer 자신이 쓴 예고 문장만 해당)에 해당하지 않으므로 절차상 정확하다.

- **[SPEC-DRIFT]** `spec/0-overview.md` §2.7 스토리지 레이아웃이 아바타 키 패턴을 `{workspaceId}/avatars/...`
  로, 구현 상태를 "계획 (코드 미구현)" 으로 서술한다 — 실제 구현 키는 `avatars/{userId}/{uuid}.{ext}`
  (workspaceId 없음, UUID 파일명).
  - 위치: `spec/0-overview.md:269`(트리 주석), `:276`(Form 노드 업로드 / Avatar 표 행)
  - 상세: `users.service.ts` `avatarKeyPrefix()`(`avatars/${userId}/`)와 대조해 실측 — spec 의 키 패턴은
    실제 구현과 다르다. workspaceId 부재·UUID 파일명 둘 다 의도적 설계(User 는 워크스페이스 종속 리소스가
    아님, 공개 버킷에서 키가 곧 접근 통제)이므로 코드가 옳다.
  - 제안: 코드 변경 불필요. 위와 같은 planner 트랙 plan 문서가 이미 이 라인을 정확히 지목(`§할 일` 첫 항목)
    했고, "이 stale spec 을 SoT 삼아 버킷 정책을 설계하면 업로드는 성공하고 이미지만 403" 이라는 실제 위험
    까지 문서화해 두었다. 새 조치 불요.

- **[SPEC-DRIFT]** `spec/data-flow/4-file-storage.md` 가 아바타 키 패턴·구현 상태를 잘못 서술한다.
  - 위치: `spec/data-flow/4-file-storage.md:58`(§1.2 서술), `:71`(§2.1 키 패턴 표 —
    `<workspaceId>/avatars/<userId>.<ext>` "spec 정의, 미구현"), `:78`(§2.2 `avatar_url` 서술 — "현재는
    외부 URL 또는 빈 값")
  - 상세: 위와 동일한 키 패턴 불일치. 추가로 §2.3 설정 매핑에 신규 `s3.publicBaseUrl` 항목이 없음(코드에는
    `s3.config.ts` 에 실제로 존재 — `S3_PUBLIC_BASE_URL` env 신설).
  - 제안: 코드 변경 불필요 — 동일 planner 트랙 plan 문서가 이 세 지점을 정확히 지목했다.

- **[SPEC-DRIFT]** `spec/5-system/3-error-handling.md` 에러 카탈로그가 `FILE_REQUIRED`·`INVALID_FILE_TYPE`
  을 등재하지 않는다.
  - 위치: `spec/5-system/3-error-handling.md` §1.8 (line 202) — knowledge-base 도메인 에러 코드 절.
    `INVALID_FILE_TYPE` 은 `knowledge-base.service.ts:928` 과 이번 PR `users.service.ts` 가 **같은 문자열**을
    공유하는데 §1.8 에 등재되어 있지 않음(사전 존재 갭 — 이 PR 이 새로 만든 것이 아니라 재사용).
  - 상세: `FILE_REQUIRED` 는 이번 PR 이 처음 도입한 코드로, 어느 절에도 없음.
  - 제안: 코드 변경 불필요. plan 문서가 이미 두 코드의 등재를 planner 할 일로 명시했다. `INVALID_FILE_TYPE`
    쪽은 knowledge-base 모듈에도 이미 있던 사전 갭이라는 점을 등재 시 함께 반영하면 좋다(참고용, 이 PR 의
    책임 범위는 아님).

- **[INFO]** 프런트엔드에 이 엔드포인트를 소비하는 코드가 아직 없다(`codebase/frontend/src` 전수 grep —
  `me/avatar`·`uploadAvatar` 0건). spec §2.1 도 현재 UI 를 "인라인 토글, URL 갱신/제거만" 으로 서술 —
  일관됨. 백엔드 우선 배포로 보이며 PR 제목·plan 범위(`§6.1 파일 업로드 엔드포인트`)와도 일치한다. 새 결함
  아님, 프런트 통합이 후속임을 명시적으로 확인하는 차원의 기록.

- **[INFO]** `deletePreviousAvatarObject` 의 키 복원은 `previousUrl.indexOf(marker)` 로 `avatars/{자기
  userId}/` 를 앵커 삼는다. `avatarUrl` 은 `PATCH /users/me` 로 사용자가 임의 외부 URL(`@IsUrl`)을 넣을 수
  있으므로, 이론상 그 문자열 안에 우연히(또는 의도적으로) 자기 자신의 `avatars/{own-id}/...` 부분 문자열을
  심어 존재하지 않거나 의도치 않은 자기 소유 키에 대한 delete 를 유발할 수 있다. 그러나 marker 가 항상
  **호출자 자신의 userId** 로 고정되므로 다른 사용자의 객체를 지울 방법은 없고(S3 `DeleteObject` 는 키
  부재에도 idempotent 하게 204 를 반환), 실질적 피해는 자기 자신의 네임스페이스 내로 한정된다 — 문서가
  스스로 주장하는 "남의 키를 지울 수 없다" 를 검증했고 실제로 성립함을 확인. 조치 불요, 확인 결과로 기록.

## 기능/에러/엣지케이스 점검 요약 (문제 없음 확인)

- **파일 검증 순서**: `!file?.buffer?.length` → 확장자 화이트리스트(`hasOwnProperty` 로 프로토타입 체인
  차단, 실측 26 케이스 중 2 케이스만 실제로 가르는 것까지 스펙에 문서화됨) → 사용자 존재 확인 →
  **그 다음** S3 업로드. 사용자 부재 시 S3 업로드가 발생하지 않는 순서를 코드에서 직접 확인(`users.service.ts`
  113~124행) — 낭비 없는 순서.
- **Content-Type 파생**: 클라이언트 `mimetype` 을 전혀 참조하지 않고 확장자→`AVATAR_CONTENT_TYPES` 로만
  결정 — `jpg → image/jpeg`(표준 MIME, `image/jpg` 아님) 확인.
- **Lost-update 방지**: `userRepository.update(userId, { avatarUrl })` 컬럼 단위 갱신, `save()` 미사용 —
  테스트가 `repo.save` 호출 시 throw 하는 stub 으로 회귀를 고정(`save() 를 쓰면 스냅샷 전체가 실린다`).
- **정리 순서**: DB 저장 성공 후에만 `deletePreviousAvatarObject` 호출 — 저장 실패 테스트(`db down`)에서
  `s3.delete` 미호출 확인.
- **정리 실패 격리**: `decodeURIComponent` 를 포함해 파싱 전체가 `try` 안 — 깨진 퍼센트 인코딩
  URL(`%zz.png`) 에도 업로드/저장은 성공, 고아 객체 1개로 마무리(테스트로 고정, 리뷰 라운드에서 실제로 잡힌
  CRITICAL 의 회귀 방지).
- **PATCH 경로 정리**: `update()` 는 `'avatarUrl' in data` 로 게이팅해 17개 호출부의 SELECT 비용을 피하고,
  "값이 실제로 바뀐 경우"에만 정리 — OAuth 재연동이 같은 값을 다시 넣어도 방금 저장한 객체를 지우지 않음을
  테스트로 확인.
- **NotFound 응답 형식**: `code`+`message` 모두 포함 — 형제 엔드포인트(`getMe`/`updateMe`/`changePassword`)
  와 응답 본문 일치 확인.
- **HTTP 200/413**: `@HttpCode(HttpStatus.OK)` 로 NestJS 기본 201 회피(형제 POST 5개와 동일 패턴,
  `__httpCode__` 메타데이터로 고정) / multer `LIMIT_FILE_SIZE` → `PayloadTooLargeException`(413) 자동
  변환을 NestJS 소스에서 직접 확인 — `@ApiPayloadTooLargeResponse` 문서와 런타임 일치.
- **k8s 배포 선행 조건**: `S3_PUBLIC_BASE_URL` 이 `local`·`staging`·`prod` 세 overlay 전부에 patch 되어
  있음을 확인(`k8s/overlays/` 디렉터리 전수 대조) — CHANGELOG 가 경고하는 "overlay patch 누락" 위험이
  이번 diff 자체에서는 실제로 커버됨.
- **버킷 정책 선행조건**: `docker-compose.yml`/`docker-compose.e2e.yml` 의 `createbuckets` 가
  `avatars-public-read.json`(익명 `s3:GetObject` 만, `ListBucket` 제외)을 `set-json` 으로 적용 — 두
  compose 파일의 `S3_BUCKET`/버킷명(`workflow-storage`)과 정책 ARN 이 일치함을 확인.
- **TODO/FIXME/HACK/XXX**: diff 전체에 0건(grep 확인).

## 의도적으로 유예된 항목 (요구사항 위반 아님, 재확인만)

- 동시 업로드 TOCTOU(고아 객체) — `plan/in-progress/spec-sync-user-profile-gaps.md` W5 로 이미 유예,
  재개 신호(직접 측정 가능한 양)까지 명시. 데이터 정합성 자체는 깨지지 않음(승자 아바타로 수렴).
- `POST /api/users/me/avatar` e2e 부재 — 같은 문서 W9 로 유예, 선행조건(버킷 정책)은 이 PR 이 이미 해소.
- OAuth `resolveUser()` 의 raw QueryBuilder 우회 — 캐너리 테스트(`auth-oauth.service.ts` 의 우선순위 문자열
  고정)로 감지만 하고 있음, 실측대로 오늘은 고아를 만들지 않음(`byEmail.avatarUrl ?? profile.avatarUrl`).

## 요약

`POST /api/users/me/avatar` 구현은 명세된 세 가지 위험 축(키 추측 가능성·Content-Type 스푸핑·교체 시 고아
객체)을 모두 코드와 30건의 회귀 테스트로 고정했고, 실행 결과 75/75 테스트 통과·관련 파일 타입에러 0건을
직접 확인했다. 배포 선행조건(버킷 정책·`S3_PUBLIC_BASE_URL`)은 로컬/e2e/k8s 세 환경 모두에 실제로
반영되어 있다. 유일한 반복 발견사항은 spec 본문 4곳(`9-user-profile.md`·`0-overview.md`·
`4-file-storage.md`·`3-error-handling.md`)이 구현을 아직 반영하지 못한 SPEC-DRIFT 인데, 이는 코드 결함이
아니라 이미 `plan/in-progress/spec-update-avatar-upload-implemented.md` 로 정확한 라인까지 지목되어
planner 트랙에 올바르게 위임된 상태다 — developer 가 `spec/` 쓰기 권한 밖이라는 프로젝트 규약도 정확히
지켰다. 새로 조치가 필요한 CRITICAL 은 없다.

## 위험도

LOW
