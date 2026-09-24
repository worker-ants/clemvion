# 부작용(Side Effect) 리뷰

## 검토 범위 요약

실행 가능한 코드/설정 변경은 5개뿐이다: `PROJECT.md`(문서), `codebase/backend/jest.config.ts`,
`codebase/backend/package.json`(scripts), `codebase/backend/test/jest-e2e.json`,
`codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts`(신규). 핵심 변경은 backend
jest 를 `node --experimental-vm-modules` 로 구동하고 `transformIgnorePatterns` 를 손으로 유지하던
ESM 허용목록에서 jest 기본값(`['/node_modules/']`)으로 되돌리는 것이다. 나머지 파일(plan 문서,
`review/code/2026/09/24/{14_24_10,15_26_17}/**`, `review/consistency/**`)은 이전 라운드 산출물이
이번 diff 에 커밋으로 편입된 것이며 실행되는 코드가 아니다.

이미 두 차례(`14_24_10`, `15_26_17`) 전수 리뷰가 이 코드를 검토했고, `15_26_17/RESOLUTION.md` 는
Warning 2건(모두 side_effect 관점이 아닌 documentation/testing 관점)을 조치 완료로 기록했다. 이번
검토는 그 결론을 재사용하지 않고, side effect 관점 8개 항목을 워킹트리 실물 파일 기준으로
독립적으로 재확인했다.

## 독립 검증 내역

- **인터페이스 변경 범위**: `package.json` 의 `test`/`test:watch`/`test:cov`/`test:debug`/`test:e2e`
  5개 스크립트 전부가 현재 `./node_modules/jest/bin/jest.js` 를 직접 가리키고 `--experimental-vm-modules`
  를 공유한다(직접 `Read` 로 확인). 이전 라운드가 지적한 `test:debug` 만 셸 셈(`node_modules/.bin/jest`)을
  남긴 드리프트는 이미 고쳐져 있다.
- **호출 경로 전수 확인** (side_effect 관점 6·7 — 환경/외부 호출 우회 여부): `.github/workflows/backend-checks.yml`,
  `.github/workflows/packages-checks.yml`, `.claude/test-stages.sh`(`cmd_unit`), `docker-compose.e2e.yml`
  모두 `pnpm --filter backend test` / `pnpm run test:e2e` 형태로 `package.json` scripts 를 경유함을
  grep 으로 직접 대조했다 — jest 바이너리를 스크립트 우회해서 직접 부르는 CI/Docker 경로는 없다.
  (`.vscode/launch.json` 등 IDE 설정도 저장소에 없어 그쪽 우회 경로도 없음을 확인.)
- **ESM 네이티브 전환이 기존 mocking 을 조용히 깨지 않는지** (side effect 관점 1·8 — 의도치 않은
  런타임 동작 변경): `transformIgnorePatterns` 변경으로 CJS 변환에서 네이티브 ESM 로드로 전환된
  패키지(`uuid`, `otplib`, `p-limit`, `yocto-queue`, `@otplib`, `@scure`, `@noble`)에 대해
  `jest.mock('uuid'|'otplib'|'p-limit'|...)` 또는 해당 모듈 네임스페이스에 대한 `jest.spyOn` 사용을
  `src`/`test` 전체에서 grep 했으나 **0건**이다. 네이티브 ESM 모듈 네임스페이스는 불변(freeze)이라
  `jest.spyOn(moduleNs, 'fn')` 이 있었다면 `TypeError: Cannot redefine property` 로 조용히 깨질
  수 있는 자리인데, 그 자리가 존재하지 않음을 확인했다 — RESOLUTION.md 가 보고한 전 스위트 그린
  (473/9950 unit, 380 e2e)과 일치한다.
- **파일시스템 부작용**: 신규 `esm-native-load.spec.ts` 는 `fs.readFileSync` 로 `package.json` ·
  `test/jest-e2e.json` 를 **읽기만** 한다(쓰기·삭제 없음). `createRequire` 로 `uuid/package.json` 을
  require 하는 것도 부작용 없는 조회다.
- **전역 변수·환경변수**: 신규/변경 코드에 전역 변수 도입이나 `process.env` 읽기/쓰기는 없다.
  `--experimental-vm-modules` 는 CLI 플래그이며 `start`/`start:prod` 등 프로덕션 실행 스크립트에는
  붙지 않음을 `package.json` 전체 대조로 재확인했다 — 배포 런타임 공격 표면·동작에는 영향이 없다.
- **네트워크 호출**: 없음. 순수 로컬 파일/모듈 로딩 변경이다.

## 발견사항

- **[INFO]** `--experimental-vm-modules` 는 SemVer 로 보증되지 않는 Node 내부 probe(`vm.SourceTextModule.prototype.hasAsyncGraph`)에 게이트가 걸려 있다
  - 위치: `codebase/backend/jest.config.ts` (신규 주석 블록, `transformIgnorePatterns` 필드 주석)
  - 상세: 주석 자체가 "게이트는 플래그이지 Node 버전이 아니다" 를 실측으로 밝히고 있다. 이는 공개
    API 계약이 아닌 Node/V8 내부 구현에 결합된 값이라, 향후 Node 마이너/메이저에서 이 내부
    property 가 이름이 바뀌거나 사라지면 `test`/`test:watch`/`test:cov`/`test:debug`/`test:e2e`
    5개 스크립트 전부가 한꺼번에 다시 깨질 수 있다. 부작용의 성격은 "의도치 않은 상태 변경" 이
    아니라 "장래의 잠재적 회귀 지점을 5곳에 동시에 심는다"는 것이다. 이미 문서화·실측된 트레이드
    오프이고 이전 라운드에서도 같은 관측이 나왔으므로 blocking 은 아니다.
  - 제안: 조치 불요(이미 인지·문서화됨). 재발 시 진단 난이도를 낮추려면 `globalSetup` 에 게이트
    존재를 확인하는 1줄 fail-fast 가드를 고려할 수 있음 — 이전 라운드 dependency.md 가 이미 제안한
    것과 동일하며 이번에도 우선순위는 낮음.

- **[INFO]** 테스트 스크립트 호출 경로를 우회하는 진입점(IDE 테스트 러너, `npx jest` 직접 실행)은 이번 변경의 보증 밖이며, 이는 신규 가드 스펙 자신이 명시하고 있다
  - 위치: `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts` (파일 상단 주석,
    "이 가드가 덮지 못하는 것" 단락)
  - 상세: `--experimental-vm-modules` 는 CLI 인자라 5개 npm script 문자열에만 존재한다. 이 스크립트를
    우회해 `jest` 를 직접 호출하면(IDE 확장, `pnpm exec jest`, 로컬 `npx jest`) 여전히
    `Must use import to load ES Module` 로 실패한다 — 이는 **부작용**이라기보다 회귀 감지 범위의
    경계이며, 가드 스펙이 스스로 그 경계를 인정하고 있어 은폐된 위험은 아니다. `.vscode/launch.json`
    등 저장소에 커밋된 IDE 설정이 없음을 확인해 저장소 차원에서 이 경로에 의존하는 자동화는 없다.
  - 제안: 조치 불요 — 참고용 기록.

## 요약

핵심 변경(`jest.config.ts`/`package.json`/`test/jest-e2e.json`)은 backend jest 테스트 러너 내부의
모듈 로딩 방식(허용목록 기반 CJS 변환 → Node 플래그를 통한 네이티브 ESM 로드) 전환에 한정되며,
프로덕션 런타임·전역 변수·환경 변수·네트워크·파일시스템 쓰기·공개 함수 시그니처 어디에도 부작용을
내지 않는다. 이전 두 라운드가 지적한 유일한 side-effect 급 결함(`test:debug` 셸 스크립트 드리프트)은
현재 워킹트리에서 이미 수정돼 있음을 직접 확인했다. 이번 검토는 그 결론에 더해 (1) CI/Docker/워치독
전 경로가 `package.json` scripts 를 경유해 새 플래그를 실제로 상속받는지, (2) 네이티브 ESM 전환
대상 패키지에 대한 `jest.mock`/`jest.spyOn` 이 있어 "모듈 네임스페이스 불변" 문제로 조용히 깨질
자리가 있는지를 독립적으로 재검증했고, 둘 다 문제 없음을 확인했다. 남은 리스크는 SemVer 밖의 Node
내부 probe 에 5개 스크립트가 동시에 결합돼 있다는 것과 스크립트 우회 호출은 보증 밖이라는 점뿐이며,
둘 다 저자가 이미 실측·문서화한 트레이드오프다.

## 위험도

LOW
