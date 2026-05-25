# 문서화(Documentation) 리뷰 결과

리뷰 대상: workflow-resumable-execution Phase 2 cont — spec 변경 + review/consistency 산출물
검토 일시: 2026-05-25

---

## 발견사항

### [INFO] `spec/1-data-model.md` — `error.code` 어휘 확장 설명이 단일 셀에 집중되어 가독성 저하
- 위치: `spec/1-data-model.md` Execution 테이블의 `error` 컬럼 셀
- 상세: 엔진 인프라 차원 에러 코드 4종(`SERVER_INTERRUPTED`, `WORKER_HEARTBEAT_TIMEOUT`, `RESUME_FAILED`, `RESUME_CHECKPOINT_MISSING`, `RESUME_INCOMPATIBLE_STATE`)과 각 cross-link를 단일 셀에 나열했다. 가독성 면에서 테이블 셀이 지나치게 길어졌고, 각 코드에 대한 설명과 링크가 줄바꿈 없이 이어지는 구조다. 독자가 이 셀을 처음 읽을 때 어휘 목록인지 설명 글인지 구분하기 어렵다.
- 제안: 해당 컬럼 설명 외에, `spec/1-data-model.md` 에 별도 소섹션(`### Execution.error.code 어휘`)을 추가하거나, 이미 이 어휘를 정의하는 `spec/5-system/4-execution-engine.md` 로 cross-link만 남기고 상세는 위임하는 방식을 고려한다.

---

### [INFO] `spec/4-nodes/6-presentation/0-common.md §10.9` — SoT 경계 구분 주석 미추가
- 위치: `spec/4-nodes/6-presentation/0-common.md §10.9` Layer 표
- 상세: `rationale_continuity.md` (파일 7, 발견사항 5)에서 "outer 메시지 스키마(`executionId`, `nodeExecutionId`, `type`)는 §7.4, inner payload sentinel wrap은 §10.9" 경계를 한 줄로 명시하라고 권고했다. 이번 변경에서 전송 매체(Redis pub/sub → BullMQ)를 올바르게 갱신했지만, 두 SoT의 경계를 구분하는 명시적 주석은 추가되지 않았다. 독자가 `nodeExecutionId` 필드가 어떤 스펙 문서에 정의됐는지 찾으려면 두 문서를 모두 봐야 한다.
- 제안: `§10.9` Layer 표 하단에 "(outer 메시지 스키마 `{executionId, nodeExecutionId, type}` 의 SoT는 [실행 엔진 §7.4](../../5-system/4-execution-engine.md#74-분산-실행-multi-instance), inner payload sentinel wrap 의 SoT는 본 §10.9)" 한 줄을 추가한다.

---

### [INFO] `spec/5-system/6-websocket-protocol.md` — `queued` 필드 설명이 click_button ack 블록에만 위치
- 위치: `spec/5-system/6-websocket-protocol.md` §4.2, `queued: boolean` 필드 설명 단락
- 상세: `queued` 필드가 `submit_form` / `submit_message` / `end_conversation` ack 에도 공통 적용된다고 설명 단락에 명시하지만, 실제로 각 ack 명령의 success payload 코드 블록(`click_button` 이외)에는 `queued` 필드가 표시되지 않는다. 독자가 다른 ack의 payload 예시를 보면 `queued` 필드의 존재를 인식하지 못할 수 있다.
- 제안: 각 ack 명령의 success payload 예시 블록에 `queued: false` 를 추가하거나, 공통 설명 단락 위치를 각 명령 공통 섹션 앞으로 이동해 "이하 모든 ack에 적용" 임을 구조적으로 명확히 한다.

---

### [INFO] `spec/5-system/4-execution-engine.md` — `RESUME_BULLMQ_ATTEMPTS` ENV vs 코드 상수 모호성 (인라인 주석 불명확)
- 위치: `spec/5-system/4-execution-engine.md §11` 환경변수 표 (diff는 파일 크기로 생략됨, `naming_collision.md` 파일 21 기준)
- 상세: `naming_collision.md`(파일 21)에서 "§11 환경변수 표에 `RESUME_BULLMQ_ATTEMPTS`를 환경변수로 등재하면서 `(현재 양쪽 모두 코드 상수, ENV 화는 후속)` 병기"한다고 확인했다. 실제 코드에서는 ENV로 읽는 코드 없이 상수 3이 하드코딩된다. 환경변수 목록에 ENV가 아닌 항목이 혼재하면, 운영자가 해당 값을 환경변수로 설정하려 할 때 혼동이 발생할 수 있다.
- 제안: 표 제목을 "환경변수 (및 코드 상수)"로 변경하거나, `RESUME_BULLMQ_ATTEMPTS` 행의 비고 컬럼에 "(현재 코드 상수 — `continuation-execution.queue.ts:36` 하드코딩 3, ENV화는 후속 PR)" 으로 더 명확히 기재한다.

---

### [INFO] `spec/data-flow/3-execution.md §2.3` — `exec:cont:seq:<executionId>` Redis 키의 TTL 미설정 근거 미문서화
- 위치: `spec/data-flow/3-execution.md §2.3` Redis 키 표, `exec:cont:seq:<executionId>` 행
- 상세: TTL 컬럼에 "미설정 (자연 expire 미적용 — Phase 3 후속)"이라고 기재되어 있다. TTL이 없는 글로벌 Redis 키는 운영 환경에서 메모리 누수 위험이 있으므로, 독자나 운영자가 이 결정의 근거를 바로 확인할 수 없다면 불안감을 유발할 수 있다.
- 제안: 해당 행 비고 또는 표 하단 주석에 "Phase 3에서 TTL을 설정하는 근거: executionId별 단조 seq 카운터이므로 Execution이 종결 후에도 키가 남아 있어도 동작에 영향 없음. 메모리 비용은 executionId당 8 bytes 미만으로 무시 가능 수준" 정도의 한 줄 설명을 추가한다.

---

### [INFO] `spec/5-system/3-error-handling.md` — cross-link 블록쿼트가 테이블과 분리되어 위치가 다소 모호
- 위치: `spec/5-system/3-error-handling.md` §3 에러 코드 표 직후 blockquote
- 상세: `INVALID_STATE` 행 아래에 추가된 blockquote("WS commands에서는 동일 의미를 `INVALID_EXECUTION_STATE` 코드로 표기...")는 역방향 cross-link로서 적절하다. 다만 blockquote가 테이블과 다음 섹션(`### 1.4 워크플로우 실행 에러`) 사이에 위치하면서, `INVALID_STATE` 행에만 관련이 있는 주석인지 해당 섹션 전체에 관한 주석인지 명확하지 않다.
- 제안: blockquote를 `INVALID_STATE` 행의 비고 컬럼 인라인에 "(→ WS에서는 `INVALID_EXECUTION_STATE`, [§7.5.1](...))" 형태로 이동하거나, 현재 위치를 유지하면서 앞에 "**`INVALID_STATE` 관련:**" 레이블을 추가해 대상을 명확히 한다.

---

### [WARNING] `spec/5-system/4-execution-engine.md §7.5.1` — 구현 현황 인라인 노트 누락 (spec-impl 갭 문서화 부재)
- 위치: `spec/5-system/4-execution-engine.md §7.5.1 Publisher 측 사전 검증` (diff 생략, `rationale_continuity.md` 파일 15, 발견사항 5에서 확인)
- 상세: `rationale_continuity.md`(파일 15) 발견사항 5에서 "§7.5.1에 '현재 구현은 sentinel publish 경로로 우회 — 후속 PR에서 동기 반환으로 전환 예정' 구현 현황 인라인 노트를 추가하라"고 권고했다. 해당 노트 없이 spec에 "client에 즉시 `INVALID_EXECUTION_STATE`를 반환한다"고 규범적으로 기술하면, 실제 구현(sentinel publish → worker rehydrateAndResume → 에러 surface)과 spec이 불일치하는 상태가 된다. 미래 구현자가 spec 기준으로 동기 반환을 기대하고 구현했다가 혼동할 수 있다.
- 제안: `§7.5.1` 본문에 다음 인라인 노트를 추가한다: `> Phase 2 cont 시점 구현: sentinel publish → ContinuationProcessor → RESUME_CHECKPOINT_MISSING 으로 surface (1-2초 지연). 동기 반환 경로(SELECT FOR UPDATE → 즉시 ack)는 후속 PR에서 전환 예정.`

---

### [WARNING] `spec/5-system/4-execution-engine.md §Rationale` — heartbeat 기반 전환 결정 근거 미등재
- 위치: `spec/5-system/4-execution-engine.md §Rationale` "Durable Continuation & Graceful Shutdown (2026-05-24)"
- 상세: `rationale_continuity.md`(파일 7) 발견사항 1에서 "기존 `started_at < now() - 30분` 임계값을 heartbeat 미응답 기반으로 교체한 결정 근거가 Rationale에 누락됐다"고 WARNING으로 식별했다. 이 근거가 없으면 미래 독자가 왜 시간 임계값 방식을 버렸는지 알 수 없어, 30분 임계값을 다시 도입하거나 조합해 사용하려는 시도가 발생할 수 있다.
- 제안: `§Rationale "Durable Continuation (2026-05-24)"` 또는 §7.4 Recovery 절 인라인에 다음 단락을 추가한다: "기존 `started_at < now() - 30분` 임계값 기반 Recovery를 heartbeat 미응답 기반으로 교체한 이유: 시간 임계값은 정상 대기 중인 `WAITING_FOR_INPUT` Execution도 30분 초과 시 일괄 FAIL 처리해 운영 회귀를 유발했다. heartbeat 기반은 RUNNING 상태의 worker 응답 여부만 확인하므로 WAITING_FOR_INPUT은 영향을 받지 않는다."

---

### [WARNING] `spec/5-system/4-execution-engine.md §Rationale` — rehydration 실패 단말 상태 선택 근거 미등재
- 위치: `spec/5-system/4-execution-engine.md §Rationale`
- 상세: `rationale_continuity.md`(파일 7) 발견사항 6에서 "rehydration 실패 단말 케이스에서 Execution이 `failed`가 아닌 `cancelled`로 마감되는 이유가 Rationale에 없다"고 WARNING으로 식별했다. `cancelled`와 `failed`는 사용자 경험에서 다른 의미를 지니며(사용자가 취소한 것 vs 시스템 오류), 이 선택이 문서화되지 않으면 구현자가 `failed`가 더 적절하다고 판단해 변경할 위험이 있다.
- 제안: `§Rationale`에 다음 항목을 추가한다: "rehydration 실패 단말 상태 — NodeExecution: `failed`, Execution: `cancelled` 이분 이유: 인프라 실패로 종결되더라도 사용자 관점에서는 '본인이 관여한 인터랙션이 처리되지 않음'이므로 `cancelled`로 분류. NodeExecution은 실제 오류 발생 노드를 표시하기 위해 `failed`를 사용. 동일 패턴: `waiting_for_input → failed` 전이 추가 (2026-05-19) Rationale 참조."

---

### [WARNING] `spec/5-system/4-execution-engine.md §Rationale` — `INVALID_EXECUTION_STATE` WS 전용 분류 결정 근거 미공식 등재
- 위치: `spec/5-system/4-execution-engine.md §Rationale` 또는 `spec/5-system/6-websocket-protocol.md §Rationale`
- 상세: `rationale_continuity.md`(파일 15) 발견사항 3에서 "`INVALID_EXECUTION_STATE`를 'WS ack 전용 코드'로 확정하는 것이 기존 합의에 없던 새 결정이나 Rationale 부재"라고 WARNING으로 식별했다. `§4.2` 에러 코드 표에 "WS 전용 코드" 주석을 추가한 것으로 충분하지 않다 — WS/REST 두 레이어에서 다른 이름을 유지하는 근거(왜 통일하지 않는가)가 Rationale로 공식 등재되지 않으면 미래에 재논의될 수 있다.
- 제안: `spec/5-system/4-execution-engine.md §Rationale` 또는 `spec/5-system/6-websocket-protocol.md §Rationale`에 다음 항목을 추가한다: "WS/REST 에러 코드 이름 분리 유지 (`INVALID_EXECUTION_STATE` vs `INVALID_STATE`) — 통일 대안을 기각한 이유: WS ack error와 REST 422 error는 클라이언트 error routing 분기가 다르므로 같은 코드를 사용하면 클라이언트가 두 경로를 잘못 병합할 위험이 있다. historical artifact로 생성된 이름이지만 의도적으로 분리를 유지한다."

---

### [WARNING] `review/consistency/2026/05/25/08_41_30/_retry_state.json` — agents_pending 상태 불일치
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/workflow-resumable-execution-phase2-cont-64f537/review/consistency/2026/05/25/08_41_30/_retry_state.json`
- 상세: `_retry_state.json`의 `agents_pending` 배열에 5개 agent가 모두 등재되어 있고(`agents_success: []`, `agent_history: {}`), 실제 산출 파일(`SUMMARY.md`, 각 checker 결과 `.md`)은 모두 생성 완료된 상태다. 이는 초기 상태로 기록된 retry state가 완료 후 갱신되지 않은 것을 의미한다. 다른 두 세션(`07_12_25`, `08_28_14`)의 `_retry_state.json`은 `agents_pending: []`, `agents_success: [모든 agent]`로 올바르게 갱신되어 있다.
- 제안: `08_41_30/_retry_state.json`의 `agents_pending`을 `[]`로, `agents_success`를 `["cross_spec", "rationale_continuity", "convention_compliance", "plan_coherence", "naming_collision"]`로 갱신하고 `agent_history`도 채운다. 이는 재시도 정책 추적에 영향을 줄 수 있다.

---

### [INFO] `review/consistency` 산출물 — `meta.json` 파일에 newline 미종결 일관성
- 위치: `review/consistency/2026/05/25/07_12_25/meta.json`, `08_28_14/meta.json`, `08_41_30/meta.json`
- 상세: 세 `meta.json` 파일 모두 `\ No newline at end of file` 경고로 마감된다. JSON 파일의 newline 미종결은 일부 도구(diff, cat 등)에서 경고를 유발하며 POSIX 규약 위반이다. `_retry_state.json` 파일도 동일하다.
- 제안: JSON 파일 작성 시 파일 마지막에 개행(`\n`)을 추가한다.

---

## 요약

이번 변경의 핵심은 Redis pub/sub Continuation Bus를 BullMQ 영속 큐로 교체하는 아키텍처 전환과 그에 따른 spec 문서 갱신이다. 문서화 관점에서 보면, `spec/0-overview.md`, `spec/data-flow/0-overview.md`, `spec/data-flow/3-execution.md`, `spec/4-nodes/6-presentation/0-common.md`, `spec/5-system/3-error-handling.md`, `spec/5-system/6-websocket-protocol.md`, `spec/5-system/10-graph-rag.md`, `spec/1-data-model.md` 모두 기술 변경을 올바르게 반영했고 cross-link도 일관되게 갱신되었다. 가장 중요한 미흡 사항은 Rationale 문서화 3건이다: (1) heartbeat 기반 Recovery 전환 결정 근거, (2) rehydration 실패 단말 상태 `cancelled` 선택 근거, (3) `INVALID_EXECUTION_STATE` WS 전용 분류 결정 근거가 모두 `spec/5-system/4-execution-engine.md §Rationale`에 공식 등재되지 않았다. 이 Rationale 누락은 미래 구현자가 동일한 결정을 재논의하거나 번복할 위험을 높이므로 수정이 권장된다. 추가로 `§7.5.1`의 spec-impl 갭(동기 반환 규범 vs 실제 비동기 구현) 인라인 노트가 없어 구현자 혼동이 예상된다. `review/consistency/08_41_30/_retry_state.json`의 상태 불일치(agents_pending 미갱신)는 운영 도구 추적에 영향을 줄 수 있어 정정이 필요하다.

---

## 위험도

MEDIUM

Rationale 문서화 누락 3건(WARNING)이 spec 단일 진실 원칙의 "결정 근거는 Rationale에 기록" 규약을 직접적으로 위반하며, 미래 구현자가 기각된 대안을 재도입하거나 상태 선택을 변경하는 회귀로 이어질 수 있다. 나머지 INFO 항목들은 가독성 보완 수준이다.
