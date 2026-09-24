# 테스트(Testing) 리뷰 — jest ESM 네이티브 로드 전환 (5회차)

## 검증 방법

이 PR 은 이미 4회차 리뷰(`review/code/2026/09/24/{14_24_10,15_26_17,16_02_28,16_29_15}`)를
거쳤고, `codebase/**` 실질 diff 는 4라운드 이후 커밋(`00791d3c8`) 한 건 — `test:debug` 의
`-r` 순서를 `NODE_ARGS_BY_SCRIPT` 열거 대신 **script 별 node 인자 구간 + 진입점 전체를
접두어 문자열로 고정**하는 방식으로 바꾼 것 — 뿐이다. 4라운드 WARNING(census 가드가
`--experimental-vm-modules` 순서만 보고 `test:debug` 의 `-r tsconfig-paths/register`·
`-r ts-node/register` 순서는 안 봄)이 실제로 닫혔는지가 이번 라운드의 핵심 질문이었다.

저장소는 **`cp` 로 백업 후 원복**했고(`git checkout`/`restore` 미사용), 세션 종료 시
`git status --short` 로 이 리뷰 산출물 디렉터리(`review/code/2026/09/24/16_56_25/`) 외
변경 없음을 확인했다.

1. `esm-native-load.spec.ts` 단독 실행(`node --experimental-vm-modules
   ./node_modules/jest/bin/jest.js --testPathPatterns='esm-native-load.spec.ts'`) →
   **PASS 4/4** (독립 재현).
2. **뮤테이션 M10 재검증** — `codebase/backend/package.json` 을 스크래치로 `cp` 백업한 뒤,
   `test:debug` 의 `-r ts-node/register` 를 진입점(`./node_modules/jest/bin/jest.js`) 뒤로
   옮겨 저장소 파일을 직접 수정하고 같은 스펙을 재실행:
   - **예측**: RED (4라운드가 실측한 결함의 재현)
   - **실측**: **RED** —
     ```
     - "prefix": "node --experimental-vm-modules --inspect-brk -r tsconfig-paths/register -r ts-node/register ./node_modules/jest/bin/jest.js"
     + "prefix": "node --experimental-vm-modules --inspect-brk -r tsconfig-paths/register ./node_modules/jest/bin/jest.js -r ts-node/register"
     ```
     (`toEqual` 객체 diff — `expectedPrefix` 전체 문자열 비교가 `-r` 순서 이탈을 그대로 잡는다)
   - `cp` 로 원본 복원 → 재실행 **PASS 4/4** 확인, `git status --short` 로 잔여물 없음 확인.
3. CI 진입점 경계 재확인 — `.github/workflows/backend-checks.yml` 의 `unit` 잡은
   `pnpm --filter backend test`(= `test` script, 가드 대상), `docker-compose.e2e.yml` 만
   `test:e2e` 를 참조. 가드가 스펙 헤더에서 주장하는 "CI·e2e 진입점은 전부 script 를
   경유한다"는 경계가 현재도 사실과 일치한다.

## 발견사항

없음. 4라운드 WARNING 은 「자리를 하나 더 열거」하는 대신 「script 별 node 인자 구간 +
진입점」을 접두어 문자열 전체로 고정하는 설계 전환으로 닫혔고, 위 재현(M10)이 그 전환이
실제로 회귀를 잡는다는 것을 독립적으로 확인했다. 이 설계는 향후 같은 클래스(위치-의존
플래그의 순서 이탈)의 **네 번째 재발을 구조적으로 차단**한다 — 어떤 node 옵션이 늘거나
빠지거나 순서가 바뀌어도 `expectedPrefix` 대조 한 줄이 잡는다(대가는 스펙 헤더·plan 양쪽에
명시: 정당한 node 옵션 변경도 이 단언을 먼저 깨야 하고, 그때 선언을 함께 고친다).

- **[INFO]** (확인 — 새 갭 아님) `import.meta.url` 케이스(`@nestjs/typeorm@12` 가 실제로
  행사하는 벽)는 이 가드로 여전히 미검증
  - 위치: `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts:4`(canary =
    `uuid`, CJS downlevel 가능한 ESM) · `plan/in-progress/nestjs-v12-coordinated-upgrade.md`
    §B
  - 상세: 1~4라운드가 이미 추적했고 후속 plan(`nestjs-v12-coordinated-upgrade.md`)의 착수
    조건(§B)으로 명시돼 있다. 이번 diff 는 NestJS 의존성 자체를 올리지 않으므로(현재
    NestJS 11 그대로) 이 PR 스코프에서 검증 불가능한 것이 맞다 — 재등재가 아니라 재확인.
  - 제안: 없음(후속 plan 에 이미 반영됨).

- **[INFO]** 단위 설정(`jest.config.ts`)의 `transformIgnorePatterns` 는 e2e 설정과 달리
  **정적 값 단언이 없고 import 트립와이어로만** 간접 검증된다 — 의도된 비대칭이며 새 갭
  아님
  - 위치: `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts` 41~45행
    주석("위 두 테스트는 단위 설정만 행사한다... e2e 설정은 별도 파일이고...")
  - 상세: 스펙 자신이 그 비대칭의 이유를 이미 서술한다 — 이 스펙 파일 자체가 단위
    `jest.config.ts` 로 돌기 때문에 파일 로드 자체(`import … from 'uuid'`)가 단위 설정의
    트립와이어이고, e2e 설정은 이 스펙이 그 설정으로 실행되지 않으므로 별도 정적 대조가
    필요하다. 다만 실패 시 진단 품질은 다르다 — 단위 쪽이 회귀하면 `ReferenceError: exports
    is not defined` 같은 모듈 로드 에러로 나타나 원인 규명에 한 단계가 더 필요하고, e2e
    쪽은 `toEqual` diff 로 즉시 원인이 보인다. 동작상 결함은 아니고 가독성/디버깅 편의
    수준의 비대칭이라 WARNING 이 아닌 INFO 로 남긴다.
  - 제안: 없음(선택 사항) — 굳이 닫으려면 단위 설정에도 `jest.config.ts` 를 직접
    `import`/`require` 해 `transformIgnorePatterns` 값을 `toEqual(['/node_modules/'])` 로
    단언하는 다섯 번째 테스트를 추가할 수 있으나, 이미 비용 대비 효과가 낮다고 판단되는
    영역(§수렴 기준 아래 참고)이라 신규 항목으로 강제하지 않는다.

## Mock 적절성 · 테스트 격리 · 가독성

가드 4개 테스트 전부 실제 파일시스템(`package.json`, `test/jest-e2e.json`)과 실제 `uuid`
패키지를 읽는 **정적 대조/실동작 호출**이며 mock 이 전혀 없다 — 이 종류의 "설정이 실제로
그 값인가", "그 패키지가 실제로 로드되는가"를 검증하는 인프라 가드에는 mock 을 쓰지 않는
편이 오히려 정확하다(mock 을 쓰면 검증 대상인 실제 파일/실제 모듈 로딩 자체를 우회하게
된다). 각 `it` 은 독립적으로 파일을 다시 읽고 상태를 공유하지 않아 격리도 문제없다.
가독성 측면에서 각 테스트 위 주석이 "왜 이 검증이 존재하는가"·"이 검증이 못 잡는 것은
무엇인가"를 명시적으로 적어 두어(41~60행, 76~87행) 의도가 분명하다.

## 회귀 테스트

기존 스위트(backend unit 473 스위트/9950, e2e 380 PASS — 4라운드 RESOLUTION 실측치)는
이번 라운드에 실질 코드 변경이 한 파일(`package.json` 의 `test:debug` 선언 형태 변경)뿐이라
그대로 유효하다. 새 가드 자체도 이번 라운드에 추가된 테스트가 아니라 3~4라운드에 걸쳐
진화해 온 기존 스위트의 일부다.

## 요약

4라운드가 스스로 선언한 정지 기준("Critical 또는 재현되는 동작 결함이 나오면 조치, 그
외 커버리지/구조/문서 수준만 남으면 수렴 처리") 아래에서, 이번 라운드는 4라운드 WARNING의
수정(`00791d3c8`)이 **독립 뮤테이션 재현(M10 재실행)으로 실제로 회귀를 잡는다는 것**을
확인했고, 새로운 Critical·Warning 은 찾지 못했다. `import.meta.url` 미검증과 단위/e2e
설정 검증 방식의 비대칭은 둘 다 스펙·plan 이 이미 자각하고 문서화한 것으로, 동작 결함이
아니라 스코프 경계의 재확인이라 INFO 로만 남긴다. 저장소는 뮤테이션 후 `cp` 로 원복했고
`git status --short` 로 잔여물이 없음을 확인했다.

## 위험도

NONE
