# Rationale 연속성 검토 결과

검토 대상: `spec/conventions/rag-evaluation.md` + `spec/5-system/9-rag-search.md`
검토 모드: `--impl-done` (구현 완료 후 최종 정합 검증, diff-base=origin/main)

---

## 발견사항

### 1. [INFO] `rag-evaluation.md` §2 `positive` 정의와 구현 일치 확인

- target 위치: `spec/conventions/rag-evaluation.md §2 집계` + `retrieval-metrics.ts` `evaluateRetrieval`
- 과거 결정 출처: `spec/conventions/rag-evaluation.md ## Rationale D-E6` — "부정 케이스는 gold negative 라벨 부재로 정/오 판정을 보류하고 정보 지표(`retrievedAnyRate`)로만 집계"
- 상세: spec §2 는 positive 를 `shouldRetrieve:true` 이면서 `goldChunkIds` 1개 이상으로 정의한다. 구현(`evaluateRetrieval` 라인 `entry.shouldRetrieve && entry.goldChunkIds.length > 0`)이 이 정의와 정확히 일치하며, `shouldRetrieve:true` 이면서 `goldChunkIds:[]` 인 비정상 entry 는 negative bucket 으로 분류된다. D-E6 의 "gold negative 라벨 부재 → 정/오 판정 보류" 원칙과 정합.
- 제안: 추가 조치 불필요. 현재 구현이 Rationale 를 올바르게 반영함.

### 2. [INFO] `rag-evaluation.md` §3 `--threshold` 의미가 spec 본문과 구현에서 일관됨

- target 위치: `spec/conventions/rag-evaluation.md §3` 실행 경로 테이블 + `eval-retrieval.ts`
- 과거 결정 출처: `spec/5-system/9-rag-search.md ## Rationale "왜 `ragThreshold` 의미를 재해석했나"` — rerank_mode 에 따라 threshold 를 cosine 임계 또는 rerank 점수 임계로 분기 해석
- 상세: spec §3 이 `--threshold 0` 에 대해 "KB `rerank_mode=off` 시 cosine 임계, `cross_encoder` 시 rerank 점수 임계로 해석"이라는 설명을 추가했고, 구현 `eval-retrieval.ts` 는 이 인자를 `RagSearchService.searchWithMeta()` 에 `{ topK, threshold }` 로 투명하게 전달한다. threshold 의 "의미 재해석"은 `RagSearchService` 내부에서 이미 결정된 사항이며, eval 스크립트는 그 결정을 존중하는 pass-through 구조다. 9-rag-search.md Rationale 에서 명시적으로 기각된 "cosine 임계 유지한 채 리랭크" 안(wide 후보를 미리 굶기는 문제)을 eval 이 우회하는 설계는 없다.
- 제안: 추가 조치 불필요.

### 3. [INFO] `rag-evaluation.md` Rationale D-E3 — 제품 LlmService 경유 원칙과 구현 정합

- target 위치: `spec/conventions/rag-evaluation.md ## Rationale D-E3` + `generate-golden-set.ts`
- 과거 결정 출처: CLAUDE.md "외부 LLM 호출 정책" — `subprocess.run(["claude", "-p", ...])` 와 Anthropic SDK 직접 호출 금지; D-E3 "생성기는 제품 자체 `LlmService.chat()`(graph-extraction 과 동일 패턴)을 쓴다"
- 상세: `generate-golden-set.ts` 는 `EvalCliModule` 을 통해 DI 컨텍스트를 부팅하고 `app.get(LlmService)` → `llmService.chat()` 을 사용한다. SDK 직접 호출·`claude -p` subprocess 호출이 없어 D-E3 원칙과 완전 일치. graph-extraction 과 동일 패턴(LlmService.chat + jsonSchema + temperature:0).
- 제안: 추가 조치 불필요.

### 4. [INFO] `EvalCliModule` — AppModule 미부팅 관례와 정합

- target 위치: `src/modules/knowledge-base/eval/eval-cli.module.ts` JSDoc
- 과거 결정 출처: `spec/conventions/rag-evaluation.md §3 "부트스트랩 격리"` — "KnowledgeBaseModule 은 BullMQ 큐·프로세서를 동반하므로 AppModule 부팅 시 운영 워커가 실 작업 job 을 소비"; `9-rag-search.md Rationale "왜 완전 선택적(off 기본)인가"` — 셀프호스팅 배포에서 불필요한 강제 의존성 회피
- 상세: `EvalCliModule` 은 큐·프로세서를 제외하고 `RagSearchService`/`RerankService`/`LlmModule`/`RerankConfigModule` 만 포함하는 경량 DI. `ROOT_ENTITIES` 를 `src/database/root-entities.ts` (app.module 에서 분리된 신규 파일)에서 임포트해 entity 메타데이터 재사용. `app.module` 에서 ROOT_ENTITIES 를 분리한 것은 eval CLI 가 전체 AppModule transitive import 없이 entity 목록만 재사용하기 위한 것으로, spec §3 부트스트랩 격리 요건을 충족하는 구조적 변화다.
- 제안: `root-entities.ts` 분리에 대한 설계 결정이 spec 본문(§3)에만 간단히 언급되어 있고 Rationale 에 별도 항이 없다. 향후 이 모듈 분리 결정을 `rag-evaluation.md` Rationale 에 D-E7 항으로 추가하면 추적성이 높아진다. 현 시점 위반은 아님.

### 5. [INFO] `rag-evaluation.md` Rationale D-E4 결정성 규칙과 구현 정합

- target 위치: `spec/conventions/rag-evaluation.md ## Rationale D-E4` + `retrieval-metrics.ts orderRetrieved`
- 과거 결정 출처: D-E4 "지표는 순수·결정적(동점 `chunkId` tie-break)이어야 CI 회귀 비교가 안정적"
- 상세: `orderRetrieved` 가 score 내림차순 정렬 후 동점은 `chunkId` 사전순 2차 정렬로 tie-break 하며, 입력 배열을 변형하지 않는(`[...retrieved].sort(...)`) 순수 함수다. 테스트 `retrieval-metrics.spec.ts` 가 이 결정성을 직접 검증(동점 score → chunkId 오름차순 정렬 테스트). D-E4 원칙과 완전 일치.
- 제안: 추가 조치 불필요.

---

## 요약

이번 검토 범위(RAG 평가 하베스 P0 Phase 0+1 구현 완료 후 최종 정합 검증)에서 기각된 대안의 재도입, 합의된 원칙 위반, 무근거 번복, 암묵적 가정 충돌은 발견되지 않았다. `spec/conventions/rag-evaluation.md` 와 `spec/5-system/9-rag-search.md` 의 Rationale 에 기록된 모든 설계 원칙(D-E1~D-E6, ragThreshold 재해석, 외부 LLM 호출 금지, 부트스트랩 격리, 결정성 tie-break, positive/negative 분리 집계)이 구현에 올바르게 반영되어 있다. 9-rag-search.md 가 명시적으로 기각한 대안들(항상 리랭크, cosine 임계 유지 리랭크, 노드 단위 리랭크, SDK 직접 호출)도 eval 코드에 재도입된 패턴이 없다. 단 `root-entities.ts` 분리 결정에 대한 Rationale 항이 누락된 것은 정보 수준의 보완 제안으로 남긴다.

---

## 위험도

NONE
