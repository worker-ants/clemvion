# 테스트(Testing) 코드 리뷰 — 아바타 이미지 업로드(공개 버킷 + 공개 URL)

## 발견사항

- **[WARNING]** 공개 버킷 정책(`avatars-public-read.json`)의 실제 동작(익명 GET 200 / ListBucket 403)을 검증하는 자동화 테스트가 없다 — 수동 재현 명령만 존재한다
  - 위치: `scripts/minio/README.md`(재현 명령만 문서화), `docker-compose.e2e.yml:87-96`(`volumes:` 마운트 + `mc anonymous set-json`), `docker-compose.yml:59-76`(동일 패턴). 자동 테스트 파일 부재 — `find codebase/backend/test -iname '*avatar*'` 0건, `grep -rln "attach(\|multer\|multipart" codebase/backend/test/*.e2e-spec.ts` 0건.
  - 상세: CHANGELOG·`scripts/minio/README.md` 자체가 "`mc anonymous set download` 는 실측으로 기각했다 — ListBucket 을 함께 열어 UUID 를 포함한 전체 키를 열거할 수 있었다" 는 사실을 강조하고, `명시 정책으로 바꾼 뒤 목록 403 · GET 200 을 확인했다`고 적는다. 그런데 그 확인은 **사람이 curl 로 한 번 돌린 결과**이지, CI 에서 반복 실행되는 테스트가 아니다. `docker-compose.e2e.yml` 은 이미 MinIO 를 부팅하고 정책까지 적용하므로 e2e Jest 스위트에서 실제로 아바타를 업로드한 뒤 `fetch(publicUrl)` 로 200 을, `fetch(bucketUrl + '?list-type=2&prefix=avatars')` 로 403 을 확인하는 것이 기술적으로 가능하다. 이 축은 이 PR 이 반복해서 "동작은 하는데 잘못된 채로 동작해서 테스트가 아니면 드러나지 않는다"고 스스로 규정한 세 위험 중 **키 추측 불가능성(접근 통제)** 과 직결되는데, 정작 그 통제를 실제로 강제하는 인프라 설정(JSON 정책 파일·`mc anonymous set-json` 커맨드)은 회귀 보호가 전혀 없다. 누군가 `avatars-public-read.json` 을 실수로 되돌리거나(`set download` 로) `docker-compose*.yml` 의 마운트/명령을 지워도, 유닛 테스트(`S3Service` 전량 mock)는 전부 GREEN 을 유지한다.
  - 제안: e2e 스위트에 최소 1개 스펙을 추가해 (1) 실제 로그인 사용자로 `POST /api/users/me/avatar` 호출 → 응답의 `avatarUrl` 을 익명 `fetch` 로 GET 해 200 을 확인, (2) 같은 버킷에 `?list-type=2&prefix=avatars` 로 익명 GET 해 403/AccessDenied 를 확인한다. 인프라(JSON 정책 파일·compose 커맨드)의 정합성을 검증하는 유일한 방법이라 위험 대비 비용이 낮다.

- **[WARNING]** "빈 파일을 거부한다" 테스트가 실제로는 **파일 부재**만 검증하고, 코드가 막는 세 조건(`file` 없음/`file.buffer` 없음/`buffer.length===0`) 중 "버퍼 길이 0" 분기를 가르지 못한다
  - 위치: `codebase/backend/src/modules/users/users-avatar.service.spec.ts:145-151`(`it('빈 파일을 거부한다', ...)`, `service.updateAvatar(USER_ID, undefined)` 호출) / 대상 가드: `codebase/backend/src/modules/users/users.service.ts:83`(`if (!file?.buffer?.length) {`)
  - 상세: 가드는 `file` 자체가 `undefined` 인 경우, `file.buffer` 가 없는 경우, `file.buffer.length === 0`(빈 이미지 파일)인 경우 셋 다 막아야 한다. 그런데 이 테스트는 세 번째 인자로 `undefined`(파일 자체 부재)만 넘긴다. `!file?.buffer?.length` 를 `!file` 로 뮤테이션해도(즉 "빈 버퍼" 방어를 완전히 제거해도) 이 테스트는 여전히 GREEN 이다 — `undefined` 는 `!file` 로도 걸리기 때문이다. 실제로 컨트롤러 레벨에서는 `file` 객체 자체가 없을 일은 거의 없다(multer 가 `file` 필드 부재 시에도 `undefined` 를 넘기지만, "파일은 첨부했는데 내용이 0바이트"인 케이스가 이 서비스 레벨 가드의 진짜 표적이다). 이 PR 의 다른 테스트들은 이런 "분기를 못 가르는 fixture" 문제를 정확히 짚어 왔다(예: 대문자 확장자, Content-Type 값 전수 대조 — 전부 "이 조건을 지워도 GREEN 이었다"는 실측 코멘트가 달려 있다). 같은 기준을 이 가드에는 적용하지 않았다.
  - 제안: `makeFile()` 과 별개로 `{ originalname: 'me.png', buffer: Buffer.alloc(0), mimetype: 'image/png' }` 형태의 실제 "파일은 있는데 빈 버퍼" 케이스를 추가한다. `file` 자체가 없는 케이스(컨트롤러가 `@UploadedFile()` 로 못 채운 경우)는 별도로 유지해도 되지만, 현재 테스트명("빈 파일")과 실제로 검증하는 조건("파일 없음")이 어긋나 있어 다음 사람이 커버리지를 오독하기 쉽다.

- **[INFO]** 동시(중복) 아바타 업로드 시 "패자"의 신규 S3 객체가 영구 고아로 남는 race 는 테스트로 방어되지 않지만, 이미 문서화되어 유예된 항목이라 새 지적은 아니다
  - 위치: `codebase/backend/src/modules/users/users.service.ts:122-147`(`updateAvatar` — `previousUrl` 캡처와 `deletePreviousAvatarObject` 호출), 회귀 테스트는 전부 `users-avatar.service.spec.ts` 축 3 에서 순차 `await` 로만 구성된다(예: `축 3` describe 블록 전체, `197행` "정리 실패가 업로드를 깨뜨리지 않는다" 등).
  - 상세: `CHANGELOG.md` 가 스스로 "없앤 것은 '다른 컬럼' 경쟁뿐이다. 같은 사용자가 동시에 두 번 업로드하면 `avatarUrl` 자체를 두고 여전히 경합하고, 패자가 올린 객체는 고아로 남는다"고 명시하고, `plan/in-progress/spec-sync-user-profile-gaps.md:79-88`("리뷰 2라운드에서 유예한 두 건 — 동시 업로드 TOCTOU — 고아 객체")에 추적 항목으로 등재돼 있다. 즉 이 갭은 팀이 실측 검토(concurrency 리뷰 WARNING) 후 의도적으로 유예한 것이며, 이번 라운드에서 새로 발견한 사항이 아니다.
  - 제안: 조치 불요 — 유예 항목이 살아 있는 한 테스트를 요구하지 않는다. 다만 그 plan 항목이 실제로 착수될 때, 이 파일의 축 3 테스트들에 동시성(Promise.all 두 번 병렬 호출) 케이스를 추가해야 한다는 점만 남겨 둔다.

- **[INFO]** `UsersService.update()` 의 아바타 정리 조건(`previousUrl && previousUrl !== updated.avatarUrl`)이 "다른 URL로 교체" 케이스만 테스트되고, "avatarUrl 을 `null` 로 제거"하는 케이스는 테스트되지 않는다
  - 위치: `codebase/backend/src/modules/users/users-avatar.service.spec.ts:270-325`(`describe('UsersService.update — PATCH 로 아바타를 바꿔도 옛 객체를 정리한다')` — `build('https://gravatar.example/x')`, `build(OLD)` 두 케이스만 존재), 대상 로직: `codebase/backend/src/modules/users/users.service.ts:234-248`
  - 상세: `PATCH /api/users/me` 로 `avatarUrl: null` 을 보내 아바타를 제거하는 시나리오(예: `UpdateMeDto` 가 이를 허용한다면)에서도 같은 조건식이 참이 되어 정리가 일어나야 하는데, 이 전이(비어있지 않은 값 → `null`)를 직접 고정하는 테스트가 없다. 로직상 별도 분기가 아니라 값 비교만 다르므로 실패 위험은 낮지만, "값이 바뀌면 지운다"는 불변식을 조건식이 아니라 값 하나로만 실증하고 있어 엄밀히는 gap 이다.
  - 제안: 필요 시 `it('avatarUrl 을 null 로 지워도 옛 객체를 정리한다', ...)` 한 케이스만 추가하면 충분하다. 우선순위는 낮음.

- **[INFO]** `main.ts` 의 신규 production 부팅 경고(`resolvePublicBaseUrl` + `isPrivateHost` 조합, `NODE_ENV==='production'` 게이트)는 테스트 커버리지가 전혀 없다 — 다만 같은 파일의 기존 `ALLOW_PRIVATE_HOST_TARGETS` warn 블록도 동일하게 미검증이라 새로운 패턴은 아니다
  - 위치: `codebase/backend/src/main.ts:160-174`
  - 상세: `production-guards.ts` 의 JSDoc 이 "throw 정책은 `production-guards.ts`, warn 정책은 `main.ts`(호출자)가 담당"이라고 명시적으로 컨벤션을 규정하고 있고, `production-guards.spec.ts` 는 그 throw 함수(`assertProductionConfig`)만 순수 함수로 단위 테스트한다 — `main.ts` 안의 warn 블록들(`ALLOW_PRIVATE_HOST_TARGETS` 포함)은 이 저장소에서 애초에 단위 테스트 대상이 아니다. 이번 PR 이 추가한 `S3_PUBLIC_BASE_URL` 경고도 같은 컨벤션을 따랐을 뿐이라 이 자체가 새로운 결함은 아니다. 다만 CHANGELOG 는 이 경고를 "신규 env 를 k8s overlay 에 전파하지 않아 base 의 localhost 기본값이 프로덕션에 실릴 뻔한 근접사고가 실제로 있었고, 그 클래스의 backstop"이라고 스스로 무게를 싣는다 — 그 정도로 중요하다고 명시한 코드치고, `resolvePublicBaseUrl(process.env)` 와 `isPrivateHost(...)` 를 합성한 조건식 자체(`if (publicBase && isPrivateHost(publicBase))`, `:167`)는 각 부품(`s3.config.spec.ts`, 그리고 프로젝트 어딘가의 `isPrivateHost` 소비처 테스트)만 따로 검증될 뿐, 이 합성 지점 자체는 어디서도 실행되지 않는다.
  - 제안: 저장소 컨벤션을 바꾸라는 요구는 아니다. 다만 이 조건식만이라도 별도 순수 함수(예: `shouldWarnPrivatePublicBase(env, isPrivateHostFn)`)로 뽑아 한 줄짜리 단위 테스트를 붙이면, "합성이 깨졌는데 부품 테스트는 다 통과"하는 사각을 없앨 수 있다. 강제 사항 아님.

## 긍정적으로 짚을 점 (참고)

- `s3.config.spec.ts`/`s3.service.spec.ts` 의 `beforeEach`/`afterEach` env 저장·복원, 매 테스트 독립 `Test.createTestingModule` 구성 — 테스트 격리가 잘 지켜졌다.
- `users.service.spec.ts`/`users-avatar.service.spec.ts` 양쪽에서 `S3Service` mock 을 "예상 밖 호출 시 throw" 로 구성한 것은 조용한 no-op mock 이 회귀를 숨기는 것을 막는 좋은 패턴이다.
- `users-avatar.service.spec.ts` 는 이전 세 라운드 리뷰에서 실측으로 잡힌 vacuous 테스트(부분 매칭 정규식·첫 occurrence 만 검사·분기를 못 가르는 fixture)를 각 테스트 주석에 "왜 이 형태인가"로 명시해 재발을 막고 있다 — 가독성·의도 전달이 뛰어나다.
- `users-avatar-swagger-sync.spec.ts` 의 "전수 열거 + 정확히 일치" 방식은 이전 라운드의 "접두어 요구 정규식이라 값이 갈려도 GREEN" 결함을 구조적으로 재발 못 하게 고쳤다.
- `updateAvatar 는 avatarUrl 단 하나만 싣는다` 테스트(`users-avatar.service.spec.ts:339-380`)는 lost-update CRITICAL 을 `Object.keys(patch)` 정확 비교로 고정해 다음 사람이 컬럼을 실수로 추가해도 즉시 잡히게 했다.
- 확장자 프로토타입 체인 가드 테스트는 실제로 뚫리는 2개(`constructor`/`__proto__`)와 vacuous 한 5개를 구분해 "왜 나머지는 이 가드를 가르지 못하는지"까지 남겼다 — 근거 없는 커버리지 과신을 막는다.

## 요약

핵심 서비스 로직(`UsersService.updateAvatar`/`update`, `S3Service.getPublicUrl`, `resolvePublicBaseUrl` 3단 폴백)은 세 라운드에 걸친 리뷰 피드백을 반영해 테스트가 매우 촘촘하고, 특히 "분기를 못 가르는 fixture"·"부분 매칭 정규식" 류의 vacuous 테스트를 실측으로 잡아 재발 방지 주석까지 남긴 점이 인상적이다. 이번 라운드에서 새로 확인한 갭은 두 가지다 — (1) 이 기능의 핵심 보안 통제인 MinIO 버킷 정책(익명 GET 허용·ListBucket 차단)이 자동화 테스트 없이 수동 curl 재현에만 의존하고, (2) "빈 파일 거부" 테스트가 이름과 달리 파일-부재만 검증해 버퍼-길이-0 분기를 실제로 가르지 못한다(뮤테이션 생존 가능). 나머지 항목(동시 업로드 race, `update()` null 전이, `main.ts` 경고 조합 테스트 부재)은 이미 문서로 유예됐거나 기존 컨벤션과 일관돼 있어 낮은 우선순위다.

## 위험도

MEDIUM
