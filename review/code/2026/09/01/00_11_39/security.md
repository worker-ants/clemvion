# 보안(Security) 코드 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)

## 총평

이 변경은 이미 4라운드 리뷰·fix 사이클(`review/code/2026/08/31/{22_12_54,22_44_14,23_19_39,23_46_40}`)을
거쳤고, 이번 세션에서 직접 현재 소스(`codebase/backend/src/modules/users/users.service.ts`,
`users.controller.ts`, `codebase/backend/src/common/services/s3.service.ts`,
`codebase/backend/src/common/config/s3.config.ts`, `main.ts`)를 다시 읽어 독립적으로 재검증했다.
"공개 버킷 + 공개 URL" 이라는 설계 자체가 접근 통제를 키의 추측 불가능성에 의존하게 만드는데,
그 트레이드오프를 코드·인프라·테스트 세 층위에서 일관되게 좁혀 놓았고 Critical 로 볼 결함은
찾지 못했다.

### 확인한 방어 (문제 없음)

- **인증/인가**: `UsersController` 클래스 레벨 `@UseGuards(JwtAuthGuard)`(`users.controller.ts:62`)로
  전 엔드포인트가 보호되고, `uploadAvatar`(`users.controller.ts:191-197`)는 대상 사용자를
  `@CurrentUser()` 로 얻은 JWT `payload.sub` 로만 정한다 — 요청 바디/경로에 user id 를 받지
  않으므로 IDOR 여지가 없다.
- **Content-Type 스푸핑/저장형 XSS**: `updateAvatar`(`users.service.ts:79-149`)는 클라이언트가
  보내는 `file.mimetype` 을 전혀 쓰지 않고, 파일명 확장자에서 서버가 `Content-Type` 을
  강제 파생한다(`users.service.ts:97-111`, `AVATAR_CONTENT_TYPES` `users.service.ts:43-49`).
  SVG 는 화이트리스트에서 의도적으로 제외돼 있다(스크립트를 품을 수 있는 유일한 이미지
  포맷). 공개 URL 로 서빙되는 오브젝트가 `text/html` 로 해석될 경로를 원천 차단한다.
- **프로토타입 오염을 통한 화이트리스트 우회**: 확장자 조회를
  `Object.prototype.hasOwnProperty.call(...)` 로 감싸(`users.service.ts:100-103`)
  `constructor`/`__proto__` 같은 상속 프로퍼티 이름이 일반 인덱싱에서 truthy 를 반환해
  화이트리스트를 통과하는 경로를 막는다.
- **공개 버킷 키 열거**: 오브젝트 키가 `avatars/{userId}/{randomUUID()}.{ext}`
  (`users.service.ts:123`)라 워크스페이스 멤버 목록을 아는 공격자가 예측으로 아바타를
  열거할 수 없다. 버킷 정책(`scripts/minio/avatars-public-read.json`)도 `s3:GetObject` 만
  `avatars/*` 접두에 허용하고 `s3:ListBucket` 은 포함하지 않는다 — `mc anonymous set download`
  가 접두 지정 시 `ListBucket` 을 암묵적으로 함께 여는 것을 실측으로 발견·기각한 근거가
  `scripts/minio/README.md` 에 재현 명령과 함께 남아 있다. 명시 정책 리소스도
  `workflow-storage/avatars/*` 로 스코프가 좁혀져 같은 버킷의 다른 prefix(워크플로 파일 등)는
  영향을 받지 않는다.
- **동시성 lost-update**: `updateAvatar` 는 S3 업로드(느린 I/O) 뒤 전체 엔티티 `save()` 가
  아니라 `userRepository.update(userId, { avatarUrl })` 로 **`avatarUrl` 컬럼만** 갱신한다
  (`users.service.ts:136-137`, 주석에 lost-update 근거 명시). 로그인 실패 카운터·계정 잠금
  등 다른 요청이 그 사이 바꾼 컬럼을 되돌리는 경쟁이 성립하지 않는다 — 4라운드 전 이 부분은
  `save(user)` 전체 저장이었고 이전 라운드 concurrency 리뷰가 CRITICAL 로 잡았던 지점인데,
  현재 코드는 이미 targeted update 로 정정돼 있다.
- **옛 아바타 삭제의 경로 이탈/타인 객체 삭제**: `deletePreviousAvatarObject`(`users.service.ts:169-196`)
  는 삭제 대상 키를 `avatars/{userId}/` 마커(호출자가 넘긴, JWT 로 인증된 자기 자신의 id)로만
  앵커링한다. `PATCH /users/me` 로 사용자가 `avatarUrl` 에 임의 문자열을 넣어도, 그 마커가
  발견되지 않으면 삭제를 시도조차 하지 않고(`users.service.ts:174-177`), 발견돼도 복원되는
  키는 항상 자기 자신의 접두 아래로 국한된다. S3 오브젝트 키는 파일시스템과 달리 `..` 세그먼트를
  정규화하지 않는 flat namespace 라, 문자열 조작으로 상위 경로를 벗어나는 것도 원천적으로
  불가능하다(리터럴 키 불일치로 no-op).
- **에러 응답의 정보 노출**: `s3Service.upload` 등에서 예외가 나면 `GlobalExceptionFilter`
  (`codebase/backend/src/common/filters/http-exception.filter.ts`, 이번 diff 밖의 기존 코드)가
  매핑되지 않은 내부 `Error` 를 `logger.error` 로만 남기고 클라이언트에는 고정 문구
  (`UNHANDLED_ERROR_MESSAGE`)만 반환한다 — S3 엔드포인트·버킷명·SDK 예외 메시지가 클라이언트로
  echo 되지 않는다.
- **자격증명 관리**: `S3_ACCESS_KEY`/`S3_SECRET_KEY` 는 K8s Secret, 새로 추가된
  `S3_PUBLIC_BASE_URL`(비밀 아님)은 ConfigMap 으로 정확히 분리돼 있다
  (`k8s/base/configmap.yaml`, `k8s/overlays/{prod,staging}/kustomization.yaml`). 하드코딩된
  실제 시크릿은 발견되지 않았다 — `.env.example`/`docker-compose*.yml` 의 `minioadmin` 류는
  로컬 개발용 플레이스홀더다.

### 발견사항

- **[WARNING]** 업로드된 파일의 실제 바이트가 유효한 이미지인지 검증하지 않는다(매직바이트/디코딩
  검증 부재) — 확장자 화이트리스트 + 서버 강제 `Content-Type` 조합이 stored-XSS 의 주 벡터
  (악성 콘텐츠가 `text/html` 로 해석되는 경로)는 막지만, "임의 바이너리에 `.png` 확장자만 붙여
  공개 버킷에 올리는 것" 자체는 막지 않는다. `Content-Type: image/png` 로 응답되는 한 브라우저가
  그 바이트를 스크립트로 실행하지는 않으므로 XSS 위험은 낮지만, 공개 URL 이 임의 콘텐츠 배포
  용도로 오·남용될 여지(스토리지 낭비·평판 리스크)는 남는다.
  - 위치: `codebase/backend/src/modules/users/users.service.ts` — `updateAvatar()` 의 확장자
    판정 블록(97번 줄 `const ext = file.originalname.split('.')...` 부터 106~111번 줄
    `if (!contentType) { throw ... }` 까지).
  - 상세: 이 갭은 1~4라운드 리뷰가 반복 지목했고, `review/code/2026/08/31/23_46_40/RESOLUTION.md`
    가 "서버측 이미지 처리(썸네일 생성 등) 도입 시 재개" 라는 명시적 신호와 함께 의도적으로
    유예했다 — 새로 발견된 결함이 아니라 이미 알려진 채 의식적으로 남긴 잔여 표면이다.
  - 제안: 현재 유예 판단을 뒤집을 근거는 없다. `sharp`/`file-type` 등으로 매직바이트를 검증하는
    방어를 추가하면 이 표면을 닫을 수 있으나, 지금 상태로도 XSS 자체는 막혀 있어 우선순위는 낮다.

- **[WARNING]** 동시 아바타 업로드의 TOCTOU 로 "패자" 요청이 올린 S3 오브젝트가 정리되지 않고
  영구 고아로 남을 수 있다 — 데이터 무결성이나 타 사용자 노출 문제는 아니지만, 인증된 단일
  사용자가 짧은 시간에 반복 업로드해 스토리지 비용을 의도적으로 늘릴 수 있는 남용 벡터다.
  전역 `UserThrottlerGuard`(사용자당 분당 100회, 아바타 개별 `@Throttle` 없음) × 최대 2MB 를
  곱하면 이론상 분당 최대 ~200MB 상당의 고아 객체를 한 사용자가 쌓을 수 있다.
  - 위치: `codebase/backend/src/modules/users/users.service.ts` — `updateAvatar()` 전체
    (79~149번 줄)와 `deletePreviousAvatarObject()`(169~196번 줄); 관련 유예 기록은
    `plan/in-progress/spec-sync-user-profile-gaps.md`.
  - 상세: 이미 인지되고 재개 신호(오브젝트 수가 사용자 수를 유의미하게 초과)까지 등재된
    유예 항목이다. 다만 그 신호가 자동 알람이 아니라 수동 관측이라는 점은 잔여 갭으로 남는다.
  - 제안: 이번 PR 을 막을 사유는 아니다. 재개 신호를 정기 배치(예: `avatars/` 오브젝트 수 대
    사용자 수 비율 집계)로 자동화하면 "수동 관측 의존" 갭이 닫힌다.

- **[INFO]** 공개 아바타 오브젝트 응답에 `X-Content-Type-Options: nosniff` 가 설정되지 않는다.
  주 방어(서버가 확장자로 `Content-Type` 을 강제)가 견고해 실질 위험은 낮지만(현대 브라우저는
  명시적 `image/*` Content-Type 을 `text/html` 로 스니핑해 실행하지 않는다), 레거시 경로에
  대한 방어 심화로 이 헤더를 `PutObjectCommand` 에 실어 두는 것을 고려할 만하다.
  - 위치: `codebase/backend/src/common/services/s3.service.ts` — `upload()` 메서드(53~67번
    줄, 이번 PR 이 새로 만든 코드는 아니고 기존 `upload()` 를 그대로 재사용).

- **[INFO]** `S3Service` 생성자의 `publicBaseUrl` 폴백(`?? endpoint`, `s3.service.ts:40-41`)이
  주석상 "SoT 는 `s3.config.ts`" 라고 단언하면서도 자체적으로 다시 폴백한다. 정상 부팅 경로
  (`s3Config` 가 로드된 경로)에서는 `s3.config.ts` 의 `resolvePublicBaseUrl` 이 이미 항상
  truthy 문자열을 채우므로 이 분기는 도달 불가능하고, 보안적으로 악용 가능한 경로는 아니다
  (설정 미로드 조립에서 URL 에 `"undefined"` 문자열이 박히는 것을 막는 2차 방어로 의도된
  것으로 문서화돼 있다). 다음 유지보수자가 "폴백은 config 한 곳" 이라는 주석만 믿고
  `s3.config.ts` 만 고치면 이 2차 분기의 존재를 놓칠 수 있다는 점은 문서-코드 정합성
  관점의 참고 사항.

- **[INFO]** `S3_PUBLIC_BASE_URL` 미설정 시 프로덕션에서도 `http://localhost:9000` 까지
  폴백되는 경로가 열려 있다. `main.ts`(160~172번 줄)가 production 에서 `resolvePublicBaseUrl`
  + `isPrivateHost` 로 검사해 `warn` 을 남기지만 `throw` 는 하지 않는다(기존
  `ALLOW_PRIVATE_HOST_TARGETS` 패턴과 의도적으로 동일한 설계, 단일 호스트 self-host 배포를
  허용하기 위함). 이는 정보 노출·인가 우회가 아니라 가용성(이미지가 403/미도달) 문제이고,
  CHANGELOG·k8s overlay 주석·`.env.example` 세 곳에서 반복 경고돼 발견 가능성은 낮지 않다.

## 요약

핵심 보안 위험 요소 — 공개 버킷에서의 키 열거, 클라이언트 제어 mimetype 을 통한 저장형 XSS,
프로토타입 오염을 통한 확장자 화이트리스트 우회, MinIO `anonymous set download` 가 숨겨서 여는
`ListBucket`, S3 업로드 지연 중 다른 요청의 컬럼 변경을 되돌리는 lost-update, 옛 아바타 정리의
경로 이탈/타인 객체 삭제 — 를 모두 코드·인프라·테스트 세 층위에서 실측 기반으로 막아 두었고,
직접 재검증한 현재 소스(4라운드 fix 반영 후)에서도 이 방어들이 그대로 유지되고 있음을 확인했다.
인증(`JwtAuthGuard` + JWT `sub` 기반 self-scoping), K8s 상 비밀/비-비밀 값의 분리, 에러 응답의
내부 정보 마스킹도 문제없다. 남는 항목은 전부 Critical 이 아니라 이미 인지되고 의식적으로
유예된 방어 심화(매직바이트 검증·nosniff 헤더) 또는 스토리지 비용 관점의 저강도 남용 벡터이며,
즉시 차단할 사유는 없다.

## 위험도

LOW
