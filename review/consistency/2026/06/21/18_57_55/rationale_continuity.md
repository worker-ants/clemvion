# Rationale 연속성 검토 결과

검토 모드: impl-done (scope=spec/4-nodes/3-ai, diff-base=origin/main)
대상 리팩토링: M-1 step 1 — `AiConditionEvaluator` 추출 (`ai-condition-evaluator.ts` 신설)

---

## 발견사항

### [INFO] §5.2 복수 조건 도구 동시 호출 시 우선순위 — Evaluator 구현 검증 필요
- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md §5.2` 항목 2-a
- **과거 결정 출처**: `1-ai-agent.md §5.2` ("복수의 조건 도구가 호출된 경우, `conditions` 배열에서 인덱스가 가장 작은 조건을 선택")
- **상세**: spec §5.2는 복수 조건 도구 호출 시 `conditions` 배열 인덱스 기준 첫 번째 조건을 채택한다는 우선순위 결정을 명시한다. M-1 step 1에서 이 로직이 `AiConditionEvaluator.classifyToolCalls` 로 추출됐다. 계획 문서(`02-architecture.md §M-1`)는 "behavior-preserving" 이라 명시하고 있어 위반 가능성이 낮으나, Rationale 에 결정 근거가 기록되어 있지 않아 추출 시 누락 위험이 존재한다.
- **제안**: 비차단. `ai-condition-evaluator.spec.ts` 에 복수 조건 동시 호출(인덱스 타이브레이킹) 케이스가 포함되어 있는지 확인하면 충분하다.

### [INFO] §6.1 step 3a 구현 참조 표기 — planner 후속(비차단 SPEC-DRIFT) 예정
- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md §6.1` step 3a ("구현은 먼저 등록된 `toolProviders` 중 `matches(tc.name)` 가 참인 첫 provider 를 찾고...")
- **과거 결정 출처**: `1-ai-agent.md §6.1` step 3 — "구현: `ai-agent.handler.ts` `classifyToolCalls`"
- **상세**: step 3a 의 구현 참조가 여전히 `ai-agent.handler.ts classifyToolCalls` 를 가리키고 있지만, M-1 step 1 이후 실제 구현은 `ai-condition-evaluator.ts` 로 이동됐다. 계획 문서 `02-architecture.md §M-1`의 "planner 후속(비차단 SPEC-DRIFT)" 에 이미 등록된 사항으로, Rationale 의 설계 원칙(분류 결정성: provider prefix 상호 disjoint → 분류 결과 결정적) 자체는 불변이고 구현 위치 참조만 stale 해진 상태다.
- **제안**: 비차단. planner 가 `1-ai-agent.md §6.1 step 3a` 의 "구현: `ai-agent.handler.ts` `classifyToolCalls`" 를 "구현: `ai-condition-evaluator.ts`" 로 갱신하고, frontmatter `code:` 에 `ai-condition-evaluator.ts` 를 등재하면 완전히 정리된다 (이미 계획 등록된 사항).

---

## 요약

검토 대상 리팩토링(M-1 step 1: `AiConditionEvaluator` 추출)은 `spec/4-nodes/3-ai` 의 Rationale 에서 명시적으로 기각된 대안을 재도입하거나 합의된 설계 원칙을 위반한 사례를 포함하지 않는다. `1-ai-agent.md §12` 의 핵심 Rationale 항목들(§12.4 Presentation Tool silent fallback 원칙, §12.5 form timeline 통합, §12.9 memoryStrategy 별도 필드 원칙, §12.11 안정 프리픽스 ordering 등)은 behavior-preserving 추출인 step 1 에서 전혀 건드리지 않았고, step 3a 의 구현 참조 표기 stale 은 계획 단계에서 이미 인지된 비차단 후속 항목이다. INFO 2건 모두 spec Rationale 의 설계 원칙과 충돌이 아닌 문서 동기화 gap 이다.

## 위험도

NONE

STATUS: OK
