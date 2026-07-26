# Plan 정합성 검토 — node-cancellation 잔여 (선형 경로 cancel 전파 항목)

검토 대상 plan: `plan/in-progress/node-cancellation-residual-signal-propagation.md`
검토 대상 target: `spec/conventions/node-cancellation.md` + `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md`(위임 문서)
비교 기준: `origin/main..HEAD` 커밋 이력(`dad70c7b2` ~ `364646d18`, 총 7 라운드 `/ai-review`) + 각 라운드 `review/code/2026/07/26/{11_48_55,12_55_55,13_47_42,14_45_30,15_30_00,15_56_53,16_20_52}/{SUMMARY,RESOLUTION}.md`.

## 발견사항

### [WARNING] "선형 경로 cancel 전파" 항목의 완료 서술이 실제 구현 범위보다 4라운드(4R~7R) 뒤처짐 — Sub-Workflow/Background 확장이 plan 에 없음

- **target 위치**: `plan/in-progress/node-cancellation-residual-signal-propagation.md:73-144` — "선형 경로 cancel 전파의 기전 규명 + 결정적 고정" 항목. 체크박스는 `[x]` 완료, 최신 서술은 "후속 2 — `review/code/2026/07/26/12_55_55`"(2R)까지만 기록.
- **관련 plan/커밋**: `git log --oneline origin/main..HEAD` 기준 이 항목을 만든 커밋 계열은 `dad70c7b2`(1R 이전 최초 조치) → `ff87ede27`/`107133cfd`(1R C1-C4/W1-W8, 컨테이너·Parallel 확장) → `10b27c320`(2R C5/W9-W13) → **`2ca6ada66`(3R W14-W18) → `0f4047426`(4R W19·W20) → `410d913fe`(5R W25) → `3428129b1`(6R W26·W27)** 까지 7 라운드에 걸쳐 이어졌다. `git log --oneline origin/main..HEAD -- plan/in-progress/node-cancellation-residual-signal-propagation.md` 로 확인하면 이 plan 파일을 마지막으로 건드린 커밋은 `2ca6ada66`(3R, §5→§2.2 인용 정정용 1줄 편집)이고, **그 뒤 4R~7R(`0f4047426`·`410d913fe`·`3428129b1`·`364646d18`) 는 이 파일을 전혀 건드리지 않았다**.
- **상세**: 4R~6R 에서 실제로 고쳐진 것은 이 plan 문서 어디에도 이름이 등장하지 않는다(grep 결과 "Sub-Workflow"·"Background"·"W14"~"W27"·"3R"~"7R" 전부 0건):
  - **W14/W18(3R)** — `containerCancelCheckedAtMs` 스로틀 Map 이 **Background 서브그래프**(`executeBackgroundSubgraph`, 부모와 동일 `executionId` 공유) 경로에서 정리되지 않아 무한 성장 누수.
  - **W15(3R)→W19(4R)** — 엔진의 `executeNode` catch 가 `ExecutionCancelledError` 를 분류하지 않아 **Sub-Workflow 노드**(`workflow.handler.ts`)의 취소가 `failed` 로 오분류 + 내부 message(executionId 포함) WS 노출(W15), 1차 수정은 `ParkReleaseSignal` 패턴을 잘못 복제해 노드가 **영구 `running`** 으로 잔류하는 새 결함을 만듦(W19, 커밋 `0f4047426` — "취소된 Sub-Workflow 노드가 영구 running 으로 남던 결함").
  - **W20(4R)** — `errorHandling.policy:'retry'` 노드에서 취소가 최대 3회 재시도+백오프(최대 7초) 뒤에야 수렴하던 오분류.
  - **W25(5R)** — 두 catch 의 취소 종결 로직을 `markNodeCancelled` 헬퍼로 추출(리팩터).
  - **W26/W27(6R)** — JSDoc 배치 정정 + `error` 키 부재 불변식 결속.
  - 7R(`364646d18`)은 전원 NONE 으로 수렴 확인만 하고 코드 변경 없음.
- 즉 "컨테이너·Parallel·Sub-Workflow·Background 까지 확장됐다"는 실제 구현 사실 중 **Sub-Workflow·Background 확장 부분은 plan 문서에 전혀 반영돼 있지 않다.** 체크박스가 `[x]` 로 닫혀 있어 이 항목만 읽으면 Sub-Workflow 노드가 별도의 심각한 결함(취소를 `failed` 로 오분류 → 영구 `running` 잔류)을 겪었다가 고쳐졌다는 사실도, Background 경로의 메모리 누수 수정도 알 수 없다.
- **동반 문제**: `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` "추가 위임 (2026-07-26 #6)" 절(§6 표에 넣을 신규 행 제안 문구, `:280`)도 **1R 커밋(`ff87ede27`)에서 멈춘 뒤 한 번도 갱신되지 않았다**(`git log -- 그 파일` 확인). 제안 문구는 "선형 3곳 + 컨테이너(아이템 경계)/Parallel(노드 경계)" 만 언급하고 Sub-Workflow(`executeNode` 분류)·Background(스로틀 정리)는 빠져 있다 — project-planner 가 이 문구를 그대로 spec 에 옮기면 **새로운 spec-drift**(커버리지 서술 누락)가 생긴다.
- **제안**: (1) plan 문서에 "후속 3 — review 13_47_42~16_20_52 (3R~7R)" 절을 추가해 W14~W27 요약(Sub-Workflow `executeNode` 취소 분류·Background 스로틀 정리·retry 오분류·리팩터·invariant 보강)을 반영. (2) "추가 위임 #6" 의 §6 표 제안 문구를 이 확장을 포함하도록 갱신 — project-planner 가 실제로 spec 에 반영하기 전에 이 위임 문서부터 최신화해야 한다.

### [WARNING] 백로그 7건 중 5건이 plan 어디에도 기록되지 않음

`review/code/2026/07/26/14_45_30/RESOLUTION.md` 4R §범위 판정 이후 라운드마다("이월 백로그") 반복 언급된 7개 항목을 `plan/in-progress/node-cancellation-residual-signal-propagation.md` 및 `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` 전체 grep 으로 대조한 결과:

| 백로그 항목 | plan 기록 여부 | 근거 |
|---|---|---|
| `runParallel` 이 `ParallelResult.failures` 미소비 | **기록됨** | `node-cancellation-residual-signal-propagation.md` "백로그 — 이번 라운드 범위 밖으로 명시적으로 남긴 항목" 절 |
| `ParallelExecutor 'stop'` 의 `failures[0]` 우선순위 레이스 | **기록됨** | 같은 절 |
| 선재 spec 파일(`execution-engine.service.spec.ts`) 구조적 flakiness(W23, `flushResumeDrive`) | **미기록** | 두 plan 파일 전체 grep 0건. `execution-engine-residual-gaps.md` 등 인접 plan 에도 없음 |
| 가드 시퀀스 헬퍼 승격(W8, `assertActiveTimeWithinLimit`+`assertExecutionNotCancelled` 3중 복제 통합) | **미기록** — 그런데 `review/code/2026/07/26/11_48_55/RESOLUTION.md:25` 는 "가드 시퀀스 헬퍼 승격은 중간 크기 후속 작업으로 **이미 plan 에 명시돼 있음**(`node-cancellation-residual-signal-propagation.md` §6 표 W8 원문)" 이라고 적었으나 **이 주장은 사실이 아니다** — 해당 plan 파일에 "가드"·"헬퍼" 조합 문자열이 없다(유일한 "헬퍼" 언급은 무관한 `http-request.handler.ts` 리스너 정리 헬퍼). 이후 3R~7R 도 "이미 plan 에 있다"는 이 잘못된 전제를 그대로 이어받아("W8" 라벨만 반복) 실제로 적어 넣은 라운드가 없다 | `11_48_55/RESOLUTION.md:25,64,67`, `12_55_55/maintainability.md:35` 등 |
| shutdown `FAILED`(`SERVER_INTERRUPTED`) 를 `assertExecutionNotCancelled` 가 감지 못함 | **미기록** — `11_48_55/concurrency.md:20` 이 명시적으로 "`assertExecutionNotCancelled` 를 `status IN (CANCELLED, FAILED)` 로 넓히는 안이 [BLOCKED 결정]에 포함돼야 한다는 점을 **그 트래킹 문서에 명시적으로 남길 것을 권장**(현재는 CANCELLED 사례만 언급됨)" 이라고 콕 집어 요청했으나, plan 의 BLOCKED 항목(`:53-63`)도 위임 문서(`spec-update-node-cancellation-shutdown-classification.md`)도 이 구체적 제안(`status IN (...)` 확장안)을 담지 않았다 | `concurrency.md:17-20,28` |
| WS 프로토콜 spec(`6-websocket-protocol.md`)의 `execution.node.cancelled` 생산자·필드 서술 갱신(신규 `ExecutionCancelledError` 생산자 반영, planner 위임) | **미기록** | `15_56_53/RESOLUTION.md:16`·`scope.md:111` 이 "planner 위임"으로 명시했으나 두 plan 파일 어디에도 이 항목이 없다. `spec-update-node-cancellation-shutdown-classification.md` 의 §4 위임(2026-07-25 #4)에 있는 "`6-websocket-protocol.md §4.1`" 언급은 **다른** 선재 이슈(`meta.success=false` 불일치)를 가리키며 이번 신규 지적과 무관 |
| harness diff-list 갭(코드 fix 커밋과 리뷰 산출물이 같은 커밋에 있으면 리뷰 프롬프트 파일 목록에서 실제 소스가 누락되는 하네스 결함) | **미기록** | `15_30_00/RESOLUTION.md:15` 가 명시적으로 "harness 백로그"로 분류했지만, `plan/in-progress/harness-*.md`(consistency-summary-downgrade-rule·env-value-subpattern-dedup·review-gate-ci-backstop) 3개 및 두 대상 plan 전체에 "diff-list" 문자열이 0건 — 5R~7R 에 걸쳐 5~6명이 반복 지적했음에도(`15_30_00`·`15_56_53`·`16_20_52`) 추적 문서가 없다 |

- **상세**: 7건 중 2건만 실제로 plan 에 남았고, 나머지 5건은 각 라운드 RESOLUTION/SUMMARY 안에서만 "백로그"라고 말해질 뿐 실제 plan/위임 문서에는 옮겨지지 않았다. 특히 "가드 시퀀스 헬퍼 승격" 은 **이미 기록됐다는 잘못된 주장**이 4라운드 넘게 반복 인용되면서 아무도 실제로 적어 넣지 않은 채 방치된 사례라 재발 위험이 높다(다음에 이 항목을 참조하는 사람도 "이미 plan 에 있다"는 텍스트만 보고 실제로는 없다는 것을 확인하지 않을 수 있다).
- **제안**: `node-cancellation-residual-signal-propagation.md` "백로그 — 이번 라운드 범위 밖으로 명시적으로 남긴 항목" 절에 5건을 추가:
  1. 선재 spec 파일(`execution-engine.service.spec.ts`) 구조적 flakiness(`flushResumeDrive`) — 분할 규모 작업.
  2. 가드 시퀀스 헬퍼 승격(`assertActiveTimeWithinLimit`+`assertExecutionNotCancelled` 3중 복제 통합) — 중간 규모 리팩터.
  3. BLOCKED 항목에 "`assertExecutionNotCancelled` 를 `status IN (CANCELLED, FAILED)` 로 넓히는 안" 을 결정 옵션으로 명시(shutdown FAILED 미감지).
  4. WS 프로토콜 spec(`6-websocket-protocol.md`)의 `execution.node.cancelled` 생산자·필드 서술 갱신 — planner 위임.
  - harness diff-list 갭은 이 plan 이 아니라 `plan/in-progress/harness-*.md` 계열(또는 신규 harness plan)에 기록해야 한다 — node-cancellation plan 의 책임 범위 밖.

### [INFO] BLOCKED 항목·미해결 결정은 정상 보존 확인 (문제 없음, 참고용)

- `⛔ BLOCKED — Workflow 단위 timeout / graceful shutdown 의 노드 abort 통합` 항목(`node-cancellation-residual-signal-propagation.md:53-63`)은 여전히 `[ ]` 미완료, `spec-update-node-cancellation-shutdown-classification.md` 의 (a)/(b) 택일 체크박스도 전부 `[ ]` 미결.
- `git diff origin/main..HEAD --stat -- '**/shutdown-state*'` 결과 0건 — 이번 7라운드 어떤 커밋도 `shutdown-state.service.ts` 를 건드리지 않아, 이 BLOCKED 결정을 우회하는 코드 변경은 없다.
- `spec/conventions/node-cancellation.md` §6 표의 해당 행도 여전히 `—`(미구현)로 남아 있어 spec·plan·코드 3자가 일치한다.
- 단 위 두 번째 발견사항의 "shutdown FAILED 미감지" 세부 — 리뷰가 명시적으로 요청한 결정 옵션 보강이 누락된 것은 BLOCKED 항목 자체를 무효화하진 않지만, 나중에 project-planner 가 이 문서만 보고 결정할 때 불완전한 정보로 결정할 위험이 있다는 점에서 위 WARNING 과 연결된다.

## 요약

이번 세션(7 라운드 `/ai-review`, `dad70c7b2`~`364646d18`)의 실제 코드 변경 범위는 plan 문서가 서술하는 것보다 넓다 — 선형 3곳·컨테이너·Parallel 확장까지는 plan 에 정확히 반영돼 있으나, 3R~6R 에서 발견·수정된 **Sub-Workflow 노드의 취소 오분류/영구 running**·**Background 서브그래프의 스로틀 Map 누수**·retry 정책 오분류·리팩터·invariant 보강은 plan 문서 어디에도 서술되지 않은 채 체크박스만 `[x]` 로 닫혀 있다. 같은 이유로 위임 문서(`spec-update-node-cancellation-shutdown-classification.md`)의 §6 표 제안 문구도 구식이라, project-planner 가 그대로 spec 에 반영하면 새 spec-drift 가 생길 수 있다. 백로그 7건 중 5건("가드 시퀀스 헬퍼 승격"은 특히 "이미 기록됨"이라는 반복된 오기록으로) 이 실제로는 어느 plan 문서에도 적히지 않았다. 반면 BLOCKED 항목(workflow-timeout/shutdown 노드 abort)은 코드·spec·plan 3자가 정확히 일치하는 상태로 보존돼 있고 어떤 커밋도 이를 우회하지 않았다 — 미해결 결정과 충돌하는 CRITICAL 은 발견되지 않았다.

## 위험도

MEDIUM
