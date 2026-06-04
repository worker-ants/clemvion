# Consistency Check 통합 보고서 (--impl-prep spec/5-system/)

**BLOCK: YES** (원판정) — **단, 2개 Critical 은 PR1(execution-engine intake 큐)과 무관한 기존 auth spec 이슈로, 본 구현을 차단하지 않음. 아래 §scope 판단 참조.**

검토: `--impl-prep spec/5-system/` · 2026-06-04

## Critical 2건 — 전부 `spec/5-system/1-auth.md` (auth 도메인, pre-existing)
1. 초대 에러코드 6개 lower_snake_case 위반 (§1.5.4) — UPPER_SNAKE_CASE 로 정정 필요.
2. WebAuthn availability 응답 포맷 내부 불일치 (§1.4.3 vs §5) — `{ data: { enabled } }` 통일.

→ **scope 판단**: 본 구현(PR1)은 execution-engine 변경이며 `1-auth.md` 를 건드리지 않음(git 확인: branch 무수정). 두 Critical 은 `--impl-prep` 를 `spec/5-system/` 전체로 넓게 잡아 딸려온 **기존 auth spec 이슈**다. execution-engine 도메인 Critical 0 + Rationale Continuity NONE → PR1 코드 구현은 차단 대상 아님. auth Critical 은 **별도 project-planner 후속**으로 분리(본 PR 무관).

## execution-engine 관련 실재 WARNING (후속 spec 패치)
- **execution-run 미등록 SoT 2곳**: `spec/data-flow/0-overview.md §4`, `spec/5-system/16-system-status-api.md §1`(+§3 burst 오탐 note). 내 spec PR(#458)이 §2.4/§2.6/§9.3/§11 은 반영했으나 이 2곳 누락 → project-planner 소규모 후속.
- EXECUTION_TIMEOUT 의미 분리·WORKER_HEARTBEAT_TIMEOUT 설명·EXECUTION_TIME_LIMIT_EXCEEDED 등록: 내 PR #458 에서 §1.4/§8/§2.13 이미 반영됨(checker 가 draft 후속목록을 pending 으로 오독한 부분 포함). 단 **EIA §5.2 예시 + execution-failure-classifier.ts** 에 신규 코드 미전파 = PR2 범위로 포함.

## Plan Coherence (stale/무관)
- W6 `spec-exec-intake-queue` 미머지 경합 → **이미 머지됨(#458)**, stale.
- W7 `fix-bg-context-followups` §5.5 동시수정 → spec-vs-spec 건이라 PR1 **코드** 와 무관.

## 결론
PR1 코드 구현 진행. 차단 Critical 은 무관 auth 이슈로 분리, 실재 exec-engine WARNING(SoT 등록 2곳 + EIA/classifier 전파)은 후속(project-planner / PR2)으로 추적.

> main 멱등 persist (workflow terminal write 가 write_blocked).
