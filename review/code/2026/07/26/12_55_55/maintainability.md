# Maintainability Review — node-cancellation §2.3 가드 확산 (2026-07-26 12:55:55)

## 발견사항

- **[WARNING]** 취소 종결 로직(guarded UPDATE + emit) 8줄 블록이 두 catch 에 거의 동일하게 복제됨
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2625-2637`(`finalizeResumedExecutionOutcome`) / 동일 파일 `:4525-4537`(`runExecution` catch)
  - 상세: 두 사이트 모두
    ```
    savedExecution.finishedAt = savedExecution.finishedAt ?? new Date();
    savedExecution.durationMs = savedExecution.durationMs ?? (...)
    await this.updateExecutionStatus(savedExecution, ExecutionStatus.CANCELLED);
    await this.emitCancellationEvent(executionId, { cancelledBy: 'user', logContext: '...' });
    ```
    을 `logContext` 문자열 한 값만 바꾼 채 손으로 복제했다. 이 로직을 감싸는 설명 주석도 각각 8~14줄(`:2620-2624`, `:4510-4523`)로 따로 붙어 있어, 이 불변식("stop 이 쓴 finishedAt/durationMs 를 재마킹하지 않는다")이 바뀌면 두 군데를 손으로 동기화해야 한다. 이 로직은 이번 PR(C4)이 신규 도입한 것이라 "기존 부채의 재노출"이 아니라 새로 만든 중복이다.
  - 제안: `finalizeCancelledExecution(savedExecution, logContext)` 같은 private 헬퍼로 뽑아 두 catch 가 호출만 하도록 정리. 세 번째 취소 종결 지점이 나중에 추가될 가능성을 고려하면 지금 추출하는 비용이 가장 싸다.

- **[INFO]** 가드 시퀀스 비대칭(`assertActiveTimeWithinLimit` 2곳 vs `assertExecutionNotCancelled` 5곳)이 코드만 봐서는 설명되지 않음
  - 위치: `execution-engine.service.ts:1636`/`:1638`(`runNodeDispatchLoop`), `:4266`/`:4268`(`runExecution`) — 이 두 곳은 두 가드가 나란히 붙음. 반면 `:6480`(`executeContainerBody`)·`:7120`(`executeParallelBranchBody`)엔 `assertExecutionNotCancelled` 만 있고 `assertActiveTimeWithinLimit` 호출이 없음
  - 상세: `RESOLUTION.md`(`review/code/2026/07/26/11_48_55/RESOLUTION.md` "보류·후속 항목")가 이 비대칭을 "본 세션에서 미확인"으로 이미 자체 기록해뒀지만, 소스 코드 자체에는 그 사실이 드러나지 않는다. 다음에 코드만 보는 사람(향후 리뷰어 포함)은 실수로 빠뜨린 것인지 의도적 설계인지 판단할 근거가 없어 동일한 의문을 다시 조사하게 될 수 있다.
  - 제안: 최소한 두 컨테이너 가드 호출부 옆에 "`assertActiveTimeWithinLimit` 는 아직 여기 없음(추적: W8)" 한 줄만 남겨도 향후 재조사 비용을 없앤다. 급하지 않음 — 팀이 이미 백로그로 인지 중.

- **[INFO]** e2e 신규 대기 코드의 매직 넘버가 파일 자체 명명 상수 관행과 불일치(직전 라운드에서도 지적됐고 미해결로 남음)
  - 위치: `codebase/backend/test/node-cancellation-propagation.e2e-spec.ts` — 신규 `await new Promise((r) => setTimeout(r, 2_000));` (파일 상단엔 `const INFLIGHT_WINDOW_MS = 5_000;` 명명 상수 관행이 이미 있음, `:77`)
  - 상세: `review/code/2026/07/26/11_48_55/SUMMARY.md` INFO 항목에서 이미 동일하게 지적됐고("매직 넘버가 파일의 명명 상수 관행을 따르지 않음") 이번 라운드에도 그대로 남아 있다. flaky 위험은 낮다고 이미 평가됐으므로 차단 사유는 아니다.
  - 제안: `SETTLE_WINDOW_MS` 같은 이름으로 상수화. 우선순위 낮음.

## 가드 확산(5곳 호출 + 2곳 재throw) 판단

과업에서 명시적으로 요청한 항목이라 별도로 답한다. **현재 형태는 수용 가능하며, 지금 시점에 헬퍼로 묶을 필요는 없다고 판단한다.**

근거:
1. **호출부 자체는 1줄이고 이미 추출돼 있다.** `assertExecutionNotCancelled()`는 잘 문서화된 단일 private 메서드(`:7847-7861`, JSDoc `:7819-7846`)이고, 5개 호출부는 각각 `await this.assertExecutionNotCancelled(executionId);` 한 줄 + 그 경계에서 왜 필요한지 설명하는 2~6줄 주석이다. 이는 `assertActiveTimeWithinLimit` 호출 패턴 및 저장소 전역에서 이미 5~6회 반복되는 `if (err instanceof ParkReleaseSignal) { ... }` sentinel-재throw 관행과 스타일이 일치한다 — 새로운 패턴을 도입한 것이 아니라 **기존 컨벤션을 그대로 따른 것**이다.
2. **5곳처럼 보이지만 실질 삽입 지점은 4개 개념 단위다.** ForEach/Loop/Map 세 컨테이너 타입이 각자 가드를 심을 필요 없이 공유 진입점 `executeContainerBody` 한 곳에만 얹었다(`loop-executor.ts` 는 코드 변경 없이 "왜 불필요한지" 설명 주석만 추가한 것이 그 증거). 컨테이너 종류가 늘어도 가드 호출부가 늘지 않는 구조라, N-타입 반복 삽입의 함정을 이미 피했다.
3. **재throw 2곳(`workflow.handler.ts`, `foreach-executor.ts`)은 각기 다른 문제를 푼다.** 하나는 예외 흡수(catch-and-convert-to-port) 무력화 방지, 다른 하나는 `errorPolicy` 우회다. 두 로직을 하나의 공용 헬퍼로 합치면 오히려 각 사이트의 의도(무엇을 무엇으로부터 지키는지)가 흐려진다 — 얇은 wrapper 로 묶어도 실질적으로 줄어드는 코드가 없다.
4. **팀 스스로 이미 "지금 통합하지 않는다"를 명시적으로 결정해뒀다**(`RESOLUTION.md` W8: "전면 통합은 과거 엔진 재작성급 고위험으로 기각된 범위 — 가드 시퀀스 헬퍼 승격은 중간 크기 후속 작업으로 백로그"). 8000줄 넘는 단일 서비스 파일에서 진행 중인 취소 버그 수정 PR 안에 구조적 리팩토링까지 얹는 것은 diff 를 더 위험하게 만들 뿐이며, 이 프로젝트에서 유사 사례(cafe24/makeshop 미러 dedup)도 "의도된 중복 유지"로 결론난 전례가 있다.
5. 다만 실제로 값이 있는 곳은 **로직 복제**(위 WARNING — C4 의 8줄 종결 블록)다. "호출 한 줄"의 반복은 저렴하지만 "분기+계산+두 번의 async 호출"의 반복은 다음 사람이 한쪽만 고치고 다른 쪽을 놓칠 실제 위험이 있다. 그 지점만 지금 추출하고, 가드 호출부 자체의 통합은 팀 결정대로 백로그로 두는 것이 맞는 절충이다.

## 요약

이번 변경은 취소 전파 결함(§2.3)을 5개 지점으로 확장하고 2개 재throw를 추가했지만, 새 삽입은 대부분 기존 컨벤션(`assert*` 헬퍼 패턴, `ParkReleaseSignal` sentinel 재throw 관행)을 그대로 따르는 저비용 1줄 호출이라 가독성·중첩·복잡도 문제를 일으키지 않는다. 헬퍼 `assertExecutionNotCancelled()` 자체는 이름·길이·문서화 모두 양호하고, `ForEachExecutor` 회귀 테스트는 `describe.each` 로 정책 3종을 파라미터화해 불필요한 반복을 피했다. 유일하게 실질적인 신규 중복은 C4가 도입한 취소-종결(guarded UPDATE + emit) 8줄 블록이 두 catch에 손으로 복제된 것으로, 지금 헬퍼로 뽑는 편이 저렴하다(WARNING). 나머지는 팀이 이미 인지·추적 중인 저위험 항목(가드 시퀀스 비대칭, e2e 매직 넘버)이라 참고용 INFO로만 남긴다. "5곳+2곳 확산이 헬퍼로 묶여야 할 시점인가"라는 질문에는 — 호출부 자체는 아직 통합 임계값에 도달하지 않았고 컨테이너 타입 증가에도 호출부가 늘지 않는 구조라는 점에서 아니오로 판단한다.

## 위험도

LOW
