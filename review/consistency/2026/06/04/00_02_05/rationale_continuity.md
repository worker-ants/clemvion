# Rationale 연속성 검토 결과

- 검토 대상: `plan/in-progress/spec-draft-rag-reranking.md`
- 관련 spec: `spec/5-system/9-rag-search.md`, `spec/5-system/7-llm-client.md`, `spec/5-system/10-graph-rag.md`, `spec/2-navigation/5-knowledge-base.md`, `spec/4-nodes/3-ai/1-ai-agent.md`

---

## 발견사항

### [INFO] `ragThreshold` 의미 변경에 새 Rationale 부재이나 근거는 내재됨
- target 위치: `plan/in-progress/spec-draft-rag-reranking.md` §5 "AI Agent 노드 단위"
- 과거 결정 출처: `spec/5-system/9-rag-search.md` §2.1 KB tool 정의(`threshold` = 유사도 임계값), `spec/4-nodes/3-ai/1-ai-agent.md` §1 config 표(`ragThreshold = 최소 유사도 임계값 0-1`)
- 상세: target 은 `ragThreshold` 를 `rerank_mode≠off` 일 때 "rerank 점수 임계 default (KB `rerank_score_threshold` 미설정 시 fallback)" 로 재해석한다. 기존 spec 에서 `ragThreshold` 는 명확하게 cosine 유사도 임계값으로 정의돼 있으며, LLM 이 `threshold` 인자로 override 하는 경로도 cosine 기반이다. 이 의미 재해석은 결정 번복에 해당하지만 target Rationale 내에 "컷 기준을 cosine → rerank 점수로 이동하는 것이 핵심" 이라는 설명이 있어 근거가 완전히 없진 않다. 그러나 기존 spec 의 `ragThreshold` 항목을 직접 갱신하는 Rationale 이 spec 본문에 명시되어 있지 않다.
- 제안: 영향 spec `spec/4-nodes/3-ai/1-ai-agent.md` §1 config 표의 `ragThreshold` 항에 "rerank_mode≠off KB 에서는 rerank 점수 임계로 해석됨 (cosine 아님)" 을 주석 추가하고, `spec/5-system/9-rag-search.md` §2.1 `threshold` 파라미터 설명에도 `rerank_mode` 분기를 명시. spec 반영 시 동반 Rationale 항목 추가 권장.

### [INFO] `rag_mode` 불변 원칙과 `rerank_mode` 가변 원칙의 대비 — 명시 근거 부재
- target 위치: `plan/in-progress/spec-draft-rag-reranking.md` §2.1 데이터 모델 첫 번째 비고
- 과거 결정 출처: `spec/5-system/10-graph-rag.md` §3.1 KB-GR-MD-02, 기술 결정 표 #6 "KB 모드 사후 변경 — 생성 시에만 결정(불변). 모드 전환은 새 KB 생성으로 대체"
- 상세: `rag_mode` 는 생성 시 결정 후 불변이 확립된 원칙이다. target 은 `rerank_mode` 를 "사후 변경 가능(재임베딩 불요)" 로 정의한다. 두 필드가 같은 KB 설정 레이어에 공존하면서 한쪽은 불변·한쪽은 가변인 비대칭에 대한 명시 근거가 target Rationale 에 없다. `rag_mode` 불변 이유("마이그레이션·UX 부담")가 `rerank_mode` 에는 해당하지 않는다는 사실을 target 이 암묵적으로만 전제한다.
- 제안: target Rationale 의 "왜 KB 단위인가" 항에 "왜 rerank_mode 는 rag_mode 와 달리 사후 변경을 허용하는가: 리랭크 설정은 검색 시점 적용이라 재임베딩·데이터 마이그레이션이 없으며, rag_mode 불변의 근거(추출 파이프라인 마이그레이션 비용)가 적용되지 않는다" 를 한 줄로 추가.

### [INFO] `LLMClient.rerank?()` 에러코드 처리 방식의 의도 불명
- target 위치: `plan/in-progress/spec-draft-rag-reranking.md` §6
- 과거 결정 출처: `spec/5-system/7-llm-client.md` §6 에러 처리 표, §8.4 `LLM_STREAMING_UNSUPPORTED` 패턴
- 상세: target 은 `LLMClient` 에 `rerank?()` 를 추가하고 미지원 provider 구성 시 `LLM_CONFIG_INVALID` 로 처리한다고 기술한다. `LLM_CONFIG_INVALID` 재사용은 기존 에러 코드 패턴과 일관되지만, `stream?()` 의 경우 전용 `LLM_STREAMING_UNSUPPORTED` 를 도입한 패턴과 대비될 때 왜 rerank 는 전용 코드를 쓰지 않는지 target Rationale 에 언급이 없다. 또한 §6 에러 처리 표에 rerank 에러 항목 추가가 반영 대상에 포함되지 않는다.
- 제안: target Rationale 또는 §6 반영 대상 목록에 "rerank 미지원 에러는 전용 코드 대신 `LLM_CONFIG_INVALID` 재사용 (설정 오류로 간주 — stream 미지원과 달리 실행 중 호출이 아니라 구성 시점 실패이므로 별도 enum 불필요)" 명시 권장.

---

## 요약

target 문서(`spec-draft-rag-reranking.md`)는 기존 spec Rationale 에서 명시적으로 기각된 대안을 재도입하거나 합의된 invariant 를 직접 위반하는 CRITICAL/WARNING 사항을 포함하지 않는다. 세 가지 발견 모두 INFO 수준이다: (1) `ragThreshold` 의미 재해석이 영향 spec 갱신 시 동반 Rationale 없이 남을 위험, (2) `rag_mode` 불변 원칙과 `rerank_mode` 가변 허용의 비대칭에 대한 명시 근거 부재, (3) `rerank?()` 에러 처리 방식의 의도 불명. 주요 설계 원칙—KB 소유권 원칙, 노드 인터페이스 불변(`ragTopK`/`ragThreshold`), 셀프호스팅 선택성(off 기본), graceful degradation—은 모두 올바르게 계승하고 있으며, target 자체 Rationale 에 폐기 대안까지 명시하여 Rationale 연속성 측면에서 전반적으로 양호하다.

## 위험도

LOW
