# 성능(Performance) 리뷰 — jest ESM 네이티브 로드 전환 (5라운드)

## 스코프 확인

diff 는 93개 파일로 구성되나, 실질 코드/설정 변경은 이전 네 라운드와 동일하게 **4개**뿐이다:
`codebase/backend/jest.config.ts`, `codebase/backend/package.json`(scripts),
`codebase/backend/test/jest-e2e.json`, `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts`.

`git diff origin/main -- <위 4개 경로>` 를 직접 재실행하고, 4라운드 결과물
(`review/code/2026/09/24/16_29_15/SUMMARY.md`)이 지적한 두 WARNING(census 가드의
`test:debug` `-r` 순서 미검사, plan 뮤테이션 표의 M8/M9 누락)이 커밋 `00791d3c8`
("test(backend): 4라운드 — 세 번째 같은 형태라 자리 말고 형태를 고쳤다")로 조치됐음을
`git show 00791d3c8`로 직접 확인했다. 그 수정은 `esm-native-load.spec.ts` 의 세 번째
`it` 블록을 "옵션 존재+순서 개별 열거" 방식에서 "script 별 node 인자 구간 전체를
문자열 접두어로 통째 비교" 방식으로 바꾼 것으로, 루프 반복 횟수(5개 script)·I/O
(`fs.readFileSync` 1회)는 변경 전과 동일하거나 더 단순해졌다 — 성능 관점에서 새로
검토할 것이 없다.

이번 라운드에서 새로 나타난 파일은 전부 다음 두 부류다:
1. `review/code/2026/09/24/{14_24_10,15_26_17,16_02_28,16_29_15}/**` — 1~4라운드
   자신의 리뷰 산출물(SUMMARY·RESOLUTION·각 관점 리포트·meta.json 등) 커밋.
2. `review/consistency/2026/09/24/{12_57_36,13_55_20}/**` — consistency-check 산출물.

둘 다 텍스트 리포트이며 실행되는 애플리케이션 코드도 테스트 코드도 아니다. `PROJECT.md` 의
한 문단 추가, `plan/in-progress/nestjs-v12-coordinated-upgrade.md`(스텁, 3라운드부터
불변), `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 후속 항목
2건(docs 가드 pathspec 갭·CHANGELOG 판정 기준 부재)도 마찬가지로 문서·프로세스
성격이며 4라운드에서 이미 INFO로 검토되어 "런타임 성능과 무관"으로 결론난 항목과
내용이 동일하다(추가 변경 없음).

핵심 변경은 여전히 **Jest 테스트 러너의 ESM 모듈 로딩 방식**(손으로 유지하던
`transformIgnorePatterns` allowlist 제거 → `node --experimental-vm-modules` 를 통한
네이티브 ESM 로드)이며, 프로덕션 런타임 코드 경로는 전혀 건드리지 않는다.

## 발견사항

- **[INFO]** 변경 범위는 프로덕션 런타임에 영향을 주지 않는 테스트 인프라 설정이다
  - 위치: `codebase/backend/jest.config.ts` (`transformIgnorePatterns: ['/node_modules/']`), `codebase/backend/package.json` (`test`/`test:watch`/`test:cov`/`test:debug`/`test:e2e` scripts), `codebase/backend/test/jest-e2e.json` (`transformIgnorePatterns`)
  - 상세: 손으로 유지하던 allowlist 정규식(6개 패키지명 + pnpm `.pnpm/` prefix 선택적 그룹의 alternation)에서 jest 기본값 `['/node_modules/']` 로 되돌리고, 대신 `--experimental-vm-modules` 플래그로 ESM 의존성을 ts-jest 변환 없이 네이티브로 로드한다. 정규식 매칭 비용은 복잡한 alternation → 단일 리터럴 방향으로 가벼워지고 ts-jest 변환 대상도 줄어든다. 이 경로는 테스트 러너의 모듈 해석 단계에서만 실행되고 프로덕션 요청 처리 경로와 무관하므로 지연시간/처리량에 영향이 없다.
  - 제안: 없음 — 정보성.

- **[INFO]** 테스트 실행 시간 변화는 plan 문서가 이미 정직하게 실측·자기정정했다
  - 위치: `plan/in-progress/jest-esm-native-load.md` §C
  - 상세: backend 단독 jest 32.5s → 23.5~26.5s(20~28% 개선), `run-test.sh unit`(전 패키지 wrapper) 기준 76~103s → 87s(유의한 차이 없음). 초판의 "3배 빠름" 은 단독 실행시간과 wrapper 전체시간을 잘못 비교한 것이었고, 문서가 스스로 반증·정정한 이력이 남아 있다. 이번 라운드도 새로 바뀐 실측치가 없다. 조치 불필요.
  - 제안: 없음.

- **[INFO]** `--experimental-vm-modules` 가 모든 jest invocation 에 일괄 추가되어 워커 프로세스당 stderr 로그가 소폭 증가
  - 위치: `codebase/backend/package.json` (`test`/`test:watch`/`test:cov`/`test:debug`/`test:e2e`)
  - 상세: `ExperimentalWarning: VM Modules …` 가 jest 워커 프로세스마다 1줄 찍힌다(plan 문서 실측: 11코어 머신에서 9줄). CI 로그량에 미세한 영향은 있으나 테스트 처리량 자체에는 영향이 없는 수준이고, plan 문서가 신호 가시성을 위해 의도적으로 유지한다고 명시했다.
  - 제안: 없음.

- **[INFO]** 4라운드 fix로 재작성된 census 가드(`esm-native-load.spec.ts`)의 I/O·연산 비용도 무시할 수준
  - 위치: `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts` (61~116행, `fs.readFileSync(pkgPath, ...)` 1회 + script 5개에 대한 문자열 slice 비교 루프 + `e2e-config` 를 읽는 별도 `it` 1회)
  - 상세: 파일 두 개(`package.json`, `test/jest-e2e.json`)를 각각 스펙당 1회 동기 로드하고, 5개 script 이름에 대해 `Object.entries`/`slice`/`toEqual` 을 수행한다. 입력 크기가 작고(수 KB) 반복 횟수가 고정 상수(5)라 O(n) 수준이며, 테스트 프로세스 setup 단계에서 1회만 실행되므로 블로킹 I/O 로 문제 삼을 수준이 아니다.
  - 제안: 없음.

- **[INFO]** `transformIgnorePatterns` 기본값이 pnpm 중첩 경로에서도 매치되어 회귀 없음을 실측 확인
  - 위치: `codebase/backend/jest.config.ts`, `codebase/backend/test/jest-e2e.json`
  - 상세: `/node_modules/` 는 pnpm 의 `.pnpm/<pkg>@<ver>/node_modules/<pkg>` 레이아웃에서도 마지막 세그먼트에 매치되므로 별도 pnpm prefix 분기가 필요 없다. plan 문서·4라운드 수정 커밋 모두 unit 473스위트/9950·e2e 380 PASS 로 확인했다.
  - 제안: 없음.

- **[INFO]** 신규/누적 plan 문서(`nestjs-v12-coordinated-upgrade.md`, `spec-draft-nullable-notation-followups.md` 후속 항목)는 CI 잡 구성·후속 업그레이드 선결조건 문서일 뿐 이번 diff의 런타임 성능과 무관
  - 위치: `plan/in-progress/nestjs-v12-coordinated-upgrade.md` §A~E, `plan/in-progress/spec-draft-nullable-notation-followups.md` (docs 가드 pathspec 갭·CHANGELOG 판정 기준 항목)
  - 상세: 전자는 후속 NestJS 12 동반 업그레이드의 착수 조건(선행 PR 의존, reflection 보안 회귀 검증 체크리스트)만 기술하며 이번 diff 범위 밖의 스텁이다. 후자 두 항목은 CI 파이프라인 트리거 정확도·문서 프로세스 문제로, 이 리뷰의 "성능"(프로덕션 지연시간·처리량) 관점과는 결이 다르다.
  - 제안: 없음 — 참고로 남긴다.

알고리즘 복잡도·N+1 호출·메모리 누수·캐싱 전략·블로킹 I/O·과도한 문자열 연결·부적절한
자료구조·선행 로딩 등 나머지 점검 관점은 이번 diff 에 해당하는 프로덕션 코드 경로가 없어
적용 대상이 없다.

## 뮤테이션/검증 메모

이번 라운드는 코드 수정 없이 정적 대조(`git diff origin/main -- <4개 경로>`, `git show
00791d3c8`)만으로 4라운드 fix 반영 여부를 확인했다. 저장소 트리에 어떤 파일도 쓰거나 고치지
않았고(`git status --short` 결과 이번 리뷰 출력 디렉터리 `review/code/2026/09/24/16_56_25/`
하나만 untracked, 다른 변경 없음), 원복이 필요한 뮤테이션도 없었다.

## 요약

핵심 코드/설정 diff(`jest.config.ts`/`package.json`/`jest-e2e.json`/
`esm-native-load.spec.ts`)는 여전히 애플리케이션 런타임 코드를 전혀 건드리지 않고 Jest
테스트 러너의 ESM 모듈 로딩 방식만 바꾸는 순수 테스트 인프라 변경이다. 4라운드에서 지적된
두 WARNING(census 가드의 `test:debug` 옵션 순서 미검사, plan 뮤테이션 표 누락)은 커밋
`00791d3c8`로 조치됐고, 그 재작성된 가드 코드도 성능 관점에서 문제 삼을 것이 없다(고정
상수 반복·소규모 동기 파일 읽기). 손으로 유지하던 `transformIgnorePatterns` allowlist
제거는 정규식 매칭·변환 오버헤드를 오히려 줄이는 방향이고, 유일하게 측정 가능한 "성능"
지표인 테스트 실행 시간은 plan 문서가 정직하게 실측(backend 단독 20~28% 개선, wrapper
기준 무의미)했다. 이번 라운드에서 새로 추가된 파일은 전부 1~4라운드 자신의 리뷰/
consistency-check 산출물 커밋이라 성능 관점의 신규 코드 검토 대상이 없다. CRITICAL/
WARNING 급 성능 이슈는 5라운드에 걸쳐 발견되지 않았다.

## 위험도

NONE
