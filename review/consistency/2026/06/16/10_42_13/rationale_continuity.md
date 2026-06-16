# Rationale 연속성 검토 결과

검토 대상: `spec/2-navigation/6-config.md`
검토 모드: spec draft 검토 (--spec)
검토 일시: 2026-06-16

---

## 발견사항

- **[WARNING]** R-4 의 SSRF 예외 규칙 참조가 Dropped 결정과 불일치
  - target 위치: `spec/2-navigation/6-config.md` §R-4 (Rationale, 325번째 줄)
  - 과거 결정 출처: `spec/5-system/7-llm-client.md §2.1 Rationale` — "리랭크 provider 확장(jina/voyage/local/builtin)을 drop 했나" 항 (2026-06-05 결정)
  - 상세: R-4 의 설명이 "SSRF 가드 자체는 [LLM Client §5.5](../5-system/7-llm-client.md) 의 `tei`/`local` 예외 규칙 재사용" 이라고 서술한다. `local` 리랭커 provider 가 Dropped 됐음을 같은 문장 안에서 인정하면서도("`local` 리랭커 provider 는 Dropped"), 바로 뒤에서 SSRF 예외 규칙 출처를 `tei`/`local` 예외 규칙으로 기술한다. LLM Client §5.5 자체에도 "`local` 프로바이더는 예외" 라는 서술이 *chat* 용 Local(Ollama/vLLM) 을 가리키며 살아있으나, rerank 용 `local` 은 명시적으로 Dropped 이다. 결과적으로 R-4 의 참조 표현("§5.5 의 `tei`/`local` 예외 규칙 재사용")은 rerank 맥락에서 `local` 이 유효한 SSRF 예외 대상인 것처럼 읽혀 혼란을 준다. LLM Client §5.5 와 §2.1 Rationale 은 이미 "rerank 에는 `local` provider 가 없다 — §2.1 Dropped" 를 명확히 병기하고 있으므로 (7-llm-client.md 257번째 줄), 6-config.md 의 R-4 서술이 같은 명확성을 갖추지 못한 상태다.
  - 제안: R-4 의 SSRF 규칙 재사용 설명을 "`tei`/`local` 예외 규칙" 대신 "`tei` 사설망 예외 규칙"으로 좁혀 기술한다. 예: "SSRF 가드 자체는 [LLM Client §5.5](../5-system/7-llm-client.md) 의 `tei` 사설망 예외 규칙 재사용 — rerank 에는 `local` provider 가 없으므로 `local` 예외는 비해당". LLM Client spec 이 이미 이 사실을 명시하므로 target 이 이를 정확하게 참조하면 충분하다.

- **[INFO]** R-3 의 "연결 테스트 미제공" 근거 출처 참조 오류 가능성
  - target 위치: `spec/2-navigation/6-config.md` §B.6.2 (244번째 줄)
  - 과거 결정 출처: `spec/2-navigation/6-config.md` Rationale §R-3 (번복) — ModelConfig 단일 화면 통합
  - 상세: B.6.2 의 "연결 테스트 미제공" 설명이 `[Rationale R-3](#r-3-번복--modelconfig-단일-화면-통합)` 를 출처로 링크한다. 그러나 R-3 은 통합 결정("유지되는 것: 연결 테스트 미제공")을 열거하기는 하지만, 연결 테스트 미제공의 실질 근거("표준 model-list/test API 가 없어")는 B.6.2 본문에 서술돼 있고 R-3 에는 별도 Rationale 없이 나열만 된다. 참조 방향이 역전된 상태라 "왜 미제공인가" 의 근거 SoT 위치가 불명확하다.
  - 제안: B.6.2 참조를 별도 Rationale 항목(예: `R-7 Rerank 연결 테스트 미제공 근거`)으로 분리하거나, 본문 내 서술("표준 model-list/test API 부재")이 자급하는 서술임을 명시해 R-3 링크를 제거하거나 "(R-3 에서 열거)" 정도의 약한 참조로 표현을 완화한다. 현 상태가 오독을 일으키는 수준은 아니나 Rationale 내비게이션을 오도할 수 있다.

- **[INFO]** R-1 "범위 한정" 항의 AI 노드 `model` 필드 Expression 허용 유지 언급
  - target 위치: `spec/2-navigation/6-config.md` Rationale §R-1 (298번째 줄)
  - 과거 결정 출처: 해당 Rationale 내부에서 자체 명시
  - 상세: R-1 이 "AI 노드(spec/4-nodes/3-ai/1-ai-agent.md) 설정 패널의 `model` 필드는 Expression(`{{ vars.model }}`) 허용이 그대로 유지된다" 고 명시한다. 이는 AI 노드 spec 과의 교차 원칙이지만 해당 spec 이 별도로 이를 확인하는 링크가 없다. AI 노드 spec 이 실제로 동일 원칙을 갖고 있는지 단방향 선언 상태다.
  - 제안: AI 노드 spec(`spec/4-nodes/3-ai/1-ai-agent.md`)에서 `model` 필드의 Expression 허용 원칙이 명시돼 있는지 확인한다. 양쪽이 서로 참조하도록 cross-reference 를 보완하면 단방향 선언의 위험이 줄어든다. 현재 target 의 Rationale 연속성 관점에서는 선언 자체에 위반이 없고 기각된 대안 재도입도 아니므로 INFO 수준이다.

---

## 요약

`spec/2-navigation/6-config.md` 의 Rationale(R-1 ~ R-6) 은 전반적으로 과거 결정과 잘 정합된다. R-3 번복 결정은 이전 결정(RerankConfig sibling 분리, KB piggyback)을 명시적으로 폐기하고 새 근거를 완비해 절차상 문제가 없다. R-5 max_tokens 정정·R-6 호출 이력 스키마 결정도 기존 Rationale 와 충돌하지 않는다. 다만 R-4 에서 SSRF 예외 규칙 출처를 `tei`/`local` 으로 묶어 참조하는 서술이 rerank 에서 `local` 이 Dropped 됐다는 LLM Client spec Rationale(2026-06-05 결정)과 표현상 불일치를 일으킨다. 기각된 대안(`local` rerank provider)을 재도입하려는 의도는 없으나, 해당 참조 표현이 Dropped 결정 이후에도 `local` 을 유효한 예외 대상으로 오독하게 할 수 있어 WARNING 으로 분류한다.

---

## 위험도

LOW
