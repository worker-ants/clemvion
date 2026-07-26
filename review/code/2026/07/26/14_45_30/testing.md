# 테스트(Testing) 리뷰 — linear-cancel-mechanism (4R, W15/W17/W18 직접 실측 검증)

본 라운드의 지시대로 재론(C1~C5·W1~W13)은 하지 않는다. 직전 라운드(`13_47_42`)에서 내가 낸 **W18**
(스로틀 Map 정리 커버리지 0)과 requirement 가 낸 **W17**(W10 스로틀 테스트 wall-clock flaky), 그리고
W15(Sub-Workflow 재throw 회귀 테스트 유무)가 이번 조치 커밋(`2ca6ada66` — SUMMARY W14-W18 처리)으로
실제 해소됐는지 코드·테스트를 직접 열어 mutation(`cp` 백업 → 삭제 → RED 확인 → `cp` 원복, `git
checkout` 미사용) 및 반복 실행으로 실측했다.

## 결론 요약

| 항목 | 주장 | 실측 결과 |
|---|---|---|
| W18 (Map 정리, background 경로) | `executeBackgroundSubgraph` finally 에 `delete` 추가 | **해소 확인** — mutation RED |
| W18 (Map 정리, 정상 종결 경로) | 신규 회귀 테스트로 커버리지 0 해소 | **해소 확인** — mutation RED |
| W18 (LoopExecutor 대칭 테스트) | 신규 추가 | **해소 확인** — 존재·통과 |
| W17 (W10 스로틀 테스트 flaky) | `Date.now` spy 로 결정화 | **해소 확인**(해당 테스트 자체) — 단, 아래 신규 발견 참조 |
| W15 (Sub-Workflow 재throw) | 신규 회귀 테스트 | **해소 확인** — mutation RED |
| (부수) W16 (retry-turn cancel error 비노출) | 신규 대조 테스트 | **해소 확인** — mutation RED |

세부 근거는 아래 발견사항 및 실측 로그 참조.

---

## (a) W18 — `containerCancelCheckedAtMs` 정리 커버리지, mutation 으로 3곳 모두 확인

### a-1. Background 경로 (신규 `executeBackgroundSubgraph` finally delete)

- 프로덕션: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:6951`
  (`this.containerCancelCheckedAtMs.delete(job.executionId);`, `finally` 블록 마지막 줄, `:6941-6952`)
- 테스트: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:3747-3764`
  (`it('cleans up containerCancelCheckedAtMs for the shared executionId in finally (W14 background
  leak regression)', ...)`)
- 실측: `:6951` 줄을 `// MUTATED-OUT: ...` 으로 주석 처리 → 해당 테스트 단독 실행 시 **RED**
  (`Expected: false, Received: true`). `cp` 백업으로 원복 후 재실행 **GREEN**, `git status --short`
  로 소스 파일 변경 없음 확인.
- 판정: **해소 확인**. 이 테스트는 실제로 결함을 잡는다.

### a-2. 정상 종결 경로 (`runExecution` finally delete)

- 프로덕션: `execution-engine.service.ts:4544` (`this.containerCancelCheckedAtMs.delete(executionId);`)
- 테스트: `execution-engine.service.spec.ts:10397-10461`
  (`it('실행이 정상 종결되면 containerCancelCheckedAtMs 에서 executionId 키가 제거된다 (W18)', ...)`)
- 실측: `:4544` 를 주석 처리 → **RED**(`Expected: false, Received: true`). `cp` 원복 후 **GREEN**
  재확인.
- 판정: **해소 확인**. 직전 라운드에서 "두 delete 를 모두 제거해도 415/415 GREEN"이라 지적했던
  커버리지 0 이 두 경로 모두에서 실제로 닫혔다.

### a-3. LoopExecutor 대칭 테스트

- 테스트: `execution-engine.service.spec.ts:10468-10557`
  (`it('노드 경계가 아니라 반복 경계에서 외부 cancel 을 관측하면 남은 Loop 반복은 dispatch 되지
  않는다 (W18 — LoopExecutor 대칭)', ...)`)
- ForEach(C3)/Parallel(C5) 과 대칭으로 Loop 컨테이너에도 "iteration 경계에서 외부 cancel 관측 시
  남은 iteration 미실행"을 직접 단언 — 직전 라운드가 "전용 spec 파일도 없고 회귀 테스트도 없다"고
  지적한 갭이 닫혔다. `Date.now` spy 로 스로틀 창을 결정적으로 넘긴다(C3/W9 패턴과 동일).
- 판정: **해소 확인**(mutation 은 별도로 돌리지 않았으나 코드 구조가 C3/W9 와 대칭이고 assertion 이
  구체적 — `bodyCalls).toBe(1)` 등).

---

## (b) W17 — W10 스로틀 회귀 테스트의 결정성

- 대상: `execution-engine.service.spec.ts:10308-10388`
  (`it('짧은 간격 내 아이템 경계 반복은 실제 DB 조회를 1회로 스로틀한다 (W10)', ...)`)
- 수정 확인: `:10316-10319` 에서 `const simulatedNow = Date.now(); const nowSpy =
  jest.spyOn(Date, 'now').mockImplementation(() => simulatedNow);` 로 **시간을 전혀 전진시키지
  않는 고정값**을 반환하도록 바뀌었다(자매 C3/W9 테스트가 "0→1 경계에서 +300 으로 창을 넘기는" 패턴과
  달리, 이 테스트는 반대로 "끝까지 창 안에 머물러야" 하므로 아예 고정이 맞는 설계).
- 반복 실행: 해당 테스트만 단독으로 **15회 반복** 전부 GREEN. 이후 파일 전체(419 tests)를
  **총 64회** 반복 실행하는 동안 이 테스트가 실패한 사례는 **0건**(아래 (신규 발견) 참조 — 같은
  64회 중 실패 2건은 모두 *다른* 테스트였다).
- 판정: **W17 이 지목한 그 테스트는 결정적으로 고쳐졌다.** wall-clock 의존이 제거됐고, 실측상
  flake 가 재현되지 않는다.

### [WARNING] (신규 발견) — 같은 파일 전체 실행 시 여전히 낮은 빈도(~3%)로 *다른* 신규 테스트가 flake 한다. W17 은 지목된 그 테스트만 좁게 고쳤을 뿐, 파일 수준의 real-timer 교차오염 구조 자체는 남아 있다

- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` 파일
  전체(419 tests) 반복 실행. 관측된 개별 실패 지점은 `:3762`
  (`expect(priv().containerCancelCheckedAtMs.has(executionId)).toBe(false);`, W14 background
  leak 회귀 테스트)와 `:5774`
  (`expect(ne?.status).not.toBe(NodeExecutionStatus.FAILED);`, W15 Sub-Workflow 회귀 테스트) 두
  곳 — 서로 다른 실행 회차에서 각각 1회씩.
- 상세: 파일 전체를 순차로 **64회** 반복 실행한 결과 **2회 실패**(실패율 ≈3.1%). 두 실패 모두 위
  (a)/(c) 에서 mutation 으로 결함 탐지력을 확인한 **정상 코드 상태**에서 발생했다 — 즉 프로덕션
  로직 결함이 아니라 **테스트 격리 실패**(순수 flake)다. 두 번 모두 실패한 테스트 자체는
  `Date.now` 를 건드리지 않으므로(W14 테스트는 spy 자체가 없고, W15 테스트는 `Date` 를 전혀
  참조하지 않는 `mockRejectedValue`/`mockOutput` 기반 동기 흐름) W17 이 고친 메커니즘(wall-clock
  스로틀 창)과는 무관하다 — **W17 의 fix 범위 밖에서 같은 "대형 단일 spec 파일 + 실제 타이머
  혼재" 구조가 여전히 산발적 flake 를 만들어낸다**는 뜻이다.
  실제로 이 파일에는 이미 훨씬 이전 라운드부터 알려진 real-timer 의존 헬퍼가 존재한다 —
  `flushResumeDrive`(`:101-103`, `return new Promise((resolve) => setTimeout(resolve, ms));`,
  기본 200ms)는 실제 `setTimeout` 을 쓰며, 파일 내 기존 주석(`:8054-8055`, "W15(ai-review) —
  flushResumeDrive(200ms) × 다수(button×22·인터리빙 등) 누적이 jest 기본 5s 타임아웃에 근접해 CI
  고부하 시 flaky → 본 파일 타임아웃 상향")이 스스로 "CI 고부하 시 flaky" 위험을 명시하고, 그 이전
  라운드(W13)에 지연을 40ms→200ms 로 올린 이력까지 남아 있다. 이번에 관측한 두 실패는 이 기존
  real-timer 잔여 위험이 이번 라운드가 새로 추가한 테스트(W14/W15)의 실행 창에 우연히 겹친
  결과일 가능성이 높다(419개 테스트가 한 파일에서 순차 실행되며 총 실행 시간이 8~9초에 달하고,
  본 실측처럼 여러 jest 프로세스를 반복/병행 실행하면 시스템 부하가 커져 그 창이 넓어진다).
  두 실패 모두 **단독 실행(`-t` 로 해당 테스트만)** 시에는 재현되지 않았다 — 즉 이 테스트들
  자체는 결정적이고, "커다란 파일을 통째로 반복 실행"할 때만 낮은 확률로 드러나는 교차오염이다.
  이는 정확히 requirement.md 가 W17 에서 지적한 것과 같은 클래스의 문제(대형 spec 파일 +
  wall-clock)가, 그 특정 테스트 하나만 고쳐진 뒤에도 파일 전체 수준에서는 근본적으로 해소되지
  않았다는 실증이다.
- 제안: 필수 차단 사유는 아니다(정확히 3% 내외, 프로덕션 로직 결함 아님, mutation 결함 탐지력은
  정상). 다만 다음 중 하나를 권장한다 — (1) `flushResumeDrive` 를 쓰는 테스트들을 `jest.useFakeTimers()`
  기반으로 전환해 real timer 의존 자체를 제거, (2) 이 스펙 파일(현재 419 tests, 1만7천+ 줄)을
  describe 단위로 여러 파일로 분리해 교차오염 표면을 줄임, (3) 최소한 CI 에서 이 파일에 대해
  `--testRetries`/재시도 정책을 명시적으로 문서화. 지금 당장은 아니어도 향후 CI 안정성 이슈로
  재부상할 가능성이 있어 WARNING 으로 기록한다.

---

## (c) W15 — Sub-Workflow(workflow) 노드 재throw 회귀 테스트

- 프로덕션: `execution-engine.service.ts:5812-5814`
  (`if (err instanceof ExecutionCancelledError) { throw err; }`, `executeNode` 의 generic catch,
  `ParkReleaseSignal` 우회(`:5801-5803`) 바로 다음, errorPolicy 적용(`:5817-`) 이전)
- 테스트: `execution-engine.service.spec.ts:5745-5790`
  (`it('Sub-Workflow(workflow) 노드에서 ExecutionCancelledError 가 발생하면 FAILED 로 오분류하거나
  NODE_FAILED 를 emit 하지 않는다 (W15)', ...)`) — NodeExecution 상태가 FAILED 아님, handler 가
  1회만 호출됨(errorPolicy 재시도 없음), `NODE_FAILED` 미emit, Execution 은 `cancelled` 로 마감
  4가지를 모두 단언한다.
- 실측: `:5812-5814` 가드를 주석 처리 → **RED**(`Expected: not "failed", Received: "failed"`).
  `cp` 원복 후 **GREEN** 재확인, `git status --short` 로 소스 무변경 확인.
- 판정: **회귀 테스트 존재하고 실제로 결함을 잡는다.**

### (부수 확인, 시간 허용 범위 내) W16 — RetryTurnService 취소 시 `execution.error` 비노출

- 프로덕션: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:641-654`
  (`isCancelled` 판정 재사용, `if (!isCancelled) { execution.error = ... }`)
- 테스트: `retry-turn.service.spec.ts:476-501`(취소 케이스 — `execution.error` 가 `undefined`)과
  `:504-520`(대조군 — 일반 Error 는 `execution.error` 가 그대로 채워짐) 양쪽을 대칭 검증.
- 실측: `if (!isCancelled) {...}` 가드를 제거하고 무조건 대입으로 mutation → 취소 케이스 테스트가
  **RED**(`Expected: undefined, Received: {"message": "Execution cancelled..."}）. `cp` 원복 후
  20/20 GREEN 재확인.
- 판정: **해소 확인**. 대조군 테스트까지 있어 "취소가 아닌 일반 실패는 기존과 동일하게 저장돼야
  한다"는 반대 방향 회귀도 함께 고정돼 있다.

---

## 그 외 관찰 (참고, 블로킹 아님)

- **[INFO]** 신규 `nowSpy` 사용 테스트(LoopExecutor W18 대칭, `:10556`)도 기존에 이미 INFO 로
  지적된 관행(try/finally 대신 trailing `nowSpy.mockRestore()`)을 그대로 따른다 — 직전 라운드에서
  이미 "실측상 현재 무해"로 판정된 것과 동일 클래스이므로 재차 격상하지 않는다.
- W14 테스트(`:3747-3764`)는 `Date.now` 를 스파이하지 않고 실제 `Date.now()` 값을 한 번만 읽어
  Map 에 심는다 — 시간 자체를 검증 대상으로 삼지 않으므로(정리 여부만 확인) 이 부분은 설계상
  적절하다.
- W15/W16/W18 신규 테스트 모두 mock 사용이 "실제 인스턴스 필드를 `as unknown as {...}` 캐스팅해
  직접 조회"하는 이 파일의 기존 관행을 그대로 재사용해 새로운 mock 패턴을 추가하지 않았다 —
  가독성·일관성 측면에서 양호.

## 요약

이번 라운드가 지시한 3가지 직접 실측 대상은 모두 실제로 해소됐다: (a) W18 스로틀 Map 정리는
background 경로·정상 종결 경로 두 곳 모두 신규 회귀 테스트가 mutation 으로 결함을 잡는 것을
확인했고 LoopExecutor 대칭 테스트도 추가됐다. (b) W17 이 지목한 W10 스로틀 테스트는 `Date.now`
spy 로 완전히 결정화돼 15회 단독 반복 + 64회 전체 파일 반복에서 단 한 번도 실패하지 않았다. (c)
W15 Sub-Workflow 재throw 에는 4가지 단언을 갖춘 회귀 테스트가 있고 mutation 으로 결함 탐지력을
확인했다(부수로 W16 도 대조군까지 갖춘 회귀 테스트로 확인). 다만 이 과정에서 **W17 의 fix 범위
밖에서 파일 전체 수준의 real-timer 교차오염이 여전히 낮은 확률(64회 중 2회, ≈3%)로 남아 있음을
새로 발견**했다 — 이번엔 W10 테스트가 아니라 이번 라운드가 새로 추가한 W14/W15 테스트가
번갈아 flake 했고, 두 테스트 모두 단독 실행 시에는 결정적이었다. 프로덕션 로직 결함이 아니라 이
파일이 오래전부터 안고 있던 real-timer(`flushResumeDrive` 등) 구조적 위험의 재발현으로 보이며,
즉시 차단 사유는 아니지만 CI 안정성 관점에서 WARNING 으로 기록해 후속 조치(fake timer 전환 또는
파일 분리)를 권장한다.

## 위험도

LOW
