# 의존성(Dependency) 리뷰

## 발견사항

- **[INFO]** 새 외부 의존성·버전 범프·lockfile 변경 전혀 없음 — 순수 테스트 tooling 변경
  - 위치: `codebase/backend/package.json` (전체), 저장소 전체 diff stat
  - 상세: `git diff origin/main...HEAD --stat` 로 전 39개 변경 파일을 직접 확인했다. `pnpm-lock.yaml`·`pnpm-workspace.yaml` 은 변경 목록에 없고, `codebase/backend/package.json` 은 `scripts` 블록 10줄(제거 5 + 추가 5)만 바뀌었다. `dependencies`/`devDependencies` 섹션은 `uuid: ^14.0.1`, `otplib: ^13.4.1`, `p-limit: ^7.3.2`, `jest: ^30.5.1`, `ts-jest: ^29.2.5`, `@nestjs/testing: ^11.0.1` 등 전부 원본 그대로다 — `@nestjs/typeorm@12` 자체는 이 PR 에서 **범프되지 않았다**(별도 미착수 plan `nestjs-v12-coordinated-upgrade.md` 로 명시적으로 분리). 따라서 신규 의존성 필요성·라이선스·취약점·번들 크기·전이 의존성 충돌 관점의 리스크는 이 diff 자체에는 없다.
  - 제안: 없음(정보 제공).

- **[INFO]** 손으로 유지하던 ESM 허용목록(unit/e2e 두 곳, 이미 서로 발산해 있었음) 제거 — 유지보수 부담과 drift 원천 해소
  - 위치: `codebase/backend/jest.config.ts:41` (`transformIgnorePatterns: ['/node_modules/']`), `codebase/backend/test/jest-e2e.json:9`
  - 상세: 이전에는 `uuid|p-limit|yocto-queue|otplib|@otplib|@scure|@noble` (unit) vs `uuid|p-limit|yocto-queue` (e2e) 로 **두 설정 파일 간 목록이 이미 어긋나 있던** 상태였다. 패키지가 ESM 으로 전환될 때마다 사람이 정규식에 손으로 추가해야 하는 구조였고, `@nestjs/typeorm@12` 처럼 `import.meta.url` 을 쓰는(=CJS downlevel 이 원리적으로 불가능한) 의존성은 애초에 이 레버로 수용 자체가 안 됐다(플랜 §A 실측). jest 기본값으로 되돌리고 `node --experimental-vm-modules` 로 네이티브 ESM 로드를 켜는 방향은 해당 클래스의 의존성을 포함해 더 넓게 대응 가능하므로 개선으로 판단한다. 새 가드 스펙(`src/repo-guards/__tests__/esm-native-load.spec.ts`)이 unit(`jest.config.ts`)·e2e(`test/jest-e2e.json`) 두 설정이 다시 발산하지 않는지 정적 대조로 잡는다.
  - 제안: 없음 — 개선으로 판단.

- **[INFO]** 테스트 인프라가 SemVer 로 보증되지 않는 Jest 내부 probe / Node 실험 플래그에 결합됨 — 이미 실측·문서화·가드됨
  - 위치: `codebase/backend/package.json:22-26` (`node --experimental-vm-modules ./node_modules/jest/bin/jest.js`), `codebase/backend/jest.config.ts:26-32` (근거 주석)
  - 상세: 이 방식의 실제 게이트는 `vm.SourceTextModule.prototype.hasAsyncGraph` 라는 jest-runtime 내부 probe(공개 API 아님)이고, `--experimental-vm-modules` 는 Node 의 **실험적** 플래그다(`plan/in-progress/jest-esm-native-load.md` §A). `jest: ^30.5.1` 은 caret 고정이라 향후 patch/minor 에서 이 내부 구현이 바뀌면 유사한 오도성 회귀가 재발할 수 있다. 다만 (1) 저자가 판별 실험(플래그만 제거 → RED, `Must use import to load ES Module`)으로 결합을 실측했고, (2) 회귀 시 실패 양상이 **조용한 손상이 아니라 전체 로드 실패**(uuid 를 쓰는 스펙 전부가 즉시 RED)라 은닉될 여지가 낮으며, (3) `esm-native-load.spec.ts` 가 뮤테이션 4종(M1~M4) 전부로 이 불변식을 이름 붙여 고정했고, (4) `engines.node: ">=24"`(루트·backend 공통)와 CI `node-version: '24'`(4개 workflow) 가 정합함을 직접 확인했다. 순수 신규 리스크라기보다 이미 식별·완화된 trade-off 다.
  - 제안: 없음(blocking 아님). 여유가 될 때 jest 자체의 minor 상향 시 이 가드 스펙이 회귀를 즉시 잡는지 한 번 더 확인하는 정도로 충분.

- **[INFO]** jest 실행 경로가 5개 script 전부 `./node_modules/jest/bin/jest.js` 로 통일됨 — 직전 라운드 Warning 이 반영된 상태를 확인
  - 위치: `codebase/backend/package.json:22-26` (`test`, `test:watch`, `test:cov`, `test:debug`, `test:e2e`)
  - 상세: 이전 라운드(`review/code/2026/09/24/14_24_10`)에서 `test:debug` 만 `node_modules/.bin/jest`(셸 shim)를 그대로 남겨 `node` 로 직접 실행 시 `SyntaxError` 로 죽는 결함이 architecture·side_effect·testing 세 reviewer 의 독립 재현으로 확정됐고(dependency reviewer 는 당시 "기능적으로 동등" 이라며 과소평가했다), `815d2e180` 에서 5개 전부 동일 경로로 통일해 조치했다. 이번 diff 를 직접 열어 5줄 모두 `./node_modules/jest/bin/jest.js` 로 일치함을 확인했고, `node_modules/jest/bin/jest.js` 가 실제 설치된 `jest@30.5.1` 패키지의 `bin` 필드(`./bin/jest.js`)와 일치함도 확인했다. `packages/*` 워크스페이스는 이 변경의 스코프 밖이며(`grep` 확인 결과 다른 `package.json` 에는 이 패턴이 없음) PROJECT.md 의 jest/vitest 이원화 정책과 충돌하지 않는다.
  - 제안: 없음 — 확인용 기재.

- **[INFO]** 후속 plan(`nestjs-v12-coordinated-upgrade.md`)이 부분 메이저 범프의 위험을 정확히 식별해 별도 스코프로 격리함
  - 위치: `plan/in-progress/nestjs-v12-coordinated-upgrade.md` (전체, 미착수 스텁)
  - 상세: `@nestjs/platform-express@12` 단독 범프가 `@nestjs/common@11` 의 `exports` 서브패스 부재로 런타임 `ERR_MODULE_NOT_FOUND` 를 낸다는 것을 실측(e2e 컨테이너 exit 1)했고, `@nestjs/*` 전체가 동반 이동해야 한다는 결론과 `throttler`(별도 라인, CJS) peer 검증·`@nestjs/cli` 빌드 산출물 형식·Swagger/socket.io 어댑터 API 변경 같은 착수 시 확인 목록을 남겼다. 이 PR 자체는 의존성 버전을 바꾸지 않으므로 실행 리스크는 없고, 향후 실제 범프 PR 이 검증해야 할 항목을 미리 정리해 둔 점은 긍정적이다.
  - 제안: 없음(참고용).

## 요약

이 diff 는 신규 외부 패키지·버전 범프·lockfile 변경이 전혀 없는 순수 테스트 tooling 변경이다(`pnpm-lock.yaml`·`pnpm-workspace.yaml` 미변경, `package.json` 은 `scripts` 10줄뿐). 손으로 유지하던 `transformIgnorePatterns` ESM 허용목록(이미 unit/e2e 간 발산해 있던 상태)을 jest 기본값 + `node --experimental-vm-modules` 네이티브 ESM 로드로 대체해, `@nestjs/typeorm@12`(`import.meta.url`, CJS downlevel 불가) 같은 클래스의 향후 의존성도 수용 가능하게 만든다. 실제 NestJS v12 범프는 `plan/in-progress/nestjs-v12-coordinated-upgrade.md` 로 스코프가 명확히 분리돼 있다. 유일한 구조적 리스크는 SemVer 로 보증되지 않는 jest 내부 probe/Node 실험 플래그에 대한 결합인데, 저자가 판별 실험과 뮤테이션 4종으로 이미 검증·가드했고 회귀 시 조용한 손상이 아니라 즉시 전체 로드 실패로 드러나는 성질이라 실질 위험이 낮다. 직전 라운드에서 지적된 `test:debug` 경로 불일치(dependency reviewer 가 당시 과소평가했던 항목)도 이번 diff 에서 5개 script 전부 동일 경로로 통일된 것을 직접 확인했다. Critical/Warning 급 발견사항 없음.

## 위험도
LOW
