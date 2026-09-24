# 부작용(Side Effect) 리뷰

## 대상 요약

실제 런타임/도구 코드 변경은 5개 파일뿐이다 (`git diff --stat origin/main... -- 'codebase/**' 'PROJECT.md'`
로 재확인): `PROJECT.md`(문서 1줄), `codebase/backend/jest.config.ts`,
`codebase/backend/package.json`(test 스크립트 5개), `codebase/backend/test/jest-e2e.json`,
신규 `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts`. 핵심은 backend
jest 실행 방식 전환 — 손수 유지하던 `transformIgnorePatterns` 허용목록(uuid·p-limit·
yocto-queue·otplib·@otplib·@scure·@noble)을 폐지하고 기본값(`['/node_modules/']`)으로
되돌린 뒤, jest 를 `node --experimental-vm-modules ./node_modules/jest/bin/jest.js` 로
띄워 ESM 의존성을 네이티브로 로드하게 한다. 나머지 파일(`plan/**`, `review/**`)은 문서·리뷰
산출물이라 런타임 부작용 표면이 없다.

이 diff 는 직전 라운드(`review/code/2026/09/24/16_29_15`)의 side_effect 리뷰가 이미 대상으로
삼았던 것과 코드 수준에서 동일하다(diff --stat 일치) — 본 라운드는 그 결론을 독립적으로
재검증했다.

## 발견사항

- **[INFO]** 프로세스 전역 실험 플래그가 backend 의 모든 jest 실행 경로에 상시 적용된다
  — 위치: `codebase/backend/package.json:22`(`test`), `:23`(`test:watch`), `:24`(`test:cov`),
  `:25`(`test:debug`), `:26`(`test:e2e`)
  - 상세: `--experimental-vm-modules` 는 Node 프로세스 단위 플래그라 워커마다
    `ExperimentalWarning: VM Modules …` 1줄이 stdout/stderr 에 찍힌다. 개발자 자신이
    `plan/in-progress/jest-esm-native-load.md` §C·§D 에서 11코어 머신 실측 9줄로 계측했고
    `--disable-warning` 으로 억제하지 않기로 명시적으로 선택했다. `.claude/tools/run-test.sh`,
    `.github/workflows/backend-checks.yml`(`pnpm --filter backend test`),
    `docker-compose.e2e.yml`(`pnpm run test:e2e`), `.claude/test-stages.sh` 를 직접 grep
    해 전 진입점이 npm script 를 경유함을 확인했고, 이 배너를 파싱 대상으로 삼는 코드는
    저장소 내에 없다(`grep -rn "experimental-vm-modules\|ExperimentalWarning" .claude .github Makefile` → 0건).
  - 제안: 유지해도 무방(의도된 트레이드오프, 문서화 완료). 추후 CI 로그를 자동 소비하는
    스크립트가 생기면 이 배너를 필터링 대상에 포함할 것.

- **[INFO]** 공개(개발자 대면) 인터페이스인 npm test 스크립트의 실행 형태가 바뀌어, 그
  문자열을 우회하는 진입점은 이 변경의 보호 밖에 남는다 — 위치:
  `codebase/backend/package.json:22`~`:26` / 가드 코멘트는
  `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts:57`~`60`
  ("이 가드가 덮지 못하는 것" 단락)
  - 상세: 플래그는 5개 npm script 문자열에만 존재한다. `npx jest` 직접 호출이나 IDE 의
    "Jest: run current file" 같은 통합처럼 그 문자열을 우회하는 진입점은 여전히
    `Must use import to load ES Module` 로 깨진다. 개발자가 스펙 코멘트와 plan 문서에 이
    경계를 스스로 명시했고, 본 리뷰가 독립적으로 재확인한 grep 결과(`.github/workflows/backend-checks.yml`,
    `docker-compose.e2e.yml`, `.claude/test-stages.sh`)도 전부 npm script 경유임을 뒷받침한다 —
    현재 CI/로컬 표준 경로에서의 실제 회귀는 아니며, 새로 발견된 결함이 아니라 이미 self-disclosed 된
    잔여 위험이다.
  - 제안: 없음(이미 문서화된 수용 리스크). 신규 CI 진입점을 추가할 때 이 경계를 재확인할 것.

- **[INFO]** `test:debug` 스크립트가 이번 변경의 부수효과로 함께 고쳐졌다 — 위치:
  `codebase/backend/package.json:25`
  - 상세: 진입점이 `node_modules/.bin/jest`(셸 shim)에서 `./node_modules/jest/bin/jest.js`로
    바뀌면서, 2026-03-30 scaffold 이후 방치돼 있던 `test:debug`(shim 을 `node` 에 직접 넘겨
    `SyntaxError: missing ) after argument list` 로 항상 실패하던 상태)가 부수적으로
    고쳐졌다. 스코프 밖의 변경이지만 방향은 긍정적이고 PR 이 스스로 기록해 뒀다
    (`esm-native-load.spec.ts:48`~`50`).
  - 제안: 없음(공짜 수정, 위험 아님).

## 확인 항목 (문제 없음으로 판단, 근거 포함)

- **시그니처/인터페이스 변경(함수 단위)**: 신규 파일 `esm-native-load.spec.ts` 는 다른 코드를
  호출하지 않는 순수 테스트 추가다 — 기존 함수/클래스 시그니처 변경 없음.
- **파일시스템 부작용**: 신규 스펙은 `fs.readFileSync` 로 `package.json`(63~64행) 과
  `test/jest-e2e.json`(123행)을 읽기만 한다 — 쓰기·생성·삭제 없음. 직접 `cat` 으로 재확인.
- **전역 변수**: JS 애플리케이션 레벨 전역 변수 도입/변경 없음. `--experimental-vm-modules`
  는 Node 런타임 플래그이지 애플리케이션 전역 상태가 아니다.
- **환경 변수**: 신규/변경된 환경 변수 읽기·쓰기 없음 — 플래그는 CLI 인자로만 전달되고
  `NODE_OPTIONS` 등 env 경유가 아니다(plan 문서가 "셸 문법에 의존하지 않기 위해 env 접두어
  대신 이 형태를 쓴다"고 명시).
- **네트워크 호출**: 없음.
- **이벤트/콜백**: 없음.
- **transformIgnorePatterns 스코프 변경 방향**: 이전에는 6개 패키지(+scoped 하위)를 ts-jest
  변환 대상에서 예외 처리했고, 이번 변경은 그 예외 목록 자체를 없앤 것이므로 실질적으로
  "허용 확대"가 아니라 "허용목록 폐지"다 — `--experimental-vm-modules` 와 짝을 이뤄야만
  성립하는 설계이며, 플래그 제거·허용목록 복원·e2e 설정 발산·canary CJS 가정 4종 뮤테이션으로
  검증돼 있다(`esm-native-load.spec.ts` M1~M4, `jest-esm-native-load.md` §D). 새로 도입되는
  위험이 아니라 이미 실측·가드된 설계.
- **다른 workspace 파급**: `codebase/backend/jest.config.ts` 는 backend 전용이며
  frontend/channel-web-chat/packages/* 가 참조하는 공유 설정이 아니다
  (`find codebase -maxdepth 2 -iname "jest.config*"` → backend 1건만 확인).
- **CI/로컬 진입점 전수**: `.github/workflows/backend-checks.yml:121`(`pnpm --filter backend test`),
  `docker-compose.e2e.yml:209`(`pnpm run test:e2e`), `.claude/test-stages.sh:59`
  (`pnpm --filter backend test`) — 모두 npm script 경유, 직접 `jest`/`node_modules/.bin/jest`
  호출 지점 없음(grep 재확인).

## 요약

리뷰 대상의 실질 부작용 표면은 backend jest 실행 파이프라인(설정 2곳 + 스크립트 5곳 + 신규
가드 테스트 1개)에 국한되며, 애플리케이션 코드의 상태 변경·전역 변수·파일 I/O 쓰기·환경 변수·
네트워크·이벤트/콜백 부작용은 발견되지 않았다. 유일하게 "부작용"이라 부를 만한 것은 (1) 프로세스
전역 Node 실험 플래그 상시 활성화로 인한 stdout/stderr 경고 노이즈, (2) npm script 문자열을
우회하는 진입점(IDE 통합·`npx jest` 직접 호출)이 이 변경의 보호 밖에 남는다는 점인데, 둘 다
개발자가 사전에 뮤테이션 테스트·실측 비교표로 검증하고 plan 문서에 트레이드오프로 명시해
두었으며, 본 리뷰가 CI/Makefile/docker-compose/test-stages.sh 전 진입점을 독립적으로 grep
재확인해 "가드가 커버 못 하는 우회 경로" 주장이 현재 표준 경로에서는 실제 회귀로 이어지지
않음을 확인했다. `esm-native-load.spec.ts` 는 파일을 읽기만 하고 쓰지 않는다. 새로 생성된
plan/review 문서(`nestjs-v12-coordinated-upgrade.md` 등)는 산출물 성격이라 부작용 평가
대상이 아니다.

## 위험도

LOW
