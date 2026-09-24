# 의존성(Dependency) 리뷰

## 발견사항

- **[INFO]** 새 외부 의존성 없음, lockfile 무변경 — 이 PR 은 순수 tooling 변경이다
  - 위치: `codebase/backend/package.json` (전체), `pnpm-lock.yaml` (변경분에 미포함)
  - 상세: `git diff origin/main...HEAD --stat` 로 확인한 변경 파일 목록에 `pnpm-lock.yaml` 이 없고, `package.json` diff 는 `scripts` 블록 10줄(제거 5 + 추가 5)에 한정된다. `dependencies`/`devDependencies` 항목은 전부 동일 버전 그대로다(예: `uuid: ^14.0.1`, `otplib: ^13.4.1`, `jest: ^30.5.1`, `ts-jest: ^29.2.5`, `@nestjs/typeorm: ^11.0.3` 등 미변경). 즉 버전 고정·라이선스·취약점·번들 크기 관점에서 이 diff 자체가 유발하는 리스크는 없다. `plan/in-progress/nestjs-v12-coordinated-upgrade.md` 가 실제 `@nestjs/*` v12 의존성 범프를 별도 후속 plan 으로 명시적으로 분리해 둔 점도 의존성 변경을 이 PR 스코프 밖으로 적절히 격리한 것으로 보인다.
  - 제안: 없음(정보 제공).

- **[INFO]** 손으로 유지하던 ESM 허용목록을 jest 기본값으로 되돌림 — 내부 유지보수 부담 감소 + 기존 drift 해소
  - 위치: `codebase/backend/jest.config.ts:39`, `codebase/backend/test/jest-e2e.json:9`
  - 상세: 기존에는 `transformIgnorePatterns` 에 ESM 전용 패키지(`uuid`, `p-limit`, `yocto-queue`, `otplib`, `@otplib`, `@scure`, `@noble`)를 수동 나열한 허용목록이 있었고, 패키지가 ESM 으로 전환될 때마다 사람이 목록을 늘려야 하는 구조였다. 또한 unit 설정(`jest.config.ts`, 6개 패키지)과 e2e 설정(`test/jest-e2e.json`, `uuid|p-limit|yocto-queue` 3개)이 **이미 서로 어긋나 있었다** — 두 설정 파일 간 의존성 목록 동기화가 깨져 있던 기존 결함을, jest 기본값(`['/node_modules/']`)으로 되돌려 원천 제거했다. `@nestjs/typeorm@12` 처럼 `import.meta.url` 을 쓰는(=CJS 로 downlevel 자체가 불가능한) 향후 ESM-only 의존성도 이 방식으로만 수용 가능하므로, 방향성은 타당하다.
  - 제안: 없음 — 개선으로 판단.

- **[INFO]** 버전 고정된 npm 의존성 대신 실험적(experimental) Node.js 플래그에 테스트 인프라가 의존하게 됨
  - 위치: `codebase/backend/package.json:22-26` (`node --experimental-vm-modules ...`), `codebase/backend/jest.config.ts:17-39` (주석 근거)
  - 상세: 이 변경의 핵심 게이트는 npm 의존성 버전이 아니라 `--experimental-vm-modules` 플래그가 노출하는 `vm.SourceTextModule.prototype.hasAsyncGraph` 라는 **jest-runtime 내부 probe**다(`plan/in-progress/jest-esm-native-load.md` §A 실측). 이는 SemVer 로 보증되는 공개 API 가 아니라 Node/V8 내부 구현에 결합된 값이고, 이번 조사에서 이미 "jest 의 에러 메시지가 원인을 잘못 가리켰다"는 것이 확인됐다(Node 버전 힌트는 오도, 실제 게이트는 플래그). 향후 Node 마이너/메이저에서 이 내부 property 가 바뀌면 유사한 진단 난이도의 회귀가 재발할 수 있다. 다만 저자들이 이 트레이드오프를 이미 측정·문서화했고(§C 비용 항목, `ExperimentalWarning` 을 의도적으로 숨기지 않음), `engines.node: ">=24"` 와 CI `node-version: '24'` 핀이 일치하는 것도 확인했다(`.github/actions/pnpm-workspace/action.yml`, `harness-checks.yml`, `deps-security-checks.yml`, `deps-peer-observe.yml` 전부 `'24'`).
  - 제안: `engine-strict=false`(`.npmrc`) 상태라 로컬에서 `>=24` 범위 내 더 낮은 패치(예: 24.0~24.8 대)를 쓰는 기여자가 있다면 같은 종류의 오도된 에러를 다시 밟을 수 있다. 여유가 될 때 `jest.config.ts` 의 `globalSetup` 등에 `typeof require('node:vm').SourceTextModule?.prototype?.hasAsyncGraph === 'function'` 1줄 가드를 추가해, 게이트 부재 시 "Node 버전 문제"가 아니라 "플래그/버전 확인" 이라는 명확한 메시지로 fail-fast 하게 하는 것을 고려. (blocking 아님 — 이미 실측·문서화된 trade-off이므로 INFO.)

- **[INFO]** 스크립트 간 jest 실행 경로 표기 불일치(사소)
  - 위치: `codebase/backend/package.json:25` (`test:debug`) vs `:22,23,24,26` (`test`, `test:watch`, `test:cov`, `test:e2e`)
  - 상세: `test`/`test:watch`/`test:cov`/`test:e2e` 는 `node --experimental-vm-modules ./node_modules/jest/bin/jest.js` 로 실제 진입점 파일을 직접 가리키는 반면, `test:debug` 만 기존 그대로 `node_modules/.bin/jest`(bin 심볼릭 링크)를 그대로 쓴다. pnpm `node-linker=isolated` 레이아웃에서도 `jest` 는 backend 의 **직접** devDependency 라 `.bin/jest` 심볼릭 링크가 동일 파일(`node_modules/jest/bin/jest.js`)을 가리켜 기능적으로는 동등하다 — 실동작 리스크는 없다.
  - 제안: 가독성·일관성 차원에서 후속 편집 시 한 형태로 통일 권장(blocking 아님).

## 요약

이번 diff 는 새 외부 패키지 추가·버전 범프·lockfile 변경이 전혀 없는 **순수 테스트 tooling 변경**이다. jest 를 `--experimental-vm-modules` 플래그로 구동해 ESM 전용 패키지를 네이티브로 로드하게 하고, 손으로 유지하던 `transformIgnorePatterns` 허용목록(이미 unit/e2e 두 설정 간 drift 가 있었음)을 jest 기본값으로 되돌렸다 — 이는 향후 `@nestjs/typeorm@12`(`import.meta.url`, CJS downlevel 불가) 같은 ESM-only 의존성을 받아들이기 위한 선행 조건이며, 실제 NestJS v12 의존성 범프 자체는 `plan/in-progress/nestjs-v12-coordinated-upgrade.md` 로 스코프가 명확히 분리되어 있다. 유일한 실질적 dependency-관점 리스크는 SemVer 로 보증되지 않는 Node 실험 플래그/내부 V8 probe 에 테스트 실행이 결합된 점이지만, 저자들이 이를 실측·판별 실험(플래그만 제거 시 RED 재현)까지 거쳐 명시적으로 문서화했고 CI Node 버전 핀과도 정합한다. Critical/Warning 급 결함은 발견되지 않았다.

## 위험도
LOW
