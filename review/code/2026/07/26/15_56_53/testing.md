# 테스트(Testing) 리뷰 — linear-cancel-mechanism (6R, W25 `markNodeCancelled` 추출 검증)

## 0. 대상 확정 (harness gap 주의사항 대응)

프롬프트(`_prompts/testing.md`)에 첨부된 diff-list 는 `review/code/2026/07/26/13_47_42/*.md`
(구 라운드 리뷰 산출물)만 포함하고 있어, 지시받은 실제 검증 대상(`markNodeCancelled` 추출)의 소스
diff 가 프롬프트 안에 없었다 — 이 브랜치에서 반복 관측된 harness 갭과 동일 클래스. `git log
--oneline -5` + `git show 410d913fe`(HEAD, `refactor(engine): 5R W25 — 노드 취소 종결 중복을
markNodeCancelled 로 추출`)로 실제 변경분을 직접 열어 검증했다. 이 커밋은
`codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 단 1개 소스 파일만
바꾼다(그 외는 이전 라운드 review 아티팩트 커밋). **`execution-engine.service.spec.ts` 는 이번
커밋에서 전혀 수정되지 않았다** — 즉 이번 추출은 기존 회귀 테스트 코드를 한 글자도 건드리지 않고
프로덕션 코드만 재구성한 순수 추출이다.

## 1. (a) 동작 보존 검증 — errorEnvelope 없는 호출부에서 `error` 키가 생기는지

소스 확인(`execution-engine.service.ts:4586-4615`, `markNodeCancelled`):

```ts
nodeExecution.status = NodeExecutionStatus.CANCELLED;
if (errorEnvelope) nodeExecution.error = errorEnvelope;      // :4594 — 조건부 대입
...
{
  ...
  ...(errorEnvelope ? { error: errorEnvelope } : {}),        // :4607 — 조건부 spread
  ...
}
```

두 지점 모두 `errorEnvelope` 가 `undefined` 인 `ExecutionCancelledError` 호출부(`executeNode`
catch, `err instanceof ExecutionCancelledError` 분기)에서는 `nodeExecution.error` 를 건드리지
않고, WS payload 에도 `error` 키 자체를 만들지 않는다 — **코드 자체는 커밋 메시지·주석의 주장과
정확히 일치**한다(정적 확인, 참).

**그러나 이 불변식을 구조적으로 검증하는 회귀 테스트가 없다** — 실측으로 확인(§3 참고). 기존
W15 테스트(`execution-engine.service.spec.ts:5745-5814`)는 `error` 키의 **부재**를 직접 검사하지
않고, 발행된 payload 를 `JSON.stringify` 한 뒤 특정 문자열(`'cancelled externally'`, sentinel
메시지 본문)이 없는지만 확인한다(`:5796-5798`). DB 엔티티 쪽도 `ne?.status`/`ne?.finishedAt` 만
양성 단언할 뿐 `ne?.error` 는 검사하지 않는다(`:5779-5781`). 이 텍스트-부분-매치 방식은 "그 특정
메시지가 새지 않는다"만 보장하고 "`error` 키 자체가 생기지 않는다"는 더 넓고 정확한 계약은
보장하지 않는다.

## 2. (b) 헬퍼 결속(binding) 실측 — `cp` 백업 + 라인별 뮤테이션

절차: `execution-engine.service.ts` 를 스크래치패드에 `cp` 로 백업(`git checkout` 미사용) →
`markNodeCancelled` 내부를 한 줄씩 sed/python 으로 치환 → 대상 테스트만
(`-t "W15|4R\)|node-cancellation"`, 4 tests: `classifies a handler-thrown AbortError...`/`Sub-
Workflow(workflow)...(W15)`/`errorPolicy:retry...(4R)`/기타 1건) 실행 → 결과 기록 → `cp` 로 원복
→ `diff -q`/`git status --short codebase/` 로 무변경 확인. 매 라운드마다 원복 완료 후 다음
뮤테이션 진행.

| # | 뮤테이션 위치 | 내용 | 결과 |
|---|---|---|---|
| 1 | `:4593` | `nodeExecution.status = CANCELLED` → `FAILED` | **RED** (2 failed) |
| 2 | `:4593` | 상태 대입 줄 자체를 주석 처리(제거) | **RED** — `Expected: "cancelled" / Received: "running"`, 커밋 메시지의 mutation 주장과 **자릿수까지 일치** |
| 3 | `:4599-4614` | `emitNode(...)` 호출 전체 제거 | **RED** (2 failed, `execution.node.cancelled` 미발행 확인) |
| 4 | `:4607` | 조건 반전 — envelope 있을 때 `error` 키를 **생략** | **RED** (`toHaveBeenCalledWith` 의 `error: objectContaining` 매치 실패) |
| 5 | `:4595` | `finishedAt = new Date()` → `finishedAt = startedAt`(durationMs=0으로 변형) | **GREEN** — 값 자체(0 vs 실제 경과)를 단언하는 테스트 없음. 낮은 위험(타이머 제어 없는 테스트의 일반적 한계) |
| 6 | `:4598` | `nodeExecutionRepository.save(nodeExecution)` 호출을 통째로 제거(상태 대입은 유지) | **GREEN** — 4 tests 전부 통과. **§4 에서 원인 분석** |
| 7 | `:4594` | `if (errorEnvelope) nodeExecution.error = ...` → `nodeExecution.error = errorEnvelope ?? { code: 'INTERNAL', message: 'db-leaked-detail' }`(envelope 없을 때 임의 값 강제 대입) | **GREEN** — 4 tests 전부 통과 |
| 8 | `:4607` | `...(errorEnvelope ? { error: errorEnvelope } : {})` → `error: errorEnvelope ?? { code: 'INTERNAL', message: 'leaked-internal-detail' }`(envelope 없을 때도 payload 에 임의 `error` 키 강제 삽입) | **GREEN** — 4 tests 전부 통과. **§1 주장의 실증** |

뮤테이션 1~4 는 커밋이 명시한 마킹 로직(상태·emit·envelope 유무)이 실제로 테스트에 결속돼 있음을
확인한다 — 특히 #2 는 커밋 메시지의 "mutation: 헬퍼의 마킹 제거 시 Received "running" RED" 주장을
문자 그대로 재현했다(**참**).

뮤테이션 6~8 은 헬퍼의 다른 세 측면 — **`save()` 호출 자체의 발생 여부**, **DB 엔티티
`error` 필드의 envelope-부재 시 불변**, **WS payload `error` 키의 envelope-부재 시 불변** — 이
기존 4개 테스트로는 전혀 결속돼 있지 않음을 보여준다. 아래 §4 에서 원인과 영향을 분리해 정리한다.

## 3. 발견사항

- **[WARNING]** `errorEnvelope` 부재 시 `error` 키/필드가 **생기지 않는다**는 핵심 불변식(§5.1
  envelope 유출 방지, W15/W19 의 존재 이유 그 자체)을 구조적으로 검증하는 회귀 테스트가 없다 —
  실측으로 확인
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4594`
    (`nodeExecution.error` 조건부 대입), `:4607`(payload 조건부 spread). 대상 테스트:
    `execution-engine.service.spec.ts:5745-5814`(W15, `n-subwf`) 의 단언부
    `:5779-5781`(`ne?.status`/`ne?.finishedAt` 만 검사, `ne?.error` 미검사)와
    `:5789-5798`(payload 전체를 `JSON.stringify` 해 특정 문자열 부재만 검사, 키 구조는 미검사).
  - 상세: 위 §2 표의 뮤테이션 #7·#8 이 실증한다 — `errorEnvelope` 가 없는 분기에서 DB 저장
    `error` 필드와 WS payload `error` 키에 임의의(`'db-leaked-detail'`/`'leaked-internal-detail'`)
    내용을 강제로 채워 넣어도 W15 테스트를 포함한 4개 회귀 테스트가 전부 GREEN 으로 통과한다.
    이 헬퍼가 존재하는 이유(추출 커밋 메시지·JSDoc 이 명시)는 정확히 "`ExecutionCancelledError`
    sentinel 의 message 에 `executionId` 가 들어 있어 client 노출 금지"이므로, 이 불변식은
    보안/프라이버시 성격이 있다. 오늘 코드는 정확하지만(§1, 정적 확인상 참), 그 정확성을 지키는
    안전망이 "특정 문자열이 안 보인다"는 약한 대체 지표뿐이라, 향후 누군가 이 헬퍼를 고치다
    실수로(혹은 다른 목적의 리팩터로) `error` 키를 무조건 채우게 만들어도 테스트 스위트가 이를
    잡지 못한다. 추출 전에는 이 로직이 두 catch 블록에 복제돼 있어 결함 발생 표면이 2곳이었는데,
    추출 후에는 단일 지점(`markNodeCancelled`)이 두 호출부의 유일한 방어선이 됐다 — 그만큼 이
    한 곳의 회귀 테스트 결속이 더 중요해졌는데, 결속은 오히려 약하다.
  - 제안: W15 테스트에 아래 두 단언을 추가 — 최소 비용으로 구조적 검증이 된다.
    ```ts
    expect(ne?.error).toBeUndefined();
    expect(cancelCall?.[3]).not.toHaveProperty('error');
    ```
    (기존의 `not.toContain('cancelled externally')` 단언은 유지 — 이중 방어로 두어도 무방.)
    이미 `applyCancellation`(Execution 레벨, `emitCancellationEvent`) 테스트
    (`:3069-3079`, `expect(emittedPayload).not.toHaveProperty('error')`)가 동일 패턴의 정확한
    구조적 검증을 하고 있어, 그 스타일을 그대로 node 레벨에 옮기면 된다.

- **[INFO]** `NodeExecution.save()` 호출이 통째로 사라져도 기존 회귀 테스트가 감지하지 못한다 —
  mock 이 인자를 참조로 저장해 발생하는 pre-existing 테스트-더블 결함(이번 diff 가 만든 문제
  아님, 그러나 (b) 결속 질문에 직접 관련)
  - 위치: 테스트 헬퍼 `lastNodeExecSave`(`execution-engine.service.spec.ts:5457-5461`,
    `mockNodeExecutionRepo.save.mock.calls.map(c=>c[0]).filter(...).pop()`)와 mock 구현
    (`:311-315`, `save: jest.fn().mockImplementation((entity)=>Promise.resolve(entity))` —
    인자를 깊은 복사 없이 그대로 반환·기록).
  - 상세: `createNodeExecution`(`:8240-8255`)이 최초 RUNNING 상태로 `save()` 한 번 호출한 뒤,
    그 **동일 객체 참조**가 `executeNode` 를 거쳐 `markNodeCancelled` 로 전달돼 제자리에서
    (`nodeExecution.status = CANCELLED` 등) 변형된다. jest 의 `mock.calls` 는 인자를 값이 아니라
    참조로 저장하므로, `markNodeCancelled` 안의 두 번째 `save()` 호출을 통째로 제거해도(§2 표
    뮤테이션 #6) **첫 번째(RUNNING) 호출이 기록해 둔 참조가 사후 변형을 통해 그대로 CANCELLED
    상태를 보여준다** — `lastNodeExecSave` 가 "최신 저장된 값"이 아니라 "그 시점에 해당 필드가
    최종적으로 어떤 값인가"를 보고 있는 셈이라, 저장 호출 자체의 존재 여부는 검증되지 않는다.
    실무 위험은 낮다 — 이번 diff 는 `save()` 를 실제로 호출하고(정적 확인, `:4598`), 이 결함은
    이번 diff 가 새로 만든 것도 아니고 이번 diff 로 악화되지도 않았다. 다만 (b) 질문("기존
    회귀 테스트가 여전히 헬퍼에 결속돼 있는가")에 대한 답이 "필드 값에는 강하게 결속돼 있지만,
    영속화(persist) 호출 그 자체에는 결속돼 있지 않다"는 것이 실측으로 드러났으므로 기록한다.
  - 제안: 필수 아님(광범위한 기존 스펙 패턴 변경이 필요해 이번 diff 범위를 벗어남). 여유가
    되면 최소한 신규/변경 테스트에서 `expect(mockNodeExecutionRepo.save).toHaveBeenCalledTimes(n)`
    류의 호출-횟수 단언을 값 단언과 병행하는 관행을 권장(파일 내 다른 곳, 예:
    `:7613`/`:7758`/`:7882` 는 이미 이 패턴을 쓴다).

- **[INFO]** 회귀 테스트가 헬퍼 이름(`markNodeCancelled`)에 결속돼 있지 않다 — 좋은 테스트
  용이성 신호
  - 위치: `execution-engine.service.spec.ts` 전체에 `markNodeCancelled` 문자열 매치 0건
    (grep 확인). W15/`classifies a handler-thrown AbortError...`/`errorPolicy:retry...(4R)` 세
    테스트 모두 `service.execute(workflowId, {})` 공개 API 를 통해 간접적으로 헬퍼를
    행사(exercise)한다.
  - 상세: 이는 이번 추출이 구현 세부사항이 아니라 관찰 가능한 동작(상태·이벤트)만을 검증하는
    기존 테스트 스타일과 잘 맞물린다는 뜻이다 — 헬퍼를 다시 인라인하거나 이름을 바꿔도 테스트는
    깨지지 않는다(good testability, 점검 관점 8). 별도 조치 불필요, 긍정적 관찰로 기록.

- **[INFO]** W15/AbortError/retry 세 테스트가 의미상 맞지 않는 `describe('error port routing
  (§3.2)', ...)` 블록 안에 위치한다 (pre-existing, 이번 diff 미변경)
  - 위치: `execution-engine.service.spec.ts:5446`(describe 선언), 그 안의 `:5532`/`:5745`/`:5820`
    (모두 node-cancellation §5.1 계열 테스트).
  - 상세: `error port routing (§3.2)` 는 원래 error 포트 라우팅(핸들러가 `port:'error'` 로 결과를
    낸 경우) 테스트를 위한 블록인데, 취소(cancellation) 계열 테스트가 다수 이 안에 얹혀 있다.
    `execution-engine.service.spec.ts` 는 이번 커밋에서 전혀 수정되지 않았으므로 이 diff 가
    만든 문제는 아니다. 테스트 결과 자체에는 영향 없음(순수 조직/가독성 문제).
  - 제안: 필수 아님. 여유가 되면 별도 `describe('node cancellation (§5.1)', ...)` 로 이동해
    그루핑을 명확히 하면 검색성이 좋아진다.

## 4. (c) 추출로 테스트가 vacuous 해졌는가

**아니다.** 이번 diff 는 `execution-engine.service.spec.ts` 를 전혀 건드리지 않았고(정적 확인),
§2 뮤테이션 1~4(상태·emit·envelope 유무를 정면으로 바꾸는 뮤테이션)가 전부 RED 로 정확히 반응해
"추출 후에도 기존 4개 테스트가 여전히 결함을 잡는다"는 (b) 의 핵심 질문에 **그렇다**로 답한다.
브랜치가 이미 3회 자백한 vacuous 패턴류(① 옛 `not.toBe(FAILED)` — RUNNING 인 채로도 참,
② retryConfig 평면 배치로 재시도 루프 미진입, ③ 재시도 detached 타이머 미대기)와 **같은 클래스의
신규 vacuous 단언**은 이번 §2/§3 검증에서 발견되지 않았다. 다만 §3 WARNING 이 지적하는 것은
"vacuous 단언"이 아니라 "애초에 그 불변식을 겨냥한 단언 자체가 없다"는 **커버리지 갭**이라는 점을
분명히 한다 — 다른 종류의 취약점이다.

## 5. 회귀 스위트 상태 확인

- `npx jest execution-engine.service.spec.ts` 전체 — **420/420 통과**, 8.3s.
- `npx jest containers/foreach-executor.spec.ts containers/parallel-executor.spec.ts` — 42/42 통과.
- `npx jest src/nodes/flow/workflow/workflow.handler.spec.ts` — 50/50 통과.
- 모든 뮤테이션은 `cp` 백업본으로 원복 후 `diff -q`(바이트 동일) + `git status --short codebase/`
  (무변경)로 잔존 여부를 매번 확인했다. 최종 상태의 소스 파일은 커밋 `410d913fe` 그대로다.

## 요약

`markNodeCancelled` 추출은 정적으로 확인한 한 동작 보존이 맞다 — `errorEnvelope` 부재 시
`nodeExecution.error` 를 건드리지 않고 payload 에도 `error` 키를 만들지 않는 조건부 로직이
정확히 두 지점(:4594, :4607) 모두에 보존돼 있다. `cp` 백업 기반 라인별 뮤테이션으로 상태 마킹·
`NODE_CANCELLED` emit·envelope 존재 시 `error` 키 포함 여부는 기존 W15/AbortError/4R-retry
테스트에 확실히 결속돼 있음을 실측했고, 커밋 메시지의 mutation 주장("마킹 제거 시 Received
"running" RED")도 시그니처까지 정확히 재현했다. 그러나 반대 방향 — **envelope 부재 시 `error`
키가 절대 생기지 않는다**는, 이 헬퍼가 존재하는 핵심 이유(W15/W19 의 executionId 유출 방지) —
는 구조적으로 검증되지 않는다: DB 필드와 WS payload 양쪽에 임의의 가짜 `error` 값을 강제로
채워 넣어도 4개 회귀 테스트가 전부 통과했다(실측, WARNING). 부수적으로 `save()` 호출 자체의
발생 여부가 mock 의 참조 공유로 인해 검증되지 않는다는 pre-existing 갭도 발견했다(이번 diff
원인 아님, INFO). 추출 자체가 새로운 vacuous 단언을 만들지는 않았다 — spec 파일이 아예
변경되지 않았고 기존 검증력도 그대로 보존됐다. 신규 결함(코드 결함)은 없다. C1~C5·W1~W25 는
재론하지 않았다.

## 위험도

LOW
