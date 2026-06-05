# 유저 가이드 동반 갱신(User Guide Sync) 검토 결과

검토 일시: 2026-06-05  
대상 브랜치: rag-rerank-followup-864891 (origin/main 대비)  
매트릭스 SSOT: `.claude/config/doc-sync-matrix.json` (rows 19개)  
매칭된 trigger: `integration-provider-change` (2건)

---

## 발견사항

### [WARNING] RerankConfig 관리 화면 신규 추가 — user-guide docs MDX 누락

- **변경 파일**: `codebase/frontend/src/app/(main)/rerank-configs/page.tsx` (신규), `codebase/frontend/src/components/layout/sidebar.tsx` (`sidebar.reranker` 항목 추가)
- **매트릭스 항목**: `integration-provider-change` — "통합 신규/제공자 변경": `codebase/frontend/src/content/docs/06-integrations-and-config/<provider>.{mdx,en.mdx}` + dict 키
- **누락된 동반 갱신**:
  - `codebase/frontend/src/content/docs/06-integrations-and-config/rerank-config.mdx` (신규 미생성)
  - `codebase/frontend/src/content/docs/06-integrations-and-config/rerank-config.en.mdx` (신규 미생성)
- **상세**: `/rerank-configs` 경로의 RerankConfig 관리 화면이 신규 추가되었다. 사이드바에 "리랭커" 항목이 등장하고 CRUD UI가 완전히 구현됐으나, 이에 대응하는 user-guide MDX 페이지가 없다. 동일 패턴인 LLM Config는 `llm-config.mdx` + `llm-config.en.mdx`(각 104줄)가 존재한다. spec/2-navigation/6-config.md Part C에 RerankConfig 관리 화면의 상세 UI 스펙(C.1~C.3)이 기술되어 있어 docs 작성의 근거는 충분하다. i18n dict(ko/en `rerankConfigs.ts`)는 양쪽 모두 추가되어 i18n parity는 충족된다.
- **제안**: `codebase/frontend/src/content/docs/06-integrations-and-config/rerank-config.mdx`와 `rerank-config.en.mdx`를 신규 작성한다. 내용 근거는 `spec/2-navigation/6-config.md §Part C` (C.1 화면 구조, C.2 추가/수정 필드, C.3 기본 설정)와 `llm-config.mdx` 패턴(frontmatter `spec:`, `code:` glob, 프로바이더 표, 추가 단계 절차, 에러 코드 표)을 참고한다.

---

### [WARNING] KB 폼 리랭킹 탭 신규 추가 — knowledge-base 유저 가이드 갱신 누락

- **변경 파일**: `codebase/frontend/src/components/knowledge-base/kb-form-body.tsx` (rerank 탭 신규), `codebase/frontend/src/lib/i18n/dict/{ko,en}/knowledgeBases.ts` (`formTabRerank`, `rerankMode`, `rerankConfig` 등 20개 키 추가)
- **매트릭스 항목**: `integration-provider-change` — "통합 신규/제공자 변경": `codebase/frontend/src/content/docs/06-integrations-and-config/<provider>.{mdx,en.mdx}` + dict 키
- **누락된 동반 갱신**:
  - `codebase/frontend/src/content/docs/06-integrations-and-config/knowledge-base.mdx` — 리랭킹 탭 갱신 없음
  - `codebase/frontend/src/content/docs/06-integrations-and-config/knowledge-base.en.mdx` — 리랭킹 탭 갱신 없음
- **상세**: KB 생성/수정 폼에 "리랭킹" 탭이 추가되었다 (`KbFormTab = "basic" | "embedding" | "graph" | "rerank"`). 신규 탭에는 `rerankMode`, `rerankConfig`, `rerankCandidateK`, `rerankScoreThreshold`, `rerankGradingLlm` 5개 설정 필드가 포함된다. 그러나 `knowledge-base.mdx`와 `knowledge-base.en.mdx`에는 이 탭과 필드에 대한 설명이 일체 없다(현재 "Graph" 행에만 `rerank`가 1회 언급). 사용자는 UI에서 리랭킹 탭을 발견하지만 가이드를 찾을 수 없다. i18n dict 키는 ko/en 양쪽 모두 추가되어 parity는 충족된다.
- **제안**: `knowledge-base.mdx` 및 `knowledge-base.en.mdx`에 리랭킹 탭 섹션을 추가한다. 내용: (1) 리랭킹 탭 등장 조건 및 필드 설명 표(`rerankMode` / `rerankConfig` / `rerankCandidateK` / `rerankScoreThreshold` / `rerankGradingLlm`), (2) `cross_encoder_llm` 모드에서 Grading LLM 필드 사용 방법, (3) 기본 리랭커 미설정 시 `off` 강등 동작. 근거는 `spec/2-navigation/5-knowledge-base.md` §2.2와 `spec/5-system/9-rag-search.md §3.3`.

---

## 확인된 사항 (이상 없음)

- **i18n parity**: `rerankConfigs.ts` ko/en 양쪽 동시 추가 — PASS. `knowledgeBases.ts` ko/en 양쪽 20개 키 동시 추가 — PASS. `sidebar.ts` ko/en 양쪽 `reranker` 키 추가 — PASS.
- **신규 warningCode/errorCode**: `RERANK_LLM_GRADING_FAILED` 등 RERANK_* 코드는 `ragDiagnostics.rerank.error` 진단 필드 값이며 `ErrorCode` enum 및 `warningRules`에 등재되지 않는다. `backend-labels.ts` 매핑 의무 없음 — PASS.
- **신규 섹션 디렉토리**: 신규 docs 섹션 디렉토리가 생성되지 않음 — PASS.
- **표현식/인증/실행 흐름 변경**: 해당 없음.

---

## 요약

매트릭스 19개 trigger 중 `integration-provider-change`가 2건 매칭되었다. RerankConfig 관리 화면 신규 추가(`/rerank-configs`)에 대응하는 `rerank-config.{mdx,en.mdx}` docs 페이지가 미생성이고, KB 폼 리랭킹 탭 추가에 대응하는 `knowledge-base.{mdx,en.mdx}` 갱신이 누락됐다. i18n dict ko/en parity는 모든 신규 키에서 충족된다. 사용자는 새 리랭커 설정 화면과 KB 폼 리랭킹 탭의 사용 방법을 user-guide에서 찾을 수 없는 상태다.

---

## 위험도

WARNING
