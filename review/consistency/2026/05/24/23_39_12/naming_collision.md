# 신규 식별자 충돌 검토 결과

> 검토 대상: `plan/in-progress/spec-draft-workflow-resumable-execution.md` (rev 2 — 2026-05-24)
> 검토 일시: 2026-05-24
> 검토 모드: spec draft (--spec)

---

## 발견사항

### 1. [WARNING] `ContinuationType` 메시지 스키마에 `nodeExecutionId` 필드 신설 — 기존 스키마와 비호환

- **target 신규 식별자**: `{ type: ContinuationType, executionId: string, nodeExecutionId: string, payload?: unknown }` — 변경 1.4 §7.4 신규 본문의 "메시지 스키마" 행
- **기존 사용처**: `spec/5-system/4-execution-engine.md` line 742 — `{ type: ContinuationType, executionId: string, payload?: unknown }` (기존 3-필드 스키마)
- **상세**: target 은 기존 pub/sub 시대의 continuation 메시지 스키마에 `nodeExecutionId` 필드를 추가한다. 동일 `ContinuationType` 이름을 사용하면서 스키마 shape 이 변경되는데, 기존 코드베이스(`execution-engine.service.ts:417-424` 등)가 아직 구 스키마를 참조하고 있다. spec 본문에 "기존 스키마에서 확장" 임이 명시적으로 서술되지 않아, spec 적용 시 기존 `ContinuationType` 타입 정의 변경 범위가 불명확하다.
- **제안**: §7.4 신규 본문에 "기존 `ContinuationType` 인터페이스에 `nodeExecutionId: string` 필드 추가" 문장을 명시적으로 삽입한다. 구현 단계에서 `ContinuationMessage` 타입 정의 변경이 필요함을 spec 에 표기한다.

---

### 2. [WARNING] `task-queue` BullMQ 큐 이름 — 기존 spec·코드베이스에 미등록

- **target 신규 식별자**: `task-queue` — 변경 1.9 §11 Graceful Shutdown 표의 큐 목록 "BullMQ continuation-queue / background-execution / task-queue 의 active job"
- **기존 사용처**: `spec/data-flow/0-overview.md` line 93 에 등록된 BullMQ 큐 목록 — `background-execution`, `document-embedding`, `graph-extraction`, `schedule-execution`, `alerts-evaluator`, `integration-expiry`. `task-queue` 는 spec 에 등록되지 않았고 codebase 소스 디렉토리에서도 확인되지 않는다. 변경 1.10 의 §9.3 BullMQ 큐 목록 표에도 `task-queue` 는 "기존값 유지" 로 기재되어 있으나 기존에 정의된 바가 없다.
- **상세**: `task-queue` 가 실제로 존재하는 큐인지(다른 이름으로 존재하는지), 아니면 spec draft 오기인지 불분명하다. §11 의 graceful shutdown 문맥에서 이 큐가 언급되므로, 미존재 큐를 "active job 처리 중" 으로 서술하면 구현자가 혼동할 수 있다.
- **제안**: `task-queue` 가 실제 큐라면 `spec/data-flow/0-overview.md §2` 큐 목록과 §9.3 표에 동시 등록한다. 만약 `background-execution` 의 다른 표현이라면 §11 의 해당 문장에서 `task-queue` 를 삭제하거나 `background-execution` 으로 대체한다.

---

### 3. [WARNING] `execution:continuation` Redis 채널 → `execution-continuation` BullMQ 큐 — 이름 유사성으로 인한 혼동 위험

- **target 신규 식별자**: BullMQ 큐 이름 `execution-continuation` (대시 구분)
- **기존 사용처**: `spec/5-system/4-execution-engine.md` §9.2 (line 825), `spec/4-nodes/6-presentation/0-common.md` §10.9 — Redis pub/sub 채널 `execution:continuation` (콜론 구분)
- **상세**: 두 식별자가 콜론 vs 대시 한 글자 차이이므로, 구현자가 Redis 채널 이름으로 오인해 BullMQ 큐를 생성하거나, 반대로 BullMQ 큐 이름을 Redis 채널로 SET 하는 오기재 위험이 있다. spec 의 삭제 대상(`execution:continuation`)과 신규 대상(`execution-continuation`)이 문서 내 혼재하는 과도기에 특히 위험하다.
- **제안**: 변경 1.4 §7.4 신규 본문에 "옛 채널 이름 `execution:continuation` (콜론) 과 혼동 금지 — BullMQ 큐 이름은 대시 구분 `execution-continuation`" 임을 주석으로 명기한다. §9.2 삭제 행과 §9.3 신규 행이 동일 spec 적용 PR 에서 atomic 하게 처리되어야 함을 target 에 명시한다.

---

### 4. [INFO] `STUCK_RECOVERY_STALE_MS` — 코드 내부 상수에서 spec 표로 승격, 이름 충돌은 없으나 관리 이중화 주의

- **target 신규 식별자**: `STUCK_RECOVERY_STALE_MS` — 변경 1.5 §7.4 Recovery 소절의 "(임계 튜닝 후속)" 설명에서 환경변수 후보로 언급
- **기존 사용처**: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:627` — `private static readonly STUCK_RECOVERY_STALE_MS = 30 * 60 * 1000` (코드 상수)
- **상세**: 이름 충돌이 아니라, 기존에 코드 상수로 존재하는 식별자를 target 이 spec 표에서 `ENV 화 여부는 구현 시 두 큐 일관성 유지` 라는 조건부 언급으로 끌어올리고 있다. 두 큐(`background-execution` / `execution-continuation`)의 `attempts` 상수 관리 방식(코드 vs ENV) 이 이 시점에 결정되지 않은 채 draft 에 남아 있다.
- **제안**: spec 적용 단계에서 `STUCK_RECOVERY_STALE_MS` 를 ENV 화할 경우 기존 코드 상수와 충돌하지 않도록 `spec/5-system/4-execution-engine.md §11` 환경변수 표의 `RESUME_BULLMQ_ATTEMPTS` 주석 패턴("코드 상수면 spec 표에서만 노출")을 `STUCK_RECOVERY_STALE_MS` 에도 동일하게 적용한다.

---

### 5. [INFO] `queued: boolean` ack 필드 — 기존 ack payload 필드명과의 혼동 없음, 단 `resumed: true` + `queued: true` 조합의 의미 명확화 필요

- **target 신규 식별자**: `queued: boolean` — 변경 2.1 `execution.click_button.ack` payload 신규 필드
- **기존 사용처**: `spec/5-system/6-websocket-protocol.md` line 229 — `execution.click_button.ack` 의 기존 payload 에 `executionId`, `nodeId`, `buttonId`, `resumed` 만 존재. `queued` 필드는 없음
- **상세**: 이름 충돌은 없다. 그러나 `resumed: true, queued: true` 조합의 의미가 "BullMQ 에 enqueue 됐으나 아직 pick up 안 됨" 인데, 클라이언트 입장에서 `resumed: true` 는 "재개 성공" 을 연상시켜 `queued: true` 와 혼독될 수 있다. target 본문에 "본 필드는 디버깅·관측 용도이며 클라이언트 routing 결정에 사용하지 않는다" 로 이미 의도를 서술하고 있으나, `resumed` 의 의미 재정의("enqueue 성공 = resumed true") 가 기존 ack payload 에서 `resumed: true` 가 "즉시 resolve 성공" 을 의미하던 것과 다르다.
- **제안**: spec 적용 시 `execution.click_button.ack` 의 `resumed` 의미를 "enqueue 또는 즉시 resolve 중 하나가 성공" 으로 재정의함을 §4.2 본문에 명기한다. `queued` 가 `false` 이고 `resumed` 가 `true` 인 경우가 기존 in-instance fast path 에 해당함을 표 또는 주석으로 명시한다.

---

### 6. [INFO] `RESUME_CHECKPOINT_MISSING`, `RESUME_FAILED`, `RESUME_INCOMPATIBLE_STATE` 에러 코드 — 기존 에러 코드 목록에 미등록

- **target 신규 식별자**: 에러 코드 3종 — 변경 2.2 §4.2 에러 코드 표, 변경 3 `spec/1-data-model.md §2.13`
- **기존 사용처**: `spec/5-system/3-error-handling.md` — 전역 에러 코드 목록. 위 3종은 등록되지 않음. `spec/5-system/6-websocket-protocol.md §7.1` — WS 전용 에러 코드 표에도 없음
- **상세**: 이름 충돌은 없다. 그러나 `RESUME_FAILED` 는 환경변수 `RESUME_BULLMQ_ATTEMPTS` 와 연동하는 인프라 레벨 에러 코드로, spec 적용 시 `spec/5-system/3-error-handling.md` 의 전역 에러 코드 표 또는 §7.1 WS 에러 코드 표에 등록되지 않으면 다른 구현자가 재발명할 위험이 있다.
- **제안**: spec 적용 phase 에서 위 3종을 `spec/5-system/3-error-handling.md` 의 "엔진 인프라 에러" 카테고리 또는 신규 카테고리로 등재하거나, target 의 §2.2 표에 "WS §7.1 에러 코드 표에도 동시 추가" 를 명시한다.

---

### 7. [INFO] `SERVER_INTERRUPTED` 에러 코드 — 기존 에러 코드 목록에 미등록

- **target 신규 식별자**: `error.code='SERVER_INTERRUPTED'` — 변경 1.9 §11 Graceful Shutdown 항목 4
- **기존 사용처**: `spec/5-system/3-error-handling.md` 전역 에러 코드 목록, `spec/5-system/6-websocket-protocol.md §7.1` — 없음
- **상세**: 기존에 `EXECUTION_TIMEOUT` 등 엔진 레벨 에러 코드가 `spec/5-system/3-error-handling.md`에 등록되어 있는데 `SERVER_INTERRUPTED` 는 누락이다. 구현자가 다른 이름(예: `NODE_INTERRUPTED`, `GRACEFUL_SHUTDOWN_TIMEOUT`)으로 중복 도입할 위험이 있다.
- **제안**: `RESUME_*` 3종과 함께 `spec/5-system/3-error-handling.md` 에 `SERVER_INTERRUPTED` 를 등재한다.

---

### 8. [INFO] `SERVER_SHUTTING_DOWN` 에러 코드 — API 규약과의 정합 확인 필요

- **target 신규 식별자**: `error.code='SERVER_SHUTTING_DOWN'` — 변경 1.9 §11 Graceful Shutdown 항목 1, 503 응답의 body
- **기존 사용처**: `spec/5-system/2-api-convention.md` §4 에러 응답 shape — 503 응답 shape 예시 없음. 인증 관련 503 (`WEBAUTHN_DISABLED`) 이 `spec/5-system/1-auth.md` 에서만 사용됨
- **상세**: 이름 충돌은 없다. `SERVER_SHUTTING_DOWN` 이 503 응답의 `error.code` 로 쓰이는 것이 `spec/5-system/2-api-convention.md` 의 에러 응답 규약(`{ error: { code, message } }`)과 일치하는지 확인이 필요하다. target 본문에 "표준 API 에러 shape ([Spec API 규약](./2-api-convention.md))" 을 참조한다고 명기하고 있어 의도는 맞으나, 503 응답 shape 이 API 규약에 명시적으로 정의되어 있지 않다.
- **제안**: spec 적용 시 `spec/5-system/2-api-convention.md` 에 "503 응답은 표준 에러 shape 사용 + `Retry-After` 헤더 동봉" 사례를 한 줄 추가한다.

---

## 요약

target 문서(`spec-draft-workflow-resumable-execution.md` rev 2)가 도입하는 신규 식별자 중 동일 이름이 다른 의미로 기존에 쓰이는 CRITICAL 충돌은 발견되지 않았다. 주요 위험은 두 가지다. 첫째, BullMQ 큐 이름 `execution-continuation` 이 삭제 예정인 Redis pub/sub 채널 `execution:continuation` 과 한 글자 차이로 구현자 오기재 위험이 있다(WARNING). 둘째, §11 Graceful Shutdown 에서 `task-queue` 라는 이름이 기존 spec·코드베이스에 존재하지 않는 채로 언급되어 의미가 불명확하다(WARNING). 나머지 사항(`queued` 필드, 에러 코드 3종+1종, `STUCK_RECOVERY_STALE_MS` 코드 상수)은 이름 충돌이 아닌 spec 등재 누락 또는 의미 명확화 권장 사항이다.

---

## 위험도

MEDIUM
