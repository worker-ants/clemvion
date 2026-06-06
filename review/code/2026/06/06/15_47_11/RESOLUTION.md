# RESOLUTION — 15_47_11

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| #1 (W1) | 코드 | affb8144 | rerank.service.ts fallback() — applyDynamicCut 반환 cutoffApplied 실제 값 사용 (spec §4.2 정의 준수) |
| #2 (W2) | 코드 | affb8144 | rag-search.service.ts SearchWithMetaResult 타입 alias export + searchWithMeta 반환 타입 명시 (rerank 선택성 의미 문서화) |
| #3 (W3) | 조치 불필요 | — | RagSearchService 664줄 — graph traversal 관련 메서드가 200줄 이상 성장 시 GraphSearchStrategy 분리 검토. 현재 임계 미도달, 선제 리팩토링 불필요 |
| #4 (W4) | spec | (main 반영) | spec §2.2 에 `gradingNoGrounding=true` tool_result 포맷(`grounding:"none"`) 예시 추가 — `docs(spec)` 커밋 |
| #5 (W5) | 코드 | affb8144 | dynamic-cut.util.ts DynamicCutOptions / DynamicCutResult<T> 인터페이스에 JSDoc 추가 |
| #6 (W6) | 조치 불필요 | — | top_k breaking change 테스트 반영 확인: kb-tool-provider.spec.ts "ragTopK 미설정 시 topK 를 undefined 로 전달" + "LLM 인자 top_k 는 ragTopK 미설정이어도 명시 override" + ai-agent.handler.spec.ts L295-300 — 신규 동작 이미 반영됨 |
| #7 (W7) | spec | (main 반영) | spec §4.2 cutoffApplied 의미 확장 + Rationale 'v1 breaking note' 추가 — `docs(spec)` 커밋 |
| #8 (W8) | spec | (main 반영) | spec §3.4 에 pgvector hnsw.ef_search/ivfflat.probes follow-up 노트 추가 — `docs(spec)` 커밋 |

> W4/W7/W8 은 ESCALATE=spec 으로 main 이 받아 spec/5-system/9-rag-search.md 에 직접 반영(developer spec read-only → planner 역할). draft `spec-update-rag-search.md` 는 반영 후 제거. `--impl-done` 게이트로 spec+코드 정합성 최종 검증.

## TEST 결과

- lint  : 통과
- unit  : 통과 (40 passed)
- build : 통과 (lint 포함 TypeScript 컴파일 에러 없음)
- e2e   : 통과 (175/175)

## 보류·후속 항목

- spec draft 위임 (W4 / W7 / W8): `plan/in-progress/spec-update-rag-search.md`
  - W4: spec §2.2 `gradingNoGrounding=true` 시 tool_result 포맷 예시
  - W7: spec §4.2 `cutoffApplied` 의미 확장(θ 전용 → 세 컷 통합) + Rationale breaking note
  - W8: spec §3.1 또는 §7 wide 회수 도입 시 pgvector 인덱스 파라미터(hnsw.ef_search / ivfflat.probes) 검토 follow-up
- INFO 항목 다수(#1~#20): 자동 수정 대상 아님. spec Rationale 보강 권장 사항은 위 spec draft 에 통합 가능.
