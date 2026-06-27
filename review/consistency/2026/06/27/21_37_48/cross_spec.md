# Cross-Spec 일관성 검토 — EIA seq NFR 명문화 (EIA-NF-06 / EIA-NF-07)

target: `plan/in-progress/spec-draft-eia-seq-nfr.md`
대상 spec: `spec/5-system/14-external-interaction-api.md` §3.5

## 발견사항

### [WARNING] EIA-NF-06 의 "분산 monotonic 무조건 보장" vs 기존 spec 의 명시적 degraded-fallback trade-off

- **target 위치**: 변경안 §3.5 EIA-NF-06 — "멀티 인스턴스 환경에서 … seq … 는 1000 events/s 부하에서 중복·역전 없이 단조 유일하다. Redis `INCR` 의 원자성으로 보장"
- **충돌 대상**:
  - `spec/5-system/6-websocket-protocol.md` §2.2 (line 106): "**저장소 정책은 Redis-only … Redis 미가용 시 in-memory per-instance counter 로 degrade … degraded 구간의 분산(cross-instance) monotonic 은 미보장 (수용된 trade-off)**"
  - `spec/5-system/4-execution-engine.md` §9.2 (`exec:seq:<executionId>` 행): "Redis 미가용 시 in-memory per-instance degraded fallback (분산 monotonic 미보장 — 수용된 trade-off)"
- **상세**: 같은 `ExecutionSeqAllocator` (Redis `INCR exec:seq:<id>`) counter 에 대해, 기존 두 spec 은 "정상 경로에서는 분산 monotonic 보장, **Redis 장애 degraded 구간에서는 분산 monotonic 미보장**" 으로 조건부 기술한다. target 의 EIA-NF-06 은 이 예외 구간을 명시하지 않아, 글자 그대로 읽으면 "항상 무조건 단조 유일" 로 해석되어 기존의 수용된 trade-off 와 모순된다. 직접 작동 불가까지는 아니므로 CRITICAL 이 아니라 WARNING — 다만 NFR 의 충족/위반 판정 기준이 영역마다 갈리는 문제다.
- **제안**: EIA-NF-06 문장에 "Redis 정상(가용) 경로 한정" 또는 "Redis `INCR` 가용 시" 단서를 추가하고, degraded fallback 의 미보장 구간을 websocket-protocol §2.2 / execution-engine §9.2 의 SoT 참조로 연결한다 (예: "Redis 가용 시 `INCR` 원자성으로 보장 — degraded fallback 의 cross-instance 예외는 [WS §2.2]·[실행엔진 §9.2] 의 수용된 trade-off 참조").

### [WARNING] EIA-NF-06 의 `§5.6` 인용이 잘못된 섹션을 가리킴

- **target 위치**: EIA-NF-06 말미 "Redis `INCR` 의 원자성으로 보장 (§5.6·§R7)"
- **충돌 대상**: `spec/5-system/14-external-interaction-api.md` §5.6 (line 498) = "**동시성 / Lock (EIA-NF-05)**" — inbound interact 명령의 직렬화(second-arrival → 409 STATE_MISMATCH) 를 다루며 seq counter 의 Redis INCR 원자성과 무관하다.
- **상세**: seq counter 발급의 atomic INCR 근거는 §R7 ("구현 전제": execution 별 atomic INCR) + 실행엔진 §9.2 (`exec:seq:<id>` 키 정의) 에 있다. §5.6 은 별개 동시성 주제(interact 명령 lock)라 잘못된 참조다. target 이 spec 본문에 들어가면 독자를 오도한다.
- **제안**: `(§5.6·§R7)` 를 `(§R7)` 로 정정하거나, atomic INCR 키 SoT 인 `[실행엔진 §9.2](./4-execution-engine.md#92-...)` 로 교체. (§5.6 은 EIA-NF-05 의 동시성과 혼동된 것으로 보인다 — 같은 draft Rationale 이 "EIA-NF-05(동시성 1건)" 을 언급하는 점과 일관되게, NF-05 와 §5.6 을 NF-06 자리에 잘못 끌어온 것으로 추정.)

### [INFO] 출처로 인용된 plan 파일이 존재하지 않음

- **target 위치**: 헤더 "> 출처: `plan/complete/eia-distributed-seq-load-verify.md` 수용 기준 + 실 e2e 검증 (PR #730)" 및 결정 근거의 "plan/complete/eia-distributed-seq-counter.md 수용 기준 #3"
- **충돌 대상**: `plan/complete/` 에는 `eia-distributed-seq-counter.md` 와 `eia-distributed-seq-checklist.md` 만 존재. `eia-distributed-seq-load-verify.md` 는 없음.
- **상세**: cross-spec 모순은 아니나, 정식 NFR 의 근거 추적성(traceability)을 위해 인용 경로가 실재해야 한다. 또한 EIA-NF-07 의 "수용 기준 #3" 은 실제로 `eia-distributed-seq-counter.md` 의 "single-instance 환경에서 latency 회귀 < 5ms (current in-memory baseline 대비)" 와 정합한다(검증됨) — 단 그 항목은 번호 없는 bullet 이라 "#3" 표기가 파일과 일치하지 않는다.
- **제안**: 출처 경로를 실재 파일(`eia-distributed-seq-counter.md` / `eia-distributed-seq-checklist.md`)로 정정하고, "#3" 대신 해당 bullet 문구를 직접 인용.

## 요약

데이터 모델·API 계약·요구사항 ID·RBAC·계층 책임 축에서는 충돌이 없다. 신규 ID EIA-NF-06/07 은 기존 NF-01~05 범위와 겹치지 않고, EIA-NF-07 의 latency 회귀 예산(< 5ms vs in-memory baseline)은 plan 수용 기준과 정확히 정합하며, EIA-NF-05(동시성 1건) 인용도 정확하다. 유일한 실질 충돌은 **상태/불변식 기술의 일관성** 축이다 — EIA-NF-06 이 같은 `ExecutionSeqAllocator` counter 에 대해 "무조건 분산 monotonic" 으로 단정해, websocket-protocol §2.2·execution-engine §9.2 가 명시적으로 수용한 "Redis degraded 구간 미보장" trade-off 와 어긋난다. 추가로 §5.6 인용 오류(실제로는 §R7/실행엔진 §9.2 를 가리켜야 함)와 비실재 plan 경로 인용이 있다. 모두 문구 단서 추가·참조 정정 수준으로 해소 가능하며, 본 draft 가 코드/테스트 변경 없는 문서화라는 점에서 채택 자체를 막을 정도는 아니다.

## 위험도

MEDIUM
