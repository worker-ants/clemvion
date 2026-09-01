# 요구사항(Requirement) 코드 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)

## 발견사항

- **[SPEC-DRIFT]** `spec/2-navigation/9-user-profile.md` 가 `POST /api/users/me/avatar` 를 여전히 "미구현 (Planned)" 으로 서술한다. 코드는 완전히 구현돼 있고(`UsersController.uploadAvatar` → `UsersService.updateAvatar` → `S3Service.upload`/`getPublicUrl`), 회귀 테스트 30건(`users-avatar.service.spec.ts`)이 통과한다.
  - 위치: `spec/2-navigation/9-user-profile.md` "아바타 | O | 인라인 토글 | 현재 구현: … **이미지 파일 업로드는 미구현 (Planned)**" 행(§2.1), 및 "`~~POST~~` | `~~/api/users/me/avatar~~` | … **미구현 (Planned)**" 행(§6.1 표)
  - 상세: 코드가 옳고 spec 이 낡은 전형적 케이스다. `codebase/backend/src/modules/users/users.controller.ts` 의 `uploadAvatar` 가 실제로 존재하며 `@ApiOperation`/`@ApiBody`/`@ApiPayloadTooLargeResponse` 등 완전한 Swagger 계약까지 갖췄다.
  - 제안: 코드 유지. 이미 `plan/in-progress/spec-update-avatar-upload-implemented.md` 가 정확한 두 지점(`:136`,`:334`)을 planner 트랙 할 일로 등록해 두었으므로 이 리뷰에서 추가 조치는 불필요 — 해당 plan 항목의 완결만 확인하면 된다.

- **[SPEC-DRIFT]** `spec/0-overview.md` §2.7 스토리지 레이아웃이 아바타 키를 `{workspaceId}/avatars/{userId}.{ext}` 로, 상태를 "계획 (코드 미구현)" 으로 서술하지만, 실제 구현 키는 `avatars/{userId}/{uuid}.{ext}` 다(`workspaceId` 없음, 파일명이 고정 `{userId}.{ext}` 가 아니라 매번 새 UUID).
  - 위치: `spec/0-overview.md` 스토리지 레이아웃 트리의 `avatars/` 항목과 "Form 노드 업로드 / Avatar" 표 행 (grep 결과 각각 대략 269·276행대)
  - 상세: 이 drift 는 단순 서술 차이가 아니라 **버킷 정책 설계를 오도할 수 있는 실질적 위험**이다 — 이 spec 을 SoT 삼아 `{workspaceId}/avatars/` 접두로 익명 GET 정책을 만들면 실제 객체(`avatars/{userId}/...`)는 그 정책 밖이라 업로드는 성공하고 이미지만 403 이 된다. 실측: `scripts/minio/avatars-public-read.json` 의 실제 `Resource` 는 `arn:aws:s3:::workflow-storage/avatars/*` 로, spec 이 아니라 구현 키를 따른다 — 코드/인프라가 서로 일치하고 spec 만 어긋나 있음을 확인했다.
  - 제안: 코드 유지. `plan/in-progress/spec-update-avatar-upload-implemented.md` 가 이 지점을 이미 planner 할 일로 지목했다.

- **[SPEC-DRIFT]** `spec/data-flow/4-file-storage.md` §1.2/§2.1/§2.2 가 아바타를 "spec 정의, 미구현" 으로, 키 패턴을 `<workspaceId>/avatars/<userId>.<ext>` 로, `avatar_url` 컬럼을 "현재는 외부 URL 또는 빈 값" 으로 서술한다. 셋 다 구현과 어긋난다(구현 키는 `avatars/{userId}/{uuid}.{ext}`, 컬럼은 이제 자체 업로드 공개 URL 도 담는다). §2.3 설정 매핑 표에도 신규 `s3.publicBaseUrl` 필드가 없다.
  - 위치: `spec/data-flow/4-file-storage.md:55-59`("1.2 (Spec 상 정의되지만 미구현) Form 첨부 / Avatar"), `:71`(키 패턴 표 `<workspaceId>/avatars/<userId>.<ext>` 행), `:78`(`avatar_url` 서술)
  - 제안: 코드 유지. 동일 plan 문서가 이 세 지점을 지목해 두었다.

- **[SPEC-DRIFT]** `spec/5-system/3-error-handling.md` 에러 카탈로그에 `FILE_REQUIRED`(신규, 파일 누락)와 `INVALID_FILE_TYPE`(knowledge-base 모듈과 코드 재사용 중이나 카탈로그에는 KB 문맥으로만 등재)가 아바타 엔드포인트 발행처로 등재돼 있지 않다.
  - 위치: `codebase/backend/src/modules/users/users.service.ts` `updateAvatar` (`FILE_REQUIRED` / `INVALID_FILE_TYPE` throw 지점) ↔ `spec/5-system/3-error-handling.md` §1 에러 카탈로그
  - 상세: `INVALID_FILE_TYPE` 자체는 `spec/data-flow/4-file-storage.md:52`(KB 문맥)에 이미 있어 코드가 값을 새로 발명한 것은 아니지만, 에러 카탈로그 문서(`3-error-handling.md`)에는 아바타 발행처가 없다. 반대로 413 쪽은 검증했다 — multer `limits.fileSize` 초과는 NestJS `transformException`(`@nestjs/platform-express` 확인)이 `PayloadTooLargeException` 으로 변환하고 `GlobalExceptionFilter` 가 전역 `PAYLOAD_TOO_LARGE`(§1.3)로 매핑한다. 이는 spec Rationale(`3-error-handling.md:595-600`, "일반 신규 코드는 전역 `PAYLOAD_TOO_LARGE` 를 쓰고, 도메인 특화 한도가 있을 때만 별도 코드를 신설한다")와 **일치**하는 설계라 새 코드가 필요하지 않다 — 이 항목은 발견사항 아님.
  - 제안: 코드 유지. `FILE_REQUIRED`/`INVALID_FILE_TYPE` 등재는 `plan/in-progress/spec-update-avatar-upload-implemented.md` §할 일에 이미 planner 몫으로 적혀 있다.

- **[INFO]** `updateAvatar` 의 "파일은 있으나 0바이트" 분기(`file.buffer.length === 0`)를 직접 겨냥하는 테스트가 없다. 현재 `축 2` 의 "빈 파일을 거부한다" 케이스는 `file === undefined` 만 검증하고, `file = { buffer: Buffer.alloc(0), ... }` 형태(멀티파트 파서가 빈 파일을 이렇게 넘길 수 있음)는 별도 케이스가 없다.
  - 위치: `codebase/backend/src/modules/users/users-avatar.service.spec.ts` "축 2 — Content-Type 은 클라이언트 값을 쓰지 않는다" 블록의 "빈 파일을 거부한다" 테스트 (약 145-151행)
  - 상세: `!file?.buffer?.length` 가드 자체는 optional chaining 으로 두 형태(undefined/빈 buffer) 를 이미 코드로 올바르게 처리한다 — 이건 테스트 커버리지 갭이지 코드 결함은 아니다. 직전 리뷰 라운드(2026-08-31 23:46:40, INFO #12)에서도 같은 갭이 지적됐고 이번 diff 까지도 해소되지 않았다.
  - 제안: `it('버퍼가 0바이트인 파일을 거부한다', ...)` 로 `makeFile` 대신 `{ originalname: 'me.png', buffer: Buffer.alloc(0) }` 를 넘기는 케이스 하나 추가. 차단 사유는 아니다.

## 그 외 점검 결과 (문제 없음 — 실측 확인)

- **핵심 비즈니스 규칙 3축 전부 코드·테스트로 고정됨**: (1) 키에 UUID 포함 — 추측 불가능성이 접근 통제(`avatars/{userId}/{uuid}.{ext}`, `randomUUID()`), 연속 업로드 시 키가 매번 다름을 실측하는 테스트 포함. (2) `Content-Type` 은 확장자에서만 파생 — 클라이언트 `mimetype`(`text/html`)을 무시하고 화이트리스트 값을 강제, 5개 확장자 전수(`png/jpg/jpeg/webp/gif`) 값 대조 + 대문자 확장자(`ME.PNG`) 양성 테스트. (3) 교체 시 옛 객체 정리는 **DB 저장 성공 후**에만 — 저장 실패 시 정리를 호출하지 않는 것까지 테스트로 고정.
- **Lost-update 방지**: `updateAvatar` 가 `save(entity)` 대신 `userRepository.update(userId, { avatarUrl })` 컬럼 단위 갱신만 쓴다. UPDATE 페이로드가 정확히 `['avatarUrl']` 키 하나뿐임을 단언하는 전용 테스트가 있어, 업로드 중 다른 요청이 바꾼 컬럼(로그인 실패 카운터·계정 잠금 등)이 되돌아가는 회귀를 잡는다.
- **프로토타입 체인 우회 방지**: `ext` 조회에 `Object.prototype.hasOwnProperty.call(...)` 사용. 실제로 뚫릴 수 있는 두 이름(`constructor`·`__proto__`)과, `.toLowerCase()` 때문에 이미 막히는 나머지 5개 이름 모두를 테스트가 구분해 왜 vacuous 한지까지 주석으로 남겼다 — 근거가 검증 가능하게 기록됨.
- **깨진 percent-encoding 방어**: 옛 `avatarUrl` 에 `%zz` 같은 잘못된 인코딩이 있어도 `decodeURIComponent` 호출이 `try` 안에 있어 업로드/저장이 이미 성공한 뒤 500 이 나는 것을 막는다 — 전용 회귀 테스트로 고정.
- **에러 코드·본문 일관성**: `FILE_REQUIRED`(파일 부재) vs `INVALID_FILE_TYPE`(확장자 불허)가 서로 다른 코드로 분리돼 클라이언트가 분기할 수 있다. `USER_NOT_FOUND` 는 `code`+`message` 를 모두 실어 형제 엔드포인트(`getMe`/`updateMe`/`changePassword`)와 응답 본문이 일치한다.
- **응답 봉투 일관성**: `uploadAvatar` 가 `toProfileData()` 공용 헬퍼를 재사용해 `getMe`/`updateMe` 와 동일한 필드 집합(`locale`/`theme` null→기본값 대체 포함)을 반환하고 `pendingEmail` 은 싣지 않는다 — 컨트롤러 단위 테스트로 확인.
- **`getPublicUrl` 엣지 케이스**: base URL 트레일링 슬래시 제거(이중 슬래시 방지), 키 세그먼트별 인코딩(`/` 가 `%2F` 로 깨지지 않음), `publicBaseUrl` 미설정 시 `endpoint` 로의 2차 폴백까지 전수 테스트.
- **`resolvePublicBaseUrl` SoT 통합**: `s3.config.ts` 의 순수 함수가 `s3Config`·`S3Service`(2차 방어)·`main.ts`(production 부팅 경고) 세 소비처의 공유 SoT 임을 확인했다. 직전 리뷰 라운드가 지적했던 "빈 문자열 폴백 불일치"(`main.ts` 사본이 `''` 를 반환해 경고가 침묵하던 문제)는 `main.ts` 가 이제 손으로 규칙을 다시 적지 않고 `resolvePublicBaseUrl(process.env)` 를 직접 호출하는 것으로 해소됐다. `s3.config.spec.ts`/`s3.service.spec.ts` 양쪽에 빈 문자열(`''`)·둘 다 미설정 케이스가 있어 `||` vs `??` 연산자 차이도 고정돼 있다.
- **413 처리**: 컨트롤러 주석의 "multer 는 스트림 단계에서 끊어 413 을 낸다" 주장을 `@nestjs/platform-express@11.1.27` 소스(`multer.utils.js` `transformException` — `LIMIT_FILE_SIZE` → `PayloadTooLargeException`)로 직접 확인했다. 근거 없는 주석이 아니다.
- **배포 인프라 정합성**: `docker-compose.yml`/`docker-compose.e2e.yml` 의 `mc anonymous set-json` 대상 정책 파일(`scripts/minio/avatars-public-read.json`)이 실제로 `avatars/*` 에 `s3:GetObject` 만 허용(목록 조회 없음)함을 직접 열어 확인했다. `k8s/base|overlays/{local,prod,staging}` 전부 `S3_PUBLIC_BASE_URL` 을 일관되게 설정(로컬은 `localhost`, prod/staging 은 `REPLACE_ME.cloudfront.net` placeholder) — 3-overlay 배포 선행조건 누락이 없다.
- **직전 리뷰 라운드(2026-08-31 23:46:40) WARNING 9건 재확인**: `Promise.all` 병렬화(#6), Content-Type 매핑값 전수 테스트(#7), 대문자 확장자 양성 테스트(#8), CHANGELOG 의 production 부팅 가드 문서화(#9), `main.ts` SoT 통합(#5 일부) — 전부 현재 코드에 반영돼 있음을 실측 확인했다. 나머지(#1~#3 side_effect/동시성 계열, #4 매직바이트 미검증)는 `plan/in-progress/spec-sync-user-profile-gaps.md` 에 재개 신호와 함께 명시적으로 유예돼 있고, 정합성(사용자가 보는 최종 `avatarUrl`)을 깨뜨리지 않는다는 근거가 함께 기록돼 있어 이번 라운드에서 새로 지적할 사항이 아니다.

## 요약

핵심 비즈니스 규칙(키의 UUID=접근 통제, Content-Type 서버 강제, 정리 순서=저장 후) 세 축과 lost-update 방지, 에러 코드 분기, 응답 봉투 일관성이 모두 코드와 뮤테이션 실측 테스트(30건)로 정확히 고정돼 있고, 이전 8라운드 리뷰의 WARNING 항목 대부분(폴백 SoT 통합·병렬화·테스트 커버리지·CHANGELOG)이 이번 diff 시점에 실제로 반영됨을 직접 확인했다. 남은 결함은 없고, spec 4개 문서(`9-user-profile.md`·`0-overview.md`·`4-file-storage.md`·`3-error-handling.md`)의 stale 서술은 코드가 아니라 spec 이 낡은 SPEC-DRIFT 이며, 이미 `plan/in-progress/spec-update-avatar-upload-implemented.md` 로 정확한 라인까지 planner 트랙에 위임돼 있어 이번 코드 변경을 막을 사유가 아니다. 유일한 미세 갭은 "빈 buffer 파일" 양성 테스트 부재(INFO, 코드는 이미 올바르게 처리)뿐이다.

## 위험도

LOW
