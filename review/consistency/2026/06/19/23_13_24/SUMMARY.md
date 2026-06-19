# Consistency Check 통합 보고서 (--impl-done)

**BLOCK: NO** — Critical 발견 없음

검토 대상: `spec/4-nodes/2-flow/` + 연관 구현 diff (diff-base=origin/main)
검토 일시: 2026-06-19 23:13

## 전체 위험도

**LOW** — WARNING 1건(에러 코드 표 불일치), INFO 8건. Critical 없음.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target | 제안 |
|---|---------|------|--------|------|
| W-1 | Convention Compliance | `0-common.md §2.1` 에러 컨트랙트 표에 `WORKFLOW_FORBIDDEN_WORKSPACE` 누락 — `1-workflow.md §6` 신규 코드와 flow-common 문서 불일치 | `spec/4-nodes/2-flow/0-common.md §2.1` | Sync 모드 행 code 목록에 `WORKFLOW_FORBIDDEN_WORKSPACE` 추가 (→ 본 PR 에서 조치) |

## 참고 (INFO)

| # | Checker | 항목 | disposition |
|---|---------|------|-------------|
| I-1 | Rationale Continuity | spec 에 typed/plain Error 계층 미기재 | → §6 비고에 1줄 추가(조치) |
| I-2 | Rationale Continuity | TurnRagDelta rename spec Rationale 미기재 | spec 에 이름 없음 → 조치 불필요 |
| I-3 | Rationale Continuity | LlmCallRecord 공유 타입 spec 미언급 | spec 이 내부 TS 타입명 강제 안 함 → 조치 불필요 |
| I-4 | Convention Compliance | 0-common.md·1-workflow.md `## Rationale` 부재 | 후속 spec-cleanup(즉시 차단 아님) |
| I-5 | Convention Compliance | frontend TurnRagDelta rename ↔ AI spec canonical TurnDebugEntry 명칭 | TurnRagDelta=frontend RAG delta(≠ backend canonical TurnDebugEntry) — spec 계약 무관, 조치 불필요 |
| I-6 | Plan Coherence | c1 SPEC-DRIFT 후속(3-error-handling/4-execution-engine) 미완료 주장 | **본 PR commit 2ace2c64 에서 이미 갱신됨**(checker scope=flow 라 미관측). 정합 |
| I-7 | Plan Coherence | type-consolidation SPEC-DRIFT(b) 미완료 | c1-engine-split.md 별도 후속 기록됨(handoff) |
| I-8 | Naming Collision | `WORKFLOW_FORBIDDEN_WORKSPACE` `spec/conventions/error-codes.md` 미등재 | → 검토 후 조치/disposition |

## Checker별 위험도

| Checker | 위험도 |
|---------|--------|
| Cross-Spec | success (출력 파일 write bg-isolation 차단 — 결과는 workflow 반환으로 수신, BLOCK 판정 반영) |
| Rationale Continuity | NONE |
| Convention Compliance | LOW (W-1) |
| Plan Coherence | LOW (INFO만, 충돌 없음) |
| Naming Collision | NONE |

## 결론

**BLOCK: NO** — spec↔code 정합 Critical 없음. SPEC-CONSISTENCY gate 통과. W-1 + I-1/I-8 은 본 PR 에서 spec-only 조치(코드 무변).
