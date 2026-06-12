# Rationale 연속성 검토 결과

검토 대상: `spec/5-system/10-graph-rag.md`
검토 모드: spec draft (--spec)

---

## 발견사항

### 발견사항 없음 — 모든 변경이 Rationale 원칙과 정합

검토된 변경 내용 (git diff):

1. `ragSources[]` 예시 JSON 의 텍스트 미리보기 필드명 `"chunk"` → `"content"` 로 교정
2. `§4.3` 에 SoT 교차 참조 노트 추가: `ragSources[]` 스키마의 단일 SoT 는 `9-rag-search.md §4.1` 임을 명시

---

**[INFO]** `"chunk"` 필드는 canon 필드명이 아님 — 오류 수정, 원칙 위반 아님
- target 위치: `spec/5-system/10-graph-rag.md §4.3` (예시 JSON 두 항목)
- 과거 결정 출처: `spec/5-system/9-rag-search.md §4.1 ragSources` 스키마 정의; `plan/complete/spec-draft-rag-reranking.md §Rationale`
- 상세: `9-rag-search.md §4.1` 은 텍스트 미리보기 필드를 `"content"` 로 정의하고 "원본 청크 텍스트의 앞 200자 (미리보기용)"로 명시한다. 변경 전 `10-graph-rag.md §4.3` 의 예시가 `"chunk"` 를 사용한 것은 canon 스키마에서 이탈한 오류였다. 이번 변경이 그 오류를 교정하고 SoT 교차 참조를 추가함으로써 Rationale 연속성이 오히려 강화됐다. `plan/complete/spec-draft-rag-reranking.md` 와 `spec/4-nodes/3-ai/1-ai-agent.md §469` 에서도 동일하게 `"content"` 를 사용하고 있어 일관성이 확인된다.
- 제안: 추가 조치 불필요. INFO 등급은 변경 방향의 정합성을 확인하는 메모 수준으로 기록한다.

---

## Rationale 원칙별 점검 결과

| 점검 관점 | 결과 |
|----------|------|
| 기각된 대안의 재도입 | 이상 없음. `9-rag-search.md §Rationale` 의 "폐기한 대안" (노드 단위 리랭크 설정 / 항상 리랭크 / cosine 임계 유지 후 리랭크 / in-DB 리랭킹) 중 어느 것도 target 변경에서 재도입되지 않았다. |
| 합의된 원칙 위반 | 이상 없음. "KB 소유권 원칙"(`ragSources` 스키마를 9-rag-search.md §4.1 에서 단일 관리), "설정 분산 회피"(graph 파라미터는 KB 단위), "gradeful degradation" 등 합의 원칙이 모두 준수된다. |
| 결정의 무근거 번복 | 이상 없음. 변경 전 `"chunk"` 필드는 어떤 Rationale 에도 결정 근거가 없었다 — 기존 canon(`"content"`) 을 회복한 교정이라 "번복"에 해당하지 않는다. |
| 암묵적 가정 충돌 | 이상 없음. `graph` 모드 KB 가 동일 `meta.ragSources` 누적·References UI 소비 경로를 공유한다는 가정(`9-rag-search.md §1` "호출 결과의 분리 유지" 섹션)과 충돌하지 않는다. SoT 노트 추가가 이 가정을 명시적으로 강화한다. |

---

## 요약

`spec/5-system/10-graph-rag.md §4.3` 의 변경은 `ragSources[]` 예시 JSON 의 잘못된 필드명 `"chunk"` 를 `9-rag-search.md §4.1` 이 canonical 로 정의한 `"content"` 로 교정하고, SoT 교차 참조 노트를 추가한 것이다. 이는 과거 Rationale 에서 기각된 대안을 재도입하지 않으며, `9-rag-search.md §Rationale` 에 기록된 "KB 소유권 원칙" · "ragSources 스키마 단일 관리" · "graph 파라미터 KB 단위 제어" 등 모든 합의 원칙과 정합한다. 기존 결정이 뒤집히거나 새 Rationale 없이 번복된 항목은 없다.

---

## 위험도

NONE
