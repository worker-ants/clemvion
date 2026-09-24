# 보안(Security) 리뷰 — jest ESM 네이티브 로드 전환 (4라운드, deps-nestjs12-ci-4a7b2e)

## 검토 범위 요약

리뷰 대상 75개 파일 중 실행 가능한 실질 코드/설정 변경은 4개뿐이다:

- `codebase/backend/jest.config.ts` — `transformIgnorePatterns` 를 손으로 유지하던 ESM 패키지
  허용목록(`uuid|p-limit|yocto-queue|otplib|@otplib|@scure|@noble`)에서 jest 기본값
  (`['/node_modules/']`)으로 되돌림
- `codebase/backend/test/jest-e2e.json` — 동일하게 기본값으로 되돌림
- `codebase/backend/package.json` — `test`/`test:watch`/`test:cov`/`test:debug`/`test:e2e`
  5개 스크립트에 `node --experimental-vm-modules ./node_modules/jest/bin/jest.js` 도입
- `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts` (신규) — 위 불변식을
  고정하는 가드 스펙. `uuid/package.json` 읽기, `uuidv4()` 호출, 그리고 자기 `package.json`·
  `test/jest-e2e.json` 을 `fs.readFileSync` + `path.resolve(__dirname, ...)` 로 읽어 문자열
  대조하는 정적 테스트만 포함 — 경로는 전부 `__dirname` 기준 하드코딩된 상대경로이며 사용자
  입력이나 외부 데이터가 개입할 여지가 없다.

전체 코드를 직접 열어 확인했다(`Read` 로 `esm-native-load.spec.ts` 전문, `Bash grep` 으로
4개 파일 + `PROJECT.md` 의 시크릿 패턴 전수 스캔). 나머지 71개 파일은 `plan/in-progress/*.md`
(3건), `PROJECT.md` 정책 문서 갱신, 그리고 이전 3라운드(`14_24_10`·`15_26_17`·`16_02_28`)의
`review/code/**` 산출물과 `review/consistency/**` 산출물(모두 markdown/json 리포트) — 실행되는
애플리케이션 코드나 인프라 코드가 아니다.

이번 diff 는 production 런타임·API 엔드포인트·인증 미들웨어를 전혀 건드리지 않는 **테스트
하니스(jest) 전용 변경**이며, 이전 3라운드 보안 리뷰(`review/code/2026/09/24/{14_24_10,
15_26_17,16_02_28}/security.md`) 모두 동일 결론(위험도 NONE)에 도달했다. 이번 라운드에서
독립적으로 재확인한 결과도 같다.

## 점검 관점별 확인

- **인젝션 취약점**: 사용자 입력을 처리하는 코드가 없다. 신규 가드 스펙의 `fs.readFileSync`
  호출은 인자가 전부 `path.resolve(__dirname, '고정 상대경로')` 리터럴이라 경로 탐색 벡터가
  없다. `package.json` 스크립트는 고정 문자열이며 외부 입력을 셸에 보간하지 않는다.
- **하드코딩된 시크릿**: 4개 코드 파일 + `PROJECT.md` 전수를 `password|secret|api[_-]?key|
  token|private[_-]?key|BEGIN (RSA|PRIVATE)` 패턴으로 grep — 매치된 것은 `jsonwebtoken`
  패키지명, `AuthConfig` enum 라벨(`api_key`/`bearer_token`), `refreshToken` 쿠키 *이름*
  뿐이며 실제 시크릿 값은 없다.
- **인증/인가**: 이번 diff 는 인증/인가 코드를 전혀 건드리지 않는다. 다만 신규 plan
  `plan/in-progress/nestjs-v12-coordinated-upgrade.md` §C 는 이 변경이 여는 후속
  `@nestjs/typeorm@12` 업그레이드가 `RolesGuard`/`@WorkspaceId()` reflection 기반 인가
  가드의 fail-open 회귀 위험을 안고 있음을 이미 명문화해 선결 조건으로 격리해 뒀다 —
  이번 PR 범위 안에서 그 위험이 실현되지는 않는다(추적용 INFO, 아래).
- **입력 검증 / 암호화 / 에러 처리**: 해당 코드 경로 없음.
- **의존성 보안**: `dependencies`/`devDependencies` 버전은 이 diff 로 전혀 바뀌지 않는다
  (`package.json` diff 는 `scripts` 블록에 국한). `--experimental-vm-modules` 는 Node 실험
  플래그이지만 `test`/`test:watch`/`test:cov`/`test:debug`/`test:e2e` 5개 테스트 스크립트에만
  붙고, `start`/`start:prod` 등 배포 런타임 진입점에는 없다 — 배포되는 서버 프로세스의 공격
  표면을 넓히지 않는다.

## 발견사항

- **[INFO]** 후속 NestJS 12 업그레이드의 인가 reflection 회귀 위험이 별도 plan 으로 선결
  조건화되어 있음 (추적용, 조치 불요)
  - 위치: `plan/in-progress/nestjs-v12-coordinated-upgrade.md` §C (「착수 시 **반드시** 검증할
    것 — reflection 보안 회귀」)
  - 상세: 이번 diff 자체는 `@nestjs/*` 의존성 버전을 올리지 않는다. 다만 `--experimental-vm-modules`
    전환은 `import.meta.url` 을 쓰는(CJS downlevel 불가) `@nestjs/typeorm@12` 를 jest 가
    로드할 수 있게 하는 선행 조건이고, 그 후속 업그레이드가 `RolesGuard`/`@WorkspaceId()`
    의 Nest 비공개 API(`ROUTE_ARGS_METADATA`) 의존과 fail-open 파손 방향(멤버십 검증이
    조용히 사라짐)을 안고 있음을 plan 문서가 이미 실측 근거(§A)와 함께 문서화했다. 이번 PR
    코드 변경 범위 안에서는 그 위험이 실현되지 않는다.
  - 제안: 후속 PR 리뷰 시 §C 체크리스트(부트 캐너리 소비 라우트 수 회귀 비교, `workspace.decorator.spec.ts`/
    `roles.guard.spec.ts` 가 의도한 경로를 타는지)가 실제로 수행됐는지 재확인할 것.

- **[INFO]** 신규 가드 스펙의 보증 경계가 스스로 명시되어 있음
  - 위치: `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts` (파일 헤더 및
    58번째 줄 부근 주석 「이 가드가 덮지 못하는 것」)
  - 상세: 플래그는 CLI 인자라 `package.json` 의 5개 script 문자열에만 존재하고, 그 script 를
    우회하는 호출(IDE 테스트 러너, `npx jest` 직접 실행)은 이 가드의 불변식 밖이다. 저자가
    이를 숨기지 않고 주석으로 명시해 다음 사람이 보증 범위를 과신하지 않도록 했다 — 보안
    회귀는 아니지만 "문서화된 보장이 구현보다 넓으면 안 된다"는 원칙을 잘 지킨 사례.
  - 제안: 없음(참고용).

## 요약

이번 변경(4라운드 누적 diff)은 backend jest 테스트 러너가 ESM-only 의존성을 손으로 관리하는
허용목록 대신 `node --experimental-vm-modules` 로 네이티브 로드하도록 전환하는 순수 테스트
하니스/CI 설정 변경이며, production 코드·API 엔드포인트·인증 경로·의존성 버전을 전혀 건드리지
않는다. 신규 가드 스펙(`esm-native-load.spec.ts`)도 고정 상대경로만 읽는 정적 대조 테스트로
인젝션·시크릿·인가 관련 위험이 없다. 실험적 Node 플래그는 테스트 스크립트에만 한정되어 배포
런타임의 공격 표면에 영향을 주지 않음을 `package.json` 전체 컨텍스트로 확인했다. 동봉된 plan
문서는 이 변경이 여는 후속 NestJS 12 동반 업그레이드가 reflection 기반 인가 가드에 대해 안고
있는 fail-open 위험을 이미 별도 plan(§C)으로 명문화해 선제 격리해 두었다. 나머지 71개 파일은
markdown 리뷰/plan/consistency 산출물로 실행 코드가 아니어서 보안 검토 대상이 아니다. 이전
3라운드 보안 리뷰와 동일하게 Critical/Warning 급 결함은 발견되지 않았다. 저장소 파일에 대한
뮤테이션(수정/원복)은 수행하지 않았다 — `git status --short` 확인 불필요(정적 리뷰 + 대상
파일 직접 열람만 수행).

## 위험도

NONE
