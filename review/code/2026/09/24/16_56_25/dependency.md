# 의존성(Dependency) 리뷰

## 검토 범위 메모

이 diff 는 93개 파일, +6966/-22 로 크지만 **의존성 관점에서 실제로 손이 간 코드**는
`codebase/backend/{package.json,jest.config.ts,test/jest-e2e.json,src/repo-guards/__tests__/esm-native-load.spec.ts}`
넷뿐이다. 나머지는 plan 문서와 이전 4개 리뷰 라운드(`review/code/2026/09/24/{14_24_10,15_26_17,16_02_28,16_29_15}`)·
consistency-check(`review/consistency/2026/09/24/{12_57_36,13_55_20}`) 산출물이다. 이 리뷰는
**5번째 연속 라운드**이고, 직전 4라운드(`14_24_10`·`15_26_17`·`16_02_28`·`16_29_15`)의 dependency
리뷰가 모두 동일한 사실관계(새 의존성 없음·lockfile 무변경·LOW)에 독립적으로 도달했다. 이번
라운드에서 새로 반영된 코드 변경은 커밋 `00791d3c8`("4라운드")인데, `git show --stat` 로 확인한
결과 그 커밋은 `esm-native-load.spec.ts` 와 `jest-esm-native-load.md` 만 건드렸고
`package.json`/`jest.config.ts`/`test/jest-e2e.json` 은 무변경이다 — 즉 의존성 표면 자체는
4라운드 리뷰 시점과 동일하다. 아래는 그 사실을 직접 재확인한 결과다.

## 발견사항

- **[INFO]** 새 외부 의존성·버전 범프·lockfile 변경 전혀 없음 — 5라운드 연속 확인
  - 위치: `codebase/backend/package.json:28-93`(`dependencies`/`devDependencies` 블록, 전체)
  - 상세: `git diff origin/main...HEAD --stat`(93 files)와 `git diff origin/main...HEAD --stat -- pnpm-lock.yaml pnpm-workspace.yaml package.json .github/dependabot.yml`(빈 결과)를 직접 실행해 확인했다. `codebase/backend/package.json` diff 는 `scripts` 블록(`  22|`~`  26|`, -5/+5)에 한정되고, `dependencies`/`devDependencies` 는 `@nestjs/typeorm: ^11.0.3`·`jest: ^30.5.1`·`ts-jest: ^29.2.5`·`uuid: ^14.0.1`·`otplib: ^13.4.1`·`p-limit: ^7.3.2` 등 전부 원본 그대로다. 새 의존성 필요성·버전 고정·라이선스·취약점·번들 크기·전이 의존성 충돌 관점의 신규 리스크는 없다.
  - 제안: 없음(정보 제공).

- **[INFO]** 손으로 유지하던 ESM `transformIgnorePatterns` 허용목록(unit·e2e 두 곳, 이미 서로 발산해 있었음) 제거 — 유지보수 부담 및 drift 원천 해소
  - 위치: `codebase/backend/jest.config.ts:19-41`(`transformIgnorePatterns: ['/node_modules/']`), `codebase/backend/test/jest-e2e.json:9`
  - 상세: 이전 unit 목록(`uuid|p-limit|yocto-queue|otplib|@otplib|@scure|@noble`)과 e2e 목록(`uuid|p-limit|yocto-queue`)이 이미 서로 어긋나 있었고, 패키지가 ESM 으로 갈 때마다 두 파일을 손으로 갱신해야 하는 구조였다. `node --experimental-vm-modules` 네이티브 로드로 전환하며 두 설정 모두 jest 기본값으로 되돌려 drift 를 제거했다. 기본값 `/node_modules/` 는 앵커 없는 부분일치라 pnpm isolated 레이아웃의 중첩 경로(`.pnpm/<pkg>/node_modules/<dep>/…`)에도 여전히 매치되므로, 이전 정규식이 갖고 있던 `\.pnpm/[^/]+/node_modules/` 특례를 잃지 않는다 — 직접 대조해 확인했다. `@nestjs/typeorm@12`처럼 `import.meta.url`을 쓰는(=CJS downlevel 원리적 불가) 클래스의 향후 의존성도 이 방식으로만 수용 가능하다는 것이 `plan/in-progress/jest-esm-native-load.md` §A 실측(허용목록 확대 두 방식 모두 실패)의 근거다.
  - 제안: 없음 — 개선으로 판단.

- **[INFO]** 테스트 인프라가 SemVer 로 보증되지 않는 Node 실험 플래그 + jest 내부 probe 에 결합됨 — 4라운드째 동일 결론(이미 실측·판별실험·뮤테이션 가드로 완화)
  - 위치: `codebase/backend/package.json:22-26`(5개 `test*` script), `codebase/backend/jest.config.ts:26-32`(근거 주석), `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts` 전체
  - 상세: 실제 게이트는 Node 버전이 아니라 `--experimental-vm-modules`가 노출하는 `vm.SourceTextModule.prototype.hasAsyncGraph`라는 jest-runtime **내부** probe다(공개 SemVer 계약 아님). `engines.node: ">=24"`(루트·backend 공통)와 CI `node-version: '24'` 핀이 정합함을 재확인했다(`.github/actions/pnpm-workspace/action.yml`·`harness-checks.yml`·`deps-security-checks.yml`·`deps-peer-observe.yml` 4곳). 이번 라운드에 반영된 커밋(`00791d3c8`)은 이 불변식을 지키는 가드(`esm-native-load.spec.ts`)를 「자리 열거」에서 「node 인자 구간 전체 고정」으로 재설계했고, `plan/in-progress/jest-esm-native-load.md`가 M1~M4(불변식 1) + M10~M13(불변식 2) 총 8개 뮤테이션의 예측=실측 RED 기록을 남겼다 — 회귀 시 조용한 손상이 아니라 로드 단계 전체 실패(canary `uuid` 트립와이어)로 드러나는 성질도 유지된다. 4개 선행 라운드가 이미 같은 결론(LOW)에 도달했고 이번 라운드도 위험도를 올릴 근거를 찾지 못했다.
  - 제안: 없음(blocking 아님).

- **[INFO]** jest 실행 경로 5개 script 전부 `./node_modules/jest/bin/jest.js` 로 통일된 상태 및 실제 설치 경로 일치를 재확인
  - 위치: `codebase/backend/package.json:22-26`
  - 상세: `node_modules/jest/bin/jest.js`가 실제로 존재함(셸 shim이 아닌 실행 가능 JS 파일, 324 bytes)을 직접 `ls`로 확인했다. 1라운드에서 지적된 `test:debug`만 옛 `.bin/jest` shim을 남겼던 drift는 이미 조치된 상태이고, 이번 라운드가 새로 반영한 커밋도 이 5개 script 텍스트 자체는 건드리지 않았다(수정 파일이 `esm-native-load.spec.ts`·`jest-esm-native-load.md` 뿐임을 `git show --stat`로 확인).
  - 제안: 없음 — 확인용 기재.

- **[INFO]** 실제 `@nestjs/*` v12 의존성 범프는 이번 diff 밖 — 부분 메이저 범프를 별도 plan(`nestjs-v12-coordinated-upgrade.md`)으로 명시적 격리, 이번 diff 에서도 미착수 스텁 상태 유지
  - 위치: `plan/in-progress/nestjs-v12-coordinated-upgrade.md`(전체, 미착수), `codebase/backend/package.json`(`@nestjs/*` 전부 `^11.x` 그대로 확인)
  - 상세: 막힌 dependabot PR 둘(`@nestjs/typeorm` 12.0.1 `#1339`, `@nestjs/platform-express` 12.0.3 `#1382`)의 실제 버전 범프는 이 PR 스코프 밖이며, `@nestjs/platform-express@12` 단독 범프가 `@nestjs/common@11`의 `exports`에 없는 서브패스(`@nestjs/common/internal`) 요구로 런타임 `ERR_MODULE_NOT_FOUND`를 낸다는 실측(e2e 컨테이너 exit 1)이 plan에 남아 있다. `@nestjs/*` 관련 14개 패키지 전부가 12.x로 동시 이동해야 하고 전부 `type: module`이라는 표도 그대로다. 부분 메이저 범프라는 "성립하지 않는 중간 상태"를 시도하지 않도록 격리한 스코프 경계는 타당하다.
  - 제안: 없음(참고용) — 후속 착수 시 plan §B·§C·§D(선행조건·reflection 보안 회귀 검증·`throttler` peer 확인 등) 체크리스트 수행 여부가 그 PR의 의존성 리뷰 포인트.

## 요약

이 diff는 신규 외부 패키지·버전 범프·lockfile 변경이 전혀 없는 순수 테스트 tooling 변경이며, 5번째 연속 리뷰 라운드에서도 동일한 사실관계를 독립적으로 재확인했다. 이번 라운드에 새로 반영된 커밋(`00791d3c8`)은 의존성 표면(`package.json`/`jest.config.ts`/`test/jest-e2e.json`)을 건드리지 않고 가드 스펙(`esm-native-load.spec.ts`)의 검증 방식만 「자리 열거」에서 「node 인자 구간 전체 고정」으로 개선했으므로, 유일한 구조적 트레이드오프인 "SemVer 로 보증되지 않는 Node 실험 플래그 + jest 내부 probe 결합"에 대한 완화(뮤테이션 8종 RED 확인, CI Node 버전 핀 정합)가 오히려 더 촘촘해졌다. `@nestjs/*` v12 실제 범프는 별도 plan으로 계속 명확히 격리되어 있다. Critical/Warning급 발견사항 없음.

## 위험도
LOW
