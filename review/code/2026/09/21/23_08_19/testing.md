# 테스트(Testing) 리뷰 — race-helper-guard-tests

## 검증 절차 메모

`codebase/backend/src/shared/testing/overlap-preconditions.spec.ts` 를 저장소 내에서
직접 실행해 확인했다(파일 mutation 없음, read-only 실행):

```
npx jest --config jest.config.ts shared/testing/overlap-preconditions.spec.ts
→ Test Suites: 1 passed, 1 total / Tests: 11 passed, 11 total
```

또한 `codebase/backend/jest.config.ts`(`rootDir: 'src'`, `testRegex: '.*\.spec\.ts$'`)와
`codebase/backend/test/jest-e2e.json`(`testRegex: '.e2e-spec.ts$'`)를 직접 열어, plan 과
`overlap-preconditions.ts` JSDoc 이 주장하는 "unit jest 가 `src/shared/testing/*.spec.ts`
를 집고, `test/helpers/*.spec.ts` 는 어느 러너에도 안 걸린다"는 서술이 실제 설정과 일치함을
확인했다. 리뷰 종료 시 `git status --short` 로 저장소에 잔여 mutation이 없음을 확인했다
(`review/code/2026/09/21/23_08_19/` 자체 산출물 외 변경 없음).

## 발견사항

- **[INFO]** `raceUnderHeldLock` 내부에서 `assertEnoughFiresForOverlap`/모듈 최상위
  `assertGuardBelowKnownTimeouts` 호출을 통째로 **삭제**해도 잡아내는 테스트가 없다 (배선 갭)
  - 위치: `codebase/backend/test/helpers/concurrency.ts:31`, `:78` (신규 함수 호출 지점)
  - 상세: 새 self-spec(`overlap-preconditions.spec.ts`)은 두 규칙의 **내용**만 순수 함수
    수준에서 검증한다. `concurrency.ts` 가 그 함수를 실제로 **호출한다**는 배선은 어떤
    테스트도 행사하지 않는다. 기존 9파일 11블록의 e2e 는 전부 `fires: [f, f]`(길이 2)로만
    호출하므로, `assertEnoughFiresForOverlap(fires.length)` 호출 줄 하나를 지워도 그 e2e
    들은 여전히 통과한다 — 회귀를 감지하지 못한다. 모듈 최상위 `assertGuardBelowKnownTimeouts(...)`
    호출도 마찬가지로, 그 줄을 지워도 어떤 테스트도 실패하지 않는다(현재 상수 값이 안전 범위
    안에 있어 호출해도 안 해도 import 는 성공한다).
  - 이 갭은 plan(`plan/in-progress/race-helper-guard-tests.md` §B, "남는 이음매를 적어 둔다")
    본문에 이미 명시적으로 인지·기록돼 있고, 저자 스스로 확인한바 기존 `src/shared/testing/`
    5쌍 선례(`trigger-workflow-ref` 등)도 동일한 성격의 갭(콘텐츠는 self-spec, 소비부 호출은
    별도 미검증)을 갖는다. 새로 도입된 결함이 아니라 기존 관례와 **같은 등급**의 한계이므로
    Critical/Warning 이 아니라 INFO 로 기록한다.
  - 제안: 지금 당장 조치는 불요. 다만 향후 이런 "순수 규칙 추출 + self-spec" 패턴을 반복할
    때, 호출부에서 그 규칙이 실제로 불려지는지까지 검증하고 싶다면 `jest.spyOn` 으로
    `raceUnderHeldLock` 호출 시 해당 함수가 호출됐는지 확인하는 얇은 통합 테스트를 별도
    고려할 수 있다(다만 이는 5개 선례 전체에 적용될 구조적 결정이라 이 PR 단독 스코프는
    아니다).

- **[INFO]** 엣지 케이스/경계값 테스트 설계가 뮤테이션 대상까지 명시하며 매우 촘촘함 — 특이 발견 아님, 긍정적 관찰
  - 위치: `codebase/backend/src/shared/testing/overlap-preconditions.spec.ts:25`(`it.each([[0],[1]])`),
    `:32`(`it.each([[2],[3],[9]])`), `:53`(`>=` 경계), `:62`(둘째 항만 위반), `:70`(둘 다 위반 시 첫 항 보고)
  - 상세: `0`/`1`/`2` 세 값을 분리해 각기 다른 "왜 이 값인가"(공허성 가드의 `pending` vs
    `settled` 판정과의 상호작용)를 주석으로 명시했고, `assertGuardBelowKnownTimeouts` 는
    `>=`→`>` 뮤턴트, "루프를 첫 항만 보게 줄이는" 뮤턴트를 각각 별도 케이스로 죽이도록
    설계돼 있다(같은 입력을 재사용하지 않고 각 케이스에 다른 값을 배정해 서로를 구분할 수
    있게 한 점도 적절 — `feedback_mutation_coverage_multiarm_operators` 교훈과 일치).
    직접 실행한 결과 11개 테스트 전부 PASS, plan 에 기록된 4종 뮤턴트(A~D) 예측=실측 표도
    타당해 보인다(단, 뮤턴트 재현 자체는 이 리뷰에서 재실행하지 않고 plan 기록을 근거로
    삼았다 — 저장소 파일을 고쳐 재확인하는 대신 신뢰할 수 있는 별도 근거인 실제 unit 실행
    결과와 jest 설정 대조로 교차 검증했다).

- **[INFO]** Mock 미사용 — 순수 함수 추출로 테스트 용이성이 실질적으로 개선됨
  - 위치: `codebase/backend/src/shared/testing/overlap-preconditions.ts` 전체
  - 상세: 두 규칙 모두 import 0, DB/타이머 등 외부 의존성 없는 순수 함수로 추출돼 self-spec
    이 mock/stub 없이 직접 입력→예외를 검증한다. 이전에는 `concurrency.ts` 최상위 `for`
    루프(모듈 부수효과)와 DB 의존 함수 내부에 갇혀 있어 `jest.isolateModules`+`doMock` 없이는
    테스트 불가능했던 것과 비교하면 테스트 용이성(관점 8) 개선이 뚜렷하다.

## 요약

`overlap-preconditions.ts`/`.spec.ts` 신규 쌍은 이전에 "어떤 러너도 지나가지 않던" 순수
동기 검사 두 개를 실행 가능한 위치로 옮기고, 경계값·오탐 시나리오·다중 위반 우선순위까지
뮤테이션 관점에서 설계된 11개 테스트로 고정했다. 실제로 `npx jest`를 직접 실행해 11개
전부 PASS 함을 확인했고, jest 설정(`rootDir: 'src'`, unit `testRegex`)이 이 파일을 실제로
수집함도 별도로 대조했다 — plan 이 주장하는 "선례 5쌍과 같은 자리라 jest 설정 무변경으로
수집된다"는 서술이 실측과 일치한다. 유일하게 남는 갭은 `concurrency.ts` 가 이 함수들을
실제로 호출한다는 "배선" 자체는 미검증이라는 점인데, 이는 저자가 스스로 plan 에 명시했고
기존 5개 선례와 동일한 성격의 한계라 이번 PR 이 새로 만든 결함이 아니다. 전반적으로 테스트
존재성·경계값·가독성·의존성 주입(순수 함수화) 모든 관점에서 높은 품질이며, 차단할 발견사항은
없다.

## 위험도
LOW
