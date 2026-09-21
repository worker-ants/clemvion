# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** 검증 로직을 분리 모듈로 옮기며 에러 메시지에서 `raceUnderHeldLock:` 접두어가 소리 없이 사라졌다
  - 위치: `codebase/backend/src/shared/testing/overlap-preconditions.ts` — `assertEnoughFiresForOverlap` 함수(게이트 25-31행), `assertGuardBelowKnownTimeouts` 함수(게이트 48-60행)
  - 상세: 기존 `codebase/backend/test/helpers/concurrency.ts` 의 인라인 검사는 두 에러 메시지 모두 `` `raceUnderHeldLock: ...` `` 접두어를 붙였다(구 diff 기준 삭제된 줄: 겹침 가드 `raceUnderHeldLock: 겹침을 만들려면 thunk 가 2개 이상이어야 한다 (받은 수: ${fires.length})`, 타임아웃 가드 `raceUnderHeldLock: 공허성 가드(...)`). 새 순수 함수로 옮기면서 이 접두어가 빠졌다 — `overlap-preconditions.ts` 게이트 28행 `` `겹침을 만들려면 thunk 가 2개 이상이어야 한다 (받은 수: ${fireCount})` ``, 게이트 54-57행 `` `공허성 가드(${guardMs}ms)가 ${name}(${timeoutMs}ms) 이상이다 — ...` ``. `raceUnderHeldLock` 이 이 함수들을 그대로 호출만 하므로(`concurrency.ts` 게이트 78행 `assertEnoughFiresForOverlap(fires.length);`, 게이트 31행 `assertGuardBelowKnownTimeouts(VACUITY_GUARD_MS, KNOWN_LOCK_TIMEOUTS_MS);`) 이 에러가 어느 e2e 파일의 스택에서 터지든 메시지만 보면 "어느 헬퍼가 던졌는지" 단서가 하나 준다. `grep -rn "raceUnderHeldLock:" codebase/` 로 확인한 결과 이 접두어 문자열에 의존하는 호출부·테스트 단언은 현재 0건이라 즉시 깨지는 곳은 없다.
  - 제안: 의도된 메시지 단순화라면 문제 없음. 다만 향후 CI 로그에서 "이 예외가 raceUnderHeldLock 경유인지" 구분이 필요해질 수 있으니, 필요하면 `raceUnderHeldLock` 쪽에서 catch 후 재던지기보다 메시지에 컨텍스트를 붙이는 별도 계층을 고려.

## 그 외 점검 결과 (문제 없음)

- **모듈 로드 시점 부작용 불변**: `concurrency.ts` 상단의 `assertGuardBelowKnownTimeouts(VACUITY_GUARD_MS, KNOWN_LOCK_TIMEOUTS_MS)` 호출(게이트 31행)은 종전의 최상위 `for` 루프와 동일하게 **import 시점에 동기적으로 평가**된다. 실행 시점·조건·던지는 대상 전부 동일 — 새로운 import-time 부작용이 추가된 것이 아니라 동일 부작용을 함수 호출로 재구성한 것.
- **런타임 의존성 0 확인**: `codebase/backend/src/shared/testing/overlap-preconditions.ts` 는 import 문이 전혀 없는 순수 함수 모듈이다. `codebase/backend/tsconfig.build.json` 이 `src/shared/testing/**` 를 `exclude` 하는 것을 직접 확인했다(`grep -n "shared/testing" tsconfig.build.json` → 게이트 20행에 `"src/shared/testing/**",`) — 신규 파일이 `dist/` 로 유출되지 않는다는 plan 의 주장이 실측과 일치.
- **시그니처·공개 인터페이스**: `raceUnderHeldLock<T>(locker, lock, fires)` 의 시그니처·반환 타입·throw 조건은 변경 없음. 신규 export(`assertEnoughFiresForOverlap`, `assertGuardBelowKnownTimeouts`)는 기존 호출자가 없는 완전 신규 함수라 하위 호환 문제가 없다. `codebase/backend/src/shared/testing/` 에 barrel(`index.ts`)이 없어 신규 함수가 의도치 않게 넓은 표면으로 재노출되지도 않는다(`ls` 로 확인).
- **호출부(9개 e2e 파일) 영향 없음**: `grep -rln "raceUnderHeldLock" codebase/backend/test` 로 나온 9개 `*-concurrency.e2e-spec.ts` 파일 중 어느 것도 가드의 정확한 에러 문자열을 단언하지 않는다(`toThrow`/`rejects` 로 이 메시지를 매칭하는 곳 0건) — 위 INFO 항목의 영향 범위가 실측상 0임을 뒷받침.
- **전역 변수·환경 변수·네트워크·이벤트/콜백**: 새 코드는 순수 계산과 `throw` 뿐이며, 전역 상태를 읽거나 쓰지 않고 `process.env` 접근도, 네트워크 호출도, 이벤트 발행도 없다.
- **파일시스템 부작용**: 코드 변경 자체는 파일을 생성·삭제하지 않는다. diff 에 포함된 `plan/`·`review/consistency/**` 신규 파일들은 developer 워크플로가 요구하는 산출물(impl-prep 게이트 리포트, in-progress plan)로 이 프로젝트 관례상 정상적인 커밋 대상이다(리뷰 산출물은 gitignore 대상이 아님).
- **문서 변경(PROJECT.md)**: 신규 헬퍼 배치 예외 한 줄만 추가되었고 코드 동작에 영향 없음.

## 요약

핵심 변경은 `raceUnderHeldLock` 내부의 인라인 동기 검사 두 개를 `src/shared/testing/overlap-preconditions.ts` 의 순수 함수로 추출한 리팩터링이며, 호출 시점·조건·시그니처 모두 원본과 동일하게 유지된다. 실제로 관측되는 부작용은 두 에러 메시지에서 `raceUnderHeldLock:` 접두어가 빠진 것 하나뿐이고, 이는 grep 으로 확인한 결과 현재 이 문자열에 의존하는 호출부·단언이 없어 즉시 영향은 없다(INFO). 신규 모듈은 import 0 · exclude 확인 · barrel 없음으로 프로덕션 번들·공개 표면에 영향이 없고, 전역 변수·환경 변수·네트워크·파일시스템 부작용도 발견되지 않았다.

## 위험도

LOW
