# Cross-Spec 일관성 검토 결과

검토 대상: `plan/in-progress/spec-draft-exec-park-b2-durable.md`
검토 기준 spec: `spec/5-system/4-execution-engine.md`, `spec/1-data-model.md §2.13`, `spec/5-system/13-replay-rerun.md`, `spec/conventions/migrations.md`

---

## 발견사항

### [CRITICAL] V086 마이그레이션 번호 충돌 — C1 의 rename 지시 미반영 위험
- **target 위치**: C1 항 "마이그레이션 V086__execution_resume_call_stack.sql (가칭). 주의: main 에 이미 V086 존재 → V087+ 로 renumber 필수"
- **충돌 대상**: `codebase/backend/migrations/V086__agent_memory_scope_updated_index.sql` (실제 존재 확인됨), `spec/1-data-model.md §3 인덱스 전략` L1289: "(CONCURRENTLY, V086)"
- **상세**: target draft 가 `V086__execution_resume_call_stack.sql` 을 명시하면서 "주의" 란에 V087+ renumber 를 언급만 하고 있다. 그러나 spec draft 의 C1 본문 첫 줄에는 여전히 "(가칭) V086" 이 노출돼 있어, draft 가 그대로 spec 에 적용될 경우 마이그레이션 번호 충돌이 발생한다. `spec/1-data-model.md §3` 의 인덱스 전략 표는 V086 을 AgentMemory scope CONCURRENTLY 인덱스로 이미 기록 중 — `resume_call_stack` 마이그레이션을 V087 이상으로 확정 기재하지 않으면 두 spec 이 동일 번호를 다른 목적으로 가리키는 불일치가 생긴다.
- **제안**: C1 에서 `V086` 칭호를 제거하고 `V087__execution_resume_call_stack.sql` (또는 사전 확인 후의 올바른 번호) 로 확정 기재. `spec/1-data-model.md §3` 인덱스 표에서도 `resume_call_stack` 컬럼이 추가되는 마이그레이션 번호를 함께 명시.

---

### [WARNING] `spec/1-data-model.md §2.13 Execution` 컬럼 표에 `resume_call_stack` 미등재
- **target 위치**: C1 "data-model: 1-data-model.md §2.13 Execution 컬럼 표에 resume_call_stack jsonb NULL 행 추가"
- **충돌 대상**: `spec/1-data-model.md §2.13` — 현재 Execution 컬럼 표에 `conversation_thread`(V084), `user_variables`(V085)는 있으나 `resume_call_stack` 은 없음
- **상세**: target 이 "추가" 를 요구하는 작업이 아직 이루어지지 않은 상태에서 spec draft 를 적용하면, spec/1-data-model.md 와 spec/5-system/4-execution-engine.md §6.2 저장 전략 표가 모두 `resume_call_stack` 을 누락한 채 충돌 상태로 존재하게 된다. draft 가 "적용 예정 변경 목록" 이라면 이 자체가 충돌이 아니지만, §6.2 저장 전략 표("waiting_for_input 진입 시" 행) 의 PostgreSQL commit 대상에 `resume_call_stack` 이 열거되어 있지 않아 실행 엔진 spec 내부에서도 §6.2 와 C1 이 불일치한다.
- **제안**: target 이 spec 에 반영될 때 `spec/5-system/4-execution-engine.md §6.2` 의 "waiting_for_input 진입 시" 행의 commit 목록에 `Execution.resume_call_stack` 을 추가하고, `spec/1-data-model.md §2.13` 컬럼 표에 `resume_call_stack jsonb NULL` 행을 동시 추가해야 두 문서가 일치한다.

---

### [WARNING] `spec/5-system/4-execution-engine.md §6.2 저장 전략` — `_continuationCheckpoint` 컬럼 신설 기각 결정과의 긴장
- **target 위치**: C1 — `resume_call_stack jsonb NULL` 신규 Execution 컬럼 추가
- **충돌 대상**: `spec/5-system/4-execution-engine.md §6.2` L733, Rationale L1174: "별도 `_continuationCheckpoint` 컬럼 신설 기각 — 기존 SoT 인 `NodeExecution.outputData` 를 활용, DB 스키마 변경·마이그레이션을 회피"
- **상세**: 기존 spec 의 Rationale 은 "컨티뉴에이션 재개용 추가 컬럼을 Execution 에 신설하지 않는다" 는 원칙을 명시했다. `resume_call_stack` 은 `_continuationCheckpoint` 와 목적이 다르나(call stack 구조 = 중첩 sub-workflow 재진입 경로, `_continuationCheckpoint` = 멀티턴 runtime state snapshot) 동일한 "Execution 테이블 신규 컬럼" 범주다. 기존 기각 근거가 `resume_call_stack` 에는 적용되지 않는다는 명시적 반론이 없으면, 의사결정 이력을 읽는 사람이 혼동할 수 있다.
- **제안**: target spec 적용 시 `spec/5-system/4-execution-engine.md §Rationale` 의 해당 절에 "call stack 영속(D6)은 `_continuationCheckpoint` 기각과 같은 범주가 아닌 이유 — `NodeExecution.outputData` 로 표현할 수 없는 호출 체인 구조를 담는 전용 컬럼" 이라는 명시적 주석을 추가할 것을 권장.

---

### [WARNING] `spec/5-system/4-execution-engine.md §4.x` 구현 메모 — PR-B2/B3 "미적용" 상태 서술이 C5 완료형 갱신과 충돌
- **target 위치**: C5 "§4.x banner 2개 '멀티턴 AI 잠정 잔존' 인라인 표기 제거 → 완료형 갱신"
- **충돌 대상**: `spec/5-system/4-execution-engine.md` L406, L408, L829 — 현재 spec 이 "PR-B2(멀티턴 AI) 미적용" 상태를 명시적으로 기술 중
- **상세**: 현재 spec 은 L406 에서 "PR-B2(멀티턴 AI) 미적용: `runAiConversationLoop` 장수 루프의 turn-단위 park 전환·fast-path 잔재 제거(B3)는 아직 미반영", L829 에서 "`pendingContinuations` 에 in-memory 코루틴이 살아있으면(멀티턴 AI 잠정 경로) `rejectPending` 경로로 처리" 를 기술한다. target draft C5 가 이를 "완료형" 으로 갱신하겠다고 하나, PR-B2 가 실제 머지되기 전에 spec 만 완료형으로 바꾸면 spec과 구현이 역전된다. 이는 충돌이 아닌 적용 순서 의존성이지만, draft 가 "spec 적용 시점 = 구현 완료 후" 를 명시하지 않으면 위험하다.
- **제안**: C5 에 "본 spec 갱신은 PR-B2 코드 머지 후에 적용" 전제를 명시. 아직 주석이 있는 상태에서 spec 만 완료형으로 변경하는 것은 CLAUDE.md "spec/ 변경 → project-planner" 규약상 구현 완료 확인 후 적용이 원칙이다.

---

### [WARNING] `spec/5-system/4-execution-engine.md §7.5` rehydration 절차에 중첩 call stack 재진입 미기술
- **target 위치**: C5 "§7.5 rehydration: 재귀 call-stack 재진입 절차 추가"
- **충돌 대상**: `spec/5-system/4-execution-engine.md §7.5 Resume after Restart (rehydration)` — 현재 §7.5 는 top-level 단일 세그먼트 재개만 기술하며, `resume_call_stack` 을 읽어 중첩 프레임을 재진입하는 절차가 없음
- **상세**: C3 에서 정의하는 `driveResumeDetached`/`resumeFromCheckpoint` 가 call stack 을 읽어 재귀적으로 executeInline 을 재호출하는 절차가 §7.5 에 없다. target draft 가 "추가" 를 예고하지만 현재 §7.5 는 `resume_call_stack` 을 전혀 참조하지 않는다. spec 적용 전까지는 §7.5 재개 절차와 실제 구현이 불일치하게 된다.
- **제안**: target spec 적용 시 §7.5 에 "중첩 call stack 재진입" 단계를 명시적으로 추가 — `resume_call_stack IS NOT NULL` 분기 → 프레임 재귀 재진입 → 최내층 WAITING NodeExecution 에 payload 전달 순서.

---

### [INFO] `spec/1-data-model.md §2.13` 의 `conversation_thread` / `user_variables` "분류" 서술과 `resume_call_stack` 분류 일관성
- **target 위치**: C1 "conversation_thread/user_variables 와 같은 'durable park 스냅샷' 분류"
- **충돌 대상**: `spec/1-data-model.md §2.13` — `conversation_thread` (V084) · `user_variables` (V085) 는 각각 다른 설명 방식으로 기술되어 있으나 명시적 "분류" 태그는 없음
- **상세**: target draft 가 `resume_call_stack` 을 "durable park 스냅샷" 으로 분류한다고 쓰지만, `spec/1-data-model.md` 의 기존 두 컬럼 설명에는 이 분류 용어가 없다. 분류 용어를 추가할 경우 기존 컬럼 설명도 같은 언어로 갱신해야 일관성이 유지된다.
- **제안**: `spec/1-data-model.md §2.13` 에 `resume_call_stack` 추가 시, 기존 `conversation_thread`·`user_variables` 설명에도 "durable park 스냅샷" 분류 표기를 통일 추가하거나, 분류 용어를 spec draft 에서 삭제하고 기능 설명만 남기는 방향 중 하나를 선택.

---

### [INFO] `spec/conventions/migrations.md` — `V087` 번호 미확인 상태에서의 draft 작성
- **target 위치**: C1 "V086__execution_resume_call_stack.sql (가칭)... V087+ 로 renumber 필수"
- **충돌 대상**: `spec/conventions/migrations.md §5 새 마이그레이션 추가 절차`, `codebase/backend/migrations/` 실제 파일 목록
- **상세**: 현재 migrations 폴더에 V086 까지 존재하며 V087 은 미사용 상태다. draft 가 "V087+" 로 renumber 를 권고하나 "가칭" 이라는 표현을 유지해 번호가 확정되지 않은 채 spec draft 에 포함되어 있다. `spec/conventions/migrations.md` 는 "재사용 금지: 한 번 main 에 들어간 V번호는 재할당하지 않는다" 를 명시하므로 draft 에서 번호를 확정하지 않으면 작성자마다 다른 번호를 사용할 위험이 있다.
- **제안**: spec 적용 전 V087 이 실제 사용 가능한지 `check-migration-versions.py` 로 확인 후 확정 번호를 명시.

---

## 요약

target draft(PR-B2 full durable turn-park + 중첩 call stack 영속)는 기존 `spec/5-system/4-execution-engine.md` 의 Phase B 롤아웃 설계(B1→B2→B3)와 논리적으로 일관되며, `spec/1-data-model.md` 의 V084/V085 컬럼 패턴을 자연스럽게 확장한다. 다만 세 가지 직접 갱신 대상 사이의 정합이 미완성이다: (1) V086 마이그레이션 번호 충돌이 CRITICAL 수준으로 명확히 renumber 확정이 필요하고, (2) `spec/1-data-model.md §2.13` 및 `spec/5-system/4-execution-engine.md §6.2` 의 `resume_call_stack` 미등재, (3) §7.5 rehydration 절차에 중첩 call stack 재진입 단계 미기술. C5 의 "완료형 갱신" 은 PR-B2 코드 머지와 순서가 지켜져야 spec↔구현 역전을 막을 수 있다. 다른 영역(13-replay-rerun, 0-overview, conventions/migrations) 에는 target 이 기술하는 변경과 직접 모순되는 서술이 없다.

---

## 위험도

**MEDIUM**

(CRITICAL 1건 — V086 마이그레이션 번호 충돌, WARNING 3건 — 두 spec 파일 미동기화·기각 결정 긴장·§7.5 미기술)

STATUS: SUCCESS
