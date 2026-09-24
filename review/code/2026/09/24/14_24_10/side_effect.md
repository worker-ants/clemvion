# 부작용(Side Effect) 리뷰

## 발견사항

- **[WARNING]** `test:debug` 스크립트가 `node` 에 셸 스크립트를 직접 넘겨 이미 깨져 있고, 이 diff 가 그 줄을 손댔음에도 고치지 않았다
  - 위치: `codebase/backend/package.json:25` (`"test:debug"`)
  - 상세: 다른 4개 스크립트(`test`/`test:watch`/`test:cov`/`test:e2e`)는 `./node_modules/jest/bin/jest.js` 를 직접 가리키도록 바뀌었지만, `test:debug` 만 예전 그대로 `node_modules/.bin/jest` 를 인자로 남겨 두고 `--experimental-vm-modules` 플래그만 추가했다. 그런데 pnpm 이 생성한 `node_modules/.bin/jest` 는 `#!/bin/sh` 로 시작하는 **셸 스크립트**이지 JS 파일이 아니다. `node <스크립트>` 로 셸 스크립트를 넘기면 Node 가 shebang 줄만 벗기고 나머지를 JS 로 파싱하려다 실패한다. 실제로 확인했다:
    ```
    $ cd codebase/backend && node node_modules/.bin/jest --version
    .../node_modules/.bin/jest:2
    basedir=$(dirname "$(echo "$0" | sed -e 's,\\,/,g')")
              ^^^^^^^
    SyntaxError: missing ) after argument list
    ```
    이 문제는 **이 diff 이전부터 존재**했다(구 버전도 `node ... node_modules/.bin/jest --runInBand` 형태였다) — diff 가 새로 만든 결함은 아니다. 다만 diff 가 정확히 이 줄을 수정하면서도 고치지 않았고, plan(`plan/in-progress/jest-esm-native-load.md`)의 TEST WORKFLOW 체크리스트는 lint/unit/build/e2e 만 언급할 뿐 `test:debug` 실행 확인은 없어 — 이번에도 검증 없이 그대로 통과했다. `pnpm run test:debug` 는 여전히 즉시 SyntaxError 로 죽는다.
  - 제안: `test:debug` 도 다른 4개 스크립트와 동일하게 `./node_modules/jest/bin/jest.js` 를 가리키도록 맞추거나(디버거의 `-r` 레지스터 훅이 같은 node 프로세스에 적용되려면 이 형태가 맞다), 이 PR 스코프가 아니라면 최소한 plan 에 "pre-existing, 이 PR 은 건드리지 않음"이라고 명시해 다음 사람이 새 회귀로 오인하지 않게 할 것.

- **[INFO]** `--experimental-vm-modules` 플래그가 jest 워커마다 `ExperimentalWarning: VM Modules is an experimental feature ...` 를 stderr 에 찍는다
  - 위치: `codebase/backend/package.json:22-26` (모든 `test*` 스크립트), `codebase/backend/jest.config.ts:17-39` 주석
  - 상세: plan 문서(§C, §D)에 이미 실측·고지되어 있고 의도적으로 숨기지 않기로 한 결정이다(실험 플래그 위에 서 있음을 드러내는 편이 낫다는 근거). CI 로그·로컬 콘솔 노이즈가 워커 수만큼 늘어나는 것은 실제 부작용이지만 문서화·의도된 트레이드오프이므로 별도 조치 불요.
  - 제안: 없음(참고용 기록).

- **[INFO]** `transformIgnorePatterns` 를 Jest 기본값(`['/node_modules/']`)으로 되돌리는 것은 프로세스 전역 동작 변경이지만 스코프가 `codebase/backend` 로 한정됨을 확인했다
  - 위치: `codebase/backend/jest.config.ts:39`, `codebase/backend/test/jest-e2e.json:9`
  - 상세: `grep -rl transformIgnorePatterns codebase` 로 확인한 결과 이 두 파일 외에 동일 패턴을 중복 유지하는 다른 패키지(`packages/*`, `frontend`, `channel-web-chat`)는 없다. 즉 "손으로 유지하던 허용목록이 두 곳에서 어긋나 있었다"는 plan 의 주장과 일치하고, 이번 변경이 의도치 않게 다른 워크스페이스의 테스트 로딩 방식을 바꾸지는 않는다. CI 워크플로(`backend-checks.yml` unit → `pnpm --filter backend test`, `docker-compose.e2e.yml` → `pnpm run test:e2e`)는 모두 `package.json` scripts 를 경유하므로 새 플래그가 정상적으로 전파된다 — 플래그를 우회해 `jest` 바이너리를 직접 부르는 CI/Docker 경로는 발견되지 않았다.
  - 제안: 없음(검증 완료, 정보성 기록).

## 요약

핵심 변경(`jest.config.ts`/`package.json`/`test/jest-e2e.json`의 `transformIgnorePatterns` 기본값 복귀 + `--experimental-vm-modules` 플래그 도입)은 plan 문서에 실측·판별 실험까지 갖춰 검증되었고, CI/Docker 경로 전수 확인 결과 이 변경을 우회해 예전 방식으로 jest 를 부르는 숨은 진입점은 없었다. 다만 diff 가 직접 수정한 `test:debug` 스크립트는 pnpm 이 생성하는 셸 스크립트(`node_modules/.bin/jest`)를 `node` 에 그대로 넘기고 있어 `SyntaxError` 로 즉시 죽는 상태이며(직접 실행으로 확인), 이는 이 PR 이전부터 있던 결함이지만 이번에도 손대고 고치지 않아 방치가 이어진다. 그 외 신규 전역 상태 변경, 공개 API/함수 시그니처 변경, 환경 변수 오·남용, 의도치 않은 네트워크 호출, 파일시스템 부작용은 발견되지 않았다(신규 생성된 `plan/`·`review/consistency/` 문서는 프로젝트 규약이 요구하는 정상 산출물).

## 위험도

LOW
