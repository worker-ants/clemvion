# 동시성(Concurrency) 리뷰 — 4R (W14 재검증 집중)

집중 검증 대상: 직전 라운드(`13_47_42`)가 WARNING 으로 낸 **W14**(`containerCancelCheckedAtMs` Map
이 `executeBackgroundSubgraph` 경로에서 정리되지 않아 누수)가 이번 커밋(`2ca6ada66`)으로 해소됐는지,
정리 지점이 3곳(`:2670`·`:4544`·`:6951`)이 된 지금 **전 종료 경로가 커버되는지 전수 확인**. W15~W18 은
동일 커밋에 포함된 부수 변경으로, 동시성 관점에서 새 위험을 만들지 여부만 간단히 확인했다(C1~C5,
W1~W13 은 이미 해소 확인된 항목이라 재론하지 않음).

## 검증 방법

1. `git log --oneline -- execution-engine.service.ts` 로 W14~W18 픽스 커밋(`2ca6ada66`) 특정.
2. `git show 2ca6ada66 -- execution-engine.service.ts` 로 실제 diff 확인 — `:6951`
   (`executeBackgroundSubgraph` 의 `finally` 블록)에 `this.containerCancelCheckedAtMs.delete(job.executionId)`
   추가됨을 확인.
3. `containerCancelCheckedAtMs` 를 참조하는 모든 지점(`set`/`delete`/필드 선언)을 grep 하고, 각 `delete`
   호출부가 속한 함수와 그 함수의 모든 exit path(정상/park/cancel/에러)를 직접 `Read` 로 추적.
4. `set()`(`:7941`, `executeContainerBody` 내부의 `assertExecutionNotCancelled(executionId, {throttle:true})`
   콜)을 만들 수 있는 모든 콜체인을 역추적해, 그 호출이 반드시 어느 top-level 진입점의 try 블록 안에서만
   일어나는지 확인.
5. **실측 mutation 검증**: `:6951` 의 `this.containerCancelCheckedAtMs.delete(job.executionId);` 를
   `// MUTATED-OUT: ...` 으로 주석 처리한 뒤 `npx jest execution-engine.service.spec.ts -t "W14 background
   leak regression"` 실행 → **RED**(`Expected: false / Received: true`) 확인. 원본 파일로 복원(`cp` 로
   원복, `git status` 로 diff 없음 확인) 후 전체 스펙 재실행 → **419/419 GREEN**.

## 발견사항

- **[INFO]** W14 해소 확인 — `executeBackgroundSubgraph` 의 `finally` 에 background 전용 delete 가
  추가되어 background 경로 누수가 닫혔다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:6951`
    (`executeBackgroundSubgraph` 의 `finally` 블록, `this.containerCancelCheckedAtMs.delete(job.executionId)`)
  - 상세: `containerCancelCheckedAtMs.set(...)` 은 오직 `executeContainerBody`(`:7941`)의
    `assertExecutionNotCancelled(executionId, { throttle: true })` 호출을 통해서만 발생한다.
    `executeContainerBody` 는 컨테이너 아이템 dispatch 를 담당하는 `runNodeDispatchLoop` 공용 helper의
    `dispatchKind === 'container'` 분기(`:1721` 부근)에서만 호출되고, `runNodeDispatchLoop` 자체는
    **5개의 top-level 진입점**에서만 호출된다 — `runExecution`(직접, `:4365` 부근), `driveResumeAwaited`
    (`:2245`), `driveCallStackResume`(→ `driveResumeFrame` → `:2576`), `driveStuckRedrive`(`:3329`),
    `executeBackgroundSubgraph`(→ `executeInline` → 동일 helper, `:3857`/`:7226`/`:7650` 등 중첩 container/
    parallel 재귀도 전부 이 5개 진입점 중 하나의 최초 호출 스택 안에서만 실행됨). 5개 진입점 각각이
    자신의 `try { ... } finally { ... }`(또는 `finalizeRehydrationCleanup` 위임)로 **무조건**
    `containerCancelCheckedAtMs.delete(executionId)` 를 실행한다 — `runExecution`(`:4544`),
    `driveResumeAwaited`(`:2312`→`finalizeRehydrationCleanup`), `driveCallStackResume`(`:2476`→동일),
    `driveStuckRedrive`(`:3380`→동일), `executeBackgroundSubgraph`(`:6951`, 이번 커밋 신규). 즉 Map 에
    항목을 만들 수 있는 **모든** 경로가 자신의 종료 시 반드시 정리하는 구조가 됐다.
  - 실측 검증: `:6951` 의 delete 를 mutate-out 한 뒤 `execution-engine.service.spec.ts:3747`
    ("cleans up containerCancelCheckedAtMs for the shared executionId in finally (W14 background leak
    regression)") 를 단독 실행 → **RED**(`priv().containerCancelCheckedAtMs.has(executionId)` 가
    `true` 로 남아 단언 실패). 원복 후 전체 스펙(419 tests) 재실행 → **전부 GREEN**. 코드-테스트 대응이
    실제로 이 결함 클래스를 잡아낸다는 것을 직접 확인했다.
  - 제안: 없음 — 해소 확인.

- **[INFO]** 부모(`runExecution`)/자식(`executeBackgroundSubgraph`) 중 어느 쪽이 먼저 자신의
  `delete(executionId)` 를 실행해도 correctness 문제 없이 수렴한다
  - 위치: `execution-engine.service.ts:4544`(`runExecution` finally) ↔ `:6951`
    (`executeBackgroundSubgraph` finally) — 둘 다 **동일한 `executionId`** 를 키로 공유.
  - 상세: Background 는 부모와 `executionId` 를 공유하는 fire-and-forget BullMQ job 이라, 두 async
    함수 인스턴스가 이벤트 루프 위에서 인터리빙되며 독립적으로 종료된다. 가능한 순서 2가지를 모두
    추적했다.
    1. **부모가 먼저 종료**: `runExecution` finally(`:4544`)가 키를 지운다. Background 가 아직
       실행 중이면 다음 컨테이너 아이템 경계에서 `set()`으로 키를 재생성할 수 있지만, Background
       자신도 종료 시 반드시 `:6951` finally 를 거치므로(성공/park-swallow/cancel-swallow/미처리
       에러 재throw 4개 분기 모두 finally 블록 이후에 전파 — JS 의 try/finally 는 어떤 exit
       경로든 finally 를 보장) 최종적으로 키가 다시 제거된다.
    2. **Background 가 먼저 종료**: `:6951` finally 가 키를 지운다(이미 없으면 no-op — `Map.delete`
       는 부재 키에 안전). 부모가 아직 컨테이너를 실행 중이면 이후 `set()` 으로 재생성하지만, 부모
       자신의 `runExecution` finally(`:4544`)가 마지막에 반드시 실행되어 최종 정리된다.
    - 두 경우 모두 **유일한 부작용은 상대가 먼저 지운 직후 1회의 스로틀 캐시 미스**(다음 아이템 경계
      체크가 `lastCheckedAt` 미존재로 실제 `findOne` 1회 추가 수행)뿐이다 — 스로틀은 순수 최적화이므로
      데이터 손상·lost-update·무한 누수 어느 것도 발생하지 않는다. Node.js 단일 스레드 + `Map.set`/
      `Map.delete` 각각 원자적 동기 연산이므로 두 delete/set 호출 사이에 진짜(데이터 레이스) 경합은
      없다 — 순서에 따른 캐시 미스 정도의 "논리적" 상호작용만 있다(직전 라운드 INFO 항목과 동일 결론,
      이번 수정 반영 후 재검증).
    - 동일 `executionId` 로 Background 노드가 여러 개 동시 실행되는 경우(하나의 부모 Execution 안에
      Background 노드가 2개 이상 있고 둘 다 큐잉되어 병렬로 처리되는 경우)도 동일 논리로 커버된다 —
      각자 자신의 `:6951` finally 에서 idempotent 하게 delete 하므로, N 개의 concurrent 소비자가
      있어도 마지막으로 종료하는 소비자가 항상 최종 정리를 완결한다.
  - 제안: 없음 — 현재 설계로 충분히 안전. (참고 — 굳이 더 하드닝하려면 이 Map 을 `finalizeRehydrationCleanup`
    처럼 명시적 "정리 지점 열거" 방식 대신 참조 카운팅 기반으로 바꿀 수 있으나, 순수 최적화용 캐시에
    그 정도 복잡도를 들일 실익은 낮다.)

- **[INFO]** 정리 지점이 열거형(3곳 하드코딩)이라는 설계 자체는 여전히 "새 진입점 추가 시 누락되기
  쉬운" 구조적 특성을 갖고 있음 — 이번 라운드는 문제 없으나 유지보수 시 유의
  - 위치: `execution-engine.service.ts:540`(필드 선언 JSDoc), `:2664`-`:2670`, `:4540`-`:4544`,
    `:6945`-`:6951`
  - 상세: 세 지점 모두 정확한 위치에 있고 이번 diff 로 커버리지가 완결됐음을 위에서 실측했다. 다만
    이 Map 은 "종료 지점마다 수동으로 `delete` 를 챙겨야 하는" 열거형 정리 방식이라, 향후 새로운
    execution 세그먼트 진입점(예: 새로운 종류의 재개/재배달 경로)이 추가되면서 `runNodeDispatchLoop`
    를 새로 호출하는 코드가 생기면 그 진입점도 동일하게 자신의 `finally` 에 delete 를 추가해야
    한다 — 이번 W14 결함 자체가 그 실패 모드의 실제 사례였다. 코드 결함은 아니고 즉시 조치가
    필요하지도 않으나, 다음 신규 진입점 추가 PR 에서 리뷰어가 다시 챙겨야 할 체크리스트 항목으로
    남긴다.
  - 제안: 필수 아님. 참고용 기록.

## 요약

직전 라운드가 WARNING 으로 지적한 W14(`containerCancelCheckedAtMs` 가 `executeBackgroundSubgraph`
경로에서 정리되지 않아 무제한 누수)는 이번 커밋(`2ca6ada66`)이 그 함수의 `finally`(`:6951`)에
`this.containerCancelCheckedAtMs.delete(job.executionId)` 를 추가하며 완전히 해소됐다. Map 에
항목을 만들 수 있는 모든 콜체인(`executeContainerBody` → `runNodeDispatchLoop` → 5개 top-level
진입점)을 역추적한 결과, 이제 정리 지점 3곳(`:2670`·`:4544`·`:6951`)이 그 5개 진입점 전체를 정확히
커버한다 — 빠진 종료 경로는 없다. Background 가 부모와 `executionId` 를 공유하는 데서 오는 부모/자식
delete 순서 상호작용도 분석했으며, 어느 쪽이 먼저 지우든 최종적으로는 항상 키가 제거되는 방향으로
수렴하고(둘 다 idempotent finally 로 정리), 유일한 부작용은 상대가 먼저 지운 직후 1회의 스로틀 캐시
미스(추가 DB 조회 1회)뿐이라 correctness 문제가 없다. 직접 `:6951` 의 delete 를 mutate-out 해 W14
회귀 테스트가 RED 로 떨어짐을 실측 확인했고, 원복 후 전체 스펙 419/419 GREEN 도 재확인했다. 이번
diff 에 포함된 W15(Sub-Workflow cancel 재분류)·W16(retry-turn error 노출 가드)·W17(스로틀 테스트
Date.now 결정화)·W18(회귀 테스트 추가)은 모두 동기적 분기 추가이거나 테스트 전용 변경이라 새로운
동시성 위험을 만들지 않는다. 남은 것은 "정리 지점이 수동 열거형이라 향후 신규 진입점에서 다시
누락될 수 있다"는 구조적 INFO 뿐이며 즉시 조치가 필요한 항목은 없다.

## 위험도

NONE
