# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 불필요.

## 전체 위험도
**MEDIUM** — Cross-Spec 및 Rationale Continuity 양쪽에서 동일 파일 내 섹션 간 불일치(§9.2 ↔ §9.3 jobId 기술 모순, Rationale "두 개뿐" 선언 무효화, dead-link cross-reference)가 겹쳐 확인됨. Convention Compliance·Plan Coherence 는 LOW, Naming Collision 은 NONE.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | `data-flow/3-execution.md §1.1` 시퀀스 다이어그램이 old in-process 흐름을 기술해 §4 배너 "PR1 구현 완료"와 모순 | §4 배너 변경 (SUMMARY#5) | `spec/data-flow/3-execution.md §1.1` | §1.1 다이어그램에 `execution-run` 큐 enqueue + `ExecutionRunProcessor` 소비 단계 추가 — 본 draft 범위 외이면 후속 plan 등록 |
| 2 | Cross-Spec | `data-flow/3-execution.md §2.2` BullMQ 표에 `execution-run` 큐 행 없어 §9.3 변경과 불일치 | §9.3 표 변경 (SUMMARY#3) | `spec/data-flow/3-execution.md §2.2` | §2.2 에 `execution-run` 행 추가 (producer/consumer/payload) — 후속 plan 등록 권장 |
| 3 | Cross-Spec | §9.2 `exec:run:seq:<executionId>` 키 행이 "seq 로 jobId 구성" 암시 ↔ §9.3 draft "PR1 은 seq 없이 executionId 직접" 기술과 동일 파일 내 자기-충돌 | §9.3 표 변경 (SUMMARY#3) | `spec/5-system/4-execution-engine.md §9.2` line 988 | 동일 PR 범위에서 §9.2 해당 행에 "(PR3/PR4 seq 추가 시 활성화 — PR1 미사용, jobId=executionId 직접 사용)" 명기 |
| 4 | Cross-Spec | §11 Graceful Shutdown item 2 의 큐 목록에 `execution-run` worker 언급 없어 PR1 이후 오해 유발 | §11 ENV 표 변경 (SUMMARY#4) | `spec/5-system/4-execution-engine.md §11` item 2 | 큐 목록을 `execution-run` / `execution-continuation` / `background-execution` 으로 확장하고 "일반 노드 실행은 큐 미경유" 괄호 제거 또는 §9.3 과 일치하도록 수정 |
| 5 | Rationale Continuity | Rationale "Phase 2 cont 후속 정리 §1" 의 "두 개뿐" 선언이 갱신 없이 무효화됨 — `execution-run` 추가로 세 번째 큐가 생기나 Rationale 불갱신 | §9.3 `execution-run` 행 추가 | `spec/5-system/4-execution-engine.md` Rationale line 1199–1201 | "두 개뿐" → "세 개" 로 갱신, `execution-run` 도입 경위(PR1 intake 큐) 한 줄 보충 |
| 6 | Rationale Continuity | `spec/0-overview.md` Rationale §2.4 cross-link "per-node → execution-level intake 큐" 절이 실행엔진 spec 에 존재하지 않아 dead-link 상태 | 전반 | `spec/5-system/4-execution-engine.md ## Rationale` (해당 절 미존재) | `## Rationale` 에 "per-node → execution-level intake 큐" 절 신설(배경·채택·기각 대안 기록) |
| 7 | Convention Compliance | 적용 절차 step 2 의 `/consistency-check --spec` 실행 주체 불명확 — `spec/` 쓰기 권한 규약(`project-planner` 전담) 과 혼동 여지 | `## 적용 절차` step 2 | CLAUDE.md §Skill 체계 | step 2 를 "project-planner 가 실행 → BLOCK:NO 확인" 으로 주체 명기 |
| 8 | Convention Compliance | step 4 "`resolution-applier` 재호출" 표현이 허용 LLM 호출 경로(Agent tool / Workflow tool)를 명기하지 않음 | `## 적용 절차` step 4 | `.claude/docs/subagent-call-contract.md`; CLAUDE.md §외부 LLM 호출 정책 | "orchestrator(main Claude)가 `Agent` tool 로 `resolution-applier` sub-agent 재호출" 형태로 명기 |
| 9 | Plan Coherence | target 적용 후 `spec-sync-execution-engine-gaps.md` §4 추적 항목이 stale — per-node 모델 기술이 outdated 이며 PR1 구현 완료 부분이 반영 안 됨 | §4 배너 변경 (SUMMARY#5) | `plan/in-progress/spec-sync-execution-engine-gaps.md` §4 항목 | spec 반영 동시에 §4 항목을 `[x]` 마킹 + 해소 기록하거나 per-node 항목 제거 후 §4.1–4.3 완료 표기 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `spec/0-overview.md` §2.4·§2.6·Rationale 는 worktree 내에서 이미 갱신 완료 — 불일치 없음 | `spec/0-overview.md` | 현 상태 유지 |
| 2 | Cross-Spec | `spec/5-system/_product-overview.md` 실행엔진 상태 요약 동기화 권장 (미확인) | `spec/5-system/_product-overview.md` | draft 적용 후 §4 배너와 일치 여부 검토 |
| 3 | Rationale Continuity | `maxStalledCount:0` 선택 이유(`attempts:1` / stalled 재배달 비활성 / `removeOnFail:false`)가 spec Rationale 에 미기록 | §9.3 `execution-run` 행 비고 | `## Rationale` 에 "`execution-run` 큐 초기 옵션 선택" 절 짧게 추가 권장 |
| 4 | Rationale Continuity | `EXECUTION_RUN_WORKER_CONCURRENCY` 추가가 §11 Graceful Shutdown item 2 갱신과 짝을 이루어야 함 (WARNING #4 파생 이슈) | §11 ENV 표 | draft 의 "범위 외" 섹션에 §11 item 2 갱신 포함 여부를 명시 |
| 5 | Convention Compliance | `SPEC-DRIFT` 레이블은 plan 내부 서술 자유 레이블로 규약 위반 아님 — 단 spec frontmatter status 와 혼동 방지 권고 | `## 분류` 첫 줄 | "변경 성격: spec-drift" 표현으로 명확화 고려 (필수 아님) |
| 6 | Convention Compliance | plan `## Rationale` 갱신 여부 미언급 — 변경 시 해당 spec Rationale 갱신 대상 포함 권장 | `## 제안 변경` 전체 | 적용 절차 step 3 에 "§ Rationale 갱신 필요 여부 확인" 단계 추가 또는 `## 범위 외` 에 비변경 사유 명시 |
| 7 | Plan Coherence | §9.3 `exec:run:seq` Redis key "(target — §4)" 마커가 의도적 범위 외 처리 — PR3 seq 추가 시 갱신 예정으로 정확 | `## 범위 외` | 현 상태 유지 |
| 8 | Plan Coherence | `kb-quality-fba2f2` 브랜치(PR #457 OPEN)가 동일 파일 다른 라인 편집 중 — 논리 충돌 없으나 merge 시 git 위치 충돌 가능 | `spec/5-system/4-execution-engine.md` | PR #457 과 merge 순서 조율 — 먼저 merge 된 쪽 기준으로 나중 PR 이 rebase |
| 9 | Plan Coherence | stale worktree 5건 잔존 (`spec-exec-intake-queue`, `fix-spec-frontmatter-catalog`, `spec-inprogress-impl2`, `spec-sync-audit`, `fix-bg-context-followups`) | `.claude/worktrees/` | `./cleanup-worktree-all.sh --yes --force` 실행 권장 |
| 10 | Naming Collision | `ExecutionRunTriggerType` — spec 미문서화 신규 타입, 기존 `Trigger.type` 어휘 값 집합과 겹치나 의도적 분리 선언으로 충돌 없음 | §9.3 비고 인용 | §9.3 비고에 `Trigger.type` 과의 관계 한 줄 주석 추가 권장 |
| 11 | Naming Collision | plan "Before" 서술과 실제 spec 불일치 — §9.3 `execution-run` 행 미존재, §11 `EXECUTION_RUN_WORKER_CONCURRENCY` 행 미존재 (신규 삽입으로 처리해야 함) | plan `## 제안 변경` Before 블록 | 적용 시 편집 위치를 "기존 행 수정" 이 아닌 "신규 행 삽입" 으로 처리 확인 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | MEDIUM | `data-flow/3-execution.md` §1.1·§2.2 미갱신으로 §4 배너와 모순; 동일 파일 §9.2 ↔ §9.3 jobId 기술 내부 충돌 |
| Rationale Continuity | MEDIUM | Rationale "두 개뿐" 선언 무효화 및 `spec/0-overview.md` §2.4 dead-link cross-reference |
| Convention Compliance | LOW | 적용 절차 step 2 주체 불명, step 4 호출 경로 미명기 (WARNING 2건) |
| Plan Coherence | LOW | `spec-sync-execution-engine-gaps.md` §4 항목 stale 예정 (WARNING 1건); merge-time 위치 충돌 가능성 |
| Naming Collision | NONE | 신규 식별자 모두 충돌 없음, 네이밍 패턴 일관성 유지 |

## 권장 조치사항

1. **(동일 PR 범위 필수)** `spec/5-system/4-execution-engine.md` §9.2 `exec:run:seq:<executionId>` 행에 "PR1 미사용, jobId=executionId 직접 사용 — PR3/PR4 seq 추가 시 활성화" 명기하여 §9.3 draft 와의 내부 모순 해소 (WARNING #3).
2. **(동일 PR 범위 강력 권장)** 실행엔진 spec `## Rationale` 에 다음 세 항목 추가: (a) "두 개뿐" → "세 개" 갱신 + `execution-run` 도입 경위 (WARNING #5), (b) "per-node → execution-level intake 큐" 절 신설하여 `spec/0-overview.md` §2.4 dead-link 해소 (WARNING #6), (c) `execution-run` 큐 초기 옵션 선택 근거 (`maxStalledCount:0` 등) (INFO #3).
3. **(동일 PR 범위 권장)** §11 Graceful Shutdown item 2 큐 목록에 `execution-run` worker 추가 및 "일반 노드 실행은 큐 미경유" 괄호 수정 (WARNING #4).
4. **(draft 수정)** 적용 절차 step 2 에 `project-planner` 를 실행 주체로 명기, step 4 에 `Agent` tool 경로 명기 (WARNING #7, #8).
5. **(spec 반영 직후)** `spec-sync-execution-engine-gaps.md` §4 추적 항목을 `[x]` 또는 수정 완료 기록으로 갱신 (WARNING #9).
6. **(후속 plan)** `spec/data-flow/3-execution.md` §1.1 시퀀스 다이어그램 및 §2.2 BullMQ 표에 `execution-run` 큐 반영 (WARNING #1, #2).
7. **(선택)** stale worktree 5건 정리 및 PR #457 (`kb-quality-fba2f2`) merge 순서 조율.