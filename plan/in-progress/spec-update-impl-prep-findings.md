---
worktree: ai-thread-source-mark-7c4f2a
started: 2026-05-16
owner: planner (위임)
---

# Spec Update 제안 — impl-prep consistency-check 부산물

`/consistency-check --impl-prep spec/5-system/` (세션 `review/consistency/2026/05/16/10_01_06/`) 에서 발견된 Critical 4건은 본 작업(AI 대화 messages[].source 마커 구현)과 인과 관계가 없는 **다른 spec 영역의 기존 이슈**다. 본 plan 은 그 이슈들을 project-planner 가 별도 작업으로 처리하도록 위임 메모.

## 처리 항목

- [ ] **C1**: `spec/1-data-model.md §2.13 Execution` 에 `re_run_of UUID NULL` / `chain_id UUID NOT NULL` 컬럼·인덱스 추가. `spec/5-system/13-replay-rerun.md §9.1` 와 정합.
- [ ] **C2**: `spec/5-system/10-graph-rag.md §2.2` 의 `graph_extraction_status` Enum 목록에 `failed` 추가 — 동일 문서 §7·§3.2 에서 이미 사용 중이므로 명백한 자체 모순.
- [ ] **C3**: `spec/5-system/10-graph-rag.md Rationale` 의 폐기된 `memory/graph-rag-decisions.md` 참조 제거 또는 `plan/complete/archive/from-memory/` 실제 경로로 갱신.
- [ ] **C4**: `spec/5-system/10-graph-rag.md Rationale` 의 폐기된 `prd/*.md` 경로 4건을 `spec/` 이관 경로로 갱신 또는 "역사 기록" 주석 부기.

## 부수 Warning (참고용)

상세는 세션 `SUMMARY.md` 참조. 본 작업과 무관하므로 별도 처리.

- W1: API 경로 prefix 혼재 (`/api/v1/` vs `/api/`) — `spec/5-system/2-api-convention.md` 에서 정책 확정 필요.
- W4: `11-mcp-client.md §8.3` 가 존재하지 않는 `4-integration.md §14` 참조.
- W8/W9/W10: 일부 spec 의 Overview/Rationale 섹션 누락.
- W11: webhook spec Overview 에 `prd/` 출처 표기 잔류.

## 위임

위 항목은 project-planner 가 별도 worktree 에서 spec 갱신해야 한다. 본 작업(`ai-thread-source-mark-7c4f2a`) 의 PR 머지와 무관하게 진행.
