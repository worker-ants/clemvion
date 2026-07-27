# 보안(Security) 리뷰

## 발견사항

- **[INFO]** `ExecutionCancelledError` 메시지에 `executionId` 포함 — client 노출 경로 재확인 권고
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts` `assertLinkedTransitionApplied` (게이트 365~367)
  - 상세: 신규 `assertLinkedTransitionApplied` 가 던지는 `ExecutionCancelledError` 메시지는 `` `Execution ${executionId} cancelled during ${phase}` `` 형태로 executionId 를 포함한다. 같은 파일 `execution-engine.service.ts` 의 기존 컨벤션(게이트 4573~4576, `markNodeCancelled` JSDoc — "`ExecutionCancelledError` 경로는 **싣지 않는다**(그 sentinel 의 message 에 executionId 가 들어 있어 client 노출 금지 — W15/W19)")과 정확히 일치하게, 이번 신규 호출 3곳(re-park/첫 turn park/RUNNING 재claim·RUNNING 유지)도 `markNodeCancelled` 호출 시 `errorEnvelope` 를 넘기지 않아 이 규약을 그대로 따른다 — 실제 결함은 아니다. 다만 신규 throw 지점이 4곳(§2.3 turn 경계 가드 포함) 늘어난 만큼, 상위 catch 체인 전체(`executeNode`/`finalizeResumedExecutionOutcome`/HTTP 응답 매핑)가 이 sentinel 의 `.message` 를 그대로 client 응답에 싣지 않는지 지속적으로 감사할 필요가 있다.
  - 제안: 별도 조치 불요(기존 W15/W19 관행을 준수). 향후 `ExecutionCancelledError` 를 잡는 새 catch 블록을 추가할 때 `.message` 를 client-facing payload 에 직접 노출하지 않도록 코드 리뷰 체크리스트에 명시.

- **[INFO]** `NON_TERMINAL_STATUSES_SQL` — enum 기반 SQL 문자열 결합, 현재는 안전하나 향후 변경 시 재확인 필요
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `NON_TERMINAL_STATUSES_SQL` 정적 필드 (게이트 507~512), 사용처(게이트 8184~8189, 8227)
  - 상세: `Object.values(ExecutionStatus).filter(...).map(status => \`'${status}'\`).join(', ')` 로 만든 문자열을 두 SQL 쿼리(`FOR UPDATE` 짝 전이 가드·else 분기 guarded UPDATE)에 템플릿 리터럴로 직접 삽입한다. `ExecutionStatus` 는 코드에 고정된 TypeScript enum 값이고 사용자 입력이나 DB 조회 결과가 아니므로 인젝션 경로가 없다 — 작성자 주석도 이를 명시("enum 값 기반이라 인젝션 우려 없음"). 실행 대상 row 자체는 `id = $1` 파라미터 바인딩으로 분리돼 있어 안전. 새로 도입한 패턴이 아니라 기존 else 분기의 하드코딩 리터럴을 단일 출처로 DRY 한 것뿐이라 위험이 늘지 않았다.
  - 제안: 조치 불요. 다만 향후 `ExecutionStatus` 값이 설정 파일 등 외부 소스에서 동적으로 채워지도록 리팩터링될 경우, 이 문자열 결합 지점을 파라미터 바인딩(`= ANY($n::text[])` 등)으로 전환해야 한다는 점을 코드 주석에 명시해 두면 좋다(선택 사항).

- **[INFO]** e2e 전용 지연 마커(`__e2e_delay_ms:<n>`) — production 도달 불가, 상한 적용 확인됨
  - 위치: `codebase/backend/src/modules/llm/clients/stub.client.ts` `DELAY_MARKER`/`STUB_MAX_DELAY_MS` (게이트 41~42), `chat()` 처리부(게이트 49~69)
  - 상세: 정규식 `/^__e2e_delay_ms:(\d+)\s*/` 로 파싱한 지연값을 `Math.min(Number(...), STUB_MAX_DELAY_MS)` 로 상한(5000ms) 처리해 무한 대기(DoS)를 방지했다. `StubLlmClient` 자체가 `LLM_STUB_MODE=true` 일 때만 `LlmService.createClient` 가 바인딩하는 테스트 전용 경로(파일 상단 주석에 "프로덕션 경로에는 절대 활성화되지 않는다" 명시)이므로 실사용자 입력이 이 파서에 도달할 공격 표면이 없다. 정규식도 `\d+`/`\s*` 조합으로 ReDoS 우려 없음.
  - 제안: 조치 불요.

## 요약

이번 변경의 핵심은 AI multi-turn 세션의 "park 짝 전이"(`updateExecutionStatus` 의 `linkedNodeExec` 분기)가 무가드 full-entity save 였던 lost-update 결함을 트랜잭션 내 `SELECT ... FOR UPDATE` 행 잠금으로 닫고, turn 경계에서 취소를 직접 재관측(`assertExecutionNotCancelled`)해 사용자가 누른 Stop 이 조용히 무효화(되살아남)되던 문제를 수정한 것이다. 이는 보안 관점에서 사용자가 트리거하는 취소(kill-switch) 컨트롤의 무결성을 회복시키는 **개선**이며, 새로운 인젝션·인증 우회·시크릿 노출 벡터는 발견되지 않았다. SQL 은 전부 파라미터 바인딩(`$1`) 또는 컴파일타임 고정 enum 값으로만 구성되고, 취소 종결 시 `nodeExec.outputData`/`error` 를 명시적으로 비운 뒤 마킹해 취소된 노드가 이전 성공 페이로드를 남기지 않도록 하는 등 데이터 위생도 강화됐다. `ExecutionCancelledError` 메시지의 executionId 가 client 에 노출되지 않아야 한다는 기존 컨벤션(W15/W19)도 신규 throw 지점 전부에서 일관되게 지켜졌다. e2e 전용 지연 마커는 production 경로에 도달할 수 없고 상한이 적용돼 있어 안전하다. 전반적으로 이번 diff 는 보안 회귀를 유발하지 않았고, 오히려 하나의 실질적 데이터 정합성/제어 우회 결함을 닫았다.

## 위험도

NONE
