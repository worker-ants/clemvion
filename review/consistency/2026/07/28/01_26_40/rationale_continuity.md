# Rationale 연속성 검토 결과

> 참고: 전달된 `_prompts/rationale_continuity.md` 는 컨텍스트 예산 초과로
> `spec/5-system/4-execution-engine.md` (본 PR 과 가장 밀접한 실행엔진 spec, 292KB) 를
> **본문 없이 누락**하고 있었다("컨텍스트 예산 초과로 생략된 파일 18개" 목록에 명시). 또한
> 프롬프트에 실제 코드 diff 가 포함돼 있지 않았다. 두 문제 모두 워킹트리
> (`/Volumes/project/private/clemvion/.claude/worktrees/retry-turn-cancel-guard-ba75a2`) 를
> 절대경로로 직접 `Read`/`git diff`/`git log` 하여 우회했다 — `git diff origin/main..HEAD`,
> `spec/5-system/4-execution-engine.md`, `spec/conventions/node-cancellation.md`,
> `plan/in-progress/retry-turn-terminal-guard.md` 를 전문 확인.

## 검토 대상 요약

이번 PR(`retry-turn-terminal-guard`)의 실제 diff 는 `spec/` 을 전혀 건드리지 않는다 —
`codebase/backend/src/modules/execution-engine/retry-turn.service.ts`(+167)와 그 spec
테스트, `CHANGELOG.md`, `plan/in-progress/retry-turn-terminal-guard.md` 뿐이다. 따라서 본
Rationale 연속성 검토의 "target" 은 **이 코드 변경이 기존 spec 의 `## Rationale` 이 규정한
취소(cancellation) invariant 와 정합하는가**이다.

## 발견사항

- **[WARNING] `retry_last_turn` replay 취소 의미론 — 결정은 이미 번복됐는데 옛 Rationale 이 정정 없이 방치돼 있고, 이번 PR 이 그 번복된(새) 쪽 위에 코드를 쌓았다**
  - target 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` 신규
    `finalizeGuarded()` (diff `@@ -414,6 +415,132 @@` 이하) — `completeRetryExecution` /
    `failRetryExecution` 양쪽이 경유. 특히 `target === ExecutionStatus.CANCELLED` 멱등 분기의
    `COALESCE(finished_at, …)` 처리와, `canTransition(live.status, target)` 가 `false` 면
    (예: `live.status === CANCELLED`) 자연 종결(FAILED/COMPLETED) 저장·이벤트 emit 을 **전부
    스킵**하는 로직. `plan/in-progress/retry-turn-terminal-guard.md` "project-planner 위임"
    절(파일 끝)이 이 모순을 이미 스스로 인지·기록하고 있다.
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` `## Rationale`(1308행 이하) →
    `### \`failed → running\` 재진입 전이 (R1 의 retry 실행 경로)` (1448–1454행), 특히 1454행:
    > "replay 가 RUNNING 으로 도는 도중 도착한 사용자 cancel 은 **graceful no-op** 이다 …
    > 취소는 replay 가 다음 `waiting_for_input` park 에 도달했을 때 … 발효된다. **(replay 가
    > park 없이 그 turn 에서 종결되면 cancel 은 무효과로 흘려보내진다.)**"

    동일 주장이 본문 §1.1 상태 전이표 77행에도 그대로 있다("replay 가 RUNNING 으로 도는 중
    도착한 cancel 은 graceful no-op … 취소는 다음 waiting_for_input park 에서 비로소
    발효된다").
  - 상세: 위 Rationale 은 "park 에 도달하지 못하고 그 turn 안에서 자연 종결되면, 그 사이
    도착한 cancel 은 그냥 버려진다(=자연 종결이 이긴다)"고 **명시적으로 단언**한다. 그러나:
    1. 같은 파일 §1.1 81–92행(2026-07-27 신설, `#1023`)은 "짝 전이는 방향과 무관하게 no-op 이
       될 수 있다"며 정반대로 — 대상 행이 이미 terminal(cancelled 포함)이면 **자연 종결
       쪽이 지고(아무 것도 안 쓰고 `false` 반환)** DB 의 cancelled 가 보존된다고 규정한다.
       근거 문장: "이 가드가 없으면 … full-entity save 가 동시 도착한 취소를 덮어써, 사용자
       Stop 이 지연되는 게 아니라 **소실**된다."
    2. `spec/conventions/node-cancellation.md` §2.4 + 그 `## Rationale`
       ("왜 짝 전이에 terminal 가드가 필요한가", 2026-07-27)도 동일하게 "cancel 이 이미 DB 에
       커밋됐다면 그 이후의 자연 종결 쓰기는 반드시 skip 되어야 하며, 그러지 않으면 Stop 이
       소실된다"를 시스템 invariant 로 못박는다 — 즉 **이것이 현재 합의된, 최신 invariant**다.
    3. 이번 PR 의 `finalizeGuarded` 는 정확히 이 (2)의 (현재 유효한) invariant 를
       `retry_last_turn` replay 라는 **새 코드 경로**에 그대로, 올바르게 확장 적용한다 — DB 가
       이미 `CANCELLED` 면 `canTransition(CANCELLED, FAILED|COMPLETED)` 가 `state-machine.ts`
       (`ALLOWED_TRANSITIONS[CANCELLED] = []`)에 의해 항상 `false` 이므로 자연 종결 쓰기는
       **무조건 스킵**된다 — park 도달 여부와 무관하게, 그리고 그 turn 이 park 없이 끝났어도
       cancel 은 "무효과로 흘려보내지지" 않고 보존된다. 즉 코드는 **옳다**. 다만 이는 1454행이
       서술하는 시나리오("park 없이 종결되면 cancel 무효과")를 정확히 반증하는 동작이며, 이번
       PR 은 그 반증되는 동작을 새 파일에 한 번 더 재현·강화하면서도 1454행/77행을 정정하는
       Rationale 을 함께 남기지 않았다.
    4. `plan/in-progress/retry-turn-terminal-guard.md` 자신도 이 모순을 인지하고 "코드는
       유지하고 spec 을 정정해야 한다"고 결론짓지만, 그 spec 정정은 아직 일어나지 않았고
       기존에 이 영역 spec 갱신을 추적하는
       `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md`
       (owner: project-planner) 도 `failed → running`/`retry_last_turn` 관련 절은 다루지
       않는다(파일 전체에 "retry_last_turn"·"replay"·"graceful no-op" 언급 0건) — 즉 이
       모순은 **아직 어떤 project-planner plan 에도 정식으로 등재되지 않은 새 항목**이다.
    5. 왜 방치하면 위험이 커지는가: 이 Rationale 항목을 신뢰하는 다음 개발자는 "park 없이
       끝나는 retry replay 는 cancel 을 무시해도 된다"는 (이제는 틀린) 전제로 코드를 수정할 수
       있고, 이는 바로 `#1021`/`#1022`/`#1023` 이 고친 "Stop 이 부수효과를 못 멈추고 조용히
       소실되던" 결함 클래스를 재도입하는 길이 된다. 같은 클래스의 결함이 이 코드베이스에서
       최근 3 PR 연속으로 재발한 이력이 있어(recurrence 위험이 사변적이지 않음), 문서 정정의
       우선순위는 높게 잡을 것을 권한다.
  - 제안: project-planner 턴에서 (a) §1.1 상태 전이표 77행과 (b) `## Rationale`
    "`failed → running` 재진입 전이" 1448–1454행을 "DB 에 이미 커밋된 cancel 은 park 도달
    여부와 무관하게 항상 우선하며, 자연 종결(retry 성공/재실패)은 guarded/idempotent 쓰기로
    스킵된다(§2.4, `finalizeGuarded`)"로 정정. 이 항목을
    `spec-update-node-cancellation-shutdown-classification.md` 에 신규 위임 절로 추가하거나
    별도 plan 을 신설할 것. 필요하면 §1.1 81–92행에서 이미 쓰인 문구를 그대로 재사용 가능
    (해당 절은 이미 올바른 새 invariant 를 반영하고 있어 "새 Rationale 작성"이 아니라 "인접한
    stale 서술의 교정"에 가깝다).

- **[WARNING] `node-cancellation.md` §6 구현 현황 표에 이번 PR 의 신규 소비자 행 누락**
  - target 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`
    `finalizeGuarded` (신규 §2.4 DB 관측 취소 가드의 3번째 소비자 — 기존
    `execution-engine.service.ts` 의 짝 전이/`finalizeFailedExecution`/
    `failFirstSegmentSetup`/`executeSync` timeout 에 이어).
  - 과거 결정 출처: `spec/conventions/node-cancellation.md` `## 6. 구현 현황 / 후속` 표 184행
    ("§2.4 park↔resume 짝 전이 terminal 가드 | ✓ | `execution-engine.service.ts` — …") — 이
    표는 "2026-07-26 코드 대조로 갱신"이라는 전제로, §2.4 가드를 실제로 구현한 모든 지점을
    빠짐없이 기록한다는 원칙(이미 이 문서 자체가 §6 표 갱신 누락을 두 차례
    "SPEC-DRIFT"로 다룬 전례가 있음 — 위 spec-update 계획서의 #2/#3 절)을 세운다.
  - 상세: `retry-turn.service.ts` 는 §2.4 가드와 동일한 원칙(DB 관측 cancelled 는 자연
    종결을 이긴다)을 새 파일에 새로 구현했지만, 184행 표는 이 소비자를 열거하지 않는다 —
    표만 보면 §2.4 가드가 `execution-engine.service.ts` 4개 지점에만 있다고 오독된다.
    `plan/in-progress/retry-turn-terminal-guard.md` 자신도 정확히 이 갱신을 project-planner
    위임 항목으로 이미 요청해 두었다.
  - 제안: 184행 아래(또는 인접)에 `retry-turn.service.ts`(`finalizeGuarded`, `completeRetryExecution`/`failRetryExecution` 소비) 행을 추가.

- **[INFO] 준수 확인 — 회귀·번복 오인 소지 없음**
  - `finalizeGuarded` 는 `## Rationale` "R2 (`waiting_for_retry` 신설) 기각" (1412행) 을
    재도입하지 않는다 — 신규 상태를 만들지 않고 기존 `allowRetryReentry` opt-in
    (`FAILED → RUNNING`) 만 사용한다.
  - `finalizeGuarded` 의 멱등 분기가 `EngineDriver`/`updateExecutionStatus` choke point 를
    우회하고 raw `createQueryBuilder().update()` 를 쓰는 점(이미 ai-review 5R 에서 WARNING
    으로 등재·defer 됨)은 `## Rationale` §7.5 "재개 race 보장을 DB 원자 claim 으로"(1354행,
    "구현: … `updateExecutionStatus`/`assertTransition` choke point 를 **우회**하는 raw
    conditional UPDATE") 절이 **동일한 사유(조건부 원자성 필요)로 choke point 우회를 이미
    선례화**해 두었으므로, 원칙 위반이라기보다 기존 예외 패턴의 연장에 가깝다 — 별도
    발견사항으로 승격하지 않았다(중복 방지 차원에서 기존 ai-review 트랙에 위임).
  - `error` 를 SET 절에서 제외한 것("W16(취소 시 error 미저장)")과 `finalizeCancelledExecution`
    의 `??` 병합 계약(§2.3 JSDoc, `execution-engine.service.ts:4694`) 인용은 실제 코드로
    검증됨 — 지어낸 근거 없음.

## 요약

이번 PR 자체의 코드(`finalizeGuarded`)는 `spec/conventions/node-cancellation.md` §2.4 가
확립한 **현재의 올바른** 취소-보존 invariant를 새 소비자에 일관되게 확장 적용한 것으로, 그
자체로는 원칙을 위반하지 않는다(target 이 기각된 대안을 재도입하지도, 현재 합의된 invariant를
직접 위반하지도 않는다). 문제는 그 invariant 가 확립되기 전(2026-06-06)에 쓰인
`spec/5-system/4-execution-engine.md` 의 `## Rationale`("failed → running 재진입 전이")과
본문 상태 전이표가, `#1021`~`#1023` 및 이번 PR 로 사실상 폐기된 옛 결정("park 없이 종결되면
cancel 은 무효과")을 여전히 시스템 invariant 로 단언하고 있고, 이 모순이 아직 어떤
project-planner 추적 문서에도 정식 등재되지 않았다는 점이다(결정 번복은 의도된 것이 맞지만
새 Rationale 이 그 자리를 대체하지 않은 전형적 케이스). 이는 developer 자신이 이미 plan 에
"project-planner 위임"으로 명시한 항목이며, 본 검토는 그 존재를 spec 원문 직접 대조로
확인·확정한 것이다 — 코드 자체의 정합성 위험은 낮지만, spec 정정 전에는 이 문서를 SoT 로
신뢰하는 향후 작업이 `#1021`/`#1022` 급 결함(최근 이 영역에서만 3차례 재발한 클래스)을
반복 재도입할 실질적 위험이 있어 우선순위는 높게 볼 것을 권한다.

## 위험도

HIGH
