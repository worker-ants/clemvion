# 문서화(Documentation) Review

대상: `2ca44b769 fix(engine): retry 재진입 짝 전이가 DB 가드에 막혀 절대 persist 되지 않던 결함 (8R CRITICAL)`
검토 파일: `state/state-machine.ts`, `execution-engine.service.ts`, `ai-turn-orchestrator.service.ts`, `engine-driver.interface.ts`, `retry-turn.service.ts`

## 발견사항

- **[CRITICAL]** `retry_last_turn` 재진입의 "turn 계속 → re-park(`FAILED → WAITING_FOR_INPUT`)" 결과가 두 SoT spec 문서 어디에도 없음 — 이번 커밋이 그 경로를 처음으로 실제 도달 가능하게 만들었는데도 문서는 성공/실패 이분법에 머물러 있음
  - 위치: (이 5개 리뷰 대상 파일 밖이지만 이번 diff 의 직접 결과라 반드시 지적) `spec/5-system/4-execution-engine.md:40-47`(ASCII 상태 다이어그램), `:66-78`(§1.1 "허용되는 상태 전이" 표, `failed` 행이 `running` 하나뿐), `:1507-1519`(전용 Rationale "### `failed → running` 재진입 전이"); `spec/4-nodes/3-ai/1-ai-agent.md:989`(§7.9), `:1308`(§12.8). 코드 쪽 근거: `codebase/backend/src/modules/execution-engine/state/state-machine.ts`(게이트 30-37, 68-79 — `canTransition` 의 `to === RUNNING || to === WAITING_FOR_INPUT` 분기, 이번 diff 로 `WAITING_FOR_INPUT` 대상이 신설); `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`(게이트 520-533 — `NON_TERMINAL_OR_FAILED_STATUSES_SQL` 신설 docblock, "재진입이 구조적으로 절대 persist 될 수 없었음"이라고 스스로 서술).
  - 상세: 이번 커밋은 `canTransition` 에 `FAILED → WAITING_FOR_INPUT` opt-in 전이를 신설하고, 그 전이가 실제로 DB 에 persist 되도록 세 곳(`lockNonTerminalExecutionRow`/`tryLockActiveExecutionAndSaveNodeExec`/else-분기 guarded UPDATE)을 고쳤다. 커밋 메시지 스스로 "turn 계속(multi-turn 최빈)" 이라 명시하듯 이 전이는 재진입 시나리오 중 **가장 흔한 경로**다. 그런데 이 전이의 공식 SoT 인 `spec/5-system/4-execution-engine.md` §1.1 의 ASCII 다이어그램과 "허용되는 상태 전이" 표는 `failed → running` 한 줄만 있고 `failed → waiting_for_input` 행이 없다. 전용 Rationale 절도 "재진입 성공 시 `completed`, 재실패 시 `failed`" 두 갈래만 서술하고 세 번째(계속 → re-park) 갈래가 없다. `spec/4-nodes/3-ai/1-ai-agent.md` §7.9·§12.8("재진입한 turn 이 성공 종결되면 … 재진입 turn 이 다시 실패하면 …")도 동일하게 이분법이다. 이번 커밋 이전에는 이 전이가 DB 가드에 막혀 **항상 실패**했으므로(그 시점엔 spec 의 이분법 서술이 결과적으로 사실과 어긋나지 않았음) 무해했지만, 이제는 실제로 도달 가능한 런타임 경로가 됐다 — 이 spec 만 읽는 사람(다른 개발자, consistency-checker, FE 팀)은 "재진입은 성공/실패 둘 중 하나로 끝난다"고 잘못 이해하게 된다. `spec/conventions/node-cancellation.md:92-94`(retry 재진입 종결 경로 terminal 가드 서술)도 같은 이분법이라 부수적으로 함께 확인 대상이다.
  - 제안: `developer` 는 `spec/` write 권한이 없으므로(CLAUDE.md 역할 규약) project-planner 턴으로 위임. §1.1 표에 `failed | waiting_for_input` 행 추가("turn 계속 시 re-park, `allowRetryReentry` opt-in") + ASCII 다이어그램 갱신 + Rationale 절에 "계속(re-park)" 세 번째 갈래 추가, `1-ai-agent.md` §7.9/§12.8 에도 동일 갈래 보강. `plan/in-progress/retry-turn-terminal-guard.md` 의 `spec_impact` 트래킹에 항목으로 등재.

- **[WARNING]** 이번 "8R CRITICAL" 결함 수정에 대한 CHANGELOG.md 항목 누락 — 같은 파일·같은 심각도의 직전 선례들과 불일치
  - 위치: `CHANGELOG.md` (파일 최상단, 신규 `## Unreleased` 섹션 부재) — 커밋 `2ca44b769` 는 `CHANGELOG.md` 를 전혀 건드리지 않음(`git show 2ca44b769 --stat` 확인)
  - 상세: `CHANGELOG.md` 는 이 저장소에서 실행 엔진 correctness fix 를 상세히 기록하는 확립된 관례다. 파일 최상단의 두 기존 항목("AI multi-turn resume turn 경계 cancel 가드 + park 짝 전이 lost-update 차단", "외부 cancel(Stop) 후에도 하류 노드 dispatch·부수효과가 계속되던 결함 수정")이 정확히 같은 파일(`execution-engine.service.ts`)의 비슷하거나 더 가벼운 결함을 상세 서술한다. `git log --oneline -- CHANGELOG.md` 로 확인한 직전 선례 커밋들(`771801e3e`, `d3fafbafc`, `24d8ab623` 등 — 전부 `fix(engine)`)은 모두 CHANGELOG 항목을 동반했고, 그중 `771801e3e`("retry-turn 종결 2경로의 무가드 terminal 쓰기 차단")는 바로 이 기능(`retry_last_turn`)의 직전 결함 수정이었다. 반면 이번 커밋은 "재진입이 구조적으로 절대 persist 될 수 없었음"이라고 스스로 표현할 만큼 심각한 회귀(8라운드에 걸쳐서야 발견)인데도 CHANGELOG 에 한 줄도 없다.
  - 제안: 위 두 선례와 동일한 형식으로 "Unreleased" 섹션 신설 — 결함 재현조건(즉시종료 시 CANCELLED 오분류 / 계속 시 동기 throw로 EXECUTION_FAILED 오분류), 수정 4곳, mock 하드코딩("항상 잠금 성공")이 8라운드 동안 결함을 은폐한 경위, SoT 링크(spec §1.1/§1.3, `plan/in-progress/retry-turn-terminal-guard.md`)를 요약해 추가할 것을 권고.

- **[WARNING]** `tryLockActiveExecutionAndSaveNodeExec` 의 JSDoc 이 신규 `opts` 인자를 반영하지 못함 — 같은 diff 의 자매 함수는 갱신됐는데 이 함수와 인터페이스 미러는 누락
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8217-8220`(`@returns` — "true 면 Execution 이 **non-terminal** 이라 … save 했다" 문구, 실제 소스 파일 줄번호로 확인 — 이 함수 본문은 8224 부터 시작하며 프롬프트 게이트 범위(1225줄까지 표시) 밖이라 `Read` 로 직접 확인함) 및 `codebase/backend/src/modules/execution-engine/engine-driver.interface.ts:186-209`(게이트 번호 — `AiTurnEngineDriver.tryLockActiveExecutionAndSaveNodeExec` JSDoc, `opts` 파라미터는 게이트 213)
  - 상세: 이번 diff 는 `tryLockActiveExecutionAndSaveNodeExec` 에 3번째 파라미터 `opts?: { allowRetryReentry?: boolean }` 를 신설하고, 파라미터 바로 위에 상세 인라인 주석(`execution-engine.service.ts` 게이트 545-552 상당, "세 번째 잠금 소비처 …")을 달았다. 그러나 함수 상단 공식 JSDoc 의 `@returns` 는 여전히 "true 면 Execution 이 **non-terminal** 이라 save 했다"로만 서술 — opt-in 시 FAILED(terminal)도 성공 케이스가 됨을 반영하지 않는다. 같은 diff 안에서 자매 함수 `lockNonTerminalExecutionRow` 의 JSDoc 은 정확히 이 뉘앙스("non-terminal(또는 opt-in 시 FAILED)")로 갱신됐다(execution-engine.service.ts 게이트 519 부근, `@param opts.allowRetryReentry` + `@returns` 모두 수정) — 저자가 이 패턴을 알고 실행했음에도 `tryLockActiveExecutionAndSaveNodeExec` 와 그 인터페이스 미러(`engine-driver.interface.ts`)에는 적용하지 않았다. 인터페이스 쪽은 한 걸음 더 나아가 `opts` 파라미터에 대한 설명이 `@param` 이든 인라인 주석이든 전혀 없다 — `engine-driver.interface.ts` 자신의 파일 최상단 docstring(게이트 26-27)이 "메서드 시그니처는 엔진을 단일 진실(source of truth)로 그대로 미러링한다"고 선언하는 계약 파일인데, 정작 신규 파라미터의 의미는 미러링되지 않았다.
  - 제안: `tryLockActiveExecutionAndSaveNodeExec` 의 `@returns`(양쪽 파일)에 `lockNonTerminalExecutionRow` 와 동일하게 "(또는 opt-in 시 FAILED)" 뉘앙스를 반영하고, `engine-driver.interface.ts` 쪽에 최소 1줄이라도 `@param opts.allowRetryReentry` — "retry 재진입 전용, 구현은 engine 참조" 정도를 추가할 것.

- **[INFO]** `ExecutionEngineService` 클래스 최상단 docstring 의 "상태 머신" 한 줄 요약이 retry-reentry 예외 엣지를 언급하지 않음(참고용, diff 범위 밖)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 게이트 441-442 (" - **상태 머신**: PENDING → RUNNING → (WAITING_FOR_INPUT ↔ RUNNING)* → COMPLETED / FAILED / CANCELLED.")
  - 상세: 이 요약은 이번 diff 이전부터 있던 고수준 서술이라 이번 변경이 직접 만든 결함은 아니지만, FAILED 를 완전한 종착 상태로 서술해 위 CRITICAL 항목과 같은 결을 공유한다. 이미 "static 줄 수 stale" 이유로 한 차례 WARNING #4(2026-07-27) 를 받은 이력이 있는 docblock이라, 다음 편집 시 이 한 줄도 함께 정정하면 좋다.
  - 제안: 우선순위 낮음 — 위 spec 정정과 함께 처리하거나 별도 후속으로 defer 가능.

## 참고 — 이번 diff 문서화 품질의 강점

state-machine.ts / execution-engine.service.ts / ai-turn-orchestrator.service.ts / engine-driver.interface.ts 4개 파일 모두, 새로 추가된 `opts`/`allowRetryReentry` 흐름 대부분에 대해 "왜 필요한가 · 안 하면 무엇이 깨지는가 · 어느 호출부가 언제 켜야 하는가"를 구체적 재현 시나리오와 함께 서술한 인라인/JSDoc 주석이 동반됐다(`reparkAiResumeTurn` 파라미터 주석, `NON_TERMINAL_OR_FAILED_STATUSES_SQL` docblock 등). 신규 테스트(`state-machine.spec.ts` 3건, `execution-engine.service.spec.ts` 2건)의 이름·주석도 실제로 검증하는 내용과 정확히 일치한다. README/설정/CHANGELOG 는 이 저장소 관례상 코드 변경과 함께 갱신되는 항목인데, 이번 커밋은 내부 엔진 로직 문서화에는 공을 들였으면서 그 상위 계층(CHANGELOG, spec SoT)과의 동기화가 빠졌다는 점이 이 리뷰의 핵심 지적이다. README/API 문서/신규 환경변수/예제 코드 항목은 이번 변경 범위(REST/WS 표면 불변, 신규 env 없음)상 해당 없음(N/A)으로 판단했다.

## 요약

이번 diff 자체의 소스 레벨 문서화(JSDoc/인라인 주석)는 매우 높은 수준이며 버그의 재현 조건과 수정 근거를 정확하고 상세하게 남겼다. 그러나 이 fix 가 처음으로 실제 도달 가능하게 만든 `FAILED → WAITING_FOR_INPUT`("turn 계속 → re-park", 커밋 스스로 "최빈" 시나리오라 명시) 전이가 두 개의 공식 SoT spec 문서(`4-execution-engine.md` §1.1/Rationale, `1-ai-agent.md` §7.9/§12.8)의 상태 전이 서술에 전혀 반영되지 않아, 향후 이 spec 만 참조하는 개발자·컨시스턴시 체크가 "재진입은 성공/실패 이분"이라는 오해를 할 수 있는 구조적 gap 이 남았다(CRITICAL). 또한 이 정도 심각도("8R CRITICAL", 구조적으로 항상 실패하던 결함)의 수정임에도 이 저장소의 확립된 관례와 달리 CHANGELOG.md 항목이 없고(WARNING), 동일 diff 안에서 신설된 `opts` 파라미터의 JSDoc 이 자매 함수(`lockNonTerminalExecutionRow`)만 갱신되고 `tryLockActiveExecutionAndSaveNodeExec`(구현+인터페이스 미러 양쪽)는 누락돼 내부 일관성이 깨졌다(WARNING). README/API 문서/환경변수/예제 코드 관점은 이번 변경 범위상 해당 사항 없음.

## 위험도

HIGH
