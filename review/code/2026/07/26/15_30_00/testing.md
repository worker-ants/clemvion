# 테스트(Testing) 리뷰 — linear-cancel-mechanism (5R, W19·W20 mutation 독립 재검증)

본 라운드 최우선 지시: 커밋 `0f4047426`("W19·W20 fix + '직전 테스트 2건이 vacuous 했다' 자백")의
mutation 주장 2건을 `cp` 백업(→ 뮤테이션 → RED 확인 → `cp` 원복, `git checkout` 미사용)으로 직접
재실측하고, 이번에 고친 두 테스트가 또 다른 방식으로 vacuous 하지 않은지 의심 검증한다.

## 0. 선행 발견 — 이번 라운드 프롬프트에 실제 소스 diff 가 누락돼 있다 (harness gap)

- **[WARNING]** `_prompts/testing.md` 가 참조하는 파일 목록(`review/code/2026/07/26/15_30_00/meta.json`)이
  이번 커밋(`0f4047426`)의 review 아티팩트(`review/code/2026/07/26/{13_47_42,14_45_30}/*.md`)만
  포함하고, **정작 그 커밋이 바꾼 실제 소스 3파일 — `CHANGELOG.md`, `execution-engine.service.ts`
  (+49/-8), `execution-engine.service.spec.ts`(+81) — 은 목록에 전혀 없다.**
  - 위치: `review/code/2026/07/26/15_30_00/meta.json`, `review/code/2026/07/26/15_30_00/_routing_decision.json`
  - 상세: `git show --stat 0f4047426` 로 직접 대조한 결과, 이 커밋은 소스 3파일 + `review/code/.../14_45_30/*`
    16개 파일을 바꿨다. 그런데 이번 라운드 `meta.json`(`files[]`)에는 `13_47_42/*`·`14_45_30/*` 의
    review 문서만 있고 소스 파일은 없다 — 즉 프롬프트만 보고 작업했다면 **이번 라운드의 핵심 검증
    대상(W19/W20 코드·테스트 자체)을 단 한 줄도 볼 수 없는 상태**였다. 라우터의
    `_routing_decision.json` 은 testing 을 "vacuous 단언 2건을 고쳤다고 주장하므로 mutation 독립
    재검증 필요"라는 이유로 강제 선택했으면서, 그 검증에 필요한 소스 diff 를 프롬프트 조립
    단계에서 누락시킨 셈 — 프로세스 자기모순이다. 오케스트레이터의 이번 턴 지시(직접 `Read`/`git
    show`/`cp` 뮤테이션 수행)가 이를 우회하도록 명시적으로 보완했기 때문에 실질 검증은 아래처럼
    수행했지만, 이 지시가 없었다면(표준 파이프라인 단독 실행) 이번 라운드는 실제 코드를 전혀 보지
    못한 채 "review-of-reviews" 만 검토하고 통과시켰을 위험이 있다.
  - 제안: diff-list 조립 스크립트가 이번 라운드처럼 "직전 라운드 산출물 커밋 + 코드 fix 커밋"이
    한 커밋에 같이 들어간 경우에도 코드 파일을 누락하지 않는지 점검. 코드 리뷰 결과 자체(Critical 0,
    아래 참조)에는 영향 없으나 파이프라인 신뢰도 문제로 별도 기록 권장.

## 1. (a) W19 — `nodeExecution.status = CANCELLED` 마킹 mutation 재실측

- 대상 코드: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:5822-5845`
  (`executeNode` catch 의 `if (err instanceof ExecutionCancelledError) { ... }` 블록), 마킹 라인은
  `:5823`(`nodeExecution.status = NodeExecutionStatus.CANCELLED;`).
- 대상 테스트: `execution-engine.service.spec.ts:5745-5814`
  (`Sub-Workflow(workflow) 노드에서 ExecutionCancelledError 가 발생하면 FAILED 로 오분류하거나
  NODE_FAILED 를 emit 하지 않는다 (W15)`), 핵심 단언 `:5780`(`expect(ne?.status).toBe(NodeExecutionStatus.CANCELLED)`).
- 절차: `cp` 로 `execution-engine.service.ts` 백업 → `:5823` 한 줄만
  `// MUTATED-OUT: nodeExecution.status = NodeExecutionStatus.CANCELLED;` 로 치환(다른 줄은 그대로
  유지 — `finishedAt`/`durationMs`/`save`/`emitNode`/`throw err` 는 살아있음) → 대상 테스트 단독
  실행 → `cp` 원복 → `git diff --stat` 로 무변경 확인.
- 실측 결과: **RED 재현, 주장과 문자 그대로 일치.**
  ```
  Expected: "cancelled"
  Received: "running"
  ```
  원복 후 동일 테스트 재실행 GREEN 확인.
- 판정: **RESOLUTION.md 의 W19 mutation 주장(a) 확인 — 참.**

## 2. (b) W20 — `executeWithRetry` 재시도 제외 조건 mutation 재실측

- 대상 코드: `execution-engine.service.ts:6187`
  (`if (isAbortError(lastError) || err instanceof ExecutionCancelledError) { throw lastError; }`).
- 대상 테스트: `execution-engine.service.spec.ts:5820-5867`
  (`errorPolicy:retry 노드에서도 ExecutionCancelledError 는 재시도하지 않고 즉시 전파한다 (4R)`),
  핵심 단언 `:5866`(`expect(executeImpl).toHaveBeenCalledTimes(1)`).
- 절차: `cp` 백업 → `:6187` 을 `if (isAbortError(lastError)) {` 로 치환(정확히 `|| err instanceof
  ExecutionCancelledError` 만 제거) → 대상 테스트 단독 실행 → `cp` 원복 → `git diff --stat` 무변경
  확인.
- 실측 결과: **RED 재현, 주장과 문자 그대로 일치.**
  ```
  Expected number of calls: 1
  Received number of calls: 4
  ```
  원복 후 GREEN 재확인. 두 테스트를 함께(`-t "W15|errorPolicy:retry 노드에서도"`) 재실행해도
  최종 상태는 2/2 GREEN.
- 판정: **RESOLUTION.md 의 W20 mutation 주장(b) 확인 — 참.**

두 mutation 모두 RESOLUTION.md/커밋 메시지가 제시한 정확한 실패 시그니처(`Received: "running"`,
`Received number of calls: 4`)와 **자릿수 하나 틀리지 않고 일치**했다. 조작은 커밋이 실제로 바꾼
그 줄만 정밀 타격했고(블록 전체 삭제 같은 거친 뮤테이션 아님), 이는 직전 라운드
(`14_45_30/testing.md`)가 스스로 지적했던 함정 — "블록 전체를 지우는 거친 뮤테이션은 더 좁은
실제 결함(부분 구현)을 놓칠 수 있다" — 을 피하기 위해 의도적으로 그렇게 했다.

## 3. 두 테스트의 "또 다른 방식" vacuousness 의심 검증

지시대로 이 브랜치에서 이미 3회 나온 vacuous 패턴(① 구 W15 `not.toBe(FAILED)` — RUNNING 인 채로도
참, ② 신 W20 테스트의 1차 초안 — `retryConfig` 를 평면 위치에 둬 재시도 루프 자체에 미진입, ③ 신
W20 테스트의 2차 초안 — 재시도가 `sleep` 을 낀 detached 실행인데 타이머를 흘리지 않고 단언)과
**다른 결을 가진 잔여 취약점**이 있는지 별도로 점검했다.

- **재확인**: 위 §1/§2 실측 결과 두 테스트 모두 커밋이 주장한 정확한 결함 클래스를 정밀하게
  잡는다. 새로운 vacuous 패턴(④)은 발견되지 않았다.
- **[INFO] W19 테스트의 emit 단언이 `expect.objectContaining` 부분 매치라 payload 의 나머지
  필드(오분류/누락) 는 검증하지 못한다**
  - 위치: `execution-engine.service.spec.ts:5783-5788`
    (`toHaveBeenCalledWith(..., expect.objectContaining({ status: 'cancelled' }))`)
  - 상세: 실제 payload(`execution-engine.service.ts:5833-5842`)는 `nodeExecutionId` /
    `parentNodeExecutionId` / `nodeType` / `nodeLabel` / `input` / `startedAt` / `finishedAt` 7개
    필드를 담지만, 테스트는 `status` 한 필드만 부분 매치한다. 예컨대 `parentNodeExecutionId` 에
    잘못된 값을 넣거나 `nodeType` 을 하드코드해도 이 assertion 은 여전히 통과한다. 실질 영향은
    낮다(프론트 타임라인은 주로 `status`/`finishedAt` 을 소비하고, 그 두 필드는 위에서 별도로
    양성 검증됨) — 필수 개선 아님.
  - 제안: 여유가 되면 `objectContaining` 을 `{status, nodeExecutionId, nodeType, ...}` 전체
    필드로 확장하면 완전성이 높아진다.
- **[INFO] `errorPolicy:retry` 노드에서 취소 시 `NodeExecution` 이 실제로 CANCELLED 로 마감되는지는
  end-to-end 로 직접 단언되지 않는다 — W19 안전망에 암묵적으로 의존**
  - 위치: `execution-engine.service.spec.ts:5820-5867`
    (`errorPolicy:retry 노드에서도 ExecutionCancelledError 는 재시도하지 않고 즉시 전파한다 (4R)`)
  - 상세: 이 테스트는 `executeImpl` 호출 횟수(=1)만 확인한다. `executeWithRetry` 가 예외를
    재throw 한 뒤(`:6187`) 그것이 `executeNode` 의 바깥 catch(`:5822`, W19 로 CANCELLED 마킹)로
    올라가 최종적으로 `nodeExecution.status` 가 CANCELLED 로 마감되는지는 이 테스트에서 직접
    확인하지 않는다 — 같은 catch 블록을 공유하므로 §1 의 W19 테스트가 그 마킹 로직 자체를
    독립적으로 검증하긴 하지만, "retry 정책이 붙은 노드"라는 조합 조건에서도 동일하게 동작함을
    보장하는 조합 테스트는 없다. `errorHandling.policy` 분기가 `executeNode` catch 진입 이전
    단계(`executeWithRetry` 내부)에만 있고 catch 자체는 정책과 무관하게 공유되므로 실무적 위험은
    낮지만, "재시도 정책 노드가 취소되면 최종적으로 cancelled 로 마감된다"는 명제 자체를 하나의
    테스트로 닫아 두면 향후 두 로직(재시도 제외 판정 vs CANCELLED 마킹)이 분리 리팩터링될 때
    회귀를 더 빨리 잡을 수 있다.
  - 제안: §1 테스트처럼 `errorPolicy:retry` 노드에도 `expect(ne?.status).toBe(NodeExecutionStatus.CANCELLED)`
    단언을 추가(또는 §1 테스트의 노드에 retry 설정을 추가하는 파라미터화)를 권장. 필수 차단
    사유는 아님.
- **[INFO] W19 시나리오(Sub-Workflow `type:'workflow'` 노드 취소)는 unit 뿐 e2e 커버리지가 없다**
  - 위치: `codebase/backend/test/node-cancellation-propagation.e2e-spec.ts:121-333`
    (`createTwoStepWorkflow` — `type: 'code'` busy-wait 노드 사용)
  - 상세: 이 파일의 `진행 중 노드가 있는 실행을 stop 하면...` e2e 는 `code` 타입 노드로 in-flight
    취소를 검증하며 `workflow`(Sub-Workflow) 타입 노드는 쓰지 않는다 — 즉 W19 가 고친 경로
    (`executeInline` 이 §2.3 가드로 관측한 `ExecutionCancelledError` 가 `executeNode` catch 로
    떨어지는 경로)를 실제 NestJS 앱 + 실제 DB 로 왕복 검증하는 e2e 는 없고, 유일한 안전망은
    mock 기반 unit 테스트(§1)다. `grep -rln "type: 'workflow'"` 결과 `test/` 아래 sub-workflow
    타입 노드를 쓰는 파일이 취소 시나리오와 무관한 다른 e2e 뿐임을 확인. mutation 으로 unit
    테스트의 결함 탐지력 자체는 확인됐으므로(§1) 즉각 위험은 낮으나, "영구 spinner" 라는 버그의
    실사용 증상이 프론트-백엔드 왕복 계약(WS emit → 프론트 소비)에 걸쳐 있는 만큼 e2e 한 건이
    있으면 신뢰도가 더 높아진다.
  - 제안: 필수는 아님(백로그 후보). 추가한다면 두 단계 Sub-Workflow(부모→자식) 를 만들고 자식이
    running 인 상태에서 stop 한 뒤 부모 `workflow` 노드의 `NodeExecution.status` 가 `cancelled` 로
    수렴하는지 확인하는 형태.

## 4. 회귀 스위트 상태 확인

- `npx jest execution-engine.service.spec.ts` 전체(420 tests) 1회 실행 — **420/420 통과**, 소요
  8.36s. 직전 라운드(`14_45_30/testing.md`)가 64회 반복에서 관측한 ~3% real-timer 교차오염
  flake(W23, 이미 이번 라운드 SUMMARY 에서 명시적으로 백로그 분리됨)는 이번 1회 실행에서는
  재현되지 않았다 — 별도 조치 대상 아님(재론하지 않음).
- §1/§2 mutation 각각 원복 후 대상 테스트만/두 테스트 합산 재실행 모두 GREEN, `git status --short`
  로 소스 파일 무변경(mutation 잔존 없음) 확인.

## 요약

지시받은 두 mutation 주장(RESOLUTION.md, W19/W20)을 `cp` 백업 기반으로 독립 재실측한 결과 **둘
다 사실이며, 주장된 실패 시그니처(`Received: "running"`, 호출 4회)와 정확히 일치**했다. 뮤테이션은
커밋이 실제로 바꾼 최소 단위(마킹 한 줄, 제외 조건 한 항)만 정밀 타격해 "거친 뮤테이션이 좁은
실결함을 가린다"는 이전 라운드의 자기 발견 함정도 피했다. 이번에 고친 두 테스트를 "또 다른 방식"
vacuousness 관점에서 추가 점검한 결과 새로운 vacuous 패턴(④)은 발견되지 않았고, 대신 세 건의
경미한 커버리지 갭(부분 매치 assertion, retry+cancel 조합의 최종 상태 미검증, Sub-Workflow 취소의
e2e 부재)을 INFO 로 기록했다 — 모두 블로킹 사유는 아니다. 가장 중요한 발견은 코드가 아니라
**프로세스**다: 이번 라운드의 프롬프트 파일 목록 자체가 검증 대상 소스 3파일을 누락하고 있어,
오케스트레이터의 명시적 우회 지시가 없었다면 이번 라운드의 핵심 임무(mutation 독립 재검증)를
프롬프트만으로는 수행할 수 없었을 것이다 — WARNING 으로 기록해 harness 조립 스크립트 점검을
권장한다.

## 위험도

LOW
