# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 구현 착수 가능.

## 전체 위험도
**LOW** — 5개 checker 모두 LOW. Critical 위배 없음. WARNING 4건(plan-spec 표기 불일치, worktree 동시 편집 위험, D6 레이블 이중 의미, frontmatter 빌드 가드 확인 필요)은 즉각 차단 사유 아님.

## Critical 위배 (BLOCK 사유)

_없음_

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | spec §4.x 의 PR-B2a "완료" 서술 vs plan 의 "머지 전" 상태 불일치 | `spec/5-system/4-execution-engine.md` §4.x (line 406, 408) | `plan/in-progress/exec-park-durable-resume.md` line 151 — branch `claude/exec-park-pr-b2`, 테스트·e2e 잔여 | (a) PR-B2a 실제 머지 시 자동 해소. (b) 머지 전이면 spec §4.x 의 "완료" 문구를 "진행(branch, 테스트·e2e 잔여)"으로 한시 수정 |
| 2 | Plan-Coherence | `impl-exec-concurrency-cap` worktree(PR2b)가 PR-B2 이전 서술을 보유한 채 rebase 미완료 상태 — spec 동시 편집 시 PR-B2a 완료형 서술 덮어쓸 위험 | `spec/5-system/4-execution-engine.md` §8, §4, §Rationale | `plan/in-progress/exec-intake-queue-impl.md` PR2b (`worktree: impl-exec-concurrency-cap`, branch `claude/impl-concurrency-cap-pr2b`) | PR2b 착수 첫 작업으로 `origin/main` rebase + spec 충돌 수동 해소 필수 |
| 3 | Naming-Collision | 내부 레이블 `D6` 이중 의미 — exec-park plan 결정(중첩 sub-workflow durable화)과 AI 노드 output 경로 단일화 결정이 동일 레이블 충돌 | `spec/5-system/4-execution-engine.md` §7.5, §6.2, §Rationale | `spec/4-nodes/3-ai/1-ai-agent.md:751`, `3-information-extractor.md:334,370,386,430`, `2-text-classifier.md:340,350` | AI 노드 측 단독 `D6` 언급에 `AI-D6` 등 명확한 prefix 추가(최소 변경). 또는 exec-park 결정 레이블 전체를 `EP-D*` namespace 로 격리 |
| 4 | Convention-Compliance | `status: partial` 유지 적정성 — PR-B2a 완료 후 `pending_plans` 경로 실존·lifecycle 가드 통과 확인 필요 | `spec/5-system/4-execution-engine.md` frontmatter | `spec/conventions/spec-impl-evidence.md §3` `spec-status-lifecycle.test.ts` / `spec-pending-plan-existence.test.ts` | 브랜치 완료 전 빌드 가드 로컬 실행 확인. 완료된 plan 이 있으면 `plan/complete/` 이동 후 frontmatter 경로 동기 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | §7.4 fast-path 제거 표현이 과거완료형 — §4.x 과도기 설명과 표현 강도 차이 | `spec/5-system/4-execution-engine.md` §7.4 (line 829) | "top-level — PR-B1/B2a 범위; 중첩 executeInline fast-path 는 PR-B2b 에서 완전 제거 예정" 한정 문구 보강 |
| 2 | Cross-Spec | 데이터 모델 Execution 컬럼(V084/V085/V087)과 spec §6.2 저장 전략 일치 확인 완료 | `spec/1-data-model.md §2.13` | 추가 조치 불필요 |
| 3 | Rationale | §9.2 heartbeat Redis 키가 stalled-job 일원화 결정 후에도 잔존 | `spec/5-system/4-execution-engine.md` §9.2 | 해당 행에 "stalled-job 일원화로 폐기 예정" 비고 추가, 또는 실구현 없으면 삭제 |
| 4 | Rationale | `_continuationCheckpoint` 기각 이유가 §6.2 와 §Rationale 양쪽에 분산 — 내용 충돌 없음 | `spec/5-system/4-execution-engine.md` §6.2, §Rationale | §6.2 비고에 "per-node 분산과 무관 — §Rationale exec-park D6 참조" 선택적 보강 |
| 5 | Rationale | §9.2 전역 키 예외가 §9.1 패턴 이탈임을 본문 비고에만 설명, §Rationale 미기재 | `spec/5-system/4-execution-engine.md` §9.2 | §Rationale 에 "Redis 전역 키 예외" 항 추가 선택적 고려 |
| 6 | Convention | §3.3 Background 절이 §3.4 뒤에 물리적으로 위치 — 번호·순서 역전 | `spec/5-system/4-execution-engine.md` §3.3 (line 326 근처) | §3.3 을 §3.2 와 §3.4 사이로 이동, 또는 번호 재정렬 |
| 7 | Convention | §10.3·§10.4 가 `## 11. Graceful Shutdown` 뒤에 배치되어 섹션 귀속 모호 | `spec/5-system/4-execution-engine.md` §10.3, §10.4 (line 1132 근처) | §10.3·§10.4 를 §10.2 바로 다음(## 11 이전)으로 이동 |
| 8 | Convention | `INVALID_EXECUTION_STATE` 에러 코드가 도메인 prefix 권장 패턴과 거리 — 이미 클라이언트 계약 코드 | `spec/5-system/4-execution-engine.md` §7.4, §7.5.1 | rename 금지. `error-codes.md §3` Historical-artifact 레지스트리에 등재해 "WS layer 한정, 의도적 명명" 명시 |
| 9 | Plan-Coherence | PR #494 머지로 `exec-park-pr-b2` worktree 가 STALE — 정리 미완료 | `.claude/worktrees/exec-park-durable-resume` | `./cleanup-worktree-all.sh --yes --force` 실행 권장 |
| 10 | Plan-Coherence | `spec-update-pr2a-*` 2개 plan 이 반영 완료 후에도 `plan/in-progress/` 잔존 | `plan/in-progress/spec-update-pr2a-active-running-invariants.md`, `plan/in-progress/spec-update-pr2a-timeout.md` | plan-lifecycle 규약에 따라 `plan/complete/` 로 이동 |
| 11 | Naming-Collision | `CHECKPOINT_SCHEMA_VERSION` 과 `CALL_STACK_SCHEMA_VERSION` 상수 — spec 내 유일 정의, 충돌 없음 | `spec/5-system/4-execution-engine.md` §1.3, §7.5 | 구현 시 `RESUME_CHECKPOINT_SCHEMA_VERSION` / `RESUME_CALL_STACK_SCHEMA_VERSION` 공통 prefix 고려 |
| 12 | Naming-Collision | `D4`/`D3` 레이블이 현재 cross-file 충돌 없으나 AI 노드 spec 향후 독립 정의 시 재충돌 위험 | `spec/5-system/4-execution-engine.md` §4.x, §Rationale | exec-park 결정 레이블 전체(`D1~D6`)에 `EP-` 접두사 부여해 namespace 격리 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | spec §4.x "PR-B2a 완료" 표기 vs plan "머지 전" 불일치(WARNING). §7.4 fast-path 표현 강도 차이(INFO) |
| Rationale-Continuity | LOW | §9.2 heartbeat 키 stalled-job 결정 후 잔존(INFO). 나머지 기각 이력·합의 원칙 모두 일관 |
| Convention-Compliance | LOW | `status: partial` + `pending_plans` 빌드 가드 확인 필요(WARNING). 절 번호 역전 2곳(INFO) |
| Plan-Coherence | LOW | `impl-concurrency-cap-pr2b` worktree rebase 미완 상태 spec 동시 편집 위험(WARNING). STALE worktree 정리 권장(INFO) |
| Naming-Collision | LOW | `D6` 레이블 이중 의미(WARNING). 나머지 식별자·에러코드·env var 모두 충돌 없음 |

## 권장 조치사항

1. **(WARNING 1 해소)** PR-B2a 머지 완료(`8538ed8a`)로 자동 해소. PR-B2b spec flip 에서 완료형 전환.
2. **(WARNING 2 해소)** PR2b 착수 시 `impl-concurrency-cap-pr2b` worktree 에서 `origin/main` rebase 강제 — 타 worktree 책임(본 PR 범위 외, plan W4 기록).
3. **(WARNING 3 해소)** spec flip 시 project-planner 가 D6 레이블 namespace 검토.
4. **(WARNING 4 해소)** spec flip 후 `spec-pending-plan-existence.test.ts` + `spec-status-lifecycle.test.ts` 빌드 가드 통과 확인.
