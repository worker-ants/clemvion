# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다.

검토 대상: `plan/in-progress/spec-draft-exec-park-b2-durable.md`
검토 일시: 2026-06-06

---

## 전체 위험도

**HIGH** — 마이그레이션 버전 V086 충돌(Critical)이 Flyway 배포 즉시 중단을 유발하며, 복수 checker 에서 동일 문제로 집중 경보. WARNING 7건(spec 파일 간 미동기화, 기각 결정 긴장, §7.5 미기술, active worktree 덮어쓰기 위험, C5 적용 순서 의존성, schemaVersion/Frame 명명 중의성) 추가.

---

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| C1 | Cross-Spec + Naming-Collision (통합) | 마이그레이션 버전 `V086` 이미 점유 — spec draft 가 `V086__execution_resume_call_stack.sql` 을 사용하면 Flyway validate 단계에서 즉시 배포 중단 | C1 "마이그레이션: `V086__execution_resume_call_stack.sql` (가칭)" | `codebase/backend/migrations/V086__agent_memory_scope_updated_index.sql` + `spec/1-data-model.md §3 인덱스 표 (CONCURRENTLY, V086)` | spec draft 에서 `V086` 가칭 표기 제거 후 `V087__execution_resume_call_stack.sql` 로 확정 기재. `spec/1-data-model.md §2.13` 추가 시 동일 번호 명시. `ls migrations/V08*` 로 실제 next 번호 재확인 후 확정. |

> 동일 충돌이 Cross-Spec(CRITICAL), Convention-Compliance(WARNING), Naming-Collision(CRITICAL), Plan-Coherence(INFO), Rationale-Continuity(INFO) 5개 checker 모두에서 지적됨. 가장 강한 등급(CRITICAL)으로 통합.

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W1 | Cross-Spec | `resume_call_stack` 이 `spec/1-data-model.md §2.13` 컬럼 표 및 `spec/5-system/4-execution-engine.md §6.2` "waiting_for_input 진입 시" commit 목록에 미등재 — 두 spec 파일 내부 불일치 | C1 "data-model §2.13 추가" | `spec/1-data-model.md §2.13`, `spec/5-system/4-execution-engine.md §6.2` | spec 적용 시 두 파일에 `resume_call_stack jsonb NULL` 행과 commit 목록 항목을 동시 추가 |
| W2 | Cross-Spec | `_continuationCheckpoint` 컬럼 신설 기각 결정(Rationale L1174)과 신규 `resume_call_stack` Execution 컬럼 신설의 범주 긴장 — 명시적 반론 없으면 독자 혼동 | C1 `resume_call_stack jsonb NULL` 신규 Execution 컬럼 | `spec/5-system/4-execution-engine.md §Rationale L1174` "별도 컬럼 신설 기각" | spec §Rationale 에 "call stack 영속(D6)이 `_continuationCheckpoint` 기각과 다른 범주인 이유" 명시적 주석 추가 |
| W3 | Cross-Spec | C5 "완료형 갱신" 이 PR-B2 코드 머지 전에 spec 에만 적용되면 spec↔구현 역전 발생 | C5 "§4.x banner 제거 → 완료형 갱신" | `spec/5-system/4-execution-engine.md` L406, L408, L829 현재 "PR-B2 미적용" 명시 | C5 에 "PR-B2 코드 머지 후 적용" 전제를 명시 |
| W4 | Cross-Spec | §7.5 rehydration 절차에 중첩 call stack 재진입 단계 미기술 — C3 의 `driveResumeDetached`/`resumeFromCheckpoint` 절차가 §7.5 에 없음 | C5 "§7.5 재귀 call-stack 재진입 절차 추가" 예고 | `spec/5-system/4-execution-engine.md §7.5` (현재 top-level 단일 세그먼트 재개만 기술) | spec 적용 시 §7.5 에 `resume_call_stack IS NOT NULL` 분기 → 재귀 프레임 재진입 → 최내층 WAITING NodeExecution payload 전달 순서 명시 |
| W5 | Plan-Coherence | `impl-concurrency-cap-pr2b` active worktree 가 `spec/5-system/4-execution-engine.md` 를 Phase B 이전 서술로 보유 — PR-B2 머지 후 push 시 target C5 완료형 재전환 덮어쓰기 위험 | C5 spec 서술 재전환 | `claude/impl-concurrency-cap-pr2b` branch (PR 없음, active — pendingContinuations fast-path 서술 잔존) | PR-B2 머지 전 `impl-concurrency-cap-pr2b` 가 origin/main rebase 선행. `exec-intake-queue-impl.md` 착수조건에 명기 여부 재확인 |
| W6 | Naming-Collision | `schemaVersion` 필드 중의성 — `_resumeCheckpoint.schemaVersion`(기존 `CHECKPOINT_SCHEMA_VERSION`) 과 `resume_call_stack.schemaVersion` 이 동일 이름으로 독립 진화 시 의도치 않은 coupling 위험 | C1 `resume_call_stack: { schemaVersion: number, frames: Frame[] }` | `execution-engine.service.ts:284 CHECKPOINT_SCHEMA_VERSION` | spec draft 에 `resume_call_stack` 버전 필드가 별도 상수(`CALL_STACK_SCHEMA_VERSION`)임을 명시하거나 필드명을 `version` 으로 변경 |
| W7 | Naming-Collision | `Frame` 타입명 범용성 — JS/TS 생태계 다의어, 현재 codebase 에 동명 export 타입 없어 즉각 충돌은 아니나 향후 혼동 가능 | C1 `Frame = { workflowId, invokerNodeId, recursionDepth }` | (현재 충돌 없음) | spec 에서 `ResumeCallStackFrame` 또는 `CallStackFrame` 으로 명명 권장 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I1 | Cross-Spec | `durable park 스냅샷` 분류 용어 — `conversation_thread`·`user_variables` 에 해당 분류 태그 없음 | `spec/1-data-model.md §2.13` | 추가 시 기존 컬럼에도 분류 표기 통일하거나 draft 에서 분류 용어 삭제 |
| I2 | Cross-Spec | migrations.md 절차 — V087 미확정 상태로 "가칭" 표기 잔존 | C1 V번호 기재 | `ls migrations/V08*` 실행 후 확정 번호 기재 |
| I3 | Rationale | C4 B3 제거 후 Rationale L1257 "단계적 롤아웃(B1→B2)" note 갱신 방식(덧붙임 vs 대체) 불명확 | C5 §Rationale 갱신 | spec 적용 시 note 를 인라인 대체할지 추가할지 명시 |
| I4 | Rationale | D6 의 per-node task queue 기각(L1303)과의 범주 구분이 draft §Rationale 에만 있고 spec §Rationale 에 아직 없음 | C3 중첩 call stack durable | spec 적용 시 §Rationale 에 구분 설명 그대로 이전 |
| I5 | Rationale | V087 renumber — Flyway forward-only 정책 내 처리, 기각 결정 번복 없음. 확정 번호 기재만 필요 | C1 V번호 | spec 최종 적용 전 확정 번호 기재 |
| I6 | Rationale | §3.2 컨테이너 body blocking 금지 제약 유지 선언 — 충돌 없음 | C3 제약 유지 | 조치 불필요 |
| I7 | Convention | spec draft 자체 plan frontmatter 부재 — 부모 plan이 umbrella 역할. 가드 대상 여부 불명확 | `plan/in-progress/spec-draft-exec-park-b2-durable.md` | subfolder 이동 또는 frontmatter 추가 |
| I8 | Plan-Coherence | `13-replay-rerun.md §14.3` D3 노트의 PR-B2 완료 후 처리 방향 미명시 | C5 "직교 확인" 기재만 | spec draft 적용 시 §14.3 처리 방향 명시적 확인 |
| I9 | Plan-Coherence | stale worktree 2건 (`exec-park-b1`, `impl-exec-concurrency-cap`) 잔존 | 워크트리 현황 | `./cleanup-worktree-all.sh --yes --force` 실행 권장 |
| I10 | Naming-Collision | `invokerNodeId` 와 기존 필드(`Node.id`)의 의미상 대응 관계 미기술 | `Frame.invokerNodeId` | spec C1 에 "= 해당 sub-workflow 를 호출한 Workflow 노드의 `Node.id`" 주석 추가 |
| I11 | Naming-Collision | `D4`·`D6` plan 레이블 — integration spec 의 `D4`(오류 라우팅)과 동명 혼동 가능. plan 스코프 내에서만 유효 | plan 레이블 | spec 본문 노출 최소화 (현 draft §Rationale 수준은 허용 범위) |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | MEDIUM | CRITICAL 1건(V086 충돌) + WARNING 3건(§2.13/§6.2 미동기화, 기각 결정 긴장, §7.5 미기술 + C5 적용 순서) + INFO 2건 |
| Rationale-Continuity | LOW | INFO 4건 — spec 적용 시 챙길 Rationale 텍스트 갱신 방향. 기각 결정 재도입 없음 |
| Convention-Compliance | LOW | WARNING 1건(V086 가칭 표기) + INFO 3건. 주요 규약 위반 없음 |
| Plan-Coherence | LOW | WARNING 1건(impl-concurrency-cap-pr2b 덮어쓰기 위험) + INFO 3건 |
| Naming-Collision | HIGH | CRITICAL 1건(V086 중복) + WARNING 2건(schemaVersion 중의성, Frame 범용 타입명) + INFO 3건 |

---

## 권장 조치사항

1. **(BLOCK 해소 — 필수)** spec draft C1 의 `V086__execution_resume_call_stack.sql` 가칭 → `V087__execution_resume_call_stack.sql` 확정(`ls migrations/V08*` 재확인 완료: next=V087). "가칭"/"renumber 필수" 주석 제거. `spec/1-data-model.md §2.13` 병기 번호도 V087 확정.
2. **(W1)** §6.2 commit 목록 + §2.13 컬럼 표에 `resume_call_stack` 동시 추가.
3. **(W2)** §Rationale 에 "call stack 영속(D6) ≠ `_continuationCheckpoint` 기각(L1174)" 범주 구분 주석.
4. **(W3)** C5 spec 갱신은 PR-B2 코드 머지 후 적용 전제 명시.
5. **(W4)** §7.5 에 중첩 call stack 재진입 절차 추가.
6. **(W5)** `impl-concurrency-cap-pr2b` origin/main rebase 선행 명기 확인.
7. **(W6)** `resume_call_stack` 버전 = 별도 상수 `CALL_STACK_SCHEMA_VERSION`(또는 필드명 `version`).
8. **(W7)** `Frame` → `ResumeCallStackFrame`.
9. **(I 군)** Rationale 갱신 방향 명시(I3/I4), §14.3 처리(I8), stale worktree 정리(I9), `invokerNodeId` 주석(I10).
