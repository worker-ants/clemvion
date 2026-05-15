---
worktree: cleanup-script-prod-a3f81c
started: 2026-05-15
owner: developer (→ project-planner 위임)
---

# spec-update: 8-embedding-pipeline 정합성 정비

> 작성 배경: `cleanup-script-prod-a3f81c` worktree 의 사전 일관성 검토(`/consistency-check --impl-prep`) 에서 spec 자체의 기존 정합성 문제 다수 발견. 본 worktree 의 변경(스크립트 packaging) 과는 무관하므로 별도 plan 으로 분리. **project-planner 에 위임 필요**.

검토 산출물: `review/consistency/2026/05/15/22_32_15/SUMMARY.md`

## Critical (BLOCK 사유, 별도 작업으로 해소 필요)

- [ ] **WebSocket 이벤트 명명 3중 충돌**
  - `spec/5-system/8-embedding-pipeline.md §8` — 채널 `kb:${documentId}`, 콜론+언더스코어 이벤트 (`document:embedding_started` 등), `document:embedding_error` / `document:embedding_retry` 정의
  - `spec/5-system/6-websocket-protocol.md §4.3` — 다른 채널/이벤트 type 형식, 위 두 이벤트 누락
  - `spec/2-navigation/5-knowledge-base.md §2.4.1` — 채널 `embedding:{knowledgeBaseId}` 등 또 다른 표기
  - 권위 문서 결정 후 나머지 두 문서 정합 필요. Graph RAG 이벤트(`graph_started` 등) 도 `6-websocket-protocol.md` 에 누락 → 함께 추가 권장.

## Warning (정비 항목)

- [ ] §2 임베딩 실패 에러 저장 위치 — "Document.metadata" → "Document.embedding_error_message" 로 수정 (단순 오기)
- [ ] §9.4 `retry-failed` API 의 `scope` 허용값 — `'all'` 포함 여부 결정 후 `5-knowledge-base.md §2.4.1` 과 동기화
- [ ] §6.2 IVFFlat DDL 예시 → HNSW 로 갱신 또는 V022/V023 마이그레이션 참조 주석
- [ ] Rationale "후속 검토" 목록 — V024 로 완료된 항목에 완료 표시
- [ ] Rationale 형식 — 작업 일지 → 결정 배경·근거·폐기 대안 중심으로 재작성
- [ ] Rationale 본문의 폐기된 `memory/` 경로 직접 참조 제거
- [ ] Rationale 본문의 옛 flat review 경로(`review/2026-05-02_13-18-24/`) 참조 제거

## Info (선택)

- [ ] `DocumentChunk` 정의가 `1-data-model.md §2.12.1` 과 `8-embedding-pipeline.md §6.1` 양쪽에 중복 — 후자에서 링크 참조로 전환 권장
- [ ] `## 1. 개요` → `## Overview` 권장 패턴화
- [ ] `document:embedding_error` 의미 변경(2026-05-11) 에 대한 §8 ↔ §9.2 교차 참조 한 줄 추가

## 처리 방침

- 본 worktree(`cleanup-script-prod-a3f81c`) 의 변경은 위 항목과 인과관계 없음. 따라서 본 worktree 의 구현은 차단하지 않음.
- 위 항목은 `project-planner` skill 진입으로 별도 worktree 에서 처리.
- 본 plan 은 `complete/` 로 이동시키지 않는다 — project-planner 가 인수받아 별도 plan 으로 분리하거나, 본 파일을 이어받아 처리.
