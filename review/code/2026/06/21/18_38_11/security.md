# 보안(Security) 리뷰 결과

## 발견사항

### **[INFO]** `condition.prompt` 가 시스템 프롬프트에 비새니타이징 삽입됨 (잠재적 프롬프트 인젝션)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m1-condition-evaluator/codebase/backend/src/nodes/ai/ai-agent/ai-condition-evaluator.ts` — `buildConditionSystemPromptSuffix` (line 83–85), `buildConditionTools` (line 65)
- 상세: `ConditionDef.prompt` 필드는 사용자가 워크플로 설정에서 직접 작성하는 텍스트다. 이 값이 `sanitizeId` 처리 없이 LLM 시스템 프롬프트 접미사와 도구 `description` 필드에 그대로 삽입된다(`- ${condToolName(c.id)}: ${c.prompt}`). 만약 워크스페이스 관리자 이외의 사용자가 condition 설정을 조작할 수 있는 경로가 존재한다면, 정교하게 구성된 `prompt` 값으로 LLM 행동을 오염시키는 프롬프트 인젝션이 가능하다. 단, 현재 구조에서 `ConditionDef` 는 노드 config(관리자 영역)에서만 오는 것으로 보이므로 공격 표면이 제한적이다.
- 제안: 이 경로가 신뢰된 관리자 입력임을 아키텍처 문서에 명시하거나, `prompt` 에 길이 상한(현재 schema validation 에 2000자 cap 언급)과 개행/제어문자 정규화를 추가한다. 특히 개행 문자가 조건 안내문 구조를 깨는 케이스(`\n` 포함 시 `condList` 포맷 오동작)를 spec/validation 레이어에서 거부하는 것이 바람직하다.

### **[INFO]** `conditionId` 충돌(collision)로 인한 조건 오인식 가능성
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m1-condition-evaluator/codebase/backend/src/nodes/ai/ai-agent/ai-condition-evaluator.ts` — `sanitizeId` / `condToolName` (line 38–45), `classifyToolCalls` (line 99–101)
- 상세: `sanitizeId` 는 비영숫자/언더스코어를 모두 `_` 로 치환하므로 서로 다른 `id` 가 동일한 sanitized name 으로 매핑될 수 있다(예: `"a-b"` 와 `"a_b"` 는 둘 다 `cond_a_b`). `classifyToolCalls` 의 `condNameToCondition` Map 은 후입력이 앞선 값을 덮어쓰므로(Map.set 의 기본 동작), 충돌이 발생할 경우 마지막으로 정의된 condition 만 매핑된다. 공격자가 조건을 직접 정의하는 상황은 아니지만, 관리자 실수로 인한 의도치 않은 조건 라우팅이 가능하다.
- 제안: `buildConditionTools` 또는 `validate` 단계에서 sanitized name 충돌을 감지해 오류로 반환한다. 이미 `too-many-conditions` 등의 스키마 검증이 존재하므로 같은 레이어에 `duplicate-condition-tool-name` 검사를 추가한다.

### **[INFO]** LLM 반환 `reason` 필드의 문자 단위 절단 — 바이트 안전성 검토
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m1-condition-evaluator/codebase/backend/src/nodes/ai/ai-agent/ai-condition-evaluator.ts` — `extractConditionReason` (line 155)
- 상세: `reason.slice(0, CONDITION_REASON_MAX_CHARS)` 는 JavaScript 문자열의 코드 유닛(char) 단위로 절단한다. 멀티바이트(UTF-8) 문자의 서로게이트 페어가 중간에 잘릴 수 있으나, 이 값은 outputData JSON 에 문자열로 저장되므로 JS 엔진이 자체 처리하며 실제 보안 위협 수준은 낮다. 다만 DB 컬럼이 특정 바이트 한도를 강제할 경우 이슈가 될 수 있다. spec에도 char 단위 절단을 의도로 명시(`멀티바이트 문자도 char(코드유닛) 단위로 500 절단`)하므로 현재는 의도된 동작이다.
- 제안: outputData → DB 저장 경로에서 컬럼 바이트 제한이 별도 존재한다면 그 레이어에서 방어한다. 현재 이 함수 자체는 spec 의도에 부합한다.

## 요약

이번 변경은 `AiAgentHandler` 의 조건 평가 private 메서드를 `AiConditionEvaluator` 무상태 collaborator 로 추출하는 순수 리팩터링이다. 하드코딩된 시크릿, SQL/커맨드 인젝션, 인증 우회, 안전하지 않은 암호화 알고리즘, 에러 메시지 민감정보 노출 등의 전통적 보안 취약점은 발견되지 않는다. `sanitizeToolError` 함수가 예외 메시지를 sanitize 하고, `extractConditionReason` 이 JSON 파싱 예외를 캐치하며, `CONDITION_REASON_MAX_CHARS` cap 이 LLM 생성 문자열의 무제한 유입을 차단하는 등 방어적 코딩 패턴이 일관되게 유지된다. 유일한 주의 지점은 관리자 설정 `condition.prompt` 가 LLM 프롬프트에 비new라인 새니타이징 없이 삽입되는 점이며, 이는 신뢰 경계가 관리자 영역에 국한되는 한 현재 수용 가능한 수준이다.

## 위험도

LOW
