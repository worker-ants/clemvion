---
worktree: rag-rerank-followup-864891
started: 2026-06-05
owner: developer
---
# RAG 리랭킹 후속 — A.1 cross_encoder_llm + A.2 UI + A.5 spec 완결성

> 기반: #465(cross_encoder PoC)·#466(threshold 컷·진단 전파·SSRF) 머지 후속.
> [`rag-rerank-followup.md`](./rag-rerank-followup.md) 의 A.1·A.2·A.5 진행 (A.3 provider 확장·A.4 멀티-KB 는 drop).
> spec: [`9-rag-search §3.3`](../../spec/5-system/9-rag-search.md) · [`1-data-model §2.16.1`](../../spec/1-data-model.md) · [`6-config`](../../spec/2-navigation/6-config.md) · [`1-auth`](../../spec/5-system/1-auth.md)

## 현황 (탐색 결과)
- A.1: 배관(mode 전달·`ragDiagnostics.rerank` 전파)은 #466 완료. **LLM grading 실제 로직 미구현**(`rerank.service.ts` `llmGradingApplied:false` 고정).
- A.2: 리랭킹 프론트 UI 전무. RerankConfig CRUD API(`/api/rerank-configs`)는 백엔드 구현됨.
- A.5: spec 동기화 미흡.

## A.1 — cross_encoder_llm LLM grading (백엔드)
- [x] RerankService: cross_encoder 후 `mode==='cross_encoder_llm'` 이면 survivors(~15)에 **listwise LLM grading 1콜**(chat, `rerank_llm_config_id` resolve → LlmService.chat). id 순위+점수 반환 파싱 → 재정렬 + 동적 컷. `llmGradingApplied:true`.
- [x] 실패 시 cross-encoder 결과로 fallback(`RERANK_LLM_GRADING_FAILED`), throw 없음.
- [x] LlmService(chat) 의존 주입 — KnowledgeBaseModule 에 이미 LlmModule import.
- [x] 단위테스트(grading happy/parse-fail/fallback).

## A.2 — 프론트엔드 UI
- [x] 워크스페이스 RerankConfig 관리: `app/(main)/rerank-configs/page.tsx` + `lib/api/rerank-configs.ts`(hooks) + Form/List 컴포넌트 (llm-configs 미러).
- [x] KB 폼(`kb-form-body.tsx`) 리랭킹 섹션: mode 드롭다운(off/cross_encoder/cross_encoder_llm) + RerankConfig select + candidate pool + score cutoff + (cross_encoder_llm 시) grading LLM. visibleWhen mode≠off.
- [x] i18n `dict/{ko,en}/rerankConfigs.ts`(신규) + knowledgeBases.ts 리랭킹 라벨.
- [x] 네비게이션 진입(설정 영역에 RerankConfig 링크, llm-configs 옆).

## A.5 — spec 완결성
- [x] `1-auth §3.2` RBAC 매트릭스 RerankConfig 행 + `§4.1` 감사로그 `rerank_config.*`.
- [x] `6-config.md` RerankConfig 관리 화면 + `/api/rerank-configs` endpoint 절(LLMConfig 대칭).
- [x] `5-knowledge-base.md` 리랭킹 행 "(Planned, 선택)" → "(선택, cross_encoder/cross_encoder_llm 구현)".
- [x] `1-data-model §2.16.1` "(Planned)" 정리(앵커 보존 주의) + `9-rag-search §3.3` cross_encoder_llm "구현됨" 반영.
- [ ] frontmatter: 모든 surface 구현 시 `9-rag-search` status partial→implemented 검토. UI 추가로 `5-knowledge-base`·`6-config` code: 갱신.

## 검증 (정석 — rebase/리뷰 생략 금지, memory 2026-06-05 정정)
- [x] consistency-check --impl-prep (12_59_45 BLOCK:NO)
- [ ] TEST WORKFLOW (lint·unit·build·**frontend 포함**·e2e) — frontend node_modules 실제 부트스트랩 필요(turbopack)
- [ ] /ai-review (full, route 오판 시 --route=all)
- [ ] consistency-check --impl-done

## 진행 메모
- 2026-06-05 fresh worktree(864891) from main(#475까지). A.3·A.4 drop.
