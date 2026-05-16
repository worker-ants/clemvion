---
worktree: spec-pipeline-consistency-4c9e1f
started: 2026-05-15
owner: project-planner
---

# spec-update: 8-embedding-pipeline 정합성 정비

> 작성 배경: `cleanup-script-prod-a3f81c` worktree 의 사전 일관성 검토(`/consistency-check --impl-prep`) 에서 spec 자체의 기존 정합성 문제 다수 발견. 본 worktree 의 변경(스크립트 packaging) 과는 무관하므로 별도 plan 으로 분리. project-planner 가 `spec-pipeline-consistency-4c9e1f` worktree 에서 인수해 처리 (2026-05-16).

검토 산출물:
- 발생: `review/consistency/2026/05/15/22_32_15/SUMMARY.md` (cleanup-script-prod PR 의 사전 검토 결과)
- 1차 spec draft 검토: `review/consistency/2026/05/15/23_50_03/SUMMARY.md` (BLOCK: YES — 변경 대상 4 파일 불충분)
- 2차 spec draft 검토: `review/consistency/2026/05/15/23_58_15/SUMMARY.md` (BLOCK: NO — Critical 해소)

## Critical (해소 완료)

- [x] **WebSocket 이벤트 명명 3중 충돌**
  - backend `KbEventType` union (12개) + `kb:${documentId}` 채널을 권위로 결정.
  - `spec/5-system/8-embedding-pipeline.md §8` 12개 이벤트 정합 (embedding 6 + graph 6, graph 는 `10-graph-rag.md §6` 위임).
  - `spec/5-system/6-websocket-protocol.md §3.2/§4.3` 갱신 (KB 단위 → 문서 단위 채널, 점 표기 → 콜론+언더스코어).
  - `spec/2-navigation/5-knowledge-base.md §2.7.1` 갱신 (`document:graph_*` 6개 명시, `kb:graph_stats_updated` 제거).
  - `spec/5-system/10-graph-rag.md §2.3/§4.2/§6` 갱신 (채널 명시, `kb:graph_stats_updated` 행 삭제).
  - `spec/data-flow/6-knowledge-base.md §2.5` 갱신 (12개 이벤트 + 단일 채널).
  - `spec/5-system/2-api-convention.md §10.3` 갱신 (옛 `embedding.progress` 표기 → `document:embedding_*`, `document:graph_*`).

## Warning (해소 완료)

- [x] §2 임베딩 실패 에러 저장 위치 — "Document.metadata" → "Document.embedding_error_message" 로 수정
- [x] §9.4 `retry-failed` API 의 `scope` 허용값 — `'all'` 유지 + `5-knowledge-base.md §2.4.1` 에도 `'all'` 추가, UI 사용 컨텍스트 footnote
- [x] §6.2 IVFFlat DDL 예시 → 컨셉 예시로 유지 + V022/V023/V030~V032 partial HNSW 참조 노트 추가
- [x] Rationale "후속 검토" 목록 — V024 로 완료된 2건에 "→ V024 로 완료" 표시
- [x] Rationale 형식 — "작업 메모" → "결정" 헤더, "결정: spec 정합성 정비 (2026-05-16)" 신규 결정 4건 추가
- [x] Rationale 본문의 폐기된 `memory/` 경로 직접 참조 제거
- [x] Rationale 본문의 옛 flat review 경로(`review/2026-05-02_13-18-24/`) 참조 제거

## Info (해소 완료)

- [x] `DocumentChunk` 정의 중복 — `§6.1` 상단에 "권위 정의는 `1-data-model.md §2.12.1`" 한 줄 추가 (표는 보존)
- [x] `## 1. 개요` → `## Overview` — **본 PR 에서 미수행**. consistency check WARNING #7 회피 (동일 파일 내 §2~§9 번호형 헤더와 비일관 발생, 타 spec 의 §1 크로스 참조 깨질 위험). 후속 plan 으로 분리 가능.
- [x] `document:embedding_error` 의미 변경(2026-05-11) 에 대한 §8 ↔ §9.2 교차 참조 한 줄 추가 (§8 헤더 끝에)
- [x] `1-data-model.md §2.12.1` 인덱스 IVFFlat → partial HNSW 갱신

## 후속 plan (신규 분리 필요)

- [ ] `plan/in-progress/kb-graph-stats-dead-path.md` — `kb-stats.helper.ts:42-46` 의 `kb:graph_stats_updated` emit 이 `emitExecutionEvent` 로 호출되어 채널이 `execution:kb:…` 로 prefix 되어 frontend `kb:` 구독에 도달하지 못하는 dead path. `kb:reembed_started/finished`, `kb:reextract_started/finished` 도 동일 카테고리. 옵션: (1) `emitKbEvent` + 신규 이벤트 type 추가, (2) 코드 제거. dev 결정.

## 처리 방침

- 본 plan 은 spec 반영 + PR 머지까지 끝나면 `complete/` 로 git mv.
- 후속 plan(`kb-graph-stats-dead-path.md`) 은 신규 worktree 에서 dev 가 처리. spec 결정에 따라 본 PR 의 spec 변경 reverse 가능.
