# 아키텍처(Architecture) Review

## 리뷰 대상

- `codebase/backend/src/modules/execution-engine/engine-driver.interface.ts`
- `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`
- `codebase/backend/src/modules/execution-engine/state/state-machine.ts`

이번 라운드(직전 11R, HEAD `0f0bdabe8`)는 `updateExecutionStatus` JSDoc 에 `@param opts` 를
보강하고 사용자 가이드 문서 순서를 정정한 **문서 전용 변경**이다. 소스 로직은 8R(`2ca44b769`)
이후 무변경. 이 세 파일이 관련된 8R~11R CRITICAL(짝 전이가 DB 가드에 막혀 절대 persist
되지 않던 결함과 그 하네스 배선 결함들)은 11R 시점에 14개 reviewer 전원 CRITICAL 0 으로
수렴했고 `plan/in-progress/retry-turn-terminal-guard.md` 에 #1~#30 구조 부채가 우선순위별로
이미 등재·추적 중이다. 아래는 그 목록을 반복 재기재하지 않고, 직접 DI 배선을 실측해 얻은
**신규 확정 증거** 위주로 보고한다.

## 발견사항

- **[WARNING]** `RetryTurnService` 의 `AiTurnOrchestrator` forwardRef 근거 주석이 현재 DI 배선과 모순 — 4라운드 미해결 의문을 실측으로 확정
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:88-91`(`@Inject(forwardRef(() => AiTurnOrchestrator))` 직전 주석 "orchestrator 가 ENGINE_DRIVER(=엔진) 를 주입받고 엔진은 본 서비스를 주입받으므로 transitive 순환 DI → forwardRef"), 같은 파일 `:61-64`(클래스 docstring "엔진의 thin delegator 를 제거하고 engine→Retry 역방향 주입을 없애 양방향 forwardRef 순환 DI 를 단방향(Retry→engine)으로 정리했다")
  - 상세: 두 주석이 같은 파일 안에서 정반대를 말한다 — 생성자 주석은 "엔진이 본 서비스(`RetryTurnService`)를 주입받는다"(역방향 주입이 **존재**)고 전제하는데, 클래스 docstring 은 그 역방향 주입을 "제거"해 "단방향(Retry→engine)" 으로 정리했다고 말한다. 이 모순은 `plan/in-progress/retry-turn-terminal-guard.md` 백로그 #8 로 1R→2R→3R→5R→7R 5차례 반복 지적됐으나 매번 "모듈 레벨 import 순환 실측이 필요해 범위 밖" 으로 defer 됐다(3R Warning #3: "이번 라운드도 defer — 모듈 레벨 import 순환 실측이 필요해 범위 밖"). 이번 라운드에 그 실측을 직접 수행해 결론을 확정했다:
    - `execution-engine.service.ts:781-782` — 엔진은 `AiTurnOrchestrator` 를 `forwardRef` 로 주입받는다(진짜 순환: Engine↔AiTurnOrchestrator, `AiTurnOrchestrator` 가 `ENGINE_DRIVER`(=엔진)를 주입받으므로).
    - `execution-engine.service.ts:789-790` — "C-1 후속 ④ — RetryTurnService 역방향 주입 제거(engine→Retry 순환 DI 해소)" 주석과 함께, 엔진 생성자 파라미터 목록 전체(`grep -n "RetryTurnService" execution-engine.service.ts` 전체 매치)를 확인한 결과 실제로 **`RetryTurnService` 를 주입받는 필드가 없다** — 주석대로 제거가 실재한다.
    - `ai-turn-orchestrator.service.ts:82-90`(`AiTurnOrchestrator` 전체 생성자) — `NodeHandlerRegistry`/`ExecutionContextService`/`ExecutionEventEmitter`/`NodeExecution` repo/`ENGINE_DRIVER` 만 주입받는다. `RetryTurnService` 참조가 파일 전체에서 0건(`grep -n "RetryTurnService" ai-turn-orchestrator.service.ts` 매치 없음).
    - `continuation/continuation-execution.processor.ts:66` — `RetryTurnService` 를 주입받는 유일한 다른 소비자이나 forwardRef 없이 평범하게 주입한다(외부 leaf consumer, `AiTurnOrchestrator`/엔진 그래프로 다시 연결되지 않음).
    - 원 추출 커밋 `0c275dd7f0`(2026-06-18, "RetryTurnService 추출 (C-1 step4, FINAL)") 커밋 메시지: "retryLastTurn(←websocket.gateway)·applyRetryLastTurn(←continuation-execution.processor) 은 외부 진입이라 **엔진 thin delegator 잔류**" — 추출 당시엔 엔진이 실제로 `RetryTurnService` 를 호출하는 delegator 를 갖고 있어 forwardRef 가 그 시점엔 정확히 필요했다. 이후 "C-1 후속 ④" 라운드가 그 delegator 를 제거하면서 클래스 docstring 은 갱신됐지만, 생성자 인라인 주석은 갱신되지 않고 그대로 남았다.
    
    즉 `RetryTurnService → AiTurnOrchestrator → ENGINE_DRIVER(엔진)` 경로는 존재하지만 엔진→`RetryTurnService` 로 돌아오는 변은 지금 없다(왕복이 아니라 편도) — 현재 배선상 `RetryTurnService` 생성자의 `forwardRef(() => AiTurnOrchestrator)` 는 실제 순환을 막는 게 아니라, **이미 제거된 과거 배선을 근거로 든 주석만 남긴 채 존속**하고 있을 가능성이 높다. forwardRef 자체는 순환이 없어도 런타임 오류를 일으키지 않으므로 기능 결함은 아니지만, (a) 존재하지 않는 순환을 설명하는 주석이 코드베이스에 남아 향후 유지보수자가 잘못된 전제로 판단하게 만들고, (b) 5차례 반복된 "실측 필요" 항목이 실제로는 한 시간 이내의 grep+constructor 확인으로 해소 가능했다는 점에서 defer 관성 자체도 재점검 가치가 있다.
  - 제안: (1) 최소 조치 — `retry-turn.service.ts:88-89` 주석을 현재 배선에 맞게 정정한다("`AiTurnOrchestrator` 자체는 `RetryTurnService` 를 주입받지 않아 현재는 순환이 없다 — forwardRef 는 [과거 엔진 thin delegator 시대의 잔재 / 향후 재도입 방어] 목적으로 유지" 중 실제 의도에 맞는 쪽으로 명시). (2) 선택 조치 — forwardRef 제거가 실제로 안전한지 boot 테스트(`Test.createTestingModule` 부팅 성공 확인)로 검증한 뒤 제거 검토. 어느 쪽이든 `plan/in-progress/retry-turn-terminal-guard.md` #8 항목을 "실측 완료, 조치 대기" 로 갱신할 것을 권장.

- **[INFO]** 이미 defer 등재된 구조 부채 — 소스 로직 무변경 확인, 신규 조치 불필요
  - 위치: `state/state-machine.ts:63-79`(`canTransition` 의 `allowRetryReentry` opt-in 표-밖 예외), `engine-driver.interface.ts:76-83`/`216-222`(`opts?: { allowRetryReentry?: boolean }` 인라인 구조적 타입 중복)
  - 상세: (1) 상태 전이 정당성의 이중 진실 소스(`state-machine.ts` TS 규칙 vs 엔진의 SQL allow-list) — plan #21, (2) `{ allowRetryReentry?: boolean }` 가 `state-machine.ts` 의 named export `TransitionOptions` 를 재사용하지 않고 5곳 이상 인라인 재선언되는 것 — plan #22, (3) `finalizeAiNode` "RUNNING 유지" 분기의 opts 전파 미검증(도달 가능성 불명) — plan #24. 세 항목 모두 10R/11R 아키텍처 리뷰(`review/code/2026/07/30/16_42_36`, `17_37_14`)가 이미 독립 발견해 P2/P3 로 defer 등재했고, 이번 라운드는 세 파일의 관련 코드가 8R 이후 문자 그대로 무변경임을 재확인했다(diff 는 JSDoc 문단 추가뿐). 새로운 악화나 완화 없음 — 기존 defer 유지를 권장하며 신규 백로그는 불필요하다.
  - 제안: 없음(교차검증 완료, 재조치 불요).

- **[INFO]** (긍정) 11R JSDoc 보강이 `CoreEngineDriver.updateExecutionStatus` 와 `AiTurnEngineDriver.tryLockActiveExecutionAndSaveNodeExec` 사이의 계약 서술을 대칭으로 맞춤
  - 위치: `engine-driver.interface.ts:76-83`(`updateExecutionStatus` 신규 `@param opts.allowRetryReentry`), `:216-222`(`tryLockActiveExecutionAndSaveNodeExec` 기존 동일 문단)
  - 상세: 10R 아키텍처 리뷰(`16_42_36`)가 "상태 전이 단일 choke point 이자 이번 CRITICAL 의 당사자 함수"인 `updateExecutionStatus` 에만 `opts` 계약 설명이 없던 비대칭을 지적했고(당시 W7/11R W8), 이번 diff 로 두 시그니처의 JSDoc 이 "opt-in 시에도 COMPLETED/CANCELLED 는 배제" · "기본(미전달)은 종전과 동일하게 FAILED 배제" 문구까지 동일하게 맞춰졌다. 두 인터페이스 멤버가 실제로 같은 opt-in 계약(상태머신 + DB 가드 동시 적용, 하나만 반영 시 0행)을 공유한다는 사실이 이제 어느 쪽 JSDoc 을 먼저 읽어도 동일하게 전달된다 — ISP 로 나뉜 두 소비자 인터페이스의 계약 문서가 실제 구현과 정합함을 확인했다.
  - 제안: 없음(양호 확인).

## 요약

이번 라운드는 문서 전용 diff(11R 산출)라 아키텍처 관점의 새 위험은 없고, `updateExecutionStatus`
JSDoc 보강은 형제 메서드와의 계약 서술 비대칭을 정확히 해소했다. 대신 이번 리뷰는
"모듈 레벨 import 순환 실측이 필요해 범위 밖" 이라는 사유로 1R 부터 5차례 defer 되어 온
`RetryTurnService`↔`AiTurnOrchestrator` forwardRef 근거 주석의 진위를 직접 실측했다 — 결론은
현재 배선상 `AiTurnOrchestrator` 는 `RetryTurnService` 를 주입받지 않고(엔진도 마찬가지로
"C-1 후속 ④" 라운드에 그 reverse injection 을 제거함), 따라서 `RetryTurnService` 생성자의
`forwardRef(() => AiTurnOrchestrator)` 를 정당화하는 "transitive 순환 DI" 주석은 원 추출
시점(`0c275dd7f0`, 엔진이 thin delegator 로 `RetryTurnService` 를 호출하던 시절)에는 맞았으나
그 delegator 가 제거된 지금은 사실과 어긋난다. forwardRef 자체는 순환이 없어도 무해하게
동작하므로 런타임 결함은 아니지만, 코드에 남은 잘못된 인과 설명은 향후 유지보수 판단을
오도할 수 있어 WARNING 으로 기록한다. 그 외 이미 `plan/in-progress/retry-turn-terminal-guard.md`
#21/#22/#24 로 추적 중인 이중 진실 소스·opts 인라인 타입 중복·미검증 분기는 소스 로직이
8R 이후 무변경임을 재확인했을 뿐 새로운 악화가 없어 INFO 로 교차검증만 남긴다. `EngineDriver`
계열 ISP 분해, `ALLOWED_TRANSITIONS` 를 건드리지 않는 opt-in 확장(OCP), `RetryEngineDriver` 슬라이스가
`RetryTurnService` 의 실제 소비 표면과 정확히 일치하는 점(과다/과소 노출 없음) 등 기존 구조적
강점은 이번 라운드에도 그대로 유지된다.

## 위험도

LOW
