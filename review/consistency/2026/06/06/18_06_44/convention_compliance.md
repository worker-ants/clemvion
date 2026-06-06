# 정식 규약 준수 검토 결과

검토 모드: 구현 완료 후 (--impl-done)
대상 문서: `spec/5-system/9-rag-search.md`
검토 범위: `spec/conventions/**` 전체 + diff `origin/main...HEAD`
검토일: 2026-06-06

---

## 발견사항

### [INFO] spec frontmatter `status: partial` 유지 — 현 상태는 규약 적합, 단 승격 시점 검토 권장
- target 위치: `spec/5-system/9-rag-search.md` frontmatter `status: partial`
- 위반 규약: `spec/conventions/spec-impl-evidence.md §3` — `partial` → `implemented` 전이 규칙
- 상세: 현재 `pending_plans: [rag-rerank-followup.md, rag-dynamic-cut.md]` 두 plan 모두 `plan/in-progress/` 에 실존하므로 `spec-pending-plan-existence.test.ts` 가드는 통과. `code:` 4개 경로도 모두 이번 diff 구현 대상 파일(`dynamic-cut.util.ts`, `rag-search.service.ts`)을 포함한다. 본 diff 는 `hnswEfSearchFor` 추가라는 scope-limited 변경이므로 `status: partial` 유지는 정당하다.
- 제안: `rag-dynamic-cut.md` plan 이 완료로 이동할 시점에 `status: implemented` 로 승격 (가드 자동 강제). 현재는 조치 불요.

### [INFO] `code:` 경로에 `dynamic-cut.util.ts` 파일 직접 등재 — 구현 완료 반영 충분
- target 위치: `spec/5-system/9-rag-search.md` frontmatter `code:` 3번째 항목
- 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1` — `code:` glob 매칭 의무
- 상세: `codebase/backend/src/modules/knowledge-base/search/dynamic-cut.util.ts` 가 명시 경로로 등재되어 있고, diff 에서 `hnswEfSearchFor` 함수가 해당 파일에 추가됐다. `spec-code-paths.test.ts` 가드 통과 조건(`status ∈ {partial, implemented}` 시 `≥1 매치 의무`) 충족. 이슈 없음.

### [INFO] `§3.4` 주석 인라인 참조 — 코드·spec 간 단방향 참조, 역방향 누락
- target 위치: `dynamic-cut.util.ts` 신규 추가 블록 주석 `// (spec/5-system/9-rag-search.md §3.4)`, `rag-search.service.ts` 신규 블록 주석 `// (§3.4)`
- 위반 규약: 명시적 금지 규약 없음 (INFO 레벨)
- 상세: 코드에서 spec 으로의 단방향 참조는 SDD 관행으로 적합. spec `§3.4` 본문도 `hnswEfSearchFor` 와 `SET LOCAL hnsw.ef_search = clamp(LIMIT×2, 40, 1000)` 를 명시적으로 서술(`§3.4` 하위 "pgvector HNSW ef_search (recall 보전)" 단락)해 spec↔코드 정합이 맞다.
- 제안: 현재 수준으로 충분. `spec/5-system/9-rag-search.md §3.4` 의 `hnswEfSearchFor` 함수명 명시가 `spec-coverage` audit 에서 구현 참조 증거로 작동.

### [INFO] `HNSW_EF_SEARCH_DEFAULT` / `HNSW_EF_SEARCH_MAX` 상수명 — 명명 규약 적합
- target 위치: `dynamic-cut.util.ts` 신규 상수 `HNSW_EF_SEARCH_DEFAULT`, `HNSW_EF_SEARCH_MAX`
- 위반 규약: 명시 규약 없음 (INFO)
- 상세: `RAG_RECALL_K`, `RAG_INJECT_TOKEN_BUDGET`, `RAG_MAX_INJECT_COUNT` 기존 상수와 동일한 `UPPER_SNAKE_CASE` 패턴을 따른다. 도메인 prefix `HNSW_` 는 pgvector GUC 도메인을 식별하는 명확한 표기. spec `§3.4` 에서 "RAG prefix 명명" 패턴을 기술하며, 이번 상수는 RAG 레이어가 아닌 pgvector 인프라 레이어 상수이므로 `HNSW_` prefix 가 의미적으로 더 정확하다. 규약 위반 없음.

### [INFO] `rerank` 에러 코드(`RERANK_ENDPOINT_FAILED` 등) — `UPPER_SNAKE_CASE` 규약 준수 확인
- target 위치: `spec/5-system/9-rag-search.md §4.2`, `§6` 에러 코드 목록
- 위반 규약: `spec/conventions/error-codes.md §1`, `spec/conventions/node-output.md §3.2`
- 상세: diff 에 에러 코드 신규 추가 없음. 기존 spec 의 `RERANK_ENDPOINT_FAILED` / `RERANK_NO_VALID_RESULTS` / `RERANK_LLM_GRADING_FAILED` / `RERANK_CONFIG_INVALID` 는 모두 `UPPER_SNAKE_CASE`, 도메인 prefix `RERANK_` 패턴을 따른다. `spec/conventions/error-codes.md §1` 의미 기반 명명 원칙 준수. 조치 불요.

---

## 요약

`spec/5-system/9-rag-search.md` 와 관련 구현 diff 는 정식 규약을 전반적으로 준수한다. `spec-impl-evidence.md` frontmatter 스키마(`id`/`status`/`code:`/`pending_plans:`) 가 올바르게 작성됐고, `status: partial` 에 대응하는 `pending_plans:` 두 파일 모두 `plan/in-progress/` 에 실존하며, `code:` 경로도 이번 diff 의 핵심 파일을 포함한다. 신규 상수(`HNSW_EF_SEARCH_DEFAULT`/`MAX`)와 함수(`hnswEfSearchFor`)의 명명은 기존 `RAG_*` 상수 패턴과 일관된 `UPPER_SNAKE_CASE` 를 따르고, 에러 코드는 `UPPER_SNAKE_CASE` + 도메인 prefix 규약을 유지한다. 문서 구조(Overview / 본문 / Rationale 3섹션)도 완비됐다. CRITICAL 또는 WARNING 수준의 규약 위반은 발견되지 않았다.

## 위험도

NONE

STATUS: SUCCESS
