# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 구현 착수 차단 사유 없음.

**Target**: `spec/5-system/4-execution-engine.md`
**Mode**: `--impl-prep` (구현 착수 전)
**검토 일시**: 2026-06-06

---

## 전체 위험도
**LOW** — Critical/Warning 수준 위배 없음. 1건의 WARNING(레이블 충돌)과 다수 INFO 수준 개선 권고만 발견됨.

---

## Critical 위배 (BLOCK 사유)

해당 없음.

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Naming Collision | `exec-park D6` 레이블이 AI 노드 spec 의 동명 `D6`(output 단일화 결정)와 두 별개 결정에 동시 사용됨. 인라인 주의 문구가 있으나 혼동 리스크 실존 | `spec/5-system/4-execution-engine.md §7.5`, §Rationale | `spec/4-nodes/3-ai/1-ai-agent.md` L750, `3-information-extractor.md` L334/370/386/430, `2-text-classifier.md` L340/350 | 실행 엔진 측 레이블을 `exec-park D6-stack` 으로 세분화하거나, AI 노드 측을 `ND-D6` 로 rename 해 namespace 분리. |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Cross-Spec | `execution.resumed` 이벤트 — Phase B rehydration 경로와의 관계가 `3-execution.md` 에 불명확 | `spec/3-workflow-editor/3-execution.md §이벤트 목록` | `execution.resumed` 행에 "Phase B 이후 모든 재개가 rehydration 경로 — §7.5 참조" 크로스링크 추가 권장 |
| I-2 | Cross-Spec | `executeInline` park 후 재개 시 sub-workflow 출력 래핑 형태 미명시 | `spec/5-system/4-execution-engine.md §7.5` "(b) 외곽 frame" | `{ result: innerOutput }` 1단 래핑 명시 추가로 구현 모호성 제거 |
| I-3 | Cross-Spec | `EXECUTION_TIME_LIMIT_EXCEEDED` 가 `spec/5-system/3-error-handling.md §1.4` 에 미열거 가능 | `spec/5-system/3-error-handling.md §1.4` | 해당 코드 열거 여부 확인 후 누락 시 동기화 권장 |
| I-4 | Rationale Continuity | `waiting_for_input → failed` 전이 추가 — 기존 정책 번복 출처 참조 링크 부재 (현 문구가 사실상 충족) | `spec/5-system/4-execution-engine.md §Rationale` | 현 수준으로 연속성 추적 충분. 추가 조치 불요 |
| I-5 | Rationale Continuity | `_multiTurnState` 키 폐기 경위 (도입·rename·폐기) 가 Rationale 에 미기술 | `spec/5-system/4-execution-engine.md §1.3` | §1.3 또는 §Rationale 에 한 줄 추가: rename(Stage 2) + 페이로드 제거(Stage 5) + strip list 잔존이 defensive guard 임을 명시 |
| I-6 | Convention Compliance | `## Overview` 섹션 부재 — 3섹션 구조 권장 미충족 (기술 명세 성격, 기능 문제 없음) | `spec/5-system/4-execution-engine.md` 전체 구조 | 강제 규약 아닌 가이드라인. 현 상태 유지 가능 |
| I-7 | Convention Compliance | `exec-park-durable-resume.md` 가 `pending_plans` 에 잔류하나 실제 작업은 MERGED 완료 | `spec/5-system/4-execution-engine.md` frontmatter | `plan/in-progress/exec-park-durable-resume.md` 를 `plan/complete/` 로 이동 후 frontmatter `pending_plans` 에서 제거. `spec-status-lifecycle.test.ts` 가드가 포착 가능 |
| I-8 | Convention Compliance | `INVALID_EXECUTION_STATE`(WS) vs `INVALID_STATE`(REST) 분리 케이스가 `error-codes.md §3` 레지스트리에 미등재 | `spec/5-system/4-execution-engine.md §7.5.1`, §Rationale | `error-codes.md §3` 에 layer-routing 패턴 선례로 등재 권장 |
| I-9 | Plan Coherence | target 파일이 현 worktree 에서 미수정 — `--impl-prep` 는 향후 A2/A3 선행 점검 목적 | `spec/5-system/4-execution-engine.md` | A2(frontmatter 변경) 착수 시 재실행 불요. A3(`1-ai-agent.md` 수정) 시 그 파일 scope 로 `--impl-prep` 재실행 권장 |
| I-10 | Plan Coherence | `exec-park-durable-resume` worktree — PR MERGED 확인, stale 판정. 경합 없음 | worktree `exec-park-durable-resume` | `cleanup-worktree-all.sh --yes --force` 실행 권장 |
| I-11 | Naming Collision | `CONTINUATION_SEQ_TTL_SECONDS` 가 §11 환경변수 일람에 누락 | `spec/5-system/4-execution-engine.md §9.2` vs §11 | §11 환경변수 테이블에 추가해 가시성 통일 |
| I-12 | Naming Collision | `exec:run:seq` Redis 키가 "PR1 미사용" 이지만 §9.2 테이블에 미래 예정 항목으로 혼재 | `spec/5-system/4-execution-engine.md §9.2` | 해당 행에 `(Planned, PR3/PR4)` 태그 명시 강화 또는 "미래 예약 키" 섹션으로 분리 |
| I-13 | Naming Collision | `EXECUTION_RUN_WORKER_CONCURRENCY` 기본값이 `16-system-status-api.md` 에 하드코딩 `1` 로 표기 — 현재 일치하나 향후 drift 위험 | `spec/5-system/16-system-status-api.md` L22 | cross-link 방식(`§4.3 참조`)으로 변경해 drift 방지 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | 직접 모순 없음. 4건 INFO 수준 서술 보완 권고 |
| Rationale Continuity | NONE | 주요 번복 모두 배경·기각 대안·채택 사유 명시. 2건 INFO 명확성 보완 제안 |
| Convention Compliance | LOW | frontmatter `pending_plans` 에 MERGED plan 잔류(프로세스 이슈). 3건 INFO |
| Plan Coherence | NONE | worktree 경합 없음. stale worktree 정리 권장 |
| Naming Collision | LOW | `exec-park D6` 레이블 namespace 충돌(WARNING) + 3건 INFO |

---

## 권장 조치사항

1. **(WARNING 해소)** `exec-park D6` 레이블 namespace 분리 — 실행 엔진 측을 `exec-park D6-stack` 으로 세분화하거나 AI 노드 3개 파일(`spec/4-nodes/3-ai/1-ai-agent.md`, `3-information-extractor.md`, `2-text-classifier.md`)의 `D6` 를 `ND-D6` 로 rename. 현행 인라인 주의 문구만으로는 혼동 차단 불충분.
2. **(프로세스 정합)** `plan/in-progress/exec-park-durable-resume.md` 를 `plan/complete/` 로 이동하고 `spec/5-system/4-execution-engine.md` frontmatter `pending_plans` 에서 제거. spec-status-lifecycle 가드가 이를 포착할 수 있으므로 조기 정리 권장.
3. **(stale 정리)** `exec-park-durable-resume` worktree 를 `cleanup-worktree-all.sh --yes --force` 로 제거.
4. **(명확성)** `_multiTurnState` rename·폐기 경위를 `spec/5-system/4-execution-engine.md §1.3` 또는 §Rationale 에 한 줄 추가.
5. **(INFO 보완, 낮은 우선순위)** `CONTINUATION_SEQ_TTL_SECONDS` 를 §11 환경변수 테이블에 추가; `exec:run:seq` 미래 예약 키 표시 강화; `spec/5-system/3-error-handling.md §1.4` 에 `EXECUTION_TIME_LIMIT_EXCEEDED` 동기화 여부 확인.