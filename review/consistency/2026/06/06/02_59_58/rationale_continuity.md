# Rationale 연속성 검토 결과

검토 범위: `spec/conventions/rag-evaluation.md` + `spec/5-system/9-rag-search.md`  
구현 범위: `codebase/backend/src/modules/knowledge-base/eval/**`, `src/scripts/{generate-golden-set,eval-retrieval}.ts`, `src/database/root-entities.ts`  
diff base: `origin/main`

---

## 발견사항

### 발견사항 없음 (NONE)

검토 결과 기각된 대안의 재도입, 합의된 원칙 위반, 무근거 번복, 암묵적 가정 충돌이 발견되지 않았다.

구체적으로 점검한 항목:

1. **D-E3 (제품 LlmService 경유)** — spec `## Rationale` 에서 "`claude -p`/SDK 직접 호출 대신 제품 자체 `LlmService.chat()` 을 쓴다"고 합의. 구현의 `generate-golden-set.ts` 가 `EvalCliModule` 을 통해 `LlmModule` / `LlmService` 를 DI 경유 사용하므로 일치. 직접 SDK 호출 경로 없음.

2. **D-E4 (결정성)** — spec `## Rationale` 에서 "동점 `chunkId` tie-break 로 항상 재현"을 규정. `retrieval-metrics.ts` 의 `orderRetrieved` 가 `score 내림차순 → chunkId 사전순` 2차 정렬을 구현. 테스트(`retrieval-metrics.spec.ts`)도 이 거동을 명시 검증.

5. **D-E5 (검색 지표 우선 / LLM-judge 보류)** — spec 이 "1차 하베스는 LLM-judge 자체를 포함하지 않는다"고 선언. 구현은 `retrieval-metrics.ts`(Recall/Precision/MRR/nDCG/hit-rate)만 제공하며 LLM judge 호출이 없음. 합치.

6. **D-E6 (silver 상대비교 전용)** — spec 이 "절대값 신뢰 금지, 상대 delta 로만 해석"을 원칙으로 명시. `eval-retrieval.ts` 출력 메시지, `eval/README.md` 경고 박스 모두 동일 표현("silver 절대값 신뢰 금지, 상대비교 전용")으로 사용자에게 노출.

7. **9-rag-search.md `## Rationale` 폐기 대안 "노드 단위 리랭크 설정"** — 구현에서 리랭크 설정을 노드 단위로 이동한 흔적 없음. `EvalCliModule` 은 `RerankConfigModule` 전체를 임포트하고, KB 단위 `rerank_mode` 를 그대로 통과시켜 기존 결정 유지.

8. **`ROOT_ENTITIES` 분리** — `app.module.ts` 에서 `src/database/root-entities.ts` 로 이동하면서 `app.module.ts` 가 re-export 를 유지해 기존 import 사이트를 호환. spec 에 이 분리를 기각한 기록이 없으며 신규 합리적 리팩토링.

9. **`autoLoadEntities` 미사용 불변** — `spec/1-data-model.md` Rationale 에서 "`autoLoadEntities` 미사용 정책"을 명시. `eval-cli.module.ts` 의 `TypeOrmModule.forRootAsync` 는 `autoLoadEntities` 를 쓰지 않고 `entities: [...ROOT_ENTITIES]` 명시 목록을 사용해 invariant 준수.

---

## 요약

이번 RAG 평가 하베스 구현(`eval/**`, `scripts/eval-retrieval.ts`, `generate-golden-set.ts`, `root-entities.ts`)은 `spec/conventions/rag-evaluation.md` 및 `spec/5-system/9-rag-search.md` 의 `## Rationale` 에 기록된 모든 주요 결정(LLM-judge 1차 제외, 결정적 지표, 역방향 생성 gold 공짜, 제품 LlmService 경유, silver 상대비교 전용, KB 단위 리랭크 소유권, autoLoadEntities 미사용)을 준수하고 있다. 기각된 대안의 재도입이나 합의된 원칙 위반은 발견되지 않았다.

---

## 위험도

NONE
