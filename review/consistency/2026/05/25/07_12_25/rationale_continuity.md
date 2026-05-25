# Rationale 연속성 검토 결과

- **검토 모드**: 구현 착수 전 검토 (--impl-prep)
- **대상 scope**: `spec/5-system/`
- **기준 커밋**: main 브랜치 대비 HEAD 차이

---

## 발견사항

### 1. [WARNING] `recoverStuckExecutions` 의 WAITING_FOR_INPUT 처리 — 기존 Rationale 와 번복 근거 부재

- **target 위치**: `spec/5-system/4-execution-engine.md` §7.4 `Recovery (recoverStuckExecutions)` 섹션
- **과거 결정 출처**: 동일 파일 (main 브랜치) §7.4 — "Stale 임계값: `started_at < now() - 30분` 인 row 만 FAIL UPDATE. 30분 미만의 신규 대기는 보존된다." / "세 가드를 함께 적용해, 동시 부팅·진행 중 부팅 어떤 시나리오에서도 정상 대기를 잃지 않는다."
- **상세**: 기존 spec 의 `recoverStuckExecutions` 는 `started_at < now() - 30분` 임계값을 적용해 모든 stale row (RUNNING + WAITING_FOR_INPUT 포함) 를 FAIL UPDATE 했다. 이는 "30분 미만은 보존" 이라는 완화 가드였다. 신규 target 은 이를 "RUNNING 만 대상, WAITING_FOR_INPUT 은 무기한 보존" 으로 번복한다. 번복 자체는 `Durable Continuation (2026-05-24)` Rationale 에서 운영 회귀 근거로 설명되어 있으나, 기존 30분 임계값과의 관계 — 즉 왜 임계값 자체가 아닌 status 분리로 해결했는지, 30분 임계값을 RUNNING 에만 적용할 때의 한계 처리(예: 30분 이상 stuck RUNNING 이 아닌 heartbeat 미응답 기준으로 바뀐 경위) — 가 신규 Rationale 에 누락되어 있다. "Stale 임계값 (`STUCK_RECOVERY_STALE_MS`) 은 RUNNING 의 worker heartbeat 미응답 검출에만 사용한다" 고만 기술하고, 기존 30분 시간 임계값을 heartbeat 기반으로 교체한 결정 근거가 없다.
- **제안**: `Durable Continuation (2026-05-24)` Rationale 에 "기존 30분 started_at 임계값을 heartbeat 미응답 기반으로 교체한 이유" 한 단락을 추가하거나, §7.4 Recovery 절 인라인에 "왜 시간 임계값 → heartbeat 기반으로 전환했는가" 를 병기한다.

---

### 2. [INFO] `9.1 Redis 키 테이블` — `execution:continuation` 전역 키 주석의 부재

- **target 위치**: `spec/5-system/4-execution-engine.md` §9.1 Redis 키 테이블 및 테이블 하단 주석
- **과거 결정 출처**: 동일 파일 (main 브랜치) §9.1 — "두 전역 키 (`execution:continuation`, `exec:recover:lock`) 는 §9.1 의 `{service}:{workspaceId}:{resource}` 패턴을 따르지 않는다. 각각 인스턴스 간 메시징 / 부팅 단일 진입 가드라는 **워크스페이스에 종속되지 않는** 책임을 가지므로 전역 키로 둔다."
- **상세**: 신규 target 에서 `execution:continuation` 채널이 BullMQ 큐로 교체되어 Redis 키 테이블에서 해당 행이 제거됐다. 테이블 하단 주석도 `exec:recover:lock` 만을 전역 키 예외로 언급하도록 적절히 갱신되었다. 이 부분의 처리는 올바르다. 다만 §9.3 `BullMQ 큐 목록` 신설과의 통합 관점에서, `execution-continuation` 큐의 "§9.1 Redis 키 패턴 외" 성격 (BullMQ 내부 `bull:*` 키) 을 §9.3 에서 명시적으로 언급한 것은 적절하다.
- **제안**: 보완 불필요. 이미 §9.1 주석 갱신과 §9.3 BullMQ 큐 섹션 설명으로 잘 처리되어 있다. 단, §9.3 의 `task-queue` 행 비고 "구현 검증 후 본 행 확정/삭제" 는 spec 본문에 미확정 행이 남아있는 형태라, Phase 2 구현 완료 후 spec 갱신을 잊지 않도록 TODO 추적이 필요하다.

---

### 3. [INFO] `Graceful Shutdown §11` — 기존 WAITING_FOR_INPUT 처리 정책 번복의 명시 누락

- **target 위치**: `spec/5-system/4-execution-engine.md` §11 Graceful Shutdown, 특히 항목 3
- **과거 결정 출처**: 동일 파일 (main 브랜치) §7.4 Continuation Bus 절 — "모든 진입점은 항상 `bus.publish` 한다" 원칙 및 Recovery 절 — "보수적 가드" 설명
- **상세**: §11 항목 3 "WAITING_FOR_INPUT 상태의 Execution 은 건드리지 않음 — DB 상태 그대로 두고 in-memory resolver 만 자연 소실" 은 기존에 명시적으로 정의된 Graceful Shutdown 절차가 없던 spec 에 신규 추가되는 내용으로, 기각된 대안 재도입에는 해당하지 않는다. `Durable Continuation (2026-05-24)` Rationale 에서 "WAITING_FOR_INPUT 일괄 FAIL" 이 운영 회귀였음을 명시하고 있어 연속성 파악이 가능하다. 그러나 §11 본문에서는 "왜 건드리지 않는가" 의 근거가 `§7.5 rehydration 으로 재개` 한 문장뿐이다 — `Durable Continuation Rationale` 를 cross-reference 하는 링크가 있으면 더 명확해진다.
- **제안**: §11 항목 3 에 `(§Rationale "Durable Continuation (2026-05-24)" 참조)` 링크를 추가해 번복 근거를 바로 추적 가능하게 한다.

---

### 4. [INFO] `§7.4 Continuation Bus` — "항상 publish" 원칙의 BullMQ 계승 설명

- **target 위치**: `spec/5-system/4-execution-engine.md` §7.4 Continuation Bus "라우팅 원칙" 항목
- **과거 결정 출처**: 동일 파일 (main 브랜치) §7.4 — "모든 진입점은 항상 `bus.publish` 한다. 자기 인스턴스에 로컬 Map 키가 있어도 마찬가지 — '내 Map 에 있으면 직접' 분기는 race window 가 생긴다."
- **상세**: 기존 "항상 publish" 원칙은 BullMQ 로 전환된 target 에서도 "항상 BullMQ enqueue" 로 적절히 계승되었고, `Durable Continuation Rationale` 의 "Sticky fast-path 제거" 항목에서 근거가 명확히 설명되어 있다. 기각된 sticky fast-path (pub/sub 시대의 직접 resolve 분기 재도입 가능성) 가 명시적으로 검토되고 기각된 것도 기록되어 있다. 이 부분은 Rationale 연속성 관점에서 모범적으로 처리되어 있다.
- **제안**: 추가 조치 불필요.

---

### 5. [INFO] `spec/4-nodes/6-presentation/0-common.md §10.9` — BullMQ payload 스키마 변경의 SoT

- **target 위치**: `spec/4-nodes/6-presentation/0-common.md §10.9` (diff 내 변경 행 참조)
- **과거 결정 출처**: 동일 파일 (main 브랜치) §10.9 — "server-internal Redis pub/sub `execution:continuation` 채널의 `'continue'` 메시지 안 payload"
- **상세**: payload 스키마 자체 (`{ type: 'form_submitted', formData }` sentinel wrap) 는 변경 없고 전송 매체만 BullMQ 로 교체되었다. 기존 Rationale 에서 "sentinel wrap 형식 — dispatcher 가 sentinel 로 분기" 결정이 명시됐으나, 신규 payload 스키마에는 `nodeExecutionId` 필드가 추가되었다 (§7.4 메시지 스키마 표 참조: "nodeExecutionId: string" 추가). §10.9 SoT 문서가 이 새 필드를 반영하는지, 또는 §10.9 가 payload (sentinel wrap 내부) 만 다루고 outer 스키마는 §7.4 가 SoT 인지를 명확히 할 필요가 있다.
- **제안**: §10.9 의 SoT 범위 — "outer 메시지 스키마 (`executionId`, `nodeExecutionId`, `type`)는 §7.4, inner payload sentinel wrap 은 §10.9" — 을 한 줄로 명시해 독자가 두 SoT 경계를 혼동하지 않게 한다.

---

### 6. [WARNING] `NodeExecution.status` 에서 `waiting_for_input → failed` vs `waiting_for_input → cancelled` 불일치

- **target 위치**: `spec/5-system/4-execution-engine.md` §2 NodeExecution 상태 표 — `waiting_for_input` 행
- **과거 결정 출처**: 동일 파일 (main 브랜치) §1.1 전이 테이블 — `waiting_for_input → cancelled`(사용자 취소 또는 타임아웃), §2 NodeExecution 상태 표는 NodeExecution 의 `failed` 상태 설명에 "rehydration 실패 시 `failed` 로 전이"
- **상세**: target 의 §1.1 Execution 전이 테이블은 rehydration 실패 시 `waiting_for_input → cancelled` 로 표기한다. 반면 §2 NodeExecution 상태 표에는 동반 NodeExecution 에 대해 `failed` 로 전이한다고 기술되어 있으며, §7.5 Rehydration 실패 케이스 표도 NodeExecution 이 `failed`, 동반 Execution 이 `cancelled` 로 마감함을 명시한다. 따라서 두 레벨의 상태 전이가 일치한다. 다만 §1.1 의 `waiting_for_input → cancelled` 행 비고에 "rehydration 실패" 케이스가 추가되었는데, 기존 이 행의 근거("2026-05-19 추가" 형식으로 기록된 `waiting_for_input → failed` 전이의 Rationale §Rationale `waiting_for_input → failed 전이 추가 (2026-05-19)`)와 일관되게 rehydration 실패의 단말 케이스도 Rationale 항목을 갖추거나 `Durable Continuation` Rationale 내에 통합해야 한다. 현재 §Rationale 에는 rehydration 실패 시 `cancelled` 선택의 근거가 없다.
- **제안**: `Durable Continuation (2026-05-24)` Rationale 또는 별도 소항목에 "rehydration 실패 단말 상태를 `failed` (NodeExecution) + `cancelled` (Execution) 로 이분한 이유" 를 추가한다 — 예: "사용자가 취소한 것이 아니라 인프라 실패로 종결되므로 Execution 은 `cancelled` (사용자 구분 가능성 보존), NodeExecution 은 `failed` (오류 발생 노드 표시)".

---

## 요약

target 문서 (`spec/5-system/4-execution-engine.md` 및 연관 spec) 는 Redis pub/sub Continuation Bus 를 BullMQ 영속 큐로 교체하고, `recoverStuckExecutions` 에서 WAITING_FOR_INPUT 행을 보존하는 설계를 도입했다. 핵심 전환 근거는 `Durable Continuation (2026-05-24)` Rationale 에 잘 정리되어 있으며 기각 대안(Temporal 이전, INTERRUPTED enum 신설, pub/sub 재시도) 도 명시되어 기각된 대안의 재도입은 없다. 다만 두 가지 WARNING 이 있다: (1) 기존 `started_at < now() - 30분` 임계값 기반 Recovery 를 heartbeat 기반으로 교체한 결정 근거가 Rationale 에 누락되었고, (2) rehydration 실패 단말 케이스에서 Execution 이 `failed` 가 아닌 `cancelled` 로 마감되는 이유가 Rationale 에 없다. INFO 수준으로는 `§10.9` outer/inner 스키마 SoT 경계 명시, `task-queue` 행 확정 TODO, §11 항목 3 cross-reference 추가가 권장된다. 전반적으로 합의 원칙(항상 publish / DB 비확장 / 기존 SoT 활용) 은 잘 계승되고 있으며 CRITICAL 수준의 기각 대안 재도입은 없다.

---

## 위험도

MEDIUM
