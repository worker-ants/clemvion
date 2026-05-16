# Consistency Check 통합 보고서 (impl-prep, scope=spec/5-system/)

**BLOCK: YES** — Critical 발견 4건. 단, 발견된 Critical 모두 **본 작업(AI 대화 messages[].source 마커 구현)과 인과 관계 없음** — 별도 spec 영역의 기존 이슈.

## 본 작업의 영향 범위 안 결과 (필터링)

- `spec/5-system/6-websocket-protocol.md` (§4.4.6 신규 추가) — Critical 없음
- `spec/conventions/conversation-thread.md` (§5.1 보강) — Critical 없음
- `spec/3-workflow-editor/3-execution.md` (§8.1 동기화) — Critical 없음
- 직전 spec write 단계 검토(2026-05-16 09:42:54)에서 WARNING 1건이 보강 문장으로 해소된 상태 그대로

## 발견된 Critical (모두 본 작업 범위 밖)

| # | 파일 | 이슈 | 본 작업과의 관련성 |
|---|---|---|---|
| C1 | `spec/5-system/13-replay-rerun.md §9.1` | `re_run_of`/`chain_id` 컬럼이 `spec/1-data-model.md §2.13` 과 미동기 | 없음 — 다른 작업(`plan/in-progress/replay-rerun.md`) 영역 |
| C2 | `spec/5-system/10-graph-rag.md §2.2` | `graph_extraction_status` Enum 에 `failed` 누락 | 없음 — Graph RAG 영역 |
| C3 | `spec/5-system/10-graph-rag.md Rationale` | 폐기된 `memory/graph-rag-decisions.md` 직접 참조 | 없음 — docs-consolidation 잔존물 |
| C4 | `spec/5-system/10-graph-rag.md Rationale` | 폐기된 `prd/*.md` 경로 참조 잔존 | 없음 — docs-consolidation 잔존물 |

## 결정

- **본 작업의 구현은 진행 가능** — 모든 Critical 이 다른 spec 영역의 기존 이슈이고, 본 작업이 이를 도입/악화시키지 않음.
- 발견된 Critical 들은 `plan/in-progress/spec-update-impl-prep-findings.md` 에 별도 기록해 project-planner 가 처리하도록 위임.

## WARNING / INFO (전체 21건) 중 본 작업 관련

- 본 작업 직접 관련: 없음.
- 관련성 있을 가능성: I17 (`document:graph_error` 이벤트 의미 변경) — frontend 핸들러 마이그레이션 확인 필요. 본 작업 외 영역이지만 frontend 작업 중 발견되면 별도 fix.

## 권장 후속 조치

1. **본 작업 진행** (developer 가 backend → frontend 차례로 구현).
2. **별도 plan 작성** — `spec-update-impl-prep-findings.md` 에 C1–C4 항목 기록 → project-planner 에 위임.
3. 다음 spec/5-system 작업 진입 시 이 SUMMARY 와 별도 plan 을 다시 참조해 미해결 잔존 여부 확인.

## 원본 Critical/Warning/Info 전문

(consistency-summary sub-agent 보고서 본문은 `_retry_state.json` 에서 참고 — 항목 수: cross_spec 9 / rationale_continuity 7 / convention_compliance 10 / plan_coherence 7 / naming_collision 6. 본 SUMMARY 는 본 작업 의사결정에 필요한 부분만 압축.)
