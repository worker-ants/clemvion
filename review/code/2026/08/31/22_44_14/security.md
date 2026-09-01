# 보안(Security) 코드 리뷰 — 아바타 업로드 (공개 버킷 + 공개 URL)

## 발견사항

- **[WARNING]** `AVATAR_CONTENT_TYPES` 확장자 화이트리스트가 일반 객체 리터럴이라 `Object.prototype` 상속 프로퍼티명(`constructor`, `__proto__`, `toString`, `hasOwnProperty`, `valueOf`, `toLocaleString`, `isPrototypeOf`)을 확장자로 쓰면 검증을 우회한다.
  - 위치: `codebase/backend/src/modules/users/users.service.ts:82-91` (화이트리스트 정의는 `:43-49`)
  - 상세: `updateAvatar()` 는 `UsersService.AVATAR_CONTENT_TYPES[ext]` 로 조회한 뒤 `if (!contentType) throw BadRequestException(INVALID_FILE_TYPE)` 로 거른다. 그런데 `AVATAR_CONTENT_TYPES` 는 `Object.create(null)` 이 아닌 일반 객체 리터럴이라 `Object.prototype` 을 상속한다. 파일명을 `avatar.constructor`, `avatar.__proto__`, `avatar.toString` 등으로 지정하면(멀티파트 `filename` 은 클라이언트가 임의 지정 가능) `ext` 가 이 특수 이름이 되고, `AVATAR_CONTENT_TYPES[ext]` 는 `undefined` 가 아니라 상속된 함수/객체(예: `Object`, `Object.prototype.toString`)를 반환한다 — 실측(node -e)으로 7개 이름 전부 `truthy` 임을 확인했다. 그 결과 `!contentType` 가 `false` 가 되어 **의도한 확장자 화이트리스트 검증을 우회**하고, 이 비-문자열 값이 그대로 `s3Service.upload(key, file.buffer, contentType)` 의 `ContentType` 인자로 전달된다. AWS SDK 의 헤더 직렬화 단계에서 타입 오류로 처리되지 않은 예외(→ 잡히지 않은 500)가 나거나, 문자열로 강제 변환(`String(contentType)` → `"[object Object]"` 류)된 값이 실제 S3 오브젝트의 `Content-Type` 으로 저장될 수 있다. 어느 경로든 이 코드의 JSDoc 이 명시한 보안 불변식("확장자 화이트리스트로만 판정 — text/html 저장을 원천 차단")이 깨진다. 공격자가 이 경로로 `Content-Type` 을 임의 문자열(`text/html` 등)로 완전히 제어할 수는 없지만(반환값이 함수/객체로 고정되어 있어), 문서화된 검증 게이트를 특정 입력값으로 통과시킬 수 있다는 점 자체가 결함이다.
  - 제안: `Object.prototype.hasOwnProperty.call(AVATAR_CONTENT_TYPES, ext)` 가드를 추가하거나, `AVATAR_CONTENT_TYPES` 를 `Object.create(null)` 기반 객체 또는 `Map` 으로 바꾼다. 회귀 테스트에 `constructor`/`__proto__`/`toString` 확장자 케이스를 추가해 `INVALID_FILE_TYPE` 이 정상적으로 던져지는지 고정할 것을 권장한다(현재 `users-avatar.service.spec.ts` 는 `.svg`/`.html`/확장자 없음만 커버하고 이 축은 비어 있다).

- **[INFO]** 업로드 파일의 실제 내용(매직 바이트)은 검증하지 않고 파일명 확장자만으로 이미지 여부를 판정한다.
  - 위치: `codebase/backend/src/modules/users/users.service.ts:82-91` (`updateAvatar`)
  - 상세: `Content-Type` 을 클라이언트 `mimetype` 이 아니라 확장자에서 파생시키는 설계(JSDoc 명시)는 저장형 XSS 방지에는 유효하다. 다만 파일 바이트 자체는 어떤 형식이든 허용된다 — `.png` 확장자를 붙인 임의 바이너리(폴리글랏, 익스플로잇 페이로드 등)가 `image/png` 로 라벨링되어 공개 URL 로 서빙될 수 있다. 현재는 서버 측 이미지 처리(리사이즈·썸네일 등)가 없어 즉각적 공격 표면은 제한적이지만, 향후 이미지 처리 파이프라인이 추가되면 이 갭이 실제 취약점(예: 이미지 파서 익스플로잇)으로 이어질 수 있다.
  - 제안: 향후 서버측 이미지 처리를 추가할 계획이 있다면 매직 바이트 검증(`file-type` 류 라이브러리) 도입을 백로그에 남길 것.

- **[INFO]** 공개 버킷 오브젝트에 `X-Content-Type-Options: nosniff` 등 MIME 스니핑 방지 헤더를 코드 레벨에서 강제하지 않는다.
  - 위치: `codebase/backend/src/common/services/s3.service.ts` (`upload()`, 변경 없는 기존 메서드지만 아바타 공개 서빙의 신뢰 기반)
  - 상세: `PutObjectCommand` 는 `Bucket/Key/Body/ContentType` 만 설정한다. 이 PR 의 위협 모델(JSDoc·CHANGELOG)이 "`Content-Type` 이 브라우저 렌더링을 결정하므로 신뢰해야 한다"를 명시적으로 전제하는데, 그 신뢰를 보강하는 `nosniff` 헤더는 코드에도, 문서화된 버킷 정책 요구사항에도 없다. 오래된 브라우저의 콘텐츠 스니핑이나 프록시/CDN 설정에 따라 선언된 `Content-Type` 이 무시될 가능성에 대한 방어층이 비어 있다.
  - 제안: 가능하면 `PutObjectCommand` 호출 시 `Metadata`/`ContentDisposition` 를 통해 `nosniff` 를 강제하거나(오브젝트 스토리지가 지원 시), 최소한 `.env.example`/`k8s/README.md` 의 버킷 정책 안내에 CDN/리버스 프록시 단에서 `X-Content-Type-Options: nosniff` 를 강제하라는 문구를 추가.

- **[INFO]** `S3_PUBLIC_BASE_URL` 미설정 시 내부 주소인 `S3_ENDPOINT` 로 조용히 폴백한다.
  - 위치: `codebase/backend/src/common/config/s3.config.ts:19-22`
  - 상세: 개발/E2E 환경에서는 `S3_ENDPOINT` 가 `localhost`/컨테이너 호스트명이라 문제되지 않지만, 운영 배포에서 `S3_PUBLIC_BASE_URL` 설정을 누락하면 클라이언트에게 반환되는 `avatarUrl` 에 내부 네트워크 주소(사설 DNS/IP)가 그대로 노출될 수 있다(기능 고장은 CHANGELOG/README/k8s 문서에 이미 강하게 경고돼 있으나, 실패 모드가 "조용한 폴백"이라는 점 자체는 정보노출 관점에서도 한 번 더 짚을 가치가 있다). 인증된 사용자에게만 보이는 값이라 심각도는 낮다.
  - 제안: (선택) 운영(`NODE_ENV=production`) 에서는 `S3_PUBLIC_BASE_URL` 미설정 시 폴백 대신 부팅 실패로 fail-fast 시키는 것을 고려. 이미 문서화된 배포 선행조건과 함께 다루면 충분.

- **[INFO]** `deletePreviousAvatarObject` 의 키 복원은 `previousUrl.indexOf('avatars/{userId}/')` 부분 문자열 매칭에 의존한다 — 실제 익스플로잇 경로는 확인되지 않았으나 설계 노트로 남긴다.
  - 위치: `codebase/backend/src/modules/users/users.service.ts:120-141`
  - 상세: `avatarUrl` 은 `PATCH /users/me` 로 사용자가 임의 문자열(`@IsUrl` 통과 범위 내)을 넣을 수 있다. 앵커가 자기 자신의 `userId` 접두로 고정돼 있어 다른 사용자의 키를 삭제할 수는 없고(자기 네임스페이스 내로 한정), S3 키는 계층형 파일시스템이 아니라 평면 문자열이라 `../` 삽입으로 실제 경로 탈출도 일어나지 않는다 — 검증 결과 악용 가능성은 낮다고 판단했다. 다만 사용자가 자신의 `avatarUrl` 을 조작해 자신의 다른(현재 사용 중이 아닌) 키를 스스로 삭제하게 만드는 것은 가능한데, 이는 자기 자신의 리소스에 대한 자기-DoS 수준이라 별도 조치는 불필요해 보인다.
  - 제안: 조치 불필요. 참고용 기록.

- **[INFO — 확인됨, 결함 아님]** 인가 경로는 정상이다.
  - 위치: `codebase/backend/src/modules/users/users.controller.ts:59-62, 143-194`
  - 상세: `@UseGuards(JwtAuthGuard)` 가 컨트롤러 클래스 레벨에 있고(전역 `APP_GUARD` 로도 이중 적용), `uploadAvatar` 는 `@CurrentUser() payload.sub` 만을 대상 사용자로 사용해 다른 사용자의 아바타를 덮어쓸 수 없다. 전역 `UserThrottlerGuard` 가 `APP_GUARD` 로 등록돼 있어 이 엔드포인트도 기본 rate-limit 적용 대상이다(엔드포인트 전용 `@Throttle` 은 없지만 전역 가드로 커버됨 — 별도 지적 불요).

- **[INFO — 확인됨, 결함 아님]** CRITICAL 이었던 `decodeURIComponent` 미보호 이슈는 이미 `try` 블록 안으로 이동해 수정되어 있다.
  - 위치: `codebase/backend/src/modules/users/users.service.ts:135-141`
  - 상세: 리뷰 대상 diff 자체에 이미 반영된 수정이라 별도 조치 불필요.

## 요약

이번 변경은 "공개 버킷 + 공개 URL" 서빙 전략이 만드는 세 가지 알려진 위험(키 추측 가능성·Content-Type 신뢰·교체 시 순서)에 대해 명시적으로 대응했고(UUID 키, 확장자 기반 Content-Type 강제, SVG 배제, DB 저장 후 삭제, `decodeURIComponent` try-catch), 인가(JwtAuthGuard + self-only)·경로 조작(확장자·userId 모두 검증된 값만 S3 키에 사용)·시크릿 하드코딩(신규 없음, 기존 dev-only 값 패턴 유지) 관점에서는 문제를 찾지 못했다. 다만 `AVATAR_CONTENT_TYPES[ext]` 조회가 일반 객체 리터럴의 프로토타입 상속 프로퍼티(`constructor`/`__proto__`/`toString` 등)에 대해 진짜 검증 우회를 허용한다는 점을 실측으로 확인했다(WARNING) — 이 경로로 `Content-Type` 을 임의 문자열로 완전히 탈취할 수는 없지만, 문서화된 화이트리스트 불변식이 특정 입력에서 깨진다. 그 외에는 매직 바이트 미검증·`nosniff` 미강제·내부 주소 폴백 등 방어 심층화(defense-in-depth) 수준의 개선 여지만 남아 있다.

## 위험도

LOW
