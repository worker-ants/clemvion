# Rationale 연속성 검토 결과

검토 모드: --impl-done (구현 완료 후 검토)
Target: spec/4-nodes/3-ai (AiConditionEvaluator 추출 리팩터, 02-architecture §M-1 1단계)

---

## 발견사항

### INFO: 분류 함수 구현 위치 참조 갱신 불필요 — 동작 보존 확인

- **target 위치**: `/codebase/backend/src/nodes/ai/ai-agent/ai-condition-evaluator.ts` (신규 파일), `ai-agent.handler.ts` line 1530, 2438
- **과거 결정 출처**: `spec/4-nodes/3-ai/1-ai-agent.md §6.1 step 3.a` — "구현: `ai-agent.handler.ts` `classifyToolCalls`" 라고 명시
- **상세**: spec §6.1 step 3.a 는 `classifyToolCalls` 의 구현 위치를 "`ai-agent.handler.ts` `classifyToolCalls`" 라 명시하고 있으나, 리팩터 이후 실제 구현체는 `ai-condition-evaluator.ts` 의 `AiConditionEvaluator.classifyToolCalls` 로 이동됐다. spec 본문은 이 이동을 반영하지 않아 구현 위치 참조가 stale 하다. 단, 이 주석은 메서드 이름 규약이 아닌 파일 위치를 언급한 설명적 비고이며, 분류 로직·우선순위·결과 계약(provider 우선 → condition → normal, disjoint prefix, matchedCondition = 정의 순서 최소 인덱스)은 완전히 보존되어 있다. Rationale 의 핵심 결정(provider-우선 검사, prefix disjoint 가정, 동작 결정성)은 번복 없이 구현에 그대로 반영됨을 테스트(`ai-condition-evaluator.spec.ts`) 가 명시적으로 고정한다.
- **제안**: spec §6.1 step 3.a 의 "구현: `ai-agent.handler.ts` `classifyToolCalls`" 를 "구현: `ai-condition-evaluator.ts` `AiConditionEvaluator.classifyToolCalls` (핸들러 위임)" 으로 갱신하여 단일 진실을 유지한다. behavior-preserving 추출이므로 Rationale 신규 항목 기록은 불필요하나 구현 위치 주석은 stale.

---

### INFO: `buildConditionSystemPromptSuffix` 의 안내문 포맷 — spec 원문과 세부 문구 차이

- **target 위치**: `ai-condition-evaluator.ts` line 81–86, `buildConditionSystemPromptSuffix()`
- **과거 결정 출처**: `spec/4-nodes/3-ai/1-ai-agent.md §5.1` — "시스템 프롬프트에 조건 사용 지시를 자동 주입: '다음 조건 중 상황이 충족되면 해당 도구를 호출하세요. 조건이 충족되지 않으면 대화를 계속하세요.'"
- **상세**: spec §5.1 의 안내문 원문은 `"다음 조건 중 상황이 충족되면 해당 도구를 호출하세요. 조건이 충족되지 않으면 대화를 계속하세요."` 인데, 구현의 `buildConditionSystemPromptSuffix` 는 `[조건 안내] 대화 중 아래 조건에 해당하는 상황이 감지되면, 해당 조건 도구를 호출하세요:` + 조건 목록 + `조건에 해당하지 않으면 대화를 계속하세요.` 형태를 사용한다. 의미는 동일하나 spec 원문보다 더 구체적인 포맷(`[조건 안내]` 헤더, 조건별 열거, 개행 구조)을 채택했다. 이 차이는 기존 핸들러에서도 동일했던 것으로, 추출 리팩터가 새로 도입한 차이가 아니다.
- **제안**: spec §5.1 의 안내문 예시를 실제 구현 포맷에 맞게 갱신하거나, "이 형태를 기준으로 한다 (세부 포맷은 구현 SoT)" 라는 주석을 추가하면 drift 가 해소된다.

---

## 요약

본 리팩터(AiConditionEvaluator 추출, 02-architecture §M-1 1단계)는 `ai-agent.handler.ts` 의 조건 평가 private 메서드를 `ai-condition-evaluator.ts` 의 무상태 collaborator 클래스로 분리한 behavior-preserving 추출이다. spec/4-nodes/3-ai 의 `## Rationale` 에 기록된 핵심 결정 — provider-우선 분류, prefix disjoint 가정, condition 다중 호출 시 정의 순서 최소 인덱스를 winner 로 채택, reason 500자 절단 cap, `cond_*` / `kb_*` / `mcp_*` / `render_*` 의 도구 카테고리 분리 — 이 모두 구현에 정확히 보존되었다. 기각된 대안(예: `tool_call_not_implemented` 미구현, 표현 도구 stub 정책)도 변경 없이 유지된다. 발견된 사항은 모두 INFO 등급으로, 구현 위치 주석의 stale 한 파일 경로 참조와 안내문 포맷의 경미한 세부 차이가 전부이다. Rationale 연속성 관점의 위험은 없다.

## 위험도

NONE
