---
name: kb-unsearchable-warning
owner: developer
worktree: .claude/worktrees/kb-unsearchable-warning-b47e20
started: 2026-06-06
spec_impact:
  - spec/5-system/9-rag-search.md
  - spec/2-navigation/5-knowledge-base.md
  - spec/5-system/8-embedding-pipeline.md
---

# KB 검색 불가(재임베딩 필요/진행 중) 신호화 + 목록 경고

## 배경 / 근본원인 (분석 완료)

AI 에이전트 KB 도구(`kb_<uuid>`) 호출이 어떤 쿼리든 0건. 데이터 변동 없음.

- 근본원인: 해당 KB의 `knowledge_base.embedding_dimension` 이 NULL.
  - 검색 코드가 NULL이면 KB를 **조용히 스킵**: `rag-search.service.ts:352`(vector), `:271`(rerank), `:379` `isGraphKbSearchable`(graph) → 빈 배열.
  - `embedding_dimension` 은 V021 추가, 첫 임베딩 완료 시 채워짐(`embedding.service.ts:259-266`). 모델 변경(`knowledge-base.service.ts:152` `update()`) 또는 `reEmbedAll()`(`:569`)에서 NULL로 초기화. NULL = "모델 변경/재임베딩 시작 후 임베딩 미완료".
  - `update()` 는 모델 변경 시 dimension만 NULL로 두고 재임베딩을 자동 트리거하지 않음 → 사용자가 수동 재임베딩 안 하면 KB가 **경고 없이 영구 검색불가**.
- `embedding_dimension` 은 "모델 출력 차원"이 아니라 "현재 저장된 청크 벡터의 실제 차원". probe(테스트) 차원을 미리 저장하면 stale/mismatch 검색이 되므로 채택 안 함. NULL→스킵 가드는 올바른 안전장치로 유지하되 **silent 를 제거**하는 게 목표.

## 두 NULL 케이스

| 상태 | 의미 |
|---|---|
| dimension NULL + `reembedStatus='in_progress'` | 재임베딩 진행 중 |
| dimension NULL + `reembedStatus='idle'` | 모델 변경 후 재임베딩 미실행 — 영구 검색불가 구멍 |

게이트 = `embedding_dimension IS NULL`. `reembedStatus` 로 메시지 변형.

## 결정 (사용자 confirm 2026-06-06)

- 에이전트 노출: **신규 tool_result 봉투 + note** (`status:"not_searchable"` + `reason` + `note` + `ragDiagnostics.skipReason`). 기존 `grounding:"none"` 패턴과 동일 계열.
- 범위: **경고 노출만** (A 백엔드 신호 + B 목록 카드 경고). `update()` 자동 재임베딩/차단은 **follow-up 분리** → `plan/in-progress/kb-model-change-reembed-followup.md` (PR 머지 전 신설 예정).

## 설계안

### (A) 백엔드 신호
- `RagSearchService.searchWithMeta` — NULL 게이트에서 스킵 유지 + "왜 비었는지" 반환. 후보: `SearchWithMetaResult.unsearchable?: { kbId: string; reason: 'reembedding_in_progress' | 'reembedding_required' }[]` (KB 메타에 이미 `reembed_status` 조회됨 — KbRow 확장).
- `KbToolProvider.execute` — `unsearchable` 있으면 신규 봉투로 변환:
  ```json
  { "kb":"...", "query":"...", "status":"not_searchable",
    "reason":"reembedding_required",
    "note":"This knowledge base is being (re)embedded and is temporarily unsearchable. Tell the user it needs re-embedding; do not claim the KB is empty or fabricate an answer.",
    "results":[] }
  ```
  + `ragDiagnosticsDelta` 에 `skipReason: 'kb_unsearchable'`.

### (B) 프론트 /knowledge-bases 카드
- `embeddingDimension == null` 일 때 경고 배지:
  - `reembedStatus==='in_progress'` → "재임베딩 중" (amber/스피너)
  - `reembedStatus==='idle'` → "재임베딩 필요 · 검색 불가" (경고색)
- i18n ko/en dict 키 추가.

## Spec 변경 (project-planner 위임 — developer read-only)
- `spec/5-system/9-rag-search.md`: §2.2 신규 봉투, §4.2 `skipReason: kb_unsearchable`, §6 에러표 행 추가.
- `spec/2-navigation/5-knowledge-base.md`: §2.2.1 목록 카드 경고.

## 체크리스트
- [x] spec 변경 (project-planner) — 9-rag-search §2.2/§3.1/§4.2/§5/§6/Rationale, 2-navigation/5-knowledge-base §2.1/§2.2.1/R-2 + status:partial, 8-embedding-pipeline §7.3. `consistency-check --spec` 21_40_26 **BLOCK: NO** (WARNING 6 전부 반영: skipReason 우선순위·봉투 판별 우선순위·사전차단 경로·snake_case 규약·plan owner·5-kb status partial)
- [x] `consistency-check --impl-prep` — `--spec` 21_40_26 가 동일 영역·동일 내용 5관점(cross-spec/rationale/convention/plan/naming)을 BLOCK:NO 로 통과(WARNING 전부 반영). impl-prep 와 동일 검사라 즉시 재실행 생략, 종료 게이트 `--impl-done` 로 정합 보증.
- [x] DOCUMENTATION — user-guide 동반 갱신 매트릭스 trigger 무매칭(KB 목록 카드 상태 배지는 노드 schema/통합/인증/GUI 흐름 절 아님). 추가 i18n 키(reembeddingRequired/InProgress)는 ui-label-parity 로 커버. ai-review 의 user-guide-sync-reviewer 최종 확인.
- [x] 테스트 선작성·보강 (backend: searchWithMeta unsearchable reason·mixed, KbToolProvider not_searchable 봉투·reason 매핑, handler skipReason kb_unsearchable; frontend: 카드 경고 3종)
- [x] 구현 (A 백엔드 + B 프론트) — 커밋 1b41ec56
- [x] follow-up plan 신설 (kb-model-change-reembed-followup)
- [x] TEST WORKFLOW — lint ✓ / unit ✓ (40) / build ✓ / e2e ✓ (176). + pre-existing main red 부수 수정(pr2a Gate C spec_impact, 커밋 4d013d9e)
- [x] /ai-review 22_20_59 — **Critical 0 / 위험도 LOW**. summary sub-agent 가 주간 한도로 실패→main 이 12 reviewer 직접 합성(SUMMARY.md). WARNING 6(naming/JSDoc/주석 nit) refactor bd9a8d98 로 조치 + RESOLUTION.md. fix 후 lint/unit/build/e2e 재통과.
- [x] `consistency-check --impl-done` 07_15_48 **BLOCK: NO** (Critical 0). WARNING#1(follow-up plan spec 선갱신 의무 명문화) 반영. INFO 다수는 선택적 보강.
- [ ] 완료 시 5-knowledge-base.md status partial→implemented 복귀 + 양 spec pending_plans 에서 본 plan 제거
