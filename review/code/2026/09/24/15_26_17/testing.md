# 테스트(Testing) 리뷰 — jest ESM 네이티브 로드 전환 (2회차, 리뷰 1라운드 조치 후)

## 검증 방법

이전 라운드(`review/code/2026/09/24/14_24_10/testing.md`)가 지적한 두 항목 — `test:debug`
SyntaxError, 「플래그+기본 허용목록」 불변식의 전용 가드 부재 — 이 이번 diff 에서 조치됐다고
`RESOLUTION.md` 가 주장한다. 저장소를 뮤테이션하지 않고(파일 편집 없음, 커맨드라인 플래그
변형만) 독립 재현했다:

- `node --experimental-vm-modules ./node_modules/jest/bin/jest.js --testPathPatterns='esm-native-load.spec.ts'`
  → **PASS 3/3** (독립 재현, GREEN).
- 같은 커맨드에서 `--experimental-vm-modules` 만 제거 → **전체 스위트 로드 실패**
  (`Must use import to load ES Module: …/uuid@13.0.2/…`, `Tests: 0 total`) — plan/RESOLUTION 의
  M1 뮤턴트 결과와 **정확히 일치**하는 독립 재현.
- `node --experimental-vm-modules --inspect-brk -r tsconfig-paths/register -r ts-node/register
  ./node_modules/jest/bin/jest.js --runInBand`(수정된 `test:debug` 그대로) → 이전 라운드에서
  즉시 재현됐던 `SyntaxError: missing ) after argument list` 가 더 이상 발생하지 않고
  `--inspect-brk` 의 정상 동작(디버거 연결 대기)으로 hang — 수정이 유효함을 확인. 대기 프로세스는
  종료했다.
- `git status --short` — 세션 종료 시 이 리뷰 산출물 디렉터리(`review/code/2026/09/24/15_26_17/`)
  외 변경 없음. 트리 뮤테이션 없이 검증 완료.

## 발견사항

- **[WARNING]** npm 스크립트 텍스트 자체(jest 호출 프리픽스)를 검증하는 자동 회귀 가드가 없다 — 이 PR이 고친 결함과 정확히 같은 클래스가 재발해도 아무 테스트도 못 잡는다
  - 위치: `codebase/backend/package.json` (`scripts.test:debug`, `scripts.test:watch`, `scripts.test:cov`) · `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts`
  - 상세: 새로 추가된 `esm-native-load.spec.ts`는 `jest.config.ts`의 `transformIgnorePatterns` 값과 `test/jest-e2e.json`의 그것이 서로 어긋나지 않는지를 지킨다 — 이는 **config 값** 수준의 불변식이다. 그런데 이번 라운드의 Warning 1(`test:debug`가 `node_modules/.bin/jest` 셸 shim을 불러 `SyntaxError`로 죽던 것)은 **config 값이 아니라 package.json scripts 필드의 텍스트**가 4곳(`test`/`test:watch`/`test:cov`/`test:e2e`)과 다르게 드리프트한 사례였고, 이 새 가드는 그 종류의 회귀를 전혀 검사하지 않는다. 게다가 harness/CI를 실측한 결과 `test:cov`·`test:watch`·`test:debug` 세 스크립트는 `.claude/test-stages.sh`·`.github/workflows/**`·`Makefile` 어디에서도 호출되지 않는다(`grep -rn "test:cov\|test:watch\|test:debug"` → 매치 0) — 즉 unit 단계는 `pnpm --filter backend test`(=`test` 스크립트)만, e2e 단계는 `test:e2e`만 CI가 실행하고, 나머지 셋은 사람이 로컬에서 수동으로 돌릴 때만 발견된다. 실제로 `test:debug`가 오랫동안 깨진 채 방치됐던 것(`git log -p`로 2026-03-30 scaffold부터 존재, 아키텍처 리뷰어 실측)도 정확히 이 사각 때문이었다. 이 PR이 그 결함 하나는 고쳤지만, "고쳤다"는 사실을 지키는 자동화가 없어 다음에 5개 스크립트 중 하나만 손대면 같은 패턴이 재발해도 CI·guard 어느 쪽도 잡지 못한다.
  - 제안: `esm-native-load.spec.ts` 옆에(혹은 별도 repo-guard로) `package.json`의 `scripts` 중 jest를 직접/간접 호출하는 항목들이 동일한 `--experimental-vm-modules` 프리픽스·`./node_modules/jest/bin/jest.js` 진입점을 공유하는지 정적으로 assert하는 테스트를 추가할 것. 다른 repo-guard(예: `dto-jsdoc-citation-guard.ts`)들처럼 로직을 `-guard.ts`로 분리하면 재사용 가능. 최소한 5개 스크립트 값을 배열로 나열해 "접두어가 다르면 실패"하는 한 줄짜리 스펙만으로도 충분.

- **[INFO]** 새 가드의 canary(`uuid`)는 downlevel 가능한 ESM 패키지라, 이 PR의 핵심 신규 능력(downlevel 원리적 불가능 ESM)은 실제로 검증되지 않는다 — 스펙 헤더/plan 모두 이 사실을 인지하고 있음
  - 위치: `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts:4,30-33` · `plan/in-progress/jest-esm-native-load.md`("덮지 못하는 것" 절)
  - 상세: 이 마이그레이션의 진짜 목적은 "손으로 유지하는 허용목록으로도 어차피 CJS로 우회 가능했던" `uuid`류가 아니라, `@nestjs/typeorm@12`처럼 `import.meta.url`을 써서 **CJS로 downlevel이 원리적으로 불가능한** 패키지를 통과시키는 것이다(`jest.config.ts:39-40`, plan §A). 그런데 canary로 쓰인 `uuid`는 여전히 "허용목록에 넣고 ts-jest로 CJS 변환"해도 동작하는 부류다 — M2 뮤턴트(허용목록 복원)가 RED인 이유도 "허용목록을 안 넣어서"가 아니라 "허용목록을 넣었는데 vm-modules 모드가 이미 CJS로 변환된 파일을 ESM으로 잘못 평가해서" 깨지는 것이다. 즉 이 가드는 "플래그+기본값 페어링"은 확실히 지키지만, "import.meta.url급 ESM-only 의존성이 실제로 로드되는가"는 여전히 미검증이다 — 그 의존성(`@nestjs/typeorm@12`)이 아직 설치되지 않아 지금은 테스트할 수 없다는 제약은 합리적이지만, 이 가드가 그린이라고 해서 `nestjs-v12-coordinated-upgrade.md`가 문제없이 통과할 것이라는 보장은 아니라는 점이 스펙만 봐서는 드러나지 않는다(plan 문서에는 명시돼 있음).
  - 제안: blocking 아님 — 다만 후속 `nestjs-v12-coordinated-upgrade.md` 착수 시 §B "선행 조건"에 "이 가드가 초록이어도 `import.meta.url` 케이스는 별도로 재현 확인할 것"이라는 한 줄을 덧붙이면 다음 세션이 이 가드의 보장 범위를 넓게 오독하지 않는다.

- **[INFO]** (검증 결과 — 긍정적) 이전 라운드가 지적한 두 항목이 실제로 조치됐고, 독립 재현으로 일치를 확인
  - 위치: `codebase/backend/package.json:22-26`, `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts`
  - 상세: "검증 방법" 절 참고. `test:debug`는 나머지 4개와 동일한 `./node_modules/jest/bin/jest.js` 직접 경로로 통일돼 pnpm bin shim 파싱 문제가 사라졌고(재현: 더 이상 즉시 `SyntaxError` 아님), 새 가드는 플래그 제거 시 전체 스위트가 로드 단계에서 죽는 것을 정확히 잡는다(재현: `Tests: 0 total`, import 실패). RESOLUTION이 보고한 M1~M4 뮤테이션 표 중 M1을 커맨드라인 변형만으로 독립 재현해 일치를 확인했다(파일 편집 없이 검증 가능한 유일한 뮤턴트라 이것만 재현했고, M2~M4는 파일 편집이 필요해 재현하지 않았다 — RESOLUTION의 보고 자체는 신뢰할 근거가 충분하다고 판단).
  - 제안: 없음(정보 제공).

- **[INFO]** e2e 설정 대조는 "정적 대조"이지 "행동 검증"이 아니라는 스펙의 자기 고백이 정확함 — 새로운 갭이 아니라 이미 정직하게 스코프가 좁혀진 사례
  - 위치: `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts:41-45`
  - 상세: 세 번째 `it`는 `test/jest-e2e.json`을 `JSON.parse`로 읽어 `transformIgnorePatterns` 값만 비교한다 — 실제로 e2e jest 프로세스를 띄워 동작을 검증하지 않는다. 다만 이 한계는 스펙 자체 헤더(41-45줄)와 plan 문서("덮지 못하는 것" 절)에 이미 명시돼 있어, 리뷰어가 새로 발견해 지적할 성격의 은폐된 갭이 아니라 — 의도적으로 좁게 잡고 그 사실을 투명하게 남긴 설계다. 실제 e2e 동작 검증은 `test/jest-e2e.json`로 도는 `.e2e-spec.ts` 스위트들이 380 PASS로 이미 수행한다(RESOLUTION TEST 결과).
  - 제안: 없음 — 확인만.

## 요약

이번 라운드는 직전 테스트 리뷰(`14_24_10`)가 지적한 두 항목(`test:debug` SyntaxError, 불변식 전용 가드 부재)을 정확히 겨냥해 조치했고, 두 조치 모두 파일을 건드리지 않는 방식(커맨드라인 플래그 변형)으로 독립 재현해 RESOLUTION의 주장과 일치함을 확인했다. 새로 추가된 `esm-native-load.spec.ts`는 트립와이어 방식(모듈 최상단 import 자체가 두 방향 회귀 모두를 로드 단계에서 잡음) + 공허성 가드(canary가 CJS로 돌아가면 실패)로 잘 설계됐고, 스펙 헤더가 자신이 지키지 못하는 것(e2e 설정은 정적 대조일 뿐)을 스스로 명시해 보장 범위를 과장하지 않는다. 다만 이 PR이 실제로 고친 결함(`test:debug` 드리프트)은 "config 값"이 아니라 "package.json scripts 텍스트" 층위였는데, 새 가드는 config 값만 지키고 scripts 텍스트 자체의 정합성을 지키는 자동화는 여전히 없다 — CI가 `test:cov`/`test:watch`/`test:debug`를 전혀 실행하지 않는다는 사실까지 확인했으므로, 5개 스크립트 중 하나가 다시 어긋나도 다음 발견은 또 사람의 수동 재현에 의존하게 된다. 이것이 유일한 WARNING이고, 이 diff를 되돌릴 사유는 아니다.

## 위험도
LOW
