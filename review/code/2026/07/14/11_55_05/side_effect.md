# 부작용(Side Effect) 리뷰 — codebase/backend/Dockerfile

## 검토 방법

대상 diff(커밋 `aec1edcf1`)만 격리해 확인(이전 커밋 `ef3617a79`의 deploy/runner 리팩터와
혼동하지 않도록 `git show aec1edcf1 -- codebase/backend/Dockerfile` 로 재확인).
`deps` 스테이지의 `COPY codebase/packages ./codebase/packages`(6개 패키지 전체 소스)를
backend 의존 closure 4개(`expression-engine`/`node-summary`/`chat-channel-validation`/
`graph-warning-rules`)의 per-package COPY 로 좁힌 변경.

교차 검증한 근거:
- `codebase/backend/package.json` dependencies 는 `@workflow/{chat-channel-validation,
  expression-engine, graph-warning-rules, node-summary}` 4개만 선언 — `sdk`/`web-chat-sdk`
  의존 없음 (grep 으로 backend `src`/`test` 어디서도 `@workflow/sdk`, `@workflow/web-chat-sdk`
  참조 0건 확인).
- `deps` 스테이지의 설치 커맨드는 `pnpm install --frozen-lockfile --filter "backend..."`
  — `--filter "backend..."` 는 backend 와 **그 의존 패키지만** 선택하므로, 소스가 COPY
  되어 있었어도 이전에도 `sdk`/`web-chat-sdk` 는 install target 밖이라 실제로 설치·
  prepare(tsc) 되지 않았다. 즉 이번 변경 전에도 그 두 패키지의 소스는 backend 이미지
  기능에 기여하지 않는 "죽은 build-context" 였다.
- manifest(`package.json`) COPY 는 6개 그대로 유지 — `--frozen-lockfile` 워크스페이스
  정합성 검증에는 영향 없음(확인됨, diff 상에도 manifest COPY 라인은 미변경).

### (1) deps/builder 스테이지의 다른 소비자 — e2e `backend-e2e-runner`

`docker-compose.e2e.yml` 의 `backend-e2e-runner` (`target: deps`) 와 `docker-compose.yml`
의 dev `backend` (`target: deps`) 를 확인. 둘 다 `pnpm run test:e2e` / `pnpm run start:dev`
실행 전 이미지가 설치한 `node_modules`(anonymous volume 으로 보존)에 의존하며, 이 node_modules
는 위와 동일하게 `--filter "backend..."` 로 해소된 것이라 `sdk`/`web-chat-sdk` 를 포함한 적이
원래 없다. 따라서 `backend-e2e-runner` 가 이 두 패키지 소스 부재로 영향을 받을 경로가 없다 —
253개 e2e 통과 결과와 일치.

### (2) deploy/runner 스테이지

이번 diff 범위(`aec1edcf1`)에는 `deploy`/`runner` 스테이지 변경이 없다(그 리팩터는 선행
커밋 `ef3617a79`). 런타임 산출물(이미지 레이어 구성·`node dist/main` 엔트리포인트)에 대한
델타는 없음 — 빌드 캐시 무효화 범위만 좁아졌다.

### (3) frontend Dockerfile (미변경) 독립성

`codebase/frontend/Dockerfile` 은 `COPY codebase/packages ./codebase/packages` (6개 전체)
를 그대로 유지 — frontend 는 `channel-web-chat`/`@workflow/web-chat`(→`web-chat-sdk`→`sdk`)
closure 상 6개 모두 필요하므로 정확히 변경 대상이 아니다. 커밋 메시지에도 이 근거가 명시돼
있고 실제 파일도 미변경임을 확인.

## 발견사항

- **[INFO]** 신규 backend 워크스페이스 의존 추가 시 Dockerfile COPY 목록 수동 동기화 필요
  - 위치: `codebase/backend/Dockerfile` L34-41 (per-package COPY 4줄)
  - 상세: backend `package.json` 에 `@workflow/*` 신규 워크스페이스 의존을 추가하면서
    Dockerfile 의 per-package COPY 목록에 대응 라인을 빠뜨리면, 해당 패키지 소스가
    `deps` 스테이지에 존재하지 않아 `pnpm install --filter "backend..."` 가 그 패키지의
    `prepare`(tsc) 단계에서 소스를 찾지 못해 실패한다. 침묵 실패는 아니고(docker build
    에러로 즉시 드러남) 코멘트에도 이미 명시돼 있어 유지보수자가 인지할 수 있으나, 두
    지점(package.json 의 dependencies vs Dockerfile 의 COPY 목록)이 자동 검증 없이
    수동으로 맞아떨어져야 하는 결합(coupling)이 새로 생긴 것은 사실이다.
  - 제안: 현재 수준(주석 경고 + docker build 실패로 포착)으로 충분히 완화돼 있음. 필요시
    CI 에 "backend package.json 의 workspace deps ⊆ Dockerfile COPY 목록" 을 검증하는
    가벼운 스크립트를 추가하면 drift 를 build 실패 이전에 정적으로 잡을 수 있음(선택적
    개선, 현재 리스크는 낮음).

이 외 CRITICAL/WARNING 항목 없음. 함수 시그니처·공개 API·전역 상태·환경변수·네트워크
호출·이벤트/콜백 관점에서는 해당 사항 자체가 없음(순수 Dockerfile build-context 변경).

## 요약

이번 변경은 `codebase/backend/Dockerfile` 의 `deps` 스테이지에서 내부 패키지 **소스**
COPY 범위를 6개 전체에서 backend 가 실제 의존하는 4개(`expression-engine`/`node-summary`/
`chat-channel-validation`/`graph-warning-rules`)로 좁힌 것으로, `--filter "backend..."`
install 이 원래부터 `sdk`/`web-chat-sdk` 를 설치 대상에서 제외해왔기 때문에 런타임 동작·
산출 이미지 레이어(`deploy`/`runner` 스테이지 미변경)에는 델타가 없고 docker layer 캐시
히트율 개선 효과만 있다. e2e `backend-e2e-runner`(target=deps, 호스트 bind-mount) 도 동일
`--filter` 로 해소된 node_modules 를 그대로 사용하므로 영향 없음(253 e2e 통과와 일치),
frontend Dockerfile 은 독립적으로 6개 전체를 유지해 미변경. 유일한 잔여 리스크는 향후
backend 가 신규 `@workflow/*` 의존을 추가할 때 Dockerfile COPY 목록을 수동으로 함께
갱신해야 하는 결합인데, 누락 시 docker build 단계에서 즉시(비침묵) 실패하도록 이미 설계돼
있어 실질 위험은 낮다.

## 위험도

LOW
