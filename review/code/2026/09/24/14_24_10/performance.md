# 성능(Performance) 리뷰 — jest ESM 네이티브 로드 전환

## 스코프 확인

리뷰 대상은 `codebase/backend/jest.config.ts`, `codebase/backend/package.json`(scripts),
`codebase/backend/test/jest-e2e.json`, 그리고 `plan/in-progress/*.md` 2건, `review/consistency/**`
산출물(SUMMARY·checker 리포트·meta.json·retry_state.json) 이다. 마지막 그룹은 이전 라운드의
consistency-check 산출물(생성된 리포트)이며 애플리케이션/런타임 코드가 아니라 텍스트 산출물이므로
성능 관점에서 검토할 로직이 없다. 실질 코드 변경은 **jest 설정 3개 파일**에 국한되고, 전부
**테스트 실행기(test runner) 설정**이지 프로덕션 런타임 코드가 아니다.

## 발견사항

- **[INFO]** 변경 범위는 프로덕션 런타임에 영향을 주지 않는 테스트 인프라 설정이다
  - 위치: `codebase/backend/jest.config.ts:39` (`transformIgnorePatterns: ['/node_modules/']`), `codebase/backend/package.json:22-26` (`test`/`test:watch`/`test:cov`/`test:debug`/`test:e2e` scripts), `codebase/backend/test/jest-e2e.json:9`
  - 상세: `transformIgnorePatterns` 를 손으로 유지하던 allowlist 정규식(`uuid|p-limit|yocto-queue|otplib|@otplib|@scure|@noble` + pnpm `.pnpm/` prefix 분기)에서 jest 기본값(`['/node_modules/']`)으로 되돌리고, 대신 `node --experimental-vm-modules` 플래그로 Jest 가 ESM 의존성을 ts-jest 변환 없이 네이티브로 로드하게 한다. 매 테스트 파일 임포트 시 정규식 매칭 비용이 복잡한 alternation(6개 패키지 + 선택적 pnpm prefix 그룹)에서 단순 리터럴 부분열 매칭으로 줄어드는 효과가 있으나, 이는 실행 중인 애플리케이션 코드 경로가 아니라 테스트 실행기 내부 모듈 해석 단계에서만 발생하므로 **프로덕션 지연시간/처리량에는 영향이 없다.**
  - 제안: 없음 — 정보성. 이 변경이 영향을 주는 유일한 "성능" 지표는 CI/로컬 테스트 실행 시간이며, plan 문서(`plan/in-progress/jest-esm-native-load.md` §C)가 이미 실측(backend 단독 jest 32.5s → 23.5~26.5s, 20~28% 개선)과 함께 정직하게 기록했다.

- **[INFO]** 최초 성능 주장("3배 빠름")이 실측으로 정정된 이력 — 조치 불필요
  - 위치: `plan/in-progress/jest-esm-native-load.md` §C (`> **초판의 «3배 빠름» 은 거짓 비교였다.**` 문단)
  - 상세: 초판은 backend 단독 jest 실행시간(23.5s)을 `run-test.sh unit`(전 패키지 wrapper, 76~103s)과 비교해 배율을 부풀렸다. 공정 비교(backend 단독 대 backend 단독)로 재측정해 20~28% 개선으로 스스로 정정했고, wrapper 기준으로는 유의한 차이가 없음(76~103s → 87s)도 함께 기록했다. 성능 리뷰 관점에서 이 자체가 결함은 아니며, 오히려 과장을 스스로 반증·정정한 사례다.
  - 제안: 없음.

- **[INFO]** `--experimental-vm-modules` 플래그가 모든 jest invocation(`test`, `test:watch`, `test:cov`, `test:debug`, `test:e2e`)에 일괄 추가됨
  - 위치: `codebase/backend/package.json:22-26`
  - 상세: 이 플래그는 Node 의 실험적 VM 모듈 기능을 활성화하며, 워커 프로세스당 `ExperimentalWarning: VM Modules ...` 배너 1줄이 stderr 에 추가로 찍힌다(plan 문서 실측: 10줄). 로그량이 미미하게 늘지만 테스트 실행 자체의 처리량에 영향을 줄 수준은 아니며, plan 문서(§C)가 이 비용을 이미 인지하고 의도적으로 유지하기로 결정했다(실험 플래그 위에 서 있음을 가시화하려는 목적).
  - 제안: 없음. 로그 노이즈가 CI 아티팩트 크기에 실질적으로 영향을 줄 정도로 커지면(예: 워커 수가 매우 많은 환경) `--disable-warning=ExperimentalWarning` 도입을 재검토할 수 있으나, 현재 규모(워커당 1줄)에서는 불필요하다.

- **[INFO]** `transformIgnorePatterns` 기본값이 pnpm 중첩 경로(`.pnpm/<pkg>@<ver>/node_modules/<pkg>`)에서도 여전히 매치되는지 여부는 이미 테스트로 검증됨
  - 위치: `codebase/backend/jest.config.ts:39`, `codebase/backend/test/jest-e2e.json:9`
  - 상세: 기본 패턴 `/node_modules/` 는 문자열 내 어디에 `node_modules` 세그먼트가 있든 매치되므로 pnpm 의 isolated 레이아웃에서도 마지막 `node_modules` 세그먼트에 걸린다 — 별도 pnpm prefix 분기가 필요 없다. plan 문서가 unit 472/9946, e2e 380 PASS 로 실측 확인했다. 성능 관점에서 우려할 회귀는 없다.
  - 제안: 없음.

## 요약

이번 diff 는 애플리케이션 런타임 코드를 전혀 건드리지 않고 Jest 테스트 실행기의 모듈 로딩 방식(ts-jest allowlist 변환 → `--experimental-vm-modules` 네이티브 ESM 로드)만 바꾼 순수 테스트 인프라 변경이다. 알고리즘 복잡도·N+1 호출·메모리 누수·캐싱·블로킹 I/O·데이터 구조 등 프로덕션 성능에 관련된 관점은 애초에 적용 대상이 없다. 유일하게 측정 가능한 성능 지표는 테스트 실행 시간이며, plan 문서가 이를 정직하게 실측(backend 단독 20~28% 개선, wrapper 기준 무의미)하고 초판의 "3배" 과장 주장을 스스로 반증·정정한 이력까지 남겨 신뢰도가 높다. CRITICAL/WARNING 급 성능 이슈는 발견되지 않았다.

## 위험도

NONE
