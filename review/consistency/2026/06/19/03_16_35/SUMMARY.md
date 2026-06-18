# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음, 구현 착수 차단 사유 없음

**검토 대상**: `spec/5-system/4-execution-engine.md` · **모드**: `--impl-prep` · **Checkers**: cross_spec / rationale_continuity / convention_compliance / plan_coherence / naming_collision

## 전체 위험도
**LOW** — Critical 0, Warning 1. WARNING 1건(stale `pending_plans` 링크)은 `project-planner` 영역이며 구현 무관.

## Critical 위배

없음.

## 경고 (WARNING)

| # | Checker | 위배 | 위치 | 제안 |
|---|---------|------|------|------|
| W-1 | Plan Coherence | spec frontmatter `pending_plans:` 가 `plan/complete/` 로 이동한 `spec-sync-execution-engine-gaps.md` 를 `in-progress` 경로로 참조 (stale). §8 본문 인라인도 동일. | `spec/5-system/4-execution-engine.md` line 11, §8 | `pending_plans:` 에서 제거, §8 링크를 `exec-intake-queue-impl.md` 로 정정. **project-planner 영역** (developer 무관). |

## 참고 (INFO)

| # | Checker | 항목 | 제안 |
|---|---------|------|------|
| I-1 | Rationale Continuity | `processButtonResumeTurn` 구현 시 `button_continue` + `url?` payload 처리 누락 위험 — §1.3 에 `button_click`·`button_continue` 두 타입 명시 | **구현 시 두 경로 보존 확인** (§7.4 의 button_click 메시지로 통합 — link 버튼 재개 경로 보존) |
| I-2 | Rationale Continuity | `WaitingInteractionType='buttons'` 가 두 payload 포괄 명시 부재 | interaction-type-registry §1.2 주석 보강 (선택, planner) |
| I-3 | Convention Compliance | §1.3 `button_continue` 행 cross-link 처리 | 현행 유지 가능 |
| I-4 | Convention Compliance | §9.1/§9.2 Redis 키 예외 중복 기술 | 가독성 (규약 위반 아님) |
| I-5 | Convention Compliance | Rationale 서브제목 계층 혼재 | 선택 |
| I-6 | Plan Coherence | `exec-intake-queue-impl.md` PR2b 미결 설계 | PR2b 착수 시 재확인 |
| I-7 | Plan Coherence | §11 G1/G2 BLOCKED 배너 부재 | 선택, planner |
| I-8 | Plan Coherence | node-cancellation §2 선행 의존 | 별도 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 |
|---------|--------|------|
| Cross-Spec | NONE | 모순 없음 |
| Rationale Continuity | LOW | button_continue 구현 보존 리마인더(INFO) |
| Convention Compliance | NONE | 형식 INFO 만 |
| Plan Coherence | LOW | stale pending_plans(W-1, pre-existing) + INFO |
| Naming Collision | NONE | 신규 식별자 없음 |

## 권장 조치사항

1. (W-1, project-planner) `pending_plans:` stale 링크 제거 — pre-existing, item ⑤ 무관.
2. (I-1 구현 시) `button_continue`(link, url?/selectedItem?) 경로 보존 확인 — resolveButtonInteraction 추출 시 button_click(port)·link·item-level·fallback 전 variant 보존.

> **item ⑤ 비고**: 본 작업 = button-interaction.service.ts 내부 refactor(resolveButtonInteraction 순수함수 추출 + ButtonClickPayload 판별유니온). 행위보존·신규 식별자 spec-pin 없음(WaitingInteractionType 미이동·spec-차단). W-1/INFO 대부분 pre-existing spec frontmatter(planner) 또는 타 영역.
