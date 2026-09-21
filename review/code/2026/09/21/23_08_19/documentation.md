# 문서화(Documentation) 리뷰

## 검토 범위

실제 코드 변경(`codebase/**`, `PROJECT.md`)은 4개 파일, +162/-22줄:
- `PROJECT.md` — `test/helpers/` self-spec 러너 미탐지 예외 규칙 1항목 추가
- `codebase/backend/src/shared/testing/overlap-preconditions.ts` (신규) — 순수 함수 2개
- `codebase/backend/src/shared/testing/overlap-preconditions.spec.ts` (신규) — self-spec
- `codebase/backend/test/helpers/concurrency.ts` — 위 두 함수를 호출로 위임, 중복 주석 제거

나머지(`plan/in-progress/*.md`, `review/consistency/**`)는 plan·리뷰 산출물이며 코드 문서화
점검 관점(JSDoc/README/API문서)의 대상은 아니어서 참고용으로만 훑었다.

## 발견사항

### [INFO] JSDoc·주석 품질이 이례적으로 높음 — 결함 아님, 확인 사항
- 위치: `codebase/backend/src/shared/testing/overlap-preconditions.ts` (`assertEnoughFiresForOverlap`, `assertGuardBelowKnownTimeouts`), `codebase/backend/src/shared/testing/overlap-preconditions.spec.ts` (파일 헤더 블록)
- 상세: 두 export 함수 모두 `@throws`·`@param`·"이 가드가 실제로 막는 것"·경계값 근거까지 JSDoc 에 담겨 있고, 다음 사실관계를 실제 설정 파일로 대조했다 — 모두 일치함:
  - `codebase/backend/jest.config.ts`: `rootDir: 'src'`, `testRegex: '.*\.spec\.ts$'` → `test/` 아래 `.spec.ts` 는 unit 러너 탐색 범위 밖이라는 주석 주장과 일치
  - `codebase/backend/test/jest-e2e.json`: `testRegex: '.e2e-spec.ts$'` → 평범한 `.spec.ts` 는 e2e 러너도 안 잡는다는 주장과 일치
  - `codebase/backend/tsconfig.build.json`: `exclude` 목록에 `"src/shared/testing/**"` 실재 → `dist/` 로 안 나간다는 주장과 일치
  - `PROJECT.md` 의 `### 파일 위치·명명` 헤딩 실재 → `overlap-preconditions.ts` 헤더 주석의 "SoT 는 `PROJECT.md §파일 위치·명명` 한 줄" 참조가 정확
- 제안: 없음. 다만 이 밀도를 향후 유사 헬퍼 추출(`src/shared/testing/` 6번째 쌍)의 기준선으로 참고할 만하다.

### [INFO] `concurrency.ts` 의 중복 주석 제거 및 SoT 단일화가 정확
- 위치: `codebase/backend/test/helpers/concurrency.ts` — `VACUITY_GUARD_MS` 선언부 JSDoc, `raceUnderHeldLock` 본문 내 `assertEnoughFiresForOverlap` 호출 앞 인라인 주석
- 상세: diff 이전에는 "공허성 가드 대기 시간" 관련 근거·한계 설명이 `concurrency.ts` 안에 전문으로 있었으나, 이번 변경으로 그 서술을 `assertGuardBelowKnownTimeouts` JSDoc 으로 옮기고 `concurrency.ts` 쪽엔 "여기 복제하지 않는다(두 자리에 적으면 한쪽이 낡는다)" 라는 포인터만 남겼다. `raceUnderHeldLock` 상단의 기존 JSDoc(`@throws fires 가 2개 미만이면…`, `@param fires 발사할 thunk들(2개 이상)`)은 로직이 `assertEnoughFiresForOverlap` 호출로 위임된 뒤에도 여전히 사실과 일치 — 오래된 주석(stale comment)이 남지 않았다.
- 제안: 없음.

### [INFO] CHANGELOG.md 미변경 — 이 저장소 관례상 정합
- 위치: `CHANGELOG.md` (변경 없음)
- 상세: `CHANGELOG.md` 는 사용자에게 보이는 fix/feat 커밋에 대해 근거·판별 실측을 담은 산문 항목을 쌓는 방식으로 운영되고 있다(최근 9개 항목 전부 `fix(...)`/`feat(...)`, 프로덕션 동작 변경). 이번 변경은 plan 의 `## D. 하지 않는 것`에 명시된 대로 "프로덕션 런타임 코드 변경 0"인 test-harness 전용 리팩터다. 직전 관련 커밋(`d5e23bbb5 refactor(test):…(#1377)`, `bfdbb544d test(concurrency):…`)도 `CHANGELOG.md` 를 건드리지 않았음을 `git log -- CHANGELOG.md` 로 확인했다 — 선례와 일치하므로 이번 누락은 회귀가 아니다.
- 제안: 없음 (참고용 기록).

### [INFO] plan 문서 자체의 문서화 품질
- 위치: `plan/in-progress/race-helper-guard-tests.md`
- 상세: `--impl-prep` 1차 BLOCK 원인·정정 근거·뮤턴트 4종의 예측=실측 표·수집 수치 전/후 대조까지 갖춰 추적 가능성이 높다. 체크리스트의 미완료 항목(`트래커 :1895` 해소 표기, `/ai-review` 수렴, `--impl-done`, `plan/complete/` 이동)은 현재 세션이 진행 중인 이 리뷰 자체를 가리키는 것이므로 실제 상태와 일치한다(허위 완료 표시 없음).
- 제안: 없음.

## 요약

이번 변경은 문서화 관점에서 결함을 찾지 못했다. 신규 export 함수 2개 모두 근거·경계값·한계까지 명시한 JSDoc을 갖췄고, self-spec 이 그 JSDoc 의 주장(예: `>=` 판정, 빈 목록 공허 통과)을 뮤턴트 관점에서 그대로 고정한다. `concurrency.ts` 리팩터는 중복 주석을 제거하며 단일 SoT 포인터로 정리했고 기존 JSDoc 은 로직 위임 후에도 여전히 정확하다(stale 없음). `PROJECT.md` 의 예외 규칙 한 줄은 실제 jest/tsconfig 설정과 대조 검증했으며 정확히 일치한다. CHANGELOG 미변경은 이 저장소의 test-harness-only 커밋 선례와 일치해 문제가 아니다.

## 위험도
NONE
