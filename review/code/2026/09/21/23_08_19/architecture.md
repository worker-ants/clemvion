# 아키텍처 리뷰 — race-helper-guard-tests

## 발견사항

- **[INFO]** 테스트 전용 순수 함수가 프로덕션 소스 트리(`src/`) 안에 위치 — 구조적 분리가 아니라 빌드 설정(exclude)에 의존
  - 위치: `codebase/backend/src/shared/testing/overlap-preconditions.ts` (게이트 1~13)
  - 상세: `assertEnoughFiresForOverlap`/`assertGuardBelowKnownTimeouts` 는 순수한 테스트 헬퍼 로직이지만 `src/shared/testing/` 아래, 즉 프로덕션 컴파일 루트(`rootDir: 'src'`) 안에 놓인다. 프로덕션 코드와의 경계는 폴더 구조(예: 별도 최상위 디렉터리)가 아니라 `tsconfig.build.json` 의 `exclude: ["src/shared/testing/**"]` 라는 **빌드 설정 한 줄**에 의존한다 — 확인 결과 실제로 그렇게 exclude 되어 있다(`codebase/backend/tsconfig.build.json:20`). 레이어 경계가 구조적으로 강제되지 않고 "누군가 exclude 목록을 유지한다"는 관례에 의존하는 형태라, 향후 `tsconfig.build.json` 리팩터링·이관 시 조용히 `dist/` 로 유출될 위험이 남는다.
  - 제안: 새로 도입된 위험은 아니다 — 이 diff 이전에 이미 5쌍의 선례(`response-contract`·`schedule-trigger-ref`·`swagger-probe`·`trigger-workflow-ref`·`user-secret-absence`)가 같은 규약을 따르고 있고, jest `rootDir` 를 바꾸지 않기 위한 의도된 트레이드오프(그리고 `plan/in-progress/race-helper-guard-tests.md` §A-2/§B 에서 이미 대안 (jest `roots` 확장)을 검토 후 기각한 기록)임을 확인했다. 다만 이 규약을 처음 보는 리뷰어가 반복 재지적하지 않도록, `production-build-devdep` 류 가드가 `src/shared/testing/**` 세그먼트를 계속 고정 검증하는지 정기적으로(harness 변경 시) 재확인할 가치는 있다.

- **[INFO]** `overlap-preconditions.ts` 한 모듈에 서로 다른 두 불변식(발사 개수 하한, 가드 시간 상한)이 공존
  - 위치: `codebase/backend/src/shared/testing/overlap-preconditions.ts` — `assertEnoughFiresForOverlap`(게이트 25~31), `assertGuardBelowKnownTimeouts`(게이트 48~60)
  - 상세: 두 함수는 서로 다른 입력·다른 실패 조건을 검증하며 데이터를 공유하지 않는다. 다만 둘 다 "`raceUnderHeldLock` 이 겹침을 실제로 만들었다고 주장하기 위한 전제조건"이라는 동일한 도메인 목적으로 묶여 있고(파일 상단 JSDoc, 게이트 1~13), 파일명(`overlap-preconditions`)도 그 목적을 정확히 반영한다. 응집도는 "기능(무엇을 검증하는가)" 기준으로는 낮지 않으나 "데이터(무엇을 공유하는가)" 기준으로는 낮다.
  - 제안: 현재 규모(2개 export, 60줄)에서는 분리할 실익이 크지 않다. 세 번째 전제조건이 추가되는 시점에 재평가하면 충분하다 — 지금 쪼개는 것은 과도한 추상화가 될 수 있다.

## 상세 평가 (점검 관점별)

1. **SOLID** — `raceUnderHeldLock`(`concurrency.ts`)이 떠안던 "겹침 개수 검증"·"타임아웃 관계 검증" 두 책임을 순수 함수로 추출해 `overlap-preconditions.ts` 로 옮긴 것은 단일 책임 원칙 개선이다. `raceUnderHeldLock` 은 이제 DB 오케스트레이션(BEGIN/락/레이스/COMMIT/ROLLBACK)에만 집중하고, 두 규칙의 호출만 위임한다(게이트 76~78). 의존 방향도 test/helpers → src/shared/testing 한 방향이라 역전 없이 깔끔하다.
2. **결합도/응집도** — `overlap-preconditions.ts` 는 import 0(런타임 의존 없음)이라 결합도가 최소다. `concurrency.ts` 는 이 모듈에만 새로 결합되었고, 기존 `pg`/`@jest/globals` 의존은 그대로다. 응집도는 위 INFO 참고.
3. **레이어 책임** — DB 접근(인프라)과 순수 검증 로직(도메인 규칙)이 파일 단위로 명확히 분리됐다. 다만 "프로덕션 src 트리 vs 테스트 전용 유틸"이라는 또 다른 레이어 경계는 폴더가 아니라 빌드 설정으로 유지된다(위 INFO).
4. **디자인 패턴** — Guard Clause/Precondition 추출 패턴이 적절히 적용됐다. 안티패턴은 관찰되지 않는다. 모듈 최상위에서 `assertGuardBelowKnownTimeouts(VACUITY_GUARD_MS, KNOWN_LOCK_TIMEOUTS_MS)` 를 임포트 시점에 실행하는 부수효과(게이트 31, `concurrency.ts`)는 이 diff 이전부터 있던 구조(원래 최상위 `for` 루프)를 그대로 유지한 것이며, 이번 변경이 새로 도입한 문제는 아니다.
5. **순환 의존성** — 없음. `overlap-preconditions.ts` 는 아무것도 import 하지 않고, `concurrency.ts` 만 그것을 단방향으로 import 한다.
6. **추상화 수준** — 두 함수 모두 입력을 매개변수로 받는 순수 함수로, 오버엔지니어링도 과소 추상화도 없다. `assertGuardBelowKnownTimeouts` 가 `timeouts` 를 매개변수화한 것은 향후 다른 호출부가 자신의 상수 목록을 넘길 수 있게 하는 적절한 수준의 일반화다.
7. **모듈 경계** — `test/helpers/concurrency.ts`(DB 의존 오케스트레이션) vs `src/shared/testing/overlap-preconditions.ts`(순수 규칙) 경계가 명확하다. self-spec 이 규칙 자체를, e2e 11블록이 배선(호출 여부)을 검증하는 이원 구조는 기존 5쌍 선례와 동일한 패턴이며 plan 문서(`race-helper-guard-tests.md` §B, "남는 이음매")가 그 한계를 스스로 명시하고 있어 은폐된 갭이 아니다.
8. **확장성** — `assertGuardBelowKnownTimeouts` 는 새 호출부가 생기면 `KNOWN_LOCK_TIMEOUTS_MS` 배열에 상수를 추가하는 방식으로 확장한다(개방-폐쇄 관점에서 완전히 닫혀 있진 않지만, 목록이 비면 공허하게 통과한다는 한계를 JSDoc 과 self-spec 양쪽에 명시적으로 고정해 두어 향후 오독 위험을 낮췄다). `overlap-preconditions.ts` 에 세 번째 전제조건이 추가되더라도 기존 두 함수를 건드리지 않고 새 export 를 추가하면 되는 구조다.

## 요약

이번 변경은 `raceUnderHeldLock` 내부에 숨어 있던(그리고 어떤 러너에도 걸리지 않던) 두 개의 순수 불변식을 `src/shared/testing/overlap-preconditions.ts` 로 추출해 self-spec 으로 직접 검증 가능하게 만든 리팩터링이다. 책임 분리(DB 오케스트레이션 vs 순수 검증 로직), 의존 방향(단방향, 순환 없음), 확장 여지(향후 전제조건 추가가 기존 코드를 건드리지 않음) 모두 양호하다. 유일하게 짚을 만한 것은 "self-spec 이 필요한 테스트 헬퍼는 `src/shared/testing/`" 라는 프로젝트 관례 자체가 프로덕션 소스 트리와 테스트 전용 코드의 경계를 폴더가 아닌 `tsconfig.build.json` exclude 설정에 위임한다는 점인데, 이는 이 diff 가 새로 만든 결정이 아니라 5쌍의 기존 선례를 그대로 따른 것이고 plan 문서에서 대안(jest `roots` 확장)을 검토 후 명시적으로 기각한 근거가 남아 있어 구조적 리스크로 보기 어렵다. 나머지 파일(`PROJECT.md` 규약 갱신, plan 트래커, consistency-check 산출물)은 이 코드 변경의 근거·이력을 기록하는 문서로, 별도의 아키텍처 우려는 없다.

## 위험도
NONE
