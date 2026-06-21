# 요구사항(Requirement) 리뷰 결과

리뷰 대상 커밋: `6ee15886a5b1e83f250cd23b8750d9f95719e4c4`
변경 파일:
- `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts`
- `codebase/backend/src/nodes/ai/ai-agent/ai-condition-evaluator.ts` (신규)
- `codebase/backend/src/nodes/ai/ai-agent/ai-condition-evaluator.spec.ts` (신규)

---

## 발견사항

### [INFO] `required: []` 필드 누락 — spec §5.1 vs 구현 미세 괴리 (pre-existing)

- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m1-condition-evaluator/codebase/backend/src/nodes/ai/ai-agent/ai-condition-evaluator.ts` L211-224, `buildConditionTools`
- **상세**: `spec/4-nodes/3-ai/1-ai-agent.md §5.1` 조건 도구 `parameters` 정의에는 `required: []` 필드가 포함돼 있다. (`{ type: "object", properties: { reason: { ... } }, required: [] }`). 현재 구현에는 `required` 키가 없다. 그러나 이 괴리는 이번 리팩터에서 신규 발생한 것이 아니다 — diff 확인 결과 원래 핸들러 인라인 블록에도 `required` 가 없었으므로, 이번 추출에서 동일 코드를 그대로 이전했다. LLM API 들은 `required: []` 를 생략해도 동일하게 처리하므로 런타임 영향은 없다.
- **제안**: 이번 변경의 범위(behavior-preserving 추출) 밖. 별도 후속 작업 시 spec §5.1 과 맞추거나 spec 을 "구현 생략 허용" 으로 명시 갱신. 현재 커밋 기준 코드 변경 불요.

---

### [INFO] [SPEC-DRIFT] spec 구현 참조 포인터가 구식 — `(구현: ai-agent.handler.ts classifyToolCalls)`

- **위치**: `spec/4-nodes/3-ai/1-ai-agent.md` §6.1 3.a 본문 (L370)
- **상세**: 해당 spec 본문에 `(구현: ai-agent.handler.ts classifyToolCalls)` 라는 파일+메서드 위치 참조가 있다. 이번 리팩터로 `classifyToolCalls` 는 `ai-condition-evaluator.ts` 의 `AiConditionEvaluator` 클래스로 이전됐다. spec 본문 참조가 낡은 위치를 가리키고 있다. 코드는 올바르게 이동됐으며 되돌리는 것이 오답이다.
- **제안**: 코드 유지, spec 갱신. `spec/4-nodes/3-ai/1-ai-agent.md` §6.1 3.a 의 참조를 `(구현: ai-condition-evaluator.ts AiConditionEvaluator.classifyToolCalls)` 로 업데이트. `project-planner` 에게 위임.

---

### [INFO] [SPEC-DRIFT] plan M-1 체크박스 미갱신

- **위치**: `/Volumes/project/private/clemvion/plan/in-progress/refactor/02-architecture.md` L124 — `- [ ] 미착수 — nodes/ai/ai-agent/ai-agent.handler.ts`
- **상세**: 이번 커밋으로 plan §M-1 의 첫 단계(1. AiConditionEvaluator 추출)가 완료됐으나 plan 의 체크박스가 여전히 `미착수` 상태다. behavior-preserving 추출 + 17개 단위 테스트 신설 + lint/build/unit/e2e 전량 PASS 가 커밋 메시지에 기록돼 있어 코드 자체는 완성됐다.
- **제안**: 코드 유지, plan 갱신. M-1 체크박스를 "1단계 완료" 로 표시하고 완료 커밋 해시·리뷰 경로를 기록. 이는 코드 버그가 아니라 plan 문서 추적 누락이다.

---

## 요약

변경은 `AiAgentHandler` 의 조건 평가 로직 5개 메서드(`condToolName`, `sanitizeId`, `buildConditionTools`, `buildConditionSystemPromptSuffix`, `classifyToolCalls`, `extractConditionReason`)와 2개 타입(`ConditionDef`, `ConditionClassification`)을 상태 없는 collaborator `AiConditionEvaluator` 로 정확하게 추출했다. 핸들러의 두 분기(single_turn / multi_turn) 양쪽에서 `classifyToolCalls`, `extractConditionReason`, `buildConditionSystemPromptSuffix`, `buildConditionTools` 호출점이 모두 `this.conditionEvaluator.*` 로 치환됐으며, `toolProviders` 의존이 생성자 캡처에서 인자 전달로 정확히 변경됐다. spec §5.1 (조건 도구 등록), §5.2 (분류 로직), §7.2·§7.6 (reason 최대 500자, winner 선택 규칙) 의 행위 명세와 구현이 일치한다. 신규 단위 테스트(17케이스)는 경계값(빈 배열, reason 600자→500자, JSON parse 실패, reason 비문자열, 조건 없음, provider 우선순위)을 고루 커버한다. CRITICAL / WARNING 발견사항 없음. 발견된 3건은 모두 INFO 수준의 사전 존재 사안(required 필드 pre-existing 누락) 또는 SPEC-DRIFT(spec 참조 포인터 갱신 필요, plan 체크박스 갱신 필요)로 코드 fix 대상이 아니다.

---

## 위험도

NONE
