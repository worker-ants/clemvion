# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다.

## 전체 위험도
**MEDIUM** — OPEN PR #518(`refactor-backlog-format`)이 target과 동일 spec 라인을 수정 중이어서 머지 순서에 따라 rebase 충돌 실재. 나머지 발견사항은 LOW/NONE.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Plan Coherence | OPEN PR #518(`refactor-backlog-format`)이 `spec/1-data-model.md §2.9.1` 및 `spec/data-flow/10-triggers.md §1.4·§3.1`을 "미구현 — 구현 갭" 상태로 되돌리는 변경을 포함 — 머지 순서에 따라 target plan의 before 텍스트 불일치 또는 rebase 충돌 발생 | 갱신 대상 1(`spec/1-data-model.md §2.9.1`) 및 갱신 대상 2(`spec/data-flow/10-triggers.md §1.4`) | `plan/in-progress/refactor-backlog-format` 브랜치(PR #518 OPEN) | (a) target plan 먼저 머지 후 PR #518을 rebase on main 하고 spec 충돌 라인을 완료 텍스트로 수동 확인, 또는 (b) PR #518을 먼저 rebase해 spec 내용을 main 최신 상태로 keep 후 머지, 그 다음 target plan 진행. 어느 순서든 PR #518 즉각 rebase 선행 필요. |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | `spec/data-flow/10-triggers.md §1.4` 표의 "Schedule 삭제" 행 Trigger 컬럼에 Trigger-API-initiated 삭제 동작(`removeJob`)을 혼재 — 행 헤더(Schedule 발화)와 컬럼 내용(Trigger API 호출) 의미 교차 | draft §2 `spec/data-flow/10-triggers.md §1.4` 표 "Schedule 삭제" 행 | `spec/data-flow/10-triggers.md §1.4` 표 구조 (발화 주체 기준 행 분류 패턴) | `Trigger(type='schedule') 직접 생성` 행과 동일 패턴으로 `Trigger(type='schedule') 삭제` 행을 **별도 행**으로 추가해 Trigger-API-initiated 삭제 동작을 분리. `spec/2-navigation/2-trigger-list.md §4.3` cascade 표와의 정합성도 향상됨. |
| 2 | Convention Compliance | plan frontmatter에 `spec_impact` 필드 누락 — `started: 2026-06-10`(cutoff 이후)이므로 `complete/` 이동 시 `spec-plan-completion.test.ts` Gate C에서 강제 차단 | frontmatter (lines 1–5) | `spec/conventions/spec-impl-evidence.md §4.2` Gate C + `.claude/docs/plan-lifecycle.md §5 Gate C` | 완료 이동 전 또는 미리 frontmatter에 `spec_impact: [spec/1-data-model.md, spec/data-flow/10-triggers.md, spec/2-navigation/3-schedule.md]` 추가. |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | draft §1.3 및 §1.4 구현 갭 blockquote의 "Before" 텍스트가 현행 파일에 이미 존재하지 않음 — 일괄 적용 시 sed-style replace 에러 가능 | `spec/data-flow/10-triggers.md §1.3·§1.4`, `spec/1-data-model.md §2.9.1`, `spec/2-navigation/3-schedule.md §3.1` | 적용 전 현행 파일 재확인 후, 아직 추가되지 않은 상세 구현 설명(`syncScheduleActivation()` 참조, `removeJob` 호출 확인)만 선택적 적용. |
| 2 | Cross-Spec | `spec/2-navigation/2-trigger-list.md §4.3` cascade 표에 `DELETE /api/triggers/:id` 시 `removeJob` 호출 여부 미기재 | `spec/2-navigation/2-trigger-list.md §4.3` | draft와 함께 §4.3 표 업데이트하거나 후속 Plan 태스크로 명시 등록. |
| 3 | Rationale Continuity | `syncScheduleActivation()` 설계 선택(private 메서드 추출 이유)이 `spec/data-flow/10-triggers.md ## Rationale`에 미추가 | `spec/data-flow/10-triggers.md ## Rationale` | "update()와 remove() 두 경로 재사용으로 private 메서드 추출" 항 1개 추가. |
| 4 | Convention Compliance | `plan/in-progress/trigger-schedule-reverse-sync.md` 참조 링크가 dead link (해당 파일 미발견) | `## 추가 정보` 섹션 | 실제 경로(`plan/complete/` 이동 여부 등) 확인 후 링크 갱신. |
| 5 | Plan Coherence | `spec-sync-audit-998544` worktree(PR MERGED)가 stale로 활성 잔존 | `.claude/worktrees/spec-sync-audit-998544` | `./cleanup-worktree-all.sh --yes --force` 실행 권장. |
| 6 | Naming Collision | "구현 현황" blockquote 제목이 기존 "구현 갭" 패턴과 상이한 첫 사례 — 충돌 없으나 향후 컨벤션 미비 | `spec/data-flow/10-triggers.md §1.4` 신규 blockquote | 갭 해소 후 상태 블록은 "구현 현황" 패턴을 쓰도록 컨벤션 명시(비긴급). |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | §1.4 표 구조 비일관성(WARNING), "Before" 텍스트 부재(INFO×2), §4.3 미업데이트(INFO) |
| Rationale Continuity | LOW | `syncScheduleActivation()` 설계 근거 Rationale 미추가(INFO) |
| Convention Compliance | LOW | `spec_impact` frontmatter 미선언(WARNING), dead link(INFO) |
| Plan Coherence | MEDIUM | PR #518과 동일 라인 충돌 위험(CRITICAL), §4.3 조건부 겹침 가능성(INFO) |
| Naming Collision | NONE | 식별자 충돌 없음, "구현 현황" 패턴 첫 사례(INFO) |

## 권장 조치사항
1. **(BLOCK 해소 필수)** PR #518(`refactor-backlog-format`)을 즉시 `rebase on main`해 `spec/1-data-model.md §2.9.1` 및 `spec/data-flow/10-triggers.md §1.4` 의 spec 변경 라인을 main 최신 상태(완료 텍스트)로 확인·정리한 후 머지. 그 후 target plan 진행. 또는 target plan을 먼저 머지하고 PR #518을 rebase.
2. **(완료 이동 전 필수)** plan frontmatter에 `spec_impact` 필드 추가 — `complete/` 이동 커밋에 반드시 포함해야 Gate C 통과.
3. **(권장)** `spec/data-flow/10-triggers.md §1.4` 표에 `Trigger(type='schedule') 삭제` 행을 별도 추가해 발화 주체 기준 표 구조 일관성 확보.
4. **(권장)** `spec/2-navigation/2-trigger-list.md §4.3` cascade 표에 `removeJob` 호출 동작 추가 또는 후속 Plan 등록.
5. **(권장)** `spec/data-flow/10-triggers.md ## Rationale`에 `syncScheduleActivation()` private 메서드 추출 근거 항 추가.
6. plan 내 `trigger-schedule-reverse-sync.md` 참조 링크 실제 경로 확인·갱신.
7. stale worktree `spec-sync-audit-998544` 정리.