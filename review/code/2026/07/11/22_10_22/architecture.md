# 아키텍처(Architecture) 리뷰

대상: `refactor-reaper-dry` — 이전 PR(#916/#918, 리뷰 `19_51_59`)에서 W3(emit try/catch 4중복)·W4(bounded-concurrency
청크 루프 2중복)로 지적되고 "백로그 충분"으로 defer 됐던 항목을 정리하는 **behavior-preserving DRY 리팩터** +
`Webchat`→`WebChat` 식별자 대소문자 정규화 + spec 동기화.

## 발견사항

- **[INFO]** `processInBatches` 는 barrier(청크 단위) 동시성이지 진짜 세마포어 기반 sliding-window 풀이 아니다
  - 위치: `codebase/backend/src/common/utils/process-in-batches.ts:197-210`
  - 상세: `for (i += chunkSize) { await Promise.allSettled(chunk...) }` 구조라 한 청크 내 가장 느린 item 이 다음
    청크 시작을 막는다 — concurrency 슬롯이 놀아도 청크 경계까지는 채워지지 않는다. 리팩터 대상 원본 두 loop 를
    그대로 옮긴 것이라 **동작 변경은 없음**(성능 영향은 `performance.md` 참조)이나, 이 유틸이 `common/utils/` 라는
    범용 위치로 승격되면서 향후 새 호출부가 "진짜 bounded-concurrency 풀"을 기대하고 재사용할 위험이 생긴다.
  - 제안: JSDoc 에 이미 "fixed-size chunks" 라 명시돼 있어 계약은 명확하나, 워크로드 길이 편차가 큰 새 호출부가
    생기면 이 유틸을 그대로 재사용하지 말고 별도 세마포어 기반 헬퍼를 검토하라는 한 줄을 덧붙이면 향후 오용을
    예방할 수 있다 (강제 아님, 현재 두 호출부 — DB/Redis 단발 왕복 — 에는 적절).

- **[INFO]** `ExecutionEngineService` 가 여전히 매우 큰 단일 클래스(~8,000 LOC)이며 본 diff 가 `emitCancellationEvent`
  private 헬퍼를 추가로 얹는다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:394-419`
  - 상세: 신규 헬퍼 자체는 4개 cancel 경로(`cancelParkedExecution`·`markExecutionCancelled`·`markQueueWaitTimeout`·
    `markWebChatIdleTimeout`)의 `try{emit}catch{warn}` 중복(~24줄×4)을 단일 지점으로 수렴시켜 **net 으로 파일
    중복은 줄인다** — 이 자체는 긍정적 방향. 다만 서비스 전체의 책임 범위(god-service 경향)는 이 diff 의 스코프
    밖이며 별도로 이미 백로그 추적 중(M-3 이후 항목)이므로 본 리뷰에서 새 결함으로 취급하지 않는다.
  - 제안: 조치 불필요 — 기존 M-1 이후 분할 백로그(M-3→M-8→m-2→C-2 순서)에서 계속 다룰 사항. `emitCancellationEvent`
    는 4개 메서드 내부에서만 쓰이는 응집된 private 헬퍼라 그 자체로는 캡슐화 위반이 없다.

- **[INFO]** `Webchat`→`WebChat` 식별자 rename 이 완전함을 grep 으로 확인 — 잔존 mixed-case 참조 없음
  - 위치: 전체 `codebase/backend/src`·`test`·`spec` (파일명·큐 문자열 `webchat-idle-reaper`·env
    `WEBCHAT_IDLE_REAP_*`·wire `WEBCHAT_IDLE_TIMEOUT` 은 plan 에 명시된 대로 의도적으로 불변)
  - 상세: `grep -rn "Webchat"` 결과 프리저브 대상(파일명/큐명/env/error.code)을 제외하면 코드베이스에 0건 —
    부분 rename 으로 인한 타입 불일치·DI 토큰 불일치·import 실패 위험이 없다. 4개 심볼(`WebChatIdleReaperService`·
    `markWebChatIdleTimeout`·`findIdleWebChatExecutionIds`·`resolveWebChatIdleReapGraceMs`) 모두 선언부·호출부·
    테스트·spec 문서까지 원자적으로 동기화됐다. 결함 아님 — 긍정적 관찰이라 조치 불요.

- **[INFO]** 두 sweep 워커의 오케스트레이션 위치 비대칭(EIA-RL-06 은 `InteractionTokenService` 에 위임, EIA-RL-07 은
  `WebChatIdleReaperService.reap()` 자체에 존재)이 본 리팩터 이후도 유지됨 — 다만 이는 회귀가 아니라 두 sweep 의
  구조적 차이(RL-06 은 단일 서비스 호출로 충분, RL-07 은 engine cancel + token revoke 두 서비스 간 순서 의존 조건부
  오케스트레이션이 필요)에서 기인하는 정당한 차이이며, 직전 리뷰(`review/code/2026/07/11/19_51_59/maintainability.md`)
  에서도 WARNING 이 아닌 INFO 로 판정된 항목이다. `processInBatches` 공용화로 적어도 "청크 동시성 처리" 부분의
  중복은 제거됐고, 두 곳 모두 동일 헬퍼를 거치므로 한쪽만 고치고 다른 쪽을 놓치는 회귀(W4 원 지적 사유) 위험이
  해소됐다. 조치 불필요.

## 요약

배경 문맥(직전 리뷰 `19_51_59`)에서 W3(emit boilerplate 4중복)·W4(bounded-concurrency 청크 루프 2중복)로 지적되고
"백로그 충분, 이번 PR 강제 아님"으로 defer 됐던 두 항목을 정확히 그 스코프 안에서 해소하는 계획적인 후속 리팩터다.
`processInBatches<T,R>` 는 도메인 지식이 없는 순수 제네릭 유틸로 `common/utils/` 에 올바르게 배치되어 순환 의존
위험이 없고, 두 호출부(서로 다른 도메인 서비스)의 결합도를 낮추면서 결과 순서 보존·집계 방식은 호출자에 남겨 적절한
추상화 레벨을 유지한다. `emitCancellationEvent` 는 `ExecutionEngineService` 내부 4개 cancel 경로의 중복을 응집된
private 헬퍼로 수렴시켜 캡슐화를 해치지 않으며, `cancelledBy` 닫힌 3-값 union·`error` 필드의 조건부 스프레드(키
생략 vs null) 등 기존 프로젝트 컨벤션과도 정합한다. `Webchat`→`WebChat` rename 은 grep 으로 완전성이 확인됐고
(파일명·큐 문자열·env·wire error code 는 의도적으로 불변으로 보존), plan 문서(`refactor-reaper-dry.md`)가 "채택"
뿐 아니라 "기각"(4-into-1 config-driven 헬퍼, `MinuteRepeatableSweepWorker` 추상클래스)까지 근거를 명시해 과잉
추상화(premature abstraction)를 의도적으로 피한 성숙한 판단을 보여준다. 새로운 SOLID 위반·순환 의존·레이어 경계
침범·안티패턴은 발견되지 않았다.

## 위험도

LOW
