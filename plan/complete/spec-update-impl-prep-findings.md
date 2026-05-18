---
worktree: spec-impl-prep-findings-fix-c4e7a2
started: 2026-05-16
owner: planner (위임)
---

# Spec Update 제안 — impl-prep consistency-check 부산물

`/consistency-check --impl-prep spec/5-system/` (세션 `review/consistency/2026/05/16/10_01_06/`) 에서 발견된 Critical 4건은 원 작업(AI 대화 messages[].source 마커 구현, worktree `ai-thread-source-mark-7c4f2a`) 과 인과 관계가 없는 **다른 spec 영역의 기존 이슈**다. 본 plan 은 이 4건을 별도 worktree(`spec-impl-prep-findings-fix-c4e7a2`) 에서 일괄 처리한 작업이다.

## 처리 항목

- [x] **C1**: `spec/1-data-model.md §2.13 Execution` 에 `re_run_of UUID NULL` / `chain_id UUID NOT NULL` 컬럼·인덱스 추가. `spec/5-system/13-replay-rerun.md §9.1` 와 정합. §3 인덱스 전략 테이블에 `(re_run_of)` / `(chain_id, started_at)` 두 인덱스 추가, Re-run §9.2 `dryRun` derived 필드도 참조 주석으로 명시.
- [x] **C2**: `spec/5-system/10-graph-rag.md §2.2` 의 `graph_extraction_status` 설명 갱신 — `failed` 5종 enum 유지 + canonical source(`spec/1-data-model.md §2.12`) 참조 명시 + `embedding_status` 와 의미 동일함 명시.
- [x] **C3**: `spec/5-system/10-graph-rag.md Rationale` 의 `_원본 메모: memory/graph-rag-decisions.md_` 제거. 대신 옛 경로를 본문 첫 문장에 한 번만 언급(흡수 사실 보존) + Memory 서브섹션을 "역사 기록" framing 으로 감쌈.
- [x] **C4**: Memory 서브섹션 안의 `prd/*.md` 4건 경로는 docs-consolidation 이전 결정 시점의 PRD 트리 스냅샷이므로 그대로 보존하되, 섹션 도입부에 "역사 기록" 주석을 부기해 dead link 가 아닌 사후 갱신하지 않는 history snapshot 임을 명시.

## 부수 Warning (참고용 — 별도 plan 으로 분리)

상세는 세션 `SUMMARY.md` 참조. 본 작업 범위 밖.

- W1: API 경로 prefix 혼재 (`/api/v1/` vs `/api/`) — `spec/5-system/2-api-convention.md` 에서 정책 확정 필요.
- W4: `11-mcp-client.md §8.3` 가 존재하지 않는 `4-integration.md §14` 참조.
- W8/W9/W10: 일부 spec 의 Overview/Rationale 섹션 누락.
- W11: webhook spec Overview 에 `prd/` 출처 표기 잔류.
