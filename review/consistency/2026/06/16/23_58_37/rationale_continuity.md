# Rationale 연속성 검토 결과

**검토 모드**: 구현 착수 전 검토 (--impl-prep)
**Target 문서**: `spec/5-system/4-execution-engine.md`
**검토 일시**: 2026-06-16

---

## 발견사항

### 발견사항 없음 — 기각된 대안 재도입 없음 (NONE)

`spec/5-system/4-execution-engine.md` 의 `## Rationale` 절은 기각된 대안을 명시적으로 기록하고, target 본문이 그 대안을 재채택하는 경우가 발견되지 않았다. 구체적으로 확인한 항목:

1. **per-node task queue 기각 (§Rationale "per-node task queue → execution-level intake 큐")**
   - 기각 내용: 노드마다 개별 워커/큐로 분산하는 per-node task queue 모델.
   - target 본문 §4.2, §9.3, §11 모두 "한 세그먼트 내부 노드 dispatch 는 in-process while-loop" 를 일관되게 명시하며, 본문 어디에도 per-node 분산 흔적이 없다.

2. **Redis pub/sub `execution:continuation` 채널 폐기 (§Rationale "Durable Continuation")**
   - 기각 내용: at-most-once 의미론의 Redis pub/sub 채널.
   - target §7.4, §9.2, §9.3 에서 BullMQ `execution-continuation` 큐 단일 경로가 일관되게 기술되며, 옛 채널은 "폐기" 로 명시돼 있다.

3. **`waiting_for_retry` 신규 상태 기각 (§Rationale "retryable error 종결 시 `_retryState` 보존")**
   - 기각 내용: R2 — `waiting_for_retry` 상태 신설.
   - target §1.1 상태 머신에 `waiting_for_retry` 가 없고, retry 는 `_retryState` + `failed → running` 단일 전이로 표현됐다.

4. **별도 heartbeat 채널 기각 (§Rationale Phase 2 cont "BullMQ stalled-job 으로 일원화")**
   - 기각 내용: 워커 5초 emit + 중앙 검사 heartbeat 인프라.
   - target §7.1 에서 "별도 heartbeat 채널을 신설하지 않는다" 를 명문화하고 stalled-job 으로 일원화했다.

5. **sticky fast-path (publisher 측 BullMQ 우회) 기각 (§Rationale "Durable Continuation")**
   - 기각 내용: 같은 인스턴스에 key 있으면 BullMQ 우회하고 직접 resolve.
   - target §7.4 라우팅 원칙에서 "항상 BullMQ enqueue" 를 명시하며, in-memory `pendingContinuations` Map 도 "full B3 으로 제거됐다" 고 서술돼 있다.

6. **`_continuationCheckpoint` 별도 컬럼 신설 기각 (§6.2 park commit, §Rationale)**
   - 기각 내용: continuation 운반용 전용 DB 컬럼.
   - target §6.2 에서 기존 `NodeExecution.outputData` JSONB 키 재사용을 명시하고 별도 컬럼 신설 기각 근거를 유지하고 있다.

7. **`WAITING_FOR_INPUT → INTERRUPTED` 신규 enum 기각 (§Rationale "Durable Continuation")**
   - 기각 내용: 재시작 시 interim 상태 신설.
   - target §1.1 상태 머신에 `interrupted` 가 없으며, 재시작 후 재개는 `waiting_for_input` 무기한 park + §7.5 rehydration 단일 경로로 일관됐다.

8. **`_resumeState` 암호화 기각 (§Rationale "Multi-turn 재시작 재개 — `_resumeCheckpoint` 보존")**
   - 기각 내용: `ENCRYPTION_KEY` 기반 secret-store 암호화.
   - target §1.3 에서 credential-strip 부분집합 평문 영속 정책이 명시되고 암호화 없이 `maskSensitiveFields` 경계 strip 으로 대체됐다.

9. **`executeInline` 재호출 방식 기각 (§Rationale "park 즉시 해제 + slow-path 일원화" W2 SPEC-DRIFT)**
   - 기각 내용: 중첩 frame 재진입 시 `executeInline` 을 재호출하는 방식.
   - target §7.5 에서 `driveCallStackResume` 이 `frames` 를 직접 구동(bubble-up)함을 명시, `executeInline` 재호출은 re-entrancy 위험이 있어 기각됐다고 서술됐다.

10. **`EXEC_*` 신규 prefix 기각 (§Rationale "Continuation ack client-safe typed error")**
    - 기각 내용: `EXECUTION_*` 과 별도로 `EXEC_*` 네임스페이스 신설.
    - target §7.5.2 에서 중앙 `ErrorCode` enum 의 기존 `EXECUTION_*` 확장 정책을 유지하며 이중 표기 기각을 명문화했다.

11. **backend i18n 레이어 기각 (§Rationale "Continuation ack")**
    - 기각 내용: backend 가 i18n 다국어 메시지를 직접 emit.
    - target §7.5.2 에서 "backend 는 code + 고정 영문 generic 메시지만 emit, frontend 가 `code → i18n key` 맵으로 표시" 를 일관 유지한다.

12. **Redis pub/sub 유지 + 재시도 방식 기각 (§Rationale "Durable Continuation")**
    - 기각 내용: Redis pub/sub 유지하면서 "Map 키 없으면 대기 후 재시도" 로 우회.
    - target 에 Redis pub/sub 재도입 흔적 없음.

13. **Temporal / Inngest 전용 워크플로우 엔진 이전 기각 (§Rationale "Durable Continuation")**
    - 기각 내용: 현재 엔진을 Temporal/Inngest 로 전면 교체.
    - target 이 기존 BullMQ 패턴 위에 incremental 개선을 기술하며 전면 이전 흔적이 없다.

14. **`fresh-per-turn` 대신 checkpoint 에 rawConfig 영속 기각 (§Rationale "park 즉시 해제" D3)**
    - 기각 내용: `_resumeCheckpoint` 에 rawConfig 를 영속해 per-conversation frozen 유지.
    - target §6.1, §6.3 에서 fresh-config-per-turn(D3) 정책이 일관 유지됐다.

---

## 요약

`spec/5-system/4-execution-engine.md` 는 자체 `## Rationale` 절과 `spec/0-overview.md §Rationale "실행 엔진: Redis 큐 + 분산 워커 풀"` · `spec/1-data-model.md §Rationale` 에 기록된 14개 이상의 기각 결정을 전부 준수하고 있다. per-node task queue, Redis pub/sub 채널, heartbeat 인프라, `waiting_for_retry` 신규 상태, sticky fast-path, `_continuationCheckpoint` 별도 컬럼, `executeInline` 재호출 방식, backend i18n 등 명시적으로 기각된 대안이 본문에 재도입된 경우가 없으며, 합의된 설계 원칙(execution-level intake 큐, park = 세그먼트 종료, 항상 BullMQ enqueue, slow-path 일원화, credential-strip 평문 영속)이 모든 절에서 일관되게 반영돼 있다. Rationale 에 기록된 번복 결정(옛 "WARN #6" 번복, `_resumeCheckpoint` 도입, `failed → running` 전이 추가 등)도 각각 새 Rationale 항목을 동반하여 문서화됐다. 암묵적 가정 충돌도 발견되지 않았다.

---

## 위험도

NONE

STATUS: OK
