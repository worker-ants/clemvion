# 문서화(Documentation) Review — 아바타 업로드 (공개 버킷 + 공개 URL)

## 발견사항

- **[WARNING]** CHANGELOG·plan 문서가 실제 코드와 다른 심볼명을 적었다 (`ExpressModule` vs `ExpressNS`)
  - 위치: `CHANGELOG.md:30`, `plan/in-progress/spec-sync-user-profile-gaps.md:64`
  - 상세: 두 문서 모두 "`import Express from 'express'` 를 **`ExpressModule`** 로 개명했다" 고 적었다.
    그러나 실제 코드(`codebase/backend/src/modules/users/users.controller.ts:57`)는
    `import ExpressNS from 'express';` 이고, 사용처도 `ExpressNS.Request`/`ExpressNS.Response`
    (같은 파일 214-215, 301-302줄)이다. `ExpressModule` 이라는 이름은 코드 어디에도 없다
    (`grep -n "ExpressModule" codebase/backend/src/modules/users/users.controller.ts` → 0건).
    두 문서에 동일한 오기가 반복된 것으로 보아 초안 단계의 이름(`ExpressModule`)을 실제
    구현에서 `ExpressNS` 로 바꾼 뒤 문서를 갱신하지 않은 것으로 보인다.
  - 제안: 두 파일의 `ExpressModule` → `ExpressNS` 로 정정.

- **[WARNING]** `updateAvatar` JSDoc 의 `@throws` 목록이 실제로 던지는 예외를 누락
  - 위치: `codebase/backend/src/modules/users/users.service.ts:66` (JSDoc) vs `:94` (실제 throw)
  - 상세: `updateAvatar` 의 JSDoc 은 `@throws BadRequestException 파일 부재·허용되지 않는 확장자.`
    한 줄만 적었지만, 구현은 `if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND' });`
    (94줄)도 던진다 — 컨트롤러의 `@ApiNotFoundResponse({ description: '사용자를 찾을 수 없음' })`
    (Swagger 문서)는 이 경로를 이미 반영하고 있으므로 서비스 JSDoc 만 뒤처졌다. 같은 파일의
    `changePassword` JSDoc(209-211줄)은 `@throws NotFoundException`·`@throws
    UnauthorizedException`·`@throws BadRequestException` 셋을 모두 열거하는 관례를 따르고
    있어, `updateAvatar` 만 그 관례에서 벗어난 것으로 보인다.
  - 제안: `@throws NotFoundException \`USER_NOT_FOUND\` — 사용자 없음` 한 줄 추가.

- **[WARNING]** 반복 경고되는 "버킷 정책" 전제가 로컬/e2e 환경에는 실제로 적용돼 있지 않고, 여는 방법도 문서화되지 않음
  - 위치: `docker-compose.yml:49-66` (`createbuckets` 서비스), `docker-compose.e2e.yml:78-93` (동일)
  - 상세: CHANGELOG(`CHANGELOG.md:25-28`)·`.env.example`(150-161줄)·`k8s/README.md`(183줄)가
    반복해서 "`avatars/` 접두에 익명 GET 을 허용하는 버킷 정책이 필요하다. 없으면 업로드는
    성공하고 이미지만 403 이 된다" 고 경고한다. 그런데 `docker-compose.yml`/`docker-compose.e2e.yml`
    의 `createbuckets` 엔트리포인트는 `mc mb local/workflow-storage --ignore-existing;` 로
    **버킷 생성만** 하고, `mc anonymous set`/`mc policy set` 같은 공개 읽기 정책 설정은 어디에도
    없다(`grep -rn "anonymous set\|policy set" .` → 0건, Makefile 포함). 즉 문서가 경고하는
    바로 그 실패(업로드 성공·이미지 403)를 로컬 dev/e2e 환경에서 기본값 그대로 재현하게 되는데,
    그걸 여는 방법(수동 `mc` 명령이든 `createbuckets` 자동화든)이 어느 문서에도 없다.
    plan 의 측정치("S3 객체를 브라우저로 서빙하는 선례 0건")대로 이 기능이 첫 사례라 참고할
    기존 정책도 없다. e2e 스펙도 이 경로를 검증하지 않는다(`grep -rln avatar
    codebase/backend/test/` → 0건) — 있었다면 이 갭이 CI 에서 드러났을 것이다.
  - 제안: 최소한 README/`.env.example`/CHANGELOG 중 한 곳에 로컬에서 정책을 여는 `mc anonymous
    set download local/workflow-storage/avatars` (또는 동등) 명령을 예시로 남기거나,
    `createbuckets` 엔트리포인트에 그 단계를 자동화해 문서의 경고와 실제 동작을 일치시킬 것.

- **[INFO]** CHANGELOG 의 spec 갱신 서술이 실제 추적 범위보다 좁다
  - 위치: `CHANGELOG.md:35-37`
  - 상세: "spec `9-user-profile.md` 의 '미구현 (Planned)' 배지 flip 은 … planner 트랙으로
    분리했다" 고만 적어 마치 spec 문서 한 곳만 갱신 대기 중인 것처럼 읽힌다. 그러나 같은 커밋에
    새로 생성된 `plan/in-progress/spec-update-avatar-upload-implemented.md`(37-52줄)는 실제로
    `9-user-profile.md` 외에 `spec/0-overview.md §2.7`·`spec/data-flow/4-file-storage.md`·
    `spec/5-system/3-error-handling.md` 까지 **총 4개** spec 문서가 갱신 대상이라고 명시한다
    (그 문서 22줄: "리뷰(2026-08-31)가 `0-overview.md §2.7` 과 `data-flow/4-file-storage.md`
    누락을 잡았다"). CHANGELOG 는 그 확장된 범위를 반영하지 않은 채 남아 있다.
  - 제안: CHANGELOG 문장을 "spec 갱신(4개 문서)은 planner 트랙으로 분리" 정도로 넓히거나,
    plan 링크만 남기고 문서 수를 명시하지 않는 쪽으로 두 서술의 정합을 맞출 것.

- **[INFO]** 폴백 책임을 한 곳에 두겠다는 주석과 바로 아래 코드가 상충하는 것처럼 읽힘
  - 위치: `codebase/backend/src/common/services/s3.service.ts:32-35`
  - 상세: 주석은 "미설정 시 `endpoint` 폴백은 `s3.config.ts` 가 한다 — 여기서 다시 폴백하면
    폴백 규칙이 두 곳이 되어 갈라진다" 고 재폴백을 **하지 않겠다**는 취지로 읽히는데, 바로 다음
    줄이 `this.configService.get<string>('s3.publicBaseUrl') ?? endpoint` 로 정확히 그
    "여기서 다시 폴백" 을 하고 있다. `s3Config`(`s3.config.ts`)의 `publicBaseUrl` 은 이미
    `S3_PUBLIC_BASE_URL || S3_ENDPOINT || 'http://localhost:9000'` 3단 폴백을 완결해서
    돌려주므로, 런타임에는 `configService.get('s3.publicBaseUrl')` 이 항상 값을 가져 `??
    endpoint` 가지가 실질적으로 도달 불가능해 보인다(TS 시그니처상 `string | undefined` 이므로
    타입 안전을 위한 널가드로 추정). 주석이 "우선순위 로직은 여기서 재구현하지 않는다(소유권은
    `s3.config.ts`)" 와 "그래도 타입 안전을 위한 로컬 null-fallback 은 둔다" 를 구분하지 않아,
    다음 유지보수자가 "폴백을 안 하겠다면서 왜 폴백을 하지?" 로 오독할 수 있다.
  - 제안: 주석에 "이 `?? endpoint` 는 (`s3.config.ts` 가 항상 값을 채우므로) 사실상 도달하지
    않는 TS 타입 안전 가드일 뿐, 우선순위 재구현이 아니다" 정도로 한 줄 보강.

## 요약

이번 PR 의 문서화 밀도는 전반적으로 높다 — CHANGELOG 는 서빙 전략 선택·세 가지 위험(키 추측·
Content-Type 위조·순서 반전)·배포 선행 조건을 사용자 결정 근거까지 포함해 서술했고, 신규
`S3_PUBLIC_BASE_URL` 은 README·`.env.example`·`docker-compose.yml`·`docker-compose.e2e.yml`·
`k8s/base/configmap.yaml`·`k8s/overlays/local/configmap-patch.yaml`·`k8s/README.md` 7곳에
일관되게 반영됐으며, `s3.config.ts`·`s3.service.ts`·`users.service.ts` 의 JSDoc 은 "왜"를
충실히 설명한다. spec(`9-user-profile.md`) 쓰기는 프로젝트 컨벤션대로 developer 권한 밖이라
planner 트랙(`plan/in-progress/spec-update-avatar-upload-implemented.md`)으로 올바르게
분리됐다. 다만 세부에서 흠이 있다 — CHANGELOG 와 plan 문서 두 곳에 동일하게 반복된 심볼명
오기(`ExpressModule`↔`ExpressNS`), 서비스 JSDoc 의 `@throws` 누락(같은 파일 다른 메서드의
관례와 불일치), 그리고 가장 실질적인 문제로 **반복 경고되는 "익명 GET 버킷 정책" 전제가
로컬/e2e docker-compose 에는 실제로 설정돼 있지 않고 여는 방법도 문서화되지 않아, 그대로
따르면 문서가 경고한 바로 그 실패(이미지 403)를 로컬에서 겪게 된다.** 이 마지막 항목은
"설정 문서"·"예제 코드" 관점에서 가장 우선순위가 높다.

## 위험도

MEDIUM
