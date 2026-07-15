# 의존성(Dependency) 리뷰 — codebase/frontend/Dockerfile.playwright-e2e / docker-compose.e2e.yml

## 발견사항

- **[WARNING]** base 이미지 태그(v1.59.1-jammy)와 실제 resolve 된 `@playwright/test` 버전이 이미 어긋나 있음 — 두 파일의 "major.minor 를 맞춘다" 주석이 현재 거짓
  - 위치: `codebase/frontend/Dockerfile.playwright-e2e:47` (`FROM mcr.microsoft.com/playwright:v1.59.1-jammy`), 주석 라인 45-46 / `docker-compose.e2e.yml:147-153` (동일 주장 반복)
  - 상세: SoT 인 `codebase/frontend/package.json:73` 은 `"@playwright/test": "^1.59.1"` (caret range) 인데, 실제 lockfile 해석 결과(`pnpm-lock.yaml` frontend importer devDependencies, 및 `'@playwright/test@1.61.0'` 엔트리)는 **1.61.0** 으로 고정되어 있다 — playwright-core 도 1.61.0. 즉 base 이미지 태그(1.59.1)와 실제 설치되는 `@playwright/test`/`playwright-core`(1.61.0) 사이에 **2 minor 버전** 갭이 이미 존재한다. 두 파일의 주석은 "base 태그와 major.minor 를 맞춘다 / 상향 시 함께 갱신한다"고 명시하지만 그 불변조건은 이미 깨진 상태로 머지되려 하고 있고, 이를 검증하는 자동화(CI 스크립트·lint)가 없어 향후 `^1.59.1` 범위 안에서 patch/minor 가 더 올라가도 조용히 계속 벌어질 수 있다.
  - 완화 요인(왜 CRITICAL 이 아닌지): Dockerfile 마지막 단계가 `RUN pnpm --filter frontend exec playwright install chromium` 으로, base 이미지가 내장한 브라우저가 아니라 **실제로 install 된 `@playwright/test`(1.61.0) 기준**으로 chromium 을 다시 받는다. 검증된 실행 결과(46 tests pass, `/ms-playwright/chromium-1228` baking)도 이 재설치 단계가 버전 갭을 스스로 메꿨음을 보여준다. 따라서 "browser not found" 는 현재 발생하지 않는다.
  - 잔존 리스크: (1) base 이미지가 이미 내장한 (v1.59.1 대응) chromium 바이너리가 안 쓰이는 채로 이미지에 남아 용량만 차지(아래 크기 항목), (2) OS 레벨 공유 라이브러리(glibc/libnss 등)는 base 이미지 태그(jammy, v1.59.1 시점 patch)에 고정되는데 향후 `@playwright/test` caret 이 더 최신으로 뛰어 신규 chromium 이 base 이미지의 OS 라이브러리보다 최신 요구사항을 갖게 되면 "browser not found" 가 아니라 공유 라이브러리 누락으로 실패할 수 있음 — 이 실패 모드는 현재 재설치 로직으로도 막히지 않는다.
  - 제안: base 이미지 태그를 실제 resolve 버전(1.61.x)에 맞춰 갱신하거나, 최소한 CI/Makefile 에 `package.json` 의 `@playwright/test` 해석 버전(`pnpm list @playwright/test` 등)과 Dockerfile `FROM` 태그의 major.minor 일치를 검증하는 스크립트를 추가해 이번처럼 조용한 drift 를 다음 리뷰까지 방치하지 않게 한다. 주석의 "상향 시 함께 갱신" 이 사람 기억에만 의존하는 상태다.

- **[WARNING]** `codebase/packages` 전체 소스를 COPY — frontend 가 의존하지 않는 sdk/web-chat-sdk 까지 포함되어 backend Dockerfile 이 이미 적용한 "closure 만 COPY" 최적화가 누락됨
  - 위치: `codebase/frontend/Dockerfile.playwright-e2e:67` (`COPY codebase/packages ./codebase/packages`)
  - 상세: frontend `package.json` 의 `@workflow/*` 의존은 `chat-channel-validation`, `expression-engine`, `graph-warning-rules`, `node-summary` 4개뿐이며 `sdk`, `web-chat-sdk` 는 참조하지 않는다(확인: `grep -n "@workflow" codebase/frontend/package.json` 에 sdk/web-chat-sdk 없음). 그럼에도 이 Dockerfile 은 `codebase/packages` 디렉터리 전체(6개 패키지 소스)를 COPY 한다. 직전 커밋(`8a5c667bc build(backend): 내부패키지 소스 COPY 를 backend closure 4개로 (docker 캐시 효율) (#949)`)이 정확히 이 문제 — 불필요한 패키지 소스 COPY 로 인한 Docker 레이어 캐시 무효화 — 를 backend Dockerfile 에서 고쳤고, 본 Dockerfile 의 주석 자체가 "backend-e2e-runner 의 `target: deps` prebuild 패턴과 동형"이라고 그 패턴을 참조하면서도 정작 closure-only COPY 최적화는 이식하지 않았다.
  - 영향: 기능적으로는 무해하다(`pnpm install --filter "frontend..."` 는 어차피 sdk/web-chat-sdk 를 설치 대상에 포함하지 않으므로 `--frozen-lockfile` 결과에 영향 없음, prepare 스크립트도 실행 안 됨). 다만 sdk 또는 web-chat-sdk 소스가 바뀔 때마다(둘 다 활발히 쓰이는 SDK 패키지) `COPY codebase/packages` 레이어와 그 하위의 `pnpm install` 레이어 캐시가 불필요하게 무효화되어, frontend e2e 이미지가 실제로는 상관없는 변경에도 재빌드된다 — 이 Dockerfile 이 풀고자 한 "매 실행 반복 설치 제거"라는 목적(빌드 시간 단축)과 부분적으로 상충.
  - 제안: backend Dockerfile 과 동일하게 frontend 가 실제 의존하는 4개 패키지만 개별 COPY (`expression-engine`, `node-summary`, `chat-channel-validation`, `graph-warning-rules`), sdk/web-chat-sdk 는 package.json manifest 만 유지(이미 위에서 COPY 됨, `--frozen-lockfile` 검증에는 이미 충분). 신규 내부 패키지가 frontend 의존에 추가될 때 COPY 를 보충하라는 주석도 backend Dockerfile 처럼 남겨두면 좋다.

- **[INFO]** 새 외부 의존성 없음 — 순수 빌드 재구성
  - 위치: `codebase/frontend/Dockerfile.playwright-e2e` 전체, `docker-compose.e2e.yml` playwright-runner 섹션
  - 상세: 이번 변경은 npm 패키지를 추가/제거하지 않고 기존 `mcr.microsoft.com/playwright` 베이스 이미지 pull 을 "runtime command" 에서 "build-time COPY/RUN" 으로 옮긴 것뿐이다. 새 라이선스·CVE 노출면은 없다. `pnpm@10.23.0` 전역 설치 fallback 은 root `package.json` 의 `packageManager` 필드(`pnpm@10.23.0`)와 정확히 일치하고, 기존 `docker-compose.e2e.yml` command 에 있던 동일 fallback 을 그대로 옮긴 것이라 신규 버전 고정 이슈 없음.
  - 제안: 해당 없음(참고용).

- **[INFO]** COPY 되는 9개 package.json manifest 자체는 `--frozen-lockfile` 요건상 정당
  - 위치: `codebase/frontend/Dockerfile.playwright-e2e:55-64`
  - 상세: pnpm 은 `--filter` 범위와 무관하게 `--frozen-lockfile` 검증 시 워크스페이스 전체 멤버(`pnpm-workspace.yaml` 의 `codebase/backend`, `codebase/frontend`, `codebase/channel-web-chat`, `codebase/packages/*`) 의 `package.json` 존재와 lockfile 정합을 확인한다. backend/Dockerfile 의 `deps` stage 도 동일하게 9개 manifest 를 전부 COPY 하는 동형 패턴이라, manifest 레벨 COPY 자체는 과함이 아니라 필요조건이다. 문제는 위 두 번째 항목처럼 manifest 를 넘어 **소스 전체**를 무차별 COPY 한 지점에 있다.

## 요약

이번 변경은 새 외부 의존성을 추가하지 않는 순수 Docker 빌드 재구성(런타임 설치 → build-time baking)으로, 라이선스·신규 CVE 노출 관점에서는 문제가 없다. 다만 이번 리뷰가 특별히 요청한 버전 정합성 확인 결과, `codebase/frontend/package.json` 의 `@playwright/test: ^1.59.1` 이 lockfile 상에서 실제로는 `1.61.0` 으로 해석되어 있는데 base 이미지 태그는 여전히 `v1.59.1-jammy` 로, 두 파일의 "major.minor 를 정렬한다"는 주석과 달리 이미 2-minor 갭이 존재한다 — Dockerfile 이 빌드 시점에 `playwright install chromium` 으로 실제 설치 버전 기준 브라우저를 재획득해 당장의 "browser not found" 는 회피하지만, 이 자기치유 로직에 안전을 전부 위임한 채 불변조건 위반 상태로 머지되는 점과 향후 drift 를 잡아줄 자동 검증이 없다는 점은 유지보수 리스크다. 또한 backend Dockerfile 이 바로 직전 커밋에서 적용한 "internal package closure 만 COPY"(캐시 효율) 최적화가 이 새 Dockerfile 에는 이식되지 않아, frontend 가 의존하지 않는 sdk/web-chat-sdk 소스 변경에도 불필요하게 캐시가 무효화되는 비효율이 남아있다. 두 건 모두 기능 정지를 유발하는 CRITICAL 은 아니지만 문서화된 불변조건 위반과 최근 확립된 사내 컨벤션 미준수라는 점에서 병합 전 반영을 권고한다.

## 위험도

MEDIUM
