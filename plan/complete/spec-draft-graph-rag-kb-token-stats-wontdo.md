---
title: graph-rag "KB 상세 토큰 통계" 정직화 — 비목표 확정 (data-flow §7 invariant 정합)
worktree: llm-usage-doc-alignment-01d7a4
started: 2026-07-11
owner: project-planner
spec_area: spec/5-system/10-graph-rag.md
spec_impact:
  - spec/5-system/10-graph-rag.md
---

## 배경

`spec/5-system/10-graph-rag.md` 가 "KB 상세 토큰 통계 / KB 누적 표시"를 완료(✅)로 표기했으나
**완전 미구현**이며 `spec/data-flow/7-llm-usage.md` 의 "GraphExtractionService context 의도된 NULL"
invariant 와 정면 충돌한다(impl-prep consistency CRITICAL, `task_29ab68ff`). 사용자 결정(2026-07-11):
**정직화 + 비목표 확정** — KB 단위 토큰 attribution 은 도입하지 않고 workspace 단위 집계만 SoT.

## 실증 (조사 완료, 무수정 프로브)

| 주장 | 실제 |
|---|---|
| "추출 토큰을 LlmUsageLog 에 기록"(KB-GR-OB-01) | **TRUE** — `LlmService.chat` boundary 가 usage row 기록. 단 `workspace_id` 만, KB attribution 없음 |
| "KB 상세 토큰 통계 / KB 누적 표시"(KB-GR-EX-07 괄호·NF-GR-05) | **완전 미구현** — 경로 전무 |

증거:
- `LlmUsageLog`(`llm-usage-log.entity.ts`·1-data-model §2.24): `knowledge_base_id`/`document_id` FK **없음**, 부모=Workspace.
- `GraphExtractionService`(`graph-extraction.service.ts`) `LlmService.chat(..., undefined, ...)` — context NULL(workflow/execution/node).
- `getGraphStats`(`knowledge-base.service.ts`): entity/relation/document 카운트만, token 없음. KB 모듈 `llm_usage_log` grep 0.
- WS payload(`graph_progress`/`_completed`)·frontend(`KbGraphStats`·KB 상세 page) token 필드 없음.
- **data-flow/7-llm-usage §Rationale**: GraphExtractionService NULL = "**의도된 누락**"(workspace 집계만 온전). → KB attribution 은 이 invariant 와 상충.
- git: 처음부터 미구현(구현→제거 아님). naming `LLMUsageLog`(KB-GR-OB-01·NF-GR-05) vs canonical `LlmUsageLog`(KB-GR-EX-07·entity) 혼재.

## 변경안 (spec-only, 코드 무변경)

### `spec/5-system/10-graph-rag.md`
1. **KB-GR-EX-07(:92)**: `✅` → **⛔ 비목표**. "LLM 사용량은 `LlmService.chat` 이 `LlmUsageLog` 에 workspace 단위 기록(KB-GR-OB-01)하나 **KB 단위 attribution·누적 표시는 비목표**" + data-flow §7 cross-ref.
2. **KB-GR-OB-01(:142)**: ✅ 유지(기록은 됨). 요구사항 문구에 "**workspace 단위 — KB attribution 없음**" 명시 + `LLMUsageLog`→`LlmUsageLog` casing 정정 + context NULL(data-flow §7 의도된 누락) 노트.
3. **NF-GR-05(:170)**: 기록(workspace)은 구현됨 명시, "**KB 상세에서 누적 표시**"는 **비목표** 명시. `LLMUsageLog`→`LlmUsageLog` 정정.
4. **§Rationale 신규 항목**: KB 단위 토큰 attribution 을 비목표로 둔 근거 — data-flow §7 이 GraphExtractionService context NULL 을 의도된 설계로 확정(workspace 집계 SoT). KB attribution 도입은 (a) LlmUsageLog KB FK migration + (b) GraphExtractionService context threading 을 요구하는데 그건 이 invariant 를 뒤집는 별도 제품 결정이므로 현 범위에서 비목표.

**frontmatter `status: implemented` 유지**: graph-rag 기능은 구현됨. KB 토큰 통계는 미구현 gap 이 아니라 비목표(won't-do)라 pending_plan 불요(spec-impl-evidence — 비목표는 partial 강등 대상 아님).

## consistency-check 반영 (2026-07-11, `.../21_25_02/`, BLOCK: NO)
- **W2 (cross_spec·naming·convention 수렴)**: `⛔` 는 execution "취소됨"·plan "WITHDRAWN" 과 의미 충돌 + 요구사항 표는 `✅/🚧/❌` 3심볼 관례. → **`❌ **비목표**`** 로 기존 심볼 재사용(비채택 인라인 텍스트 관례 정합).
- **W1 (convention·rationale)**: 비목표 결정을 신규 Rationale 산문뿐 아니라 기존 **`## 8. 비-목표`** 목록 + Rationale `#### 비-목표 (범위 밖)` 목록에 등재(본문/Rationale 분리). → 반영.
- cross_spec disk-write gap → journal 복구(⛔ WARNING, Critical 0). 5/5 Critical 0.

## 체크리스트
- [x] `/consistency-check --spec` BLOCK: NO (W1·W2 반영)
- [x] (1) KB-GR-EX-07 ❌ 비목표 · (2) KB-GR-OB-01 workspace-단위+casing · (3) NF-GR-05 KB 표시 비목표 · (4) §8 비-목표 목록 + Rationale 등재
- [x] doc-guard(spec-link-integrity) 13/13
- [x] commit + PR (본 커밋)
- [x] `task_29ab68ff` 종결 (spec 정직화로 해소)
