# 보안(Security) 코드 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)

## 발견사항

- **[INFO]** `POST /api/users/me/avatar` 에는 다른 무거운/민감한 엔드포인트와 달리 전용 throttle 이 없다
  - 위치: `codebase/backend/src/modules/users/users.controller.ts` — `uploadAvatar` (151행 `@Post('me/avatar')` ~ 196행) 에는 `@Throttle` 데코레이터가 없다. 같은 컨트롤러의 `changePassword`(261행)·`requestEmailChange`(338행)는 `@Throttle({ default: { ttl: 60_000, limit: 5 } })` 로 분당 5회로 제한한다.
  - 상세: 전역 기본 throttle(`codebase/backend/src/app.module.ts` `ThrottlerModule.forRoot` — `limit: 100, ttl: 60000`, 사용자 단위)이 여전히 적용되므로 무제한은 아니다. 다만 이 엔드포인트는 요청마다 파일 전체를 메모리 버퍼로 적재하고 S3 `PutObject` 1회 + best-effort `DeleteObject` 1회를 유발하는, 컨트롤러 내 다른 GET/PATCH보다 자원(메모리·스토리지·S3 API 호출) 비용이 큰 연산이다. 분당 100회 × 최대 2MB 가 허용되므로 단일 계정으로도 짧은 시간에 다수의 PUT/DELETE 를 유발할 수 있어(스토리지·API 비용, 그리고 `plan/in-progress/spec-sync-user-profile-gaps.md` 에 이미 유예로 등재된 "동시 업로드 시 패자 객체 고아화" 시나리오의 발생 빈도를 늘리는 방향) 민감 엔드포인트(비밀번호 변경·이메일 변경)와 같은 급의 별도 하한 throttle 을 고려할 만하다.
  - 제안: `changePassword`/`requestEmailChange` 와 동일한 패턴으로 `@Throttle({ default: { ttl: 60_000, limit: N } })` 을 `uploadAvatar` 에도 부여하는 것을 검토. 다만 현재 파일 크기 상한(2MB)과 전역 throttle 이 이미 존재해 즉시 악용 가능한 취약점이라기보다 방어 심화(defense-in-depth) 수준의 권고.

- **[INFO]** 업로드 파일의 실제 바이트 내용(매직 넘버)을 검증하지 않고 파일명 확장자만으로 화이트리스트 판정한다
  - 위치: `codebase/backend/src/modules/users/users.service.ts` — `updateAvatar` 의 확장자 파싱·`hasOwnProperty` 화이트리스트 검사 블록(96~110행 부근, `AVATAR_CONTENT_TYPES` 는 43행)
  - 상세: `ext`(파일명에서 파생)가 `AVATAR_CONTENT_TYPES` 의 own-property 인지만 확인하고, 실제 업로드된 바이트가 해당 포맷의 유효한 이미지인지는 검사하지 않는다. 즉 임의 바이트를 담은 파일에 `.png` 확장자만 붙이면 통과하고, 응답 `Content-Type` 은 서버가 강제한 `image/png` 로 저장·서빙된다. **평가**: 이 설계는 이미 핵심 위협(클라이언트 `mimetype` 신뢰 시 `text/html` 저장형 XSS)을 정확히 겨냥해 `Content-Type` 을 서버측에서 확장자 기반으로 강제하고 SVG 를 명시적으로 배제했으며(코드 주석에 명시), 브라우저는 명시적 `image/*` Content-Type 을 대체로 존중해 HTML/JS 로 실행하지 않으므로 실질적 악용 난이도는 낮다. 다만 매직 넘버 검증(예: 파일 헤더 시그니처 확인)까지 더하면 "이미지가 아닌 바이트가 image/* 로 공개 서빙"되는 경계 케이스(폴리글랏 페이로드, 이미지 파서 취약점 트리거 등)를 한 겹 더 막을 수 있다.
  - 제안: 현재 위협 모델(저장형 XSS)에는 충분히 대응돼 있다고 판단되므로 즉시 조치가 필요한 결함은 아님. 향후 이미지 처리 파이프라인(썸네일 생성 등)을 추가할 계획이 있다면 그 이전에 매직 넘버 검증을 추가할 것을 권고.

## 그 외 점검 결과 (문제 없음 — 확인한 항목)

- **인증/인가**: `@UseGuards(JwtAuthGuard)` 가 컨트롤러 레벨에 있어 `uploadAvatar` 도 인증을 요구한다. 대상 사용자 ID 는 요청 바디/파라미터가 아니라 `@CurrentUser()` 로 얻은 JWT `payload.sub` 이므로 다른 사용자의 아바타를 대신 업로드하는 IDOR 경로가 없다(`users.controller.spec.ts` 의 신규 테스트가 이를 고정).
- **Content-Type 스푸핑/저장형 XSS**: 클라이언트가 보내는 `mimetype` 을 신뢰하지 않고, 서버가 확장자 화이트리스트에서 파생한 `Content-Type` 을 강제로 지정해 S3 에 저장한다(`s3Service.upload(key, file.buffer, contentType)`). SVG 는 의도적으로 화이트리스트에서 제외돼 있어 스크립트 포함 가능한 유일한 이미지 포맷이 차단된다.
- **프로토타입 오염 우회**: 확장자 화이트리스트 판정이 `Object.prototype.hasOwnProperty.call(...)` 을 사용해 `constructor`/`__proto__`/`toString` 등 `Object.prototype` 상속 키가 일반 인덱싱으로 truthy 를 돌려주며 화이트리스트를 우회하는 경로를 막는다(코드 주석에 실측 근거 명시).
- **경로/키 조작**: 오브젝트 키는 `avatars/{userId}/{randomUUID()}.{ext}` 로 서버가 전적으로 구성하며, 사용자 입력이 관여하는 부분은 사전 검증된 `ext` 뿐이다. `getPublicUrl` 은 키 세그먼트를 `encodeURIComponent` 로 개별 인코딩해 URL 구조를 보존한다. 삭제 시 사용되는 `deletePreviousAvatarObject` 는 DB 에 저장된 이전 URL에서 **자기 자신의 userId 접두**(`avatars/{userId}/`)를 앵커로 키를 복원하므로, `PATCH /users/me` 로 임의 `avatarUrl` 문자열을 넣더라도 다른 사용자의 키를 삭제 대상으로 만들 수 없다. S3 `DeleteObjectCommand` 의 `Key` 는 플랫 네임스페이스 문자열이라 `../` 등 경로 순회 문자가 있어도 파일시스템식 이스케이프가 발생하지 않는다.
- **버킷 정책(접근 통제의 실질 SoT)**: `scripts/minio/avatars-public-read.json` 이 `s3:GetObject` 만 `avatars/*` 리소스에 허용하고 `s3:ListBucket` 을 포함하지 않는다 — README 에 `mc anonymous set download` 가 의도치 않게 `ListBucket` 을 함께 여는 것을 실측으로 기각한 근거가 남아 있고, 신규 e2e 테스트(`users-avatar-upload.e2e-spec.ts`)가 익명 GET 200·목록 조회 403 을 회귀 가드로 고정한다. 정책 리소스가 `avatars/*` 로 한정돼 있어 같은 버킷의 다른 프리픽스(예: knowledge-base 파일)에는 영향이 없다.
- **SSRF**: `S3_PUBLIC_BASE_URL` 은 서버가 fetch 하는 대상이 아니라 문자열 조립에만 쓰이고(`s3.service.ts` `getPublicUrl`), production 부팅 시 `isPrivateHost`(재사용, 미변경)로 사설/loopback 여부만 경고(`warn`, 비차단)한다 — 별도 요청을 만들지 않으므로 이 값 자체가 SSRF 벡터가 되지 않는다. `avatarUrl` DTO(`update-me.dto.ts`, 이번 diff 범위 밖·미변경)는 이미 "서버가 fetch 하지 않는다"는 근거로 `@IsUrl({ require_tld: false })` 를 쓰고 있어 일관된다.
- **동시성/무결성**: `updateAvatar` 가 `save(entity)` 대신 컬럼 단위 `update(userId, { avatarUrl })` 를 써서, 업로드 중(수백 ms~수 초) 다른 요청이 바꾼 계정 잠금·2FA 등 보안 관련 컬럼이 조용히 되돌아가는(lost update) 경로를 막았다 — 이 자체가 보안 관련 회귀(계정 잠금 우회 가능성)를 예방하는 수정.
- **에러 처리**: `deletePreviousAvatarObject` 의 실패(예: 깨진 퍼센트 인코딩으로 인한 `URIError`, S3 오류)는 내부에서 `catch` 되어 `logger.warn` 으로만 남고 클라이언트 응답에 스택트레이스·내부 경로·자격증명 등 민감정보를 노출하지 않는다. `BadRequestException`/`NotFoundException` 도 구조화된 `code`/`message` 만 반환한다.
- **하드코딩 시크릿**: 이번 diff 에 새 자격증명은 없다. `docker-compose*.yml`/`.env.example`/`k8s/base/configmap.yaml` 의 `minioadmin` 류는 기존 로컬 개발 기본값의 연장이며 신규 유출이 아니다. `S3_PUBLIC_BASE_URL` 은 URL(엔드포인트) 값이지 시크릿이 아니다.
- **배포 표면 전파**: `k8s/overlays/prod`·`k8s/overlays/staging` 양쪽 모두 `S3_PUBLIC_BASE_URL` 을 명시 override 하고 있어, base configmap 의 `localhost` 기본값이 운영에 그대로 실릴 여지를 남기지 않았다. 다만 이 값이 잘못 설정되면 "업로드는 성공하고 이미지만 403" 이 되는 가시적 실패이지 보안 실패는 아니다(문서에 명시).

## 요약

`avatars/{userId}/{uuid}.{ext}` 키 설계(추측 불가능성이 접근 통제), 확장자 기반 `Content-Type` 강제(+SVG 배제, +프로토타입 오염 우회 차단), `s3:ListBucket` 을 배제한 버킷 정책, 자기 userId 접두로 앵커링된 안전한 삭제, JWT 기반 소유권 검증(IDOR 없음), 컬럼 단위 UPDATE 로 인한 보안 관련 컬럼 lost-update 방지까지 — 이 기능이 스스로 밝힌 "공개 버킷" 트레이드오프에 대한 위협 모델링이 상세하고, 각 리스크에 대응하는 테스트(unit·e2e)가 회귀 가드로 남아 있다. Critical/실질적으로 악용 가능한 취약점은 발견하지 못했다. 남은 두 항목은 방어 심화 수준의 INFO — (1) 업로드 엔드포인트에 다른 민감 엔드포인트 수준의 전용 throttle 부재, (2) 매직 넘버 미검증(확장자만 검증) — 둘 다 즉시 조치가 필요한 결함이 아니라 참고 사항이다.

## 위험도

LOW
