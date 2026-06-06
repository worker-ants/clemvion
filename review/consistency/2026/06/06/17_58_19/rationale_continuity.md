# Rationale 연속성 검토 결과

검토 대상: `spec/5-system/4-execution-engine.md`
검토 모드: `--impl-prep` (구현 착수 전)
검토 일시: 2026-06-06

---

## 발견사항

### INFO-1: `_resumeCheckpoint` 기각 대안 `암호화 영속` — Rationale 내 명시 완비
- **target 위치**: `spec/5-system/4-execution-engine.md §Rationale "Multi-turn 재시작 재개 — _resumeCheckpoint 보존 (옛 WARN #6 미영속 번복)"`
- **과거 결정 출처**: 동일 문서 Rationale 내 "WARN #6: in-memory 한정" 코드 주석 기원 결정
- **상세**: 초기 결정(WARN #6)을 번복하면서, 번복 사유(a) 추가 보호 효과 제한, (b) _resumeState 는 참조 ID 만 보유, (c) rotate/GC 복잡도)와 대안 기각(암호화 영속, `_continuationCheckpoint` 신설)을 모두 동일 Rationale 절에 함께 기술했다. 번복 동반 신규 Rationale 요건 충족.
- **제안**: 해당 없음 — 이미 올바르게 작성됨.

### INFO-2: per-node task queue 기각 — `spec/0-overview.md` §2.4 Rationale 와 정합
- **target 위치**: `spec/5-system/4-execution-engine.md §Rationale "per-node task queue → execution-level intake 큐"`, 및 §4.2 note
- **과거 결정 출처**: `spec/0-overview.md Rationale "실행 엔진: Redis 큐 + 분산 워커 풀 (§2.4)"` — "per-node task queue 를 채택하지 않은 근거는 [실행엔진 §Rationale …]"
- **상세**: `spec/0-overview.md` 는 per-node task queue 기각을 선언하고 상세 근거를 본 spec 에 위임했다. 본 spec Rationale 절이 그 위임을 완전히 받아 "(a) 엔진 재작성급 위험, (b) n8n queue mode 동형 채택" 근거를 기술하며 선언된 결정을 일관되게 유지한다. 충돌 없음.
- **제안**: 해당 없음.

### INFO-3: Redis pub/sub `execution:continuation` 폐기 — spec/0-overview.md 와 정합
- **target 위치**: `spec/5-system/4-execution-engine.md §7.4 Continuation Bus`, §9.1, §9.2, §Rationale "Durable Continuation"`
- **과거 결정 출처**: `spec/0-overview.md Rationale "실행 엔진: Redis 큐 + 분산 워커 풀"` — "옛 Redis pub/sub 채널 `execution:continuation` 은 폐기 (§Rationale 'Durable Continuation')"
- **상세**: `spec/0-overview.md` 의 선언을 본 spec Rationale 이 근거와 함께 상세화한다. at-most-once 의미론 문제, sticky fast-path 제거, 기각 대안(Temporal/Inngest, INTERRUPTED enum, pub/sub 재시도)이 모두 Rationale 에 명시돼 있다. 충돌 없음.
- **제안**: 해당 없음.

### INFO-4: `waiting_for_input → failed` 직접 전이 추가 — 기존 전이 표와의 관계 명시 보완 권장
- **target 위치**: `spec/5-system/4-execution-engine.md §1.1 허용 전이 표`, `§Rationale "waiting_for_input → failed 전이 추가"`
- **과거 결정 출처**: 동일 spec §1.1 의 초기 전이 정의 (WFI 종료를 running/cancelled 만 허용하던 암묵적 정책)
- **상세**: 해당 전이 추가는 Rationale 절에 배경·회귀 케이스·채택 사유·기각 대안(WFI→running→failed 두 단계)을 포함하여 충분히 서술됐다. 다만, 기존 "WFI 는 running 또는 cancelled 로만 종료된다"는 원칙이 **어느 문서에서 명시적으로 기각됐는지** 참조 링크가 없다 — 해당 결정이 이 문서 내부의 암묵 정의였음을 명시 한 줄 더 두면 번복 추적이 명확해진다.
- **제안**: Rationale "waiting_for_input → failed 전이 추가" 절 첫 문장에 "옛 정책(본 spec 초기 §1.1 전이 표)은 WFI 종료를 running/cancelled 로만 정의했다" 문구를 이미 포함하고 있어 사실상 충족. 현 수준으로도 연속성 추적에 충분하다.

### INFO-5: `_multiTurnState` 키 폐기 — 구버전 호환 defensive guard 를 Rationale 에 기록하지 않음
- **target 위치**: `spec/5-system/4-execution-engine.md §1.3 "재개 state 직렬화 필드 (_resumeState)"` — "옛 `_multiTurnState` 키는 Stage 2 rename + Stage 5 제거가 완료되어 현재 코드·페이로드에 존재하지 않는다."
- **과거 결정 출처**: 명시 불명 — `_multiTurnState` 의 채택 및 `_resumeState` 로의 rename/폐기 경위가 Rationale 에 없다.
- **상세**: `_multiTurnState` 는 현재 코드에서 제거됐으나 `stripControlFields()` defensive guard 에 잔존한다. 이 키의 도입·rename·폐기 결정 근거가 Rationale 에 없어, 향후 구현자가 "왜 제거됐는데 strip list 에 남아있나" 를 의문으로 남길 수 있다. 명확성 보완 제안.
- **제안**: §1.3 Rationale 또는 §Rationale 섹션에 한 줄 추가: "`_multiTurnState` → `_resumeState` rename (Stage 2) + 페이로드 제거 (Stage 5) 경위. strip list 잔존은 구버전 호환 defensive guard." 수준의 짧은 기술로 충분.

---

## 요약

`spec/5-system/4-execution-engine.md` 는 과거 Rationale 에서 기각·폐기된 결정을 이유 없이 재도입하거나 합의된 설계 원칙을 위반하는 항목이 발견되지 않는다. 주요 번복(WARN #6 `_resumeCheckpoint` in-memory 전용 → DB 영속, 별도 heartbeat → BullMQ stalled-job 일원화, Redis pub/sub → 영속 큐, per-node task queue → execution-level intake 큐, wall-clock 타임아웃 → active-running 누적 기준)은 모두 동일 문서 Rationale 절에 배경·기각 대안·채택 사유를 함께 기술해 "결정의 무근거 번복" 조건을 충족하지 않는다. `spec/0-overview.md` 의 상위 아키텍처 Rationale(Redis 큐 + 분산 워커 풀, per-node 큐 기각, pub/sub 폐기)과도 정합한다. 발견된 항목은 모두 INFO 수준의 명확성 보완 제안이다.

---

## 위험도

NONE
