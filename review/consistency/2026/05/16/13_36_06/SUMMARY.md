# Consistency Check 통합 보고서 (spec)

**Mode**: `--spec spec/2-navigation/4-integration.md`
**Target**: spec 갱신 후 재검토 — Attention 가상 필터값 도입
**BLOCK: NO** — Critical 발견 없음.

## 전체 위험도
**MEDIUM** — 런타임 에러와 연결될 수 있는 WARNING 4건, 본 작업 무관한 별 영역 spec 정합성 항목 다수. Critical 수준의 기능 파괴적 모순은 없음.

## Critical 위배 (BLOCK 사유)
없음

## 경고 (WARNING) — 본 작업 관련

| # | Checker | 위배 | 처리 |
|---|---------|------|------|
| W3 | Cross-Spec | §11.4 사이드바 배지 조건이 §2.4 배너 포함 조건과 정밀도 불일치 (`IS NOT NULL`, `> NOW()` 누락) | spec §11.4 갱신 완료 — §2.4 와 동일한 술어로 통일 |
| W7 | Plan-Coherence | `integration-attention-filter.md` plan 의 spec 갱신 체크박스 미체크인데 spec 에는 이미 반영됨 | plan 체크박스 `[x]` 갱신 + 본 세션 경로 기록 완료 |

## 경고 (WARNING) — 본 작업 범위 밖 (Follow-up)

| # | Checker | 항목 | 후속 처리 |
|---|---------|------|-----------|
| W1 | Cross-Spec | `spec/5-system/4-execution-engine.md §10` 의 `INTEGRATION_NOT_CONNECTED` / `INTEGRATION_INCOMPLETE` 구분 cross-link 미확인 | 별 spec consistency 작업으로 분리 |
| W2 | Cross-Spec | `spec/5-system/11-mcp-client.md` Internal Bridge 의 pending_install 처리 미명시 | 별 spec 작업 |
| W4 | Cross-Spec / Convention | `spec/conventions/swagger.md` 또는 `spec/5-system/2-api-convention.md` 에 가상 필터값 규약 미박제 | 본 spec §2.3/§9.1 에는 명시했으나 규약 문서에 박제 필요 — follow-up |
| W5 | Convention | §9.4 에러 응답 포맷 `{ code, message }` vs `{ error: { code, message } }` 모순 | 기존 이슈, 별 정리 |
| W6 | Convention | 본문 상단 `## Overview` 섹션 누락 — 영역 패턴인지 규약 누락인지 모호 | 규약 문서에 예외 명문화 필요 — follow-up |
| W8 | Plan-Coherence | `spec-update-cafe24-background-refresh.md` 미체크박스 다수, 산출물은 spec 반영 완료 | 별 plan housekeeping |
| W9 | Plan-Coherence | `spec-update-cafe24-app-url-reuse.md` 가 동일 파일 §3.2·§4.4·§6·§9.2 수정 — 본 worktree 와 영역 비중첩 | merge 시점에 재확인 |

## 처리 요약

- 본 작업 관련 W3/W7 즉시 해소.
- 본 작업 범위 밖 W1/W2/W4/W5/W6/W8/W9 는 `plan/in-progress/integration-attention-filter.md` 의 "Follow-up — 본 작업 범위 밖" 섹션에 명시적으로 기록 (별 plan 또는 본 PR 머지 후 후속 정리 대상).
- INFO 17건은 대부분 다른 spec 문서와의 cross-reference 보강 항목 — 별 plan 으로 점진 처리.

## 산출물 위치
- `cross_spec/review.md` (9)
- `rationale_continuity/review.md` (9)
- `convention_compliance/review.md` (6)
- `plan_coherence/review.md` (6)
- `naming_collision/review.md` (4)
- `_retry_state.json` — 모든 checker success
