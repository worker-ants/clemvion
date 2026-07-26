# 유지보수성(Maintainability) Review — linear-cancel-mechanism (4R)

## 스코프 노트 (선행 확인)

본 라운드 프롬프트에 첨부된 "리뷰 대상 파일" 11건은 전부 `review/code/2026/07/26/13_47_42/*`
(직전 라운드의 리뷰 산출물 md/json)이며, 실제 소스 diff(`execution-engine.service.ts`,
`workflow.handler.ts`, `foreach-executor.ts`, `parallel-executor.ts`, `retry-turn.service.ts` 등)는
포함돼 있지 않다. `git log`로 대조한 결과, 그 사이 커밋 `2ca6ada66`("fix(engine): SUMMARY
W14-W18 — background 스로틀 Map 누수·Sub-Workflow 취소 오분류·retry-turn error 노출·스로틀
테스트 flake 해소")가 이미 HEAD 에 반영돼 있다 — 프롬프트의 diff 베이스가 그 직전 커밋
(`615b43430`, 3R 리뷰 문서 커밋)에 고정된 탓에 실제 코드 변경분이 이번 payload 에서 누락된
것으로 보인다(harness diff-base 스코프 갭). 오케스트레이터가 지시한 점검 대상(§4·실행부·
`executeNode`·`executeBackgroundSubgraph`)이 정확히 이 누락된 코드 변경분이므로, `Read`/`Grep`
으로 현재 워크트리의 실제 소스를 직접 열어 검증했다.

## 지시 대응 — `ExecutionCancelledError` 재throw 분기 확산 + 스로틀 Map 정리 3곳 판단

### 1) 재throw 분기 6곳 — 헬퍼 추출 불필요 (INFO, 판단 근거 기록)

현재 `instanceof ExecutionCancelledError` 로 취소를 조기 분기하는 지점은 6곳이다:

| # | 위치 | 형태 |
| --- | --- | --- |
| 1 | `codebase/backend/src/nodes/flow/workflow/workflow.handler.ts:195-197` | `if (err instanceof ExecutionCancelledError) { throw err; }` (2줄, C1) |
| 2 | `codebase/backend/src/modules/execution-engine/containers/foreach-executor.ts:99-101` | 동일 2줄 idiom (C3) |
| 3 | `codebase/backend/src/modules/execution-engine/containers/parallel-executor.ts:279-284` | `failures.find((f) => f.error instanceof ExecutionCancelledError)` 후 재throw — `Promise.allSettled` 집계 구조에 맞춰 형태가 다름 (C5) |
| 4 | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:7592-7594`(`runContainer`) | 동일 2줄 idiom (W9) |
| 5 | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:5812-5814`(`executeNode`) | 동일 2줄 idiom (W15, `2ca6ada66` 신규) |
| 6 | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:6927-6939`(`executeBackgroundSubgraph`) | **재throw 아님** — `else if` 로 삼키고 debug log(fire-and-forget 이라 던질 대상이 없음) |

- 위치: 위 표 6곳
- 상세: 4곳(1·2·4·5)이 바이트 단위로 동일한 2줄 idiom 을 공유하지만, 이 2줄 자체는 더 이상
  줄일 수 없는 최소 가드다. 각 사이트의 실질 정보량은 가드 코드가 아니라 그 위에 붙은
  5~10줄 한국어 주석 — "이 catch 를 방치하면 무엇이 깨지는가"(Sub-Workflow 는
  `SUB_WORKFLOW_FAILED` 오분류, 컨테이너는 `NODE_FAILED` 오분류, Parallel 은 거짓 `done`
  포트, `executeNode` 는 Sub-Workflow 결과의 상위 노드 FAILED 오분류)를 사이트마다 다르게
  설명하며, 이는 헬퍼로 추출하면 사라지거나(추출 함수 안에 숨어 호출부에서 안 보이게 됨)
  호출부 주석으로 그대로 남아 결국 "헬퍼 호출 + 거의 같은 길이의 주석"이 되어 순 이득이
  거의 없다. `parallel-executor.ts`(3번)와 `executeBackgroundSubgraph`(6번)는 구조/의미가
  달라(배열 집계 vs fire-and-forget swallow) 공통 헬퍼 시그니처로 억지로 통합하면 오히려
  각 사이트의 실제 동작을 가리는 방향이 된다(1R maintainability 가 W8 후보를 "가드 *진입부*
  시퀀스 통합"으로 한정하고 이 catch-guard 패턴은 대상에서 제외한 것과 같은 결의 판단).
  이미 각 사이트가 개별 mutation 회귀 테스트로 커버돼 있어(`node-cancellation-residual-signal-propagation.md`
  가 기록한 "7개 지점 전부 mutation 재검증", W15 추가분도 동일 패턴 테스트 보유) 헬퍼
  부재로 인한 "조용한 회귀" 리스크도 낮다.
- 다만 이 결함 클래스(취소를 삼켜 일반 실패로 오분류하는 신규 catch 지점)가 라운드마다
  독립적으로 5회(C1→C3→C5→W9→W15) 재발견됐다는 사실 자체는 "코드 중복"이 아니라 "합의된
  규약의 부재"를 시사한다 — 현재는 사이트별 주석의 `ai-review Cx/Wx` 태그로만 관례가
  전승되고 있고, `spec/conventions/node-cancellation.md` 에는 이 규약("`ExecutionCancelledError`
  가 도달 가능한 catch 블록은 generic 실패 처리 이전에 반드시 우회 재throw/삼킴 분기를
  둔다")이 명문화돼 있지 않다.
- 제안: 코드 리팩터(헬퍼 함수 추출)는 권장하지 않음 — 위 이유로 순 이득이 없거나 음수.
  대신 저비용 예방책으로 (a) `spec/conventions/node-cancellation.md` 에 이 catch-guard
  규약을 한 줄 명문화하거나, (b) 6개 사이트를 한곳에서 나열하는 인덱스 주석(예: 아래
  §2 에서 지적한 Map JSDoc 처럼 `ExecutionCancelledError` 클래스 자체의 JSDoc 에 "이 에러가
  도달할 수 있는 catch 지점 목록"을 적어두는 것)을 고려할 만하다. 필수는 아님.

### 2) 스로틀 Map 정리 3곳 — 구조는 기존 관용구와 일관되나, 클래스 필드 JSDoc 이 이미 stale (WARNING)

- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:536-538`
  (`containerCancelCheckedAtMs` 필드 JSDoc, `:540` 필드 선언 바로 위)
- 상세: 정리(`delete`) 호출은 실제로 3곳이다 — `finalizeRehydrationCleanup`(`:2670`),
  `runExecution` 의 `finally`(`:4544`), 그리고 이번에 추가된 `executeBackgroundSubgraph`
  의 `finally`(`:6951`, 커밋 `2ca6ada66`, W14). 이 3-곳 패턴은 실제로 기존 관용구와
  일관된다 — 같은 파일에서 `contextService.deleteContext(executionId)` 와
  `clearLlmDefaultConfigCache(executionId)` 도 정확히 같은 2개 chokepoint
  (`finalizeRehydrationCleanup`/`runExecution finally`)에서 함께 정리되고 있어(`:2668-2669`,
  `:4542-4543`), `containerCancelCheckedAtMs` 가 여기 새 3번째 사이트를 더한 것은 "임의로
  흩어진 정리"가 아니라 두 기존 필드 옆에 나란히 배치된 자연스러운 확장이다. 단,
  `containerCancelCheckedAtMs` 는 background 본문이 **부모와 동일한 `executionId` 키**를
  공유한다는 점에서 `contextService`(background 는 자신만의 별도 `bgKey` 를 쓴다,
  `:6944`)와 근본적으로 다르다 — 이 "공유 키를 서로 다른 비동기 생명주기 3곳이 각자
  set/delete" 하는 형태가 정확히 W14 누수(2곳만 정리되던 시절, background 가 부모의
  delete 이후 다시 set 해 아무도 못 지움)의 원인이었다. **그런데 이 필드의 JSDoc
  (`:536-538`, "**누수 방지**: execution 종료 지점(`finalizeRehydrationCleanup`, `runExecution`
  catch/finally)에서 반드시 `delete` 한다")은 `2ca6ada66` 이후에도 갱신되지 않아 여전히
  2곳만 나열한다** — `git show 2ca6ada66 -- .../execution-engine.service.ts` 로 직접 diff 를
  대조해 이 hunk 가 손대지 않았음을 확인했다. 이 Map 이 정확히 "정리 지점 목록이 stale
  해서 새 종료 경로가 빠졌던" 결함(W14)을 겪은 당사자인데, 그 재발 방지를 위해 남긴
  기록(JSDoc 의 정리 지점 목록)이 그 수정과 동시에 갱신되지 않은 것은 같은 실패
  패턴("문서화된 불변식이 실체와 어긋난다")의 축소판 재발이다 — 다음에 4번째 종료 경로가
  생겼을 때 이 JSDoc 만 보고 "2곳만 지우면 된다"고 오판할 위험이 남는다.
- 제안: `:536-538` JSDoc 을 "`finalizeRehydrationCleanup`, `runExecution` catch/finally,
  `executeBackgroundSubgraph` finally(W14, 2026-07-26 — 부모와 executionId 를 공유하는
  fire-and-forget 경로)"로 갱신해 3곳을 모두 나열한다. 코드 동작 변경은 불필요 — 순수
  문서 정합성 수정이며 우선순위는 낮으나(이미 실제 정리는 3곳 모두 되어 있고
  `execution-engine.service.spec.ts:3747` 부근 W18 회귀 테스트가 3곳 커버리지를
  검증하므로 correctness 영향은 없음), 이 파일이 이미 "JSDoc/CHANGELOG 문구가 실제
  구현을 따라가지 못한다"는 패턴(W13, documentation W13 재발 이력 참고)으로 반복 지적된
  이력이 있어 재발 방지 차원에서 권장한다.

## 확인했으나 재론하지 않는 항목 (이미 해소됨, C1~C5·W1~W13 및 이번에 직접 확인한 W14~W18)

- W12(`finalizeCancelledExecution` 헬퍼 추출) — 여전히 유일한 통합 지점(`:4568~`)이며 재복제
  없음. 재론하지 않음(지시 준수).
- W14(background Map 누수 fix)·W15(`executeNode` 우회 재throw)·W16(`retry-turn.service.ts`
  의 `isCancelled` 게이팅) — 3건 모두 실제 소스에서 정확히 구현돼 있음을 직접 확인했다
  (`execution-engine.service.ts:6951`, `:5812-5814`, `retry-turn.service.ts:642,652`). 새로운
  유지보수성 결함은 없음 — §2 의 JSDoc stale 건만 그 구현의 부산물로 남았다.
- `loop-executor.ts` 는 여전히 per-iteration catch 가 없어 재throw 가드가 불필요하다는
  기존 판단(1R/2R)이 현재 코드에도 유효함을 재확인(`:76-115`).

## 요약

이번 라운드 payload 에는 실제 코드 diff 가 없었으나(harness diff-base 스코프 갭 — 위
"스코프 노트" 참조), 지시받은 판단 대상(`ExecutionCancelledError` 재throw 6곳, 스로틀 Map
정리 3곳)을 현재 워크트리 소스를 직접 열어 검증했다. 재throw 확산은 임계에 도달하지
않았다고 판단한다 — 4곳은 바이트 단위로 동일한 2줄 최소 가드이고, 나머지 2곳은 구조/의미가
달라 억지로 통합하면 오히려 정보를 잃는다; 각 사이트는 이미 개별 mutation 테스트로
보호된다. 다만 이 결함 클래스가 5라운드 연속 재발견된 사실은 명문화된 규약 부재를
시사하므로 낮은 비용의 문서화(spec/conventions 또는 클래스 JSDoc 인덱스)를 권장한다(INFO).
스로틀 Map 정리 3곳은 코드베이스의 기존 2-chokepoint 관용구(`contextService`/
`clearLlmDefaultConfigCache` 와 동일)를 그대로 따르는 정당한 확장이지만, 그 필드의 JSDoc
불변식 서술이 `2ca6ada66`(W14) 이후에도 여전히 2곳만 나열해 stale 상태다 — 이 Map 자신이
"정리 지점 목록 누락"으로 한 차례 누수를 겪은 당사자라는 점에서 WARNING 으로 분류하고
정정을 권장한다. 두 판단 모두 코드 동작에는 영향이 없다.

## 위험도

LOW
