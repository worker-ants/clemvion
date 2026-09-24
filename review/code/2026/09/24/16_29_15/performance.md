# 성능(Performance) 리뷰 — jest ESM 네이티브 로드 전환 (4라운드)

## 스코프 확인

diff 는 75개 파일로 구성되나, 실질 코드 변경은 이전 라운드와 동일하게 **4개**뿐이다:
`codebase/backend/jest.config.ts`, `codebase/backend/package.json`(scripts),
`codebase/backend/test/jest-e2e.json`, `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts`.

`git diff origin/main -- codebase/backend/jest.config.ts codebase/backend/package.json codebase/backend/test/jest-e2e.json codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts`
를 직접 재실행해 1~3라운드와 대조한 결과 **바이트 단위로 동일**하다(diff 해시 동일, `git status --short` 는
이번 라운드 산출 디렉터리(`review/code/2026/09/24/16_29_15/`)만 untracked 로 표시 — 작업 트리에
다른 변경 없음). 따라서 성능 관점의 독립 재검토 결론도
`review/code/2026/09/24/14_24_10/performance.md`(NONE) ·
`review/code/2026/09/24/15_26_17/performance.md`(NONE) ·
`review/code/2026/09/24/16_02_28/performance.md`(NONE) 와 동일하다.

이번 라운드에서 새로 추가된 것은 모두 문서·plan·이전 라운드 리뷰/컨시스턴시 산출물이다:
`PROJECT.md` 한 문단 추가(트리거 발화 기록), `plan/in-progress/nestjs-v12-coordinated-upgrade.md`
(3라운드에서 이미 검토된 스텁, 변경 없음), `plan/in-progress/spec-draft-nullable-notation-followups.md`
에 후속 항목 2건 추가(docs 가드 pathspec 갭·CHANGELOG 판정 기준 부재 — 둘 다 하네스/문서 프로세스
문제이지 런타임 성능과 무관), `review/code/2026/09/24/{14_24_10,15_26_17,16_02_28}/**` ·
`review/consistency/2026/09/24/{12_57_36,13_55_20}/**` (전부 이전 라운드 산출물의 커밋). 이 중
실행되는 애플리케이션 코드나 테스트 코드는 없으므로 성능 관점에서 검토할 로직이 추가되지 않았다.

핵심 변경은 여전히 **Jest 테스트 러너의 ESM 모듈 로딩 방식**(손으로 유지하던
`transformIgnorePatterns` allowlist 제거 → `node --experimental-vm-modules` 를 통한 네이티브
ESM 로드)이며, 프로덕션 런타임 코드 경로는 전혀 건드리지 않는다.

## 발견사항

- **[INFO]** 변경 범위는 프로덕션 런타임에 영향을 주지 않는 테스트 인프라 설정이다
  - 위치: `codebase/backend/jest.config.ts` (`transformIgnorePatterns: ['/node_modules/']`), `codebase/backend/package.json` (`test`/`test:watch`/`test:cov`/`test:debug`/`test:e2e` scripts), `codebase/backend/test/jest-e2e.json` (`transformIgnorePatterns`)
  - 상세: 손으로 유지하던 allowlist 정규식(6개 패키지명 + pnpm `.pnpm/` prefix 선택적 그룹의 alternation)에서 jest 기본값 `['/node_modules/']` 로 되돌리고, 대신 `--experimental-vm-modules` 플래그로 ESM 의존성을 ts-jest 변환 없이 네이티브로 로드한다. 정규식 매칭 비용은 (복잡한 alternation → 단일 리터럴) 방향으로 가벼워지고 ts-jest 변환 대상도 줄어든다. 이 경로는 테스트 러너의 모듈 해석 단계에서만 실행되고 프로덕션 요청 처리 경로와 무관하므로 지연시간/처리량에 영향이 없다.
  - 제안: 없음 — 정보성.

- **[INFO]** 테스트 실행 시간 변화는 plan 문서가 이미 정직하게 실측·자기정정했다
  - 위치: `plan/in-progress/jest-esm-native-load.md` §C
  - 상세: backend 단독 jest 32.5s → 23.5~26.5s(20~28% 개선), `run-test.sh unit`(전 패키지 wrapper) 기준 76~103s → 87s(유의한 차이 없음). 초판의 "3배 빠름" 은 단독 실행시간과 wrapper 전체시간을 잘못 비교한 것이었고, 문서가 스스로 반증·정정한 이력이 남아 있다. 이번 라운드도 그 실측치를 재사용하며 새로 바뀐 것이 없다. 조치 불필요.
  - 제안: 없음.

- **[INFO]** `--experimental-vm-modules` 가 모든 jest invocation 에 일괄 추가되어 워커 프로세스당 stderr 로그가 소폭 증가
  - 위치: `codebase/backend/package.json` (`test`/`test:watch`/`test:cov`/`test:debug`/`test:e2e`)
  - 상세: `ExperimentalWarning: VM Modules …` 가 jest 워커 프로세스마다 1줄 찍힌다(plan 문서 실측: 11코어 머신에서 9줄). CI 로그량에 미세한 영향은 있으나 테스트 처리량 자체에는 영향이 없는 수준이고, plan 문서가 신호 가시성을 위해 의도적으로 유지한다고 명시했다.
  - 제안: 없음 — 워커 수가 크게 늘어나는 환경으로 바뀌면 재검토 대상 정도.

- **[INFO]** 신규 가드 스펙(`esm-native-load.spec.ts`)의 I/O·연산 비용은 무시할 수준
  - 위치: `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts` (`fs.readFileSync` 2회 — `package.json`, `test/jest-e2e.json`)
  - 상세: 두 테스트가 각각 작은 JSON 파일(수백 바이트~수 KB)을 `fs.readFileSync` + `JSON.parse` 로 동기 로드한다. 스펙당 1회씩만 실행되고 테스트 프로세스 내부 setup 단계라 블로킹 I/O 로 문제 삼을 수준이 아니다. `uuidv4()` 호출도 단발성.
  - 제안: 없음.

- **[INFO]** `transformIgnorePatterns` 기본값이 pnpm 중첩 경로에서도 매치되어 회귀 없음을 실측 확인
  - 위치: `codebase/backend/jest.config.ts`, `codebase/backend/test/jest-e2e.json`
  - 상세: `/node_modules/` 는 pnpm 의 `.pnpm/<pkg>@<ver>/node_modules/<pkg>` 레이아웃에서도 마지막 세그먼트에 매치되므로 별도 pnpm prefix 분기가 필요 없다. plan 문서가 unit 472/9946, e2e 380 PASS 로 확인했고 `collectCoverageFrom` 도 이 diff 로 바뀌지 않는다.
  - 제안: 없음.

- **[INFO]** 신규 후속 항목(docs 가드 pathspec 갭·CHANGELOG 판정 기준 부재)은 CI 잡 구성/문서 프로세스 문제이지 런타임 성능 문제가 아니다
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (신규 두 항목: "docs 가드가 검사하는 데이터가 그 가드를 트리거하지 않는다", "CHANGELOG 「해당 없음」 판정에 성문 근거가 없다")
  - 상세: 첫 항목은 `frontend-checks.yml` pathspec 이 `plan/**`·`spec/**` 을 포함하지 않아 그 데이터를 스캔하는 가드(`plan-frontmatter` 등)가 no-op 이 된다는 내용이다. 두 옵션(pathspec 확장 vs 별도 잡 분리) 모두 CI 잡 수·트리거 빈도에 관한 것으로, 이 저장소의 "성능" 관점 항목(프로덕션 지연시간·처리량)과는 결이 다르다 — CI 파이프라인 비용/트리거 정확도 문제로 별도 트래킹이 적절하며, 이 리뷰 스코프(런타임 코드)에서는 조치 불필요.
  - 제안: 없음 — 참고로 남긴다.

알고리즘 복잡도·N+1 호출·메모리 누수·캐싱 전략·블로킹 I/O·과도한 문자열 연결·부적절한 자료구조·
선행 로딩 등 나머지 점검 관점은 이번 diff 에 해당하는 프로덕션 코드 경로가 없어 적용 대상이 없다.

## 뮤테이션/검증 메모

이번 라운드는 코드 수정 없이 정적 대조(`git diff origin/main -- <4개 경로>`)만으로 1~3라운드와의
바이트 단위 동일성을 확인했다. 저장소 트리에 어떤 파일도 쓰거나 고치지 않았고(`git status --short`
로 확인, 본 세션이 만든 untracked 항목은 이번 리뷰 출력 디렉터리 하나뿐), 원복이 필요한 뮤테이션도
없었다.

## 요약

핵심 코드 diff(`jest.config.ts`/`package.json`/`jest-e2e.json`/`esm-native-load.spec.ts`)는
1~3라운드와 바이트 단위로 동일하며, 애플리케이션 런타임 코드를 전혀 건드리지 않고 Jest 테스트
러너의 ESM 모듈 로딩 방식만 바꾸는 순수 테스트 인프라 변경이다. 손으로 유지하던
`transformIgnorePatterns` allowlist 제거는 정규식 매칭·변환 오버헤드를 오히려 줄이는 방향이고,
유일하게 측정 가능한 "성능" 지표인 테스트 실행 시간은 plan 문서가 정직하게 실측(backend 단독
20~28% 개선, wrapper 기준 무의미)했다. 이번 라운드에서 새로 추가된 파일(PROJECT.md 한 문단,
followups 항목 2건, 이전 라운드 리뷰 산출물 커밋)도 문서·프로세스 성격이라 성능 관점의 신규
코드 검토 대상이 없다. CRITICAL/WARNING 급 성능 이슈는 4라운드에 걸쳐 발견되지 않았다.

## 위험도

NONE
