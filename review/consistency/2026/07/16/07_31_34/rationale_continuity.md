# Rationale 연속성 Check 결과 — spec/4-nodes/3-ai/

## 점검 범위 및 방법

- target: `spec/4-nodes/3-ai/0-common.md`, `1-ai-agent.md`, `2-text-classifier.md`, `3-information-extractor.md` (전체 본문 + `## Rationale` 절)
- 착수 예정 작업: `plan/in-progress/ai-agent-tool-payload-budget-followups.md` 항목 A (config-time 도구 payload 예산 저장 경고) — `--impl-prep` 트리거 근거
- 대조 대상: 각 문서 자체의 `## Rationale`(1-ai-agent.md §12, 특히 §12.9/§12.10/§12.12/§12.14/§12.15의 "번복/재번복" 이력), 연결 문서 `spec/conventions/cross-node-warning-rules.md` §5·§8·Rationale, `spec/5-system/11-mcp-client.md` §3.3·§5.8·Rationale, 완료된 선행 plan `plan/in-progress/ai-agent-tool-payload-budget-guardrail.md`

## 발견사항

- **[INFO]** 저장 경고 surfacing 설계의 SoT가 두 문서에서 다른 스냅샷을 보여줌 — 실행 착수 전 참조 문서 명확화 권장
  - target 위치: `plan/in-progress/ai-agent-tool-payload-budget-followups.md` "A. config-time 저장 경고" 항목 (surface: `getGraphWarnings` append / block: `saveCanvas` error)
  - 과거 결정 출처: `plan/in-progress/ai-agent-tool-payload-budget-guardrail.md` "D3. ai-agent.md §10 config 경고 계약" 초안 — "저장 API `POST /workflows/:id/save`(`saveCanvas`) 가 ... `GraphWarningRuleResult` 를 결과 배열에 실어 반환한다" (경고 자체를 saveCanvas 응답에 포함시키는 설계)
  - 상세: 현재 확정 spec(`spec/4-nodes/3-ai/1-ai-agent.md` §10 "도구 정의 payload 예산 경고" 문단, `spec/conventions/cross-node-warning-rules.md` §5 "보조 surface — `GET /workflows/:id/graph-warnings`")는 이와 다른 최종 설계를 담고 있다 — 경고 배열의 조회는 별도 `GET /workflows/:id/graph-warnings` endpoint 가 전담하고, `saveCanvas` 는 severity `error`(strict 승격) 시의 400 차단 전용이며 경고 자체를 응답에 싣지 않는다("frontend canvas 는 이를 호출하지 않고 가드 ② 의 로컬 평가만 사용"). 즉 두 설계(guardrail plan 의 D3 초안 vs 확정 spec)는 서로 다르며, **확정 spec 이 최종 결정**이고 followups plan 의 실행 체크리스트는 이미 확정 spec 을 정확히 따르고 있어 현재 실질적 충돌은 없다. 다만 `ai-agent-tool-payload-budget-guardrail.md` 가 아직 `plan/complete/` 로 이동되지 않고 `plan/in-progress/` 에 D3 초안 문구를 그대로 보존한 채 남아 있어, 개발자가 착수 시 이 오래된 초안 문서를 참조할 경우 saveCanvas 응답에 경고를 싣는 잘못된 구현으로 되돌아갈 위험이 있다(과거에 명시적으로 기각된 것은 아니고 논의 중 진화한 설계이지만, 두 "결정 스냅샷"이 공존하는 상태).
  - 제안: 구현 시 `spec/4-nodes/3-ai/1-ai-agent.md` §10 / `spec/conventions/cross-node-warning-rules.md` §5 를 단일 SoT로 명시 참조하고(이미 followups plan 은 이렇게 하고 있음), `ai-agent-tool-payload-budget-guardrail.md` 의 D3 절 상단에 "이 초안은 §10 확정본으로 대체됨 — surfacing 은 `GET /workflows/:id/graph-warnings` 단일 경로" 라는 짧은 정정 각주를 남기거나, 해당 plan을 `plan/complete/`로 정리해 stale 초안이 실행 지침처럼 읽히지 않도록 한다.

## 요약

`spec/4-nodes/3-ai/` 네 문서는 Rationale 연속성 관점에서 매우 견고하다. `1-ai-agent.md` §12(특히 §12.9·§12.10·§12.12·§12.14)는 과거 결정을 번복할 때마다 "과거 결정 → 번복 근거 → (필요 시) 재번복 근거"를 명시적으로 누적 기록하는 모범 패턴을 따르고 있고, §12.15(도구 정의 payload 예산)는 이번에 착수하려는 `ai-agent-tool-payload-budget-followups.md` 항목 A(config-time 저장 경고)의 설계(estimator 단일 진실 재사용, backend-only graph warning, warn-기본/strict opt-in, `GET /workflows/:id/graph-warnings` surfacing)와 `spec/conventions/cross-node-warning-rules.md` §5/§8, `spec/5-system/11-mcp-client.md` §3.3(캐시된 정보는 hint일 뿐 런타임이 우선한다는 원칙)과도 정합적으로 맞물려 있다. 기각된 대안(Tool Area/`tool_*`, `conversationHistory` 등)의 재도입이나 합의 원칙 위반은 발견되지 않았고, text-classifier/information-extractor 의 Rationale 도 공통 규약을 일관되게 참조한다. 유일한 관찰 사항은 이미 완료된 선행 plan(`ai-agent-tool-payload-budget-guardrail.md`)의 초안 문구(D3)가 확정 spec 과 다른 surfacing 설계를 그대로 남기고 있다는 문서 위생 이슈로, 실질적인 spec-내 모순은 아니며 착수 전 참조 정리만 권장된다.

## 위험도

LOW
