# Rationale 연속성 검토 결과

검토 모드: `--impl-prep`  
대상 문서: `spec/5-system/4-execution-engine.md`  
검토 일시: 2026-06-04

---

## 발견사항

### 발견사항 없음 — 모든 검토 관점 PASS

`spec/5-system/4-execution-engine.md` 의 현재 본문과 `## Rationale` 절을 네 가지 관점 모두에서 검토한 결과, 충돌·번복·재도입·invariant 우회를 식별하지 못했다.

**관점별 검토 요약:**

**1. 기각된 대안의 재도입**

| 과거 Rationale 기각 결정 | target 내 상태 |
|---|---|
| per-node task queue 기각 (Rationale "per-node → execution-level intake 큐") | §4.2 / §9.3 / §11 에서 "per-node task-queue 는 존재하지 않는다" 를 명시 유지. 재도입 없음 |
| `waiting_for_retry` 신규 상태 기각 (Rationale R2) | §1.3 / §1.1 에 해당 enum 없음. R1 경로(`_retryState` 보존)만 존재 |
| Redis pub/sub `execution:continuation` 채널 폐기 (Rationale "Durable Continuation") | §7.4 / §9.2 / §9.3 에서 폐기 확인, BullMQ `execution-continuation` 큐 단일 진입 유지 |
| heartbeat 채널 신설 기각 (Rationale §3 "§7.1 heartbeat → stalled-job 일원화") | §7.1 에서 "별도 heartbeat 채널 신설하지 않는다" 명시 유지 |
| sticky fast-path(publisher 가 자기 인스턴스에 key 있으면 BullMQ 우회) 기각 (Rationale "Durable Continuation") | §7.4 "항상 BullMQ enqueue" 원칙 유지, fast-path 미재도입 |
| `_continuationCheckpoint` 별도 컬럼 신설 기각 (Rationale Multi-turn 재시작 재개) | §6.2 에서 "별도 `_continuationCheckpoint` 컬럼 신설하지 않는다" 명시 유지 |
| 암호화(`ENCRYPTION_KEY` 기반 secret-store) `_resumeCheckpoint` 적용 기각 (동일 Rationale) | §1.3 에서 credential-strip 평문 영속 정책 유지 |
| `WAITING_FOR_INPUT → INTERRUPTED` 신규 enum 기각 (Rationale "Durable Continuation") | §1.1 상태 enum 에 `interrupted` 없음 |
| Temporal/Inngest 전면 이전 기각 (동일 Rationale) | 본문 어디에도 워크플로우 엔진 교체 언급 없음 |
| config + output 양쪽에 evaluated 값을 두는 안 기각 (Rationale "Engine Raw Config Exposure") | §5.1 / §5.2 에서 raw echo / evaluated 직교 정책 유지 |

**2. 합의된 원칙 위반**

검토된 원칙:
- **"작업 단위는 execution-level active 세그먼트"** (`spec/0-overview.md` §2.4 Rationale): §4.2 에서 "1 Worker = 1 active 세그먼트" 로 일관 기술.
- **"`waiting_for_input` 무기한 durable DB park"** (§4.x): 본문 전 구간(§7.1 / §7.4 / §7.5 / §9.3)에서 "큐 없는 durable DB park", "stalled 대상 절대 아님" 일관 반복.
- **"모든 진입점은 항상 BullMQ enqueue"** (§7.4): §7.4 / §7.5 에서 원칙 유지.
- **"per-node task queue 없음"** (§4.2 + Rationale): §4.2 / §9.3 / §11 에서 재확인.
- **"config-echo 는 항상 raw, evaluated 결과는 output"** (CONVENTIONS Principle 7 / Rationale "Engine Raw Config Exposure"): §5.1 / §6.3 에서 일관 유지.
- **"active-running 누적 타임아웃 (wall-clock 아님)"** (§8 / Rationale "타임아웃을 active-running 누적 기준으로"): §8 에서 명시.

위반 사항 없음.

**3. 결정의 무근거 번복**

번복 가능성이 있는 항목을 추적했다:

- `WORKER_HEARTBEAT_TIMEOUT` 코드 **유지 + 의미 재정의** ("30분 절대 stale" → "stalled attempts 소진"): Rationale §3 "§7.1 heartbeat → stalled-job 일원화" 에서 명시적으로 근거 기술됨. 번복 아님, 갱신된 Rationale 존재.
- `waiting_for_input → failed` 전이 추가: Rationale "waiting_for_input → failed 전이 추가" 에서 배경·결정 기술. 무근거 번복 아님.
- `failed → running` 재진입 전이 추가: Rationale "failed → running 재진입 전이 (R1 의 retry 실행 경로)" 에서 근거 기술. 무근거 번복 아님.
- `_resumeCheckpoint` 영속 (옛 "WARN #6 미영속" 번복): Rationale "Multi-turn 재시작 재개 — _resumeCheckpoint 보존 (옛 WARN #6 미영속 번복)" 에서 번복 사유(운영 결함·대안 비교)를 명시. Rationale 동반 번복.

무근거 번복 없음.

**4. 암묵적 가정 충돌**

`spec/0-overview.md` Rationale §2.4 의 핵심 invariant:
- **"BullMQ `execution-continuation` 큐가 at-most-once pub/sub 를 대체"**: §7.4 / §9.3 에서 일관.
- **"세 큐 (`execution-run` / `execution-continuation` / `background-execution`)"**: §9.3 큐 목록 3개 일치.
- **"forward-only 마이그레이션 (`U{version}` undo 스크립트 없음)"** (`spec/0-overview.md` Rationale §2.8): §7.4 의 V035/V036 마이그레이션 기술이 forward-only 패턴 준수.

`spec/1-data-model.md` Rationale:
- **"`execution_node_log` append-only + BIGSERIAL 정렬"**: §7.4 에서 동일 모델 기술.
- **"`executionPath: string[]` 외부 API 시그니처 유지"**: §7.4 에서 "`findById` 가 본 테이블의 정렬 쿼리로 채운다" 로 일치.

충돌 없음.

---

## 요약

`spec/5-system/4-execution-engine.md` 는 Rationale 연속성 관점에서 이상이 없다. 기각된 대안(per-node task queue, Redis pub/sub, sticky fast-path, `waiting_for_retry` 신설, heartbeat 인프라, `_continuationCheckpoint` 별도 컬럼, Temporal/Inngest 전면 이전 등)은 목록 전체가 spec 에서 제거된 채 유지되고 있고, 모든 번복(heartbeat 코드 의미 재정의, `_resumeCheckpoint` 영속 채택)에는 Rationale 내 명시적 근거가 동반돼 있다. `waiting_for_input` 무기한 park·"항상 BullMQ enqueue"·"per-node task queue 없음"·"active-running 누적 타임아웃" 같은 합의 원칙도 본문 전 구간에서 일관되게 유지된다. 구현 착수 전 Rationale 연속성 관점의 차단 사유 없음.

---

## 위험도

NONE
