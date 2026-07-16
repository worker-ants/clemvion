# 정식 규약 준수 검토 — spec/4-nodes/3-ai/

검토 모드: `--impl-prep` (scope=`spec/4-nodes/3-ai/`)
대상 문서: `spec/4-nodes/3-ai/0-common.md` · `1-ai-agent.md` · `2-text-classifier.md` · `3-information-extractor.md` · `_product-overview.md`
대조 규약: `spec/conventions/node-output.md` · `spec/conventions/cross-node-warning-rules.md` · `spec/conventions/error-codes.md` · `spec/conventions/spec-impl-evidence.md` · `spec/conventions/conversation-thread.md` · `spec/conventions/interaction-type-registry.md`

## 발견사항

- **[WARNING]** AI Agent 출력 구조 섹션이 `node-output.md` Principle 11 의 `### Case: <케이스 이름>` 헤딩 포맷을 따르지 않음
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` §7.1~§7.10 (라인 472~1046, 헤딩 예: `### 7.1 Single Turn 모드 — 정상 완료 (\`out\` 포트)`)
  - 위반 규약: `spec/conventions/node-output.md` Principle 11 "출력 예시 문서화 규칙" — `### Case: <케이스 이름>` 헤딩을 명시적으로 요구
  - 상세: `1-ai-agent.md` §7 도입부는 "CONVENTIONS Principle 0~11 포맷" 을 따른다고 명시하지만, 실제 10개 출력-케이스 헤딩(§7.1~§7.10) 어디에도 `Case:` 토큰이 없다. 같은 AI 카테고리의 형제 문서인 `2-text-classifier.md` (§5.1~§5.3 `### 5.1 Case: Single-label 모드 …`), `3-information-extractor.md` (§5.1/§5.3~§5.6 `### 5.1 Case: Single Turn 정상 …`) 은 이 포맷을 정확히 따르며, 다른 구현 완료 노드(`spec/4-nodes/4-integration/1-http-request.md` §5.1/§5.3 등, repo 전체 65 건)도 동일 패턴을 쓴다. AI Agent 문서만 이 리포지토리 전역 관행에서 이탈한 outlier.
  - 제안: §7.1~§7.10 헤딩에 `Case:` 토큰을 삽입 (예: `### 7.1 Case: Single Turn 정상 완료 (\`out\` 포트)`). 자동 파싱 가드는 없어 CRITICAL 은 아니나, 가장 복잡하고 케이스가 많은 노드 문서가 문서화 규칙을 놓치면 향후 tooling(예: 케이스 목록 자동 추출)에 장애가 될 수 있음.

- **[WARNING]** Text Classifier 의 `meta.llmCalls` 가 `0-common.md §6` 이 "모든 AI 노드" 공통으로 규정한 `meta.turnDebug` shape 과 다른 이름·구조를 사용
  - target 위치: `spec/4-nodes/3-ai/2-text-classifier.md` §5.1/§5.2/§5.3 (라인 163, 186, 210, 252, 288, 325, 344) — `meta.llmCalls: [{requestPayload, responsePayload, durationMs}]` (top-level 평탄 배열)
  - 위반 규약: `spec/4-nodes/3-ai/0-common.md` §6 "토큰 회계 (meta)" — "모든 AI 노드의 LLM 호출 결과 메타에는 다음 필드가 포함된다" 표에서 `meta.turnDebug`(선택)를 `[{ turnIndex, llmCalls, totalDurationMs, … }, …]` 형태로 규정. 이는 `spec/conventions/node-output.md` Principle 2 "LLM 계열" 행이 위임하는 공유 shape 이며 설계 목표("노드 종류를 몰라도 어디에 무엇이 있을지 예측 가능")의 직접 근거.
  - 상세: `1-ai-agent.md`(§7.1 등, `meta.turnDebug[]`)와 `3-information-extractor.md`(§5.1 등, `meta.turnDebug`)는 공통 규약대로 `meta.turnDebug[i].llmCalls` 중첩 구조를 그대로 쓰고 있다(단일 호출도 길이-1 배열로 감싸 "멀티턴 출력 스키마와 일관성 유지"라고 명시). 반면 Text Classifier 는 `meta.llmCalls` 를 top-level 평탄 배열로 직접 노출 — `codebase/backend/src/nodes/ai/text-classifier/text-classifier.handler.ts:251-275`(실제 구현)도 동일하게 `meta.llmCalls` 를 반환해 spec-코드는 정합하지만, 세 AI 노드 간 "공통 규약" 을 어긴다. Text Classifier 자신의 §8 Rationale 은 "본 노드 단독 결정 없음 — 공통 규약을 그대로 따른다" 라고 명시하는데, 실제로는 이 특정 필드에서 공통 규약과 다른 shape 을 쓰고 있어 문서 스스로의 주장과 모순.
  - 제안: (a) Text Classifier 를 `meta.turnDebug: [{ turnIndex: 1, llmCalls: [...], totalDurationMs }]` 로 정합화하거나, (b) 정말 단일 호출·turn 개념이 없는 노드라 `llmCalls` 평탄 구조가 의도된 설계라면 `0-common.md §6` 에 "Text Classifier 는 turn 개념이 없어 `meta.llmCalls` 평탄 배열을 예외로 쓴다" 는 명시적 예외 각주를 추가해 self-claim("공통 규약을 그대로 따른다")과의 모순을 해소.

- **[WARNING]** AI Agent 의 조건(`condition.id`) 예약어 목록이 `node-output.md` Principle 6 의 시스템 포트 예약어 전체 집합과 불일치 (Text Classifier 는 정합)
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` §5.1 유효성 검증 규칙 — "예약된 포트 ID(`out`, `in`, `error`, `user_ended`, `max_turns`)와 충돌 불가" (코드: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.schema.ts:587-592` `RESERVED_PORT_IDS`)
  - 위반 규약: `spec/conventions/node-output.md` Principle 6 "동적 포트 ID 네이밍" — "시스템 포트 예약어: `out`, `error`, `default`, `done`, `user_ended`, `max_turns`, `completed`, `fallback`, `continue`. 사용자 설정 ID가 이 값과 충돌하면 프런트엔드에서 거부."
  - 상세: `2-text-classifier.md` §3.2 는 이 9개 예약어 전체(`out/error/default/done/user_ended/max_turns/completed/fallback/continue`)를 그대로 채택했고 코드(`text-classifier.schema.ts:161-169` `RESERVED_PORT_WORDS`, 주석에 "Mirrors the switch node's RESERVED_CASE_IDS pattern" 명시)도 정확히 동일 집합이다. 반면 AI Agent 는 `out/in/error/user_ended/max_turns` 5개만 검사한다 — Principle 6 의 `default`/`done`/`completed`/`fallback`/`continue` 5개가 빠져 있고(사용자가 조건 id 로 `"fallback"`이나 `"completed"`를 입력해도 통과), 반대로 Principle 6 목록에 없는 `in`(AI Agent 자신의 입력 포트)이 추가돼 있다. 두 형제 노드가 "예약 포트 이름 충돌 방지"라는 동일 목적의 검증을 서로 다른 집합으로 구현한 상태.
  - 제안: AI Agent 의 `RESERVED_PORT_IDS` 를 `node-output.md` Principle 6 의 9개 시스템 예약어 + 자기 노드의 실제 입력 포트(`in`) 로 통일하거나, 왜 AI Agent 만 축소된 부분집합을 쓰는지 spec 에 근거를 명시. `--impl-prep` 대상 작업(config-time tool-payload-budget 경고, PR #1)과는 직접 관련 없으나, 동일 파일(`ai-agent.schema.ts`)을 이번 스프린트에 다시 만지게 되므로 함께 정리하면 비용이 낮음.

## 요약

`spec/4-nodes/3-ai/` 전반은 `spec/conventions/node-output.md` 의 Principle 0~11(5필드 invariant·config/output 직교성·에러 컨트랙트·블로킹/재개·port 모델·config echo·이중 중첩 금지 등)을 매우 상세하고 명시적으로 인용하며 잘 준수하고 있고, `cross-node-warning-rules.md` 의 backend-only rule 예외(§5)·rule id 명명(`ai_agent:tool-payload-budget`) 도 정확히 정합해 이번에 착수하려는 config-time 저장 경고(항목 A) 작업을 막을 CRITICAL 규약 위반은 발견되지 않았다. 다만 AI 카테고리 3 노드가 공유해야 할 세부 shape 두 가지 — (1) 출력 예시 헤딩의 `Case:` 표기, (2) `meta.turnDebug` 구조, (3) 조건/카테고리 id 예약어 집합 — 에서 AI Agent·Text Classifier 사이에 실제 코드로도 확인되는 국소적 불일치가 있어 "노드 종류를 몰라도 예측 가능" 이라는 node-output.md 의 설계 목표를 부분적으로 흐린다. 세 건 모두 build-time 가드로 걸리지 않는 문서/네이밍 수준의 편차이며 --impl-prep 대상인 항목 A(config-time graph warning) 착수를 차단하지 않는다.

## 위험도

LOW
