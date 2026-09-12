# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**LOW** — 5개 checker 전원 CRITICAL 0건. `plan_coherence` 가 같은 worktree 의 1차 구현 plan(`impl-setup-error-code.md`) 체크리스트 미동기화를 WARNING 1건으로 지적.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | 같은 worktree 의 1차 구현 plan(`impl-setup-error-code.md`)의 체크리스트 11항목이 전부 미체크 상태로 방치되어, target 이 주장하는 "adapter 3종 `code` 부착 구현 완료" 사실이 그 plan 문서 자체에는 반영돼 있지 않음 | `plan/in-progress/spec-update-chat-channel-adapter-status.md` §영향 | `plan/in-progress/impl-setup-error-code.md` (`## 체크리스트` 전체, frontmatter `status: in-progress`) | target(또는 이어지는 planner 턴)에서 `spec/` 갱신과 함께 `impl-setup-error-code.md` 체크리스트를 실측 상태로 갱신하고 `plan/complete/` 이동 여부를 판단할 것. target §3 에서 다른 트래커(`spec-draft-nullable-notation-followups.md`)에는 이미 동일 취급을 권고했으므로 일관성을 위해 이 plan 도 포함 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | frontmatter 주석의 "아래 첫 항목" 참조가 `pending_plans` 리스트의 배열 순서(서수)에 암묵 의존 — 순서가 바뀌면 조용히 틀린 것을 가리키게 됨 | `plan/in-progress/spec-update-chat-channel-adapter-status.md` §"제안 변경 1" After 블록 | "아래 첫 항목" 대신 "`pending_plans` 첫 엔트리인 `spec-draft-nullable-notation-followups.md` 안의 `CCA §1.1.2 의 401/403 fallback 제거 판정` 항목"처럼 파일명을 직접 명시 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 정정 대상 두 지점(frontmatter 주석·§1.1.2 콜아웃)만 갱신하며 인접 SoT(`15-chat-channel.md` §5.4, `2-api-convention.md` §6, provider 3종 문서)와 이미 수렴. cross-spec 충돌 없음 |
| rationale_continuity | NONE | R-CC-23(제거 조건과 삭제 판정 분리)·R-CCA-9(기각 대안 재도입 금지)·spec-impl-evidence §3.1(status 승격 조건) 전부 준수. 서수 참조 표현 INFO 1건만 |
| convention_compliance | NONE | plan draft 자체(파일명·frontmatter·섹션 구조)가 PROJECT.md·resolution-applier.md·plan-lifecycle.md 템플릿과 일치, 제안된 spec 편집도 spec-impl-evidence.md frontmatter 스키마와 정합 |
| plan_coherence | LOW | 실측 근거(adapter 3종 `code` 부착 완료) 정확, 미해결 결정(§1.1.2 fallback 제거 판정) 우회 없음. 단 같은 worktree 1차 구현 plan 체크리스트 미동기화 WARNING 1건 |
| naming_collision | NONE | 신규 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수·파일 경로 도입 없음. 전부 기존 식별자 재인용 |

## 권장 조치사항
1. `plan/in-progress/impl-setup-error-code.md` 체크리스트를 실측 완료 상태로 갱신하고 `plan/complete/` 이동 여부를 판단한다 (WARNING #1 해소, BLOCK 사유 아님 — 후속 정리 권장).
2. (선택, cosmetic) frontmatter 주석의 "아래 첫 항목" 서수 참조를 파일명 직접 명시로 교체한다 (INFO #1).
3. target 의 spec 정정 자체는 실측으로 뒷받침되므로 별도 수정 없이 planner 턴에서 반영 진행 가능.