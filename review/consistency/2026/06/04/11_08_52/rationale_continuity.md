# Rationale 연속성 검토 결과

검토 모드: `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`

대상 변경 파일:
- `spec/5-system/9-rag-search.md` (주 변경)
- `spec/5-system/7-llm-client.md`
- `spec/5-system/4-execution-engine.md`
- `spec/5-system/5-expression-language.md`
- `spec/5-system/14-external-interaction-api.md`
- `spec/5-system/15-chat-channel.md`
- `spec/5-system/_product-overview.md`

---

## 발견사항

- **[INFO]** `spec/5-system/9-rag-search.md` — `## Rationale` 신설, 폐기 대안 목록 포함
  - target 위치: `spec/5-system/9-rag-search.md` 신규 추가된 `## Rationale` 절
  - 과거 결정 출처: `plan/in-progress/spec-draft-rag-reranking.md` 의 `## Rationale` (draft 에서 도출된 결정들)
  - 상세: 신규 `## Rationale` 는 다음 결정들을 기록하고 있으며 모두 draft 의 기각 대안과 일치한다.
    - `off` 기본: 셀프호스팅 강제 의존성 기각 (draft §1 핵심 원칙과 동일)
    - KB 단위: 노드 단위 기각 (draft §4.2 와 동일)
    - `rag_mode` 불변 / `rerank_mode` 가변 비대칭 정당화: draft 와 동일 근거
    - 기각 대안 목록 4건 ("노드 단위", "항상 리랭크", "cosine 임계 유지", "VectorChord/ColBERT") 이 draft 에서 이미 정리된 사항을 spec Rationale 로 정식화
  - 판단: 기각 대안의 재도입이 아니라 올바른 정방향 이전이다. Rationale 가 올바르게 신설되었으며 draft 와 내용이 일관된다.
  - 제안: 없음 (이상 없음).

- **[INFO]** `spec/5-system/9-rag-search.md` §3.3.2 흐름, `LLMClient.rerank()` → `RerankClient.rerank()` 변경
  - target 위치: §3.3.2 흐름 2단계 설명 (`(RerankClient.rerank() — Spec LLM Client §3.6/§4.1)`)
  - 과거 결정 출처: `plan/in-progress/spec-draft-rag-reranking.md §2.2` — RerankClient 를 LLMClient 와 분리된 별도 인터페이스로 결정
  - 상세: 구현 전 draft 의 기술은 `LLMClient.rerank()` 를 사용했으나, 구현 완료 후 `RerankClient.rerank()` 로 정정된 것이다. `7-llm-client.md` 의 신규 Rationale 가 "왜 분리했나" 를 명시적으로 기록하고 있으므로 결정 번복이 아닌 구현 사실 반영이다.
  - 판단: 정합. Rationale 의 "RerankClient 를 LLMClient 와 분리한 이유" 항목이 함께 신설되었으므로 근거 없는 번복이 아니다.

- **[INFO]** `spec/5-system/9-rag-search.md` §3.3.2 `cross_encoder_llm` 의 "항상 LLM grading" 정책
  - target 위치: §3.3.2 3단계, §3.3.1 테이블, 신규 Rationale 의 v1 결정 설명
  - 과거 결정 출처: `plan/in-progress/spec-draft-rag-reranking.md §4.2` — "v1 확정: 항상 1콜. 조건부 escalate 없음. 후속 최적화: 점수 평탄/모호 기반 conditional escalate"
  - 상세: target spec 이 draft 의 v1 결정 ("항상 LLM grading 수행") 을 그대로 채택하고, draft 의 후속 최적화 메모 ("점수 평탄/모호 기반 conditional escalate 는 P0 평가셋 보정 후 도입") 도 Rationale 에 명시한다. 이는 draft 결정의 올바른 정방향 반영이다. 기각된 대안("conditional escalate")이 명시적으로 기각 이유와 함께 기록되어 있다.
  - 판단: 정합.

- **[INFO]** `spec/5-system/7-llm-client.md` — `## Rationale` 신설
  - target 위치: `spec/5-system/7-llm-client.md` 신규 `## Rationale` 절 3개 항목
  - 과거 결정 출처: `plan/in-progress/spec-draft-rag-reranking.md §2.2` — RerankConfig 를 LLMConfig 의 sibling 리소스로 분리
  - 상세: "왜 RerankClient 를 LLMClient 와 분리된 별도 인터페이스로 둔 것인가", "왜 SSRF 가드·secret-store 는 재사용하는가", "왜 LLMClientFactory 에 통합하지 않았나" 세 항목 모두 draft §2.2 의 결정("동형의 sibling 리소스")과 일관된다. 기각 대안("capability flag 로 LLMConfig 에 욱여넣기")이 Rationale 에 명시되어 있다.
  - 판단: 정합. Rationale 신설이 결정 근거를 명확히 한다.

- **[INFO]** `spec/5-system/4-execution-engine.md` — 내부 링크 anchor 수정만
  - target 위치: §7 저장 정책 note, §9 SIGTERM §9.1
  - 상세: Rationale 와 무관한 내부 문서 링크 anchor 수정 (`#44-사용자-입력-대기-이벤트-상세-...` → `#44-실행-진행-이벤트`, `#82-websocket-명령-클라이언트--서버` → `#82-execution-제어-명령`). 어떤 설계 결정도 번복하지 않는다.
  - 판단: Rationale 연속성에 영향 없음.

- **[INFO]** `spec/5-system/14-external-interaction-api.md`, `spec/5-system/15-chat-channel.md` — 내부 링크 anchor 수정만
  - 상세: `#42-hmac-서명--authconfigtypehmac` → `#42-hmac-서명`, `#34-신뢰성일관성` → `#34-신뢰성·일관성`, `r-cca-5-대안-2-기각` → `#r-cca-5` 등 anchor 형식 정규화. 설계 결정 자체는 변경 없음.
  - 판단: Rationale 연속성에 영향 없음.

- **[INFO]** `spec/5-system/_product-overview.md` — spec 맵 링크 축소
  - target 위치: 문서 상단 관련 문서 링크 목록
  - 상세: 긴 spec 맵 목록이 핵심 3개 링크만 남도록 축소됨. 어떤 설계 결정이나 Rationale 을 삭제하거나 번복하는 변경이 아니다.
  - 판단: Rationale 연속성에 영향 없음.

---

## 요약

`spec/5-system/` 범위의 이번 변경은 RAG 리랭킹(cross-encoder) v1 구현 완료를 반영한 spec 동기화다. 핵심 변경인 `9-rag-search.md` 와 `7-llm-client.md` 모두 기존 draft(`plan/in-progress/spec-draft-rag-reranking.md`) 에서 합의된 결정을 정방향으로 spec 에 이전했으며, 신규 `## Rationale` 절이 각 결정의 근거와 기각 대안을 함께 명시하고 있다. 기각된 대안(노드 단위 설정, 항상 리랭크 강제, cosine 임계 유지 리랭크, LLMConfig 통합)은 재도입 없이 Rationale 에 기록됐다. 나머지 파일 변경은 내부 링크 anchor 정규화 수준이며 어떤 설계 원칙에도 영향을 주지 않는다. Rationale 연속성 관점에서 위반 사항이 없다.

---

## 위험도

NONE
