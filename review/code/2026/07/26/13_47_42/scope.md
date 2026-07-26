# 변경 범위(Scope) Review — linear-cancel-mechanism (3R)

대상: `dad70c7b2`(원 커밋, 선형 3-루프) → `7ea04f7cd`(1R 리뷰, C1-C4/W1-W8) →
`ff87ede27`/`107133cfd`/`a3e169317`/`12ffc45f8`(1R 조치: Sub-Workflow·컨테이너/
Parallel·Background 확장) → `cb9204968`(2R 리뷰, C5/W9-W13) → `10b27c320`/
`dceaa8ca9`(2R 조치: Parallel `continue` 우회 재throw·컨테이너 catch-all 재throw·
스로틀·회귀 테스트·리팩터·문구 정정, HEAD). `git diff origin/main...HEAD --stat`
결과(14개 코드/plan/CHANGELOG 파일 + `review/code/2026/07/26/{11_48_55,12_55_55}/`
산출물 31개)와 프롬프트 대상 파일 목록이 정확히 일치 — 숨은 변경 없음.

## 선행 판단 재확인 (다시 들추지 않음)

1R scope 리뷰(`review/code/2026/07/26/11_48_55/scope.md`, 위험도 NONE)와 2R scope
리뷰(`review/code/2026/07/26/12_55_55/scope.md`, 위험도 NONE)가 이미 다음을 스코프
내로 판정했고, 근거를 직접 대조해 재확인했다 — **재론하지 않는다**:

- **Sub-Workflow 확장(C1)**: `workflow.handler.ts:195-197` — 원 커밋의 JSDoc(§2.3)이
  스스로 "3 루프 전부 조치 완료"라 주장했는데, 1R 리뷰(3개 에이전트 수렴)가 유일한
  호출자의 catch 가 그 가드를 무력화함을 실측으로 반증. 새 기능이 아니라 원 커밋
  자신의 약속을 지키게 만드는 수정.
- **컨테이너/Parallel 본문 확장(C3)**: `foreach-executor.ts:92-101`,
  `execution-engine.service.ts` `executeContainerBody`/`executeParallelBranchBody`
  — 원 커밋의 "노드 경계마다" 주장이 컨테이너/Parallel 본문엔 적용되지 않음을
  1R 리뷰가 반증. 동일 논리.
- **Background 확장(W2)**: `executeBackgroundSubgraph` catch — C1 수정이 만든 새
  도달 경로(같은 executionId 를 공유하는 본문)의 직접 파생 결과.
- 반대로 spec 문서 갱신(W6, `project-planner` 위임)·가드 시퀀스 헬퍼 승격(W8,
  plan 백로그)·shutdown FAILED 미탐지(concurrency INFO, plan 백로그)는 developer
  권한 밖이거나 별도 규모라 **이번 PR 에 끌어들이지 않고 위임/백로그로 분리**한
  것도 1R/2R 이 이미 확인.

## 3R 신규 판단 대상 — 2R 조치(`10b27c320`/`dceaa8ca9`)의 5개 항목

### 발견사항

- **[INFO]** **C5 — `ParallelExecutor` `errorPolicy:'continue'` 취소 흡수 수정**: 스코프 내.
  - 위치: `codebase/backend/src/modules/execution-engine/containers/parallel-executor.ts:273-289`
    (`failures.find((f) => f.error instanceof ExecutionCancelledError)` 후 재throw,
    `errorPolicy` switch 이전에 배치) + `parallel-executor.spec.ts:225-284`(대칭 회귀 6건)
  - 상세: 2R 리뷰(`12_55_55/SUMMARY.md` C5)가 "C3(ForEach)가 고친 것과 구조적으로 동일한
    버그가 Parallel 콤비네이터에 남았다"고 지목한 CRITICAL 을 정확히 그 대칭 지점에만
    고쳤다. 새 옵션·새 API·다른 브랜치 로직 변경 없음. `runParallel` 의
    `failures[]` 미소비·`errorPolicy:'stop'` 의 `failures[0]` 순서 레이스는 커밋
    메시지·`RESOLUTION.md`·`node-cancellation-residual-signal-propagation.md`
    "백로그" 절에 명시적으로 범위 밖으로 분리 — 스코프를 넓히지 않으려는 절제가
    이번에도 유지됨.
  - 판정: 스코프 내.

- **[INFO]** **W9 — `runContainer` catch-all 취소 오분류 수정**: 스코프 내.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:7566-7575`
    (`if (err instanceof ExecutionCancelledError) throw err;`, 기존 FAILED 마킹/
    `NODE_FAILED` emit 로직보다 앞에 배치)
  - 상세: C3(1R)가 컨테이너 경로에 `ExecutionCancelledError` 를 처음 실전 발생시킨
    "부작용"을 2R 리뷰가 신규 결함(W9)으로 정확히 지목했다 — 즉 이번 세션 이전에는
    프로덕션에서 이 catch 에 그 에러 타입이 도달한 적이 없었다. C1/C3 와 동일한
    "우회 재throw" 패턴을 대칭 적용한 4줄 수정 + 대상 회귀 테스트
    (`execution-engine.service.spec.ts:10108-10195`, `save`/`emitNode` 인자 직접 단언).
    이번 라운드가 스스로 만든 회귀를 같은 턴에 닫은 것.
  - 판정: 스코프 내.

- **[INFO]** **W10 — 컨테이너 아이템 경계 시간 기반 스로틀 도입**: 스코프 내.
  - 위치: `execution-engine.service.ts:531-550`(`containerCancelCheckedAtMs` Map +
    `CONTAINER_CANCEL_CHECK_THROTTLE_MS = 250`), `:7896-7924`(`assertExecutionNotCancelled`
    의 `opts?.throttle` 분기), 호출부 `:6515`(`executeContainerBody` 만
    `{ throttle: true }` 전달 — 선형/Parallel 노드 경계는 옵션 없이 기존과 동일하게
    매번 조회), 정리 `:2670`(`finalizeRehydrationCleanup`) · `:4544`(`runExecution` finally)
  - 상세: 2R 리뷰(performance)가 "폴링 비용이 아이템 수에 곱해지지 않는다"던
    1R SUMMARY 의 자체 INFO 관측을 실측으로 반증하며 제기한 WARNING(W10) 에 대한
    직접 대응이다 — 즉 C3 확장 자체가 도입한 성능 회귀를, 같은 세션 안에서 review가
    잡아 같은 세션이 닫았다. 적용 범위가 `executeContainerBody` 단 한 곳으로 정확히
    좁혀져 있고(노드 경계 두 호출부는 건드리지 않음), 새 환경변수·설정 플래그·
    공개 API 없이 private 필드 2개 + 메서드 시그니처에 옵셔널 파라미터 1개 추가로
    끝났다. 트레이드오프(250ms 관측 지연이 §5 best-effort 계약상 무해한 근거,
    "N회마다 1회" 대안을 기각한 이유, Map 누수 방지)가
    `node-cancellation-residual-signal-propagation.md` "트레이드오프" 절에 근거와
    함께 기록됨 — over-engineering 이 아니라 근거가 문서화된 최소 대응.
    부수적으로 스로틀 도입이 기존 C3 회귀 테스트(아이템 0→1 경계 취소 관측)를
    깨뜨려(연속 실행 시 스로틀이 취소 관측을 가려버림) `Date.now()` spy 로 보강한
    것도 W10 의 직접 파생 결과이지 무관한 테스트 리팩토링이 아니다.
  - 판정: 스코프 내.

- **[INFO]** **W11 — C4 배선(guarded UPDATE) 회귀 테스트 추가**: 스코프 내.
  - 위치: `execution-engine.service.spec.ts:6191-6247`
  - 상세: 순수 테스트 추가(프로덕션 코드 변경 없음). 2R testing 이 "C4 배선을
    되돌려도 412/412 GREEN(미검출)"이라 지목한 커버리지 갭을 정확히 닫는다.
  - 판정: 스코프 내.

- **[INFO]** **W12 — 취소 종결 8줄 블록을 `finalizeCancelledExecution` 헬퍼로 추출**: 스코프 내(경계적이나 정당).
  - 위치: `execution-engine.service.ts:4568-4585`(신규 헬퍼) + 호출부
    `:2646`(`finalizeResumedExecutionOutcome`) · `:4530`(`runExecution`)
  - 상세: 일반적으로 "불필요한 리팩토링"은 이 리뷰 관점에서 가장 흔한 위반
    유형이지만, 이 추출 대상은 **이번 PR 자신의 C4(1R) 조치가 두 catch 에 손으로
    복제해 넣은 코드**이지 원래부터 있던 무관한 레거시 중복이 아니다. 2R
    maintainability 가 "이번 PR 이 새로 만든 중복"(W12)이라고 명시적으로 지목했고,
    추출 범위도 정확히 그 8줄(+`logContext` 매개변수화)로 한정된다 — 3개 dispatch
    루프 전체를 통합하는 더 큰 리팩터(1R maintainability 가 별도 "중간 규모 후속
    작업"으로 제안한 W8, 가드 *진입부* 시퀀스 통합)와는 대상이 다르며, W8 은 이번
    커밋에서 건드리지 않고 백로그에 그대로 남아 있다(직접 grep 으로 `assertActiveTimeWithinLimit`
    호출부 3곳이 이번 diff 로 변경되지 않았음을 확인). 두 리팩터를 혼동하지 않고
    분리한 것 자체가 스코프 규율의 증거.
  - 판정: 스코프 내.

- **[INFO]** **W13 — JSDoc/CHANGELOG "status 단일 컬럼" 문구 정정**: 스코프 내.
  - 위치: `execution-engine.service.ts:7887-7891`, `CHANGELOG.md`(성능 항목,
    "id/status 2개 컬럼만 투영"으로 수정)
  - 상세: 1R W1 이 컬럼 투영(`select:{id,status}`)으로 이미 고쳤는데 주석/CHANGELOG
    문구만 "단일 컬럼"으로 남아 있던 근소한 부정확을 정정 — 순수 문서 정확도
    수정, 로직 변경 없음.
  - 판정: 스코프 내.

## 그 외 8개 관점 (2R 이후 diff 대상)

1. **의도 이상의 변경**: 없음 — C5/W9-W13 6개 항목 전부 2R SUMMARY 의 번호가 매겨진
   항목과 1:1 대응(커밋 메시지·`RESOLUTION.md`·plan 문서 교차 인용 확인).
2. **불필요한 리팩토링**: W12 하나뿐이며, 위에서 확인했듯 이번 PR 이 스스로 만든
   중복만 대상으로 함 — 무관한 기존 코드 정리 없음.
3. **기능 확장(over-engineering)**: 없음 — 스로틀(W10)도 설정 플래그·API 없이
   상수 하나로 고정, 새 공개 인터페이스 없음.
4. **무관한 수정**: 없음 — `git diff --stat` 재확인 결과 6개 코드/테스트 파일 +
   plan/CHANGELOG 뿐, MakeShop/Cafe24/web-chat 등 무관 영역 없음.
5. **포맷팅 변경**: 없음(직접 diff 확인, 공백/줄바꿈 전용 변경 없음).
6. **주석 변경**: 신규 주석은 전부 `ai-review C5/W9/W10/.../2026-07-26` 태그로
   근거를 명시하는 신규 결함 설명이며, 기존 무관 주석 삭제/수정 없음.
7. **임포트 변경**: 없음(2R 는 신규 import 없음 — `ExecutionCancelledError` 는
   1R 에서 이미 임포트됨, `parallel-executor.ts`/`foreach-executor.ts` 는 재사용).
8. **설정 변경**: 없음(`package.json`/CI yml 등 변경 없음).

## 요약

3라운드에 걸친 확장(선형 경로 → Sub-Workflow → 컨테이너/Parallel → Background →
스로틀)은 매 단계가 "새 요구사항"이 아니라 **직전 라운드가 자신의 코드에 대해
실측으로 제기한 CRITICAL/WARNING 을 같은 결함 클래스 안에서 닫은 것**이라는 패턴을
유지한다. 이번(3R) 신규 판단 대상인 2R 조치 6개 항목(C5/W9/W10/W11/W12/W13) 도 예외가
아니다 — C5·W9 는 1R 확장(C3) 자신이 컨테이너/Parallel 경로에 처음 실전 노출시킨
동일 결함 클래스의 잔여 발현 지점을 대칭적으로 닫았고, W10 은 그 확장이 스스로
만든 성능 회귀(아이템 수에 선형 비례하는 DB 왕복)를 같은 세션 안에서 리뷰가 잡고
같은 세션이 좁게 고쳤으며(적용 범위를 컨테이너 아이템 경계 1곳으로 한정, 트레이드오프
문서화), W11/W13 은 순수 테스트/문서 정확도 보강, W12 는 이번 PR 자신이 만든
8줄 중복만을 대상으로 한 절제된 추출이다. 반대로 `runParallel` 의 `failures[]`
미소비, `errorPolicy:'stop'` 우선순위 레이스, 가드 시퀀스 헬퍼 전면 승격(W8),
spec 문서 갱신(W6), shutdown FAILED 확장 같이 진짜로 "더 큰 규모"이거나
"developer 권한 밖"인 항목들은 매 라운드 일관되게 plan 백로그/`project-planner`
위임으로 분리되고 이번 코드 diff 에는 들어오지 않았다 — 이 분리 기준이 3라운드
내내 흔들리지 않고 유지된 것이 이번 확장을 "범위 이탈"이 아니라 "원 커밋이
자체 주장한 계약의 완성"으로 판정하는 핵심 근거다. 별도 PR 로 분리해야 할 항목은
발견되지 않았다.

## 위험도

NONE
