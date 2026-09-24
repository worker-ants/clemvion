# 테스트(Testing) 리뷰 — jest ESM 네이티브 로드 전환 (3회차)

## 검증 방법

이 PR은 이미 2라운드 리뷰(`review/code/2026/09/24/14_24_10`, `review/code/2026/09/24/15_26_17`)를
거치며 새 가드(`esm-native-load.spec.ts`)에 대해 M1~M7 뮤테이션을 예측=실측으로 검증했다.
3라운드는 새로 커밋된 `codebase/**` 변경이 없으므로(직전 커밋 `d184b10d2` 이후 `git diff --stat
origin/main HEAD -- codebase/` 는 동일 4개 파일 133/-21로 불변), 기존 산출물을 재확인하고
**전 라운드가 시도하지 않은 뮤턴트 각도**를 새로 탐색했다. 저장소는 뮤테이션하지 않았다(읽기·
`grep`·스크래치 실행만, `git status --short` 확인 결과 세션 시작 시 존재하던
`review/code/2026/09/24/16_02_28/` 외 변경 없음).

- `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts` 전문 확인, `jest.config.ts`
  전문 확인, `codebase/backend/package.json` scripts 블록 확인 — 게이트 번호와 실제 줄 번호 일치.
- `.github/workflows/backend-checks.yml:121` (`pnpm --filter backend test`) ·
  `.claude/test-stages.sh:59` (`pnpm --filter backend test`) 가 실제로 새 `test` 스크립트를
  거치는지 확인 — 일치.
- `.github/workflows/repo-guards.yml` pathspec 이 `codebase/**` 전체를 잡아, 이전 라운드
  Warning 2(“docs 가드가 검사하는 데이터가 그 가드를 트리거하지 않는다” — `plan/**`·`spec/**`
  누락 사례)와 같은 pathspec 갭이 **이 신규 backend 테스트 파일에는 해당하지 않음**을 확인.
- 새 뮤턴트 가설을 실제로 실행해 확인:
  ```
  $ node ./node_modules/jest/bin/jest.js --experimental-vm-modules --listTests
  ● Unrecognized CLI Parameter: Unrecognized option "experimental-vm-modules".
  ```
  (아래 WARNING 근거. 저장소 파일은 건드리지 않고 커맨드라인 인자 순서만 바꿔 재현했다.)

## 발견사항

- **[WARNING]** 새 census 가드가 플래그의 **존재**만 검사하고 **위치(순서)**는 검사하지 않아,
  같은 텍스트 회귀 클래스를 다시 놓칠 수 있다
  - 위치: `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts:83-85`
    ```js
    for (const [name, cmd] of jestScripts) {
      expect(`${name}: ${cmd}`).toContain('--experimental-vm-modules');
      expect(`${name}: ${cmd}`).toContain('./node_modules/jest/bin/jest.js');
    }
    ```
  - 상세: 이 가드는 2라운드에서 정확히 "`test:debug` 진입점 드리프트"(config 값이 아니라
    scripts 텍스트 층위의 회귀)를 다시 잡기 위해 추가됐고, M5~M7 뮤테이션(플래그 제거·shim
    복원·접두어 없는 신규 script)은 전부 방증됐다. 그런데 두 단언 모두 `toContain`(부분 문자열
    포함 여부)이라 **순서를 강제하지 않는다**. 예를 들어 누군가
    `"test:cov": "node ./node_modules/jest/bin/jest.js --experimental-vm-modules --coverage"`
    처럼 플래그를 진입점 **뒤**로 옮겨도 두 `toContain` 은 모두 통과한다(둘 다 문자열에
    존재하므로). 그러나 Node 는 스크립트 경로 뒤에 오는 인자를 자신의 플래그가 아니라
    **스크립트(jest.js)에 전달할 인자**로 취급한다 — 즉 `--experimental-vm-modules` 가 Node
    에는 전혀 전달되지 않고 jest 자체의 CLI 인자로 들어간다. 실측(위 "검증 방법" 참고):
    `node ./node_modules/jest/bin/jest.js --experimental-vm-modules --listTests` →
    `Unrecognized CLI Parameter: Unrecognized option "experimental-vm-modules"`. `test`·
    `test:e2e` 는 CI(`backend-checks.yml:121`, `docker-compose.e2e.yml`)에서 실제로 실행되므로
    이런 순서 회귀가 나면 즉시 눈에 띄지만(가드가 놓쳐도 CI 가 잡는다), `test:cov`·`test:watch`·
    `test:debug` 세 스크립트는 스펙 자체 헤더(46-53줄)가 명시하듯 **CI·Makefile·
    `.claude/test-stages.sh`·docker-compose 어디서도 실행되지 않는다**(grep 0건, 2라운드
    실측 재확인) — 즉 이 세 스크립트에서 플래그 위치가 뒤바뀌어도 가드는 초록, CI 도 침묵,
    사람이 로컬에서 `test:debug`/`test:cov`를 우연히 돌릴 때까지 아무도 모른다. 이것이 정확히
    이 가드가 신설된 이유(`test:debug` 가 2026-03-30 scaffold 이후 방치됐던 것과 같은 형태)와
    같은 발견 경로를 다시 밟는다 — "존재 검사 ≠ 정합 검사"의 재현.
  - 제안: `toContain` 대신 순서를 강제하는 단언으로 교체. 예:
    ```js
    const tokens = cmd.trim().split(/\s+/);
    expect(tokens[0]).toBe('node');
    const flagIdx = tokens.indexOf('--experimental-vm-modules');
    const entryIdx = tokens.findIndex((t) => t.endsWith('jest/bin/jest.js'));
    expect(flagIdx).toBeGreaterThan(-1);
    expect(entryIdx).toBeGreaterThan(-1);
    expect(flagIdx).toBeLessThan(entryIdx); // Node 플래그는 반드시 진입점보다 앞에 와야 한다
    ```
    뮤테이션 관점에서 "플래그를 진입점 뒤로 이동"을 추가 뮤턴트(M8)로 넣어 RED 를 확인하면
    이번에 발견한 갭이 실제로 막히는지 방증할 수 있다.

- **[INFO]** (확인 — 새 갭 아님) `import.meta.url` 케이스는 이 가드로 여전히 미검증 — 이미
  추적됨, 재-flag 아님
  - 위치: `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts:4` (canary =
    `uuid`, downlevel 가능한 ESM) · `plan/in-progress/nestjs-v12-coordinated-upgrade.md` §B
  - 상세: 1·2라운드(`14_24_10` INFO 12, `15_26_17` INFO 3)가 이미 짚었고 조치 방식(canary 교체
    대신 후속 plan에 "가드가 초록이어도 이 케이스는 상주 검증이 아니다" 경고 인용)도 이미
    합의·기록돼 있다. 재확인만 하고 새로 등재하지 않는다.
  - 제안: 없음 — 확인만.

- **[INFO]** (확인 — 긍정적) `repo-guards.yml` pathspec 갭이 이 신규 테스트 파일에는 적용되지
  않는다
  - 위치: `.github/workflows/repo-guards.yml`(`codebase/**` pathspec) ·
    `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts`
  - 상세: `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 등재된 "docs 가드가
    검사하는 데이터가 그 가드를 트리거하지 않는다" 항목(`frontend-checks.yml` pathspec 에
    `plan/**`·`spec/**` 누락)과 같은 클래스의 문제가 이 신규 backend 테스트 파일에도 있는지
    확인했다 — 없다. `codebase/backend/**` 변경은 `backend-checks.yml`·`repo-guards.yml`
    (pathspec `codebase/**`) 양쪽에서 트리거된다.
  - 제안: 없음 — 확인만.

## 요약

3라운드는 `codebase/**` 신규 변경이 없어 2라운드까지 축적된 M1~M7 뮤테이션 검증(전부
예측=실측)을 재확인하는 데 그치지 않고, 그 검증 세트가 시도하지 않은 각도(플래그의 **존재**가
아니라 **위치**)를 실행으로 검증해 새 갭 하나를 찾았다. 새 census 가드(`esm-native-load.spec.ts:
83-85`)는 `--experimental-vm-modules` 와 진입점 경로가 스크립트 문자열에 **둘 다 포함**되는지만
확인하고 **순서**는 강제하지 않는다 — 플래그를 진입점 뒤로 옮기면 Node 가 아니라 jest 의 인자로
전달되어(`Unrecognized CLI Parameter`, 실측) 무력화되는데, 이 회귀는 `test:cov`·`test:watch`·
`test:debug`(CI·Makefile·test-stages.sh 어디서도 실행되지 않음, 재확인)에서는 조용히 가드를
통과한다. 이는 이 가드 자체가 막으려 한 "손으로 복제된 텍스트가 자동화가 밟지 않는 자리에서
드리프트한다"는 결함 클래스의 재현이라 WARNING 으로 분류했다. 다만 실제로 그런 편집이
일어날 확률은 낮고(순서를 바꾸는 것은 의도적 리팩터가 아니면 드묾), `test`·`test:e2e` 처럼
CI 가 실행하는 스크립트에서는 즉시 시끄럽게 실패하므로 blocking 은 아니다. 그 외 항목 —
`import.meta.url` 미검증(이미 추적됨), pathspec 커버리지(문제 없음 확인) — 은 새 갭이 아니다.

## 위험도
LOW
