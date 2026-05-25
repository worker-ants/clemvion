# Cross-Spec 일관성 검토 결과

**대상 draft**: `plan/in-progress/spec-draft-workflow-resumable-execution.md`  
**산출 spec**: `spec/5-system/4-execution-engine.md` (주), `spec/5-system/6-websocket-protocol.md` (부)  
**검토 일자**: 2026-05-24  
**검토 모드**: --spec

---

## 발견사항

### [CRITICAL] §7.4 Continuation Bus — Redis pub/sub 키 네이밍과의 충돌

- **target 위치**: 변경 1.4 §7.4 Continuation Bus 절 — Redis pub/sub → BullMQ 영속 큐
- **충돌 대상**: `spec/5-system/4-execution-engine.md §9.2 Redis 키 네이밍` (line 825–826)
- **상세**: 현행 §9.2 키 정의 표에는 `execution:continuation (Pub/Sub)` 채널이 명시되어 있으며 "워크스페이스 단위가 아닌 **전역**" 이라 별도 예외 항목으로 등록되어 있다. Draft 는 이 채널을 **레거시로 표시하고 제거**한다고 선언하지만, §9.2 표의 해당 행 갱신 지침이 draft 에 누락되어 있다. spec 이 그대로 채택되면 §9.2 는 제거된 채널을 계속 정의하는 불일치 상태가 된다. 또한 신규 BullMQ 큐 이름 `execution-continuation` 에 대응하는 Redis 키 패턴(BullMQ 내부 키) 을 §9.2 에 명시할지 여부를 결정해야 한다.
- **제안**: draft 에 "§9.2 키 정의 표의 `execution:continuation` 행을 삭제하고, BullMQ `execution-continuation` 큐를 §9.2 표 또는 §9.2 뒤 별도 §9.3 BullMQ 큐 목록으로 등재한다" 는 변경 지침을 추가한다.

---

### [CRITICAL] §7.4 Recovery — `recoverStuckExecutions` 스펙 본문과 draft 갱신 대상 절이 충돌

- **target 위치**: 변경 1.5 §7.4 Recovery 절 — 임계값과 대상 좁힘
- **충돌 대상**: `spec/5-system/4-execution-engine.md §7.4 Recovery` (line 767–774) 의 현행 본문
- **상세**: 현행 §7.4 Recovery 절의 **Stale 임계값** 항목은 "`started_at < now() - 30분` 인 row 만 FAIL UPDATE. 30분 미만의 신규 대기는 보존된다." 라고 기술한다. 그러나 `WAITING_FOR_INPUT` 도 포함한 채 30분을 기준으로 처리한다는 **현행 운영 버그** 도 동일 §7.4 본문에는 명시되지 않고, 분산 lock 과 stale 임계 설명만 있다. Draft 는 이를 "신규: `status='running'` 인 row 만 타겟, WAITING_FOR_INPUT 은 무기한 보존" 으로 교체한다고 선언한다. 이 변경이 §7.4 의 어느 위치(분산 lock 설명 뒤, Recovery 헤더 아래) 에 삽입되는지를 draft 가 구체적으로 지정하지 않아 채택 시 §7.4 의 어떤 단락이 교체·보존되는지 모호하다. 또한 현행 §7.4 Recovery 본문은 실행 엔진 내 `data-flow/3-execution.md §1.1` 시퀀스 다이어그램의 `continuation-bus subscribe` 경로와 연결되어 있으며, data-flow 문서도 갱신 대상에 포함돼야 한다.
- **제안**: (a) draft 에서 §7.4 Recovery 절 구체 교체 범위를 명시("기존 '**Stale 임계값**' 불릿 전체를 다음으로 교체…" 형태). (b) `spec/data-flow/3-execution.md` 를 갱신 대상 문서 목록에 추가.

---

### [CRITICAL] §4.4 Continuation Bus 현행 아키텍처 단락과 WS spec의 교차 참조가 draft 에서 누락

- **target 위치**: 변경 1.4 §7.4 Continuation Bus 절
- **충돌 대상**: `spec/5-system/4-execution-engine.md §4.4` (line 355–366), `spec/5-system/6-websocket-protocol.md §4.6 외부 표면 매핑` 표
- **상세**: 현행 §4.4 "이벤트 발행 sink — WebsocketService 단일 sink 정책" 재검토 완료 주석(line 368) 은 `continuation bus (§7.4)` 가 인스턴스 간 fan-out 을 담당한다고 명시한다. BullMQ 전환 후 continuation bus 의 역할이 바뀌면 이 §4.4 주석도 함께 갱신해야 정합이 유지된다. 또한 `spec/5-system/6-websocket-protocol.md §4.6` 의 `execution.resumed` 내부 WS 이벤트 매핑 표는 새 `execution.resumed_after_restart` 이벤트를 포함하지 않는다. draft 변경 2.2 에서 해당 이벤트를 추가하지만 §4.6 매핑 표에 대한 갱신 지침이 없다.
- **제안**: (a) draft 에 "§4.4 Rationale 의 '분산은 Continuation Bus (§7.4) 가 담당 — Redis pub/sub 채널…' 문장을 BullMQ continuation-queue 기반으로 갱신한다" 를 추가. (b) draft 에 "`spec/5-system/6-websocket-protocol.md §4.6` 매핑 표에 `execution.resumed_after_restart` 행을 추가한다" 를 명시.

---

### [WARNING] Graceful Shutdown §11 의 `/api/executions/start` 503 응답 — API 규칙 spec 과 미조율

- **target 위치**: 변경 1.6 §11 Graceful Shutdown — 항목 1 "새 Execution 시작 거부 (`/api/executions/start` 가 503 응답)"
- **충돌 대상**: `spec/5-system/2-api-convention.md` (HTTP 응답 코드 규약), `spec/5-system/3-error-handling.md`
- **상세**: draft 는 SIGTERM 수신 시 `/api/executions/start` 가 `503 Service Unavailable` 을 응답해야 한다고 정의한다. 그러나 현행 api-convention spec 은 503 의 Retry-After 헤더 포함 여부, LB drain 중 503 vs 엔드포인트 비활성화 구현 패턴에 대해 별도 정의가 없다. 503 을 클라이언트에 직접 반환하는 것이 기존 API 에러 shape (`{ error: { code, message } }`) 와 정합하는지 명확하지 않다.
- **제안**: draft 에 "503 응답은 표준 API 에러 shape 을 따르며 `Retry-After: <SIGTERM_GRACE_MS / 1000>` 헤더를 포함한다" 를 보강하거나, `spec/5-system/2-api-convention.md` 에 graceful-shutdown 503 패턴을 등재한다.

---

### [WARNING] BullMQ `attempts: 3` 과 §5.7 노드 유형별 리트라이 정책의 범주 충돌

- **target 위치**: 변경 1.4 §7.4 Continuation Bus — 재시도 `attempts: 3`, 변경 1.3 §7.5 rehydration 멱등성 `attempts: 3`
- **충돌 대상**: `spec/5-system/4-execution-engine.md §5.7 노드 유형별 리트라이 정책` (line 535–546)
- **상세**: §5.7 는 노드 유형별 재시도 정책(Integration 3회, AI 2회, Logic 0회 등) 을 정의하지만, 이는 **노드 핸들러 실행** 에 대한 리트라이이다. Draft 가 도입하는 `continuation-queue attempts: 3` 은 **사용자 입력 재개 큐** 에 대한 재시도이며 서로 다른 레이어이다. 그러나 두 리트라이 설정이 서로 어떻게 합산되는지 명시가 없다. 예를 들어, `processMultiTurnMessage` 가 재시작 후 LLM 호출에 실패하면 §5.7 AI 2회 + continuation-queue 3회의 중첩 재시도가 발생한다. Draft §1.3 "AI Conversation 노드의 비용 영향" 이 이중 호출 가능성을 언급하지만 §5.7 과의 연계 정책을 명시하지 않는다.
- **제안**: draft §7.5 에 "continuation-queue retry 는 재개 큐 전달 레이어의 재시도이며, 핸들러 실행 후 LLM 리트라이(§5.7) 와는 독립적으로 적용된다. 합산 최악 시나리오: 큐 3회 × LLM 2회 = 최대 6회 LLM 호출 가능성(멱등성 가드로 중복 결과 차단)" 을 명시한다. 또는 §5.7 표에 continuation-queue 레이어를 별도 행으로 추가한다.

---

### [WARNING] Execution.error 의 신규 `code` 값 4종 — `spec/1-data-model.md §2.13` 본문 갱신 대상 명시 누락

- **target 위치**: 변경 3 `spec/1-data-model.md` — "Execution.error (`JSONB`) 에 새 `code` 값 4종 추가… spec 본문 §2.13 의 설명 한 줄 보강만 필요"
- **충돌 대상**: `spec/1-data-model.md §2.13 Execution` (line 1119) 의 `error` 필드 설명 "에러 정보. 최초 failed NodeExecution의 에러를 참조/복사"
- **상세**: draft 는 "본문 §2.13 Execution.error 의 설명 한 줄 보강만 필요" 라고 서술하지만, 구체적으로 어떤 텍스트를 어디에 삽입하는지 지정하지 않는다. 현행 §2.13 의 `error` 필드 설명과 그 아래 `Execution.error ↔ NodeExecution.error 관계` 표는 `code` 값 어휘를 정의하지 않는다. 신규 코드 4종(`SERVER_INTERRUPTED`, `RESUME_FAILED`, `RESUME_CHECKPOINT_MISSING`, `RESUME_INCOMPATIBLE_STATE`) 이 추가되면 이 표의 `구조` 행에서 `code` 가 어떤 값을 가질 수 있는지를 명시해야 한다. 미명시 시 data-model 과 websocket spec 의 에러 코드 어휘가 분리된 채 유지된다.
- **제안**: draft 에 §2.13 `error` 필드 설명의 구체 갱신 텍스트("새 code 값: `SERVER_INTERRUPTED` / `RESUME_FAILED` / `RESUME_CHECKPOINT_MISSING` / `RESUME_INCOMPATIBLE_STATE`") 와 삽입 위치를 명시한다.

---

### [WARNING] `spec/0-overview.md §6.1` 구현 완료 목록 — continuation bus 설명이 갱신 대상

- **target 위치**: 변경 전반 (Redis pub/sub → BullMQ continuation-queue 전환)
- **충돌 대상**: `spec/0-overview.md §6.1 구현 완료` 표 (line 357) — "분산 continuation bus" 설명
- **상세**: `spec/0-overview.md §6.1` 의 시스템 구현 완료 목록은 "실행 엔진(Redis 큐 + 워커 풀, **분산 continuation bus**)" 을 기술한다. Draft 가 채택되면 continuation bus 는 Redis pub/sub 이 아닌 BullMQ 영속 큐로 바뀐다. §6.1 설명이 그대로면 독자가 "분산 continuation bus = Redis pub/sub" 로 계속 오해할 수 있다.
- **제안**: draft 의 갱신 대상 spec 목록에 `spec/0-overview.md §6.1` 의 "분산 continuation bus" 설명 갱신을 추가한다("분산 continuation bus(BullMQ 영속 큐 기반 — §7.5 rehydration)" 등으로 보강).

---

### [WARNING] `spec/0-overview.md §2.6 Data Layer` — Redis 역할 설명이 오해를 유발할 수 있음

- **target 위치**: 변경 전반 (Redis pub/sub → BullMQ continuation-queue 전환)
- **충돌 대상**: `spec/0-overview.md §2.6` (line 524) — "Redis: 캐시, **실행 상태 Pub/Sub**, 세션 관리"
- **상세**: §2.6 Data Layer 의 Redis 설명에 "실행 상태 Pub/Sub" 이 포함되어 있다. Draft 가 채택되면 continuation 용 pub/sub 은 제거되고 BullMQ 큐로 교체되므로, "Pub/Sub" 표현은 잔류하더라도 continuation 목적이 아닌 다른 pub/sub(예: `exec:recover:lock` 전역 키, `kb:*` 채널 등) 에 한정된다는 명확화가 필요하다. Continuation bus 역할 변경이 §2.6 에 반영되지 않으면 시스템 개요 오해를 유발한다.
- **제안**: draft 갱신 대상에 `spec/0-overview.md §2.6 Redis` 설명 보강("BullMQ continuation-queue 로 교체된 내용 반영") 을 추가한다. 단, 이는 low-priority 정비이므로 Phase 2 이후에 묶어 처리해도 무방.

---

### [WARNING] `plan/in-progress/self-hosting-deployment.md` 와의 cross-link — draft 자체 확인 항목이나 spec 내 미반영

- **target 위치**: 변경 1.6 §11 Graceful Shutdown 표 (`terminationGracePeriodSeconds` 언급)
- **충돌 대상**: `plan/in-progress/self-hosting-deployment.md`
- **상세**: Draft §"영향받지 않는 영역" 표에서 `self-hosting-deployment.md` 를 "보완적 — cross-link 필요" 로 명시하고 있다. 그러나 이 cross-link 가 draft 가 산출하는 spec (`spec/5-system/4-execution-engine.md §11`) 의 본문 어디에, 어떤 형태로 삽입되는지 지침이 없다. §11 표 아래의 k8s 설정 주석("Deployment manifest 의 `terminationGracePeriodSeconds`…") 은 셀프호스팅 가이드와 직접 연결되어야 하는데, spec 이 plan 문서를 참조하는 방향이 아닌 plan 문서가 spec 을 참조하는 방향으로 정리해야 한다.
- **제안**: spec §11 의 k8s 설정 주석에 셀프호스팅 Helm Chart 가이드 cross-link 를 삽입하도록 draft 에 명시한다. `plan/in-progress/self-hosting-deployment.md` 는 spec 을 참조하고 spec 이 plan 을 참조하지 않는 단방향이어야 한다.

---

### [INFO] BullMQ jobId 스키마 — `nodeExecutionId` 와 WS spec 의 식별자 일관성 확인 권장

- **target 위치**: 변경 1.4 §7.4 — "jobId = `${executionId}:${nodeExecutionId}:${monotonic-seq}`"
- **충돌 대상**: `spec/5-system/6-websocket-protocol.md §4.2` — `execution.retry_last_turn` 의 `nodeExecutionId` 사용 패턴
- **상세**: BullMQ jobId 에 `nodeExecutionId` 를 포함시키는 것은 적절하다. 다만 rehydration 경로에서 "로컬 `pendingContinuations` 키가 없는" 경우 `nodeExecutionId` 를 BullMQ 메시지 스키마에서 읽어 DB 조회하는 흐름이 WS spec §4.2 의 `execution.submit_form / click_button / submit_message` 의 payload 에 `nodeExecutionId` 가 없고 `nodeId` 만 있는 것과 정합하는지 확인이 필요하다. Client → server 명령에서 `nodeId` 만 포함하는 경우, BullMQ 메시지를 enqueue 할 때 서버가 DB 에서 현재 `nodeExecutionId` 를 lookup 하는 로직이 구현 사양에 포함되어야 한다.
- **제안**: draft §7.5 의 rehydration 경로에 "BullMQ 메시지를 enqueue 하는 시점에 서버(controller / WS gateway) 가 `executionId` + `nodeId` 로 현재 `WAITING_FOR_INPUT` 상태의 `NodeExecution` 을 DB lookup 해 `nodeExecutionId` 를 jobId 에 포함" 하는 절차를 명시한다.

---

### [INFO] `spec/data-flow/3-execution.md §1.1` 시퀀스 다이어그램 — continuation-bus 레거시 참조

- **target 위치**: 변경 전반
- **충돌 대상**: `spec/data-flow/3-execution.md §1.1` (line 52) — "continuation-bus subscribe → 폼 제출 / 버튼 클릭 / AI message 가 깨움" 주석
- **상세**: data-flow 시퀀스 다이어그램 주석은 Redis pub/sub 기반의 현행 동작을 기술하고 있다. BullMQ continuation-queue 전환 후 해당 경로가 변경되면 data-flow 다이어그램도 갱신이 필요하다.
- **제안**: Phase 2 구현 후 `spec/data-flow/3-execution.md §1.1` 시퀀스 다이어그램을 갱신하는 작업을 plan 에 명시한다.

---

### [INFO] §1.1 상태 머신 표 신규 행의 diagram ASCII 갱신 누락

- **target 위치**: 변경 1.1 §1.1 상태 머신 — 새 행 추가
- **충돌 대상**: `spec/5-system/4-execution-engine.md §1.1` 의 ASCII 상태 다이어그램 (line 18–24)
- **상세**: Draft 는 상태 전이 표에 새 행 ("waiting_for_input → waiting_for_input rehydration") 을 추가하지만, §1.1 상단의 ASCII 다이어그램은 그대로다. `waiting_for_input ─┬─ running (재개)` 경로만 표시된 현행 다이어그램은 rehydration 에 의한 동일 상태 내 self-transition 을 보여주지 않는다. 상태 enum 은 바뀌지 않으므로 self-loop 표기가 혼란을 줄 수 있지만, 다이어그램 주석 보강은 권장한다.
- **제안**: §1.1 ASCII 다이어그램 아래에 "※ rehydration 은 `waiting_for_input` 내부 transition — 상태 enum 변경 없음. §7.5 참조." 주석 한 줄을 추가하도록 draft 에 명시한다.

---

### [INFO] `waiting_for_input → cancelled` 보강의 `§1.1` 표 vs `§1.2` NodeExecution 상태 표 동기화

- **target 위치**: 변경 1.1 §1.1 상태 머신 — `waiting_for_input → cancelled` 행 보강
- **충돌 대상**: `spec/5-system/4-execution-engine.md §1.2 NodeExecution 상태` (line 116–138)
- **상세**: §1.1 Execution 상태 표의 `waiting_for_input → cancelled` 전이 조건에 "재개 실패 (§7.5)" 를 추가하지만, §1.2 NodeExecution 상태 표의 `waiting_for_input → failed` 전이 설명에는 rehydration 실패 케이스가 언급되지 않는다. Rehydration 실패 시 Execution 은 `cancelled` 가 되지만 NodeExecution 은 어떤 상태가 되는지(`failed`? `cancelled`?) 를 §1.2 에서도 명시해야 한다.
- **제안**: draft 에 §1.2 NodeExecution 상태 표의 `waiting_for_input → failed` 행에 "`RESUME_CHECKPOINT_MISSING` / `RESUME_FAILED` / `RESUME_INCOMPATIBLE_STATE` 포함" 을 추가하도록 지침을 넣는다.

---

## 요약

Draft 는 전반적으로 well-scoped 되어 있다. 상태 enum 을 확장하지 않고 기존 `waiting_for_input` 내에서 rehydration 을 처리하는 설계 결정은 기존 spec 과의 충돌 표면을 최소화했다. CRITICAL 3건은 모두 spec 본문 내 갱신 대상 절의 명시 누락 또는 파생 섹션 동기화 누락에서 비롯된다. 특히 §9.2 Redis 키 정의 표와 §4.4 Rationale 의 continuation bus 설명, §4.6 WS 이벤트 매핑 표가 draft 의 변경 범위에 포함되어야 한다. WARNING 6건 중 가장 중요한 것은 `Execution.error` 신규 코드 어휘의 §2.13 data-model 반영 명시 누락이며, 나머지는 상위 레벨 overview 문서와 API 규약 정비 수준이다. CRITICAL 3건을 draft 에 보완하면 spec 채택이 가능하다.

---

## 위험도

**MEDIUM**

CRITICAL 3건이 모두 "갱신 대상 spec 절을 draft 에서 명시하지 않은 것" 이므로, draft 자체의 설계 결정이 기존 spec 과 모순되지는 않는다. 단, 그대로 채택하면 §9.2 키 표·§4.4 Rationale·§4.6 이벤트 매핑 표가 stale 상태로 남아 이후 개발자가 Redis pub/sub 기반 구현을 참조할 위험이 있다. 수정 표면적이 작고 설계 재검토가 필요하지 않으므로 MEDIUM 으로 판정한다.
