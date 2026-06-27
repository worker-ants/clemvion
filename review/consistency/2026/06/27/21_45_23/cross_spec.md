# Cross-Spec 일관성 검토 — EIA-NF-06 / EIA-NF-07

target: `plan/in-progress/spec-draft-eia-seq-nfr.md`
대상 spec: `spec/5-system/14-external-interaction-api.md` §3.5

---

## 발견사항

### 데이터 모델 충돌

없음. EIA-NF-06/07 은 기존 엔티티·필드를 변경하지 않는다. `ExecutionSeqAllocator` 는 `exec:seq:<executionId>` Redis 키를 사용하며, 이는 `spec/5-system/4-execution-engine.md §9.2` 에 이미 정의된 키다. 신규 엔티티·필드는 도입되지 않는다.

### API 계약 충돌

없음. target 은 코드·API·테스트 변경 없음을 명시하며 §3.5 표 2행 추가 + §R7 말미 문장 추가만이다. 기존 endpoint 정의나 request/response shape 과 충돌이 없다.

### 요구사항 ID 충돌

- **[INFO] EIA-NF-06 / EIA-NF-07 은 spec 전체에서 미사용 ID**
  - target 위치: 변경안 §3.5 표 EIA-NF-06 행, EIA-NF-07 행
  - 충돌 대상: `spec/5-system/14-external-interaction-api.md §3.5` (EIA-NF-01~05 까지만 존재)
  - 상세: 전체 spec 에 EIA-NF-06, EIA-NF-07 을 다른 의미로 사용한 파일이 없다. 연번 추가로 공백 없이 자연 확장되므로 ID 충돌이 없다.
  - 제안: 변경 없음.

- **[INFO] NF-PF-* / NF-SC-* 등 `spec/5-system/_product-overview.md` 의 시스템급 NFR ID 와 네임스페이스 분리**
  - target 위치: 변경안 §3.5 표 신규 행
  - 충돌 대상: `spec/5-system/_product-overview.md` §1~§5 (NF-PF-01~06, NF-SC-01~10 등)
  - 상세: 시스템 공통 NFR 은 `NF-<카테고리>-<숫자>` 체계이고, EIA 영역 NFR 은 `EIA-NF-<숫자>` 체계다. 두 네임스페이스는 prefix 가 달라 충돌하지 않는다. EIA-NF-07 의 "회귀 latency < 5ms" 는 `NF-PF-03` ("노드 간 핸드오프 100ms 이내") 과 측정 대상이 다르다(per-INCR 발급 추가 latency vs 노드 핸드오프). 의미 중복이나 모순 없음.
  - 제안: 변경 없음.

### 상태 전이 충돌

없음. seq counter 는 stateless 발급 연산이라 상태 머신이 없다. `ExecutionSeqAllocator` 의 Redis 가용/미가용 분기 ("Redis 정상 → INCR, Redis 미가용 → in-memory degraded fallback") 는 `spec/5-system/6-websocket-protocol.md §2.2` 및 `spec/5-system/4-execution-engine.md §9.2` 에 이미 기술된 상태 전이와 동일하다. target 의 EIA-NF-06 은 "Redis 가용 경로 한정 + degraded 예외" 단서로 해당 상태 분기를 참조하며 기존 기술과 일치한다.

### 권한·RBAC 모델 충돌

없음. seq 발급은 실행 엔진 내부 연산이며 외부 RBAC 정책을 새로 정의하지 않는다. `spec/5-system/_product-overview.md §2` 의 기존 RBAC NFR(NF-SC-02)과 충돌이 없다.

### 계층 책임 충돌

- **[INFO] EIA-NF-07 의 측정 범위 — "single-instance 환경" 한정이 실행 엔진 §9.2 의 키 설명과 정합**
  - target 위치: EIA-NF-07 행 ("single-instance 환경에서 in-memory baseline 대비 median < 5ms")
  - 충돌 대상: `spec/5-system/4-execution-engine.md §9.2` (`exec:seq:<executionId>` 키 — sliding-window TTL, Redis INCR+EXPIRE 단일 pipeline)
  - 상세: §9.2 는 분산 환경의 exec:seq 동작을 기술하지만, EIA-NF-07 이 single-instance 한정으로 회귀 latency 를 측정하는 것은 §R10 의 "facade 레이어" 구분과 동일하게 내부 구현 세부를 노출하지 않는 올바른 NFR 프레이밍이다. 실행 엔진이 위 측정치를 책임지는 계층임을 명시하는 §9.2 cross-reference 가 이미 포함되어 있어 계층 책임 충돌 없음.
  - 제안: 변경 없음.

- **[INFO] §R7 Rationale 보강 문장이 기존 WS §Rationale 의 Redis-only 정책 결정과 중복 서술**
  - target 위치: "Rationale 보강 (§R7 말미에 1문장 추가)" 섹션 — "degraded(Redis 미가용) 구간의 cross-instance monotonic 미보장은 WS §2.2 / 실행 엔진 §9.2 의 수용된 trade-off 와 동일하다"
  - 충돌 대상: `spec/5-system/6-websocket-protocol.md §2.2` (SoT: Redis-only 정책·degraded fallback·trade-off 원문)
  - 상세: target 의 §R7 보강 문장은 기존 WS §2.2 의 내용을 §R7 맥락에서 연결 참조하는 것으로, 독립 재정의가 아니라 기존 결정에 대한 forward-reference 이다. 중복이지만 의미 모순은 없다. 두 spec 이 모두 "WS §2.2·실행엔진 §9.2 를 degraded trade-off SoT 로" 지정하므로 SoT 가 단일하게 유지된다.
  - 제안: 변경 없음 (INFO 수준 — 연결 참조는 독자 편의에 기여).

---

## 요약

target draft 는 `spec/5-system/14-external-interaction-api.md §3.5` 표에 EIA-NF-06/07 2행을 추가하고 §R7 말미에 정량 NFR 연결 문장을 보강하는 순수 가산형 spec 문서화다. 충돌하는 엔티티·API 계약·요구사항 ID·상태 머신·RBAC 정책이 없다. EIA-NF-06 의 "Redis 가용 경로 한정 + degraded 예외" 표현은 WS §2.2 / 실행엔진 §9.2 의 수용된 trade-off 와 일치하며, EIA-NF-07 의 회귀 latency 프레이밍은 EIA-NF-01/02(절대 latency SLO)·NF-PF-03(노드 핸드오프)과 성격이 구분되어 의미 중복이 없다. 발견된 항목은 모두 INFO 수준 — 연번 확장 정합 확인 및 cross-reference 중복 서술에 대한 동기화 권고이며, CRITICAL 또는 WARNING 충돌은 없다.

---

## 위험도

NONE
