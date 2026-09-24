# 의존성(Dependency) 리뷰

## 발견사항

- **[INFO]** 새 외부 의존성·버전 범프·lockfile 변경 전혀 없음 — 순수 테스트 tooling 변경 (4라운드 연속 확인)
  - 위치: `codebase/backend/package.json` (전체)
  - 상세: `git diff origin/main...HEAD --stat`(전체 저장소)로 직접 확인했다. `pnpm-lock.yaml`·`pnpm-workspace.yaml`·루트 `package.json`은 변경 목록에 없고, `codebase/backend/package.json` diff는 `scripts` 블록(제거 5줄 + 추가 5줄, `+5/-5`)에 한정된다. `dependencies`/`devDependencies` 섹션은 `jest`·`ts-jest`·`uuid`·`otplib`·`p-limit`·`@nestjs/typeorm` 등 전부 원본 그대로다. 새 의존성 필요성·버전 고정·라이선스·취약점·번들 크기·전이 의존성 충돌 관점에서 이 diff 자체가 만드는 리스크는 없다. 동일 결론이 `14_24_10`·`15_26_17`·`16_02_28` 세 라운드에서 독립적으로 확인됐고, 이번 라운드에서 다시 재현했다.
  - 제안: 없음(정보 제공).

- **[INFO]** 손으로 유지하던 ESM `transformIgnorePatterns` 허용목록(unit/e2e 두 곳, 이미 서로 발산해 있었음) 제거 — drift 원천 해소, `import.meta.url` 계열(downlevel 원리적 불가) 의존성도 향후 수용 가능
  - 위치: `codebase/backend/jest.config.ts` (`transformIgnorePatterns: ['/node_modules/']`), `codebase/backend/test/jest-e2e.json`
  - 상세: 이전 unit 목록(`uuid|p-limit|yocto-queue|otplib|@otplib|@scure|@noble`)과 e2e 목록(`uuid|p-limit|yocto-queue`)이 이미 서로 어긋나 있었다. `node --experimental-vm-modules` 네이티브 로드로 전환하며 두 파일 모두 jest 기본값으로 되돌려 drift 자체를 제거했다. `@nestjs/typeorm@12`(`import.meta.url` 사용)처럼 이전 허용목록 레버로는 애초에 수용 불가능했던 클래스의 의존성도 이 방식으로만 받을 수 있다는 것이 `plan/in-progress/jest-esm-native-load.md` §A 실측(허용목록 확대 두 방식 모두 실패)의 근거다. `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts`가 unit/e2e 재발산을 정적 대조로 고정한다.
  - 제안: 없음 — 개선으로 판단.

- **[INFO]** 테스트 실행이 SemVer 로 보증되지 않는 Node 실험 플래그(`--experimental-vm-modules`) + jest 내부 probe(`vm.SourceTextModule.prototype.hasAsyncGraph`)에 결합됨 — 이미 실측·판별실험·뮤테이션 가드로 완화됨
  - 위치: `codebase/backend/package.json`(`test`/`test:watch`/`test:cov`/`test:debug`/`test:e2e` 5개 script), `codebase/backend/jest.config.ts`(근거 주석), `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts`
  - 상세: 실제 게이트는 Node 버전이 아니라 플래그가 노출하는 jest-runtime 내부 값이다 — 공개 SemVer 계약이 아니므로 jest/Node 향후 minor 에서 재발할 여지는 이론상 남는다. 다만 (1) `engines.node: ">=24"`(루트·backend 공통)와 CI `node-version: '24'` 4곳이 정합, (2) `esm-native-load.spec.ts`가 M1~M4 뮤테이션(플래그 제거·허용목록 복원·e2e 설정 발산·canary CJS 가정) 전부를 이름 붙여 고정, (3) canary(`import { v4 } from 'uuid'`)가 파일 최상단 트립와이어라 회귀 시 "조용한 손상"이 아니라 로드 단계 전체 실패로 드러난다. 3개 선행 라운드가 이미 같은 결론(LOW, blocking 아님)에 도달했고, 이번 라운드에서 재검토해도 위험도를 올릴 근거는 없다.
  - 제안: 없음(blocking 아님).

- **[INFO]** `test:debug` script 경로 drift(1라운드 지적) 해소 상태 재확인, 5개 script 모두 동일 진입점
  - 위치: `codebase/backend/package.json`
  - 상세: `test`·`test:watch`·`test:cov`·`test:debug`·`test:e2e` 전부 `node --experimental-vm-modules ./node_modules/jest/bin/jest.js` 진입점을 공유한다(`test:debug`만 추가로 `--inspect-brk -r tsconfig-paths/register -r ts-node/register`). 1라운드(`14_24_10`)에서 지적된 drift(`test:debug`만 옛 `.bin/jest` shim 유지)는 `815d2e180`로 이미 조치됐고 `esm-native-load.spec.ts`의 "jest 를 띄우는 script 전부가 같은 플래그·진입점을 쓴다" 단언(존재+순서 이중 검사)이 재발을 정적으로 막는다.
  - 제안: 없음 — 확인용 기재.

- **[INFO]** 실제 `@nestjs/*` v12 의존성 범프는 이번 diff 밖 — 부분 메이저 범프를 별도 plan으로 명시적 격리, 이번 라운드에 새 plan 스텁(`nestjs-v12-coordinated-upgrade.md`)이 추가됨
  - 위치: `plan/in-progress/nestjs-v12-coordinated-upgrade.md`(신규, 미착수 스텁), `codebase/backend/package.json`(`@nestjs/typeorm` 등 미변경 확인)
  - 상세: 막힌 dependabot PR 둘(`@nestjs/typeorm` 12.0.1, `@nestjs/platform-express` 12.0.3)의 실제 버전 범프는 이 PR 스코프가 아니다. plan이 `@nestjs/platform-express@12` 단독 범프 시 `@nestjs/common@11`의 `exports`에 없는 서브패스(`@nestjs/common/internal`) 요구로 런타임 `ERR_MODULE_NOT_FOUND`(e2e 컨테이너 exit 1 실측)를 남기고, `@nestjs/*` 관련 14개 패키지 전부가 12.x로 동시 이동해야 함을 표로 정리했다 — 부분 메이저 범프라는 "성립하지 않는 중간 상태"를 시도하지 않도록 의존성 거버넌스 관점에서 타당하게 격리했다. plan 자체가 §B에서 "이 PR의 가드(canary=`uuid`, downlevel 가능한 ESM)는 `import.meta.url`(downlevel 불가) 벽을 아직 실제로 행사하지 않았다 — 착수 시 재확인 필요"를 스스로 명시해 둔 점도 확인했다.
  - 제안: 없음(참고용) — 후속 PR 착수 시 이 plan §B·§C·§D 체크리스트 수행 여부가 그 PR의 의존성 리뷰 포인트가 될 것.

- **[INFO]** `PROJECT.md`의 vitest 이행 트리거 조항 갱신 — 「트리거 발화 → 이행」으로 오독될 위험을 명시적으로 차단
  - 위치: `PROJECT.md`(버전·도구 정책, 「테스트 프레임워크 이원화」 항목)
  - 상세: 기존 문장("packages/*의 vitest 이행은 jest가 실제로 막는 ESM 의존이 등장하는 트리거 전까지 보류")에 이어 "그 트리거가 2026-09-24 backend에서 한 번 발화했고, 이행이 아니라 두 줄로 풀렸다"는 문장이 추가됐다. `git diff`로 확인한 결과 원문은 유지된 채(취소선 없이) 뒤에 이어 붙는 형태이며, "적용·검증된 것은 backend 뿐이고 packages/*에서는 아직 재지 않았다"는 한정도 함께 명시해 과잉 일반화를 막았다. 의존성 정책 문서로서 정확하고, 다음 사람이 packages/* 이행을 오판할 여지를 줄인다.
  - 제안: 없음.

## 요약

이 diff는 신규 외부 패키지·버전 범프·lockfile 변경이 전혀 없는 순수 테스트 tooling 변경이다(직접 재확인: `pnpm-lock.yaml`·`pnpm-workspace.yaml`·루트 `package.json` 무변경, backend `package.json`은 scripts 10줄뿐, `dependencies`/`devDependencies` 전부 동일 버전) — 이는 이번이 4번째 연속 라운드이며 세 라운드 모두 독립적으로 같은 사실을 확인했다. 손으로 유지하며 이미 unit/e2e 간 발산해 있던 ESM `transformIgnorePatterns` 허용목록을 jest 기본값 + `node --experimental-vm-modules` 네이티브 ESM 로드로 대체해, `@nestjs/typeorm@12`(`import.meta.url`, CJS downlevel 원리적 불가) 같은 클래스의 향후 의존성도 수용 가능하게 만들었다. 유일한 구조적 트레이드오프는 SemVer로 보증되지 않는 Node 실험 플래그와 jest 내부 probe에 대한 결합인데, CI Node 버전 핀 정합성과 뮤테이션 4종 가드(회귀 시 조용한 손상이 아니라 즉시 전체 로드 실패)로 이미 완화되어 있고 3개 선행 라운드와 동일하게 위험도를 올릴 근거를 찾지 못했다. 실제 `@nestjs/*` v12 범프는 이번 라운드에 신설된 `plan/in-progress/nestjs-v12-coordinated-upgrade.md`로 명확히 격리되어 있으며, 이 plan은 부분 메이저 범프의 런타임 파손을 실측으로 남기고 자신의 가드가 아직 커버 못 하는 지점(`import.meta.url` 벽)까지 스스로 명시해 다음 착수자에게 정확한 경계를 넘겨준다. Critical/Warning급 발견사항 없음.

## 위험도
LOW
