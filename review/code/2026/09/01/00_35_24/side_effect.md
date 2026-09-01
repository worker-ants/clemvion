# 부작용(Side Effect) 코드 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)

## 발견사항

- **[INFO]** `UsersService.update()` — 공유 진입점(호출부 다수: `totp.service.ts`·`webauthn.service.ts`·`auth.service.ts`·`users.controller.ts`)에 "avatarUrl 이 바뀌면 옛 S3 객체를 지운다"는 새 side effect(조건부 추가 `SELECT` + S3 `DeleteObjectCommand` 네트워크 호출)가 심어졌다
  - 위치: `codebase/backend/src/modules/users/users.service.ts` `update()` 메서드 (약 234~248행, `'avatarUrl' in data` 분기)
  - 상세: 시그니처(`update(id, data): Promise<User>`)는 그대로지만, 페이로드에 `avatarUrl` 키가 있고 값이 실제로 바뀌면 `deletePreviousAvatarObject()`가 호출돼 외부 S3 `DeleteObjectCommand`를 낸다. 이 메서드를 "단순 partial-update 헬퍼"로 알고 새 호출자를 추가하면, 시그니처만 보고는 이 side effect를 알 수 없다. 다만 실제로 오늘 시점에 `avatarUrl`을 페이로드에 싣는 호출부는 `updateMe`(PATCH `/users/me`) 하나뿐이고(직접 확인: `grep -n "usersService.update("`로 전 호출부 대조), 그 사실은 JSDoc과 `@ApiOperation` 설명(`updateMe` — "avatarUrl 을 다른 값으로 바꾸면 직전에 업로드된 아바타 객체가 스토리지에서 함께 정리됩니다")에 명시돼 있다. `deletePreviousAvatarObject` 자체는 실패를 삼키고 `warn` 로그만 남기므로 이 side effect가 요청을 실패시키지는 않지만, 네트워크 왕복만큼 응답 지연은 늘어난다.
  - 검증: `totp.service.ts`·`webauthn.service.ts`·`auth.service.ts`의 `usersService.update()` 호출 9곳을 전수 확인 — 전부 리터럴 객체로 특정 필드만 넘기며 `avatarUrl`을 포함하지 않는다(스프레드로 무심코 섞일 위험 없음). `auth-oauth.service.ts`의 신규 계정 연동 경로는 raw `QueryBuilder.update()`로 `avatarUrl`을 직접 써 이 메서드를 우회하는데, 그 우회가 "우선순위가 바뀌면 조용한 orphan이 된다"는 것을 지키는 소스-레벨 캐너리(`users-avatar.service.spec.ts`의 `describe('OAuth 연동 경로가 아바타 정리를 우회한다 — 캐너리')`, `resolveUser 는 기존 avatarUrl 을 공급자 사진보다 우선한다`)가 실제로 존재함을 파일을 직접 열어 확인했다. `plan/in-progress/spec-sync-user-profile-gaps.md`에도 재개 신호와 함께 유예로 등재돼 있다.
  - 제안: 별도 조치 불요 — 이미 문서화·테스트·plan 추적이 갖춰져 있다. 새 호출자가 `update()`에 `avatarUrl`을 (의도했든 아니든) 포함시킬 가능성이 생기면 이 JSDoc을 참조하도록 유지할 것.

- **[INFO]** `main.ts` 부팅 시 새 환경변수 읽기 + 조건부 로그 side effect
  - 위치: `codebase/backend/src/main.ts` `bootstrap()` 함수 (production 가드 블록, `resolvePublicBaseUrl(process.env)` 호출부)
  - 상세: `NODE_ENV === 'production'`일 때만 `S3_PUBLIC_BASE_URL`/`S3_ENDPOINT`를 읽어 `isPrivateHost()`(순수 동기 IP 리터럴 판정, DNS 조회 없음 — `ssrf.util.ts` 확인)로 사설/loopback 여부를 판정하고, 해당하면 `logger.warn`만 낸다. `throw`가 아니므로 부팅을 막거나 응답을 바꾸지 않는다. 매 부팅 1회만 실행되고 반복 폴링이나 외부 네트워크 호출은 없다. 의도된 범위 안의 부작용이다.
  - 제안: 조치 불요.

- **[INFO]** `UsersModule`이 `S3Service`를 지역 provider로 신규 등록 — 부팅 시 `S3Client` 인스턴스(및 커넥션 풀)가 하나 더 생성된다
  - 위치: `codebase/backend/src/modules/users/users.module.ts` (`providers: [UsersService, S3Service]`)
  - 상세: `S3Service` 생성자는 매 인스턴스마다 새 `S3Client`를 만든다(`s3.service.ts` 18~50행). `KnowledgeBaseModule`이 이미 같은 패턴으로 `S3Service`를 지역 provider로 등록해 앱 전체에 필수 S3 env 검증(부재 시 throw)을 강제하고 있었으므로, 이번 등록이 **새로운** 부팅 요구사항을 만들지는 않는다 — 다만 리소스 인스턴스(커넥션 풀)가 모듈별로 하나씩 더 생기는 것은 사실이다. 요청 경로 성능 문제는 아니며(Nest 싱글톤, 부팅 1회), performance.md에서도 동일 사안을 INFO로 이미 짚었다.
  - 제안: 조치 불요. S3 소비 모듈이 더 늘어나면 `@Global` 승격을 고려할 것(기존 지적과 동일).

- **[INFO]** `import Express from 'express'` → `import ExpressNS from 'express'` 리네임이 기존 두 메서드(`changePassword`·`verifyEmailChange`)의 파라미터 타입 표기를 함께 바꾼다
  - 위치: `codebase/backend/src/modules/users/users.controller.ts` (`changePassword`의 `@Req() req: ExpressNS.Request`·`@Res() res: ExpressNS.Response`, `verifyEmailChange`도 동일)
  - 상세: TypeScript 타입 레벨 변경만이고 런타임 시그니처(파라미터 개수·타입·데코레이터)는 그대로다 — 컴파일 후 소거되므로 호출자·런타임 동작에 영향 없음. 리네임 근거(`@types/multer`의 `Express.Multer.File` 접근을 위해 전역 `Express` 네임스페이스 가림을 해소)가 import 위 주석에 실측 오류 메시지와 함께 명시돼 있다. 파일 전체를 `Read`로 열어 잔여 `Express.` 참조가 없음을 확인했다.
  - 제안: 조치 불요.

## 그 외 점검 결과 (문제 없음)

- **전역 변수**: 신규 전역 변수 도입 없음. `s3.config.ts`의 `resolvePublicBaseUrl`은 순수 함수(env 객체를 인자로 받아 반환, 전역 상태 미참조).
- **파일시스템 부작용**: 신규 코드 경로에서 파일 생성·수정·삭제 없음. 신규 스펙 파일들의 `readFileSync` 사용은 전부 소스 가드용 읽기 전용(`users-avatar-swagger-sync.spec.ts`·`users-avatar.service.spec.ts`).
- **환경 변수**: 새 env(`S3_PUBLIC_BASE_URL`)는 `README.md`·`.env.example`·`docker-compose.yml`·`docker-compose.e2e.yml`·`k8s/base/configmap.yaml`·`k8s/overlays/{local,prod,staging}` 전체에 일관 배선돼 있음을 직접 확인했다. 미설정 시 `S3_ENDPOINT` → `localhost:9000` 순으로 폴백하는 규칙이 `resolvePublicBaseUrl` 한 곳(SoT)에만 있고 `main.ts`가 이를 재사용(직접 재구현하지 않음).
- **네트워크 호출**: 신규 외부 호출은 S3/MinIO에 대한 `PutObjectCommand`(업로드)·`DeleteObjectCommand`(옛 객체 정리, best-effort)뿐이며 둘 다 기능 목적에 부합한다. 그 외 신규 외부 서비스 호출 없음.
- **버킷 정책 적용(`mc anonymous set-json`)**: `docker-compose.yml`/`docker-compose.e2e.yml`의 `createbuckets` 초기화 스크립트에 정책 적용 명령이 추가됐다. `mc anonymous set-json`은 버킷의 익명 정책을 통째로 교체하는 명령이지만, 이 PR 이전에는 해당 버킷에 대한 `mc anonymous` 호출이 전혀 없었음을 grep으로 확인했다 — 기존에 다른 용도로 열려 있던 익명 정책을 덮어쓰는 부작용은 없다. 정책 파일(`scripts/minio/avatars-public-read.json`) 자체도 `s3:GetObject`만 허용하고 `avatars/*` 접두로 스코프돼 있음을 직접 열어 확인했다(`s3:ListBucket` 미포함).
- **이벤트/콜백**: 신규 이벤트 발행·콜백 등록 없음.
- **공개 API 인터페이스**: 신규 엔드포인트 `POST /api/users/me/avatar`는 순수 추가라 기존 클라이언트에 영향 없음. 기존 `PATCH /users/me` 응답 스키마는 변경되지 않았고, 동작 변화(교체 시 옛 객체 정리)는 Swagger 설명에 명시돼 있어 "조용한" API 변경이 아니다.

## 검증 메모 (읽기 전용, 저장소 트리 뮤테이션 없음)

- `git status --short` — 리뷰 시작 시점 기준 `review/code/2026/09/01/00_35_24/`(이 라운드의 산출물 디렉터리)만 untracked, 그 외 트리 클린. 리뷰 중 저장소 파일을 고치지 않았고 종료 시점도 동일 상태.
- HEAD(`ecaa785bd`)가 "리뷰 5R" 수정(빈-버퍼 vacuous 테스트 정정 + 버킷 정책 e2e 신설) 커밋임을 `git log`로 확인 — 직전 라운드(`00_11_39`) SUMMARY의 WARNING들이 그 라운드의 RESOLUTION에서 이미 처리됐고, 그 처리 결과(캐너리 존재, e2e 존재)를 코드에서 직접 재확인했다.
- `usersService.update()` 호출부 전수(`grep -rn "usersService.update("`)를 열어 `avatarUrl`을 포함하는 페이로드가 `updateMe` 외에 없음을 확인.
- `auth-oauth.service.ts`의 `resolveUser()`가 raw `QueryBuilder`로 `avatarUrl`을 직접 쓰는 경로임을 확인했고, 그 우회를 지키는 캐너리 테스트(`users-avatar.service.spec.ts` 하단 `describe('OAuth 연동 경로가 아바타 정리를 우회한다 — 캐너리')`)가 실제로 존재함을 파일을 열어 확인했다(이전 라운드에서 "존재하지 않는다"는 지적이 있었으나 RESOLUTION에서 반박·재확인된 사실과 일치).

## 요약

이번 diff가 만드는 부작용은 대체로 목적에 부합하고 문서화·테스트가 갖춰져 있다. 가장 눈여겨볼 지점은 공유 메서드 `UsersService.update()`(다수 호출부)에 "avatarUrl 변경 시 S3 삭제 네트워크 호출"이라는 새 side effect가 조건부로 심어진 것인데, 실제로 그 조건을 만족시키는 호출부는 `updateMe` 하나뿐이고 JSDoc·Swagger 설명·plan 문서·소스 캐너리 테스트로 잘 방어돼 있어 INFO로 남긴다. `main.ts`의 부팅 시 환경변수 판정+경고 로그, `UsersModule`의 `S3Service` 지역 provider 등록(커넥션 풀 중복), `Express`→`ExpressNS` 리네임에 따른 기존 두 메서드 타입 표기 변경은 모두 관측 가능하지만 위험도가 낮고 이미 disclose돼 있다. 전역 변수 신설, 예상치 못한 파일시스템 변경, 문서화되지 않은 외부 네트워크 호출, 공개 API의 조용한 파괴적 변경은 관찰되지 않았다. 버킷 정책 적용(`mc anonymous set-json`)도 기존 익명 정책을 덮어쓰는 부작용이 없음을 확인했다.

## 위험도

LOW
