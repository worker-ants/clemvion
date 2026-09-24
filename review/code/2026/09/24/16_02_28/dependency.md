# 의존성(Dependency) 리뷰

## 발견사항

- **[INFO]** 새 외부 의존성·버전 범프·lockfile 변경이 전혀 없다 — 순수 테스트 tooling 변경
  - 위치: `codebase/backend/package.json` (전체), `codebase/backend/jest.config.ts:19-41`, `codebase/backend/test/jest-e2e.json:9`
  - 상세: `git diff origin/main..HEAD --stat` 로 직접 확인한 8개 변경 파일 중 `pnpm-lock.yaml`·`pnpm-workspace.yaml`·루트 `package.json` 은 없다. `codebase/backend/package.json` diff 는 `scripts` 블록(제거 5줄 + 추가 5줄)뿐이고, `dependencies`/`devDependencies` 섹션을 직접 열어 확인한 결과 `jest: ^30.5.1`, `uuid: ^14.0.1`, `otplib: ^13.4.1`, `p-limit: ^7.3.2`, `@nestjs/typeorm: ^11.0.3` 전부 원본 그대로다. 즉 새 의존성 필요성·버전 고정·라이선스·취약점·전이 의존성 충돌 관점에서 이 diff 자체가 만드는 리스크는 없다.
  - 제안: 없음(정보 제공).

- **[INFO]** 손으로 유지하던 ESM `transformIgnorePatterns` 허용목록(unit/e2e 두 곳, 이미 서로 발산해 있었음) 제거 — 기존 drift 해소 + 향후 downlevel-불가 ESM 의존성 수용 가능
  - 위치: `codebase/backend/jest.config.ts:41` (`transformIgnorePatterns: ['/node_modules/']`), `codebase/backend/test/jest-e2e.json:9`
  - 상세: 이전 unit 목록(`uuid|p-limit|yocto-queue|otplib|@otplib|@scure|@noble`)과 e2e 목록(`uuid|p-limit|yocto-queue`)이 이미 서로 어긋나 있었고, 패키지가 ESM 으로 갈 때마다 두 파일을 손으로 갱신해야 하는 구조였다. `node --experimental-vm-modules` 네이티브 로드로 전환하면서 이 두 파일을 jest 기본값으로 되돌려 drift 자체를 원천 제거했다. 특히 `@nestjs/typeorm@12`(`import.meta.url` 사용, CJS downlevel 원리적으로 불가)처럼 이전 레버로는 애초에 수용이 불가능했던 클래스의 의존성도 이 방식으로만 받을 수 있다 — plan(`jest-esm-native-load.md` §A)의 실측(허용목록에 `@nestjs/typeorm` 추가·스코프 확대 두 방식 모두 실패)이 그 근거다.
  - 제안: 없음 — 개선으로 판단.

- **[INFO]** 테스트 실행이 SemVer 로 보증되지 않는 Node 실험 플래그 + jest 내부 probe 에 결합됨 — 이미 실측·판별실험·뮤테이션 가드로 완화됨
  - 위치: `codebase/backend/package.json:22-26` (`node --experimental-vm-modules ./node_modules/jest/bin/jest.js`), `codebase/backend/jest.config.ts:26-32`(근거 주석), `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts`
  - 상세: 실제 게이트는 Node 버전이 아니라 `--experimental-vm-modules` 가 노출하는 `vm.SourceTextModule` 이다 — 직접 재현했다: 플래그 없이 `typeof require('node:vm').SourceTextModule` → `undefined`, 플래그와 함께 → `function`(Node v24.17.0, 이 워크트리). 이는 jest-runtime 내부 구현에 결합된 값이지 공개 SemVer 계약이 아니다. 다만 (1) `engines.node: ">=24"`(루트·backend 공통)와 CI `node-version: '24'`(`deps-peer-observe.yml`·`harness-checks.yml`·`deps-security-checks.yml`·`.github/actions/pnpm-workspace/action.yml` 4곳)이 서로 정합함을 직접 grep 으로 확인했고, (2) `esm-native-load.spec.ts` 가 M1~M4 뮤테이션(플래그 제거·허용목록 복원·e2e 설정 발산·canary CJS 가정)으로 이 불변식을 결함 재발 시 즉시 RED 로 잡도록 이름 붙여 고정했으며, (3) 회귀 형태가 "조용한 손상"이 아니라 로드 단계 전체 실패라 은닉 가능성이 낮다. 순수 신규 리스크가 아니라 이미 식별·완화된 trade-off 로 판단한다.
  - 제안: 없음(blocking 아님). `jest` 자체의 향후 minor 상향 시 이 가드 스펙이 여전히 회귀를 잡는지 재확인하는 정도면 충분.

- **[INFO]** 직전 라운드에서 지적된 `test:debug` script 경로 drift 가 이 라운드에서 해소된 상태를 재확인
  - 위치: `codebase/backend/package.json:22-26`
  - 상세: 현재 파일을 직접 열어 `test`·`test:watch`·`test:cov`·`test:debug`·`test:e2e` 5개 스크립트 전부가 `node --experimental-vm-modules ./node_modules/jest/bin/jest.js` (test:debug 는 추가로 `--inspect-brk -r tsconfig-paths/register -r ts-node/register`) 형태로 동일 진입점·동일 플래그를 쓰는 것을 확인했다. 1라운드(`14_24_10`)에서 `test:debug` 만 옛 `node_modules/.bin/jest`(pnpm 환경에서 `SyntaxError`를 내는 셸 wrapper)를 남겼던 drift 는 `815d2e180` 로 조치됐고, `esm-native-load.spec.ts` 의 "jest 를 띄우는 script 전부가 같은 플래그·진입점을 쓴다" 단언이 이를 정적으로 고정한다.
  - 제안: 없음 — 확인용 기재.

- **[INFO]** 실제 `@nestjs/*` v12 의존성 범프는 이 diff 밖 — 부분 메이저 범프 회피를 별도 plan 으로 명시적 격리
  - 위치: `plan/in-progress/nestjs-v12-coordinated-upgrade.md` (전체, 미착수 스텁), `codebase/backend/package.json` (`@nestjs/typeorm: ^11.0.3` 등 미변경 확인)
  - 상세: 막힌 dependabot PR 둘(`@nestjs/typeorm` 12.0.1, `@nestjs/platform-express` 12.0.3)의 근본 해결(실제 버전 범프)은 이 PR 의 스코프가 아니며, plan 문서가 그 이유를 실측으로 남겼다 — `@nestjs/platform-express@12` 단독 범프는 `@nestjs/common@11` 의 `exports` 에 없는 `@nestjs/common/internal` 서브패스를 요구해 런타임에서 `ERR_MODULE_NOT_FOUND` 로 죽는다(e2e 컨테이너 exit 1 실측). `@nestjs/*` 관련 패키지 전부(`common`·`core`·`platform-express`·`platform-socket.io`·`websockets`·`testing`·`typeorm`·`jwt`·`passport`·`swagger`·`bullmq`·`config`·`cli`·`schematics`)가 12.x 로 동시에 올라가야 하고 전부 `type: module` 이라는 것도 plan 이 표로 남겼다 — 부분 메이저 범프라는 "성립하지 않는 중간 상태"를 시도하지 않도록 미리 격리한 것으로, 의존성 거버넌스 관점에서 타당한 스코프 경계다. 다만 이 plan 이 언급한 `esm-native-load.spec.ts` 의 canary(`uuid`)는 CJS 로 downlevel **가능한** ESM 이라, 이번 업그레이드의 진짜 벽인 `import.meta.url`(downlevel **불가**)은 실제로 `@nestjs/typeorm@12` 를 얹어야만 행사된다는 점을 plan 자체가 이미 명시했다(§B) — 착수 시 재확인이 필요하다는 사실이 상주 문서에 남아 있으므로 이 라운드에서 추가로 지적할 것은 없다.
  - 제안: 없음(참고용) — 후속 PR 착수 시 `plan/in-progress/nestjs-v12-coordinated-upgrade.md` §B·§C·§D 체크리스트가 실제로 수행되는지가 그 PR 의 의존성 리뷰 포인트가 될 것.

## 요약

이 diff 는 신규 외부 패키지·버전 범프·lockfile 변경이 전혀 없는 순수 테스트 tooling 변경이다(직접 확인: `pnpm-lock.yaml`·`pnpm-workspace.yaml`·루트 `package.json` 무변경, backend `package.json` 은 scripts 10줄뿐, `dependencies`/`devDependencies` 전부 동일 버전). 손으로 유지하며 이미 unit/e2e 간 발산해 있던 `transformIgnorePatterns` ESM 허용목록을 jest 기본값 + `node --experimental-vm-modules` 네이티브 ESM 로드로 대체해, `@nestjs/typeorm@12`(`import.meta.url`, CJS downlevel 원리적 불가) 같은 클래스의 향후 의존성도 수용 가능하게 만들었다. 유일한 구조적 트레이드오프는 SemVer 로 보증되지 않는 Node 실험 플래그와 jest 내부 probe 에 테스트 인프라가 결합된 점인데, 직접 재현(`vm.SourceTextModule`이 플래그 유무에 따라 `undefined`/`function`으로 갈리는 것 확인)·CI Node 버전 핀 정합성 확인·뮤테이션 4종 가드 확인까지 마쳤고 이미 두 차례 전 라운드에서 같은 결론(LOW)에 도달한 항목이라 이번 라운드에서도 위험도를 올릴 근거를 찾지 못했다. 실제 `@nestjs/*` v12 범프는 별도 plan(`nestjs-v12-coordinated-upgrade.md`)으로 명확히 격리되어 있고, 그 plan 이 부분 메이저 범프의 런타임 파손을 실측으로 남겨 둔 점도 의존성 거버넌스 관점에서 긍정적이다. Critical/Warning 급 발견사항 없음.

## 위험도
LOW
