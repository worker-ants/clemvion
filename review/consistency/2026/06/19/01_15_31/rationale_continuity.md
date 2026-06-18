# Rationale 연속성 검토 결과

검토 모드: --impl-prep (구현 착수 전)
Scope: `spec/5-system/4-execution-engine.md`
점검 일시: 2026-06-19

---

## 발견사항

### 발견사항 없음 — 기각된 대안 재도입 없음

이 검토에서 분석한 `spec/5-system/4-execution-engine.md` 는 구현 착수 전 상태 확인 대상이며, prompt 의 "구현 대상 영역: (없음)" 이 나타내듯 신규 spec 섹션 도입이 없다. 기존 spec 자체의 Rationale 연속성만 점검한다.

#### 주요 점검 결과

**1. per-node task queue 기각 원칙의 재확인**

- target 위치: `spec/5-system/4-execution-engine.md §4.2`, `§Rationale "per-node task queue → execution-level intake 큐"`, `§Rationale "park 즉시 해제 + slow-path 일원화" D6 항목`
- 과거 결정 출처: `spec/0-overview.md §Rationale "실행 엔진: Redis 큐 + 분산 워커 풀"` + 본 파일 `§Rationale "per-node task queue → execution-level intake 큐"`
- 상세: exec-park D6(중첩 `executeInline` blocking durable 영속)가 per-node task queue 와 같은 방향으로 오해될 수 있는 형태이나, 본 파일 D6 항목이 "per-node task queue 기각(아래 §Phase 2 cont 'per-node task-queue 미존재')과 다른 범주" 를 명시적으로 서술하고 있어 충돌 없음. D6 는 park 지점(waiting node)에서만 직렬화하는 것으로, dispatch loop in-process 전제를 유지한다는 근거가 기재됨.
- 판정: 재도입 없음. Rationale 에 배경 기재 충분.

**2. sticky fast-path 기각 원칙의 재확인**

- target 위치: `§7.4` 라우팅 원칙 셀, `§Rationale "park 즉시 해제 + slow-path 일원화" B1·B2` 항목
- 과거 결정 출처: 본 파일 `§Rationale "Durable Continuation" "Sticky fast-path 제거"`, `§Rationale "park 즉시 해제" 항목`
- 상세: full B3 완료로 `pendingContinuations` Map 이 코드에서 제거됐고, 현 spec 은 "worker-side fast-path 제거 완료" 를 §7.4 셀에 명기. "항상 BullMQ enqueue" 원칙과 충돌하는 new 분기가 없음.
- 판정: 충돌 없음.

**3. `_resumeCheckpoint` 평문 영속 — 옛 "WARN #6 미영속" 번복의 신 Rationale 존재 확인**

- target 위치: `§Rationale "Multi-turn 재시작 재개 — _resumeCheckpoint 보존 (옛 WARN #6 미영속 번복)"`
- 과거 결정 출처: 코드 주석 "WARN #6" (인스턴스 재시작 시 multi-turn 세션 in-memory only 유지 결정)
- 상세: 옛 결정을 번복하면서 본 Rationale 항목이 번복 이유(장수 채널 운영 결함)·기각 대안(암호화·별도 컬럼·TTL)·선례(`_retryState` R1)를 상세히 서술. 번복 근거 부재 아님.
- 판정: 정상적 번복 — 새 Rationale 명시적 기재 완료.

**4. `waiting_for_input → failed` 전이 추가 — 옛 WFI 종료 정책 번복**

- target 위치: `§1.1 상태 전이표`, `§Rationale "waiting_for_input → failed 전이 추가"`
- 과거 결정 출처: 옛 정책 ("WFI 종료는 running 또는 cancelled 만") — 본 파일 Rationale 항목에 명기
- 상세: AI Agent multi-turn LLM throw 경로를 위해 `WFI → failed` 단일 전이를 추가하면서, "WFI → running → failed 두 단계가 원자성을 깨므로 기각" 이라는 새 근거와 함께 추가함. 기존 원자성 원칙과 정합.
- 판정: 정상적 번복 — 새 Rationale 명시 완료.

**5. `RESUME_*` 동기 ack 노출 폐기 — 내부 모순 해소**

- target 위치: `§7.5` 설명, `§Rationale "RESUME_* 동기 ack 노출 폐기 — 후행 execution.cancelled 이벤트로 일원화"`
- 과거 결정 출처: 옛 §7.5 기술 ("이 셋 모두 WS ack 에 `resumed: false` + error 로 노출")
- 상세: 옛 기술이 §7.5.1 과 직접 모순이었고, always-enqueue 모델 도입 이후 비동기 종결이 올바른 경로라 spec 을 코드 실제 동작에 맞춤. "코드 변경 없음 — spec 을 코드 실제 동작에 맞춤" 명기.
- 판정: 정상적 정정 — 이전 오기술의 수정이며 번복이 아님.

**6. C-1 god-class 분할 — spec 무변 주장 검증**

- target 위치: `§Rationale "C-1 god-class strangler-fig 분할 (2026-06-18)"`, `§4.2` 추출 서비스 목록
- 과거 결정 출처: 본 파일 `code:` frontmatter glob + 기존 설계 원칙(단일 엔진 서비스)
- 상세: `ExecutionEngineService` 를 5개 협력 서비스로 분리했으나 본 Rationale 이 "spec 무변 — 메서드 물리 위치는 spec 이 정의하지 않는 구현 재량 영역" 이라고 명시. `codebase/backend/src/modules/execution-engine/` glob 이 추출 서비스를 자동 커버함. 인터페이스 분리에서 `WorkflowExecutor` 재사용 기각 근거("엔진 내부 통신에 재사용하면 계약 의미가 과적") 도 명기됨.
- 판단: Rationale 연속성 관점에서 spec 무변 주장이 frontmatter glob 과 정합하며, 과거 설계 원칙을 깨는 내용 없음.

**7. `EngineDriver` 내부 토큰 도입 — `WorkflowExecutor` 계약과의 분리**

- target 위치: `§Rationale "C-1 분할"` 의 `EngineDriver`(`ENGINE_DRIVER`, `useExisting: ExecutionEngineService`) 설명
- 과거 결정 출처: 기존 `WorkflowExecutor` 계약(spec 상 engine↔노드 계약)
- 상세: `EngineDriver` 는 추출 서비스가 엔진의 잔류 메서드를 호출하는 엔진 내부 전용 계약이며, `WorkflowExecutor` 계약(엔진↔노드 외부 경계)과 명시적으로 구분. in-process 전제도 명기("분산 분리가 아니라 같은 프로세스 안의 클래스 경계 정리"). `WorkflowExecutor` 재사용 기각 근거 명기.
- 판단: 과거 `WorkflowExecutor` 계약을 과적하지 않고 별도 내부 토큰으로 분리 — Rationale 연속성 문제 없음.

---

## 요약

`spec/5-system/4-execution-engine.md` 는 구현 착수 전(--impl-prep) 검토 대상이며, 신규 spec 섹션 도입(없음)이 없는 상태로 기존 spec 의 Rationale 자체를 검토했다. 파일 전체에 걸쳐 과거 결정의 번복(WARN #6 미영속 폐기, WFI→failed 전이 추가, RESUME_* 동기 ack 폐기)은 모두 새 Rationale 항목과 함께 서술되어 있으며, 기각된 대안(per-node task queue, sticky fast-path, WAITING_FOR_INPUT→INTERRUPTED enum)이 재도입된 흔적이 없다. exec-park D6(중첩 durable resume)가 per-node task queue 기각과 유사하게 보일 수 있으나, 해당 Rationale 항목이 "다른 범주"임을 명시해 오해를 선제 차단하고 있다. C-1 분할(god-class strangler-fig)은 spec 무변 주장이 frontmatter glob 커버리지로 정합하고, EngineDriver 내부 토큰과 WorkflowExecutor 외부 계약의 역할 분리가 명기돼 있다. 전체적으로 합의된 설계 원칙("항상 BullMQ enqueue", "execution-level active 세그먼트", "원자성 보장", "per-node task queue 미채택")이 유지되며 Rationale 연속성 위반은 없다.

## 위험도

NONE

STATUS: OK
