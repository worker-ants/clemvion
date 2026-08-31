# 보안(Security) 코드 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)

## 컨텍스트

이 브랜치는 이미 7라운드의 리뷰-수정 사이클을 거쳤다(`review/code/2026/08/31/*`, `review/code/2026/09/01/00_*`). 직전 라운드(7R, `f24584a35`)는 CRITICAL 하나(`incrementLoginAttempts` 의 read-modify-write `save(user)` 가 아바타 교체의 컬럼단위 `update()` 를 반대 방향에서 무효화 — 이미 삭제된 S3 객체를 가리키는 URL 로 DB 가 되돌아갈 수 있었음)를 원자적 `UPDATE ... RETURNING` 으로 고치고 전용 테스트(`users-login-attempts.service.spec.ts`)로 고정했다. 본 라운드는 그 수정이 실제로 반영된 현재 소스(`Read` 로 직접 확인)를 기준으로 재검토한다.

## 발견사항

- **[INFO]** (검증 확인, 결함 아님) 7라운드 CRITICAL 수정이 현재 소스에 반영·테스트로 고정돼 있다.
  - 위치: `codebase/backend/src/modules/users/users.service.ts` `incrementLoginAttempts`(원자 `UPDATE ... SET login_attempts = ..., locked_until = CASE ... RETURNING login_attempts`, 파라미터 `$1/$2/$3` 바인딩) / `updateAvatar`(`userRepository.update(userId, { avatarUrl })` 컬럼 단위)
  - 상세: 두 writer 모두 이제 컬럼 단위로만 쓴다. Raw SQL 은 문자열 결합이 아니라 `$1`/`$2`/`$3` 파라미터 바인딩이라 SQL 인젝션 벡터가 없다. `users-login-attempts.service.spec.ts` 가 SET 절 컬럼 집합을 정확히 `{login_attempts, locked_until}` 로 대조해 `avatar_url` 이 섞이지 않음을 고정하고, `plan/in-progress/spec-sync-user-profile-gaps.md` 의 TOCTOU 유예 노트도 반증 이력과 함께 갱신돼 있다. 새 결함 없음 — 참고로만 남긴다.

- **[INFO]** (검증 확인, 결함 아님) 공개 버킷의 유일한 접근 통제(키 UUID)가 코드·인프라·e2e 세 층 모두에서 뒷받침된다.
  - 위치: `codebase/backend/src/modules/users/users.service.ts:130`(`randomUUID()` 기반 키), `scripts/minio/avatars-public-read.json`(`s3:GetObject` 만 허용, `ListBucket` 없음), `codebase/backend/test/users-avatar-upload.e2e-spec.ts`(익명 GET 200 · 익명 목록 403 · 교체 후 옛 키 404를 실 MinIO 로 검증)
  - 상세: `mc anonymous set download` 가 의도치 않게 `ListBucket` 을 함께 여는 것을 실측으로 기각하고 명시적 정책으로 교체한 이력(`scripts/minio/README.md`)이 근거와 함께 남아 있다. `avatarUrl` → S3 key 복원(`deletePreviousAvatarObject`)도 `avatars/{자신의 userId}/` 접두로만 앵커링해 IDOR(타 사용자 객체 삭제)로 이어지지 않음을 직접 추적 확인했다.

- **[INFO]** (검증 확인, 결함 아님) 인증/인가 경계가 정확하다.
  - 위치: `codebase/backend/src/modules/users/users.controller.ts:65`(`@UseGuards(JwtAuthGuard)` 컨트롤러 레벨) / `:194-199`(`uploadAvatar` — `payload.sub`(JWT subject)를 그대로 `updateAvatar(userId, file)` 에 전달, 클라이언트가 대상 사용자를 지정할 수 있는 필드 없음)
  - 상세: 본인 리소스만 갱신 가능. 응답 봉투(`toProfileData`)도 `passwordHash`·`twoFactorSecret` 등 민감 컬럼을 노출하지 않고 명시 화이트리스트(id/email/name/avatarUrl/locale/theme) 만 내보낸다.

- **[INFO]** (검증 확인, 결함 아님) `Content-Type` 저장형 XSS 방어가 프로토타입 오염 우회 없이 동작한다.
  - 위치: `codebase/backend/src/modules/users/users.service.ts:100-118`
  - 상세: 클라이언트가 보낸 `mimetype` 을 신뢰하지 않고 확장자 화이트리스트에서 파생한 값만 `PutObjectCommand.ContentType` 으로 쓴다. `ext` 는 사용자 파일명에서 나오므로 `constructor`/`__proto__` 같은 이름이 일반 인덱싱에서 truthy 를 돌려줄 수 있는데, `Object.prototype.hasOwnProperty.call(...)` 로 소유 프로퍼티만 인정해 그 우회를 막는다. SVG(유일하게 스크립트를 품을 수 있는 이미지 포맷)는 화이트리스트에서 의도적으로 제외돼 있다.

- **[INFO]** (이미 plan 에 유예로 등재 — 새 결함 아님) 업로드 바이트의 매직 넘버(파일 시그니처) 검증 없음.
  - 위치: `codebase/backend/src/modules/users/users.service.ts` `updateAvatar` (확장자만 검사, 바이트 내용 미검사)
  - 상세: 확장자 화이트리스트 + 서버측 강제 `Content-Type` 으로 저장형 XSS 주 벡터(HTML 실행)는 막히지만, "유효 이미지 헤더 뒤에 임의 페이로드를 붙인 폴리글랏 파일을 공개 버킷에 이미지로 배포"하는 경로는 남는다. `plan/in-progress/spec-sync-user-profile-gaps.md` 가 이를 1~4라운드에 걸쳐 반복 지목된 항목으로 재개 신호(서버측 이미지 처리 도입 시)와 함께 명시 등재하고 있다 — 조치 누락이 아니라 측정된 유예다. 재확인만 하고 별도 조치는 요구하지 않는다.

- **[INFO]** (이미 plan 에 유예로 등재 — 새 결함 아님) 동시 업로드/PATCH 인터리빙 시 "패자"의 새 S3 객체가 영구 고아로 남을 수 있는 TOCTOU.
  - 위치: `codebase/backend/src/modules/users/users.service.ts` `updateAvatar`/`update` (정리 대상 키를 비원자적 사전 SELECT 로 캡처)
  - 상세: 7라운드에서 "정합성은 안 깨진다"는 유예 근거 자체가 반증됐던 자리이지만, 그 반증은 **DB 상태가 옛 URL로 되돌아가는 것**(위 CRITICAL)이었고 이는 이번 라운드에 고쳐졌다. 남은 잔여는 "패자 객체가 지워지지 않고 고아로 남는다"(과금·용량 문제, 정합성 훼손 아님)로, plan 이 이 구분을 명시하고 측정 가능한 재개 신호(`avatars/` 접두 객체 수가 사용자 수를 유의미하게 웃돌 때)를 달아 두었다. 인가/데이터 노출 문제는 아니므로 보안 관점에서는 정보성으로만 남긴다.

- **[INFO]** 아바타 업로드 전용 rate-limit 이 없다 — 전역 기본값(사용자당 100회/분)에만 의존.
  - 위치: `codebase/backend/src/modules/users/users.controller.ts` `uploadAvatar` (`@Throttle` 데코레이터 없음, 같은 파일의 `email-change/*` 는 `@Throttle({ default: { ttl: 60_000, limit: 5 } })` 를 명시)
  - 상세: 최대 2MB 파일을 분당 100회까지 올릴 수 있어(이론상 ~200MB/분/사용자) S3 PUT/DELETE 대역폭·스토리지 남용 완화 여지가 다른 엔드포인트보다 낮다. 전역 가드가 무제한을 이미 막고 있고 상한이 작아 실질 위험은 낮다 — 정보성으로만 남긴다.

## 그 외 점검 결과 (문제 없음)

- **하드코딩된 시크릿**: `docker-compose*.yml`/`.env.example`/`s3.config.ts` 의 `minioadmin`·`clemvion-e2e` 류는 이 PR 이전부터 존재하던 로컬/e2e 전용 기본값이며 신규 도입이 아니다. 운영 시크릿은 `k8s` Secret 참조로 남아 있다.
- **SSRF**: `S3_PUBLIC_BASE_URL`/`S3_ENDPOINT` 는 운영자가 배포 시 정하는 env 이지 사용자 입력이 아니다. production 에서 사설/loopback 주소로 판정되면 `main.ts` 가 `isPrivateHost`(정본 SSRF 유틸) 로 경고를 낸다 — `throw` 가 아니라 `warn` 인 이유(단일 호스트 self-host 정당 사용례)도 기존 `ALLOW_PRIVATE_HOST_TARGETS` 패턴과 일관되게 문서화돼 있다.
- **경로 탐색**: S3/MinIO 오브젝트 키는 파일시스템 경로가 아니라 flat 네임스페이스이므로 `deletePreviousAvatarObject` 의 `avatars/{userId}/` 앵커 복원 방식에 `../` 류 탈출 벡터가 성립하지 않는다.
- **암호화**: 새 알고리즘 도입 없음. 키 생성은 `node:crypto` `randomUUID()`(CSPRNG 기반 v4).
- **에러 처리**: `updateAvatar` 의 예외(`FILE_REQUIRED`/`INVALID_FILE_TYPE`/`USER_NOT_FOUND`)는 일반적인 코드/메시지만 반환하고 스택트레이스나 내부 경로를 노출하지 않는다.
- **의존성**: 이번 diff 는 `package.json`/lockfile 을 건드리지 않는다 — 전부 기존 의존성(`@aws-sdk/client-s3`, `@nestjs/platform-express`, `@nestjs/swagger`, `@types/multer`) 재사용.

## 요약

7라운드에 걸친 반복 리뷰-수정으로 발견된 심각한 결함(로그인 잠금 카운터 경쟁이 아바타 정리 순서를 반대 방향에서 무효화하던 CRITICAL, 부팅 경고 폴백 규칙의 기본값 케이스 누락, 화이트리스트 커버리지 갭 등)은 모두 현재 소스에 반영·테스트로 고정된 상태를 `Read` 로 직접 확인했다. 이번 라운드에서 새로 발견된 Critical/Warning 급 보안 결함은 없다 — 인증/인가 경계(JWT subject 기반 self-scope), 공개 버킷의 유일한 접근 통제(추측 불가능 UUID + `GetObject`-only 정책, e2e 로 실측 검증), 저장형 XSS 방어(확장자 화이트리스트 + 서버 강제 Content-Type + 프로토타입 오염 가드), SQL 인젝션 부재(전 구간 파라미터 바인딩) 모두 코드·테스트 양쪽에서 확인된다. 남은 항목(매직 넘버 미검증, TOCTOU 고아 객체, 전용 rate-limit 부재)은 전부 `plan/in-progress/spec-sync-user-profile-gaps.md` 에 측정 가능한 재개 신호와 함께 이미 유예로 등재돼 있어 조치 누락이 아니라 의도된 스코프 경계다.

## 위험도

LOW
