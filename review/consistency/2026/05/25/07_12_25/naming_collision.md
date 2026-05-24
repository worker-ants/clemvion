# 신규 식별자 충돌 검토 결과

> 검토 모드: 구현 착수 전 (--impl-prep, scope=spec/5-system/)
> 대상: workflow-resumable-execution Phase 2 신규 식별자 (Durable Continuation & Graceful Shutdown)
> 검토 시각: 2026-05-25

---

## 발견사항

### 1. [WARNING] `INVALID_EXECUTION_STATE` — spec 등재 미완료 상태로 코드·WS spec 에서 사용 중

- **target 신규 식별자**: `INVALID_EXECUTION_STATE`
- **기존 사용처**:
  - `spec/5-system/6-websocket-protocol.md` line 242 — WS 에러 코드 표에 이미 등재됨
  - `spec/5-system/4-execution-engine.md` line 750 — 큐 메시지 설명 안에 참조됨
  - **그러나** plan `plan/in-progress/workflow-resumable-execution.md` §2.9 에 "INVALID_EXECUTION_STATE 에러 코드 spec 등재 미완료 — §7.5 또는 §6-ws-protocol §4.2 에 lookup 0건/다중 row 시 반환 명시" 라고 명시적으로 열린 task로 남겨져 있음
  - 코드에서 미구현 (codebase 검색 결과 0건)
- **상세**: WS spec §4.2 의 에러 코드 표와 execution-engine §7.4 에는 이미 이름이 등장하지만, 반환 조건(0건/다중 row 각각의 정확한 의미)이 불완전하게 서술되어 있으며 codebase 에는 아직 해당 코드를 발생시키는 구현이 없다. 이름 자체의 충돌은 없으나 spec 과 구현 gap 상태임.
- **제안**: Phase 2 §2.9 task 완료 시 spec §7.5 에 "controller/WS gateway 의 `nodeId` DB lookup 결과별 에러 코드" 표를 추가하고, codebase 에 실제 throw 코드를 연동.

---

### 2. [WARNING] `INVALID_EXECUTION_STATE` vs `INVALID_STATE` — 유사 이름 혼동 가능성

- **target 신규 식별자**: `INVALID_EXECUTION_STATE`
- **기존 사용처**: `spec/5-system/3-error-handling.md` line 42 — `INVALID_STATE` (HTTP 422, "상태 전이 불가") 로 정의된 별도 공용 에러 코드
- **상세**: `INVALID_STATE` (REST API 공용, 422) 와 `INVALID_EXECUTION_STATE` (WS ack 전용, Execution 이 WAITING_FOR_INPUT 이 아닐 때) 는 의미가 다르다. 접두어 차이로 구분되지만 이름이 비슷해 WS handler 구현자가 공용 `INVALID_STATE` 를 잘못 재사용할 위험이 있다.
- **제안**: `spec/5-system/6-websocket-protocol.md §4.2` 에러 코드 표의 `INVALID_EXECUTION_STATE` 항에 "WS 전용 코드, REST 의 `INVALID_STATE` (spec/5-system/3-error-handling.md §2) 와 별개" 라는 주석 한 줄 추가 권장.

---

### 3. [INFO] `RESUME_BULLMQ_ATTEMPTS` — spec 에는 ENV 변수로 명시되어 있으나 현재 코드 상수로만 존재

- **target 신규 식별자**: `RESUME_BULLMQ_ATTEMPTS` (ENV 변수 / 코드 상수)
- **기존 사용처**: 기존 환경변수 목록 (`codebase/backend/.env.example`) 에 없음. 충돌 없음.
- **상세**: `spec/5-system/4-execution-engine.md §11` 환경변수 표에 `RESUME_BULLMQ_ATTEMPTS` (기본 3) 로 등재되어 있으나, 실제 `continuation-execution.queue.ts` 에서는 ENV 가 아닌 파일 상수로 선언됨. spec 은 ENV 화 의도를 명시하면서도 "현재 코드 상수" 라고 주석을 달아 인지하고 있음. 충돌은 없으나 spec 과 구현 사이의 미래 drift 씨앗.
- **제안**: spec §11 의 환경변수 표에 `RESUME_BULLMQ_ATTEMPTS` 행에 "(현재 코드 상수, ENV 화는 후속 PR)" 같은 인라인 노트를 추가해 혼선 방지.

---

### 4. [INFO] `CONTINUATION_EXECUTION_QUEUE` vs `BACKGROUND_EXECUTION_QUEUE` — 명명 패턴 일관성

- **target 신규 식별자**: `CONTINUATION_EXECUTION_QUEUE` (코드 상수, 값 `'execution-continuation'`)
- **기존 사용처**: `codebase/backend/src/modules/execution-engine/queues/background-execution.queue.ts` — `BACKGROUND_EXECUTION_QUEUE` (값 `'background-execution'`)
- **상세**: 두 상수 모두 BullMQ 큐 이름을 담는 동일 패턴의 상수다. 기존 패턴 (`BACKGROUND_EXECUTION_QUEUE`) 과 신규 (`CONTINUATION_EXECUTION_QUEUE`) 가 `{PURPOSE}_EXECUTION_QUEUE` 형태로 일관됨. 충돌 없음.
- **제안**: 충돌 없음. 일관성 확인.

---

### 5. [INFO] `queued: boolean` WS ack 필드 — 기존 `resumed` 필드와 동일 ack payload 에 추가

- **target 신규 식별자**: `queued: boolean` (WS ack payload 신규 필드)
- **기존 사용처**: `spec/5-system/6-websocket-protocol.md §4.2` — 기존 `resumed: boolean` 필드가 `execution.click_button.ack` 등 의 success payload 에 이미 존재
- **상세**: `queued` 는 기존 `resumed` 와 동일 ack shape 에 추가되는 선택 필드다. 두 필드는 독립적 의미를 가진다 (`resumed`=재개 여부, `queued`=BullMQ enqueue 여부). 이름 충돌 없음. spec §4.2 에 두 필드 모두 명확히 정의되어 있음.
- **제안**: 충돌 없음. 다만 `queued: true` 이면서 `resumed: true` 인 경우(fast path가 아닌 BullMQ 경로로 즉시 resolve)의 의미론이 spec 에 명확히 서술되어 있는지 구현 시 확인 권장.

---

### 6. [INFO] `exec:recover:lock` Redis 키 — §9.1 네이밍 컨벤션 의도적 예외

- **target 신규 식별자**: `exec:recover:lock` (Redis 전역 키)
- **기존 사용처**: `spec/5-system/4-execution-engine.md §9.1` 의 키 패턴 (`{service}:{workspaceId}:{resource}:{id}:{sub}`)
- **상세**: `exec:recover:lock` 은 `workspaceId` 세그먼트가 없는 전역 키로, §9.1 표준 패턴을 의도적으로 따르지 않는다. spec §9.2 에 이 예외가 명시적으로 문서화되어 있어 이름 충돌 위험은 없음. 단, 향후 추가 전역 키 도입 시 동일 prefix `exec:recover:*` 패턴과의 충돌 가능성을 유의해야 함.
- **제안**: 충돌 없음. spec 문서화 완비.

---

### 7. [INFO] `SERVER_SHUTTING_DOWN` 에러 코드 — API 에러 코드 vocabulary 에 미등재

- **target 신규 식별자**: `SERVER_SHUTTING_DOWN` (HTTP 503 응답 에러 코드)
- **기존 사용처**: `spec/5-system/3-error-handling.md` 에러 코드 표 — 해당 코드 없음. `spec/5-system/2-api-convention.md` — 503 상태 코드에 대한 일반 기술만 있음
- **상세**: `spec/5-system/4-execution-engine.md §11` 에 `SERVER_SHUTTING_DOWN` 이 503 응답 body 의 `code` 로 정의되어 있으나, `spec/5-system/3-error-handling.md` 의 공용 에러 코드 표에는 등재되어 있지 않다. 해당 코드가 execution-engine spec 에만 존재하므로 단일 진실 원칙 관점에서 cross-spec 참조가 없다. 충돌은 없으나 발견 가능성 낮음.
- **제안**: `spec/5-system/3-error-handling.md` 의 에러 코드 표에 `SERVER_SHUTTING_DOWN | 서버 셧다운 중 새 실행 거부 | 503` 행을 추가하거나, §11 에 "에러 코드 vocabulary 는 본 섹션에만 정의" 라는 scope 명시 권장.

---

## 요약

target (`spec/5-system/4-execution-engine.md §7.4 / §7.5 / §11` 및 연관 spec 파일들) 이 도입하는 신규 식별자들 — `RESUME_FAILED` / `RESUME_CHECKPOINT_MISSING` / `RESUME_INCOMPATIBLE_STATE` / `RESUME_BULLMQ_ATTEMPTS` / `SIGTERM_GRACE_MS` / `CONTINUATION_EXECUTION_QUEUE` / `ContinuationJob` / `buildContinuationJobId` / `execution-continuation` (BullMQ 큐명) / `SERVER_SHUTTING_DOWN` / `SERVER_INTERRUPTED` / `WORKER_HEARTBEAT_TIMEOUT` / `INVALID_EXECUTION_STATE` — 은 기존 영역에서 다른 의미로 이미 사용 중인 동명 식별자가 없다. 가장 주의해야 할 사항은 (1) `INVALID_EXECUTION_STATE` 가 spec 에 등재는 됐으나 codebase 구현이 아직 없고 반환 조건이 불완전하게 서술된 점, (2) 유사 이름 `INVALID_STATE` (REST 공용) 와의 혼동 가능성, (3) `SERVER_SHUTTING_DOWN` 이 공용 에러 코드 vocabulary 에 등재되지 않은 점이다. 모두 즉각 차단 수준의 충돌은 아니며 WARNING 2건 / INFO 5건으로 구성된다.

---

## 위험도

LOW
