# 보안(Security) Review — ie-resume-turn-boundary-cancel (2026-07-26 23:05)

## 발견사항

- **[INFO]** `ExecutionCancelledError` 메시지에 `executionId` 포함 — client 노출 여부 지속 감사 필요
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts` `assertLinkedTransitionApplied`(게이트 378~380) 및 `assertExecutionNotCancelled` 호출 경로(`execution-engine.service.ts` 게이트 8022~8024)
  - 상세: 신규/기존 throw 지점 전부가 `` `Execution ${executionId} cancelled during ${phase}` `` / `` `Execution ${executionId} cancelled externally` `` 형태로 executionId 를 메시지에 담는다. `markNodeCancelled` 호출 시 `errorEnvelope` 를 넘기지 않아(코드 주석에 "client-facing 노출 차단 설계" 명시, `assertLinkedTransitionApplied` 게이트 370~375) 이 sentinel 의 `.message` 자체는 `NodeExecution.error`/이벤트 페이로드에 실리지 않는다 — 기존 W15/W19 컨벤션을 그대로 준수하며 실제 결함은 아니다. executionId 자체도 그 실행을 트리거한 사용자에게는 이미 알려진 식별자라 민감정보로 보기 어렵다. 다만 이번 라운드에서 이 sentinel 을 던지는 지점이 4곳으로 늘었으므로, 상위 catch 체인(`runExecution`/`finalizeResumedExecutionOutcome`/HTTP 에러 매핑)이 이 `.message` 를 그대로 API 응답 body 에 얹지 않는지 계속 확인이 필요하다.
  - 제안: 별도 조치 불요(기존 관행 준수 확인됨). 신규 catch 블록 추가 시 `.message` 를 client-facing payload 에 직접 노출하지 않는지 리뷰 체크리스트에 유지.

- **[INFO]** `NON_TERMINAL_STATUSES_SQL` — enum 파생 문자열을 SQL 리터럴로 직접 삽입(파라미터 바인딩 아님), 현재는 안전
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:507`(정의) / `:8188`, `:8236`, `:8276`(3곳 사용처 — `updateExecutionStatus` 의 `linkedNodeExec` FOR UPDATE 쿼리·else 분기 guarded UPDATE·신규 `assertActiveExecutionAndSaveNodeExec` FOR UPDATE 쿼리)
  - 상세: `Object.values(ExecutionStatus).filter(...).map(s => \`'${s}'\`).join(', ')` 로 만든 문자열이 `AND status IN (${NON_TERMINAL_STATUSES_SQL})` 형태로 3개 쿼리에 삽입된다. `ExecutionStatus` 는 TypeScript enum 값이며 클래스 로드 시 1회 고정 계산되고 사용자 입력·외부 데이터 소스와 무관하므로 인젝션 경로가 없다(작성자 주석도 명시). 세 쿼리 모두 대상 row 식별은 `id = $1` 파라미터 바인딩으로 분리돼 있어 실질적 위험 없음. 새로 추가된 `assertActiveExecutionAndSaveNodeExec`(execution-engine.service.ts:8048~8073)도 동일 패턴을 그대로 재사용해 위험이 늘지 않았다.
  - 제안: 조치 불요. 향후 이 enum 이 외부 설정으로 동적화될 경우에만 파라미터 바인딩(`= ANY($n::text[])`)으로 전환 검토.

- **[INFO]** e2e 전용 지연 마커(`__e2e_delay_ms:<n>`) — production 도달 불가, 상한 적용 확인
  - 위치: `codebase/backend/src/modules/llm/clients/stub.client.ts:41~42`(`DELAY_MARKER`/`STUB_MAX_DELAY_MS`), `:49~69`(`chat()` 처리부)
  - 상세: 정규식 `/^__e2e_delay_ms:(\d+)\s*/` 로 파싱한 값을 `Math.min(Number(...), STUB_MAX_DELAY_MS)`(5000ms)로 상한해 무한 대기(DoS)를 방지한다. `StubLlmClient` 는 `LLM_STUB_MODE=true` 일 때만 `LlmService.createClient`(`llm.service.ts:118~121`)가 바인딩하며, `common/config/production-guards.ts:106~107` 이 `NODE_ENV=production` 부팅 시 `LLM_STUB_MODE=true` 를 fail-closed 로 차단함을 직접 확인했다 — 실사용자 입력이 이 파서에 도달할 공격 표면이 없다. 정규식도 `\d+`/`\s*` 구조상 ReDoS 우려 없음(backtracking 폭발 패턴 아님).
  - 제안: 조치 불요.

- **[INFO]** (양성 확인) TOCTOU 창이었던 `finalizeAiNode` "RUNNING 유지" 분기가 이번 라운드에 완전히 원자화됨
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:1471~1483`, `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8048~8073`(`assertActiveExecutionAndSaveNodeExec`)
  - 상세: 직전 라운드(concurrency/architecture 리뷰)가 지적했던 "취소 관측(`assertExecutionNotCancelled`, 잠금 없는 단순 SELECT) 후 `nodeExec.save()` 사이의 좁은 검사-후-사용 창"이, 신규 `assertActiveExecutionAndSaveNodeExec`(같은 트랜잭션 안에서 `SELECT ... FOR UPDATE` 로 Execution 행을 잠근 뒤에만 `nodeExec` 를 save)로 대체되며 형제 분기(`updateExecutionStatus` 의 `linkedNodeExec` 분기)와 동일한 원자성 수준으로 닫혔다. 이는 사용자가 트리거하는 취소(Stop) 컨트롤의 무결성을 보강하는 방향으로, 보안 관점에서 긍정적인 변경이다.
  - 제안: 조치 불요.

## 요약

이번 diff 의 핵심은 AI multi-turn 세션에서 "park 짝 전이"(`updateExecutionStatus` 의 `linkedNodeExec` 분기)가 무가드 full-entity save 로 인해 사용자가 누른 Stop(취소)을 조용히 되살리던 lost-update 결함을 트랜잭션 내 `SELECT ... FOR UPDATE` 행 잠금으로 닫고, turn 경계에서 취소를 직접 재관측(`assertExecutionNotCancelled`)해 사용자 kill-switch 컨트롤의 무결성을 회복시킨 것이다. 신규/변경된 SQL 은 전부 파라미터 바인딩(`$1`) 또는 컴파일타임 고정 enum 값(`NON_TERMINAL_STATUSES_SQL`)으로만 구성돼 인젝션 벡터가 없고, 취소 종결 시 `nodeExec.outputData`/`error` 를 명시적으로 비운 뒤 마킹해 취소된 노드가 이전 성공 페이로드를 노출하지 않도록 데이터 위생도 유지된다. `ExecutionCancelledError` 메시지의 `executionId` 는 기존 W15/W19 컨벤션에 따라 client-facing 필드(`errorEnvelope` 미전달)에는 실리지 않는다. e2e 전용 지연 마커(`__e2e_delay_ms`)는 production 부팅 가드가 `LLM_STUB_MODE` 를 fail-closed 로 차단해 실사용자 공격 표면이 없고 상한도 적용돼 있다. 이전 라운드(concurrency/architecture)가 지적한 `finalizeAiNode` "RUNNING 유지" 분기의 잔여 TOCTOU 창은 이번 라운드의 `assertActiveExecutionAndSaveNodeExec`(FOR UPDATE 원자화)로 구조적으로 닫혔음을 코드 레벨에서 직접 확인했다. 신규 인젝션·인증 우회·시크릿 하드코딩·안전하지 않은 암호화 벡터는 발견되지 않았으며, 전반적으로 이번 변경은 보안 회귀가 없고 오히려 취소 제어의 무결성을 강화한 개선이다.

## 위험도

NONE
