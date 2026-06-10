# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다.

## 전체 위험도
**HIGH** — Cross-Spec CRITICAL 1건(Schedule↔Trigger 동기화 방향 계약 직접 모순) + WARNING 8건 + INFO 다수

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | `spec/2-navigation/3-schedule.md §3.1`이 역방향(Trigger→Schedule) 동기화를 "역방향도 동일"이라고 기술하나, 이번 브랜치에서 갱신된 `spec/1-data-model.md §2.9.1` 및 `spec/data-flow/10-triggers.md §1.4·§3.1`은 역방향이 **미구현(구현 갭)**임을 명시 — 두 spec 간 직접 모순 | `spec/2-navigation/3-schedule.md` §3.1 라이프사이클 표 (line 115, 120) | `spec/1-data-model.md §2.9.1`, `spec/data-flow/10-triggers.md §1.4·§3.1` | `3-schedule.md §3.1` 라이프사이클 표의 "역방향도 동일" 표현을 "역방향 Trigger→Schedule 동기화는 **미구현 — 구현 갭**, [data-flow §1.4](../data-flow/10-triggers.md#14-schedule--trigger-동기화) 참조"로 수정. §3.1 제약의 "역방향: Trigger 삭제 시 Schedule도 삭제" 항목에 BullMQ `removeJob` 미호출 누락 경고 추가 |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | `2-trigger-list.md §4.3`이 Trigger API 직접 삭제 경로를 "동일 결과"로 기술하나, `data-flow/10-triggers.md §1.4`는 BullMQ `removeJob` 미호출로 Redis job 잔존 구현 갭을 신규 명시 | `spec/2-navigation/2-trigger-list.md` §4.3 (line 210) | `spec/data-flow/10-triggers.md §1.4` | §4.3 "동일 결과" 문장을 "cascade 삭제 동작은 같으나, Trigger API 직접 삭제 경로는 BullMQ `removeJob` 미호출로 Redis job scheduler 엔트리 잔존 구현 갭" 으로 교체 |
| 2 | Cross-Spec | `2-trigger-list.md §4.3` 링크 텍스트 "양방향 동기화 정의"가 링크 목적지(`data-flow §1.4`)의 실제 내용("정방향만 구현, 역방향 갭")과 정반대 의미 전달 | `spec/2-navigation/2-trigger-list.md` §4.3 (line 210) | `spec/data-flow/10-triggers.md §1.4` | 링크 텍스트를 "Schedule↔Trigger 동기화 (구현 갭 포함)"으로 변경 |
| 3 | Convention Compliance | `14-execution-history.md` — `## Rationale` 섹션 누락 (3섹션 구성 불완전) | `spec/2-navigation/14-execution-history.md` 전체 | `CLAUDE.md §정보 저장 위치`, `project-planner/SKILL.md §Spec 문서 구조` | 파일 끝에 `## Rationale` 추가 (N+1 회피 결정, LLM Usage 탭 평탄화, PRD-like 구조 채택 근거 최소 포함) |
| 4 | Convention Compliance | `14-execution-history.md` — `## Overview (제품 정의)` + `## 1. 개요` 이중 섹션 구조, 헤딩 앵커 충돌 위험 | `spec/2-navigation/14-execution-history.md` line 17–91 | `project-planner/SKILL.md §Spec 문서 구조` | (A) 기술 명세 섹션 번호를 Overview 내 `### 3.` 이후로 이어받아 중복 제거, 또는 (B) `## Overview` 폐기 후 요구사항 ID 표를 `## 1. 개요` 하위로 흡수 |
| 5 | Convention Compliance | `3-schedule.md`, `7-statistics.md` — `## Rationale` 섹션 누락 | `spec/2-navigation/3-schedule.md`, `spec/2-navigation/7-statistics.md` 전체 | `CLAUDE.md §정보 저장 위치`, `project-planner/SKILL.md §Spec 문서 구조` | 각 파일 끝에 `## Rationale` 추가 (`3-schedule.md`: Schedule 타입 트리거 생성 경로 제한 이유 등; `7-statistics.md`: LLM Usage API 분리 이유 등) |
| 6 | Plan Coherence | `spec-sync-schedule-gaps.md` sort/order 항목(C-10)이 코드에서 이미 구현 완료됐으나 plan에서 `[ ]` 미완료 상태 — 이중 구현 시도 위험 | `plan/in-progress/spec-sync-schedule-gaps.md` line 17, `spec/2-navigation/3-schedule.md §4` | `spec-sync-structural-followups.md §C-10 "FIXED"`, `schedules.service.ts:37-52` | 해당 항목 `[x]` 체크. `3-schedule.md §4` 미구현 경고 문구도 완료 상태로 갱신 |
| 7 | Plan Coherence | `spec-sync-workflow-list-gaps.md` 상태 필터 불일치 항목(C-1)이 코드에서 이미 수정 완료됐으나 plan에서 `[ ]` 미완료 상태 | `plan/in-progress/spec-sync-workflow-list-gaps.md` line 20, `spec/2-navigation/1-workflow-list.md §2.3` | `spec-sync-structural-followups.md §C-1 "FIXED"`, `workflows/page.tsx:112-113` | 해당 항목 `[x]` 체크. `1-workflow-list.md §2.3` "클라이언트 수정이 필요하다" 서술도 완료 사실 반영 |
| 8 | Plan Coherence | `spec/2-navigation/5-knowledge-base.md` frontmatter `status: partial` + `pending_plans: kb-unsearchable-warning.md` — PR #511·#513 MERGED 이후 미갱신, 4개 active/stale 브랜치 동일 패치 중복 보유 | `spec/2-navigation/5-knowledge-base.md` frontmatter | PR #511, #513 MERGED 상태 | `main` frontmatter 확인 후 `status: implemented` 승격 + pending_plans 제거. 중복 패치 보유 브랜치는 rebase/revert |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `3-schedule.md` frontmatter `pending_plans`가 `plan/in-progress/spec-sync-schedule-gaps.md` 참조하나 역방향 동기화 갭 반영 여부 불명 | `spec/2-navigation/3-schedule.md` frontmatter | plan 파일 존재 확인 및 is_active + BullMQ removeJob 갭 명시 여부 검토 |
| 2 | Convention Compliance | `16-agent-memory.md` frontmatter `id: nav-agent-memory` — 같은 영역 타 파일과 달리 `nav-` prefix 추가 (권장 기반은 `agent-memory`) | `spec/2-navigation/16-agent-memory.md` frontmatter | `id: agent-memory`로 통일하거나 영역 prefix 정책을 규약 문서에 등재 |
| 3 | Plan Coherence | `2-trigger-list.md §3` trigger sort/order 미구현 경고 추가됐으나 추적 plan 항목 부재 | `spec/2-navigation/2-trigger-list.md §3` | 추적 plan 항목 생성 또는 `spec-sync-structural-followups.md`에 추가 |
| 4 | Plan Coherence | `spec-sync-audit-998544` worktree가 `spec/2-navigation/` 다수 파일 수정 보유하나 PR #516 MERGED — stale | `spec-sync-audit-998544` worktree | `./cleanup-worktree-all.sh --yes --force` 실행 권장 |
| 5 | Plan Coherence | 4개 stale worktree(kb-lifecycle-groom-57cc46, kb-unsearchable-warning-b47e20, plan-complete-ai-review-backlog-85f80a, unified-model-mgmt-5af7ee)가 `5-knowledge-base.md` 동일 패치 중복 보유 (PR #510·#511·#513 MERGED) | 해당 worktree 4건 | `./cleanup-worktree-all.sh --yes --force`로 일괄 정리 |
| 6 | Naming Collision | `ALERT_RULE_NOT_FOUND` 에러 코드가 구현체·spec 일부에 존재하나 중앙 에러 카탈로그 미등록 | `spec/2-navigation/9-user-profile.md §Alerts API`, `spec/5-system/3-error-handling.md` | `3-error-handling.md`에 `| \`ALERT_RULE_NOT_FOUND\` | 알림 규칙 미존재 | 404 |` 행 추가 |
| 7 | Naming Collision | `EMBEDDING_PROBE_FAILED` 에러 코드가 구현체·`data-flow/6-knowledge-base.md`에 존재하나 중앙 에러 카탈로그 미등록 | `spec/2-navigation/5-knowledge-base.md`, `spec/5-system/3-error-handling.md` | `3-error-handling.md`에 `| \`EMBEDDING_PROBE_FAILED\` | 임베딩 probe 실패 | 400 |` 행 추가 |
| 8 | Naming Collision | `embedding_llm_config_id` 컬럼이 `spec/5-system/8-embedding-pipeline.md`에 미언급 | `spec/1-data-model.md §2.x`, `spec/5-system/8-embedding-pipeline.md` | `8-embedding-pipeline.md`에 해당 필드 언급 추가 (필수 아님) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | **HIGH** | `3-schedule.md §3.1`과 `data-flow/10-triggers.md §1.4·§3.1` 간 역방향 동기화 구현 여부 직접 모순 (CRITICAL 1건) + 링크 텍스트·BullMQ 갭 기술 불일치 (WARNING 2건) |
| Rationale Continuity | **NONE** | 기각 대안 재도입 없음. plan이 기존 Rationale(R-4, 단일 트랜잭션 invariant, 모듈 의존 방향)을 정합하게 이행 |
| Convention Compliance | **LOW** | CRITICAL 없음. `14-execution-history.md` Rationale 누락·이중 섹션 구조 + `3-schedule.md`·`7-statistics.md` Rationale 누락 (WARNING 3건) |
| Plan Coherence | **LOW** | CRITICAL 없음. 이미 구현 완료된 갭(C-10·C-1)이 plan에서 open 상태 + stale worktree 다수 (WARNING 3건 + INFO 2건) |
| Naming Collision | **LOW** | 충돌 없음. 에러 코드 2건 중앙 카탈로그 미등록 (INFO 2건) |

## 권장 조치사항

1. **(BLOCK 해소 — 필수)** `spec/2-navigation/3-schedule.md §3.1` 라이프사이클 표 수정: "역방향도 동일" → "역방향 Trigger→Schedule 동기화는 **미구현 — 구현 갭**" + `data-flow §1.4` 링크. 제약 항목에 BullMQ `removeJob` 미호출 누락 경고 추가.
2. **(BLOCK 해소 보완)** `spec/2-navigation/2-trigger-list.md §4.3` 수정: "동일 결과" 제거 + BullMQ 구현 갭 명시 + 링크 텍스트 "양방향 동기화 정의" → "Schedule↔Trigger 동기화 (구현 갭 포함)".
3. **(WARNING 해소)** `plan/in-progress/spec-sync-schedule-gaps.md` sort/order 항목 `[x]` 체크 + `3-schedule.md §4` 미구현 경고 문구 삭제.
4. **(WARNING 해소)** `plan/in-progress/spec-sync-workflow-list-gaps.md` 상태 필터 항목 `[x]` 체크 + `1-workflow-list.md §2.3` 서술 갱신.
5. **(WARNING 해소)** `spec/2-navigation/5-knowledge-base.md` frontmatter 확인 후 `status: implemented` 승격 및 pending_plans 제거.
6. **(WARNING — 구현 착수 전 권장)** `14-execution-history.md` `## Rationale` 추가 + 이중 섹션 구조 정리. `3-schedule.md`·`7-statistics.md` `## Rationale` 추가.
7. **(INFO)** `spec/5-system/3-error-handling.md`에 `ALERT_RULE_NOT_FOUND`·`EMBEDDING_PROBE_FAILED` 에러 코드 등재.
8. **(INFO)** stale worktree 5건(`kb-lifecycle-groom-57cc46`, `kb-unsearchable-warning-b47e20`, `plan-complete-ai-review-backlog-85f80a`, `unified-model-mgmt-5af7ee`, `spec-sync-audit-998544`) 정리: `./cleanup-worktree-all.sh --yes --force`.