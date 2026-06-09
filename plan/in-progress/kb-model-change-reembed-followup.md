---
name: kb-model-change-reembed-followup
owner: developer
worktree: (unstarted)
started: 2026-06-06
---

# KB 임베딩 모델 변경 시 재임베딩 미트리거 — 근본 원인 후속

## 배경

`kb-unsearchable-warning` (PR #508)은 `embedding_dimension == null` KB의 검색 불가를
**신호로 노출**하는 데 집중했다. 그러나 근본 원인은 그대로 남아 있다:

`KnowledgeBaseService.update()` (`knowledge-base.service.ts:152`)는 임베딩 모델을
바꾸면 `embedding_dimension` 을 NULL 로 초기화하지만 **재임베딩을 자동 트리거하지
않고, 문서 embedding_status 도 건드리지 않는다**. 사용자가 수동으로 `reEmbedAll` 을
실행하지 않으면 KB 는 **경고만 뜬 채 영구 검색 불가** 상태로 남는다.

## 검토할 선택지 (비용·UX 정책 결정 필요)

1. **모델 변경 시 재임베딩 자동 트리거** — `update()` 가 모델 변경을 감지하면
   `reEmbedAll` 을 fire-and-forget 큐잉. 단 graph 모드는 추출 LLM 비용이 추가로
   발생하므로 비용 통제와 상충(현재 spec은 "비용 통제 위해 수동 트리거" 명시).
2. **저장 차단 + 강제 확인 모달** — 모델 변경 저장 시 "재임베딩이 필요하며 비용이
   발생합니다. 지금 시작할까요?" 확인을 강제. 사용자가 명시 동의해야 저장.
3. **변경 후 재임베딩 미실행 상태를 더 강하게 노출** — 본 PR의 목록 경고에 더해
   KB 상세 상단에도 배너 + "지금 재임베딩" CTA.

## 관련 SoT
- `spec/2-navigation/5-knowledge-base.md` §2.2 임베딩 모델 변경 경고 / §2.4.1 진행 박스
- `spec/5-system/8-embedding-pipeline.md` §7.3 재임베딩
- `spec/5-system/9-rag-search.md` §6 (not_searchable 신호 — 본 PR에서 도입)

## 비고
spec 변경(정책 결정 반영)이 필요하므로 착수 시 project-planner 선행.
