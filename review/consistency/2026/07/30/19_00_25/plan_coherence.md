### 발견사항

- **[WARNING] 8R/9R ai-review 라운드의 후속 항목이 plan 마스터 백로그에 온전히 반영되지 않음**
  - target 위치: `spec/5-system/4-execution-engine.md` §7.4/§7.5(원자 claim/재진입 Rationale) — 이번 diff 가 실제로 구현·문서화한 영역
  - 관련 plan: `plan/in-progress/retry-turn-terminal-guard.md` 의 "### 코드 — 우선순위 순" 마스터 표(#1~#34)
  - 상세: 이 plan 은 1~7차·10~12차 라운드 전부 `## N차 라운드 (review/code/.../TIMESTAMP)` 전용 섹션 + (7R/11R/12R 는) `RESOLUTION.md` 로 처리 근거를 남겼다. 그런데 `review/code/2026/07/30/12_56_04`(커밋 메시지가 지칭하는 "8R", CRITICAL 1건 — `reparkAiResumeTurn`/`lockNonTerminalExecutionRow` opts 미전파로 `FAILED→RUNNING`/`FAILED→WAITING_FOR_INPUT` 짝 전이가 절대 persist 안 되던 결함, `2ca44b769` 로 수정)와 `review/code/2026/07/30/15_33_04`("9R", CRITICAL 2건 — re-park 회귀테스트 부재 + spec 3문서 SPEC-DRIFT, `1838c6fec` 로 수정) 두 세션은 **`RESOLUTION.md` 도 없고 plan 에 대응 라운드 섹션도 없다**(직접 확인: `find review/code/2026/07/30/ -name RESOLUTION.md` → `11_41_20`/`17_37_14`/`18_26_50` 만 존재, `12_56_04`/`15_33_04`/`16_42_36` 없음. plan 안에 `12_56_04`/`15_33_04`/"8차 라운드"/"9차 라운드" 문자열 전무). 두 세션의 **CRITICAL 은 커밋으로 확인 가능**하지만, WARNING 항목은 부분적으로만 마스터 표에 승격됐다:
    - 9R WARNING #3·#5(SQL 삼항식·opts 변환 헬퍼 중복)만 표 `#23`(`10R W1·9R W3·W5`)으로 승격됨 — 이 항목은 정상 반영된 사례.
    - **9R WARNING #1**("재-park 로 새로 도달 가능해진 `FAILED→RUNNING`/`WAITING_FOR_INPUT` 비-terminal persist 가 stale `error`/`finishedAt`/`durationMs` 를 지우지 않아 `GET /executions/:id` 폴링 소비자에게 장시간 모순 노출") — SUMMARY 자신이 "기존 plan #5 와 한 번에 해소 가능"이라 제안했으나, 마스터 표 `#5`는 여전히 `"성공(COMPLETED) 종결에서도 옛 실패 메시지 재기록 가능"`(4R INFO 2 유래, COMPLETED-terminal 시나리오 한정 서술)만 담고 있어 9R 이 새로 발견한 "장기 비-terminal(재-park) 노출" 서브케이스가 반영되지 않았다.
    - **9R WARNING #2**(같은 Execution 안 서로 다른 두 FAILED 멀티턴 노드가 이번 fix 로 처음 동시 재진입 가능해져 소유권 모호성 위험) — 마스터 표 어디에도 대응 항목이 없다(표 전체·`형제`/`복수 FAILED`/`소유권 모호성` grep 0건). 가까운 사촌인 `#20`(10R W5/11R 증거보강)은 "RUNNING 상태에서 형제 브랜치가 살아있는" 다른 시나리오라 대체하지 않는다.
    - **8R WARNING #2**(`retry-turn.service.ts:244-250` `spawnedId` null-invariant 방어 분기가 어떤 테스트로도 미검증 — 리뷰어가 "이론상 불가능 서술 방어분기가 실은 미검증"인 동일 클래스의 CRITICAL #1/#2 재발 통로라 **defer 부적절**이라고 명시 판단) — 현재 코드(`retry-turn.service.ts:246-249`, `RetryLastTurnError.notFound` throw)에도 대응 회귀 테스트가 없음을 직접 확인(`retry-turn.service.spec.ts` 에 `notFound`/`spawn failed`/`spawnedId` invariant 테스트 0건). "defer 하지 말라"고 명시된 항목이 fix 도 안 되고 마스터 표에 P-등급으로 등재되지도 않았다.
  - 제안: `retry-turn-terminal-guard.md` 마스터 표에 위 3건(9R W1 서브케이스를 `#5`에 각주로 흡수 또는 신규 행, 9R W2 신규 행, 8R W2 신규 행 — "defer 부적절" 명시)을 추가하고, 가능하면 `12_56_04`/`15_33_04` 세션에 대해서도 다른 라운드와 동일하게 `RESOLUTION.md`(또는 최소 plan 섹션)를 사후 작성해 처분 근거를 명문화할 것.

- **[WARNING] 이번 consistency-check 세션(19_00_25) 자체가 harness 예산 초과 버그로 실제 target 을 검토하지 못한 채 시작됨 — 이미 추적 중인 결함의 재발**
  - target 위치: 이 세션의 `## Target 문서` 번들(`spec/5-system/` 전체 스냅샷) 및 `plan/in-progress/**` 번들
  - 관련 plan: `plan/in-progress/harness-review-gate-ci-backstop.md` "재발 관측(2026-07-28) — 6번째/7번째" 절
  - 상세: 이번 세션의 5개 checker 프롬프트(`convention_compliance`/`cross_spec`/`naming_collision`/`plan_coherence`/`rationale_continuity`) 전원이 `spec/5-system/` 사전순 정렬 때문에 `1-auth.md`/`10-graph-rag.md`/`11-mcp-client.md` 3개 파일만 받고, 이번 PR 이 실제로 변경한 `4-execution-engine.md`(diff +78/-6)·`6-websocket-protocol.md`(diff +1/-1)는 전혀 못 받았다(직접 확인: 5개 프롬프트 전부 `grep -c '^#### spec/5-system/'` = 3). 가장 관련도 높은 plan `retry-turn-terminal-guard.md`(이 spec 변경의 `spec_impact` 자체)도 "컨텍스트 예산 초과로 생략된 파일 47개" 목록에 들어가 본문이 빠졌다. 이 정확히 동일한 증상(알파벳순 정렬로 두 자리 번호가 한 자리를 앞서 `4-execution-engine.md` 가 밀려남)이 `harness-review-gate-ci-backstop.md` 에 2026-07-26~07-28 사이 최소 6회 문서화돼 있고 "harness 코드 수정이 해법"(자연 정렬 + diff 매칭 spec/plan 우선 포함)이 아직 미착수([ ] 상태)다. 오늘 재발은 최소 8번째 사례다.
  - (완화 조치) 본 checker 는 프롬프트 지시("여기 없다는 사실을 근거로 삼지 말고 Read 로 직접 열어라")에 따라 워크트리 절대경로로 `4-execution-engine.md`/`6-websocket-protocol.md`/`retry-turn-terminal-guard.md`/`spec-update-node-cancellation-shutdown-classification.md`/`spec-update-retry-claim-backstop-gap.md`/`execution-engine-residual-gaps.md` 를 직접 Read 하고 `git diff origin/main...HEAD` 로 실제 변경분을 대조해 우회했다. 위 발견사항 전부는 이 우회 확인에 근거하며, 우회하지 않았다면 이 세션은 실제 대상을 한 줄도 못 보고 "발견 없음"을 반환했을 것이다.
  - 제안: `harness-review-gate-ci-backstop.md` 에 오늘(2026-07-30, 세션 `19_00_25`, scope `spec/5-system/`, checker 5/5 전원 동일 증상) 재발 기록을 추가해 자연 정렬/우선 포함 수정의 우선순위 근거(발생 빈도)로 삼을 것.

### 정합성 확인 완료 항목 (참고, 문제 아님)

직접 대조 결과 아래는 정합했다 — 이번 diff 가 plan 의 미해결 결정을 우회하거나 선행 plan 을 무시한 사례는 발견되지 않았다.

- `spec-update-node-cancellation-shutdown-classification.md` 최상단 "결정이 필요하다 (택일 a/b, SIGTERM/timeout abort 분류)"는 여전히 미결이나, 이번 diff 의 codebase 변경 범위(`ai-turn-orchestrator`/`continuation-execution.processor`/`engine-driver.interface`/`execution-engine.service`/`retry-turn.service`/`state/state-machine`)는 `shutdown-state.service.ts`/workflow-timeout 분류 경로를 전혀 건드리지 않아 그 미결 결정과 무관하다.
- `spec-update-node-cancellation-shutdown-classification.md` #8·#10(park 짝 전이 cancel 불변식, retry_last_turn 원자성 spec 반영)은 "이행 완료"로 표시돼 있고, 실제 spec 본문(`4-execution-engine.md:1392-1396` 등)과 `git show 025aedd0f` 로 대조해 제안 그대로 반영됐음을 확인했다.
- `plan/complete/spec-update-retry-claim-backstop-gap.md`(SPEC-DRIFT — `recoverStuckExecutions` 백스톱이 2차 claim 경로에 닿지 않음)의 제안 문구가 현재 spec 본문에 그대로 반영돼 있음을 grep 으로 확인했고, `retry-turn-terminal-guard.md` #15/#17 에 대한 spec 의 교차 참조도 실제 항목 번호와 일치한다.
- `spec/5-system/4-execution-engine.md` frontmatter `pending_plans:` 에 `retry-turn-terminal-guard.md` 가 추가된 것은 그 plan 의 `spec_impact` 선언과 일치하는 정상 갱신이다.
- `execution-engine-residual-gaps.md`(G2, SIGTERM+errorPolicy continue, defer 확정)는 이번 PR 의 코드 변경 범위와 겹치지 않아 갱신 불요.
- `spec/4-nodes/3-ai/1-ai-agent.md` 변경(커밋 `1838c6fec`)은 `retry-turn-terminal-guard.md` 의 `spec_impact`(현재 `4-execution-engine.md`/`node-cancellation.md` 2건만 등재)에는 없으나, 실질적으로는 같은 PR 의 project-planner 위임(spec-update-node-cancellation-shutdown-classification.md 관행)과 동일한 SPEC-DRIFT 정정으로 처리됐고 `9R CRITICAL#2`/`spec-update-node-cancellation-shutdown-classification.md` 계열 선례를 따른 정상 경로다 — `spec_impact` 목록에 이 파일이 없는 것은 사소한 프론트매터 누락이나 실제 변경 자체는 plan 이 추적하는 라운드(9R) 산출물이라 별도 신규 후속 필요는 없다.

### 요약

이번 PR(`retry-turn-terminal-guard.md`, retry_last_turn 원자 claim + 짝 전이 DB 가드)의 spec/5-system 변경은 전반적으로 plan 과 매우 밀접하게 교차 추적되어 있다 — 새 Rationale 절이 plan 의 정확한 항목 번호(#15/#17)를 인용하고, SPEC-DRIFT 는 전용 plan 문서(`spec-update-retry-claim-backstop-gap.md`)로 제안·반영·`complete/` 이관까지 완결됐으며, 미해결 결정(SIGTERM/timeout 분류 a/b)과는 코드 경로가 겹치지 않아 충돌이 없다. 다만 12라운드에 걸친 review 이력 중 8R·9R 두 라운드만 다른 라운드와 달리 `RESOLUTION.md`도 plan 섹션도 없이 처리돼, CRITICAL 은 커밋으로 확인되나 그 라운드의 WARNING 3건(재-park 비-terminal stale error 노출, 형제 FAILED 동시 재진입 소유권 모호성, "defer 부적절"로 명시된 spawn null-invariant 테스트 갭)이 plan 마스터 백로그에서 누락된 채로 남아 있다. 또한 이번 검토 세션 자체가 이미 6회 이상 문서화된 harness 예산초과 번들링 결함으로 실제 target(`4-execution-engine.md`/`6-websocket-protocol.md`)과 가장 관련 있는 plan(`retry-turn-terminal-guard.md`)을 프롬프트에서 누락한 채 시작됐다(직접 Read 로 우회 확인). 두 사안 모두 plan 갱신으로 해소 가능한 수준이며 PR 의 실질 정합성을 막는 결정 충돌은 발견되지 않았다.

### 위험도
LOW
