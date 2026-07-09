---
worktree: nav-spec-cleanup-f2dc5e
started: 2026-07-09
completed: 2026-07-09
owner: project-planner
spec_impact:
  - spec/2-navigation/11-error-empty-states.md
  - spec/2-navigation/14-execution-history.md
  - spec/2-navigation/_product-overview.md
  - spec/0-overview.md
  - spec/conventions/conversation-thread.md
---

# spec-draft: 2-navigation spec 정리 (impl-done 후속)

에디터 slug화(phase 2, #869) `/consistency-check --impl-done`(review/consistency/2026/07/09/14_08_26)이
남긴 문서 정합 INFO/WARNING 2건 정리. 순수 spec-doc, 코드·데이터모델·API 무변경.

## 변경

### 1. `spec/2-navigation/11-error-empty-states.md` — evidence 정밀화 (impl-done INFO)
- frontmatter `code:` 에 `lib/workspace/workspace-slug-gate.tsx`·`lib/workspace/resolve-fallback.ts` 추가.
- §1.3 무효-slug redirect 인용을 phase 2 실제 위치로 정정: `[slug] layout` → 공용 `WorkspaceSlugGate`
  (폴백 규칙 `resolve-fallback.ts` 의 `resolveFallbackWorkspace`), `(main)`·`(editor)` 양 layout 공유.

### 2. `spec/2-navigation/14-execution-history.md` — Overview 구조 정합 (impl-done convention WARNING)
- 이 파일만 유일하게 자체 `## Overview (제품 정의)` 안에 **요구사항-ID 매트릭스**(EH-LIST/EH-DETAIL/EH-NAV)를
  보유해 형제(`0-dashboard`·`1-workflow-list`·`10-auth-flow`·`11-error`·`15-system-status` = 2섹션 패턴)와
  이질적이었다. (`6-config.md` 도 `## Overview` 헤딩은 있으나 범위-설명 문단이라 매트릭스 케이스와 다름.) EH-* 매트릭스를 `_product-overview.md §3.15 Execution History`(형제 요구사항이 모여 있는
  단일 SoT)로 이관하고, 본 파일은 `## 1. 개요`부터 시작하는 **2섹션(본문 + Rationale)** 구조로 정리.
- cross-ref 무손상 확인: 14-execution-history 로 오는 링크는 전부 본문 anchor(§2.4·§3·§3.7 등)이며
  Overview/EH-* 매트릭스 anchor 참조는 없음. EH-DETAIL-06 clarifier·EH-DETAIL-12(#867) 는 이관 매트릭스에 **verbatim** 보존.
- **파급 정리**(consistency-check --spec 이 지적): (a) 14-execution `## Rationale` R-6 의 "이 문서" 자기참조를
  `_product-overview.md §3.15` 로 갱신. (b) `0-overview.md §4` "실행 이력" 행은 "내비게이션 → `_product-overview.md`"
  행과 중복이 되어 제거. (c) `0-overview.md §6.3` 로드맵의 EH-DETAIL-12 링크를 `_product-overview.md §3.15` 로 재배선.
  (d) `conventions/conversation-thread.md §9.3`(417줄)의 EH-DETAIL-12 **위임 링크**를 `_product-overview.md §3.15`
  로 갱신 — 이관으로 dangling 위임(R-6 이 고친 그 패턴)이 재현되지 않게. (1-ai-agent·data-hydration-surfaces·
  conversation-thread 의 나머지 EH-DETAIL-12 언급은 bare ID 라 불변.)
- **stale-base 주의**: 초기 `ensure-worktree.sh` 가 stale 로컬 origin/main(#866)에서 워크트리를 만들어 #867/#869
  미포함이었고, consistency-check --spec 이 이를 BLOCK 으로 정확히 포착. `git reset --hard origin/main`(#869)으로
  바로잡은 뒤 fresh base 에서 재작업했다.

## Rationale
- `_product-overview.md §3.x` 가 2-navigation 영역별 **요구사항 매트릭스의 단일 SoT**(NAV-WF/NAV-TR/...).
  실행 내역도 nav 영역이므로 EH-* 도 같은 자리에 있어야 형제와 정합(현 상태가 anomaly). spec-impl-evidence
  `code:` 정밀화는 신규 `WorkspaceSlugGate` 파일의 추적성 향상. 둘 다 impl-done 이 지적한 후속.
