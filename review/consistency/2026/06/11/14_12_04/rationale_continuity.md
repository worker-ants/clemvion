# Rationale 연속성 검토 결과

**대상 문서**: `spec/2-navigation/14-execution-history.md`
**검토 모드**: spec draft 검토 (--spec)
**검토 일시**: 2026-06-11

---

## 발견사항

### 발견사항 없음 (NONE)

4개 검토 관점 모두에서 유의미한 위반 또는 충돌이 발견되지 않았다. 개별 항목은 아래 INFO 수준 보완 제안으로 기술한다.

---

- **[INFO]** R-3 (LLM 탭 평탄화) — 이전 구조명 `LLM Information` 언급 위치
  - target 위치: `spec/2-navigation/14-execution-history.md` §3.4.2 본문 + Rationale R-3
  - 과거 결정 출처: `spec/3-workflow-editor/3-execution.md` (LLM Usage/Response/Request 탭 구조), `spec/4-nodes/3-ai/1-ai-agent.md` §9 (`_llmCalls`/`_turnDebugHistory` 구조)
  - 상세: 본문 §3.4.2 는 "이전에는 단일 `LLM Information` 탭 아래 `Response / Request / Usage` 하위 탭 구조였으나 …평탄화되었다" 라고 명시하고, Rationale R-3 에서 평탄화 이유를 설명한다. `spec/3-workflow-editor/3-execution.md` 의 현행 탭 구조(노드 레벨: LLM Usage 단독 / 메시지 레벨: Preview / Response / Request / LLM Usage)와 완전히 일치한다. `spec/4-nodes/3-ai/1-ai-agent.md` §9 도 "구 'LLM Information' 단일 탭 — 평탄화됨" 이라는 cross-link 주석으로 동일한 번경 사실을 인정하고 있어 세 문서 간 정합성이 유지된다.
  - 제안: 현 상태 유지 가능. 다만 `spec/3-workflow-editor/3-execution.md §Rationale` 에는 탭 구조 변경의 근거가 별도로 기록되지 않고 본 문서(14-execution-history.md)의 R-3 에만 있다. 향후 에디터 spec 을 독립적으로 읽는 독자가 "왜 LLM Usage 탭만 최상위인가" 를 찾을 때 cross-link 가 없어 혼란이 생길 수 있으므로, `3-execution.md §Rationale` 에 "LLM 탭 구조 결정의 SoT: [14-execution-history.md R-3]" 한 줄을 추가하면 좋다.

- **[INFO]** sort 기본값 `started_at` — API 규약 예시 `created_at` 와의 비대칭
  - target 위치: `spec/2-navigation/14-execution-history.md` §5 목록 API 쿼리 파라미터 표
  - 과거 결정 출처: `spec/5-system/2-api-convention.md §4.1` 목록 조회 쿼리 파라미터 (`sort` 기본값 예시 `created_at`)
  - 상세: API 규약 §4.1 은 `sort` 기본값을 `created_at` 으로 예시하나, 해당 항목은 강제 규칙이 아니라 도메인별 오버라이드를 허용하는 예시다. target 은 비고 인라인에 "기본값이 규약 예시(`created_at`)와 다른 것은 의도된 도메인 오버라이드 — 실행 이력의 자연 정렬 축은 생성이 아니라 시작 시각" 이라고 명시하고 있어 번복이 아닌 의도된 예외 선언이다.
  - 제안: 현 인라인 설명으로 충분하다. API 규약 §4.1 에 "도메인별 오버라이드 허용" 을 한 문장 명문화하면 동일 패턴이 다른 도메인에서도 재현될 때 혼란을 줄일 수 있다(해당 문서 변경은 이 문서 범위 밖).

- **[INFO]** `pending` 상태 필터 제외 — 실행 엔진 spec 과의 암묵적 정합
  - target 위치: `spec/2-navigation/14-execution-history.md` §2.3 필터 표 하단 주석
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md §1.1` (Execution 상태 전이), `spec/1-data-model.md §2.13` (Execution 엔티티)
  - 상세: target 은 `pending` 을 "실행 시작 직전의 순간적 전이 상태라 사용자가 조회·조치할 대상이 아니며, All 필터에서는 여전히 노출된다" 고 인라인 주석으로 설명한다. 실행 엔진 spec 은 `pending` 이 intake 큐 처리 전 짧은 상태임을 명시하고 있어 이 설계와 방향이 일치한다. All 필터에서는 포함된다는 사실도 명시되어 있어 숨김 처리가 아님이 확인된다. Rationale 절에는 이 결정이 별도 항목으로 기록되지 않는다.
  - 제안: §2.3 인라인 주석으로 판단 근거가 충분히 기록돼 있다. 필요 시 Rationale 에 "R-5. `pending` 상태를 필터 칩에서 제외한 이유" 항을 추가하면 체계적이지만, 현 인라인 수준도 허용 가능하다.

---

## 요약

`spec/2-navigation/14-execution-history.md` 의 Rationale 연속성을 전수 검토한 결과, 기각된 대안의 재도입, 합의된 원칙 위반, 무근거 결정 번복, 암묵적 가정 충돌 중 어느 항목도 해당하지 않는다. 핵심 설계 결정 4건(nodeExecutions N+1 회피, triggerSource 5종 정규화, LLM 탭 평탄화, Skipped 노드 제외)은 모두 Rationale 에 근거가 명시되어 있으며, 관련 spec(`spec/3-workflow-editor/3-execution.md`, `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/5-system/4-execution-engine.md`, `spec/5-system/2-api-convention.md`)의 Rationale 과 충돌하지 않는다. LLM 탭 평탄화는 R-3 에서 이전 구조를 명시적으로 언급하고 번경 근거를 서술하고 있어 형식 요건을 갖추었다. INFO 수준 보완 제안 3건(에디터 spec cross-link 추가, API 규약 명문화, pending 필터 Rationale 항 추가)이 있으나 모두 선택적 개선이다.

---

## 위험도

NONE
