# 성능(Performance) 코드 리뷰

## 발견사항

### [INFO] `ndcgAtK` 내 `Math.log2` 반복 계산 — 현 규모에서 허용 가능, 대규모 시 최적화 여지
- 위치: `codebase/backend/src/modules/knowledge-base/eval/retrieval-metrics.ts` L101-109 (`ndcgAtK` 함수)
- 상세: `ndcgAtK` 는 매 호출마다 DCG 루프와 IDCG 루프 각각에서 `Math.log2(i + 2)` 를 재계산한다. `evaluateRetrieval` 이 N entry × K 개 k값 조합으로 이 함수를 호출하므로 총 계산 횟수는 O(N·K·k)이다. N=1000, ks=[1,3,5,10](K=4), k=10이면 최대 ~40,000회 중복 계산이 발생한다. 단, Phase 0 목표 규모(수십~수백 entry)에서는 실질 병목이 되지 않는다. 이전 리뷰(02_39_25 #13)에서도 현 규모 기준 보류 판정이 내려진 사안이다.
- 제안: 현재 규모에서는 조치 불요. 수천 entry 운용 규모 도달 시 `evaluateRetrieval` 진입 시점에 `const log2Table = Array.from({length: maxK + 2}, (_, i) => Math.log2(i + 2))` 를 한 번 생성하고 `ndcgAtK` 에 전달하는 방식으로 O(N·K·k) → O(k) 로 줄이는 것을 권장.

---

### [INFO] `evaluateEntry` 내 k 값마다 `ranked.slice(0, k)` 반복 호출 — 현 규모에서 허용 가능
- 위치: `codebase/backend/src/modules/knowledge-base/eval/retrieval-metrics.ts` L180-185 (`evaluateEntry` 함수 내 k 루프)
- 상세: `recallAtK`, `precisionAtK`, `hitRateAtK`, `ndcgAtK` 각 함수가 내부에서 `ranked.slice(0, k)` 를 개별 실행한다. ks=[1,3,5,10](K=4) 기준 entry당 최대 4×4=16회 slice가 실행되며 각각 새 배열을 할당한다. N=1000이면 16,000개 배열이 GC 대상이 된다. 이전 리뷰(02_39_25 #12)에서 현 규모 기준 보류 판정이 내려진 사안이다.
- 제안: 현재 규모에서는 조치 불요. 실운용 수천 entry 규모 도달 시 `ranked.slice(0, maxK)` 를 한 번만 실행하고, `countHits` 계열 함수에 `limit` 파라미터를 추가해 내부 순회 범위를 slice 없이 제어하는 방식으로 개선 권장.

---

### [INFO] `eval-retrieval.ts` — 고유 kbId N개에 대해 개별 DB 쿼리 실행 (배치화 미적용)
- 위치: `codebase/backend/src/scripts/eval-retrieval.ts` L146-163 (`resolveWorkspace` + `wsCache`)
- 상세: `wsCache`(Promise 캐시, 이전 리뷰 #11에서 적용 완료)로 동일 kbId의 중복 쿼리는 방지되어 있다. 그러나 골든셋에 신규 kbId가 N개 있으면 첫 접근 시 N번의 개별 `SELECT workspace_id FROM knowledge_base WHERE id = $1` 가 실행된다. `pLimit(4)` 동시성 제한 하에서도 각 왕복마다 네트워크 레이턴시가 발생한다.
- 제안: 이전 리뷰(02_39_25 #11)에서 Promise 캐싱은 적용 완료됨. 추가 최적화로, 스크립트 시작 시 `goldenSet.entries` 에서 고유 kbId 목록을 추출해 `WHERE id = ANY($1::uuid[])` 로 한 번에 조회 후 `wsCache` 를 pre-warm하면 N번 왕복을 1번으로 줄일 수 있다. 현 규모(수십~수백 entry, 통상 kbId 1~3개)에서는 실질 차이 미미.

---

### [INFO] `readFileSync` + `JSON.parse` 로 전체 goldenSet 동기 적재
- 위치: `codebase/backend/src/scripts/eval-retrieval.ts` L97-98
- 상세: CLI 전용 스크립트이므로 이벤트 루프 블로킹 자체는 운영 코드 대비 허용 가능하다. 단 golden.json이 수만 entry로 커질 경우 파싱된 JSON 객체 트리가 원본 파일 크기의 수 배 메모리를 점유한다. 또한 zod `GoldenSetSchema.safeParse` 가 파싱 후 전체 entries 배열을 검증하므로 대규모 파일에서 검증 비용이 추가된다.
- 제안: 현 규모(수백 entry 이하)에서는 허용 가능하다. 수만 entry 규모 도달 시 NDJSON 포맷 또는 스트리밍 파서(`stream-json` 등) 전환, 또는 페이지 단위 배치 처리를 검토한다.

---

### [INFO] `EvalCliModule` — `ROOT_ENTITIES` 전체(~40개) 등록으로 CLI 부트스트랩 비용 과다
- 위치: `codebase/backend/src/modules/knowledge-base/eval/eval-cli.module.ts` L429 (`entities: [...ROOT_ENTITIES]`)
- 상세: eval CLI가 실제로 접근하는 테이블은 `knowledge_base`, `document_chunk`, `llm_config`, `rerank_config` 등 소수이나 TypeORM은 등록된 모든 entity의 메타데이터를 초기화 시 처리한다. ~40개 entity 로드는 CLI 시작 시간과 메모리 사용을 과도하게 높인다. 이전 리뷰(02_39_25 #15)에서 중장기 아키텍처 개선으로 분류, 보류 결정된 사안이다.
- 제안: 현재 기능 불영향. eval에 실제 필요한 entity(KnowledgeBase, DocumentChunk, LlmConfig, RerankConfig, Workspace 정도)만 별도 `EVAL_CLI_ENTITIES` 배열로 추출·등록하는 것을 중장기 개선 계획으로 추가 권장.

---

### [INFO] `lang-detect.ts` — 모듈 수준 `/g` RegExp 공유 + `countMatches` exec 루프 패턴 검증
- 위치: `codebase/backend/src/modules/knowledge-base/eval/lang-detect.ts` L10-22
- 상세: 이전 리뷰(02_39_25 #14)에서 `match()` 배열 생성 제거 조치가 완료되었다. 현재 `countMatches` 함수가 `re.lastIndex = 0` 리셋 후 `while (re.exec(text) !== null)` exec 루프를 사용해 배열 할당 없이 카운팅하는 것이 확인된다. `/g` 플래그 공유 RegExp는 `countMatches` 가 매번 `lastIndex = 0` 리셋을 수행하므로 현재 구현상 오동작 없음. 성능 관점에서 추가 조치 불요.
- 제안: 없음. 이전 리뷰 조치가 올바르게 완료되었다.

---

## 요약

이 변경의 성능 관련 핵심 이슈들은 이전 리뷰 라운드(02_39_25)에서 대부분 처리되었다. `lang-detect.ts` 의 배열 생성 제거(`countMatches` exec 루프, #14 완료), `wsCache` Promise 캐싱으로 중복 DB 쿼리 방지(#11 완료)가 적용된 것이 확인된다. 남은 사항은 모두 INFO 수준으로, `ndcgAtK` Math.log2 반복 계산, `evaluateEntry` slice 중복, kbId 배치 조회 미적용은 현 Phase 0 목표 규모(수십~수백 entry)에서 실질 병목이 없으며 기존 리뷰에서 "수천 entry 규모 도달 시 재검토"로 명시적 보류 결정된 사안들이다. `EvalCliModule` ROOT_ENTITIES 전체 등록 역시 기능에는 영향 없으며 중장기 개선 항목으로 이미 추적 중이다. CRITICAL/WARNING 등급의 신규 성능 결함은 발견되지 않는다.

## 위험도

NONE
