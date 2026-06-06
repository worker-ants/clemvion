# 성능(Performance) 코드 리뷰

## 발견사항

### [WARNING] `detectLanguage` 함수에서 /g 플래그 정규식 재사용 시 lastIndex 오염 위험
- 위치: `codebase/backend/src/modules/knowledge-base/eval/lang-detect.ts` — `HANGUL_RE`, `LATIN_RE` 모듈 스코프 상수
- 상세: `HANGUL_RE = /[가-힣ᄀ-ᇿ㄰-㆏]/g` 와 `LATIN_RE = /[A-Za-z]/g` 는 `/g` 플래그를 가진 채 모듈 스코프에 공유된다. `String.prototype.match()` 로 호출하면 매번 `lastIndex` 를 0으로 리셋하므로 현재 코드에서는 실질 오동작이 없다. 그러나 향후 이 정규식을 `exec()` 루프나 `test()` 와 섞어 쓰면 `lastIndex` 상태가 누적돼 silent 오류를 유발한다. 또한 `generate-golden-set.ts` 에서 대규모 청크 배치(수백~수천 개)를 처리할 때 매 청크마다 정규식 match 배열 객체를 생성하는 비용이 누적된다.
- 제안: `/g` 플래그를 제거하거나, match 대신 카운팅 루프(`while (re.exec(text) !== null) count++`)로 교체하면 배열 할당을 없앨 수 있다.

---

### [WARNING] `ndcgAtK` 내 `Math.log2` 반복 계산 — 정적 테이블로 캐시 가능
- 위치: `codebase/backend/src/modules/knowledge-base/eval/retrieval-metrics.ts` — `ndcgAtK` 함수 (DCG·IDCG 루프)
- 상세: `ndcgAtK` 는 매 호출마다 `Math.log2(i + 2)` 를 i = 0 … k-1 까지 반복 계산한다. `evaluateRetrieval` 은 entry 수 N × k 수 K 번 이 함수를 호출하므로 총 O(N·K·k) 번 `Math.log2` 가 실행된다. IDCG 루프 안에서도 동일한 값을 다시 계산한다. N=1000, K=4, k=10 이면 ~40,000회 중복 계산이다.
- 제안: `maxK` 크기의 log2 정적 테이블을 `evaluateRetrieval` 진입 시 한 번 생성(`Array.from({length: maxK+2}, (_, i) => Math.log2(i + 2))`)해 `ndcgAtK` 에 전달하면 재계산을 제거할 수 있다.

---

### [WARNING] `evaluateEntry` 내 k 마다 `ranked.slice` 반복 호출 — 불필요한 배열 할당
- 위치: `retrieval-metrics.ts` — `evaluateEntry` 함수
- 상세: `evaluateEntry` 는 k 값마다 `recallAtK / precisionAtK / hitRateAtK / ndcgAtK` 를 각각 호출하고 각 함수 안에서 `ranked.slice(0, k)` 를 다시 실행한다. k=[1,3,5,10] 이면 하나의 entry 에 최대 4 × 4 = 16 번 slice 가 실행된다. N=1000 entry 이면 16,000 개 배열이 GC 대상으로 쌓인다.
- 제안: `ranked.slice(0, maxK)` 를 한 번만 실행하고, `countHits` 계열 함수에 `limit` 파라미터를 추가해 내부 순회 범위를 제어하거나, `evaluateEntry` 에서 k 루프 계산을 직접 인라인화해 slice 할당 자체를 제거한다.

---

### [WARNING] `eval-retrieval.ts` — `resolveWorkspace` DB 쿼리 배치화 미적용
- 위치: `codebase/backend/src/scripts/eval-retrieval.ts` — `resolveWorkspace` + `wsCache`
- 상세: `wsCache` Map 으로 kbId 기준 중복 쿼리는 방지된다. 그러나 골든셋에 신규 kbId 가 N 개면 N 번 개별 `SELECT workspace_id FROM knowledge_base WHERE id = $1` 가 각각 실행된다. `p-limit(4)` 동시성 때문에 DB 커넥션이 병렬로 열리고 각 왕복마다 네트워크 레이턴시가 소요된다.
- 제안: 스크립트 시작 시 `goldenSet.entries` 에서 고유 kbId 목록을 추출한 뒤 `WHERE id = ANY($1)` 로 한 번에 조회해 `wsCache` 를 선채우기(pre-warm)하면 N 번 왕복을 1 번으로 줄일 수 있다.

---

### [WARNING] `eval-retrieval.ts` — `readFileSync` + `JSON.parse` 로 전체 goldenSet 동기 적재
- 위치: `eval-retrieval.ts` — `readFileSync(goldenPath, 'utf8')` + `JSON.parse` 호출부
- 상세: 파일 전체를 동기 블로킹으로 읽은 뒤 메모리에 파싱된 객체 트리로 올린다. CLI 전용 스크립트이므로 이벤트 루프 블로킹 자체는 큰 문제가 아니나, golden.json 이 수만 entry 로 커질 경우 파싱된 JSON 객체 트리가 원본 파일 크기의 수 배 메모리를 점유한다.
- 제안: 단기적으로 현 구조는 허용 가능하다. 골든셋 규모가 커질 경우 NDJSON 포맷 또는 스트리밍 파서(`stream-json` 등) 전환을 고려한다.

---

### [INFO] `EvalCliModule` — `ROOT_ENTITIES` 전체(~40개) 를 eval CLI 부트스트랩에 등록
- 위치: `codebase/backend/src/modules/knowledge-base/eval/eval-cli.module.ts` — `entities: [...ROOT_ENTITIES]`
- 상세: 주석에서 "관계 타깃 누락 방지" 목적으로 ROOT_ENTITIES 전체를 등록한다고 설명한다. eval 러너가 실제로 접근하는 테이블은 `knowledge_base`, `document_chunk`, `llm_config`, `rerank_config` 등 소수이나 TypeORM 은 등록된 모든 엔티티의 메타데이터를 초기화 시 처리하여 CLI 시작 시간과 메모리 사용이 과도하다.
- 제안: eval 에 실제 필요한 엔티티(KnowledgeBase, DocumentChunk, LlmConfig, RerankConfig, Workspace 정도)만 별도 `EVAL_ENTITIES` 배열로 추출해 등록하거나, 관계 타깃을 raw SQL 로만 접근해 entity 등록 자체를 최소화한다.

---

### [INFO] `lang-detect.ts` — `(text.match(RE) ?? []).length` 패턴의 불필요한 배열 생성
- 위치: `lang-detect.ts` — `detectLanguage` 함수
- 상세: `text.match(HANGUL_RE)` 는 모든 매칭 문자를 담은 배열을 생성한 뒤 `.length` 만 사용한다. 텍스트가 길면 수천 개 문자 배열이 생성·즉시 GC 된다.
- 제안: 카운팅 루프(`let count = 0; re.lastIndex = 0; while (re.exec(text) !== null) count++`) 또는 `[...text.matchAll(re)].length` 대신 `text.split(re).length - 1` 패턴을 사용하면 중간 배열 할당을 줄일 수 있다.

---

## 요약

이 변경은 RAG 평가 하베스(eval harness)를 신규 도입하는 것으로, 핵심 성능 경로는 순수 TS 지표 계산 레이어(`retrieval-metrics.ts`)와 NestJS 기반 CLI 러너(`eval-retrieval.ts`)로 나뉜다. 지표 레이어는 알고리즘 복잡도 자체는 적절하나 `evaluateEntry` 내 반복 `slice` 호출과 `ndcgAtK` 의 중복 `Math.log2` 계산이 대규모 골든셋에서 불필요한 객체 생성 및 연산 중복을 유발한다. CLI 러너의 `resolveWorkspace` 는 kbId 캐시로 중복 쿼리를 막지만 배치 조회로 최초 왕복 횟수를 줄일 수 있고, `EvalCliModule` 의 ROOT_ENTITIES 전체 등록은 CLI 목적 대비 과도한 부트스트랩 비용이다. `lang-detect.ts` 의 `/g` 플래그 공유 정규식은 `match` 사용 시 현재 오동작은 없지만 잠재적 `lastIndex` 함정이며 배열 할당 최적화 여지도 있다. Critical 수준의 성능 결함은 없으나 수백~수천 entry 규모의 실 골든셋 운용 시 WARNING 항목들이 실질적 성능 저하로 이어질 수 있다.

## 위험도

LOW
