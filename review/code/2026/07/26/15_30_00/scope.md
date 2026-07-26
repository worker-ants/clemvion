# 변경 범위(Scope) Review — 5R (W24 §범위 판정 실체 검증)

집중 검증 대상: 4R SUMMARY(`review/code/2026/07/26/14_45_30/SUMMARY.md`)가 직전 라운드
scope 의 W24 지적(diff 밖 발견이 명시 triage 없이 해소 사이클에 편입됨)에 응답해 신설한
**§범위 판정** 절 — "이 PR 이 만들었거나, 이 PR 때문에 새로 도달 가능해졌는가" 기준으로
편입(W19·W20·W21·W22)/분리(W23 등)를 명시했다. 이 기준이 **실제 커밋
`0f4047426`**에서 지켜졌는지 코드·git 이력으로 직접 검증했다(문서 서술을 그대로 믿지 않고
`git show`/`git log -S`로 각 항목의 최초 도입 커밋을 추적).

## 검증 방법

- `git show --stat 0f4047426` 로 실제 변경 파일 전수 확인.
- 프로덕션 코드에 한해 `git show 0f4047426 -- <file>` 로 전체 hunk(3개) 를 남김없이 열람.
- W19~W22 각각이 "이 PR(=linear-cancel-mechanism 기능 브랜치, `dad70c7b2` 이후 전 라운드)"
  자신이 만든 결함/문서인지 `git log -S`로 최초 도입 커밋을 역추적.
- W23 및 그 외 백로그 항목(`runParallel` failures 미소비, `ParallelExecutor 'stop'`
  `failures[0]` 레이스, W8 헬퍼 승격, shutdown FAILED 미감지)이 실제로 **코드에 손대지
  않았는지** 대상 파일(`parallel-executor.ts`, `foreach-executor.ts`, `loop-executor.ts`,
  `workflow-errors.ts`, `workflow.handler.ts`, `node-cancellation-propagation.e2e-spec.ts`,
  plan 문서)이 이번 커밋 변경 파일 목록에 등장하지 않는지 대조.

## 발견사항

### 편입 항목(W19·W20·W21·W22) — 전부 기준에 부합함을 확인

- **W19** — `git log -S"instanceof ExecutionCancelledError" ... execution-engine.service.ts`
  계열 추적 결과, W15 의 "아무것도 하지 않고 재throw" 코드는 이 기능 브랜치 자체의
  선행 라운드 커밋 `2ca6ada66`(W14-W18)에서 도입됐다. 즉 W19 는 이 PR(브랜치)이 스스로
  만든 결함이 맞다 — "편입" 판정이 정확하다. 실제 수정도 해당 catch 블록
  (`execution-engine.service.ts` hunk `@@ -5809,7 +5812,35 @@`, `if (err instanceof
  ExecutionCancelledError)` 분기)에 `CANCELLED` 마킹 + `NODE_CANCELLED` emit 을 추가하는
  것으로 국한돼 있고, 다른 영역을 건드리지 않았다.
- **W20** — `assertExecutionNotCancelled()`(node 경계에서 `ExecutionCancelledError` 를
  throw)는 이 브랜치의 기점 커밋 `dad70c7b2`(§2.3, "외부 cancel 후에도 하류 노드가 계속
  dispatch" 결함 수정)에서 신설됐다. `executeWithRetry` 는 `handler.execute()` 를
  직접 호출하는데(`:6163`, `:6175`), Sub-Workflow 노드는 `handler.execute` 내부에서
  `executeInline` 을 거치고 그 dispatch 루프 역시 `dad70c7b2` 이후로 매 노드 경계마다
  `assertExecutionNotCancelled` 를 호출한다 — 즉 `ExecutionCancelledError` 가
  retry-wrapped 호출 스택으로 새로 도달 가능해진 것은 바로 이 PR 의 §2.3 변경 때문이다.
  "이 PR 때문에 새로 도달 가능해진 경로"라는 서술이 실측과 일치한다. 수정 범위도
  `executeWithRetry` 의 재시도 제외 조건 한 줄(`isAbortError(lastError) ||
  err instanceof ExecutionCancelledError`)로 국한됐다.
- **W21** — (a) `CONTAINER_CANCEL_CHECK_THROTTLE_MS` 필드의 "§5" 인용과 (b)
  `containerCancelCheckedAtMs` 필드의 "누수 방지 2곳" 서술 둘 다 `git log -S` 로
  최초 도입 지점을 확인한 결과 **둘 다 이 브랜치의 `10b27c320`(W10 스로틀 도입)에서
  신설**됐다. 이후 같은 브랜치의 `2ca6ada66`(W14)이 정리 지점을 3곳으로 늘리면서 이
  JSDoc 을 갱신하지 않아 stale 해졌다 — "이 PR 이 만든 문서의 부정확"이라는 분류가
  정확하다. 실제로 `containerCancelCheckedAtMs.delete(...)` 호출은 현재
  `:2673`/`:4547`/`:6988` 세 곳으로 확인되어(`grep -n
  "containerCancelCheckedAtMs.delete"`), 갱신된 "3곳" JSDoc 과도 일치한다.
- **W22** — CHANGELOG 항목 6~9(W14·W15/W19·W20·W16)는 전부 이 기능 브랜치 자신의
  선행 라운드가 만든 변경(`2ca6ada66`, `0f4047426` 자신의 W19/W20)을 사후 기록하는
  것으로, "이 PR 이 만든 문서"의 보완이며 스코프 확장이 아니다.

### 분리 항목(W23 외) — 코드에 실제로 손대지 않았음을 확인

- `git show --stat 0f4047426` 결과 프로덕션/테스트 파일은 정확히 3개
  (`CHANGELOG.md`, `execution-engine.service.ts`, `execution-engine.service.spec.ts`)뿐이다.
  `parallel-executor.ts`/`foreach-executor.ts`/`loop-executor.ts`/`workflow-errors.ts`/
  `workflow.handler.ts`/`node-cancellation-propagation.e2e-spec.ts`/
  `plan/in-progress/*.md` 는 이번 커밋 변경 목록에 전혀 등장하지 않는다 — W23(선재
  spec 파일 구조적 flakiness), `runParallel` failures 미소비, `ParallelExecutor 'stop'`
  `failures[0]` 레이스, W8 헬퍼 승격, shutdown FAILED 미감지 전부 "분리(백로그)" 서술과
  실제 diff 가 정확히 부합한다.
- `execution-engine.service.spec.ts` 의 diff(hunk 2개)도 W19 테스트 강화 +
  W20 신규 회귀 테스트 추가로만 구성돼 있고, `flushResumeDrive`(W23 이 지목한 flaky
  헬퍼)나 다른 describe 블록은 건드리지 않았다 — spec 파일을 쪼개지 않고 놔두겠다는
  "분리" 판정과 실제 무변경이 일치한다.

### [INFO] 이번 라운드는 "fix" 커밋에 직전 라운드(14_45_30) 리뷰 산출물 13개 파일 전체를 함께 실었다 — 직전 두 라운드의 커밋 분리 관행과 다르다

- 위치: 커밋 `0f4047426` 전체(`git show --stat`) — `review/code/2026/07/26/14_45_30/`
  하위 13개 파일(`SUMMARY.md`, `RESOLUTION.md`, `meta.json`, `_retry_state.json`,
  `_routing_decision.json`, 8개 reviewer `.md`)이 코드 수정 3개 파일과 **한 커밋에
  같이 커밋**됐다.
- 상세: 직전 두 라운드(`13_47_42`)는 리뷰 산출물 커밋(`615b43430`, "docs(review): ai-review
  3R")과 그 조치의 RESOLUTION 커밋(`06eba6334`, "docs(review): RESOLUTION.md — 3R
  W14-W18 처리 결과")을 실제 코드 수정 커밋(`2ca6ada66`, "fix(engine): SUMMARY W14-W18
  ...")과 **분리**해 왔다. 이번 라운드만 리뷰 산출물 13개 파일 + `fix(engine)` 코드
  수정을 단일 커밋으로 묶었다. 코드 자체의 스코프 위반은 아니고(리뷰 산출물은
  `review/**`이 developer 쓰기 허용 영역이며 W24 대응 자체가 이번 라운드의 정당한
  작업 일부), 커밋 메시지가 "4R W19·W20" 코드 수정만 서술하고 13개 리뷰 파일 동봉을
  언급하지 않아 `git log --stat` 없이는 리뷰어가 오인하기 쉽다는 점만 참고로 남긴다.
  판정 정확성 자체에는 영향이 없다.
- 제안: 필수 조치 아님. 향후 라운드에서 관행을 되살리려면 리뷰 산출물 커밋과 코드
  수정 커밋을 분리해도 되고, 현재처럼 합쳐도 무방(둘 다 `review/**`+`codebase/**` 를
  developer 가 같은 턴에 쓸 권한이 있으므로 정책 위반은 아님).

## 요약

W24 에 대한 응답으로 4R SUMMARY 가 신설한 §범위 판정 절의 편입/분리 기준("이 PR 이
만들었거나, 이 PR 때문에 새로 도달 가능해졌는가")은 실제 커밋 `0f4047426`에서 문서
서술 그대로 지켜졌다. `git log -S` 로 역추적한 결과 W19(재throw 결함)·W21(§5 오인용
JSDoc)·W22(CHANGELOG 누락)는 전부 이 기능 브랜치 자신의 선행 라운드(`10b27c320`,
`2ca6ada66`)가 만든 것이고, W20(retry 오분류)은 이 브랜치의 기점 커밋(`dad70c7b2`)이
`assertExecutionNotCancelled` 를 node 경계에 신설해 `ExecutionCancelledError` 가
retry-wrapped 경로로 새로 도달 가능해진 데서 비롯됐다 — "편입" 판정 4건 모두 근거가
실측과 일치한다. 반대로 "분리"로 분류된 W23·`runParallel` failures 미소비·
`ParallelExecutor 'stop'` 레이스·W8 헬퍼 승격·shutdown FAILED 미감지는 관련 파일
(`parallel-executor.ts`·`foreach-executor.ts`·`loop-executor.ts`·`workflow-errors.ts`·
`workflow.handler.ts`·e2e-spec·plan 문서)이 이번 커밋 변경 목록에 전혀 없어, 실제로
코드에 손대지 않았다는 서술도 정확하다. 커밋 diff 자체도 claim 된 3개 파일·3개
hunk(JSDoc 정정, CANCELLED 마킹 추가, retry 제외 조건 추가)로 정확히 국한돼 스코프
이탈이 없다. 유일하게 기록해 둘 점은 이번 커밋이 직전 두 라운드와 달리 리뷰 산출물
13개 파일을 코드 수정과 한 커밋으로 묶었다는 것(INFO, 판정 정확성엔 무관).

## 위험도

NONE
