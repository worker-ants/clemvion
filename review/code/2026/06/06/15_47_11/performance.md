# 성능(Performance) 리뷰 — spec/5-system/9-rag-search.md

## 발견사항

### 발견사항 1
- **[WARNING]** wide 회수(RAG_RECALL_K=50) 도입 시 pgvector 쿼리 부하 10배 증가
  - 위치: §3.1 파라미터 표, §3.4 동적 점수 컷 — `$4` 회수 폭이 기존 `topK(5)` → `RAG_RECALL_K(50)`으로 확대
  - 상세: 기존 `LIMIT 5` 쿼리 대비 `LIMIT 50` 은 pgvector ANN 스캔·정렬 비용이 단순 10배가 아니라 더 클 수 있다. ivfflat/hnsw 인덱스는 `LIMIT` 이 클수록 더 넓은 후보 셀을 스캔하며 `probes`(ivfflat) / `ef_search`(hnsw) 가 고정돼 있으면 품질 열화가 생기고, 높이면 지연이 추가 증가한다. spec 에는 인덱스 파라미터 조정 여부에 대한 언급이 없다.
  - 제안: §3.1 또는 §7(확장 포인트) 에 "wide 회수 도입에 따른 pgvector `hnsw.ef_search`/`ivfflat.probes` 검토 필요" 를 Rationale 주석 또는 follow-up 항목으로 명시한다. 구현 시 벤치마크를 통해 지연 회귀 여부를 확인한다.

### 발견사항 2
- **[INFO]** token-budget 추정(char/3)이 멀티바이트 문자(한국어) 환경에서 과소 추정 가능
  - 위치: §3.4 상수 설명 — "토큰 추정: `chunking/text-chunker.estimateTokens`(char/3, 동기·무의존)"
  - 상세: char/3 근사는 ASCII 중심 추정으로, 한국어 BPE 토큰은 문자당 ~1토큰 전후다. 한국어 청크가 많을 경우 실제 토큰 수가 추정치의 3배에 달할 수 있어 `RAG_INJECT_TOKEN_BUDGET(8000)` 초과 허용 청크가 실제로는 예산을 크게 초과하게 된다. spec 에서 "의도적 분리(회귀 0)" 으로 명시돼 있으나, 한국어 위주 KB 에서 컨텍스트 창 압박이 발생할 수 있다.
  - 제안: spec Rationale 에 "한국어 over-inject 가능성은 인지하며, 추정 오차는 실운용 데이터로 `RAG_INJECT_TOKEN_BUDGET` 조정으로 흡수한다" 를 명시하거나, 후속 follow-up(`rag-rerank-followup.md`)에 한국어 토큰 추정 보정 항목을 추가한다.

### 발견사항 3
- **[INFO]** conditional escalate 진입 임계가 정량 미확정으로 최악 케이스는 v1과 동일 LLM 호출 발생
  - 위치: §3.3.2 흐름 3번 단계, Rationale "왜 D2 conditional escalate 를 지금 도입하나"
  - 상세: escalate 진입 임계를 "합리적 default(예: 최고점과 차이/표준편차 기반)"로 시작한다고 명시했지만, 임계가 너무 낮게 설정되면 `cross_encoder_llm` 모드는 기존 "항상 grading" 과 사실상 동일하게 LLM 콜을 발생시킨다. spec 은 이 케이스의 성능 상한을 별도 기술하지 않는다.
  - 제안: Rationale 에 "escalate 임계 default 의 worst-case(임계 초과 빈도 100%)는 구버전의 '항상 grading' 과 동일하므로 기존 대비 성능 회귀 없음" 을 명시해 구현자가 안전 범위를 인지하도록 한다.

### 발견사항 4
- **[INFO]** off 경로 동적 컷은 app-layer 순회(O(k)) 추가이나 성능 영향 미미
  - 위치: §3.4 동적 점수 컷 — "in-process 순수 후처리(필터·합산)"
  - 상세: 회수된 최대 50개 청크에 대한 누적 토큰 합산 루프(O(50))와 inject-cap 슬라이싱은 negligible. `estimateTokens`(char/3)도 문자열 길이 조회 수준. 별도 우려 없음.
  - 제안: 없음 (현행 설계 적절).

---

## 요약

이번 변경의 핵심 성능 영향은 spec §3.1의 회수 폭 확대(`LIMIT 5 → LIMIT 50`)로, pgvector ANN 인덱스 스캔 비용이 증가한다. 이는 설계가 의도한 trade-off(더 넓은 회수 → 동적 컷으로 품질 개선)이나, 인덱스 파라미터(`hnsw.ef_search`/`ivfflat.probes`) 조정 필요성에 대한 언급이 spec·Rationale 어디에도 없어 구현 시 지연 회귀를 간과할 위험이 있다. token-budget 추정(char/3)의 한국어 과소 추정은 알려진 한계로 spec 에서 인정하고 있으나 운용 데이터 기반 보정 경로가 명시되지 않았다. app-layer 동적 컷 자체(O(50))는 성능 관점에서 무해하다. conditional escalate 는 worst-case 가 구버전 동작과 동일하므로 성능 회귀 없다.

---

## 위험도

LOW
