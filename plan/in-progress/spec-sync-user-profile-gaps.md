---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
---

# user-profile — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). 본 spec 을 `partial` 로 강등하며 분리한 미구현 항목 추적.
> 관련 spec: spec/2-navigation/9-user-profile.md

## 미구현 항목

> **구현 진척 (2026-06-14, impl-user-profile-gaps PR)**: 테마 System(항목 4) backend 구현. 나머지는 대형 신규
> 기능 또는 frontend: avatar 업로드는 S3 공개 URL 서빙 전략(S3Service getUrl 부재) 설계 선행, 알림 설정은 신규
> entity+migration+모듈, 슬러그 라우팅은 frontend.

- [x] 아바타 이미지 **파일 업로드** 엔드포인트 (§6.1 `POST /api/users/me/avatar`) — **대형(스토리지 서빙)**: S3Service.upload 는 key 만 반환하고 공개 URL 메서드가 없어, 업로드 + 서빙 GET 엔드포인트(key→URL) 전략 설계 선행. 별도 PR.
      **완료 (2026-08-31). 서빙 전략 = 공개 버킷 + 공개 URL (사용자 결정).**
      세 안(공개 URL / 서명 URL / 백엔드 프록시) 중 사용자가 공개 URL 을 골랐다.

      | 측정 (착수 전) | 값 |
      |---|---|
      | `S3Service` 공개 API | `upload`·`download`·`delete`·`deleteMany` — **URL 메서드 없음** |
      | S3 객체를 브라우저로 서빙하는 선례 | **0건** (`download` 유일 소비처는 임베딩 파이프라인) |
      | spec 의 서빙 전략 서술 | **없음** (`9-user-profile.md:334` 는 "미구현 (Planned)" 한 줄) |

      - **구현**: `S3Service.getPublicUrl(key)` 신설 + `POST /api/users/me/avatar`
        (multer 2MB, png/jpg/jpeg/webp/gif). `S3_PUBLIC_BASE_URL` 신규 env —
        `S3_ENDPOINT` 는 백엔드가 SDK 로 쓰는 **내부** 주소라 브라우저가 도달하지 못한다.
      - **⚠ 배포 선행 조건 (코드 밖)**: `avatars/` 접두에 **익명 GET 을 허용하는 버킷 정책**이
        필요하다. 정책이 닫혀 있으면 **업로드는 성공하고 이미지만 403** 이 된다 — 조용히
        깨지지는 않지만 증상이 업로드가 아니라 표시에서 난다. `.env.example` 에 경고를 달았다.
      - **SVG 는 의도적으로 제외**했다 — 스크립트를 품을 수 있는 유일한 이미지 포맷이라
        공개 URL 로 서빙하면 저장형 XSS 표면이 된다.
      - **`Content-Type` 은 확장자에서 파생**한다. 클라이언트 `mimetype` 을 믿고 쓰면
        `text/html` 이 저장돼 같은 오리진에서 실행될 수 있다.
      - **키의 UUID 는 장식이 아니라 접근 통제다** — 공개 버킷에서 키가 곧 권한이라,
        `avatars/{userId}` 만이면 멤버 목록을 아는 사람이 아바타를 열거할 수 있다.

      **회귀 테스트 — 착수 시 3축.** 리뷰 1~5라운드 대응으로 축이 늘었고, 추가된 축은
      각 RESOLUTION 에 있다. **총 건수는 여기 적지 않는다** — 두 번 정정했는데 그때마다
      다음 라운드가 곧바로 stale 하게 만들었다. 필요하면 `jest --silent <file>` 로 센다.
      아래 표는 착수 시점의 6축이다.

      **뮤테이션 6축 (예측 / 실측 — 전부 RED)**:

      | 뮤턴트 | 실측 |
      |---|---|
      | 키에서 uuid 제거 (추측 가능) | **RED** 2 |
      | `Content-Type` 을 클라이언트 값으로 | **RED** 1 |
      | 확장자 화이트리스트 무력화 | **RED** 3 |
      | 옛 객체 정리 호출 제거 | **RED** 2 |
      | 정리를 DB 저장 **앞**으로 (순서 반전) | **RED** 1 |
      | 남의 키 보호 제거 (userId 앵커 → 공통 접두) | **RED** 1 |

      - **테스트 축을 "조용한 실패" 로 골랐다** (사용자 결정: 항목별 판단). 세 위험 모두
        *"동작은 하는데 잘못된 채로 동작"* 이라 테스트가 아니면 안 보인다. 단순 happy-path 는
        그 셋에 자연히 포함되므로 따로 세지 않았다.
      - **순서 축을 따로 둔 이유**: 정리를 저장 앞에 두면 저장 실패 시 사용자에게 **이미
        지워진** 아바타 URL 이 남는다 — 고아 객체보다 나쁘다.
      - **base URL 이 바뀐 뒤에도 옛 키를 복원**하는지 고정했다. base 를 걷어내는 방식이면
        도메인 이전 후 조용히 고아가 쌓인다.

      **부수 — `Express` 네임스페이스 shadowing**: `users.controller.ts` 가
      `import Express from 'express'` 로 **전역 `Express` 를 가리고 있었다.**
      `@types/multer` 가 `Express.Multer.File` 을 그 전역에 augment 하므로 업로드 파라미터의
      타입을 쓸 수 없었다(실측: `Namespace 'e' has no exported member 'Multer'`). 잠재 위험을
      이 변경이 처음 밟아서 `ExpressNS` 로 개명했다(사용처 4곳 동반). 초판은
      `ExpressModule` 이었으나 NestJS `@Module()` 클래스와 표기가 겹쳐 오독 소지가 있다는
      리뷰 지적으로 바꿨다 — 다른 4개 컨트롤러의 `import Express` 는 `Express.Multer` 를
      쓰지 않아 shadowing 이 문제되지 않으므로 **건드리지 않았다**.

      **spec 배지 flip 은 planner 트랙으로 분리** — `9-user-profile.md:334` 의
      ~~`POST /api/users/me/avatar`~~ "미구현 (Planned)" 취소선과 §5.1 구현 상태 문단이
      갱신돼야 한다. developer 는 `spec/` 쓰기 권한 밖이다(자기-반증형 소정정 예외에도
      해당하지 않는다 — 내가 쓴 예고 문장이 아니다). 선례: `spec-sync-websocket-protocol-gaps.md`
      의 `notification.new` 배지 flip 위임.
      → [`spec-update-avatar-upload-implemented.md`](../complete/spec-update-avatar-upload-implemented.md) — **완료 (2026-09-01)**

      **리뷰 2라운드에서 유예한 두 건** (`review/code/2026/08/31/22_44_14`):

      - [ ] **동시 업로드 TOCTOU — 고아 객체** (리뷰 W5). `updateAvatar`·`update` 모두
            정리 대상 키를 **비원자적 사전 SELECT** 로 잡는다. 같은 사용자가 더블클릭이나
            다중 탭으로 동시에 업로드하면 "패자" 요청이 올린 객체를 어느 정리 로직도
            대상으로 잡지 못해 **영구 고아**가 된다.

            **`updateAvatar`(POST) 끼리만이 아니라 `update`(PATCH) 와의 교차 인터리빙도
            같은 클래스다** — 두 진입점 다 정리 대상 키를 비원자적 사전 SELECT 로 잡으므로,
            업로드와 PATCH 가 겹쳐도 패자의 객체가 남는다(리뷰 5라운드 보강).

            지금 안 고치는 이유: 데이터 정합성은 깨지지 않는다 — 사용자가 보는 아바타는
            승자 하나로 수렴하고, **패자는 자기 객체를 고아로 남길 뿐 DB 값을 되돌리지
            못한다.** 남는 것은 과금·용량이고, 막으려면 per-user advisory lock 이 필요한데
            그건 아바타 하나 때문에 치르기엔 큰 값이다. **주기적 orphan-sweep** 이 더 맞는
            도구인데 그건 이 PR 범위가 아니다.

            **⚠ 이 근거는 한 번 반증됐다** (리뷰 7라운드). 위 문장이 성립하려면
            "`avatarUrl` 을 쓰는 모든 경로가 **컬럼 단위**여야" 하는데, 그때
            `incrementLoginAttempts` 가 요청 시작 시점 스냅샷을 `save(user)` 로 되쓰고
            있었다. 아바타 업로드가 URL 을 갱신하고 **옛 S3 객체까지 지운 뒤** 그 저장이
            커밋되면 DB 가 **이미 삭제된 객체를 가리키는 옛 URL** 로 되돌아간다 — 고아보다
            나쁜, 깨진 참조다. 나는 `updateAvatar` 만 컬럼 단위로 바꾸고 **반대편 writer 를
            보지 않은 채** "정합성은 안 깨진다" 고 적었다.

            해당 메서드를 원자 UPDATE 로 고쳤고, 전제를 실측으로 다시 확인했다 — 기존
            `User` 를 스냅샷 전체로 저장하는 곳은 이제 없다:

            | 지점 | 형태 |
            |---|---|
            | `users.service.ts:224` `create()` | 신규 엔티티 (스냅샷 아님) |
            | `auth-oauth.service.ts:391` | QueryBuilder — 값을 **명시**해서 씀 |
            | `auth-oauth.service.ts:408` · `auth.service.ts:166` | 트랜잭션 내 신규 생성 |
            | `auth.service.ts:230` | 컬럼 단위 `update()` |
            | `auth.service.ts:1172,1177` | 읽기 전용 `findOne` |

            **이 표가 이 유예의 전제다.** `User` 에 스냅샷 전체 `save()` 가 새로 생기면 위
            근거는 다시 무너진다.

            재개 신호: `avatars/` 접두의 객체 수가 사용자 수를 유의미하게 웃돌 때.
            (근거가 프록시가 아니라 **직접 측정 가능한 양**이 되도록 이렇게 적는다.)

      - [x] **`POST /api/users/me/avatar` e2e** — **완료 (2026-09-01, 리뷰 5라운드).**
            `codebase/backend/test/users-avatar-upload.e2e-spec.ts` 신설. 유닛이 원리적으로
            닿을 수 없는 것 — **버킷 정책** — 을 실 MinIO 로 못 박는다: 익명 GET **200** ·
            익명 목록 **403** · 교체 시 옛 객체 **404**. 응답의 `avatarUrl` 을 따라가지 않고
            키만 떼어 컨테이너 망 주소로 치는데, base 를 따라가면 환경 설정을 시험하게 되고
            정책은 못 보기 때문이다.

            <details><summary>착수 당시의 유예 기록 (2026-08-31)</summary>

            자매 엔드포인트
            (`change-password`·`email-change`)는 둘 다 e2e-spec 을 갖는다. unit mock 은
            `S3Service` 를 통째로 대체하므로 **실제 MinIO 왕복·413·공개 URL GET 200** 을
            증명하지 못한다 — 특히 공개 URL 200 은 이 기능의 핵심 계약인데 코드가 아니라
            **버킷 정책**이 정하므로 unit 으로는 원리적으로 닿지 않는다.

            **선행 조건은 이 PR 에서 해소했다**: `docker-compose.yml`·`docker-compose.e2e.yml`
            의 `createbuckets` 가 `scripts/minio/avatars-public-read.json` 을
            `mc anonymous set-json` 으로 적용한다. 그전에는 문서가 요구하는 정책이 로컬
            인프라에 **아예 없어서**, 문서를 그대로 따라도 문서가 경고한 403 을 겪었다.

            **리뷰가 제안한 `mc anonymous set download` 는 실측으로 기각했다** — 이름과
            달리 접두에 걸면 `s3:ListBucket` 을 함께 열어 익명 요청이 UUID 를 포함한 전체
            키를 열거할 수 있다. 근거·재현: [`scripts/minio/README.md`](../../scripts/minio/README.md).

            </details>

      - [ ] **multer 413 메시지가 CWE-209 고정 문구 계약을 깬다** (consistency
            `01_51_41` WARNING 5). `error-handling.md §1.3` 은 `PAYLOAD_TOO_LARGE` 의
            메시지를 `"Request payload too large."` 로 고정하는데, multer 의
            `PayloadTooLargeException` 은 `HttpException` 분기를 타서 `mapHttpErrorLike`
            마스킹을 우회하고 라이브러리 원문(`"File too large"`)을 그대로 내보낸다.
            같은 패턴이 `knowledge-base.controller.ts` 에도 있었으나 **이 PR 이 도달
            가능성을 크게 높였다**(아바타는 사용자가 직접 파일을 올리는 첫 경로다).
            `http-exception.filter.ts` 에서 정규화 + `message` 를 명시 단언하는 회귀 테스트.

      - [ ] **`@ApiOperation.description` 길이 강제 초과 2건** (consistency `01_51_41`
            WARNING 4). `swagger.md §3` 이 50~150자를 **강제**하는데 `updateMe` 202자,
            `uploadAvatar` 170자다. 압축하거나, DTO description 에 이미 있는 "보안·정책
            캐비엇 길이 예외" 를 엔드포인트 description 까지 확장하도록 `swagger.md §3` 을
            개정한다(후자는 planner 트랙).

      - [ ] **`uploadAvatar` 컨트롤러의 예외 전파 테스트** (리뷰 9라운드 W5). 형제
            엔드포인트(`getMe`·`changePassword` 등)는 서비스가 던진 예외가 컨트롤러에서
            삼켜지지 않는지를 `rejects.toThrow` 로 확인하는데 이 핸들러만 없다. 위험은 낮다
            (컨트롤러가 `await` 로 그대로 전파하고 e2e 가 400·413 을 실제 응답까지 본다).

            **지금 안 넣는 이유는 게이트 구조다** — `codebase/` 를 고치면 그 수정을 덮는
            리뷰 라운드가 반드시 하나 더 붙는데, 9라운드 Critical 0 · LOW 시점에 이 한 건을
            위해 라운드를 늘리는 것은 값이 맞지 않는다. 다음에 이 컨트롤러를 손댈 때 함께
            넣는다.

      - [ ] **동시 업로드 TOCTOU 유예를 `it.todo` 캐너리로 고정** (리뷰 9라운드 INFO 14).
            이 저장소는 "유예는 캐너리로 고정" 관례를 쓰는데 이 축만 예외다 — 테스트가
            **놓친 것**과 **의도적으로 유예한 것**이 구분되지 않는다. 위 항목과 같은 이유로
            다음 편집 때 함께 넣는다.

      - [ ] **프런트엔드 아바타 업로드 UI + 유저 가이드 동반 갱신** (리뷰 6라운드 INFO).
            `POST /api/users/me/avatar` 는 backend 만 있고 이를 쓰는 화면이 없다. 이 PR 은
            backend 전용이라 "누락" 이 아니라 **아직 미트리거**지만, 추적 항목이 없으면
            엔드포인트만 떠 있는 채로 잊힌다.

            UI 를 붙이는 PR 에서
            `codebase/frontend/src/content/docs/07-workspace-and-team/password-and-sessions.mdx`
            (frontmatter 가 `users.controller.ts` 를 SoT 로 명시)를 **동반 갱신**해야 한다.
            지금은 `PATCH /users/me` 의 URL 입력만 설명한다.

      - [ ] **업로드 바이트의 매직 넘버 검증** (리뷰 1~4라운드가 매번 지목 — INFO 3회 →
            WARNING 1회). 지금은 확장자 화이트리스트 + 서버 강제 `Content-Type` 만 본다.
            저장형 XSS 주 벡터는 그것으로 막히지만(브라우저가 `image/*` 로만 렌더),
            **임의 바이너리를 이미지 확장자로 공개 버킷에 배포하는 것**은 막지 못한다.

            지금 안 하는 이유: 새 의존(`file-type`/`sharp`)이 필요하고, 실제 위험은
            스토리지 낭비·평판이지 인가 우회가 아니다. **재개 신호**: 서버측 이미지 처리
            (썸네일 생성 등)를 도입할 때 — 그때는 파서 익스플로잇 표면이 생기므로 검증이
            방어가 아니라 전제가 된다.

      **리뷰 3라운드의 구조 제안 처분** (`review/code/2026/08/31/23_19_39`):

      - [ ] **아바타 정리 불변식을 쓰기 경로 한 곳으로 모은다** (리뷰 W8·W9). 지금은
            "`avatarUrl` 이 바뀌면 옛 객체를 지운다" 가 `UsersService.update()`(범용, 호출부
            17곳)와 `updateAvatar()` 두 곳에 있고, OAuth `resolveUser()` 는 raw QueryBuilder
            로 아예 우회한다(캐너리로 감지 중). 리포지토리 계층 subscriber 나 도메인 이벤트로
            올리면 모든 쓰기가 같은 지점을 지난다.

            함께 볼 것: `UsersService` 가 프로필 CRUD·비밀번호·로그인 카운터에 더해 S3
            오케스트레이션까지 지고 있어, 무관한 `users.service.spec.ts` 까지 `S3Service`
            mock 을 지게 됐다 → `UserAvatarService` 분리.

            재개 신호: 아바타 외에 S3 를 쓰는 사용자-스코프 리소스가 하나 더 생길 때.
            지금 나누면 소비자가 하나뿐인 추상이 된다.

      **기각 — `avatarUrl` 에 URL 대신 S3 key 를 저장하자** (리뷰 W7). 제안대로는 성립하지
      않는다. 그 컬럼은 **우리가 올린 객체의 URL 만 담는 것이 아니다**:

      - `update-me.dto.ts` 가 `@IsUrl({ require_tld: false })` 로 검증한다 — 계약이 URL 이다.
      - `auth-oauth.service.ts` 가 OAuth 제공자의 사진 URL(`profile.avatarUrl`)을 그대로 넣는다.

      즉 외부 URL 과 자체 업로드가 **같은 컬럼을 공유**하므로 key 로 바꾸려면 판별 컬럼이나
      별도 컬럼이 필요하고, 그건 이 항목의 범위를 넘는 데이터 모델 변경이다. URL→key 역산이
      남는 것은 그 공유의 대가다. 역산 로직을 `S3Service` 로 옮겨 build/parse 를 대칭으로
      두자는 부분(W7 후반·W19)은 위 W8·W9 항목과 함께 볼 일이다.

      **조치하지 않음**: 검증 로직 private 헬퍼 분리(W5)·spec 보일러플레이트 팩토리 통합(W6)
      — 지금 크기에서 읽기가 나빠지지 않는다. 정리를 fire-and-forget 으로(W10) — 응답 지연을
      줄이지만 "저장 뒤 정리" 순서 보장을 테스트로 관측할 수 없게 만든다. 그 순서는 이 기능의
      실제 결함(저장 실패 시 이미 지워진 URL 이 남는 것)을 막는 축이라 지연보다 우선한다.
- [x] 알림 설정 조회/수정 (§6.2 `GET/PATCH /api/notifications/settings`) — **완료 (2026-07-08)**. **재검증: store 는 이미 존재**(`user.notification_preferences` JSONB V010, `integrationExpiryEmail`) — 신규 entity 아님. 구현: 엔드포인트 신설(GET get-or-default·PATCH 부분머지) + prefs shape 확장(`executionFailedEmail`/`scheduleFailedEmail`) + DTO + **caller-side opt-out enforcement**(execution/schedule 실패 dispatch 가 `resolveOptOutEmailChannels` 로 채널 계산 — "channel 계산=호출자 책임" 불변식 보존). 응답=기본값 해소값(FE 오독 방지). spec §6.2 flip·§5.1 캡션/각주·§5.3 갱신. unit(notifications+schedule+execution dispatch)·lint·build.
  - **impl-prep 반영**: enforcement 중앙화(notify 내부)는 8-notifications "호출자 책임" 불변식 위반(CRITICAL) → caller-side 유지. `marketplace_update`(§5.1 인앱 only·opt-in·미발사)·`integration_expired`(기존 opt-in) 는 opt-out 집합 제외.
  - [ ] **(후속) in_app 채널 뮤팅** (§5.1 "채널별" — 인앱 알림 항상 표시, 뮤팅 미구현).

        > **⚠ 구현이 아니라 결정이 먼저다 (2026-08-31 실측 등재).** 착수하려고 §5.1 과 코드를
        > 열었더니 **뮤팅의 계약이 어디에도 정의돼 있지 않다**:
        >
        > - §5.1 표의 "사용자 변경 가능" 열은 **이메일 토글만** 정의한다
        >   (`executionFailedEmail`·`scheduleFailedEmail`·`integrationExpiryEmail`).
        >   in_app 쪽 필드명은 **spec 에도 코드에도 0건**이다.
        > - **어떤 유형이 뮤팅 대상인가**가 표와 충돌한다 — `팀 초대` 행은 변경 가능이
        >   **"X (항상 발송)"** 이고, `마켓플레이스 업데이트` 는 인앱 only 인데 미발사다.
        > - **"뮤팅" 의 의미가 미정**: 알림 row 를 *만들지 않는가* 아니면 *만들되 벨에서
        >   숨기는가*. 후자면 `hasRecentByResource` 24h 중복 방지(§4-integration)와 벨
        >   카운트가 함께 걸린다.
        > - 코드 쪽 계산은 `notifications.service.ts:422` 의
        >   `prefs?.[prefKey] === false ? 'in_app' : 'both'` 2갈래뿐이라, 뮤팅을 넣으려면
        >   **세 번째 상태**(email-only / none)가 필요하다 — 채널 enum 소비처 전수 영향.
        >
        > 넷 다 제품 semantics 라 developer 단독으로 정할 수 없다. planner 턴이 §5.1 에
        > (a) 뮤팅 가능 유형 (b) 필드명 (c) 뮤팅의 의미(미생성 vs 숨김) 를 적어 주면
        > 구현 자체는 작다.
  - [x] **(후속, planner) 4-integration §11.2/§11.3 필드명 동기화** — 옛 `notifyIntegrationExpiryByEmail`→`integrationExpiryEmail` (코드/9-user-profile 는 이미 `integrationExpiryEmail`; 기본값 서술은 이미 정합) + §11.3 stale 클래스명 `NotificationDispatcher` 정정. **완료 (2026-07-17)**: §11.2 채널 서술·§11.3 토글 필드명을 `notification_preferences.integrationExpiryEmail` 로 정정(SoT 링크 병기) + 정정 근거 note 신설. `9-user-profile.md §5.1` 각주의 "planner 후속" 추적 표기도 해소로 갱신.
    **⚠ 클래스명 건은 plan 서술이 부정확했다**: `NotificationDispatcher` 는 "stale(존재하지 않는) 클래스명" 이 아니라 **실존하는 다른 계층의 클래스**다 — `modules/external-interaction/notification-dispatcher.service.ts:22` 의 EIA **webhook 큐**(`NOTIFICATION_WEBHOOK_QUEUE`) enqueuer. 이메일 발송은 `modules/notifications/notifications.service.ts` 의 `dispatchEmails`(`MailService` 주입)가 담당한다. 즉 spec 의 오류는 "죽은 이름 인용" 이 아니라 **이름이 비슷한 별개 컴포넌트 오지목** 이었고, 정정문에 그 구분을 명시했다.
- [ ] 이메일 일일 요약 토글 (§5.3) — 저장소는 존재하나 **집계·발송 job + 전용 토글** 미구현(별도 PR).
- [x] 테마 `System` (OS 자동 추종) 옵션 (§2.0/§2.1) — **backend + frontend 완료**: backend `UpdateMeDto.USER_THEMES`·`UserProfileDto` enum 에 `'system'` 추가(User.theme varchar(10) default 'light' — migration 불요). frontend `ServerTheme` 타입·profile sync guard·`ProfilePreferencesCard` 라벨/토글 옵션·i18n(ko/en `themeSystem`) 추가 — theme-store 는 이미 `prefers-color-scheme` 적용 보유. dto 검증 7건 테스트. (ai-review 가 frontend ripple WARNING 3건을 잡아 동반 구현으로 완결.)
- [x] 워크스페이스 전환 시 슬러그 URL 라우팅 (§3 `/w/[slug]/...`) — **frontend 완료** (`plan/complete/workspace-slug-routing.md`, phase 1): `(main)/w/[slug]` 라우트 구조 신설(26페이지 이동)·slug 해소 layout(reconcile URL 우선)·`(main)/[...rest]` catch-all·`buildWorkspaceHref` 링크 헬퍼·switchWorkspace 네비게이션화. §3 flip·data-flow-12 Rationale·10-auth-flow §7.2·_layout §2.2/§3.1 반영. docs(`/docs`)는 워크스페이스 무관이라 계속 slug 밖(설계). editor(`/workflows/[id]`)는 **phase 2(editor-slug-phase2 plan)에서 slug 편입 완료** — `(editor)/w/[slug]/workflows/[id]`.

## 비고
- §6.1 세션 단건 종료는 spec 의 `DELETE .../:familyId` 가 아니라 실제 `POST .../:familyId/revoke` 로 구현됨 — 이는 의도된 설계(프록시 DELETE 바디 제거 회피)라 spec 본문을 코드에 맞게 정정만 했고 미구현 항목은 아님.
- `profile/alerts` 페이지는 알림 채널 on/off 가 아니라 별개의 알림 규칙(failure_rate/duration/llm_cost 임계치) 관리 화면 — §5 의 미구현과 무관.
- 각 항목의 근거(claim→코드부재)는 audit findings/2-navigation.md 참조.
