# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다

## 전체 위험도
**HIGH** — `impl-concurrency-cap-pr2b` 브랜치가 이미 완료 처리된 spec 변경(Phase B 모델, RerankConfig RBAC)을 덮어쓸 위험이 구체화됨. 나머지 checker(Cross-Spec / Rationale / Convention / Naming) 는 모두 INFO 또는 NONE 수준.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| C1 | Plan Coherence | `impl-concurrency-cap-pr2b` 브랜치가 `spec/5-system/4-execution-engine.md` 를 Phase B 이전 모델(`pendingContinuations` 재등록 현재형, `resume_call_stack`·`conversation_thread`·`user_variables` 누락, `firstSegmentBarriers` 현재 동작 서술)로 되돌리며 `exec-park-durable-resume` plan 을 `pending_plans` 에서 삭제 | `spec/5-system/4-execution-engine.md` §4.x / §6.2 / §7.4 / §1.1 전이표 | `plan/in-progress/exec-intake-queue-impl.md` (worktree `impl-exec-concurrency-cap`, branch `claude/impl-concurrency-cap-pr2b`) | `impl-concurrency-cap-pr2b` 브랜치가 spec push 전에 PR-B2(`exec-park-durable-resume`) 완료·머지까지 `4-execution-engine.md` 수정 동결, 또는 PR-B2 완료 후 origin/main 으로 rebase |
| C2 | Plan Coherence | `impl-concurrency-cap-pr2b` 브랜치가 `spec/5-system/1-auth.md §3.2` 의 `Rerank Config | CRUD | CRUD | R | R` 행과 §4.1 `rerank_config.*` 감사 로그 항목을 삭제 — `rag-rerank-followup.md` 가 완료([x]) 처리한 spec 변경을 회귀시킴 | `spec/5-system/1-auth.md` §3.2 RBAC 매트릭스, §4.1 감사 로그 | `plan/in-progress/rag-rerank-followup.md` (완료 체크박스) | `impl-concurrency-cap-pr2b` 의 `1-auth.md` diff 에서 Rerank Config 행 삭제를 revert 하거나 origin/main(행 추가된 상태) 으로 rebase |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W1 | Plan Coherence | `impl-concurrency-cap-pr2b` 브랜치가 `spec/5-system/1-auth.md §1.5.4` 의 `historical-artifact 예외` 주석 블록을 삭제 — `error-codes.md §3` 레지스트리와의 정합 근거 소실 | `spec/5-system/1-auth.md` §1.5.4 에러 응답표 하위 주석 | `spec/conventions/error-codes.md §3 Historical-artifact 예외 레지스트리` | PR2b 에서 auth spec 수정 의도가 없으면 해당 삭제를 revert 후 rebase |
| W2 | Plan Coherence | `spec/5-system/4-execution-engine.md` 의 D6(`resume_call_stack` V087) 관련 절이 "구현됨" 현재형으로 기술되어 있으나 구현은 PR-B2 에서 착수 전 (plan 체크박스 미완료) | `spec/5-system/4-execution-engine.md` §6.2 (e), §7.5, §Rationale D6 | `plan/in-progress/exec-park-durable-resume.md` PR-B2 체크박스 | spec D6 관련 절에 "PR-B2 에서 구현 예정 / 설계 확정·미구현" 표식 추가 권장 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I1 | Cross-Spec | `spec/data-flow/3-execution.md` Schema 매핑 표에서 `resume_call_stack` (V087) 컬럼 누락 | `spec/data-flow/3-execution.md` §1.3 Sequence Note, §2.1 Postgres Schema 매핑 | `execution` 행에 `resume_call_stack` commit 추가; SoT 는 `4-execution-engine.md §6.2` |
| I2 | Cross-Spec | `spec/data-flow/3-execution.md §2.1` Schema 매핑 `execution` 행에 `conversation_thread`, `user_variables` 컬럼 누락 (§1.3 Sequence 에는 언급됨) | `spec/data-flow/3-execution.md §2.1` | park 진입 전용 행 추가 또는 기존 행에 3개 컬럼 명시 |
| I3 | Cross-Spec | data-flow §1.3 `alt` 분기("멀티턴 AI fast-path") 에 PR-B2 완료 시 제거 예정 주석 없음 | `spec/data-flow/3-execution.md §1.3` line 111 부근 | "PR-B2 완료 시 이 alt 분기 제거 예정" 주석 추가 |
| I4 | Cross-Spec | data-flow 큐 카탈로그와 `16-system-status-api.md §1` QueueRegistry 두 목록의 동시 갱신을 보장하는 공식 절차 없음 | `spec/data-flow/0-overview.md §4`, `spec/5-system/16-system-status-api.md §1` 서두 | "두 목록을 반드시 동시 갱신" 규약 문구 추가 |
| I5 | Cross-Spec | `spec/1-data-model.md` → `4-execution-engine.md #8-동시-실행-제한` 앵커 링크가 섹션 rename 시 dead link 위험 | `spec/1-data-model.md` `active_running_ms` 행 | 섹션 변경 시 링크 동기화 규약 메모를 `4-execution-engine.md §8` 에 추가 |
| I6 | Cross-Spec | `4-execution-engine.md §1.1` `waiting_for_input → cancelled` 행에서 rehydration 실패 시 NodeExecution=`failed` / Execution=`cancelled` 구분이 불명확 | `spec/5-system/4-execution-engine.md §1.1` 전이표 | 해당 행 설명에 NodeExecution/Execution 상태 구분 명시 |
| I7 | Convention Compliance | `spec/5-system/11-mcp-client.md` 에 `## Overview (제품 정의)` 및 최상위 `## Rationale` 섹션 없음 (내용은 본문 산재) | `spec/5-system/11-mcp-client.md` | 문서 상단에 `## Overview`, 하단에 `## Rationale` 신설 |
| I8 | Convention Compliance | `spec/5-system/_product-overview.md` 상단 nav 목록에서 `17-agent-memory.md` 누락 (본문 링크는 존재, build guard 통과) | `spec/5-system/_product-overview.md` line 5 | nav 목록 끝에 `· [Agent Memory](./17-agent-memory.md)` 추가 |
| I9 | Convention Compliance | `spec/5-system/1-auth.md` 에 `## Overview (제품 정의)` 섹션 없음 (`## Rationale` 은 있음) | `spec/5-system/1-auth.md` | 제목 바로 아래 `## Overview (제품 정의)` 섹션 추가 |
| I10 | Plan Coherence | `rag-eval-harness-b8cc46` 브랜치도 `spec/5-system/9-rag-search.md` 를 동시 수정 중 — merge 순서에 따라 rebase 필요 | `spec/5-system/9-rag-search.md` | 나중에 머지되는 브랜치가 rebase 로 최신 main 반영 |
| I11 | Rationale Continuity | D6(중첩 call stack 영속화) 가 per-node task queue 기각 결정과 혼동될 소지 — cross-link 없음 | `spec/5-system/4-execution-engine.md` §4.2 / §7.5 | D6 관련 절에 "(per-node task queue 기각과 다른 범주 — §Rationale 참조)" 한 줄 주석 추가 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | `data-flow/3-execution.md` Schema 매핑 표에서 V087(`resume_call_stack`) 및 `conversation_thread`/`user_variables` 컬럼 누락 — 문서 동기화 갭 (INFO 6건) |
| Rationale Continuity | LOW | Phase B 단계 롤아웃·`_resumeCheckpoint` 번복·D6 모두 Rationale 연속성 유지. per-node 기각 혼동 소지 cross-link 누락 (INFO 1건) |
| Convention Compliance | NONE | frontmatter / 에러코드 명명 전반 준수. `11-mcp-client.md` Overview·Rationale 섹션 미작성, `_product-overview.md` nav 누락, `1-auth.md` Overview 누락 (INFO 3건) |
| Plan Coherence | HIGH | `impl-concurrency-cap-pr2b` 브랜치가 Phase B 모델 서술 회귀 + RerankConfig 행 삭제 + historical-artifact 주석 삭제 (CRITICAL 2건, WARNING 2건) |
| Naming Collision | NONE | DB 컬럼 3종, 에러 코드 3종, 내부 상수 2종, 내부 함수 4종 — 기존 식별자 충돌 0건. 마이그레이션 번호 순차 무결 |

## 권장 조치사항

1. **(BLOCK 해소 — C1)** `impl-concurrency-cap-pr2b` 브랜치의 `spec/5-system/4-execution-engine.md` 변경을 즉시 동결하고, PR-B2(`exec-park-durable-resume`) 완료·머지 후 origin/main 으로 rebase. 또는 PR2b 가 spec 을 수정하지 않도록 해당 spec 변경을 모두 제거.
2. **(BLOCK 해소 — C2)** `impl-concurrency-cap-pr2b` 브랜치의 `1-auth.md` diff 에서 `Rerank Config` RBAC 행 삭제 및 `rerank_config.*` 감사 로그 삭제를 revert. PR2b 의 실제 범위(concurrency cap)와 무관한 변경이므로 제거가 올바름.
3. **(WARNING — W1)** C2 처리 과정에서 `1-auth.md §1.5.4` historical-artifact 주석 블록도 함께 복원.
4. **(WARNING — W2)** `spec/5-system/4-execution-engine.md` D6 관련 절(§6.2 (e), §7.5)에 "설계 확정·PR-B2 에서 구현 예정" 표식 추가. 현재 완료형 서술이 미구현 상태를 오해하게 할 수 있음.
5. **(INFO — I1/I2)** `spec/data-flow/3-execution.md` §2.1 Schema 매핑 표를 `4-execution-engine.md §6.2` 와 동기화 (`resume_call_stack`, `conversation_thread`, `user_variables` 추가).
6. **(INFO — I3)** `spec/data-flow/3-execution.md §1.3` alt 분기에 PR-B2 완료 시 제거 예정 주석 추가.
7. **(INFO — I7/I8/I9)** `11-mcp-client.md` Overview·Rationale 신설, `_product-overview.md` nav 목록 `17-agent-memory.md` 추가, `1-auth.md` Overview 섹션 추가 — 우선순위 낮음, 다음 spec 편집 시 일괄 처리 가능.