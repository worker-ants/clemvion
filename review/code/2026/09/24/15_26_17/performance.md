# 성능(Performance) 리뷰

## 스코프 확인

이번 diff 는 39개 파일로 구성되나, 실질 코드 변경은 **4개**뿐이다: `codebase/backend/jest.config.ts`,
`codebase/backend/package.json`(scripts), `codebase/backend/test/jest-e2e.json`, 그리고 신규
`codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts`. 나머지(`PROJECT.md`,
`plan/in-progress/*.md` 2건, `plan/in-progress/spec-draft-nullable-notation-followups.md` 추가분,
`review/code/2026/09/24/14_24_10/**` 및 `review/consistency/2026/09/24/{12_57_36,13_55_20}/**`)는
문서·이전 라운드 리뷰/컨시스턴시 산출물이며, 실행되는 애플리케이션 코드도 테스트 코드도 아니므로
성능 관점에서 검토할 로직이 없다.

핵심 변경은 **Jest 테스트 러너의 ESM 모듈 로딩 방식**(손으로 유지하던 `transformIgnorePatterns`
allowlist → `node --experimental-vm-modules` 를 통한 네이티브 ESM 로드)이며, 프로덕션 런타임
코드 경로는 전혀 건드리지 않는다. 참고로 `review/code/2026/09/24/14_24_10/performance.md` 가
동일 diff(1라운드)를 이미 검토해 위험도 NONE 으로 판정했고, 그 뒤 `RESOLUTION.md` 는 성능 영역에
대해 조치가 필요한 지적이 없었다고 기록한다(Critical/Warning 은 documentation·architecture 영역에서
나왔고 성능 항목은 전부 INFO). 이번 라운드에서 코드 3파일(`jest.config.ts`/`package.json`/
`jest-e2e.json`) 자체의 diff 내용은 1라운드와 동일하며, 추가된 것은 `RESOLUTION.md`·plan 갱신·
1라운드 산출물 커밋뿐이므로 독립적으로 재검토한 결론도 같다.

## 발견사항

- **[INFO]** 변경 범위는 프로덕션 런타임에 영향을 주지 않는 테스트 인프라 설정이다
  - 위치: `codebase/backend/jest.config.ts:39` (`transformIgnorePatterns: ['/node_modules/']`), `codebase/backend/package.json:22-26` (`test`/`test:watch`/`test:cov`/`test:debug`/`test:e2e`), `codebase/backend/test/jest-e2e.json:9`
  - 상세: `transformIgnorePatterns` 를 손으로 유지하던 allowlist 정규식(6개 패키지명 + pnpm `.pnpm/` prefix 선택적 그룹의 alternation)에서 jest 기본값 `['/node_modules/']` 로 되돌리고, 대신 `--experimental-vm-modules` 플래그로 ESM 의존성을 ts-jest 변환 없이 네이티브로 로드한다. 정규식 자체의 매칭 비용은 (복잡한 alternation → 단일 리터럴) 방향으로 오히려 가벼워지지만, 이 경로는 테스트 러너의 모듈 해석 단계에서만 실행되고 프로덕션 요청 처리 경로와 무관하므로 지연시간/처리량에 영향이 없다.
  - 제안: 없음 — 정보성.

- **[INFO]** 테스트 실행 시간 변화는 plan 문서가 이미 정직하게 실측·자기정정했다
  - 위치: `plan/in-progress/jest-esm-native-load.md` §C
  - 상세: backend 단독 jest 32.5s → 23.5~26.5s(20~28% 개선), `run-test.sh unit`(전 패키지 wrapper) 기준 76~103s → 87s(유의한 차이 없음). 초판의 "3배 빠름" 은 단독 실행시간과 wrapper 전체시간을 잘못 비교한 것이었고, 이 라운드에서 그 오류를 스스로 반증·정정한 이력이 문서에 남아 있다. 조치 불필요.
  - 제안: 없음.

- **[INFO]** `--experimental-vm-modules` 가 모든 jest invocation 에 일괄 추가되어 워커 프로세스당 stderr 로그가 소폭 증가
  - 위치: `codebase/backend/package.json:22-26`
  - 상세: `ExperimentalWarning: VM Modules …` 가 jest 워커 프로세스마다 1줄 찍힌다(plan 문서 실측: 11코어 머신에서 9줄). CI 로그량에 미세한 영향은 있으나 테스트 처리량 자체에는 영향이 없는 수준이고, `--disable-warning` 으로 지울 수 있음을 알면서도 신호 가시성을 위해 의도적으로 유지한다고 문서화되어 있다.
  - 제안: 없음 — 워커 수가 크게 늘어나는 환경으로 바뀌면 재검토 대상 정도.

- **[INFO]** 신규 가드 스펙(`esm-native-load.spec.ts`)의 I/O·연산 비용은 무시할 수준
  - 위치: `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts` (전체, 특히 `fs.readFileSync` 호출부)
  - 상세: 세 번째 테스트가 `test/jest-e2e.json` 을 `fs.readFileSync` + `JSON.parse` 로 동기 로드한다. 파일 크기가 수백 바이트이고 스펙당 1회만 실행되므로 블로킹 I/O 관점에서 문제 삼을 수준이 아니다. `uuid` 호출(`uuidv4()`)도 단발성이라 CPU 비용이 무시할 만하다.
  - 제안: 없음.

- **[INFO]** `transformIgnorePatterns` 기본값이 pnpm 중첩 경로에서도 매치되어 회귀 없음을 실측 확인
  - 위치: `codebase/backend/jest.config.ts:39`, `codebase/backend/test/jest-e2e.json:9`
  - 상세: `/node_modules/` 는 pnpm 의 `.pnpm/<pkg>@<ver>/node_modules/<pkg>` 레이아웃에서도 마지막 세그먼트에 매치되므로 별도 pnpm prefix 분기가 필요 없어졌다. plan 문서가 unit 473/9949, e2e 380 PASS 로 확인했고 커버리지 대상(`collectCoverageFrom`)도 이 diff 로 바뀌지 않는다.
  - 제안: 없음.

알고리즘 복잡도·N+1 호출·메모리 누수·캐싱 전략·블로킹 I/O·과도한 문자열 연결·부적절한 자료구조·선행 로딩 등 나머지 점검 관점은 이번 diff 에 해당하는 프로덕션 코드 경로가 없어 적용 대상이 없다.

## 요약

이번 diff 는 애플리케이션 런타임 코드를 전혀 건드리지 않고 Jest 테스트 러너의 ESM 모듈 로딩 방식만 바꾸는 순수 테스트 인프라 변경이다(손으로 유지하던 `transformIgnorePatterns` allowlist 제거 → `--experimental-vm-modules` 네이티브 로드 전환, 그리고 그 불변식을 지키는 신규 가드 스펙 1개). 유일하게 측정 가능한 "성능" 지표는 테스트 실행 시간이며, plan 문서가 이를 정직하게 실측(backend 단독 20~28% 개선, wrapper 기준 무의미)하고 초판의 과장 주장을 스스로 반증·정정한 이력까지 남겼다. 워커 프로세스당 `ExperimentalWarning` 로그 1줄 증가는 성능이 아닌 로그 노이즈 수준이며 의도적으로 유지되는 트레이드오프다. 나머지 변경 파일은 문서·plan·이전 라운드 리뷰 산출물이라 성능 관점의 코드 검토 대상이 아니다. CRITICAL/WARNING 급 성능 이슈는 발견되지 않았다.

## 위험도

NONE
