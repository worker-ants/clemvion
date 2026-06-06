# 정식 규약 준수 검토 결과

검토 대상: `spec/5-system/9-rag-search.md` 및 관련 구현 diff (origin/main...HEAD)
검토 모드: 구현 완료 후 (--impl-done, scope=spec/5-system/9-rag-search.md)

---

## 발견사항

### [INFO] `spec/5-system/9-rag-search.md` — `status: partial` 유지 적절성

- target 위치: `spec/5-system/9-rag-search.md` frontmatter (`status: partial`)
- 위반 규약: `spec/conventions/spec-impl-evidence.md §3` (status 라이프사이클 전이 규칙)
- 상세: spec frontmatter 의 `pending_plans:` 에 `plan/in-progress/rag-rerank-followup.md` 와 `plan/in-progress/rag-dynamic-cut.md` 가 등재되어 `status: partial` 유지가 명시적으로 정당화되어 있다. 구현 diff 에서 `dynamic-cut.util.ts` 등이 추가되었으므로 `rag-dynamic-cut.md` plan 이 완료되었을 경우 `status` 승격 검토가 필요할 수 있으나, `rag-rerank-followup.md`(conditional escalate 정량 임계 A/B)가 여전히 in-progress 이므로 현재 `partial` 유지는 적절하다. 자동 가드(`spec-status-lifecycle.test.ts`)가 pending_plans 상태를 추적하므로 plan 완료 시점에 승격 의무가 자동 강제된다.
- 제안: plan `rag-dynamic-cut.md` 가 이번 구현으로 완료 상태라면 `plan/complete/` 로 이동하고 frontmatter `pending_plans:` 를 갱신하여 가드 오탐을 방지한다. `rag-rerank-followup.md` 가 남아 있으므로 `status` 는 `partial` 유지.

---

### [INFO] `rerank.service.ts` 내부 상수 명명 — UPPER_SNAKE_CASE 준수

- target 위치: `codebase/backend/src/modules/knowledge-base/search/rerank.service.ts` (추가된 상수 `ESCALATE_TOP_SCORE_FLOOR`, `ESCALATE_FLAT_REL_GAP`)
- 위반 규약: `spec/conventions/error-codes.md §1` (UPPER_SNAKE_CASE 표기 — 에러 코드 명명 규약의 파생 원칙; `spec/conventions/node-output.md §3.2` 에러 코드 `UPPER_SNAKE_CASE`)
- 상세: 에러 코드 한정 규약이지만, 해당 상수들은 모두 UPPER_SNAKE_CASE 로 일관되게 명명되어 있어 위반 없음. `LLM_GRADING_POOL`, `GRADING_CONTENT_CHARS` 등 기존 상수와 동일 패턴으로 추가됨.
- 제안: 없음. 현행 준수.

---

### [INFO] `RerankDiagnostics` — 새 필드 `gradingNoGrounding` spec 페이로드와 일치 확인

- target 위치: `codebase/backend/src/modules/knowledge-base/search/rerank.service.ts` 인터페이스 `RerankDiagnostics` + `spec/5-system/9-rag-search.md §4.2`
- 위반 규약: `spec/conventions/node-output.md §3` (출력 포맷 규약 — 에러·진단 페이로드 형태)
- 상세: spec §4.2 의 `rerank` 서브객체 JSON 예시에 `gradingNoGrounding: false` 가 포함되어 있고, 구현의 `RerankDiagnostics` 인터페이스에도 동일 필드가 추가됨. 이름·타입·의미가 spec 과 1:1 일치한다. `error` 필드는 `null | string` (UPPER_SNAKE_CASE 코드) 규약을 그대로 유지한다.
- 제안: 없음. 현행 준수.

---

### [INFO] `RerankParams` — `topK` → `injectCap` + `tokenBudget` 분리 — 외부 API 계약 영향 없음

- target 위치: `codebase/backend/src/modules/knowledge-base/search/rerank.service.ts` 인터페이스 `RerankParams`
- 위반 규약: `spec/conventions/error-codes.md §2` (rename 은 breaking change — 에러 코드 한정이나 공개 인터페이스 안정성 원칙과 유사)
- 상세: `topK` 가 `injectCap` + `tokenBudget` 으로 교체되었다. `RerankParams` 는 `RagSearchService` 내부에서 `RerankService` 를 호출할 때만 사용하는 **내부 private 인터페이스**로, 외부 API 응답·클라이언트 계약에는 영향이 없다. spec §4.2 의 `ragDiagnostics.rerank` 외부 스키마는 불변이고, `top_k` / `threshold` KB tool 인터페이스도 불변(§2.1)이다. 따라서 breaking change 에 해당하지 않는다.
- 제안: 없음. 내부 인터페이스 변경이므로 규약 위반 아님.

---

### [INFO] i18n 규약 — 라벨·힌트 변경의 `backend-labels.ts` 동시 갱신 확인

- target 위치: `codebase/frontend/src/lib/i18n/backend-labels.ts` (diff 포함)
- 위반 규약: `spec/conventions/i18n-userguide.md Principle 3-B` (backend `ui.label`/`hint` 변경 시 `LABEL_KO`/`HINT_KO` 동시 갱신 의무)
- 상세: diff 에서 `ai-agent.schema.ts` 의 `ragTopK` label 이 `"RAG Top-K (default)"` → `"RAG Top-K (cap)"` 으로, hint 가 변경되었다. `backend-labels.ts` diff 를 보면 `LABEL_KO` 에서 `"RAG Top-K (default)": "RAG Top-K (기본값)"` 엔트리가 `"RAG Top-K (cap)": "RAG Top-K (상한)"` 으로 교체되었고, `HINT_KO` 에서도 구 hint 키가 신 hint 키로 교체되었다. Principle 3-B 의 "동일 PR 안에서 갱신" 의무를 충족한다.
- 제안: 없음. 현행 준수.

---

### [INFO] 사용자 가이드 MDX 동기화 — 영/한 sibling 동시 갱신 확인

- target 위치: `codebase/frontend/src/content/docs/02-nodes/ai.mdx`, `ai.en.mdx`, `06-integrations-and-config/knowledge-base.mdx`, `knowledge-base.en.mdx`
- 위반 규약: `spec/conventions/i18n-userguide.md Principle 5` (canonical `.mdx` + 영어 sibling `.en.mdx` 동시 갱신)
- 상세: 4개 파일(한/영 pair × 2 문서) 모두 diff 에 포함되어 `ragTopK` 설명·default 값 문자열이 동시 갱신되었다. Principle 5 의 sibling 동시 갱신 의무를 충족한다.
- 제안: 없음. 현행 준수.

---

### [INFO] `applyLlmGrading` 반환 타입 — 내부 판별자 `applied: boolean` → `outcome: 'applied' | 'no_grounding' | 'failed'` 변경

- target 위치: `codebase/backend/src/modules/knowledge-base/search/rerank.service.ts` private `applyLlmGrading()` 반환 타입
- 위반 규약: 없음 (private method, 외부 계약 아님)
- 상세: 변경이 private method 내부에 국한되며, 외부 `RerankResponse`·`RerankDiagnostics` 스키마에는 변화가 없다. spec §3.3.2 의 `outcome` 기술과 구현이 일치한다.
- 제안: 없음.

---

## 요약

`spec/5-system/9-rag-search.md` 를 구현한 diff 는 정식 규약(`spec/conventions/`) 관점에서 주요 위반 사항이 없다. 에러 코드는 `UPPER_SNAKE_CASE`(`RERANK_ENDPOINT_FAILED` 등)를 준수하고, 진단 페이로드(`RerankDiagnostics.gradingNoGrounding`)는 spec §4.2 JSON 스키마와 1:1 일치한다. i18n Principle 3-B 에 따른 `LABEL_KO`·`HINT_KO` 동시 갱신, Principle 5 에 따른 영/한 MDX sibling 동시 갱신도 확인된다. `RerankParams.topK → injectCap + tokenBudget` 교체는 내부 서비스 인터페이스 범위이므로 외부 API 계약에 영향 없다. spec frontmatter `status: partial` 유지는 `rag-rerank-followup.md` 미완료를 감안하면 적절하며, `rag-dynamic-cut.md` plan 완료 여부에 따라 `pending_plans` 갱신이 필요할 수 있다 (자동 가드 대상).

## 위험도

NONE
