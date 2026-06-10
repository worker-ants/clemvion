---
name: models-rename-docs-unify-followup
worktree: (unstarted)
status: pending
started: 2026-06-11
owner: developer
related_spec:
  - spec/2-navigation/6-config.md
  - spec/2-navigation/_product-overview.md
  - spec/2-navigation/13-user-guide.md
  - spec/4-nodes/3-ai/0-common.md
related_plan:
  - plan/in-progress/unified-model-management.md
---
# Followup — LLM→Models 명칭 전파 + user-guide 페이지 통합

> 분리 사유: Unified Model Management 의 R-3(통합 `/models` 화면) 결정은 spec·코드에 반영됐으나,
> 다수 cross-reference spec 의 **구 "LLM Config" 명칭/앵커**와 **user-guide MDX 페이지 구조**가
> 아직 통합 전이다. `--impl-done`(`review/consistency/2026/06/11/01_04_49`, BLOCK:NO)에서
> 비차단 WARNING 으로 식별. 앵커 정합·docs deep-link 영향이 커 별도 focused 작업으로 분리한다.

## 작업 항목 (consistency `01_04_49` WARNING 매핑)

1. **W-4/W-9 — `_product-overview.md §3.7` heading 갱신**
   `### 3.7 Config — LLM (LLM 설정)` → `### 3.7 Config — Models (모델 설정)`.
   앵커가 `#37-config--llm-llm-설정` → 변경되므로 **모든 referrer 동반 수정**:
   - `spec/2-navigation/6-config.md:23`
   - `spec/4-nodes/3-ai/_product-overview.md:3`
   (변경 후 `grep -rn "37-config--llm"` 0건 확인.)

2. **W-10 — `spec/4-nodes/3-ai/**` 링크 텍스트 통일**
   `[Spec LLM Config](../../2-navigation/6-config.md)` 링크 **텍스트**(URL 불변)를
   `[Spec 설정 — Models]` 로 통일. 대상 6곳: `0-common.md:17·33`, `1-ai-agent.md:20`,
   `2-text-classifier.md:12`, `3-information-extractor.md:13`, `_product-overview.md:3`.

3. **W-11 + INFO13/14/15 — user-guide 페이지 통합**
   `spec/2-navigation/13-user-guide.md` IA(line 62)는 통합 `models` doc 페이지를 선언하나
   실제 파일은 `06-integrations-and-config/llm-config.{mdx,en.mdx}` +
   `rerank-config.{mdx,en.mdx}` 로 분리돼 있음. 통합:
   - `models.mdx` / `models.en.mdx` 신설(Chat/Embedding/Rerank 3절) 또는 기존 2쌍 rename/병합.
   - **Embedding 탭 가이드 절 신규 작성**(INFO14, 현재 미작성).
   - 구 API 경로 표기(`/api/llm-configs/…`)를 통합 `/api/model-configs?kind=` 로 교체·병기(INFO13).
   - 버튼 레이블 문서 표기 `[+ Add Provider]` → 실제 UI 텍스트 `[+ Add Model]`(INFO15).
   - 구 slug(`llm-config`,`rerank-config`)로의 deep-link(spec frontmatter·타 가이드) 영향 확인 +
     `SECTION_LABELS_BY_LOCALE` / IA 등록 동기화. `user-guide-writer` sub-agent 위임 권장.
   - 통합 후 doc 가드(`impl-anchor-existence`/`integrations-coverage`/`locale`) 통과 확인.

## PR4 연계 (별도 추적 — 본 followup 와 독립)

- `spec/2-navigation/_layout.md`·`13-user-guide.md` Rationale 에 R-3 파생 근거 한 줄(I-4·I-5).
- PR4(레거시 제거) 시 `6-config.md` `code:` 의 구 `llm-configs/`·`rerank-configs/` glob 제거 +
  사이드바·i18n 레거시 키(`llmConfig`,`reranker`) 제거(코드리뷰 INFO8).

## 본 PR(PR3)에서 처리 안 한 비관련 WARNING (참고)

> 본 통합작업과 무관 — 각 담당 영역에서 별도 처리.
- **W-2**: `spec/0-overview.md §6.1` 에 Agent Memory 화면 미등재 — agent-memory 영역 소관.
- **W-5**: `spec/2-navigation/14-execution-history.md` `## Rationale` 절 누락 — 해당 spec 소관.
- **W-6**: `spec/2-navigation/6-config.md` `## Overview` 절 미보유(3섹션 패턴) — planner 구조 정리 소관.
