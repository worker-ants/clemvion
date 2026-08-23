# Plan 정합성 검토 — spec/3-workflow-editor/ (impl-done)

## 발견사항

- **[INFO]** `4-ai-assistant.md` Rationale 내 "구현 단계에서 유의 사항" §4 가 masking 이중화 결정보다 stale
  - target 위치: `spec/3-workflow-editor/4-ai-assistant.md:1471` ("4. **마스킹 구현.** `mask-sensitive-fields.util.ts` 재사용. 응답 직렬화 직전에 `inputData`/`outputData`/`error` 필드를 각각 한 번씩 통과시킴.")
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` — "workflow-assistant LLM 도구가 `inputData`·`outputData`·`error` 세 필드를 더 약한 마스킹으로 내보낸다" 항목, `→ 종결 (2026-08-23). 사용자 결정: 유출 차단이 우선.` 문단
  - 상세: 같은 파일의 §4.1.1(`spec/3-workflow-editor/4-ai-assistant.md` 마스킹 규칙 단락)과 바로 위 "확정된 결정 사항" 표는 2026-08-23 결정("`maskSensitiveFields` + `deepRedactSecrets` 중첩, 출력 `\"***\"`")으로 이미 갱신됐지만, 같은 Rationale 섹션 안의 "구현 단계에서 유의 사항" 번호 목록 4번 항목은 `deepRedactSecrets` 언급 없이 예전 단일 계층 마스킹 서술을 그대로 두고 있다. plan 의 "spec 동반 갱신 4곳"(§4.1.1 + `:1429` 결정 메모 · EIA §R17 · `_product-overview.md` EH-NAV-04 · `egress-masking.md`)에는 이 항목이 포함되지 않았고, 실제로 이 지점만 놓쳤다. 기능적 충돌은 아니며(코드는 diff 대로 두 층을 겹친다) 문서 내부 자기모순에 가깝다.
  - 제안: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 해당 종결 항목 아래에 짧은 후속 메모(§4.1.1 은 갱신했지만 "구현 단계 유의 사항" 번호 목록은 미갱신)를 남기거나, 지금 세션에서 planner 턴으로 `4-ai-assistant.md:1471` 을 `deepRedactSecrets` 언급을 포함하도록 한 줄 정정한다.

## 요약

이번 diff(`mask-sensitive-fields.util.ts` token 계열 키 확장 + `explore-tools.service.ts` 의 `deepRedactSecrets` 중첩)는 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 가 이미 2026-08-23 자로 "사용자 결정: 유출 차단이 우선"으로 명시적으로 닫아 둔 항목을 그대로 집행한 것이다 — plan 이 미해결로 남긴 결정을 우회하거나 충돌하는 결정을 내리는 곳은 없다. 같은 plan 문서가 요구한 "spec 동반 갱신 4곳"(`4-ai-assistant.md §4.1.1`/결정 메모, EIA `§R17`, `2-navigation/_product-overview.md EH-NAV-04`, `spec/conventions/egress-masking.md`)도 실제 워킹트리에서 전수 확인되어 반영돼 있다. 같은 plan 문서가 명시적으로 열어 둔 인접 항목들(`DEFAULT_SENSITIVE_KEYS` 의 정적 grep 한계, `handler-output.adapter.ts` 값 축 미착수, `redact-stored-error.ts` 위생 4건)은 이번 diff 가 건드리지 않았고, diff 의 코드 주석 자체가 그 경계를 정확히 재진술하고 있어 선행/후속 plan 과 충돌하지 않는다. 유일한 흠은 §4.1.1 갱신 시 같은 파일 안의 오래된 구현 노트 한 줄을 놓친 문서 내부 staleness로, plan 정합성이라기보다 spec 자기 일관성에 가까운 경미한 잔여다.

## 위험도
LOW
