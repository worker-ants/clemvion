### 발견사항

- **[INFO]** `error`/`result` 필드가 `CANCELLED` 상태에서는 채워지지 않는다 — spec 필드표와 잠재적 불일치이나 이번 diff 의 변경 범위 밖(pre-existing)
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts` `getStatus()` 의 `result`/`error` 삼항 조건 (`execution.status === ExecutionStatus.COMPLETED` / `=== ExecutionStatus.FAILED`만 검사)
  - 상세: `spec/5-system/14-external-interaction-api.md` §6.5 필드 집합 표는 `error` 행을 `failed, cancelled(시스템 취소 한정)` 로 명시한다. 그런데 `getStatus()` 코드는 `error` 를 `ExecutionStatus.FAILED` 조건에서만 채우고 `CANCELLED` 는 다루지 않는다(`result` 도 `COMPLETED` 조건만). 이 diff 는 이 조건식 자체를 바꾸지 않았고(`deepRedactSecrets(...)` → `stripAndRedact(...)` 로 본문만 교체) 값 마스킹/필드-strip 로직 교체가 스코프이므로 새로 도입된 결함은 아니다. spec 문서도 이 diff 에서 "형태 불일치" 문구는 그대로 유지했다(코드가 명확히 틀렸다고 새로 지적된 바 없음). CANCELLED 케이스는 별도 트래킹이 필요할 수 있음을 기록만 해 둔다.
  - 제안: 이 PR 범위에서 조치 불요. `CANCELLED` 시 `error` 를 채울지 여부는 별도 planner 항목으로 검토(이미 spec 이 "구현됨 — 형태 불일치" 로 알려진 갭임을 표기하고 있어 신규 발견이 아님).

- **[INFO]** `stripAndRedact`(`interaction.service.ts`) 의 반환 타입이 실제 입력 shape 을 강제하지 않는다 — 방어적 캐스팅
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:98` 부근 `function stripAndRedact(value: unknown): Record<string, unknown> | null`
  - 상세: `execution.outputData`/`nodeExec.outputData` 가 항상 object-or-null 이라는 DB 계약에 의존해 `Record<string, unknown>` 으로 강제 캐스팅한다. 배열/원시값이 JSONB 컬럼에 저장될 수 있는 극단적 케이스라면 caller 쪽 타입 기대와 어긋날 수 있으나, 이는 이 diff 이전부터 존재하던 캐스팅 패턴(`deepRedactSecrets(...) as Record<string, unknown>`)을 그대로 계승한 것이라 이번 diff 가 새로 만든 리스크는 아니다.
  - 제안: 조치 불요 — 참고용 기록.

- **[INFO]** 코드 검증 결과 — 기능 완전성·엣지 케이스·spec 정합 모두 확인됨(positive finding)
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts` (`stripDeep`), `codebase/backend/src/modules/websocket/websocket.service.ts` (`emitExecutionEvent`/`emitNodeEvent`), `codebase/backend/src/modules/external-interaction/interaction.service.ts` (`stripAndRedact`, `getStatus`)
  - 상세: 직접 실행 검증 결과:
    1. `stripDeep` 의 경계 연산자는 JSDoc 이 선언한 대로 `>` 로 고정돼 있고(`if (depth > maxDepth) return value;`), 형제 함수 `sanitizePayloadForWs`(`depth > MAX_SANITIZE_DEPTH`)·`deepRedactSecrets`(`depth >= MAX_REDACT_DEPTH`)와의 경계 차이도 JSDoc 표와 실제 코드가 정확히 일치한다.
    2. `stripAndRedact` 의 null 처리(`value === null || value === undefined) return null`)가 `getStatus()` 세 출구(waiting `nodeOutput`, terminal `result`, terminal `error`) 모두에 정확히 대칭 적용됨을 확인 — waiting 은 `?? {}` 로 흡수, terminal 은 `null` 그대로 전파(신규 회귀 테스트가 이 구분을 고정).
    3. `websocket.service.ts` → `notification-fanout.service.ts` 로 이어지는 `executionEvents$` 스트림이 이미 strip 된 `fanoutEnvelope` 을 방출함을 소스 추적으로 확인 — CHANGELOG 가 주장하는 "3개 출구(SSE·webhook·chat-channel)가 같은 strip 을 공유한다" 는 서술이 실제 배선과 일치한다.
    4. `spec/5-system/14-external-interaction-api.md` §6.2 blockquote 에 새로 추가된 `waitingNodeType` 매핑이 `ai-turn-orchestrator.service.ts`/`form-interaction.service.ts`/`button-interaction.service.ts`/`chat-channel.dispatcher.ts`/`channel-web-chat/eia-types.ts` 전 소비처에서 실제로 쓰이고 있음을 grep 으로 확인 — 이 spec 갱신은 코드를 뒤늦게 따라잡은 정확한 문서화다(CHANGELOG 의 "코드가 앞질러 있던 서술 7곳을 따라잡힌다" 주장과 일치).
    5. 관련 테스트 3파일(`interaction.service.spec.ts`, `websocket.service.spec.ts`, `strip-external-only-fields.spec.ts`) 109건 + `notification-fanout.service.spec.ts` 11건을 직접 실행해 전부 통과 확인.
  - 제안: 없음(positive finding). TODO/FIXME/HACK/XXX 주석은 변경 파일 전체에서 검색했으나 없음.

### 요약
이번 diff 의 핵심은 `execution.waiting_for_input` 의 `llmCalls`(raw LLM 프롬프트/응답) 가 WS fanout 은 depth-1 shallow strip 만, REST `getStatus` 스냅샷은 값 마스킹(`deepRedactSecrets`)만 걸려 있어 중첩 위치·REST 경로 양쪽으로 새던 결함을 신규 공유 유틸 `stripExternalOnlyFields`(깊이-무관, 필드명 기준)로 교정하고 `interaction.service.ts` 의 세 출구(waiting/terminal result/terminal error)에 `stripExternalOnlyFields` + `deepRedactSecrets` 를 대칭으로 걸었다. 직접 코드·테스트를 읽고 실행한 결과 경계 연산자·null 처리·clone-on-write·`__proto__` 방어·순서 무관성 등 앞선 8라운드 리뷰가 지적한 항목들이 모두 실측/테스트로 닫혀 있고, spec 문서(`5-system/14-external-interaction-api.md`, `5-system/6-websocket-protocol.md`, `1-data-model.md`)도 실제 구현·배선과 line-level 로 일치한다. 유일하게 남은 것은 `CANCELLED` 상태에서 `error` 필드가 채워지지 않는 pre-existing 갭(이 diff 범위 밖, spec 도 이미 "형태 불일치"로 알려진 상태로 표기)뿐이며 신규 결함이 아니다. TODO/FIXME 류 미완성 표식도 없다.

### 위험도
NONE
