# 부작용(Side Effect) 리뷰

## 대상 요약

핵심 변경은 backend jest 실행 방식 전환(`transformIgnorePatterns` 손수 허용목록 → 기본값
`['/node_modules/']` + `node --experimental-vm-modules ./node_modules/jest/bin/jest.js`)이며,
`codebase/backend/jest.config.ts`, `codebase/backend/package.json`(5개 test 스크립트),
`codebase/backend/test/jest-e2e.json`, 신규 가드 `esm-native-load.spec.ts` 가 실제 코드
변경분이다. 나머지(`PROJECT.md`, `plan/**`, `review/**`)는 문서·리뷰 산출물로 런타임 부작용
표면이 없다.

## 발견사항

- **[INFO]** 프로세스 전역 실험 플래그가 backend 의 모든 jest 실행 경로에 상시 적용된다
  — 위치: `codebase/backend/package.json` `scripts.test` / `test:watch` / `test:cov` /
  `test:debug` / `test:e2e` (5줄 모두)
  - 상세: `--experimental-vm-modules` 는 Node 프로세스 단위 플래그라 워커마다
    `ExperimentalWarning: VM Modules …` 1줄이 stdout/stderr 에 찍힌다(개발자 자신이
    `plan/in-progress/jest-esm-native-load.md` §C·§D 에서 11코어 머신 실측 9줄로 계측·의도적
    비억제로 기록함). `.claude/tools/run-test.sh` 의 PASS_LINE 추출 정규식
    (`tests:.*pass|passing\b|✓.*passed\b`) 과는 패턴이 겹치지 않아 로그 파싱 회귀는 직접
    확인되지 않았다. 다만 이 플래그를 참조하는 별도 CI 로그 스크레이퍼나 IDE 통합이 있다면
    영향권 밖에서 새 경고 라인을 만나게 된다.
  - 제안: 기존 기록대로 유지해도 무방하나(의도적 트레이드오프로 이미 문서화됨), CI 로그를
    자동 소비하는 다른 스크립트가 생기면 이 배너를 필터링 대상에 포함해야 한다는 점만 인지.

- **[INFO]** `transformIgnorePatterns` 완화의 적용 범위가 명시 목록(6개 패키지)에서
  `node_modules` 전체로 넓어진다 — 위치: `codebase/backend/jest.config.ts:41`,
  `codebase/backend/test/jest-e2e.json:9`
  - 상세: 이전에는 `uuid|p-limit|yocto-queue|otplib|@otplib|@scure|@noble` 만 ts-jest 변환
    대상에서 제외(→ 나머지 node_modules 는 이미 기본값처럼 무변환)됐고, 이번 변경은 그 예외
    목록 자체를 없애고 전체를 기본값으로 되돌린 것이므로 실질적으로 **변환 스코프가 줄었지
    늘지 않았다** — "허용목록 완화"가 아니라 "허용목록 폐지"다. `--experimental-vm-modules` 와
    짝을 이뤄야만 성립하는 설계이고, PR 자체가 뮤테이션 4종(플래그 제거·허용목록 복원·e2e
    설정 발산·canary CJS 가정)으로 짝 관계를 검증해 뒀다(`esm-native-load.spec.ts`,
    `jest-esm-native-load.md` §D). 새로 도입되는 상태 변경이 아니라 이미 실측·가드된 설계로
    판단해 별도 조치 불요.
  - 제안: 없음(참고용 기록).

- **[INFO]** 가드가 커버하지 못하는 우회 경로 — 위치:
  `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts` 의
  `it('jest 를 띄우는 script 전부가 같은 플래그·진입점을 쓴다', …)` 주석 (파일 내 57~60행,
  "이 가드가 덮지 못하는 것" 단락)
  - 상세: 플래그는 5개 npm script 문자열에만 존재하므로, IDE 테스트 러너나 `npx jest` 직접
    호출처럼 그 문자열을 우회하는 진입점은 불변식 밖이며 여전히
    `Must use import to load ES Module` 로 깨진다. 개발자 스스로 스펙 헤더와 plan 문서에
    이 경계를 명시했고, CI·Makefile·docker-compose·`.claude/test-stages.sh` 실측 grep 으로
    전부 npm script 를 경유함을 확인했다(직접 재확인: `.github/workflows/backend-checks.yml`
    은 `pnpm --filter backend test`, `docker-compose.e2e.yml` 은 `pnpm run test:e2e`,
    `.claude/test-stages.sh` 도 `pnpm --filter backend test`/`test:e2e` 만 사용 — 직접
    `jest`/`node_modules/.bin/jest` 호출 지점 없음, grep 0건 재확인됨). 새로운 결함이 아니라
    이미 스스로 알린 잔여 위험.
  - 제안: 없음(이미 문서화된 수용 리스크).

- **[INFO]** `test:debug` 스크립트가 이 변경의 부수효과로 함께 고쳐짐 — 위치:
  `codebase/backend/package.json` `scripts.test:debug`
  - 상세: 진입점이 `node_modules/.bin/jest`(셸 shim) 에서 `./node_modules/jest/bin/jest.js`
    로 바뀌면서, 2026-03-30 이후 방치돼 있던 `test:debug`(shim 을 `node` 에 직접 넘겨
    `SyntaxError` 로 항상 실패)가 부수적으로 고쳐졌다(스펙 주석에 근거 기재). 의도한 스코프
    밖의 변경이지만 방향은 긍정적이고, PR 이 이를 숨기지 않고 스스로 기록했다.
  - 제안: 없음(공짜 수정, 부작용 성격의 위험 아님).

## 확인 항목 (문제 없음으로 판단, 근거 포함)

- **시그니처/인터페이스 변경**: `esm-native-load.spec.ts` 는 신규 파일이며 다른 코드를
  호출하지 않는다(신규 테스트 함수 추가일 뿐, 기존 함수 시그니처 변경 없음).
- **파일시스템 부작용**: 신규 스펙은 `fs.readFileSync` 로 `package.json`/`test/jest-e2e.json`
  을 읽기만 한다 — 쓰기·생성·삭제 없음.
- **전역 변수**: JS 레벨 전역 변수 도입/변경 없음. `--experimental-vm-modules` 는 Node 런타임
  플래그이지 애플리케이션 전역 상태가 아니다.
- **환경 변수**: 신규/변경된 환경 변수 읽기·쓰기 없음(플래그는 CLI 인자로만 전달되며
  `NODE_OPTIONS` 등 환경변수 경유가 아님 — plan 문서가 "env 접두어 대신 이 형태를 쓴다"고
  명시적으로 선택함).
- **네트워크 호출**: 없음.
- **이벤트/콜백**: 없음.
- **다른 workspace(frontend/channel-web-chat/packages/*) 파급**: `jest.config.ts` 는 backend
  전용 파일이며 다른 workspace 가 참조하는 공유 설정이 아님을 확인(`find codebase -maxdepth 2
  -iname "jest.config*"` → backend 1건).

## 요약

리뷰 대상의 실질 부작용 표면은 backend jest 실행 파이프라인(설정 2곳 + 스크립트 5곳)에
국한되며, 코드 자체의 상태 변경·전역 변수·파일 I/O·네트워크·콜백 부작용은 발견되지 않았다.
유일하게 "부작용"으로 부를 만한 것은 프로세스 전역 Node 실험 플래그 상시 활성화로 인한
stdout 경고 노이즈와 변환 스코프 축소인데, 둘 다 개발자가 사전에 뮤테이션 테스트·실측
비교표로 검증하고 plan 문서에 트레이드오프로 명시해 둔 의도된 변경이며, CI/Makefile/
docker-compose 전 진입점이 npm script 를 경유함을 재확인해 "가드가 커버 못 하는 우회 경로"
주장도 사실과 부합했다. 새로 생성된 review/plan 문서들은 산출물 성격이라 부작용 평가 대상이
아니다.

## 위험도

LOW
