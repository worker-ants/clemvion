# Rationale 연속성 검토 결과

검토 모드: --impl-prep  
대상 spec: `spec/2-navigation/6-config.md`  
diff 상태: 변경 없음 (없음) — 기존 spec 내용 대상 검토

---

## 발견사항

### 발견사항 1

- **[INFO]** LLM model config SSRF opt-out 메커니즘이 통합-노드 `ALLOW_PRIVATE_HOST_TARGETS` 원칙 문서에 carve-out 로 명시되지 않음
  - target 위치: `spec/2-navigation/6-config.md` R-4 (cohere Base URL SSRF 가드), §B.5 embedding 테이블 "SSRF 가드" 비고
  - 과거 결정 출처: `spec/4-nodes/4-integration/1-http-request.md` Rationale — `ALLOW_PRIVATE_HOST_TARGETS` callout 및 스코프 열거 ("HTTP Request·Database Query·Send Email 가 동일 플래그를 공유한다. AI Agent 의 MCP 서버는 별개 정책(`MCP_ALLOW_INSECURE_URL`)을 사용한다.")
  - 상세: `spec/4-nodes/4-integration/1-http-request.md` 는 `ALLOW_PRIVATE_HOST_TARGETS` 의 커버리지를 HTTP Request·Database Query·Send Email 로 열거하고, MCP 만 `MCP_ALLOW_INSECURE_URL` 로 별도 carve-out 해 명시했다. LLM model config 의 SSRF guard(`spec/5-system/7-llm-client.md §5.5`)는 세 번째 메커니즘 — `local` / `tei` provider 를 hardcoded exception 으로 두고 `ALLOW_PRIVATE_HOST_TARGETS` 로 제어하지 않는다 — 을 사용한다. 이 세 번째 메커니즘은 http-request Rationale 의 carve-out 목록에 등장하지 않는다. 아키텍처 상 model config 는 workflow execution 경로의 통합 노드가 아니라 model provider 설정 레이어라 원칙 스코프("통합 노드 전반")를 벗어나므로 하드-위반은 아니다. 그러나 carve-out 문서가 누락되어 있어, 향후 구현자가 LLM Client SSRF 를 `ALLOW_PRIVATE_HOST_TARGETS` 에 연결하려는 시도를 하거나 반대로 통합 노드에 `local` 예외 패턴을 이식하는 잘못된 정합 시도가 생길 수 있다.
  - 제안: `spec/4-nodes/4-integration/1-http-request.md` Rationale 의 `ALLOW_PRIVATE_HOST_TARGETS` carve-out 목록에 LLM Client SSRF 를 세 번째 명시적 항목으로 추가한다. 예: "LLM model config 의 baseUrl SSRF 가드는 provider 타입 기반 hardcoded exception(`local`/`tei`)을 사용하며, 이는 workflow 실행 경로가 아닌 model provider 설정 레이어로서 `ALLOW_PRIVATE_HOST_TARGETS` 스코프 밖이다." — 현재 `spec/5-system/7-llm-client.md §5.5` 는 가드 규칙 자체를 설명하나 왜 `ALLOW_PRIVATE_HOST_TARGETS` 를 따르지 않는지 Rationale 을 두지 않는다.

---

### 기각된 대안 재도입 검토

- **R-3 번복 (ModelConfig 단일 화면 통합)**: 구 결정(RerankConfig sibling + LLMConfig embedding piggyback)을 뒤집었으나, spec 이 이를 `## Rationale R-3 (번복)` 으로 명시하고 새 Rationale(kind 판별자·관리 포인트 감소·인프라 공유 재확인)을 함께 제시했다. 결정 번복의 형식 요건(이전 결정 명시 + 새 Rationale) 충족.
- **R-5 max_tokens 기본값 4096**: 구 spec 의 2048 표기가 "구현에 한 번도 적용된 적 없음"을 확인한 뒤 spec 을 코드에 맞추는 SPEC-DRIFT 정정이다. 설계 의도를 번복한 것이 아닌 낡은 spec 동기화라 Rationale 위반 없음.
- **R-1 select-only 모델 선택**: 자유 입력을 배제한 신규 결정이나, 이와 명시적으로 충돌하는 기존 Rationale("자유 입력 허용")는 확인되지 않는다.
- **R-2 AuthConfig / R-4 cohere Base URL / R-6 rolling window**: 각각 데이터 모델·Webhook spec 의 기존 Rationale 과 방향이 일치하며, 이전 결정을 번복하지 않는다.

---

## 요약

`spec/2-navigation/6-config.md` 는 이 PR 에서 변경이 없으며(diff 없음), 기존 내용을 기준으로 검토했다. R-3 번복과 R-5 정정은 모두 적절한 새 Rationale 과 함께 명시되어 있고, 다른 결정들도 관련 spec 의 기존 원칙에 부합한다. 기각된 대안의 재도입이나 합의된 invariant 직접 위반은 발견되지 않는다. 유일한 약점은 LLM Client SSRF guard 가 `ALLOW_PRIVATE_HOST_TARGETS` 와 별개인 세 번째 메커니즘을 사용하면서 http-request spec Rationale 의 carve-out 목록에 등록되지 않은 문서 공백이다. 이는 기능 동작을 해치지 않으나, 향후 구현자가 두 SSRF 메커니즘을 통합하려는 불필요한 시도를 야기할 수 있다.

---

## 위험도

LOW
