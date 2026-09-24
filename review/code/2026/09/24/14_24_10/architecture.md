# 아키텍처(Architecture) 리뷰

## 발견사항

- **[WARNING]** `test:debug` npm 스크립트가 이미 깨져 있다 — 이번 PR이 그 줄을 만졌음에도 발견하지 못함
  - 위치: `codebase/backend/package.json:25` (`"test:debug": "node --experimental-vm-modules --inspect-brk -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --runInBand"`)
  - 상세: 이번 diff는 `test`/`test:watch`/`test:cov`/`test:e2e` 4개 스크립트를 `node --experimental-vm-modules ./node_modules/jest/bin/jest.js` 형태로 통일했지만, `test:debug`만 예전 `node_modules/.bin/jest` 경로를 그대로 남겼다. 이 워크트리(pnpm)에서 `node_modules/.bin/jest`는 심볼릭 링크가 아니라 `NODE_PATH`를 설정해 주는 POSIX 셸 래퍼 스크립트다(`#!/bin/sh` + `basedir=$(dirname ...)`). 실측: `node node_modules/.bin/jest --version` → `SyntaxError: missing ) after argument list`(Node v24.17.0, 이 워크트리). 반면 `node --experimental-vm-modules ./node_modules/jest/bin/jest.js --version` → `30.5.0`으로 정상 동작한다(대조 실측). `git log -p -L '/"test:debug"/,+1'`로 추적하면 이 형태는 2026-03-30 최초 scaffold 커밋부터 있었고, pnpm 마이그레이션(`.bin`이 symlink 대신 셸 래퍼가 되는 시점) 이후 조용히 깨졌을 가능성이 높다 — 이번 PR이 만든 결함은 아니다. 다만 "jest를 어떻게 호출하는가"라는 계약이 5개 스크립트에 손으로 각각 중복돼 있어 단일 진실 지점이 없고, 그 결과 자매 스크립트 4개가 새 형태로 수렴하는 동안 이 한 곳만 드리프트를 눈치채지 못했다 — 정확히 이 PR이 `transformIgnorePatterns`에서 제거하려 한 "손으로 유지하는 목록은 갈라진다"는 패턴이 `package.json` 스크립트 레이어에서 재현된 사례다.
  - 제안: `test:debug`도 `./node_modules/jest/bin/jest.js`로 통일. 근본적으로는 5개 스크립트에 반복되는 `node --experimental-vm-modules ...` 접두어를 쉘 스크립트나 npm-script 합성으로 뽑아 단일 진실 지점화할 것 — 지금처럼 손으로 5곳에 복제하면 다음 드리프트(예: Node에서 플래그가 안정화되어 제거될 때)도 같은 방식으로 새어나간다.

- **[INFO]** 손으로 유지하던 ESM allowlist 제거는 개방-폐쇄 원칙(OCP) 개선
  - 위치: `codebase/backend/jest.config.ts:17-39`, `codebase/backend/test/jest-e2e.json:9`
  - 상세: 기존 `transformIgnorePatterns` 정규식 allowlist(uuid/p-limit/yocto-queue/otplib/@otplib/@scure/@noble)는 새 ESM 패키지가 추가될 때마다 사람이 두 파일(unit/e2e)에 각각 수정해야 했고, 실제로 두 목록이 이미 서로 어긋나 있었다(unit은 6개, e2e는 3개만 등재). `--experimental-vm-modules` + 기본 `transformIgnorePatterns`로 전환하면 신규 ESM 의존성 추가 시 설정 수정이 불필요해진다 — "설정을 수정하지 않고 확장 가능"이라는 점에서 OCP에 부합하는 개선이며, `@nestjs/typeorm@12`처럼 `import.meta.url` 때문에 애초에 CJS로 downlevel이 불가능한 의존성까지 다루므로 이전 방식으로는 원리적으로 닿지 못하던 지점이다. plan 문서(§C-4)의 판별 실험(플래그만 제거 시 RED)으로 "두 변경이 한 쌍"이라는 설계 근거를 실측 검증한 점도 확인했다.

- **[INFO]** 테스트 인프라가 Node의 experimental 플래그에 결합됨 — 인지된 트레이드오프
  - 위치: `codebase/backend/package.json:22-26` (전 스크립트), `plan/in-progress/jest-esm-native-load.md:79-81`(§C)
  - 상세: 5개 npm 스크립트 전부가 `--experimental-vm-modules`라는 Node 실험 플래그에 의존하게 됐다. 이 플래그의 의미/이름이 Node에서 바뀌거나 제거되면(안정화 시 흔한 패턴) 5곳을 동시에 손봐야 한다 — 이는 위 WARNING 항목이 지적한 중복 문제와 같은 결이다. plan 문서가 `ExperimentalWarning` 배너를 의도적으로 남겨 신호로 삼겠다고 명시했으므로(§C) 리스크 자체는 인지되고 있으나, 설계상 "테스트 러너 호출 방식"이라는 하나의 관심사가 5개 파일에 흩어진 채 실험적 런타임 동작에 결합돼 있다는 점은 다음 Node 메이저 업그레이드 시 재검증 지점으로 남겨 둘 필요가 있다.

- **[INFO]** 작업 스코프 경계가 명확하게 나뉨 (참고, 코드 외 관찰)
  - 위치: `plan/in-progress/jest-esm-native-load.md`(§E "하지 않는 것"), `plan/in-progress/nestjs-v12-coordinated-upgrade.md`(§B "선행 조건")
  - 상세: 이번 PR(테스트 러너 ESM 네이티브 로딩)과 그 뒤를 잇는 "NestJS 12 동반 업그레이드"를 별도 plan으로 명확히 분리하고, 후자가 전자를 선행 조건으로 참조하는 단방향 의존을 문서화했다. `@nestjs/common@12` 없이 `platform-express@12`만 올리면 런타임에서 죽는다는 실측(§A)까지 근거로 남겨, 부분 메이저 범프라는 "성립하지 않는 중간 상태"를 아예 시도하지 않도록 설계했다 — 모듈 경계(어디까지가 이번 변경의 책임인가)를 코드가 아닌 계획 단계에서부터 잘 그은 사례.

## 요약

이번 변경은 애플리케이션 런타임 레이어가 아니라 backend의 Jest 테스트 도구 설정(`jest.config.ts`, `package.json` scripts, `test/jest-e2e.json`)에 국한된 빌드/테스트 인프라 리팩터다. 두 파일에 따로 유지되며 이미 서로 어긋나 있던 손-유지 ESM allowlist를 제거하고 Node의 `--experimental-vm-modules`를 통한 네이티브 ESM 로딩으로 전환한 것은, `import.meta.url`처럼 원리적으로 CJS 변환이 불가능한 의존성까지 다룰 수 있게 하고 향후 ESM 패키지 추가 시 설정 수정을 없앤다는 점에서 OCP 관점의 실질적 개선이며, 판별 실험으로 설계 근거("두 변경이 한 쌍")를 스스로 검증한 점도 신뢰할 만하다. 다만 그 처방을 5개의 npm 스크립트에 손으로 복제하는 과정에서, 정확히 이 PR이 없애려던 "손으로 병렬 유지되는 목록은 갈라진다"는 패턴이 스크립트 레이어에서 재현됐다 — `test:debug`만 옛 `node_modules/.bin/jest`(pnpm 환경에서 유효한 JS가 아닌 셸 래퍼) 경로를 남겨 실제로 실행 시 `SyntaxError`가 나는 것을 실측으로 확인했다(사전에 존재하던 결함으로 보이며 이번 PR이 만든 것은 아니지만, 바로 그 줄을 만지면서도 잡지 못했다). 순환 의존·레이어 위반·모듈 경계 침범 등 더 넓은 아키텍처 문제는 발견되지 않았고, 오히려 후속 NestJS 12 업그레이드 plan과의 선행 조건 분리는 스코프 경계를 잘 그은 사례다.

## 위험도
LOW
