# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-draft-rag-dynamic-cut.md`
참조 spec: `spec/5-system/9-rag-search.md`, `plan/complete/spec-draft-rag-reranking.md`, `plan/in-progress/rag-rerank-followup.md`, `plan/in-progress/rag-quality-improvement.md`, `spec/5-system/17-agent-memory.md`

---

## 발견사항

- **[WARNING]** D2 conditional escalate — v1 "항상 grading" 결정의 무근거 번복
  - target 위치: A3 §3.3.1 `cross_encoder_llm` 행 신규 기술, A4 §3.3.2 "v1 결정" bullet 갱신, 그리고 `## Rationale (draft 자체)` "왜 D2 conditional escalate 를 지금 도입하나"
  - 과거 결정 출처: `plan/complete/spec-draft-rag-reranking.md` §4.2 + `## Rationale` "남은 결정 ② cross_encoder_llm = 항상 LLM grading(v1). 점수기반 conditional escalate 정량 임계는 P0 보정 후 후속 최적화" / `spec/5-system/9-rag-search.md §3.3.2` "v1 결정: `cross_encoder_llm` 은 항상 LLM grading 을 수행한다(점수 평탄/모호 기반 conditional escalate 는 … 후속 도입)" / `plan/in-progress/rag-rerank-followup.md` "conditional escalate 정량 임계 — P0 평가셋 보정 후 도입"
  - 상세: 이전 spec 에서 "v1 = 항상 grading, conditional escalate 는 P0 평가셋 이후 후속" 으로 **명시 확정**된 결정을 target 이 "메커니즘(진입 구조 + 합리적 default 임계)은 이번 PR 포함, 정량 임계 A/B 만 후속" 으로 번복한다. target draft 자체에 "왜 D2 conditional escalate 를 지금 도입하나" 라는 새 Rationale 항목이 있으므로 **새 Rationale 부재(CRITICAL 기준)는 아니다**. 그러나 기존 Rationale 에서 조건이었던 "P0 평가셋 선행 + 정량 임계 확정" 없이도 도입이 안전한 이유("escalate 안 됨 = 기존 동작"이라는 안전 논거)가 target draft 내에서 제시되어 있어 번복 이유 자체는 존재한다. 다만 과거 확정된 결정("2026-06-04 확정: 항상 grading")이 사용자 논의(`rag-quality-improvement.md §6`)를 거쳐 확정된 것인 반면, 본 번복의 트리거가 목표 spec draft 내에서만 서술되어 있어 —연속성 체인(기존 Rationale → 번복 Rationale)이 spec 본문에 명시적으로 기록될 필요가 있다.
  - 제안: target 의 A8 `## Rationale` "왜 D2 conditional escalate 를 지금 도입하나" 항목에 **"v1 확정(spec-draft-rag-reranking.md §4.2) 대비 번복 이유"** 를 명시하도록 보강한다. 구체적으로 "기존 v1 결정은 'P0 평가셋 없이 정량 임계를 정하기 어려워 항상 grading 으로 단순화' 한 것이었으나, escalate 진입 구조 자체(분기 로직)는 데이터 무관하게 안전(미escalate 시 기존 동작과 동일)하므로 메커니즘과 임계 A/B 를 분리 도입 가능하다" 는 취지를 기존 결정과의 연계 형식으로 적는다.

- **[WARNING]** `off` 모드 "byte-identical (하위호환)" 원칙의 번복 — 새 Rationale 갱신 필요
  - target 위치: A3 §3.3.1 `off` 행 신규 기술 ("D1 이전: 고정 `LIMIT topK`. 동적 컷은 cosine 점수 위 app-layer 후처리"), A8 "갱신 왜 완전 선택적(off 기본)인가" 항목
  - 과거 결정 출처: `plan/complete/spec-draft-rag-reranking.md` §1 "KB 단위 `rerank_mode` 의 기본값은 `off` — 설정하지 않으면 현재와 완전히 동일하게 동작한다 (하위호환)" + `## Rationale` "왜 완전 선택적(off 기본)인가" "(a) 하위호환 byte-identical" / `spec/5-system/9-rag-search.md §3.3.1` `off` 행: "**현행과 byte-identical (하위호환)**"
  - 상세: `off` 모드의 "byte-identical 하위호환" 은 리랭킹 spec 에서 핵심 invariant 로 명시("설정하지 않으면 현재와 완전히 동일하게 동작")됐다. target 이 `off` 모드에 동적 점수 컷(token-budget + inject-cap)을 추가로 적용함으로써 이 invariant 를 의도적으로 파기한다. target A8 에 "byte-identical 문구 제거" 및 의미 변화 이유 설명이 포함되어 있어 Rationale 갱신이 의도됐음을 알 수 있다. 단 과거 Rationale 에 명시된 "(a) 하위호환 byte-identical" 조항이 **폐기된다는 사실을 기존 Rationale 항목 내에서** 명시적으로 포인트아웃하지 않으면, 이후 독자가 "왜 off 모드에 byte-identical 원칙이 사라졌나"를 추적할 수 없다.
  - 제안: A8 갱신 항목에서 "byte-identical 문구 제거" 사실과 함께 **"리랭킹 spec 에서 기록된 byte-identical 조항(spec-draft-rag-reranking.md §1 / rag-search.md §3.3.1) 을 본 D1 개정으로 폐기"** 를 한 줄 명시하고, 새로운 하위호환 정의("리랭커 인프라 의존 없음")가 기존 정의("SQL 동일")를 대체하는 근거를 서술한다.

- **[INFO]** `ragTopK` 기본값 제거(optional 화) — 기존 Rationale 에 "노드 config 필드 증식 회피" 원칙을 재확인할 보완 기회
  - target 위치: B1 §1 config 표 — ragTopK 기본값 칸 제거, A8 "왜 ragTopK 기본값(5)을 제거(optional)했나"
  - 과거 결정 출처: `plan/complete/spec-draft-rag-reranking.md` §5 "AI Agent 노드 단위: `ragTopK` = 리랭크 후 최종 청크 수(LLM override 가능)" — 기본값 5 를 유지한 채 의미만 보강 / `## Rationale` "왜 `ragThreshold` 의미를 재해석했나" "(I4): 신규 노드 config 필드 증식을 피하고…" (필드 삭제가 아닌 재해석 방향)
  - 상세: 이전 리랭킹 spec 은 `ragTopK` 기본값 5를 유지하면서 의미만 "리랭크 후 최종 청크 수" 로 보강했다. target 은 기본값 자체를 제거해 "동적 컷 도입으로 고정 기본 주입수 개념이 사라짐"으로 번복한다. A8 에 "왜 ragTopK 기본값(5)을 제거했나" Rationale 이 있으므로 충돌은 명시적으로 처리됐다. 단 `17-agent-memory.md` 라인 83이 "기본값은 RAG 정합을 위해 동일(`5` / `0.7`)하나 별도 필드다" 고 서술하는데, target D 에서 이 문구를 갱신하는 내용이 포함돼 있어 해당 변경은 수행된다 — 주의 사항으로 spec D 반영 시 `17-agent-memory.md §4` 의 `기본값은 RAG 정합을 위해 동일(5 / 0.7)하나 별도 필드다` 에서 `ragTopK` 부분이 `0.7` 기술을 포함해 완전히 갱신되는지 확인 필요.
  - 제안: A8 Rationale 에 "이전 리랭킹 spec(spec-draft-rag-reranking.md §5)에서 ragTopK 기본값 5 를 유지했던 것은 리랭크 후 최종 슬라이스 숫자라는 의미 보강에 그쳤기 때문이며, D1 동적 컷 도입으로 고정 기본 주입수 개념 자체가 소거되므로 이 번복은 D1 의 자연스러운 귀결" 이라는 한 문장을 추가하면 연속성 체인이 완성된다.

- **[INFO]** `off` 모드 동적 컷 추가 시 `cosine θ` 이중 게이트 명확화
  - target 위치: A2 §3.1 분기 노트, A5 §3.4 동적 컷 흐름도 step `3a`
  - 과거 결정 출처: `plan/complete/spec-draft-rag-reranking.md` §3 "폐기한 대안: *cosine 임계 유지한 채 리랭크*: wide 후보를 cosine 으로 미리 굶겨 리랭커 효과 반감. 기각(§3 에서 wide 회수 시 cosine 임계 미적용)"
  - 상세: 기각된 대안 "cosine 임계 유지한 채 리랭크" 는 `rerank_mode ≠ off` 경로에 해당한다. target 은 `off` 경로에서 cosine θ 게이트를 SQL 단계에서 유지하므로 기각 대안과는 다른 경로다 — 직접 충돌은 아니다. 다만 `off` 경로가 이제 cosine θ(SQL) → app-layer 동적 컷(token-budget + inject-cap)의 이중 필터가 되는 구조를 spec 에서 충분히 서술하지 않으면 "왜 off 만 cosine θ 를 SQL 에서 유지하는가" 에 대한 의문이 생길 수 있다.
  - 제안: A5 §3.4 또는 A8 Rationale 에 "off 경로에서 cosine θ 는 SQL 단계 관련성 게이트로 유지되며, 기각된 대안('cosine 임계 유지한 채 리랭크', rerank ≠ off 경로)과는 별개다 — off 경로 cosine θ 는 리랭커 없는 관련성 게이트이므로 제거 대상이 아니다" 를 명기한다.

---

## 요약

target 문서는 D1(동적 점수 컷)과 D2(conditional escalate) 두 결정에 대해 새로운 Rationale 항목을 대체로 갖추고 있어 완전한 Rationale 공백은 없다. 그러나 두 건의 WARNING 이 존재한다. 첫째, `cross_encoder_llm` v1 "항상 grading" 결정(2026-06-04 확정)을 번복하면서 새 Rationale 이 draft 내에 있으나 기존 Rationale(spec-draft-rag-reranking.md §4.2 + rag-search.md §3.3.2 v1 결정)을 명시적으로 참조·폐기 선언하지 않아 연속성 체인이 불완전하다. 둘째, `off` 모드의 "byte-identical 하위호환" invariant 가 의도적으로 파기되는데, A8 에 갱신 의도가 있으나 기존 Rationale 의 "(a) 하위호환 byte-identical" 조항이 폐기된다는 사실을 해당 항목 내에서 명시적으로 기록하지 않는다. 두 WARNING 모두 spec 본문 반영 시 Rationale 항목에 "기존 결정 출처 + 번복 이유" 를 한 문장씩 추가하는 것으로 해소 가능하다.

---

## 위험도

MEDIUM
