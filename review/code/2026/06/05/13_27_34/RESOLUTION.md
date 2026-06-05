# RESOLUTION — rag-rerank-followup (/ai-review 13_27_34)

/ ai-review --route=all (14 reviewer) 결과 Critical 0, Warning 18, INFO ~12.
**스코프 오염 주의**: stale 로컬 main(9f30216f=#468) 기준 비교로 #469~#475(summaryModel/extractionModel·information_extractor checkpoint·conversation_thread durable·active_running_ms·agent-memory) 변경이 diff 에 섞임 → 그 findings(W1~5·W9·W11~13·W16~18·INFO 1~4,7~9,11)는 **이미 머지·리뷰된 타 PR 분으로 본 PR 무관**. 아래는 rerank 변경 관련 in-scope 항목만.

## 조치 항목

| SUMMARY # | 카테고리 | 조치 | commit |
|---|---|---|---|
| W6 | UserGuideSync | `rerank-config.{mdx,en.mdx}` 신규 (RerankConfig 화면) | `51a07028` |
| W7 | UserGuideSync | `knowledge-base.{mdx,en.mdx}` 리랭킹 섹션 추가 | `51a07028` |
| W8 | Requirement | `6-config` broken anchor `-rerankconfig-planned`→`-rerankconfig` | `34b6de37` |
| W10 | Requirement | rerank/rag-search stale "후속" 주석 정리(cross_encoder_llm 구현 반영) | `34b6de37` |
| W14 | Maintainability | `6-config` Part C Rationale(R-3) 신설 | `34b6de37` |
| W15 | Documentation | `6-config` Rerank API 응답 schema SoT 링크 | `34b6de37` |
| INFO5 | SPEC-DRIFT | `1-data-model §2.16.1` (Planned) 모순 주석 제거 | `34b6de37` |
| INFO6 | Requirement | `9-rag-search §3.3` v1 단일 KB 한정 제약 명시 | `34b6de37` |

## 보류·후속 항목
- INFO10 `rerank_config.reveal` 권한 매트릭스 비대칭 → `rag-rerank-followup.md` (RerankConfig 는 reveal 미노출, 선택).
- out-of-scope(#469~#475 review 오염): 본 PR 무관, 해당 PR 머지 시 이미 리뷰됨.

## TEST 결과
- **lint**: 통과 (backend 변경 파일 eslint clean; frontend rerank 파일 eslint clean).
- **unit**: 통과 (backend rerank/rag-search 34; frontend docs registry/frontmatter/link-integrity 24파일·2039, i18n parity 8/9 — 1 실패는 `@workflow` 워크스페이스 미빌드 환경갭·내 변경 무관).
- **build**: 통과 (backend tsc 0; frontend 풀빌드는 dockerized e2e 가 검증).
- **e2e**: **통과** (dockerized `make e2e-test` — Docker 안 frontend+backend 풀빌드 + V081/V082 마이그레이션 + 통합, 173 tests PASS). user-guide `.mdx` 본문은 e2e 면제 화이트리스트.
