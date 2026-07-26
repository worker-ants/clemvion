# 변경 범위(Scope) Review — linear-cancel-mechanism (6R)

## 스코프 노트 (프롬프트 diff-list 갭, 5R에서도 동일 현상)

프롬프트에 첨부된 리뷰 대상 파일은 `review/code/2026/07/26/{13_47_42,14_45_30,15_30_00}/*`
(직전 세 라운드의 리뷰 산출물)뿐이며, 실제 검증 대상인 소스 diff(`execution-engine.service.ts`)는
payload 에 포함돼 있지 않다. 5R maintainability.md 가 이미 같은 원인("코드 수정과 직전 라운드
리뷰 산출물을 한 커밋에 함께 담아 harness diff-base 가 코드 hunk 를 누락")을 기록해 뒀고, 5R
SUMMARY 도 이를 harness 백로그로 분리했다 — 재론하지 않는다. 오케스트레이터 지시대로
`git show HEAD --stat` / `git show HEAD -- <path>` 로 최신 커밋을 직접 열어 검증했다.

## 대상 커밋

`410d913fe` — `refactor(engine): 5R W25 — 노드 취소 종결 중복을 markNodeCancelled 로 추출`

```
$ git show HEAD --stat
 .../execution-engine/execution-engine.service.ts   |  97 ++++---   (56 insertions, 41 deletions)
 review/code/2026/07/26/15_29_59/_retry_state.json  | 153 +++++++++++
 review/code/2026/07/26/15_29_59/meta.json          | 282 +++++++++++++++++++++
 review/code/2026/07/26/15_30_00/RESOLUTION.md      |  44 ++++
 review/code/2026/07/26/15_30_00/SUMMARY.md         |  56 ++++
 review/code/2026/07/26/15_30_00/_retry_state.json  | 130 ++++++++++
 review/code/2026/07/26/15_30_00/_routing_decision.json | 23 ++
 review/code/2026/07/26/15_30_00/documentation.md   | 146 +++++++++++
 review/code/2026/07/26/15_30_00/maintainability.md | 128 ++++++++++
 review/code/2026/07/26/15_30_00/meta.json          | 146 +++++++++++
 review/code/2026/07/26/15_30_00/requirement.md     | 137 ++++++++++
 review/code/2026/07/26/15_30_00/scope.md           | 109 ++++++++
 review/code/2026/07/26/15_30_00/security.md        |  80 ++++++
 review/code/2026/07/26/15_30_00/side_effect.md     | 109 ++++++++
 review/code/2026/07/26/15_30_00/testing.md         | 152 +++++++++++
 15 files changed, 1751 insertions(+), 41 deletions(-)
```

**의도된 변경(발주)**: 5R SUMMARY의 유일한 WARNING(`W25`) — `executeNode` catch 의
`isAbortError`/`ExecutionCancelledError` 두 취소 분기가 복제한 ~20줄(상태 마킹·
`finishedAt`/`durationMs` 계산·`save`·`NODE_CANCELLED` emit)을 `markNodeCancelled` 헬퍼로
추출하는 **동작 보존 리팩터**. `review/**` 14개는 직전(5R) 라운드가 산출한 리뷰 문서·상태
파일로, 이 harness 가 매 라운드 코드 fix 커밋에 직전 라운드 산출물을 함께 담아온 기존
패턴(1R~5R 전 라운드가 동일하게 유지) 그대로다 — 무관한 산출물이 아니라 워크플로 관례.

## 1. 소스 diff 실측 — 동작 보존 여부

`git show HEAD -- codebase/backend/.../execution-engine.service.ts` 전체를 직접 읽어
2개 hunk 로 구성됨을 확인했다:

1. **hunk 1 (순수 추가)** — `finalizeCancelledExecution` 바로 위에 신규 `private async
   markNodeCancelled(nodeExecution, node, context, executionId, errorEnvelope?)` 메서드와
   그 JSDoc 을 추가. 본문은 기존 두 분기가 각각 인라인으로 수행하던 연산(status 대입 →
   `errorEnvelope` 있으면 `nodeExecution.error` 대입 → `finishedAt`/`durationMs` 계산 →
   `save` → `emitNode(..., NODE_CANCELLED, {...})`)을 그대로 옮긴 것 — 새 로직 없음.
2. **hunk 2 (호출부 치환)** — `isAbortError` 분기와 `ExecutionCancelledError` 분기 각각의
   인라인 20여 줄을 `await this.markNodeCancelled(nodeExecution, node, context, executionId,
   errorEnvelope?)` 단일 호출로 치환. `throw err;` 는 두 분기 모두 호출부에 그대로 남음.

**필드/조건 단위 대조 결과 — 값 손실 없음:**

- `isAbortError` 경로: 이전에 `nodeExecution.error = errorEnvelope`(무조건 대입) →
  헬퍼는 `if (errorEnvelope) nodeExecution.error = errorEnvelope;` 인데 이 경로는 항상
  `errorEnvelope` 를 넘기므로 실질 동일. emit payload 의 `error: errorEnvelope` (무조건
  포함) → 헬퍼는 `...(errorEnvelope ? { error: errorEnvelope } : {})` — 이 경로는 항상
  포함되므로 동일.
- `ExecutionCancelledError` 경로: 이전엔 `error` 필드를 아예 대입/emit 하지 않았음 →
  헬퍼 호출 시 `errorEnvelope` 인자를 생략(`undefined`) → 두 조건부 분기 모두 스킵되어
  `error` 필드가 `nodeExecution`에도 emit payload 에도 생기지 않음 — 동일.
- 나머지 필드(`nodeExecutionId`, `parentNodeExecutionId`, `status`, `nodeType`,
  `nodeLabel`, `input`, `startedAt`, `finishedAt`) 는 두 원본 분기 모두 토큰 단위로
  동일했고 헬퍼에도 그대로 보존.
- `throw err;` 는 헬퍼가 던지지 않고 호출부 책임으로 남겨 두 분기가 여전히 서로 다른
  원본 에러(`err`)를 재throw — 헬퍼 추출로 인한 에러 타입 손실 없음.

**새 import 없음** — `git show HEAD -- <path> | grep '^+import\|^-import'` 결과 0건.
`Node`/`ExecutionContext` 타입은 이미 같은 파일에서 수십 곳 사용 중인 기존 타입.

**테스트 파일 무변경** — `git show HEAD --numstat` 에 `*.spec.ts` 가 없다. 동작 보존
리팩터이므로 기존 43 suites / 1121 tests 가 추출 전후 그대로 통과한다는 RESOLUTION.md 주장과
일치(구조도 확인: 새 테스트를 추가하지 않고 기존 회귀 테스트가 그대로 새 헬퍼 경로를
간접 커버).

**결론: 로직 변경·기능 추가·무관 파일 수정 없음. 순수 동작 보존 리팩터로 국한된다.**

## 2. 발견사항

이번 diff 자체에서 스코프 이탈로 지적할 사항은 없다. 참고용 INFO 1건만 기록한다.

- **[INFO]** 헬퍼 파라미터 순서가 5R `maintainability.md` 가 제안한 초안과 다르다
  (제안: `(nodeExecution, context, node, executionId, errorEnvelope?)` / 실제 채택:
  `(nodeExecution, node, context, executionId, errorEnvelope?)`)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
    (`markNodeCancelled` 시그니처, `finalizeCancelledExecution` 바로 위 신설 메서드)
  - 상세: 리뷰 제안은 구속력 있는 스펙이 아니라 권고 초안이므로 순서 차이 자체는
    스코프 위반이 아니다. 실제 구현이 두 호출부(`isAbortError`, `ExecutionCancelledError`)
    모두에서 새 시그니처와 인자 순서를 일관되게 사용하는지만 확인하면 되는데, `git show
    HEAD` diff 상 두 호출부 모두 `(nodeExecution, node, context, executionId, [errorEnvelope])`
    순서로 정확히 일치한다 — drift 없음. 기록만 남긴다.
  - 제안: 없음(조치 불필요).

## 3. 5R SUMMARY 백로그 분리 항목 — 코드 무변경 재대조

지시대로, 5R SUMMARY/RESOLUTION 이 명시적으로 백로그·위임으로 분리한 5개 항목이 이번
커밋에서도 여전히 손대지 않았는지 `git show HEAD --stat`(전체 파일 목록)과 개별
`git log -1 -- <path>` 로 대조했다:

| 백로그 항목 | 관련 파일 | 이번 커밋(410d913fe)에 포함? | 최종 수정 커밋 |
| --- | --- | --- | --- |
| 선재 spec 파일(`execution-engine.service.spec.ts`) 구조적 flakiness | `execution-engine.service.spec.ts` | **아니오** — numstat 에 `.spec.ts` 없음 | 이전 라운드(4R `0f4047426`) — 5R·6R 모두 미접촉 |
| `ParallelExecutor.execute` 의 `runParallel` `failures[]` 미소비 | `parallel-executor.ts` | **아니오** — 이번 stat 목록에 파일 자체가 없음 | `10b27c320`(2R) — 3R~6R 모두 미접촉 |
| Parallel `errorPolicy:'stop'` 의 `failures[0]` 우선순위 레이스 | `parallel-executor.ts` | **아니오** — 상동 | 상동 |
| shutdown `FAILED`(SERVER_INTERRUPTED) 미감지 | (concurrency INFO, 대상 파일 미특정 — 백로그 문서 참조) | **아니오** — 이번 커밋은 `execution-engine.service.ts` 1개 소스 파일만 수정, 해당 로직 구간(shutdown/SIGTERM 처리) 밖 | — |
| `spec/5-system/6-websocket-protocol.md` 의 `execution.node.cancelled` WS 서술(생산자 1개·`error` 상시 전제) | `spec/5-system/6-websocket-protocol.md` | **아니오** — `git log -3 -- <path>` 최신 커밋 `7847535fc`(#961, 이 브랜치 이전) | developer 권한 밖 → planner 위임 유지, 이번 커밋 미접촉 |

전 항목 코드/spec 무변경을 직접 명령으로 재확인했다 — 5R 판정을 뒤집을 근거 없음.

## 4. 그 외 8개 관점 (이번 diff 대상)

1. **의도 이상의 변경**: 없음 — 커밋 메시지·5R SUMMARY W25·RESOLUTION.md 조치 항목이
   diff 2-hunk 와 1:1 대응.
2. **불필요한 리팩토링**: 없음 — 추출 대상은 **이번 PR 자신(4R `0f4047426`, W19)이 새로
   만든 20여 줄 중복**이지 무관한 레거시 코드 정리가 아니다. 같은 파일의 Execution 레벨
   동형 중복을 `finalizeCancelledExecution`(W12, 2R)으로 추출한 선례와 동일 패턴 — 코드베이스
   관용구를 벗어나지 않는다.
3. **기능 확장(over-engineering)**: 없음 — 새 옵션·새 공개 API·새 분기 없음. 기존 두 분기의
   유일한 차이(`errorEnvelope` 유무)를 선택 인자 하나로 표현했을 뿐.
4. **무관한 수정**: 없음 — 소스 변경은 `execution-engine.service.ts` 1개 파일, 2개 hunk 뿐.
   `parallel-executor.ts`/`foreach-executor.ts`/`workflow.handler.ts`/spec 문서 등은
   이번 커밋에 전혀 등장하지 않는다.
5. **포맷팅 변경**: 없음 — RESOLUTION.md 는 "추출 직후 prettier 오류 3건을 `--write` 로
   정리"라 기록하는데, 실제 `git show HEAD` numstat(56/41)이 diff 로 관측한 2-hunk 분량과
   정확히 일치해 prettier 정리가 신설 코드 범위 밖으로 번지지 않았음을 확인했다 — 파일
   전역 재포맷 없음.
6. **주석 변경**: 신규 JSDoc(`markNodeCancelled` 헤더)은 추출 배경(W19/W12 선례, `errorEnvelope`
   유무 차이, throw 를 호출부에 남긴 이유)을 설명하는 근거 있는 신규 주석이며, 기존 무관
   주석의 삭제·수정은 없다(호출부에 남은 `§5.1 봉투 형식`/`W15 노출 차단` 기존 주석은
   그대로 보존).
7. **임포트 변경**: 없음 — `import` 라인 diff 0건, 사용 타입은 기존 재사용.
8. **설정 변경**: 없음 — `package.json`/CI/env 설정 파일 변경 없음.

## 요약

6라운드째 검증 대상인 최신 커밋(`410d913fe`)은 5R SUMMARY 의 유일한 WARNING(W25 — `executeNode`
취소 분기 중복)을 해소하는 **순수 동작 보존 리팩터**로 정확히 국한된다. 신설 `markNodeCancelled`
헬퍼는 두 원본 분기의 필드 대입·조건부 `error` 봉투·save·emit·throw 를 값 하나(`errorEnvelope`
유무) 차이로 정확히 재현하며, 로직 변경·새 기능·새 import·설정 변경·무관 파일 수정이 없다.
prettier 정리도 diff 규모(56/41, 2-hunk)를 벗어나지 않아 포맷팅 오염이 없음을 numstat 로
직접 확인했다. 함께 커밋된 `review/**` 14개 파일은 직전 라운드 산출물로, 매 라운드 반복돼
온 워크플로 관례이지 스코프 이탈이 아니다. 지시대로 대조한 5R 백로그 5개 항목(선재 spec
flakiness, `runParallel` failures 미소비, Parallel `stop` 레이스, shutdown FAILED, WS spec
서술)은 관련 파일 자체가 이번 커밋 변경 목록에 등장하지 않음을 `git show`/`git log`로
직접 확인했다 — 여전히 코드에 손대지 않은 상태 그대로다. 이전 라운드에서 이미 판정된
확장(C1~C5, W1~W24)은 재론하지 않았다.

## 위험도

NONE
