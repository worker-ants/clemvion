---
worktree: graph-rag-doc-fix
started: 2026-06-27
owner: project-planner
status: complete
completed: 2026-06-27
spec_impact:
  - spec/5-system/10-graph-rag.md
base: origin/main @ 7af855f64 (#723 포함)
source: #720 impl-done(spec/5-system/) 가 노출한 pre-existing nav-doc 결함 (별 트랙 deferred, 순서 2/3)
---

# 10-graph-rag.md doc 정합 (consistency-check 노출 pre-existing)

#720 의 consistency-check --impl-done 가 노출한 `spec/5-system/10-graph-rag.md` 문서 결함 2건.
**코드 변경 없음.** (검증 완료 — 둘 다 실재 결함.)

## 대상 — 형제 spec(8·9) 대조로 두 #720 WARNING 모두 재판정

**핵심**: 8-embedding-pipeline·9-rag-search 모두 `## Overview (제품 정의)` + `## 1. 개요` 동일 구조이고,
관련 문서 블록은 `[PRD AI & 지식 저장소](../4-nodes/3-ai/_product-overview.md)` 로 **공유 PRD 를 가리킨다**.
→ #720 가 올린 두 WARNING 을 형제 대조로 재판정:

1. **dual overview (#720 WARNING 2) — FALSE POSITIVE, 수정 안 함**. `## Overview (제품 정의)` + `## 1. 개요`
   는 8·9·10 전 system spec 공통 **확립 컨벤션**(PRD 절 + 기술 본문 intro)이지 버그가 아니다. 최초 rename
   (`## 1. 아키텍처 흐름`)은 10 만 형제와 어긋나게 만들어 오히려 inconsistency 유발(--spec INFO 1 가 포착)
   → **`## 1. 개요` 로 revert**.
2. **self-referential 링크 (#720 WARNING 1) — 실재 버그, 컨벤션대로 수정**. line 25 `[PRD Graph RAG](./10-graph-rag.md)`
   self-link 은 8·9 의 `[PRD AI & 지식 저장소](../4-nodes/3-ai/_product-overview.md)`(공유 도메인 PRD, graph-rag
   상세를 본 파일로 위임) 패턴과 어긋난 anomaly. **삭제가 아니라 8·9 와 동일하게 공유 PRD 링크로 교체**.

## 최종 변경 (10-graph-rag.md 1줄)

- line 25 관련 문서: `[PRD Graph RAG](./10-graph-rag.md)` → `[PRD AI & 지식 저장소](../4-nodes/3-ai/_product-overview.md)`.
- (§1 헤딩 무변경 — 컨벤션 유지.)

## 안전성 (검증 완료)

- 8·9 자기참조 self-link 없음 — 10 의 self-link 이 anomaly 확인. 교체 대상 `_product-overview.md` 실재·graph-rag 위임 명시 확인.
- self-link 은 line 25 단 1곳.

## 게이트

- [x] consistency-check --spec — 1차(20_02_06, BLOCK NO) INFO 가 형제 divergence 포착 → 정정 → 2차(20_09_05) **BLOCK NO** (정정안 형제 컨벤션 정합)
- (planner: spec/** 본문만. 코드/테스트 없음 → /ai-review·--impl-done 불요)

## 완료

10-graph-rag.md self-link 1줄 정정(공유 PRD 링크, 8·9 컨벤션). dual-overview rename 은 false-positive 로 미적용(revert). 게이트 통과.

## 미포함 (별 트랙)

- 순서 3: `security-backlog-invitation-token-hash` plan — §1.5.D "raw 유지" 확정 반영 + complete 처리.
