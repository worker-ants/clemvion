# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-done` (구현 완료 후 검토)
Target: `spec/5-system` (diff vs origin/main)
검토 일시: 2026-06-06

---

## 변경 요약

이번 PR 에서 변경된 spec 파일과 핵심 내용:

1. **`spec/5-system/4-execution-engine.md`** — 구현 상태 메모 갱신:
   - PR-B2a(top-level 멀티턴 AI turn-단위 park) 완료로 표기
   - PR-B2b(중첩 executeInline D6 + full B3) 미적용 명시
   - 새 섹션: `resume_call_stack` D6 재귀 재진입 절차 추가
   - §6.2 waiting_for_input 진입 시 저장 목록에 `(e) resume_call_stack` 추가

2. **`spec/1-data-model.md`** — Execution 엔티티에 `resume_call_stack` JSONB 필드 추가 (V087)

---

## 발견사항

### [WARNING] data-flow/3-execution.md — 멀티턴 AI fast-path 분기 stale
- **target 위치**: `spec/5-system/4-execution-engine.md` §4.x 구현 메모 (PR-B2a 완료 기술)
- **충돌 대상**: `spec/data-flow/3-execution.md` line 52, line 111
- **상세**:
  - `4-execution-engine.md`(target) 는 "PR-B2a(top-level 멀티턴 AI) 완료 — fresh park 가 in-memory resolver 를 등록하지 않아 항상 rehydration 으로 재개"를 선언한다.
  - `spec/data-flow/3-execution.md` line 52 의 sequence diagram note 는 여전히 "멀티턴 AI 는 PR-B2 전까지 in-memory 루프 유지(잠정 fast-path)" 라 기술한다.
  - line 111~112 의 `alt` 분기 "멀티턴 AI 로컬 pendingContinuations hit (잠정 fast path — PR-B2 에서 제거)" + `Eng->>Eng: resolver 호출 → waitForX await 풀림` 코드 경로는 top-level 멀티턴 AI 재개에 대해서는 현재 존재하지 않는 코드 경로를 diagram 으로 보여주고 있다.
  - 이는 spec 독자가 "top-level 멀티턴 AI 재개 시 fast-path 가 여전히 동작한다" 고 오인할 수 있는 정보 불일치다.
  - **중첩 `executeInline` 멀티턴 AI 는 PR-B2b 미적용이라 여전히 in-memory 루프이지만**, data-flow 문서는 top-level / 중첩을 구분하지 않고 "멀티턴 AI"를 통칭하여 기술한다.
- **제안**: `spec/data-flow/3-execution.md`를 갱신한다.
  - line 52 note 를: "Phase B — park = 세그먼트 종료. 폼/버튼·top-level 멀티턴 AI(PR-B2a)는 코루틴을 즉시 해제하고(메모리 0 점유) 재개는 §7.5 rehydration(slow-path)으로 일원화. 중첩 executeInline 멀티턴 AI 는 PR-B2b 미적용(in-memory 루프 잠정 유지). continuation-queue(BullMQ) consume 가 깨운다" 로 수정.
  - §1.3 sequence diagram 의 `alt 멀티턴 AI 로컬 pendingContinuations hit` 분기를: "멀티턴 AI **중첩 executeInline** 로컬 pendingContinuations hit (잠정 fast path — PR-B2b 에서 제거)" 로 범위 한정 + `else` 분기를 "폼/버튼·top-level 멀티턴 AI 또는 중첩 local miss (§7.5 rehydration — Phase B 일원화)" 로 명시.

### [WARNING] data-flow/3-execution.md §1.3 — rehydration 재구성 목록에 resume_call_stack 미포함
- **target 위치**: `spec/5-system/4-execution-engine.md` §6.2, §7.5 (resume_call_stack D6 재귀 재진입)
- **충돌 대상**: `spec/data-flow/3-execution.md` line 114
- **상세**:
  - target spec 은 `Execution.resume_call_stack` (V087)을 park 시 durable commit 하고 §7.5 rehydration 이 이 스택으로 sub-workflow 프레임 재귀 재진입한다고 명시한다.
  - `spec/data-flow/3-execution.md` line 114 의 rehydration 재구성 경로 기술 `ExecutionContext 재구성 (execution_node_log + node_execution.output_data + conversation_thread + user_variables)` 는 `resume_call_stack` 를 포함하지 않는다.
  - D6 코드 구현 자체는 PR-B2b 예정이므로 현재 live 경로에 `resume_call_stack` 재진입이 없지만, 설계 확정된 필드가 schema 매핑 문서에 누락되어 있으면 PR-B2b 구현 시 참조 문서 기준이 흐릿해진다.
- **제안**: `spec/data-flow/3-execution.md` line 114 를 `ExecutionContext 재구성 (execution_node_log + node_execution.output_data + conversation_thread + user_variables + resume_call_stack?)` 으로 갱신하되, `resume_call_stack` 재진입은 PR-B2b 구현 예정(`exec-park D6`)임을 괄호 주석으로 표기한다.

### [INFO] data-flow/3-execution.md §2.1 Postgres 매핑 — execution 테이블 durable resume 컬럼 미등재
- **target 위치**: `spec/1-data-model.md` (conversation_thread V084, user_variables V085, resume_call_stack V087 추가)
- **충돌 대상**: `spec/data-flow/3-execution.md` §2.1 Postgres 매핑 표
- **상세**:
  - `spec/data-flow/3-execution.md` §2.1 의 `execution` 테이블 행은 `INSERT workflow_id, trigger_id, status, input_data, started_at, ...` 와 `UPDATE status, finished_at, ...` 만 기재하고, `conversation_thread`, `user_variables`, `resume_call_stack` 세 durable resume 컬럼을 포함하지 않는다.
  - 이 세 컬럼은 이미 data-model 과 execution-engine spec 에 정의되어 있으며, data-flow 문서의 Schema 매핑 섹션이 incomplete 하다는 동기화 권장 사항이다.
  - 실제 충돌·모순은 아니며 문서 완결성 관점의 gap 이다.
- **제안**: `spec/data-flow/3-execution.md` §2.1 `execution` 테이블 행의 `waiting_for_input 진입 시` 케이스를 별도 행으로 분리하거나, 기존 상태 전이 행에 `+ conversation_thread (park 시), user_variables (park 시), resume_call_stack (park 시, D6 구현 예정)` 을 추가한다.

---

## 요약

`spec/5-system/4-execution-engine.md` 와 `spec/1-data-model.md` 의 변경 자체는 내부적으로 일관성이 있다 — PR-B2a(top-level 멀티턴 AI turn-park) 완료 표기, V087 `resume_call_stack` 신설, D6 재귀 재진입 절차 모두 두 파일 간 상호 참조와 정합한다. 주요 cross-spec 충돌은 **`spec/data-flow/3-execution.md` 가 PR-B2a 이전 상태("멀티턴 AI fast-path 잠정 유지")를 그대로 반영하고 있어 target spec 의 현행 구현 상태와 어긋나는 것**이다. 이는 top-level 멀티턴 AI 재개 경로에 대한 명시적 정보 불일치(WARNING)이고, rehydration 재구성 목록의 `resume_call_stack` 누락은 설계 확정 항목 동기화 권장(WARNING)이다. 두 항목 모두 작동 불가 수준의 CRITICAL 충돌은 아니나, PR-B2b 구현 전에 data-flow 문서 동기화가 권장된다.

---

## 위험도

LOW
