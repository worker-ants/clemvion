# 테스트(Testing) 리뷰 — jest ESM 네이티브 로드 전환 (4회차)

## 검증 방법

이 PR 은 이미 3회차 리뷰(`review/code/2026/09/24/{14_24_10,15_26_17,16_02_28}`)를 거쳤고,
매 라운드가 테스트 관점 WARNING 을 하나씩 냈고 다음 라운드에서 조치됐다:

- 1라운드(`14_24_10`): `test:debug` 사전 결함(pnpm shell shim → `SyntaxError`) — 2라운드에서
  `./node_modules/jest/bin/jest.js` 직접 호출로 수정.
- 2라운드(`15_26_17`): "플래그+기본 허용목록" 불변식을 지키는 전용 가드 부재 — 3라운드
  커밋(`f14d680ae`)이 `esm-native-load.spec.ts` 에 5개 script 전수 census 테스트를 추가.
- 3라운드(`16_02_28`): 그 census 가 `toContain` 두 개(존재만)라 플래그가 진입점 **뒤**로
  가도 통과 — `a49b62108` 가 `flagIdx < entryIdx` 순서 단언으로 교체.

이번 라운드는 `codebase/**` 에 새 커밋이 없다(`git diff --stat origin/main HEAD -- codebase/`
가 3라운드 이후와 동일 4개 파일, 133/-21). 따라서 (1) 3라운드 수정이 실제로 유효한지 재검증하고,
(2) 지금까지 세 라운드가 밟지 않은 각도를 새로 탐색했다. 저장소는 **뮤테이션하지 않았다** —
전부 `Read`/`grep`/독립 `node` CLI 실행이었고, 세션 종료 시 `git status --short` 는 이
리뷰 산출물 디렉터리(`review/code/2026/09/24/16_29_15/`) 외 변경 없음을 확인했다.

- `esm-native-load.spec.ts` 를 단독 실행 → **PASS 4/4** (독립 재현, 3라운드 수정이 살아있음을
  확인).
- 새 뮤턴트 가설: census 가드는 `FLAG`(`--experimental-vm-modules`)와 `ENTRY`
  (`./node_modules/jest/bin/jest.js`)의 상대 순서만 검사한다. 그런데 `test:debug` 스크립트는
  같은 규칙(node 옵션은 스크립트 경로보다 **앞**에 와야 한다)을 지켜야 하는 옵션이 **둘 더**
  있다 — `-r tsconfig-paths/register -r ts-node/register`. 이 두 플래그는 이번 PR 이 추가한
  것이 아니라 이전부터 있던 것이라 diff 범위 밖이지만, "존재 검사가 아니라 위치가 문제였다"는
  이 PR 전체의 교훈과 **정확히 같은 모양**이라 실제로 재현해 봤다(저장소 파일은 건드리지 않고
  커맨드라인 인자 순서만 바꿈):
  ```
  $ node --experimental-vm-modules ./node_modules/jest/bin/jest.js \
      -r tsconfig-paths/register -r ts-node/register \
      --testPathPatterns='esm-native-load.spec.ts'
  ● Unrecognized CLI Parameter:
    Unrecognized option "r".
  ```
  `-r` 가 진입점 **뒤**로 가면 node 가 아니라 jest 가 인자로 받아 즉시 죽는다 — `--experimental-
  vm-modules` 가 진입점 뒤로 갈 때와 **동일한 실패 모양**(jest 가 "Unrecognized …" 로 거부).

## 발견사항

- **[WARNING]** census 가드가 `--experimental-vm-modules` 의 위치만 지키고, `test:debug` 에
  있는 동종 위치-의존 플래그(`-r tsconfig-paths/register`, `-r ts-node/register`)는 지키지
  않는다 — 이 PR 이 세 라운드에 걸쳐 고친 결함 클래스("존재 검사 ≠ 정합 검사")가 **가드 자신의
  스코프 경계에서** 다시 열려 있다
  - 위치: `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts` 함수
    `it('jest 를 띄우는 script 전부가 같은 플래그·진입점을 쓴다', …)` (61~106행대, `FLAG`/`ENTRY`
    상수와 `flagIdx`/`entryIdx` 비교 블록)
  - 상세: 3라운드가 고친 것은 "`--experimental-vm-modules` 가 `ENTRY` 보다 앞에 있는가"였다.
    그런데 `test:debug`(`codebase/backend/package.json` scripts 블록)는 node 옵션이 스크립트
    경로보다 앞에 와야 한다는 **같은 규칙**을 지켜야 하는 옵션을 두 개 더 갖고 있다 —
    `-r tsconfig-paths/register`, `-r ts-node/register`. 이 둘은 현재 스크립트 안에서는
    올바른 위치(진입점보다 앞)에 있지만, 그 사실을 지키는 것은 **아무것도 없다**. 위 "검증
    방법"에서 실측했듯 이 둘을 진입점 뒤로 옮기면 node 가 자신의 옵션으로 소비하지 않고
    jest 가 자신의 CLI 인자로 받아 `Unrecognized option "r"` 로 즉시 죽는다 — `--experimental-
    vm-modules` 가 뒤로 갔을 때와 **바이트 단위로 같은 실패 모양**(jest 의 "Unrecognized CLI
    Parameter")이다. 그리고 `test:debug` 는 스펙 헤더 자신이 명시하듯(51~53행) CI·Makefile·
    `.claude/test-stages.sh`·docker-compose 어디서도 실행되지 않으므로, 이 두 플래그가 미래에
    실수로(혹은 `--experimental-vm-modules` 위치를 옮기는 리팩터를 하다 같이) 뒤로 밀려도
    **census 가드도 통과하고 CI 도 침묵한다** — 정확히 1라운드가 발견했던 "`test:debug` 가
    2026-03-30 부터 아무도 모르게 깨져 있었다"는 사고 패턴을 재현할 조건이다. 이 두 플래그
    자체는 이번 diff 가 추가한 것이 아니라 그 전부터 있었으므로 이 PR 이 "만든" 결함은
    아니지만, 이 PR 이 세운 가드가 "위치 검사"라는 새 기준을 자기 스코프 안의 `FLAG`/`ENTRY`
    두 토큰에만 좁게 적용해, 같은 스크립트 문자열 안의 동종 위험 토큰을 놓쳤다.
  - 제안: census 루프에서 검사하는 토큰을 스크립트별로 일반화한다. 예:
    ```js
    const NODE_ARGS_BY_SCRIPT: Record<string, string[]> = {
      test: ['--experimental-vm-modules'],
      'test:watch': ['--experimental-vm-modules'],
      'test:cov': ['--experimental-vm-modules'],
      'test:debug': [
        '--experimental-vm-modules',
        '-r tsconfig-paths/register',
        '-r ts-node/register',
      ],
      'test:e2e': ['--experimental-vm-modules'],
    };
    // 각 항목이 ENTRY 보다 앞에 있는지 for-of 로 검사
    ```
    또는 최소한 `test:debug` 전용으로 `-r` 두 개의 순서를 추가 단언 한 쌍만 넣어도 이번에
    실측한 회귀는 잡힌다. 뮤테이션 관점에서 "`-r ts-node/register` 를 진입점 뒤로 이동"을
    추가 뮤턴트로 넣어 RED 를 먼저 확인할 것 — 이 리뷰의 실측이 그 RED 다.

- **[INFO]** (확인 — 새 갭 아님, 회귀 없음) 3라운드 WARNING(census 가 순서를 안 본다)의 수정이
  유효하다
  - 위치: `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts` (`flagIdx <
    entryIdx` 비교, 존재 단언과 순서 단언 두 벌)
  - 상세: 독립 실행 4/4 PASS. `hasFlag`/`hasEntry` 존재 단언과 `flagBeforeEntry` 순서 단언이
    분리돼 있어, 3라운드 RESOLUTION 이 검증한 M8(순서 위반)·M9(존재 위반) 둘 다 여전히 서로
    다른 지점에서 잡힌다(플래그 제거 시 92행대 존재 단언이 먼저 실패해 순서 비교가 `-1 <
    entryIdx` 로 공허하게 통과하는 사고를 막는다).
  - 제안: 없음 — 확인만.

- **[INFO]** (확인 — 새 갭 아님) `import.meta.url` 케이스는 이 가드로 여전히 미검증 — 1~3
  라운드가 이미 추적, `nestjs-v12-coordinated-upgrade.md` §B 에 착수 조건으로 등재됨
  - 위치: `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts:4`(canary =
    `uuid`, downlevel 가능) · `plan/in-progress/nestjs-v12-coordinated-upgrade.md` §B
  - 상세: 재확인만, 새로 등재하지 않는다.
  - 제안: 없음.

## 요약

3라운드에 걸쳐 이 PR 자신이 "존재 검사 ≠ 정합 검사"라는 결함 클래스를 두 번 스스로 밟고
고쳤는데(2라운드: 가드 부재 → 3라운드: 가드는 있으나 순서 미검사), 그 교훈을 같은 가드의
검사 범위 자체에 적용해 보니 세 번째 사례가 실측으로 나왔다 — census 가드는
`--experimental-vm-modules`↔진입점 순서만 지키고, `test:debug` 안의 동종 위치-의존 옵션
(`-r tsconfig-paths/register`, `-r ts-node/register`)은 지키지 않는다. 실제로 이 두 옵션을
진입점 뒤로 옮기면 node 가 아니라 jest 가 받아 `Unrecognized option "r"` 로 즉시 죽는 것을
독립 재현으로 확인했다 — `--experimental-vm-modules` 위치 오류와 바이트 단위로 같은 실패
모양이다. 이 두 옵션 자체는 이번 diff 가 만든 게 아니고 현재는 올바른 위치에 있으므로
CRITICAL 은 아니지만, `test:debug` 가 CI·Makefile·test-stages.sh 어디에서도 실행되지 않는다는
사실(스펙 헤더 자신의 기술)과 겹치면 "가드도 CI 도 침묵하는 채 방치"라는, 이 PR 의 1라운드가
발견한 바로 그 사고 패턴을 재현할 조건을 갖춘다. WARNING 으로 분류했다 — 이 diff 를 되돌릴
사유는 아니지만, census 루프를 스크립트별 옵션 목록으로 일반화하면 닫힌다. 그 외에는 3라운드
수정(순서 단언)이 독립 재현으로 유효함을 재확인했고, `import.meta.url` 미검증은 이미 추적된
사항으로 재확인만 했다. 저장소는 뮤테이션하지 않았다(`git status --short` 로 확인).

## 위험도

LOW
