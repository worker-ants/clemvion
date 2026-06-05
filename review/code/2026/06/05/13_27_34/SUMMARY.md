# Code Review 통합 보고서 (rag-rerank-followup, --route=all 14 reviewer)

**RISK: MEDIUM · Critical 0 · Warning 18 · INFO ~12**

> ⚠️ **스코프 오염**: `--branch main` 이 stale 로컬 main(9f30216f=#468)과 비교해 **이미 머지된 #469~#475**(summaryModel/extractionModel, information_extractor checkpoint, conversation_thread durable, active_running_ms, agent-memory)를 diff 에 포함. 그 관련 findings(W1~5, W9, W11~13, W16~18, INFO 1~4,7~9,11)는 **본 PR 무관**(해당 PR 머지 시 이미 리뷰됨). 아래는 **rerank 변경 관련 valid 항목만**.

## Critical
없음.

## 경고 (WARNING) — rerank 관련(in-scope)

| # | 카테고리 | 발견 | 조치 |
|---|----------|------|------|
| W8 | Requirement | `6-config.md` L17·L187 앵커 `#2161-rerankconfig-planned` broken (heading 은 `#2161-rerankconfig`) | 링크 `-planned` 제거 |
| W10 | Requirement | `rerank.service.ts` L26/L33·`rag-search.service.ts` L132 "후속" 주석 stale (A.1 로 cross_encoder_llm 구현됨) | 주석 정리(멀티-KB "후속"은 유지) |
| W6 | UserGuideSync | `/rerank-configs` 화면 user-guide `rerank-config.{mdx,en.mdx}` 미생성 | user-guide-writer 위임 |
| W7 | UserGuideSync | KB 폼 리랭킹 탭 user-guide `knowledge-base.{mdx,en.mdx}` 미갱신 | user-guide-writer 위임 |
| W14 | Maintainability | `6-config.md` Part C Rationale 절 없음 | 짧은 Rationale 추가 |
| W15 | Documentation | `6-config.md` Rerank API 응답 schema SoT 링크 미명시 | `7-llm-client §3.6` 링크 |

## 참고 (INFO) — in-scope
- INFO5 (SPEC-DRIFT): `1-data-model L542` "(Planned) 유지" 주석이 heading(=Planned 없음)과 모순 → 주석 정리.
- INFO6: `9-rag-search §3.3` v1 단일 KB rerank 제약 미명시 → 제약 1줄 추가.
- INFO10: `rerank_config.reveal` 권한 매트릭스 비대칭(선택) → followup.

## out-of-scope (review 오염, #469~#475 이미 머지)
W1~5, W9, W11~13, W16~18, INFO 1~4,7~9,11 — summaryModel/exec-park/agent-memory 관련. 본 PR 변경 아님.
