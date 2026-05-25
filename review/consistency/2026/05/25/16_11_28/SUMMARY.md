BLOCK: NO

# Consistency Check 통합 보고서 (spec draft)

**위험도**: MEDIUM — Critical 없음. WARNING 1건 (3개 checker 동일 지적 — `spec-only → implemented` 직접 전이). INFO 6건.

## Critical
없음.

## WARNING (1건 — 3 checker 통합)

| # | Checker | 위배 | 충돌 SoT | 제안 |
|---|---|---|---|---|
| W1 | cross-spec / rationale-continuity / convention-compliance | `spec-only → implemented` 직접 전이 (partial 단계 생략, 예외 Rationale 부재) | `spec/conventions/spec-impl-evidence.md §3.1` 순차 전이 규칙 | 두 선택지: (A) target plan 또는 §3.1 / §6 Rollout 정책에 "기존 머지 완료된 spec-only 의 소급 전이 허용" 한 줄 추가. (B) `partial` → `implemented` 2단계 분리. (A) 채택 권장 — §6 Rollout 정책이 이미 유사 사례 ("기존 머지된 PR 로 구현 완료된 spec → `implemented` 직접 승격") 허용. |

## INFO (6건)

| # | 항목 | 제안 |
|---|---|---|
| I1 | `id: presentation-common` (basename 권장 이탈) — 사유 명확하나 plan 본문 명시 권장 | plan W6 절에 "basename 권장에서 의도적 이탈 — `id: common` 중복 회피" 한 줄 추가 |
| I2 | 나머지 6개 카테고리 `0-common.md` 의 `id: common` 중복 잔존 — 부분 해소 | plan Side-effect 점검절에 "별도 후속 plan 추적" 한 줄 추가 |
| I3 | `spec-drift-ws-button-config.md` CRITICAL 미해결 상태에서 `implemented` 승격 — 외형 혼동 가능 | spec `## Rationale` 에 "WS §4.4 C2/C3 drift 는 별도 plan 추적 중" 명시 권장 |
| I4 | `code:` glob 단일 서비스 파일 — surface 커버리지 좁음 | `codebase/backend/src/nodes/presentation/**` glob 추가 권장 (선택) |
| I5 | `owner: project-planner` — plan-lifecycle §4 예시(`planner` 단축형) 와 혼용 | plan-lifecycle §4 예시 통일 권장 (별도 plan 후속) |
| I6 | stale worktree `workflow-resumable-execution-phase2-cont-64f537` | `cleanup-worktree-all.sh --yes --force` 권장 |

## Checker 별 위험도

| Checker | 위험도 |
|---|---|
| Cross-Spec | LOW |
| Rationale-Continuity | MEDIUM |
| Convention-Compliance | MEDIUM |
| Plan-Coherence | NONE |
| Naming-Collision | NONE |

## 결정

**BLOCK: NO** — 진행 허용.

W1 해소를 위한 최소 조치: plan W6 절에 §6 Rollout 정책 적용 ("기존 머지된 PR 로 구현 완료된 spec → implemented 직접 승격") 명시적 인용을 추가. 본 spec 갱신 본문은 그대로 진행 가능.

I3 권장 대응: 단순 frontmatter 변경이지만 §Rationale 에 "WS §4.4 drift 별도 추적" 노트 1줄 추가로 외형 혼동 차단.
