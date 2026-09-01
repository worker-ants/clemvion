# 보안(Security) 코드 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)

## 컨텍스트

이 diff 는 `POST /api/users/me/avatar` 신설(공개 버킷 + 공개 URL 서빙) 기능의 최종 상태이며,
동일 기능에 대해 이미 6라운드의 내부 리뷰·수정 이력(`git log` 커밋 메시지 "리뷰 2R~6R")과
직전 라운드(`review/code/2026/09/01/00_35_24/security.md`, 위험도 LOW)가 존재한다. 이번
라운드는 실제 소스(`users.controller.ts`, `users.service.ts`, `s3.service.ts`, `s3.config.ts`,
`main.ts`, `scripts/minio/avatars-public-read.json`, e2e/unit 테스트)를 직접 열어 그 결론을
독립적으로 재검증했다.

## 발견사항

- **[INFO]** `POST /api/users/me/avatar` 에 전용 throttle 이 없다
  - 위치: `codebase/backend/src/modules/users/users.controller.ts` — `uploadAvatar` 메서드(`@Post('me/avatar')` 데코레이터 부근, `changePassword`/`requestEmailChange` 와 달리 `@Throttle` 미부착)
  - 상세: 전역 기본 throttle(사용자당 100req/60s)은 여전히 적용되지만, 이 엔드포인트는 요청마다 파일 전체를 메모리 버퍼로 적재하고 S3 `PutObject` + best-effort `DeleteObject` 를 유발해 컨트롤러 내 다른 GET/PATCH보다 자원 비용이 크다. `changePassword`·`requestEmailChange` 는 분당 5회로 더 좁게 제한하는데 비슷한 비용의 이 엔드포인트만 전역 한도에 맡긴다.
  - 제안: 즉시 악용 가능한 취약점은 아니다(파일 크기 상한 2MB + 전역 throttle 존재). 방어 심화 차원에서 별도 하한 throttle을 고려할 수 있으나, 직전 라운드에서 이미 같은 결론(INFO, 조치 불요)으로 유예됐다.

- **[INFO]** 업로드 파일의 실제 바이트(매직 넘버)를 검증하지 않고 파일명 확장자만으로 화이트리스트 판정한다
  - 위치: `codebase/backend/src/modules/users/users.service.ts` — `updateAvatar` 의 `ext`/`contentType` 판정 블록, `AVATAR_CONTENT_TYPES` 상수
  - 상세: 임의 바이트 파일에 `.png` 확장자만 붙이면 확장자 검사는 통과한다. 다만 `Content-Type` 은 그 확장자에서 서버가 강제로 파생시켜 저장하므로(클라이언트 `mimetype` 은 신뢰하지 않음), 브라우저는 명시된 `image/*` Content-Type을 존중해 HTML/JS로 실행하지 않는다 — 핵심 위협(저장형 XSS)은 이미 차단돼 있다. 매직 넘버 검증까지 추가하면 "이미지가 아닌 바이트가 image/*로 공개 서빙"되는 경계 케이스(이미지 파서 취약점 트리거, 악성 파일의 위장 호스팅)를 한 겹 더 막을 수 있다.
  - 제안: 현재 위협 모델에는 충분하다. 향후 이미지 처리(썸네일 등) 파이프라인을 추가하기 전에는 매직 넘버 검증 도입을 권고 — 이미 `plan/in-progress/spec-sync-user-profile-gaps.md`(직전 라운드 RESOLUTION 확인)에 유예 항목으로 등재돼 있다.

## 그 외 점검 결과 (문제 없음 — 직접 확인)

- **인증/인가(IDOR)**: `@UseGuards(JwtAuthGuard)` 가 컨트롤러 레벨에 있어 `uploadAvatar` 도 인증을 요구하며, 대상 사용자 ID 는 요청 바디/파라미터가 아니라 `@CurrentUser()` 로 얻은 JWT `payload.sub` 뿐이다 — 다른 사용자의 아바타를 대신 업로드/조회하는 경로가 없다. `users.controller.spec.ts` 의 신규 테스트(`uploadAvatar (§6.1)`)가 `updateAvatar('user-uuid', file)` 호출 인자를 고정해 회귀를 잡는다.
- **저장형 XSS / Content-Type 스푸핑**: `users.service.ts` `updateAvatar` 가 `Object.prototype.hasOwnProperty.call(AVATAR_CONTENT_TYPES, ext)` 로 화이트리스트 own-property 여부를 확인한 뒤 서버측 `contentType` 을 강제 지정해 `s3Service.upload(key, file.buffer, contentType)` 한다. 클라이언트가 보내는 `file.mimetype` 은 전혀 참조하지 않는다. SVG(`image/svg+xml`) 는 `AVATAR_CONTENT_TYPES` 에서 의도적으로 제외돼 있고, e2e 테스트(`users-avatar-upload.e2e-spec.ts`)가 `.svg` 확장자 400/`INVALID_FILE_TYPE` 을 회귀 가드로 고정한다.
- **프로토타입 오염 우회**: `ext` 는 사용자가 보낸 파일명에서 파생되므로 `constructor`/`__proto__` 같은 `Object.prototype` 상속 키가 일반 인덱싱에서 truthy 를 반환할 수 있는데, `hasOwnProperty` 가드가 이를 차단한다. `users-avatar.service.spec.ts` (`확장자 화이트리스트는 프로토타입 체인을 타지 않는다`)가 `constructor`·`__proto__` 를 포함한 7개 케이스를 `it.each` 로 개별 검증한다.
- **경로/키 조작 (오브젝트 삭제)**: 신규 오브젝트 키는 `avatars/{userId}/{randomUUID()}.{ext}` 로 서버가 전적으로 구성한다(`UsersService.avatarKeyPrefix` + `randomUUID()`). 교체 시 옛 객체를 지우는 `deletePreviousAvatarObject` 는 DB 에 저장된 `previousUrl` 문자열에서 **호출자 자신의 userId 로 만든** `avatars/{userId}/` 마커를 앵커로 키를 복원한다 — `PATCH /users/me` 로 임의 `avatarUrl` 문자열을 넣더라도(그 DTO 는 이번 diff 범위 밖) 마커에 다른 사용자의 userId 를 심을 수 없으므로 복원된 키는 항상 호출자 자신의 프리픽스 안에 머문다. 또한 S3 `DeleteObjectCommand`/`GetObjectCommand` 의 `Key` 는 플랫 네임스페이스 문자열이라 `../` 등 순회 문자가 섞여도 파일시스템식 경로 이스케이프가 성립하지 않는다(존재하지 않는 리터럴 키에 대한 delete/get 은 그냥 실패한다). `getPublicUrl` 은 키를 세그먼트 단위로 `encodeURIComponent` 해 `/` 가 `%2F` 로 뭉개지는 것도 막는다(`s3.service.spec.ts` 신규 테스트가 고정).
- **버킷 정책(실질적 접근 통제의 SoT)**: `scripts/minio/avatars-public-read.json` 이 `s3:GetObject` 만 `arn:...:workflow-storage/avatars/*` 리소스에 허용하고 `s3:ListBucket` 은 포함하지 않는다 — `mc anonymous set download` 프리셋이 실제로는 `ListBucket` 을 함께 여는 것을 실측(README 재현 로그)으로 기각한 뒤 명시 정책으로 교체한 근거가 남아 있다. 신규 e2e(`users-avatar-upload.e2e-spec.ts`)가 익명 GET 200 · 목록 조회 403 을 회귀 가드로 고정한다.
- **SSRF**: `S3_PUBLIC_BASE_URL`/`resolvePublicBaseUrl` 은 서버가 fetch 하는 대상이 아니라 응답 URL 문자열 조립에만 쓰인다(`s3.service.ts getPublicUrl`). `main.ts` 의 `shouldWarnPublicBaseIsPrivate` 도 `isPrivateHost` 판정 결과로 `warn` 로그만 남기며 그 자체로 네트워크 요청을 만들지 않는다.
- **동시성/무결성(보안 관련 컬럼 보호)**: `updateAvatar` 가 `save(entity)` 대신 컬럼 단위 `userRepository.update(userId, { avatarUrl })` 를 써서, 업로드 중(수백 ms~수 초) 다른 요청이 바꾼 로그인 실패 카운터·계정 잠금·2FA 등록 같은 보안 관련 컬럼이 조용히 옛 값으로 되돌아가는(lost update) 경로를 차단했다 — `users-avatar.service.spec.ts` 가 `update` 호출의 `Object.keys(patch)` 를 `['avatarUrl']` 로 정확히 고정한다.
- **에러 처리**: `deletePreviousAvatarObject` 내부의 실패(예: 깨진 퍼센트 인코딩으로 인한 `URIError`, S3 오류)는 `try/catch` 로 삼켜져 `logger.warn` 으로만 남고 클라이언트 응답에는 노출되지 않는다. `BadRequestException`/`NotFoundException` 모두 구조화된 `code`/`message` 만 반환하며 스택트레이스·내부 경로·자격증명 등을 포함하지 않는다.
- **하드코딩 시크릿**: 이번 diff 에 새 자격증명은 없다. `docker-compose*.yml`/`.env.example`/`k8s/base/configmap.yaml` 의 `minioadmin` 류는 기존 로컬 개발 기본값의 연장이고, 신규로 추가된 `S3_PUBLIC_BASE_URL` 값들은 전부 엔드포인트 URL(placeholder 포함)이지 시크릿이 아니다.
- **배포 표면 전파 / 근접사고 재발 방지**: `k8s/overlays/prod`·`k8s/overlays/staging` 양쪽 모두 `S3_PUBLIC_BASE_URL` 을 명시 override 하며, base configmap 의 `localhost` 기본값이 실릴 뻔했던 근접사고(CHANGELOG 명시)에 대한 backstop 으로 `main.ts` 부팅 시 `shouldWarnPublicBaseIsPrivate(process.env)` 가 production 에서 사설/loopback 주소를 경고한다. 이 판정 로직은 `s3.config.ts` 의 순수 함수로 분리돼 있고(부트스트랩 본문에 인라인으로 두었을 때 뮤테이션 테스트로 무결성 미검증이 드러난 이력이 커밋 메시지에 남아 있다), 관련 유닛 테스트가 두 env 모두 미설정/서브도메인 함정(`localhost.evil.com`)/미치환 sentinel(`REPLACE_ME.cloudfront.net`) 케이스를 고정한다.
- **의존성**: `@aws-sdk/client-s3`, `@nestjs/platform-express`(multer) 등 이번 diff 가 새로 도입한 라이브러리는 없다 — 기존 의존성을 재사용한다.

## 요약

`avatars/{userId}/{uuid}.{ext}` 키 설계(UUID 추측 불가능성이 곧 접근 통제), 확장자 기반 `Content-Type` 강제(+SVG 배제, +프로토타입 오염 우회 차단), `s3:ListBucket` 을 배제한 명시 버킷 정책(실측으로 `mc anonymous set download` 를 기각한 근거 포함), 자기 userId 접두로 앵커링돼 교차-사용자 삭제가 불가능한 정리 로직, JWT 기반 소유권 검증(IDOR 없음), 보안 관련 컬럼의 lost-update 를 차단하는 컬럼 단위 UPDATE, production 사설 주소 근접사고에 대한 순수 함수 기반 부팅 경고까지 — 이 기능이 스스로 명시한 "공개 버킷" 트레이드오프에 대한 위협 모델링이 상세하고, 각 리스크 대응이 unit·e2e 회귀 테스트로 뒷받침된다. 직접 소스를 읽어 확인한 결과 인젝션·인증 우회·하드코딩 시크릿·SSRF·안전하지 않은 암호화·민감정보 노출 유형의 Critical/Warning 급 결함은 발견하지 못했다. 남은 두 항목(전용 throttle 부재, 매직 넘버 미검증)은 이미 직전 라운드에서 같은 결론(INFO, 즉시 조치 불요)으로 확인된 방어 심화 수준의 권고이며, 이번 재검증에서도 그 판단을 뒤집을 근거를 찾지 못했다.

## 위험도

LOW
