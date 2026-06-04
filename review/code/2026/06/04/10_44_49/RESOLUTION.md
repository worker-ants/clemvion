# RESOLUTION — 10_44_49

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| #1 | 코드 | 24112949 | kb-tool-provider.ts: search() → searchWithMeta() 교체, ragDiagnosticsDelta.rerank 포함. KbSearchDiagnostic 에 optional rerank 필드 추가. spec + handler unit spec 업데이트 |
| #2 | 코드 | 24112949 | rerank.service.ts fallback() 에서 `origin: 'reranked'` 오표시 제거. 강등 결과는 cosine 순, origin 없음. RerankResult.origin optional 로 완화 |
| #3 | spec | 6136a036 | spec/1-data-model.md §2.11 rerank_candidate_k 에 허용 범위 1~200 명시. rerank_* "(Planned)" 마커 정합화 |
| #4 | spec (SPEC-DRIFT) | 6136a036 | spec/5-system/9-rag-search.md §4.1 origin, §4.2 ragDiagnostics.rerank, §3.3, §6 의 "(Planned)" → "(v1 cross_encoder 구현됨; cross_encoder_llm 후속)" 갱신 |
| #5 | 문서화 (spec) | 6136a036 | spec/5-system/9-rag-search.md 끝에 ## Rationale 신설 — 완전 선택적·KB 단위·비대칭·동적 컷·분리 근거·폐기 대안 4종 |
| #6 | 문서화 (spec) | 6136a036 | spec/5-system/7-llm-client.md 끝에 ## Rationale 신설 — RerankClient 별도 인터페이스·SSRF 재사용·LLMClientFactory 통합 기각. §3.6/§4.1/§5.6 "(Planned)" 헤더 정합화 |
| #7 | 문서화 | 이미 처리 | plan/in-progress/rag-rerank-followup.md 생성 완료 (이전 컨텍스트) |
| INFO1 | 견고성 | 24112949 | rerank.service.ts: 유효 index 필터 후 reranked.length===0 && candidates.length>0 이면 RERANK_NO_VALID_RESULTS 로 cosine 강등 |

## TEST 결과

- lint  : backend 경고 43건 (기존 코드, 우리 변경과 무관) — frontend eslint 명령 미설치 (pre-existing 인프라 이슈, 코드 변경과 무관)
- unit  : 통과 (5900 passed, 308 suites — 1건 신규 rerank 진단 테스트 포함)
- build : e2e 통과로 확인 (별도 build 단계 없음)
- e2e   : 통과 (168/168)

## 보류·후속 항목

- INFO2/I3: rerankConfigId null→default 동작, is_default 해제 시 자동승격 없음 — spec 주석 권고 (plan/in-progress/rag-rerank-followup.md 에 포함)
- INFO7: 에러코드 EXECUTION_TIME_LIMIT 전체문서 정합 — 리랭킹 무관·기존 항목 (plan/in-progress/rag-rerank-followup.md 에 포함)
