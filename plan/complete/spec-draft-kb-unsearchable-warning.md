---
worktree: (complete)
started: 2026-06-02
completed: 2026-06-10
spec_impact:
  - spec/5-system/9-rag-search.md
  - spec/2-navigation/5-knowledge-base.md
  - spec/5-system/8-embedding-pipeline.md
owner: project-planner
---

# Spec draft: KB 검색 불가(재임베딩 필요/진행 중) 신호화 + 목록 경고

대상 spec 3개. 구현은 developer 후속 (codebase 변경 없음, 본 draft 는 spec 한정).

## 문제 정의

`knowledge_base.embedding_dimension` 이 NULL 이면 `RagSearchService` 가 해당 KB 를 검색에서 제외한다(저장 청크가 신규 query 와 차원/공간 불일치 → stale 검색 방지로 올바름). 그러나 현재는 빈 결과(`results: []`)를 반환해 **"KB 가 비었음"과 구분되지 않는 silent** 가 된다. 에이전트는 "근거 없음"으로 오인해 환각하거나 "자료가 없다"고 잘못 답한다.

NULL 의 두 원인:
1. `reembed_status='in_progress'` — 재임베딩 진행 중 (일시적, 완료 후 복구).
2. `reembed_status='idle'` + dimension NULL — 임베딩 모델을 변경(`update()`)했으나 재임베딩 미실행. **영구 검색불가 구멍** (사용자가 수동 재임베딩 전까지 지속).

기존 spec(8-embedding-pipeline §line 249)은 (1)만 "자연스럽게 제외"로 다루고 (2)를 누락하며, 두 경우 모두 에이전트/사용자에게 알리지 않는다.

## 변경 1: spec/5-system/9-rag-search.md

### §2.2 KB tool 결과 포맷 — 신규 봉투 추가
기존 `error:"search_failed"`·`grounding:"none"` 봉투와 같은 계열로, KB 검색 불가 봉투 추가:

```json
{
  "kb": "요금제 안내",
  "query": "요금제 종류",
  "status": "not_searchable",
  "reason": "reembedding_required",
  "note": "This knowledge base is being (re)embedded and is temporarily unsearchable. Tell the user it needs re-embedding (or is in progress); do not claim the KB is empty or fabricate an answer.",
  "results": []
}
```
- `reason`: `reembedding_in_progress` (reembed_status='in_progress') / `reembedding_required` (idle + dimension NULL).
- `grounding:"none"`(line 130) 절과 유사하게, 이 신호를 받은 에이전트는 해당 KB 기반 답변을 만들지 않고 "재임베딩 필요/진행 중"을 사용자에게 명시한다(오인·환각 억제). `search_failed`(일시 인프라 오류)와 구분 — `not_searchable` 은 데이터 적재 상태 문제로, 재시도해도 동일.

### §4.2 ragDiagnostics — skipReason 확장
`skipReason` enum 에 `kb_unsearchable` 추가. 현재: `empty_kb_list`(KB 미설정) / `no_results`(모든 호출 0건). 신규: `kb_unsearchable`(호출 KB 가 embedding_dimension NULL 로 검색 제외 — 재임베딩 필요/진행 중). `no_results` 와 구분: 후자는 검색은 됐으나 임계 미달, 전자는 검색 자체가 불가.

### §6 에러 처리 표 — 신규 행
"검색 결과 0건" 행과 **구분되는** 행 추가:

| 상황 | 처리 |
|---|---|
| KB 검색 불가 (embedding_dimension NULL: 모델 변경 후 미재임베딩 `reembedding_required` / 재임베딩 진행 중 `reembedding_in_progress`) | §2.2 `status:"not_searchable"` 봉투 + `note` 로 에이전트에 전달. `ragDiagnostics.skipReason="kb_unsearchable"`. **노드 실패 아님**(graceful) — 에이전트가 "재임베딩 필요/진행 중"을 사용자에게 안내. stale 벡터 검색은 의도적으로 수행하지 않음 ([§5 임베딩 모델 일관성](#5-임베딩-모델-일관성), [임베딩 파이프라인 §5.4/§7.3](./8-embedding-pipeline.md)) |

> 원칙 보강: 검색 불가(`not_searchable`)는 일시 실패(`search_failed`)와 달리 **데이터 적재 상태** 문제이므로, 에이전트가 사용자에게 "재임베딩이 필요/진행 중"임을 안내하도록 한다(빈 KB·무관 결과로 오인 금지).

### §5 (cross-ref) / Rationale
- §5 임베딩 모델 일관성 절에 NULL dimension = "현재 저장 청크의 실제 차원이 미확정/모델 변경 후 미재임베딩 상태"임을 1줄 명시 (이미 8-embedding §5.4 와 연결).
- Rationale 추가: "왜 silent 제외를 신호로 바꿨나" — NULL→스킵(stale 방지)은 유지하되, 빈 결과가 빈-KB 와 구분 안 돼 에이전트 환각/오답을 유발 → `not_searchable` 명시 신호로 graceful 안내. probe 차원을 미리 저장하는 대안은 기각(저장 청크가 옛 차원/공간이라 dimension 만 채우면 stale/mismatch 검색이 됨 — dimension 은 "모델 출력 차원"이 아니라 "저장 청크 실제 차원"). 모델 변경 시 자동 재임베딩/차단은 본 변경 범위 밖(follow-up).

## 변경 2: spec/2-navigation/5-knowledge-base.md

### §2.2.1 컬렉션 카드 (목록) — 검색 불가 경고
카드에 검색불가 경고 추가. `embeddingDimension == null` 일 때:
- `reembedStatus==='in_progress'` → "재임베딩 중" 표시 (진행/amber, 검색 일시 제외 안내).
- `reembedStatus==='idle'` → "재임베딩 필요 · 검색 불가" 경고(경고색) — 모델 변경 후 미재임베딩.

ASCII 카드 예시에 경고 줄 추가. line 68 "임베딩 모델 변경 경고"(편집 폼 인라인)와 **별개**: 그것은 폼에서 모델을 바꾸는 시점 경고, 본 항목은 **목록 카드에서 이미 검색불가 상태가 된 KB** 를 발견성 있게 표시(에이전트 검색이 조용히 0건 나는 것을 사용자가 목록에서 인지). `reembedStatus`·`embeddingDimension` 은 이미 응답 DTO·프론트 타입에 존재.

### §2.1 컬렉션 목록 — 임베딩 상태 항목 보강(선택)
"임베딩 상태" 행에 "재임베딩 필요/진행(검색 제외)" 상태를 포함하도록 1줄 보강(카드와 일관).

### Rationale (R-추가)
"왜 목록 카드에 검색불가 경고를 두나": 에이전트의 KB 검색이 조용히 0건 나는 회귀를 사용자가 빨리 인지하려면, 검색불가 상태(dimension NULL)를 KB 목록에서 노출해야 한다. 편집 폼 인라인 경고(모델 변경 시점)만으로는 "변경했지만 재임베딩 안 한 채 잊은" 영구 구멍을 잡지 못한다.

## 변경 3 (side-effect 정합): spec/5-system/8-embedding-pipeline.md

### §line 249 보강
현재: "`reembed_status` 가 `in_progress` 인 KB 는 `embedding_dimension` 이 NULL 이므로 `RagSearchService` 에서 자연스럽게 검색 대상에서 제외된다 (재임베딩 완료 후 다시 포함)."
→ 보강: (a) `idle` + dimension NULL(모델 변경 후 미재임베딩) 케이스도 동일하게 제외됨을 명시, (b) "자연스럽게 제외(silent)"가 아니라 에이전트에는 `not_searchable` 신호로 전달됨을 cross-ref ([RAG 검색 §2.2/§6](./9-rag-search.md#6-에러-처리)), (c) UI 목록 카드 경고([Knowledge Base §2.2.1](../2-navigation/5-knowledge-base.md)) cross-ref.

## Rationale 공통
- 신규 KB/노드 config 필드 없음. `reembedStatus`/`embeddingDimension` 기존 필드 재사용. 신규 진단값(`kb_unsearchable`)·tool_result 키(`status/reason/note`)만 추가 — 기존 `grounding:"none"` 선례와 동형.
- 범위 한정(경고 노출만): `update()` 모델 변경 시 자동 재임베딩 트리거/저장 차단은 비용·UX 정책 결정이 더 필요해 별도 follow-up(`plan/in-progress/kb-model-change-reembed-followup.md`)으로 분리.
