# 문서화(Documentation) 리뷰 — retry_last_turn 재진입 원자 claim (#10 동반)

대상 커밋: `b351731f0` (`fix(engine): retry_last_turn 재진입의 비원자 가드 — 조건부 UPDATE claim 으로 교체`)
대상 파일: `retry-turn.service.ts` / `retry-turn.service.spec.ts` / `continuation-execution.processor.ts`

## 발견사항

- **[WARNING]** 클래스·메서드 최상단 docstring 이 이번 PR 의 핵심 추가 사항(2차 원자 claim)을 반영하지 않음
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:39-43`(클래스 "책임" 문단), `:252-266`(`applyRetryLastTurn` "재진입 절차" 1~7 목록)
  - 상세: 클래스 docstring 은 "**책임**: ... 보존된 `_retryState` 를 lookup·검증·atomic-consume 하고 (`retryLastTurn`), worker handoff 로 spawn 된 RUNNING row 를 multi-turn loop 에 재진입시켜 ... (`applyRetryLastTurn`)" 라고 서술해 atomic-consume 을 `retryLastTurn` 에만 귀속시킨다. 이번 PR 은 `applyRetryLastTurn` 에도 별도의 원자 소비(스폰된 row 의 `inputData._retryState` 를 `status='running' AND jsonb_exists(...)` 조건부 UPDATE 로 제거, 310-339행)를 신설했는데 — 이 PR 전체의 존재 이유인 핵심 정정임에도 — 클래스 요약에도, `applyRetryLastTurn` 자신의 "재진입 절차" 1~7 단계 목록(252-266행, load→ExecutionContext 확보→shape 변환→NODE_STARTED emit→turn 구동→finalize→downstream)에도 이 claim 단계가 등장하지 않는다. 새로 추가된 인라인 주석(310-322행)은 매우 상세하지만, 최상위 요약만 읽는 독자는 두 번째 원자 claim 의 존재와 그것이 이 PR 의 핵심이라는 사실을 알 수 없다.
  - 제안: 클래스 docstring "책임" 문단에 "`applyRetryLastTurn` 도 spawn row 의 `_retryState` 키를 조건부 UPDATE 로 원자 소비해 중복 delivery 를 차단한다(2026-07-28)" 한 줄 추가하고, "재진입 절차" 목록에 claim 단계를 번호 매겨 삽입.

- **[WARNING]** (pre-existing, 이번 PR 도입 아님) `applyRetryLastTurn` docstring 이 이미 제거된 `runAiConversationLoop` 를 재진입 메커니즘으로 계속 인용
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:113`, `:259`
  - 상세: `retryLastTurn` docstring(113행: "shape 변환 후 `runAiConversationLoop` 로 재진입")과 `applyRetryLastTurn` docstring(259행: "5. `runAiConversationLoop` 를 마지막 user message replay ... 로 구동")이 모두 재진입 구동 메서드로 `runAiConversationLoop` 를 지목한다. 그러나 같은 파일 421-422행 자신의 주석이 "exec-park D6 full B3 — 옛 `runAiConversationLoop(initialAction)` 장수 루프 replay 를 turn-park 모델의 단발 처리기로 이관한다. `processAiResumeTurn` 이 마지막 turn ... 을 즉시 replay"라고 명시하고, `ai-turn-orchestrator.service.ts:186` 도 "옛 in-memory 장수 루프(`runAiConversationLoop`)는 제거됐다"고 재확인한다. `git blame` 확인 결과 두 인용 모두 `0c275dd7f0`(2026-06-18, `RetryTurnService` 최초 추출)부터 존재해 이번 커밋이 만든 결함은 아니다. 다만 이번 PR 이 수정한 바로 그 메서드(`applyRetryLastTurn`)의 docstring 안에 있어, 새 원자 claim 을 이해하려는 독자가 가장 먼저 마주치는 위치라는 점에서 지금 남겨두면 혼란을 유발한다.
  - 제안: 두 인용을 실제 호출부인 `processAiResumeTurn`(426-435행)으로 정정.

- **[WARNING]** (pre-existing, 이번 PR 도입 아님) `ContinuationExecutionProcessor` 클래스 docstring 의 "처리 흐름"이 이미 제거된 `pendingContinuations` fast-path 를 서술
  - 위치: `codebase/backend/src/modules/execution-engine/continuation/continuation-execution.processor.ts:28-37`
  - 상세: 클래스 docstring 은 "로컬 `pendingContinuations` Map 키 hit → 즉시 resolve (fast path, 동일 인스턴스가 publisher 였던 케이스)" 대 "키 miss → §7.5 rehydration slow path"의 2-경로 모델을 서술한다. 그러나 `execution-engine.service.ts:941` 은 "§7.5 rehydration 으로만 재개한다. (옛 `pendingContinuations` fast-path 제거.)"라고 명시하고, `spec/5-system/4-execution-engine.md` "Worker 동작" 셀도 "in-process resolver 가 일절 존재하지 않는다 ... 재개 경로는 slow-path(rehydration)로 일원화된다"고 확정한다(Phase B full B3). 실제로 이 파일의 `process()` 메서드(71-165행) 본문 어디에도 로컬 Map 조회 로직이 없다 — 서술된 fast path 는 코드에 존재하지 않는다. `git blame` 상 `46cc71705`(2026-05-25)부터 있어 이번 PR 과 무관한 pre-existing 결함이지만, 이번 PR 이 바로 아래(77-92행)에 추가한 원자 claim 설명 위에 위치해 "fast path 가 있으니 이 claim 도 우회될 수 있는가"라는 오해를 유발할 수 있는 인접성이 있다.
  - 제안: "처리 흐름" 절을 spec 의 현재 서술("항상 §7.5 rehydration 경로")과 일치하도록 정정하거나, 최소한 해당 문단에 "레거시/제거됨(Phase B full B3)" 표시 추가.

- **[WARNING]** CHANGELOG.md 미갱신 — 동일 연작의 직전 커밋과 관례 불일치
  - 위치: `CHANGELOG.md` (신규 항목 없음 — 커밋 diff 에 `CHANGELOG.md` 미포함)
  - 상세: 이 fix 는 "중복 배달 시 락 없는 인스턴스-로컬 `ExecutionContext` 공유로 인한 대화 상태 훼손·중복 LLM 과금·downstream 도구(Cafe24/MakeShop/MCP) 중복 실행"이라는 실제 데이터 무결성/과금 버그를 닫는다. 같은 파일(`retry-turn.service.ts`)을 다루는 바로 앞 커밋(`771801e3e`, "retry-turn 종결 2경로의 무가드 terminal 쓰기 차단")은 `CHANGELOG.md` 의 "Unreleased — AI multi-turn resume 턴 경계 cancel 가드 + park 짝 전이 lost-update 차단" 절에 항목 7 로 등재됐다(같은 절 3차 라운드 이력에도 "Warning #2(documentation) — CHANGELOG.md #7 항목 stale 문구 갱신"이 있어, 이 프로젝트가 CHANGELOG 정확성을 능동적으로 관리함을 보여준다). 이번 커밋은 성격이 같은 계열(retry-turn 동시성 결함)임에도 대응 항목을 추가하지 않았다.
  - 제안: 위 Unreleased 절(또는 새 절)에 "retry_last_turn 재진입 중복 배달 방지(원자 claim)" 요지의 항목 추가.

- **[INFO]** `ContinuationExecutionProcessor` 최상단 "Idempotency" 절이 `retry_last_turn` 의 별도 보장 메커니즘을 언급하지 않음
  - 위치: `codebase/backend/src/modules/execution-engine/continuation/continuation-execution.processor.ts:44-49`
  - 상세: "비원자 SELECT 재검증과 달리 check-then-act 창이 없어 이중 실행 0 을 기계 보장"이라는 서술이 `claimResumeEntry` 문단에만 있다. `retry_last_turn` 이 별도 메커니즘(`applyRetryLastTurn` 자체 claim, 이번 PR 신설)으로 동일 보장을 얻는다는 사실은 83-87행 인라인 주석에만 있어, 클래스 최상단 요약만 읽으면 `retry_last_turn` 도 이 보장을 받는지 불분명하다. 오류는 아니고 완전성 보완 수준.
  - 제안: Idempotency 절에 "`retry_last_turn` 은 별도 claim(`RetryTurnService.applyRetryLastTurn`)으로 동일 보장을 얻는다" 한 줄 추가.

- **[INFO]** 신규 ATOMIC CLAIM 주석이 새로 추가된 spec Rationale 절을 인용하지 않음
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:310-322`
  - 상세: 이 파일의 다른 주요 결정 지점(예: 242-243행, 281-285행)은 대부분 spec 섹션을 명시 인용하는 관례를 따르는데, 이번에 `spec/5-system/4-execution-engine.md` `## Rationale`에 신설된 "retry 재진입의 원자 claim — spawn 단계 원자성만으로는 불충분하다 (§7.5 대칭, 2026-07-28)" 항목은 코드 주석에서 인용되지 않는다. (확인: spec 쪽은 실제로 잘 갱신됨 — §4.2 각주·§7.4 Worker 동시성 셀·§7.5 대칭 Rationale 세 곳 모두 이번 커밋 diff 에 포함, 관례 자체는 준수됐다.)
  - 제안: 310행 주석 말미에 "spec/5-system/4-execution-engine.md §7.5 Rationale 'retry 재진입의 원자 claim' 참조" 한 줄 추가해 코드→spec 역방향 추적성 보완.

- **[INFO]** (리뷰 대상 3개 파일 외 보조 관찰) 관련 plan 체크리스트가 이번 커밋의 완료 사실을 반영하지 않음
  - 위치: `plan/in-progress/retry-turn-terminal-guard.md` ("5차 라운드 이후 위생 정리" → "코드 — 우선순위 순" 표 #1행), `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` (`## 추가 위임 (2026-07-28 #10)` 체크리스트 4항목)
  - 상세: 두 문서 모두 이번 커밋이 사실상 완료시킨 작업(원자 claim 전환, §7.4/§7.5/§4.2 spec 갱신, 2026-06-06 PASS 스코프 기록 — Rationale 절 "선행 판정의 스코프" 문단이 이 네 번째 체크 항목을 그대로 충족)을 다루지만, 두 문서의 해당 체크박스는 여전히 `- [ ]` 미체크 상태다. 리뷰 대상 파일 목록엔 없어 주 발견사항에서는 제외하되, "변경 이력" 추적 정합성 관점에서 참고용으로 남긴다.
  - 제안: 두 문서의 해당 항목을 체크하고 완료 근거로 `b351731f0` 커밋 해시를 남길 것.

## 요약

이번 PR 이 신규로 작성한 코드(원자 claim 블록, 관련 fast-path 주석 정정, continuation processor 의 claim 제외 사유 정정, 신규 테스트 3건)의 인라인 문서화 수준은 매우 높다 — 조건이 왜 두 개 다 필요한지, 트레이드오프가 무엇인지, 과거 어떤 리뷰 라운드의 어떤 CRITICAL 을 닫는지까지 정확하고 검증 가능하게(`06 C-2`, "ai-review 5차 라운드" 등 실제 이력과 대조 확인함) 기술돼 있다. Spec 동반 갱신(`spec/5-system/4-execution-engine.md` §4.2 각주·§7.4 Worker 동시성 셀·§7.5 대칭 Rationale)도 실제로 커밋에 포함돼 있어 "spec 동반 필수" 규약을 준수했다. 다만 (1) 클래스/메서드 최상위 요약 docstring 이 이번 PR 의 핵심 추가 사항(2차 원자 claim)을 반영하지 않은 점, (2) 두 파일에 남아 있는 pre-existing 한 stale 참조(`runAiConversationLoop`, `pendingContinuations` fast-path — 둘 다 이번 PR 이전부터 존재하나 수정 대상 코드 바로 옆이라 혼란을 유발할 수 있음), (3) 동일 연작의 관례상 기대되는 CHANGELOG 항목 누락이 발견됐다. README/API 문서/설정 문서/예제 코드는 이번 변경(내부 엔진 동시성 처리, 신규 공개 API·env var·wire format 변경 없음)의 성격상 해당 사항 없음으로 확인했다.

## 위험도

LOW
