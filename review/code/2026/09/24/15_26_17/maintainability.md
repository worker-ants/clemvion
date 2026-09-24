# 유지보수성(Maintainability) 리뷰

## 검토 방법

실제 코드/설정 변경은 5개 파일이다: `PROJECT.md`, `codebase/backend/jest.config.ts`,
`codebase/backend/package.json`, `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts`(신규),
`codebase/backend/test/jest-e2e.json`. 나머지(plan 문서 2건, `review/code/2026/09/24/14_24_10/**`,
`review/consistency/2026/09/24/{12_57_36,13_55_20}/**`)는 이전 라운드 산출물·plan 문서로, 코드가 아니라
가독성/네이밍/함수 길이 등 본 관점의 대상이 아니다.

이전 라운드(`review/code/2026/09/24/14_24_10/maintainability.md`)가 WARNING 으로 지적한 `test:debug`
스크립트의 `node_modules/.bin/jest` 잔존은 실제 파일(`codebase/backend/package.json:25`)을 직접 열어
확인한 결과 이미 `./node_modules/jest/bin/jest.js` 로 통일돼 있다 — `RESOLUTION.md` 의 조치 기록과 일치한다.
같은 라운드가 WARNING 으로 지적한 `jest.config.ts` 상단 docstring 의 stale 서술도 현재 파일에서 이미
"허용목록이 사라졌고 지금 무엇을 주석해야 하는지"로 갱신돼 있음을 확인했다. 두 항목 모두 재발하지 않았다.

## 발견사항

- **[INFO]** `package.json` 5개 test 스크립트가 15단어 접두어(`node --experimental-vm-modules
  ./node_modules/jest/bin/jest.js`)를 그대로 복제
  - 위치: `codebase/backend/package.json` (`scripts.test`·`test:watch`·`test:cov`·`test:debug`·`test:e2e`)
  - 상세: 다섯 줄 모두 동일 접두어를 문자 그대로 반복한다(`test:debug`는 그 뒤에 `--inspect-brk -r ...`가
    끼어들어 있다). jest 바이너리 경로가 바뀌거나 `--experimental-vm-modules` 플래그가 Node 에서
    안정화되어 제거될 때 5곳을 동시에 고쳐야 한다 — 정확히 이 PR 이 `transformIgnorePatterns`
    허용목록에서 없애려 한 "손으로 병렬 유지되는 목록은 갈라진다" 패턴이 스크립트 레이어에서 다시
    나타난 형태다. 다만 이 지적은 이전 라운드(`review/code/2026/09/24/14_24_10/maintainability.md`
    INFO 2)에서 이미 나왔고, `RESOLUTION.md` INFO 7 이 "5곳 정도는 단일화가 오히려 간접층을 만든다"는
    근거로 명시적으로 defer 했다 — 새로 발견한 문제는 아니며 이미 판단된 트레이드오프임을 재확인한다.
  - 제안: 현 규모(5줄)에서는 추가 조치 불필요. 접두어가 늘어나거나(6번째 스크립트 추가 등) 플래그
    자체가 바뀌는 시점이 오면 그때 셸 스크립트/합성으로 뽑는 것을 재검토.

- **[INFO]** `jest.config.ts` 의 `transformIgnorePatterns` 주석(19~40행, 약 22줄)이 실제 값(`['/node_modules/']`,
  1줄)에 비해 상당히 길다
  - 위치: `codebase/backend/jest.config.ts:19-40`
  - 상세: 게이트의 정체(Node 버전이 아니라 `--experimental-vm-modules` 플래그) · 두 변경이 한 쌍이라는
    불변식 · 되돌렸을 때 각각 어떤 에러가 나는지까지 담고 있어 분량이 크다. 다만 같은 파일 하단
    `forceExit` 관련 주석(50~70행)도 비슷한 밀도로 이미 존재해 파일 전체의 기존 스타일과 일관되고,
    이 파일 자체의 존재 이유(docstring: "JSON 은 주석을 못 담으니 이 근거를 여기 옮겨 적는다")와도
    부합한다. 결함이 아니라 관찰이다.
  - 제안: 조치 불필요. 단, 향후 이 파일에 세 번째 이상 이런 분량의 "왜" 주석 블록이 쌓이면 파일
    docstring 을 목차형으로 정리하는 것을 고려.

- **[INFO]** 신규 가드 스펙의 세 번째 테스트가 e2e 설정 경로를 문자열 상대경로 리터럴로 하드코딩
  - 위치: `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts` (`e2e 설정도
    transformIgnorePatterns 를 기본값으로 둔다` 테스트, `path.resolve(__dirname, '../../../test/jest-e2e.json')`)
  - 상세: `../../../` 세 단계 traversal 이 `__dirname`(`src/repo-guards/__tests__/`) 기준으로 정확히
    backend 루트의 `test/jest-e2e.json` 을 가리키는 것은 확인했다. 다만 형제 가드
    `production-build-devdep-guard.ts` 는 같은 종류의 경로 계산을 파라미터(`backendDir`)로 받는 순수
    함수로 분리해 재사용·테스트하는 규약(파일 헤더가 "파서 순수 로직과 소비 spec 을 분리하는 규약"이라
    명시)을 쓰는 반면, 이 파일은 세 테스트 모두를 `describe` 블록 안에 인라인했다. 다만 `esm-native-load`
    는 파싱 로직이 없고(단순 `require`/`JSON.parse`) `workspace-roles-attachment.spec.ts` 도 같은
    이유로 별도 `-guard.ts` 없이 단일 spec 으로 존재하는 선례가 있어, 이 자체를 컨벤션 위반으로 보지는
    않는다.
  - 제안: 조치 불필요(선례와 정합). 다만 이 스펙 파일이 향후 이동(예: `__tests__` 계층 재구성)될 경우
    `../../../` 개수를 그대로 두면 조용히 다른 파일을 가리키게 된다는 점만 남겨 둔다 — 지금 당장의
    결함은 아니다.

## 긍정적으로 눈에 띈 점

- 신규 `esm-native-load.spec.ts`: 이름·`describe`/`it` 문구가 검증 대상(“ESM-only 의존성 네이티브 로드”)을
  정확히 드러내고, 공허성 가드(canary 가 CJS 로 돌아가면 나머지 테스트가 아무것도 지키지 못한 채
  초록이 되는 것을 막는 첫 테스트)를 별도로 둔 점은 이 리뷰가 반복해 지적해 온 "GREEN 은 증거가
  아니다" 문제를 스스로 예방한 설계다.
- `test:debug` 를 포함한 5개 스크립트 형태 통일, `jest.config.ts` docstring 최신화 등 이전 라운드
  WARNING 이 정확히 재현한 자리에 정확히 반영돼 재발이 없다.
- 손으로 유지하던 6-패키지 allowlist 정규식(그마저 unit/e2e 간 이미 어긋나 있던)을 jest 기본값으로
  되돌린 것은 "설정을 건드리지 않고 확장 가능"해진다는 점에서 순수한 유지보수 부담 감소다.

## 요약

실제 코드 변경은 backend Jest 설정 3개 파일과 신규 가드 스펙 1개로 좁고, 로직 코드(함수·클래스·분기)를
사실상 포함하지 않는 순수 tooling 변경이라 가독성·네이밍·함수 길이·중첩 깊이·순환 복잡도 관점에서는
검토할 표면이 거의 없다. 이전 라운드가 잡은 두 WARNING(`test:debug` 표기 드리프트, `jest.config.ts`
stale docstring)은 이번 diff 에서 이미 고쳐진 상태로 실제 파일을 열어 확인했고 재발하지 않았다. 남은
관찰은 전부 INFO 이며, 그중 가장 눈에 띄는 "5개 npm 스크립트의 접두어 복제"도 새 발견이 아니라 이전
라운드에서 이미 제기되고 `RESOLUTION.md` 가 근거를 남기며 defer 한 항목이다. 신규 테스트 파일은 이름과
공허성 가드 설계가 신뢰할 만하다. Critical/Warning 급 유지보수성 결함은 발견되지 않았다.

## 위험도

LOW
