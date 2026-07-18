# 정식 규약 준수 검토 — `spec/4-nodes/3-ai` (--impl-prep)

## 검토 범위

- `spec/4-nodes/3-ai/0-common.md`, `1-ai-agent.md`, `2-text-classifier.md`, `3-information-extractor.md` (직접 파일시스템에서 전문 확인)
- 대조 규약: `spec/conventions/node-output.md`, `interaction-type-registry.md`, `error-codes.md`, `conversation-thread.md`(제목만), `cross-node-warning-rules.md`, `CLAUDE.md`/`project-planner/SKILL.md` 의 spec 문서 구조·명명 컨벤션

## 발견사항

- **[WARNING]** `0-common.md §5` 가 LLM 3노드 출력 wrapper 계약을 실제와 다른 Principle 번호로 인용
  - target 위치: `spec/4-nodes/3-ai/0-common.md` §5 "응답 형식 규약 (Principle 11)" 제목 및 본문(라인 81/83/89), §9 인용부(라인 144)
  - 위반 규약: `spec/conventions/node-output.md` — 실제 **Principle 11**(라인 439~465, "출력 예시 문서화 규칙")은 spec 문서의 Output 섹션 **작성 서식**(`### Case: <케이스 이름>` 헤더 + JSON 예시 + 표) 규칙이며, `output.result.*`/`output.error.*`/`output.interaction.*` wrapper 공유 자체는 Principle **1.1**(config/output 직교, 사용자 상호작용 데이터는 `output.interaction`), **3.2**(에러 표준 형태), **4.4/4.5**(resumed/interaction.data 규격), **8.2**("`output.result` 래핑은 LLM 계열 노드 한정")가 각각 분담해 정의한다.
  - 상세: `0-common.md`는 "LLM 3 노드는 `output.result.*` / `output.error.*` / `output.interaction.*` wrapper 를 공유한다 (CONVENTIONS Principle 11)" 이라고 명시하지만, node-output.md 의 Principle 11은 이 wrapper 구조와 무관한 **문서 서식** 규칙이다. 반면 같은 폴더의 형제 문서 `2-text-classifier.md:130`·`3-information-extractor.md:181`은 "CONVENTIONS Principle 11 포맷" 이라는 표현을 **올바른 의미**(문서 서식)로 사용한다 — 즉 동일 규약 번호가 같은 spec 영역 안에서 두 가지 다른 의미로 충돌 사용되고 있다. 기능적 동작 자체(wrapper 구조)는 실제로 Principle 1.1/3.2/4.4/8.2 와 정합하므로 계약 위반은 아니고, **인용 라벨의 오기**다.
  - 제안: `0-common.md §5` 제목/본문의 "(Principle 11)"을 삭제하거나 "(Principle 1.1 / 3.2 / 4.4 / 8.2)"로 정정. §9(라인 144)의 앵커 텍스트도 동일하게 정정. `1-ai-agent.md:459`의 "CONVENTIONS Principle 0~11 포맷"은 전체 범위 참조라 상대적으로 안전하지만, §5 자체가 정정되면 함께 재확인 필요.

- **[INFO]** `1-ai-agent.md §7.x` 출력 케이스 헤더가 Principle 11 의 `### Case:` 서식을 따르지 않음
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` §7.1~§7.9 (예: "### 7.1 Single Turn 모드 — 정상 완료 (`out` 포트)")
  - 위반 규약: `spec/conventions/node-output.md` Principle 11 — "각 노드 문서의 'Output' 섹션은 다음 형식으로 작성됩니다: `### Case: <케이스 이름>`"
  - 상세: 같은 디렉터리의 `2-text-classifier.md`(§5.1~§5.3: `### 5.1 Case: Single-label 모드 …`)와 `3-information-extractor.md`(§5.1~§5.6: `### 5.1 Case: Single Turn 정상 …`)는 리터럴 `Case:` 접두를 일관되게 사용하고, 이는 `4-nodes` 전반의 다른 노드 문서(`1-if-else.md:77` `### 5.1 Case: 조건 만족`, `1-http-request.md:146` `### 5.1 Case: 2xx 성공`)에서도 관행으로 확립되어 있다. 그러나 정작 AI 3노드 중 가장 케이스가 많은(9종) `1-ai-agent.md`만 `Case:` 접두 없이 서술형 제목을 쓴다. 자동 가드는 없어(별도 도구가 리터럴 문자열을 파싱하지 않음) 기능적 영향은 없는 순수 문서 서식 편차다.
  - 제안: `### 7.1 Case: Single Turn 정상 완료 (out 포트)` 형태로 형제 문서와 통일. 우선순위는 낮음(INFO) — 별도 PR 없이 후속 편집 시 정리해도 무방.

## 확인했으나 위반 아님 (참고)

다음은 위반 가능성을 의심해 교차검증했으나 정합으로 확인됨 — 향후 재검토 시 중복 조사 방지 목적으로 기록:

- 문서 구조: `spec/4-nodes/3-ai/` 는 다중 파일 영역이라 `_product-overview.md`(로컬 + `spec/4-nodes/_product-overview.md` 상위) 로 Overview 를 분리하는 것이 `project-planner/SKILL.md` §"Spec 문서 구조"와 정합. `0-common.md`/`1-ai-agent.md` 모두 말미 `## Rationale`(ai-agent.md 는 `## 12. Rationale` — 넘버링 스타일은 `4-nodes` 내 12개 문서에서 이미 확립된 관행이라 편차 아님) 보유.
- 파일 명명: `0-common.md`/`1-ai-agent.md`/`2-text-classifier.md`/`3-information-extractor.md` 는 `N-name.md` 정렬 보장 규칙에 정합.
- 에러 코드: `LLM_CALL_FAILED`/`LLM_RATE_LIMIT`/`LLM_RESPONSE_INVALID`/`RESUME_INCOMPATIBLE_STATE`/`RETRY_STATE_NOT_FOUND`/`TOOL_DEFINITION_PAYLOAD_EXCEEDED` 등 UPPER_SNAKE_CASE 준수, `5-system/3-error-handling.md`·`6-websocket-protocol.md`·`4-execution-engine.md` 등 SoT 문서에 실제로 카탈로그되어 있어 `error-codes.md` 명명 규약과 정합. `output.error.details.retryable`(LLM 계열 노드 필수)·`retryAfterSec`(retryable=true 시에만) invariant 도 §3.2.1 그대로 반영.
- 인터랙션 타입: `interactionType: 'ai_conversation'`/`'ai_form_render'`, `interaction.type: 'form_submitted'|'button_click'|'message_received'` 등이 `interaction-type-registry.md`·`node-output.md §4.5` 의 값과 정확히 일치.
- 동적 포트 명명: 조건 포트(사용자 정의 UUID), 시스템 예약어(`out`/`error`/`user_ended`/`max_turns`), Text Classifier 의 `class_<i>`/`fallback` 모두 Principle 6 과 정합.
- `endReason` 값(`user_ended`/`max_turns`/`condition`/`error`)이 `codebase/packages/ai-end-reason/src/index.ts` 의 `AiAgentEndReason` 유니온과 정확히 일치.
- WS 명령(`execution.submit_message`/`submit_form`/`click_button`/`end_conversation`/`retry_last_turn`)이 `5-system/6-websocket-protocol.md` 에 등록된 8개 핸들러 명칭과 정확히 일치.
- Config echo(Principle 7) — 명시 키 enumeration 서술, spread 패턴 금지 위반 없음. `output.metadata.*`·`output.output.extracted.*`(둘 다 명시적으로 "폐기"로만 언급) 등 금지 패턴 실사용 없음.
- API 문서 규약(관점 4, OpenAPI/Swagger 데코레이터·DTO 명명) — 본 target 은 노드 동작 spec 이며 DTO/Swagger 참조가 전혀 없어 해당 관점은 적용 대상 아님(스코프 밖 확인, 위반 아님).

## 요약

`spec/4-nodes/3-ai` 는 `spec/conventions/node-output.md`(Principle 0~10), `interaction-type-registry.md`, `error-codes.md` 의 실질 계약(출력 wrapper 구조, 에러 envelope, retryable invariant, 동적 포트 명명, endReason 도메인, WS 명령 명명)을 폭넓고 정밀하게 준수한다. 다만 `0-common.md §5`가 wrapper 공유 규약을 실제로는 문서 서식 규칙인 Principle 11 에 잘못 귀속시키고 있어(WARNING), 같은 영역의 형제 문서가 Principle 11 을 올바른 의미로 쓰는 것과 충돌한다 — 기능적 계약 위반은 아니나 인용 정정이 필요하다. 그 외 `1-ai-agent.md`의 출력 케이스 헤더가 형제 문서·타 노드 문서의 `Case:` 서식 관행을 따르지 않는 점은 INFO 수준의 사소한 편차다.

## 위험도

LOW
