# 요구사항(Requirement) 리뷰 결과

리뷰 대상: workflow-resumable-execution Phase 2 cont — spec 변경 + consistency 검토 산출물
리뷰 일시: 2026-05-25

---

## 발견사항

### [WARNING] `INVALID_EXECUTION_STATE` — spec §7.5.1 규범 vs 구현 간 spec-impl 갭 명시됐으나 단일 진실 위치 모호
- 위치: `spec/5-system/4-execution-engine.md §7.5.1` / `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2923 (resolveWaitingNodeExecutionId)`
- 상세: spec §7.5.1 은 publisher 측에서 lookup 0건 / 다중 row 시 "즉시 client 에 `INVALID_EXECUTION_STATE` 동기 응답" 을 규범으로 정의한다. 그러나 구현 현황 인라인 노트("현재 backend 는 `__no_node_exec__` sentinel publish 로 우회 — worker 가 `RESUME_CHECKPOINT_MISSING` 으로 surface. 동기 반환은 후속 PR 예정")와 실제 코드(line 2936: `return '__no_node_exec__'`)가 일치한다. 이 자체는 spec 에 명시되어 인지된 갭이지만, spec 규범과 현 구현이 반대 동작을 한다는 점이 중요하다. 구체적으로 현 구현에서는 0건 lookup 시 사용자가 즉시 `INVALID_EXECUTION_STATE` 를 받지 않고 1-2초 지연 후 `EXECUTION_CANCELLED` 이벤트를 받는다. 후속 PR 이 병합될 때까지 이 동작 차이가 클라이언트에게 노출된다.
- 제안: `plan/in-progress/` 에 `resolveWaitingNodeExecutionId` throw 전환 작업이 별 추적 항목으로 등록되어 있는지 확인. spec §7.5.1 의 구현 현황 노트에 해당 plan 파일 직접 링크를 추가하면 추적 가능성이 향상된다.

---

### [WARNING] `queued: boolean` ack 필드 — spec 과 구현 간 의미 불일치
- 위치: `spec/5-system/6-websocket-protocol.md §4.2` / `codebase/backend/src/modules/websocket/websocket.gateway.ts:406-410`
- 상세: spec §4.2 는 "`queued: boolean` 은 선택 필드 — `true` 면 continuation-queue 로 enqueue 만 됐고 실제 재개는 다른 인스턴스가 비동기로 수행. `false` (또는 미동봉) 이면 in-instance fast path 로 즉시 resolve"라고 정의한다. 그러나 현재 websocket.gateway.ts 의 `handleSubmitForm` (line 394-418) 은 `result.queued` 가 `false` 이면 `success: false` 에러 ack 를 반환하고, `true` 이면 `resumed: true, queued: result.queued` 를 반환한다. 즉 현재 구현에서는 `queued: false` 인 "in-instance fast path" 분기가 성공 응답이 아닌 에러 응답으로 처리된다. spec 의 정의와 실제 구현의 `queued: false` 처리 경로가 반대이다. spec 은 `queued: false` = 즉시 resolve 성공으로 정의하지만, 구현은 `queued: false` = enqueue 실패로 처리한다.
- 제안: spec 의 의미와 구현 의미 중 어느 쪽이 맞는지 결정이 필요하다. 현재 BullMQ 전환 후에는 "in-instance fast path" 개념이 제거됐고 항상 BullMQ enqueue 가 이루어지므로, `queued: false` 의 실질적 의미는 "enqueue 실패(Redis 장애)" 이다. spec §4.2 의 `queued: false` 정의("in-instance fast path 로 즉시 resolve")를 현재 구현에 맞게 "enqueue 자체 실패 — 재시도 권장" 으로 갱신하거나, 또는 spec 대로 fast path 가 남아있다면 구현에서 해당 분기를 성공 ack 로 반환하도록 수정해야 한다.

---

### [WARNING] `exec:cont:seq:<executionId>` Redis 키 — `spec/5-system/4-execution-engine.md §9.2` 에 미등재
- 위치: `spec/data-flow/3-execution.md §2.3` (신규 등재) / `spec/5-system/4-execution-engine.md §9.1/§9.2` (누락)
- 상세: `exec:cont:seq:<executionId>` 키는 `spec/data-flow/3-execution.md §2.3` 에는 추가됐으나, Redis 키 패턴의 SoT 인 `spec/5-system/4-execution-engine.md §9.2` 의 Redis 키 목록에는 없다. `§9.1` 의 전역 키 패턴 예외 note 도 `exec:recover:lock` 만 언급하며 이 키의 `workspaceId` 없는 전역 패턴 예외를 설명하지 않는다. 단일 진실 원칙상 SoT 가 분산된 상태.
- 제안: `spec/5-system/4-execution-engine.md §9.2` 에 `exec:cont:seq:<executionId>` 행 추가 및 §9.1 전역 키 예외 note 보완. TTL 미설정("자연 expire 미적용 — Phase 3 후속")도 spec §9.2 에 명시해야 한다.

---

### [WARNING] `RESUME_*` 에러 코드 3종 — `spec/5-system/3-error-handling.md` 공용 에러 카탈로그 미등재
- 위치: `spec/5-system/6-websocket-protocol.md §4.2` (정의됨) / `spec/5-system/3-error-handling.md` (없음)
- 상세: `RESUME_CHECKPOINT_MISSING` / `RESUME_FAILED` / `RESUME_INCOMPATIBLE_STATE` 세 코드는 §4.2 에러 코드 표에 정의되어 있고 `spec/1-data-model.md §2.13` error.code 어휘에도 등재됐다. 그러나 `spec/5-system/3-error-handling.md` 의 공용 에러 카탈로그에는 존재하지 않는다. `SERVER_SHUTTING_DOWN` 역시 동일하게 §11 에만 정의되고 3-error-handling.md 에 미등재 상태다. 이는 naming_collision 검토에서도 INFO 수준으로 지적됐다.
- 제안: `spec/5-system/3-error-handling.md §1.4 워크플로우 실행 에러` 에 `RESUME_CHECKPOINT_MISSING`, `RESUME_FAILED`, `RESUME_INCOMPATIBLE_STATE`, `SERVER_SHUTTING_DOWN` 네 코드를 각각 정의 scope (WS §4.2 / §11) 참조와 함께 등재한다. 또는 해당 파일에 "WS-only / engine-only 에러 코드는 각 domain spec 참조" 범위 선언을 추가해 단일 진실 원칙의 예외를 명문화한다.

---

### [WARNING] `recoverStuckExecutions` — `WAITING_FOR_INPUT` 보존 변경의 `NodeExecution` 단위 처리 누락
- 위치: `spec/5-system/4-execution-engine.md §7.4 Recovery` / `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:1508-1558`
- 상세: spec §7.4 는 "WAITING_FOR_INPUT 상태의 Execution 은 무시. 사용자 입력이 도착하면 §7.5 rehydration 으로 자연 재개"라고 기술한다. 구현도 `status = RUNNING` 에만 `.where('status = :status', { status: ExecutionStatus.RUNNING })` 조건을 걸어 WAITING_FOR_INPUT 을 건드리지 않는다. 이 부분은 일치한다. 그러나 RUNNING Execution 이 FAILED 로 마킹될 때 동반 NodeExecution 처리(해당 RUNNING 상태의 NodeExecution 을 FAILED 로 마킹)가 `recoverStuckExecutions` 구현 내에서 실행되는지 spec 에 명시되지 않았고 코드에서도 Execution 행만 UPDATE 한다(line 1529-1544). spec §7.4 는 NodeExecution 처리를 별도로 언급하지 않아 ambiguity 가 있다.
- 제안: spec §7.4 에 "stuck RUNNING 마킹 시 동반 NodeExecution 처리 여부(일괄 FAILED 또는 무시)" 를 명시한다. 구현 코드도 해당 방향으로 일치시켜야 한다.

---

### [INFO] `spec/5-system/10-graph-rag.md` frontmatter `status: implemented` 갱신 — 현재 worktree 에만 반영, main 미병합
- 위치: `spec/5-system/10-graph-rag.md` frontmatter
- 상세: worktree 의 `10-graph-rag.md` 는 `status: implemented` + `code: [...]` 로 갱신됐다. 이는 세 consistency 검토(07_12_25, 08_41_30) 에서 이미 지적된 대로 올바른 갱신이다. 단, 이 변경이 main 에 merge 되기 전까지 다른 agent 가 main 의 `spec-only` 상태를 보고 미구현으로 판단하는 리스크가 존재한다. plan_coherence 검토에서 INFO 수준으로 이미 문서화됨.
- 제안: 추가 조치 없음. 현 PR merge 시 자동 해소된다.

---

### [INFO] consistency 검토 산출물 `_retry_state.json` (08_41_30) — `agents_pending` 에 5개 checker 모두 listed, `agents_success: []`
- 위치: `review/consistency/2026/05/25/08_41_30/_retry_state.json`
- 상세: 세 번째 consistency check (08_41_30) 의 `_retry_state.json` 파일이 초기 상태(`agents_pending: [...5개...]`, `agents_success: []`)로 저장되어 있다. 그러나 실제로는 5개 checker 모두 완료됐고 SUMMARY.md 파일도 작성됐다. 이는 하네스가 `_retry_state.json` 을 초기 직후 Write 한 뒤 sub-agent 실행 완료 후 갱신하지 않은 채 종료된 케이스로 보인다. subagent-call-contract.md 의 재시도 상태 추적이 올바르게 완료됐으나 파일이 stale 상태다. 기능 자체에 영향 없음.
- 제안: 하네스 구현에서 session 완료 시 `_retry_state.json` 을 최종 상태로 flush 하는 단계 추가 여부를 검토한다.

---

### [INFO] `spec/4-nodes/6-presentation/0-common.md §10.9` — outer/inner payload 스키마 SoT 경계 미명시
- 위치: `spec/4-nodes/6-presentation/0-common.md §10.9` (Layer (2) 행)
- 상세: 변경된 표에서 "본 §10.9" 를 SoT 라고 명시하지만, outer 메시지 스키마(`executionId`, `nodeExecutionId`, `type`) 의 SoT 가 §7.4 이고 inner sentinel wrap(`{ type: 'form_submitted', formData }`)의 SoT 가 §10.9 라는 경계가 불명확하다. rationale_continuity 검토(07_12_25 #5) 에서도 동일하게 지적됐다.
- 제안: Layer (2) 행의 SoT 컬럼을 "outer 메시지 스키마 SoT: [실행 엔진 §7.4](../../5-system/4-execution-engine.md#74) / inner sentinel wrap SoT: 본 §10.9" 로 분리 명시.

---

### [INFO] consistency 검토 3회 실행 — 동일 `spec/5-system/` scope 에 대해 07_12_25, 08_41_30 두 번의 `--impl-prep` 검토가 존재
- 위치: `review/consistency/2026/05/25/07_12_25/` 및 `review/consistency/2026/05/25/08_41_30/`
- 상세: 같은 scope (`spec/5-system/`) 에 대해 impl-prep 검토가 두 번 실행됐다. 07_12_25 는 spec 변경 전 원래 `spec/5-system/` 상태를 대상으로, 08_41_30 은 spec 변경 후 상태를 재검토한 것으로 보인다. 이중 실행 자체는 문제가 아니며 두 번째 검토(08_41_30)가 "본 PR 영역 BLOCK: NO" 를 결론으로 냈으므로 절차상 문제 없음. 단, 08_41_30 SUMMARY 의 pre-existing CRITICAL 4건(auth, graph-rag, mcp-client, chat-channel spec-impl-evidence 위반)은 별 spec PR 로 처리되어야 하며 본 PR 이 해소하지 않는다.
- 제안: 추가 조치 없음. pre-existing CRITICAL 4건은 별도 project-planner 픽업 필요.

---

## Spec Fidelity 점검 (관련 spec 문서 식별 및 line-level 일치 여부)

관련 spec 문서:
- `spec/5-system/4-execution-engine.md` — §7.4 Continuation Bus, §7.5 rehydration, §7.5.1, §9.1/§9.2/§9.3, §11 Graceful Shutdown (SoT)
- `spec/5-system/6-websocket-protocol.md` — §4.2 실행 제어 명령 에러 코드 + ack payload
- `spec/5-system/3-error-handling.md` — 공용 에러 카탈로그
- `spec/1-data-model.md §2.13` — Execution.error.code 어휘
- `spec/data-flow/0-overview.md §4/§5` — BullMQ 큐 카탈로그, Continuation bus 설명
- `spec/data-flow/3-execution.md §1.3/§2.2/§2.3` — 시퀀스 다이어그램, 큐/Redis 목록

주요 line-level 점검 결과:

1. **BullMQ 전환 전파**: `spec/0-overview.md §2.6`, `spec/data-flow/0-overview.md §4/§5`, `spec/data-flow/3-execution.md §2.3`, `spec/4-nodes/6-presentation/0-common.md §10.9` 모두 "Redis pub/sub" → "BullMQ `execution-continuation`" 로 일관되게 갱신됨. 일치.

2. **`queued: boolean` 선택 필드**: spec §4.2 정의 ("선택 필드", `false` = in-instance fast path) 와 구현 (`queued: false` = enqueue 실패) 간 의미론 불일치. **[WARNING 참조]**

3. **`INVALID_EXECUTION_STATE` §7.5.1 규범**: spec §7.5.1 에 동기 반환 규범 기술됨. 구현 현황 노트에 "현재 sentinel 우회" 명시됨. spec 자체가 갭을 인지하고 있어 spec 결함은 아니나 규범과 구현이 현재 불일치. **[WARNING 참조]**

4. **`RESUME_*` 코드 3종**: `spec/5-system/6-websocket-protocol.md §4.2` 에 등재 + `spec/1-data-model.md §2.13` 에 어휘 추가. 구현에서는 `'RESUME_CHECKPOINT_MISSING'` / `'RESUME_FAILED'` / `'RESUME_INCOMPATIBLE_STATE'` 문자열이 `execution-engine.service.ts` 에 사용됨. 일치.

5. **`exec:cont:seq:<executionId>` 키**: `spec/data-flow/3-execution.md §2.3` 에 등재, `spec/5-system/4-execution-engine.md §9.2` 미등재. 구현 `ContinuationBusService.SEQ_KEY_PREFIX = 'exec:cont:seq:'` 존재. spec 단일 진실 분산. **[WARNING 참조]**

6. **`SERVER_SHUTTING_DOWN` / `SERVER_INTERRUPTED`**: `spec/5-system/4-execution-engine.md §11` 에 정의, `spec/5-system/3-error-handling.md` 카탈로그 미등재. 구현에서 두 코드 모두 사용 중. **[WARNING 참조]**

7. **`spec/5-system/10-graph-rag.md` frontmatter**: `status: implemented` + code 경로 목록으로 갱신. `spec/conventions/spec-impl-evidence.md §3.1` 요건 충족. 일치.

8. **`recoverStuckExecutions` WAITING_FOR_INPUT 보존**: spec §7.4 "WAITING_FOR_INPUT 무시" 기술과 구현 코드 `status = RUNNING` 필터 일치. NodeExecution 동반 처리 미명시는 ambiguity. **[WARNING 참조]**

---

## 요약

본 PR 의 핵심 변경(Redis pub/sub Continuation Bus → BullMQ 영속 큐 전환, `spec/5-system/4-execution-engine.md §7.5.1` 신설, `spec/5-system/10-graph-rag.md` frontmatter 갱신, 관련 5개 spec 파일 동기화)은 전반적으로 기능 의도를 충실하게 반영하고 있으며, 3회의 consistency 검토 모두 "BLOCK: NO" 결론을 냈다. 그러나 요구사항 관점에서 두 가지 중요한 spec-impl 불일치가 존재한다. 첫째, `queued: boolean` ack 필드의 `false` 의미가 spec("in-instance fast path 즉시 resolve")과 구현("enqueue 실패")이 반대로 정의되어 있다. 둘째, `spec/5-system/4-execution-engine.md §7.5.1` 의 `INVALID_EXECUTION_STATE` 동기 반환 규범이 현 구현에서 sentinel 우회로 대체되어 있다(spec 에 명시된 알려진 갭이나, 클라이언트 동작 차이 유발). 또한 `exec:cont:seq:*` Redis 키와 `RESUME_*` / `SERVER_SHUTTING_DOWN` 에러 코드의 공용 카탈로그 미등재가 WARNING 수준의 spec 단일 진실 분산 문제로 남아 있다. pre-existing CRITICAL 4건(auth/graph-rag/mcp-client/chat-channel spec-impl-evidence 위반)은 본 PR 범위 밖이며 별도 project-planner 이슈다.

---

## 위험도

MEDIUM

`queued: boolean` 의미론 불일치가 클라이언트 구현자에게 혼동을 줄 수 있고(클라이언트가 `queued: false` = 성공으로 처리했다가 현 구현에서 error ack 를 받는 상황), `INVALID_EXECUTION_STATE` 동기 반환 규범과 현 구현 동작이 다르다는 점이 실질적 사용자 영향을 가진다. 나머지 WARNING 항목들은 spec 정합화 이슈로 구현 동작에 직접 영향을 주지 않는다.
