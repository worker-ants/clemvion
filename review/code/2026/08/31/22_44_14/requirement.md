# 요구사항(Requirement) 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)

## 검증 방법
- 전체 diff(21개 파일)를 직접 읽고, 프롬프트가 잘려 표시하지 못한 `CHANGELOG.md`·`README.md`·`.env.example`·`users.controller.ts`·`users.controller.spec.ts`·`k8s/README.md`를 `Read`로 전문 확인.
- 신규/변경 테스트 6개 스위트(61 tests)를 `npx jest`로 실행 — 전부 GREEN (`users-avatar.service.spec.ts`, `users-avatar-swagger-sync.spec.ts`, `users.controller.spec.ts`, `users.service.spec.ts`, `s3.service.spec.ts`, `s3.config.spec.ts`).
- 변경 파일 대상 `npx tsc --noEmit`·`npx eslint` 실행 — 신규/변경 코드 자체의 타입/린트 에러 없음(전체 backend에 존재하는 tsc 에러들은 전부 이 PR과 무관한 파일이며, `users.service.spec.ts:124`의 사전 존재 캐스트 에러는 `origin/main`에도 동일하게 존재함을 `git show origin/main:...`으로 확인).
- 저장소 트리는 뮤테이션하지 않았다(정규식 동작 확인은 파일과 무관한 독립 `node -e` 스니펫으로만 수행). `git status --short` 최종 확인 결과 clean.
- `spec/2-navigation/9-user-profile.md`, `spec/data-flow/4-file-storage.md`를 직접 열어 plan 문서가 주장하는 spec 불일치를 실측 대조.

## 발견사항

- **[WARNING]** `CHANGELOG.md`가 서술하는 리네임 대상 식별자명이 실제 코드와 다르다.
  - 위치: `CHANGELOG.md:30` (신설 항목) / 실제 코드 `codebase/backend/src/modules/users/users.controller.ts:57`
  - 상세: CHANGELOG는 "`import Express from 'express'` 를 `ExpressModule` 로 개명했다"고 적지만, 실제 코드는 `import ExpressNS from 'express';`로 개명했고 사용처(`ExpressNS.Request`/`ExpressNS.Response`, controller.ts:214-215, 301-302)도 전부 `ExpressNS`다. 저장소 전체에서 `ExpressModule` 문자열은 CHANGELOG 안에만 존재한다(`grep -rn ExpressModule` 결과 CHANGELOG.md 1건뿐).
  - 제안: CHANGELOG의 식별자명을 `ExpressNS`로 정정한다. 사소하지만 향후 이 리네임을 grep으로 추적하려는 사람이 CHANGELOG를 믿고 잘못된 이름을 검색하게 만든다.

- **[WARNING]** Swagger 산문 동기화 테스트가 두 곳 중 한 곳만 검증한다 — 자신의 JSDoc 주장("설명이 나열한 확장자가 … 정확히 일치")보다 좁다.
  - 위치: `codebase/backend/src/modules/users/users-avatar-swagger-sync.spec.ts:26-33` (두 번째 `it` 블록, `source.match(...)` 사용) / 대조 대상 `users.controller.ts:162`(`@ApiOperation` description)와 `:175`(`@ApiBody` schema `file.description`) — 두 곳 모두 `(최대 2MB, png/jpg/jpeg/webp/gif)` 리터럴을 독립적으로 갖고 있음.
  - 상세: 확장자-목록 검증에 쓰는 정규식 `/\(최대 \d+MB, ([a-z/]+)\)/`는 `g` 플래그 없이 `.match()`로 호출된다 — JS 의미상 **첫 번째 매치만** 반환한다(파일 상 첫 매치는 `@ApiOperation`의 description). 반면 바로 위 첫 번째 `it`(MB 숫자 검증)는 `matchAll(/최대 (\d+)MB/g)`로 **전역** 매치라 두 위치 모두 검사한다. 독립적으로 재현: `node -e` 로 두 번째 리터럴만 `gif`→`svg`로 바꾼 문자열을 같은 정규식에 넣으면 `.match()`는 첫 번째("gif")만 반환해 드리프트를 놓치는 것을 확인했다(저장소는 건드리지 않고 문자열 리터럴로만 검증). 즉 `@ApiBody`의 확장자 목록이 향후 `AVATAR_CONTENT_TYPES`와 갈려도(예: SVG를 조용히 허용) 이 테스트는 계속 GREEN이다 — 테스트 자신의 주석("SVG 를 조용히 허용해도 통과하면 안 된다")이 두 번째 위치에서는 지켜지지 않는다.
  - 제안: `matchAll(/\(최대 \d+MB, ([a-z/]+)\)/g)`로 바꿔 발견된 모든 매치를 순회 검증하거나, 두 리터럴을 하나의 상수/헬퍼로 통합해 애초에 두 곳에 흩어지지 않게 한다.

- **[INFO] `[SPEC-DRIFT]`** `spec/2-navigation/9-user-profile.md`가 여전히 "미구현 (Planned)"으로 서술 — 이미 developer가 올바르게 planner 트랙으로 위임한 상태.
  - 위치: `spec/2-navigation/9-user-profile.md:136`("이미지 파일 업로드는 미구현 (Planned)"), `:334`(`~~POST~~ ~~/api/users/me/avatar~~ … 미구현 (Planned)`) — 직접 `Read`로 실측 확인. `spec/data-flow/4-file-storage.md:58,71,78`도 `{workspaceId}/avatars/{userId}.{ext}` 키 패턴(실제 구현은 `avatars/{userId}/{uuid}.{ext}` — `workspaceId` 없음, UUID 파일명)과 "미구현"을 유지 — 마찬가지로 실측 확인.
  - 상세: 코드가 spec보다 앞서 있고, 이는 CLAUDE.md의 자기-반증형 소정정 예외에 해당하지 않는(developer가 쓴 예고가 아니라 제품 정의 서술) 정당한 케이스다. `plan/in-progress/spec-update-avatar-upload-implemented.md`가 세 문서(9-user-profile.md·0-overview.md §2.7·data-flow/4-file-storage.md) 전부를 정확한 라인 근거와 함께 planner 위임으로 이미 등재했고, "배지만 뒤집지 말고 공개 버킷/URL이라는 제품 속성을 함께 적으라"는 지침까지 명시했다. 코드 쪽 처리는 옳다 — 이 항목은 spec 갱신 누락이지 코드 버그가 아니다.
  - 제안: (코드 수정 아님) `project-planner`가 `plan/in-progress/spec-update-avatar-upload-implemented.md`의 할 일을 실행해 §6.1 표(`:334`)·§2.1 아바타 행(`:136`)·`0-overview.md §2.7`·`data-flow/4-file-storage.md §1.1/§1.2/§2.1/§2.2/§2.3`을 갱신. 이미 plan에 반영되어 있으므로 이 리뷰가 새로 요구하는 조치는 없음.

- **[INFO]** `FILE_REQUIRED`/`INVALID_FILE_TYPE` 에러 코드가 `spec/5-system/3-error-handling.md` 카탈로그에 없다.
  - 위치: `codebase/backend/src/modules/users/users.service.ts:77`(`FILE_REQUIRED` 신규), `:88`(`INVALID_FILE_TYPE`, `knowledge-base.service.ts:928`와 공용 — grep으로 재사용 확인).
  - 상세: `spec/5-system/3-error-handling.md`에 두 코드 모두 0건(`grep` 확인). `INVALID_FILE_TYPE`은 이 PR 이전부터 존재하던 미등재 상태라 이 PR이 만든 회귀는 아니다. `plan/in-progress/spec-update-avatar-upload-implemented.md`의 할 일 목록에 두 코드의 카탈로그 등재가 이미 포함돼 있어 별도 조치 불요.
  - 제안: 없음(추적됨).

- **[INFO]** 동시 아바타 업로드 시 레이스로 새로 올린 객체 하나가 고아로 남을 수 있는 경로가 회귀 테스트에 없다.
  - 위치: `codebase/backend/src/modules/users/users.service.ts:68-107` (`updateAvatar`).
  - 상세: `updateAvatar`는 (1) 현재 `avatarUrl` 읽기 → (2) 신규 업로드 → (3) DB 저장 → (4) 옛 객체 삭제 순으로 동작한다. 같은 사용자가 거의 동시에 두 번 업로드하면, 두 요청 모두 (1)에서 같은 `previousUrl`(원래 아바타)을 읽고 각자 새 객체를 업로드한 뒤 (3) 저장은 "마지막 쓰기 승리"가 된다. 진 쪽 요청이 방금 올린 새 객체는 어느 요청의 (4)에서도 그 키를 대상으로 삼지 않으므로(두 요청 다 자신이 읽은 `previousUrl`만 지운다) 영구 고아로 남는다. CHANGELOG/JSDoc이 명시적으로 정의한 3대 위험 중 "교체 시 옛 객체가 남는 것"과 같은 계열이지만, 13개 회귀 테스트 중 동시성 케이스는 없다.
  - 제안: 저비용/저확률 edge case이고 고아 객체는 기능 정상성이 아니라 과금·용량에만 영향(문서가 이미 그렇게 규정)이므로 필수 차단 사유는 아니다. 다만 향후 정리 job(orphan sweeper) 설계 시 이 경로를 covered case로 등재해 두면 좋다.

- **[INFO]** `s3.service.ts`의 `publicBaseUrl` 폴백 주석과 구현이 미묘하게 어긋난다(기능 영향 없음).
  - 위치: `codebase/backend/src/common/services/s3.service.ts:32-35`.
  - 상세: 주석은 "미설정 시 `endpoint` 폴백은 `s3.config.ts` 가 한다 — 여기서 다시 폴백하면 폴백 규칙이 두 곳이 되어 갈라진다"고 적지만, 바로 아래 코드는 `this.configService.get<string>('s3.publicBaseUrl') ?? endpoint`로 로컬 폴백을 여전히 갖고 있다. 실제로는 `s3.config.ts`의 `publicBaseUrl`이 3단 폴백(`S3_PUBLIC_BASE_URL || S3_ENDPOINT || 'http://localhost:9000'`)으로 항상 truthy 값을 반환하므로 이 `?? endpoint`는 정상 경로에서 도달 불가능한 방어 코드이고, 도달하더라도 같은 `endpoint` 값으로 수렴해 "두 곳이 갈라진다"는 주석의 우려는 실제로 발생하지 않는다. 즉 버그는 아니지만 주석이 "여기서 폴백을 안 한다"고 읽히는데 코드는 폴백을 갖고 있어 다음 사람이 헷갈릴 수 있다.
  - 제안: 주석을 "config 조회 자체가 실패(테스트 mock 등)할 때의 방어적 이중 안전장치"로 정정하거나, 정말 불필요하다고 판단되면 `?? endpoint`를 제거한다. 낮은 우선순위.

- **[INFO]** 신규 엔드포인트(`POST /api/users/me/avatar`)에 대한 backend supertest e2e 또는 frontend Playwright e2e가 없다.
  - 위치: `codebase/backend/test/`, `codebase/frontend/e2e/` — `grep -rl "me/avatar\|uploadAvatar"` 결과 0건.
  - 상세: 유닛 테스트는 `S3Service`를 mock해 로직 분기를 촘촘히 덮지만, 실제 MinIO에 대한 멀티파트 업로드 → `forcePathStyle` 버킷 경로 → `getPublicUrl` 조립의 왕복 자체는 어떤 계층에서도 실행되지 않는다. `docker-compose.e2e.yml`·`docker-compose.yml`·`k8s/base/configmap.yaml`·`k8s/overlays/local/configmap-patch.yaml` 네 곳 모두 `S3_PUBLIC_BASE_URL`을 추가했고 e2e 파일 주석은 명시적으로 "브라우저(Playwright)가 도달할 주소"라고 적어 e2e 소비를 염두에 둔 것으로 보이지만, 이번 PR에는 그 소비자가 없다.
  - 제안: 필수 차단 사유는 아니다(유닛 커버리지가 두텁고, `plan` 문서가 "회귀 테스트 13건·뮤테이션 6축"을 사용자 결정에 따른 의도적 범위로 명시). 다만 공개 버킷 정책이 실제로 열려 있는지(익명 GET 허용) 검증하는 것은 유닛 테스트로는 원천적으로 불가능한 영역이라, 후속 e2e 항목으로 남겨둘 가치가 있다.

## 요약
핵심 로직(`UsersService.updateAvatar`/`deletePreviousAvatarObject`/`S3Service.getPublicUrl`)은 CHANGELOG·JSDoc이 서술한 세 가지 "조용한 실패" 위험(추측 가능한 키·클라이언트 mimetype 신뢰·정리 순서 역전)을 정확히 코드로 반영했고, 이전 리뷰 라운드가 잡은 CRITICAL(퍼센트 인코딩 파싱이 try 밖)과 WARNING(PATCH 경로의 고아 객체)도 회귀 테스트로 고정된 채 현재 코드에 반영돼 있다(관련 61개 테스트 전부 GREEN, 신규 파일 tsc/eslint 클린). 파일 크기 초과 시 413 매핑도 NestJS/multer 내부 구현으로 실측 확인했다. 남은 이슈는 전부 CRITICAL이 아니다 — CHANGELOG의 식별자명 오기, swagger 동기화 테스트가 두 리터럴 중 하나만 지키는 커버리지 좁음, spec 3개 문서의 "미구현" 배지가 아직 planner 위임 대기 중인 SPEC-DRIFT(이미 정확한 라인 근거로 등재돼 있어 developer 쪽 처리는 적절함), 에러 카탈로그 미등재, 동시 업로드 레이스로 인한 고아 객체 미검증, 그리고 신규 엔드포인트의 e2e 부재. 전반적으로 요구사항 충족도는 높고, 발견된 항목은 문서 정확성과 테스트 커버리지 보강 성격이다.

## 위험도
LOW
