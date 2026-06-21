### 발견사항

- **[INFO]** 프롬프트 인젝션(Prompt Injection) — condition.prompt 가 시스템 프롬프트에 직접 삽입됨
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-condition-evaluator.ts` — `buildConditionSystemPromptSuffix`, `buildConditionTools`
  - 상세: `c.prompt` (사용자 정의 condition 설명)가 이스케이핑 없이 시스템 프롬프트 문자열과 직접 연결된다. 악의적인 사용자가 condition prompt 에 개행+LLM 지시문을 심어 시스템 프롬프트 구조를 혼동시키는 prompt injection을 시도할 수 있다. `ConditionDef`가 워크플로 설계자(admin) 신뢰 레벨의 구성 값이라면 현재 실용적 위험도는 낮으나, 이 신뢰 경계가 외부 사용자 입력으로 확장될 경우 실질화된다.
  - 제안: `ConditionDef`의 신뢰 경계를 명시적으로 문서화. 향후 condition 설정이 외부 사용자 입력을 허용하게 될 경우 prompt 필드 화이트리스트 검증 레이어 추가 필요. `c.prompt`에서 개행 문자를 공백으로 정규화하는 것만으로도 구조 혼동 위험을 낮출 수 있다.

- **[INFO]** condition ID sanitize 충돌 — 서로 다른 ID가 동일 `cond_*` 이름으로 매핑 가능
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-condition-evaluator.ts` — `sanitizeId`, `classifyToolCalls`
  - 상세: `[^a-zA-Z0-9_]` 치환으로 `"user-A"`와 `"user A"`가 모두 `cond_user_A`로 매핑된다. `condNameToCondition` Map에서 나중에 삽입된 condition이 이전 것을 덮어써 조건 라우팅이 의도와 다르게 동작할 수 있다.
  - 제안: `validate()` 단에서 sanitized 이름 기준 uniqueness 검증을 추가하거나, Map 삽입 시 충돌 감지 후 경고 로그를 남길 것. 스키마 레벨에서 raw ID 유일성이 이미 강제되나 sanitize 후 충돌은 별도 검증이 필요하다.

- **[INFO]** `extractConditionReason` — LLM 반환 `reason` 필드의 downstream 컨텍스트별 escaping 불명확
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-condition-evaluator.ts` — `extractConditionReason`
  - 상세: `reason.slice(0, 500)` 길이 제한과 `typeof args.reason === 'string'` 타입 검사로 기본 방어를 갖추고 있다. 단, `reason`이 노드 출력 포트나 로그를 통해 HTML/SQL 컨텍스트에 삽입되는 downstream 경로가 있다면 해당 레이어별 escaping이 별도로 적용되어야 한다.
  - 제안: `reason` 필드가 최종적으로 사용되는 모든 컨텍스트(HTML 렌더링, DB 저장, 로그 등)에서 컨텍스트별 escaping이 적용되는지 확인할 것.

### 요약

이 변경은 `AiAgentHandler`에서 조건 평가 로직을 `AiConditionEvaluator`라는 무상태 collaborator로 추출하는 순수 리팩터링으로, 신규 취약점을 도입하지 않았으며 기존 동작을 1:1로 이동했다. `sanitizeToolError`로 예외 정보를 노출 전 새니타이징하는 패턴, `FORM_SUBMITTED_GUIDANCE_MESSAGE`를 하드코딩 상수로만 허용하는 보안 경계 설명, `extractConditionReason`의 500자 cap·타입 검사 등 기존의 방어 패턴이 올바르게 유지된다. 하드코딩된 시크릿, 인증/인가 우회, 알려진 취약 의존성 도입 등의 문제는 발견되지 않았다. 유일한 관심 영역은 사용자 정의 `condition.prompt`가 시스템 프롬프트에 이스케이핑 없이 삽입되는 구조이나, 이는 이전 코드에도 존재하던 것으로 `ConditionDef`가 워크플로 설계자 신뢰 레벨임을 전제하고 있다.

### 위험도

LOW
