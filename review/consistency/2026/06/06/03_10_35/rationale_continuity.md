# Rationale 연속성 검토 결과

검토 모드: `--impl-done`
대상: `spec/conventions/rag-evaluation.md + spec/5-system/9-rag-search.md` — 구현 변경 diff (origin/main...HEAD)

---

## 발견사항

### 발견사항 1

- **[INFO]** macroAverage NaN guard — 분모가 유효 entry 수가 아닌 총 entry 수
  - target 위치: `codebase/backend/src/modules/knowledge-base/eval/retrieval-metrics.ts` `macroAverage()` 함수, `const n = entries.length` (line 217)
  - 과거 결정 출처: `spec/conventions/rag-evaluation.md §2 결정성 규칙` — "gold 가 빈 entry 의 지표는 NaN(평가 제외 신호) → macro 평균에서 빠진다."
  - 상세: `macroAverage` 는 NaN 값을 합산에서 건너뛰지만(NaN guard 적용), 분모는 `entries.length` (전달된 배열의 총 원소 수)로 나눈다. spec 의 의도는 "NaN 을 낸 entry 는 분모에서도 제외"이다. 실제로는 `evaluateRetrieval` 에서 `entry.shouldRetrieve && entry.goldChunkIds.length > 0` 조건을 통과한 entry 만 `positives` 에 담겨 `macroAverage` 로 전달되므로, 현재 코드 경로에서 NaN entry 가 `positives` 에 포함되는 경우는 없다. 따라서 분모 오류가 실제로 발생하지는 않으나, spec 이 "NaN → 평균 제외"라고 명시한 반면 `macroAverage` 함수 자체는 이 보장을 코드 레벨에서 명시적으로 담보하지 않는다. W9 테스트(goldChunkIds=[] && shouldRetrieve=true)는 `positives` 필터에서 이미 차단되므로 분모 오류를 검증하지 못하고 있다.
  - 제안: `macroAverage` 내에서 유효 entry(NaN 미발생) 카운트를 분모로 사용하거나, 현재 구조적 불변이 spec 의 NaN 제외 보장을 충족함을 코드 주석으로 명시. 또는 W9 테스트 설명에 "필터는 evaluateRetrieval 레벨에서 담보됨" 주석 추가로 Rationale 연속성 보강.

---

### 발견사항 2

- **[INFO]** LLM-judge 보류 결정 — 구현 전체에서 일관 적용 (긍정적 확인)
  - target 위치: `codebase/backend/eval/README.md` 주석, `codebase/backend/src/scripts/eval-retrieval.ts` 주석
  - 과거 결정 출처: `spec/conventions/rag-evaluation.md Rationale D-E5` — "한국어 judge 신뢰도(Fleiss κ≈0.3)가 낮아 raw judge 를 hard gate 로 쓰면 잡음. LLM-judge 는 후속 Phase 에서 ensemble·느슨 게이트로 별도 도입"
  - 상세: 구현 전체에 걸쳐 LLM-judge 를 포함하지 않고 순수 검색 지표만 사용한다. D-E5 의 기각 결정이 그대로 유지됨. 이상 없음.
  - 제안: (현상 확인, 변경 제안 없음)

---

### 발견사항 3

- **[INFO]** D-E3 LlmService 경유 — 직접 SDK/subprocess 호출 없음 (긍정적 확인)
  - target 위치: `codebase/backend/src/scripts/generate-golden-set.ts`
  - 과거 결정 출처: `spec/conventions/rag-evaluation.md Rationale D-E3` — "생성기는 claude -p/SDK 직접 호출 대신 제품 자체 LlmService.chat()(graph-extraction 과 동일 패턴)을 쓴다"
  - 상세: `generate-golden-set.ts` 는 `LlmService` 를 DI 로 주입받아 사용하며 Anthropic SDK 직접 호출 또는 subprocess 경로는 없다. D-E3 + CLAUDE.md 외부 LLM 호출 정책 모두 준수. 이상 없음.
  - 제안: (현상 확인, 변경 제안 없음)

---

### 발견사항 4

- **[INFO]** 9-rag-search Rationale "노드 단위 리랭크 기각" — eval `--threshold` 처리 방식 검증
  - target 위치: `codebase/backend/src/scripts/eval-retrieval.ts` lines 125, 184
  - 과거 결정 출처: `spec/5-system/9-rag-search.md Rationale` — "노드 단위 리랭크 설정: KB 소유권 원칙 위반·설정 분산. 기각." 및 "왜 ragThreshold 의미를 재해석했나: 기존 ragThreshold 를 rerank_mode 에 따라 분기 해석한다."
  - 상세: eval-retrieval 이 `--threshold` 를 `searchWithMeta()` 에 전달하는 구조는 "런타임 threshold" 경로이고, `searchWithMeta` 내부에서 KB 의 `rerank_mode` 에 따라 cosine 임계 또는 rerank 점수 임계로 분기 해석된다(`rag-search.service.ts` lines 213–215). 기각된 "노드 단위 리랭크 설정" 대안의 재도입이 아님. 이상 없음.
  - 제안: `eval/README.md` 의 `--threshold` 항목에 "KB 의 rerank_mode 가 off 이면 cosine 임계, cross_encoder 이면 rerank 점수 임계로 해석됨(spec §3.3 / Rationale I4)" 한 줄 설명을 추가하면 Rationale 연속성이 명시적으로 기록된다.

---

## 요약

이번 diff(RAG 평가 하베스 P0 Phase 0+1 구현)는 `spec/conventions/rag-evaluation.md` 및 `spec/5-system/9-rag-search.md` 의 Rationale 결정과 전반적으로 정합한다. D-E1(역방향 생성 gold 공짜)·D-E2(언어 휴리스틱)·D-E3(제품 LlmService 경유)·D-E4(결정성)·D-E5(LLM-judge 보류)·D-E6(silver/gold 상대비교) 모두 코드에서 올바르게 구현되었고, 9-rag-search Rationale 의 "노드 단위 리랭크 기각"·"KB 단위 설정 원칙"·"off 기본"도 eval 스크립트의 threshold 처리 경로에서 위반이 없다. 유일한 주의 사항은 `macroAverage` 의 분모가 구조적으로는 문제없으나 spec 이 명시한 "NaN → 평균 제외" 보장을 함수 레벨에서 명시적으로 표현하지 않는다는 코드 명확성 사안이다. 기각된 대안의 재도입이나 합의 원칙 위반에 해당하는 CRITICAL/WARNING 발견사항은 없다.

---

## 위험도

NONE
