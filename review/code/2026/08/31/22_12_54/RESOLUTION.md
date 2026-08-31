# RESOLUTION — 아바타 업로드 리뷰 반영

대상 SUMMARY: 위험도 **HIGH** · Critical **2** · Warning **9** · INFO 7
반영 커밋: `8d06f4944`

전부 처리했다. 미조치는 없다. 아래 "판단해서 좁힌 것" 두 건은 **하지 않은 것이 아니라 다르게
한 것**이라 근거를 함께 적는다.

## Critical

### C1 — `decodeURIComponent` 가 정리 `try` 밖 (에러 처리)

**수정.** 리뷰의 재현을 독립으로 확인했다:

```
node -e "decodeURIComponent('%zz')"  →  URIError: URI malformed
```

`deletePreviousAvatarObject` 는 파싱(`decodeURIComponent`·`split(/[?#]/)`)을 `try` 밖에
두었고 삭제 호출만 감쌌다. 옛 `avatarUrl` 에 깨진 퍼센트 인코딩이 있으면 `URIError` 가
전파돼 — 새 파일 업로드와 DB 저장이 **이미 성공한 뒤에** — 클라이언트는 500 을 받는다.
그 값은 사용자가 `PATCH /users/me` 로 넣을 수 있고 `@IsUrl` 은 퍼센트 인코딩을 보지 않는다.

**이건 단순 누락이 아니라 보장의 폭 문제였다.** 바로 위 JSDoc 이 "정리 실패는 삼킨다" 고
적고 있었으므로, 문서한 보장이 구현보다 넓었다.

파싱을 `try` 안으로 옮기고, 로그가 못 읽은 `previousUrl` 원본을 싣게 했다.
회귀: `users-avatar.service.spec.ts` — 깨진 인코딩 옛 URL 로도 업로드가 resolve 되고
`delete` 는 시도되지 않는다(고아 1개는 감수). 뮤턴트 M1(파싱을 다시 밖으로) → **RED**.

### C2 — 위임 plan 이 SoT 문서 둘을 빠뜨림 (SPEC-DRIFT)

**수정 — 코드는 유지, 위임 범위를 넓혔다.** 직접 대조로 확인했다:

| 문서 | 적혀 있는 것 |
|---|---|
| `spec/0-overview.md:276` | `{workspaceId}/avatars/...` · **"계획 (코드 미구현)"** |
| `spec/data-flow/4-file-storage.md:71` | `<workspaceId>/avatars/<userId>.<ext>` · **"spec 정의, 미구현"** |
| 실제 구현 (`users.service.ts:92`) | `avatars/{userId}/{uuid}.{ext}` |

초판 위임(`spec-update-avatar-upload-implemented.md`)은 `9-user-profile.md` **한 문서만**
적었다. 리뷰 지적대로 나머지 둘이 남는다.

**왜 문서 흠결로 강등할 수 없나**: 운영자가 `4-file-storage.md` §2.1 을 SoT 삼아 버킷 정책을
`{workspaceId}/avatars/` 접두로 잡으면, 실제 객체는 `avatars/` 아래 있어 정책이 걸리지 않는다.
그러면 **업로드는 성공하고 이미지만 403** — 내 CHANGELOG 가 반복 경고한 그 실패를, spec 을
믿은 대가로 재현한다.

위임 대상을 3개 문서 + 에러 카탈로그로 넓히고, `workspaceId` 부재(`User` 는 워크스페이스
종속 리소스가 아니다)와 UUID 파일명(공개 버킷에서 키가 곧 접근 통제)이 **왜 의도인지**를
plan 에 함께 적었다. `spec/` 쓰기는 developer 권한 밖이라 planner 트랙 유지.

## Warning

| # | 처리 | 내용 |
|---|---|---|
| 1 | 수정 | `S3_PUBLIC_BASE_URL` 을 배포 표면 **6곳**에 전파 — `docker-compose.yml`·`docker-compose.e2e.yml`·`k8s/base/configmap.yaml`·`k8s/overlays/local/configmap-patch.yaml`·`k8s/README.md` 체크리스트·루트 `README.md`. docker-compose 는 백엔드가 `minio:9000`, 브라우저가 `localhost:9000` 이라 **폴백이 틀리는 바로 그 형상**이었다 |
| 2 | 수정 | `@HttpCode(HttpStatus.OK)` 추가. 뮤턴트 M9(제거) → **RED** (`Reflect.getMetadata('__httpCode__')`) |
| 3 | 수정(좁힘) | 파일 누락을 **`FILE_REQUIRED`** 로 분리. 확장자 불허의 `INVALID_FILE_TYPE` 은 `knowledge-base.service.ts:928` 선례가 있어 **그대로 뒀다** — 새 코드를 만들면 같은 뜻에 두 이름이 생긴다. 카탈로그 등재는 planner 트랙으로 위임 |
| 4 | 수정(좁힘) | `update()` 에도 정리 추가. 단 호출부가 **17곳**(totp·webauthn·auth 뜨거운 경로)이라 무조건 사전조회는 비싸므로 `'avatarUrl' in data` 로 가뒀고, **값이 실제로 바뀐 경우에만** 지운다 — OAuth 재연동은 같은 URL 을 다시 넘기므로 값 비교가 없으면 방금 저장한 객체를 날린다. 뮤턴트 M2(비교 제거)·M3(가드 제거) → 둘 다 **RED** |
| 5 | 수정 | 프로필 응답 매핑 3중 복제 → `toProfileData()`. `getMe` 만 `pendingEmail` 을 스프레드로 덧붙인다 |
| 6 | 수정(좁힘) | `ExpressModule` → **`ExpressNS`**(NestJS `@Module()` 과 표기 겹침 해소). 다른 4개 컨트롤러는 **건드리지 않았다** — 그쪽은 `Express.Multer` 를 쓰지 않아 shadowing 이 실제 문제가 되지 않고, 전역 컨벤션 승격은 이 변경의 범위 밖이다 |
| 7 | 수정 | `getPublicUrl` 전용 테스트 4건 + `s3.config` 3단 폴백 3건 신설. 지적대로 **신설 메서드 구현이 어디서도 실행되지 않고 있었다**(소비 테스트가 `S3Service` 를 통째로 mock). 뮤턴트 M4·M5 → **RED** |
| 8 | 수정 | 허위 보호 주장 제거 + 진짜 드리프트 지점에 테스트. 아래 별도 항목 |
| 9 | 수정 | `uploadAvatar` 컨트롤러 레벨 테스트 2건. 뮤턴트 M8(`payload.sub`→`payload.email`) → **RED** |

### W8 을 따로 적는 이유 — 없는 테스트를 근거로 들었다

컨트롤러 주석이 *"회귀 테스트가 두 값의 동일성을 고정한다"* 고 적었으나 **그런 테스트는
없었다.** 게다가 그 주석이 가리킨 `limits.fileSize` 는 `UsersService.AVATAR_MAX_BYTES` 를
직접 참조하므로 애초에 갈릴 수 없었다 — 보호가 필요 없는 자리에 없는 보호를 선언한 셈이다.

없는 보호를 근거로 대면 다음 사람이 그걸 믿고 상수를 리터럴로 바꾼다. 주석을 정정하고,
**실제로 갈릴 수 있는 곳**(상수에서 파생되지 않는 Swagger 산문 리터럴 `최대 2MB` ·
`png/jpg/jpeg/webp/gif`)에 동기화 테스트를 붙였다. 확장자는 부분집합이 아니라 **정확히
같은지**를 본다 — SVG 를 조용히 더해도 통과하면 안 되기 때문이다.
뮤턴트 M6(2MB→5MB)·M7(svg 추가) → 둘 다 **RED**.

## INFO

- **#1·#3 (보안/배포)** — 반영. `.env.example` 에 **`ListBucket` 은 허용하지 않는다**(공개
  버킷의 접근 통제가 키 UUID 의 추측 불가능성뿐이라 목록 조회가 열리면 통제가 통째로 무너진다)
  와 실제 키 형태를 명시. `k8s/README.md` 항목에도 같은 조건을 실었다.
- **#2 매직바이트 검증** — 미조치. 확장자 화이트리스트 + 강제 `Content-Type` 으로 저장형
  XSS 는 막힌다는 리뷰 판단에 동의한다. 2차 방어는 별건.
- **#4 전용 throttle · #5 MemoryStorage · #6 S3Service `@Global` 승격** — 미조치. 셋 다
  리뷰가 "현 규모에서 위험 낮음 / 기존 컨벤션 준수 / 조치 불요" 로 판정한 항목이다.

## 사용자 결정이라 뒤집지 않은 것

**공개 버킷 + 공개 URL** 은 사용자가 세 안(공개 URL / 서명 URL / 백엔드 프록시) 중 명시적으로
고른 것이다(2026-08-31). 아바타가 URL 을 아는 누구나에게 읽힌다는 것은 **받아들인 대가**이지
결함이 아니다. 완화(키 UUID · SVG 제외 · Content-Type 파생 · ListBucket 금지)는 전부 코드와
문서에 고정돼 있다.

## 검증

lint(`--max-warnings 0`) · prettier · backend **439 suites / 9126 passed, 1 skipped**
(종전 437/9110) · docs 가드 **3104** · 뮤테이션 **9축 전부 예측 RED / 실측 RED**, 원복 확인.
