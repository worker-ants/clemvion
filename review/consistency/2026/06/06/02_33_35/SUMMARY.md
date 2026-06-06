# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다.

검토 대상: `plan/in-progress/spec-draft-exec-park-b2-durable.md`
검토 일시: 2026-06-06
검토 모드: spec draft (--spec)

---

## 전체 위험도
**HIGH** — Critical 2건(plan frontmatter 누락 + 병렬 worktree spec 덮어쓰기 위험), Warning 5건 존재

---

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| C1 | Convention Compliance | `plan/in-progress/*.md` 필수 frontmatter(`worktree`/`started`/`owner`) 완전 누락 — `plan-frontmatter.test.ts` build guard 위반으로 CI red 유발 | 파일 최상단 (H1 제목으로 시작) | `.claude/docs/plan-lifecycle.md §4` + `spec/conventions/spec-impl-evidence.md §4.2` | 파일 최상단에 `--- worktree: exec-park-durable-resume / started: 2026-06-06 / owner: planner ---` frontmatter 추가 |
| C2 | Plan Coherence | active worktree `impl-exec-concurrency-cap`(branch `claude/impl-concurrency-cap-pr2b`)가 동일 `spec/5-system/4-execution-engine.md`를 PR-B1/B2 이전 모델(`pendingContinuations`, `firstSegmentBarriers`, fast-path 이원화 등)로 수정 중 — PR-B2 머지 후 rebase 없이 push 시 spec 완료형 서술이 덮어써짐. 착수조건이 `exec-intake-queue-impl.md` PR2b 항목에 실제 기술 누락 | C5/W5 — 착수조건 인식 있으나 exec-intake-queue-impl.md PR2b 항에 미기재 | `plan/in-progress/exec-intake-queue-impl.md` PR2b 착수조건 섹션 (빈 상태) | (1) `exec-intake-queue-impl.md` PR2b 항목에 "PR-B2 머지 후 `origin/main` rebase 선행 필수" 명시 추가; (2) PR-B2 랜딩 후 즉시 해당 worktree rebase 수행 |

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W1 | Cross-Spec | `spec/5-system/4-execution-engine.md §6.2` 저장 전략 표의 `waiting_for_input 진입 시` 행에 `resume_call_stack` commit 항목 누락 — 과도기 역전 가능 | C3/C5 체크리스트 (W1 인식 있음) | `spec/5-system/4-execution-engine.md §6.2` 저장 전략 표 | PR-B2 spec 적용 PR에서 §6.2 표 해당 행에 `Execution.resume_call_stack` 추가; 중첩 park 시에만 비NULL 조건도 병기 |
| W2 | Cross-Spec | sync `executeInline`의 park-return 계약 변경(PARK_RELEASED sentinel 버블업)이 `spec/4-nodes/2-flow/1-workflow.md §4`에 미반영 — 계층 책임 서술 불완전 | C3 — executeInline 내 blocking → park | `spec/4-nodes/2-flow/1-workflow.md §4` sync 모드 정의 + `spec/5-system/4-execution-engine.md §4.2` | spec 적용 시 §4 실행 로직에 "sync 모드에서 sub-workflow 내부 blocking 노드 park 시 executeInline도 PARK_RELEASED 반환 → 상위 세그먼트 park 종료" 명시 추가 |
| W3 | Convention Compliance | 마이그레이션 번호 `V087`를 확정형으로 기재 — PR race 시 번호 오류 위험(`migrations.md §5` 정신 위반) | C1 — "V087 확정" | `spec/conventions/migrations.md §5` fetch+rebase 후 확인 의무 | "현재 시점 V087 예정(PR 착수 직전 `ls migrations \| tail -2` 재확인 필수, §5)" 조건부 표현으로 수정 |
| W4 | Convention Compliance | `plan/in-progress/` 내 spec draft 보관 패턴이 규약에 명시적 허용/금지 미기재 — 모호성 존재 | 파일 경로 `plan/in-progress/spec-draft-exec-park-b2-durable.md` | `CLAUDE.md §정보 저장 위치` | `plan-lifecycle.md` 또는 project-planner SKILL.md에 "spec draft 임시 보관 허용" 패턴 명시 검토 |
| W5 | Plan Coherence | `impl-concurrency-cap-pr2b` 브랜치가 `spec/1-data-model.md`도 수정 중(V084/V085 컬럼 포함) — PR-B2의 `resume_call_stack` 컬럼 추가와 merge 순서에 따라 충돌 가능 | C1 — 1-data-model.md §2.13 컬럼 추가 | `plan/in-progress/exec-intake-queue-impl.md` PR2b + `spec/1-data-model.md` | C2 Critical 착수조건 명기에 `1-data-model.md`도 명시적으로 언급 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I1 | Cross-Spec | `resume_call_stack` 컬럼이 `spec/1-data-model.md §2.13` 표에 미기재 — spec 적용 시 의도된 미기재(W1 인식) | C1 | PR-B2 머지 시 §2.13에 `resume_call_stack jsonb NULL` 행 + V087 병기 추가 |
| I2 | Cross-Spec | `frame.workflowId` vs `context.variables.__workflowId` 레이어 구분 미명시 | C1 ResumeCallStackFrame 정의 | spec §6.2 또는 Rationale에 "frame.workflowId = 호출된 sub-workflow 정의 ID, context.variables.__workflowId와 레이어 다름" 주석 1줄 추가 |
| I3 | Cross-Spec | §7.5 rehydration 흐름에 중첩 call-stack 재진입 절차 미포함 — target W4에서 동기화 요건 인식 | C3/C5 | spec 적용 시 §7.5에 "resume_call_stack IS NOT NULL: outermost→inner 순회, 각 프레임 executeInline 재호출, 최내층 WAITING NodeExecution에 payload 전달" 절차 추가 |
| I4 | Cross-Spec | §7.4 `pendingContinuations` 과도기 서술(L829) 제거 — target C5에서 인식 | C5 | PR-B2 spec 적용 시 §7.4의 `pendingContinuations` 관련 과도기 서술을 완료형으로 대체 |
| I5 | Cross-Spec | V087 마이그레이션 번호 근거 — 파일시스템 확인 결과 V086이 실제 최고, V087 정합 확인 | C1 | 모순 없음 확인 |
| I6 | Cross-Spec | `CHECKPOINT_SCHEMA_VERSION` vs `CALL_STACK_SCHEMA_VERSION` 독립성이 §1.3에 미기재 | C1 | spec 적용 시 §1.3에 "resume_call_stack 버전 상수는 CALL_STACK_SCHEMA_VERSION 독립 상수" 주석 추가 |
| I7 | Cross-Spec | `_continuationCheckpoint` 기각(L1174)과 `resume_call_stack` 구분 주석이 기존 spec에 미기재 | Rationale D6/W2 구분 주석 | spec 적용 시 §Rationale L1174 항 바로 다음에 W2 구분 주석 삽입 |
| I8 | Cross-Spec | 컨테이너 body blocking 금지(§3.2) 유지 선언 — 기존 spec과 모순 없음 확인 | C3 | 확인 완료, 추가 조치 불요 |
| I9 | Rationale Continuity | `_continuationCheckpoint` 기각(L1174) 범주 구분 — target Rationale D6에 명시 완료, 번복 아님 | C1/Rationale | spec 적용 시 §Rationale에 실제 삽입 누락 방지 주의 |
| I10 | Rationale Continuity | per-node task queue 기각(L1303)과 D6 중첩 durable 범주 구분 — target Rationale에 명시 완료 | C3/Rationale | spec 적용 시 §Rationale의 L1303 항 하위에 cross-reference 추가 권장 |
| I11 | Rationale Continuity | L1257 "단계적 롤아웃" note를 "완료형"으로 대체 시 역사적 맥락(B1·B2 분리 불가 원칙 사유) 소실 위험 | C5 | "인라인 대체" 대신 기존 항 말미에 "(완료 — B1·B2 모두 머지됨, 2026-06-xx)" append 방식으로 역사 보존 |
| I12 | Convention Compliance | `spec/5-system/4-execution-engine.md` frontmatter `code:` glob이 `V087__*.sql`을 커버하는지 확인 필요 | C1 | PR 착수 시 glob 점검, 미커버 시 갱신 |
| I13 | Convention Compliance | draft 내 적용 체크리스트에 "§Rationale D6 항목 삽입 확인" 항목 누락 | 적용 체크리스트 C1~C5 | C5에 "§Rationale D6 항목 삽입 확인" 체크항목 추가 |
| I14 | Naming Collision | `CALL_STACK_SCHEMA_VERSION` vs `CHECKPOINT_SCHEMA_VERSION` — 역할 구분 명확, 충돌 없음 | C1 | 동일 파일 인접 위치에 선언해 "checkpoint 스키마 관련 상수 한곳에" 원칙 유지 |
| I15 | Naming Collision | `ResumeCallStackFrame.recursionDepth` vs `Execution.recursionDepth`·`ExecutionContext.recursionDepth` — 동음이의, 타입 충돌 없으나 혼동 가능 | C1 ResumeCallStackFrame 정의 | `frameDepth` 또는 `subworkflowDepth`로 변경 검토, 또는 §6.2/§7.5에 의미 차이 명시 |
| I16 | Naming Collision | `resume_call_stack` JSONB 내 `version` vs `_resumeCheckpoint` 내 `schemaVersion` — 이름 다름, 충돌 없음 | C1 JSONB 스키마 | spec §Rationale에 네이밍 불일치를 의도적 설계 결정으로 1행 명시 권장 |
| I17 | Naming Collision | C4 제거 대상 식별자들(`pendingContinuations`, `firstSegmentBarriers` 등) — 제거 후 dangling reference 정리 필요 | C4 제거 목록 | 제거 전 참조 테스트·주석·JSDoc 함께 정리 |
| I18 | Plan Coherence | C5 spec 적용 전제(W3) — exec-park-pr-b2에 현재 spec-only 커밋 없음, 계획 인식 양호 | C5/W3 | 추가 조치 불요 |
| I19 | Plan Coherence | V087 마이그레이션 번호 — impl-concurrency-cap-pr2b에 V087+ 없어 현재 유효, PR2b 착수 시 재검증 필요 | C1 | PR2b 착수 시 번호 재검증 명기 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | Critical 없음. Warning 2건(§6.2 commit 항목 누락, executeInline park-return 계약 미반영). Info 7건 — 모두 spec 적용 시 처리 대상으로 target 내 인식 완료 |
| Rationale Continuity | LOW | Critical/Warning 없음. Info 4건 — 기존 결정과 전면 정합, 역사 맥락 보존 주의사항만 존재 |
| Convention Compliance | CRITICAL | Critical 1건(plan frontmatter 완전 누락). Warning 2건(마이그레이션 번호 확정형 표기, spec draft 보관 경로 모호성) |
| Plan Coherence | HIGH | Critical 1건(impl-concurrency-cap-pr2b spec 덮어쓰기 위험 + exec-intake-queue-impl.md 착수조건 누락). Warning 2건(1-data-model.md 충돌 가능, V087 번호 경합 가능성) |
| Naming Collision | NONE | Critical/Warning 없음. Info 6건 — 신규 식별자 모두 기존과 충돌 없음. recursionDepth 동음이의 주의사항만 존재 |

---

## 권장 조치사항

1. **(BLOCK 해소 — C1)** `plan/in-progress/spec-draft-exec-park-b2-durable.md` 최상단에 YAML frontmatter `worktree: exec-park-durable-resume / started: 2026-06-06 / owner: planner` 즉시 추가 — `plan-frontmatter.test.ts` CI 차단 해소 필수.

2. **(BLOCK 해소 — C2)** `plan/in-progress/exec-intake-queue-impl.md` PR2b 항목(`[ ] PR2b — 동시성 cap`)에 착수조건 "PR-B2(`exec-park-pr-b2`) 머지 후 `origin/main` rebase 선행 필수 — 이 브랜치는 PR-B1/B2 이전 execution-engine.md 서술 포함, PR-B2 없이 push 시 spec 덮어쓰기 발생" 명시. `spec/1-data-model.md`도 동일 조건 대상으로 명시.

3. **(W1/W2 — spec 적용 시 체크)** PR-B2 spec 적용 PR에서 §6.2 저장 전략 표 `waiting_for_input 진입 시` 행에 `Execution.resume_call_stack` 추가; `spec/4-nodes/2-flow/1-workflow.md §4`에 sync 모드 park-return 계약 변경 명시. 두 항목을 C5 체크리스트에 추가 관리.

4. **(W3)** 마이그레이션 번호 표기를 "V087 예정(PR 착수 직전 재확인 필수)" 조건부 표현으로 수정.

5. **(I11 — 역사 보존)** L1257 롤아웃 note 갱신 시 "인라인 대체"가 아닌 "(완료 — B1·B2 모두 머지됨)" append 방식 채택 권장.

6. **(I15 — 혼동 방지)** `ResumeCallStackFrame.recursionDepth` → `frameDepth` 또는 `subworkflowDepth` 변경 검토, 또는 §6.2/§7.5에 의미 차이 명시.