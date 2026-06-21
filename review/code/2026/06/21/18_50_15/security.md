# Security Review

## 발견사항

### **[INFO]** 프롬프트 인젝션 — condition.prompt 가 시스템 프롬프트에 무검증 삽입됨
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m1-condition-evaluator/codebase/backend/src/nodes/ai/ai-agent/ai-condition-evaluator.ts` `buildConditionSystemPromptSuffix` (라인 2307–2311), `buildConditionTools` (라인 2284–2302)
- 상세: `c.prompt` (사용자 정의 condition prompt 문자열) 가 그대로 `condList` 에 삽입되어 LLM 시스템 프롬프트의 일부가 된다. 동일하게 `buildConditionTools` 에서 `description: c.prompt` 로 LLM 도구 정의에도 삽입된다. `c.id` 도 `condToolName` 을 통해 영숫자/언더스코어로 새니타이징되지만, `c.prompt` 자체는 어떤 새니타이징도 없다. 만약 워크플로 설정 레이어에서 condition prompt 를 최종 사용자가 직접 또는 간접적으로 제어할 수 있다면 프롬프트 인젝션 경로가 된다.
  - **범위 한정 이유 INFO**: 이 코드 레이어 자체는 핸들러가 `config.conditions` 를 그대로 받아 쓰는 구조다. 입력 유효성 검증(길이 상한 2000자 등)은 `validate()` / schema 레이어에서 이루어지고 있으며(`ai-agent.handler.ts` 내 `evaluateMetadataBlockingErrors` 참조), 최종 제어 주체가 워크플로 **설계자**(신뢰 경계 내부)인 경우 인젝션 위험은 낮다. 그러나 향후 최종 사용자가 condition을 동적으로 구성할 수 있는 경로가 추가된다면 위험도가 상승한다.
- 제안: 현재 신뢰 모델(워크플로 설계자만 condition 정의)을 spec에 명시적으로 문서화하고, `c.prompt` 가 사용자 입력(런타임 변수 등)에 의해 동적으로 채워지는 경우를 schema 레벨에서 감지하거나 제한하는 가이드를 추가한다.

### **[INFO]** LLM 생성 JSON 인자의 무제한 키 접근 — 타입 단언 후 단일 필드만 검증
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m1-condition-evaluator/codebase/backend/src/nodes/ai/ai-agent/ai-condition-evaluator.ts` `extractConditionReason` (라인 2374–2385)
- 상세: `JSON.parse(tc.arguments) as Record<string, unknown>` 후 `args.reason` 만 타입 검사하고 나머지 키는 무시한다. 현재 사용 범위(reason 문자열 추출 후 500자 truncate)에서는 문제가 없다. 그러나 이 패턴이 복사·확장될 때 다른 필드가 검증 없이 사용될 위험이 있다.
- 제안: 향후 확장 시 Zod 등 런타임 스키마 검증 라이브러리 사용을 권장하는 주석을 해당 위치에 추가한다. 현재 코드 자체는 안전하다.

### **[INFO]** condToolName 충돌 가능성 — 서로 다른 id 가 동일한 LLM 도구명으로 수렴
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m1-condition-evaluator/codebase/backend/src/nodes/ai/ai-agent/ai-condition-evaluator.ts` `sanitizeId` (라인 2261–2262), `classifyToolCalls` (라인 2320–2368)
- 상세: `sanitizeId` 는 `[^a-zA-Z0-9_]` 를 `_` 로 치환하므로 `"a-b"` 와 `"a_b"` 는 동일한 도구명 `cond_a_b` 로 수렴한다. `classifyToolCalls` 내 `condNameToCondition` 맵은 마지막 등록 값으로 덮어써진다. 중복 조건 ID 는 schema 레이어(validate)에서 차단해야 하며, 새니타이징 후 충돌 여부는 현재 검증하지 않는다.
- 제안: `buildConditionTools` 또는 `validate` 단계에서 `condToolName` 적용 후 중복 도구명을 감지하여 에러로 반환한다.

---

## 요약

이번 변경(`AiConditionEvaluator` 추출)은 순수한 behavior-preserving 리팩터링으로, 기존 `ai-agent.handler.ts` 의 private 메서드들을 무상태 collaborator 클래스로 이동한 것이다. 새로운 보안 취약점(인젝션, 시크릿 노출, 인증 우회, 암호화 문제, 의존성 취약점 등)은 도입되지 않았다. 에러 처리는 `extractConditionReason` 의 JSON 파싱 실패 시 빈 문자열 반환으로 안전하게 처리된다. `sanitizeToolError` 를 통한 에러 sanitization, `TOOL_RESULT_PREVIEW_CHARS` cap, `FORM_SUBMITTED_MAX_BYTES` cap 등 기존 핸들러의 보안 장치는 유지된다. 상기 INFO 항목들은 기존 코드에서 이미 존재하던 설계 한계이거나 향후 확장 시 주의가 필요한 사항으로, 이번 diff 의 범위에서는 보안 리스크를 악화시키지 않는다.

## 위험도

NONE
