# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 사유 없음.

## 전체 위험도
**LOW** — Warning 8건(spec 갱신 누락 위험·마이그레이션 번호 선취·worktree 덮어쓰기 위험) 모두 draft 내 가드 명시로 자가 인지됨. Critical 0건.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| — | — | Critical 발견 없음 | — | — | — |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W1 | Cross-Spec | `spec/1-data-model.md §2.13` Execution 컬럼에 `resume_call_stack` 미기재 | draft §C1 — data-model §2.13 갱신 지시 | `spec/1-data-model.md §2.13` (현재 `conversation_thread`·`user_variables`까지만 존재) | PR-B2 spec 갱신 시 `resume_call_stack jsonb NULL` 행·스키마 타입·migration 버전 동기화 |
| W2 | Cross-Spec | `spec/5-system/4-execution-engine.md §6.2` 저장 전략 표에 `resume_call_stack` 미포함 | draft §C5 — §6.2 durable park 스냅샷 항목 추가 지시 | `spec/5-system/4-execution-engine.md §6.2` `waiting_for_input 진입 시` 행 | §6.2 표에 `Execution.resume_call_stack jsonb (중첩 sub-workflow 호출 체인 — D6)` 항목 추가 |
| W3 | Cross-Spec | `spec/5-system/4-execution-engine.md §7.5` rehydration에 중첩 call-stack 재진입 절차 미기재 | draft §C5 — §7.5 갱신 지시 | `spec/5-system/4-execution-engine.md §7.5 Resume after Restart` (단일 레벨만 기술) | §7.5 rehydration 흐름에 `resume_call_stack IS NOT NULL → 재귀 프레임 재진입 절차` 분기 추가 |
| W4 | Cross-Spec | `spec/4-nodes/2-flow/1-workflow.md §4` — 중첩 executeInline blocking park 시 PARK_RELEASED 버블업 미기재 | draft §Rationale W2 항목 | `spec/4-nodes/2-flow/1-workflow.md §4` (executeInline 성공 반환만 기술) | §4 또는 §5 출력 구조에 "sync executeInline 내부 blocking park 발생 시 PARK_RELEASED sentinel 반환" 항목 추가 |
| W5 | Cross-Spec | `spec/5-system/4-execution-engine.md §4.x` "PR-B2 미적용" 배너·§7.4 L829 단서가 PR-B2 머지 후에도 잔존할 위험 | draft §C5 — 배너 제거 지시 | `spec/5-system/4-execution-engine.md §4.x L406–L408`, §7.4 L829 | draft C5 지시대로 PR-B2 spec 갱신 시 배너 완료형 전환, stale 서술 제거 |
| W6 | Cross-Spec | `§3.2` 컨테이너 body blocking 금지 범위에 Parallel 명시 부재 (draft는 Parallel 포함 서술) | draft §C3 "§3.2 금지 그대로" 참조 | `spec/5-system/4-execution-engine.md §3.2` (Loop/ForEach/Map만 열거, Parallel 미포함) | §3.2 문구에 Parallel 추가 또는 draft 참조 절 번호를 정확한 위치로 수정 |
| W7 | Convention Compliance | 마이그레이션 번호 `V087`을 draft 단계에 확정 기재 — 동시 PR race 시 번호 선취 오해 위험 | draft §C1 마이그레이션 항목 | `spec/conventions/migrations.md §2·§5` 착수 직전 max(V)+1 확인 정책 | `V<TBD — 착수 직전 migrations.md §5 절차로 확정>` 형식으로 변경 권장 (착수 직전 재확인 단서가 이미 있어 직접 위반은 아님) |
| W8 | Plan Coherence | active worktree `impl-exec-concurrency-cap`(PR2b)가 `spec/5-system/4-execution-engine.md`·`spec/1-data-model.md`를 PR-B2 이전 모델로 보유 — rebase 누락 시 덮어쓰기 위험 | draft C1·C5 갱신 대상 파일 | `claude/impl-concurrency-cap-pr2b` 분기 (`pendingContinuations`·"PR-B2 미적용" 서술 잔존) | PR-B2 merge 직후 `impl-concurrency-cap-pr2b` rebase 선행 즉시 체크. draft W5 + `exec-intake-queue-impl.md` PR2b 착수조건에 이미 기록됨 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I1 | Cross-Spec | `CALL_STACK_SCHEMA_VERSION` 상수 — §1.3에 `CHECKPOINT_SCHEMA_VERSION`과의 독립성 미기재 | draft §C1, `spec/5-system/4-execution-engine.md §1.3` | PR-B2 spec 갱신 시 §1.3에 독립 상수 선언 주석 추가 (draft I6 이미 명시) |
| I2 | Cross-Spec | §Rationale L1257 "단계적 롤아웃" note — append 방식 처리 | draft §C5, I3/I11 | append 후 현재형 상위 문장 잔존 방지 위해 "완료" 접두 또는 소제목 변경 고려 |
| I3 | Cross-Spec | `spec/5-system/13-replay-rerun.md` — `resume_call_stack` 보유 중첩 park에서 re-run 동작 미기재 | draft §C5 I8 | re-run은 새 Execution 생성으로 직교. 필요 시 "re-run은 resume_call_stack 상속 없음" 한 줄 주석 추가 |
| I4 | Rationale Continuity | C1 `resume_call_stack` vs L1174 `_continuationCheckpoint` 기각 결정 — target Rationale이 범주 구분 명시 | draft Rationale W2 항 | 이상 없음. spec 적용 시 §Rationale에 실제 추가 필요 (C5 W2 체크리스트에 포함) |
| I5 | Rationale Continuity | C4 `pendingContinuations` 전면 제거 — L1257 PR-B2 예정 단계 이행 | draft §C4 | 이상 없음 |
| I6 | Rationale Continuity | C3 중첩 durable park vs L1303 per-node task queue 기각 — target Rationale이 직교 명시 | draft §C3 Rationale | 이상 없음. spec §4.2/§7.5에 "중첩 재진입도 한 세그먼트 = 한 프로세스 내 재귀" 주석 추가 권장 |
| I7 | Convention Compliance | `data-model §2.13 병기 번호도 동일` 표현 — 마이그레이션 번호 vs spec 절 번호 혼동 가능성 | draft §C1 | "data-model.md §2.13 Execution 컬럼 표에 반영 — 마이그레이션 번호와 연동" 형태로 분리 기술 권장 |
| I8 | Convention Compliance | spec 참조 행 번호(L1174) — spec 수정 시 stale 참조 위험 | draft §Rationale | 행 번호 대신 heading anchor로 교체 권장 |
| I9 | Plan Coherence | `spec/4-nodes/2-flow/1-workflow.md §4` 변경(W2) — 추적 plan 없음 | draft Rationale W2 | draft 또는 `exec-park-durable-resume.md` Spec 변경 섹션에 `workflow.md §4` 항목 추가 |
| I10 | Plan Coherence | V087 next번호 정합 — V086 main HEAD 머지 완료, V087 정합 | draft §C1 | 이상 없음. PR2b 착수 시 V088+ 사용 필요 (exec-intake-queue-impl.md에 기록됨) |
| I11 | Naming Collision | `CALL_STACK_SCHEMA_VERSION` vs `CHECKPOINT_SCHEMA_VERSION` — 신규 상수, 충돌 없음 | draft §C1 | 두 상수를 인접 위치에 선언해 "checkpoint 스키마 관련 상수를 한곳에" 원칙 유지 |
| I12 | Naming Collision | `ResumeCallStackFrame.recursionDepth` vs `Execution.recursionDepth`·`ExecutionContext.recursionDepth` — 동음이의 잠재 | draft §C1 `ResumeCallStackFrame` 타입 | `frameDepth` 또는 `subworkflowDepth`로 변경하거나, spec §6.2/§7.5에서 두 필드 의미 차이를 명시 |
| I13 | Naming Collision | `resume_call_stack` DB 컬럼·`ResumeCallStackFrame` 타입·`invokerNodeId` 필드 — 기존 코드베이스 미존재, 충돌 없음 | draft §C1 | 없음 |
| I14 | Naming Collision | C4 제거 대상 식별자들 (`pendingContinuations` 등) — 제거 후 재사용 계획 없음 | draft §C4 | 제거 전 테스트·주석·JSDoc dangling reference 정리. `continuation-execution.processor.ts` L25 주석 포함 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | Warning 6건 — 모두 "draft 적용 시 spec 갱신 누락 시 발생하는 간극". Critical 없음. draft 자체가 갱신 체크리스트(W1~W6) 완비 |
| Rationale Continuity | NONE | 기각 결정 번복·불변식 위반 없음. L1174·L1303·L1257 세 지점 모두 target Rationale이 직접 해명 |
| Convention Compliance | LOW | Warning 1건 — 마이그레이션 번호 V087 draft 선취 기재 (착수 직전 재확인 단서로 직접 위반 아님). 나머지 INFO |
| Plan Coherence | LOW | Warning 1건 — `impl-concurrency-cap-pr2b` rebase 누락 시 spec 덮어쓰기 위험 (draft W5 + PR2b 착수조건에 이미 기록). `workflow.md §4` 추적 plan 누락 |
| Naming Collision | NONE | Critical/Warning 충돌 없음. `ResumeCallStackFrame.recursionDepth` 동음이의 잠재(INFO). 신규 식별자 전체 기존 코드베이스 미존재 확인 |

## 권장 조치사항

1. **(BLOCK 해소 불필요 — Critical 없음)**
2. **[W1~W3, W5] PR-B2 spec 갱신 PR에서** draft C5 체크리스트(W1·W2·W3·W4·I3·I6·I8·I11) 전체 이행 확인 — `spec/1-data-model.md §2.13` `resume_call_stack` 행 추가, `spec/5-system/4-execution-engine.md §6.2·§7.5` 갱신, §4.x 배너 완료형 전환.
3. **[W4, I9] `spec/4-nodes/2-flow/1-workflow.md §4`** — PARK_RELEASED 버블업 항목 추가를 draft 또는 `exec-park-durable-resume.md` Spec 변경 섹션에 추적 항목으로 등록.
4. **[W6] §3.2 Parallel body blocking 금지** — 실제 spec §3.2 또는 §3.5 문구를 확인해 draft 참조 절 번호 정확성을 수정.
5. **[W7] 마이그레이션 번호** — 선호 시 `V<TBD>` 형식으로 변경하여 번호 선취 오해를 방지.
6. **[W8] `impl-concurrency-cap-pr2b` rebase** — PR-B2 merge 직후 즉시 체크. `exec-intake-queue-impl.md` PR2b 착수조건 이행.
7. **[I12] `ResumeCallStackFrame.recursionDepth`** — `frameDepth` 또는 `subworkflowDepth`로 변경하거나 spec에 두 필드 의미 차이를 명시하여 rehydration 구현 시 혼동 방지.