# Rationale 연속성 검토 결과

검토 범위: `spec/5-system/` (diff-base: origin/main, 구현 완료 후 검토)
실제 변경된 spec 파일: `spec/5-system/7-llm-client.md`, `spec/5-system/8-embedding-pipeline.md`, `spec/5-system/17-agent-memory.md`, `spec/2-navigation/5-knowledge-base.md`

---

## 발견사항

- **[WARNING]** `LLMClient.embed` 인터페이스 시그니처 확장 — "평탄한 시그니처" 원칙 번복의 Rationale 명시 범위 불충분
  - target 위치: `spec/5-system/7-llm-client.md §3.3 "embed 시그니처 (LLMClient 인터페이스)"` + `§8.3 서비스 계층`
  - 과거 결정 출처: `spec/5-system/7-llm-client.md §3.3` 기존 Rationale — "임베딩은 파라미터/응답 객체를 쓰지 않고 **평탄한 시그니처**를 사용한다."
  - 상세: 기존 `embed(texts, model?)` 2-인자 시그니처는 "파라미터/응답 객체 없는 평탄한 형식" 으로 확립돼 있었다. 이번 변경에서 `LLMClient.embed` 인터페이스 자체에 `inputType?: "query" | "document"` 가 세 번째 위치 인자로 추가되었다. `spec/5-system/7-llm-client.md Rationale` 에는 `LlmService.embed` 의 위치 인자 확장 이유만 신설되었으나("왜 LlmService.embed 에 opts/inputType 을 위치 인자로 추가했나"), `LLMClient` **인터페이스** 수준의 확장에 대한 별도 Rationale 항목이 빠져 있다. §3.3 본문은 "평탄한 시그니처" 원칙을 여전히 기술하면서 새 인자를 추가하는 자기모순을 품고 있다. 신설 Rationale 항목이 "서비스 계층(LlmService)" 범위로만 한정 표현되어 있어, LLMClient 인터페이스 변경의 정당성(인터페이스 level 에서 왜 위치 인자 확장이 "평탄한 시그니처" 원칙 위반이 아닌가) 이 명시되지 않았다.
  - 제안: `spec/5-system/7-llm-client.md Rationale` 에 "왜 LLMClient.embed 인터페이스에 inputType 를 추가했나" 항목을 분리 신설하거나, 기존 신설 항목이 LLMClient 인터페이스와 서비스 계층 양쪽을 포괄하도록 명시 확장한다. §3.3 본문의 "평탄한 시그니처" 서술도 "위치 인자 추가는 객체화가 아니라 plain scalar 확장이므로 평탄한 시그니처 원칙 범위 내" 임을 한 문장 설명으로 보완한다.

- **[INFO]** `spec/2-navigation/5-knowledge-base.md` 한국어 추천 배지 — select-only Rationale 정합 명시 보완 권장
  - target 위치: `spec/2-navigation/5-knowledge-base.md §2.2 임베딩 모델` 필드 설명
  - 과거 결정 출처: `spec/2-navigation/5-knowledge-base.md Rationale R-1` + `spec/2-navigation/6-config.md Rationale R-1` — "임베딩 모델 선택은 select-only 강제, 조회 실패 시 자유 입력 fallback 없음"
  - 상세: 변경된 §2.2 임베딩 모델 행은 "비강제(선택을 제한하지 않으며, select-only 원칙 유지: 배지는 기존 option 라벨 위 표시용 메타데이터일 뿐 자유 입력 경로를 추가하지 않는다)" 를 인라인으로 명시해 기존 select-only Rationale 정합을 충분히 보호하고 있다. Rationale 섹션(R-1)에 별도 항목이 추가되지 않았으나 인라인 설명이 R-1 의 핵심 조건을 충족하는지 서술하고 있어 충돌 위험은 낮다. 다만 R-1 은 "임베딩 모델은 모델별 차원(dimension) 이 달라 잘못된 ID 저장 시 KB 임베딩 통째로 손상" 을 근거로 강도 높게 정의되어 있으므로, 배지 패턴 파일(embedding-model-recommendation.ts)이 option 라벨 메타데이터만 다루고 선택 집합(목록)을 확장하지 않음을 R-1 하위에 한 줄 교차 참조로 보완하면 미래 독자의 "배지 추가가 R-1 을 잠식하지 않는가" 의문을 명시 해소할 수 있다.
  - 제안: `spec/2-navigation/5-knowledge-base.md Rationale R-1` 말미에 "한국어 추천 배지(§2.2 embedding-model-recommendation.ts)는 option 라벨 표시용 메타데이터일 뿐, 선택 집합 자체를 바꾸거나 자유 입력 경로를 추가하지 않으므로 본 R-1 의 적용 범위 밖이다" 1문장 추가.

- **[INFO]** `spec/5-system/17-agent-memory.md` 비대칭 inputType 배선 추가 — 기존 재임베딩 부재 caveat 의 Rationale 미기재
  - target 위치: `spec/5-system/17-agent-memory.md §2 (recall 섹션)` 신규 callout 블록
  - 과거 결정 출처: `spec/5-system/8-embedding-pipeline.md Rationale "결정: 비대칭 입력 배선"` — "자동 트리거 대신 수동 재임베딩 플로우로 안내(비용 통제)"
  - 상세: agent memory 에는 KB 와 달리 일괄 재임베딩 경로가 없어, inputType 배선 이전 비대칭 모델로 저장된 기존 메모리가 미접두사 상태로 남는다. 신규 callout 이 이를 "dedup UPDATE(AGM-09) 재저장 또는 TTL 만료로 자연 해소" 로 설명하고 있으나, 이것이 왜 허용 가능한 트레이드오프인지(규모·비용·구조적 차이)에 대한 Rationale 항목이 `spec/5-system/17-agent-memory.md ## Rationale` 에 없다. 현 설명은 본문 callout 에만 그쳐 있어, 향후 운영 담당자가 "agent memory 재임베딩을 왜 KB 처럼 수동 제공하지 않았나" 를 추적하기 어렵다.
  - 제안: `spec/5-system/17-agent-memory.md ## Rationale` 섹션이 없으면 신설하거나 기존 섹션에, "비대칭 inputType 도입 후 기존 메모리 재임베딩 경로 미제공 이유" (KB 와의 구조적 차이 — single tenant scope_key, TTL, dedup UPDATE 로 자연 대체됨) 를 명시한다.

---

## 요약

이번 변경(spec/5-system/7-llm-client.md, spec/5-system/8-embedding-pipeline.md, spec/5-system/17-agent-memory.md, spec/2-navigation/5-knowledge-base.md)은 비대칭 임베딩 모델(e5/Gemini) 지원을 위한 inputType 파라미터 추가와 한국어 추천 배지 UX 개선이 핵심이다. 명시적으로 기각된 대안을 재도입하거나 합의된 invariant 를 직접 위반하는 CRITICAL 사항은 없다. 다만 LLMClient.embed 인터페이스 수준의 시그니처 확장에 대한 Rationale 가 "서비스 계층" 범위로만 한정 기술되어 인터페이스 수준 "평탄한 시그니처" 원칙과의 관계가 불분명한 WARNING 이 1건 있다. 나머지 INFO 2건은 기존 결정과 충돌하지 않으나 미래 독자를 위한 Rationale 보완이 권장되는 항목이다.

---

## 위험도

LOW
