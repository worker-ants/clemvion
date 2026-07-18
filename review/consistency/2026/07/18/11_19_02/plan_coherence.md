# Plan 정합성 검토 — spec/4-nodes/3-ai (--impl-prep)

## 발견사항

### [CRITICAL] Multi-turn `out` 포트 유무 — spec 자기모순이 미해소 상태로 남아있음

- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` §3.2 ("Multi Turn 모드에는 **`out` 포트가 존재하지 않는다** … 조건이 0개인 경우에도 동일") + §3.2 마이그레이션 절
- 관련 plan: `plan/in-progress/spec-drift-ai-agent-outport-countmax.md` — "Critical 1" (체크박스 미체크, 처분 없음)
- 상세: 같은 저장소 안에서 `spec/4-nodes/3-ai/_product-overview.md:84`(ND-AG-24) 와 `spec/4-nodes/_product-overview.md:215`(동일 ID) 는 여전히 "조건 0개 시 `out` + `error` 제공 (하위 호환)" 이라고 서술 — target 문서의 "out 포트 없음(예외 없음)" 과 **정반대**다. 이 모순은 `spec-drift-ai-agent-outport-countmax.md` 가 2026-07-16 발견해 "실제 코드를 SoT 로 확정 후 한쪽을 정정" 하기로 한 미해결 항목이며, 오늘(2026-07-18) 기준 체크박스가 여전히 `[ ]` 다. 방금 확인한 코드/plan 정황(`plan/in-progress/node-output-redesign/ai-agent.md` §Principle 5 "multi-turn 정상에는 out 포트가 없음 — spec §3.2 와 일치" + 동일 문서 종합개선안 마지막 항목이 "dynamic ports resolver 가 multi-turn 에서 out 을 제거하고 …를 산출하는지 frontend resolver 검증 필요"를 **미확인**으로 남겨둠)은 `1-ai-agent.md` 쪽이 맞을 가능성을 시사하지만, 공식 SoT 판정은 아직 plan 에서 내려지지 않았다.
- 제안: 이번 impl-prep 로 `spec/4-nodes/3-ai` 영역에 착수하기 전에 `spec-drift-ai-agent-outport-countmax.md` Critical 1 을 먼저 처분(project-planner, 코드 SoT 확정 → `_product-overview.md` 두 곳 정정 또는 `1-ai-agent.md` 정정)한다. 이 결정 없이 포트 관련 코드를 추가로 건드리면 이미 상반된 두 spec 문서 중 하나를 근거 없이 강화하게 된다.

### [CRITICAL] AI Agent §7.3 (single-turn `error` 포트) — 미구현 상태가 spec 문서에 캐비엇 없이 서술, `pending_plans` 미등재

- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` §7.3 ("타임아웃, rate limit, LLM API 오류, JSON 파싱 실패 등 **모든** 오류 상황에서 사용" — 조건부 표기 없음) + frontmatter `pending_plans` (현재 `ai-agent-tool-connection-rewrite.md`, `spec-drift-ai-agent-outport-countmax.md` 2건만 등재)
- 관련 plan: `plan/in-progress/node-output-redesign/ai-agent.md` §종합 개선안 첫 항목 — `[ ] (impl) **CRITICAL (single-turn 잔여)** executeSingleTurn 의 llmService.chat 호출을 try/catch 로 감싸 … 근거: ai-turn-executor.ts:1209/:1439 — 현 throw 미캡처, spec §7.3`
- 상세: 코드 확인(`ai-turn-executor.ts` `executeSingleTurn`)상 single-turn LLM 호출은 여전히 try/catch 로 감싸여 있지 않아 throw 시 엔진이 그대로 `FAILED` 로 처리하고 `output.error`/`port:'error'` 라우팅이 발생하지 않는다 — multi-turn 경로(`handleAiTurnError`)만 해소됐다. 그런데 target §7.3 은 이 미구현 케이스를 구분 없이 "모든 오류 상황"이 `error` 포트로 간다고 서술하며, 문서 내 다른 미구현 항목들(§4 Tool Area, §8 캔버스 요약)이 사용하는 "⚠ 미구현(Planned)" 마커도 없다. `1-ai-agent.md` frontmatter 의 `pending_plans` 도 이 gap 을 추적하는 `node-output-redesign/ai-agent.md`(또는 상위 `README.md`) 를 등재하지 않아, spec-impl-evidence 관례(R-5 — `partial` 은 미구현 surface 를 책임지는 plan 을 `pending_plans` 에 명시)상으로도 추적이 끊긴다.
- 제안: (a) `1-ai-agent.md` frontmatter `pending_plans` 에 `plan/in-progress/node-output-redesign/README.md`(또는 `ai-agent.md`) 추가, (b) §7.3 본문에 single-turn 경로의 현재 한계를 캐비엇으로 명시하거나, developer 가 이번 착수 범위에 이 CRITICAL 항목을 포함해 즉시 해소.

### [CRITICAL] Information Extractor §5.5 (`resumed` 구조화 스냅샷) — `status: implemented` 인데 미구현 + `pending_plans` 부재

- target 위치: `spec/4-nodes/3-ai/3-information-extractor.md` frontmatter (`status: implemented`, `pending_plans` 필드 없음) + §5.5 ("사용자 메시지를 받아 … `waiting_for_input` 으로 수렴하기 직전에 1 회 emit 되는 observability-only 스냅샷 … engine (`execution-engine.service`) 이 주입")
- 관련 plan: `plan/in-progress/node-output-redesign/information-extractor.md` 6차 갱신(2026-06-25) — "여전히 잔여: `status:'resumed'` transient snapshot 미emit (③, … AI 대화 turn 은 `message_received` interaction 을 emit 안 함)" / 자매 문서 `plan/in-progress/node-output-redesign/ai-agent.md` 는 같은 기능을 "구조화 `resumed` 스냅샷을 추가할지 … 미결정" 이라고 명시적으로 오픈 상태로 남김.
- 상세: 코드 확인(`ai-turn-orchestrator.service.ts` `handleAiMessageTurn`) 결과 AI 대화형 노드(ai_agent·information_extractor 공용 경로)는 사용자 메시지 수신 시 곧바로 다음 `waiting_for_input`/종결 상태로 전이할 뿐, 중간에 `status:'resumed'` 구조화 스냅샷을 `setStructuredOutput` 하는 코드가 없다(`message_received` 문자열은 프로덕션 AI 경로 어디에도 없음 — button-interaction 관련 파일에만 존재). 그런데 target §5.5 는 이를 캐비엇 없이 상세 JSON 예시·필드표까지 곁들여 "engine 이 주입"한다고 단정 서술하고, frontmatter 는 `status: implemented`(부분 구현이 아니라 완전 구현을 의미)이며 `pending_plans` 자체가 없다. 자매 문서 `1-ai-agent.md` §7.5 는 최소한 이 gap 을 인지해 재정의("observability 한정" + 별도 라이브 WS 신호)라도 했지만, 이 재정의조차 아직 plan 상 "구조화 emit 을 추가할지 미결정" 인 채로 남아 있어 실제로는 두 노드 모두 미해소 상태다.
- 제안: `3-information-extractor.md` 를 `status: partial` 로 하향 + `pending_plans: [plan/in-progress/node-output-redesign/information-extractor.md]`(또는 README) 등재, §5.5 에 ai-agent §7.5 와 동일한 수준의 "observability-only, 현재 구조화 emit 은 없고 § 대체 신호로 충족" 캐비엇 반영. 근본 해소는 node-output-redesign plan 의 "미결정" 항목을 project-planner 가 먼저 확정해야 한다.

### [INFO] Text Classifier — 잔여 legacy 항목이 `pending_plans` 미등재 (경미)

- target 위치: `spec/4-nodes/3-ai/2-text-classifier.md` frontmatter (`status: implemented`, `pending_plans` 없음)
- 관련 plan: `plan/in-progress/node-output-redesign/text-classifier.md` — legacy `error: z.string().optional()` schema 필드 잔재, `meta.durationMs` 주석-코드 drift(callStartedAt vs executeStartedAt), boundary 테스트 누락 등 경미한 구현 청소 항목만 잔존(런타임 동작 차이 없음).
- 상세: 위 두 CRITICAL 항목과 같은 패턴(관련 in-progress plan 이 있는데 frontmatter 에 미등재)이지만, 잔여 항목이 모두 코드 청소/주석 수준이라 target 서술과 실제 동작 사이 괴리는 없다 — 심각도가 낮다.
- 제안: 여유가 있을 때 `pending_plans` 에 함께 등재해 추적 일관성을 맞추는 정도로 충분.

### [INFO] `ie-endmultiturn-errorpayload-contract.md` — 이번 리뷰를 트리거한 plan, target 과 이미 정합

- target 위치: `spec/4-nodes/3-ai/3-information-extractor.md` §5.3 (`output.error.details.retryable` invariant — code 기반 고정)
- 관련 plan: `plan/in-progress/ie-endmultiturn-errorpayload-contract.md` (오늘 생성, 현재 worktree 소유, 워크플로 체크리스트 3번 항목이 바로 이 `--impl-prep spec/4-nodes/3-ai` 호출)
- 상세: plan 의 Q2 판정("IE 의 현재 error 종결 경로가 §5.6 을 완전 충족, retryable 은 code 기반 invariant 로 spec 이 이미 규정")은 target §5.3(line 304 부근)의 실제 서술과 정확히 일치한다. 이 plan 이 계획한 작업(엔진 `endMultiTurnConversation` 시그니처 `_` prefix, docblock 정정, pinning 테스트)은 코드/문서 수준 정리이며 spec 본문 변경을 요구하지 않는다 — target 과 충돌 없음.
- 제안: 없음 (참고용 확인).

## 요약

`spec/4-nodes/3-ai` 는 두 개의 명시적 in-progress plan(`ai-agent-tool-connection-rewrite.md`, `spec-drift-ai-agent-outport-countmax.md`)과 frontmatter 로 연결돼 있으나, 후자의 Critical 1(멀티턴 `out` 포트 유무 자기모순)이 아직 미해소인 채로 developer 착수를 앞두고 있다. 더 심각한 것은 `plan/in-progress/node-output-redesign/{ai-agent,information-extractor}.md` 가 추적 중인 두 개의 실질적 spec-코드 괴리(단일턴 AI Agent 의 `error` 포트 미구현, AI 대화형 노드의 `resumed` 구조화 스냅샷 미구현)가 target 문서의 `pending_plans` 에 전혀 반영돼 있지 않다는 점이다 — 특히 Information Extractor 는 `status: implemented`(완전 구현 주장)로 표기돼 있어 spec-impl-evidence 관례상으로도 부정확하다. 이번에 트리거된 `ie-endmultiturn-errorpayload-contract.md` 자체는 target 과 이미 정합해 문제 없음이 확인됐다. 착수 전 최소한 spec-drift Critical 1 확정과 두 노드의 `pending_plans` 보정이 필요하다.

## 위험도

CRITICAL
