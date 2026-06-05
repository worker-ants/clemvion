# Cross-Spec 일관성 검토 결과

**대상 draft**: `plan/in-progress/spec-draft-exec-park-b2-durable.md`
**검토 기준 spec**: `spec/5-system/4-execution-engine.md`, `spec/1-data-model.md`, `spec/conventions/migrations.md`, `spec/4-nodes/2-flow/1-workflow.md`, `spec/5-system/13-replay-rerun.md`, `spec/0-overview.md`
**검토 일시**: 2026-06-06

---

## 발견사항

### [WARNING] V086이 이미 AgentMemory 인덱스에 할당됨 — 마이그레이션 번호 충돌 가능성

- **target 위치**: draft §C1 "마이그레이션: `V087__execution_resume_call_stack.sql` (현재 next=**V087**; 최고 V086 #482)"
- **충돌 대상**: `spec/1-data-model.md §3 인덱스 전략` (AgentMemory 행: "CONCURRENTLY, V086"), 실제 마일스톤 파일 `codebase/backend/migrations/V086__agent_memory_scope_updated_index.sql`
- **상세**: draft 자체는 "최고 V086, next=V087" 로 정확히 기술하고 있어 직접 충돌은 없다. 그러나 동시 진행 중인 다른 PR이 V087을 먼저 머지하면 충돌이 생긴다. draft의 "구현 착수 직전 `ls migrations/V08* | tail -2` 재확인" 지시는 이 리스크를 이미 인지한 것이다. `spec/1-data-model.md`에는 `conversation_thread(V084)`, `user_variables(V085)`, `AgentMemory 인덱스(V086)` 까지만 명시되고 `V087`은 미기재 상태 — draft 적용 시 data-model §2.13에 V087 행을 추가해야 한다.
- **제안**: PR-B2 착수 직전 migrations 디렉터리를 재확인하여 번호를 확정하고, `spec/1-data-model.md §2.13` Execution 컬럼 표에 `resume_call_stack jsonb NULL (V087)` 행을 즉시 동기화한다. spec 적용 조건(W3: 코드와 동시 머지)은 이미 draft에 명시되어 있어 정책 자체는 문제 없음.

---

### [WARNING] `spec/1-data-model.md §2.13` Execution 컬럼에 `resume_call_stack` 미기재

- **target 위치**: draft §C1 "data-model: `1-data-model.md §2.13 Execution` 컬럼 표에 `resume_call_stack jsonb NULL` 행 추가"
- **충돌 대상**: `spec/1-data-model.md §2.13 Execution` (컬럼 표 — 현재 `conversation_thread`, `user_variables` 까지만 있고 `resume_call_stack` 없음)
- **상세**: draft가 spec 적용 대상으로 명시했지만 draft 자체는 "spec 갱신 예고" 문서이므로, 현재 spec은 새 컬럼을 인지하지 못한다. 적용 전 main에서 spec을 보는 사람은 `resume_call_stack` 컬럼 정의를 볼 수 없다.
- **제안**: PR-B2 spec 갱신 PR에서 `spec/1-data-model.md §2.13`에 `resume_call_stack jsonb NULL` 행, 스키마 타입(`{ version, frames: ResumeCallStackFrame[] }`), migration 버전을 동기화. draft C1의 "data-model §2.13 병기 번호도 동일" 지시와 일관.

---

### [WARNING] `spec/5-system/4-execution-engine.md §6.2` 저장 전략 표에 `resume_call_stack` 미포함

- **target 위치**: draft §C5 "§6.2 저장 전략: durable park 스냅샷에 `resume_call_stack` 추가"
- **충돌 대상**: `spec/5-system/4-execution-engine.md §6.2 저장 전략` — 현재 `waiting_for_input 진입 시` 행이 `NodeExecution.outputData + Execution.conversation_thread + Execution.user_variables`만 열거. `resume_call_stack`(중첩 sub-workflow durable commit)는 명시 안 됨.
- **상세**: §6.2가 durable park 스냅샷 목록의 단일 진실이므로, 여기에 누락된 채로는 rehydration 구현자가 `resume_call_stack`을 다룰 의무를 인지하지 못할 수 있다.
- **제안**: PR-B2 spec 갱신 시 §6.2 표 `waiting_for_input 진입 시` 셀에 `Execution.resume_call_stack jsonb (중첩 sub-workflow 호출 체인 — D6)` 항목 추가. draft §C5가 이미 이를 명시하고 있으나 현재 spec에 반영 안 된 상태.

---

### [WARNING] `spec/5-system/4-execution-engine.md §7.5` rehydration에 중첩 call-stack 재진입 절차 미기재

- **target 위치**: draft §C5 "§7.5 rehydration: 재귀 call-stack 재진입 절차 추가"
- **충돌 대상**: `spec/5-system/4-execution-engine.md §7.5 Resume after Restart` — 현재 rehydration 흐름 다이어그램은 단일 레벨(top-level WAITING NodeExecution 찾아 payload 전달) 기준. `resume_call_stack IS NOT NULL`인 경우의 재귀 executeInline 재진입 절차가 없음.
- **상세**: C3(중첩 sub-workflow durable park)이 구현되면 top-level과 중첩 park를 같은 `continuation-queue` job으로 처리하는데, §7.5가 여전히 단일 레벨만 기술하면 spec과 코드 간 이해 간극이 생긴다.
- **제안**: PR-B2 spec 갱신 시 §7.5 rehydration 흐름에 "resume_call_stack IS NOT NULL → 재귀 프레임 재진입 절차" 분기를 추가. draft §C5·Rationale §spec 적용 시 챙길 동기화 W4에 이미 명시되어 있으므로 spec 갱신 체크리스트에 포함.

---

### [WARNING] §4.x park 구현 메모의 "PR-B2 미적용" 상태 표기가 PR-B2 머지 후에도 잔존할 위험

- **target 위치**: draft §C5 "§4.x banner 2개(park=세그먼트 종료 · slow-path 일원화): 'PR-B2 미적용/멀티턴 잠정 잔존' 인라인 표기 제거"
- **충돌 대상**: `spec/5-system/4-execution-engine.md §4.x 구현 메모` (L406–L408) — 현재 "PR-B2(멀티턴 AI) 미적용"·"잠정 잔존" 명시. `§7.4 Worker 동작` (L829) "멀티턴 AI 잠정 경로 rejectPending" 단서도 동일 상태 기술.
- **상세**: 이 배너들이 PR-B2 머지 후에도 제거되지 않으면, spec을 읽는 사람이 PR-B2 완료 후에도 "아직 미적용"으로 오독한다. 이는 직접 모순은 아니지만 spec의 사실 정확성을 훼손하는 stale 서술이 된다.
- **제안**: draft C5에 명시된 대로 PR-B2 spec 갱신 시 해당 배너 제거 및 완료형 서술로 전환. draft의 W3(코드와 동시 머지) 전제조건 준수 시 자연스럽게 해소. 제거 전 draft I3/I11의 "역사 맥락 보존" 지침(말미 append)도 함께 적용.

---

### [WARNING] `spec/4-nodes/2-flow/1-workflow.md §4` — 중첩 executeInline blocking park 시 PARK_RELEASED 버블업 미기재

- **target 위치**: draft §Rationale 마지막 단락 "§4-nodes/2-flow/1-workflow.md §4 에 'sync sub-workflow 내부 blocking park 시 executeInline 도 PARK_RELEASED 버블업' 추가 (W2)"
- **충돌 대상**: `spec/4-nodes/2-flow/1-workflow.md` — 현재 executeInline(sync) 실행 성공 시 반환값을 `output.result`로 래핑하는 것만 기술. 내부 blocking park 시 PARK_RELEASED가 어떻게 처리되는지 미기재.
- **상세**: PR-B2(C3)가 중첩 sub-workflow blocking도 durable park로 처리하면, executeInline이 PARK_RELEASED를 반환·버블업하는 새 시맨틱이 생긴다. 이 시맨틱이 Workflow 노드 spec에 없으면 노드 구현자가 핸들러 반환 값의 의미를 오해할 수 있다.
- **제안**: PR-B2 spec 갱신 시 `spec/4-nodes/2-flow/1-workflow.md §4 (실행 로직)` 또는 §5 출력 구조에 "sync executeInline 내부에서 blocking park 발생 시 PARK_RELEASED sentinel 반환 → handler가 세그먼트 종료 처리" 항목 추가. draft W2에 이미 명시.

---

### [WARNING] `spec/5-system/4-execution-engine.md §3.2` container body blocking 금지 범위에 Parallel 명시 부재

- **target 위치**: draft §C3 "제약 유지: 컨테이너(Loop/ForEach/Map/Parallel) body의 blocking은 §3.2 금지 그대로"
- **충돌 대상**: `spec/5-system/4-execution-engine.md §3.2 body 서브그래프 제약` — 현재 "컨테이너 body(Loop / ForEach / Map)는 blocking 노드 … 금지"로 명시. Parallel은 §3.2 body 제약 목록에 없음. (Parallel body는 별도 §3.5에 기술되어 있고 blocking 금지 명시가 있는지 미확인 — §3.5 인용이 §3.2와 다른 문맥)
- **상세**: draft는 "컨테이너(Loop/ForEach/Map/Parallel) body" 라고 Parallel을 명시적으로 포함하지만, 기존 §3.2 문구는 "Loop / ForEach / Map"만 나열한다. Parallel body blocking 금지가 §3.2가 아닌 다른 절에 있다면 draft의 §3.2 참조가 부정확한 것이고, 없다면 기존 spec에 누락된 것이다.
- **제안**: `spec/5-system/4-execution-engine.md §3.2` (또는 Parallel 관련 섹션)을 확인해 Parallel body blocking 금지 명시 위치를 파악한 뒤, draft의 "§3.2 금지 그대로" 참조 표현을 정확한 절 번호로 수정 또는 §3.2 문구에 "Parallel" 추가. 기능적 충돌은 없으나 참조 정확성이 필요.

---

### [INFO] `CALL_STACK_SCHEMA_VERSION` 상수 — `spec/5-system/4-execution-engine.md §1.3`에 기존 `CHECKPOINT_SCHEMA_VERSION`과의 독립성 미기재

- **target 위치**: draft §C1 "`version`: 별도 상수 `CALL_STACK_SCHEMA_VERSION` (기존 `CHECKPOINT_SCHEMA_VERSION`과 독립 — 혼동/coupling 방지)"
- **충돌 대상**: `spec/5-system/4-execution-engine.md §1.3` — 현재 `CHECKPOINT_SCHEMA_VERSION`만 언급. `CALL_STACK_SCHEMA_VERSION` 독립 상수 정의가 없음.
- **상세**: 두 스키마 버전 상수가 독립으로 관리된다는 명시가 없으면 향후 코드리뷰·구현자가 단일 버전으로 통합하거나 혼용할 수 있다. 기능 충돌보다는 명명/관리 정책의 문서화 누락.
- **제안**: PR-B2 spec 갱신 시 §1.3 (블로킹/재개 컨트랙트) 또는 §6.2에 `CALL_STACK_SCHEMA_VERSION` 상수 주석을 추가하여 `CHECKPOINT_SCHEMA_VERSION`과의 독립성을 명시. draft I6에 이미 지시.

---

### [INFO] `spec/5-system/4-execution-engine.md §Rationale` — "단계적 롤아웃 (B1 → B2)" note 처리 방식

- **target 위치**: draft §C5 "L1257 단계적 롤아웃 note: '(완료 — B1·B2 모두 머지, 2026-06-06; 중첩은 D6 call stack 영속)' append"
- **충돌 대상**: `spec/5-system/4-execution-engine.md §Rationale "단계적 롤아웃"` (L1257) — 현재 B1·B2 단계별 내용이 현재형으로 기술됨.
- **상세**: draft I3/I11이 "역사 맥락 보존"을 위해 기존 note를 삭제 대신 완료 append 방식으로 처리하도록 지시하는 것은 합리적 접근. 충돌보다는 갱신 방향 확인 사항.
- **제안**: append 방식 유지. 단, append 후 "단계 롤아웃 중" 같은 현재형 표현이 최상위 문장으로 남아 오독을 유발하지 않도록 "완료" 접두 또는 소제목 변경을 고려.

---

### [INFO] `spec/5-system/13-replay-rerun.md` — `resume_call_stack`이 있는 중첩 park에서 re-run 동작 미기재

- **target 위치**: draft §C5 "§13-replay-rerun §14.3 직교 유지 확인 (I8)"
- **충돌 대상**: `spec/5-system/13-replay-rerun.md` — re-run 시 중첩 sub-workflow 실행의 `resume_call_stack` 처리 방식 미언급.
- **상세**: re-run은 새 Execution을 시작하므로 `resume_call_stack`은 원본 실행에만 남고 re-run에는 미관여이지만, 이를 명시적으로 기술하지 않으면 구현자가 re-run 시 call stack을 복사해야 하는지 혼동할 수 있다. draft의 "직교 유지 확인"이 해당 검토를 이미 지시하고 있음.
- **제안**: PR-B2 spec 갱신 후 13-replay-rerun.md에 한 줄 주석("re-run은 새 Execution 생성 — `resume_call_stack`은 원본에만 귀속, re-run 상속 없음") 추가 여부를 판단. 현재 직교로 간주하고 별도 갱신이 불필요하면 draft I8 점검만으로 충분.

---

## 요약

target draft(spec-draft-exec-park-b2-durable.md)는 기존 spec과의 직접 모순(CRITICAL)을 발생시키지 않는다. draft 자체가 "코드와 동시 머지(W3)"를 명시적 전제조건으로 설정하고, 적용 시 갱신해야 할 spec 파일·섹션 목록(W1·W2·W4·I3·I6·I8·I11)을 Rationale 말미에 완비하고 있어 spec drift 위험이 자가 인지된 상태다. 주요 경고(WARNING)는 모두 "draft 적용 시 갱신 누락 시 발생하는 spec 간 불일치"이며, 이는 spec 갱신 PR에서 draft 지시 사항을 충실히 따르면 해소된다. 유일하게 확인이 필요한 사항은 Parallel body blocking 금지의 spec 참조 절 번호 정확성(§3.2 vs 별도 절)이다.

## 위험도

LOW

---

STATUS: OK
