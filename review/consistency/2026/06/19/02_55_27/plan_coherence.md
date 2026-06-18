# Plan 정합성 검토 결과

검토 모드: `--impl-done` (scope: `spec/5-system/4-execution-engine.md`, diff-base: `origin/main`)

대상 변경: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.spec.ts` — `classifyLlmError` passthrough 경로 정규화 어서션 2건 추가.

---

## 발견사항

### [INFO] c1-engine-split.md §후속 고려 항목 실행 — 완료 표기 없음

- target 위치: `ai-turn-orchestrator.service.spec.ts` (두 테스트 케이스)
- 관련 plan: `plan/in-progress/refactor/c1-engine-split.md` §후속 고려 L134–135
- 상세: `c1-engine-split.md` §후속 고려에 "**`LLM_API_ERROR` passthrough 정규화 테스트 보강** (PR2 impl-done W-1): `classifyLlmError` 의 미등록 코드 passthrough 경로에 정규화 어서션 추가" 가 추적 항목으로 명시되어 있다. 이번 diff 가 정확히 해당 항목을 구현한다 — 미등록 explicit code 가 `classifyLlmError` 에서 그대로 보존되는 passthrough 경로를 두 어서션(기존 테스트에 `expect(result.code).toBe('LLM_API_ERROR')` 추가 + 신규 `LLM_PROVIDER_QUOTA` passthrough 케이스)으로 잠근다. 그러나 `c1-engine-split.md §후속 고려`의 해당 항목은 prose 형태(체크박스 없음)라 완료 표기 수단이 없고, 이번 변경이 plan 을 갱신하지 않아 추적이 불투명하다.
- 제안: `c1-engine-split.md §후속 고려` L134–135 항목 뒤에 완료 날짜 인라인 메모(예: `— ✅ 2026-06-19 완료, branch llm-error-passthrough`)를 추가하거나, plan 진행 로그에 이행 기록을 남기는 것을 권장한다. 차단 사유는 없음.

---

### [INFO] spec §10 L1099 "미등록 코드 passthrough" 행위가 spec 본문에 명시되지 않음

- target 위치: 신규 테스트 케이스 (`LLM_PROVIDER_QUOTA` passthrough 어서션)
- 관련 plan: 없음 (spec 정책 불완전)
- 상세: `spec/4-nodes/3-ai/1-ai-agent.md §10 L1099` 는 "명시 code(`LLM_RESPONSE_INVALID` 등)→보존(non-retryable)" 로 기술한다. "등" 이 비결정적 열거임을 암시하나, §10 표에 등재되지 않은 vendor 임의 코드(`LLM_PROVIDER_QUOTA` 같은 미등록 코드)가 passthrough 되는 행위를 spec 이 명시적으로 정의하지는 않는다. 테스트 코멘트("미등록 explicit code 는 정규화 시 그대로 passthrough")가 이 행위를 설명하지만 spec 본문에 해당 규칙이 없어 drift 가능성이 있다.
- 제안: `spec/4-nodes/3-ai/1-ai-agent.md §10 L1099` 주석에 "§10 표 밖의 미등록 explicit code 도 동일하게 보존된다 (non-retryable)" 한 줄을 추가하면 spec ↔ 테스트 정합이 완성된다. spec 쓰기 권한이 없는 developer 트랙이라면 project-planner 위임 후속으로 분리. 차단 사유는 없음.

---

## 요약

이번 diff 는 `c1-engine-split.md §후속 고려`에 명시적으로 추적된 follow-up 항목(`LLM_API_ERROR` passthrough 정규화 테스트 보강)을 구현한 것으로, 미해결 결정을 우회하거나 선행 plan 을 건너뛰는 사항이 없다. plan 과의 충돌은 없으며, INFO 2건은 (1) plan 완료 표기 누락 (추적 불투명), (2) 미등록 코드 passthrough 정책이 spec 본문에 명시되지 않아 소규모 spec 정밀화가 필요하다는 것이다. 두 항목 모두 비차단이다.

## 위험도

LOW
