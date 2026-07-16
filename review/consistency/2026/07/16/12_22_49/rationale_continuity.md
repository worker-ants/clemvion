## Rationale 연속성 Check 결과

대상: `spec/4-nodes/3-ai/` (diff-base `origin/main`)
실제 변경 파일: `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/conventions/cross-node-warning-rules.md`, `spec/conventions/node-cancellation.md`

### 발견사항

- **[INFO]** LLM chat 호출 app-level 타임아웃의 3-AI-노드 간 비대칭 도입이 0-common.md 의 drift-방지 원칙과 소폭 긴장
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` §12.16 "왜 ai_agent 전용 스코프인가" (신규)
  - 과거 결정 출처: `spec/4-nodes/3-ai/0-common.md` `## Rationale` "시스템 컨텍스트 자동 주입 (§11)" — "노드별 별도 필드가 아닌 `0-common.md §11` 단일 정의인 이유는 3 노드가 동일 컨텍스트를 필요로 하여 drift 를 방지하기 위함"
  - 상세: 0-common.md 의 선례는 AI 3 노드가 공유하는 `LlmService.chat` 관련 cross-cutting 관심사(시스템 컨텍스트 prefix)를 `0-common.md` 에 단일 정의해 drift 를 막는 원칙을 세웠다. 신규 §12.16 의 app-level LLM 호출 타임아웃도 세 노드가 동일하게 `LlmService.chat` 을 호출하는 동종 cross-cutting 관심사이지만, 이번에는 의도적으로 `ai_agent` 전용 env(`AI_AGENT_LLM_CALL_TIMEOUT_MS`)로 스코프를 좁혀 `text_classifier`/`information_extractor` 는 제외했다. 이는 "번복"이 아니라 새로운 축(defense-in-depth 노출면 차이)의 **의도적 스코프 결정**이며 §12.16 4번째 bullet 에 근거(resume 다단계 tool-loop 로 hang 노출면이 가장 넓은 노드)가 명시돼 있고 "다른 AI 노드로의 확대는 후속" 이라고도 밝혀, 형식적으로는 결정 근거 요건(§3 "결정의 무근거 번복" 기준)을 충족한다. 다만 0-common.md §Rationale 자체에는 이 예외/비대칭이 기록되지 않아, 향후 0-common.md 만 읽는 독자는 "3 노드 동일 컨텍스트 원칙"이 LLM 호출 레벨까지 전부 적용된다고 오해할 수 있다.
  - 제안: CRITICAL/WARNING 아님 — 근거가 이미 §12.16 에 명시돼 있어 즉시 조치 불요. 후속으로 text_classifier/information_extractor 에 동일 defense-in-depth 를 확대하거나 영구히 ai_agent 한정으로 굳힐 때, `0-common.md` §11 Rationale 인근에 "이 drift-방지 원칙은 systemPrompt prefix 한정이며 LLM 호출 레벨 defense-in-depth(timeout 등)는 노드별 독립 스코프"라는 한 줄 명시를 추가하면 두 문서 간 원칙 경계가 더 명확해진다.

- **[INFO]** "무제한 대기" invariant 와 신규 app-level LLM 호출 타임아웃의 문면상 인접성
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` §1 표 하단 "Multi Turn 모드에서 사용자 응답은 **무제한 대기**합니다. (외부 cancel 외에는 타임아웃이 발생하지 않습니다.)" / §12.16 "AI_AGENT_LLM_CALL_TIMEOUT_MS, 기본 600000ms"
  - 과거 결정 출처: 동일 문서 §1 config 표 하단 비고 (기존, 변경 없음) 및 §6.2 3항 "사용자 응답은 무제한 대기합니다."
  - 상세: 기존 invariant("타임아웃이 발생하지 않습니다")는 **사용자가 다음 메시지를 보낼 때까지의 대기**(park 상태, `waiting_for_input`)를 가리키고, 신규 §12.16 타임아웃은 **LLM 이 응답을 생성하는 동안의 대기**(`chat` 호출 자체)를 가리켜 서로 다른 phase 다. 실제로 코드/스펙 상 모순은 아니나, 두 "타임아웃 없음 vs 타임아웃 있음" 서술이 같은 노드 문서 안에 근접 배치되어 독자가 빠르게 훑을 때 상충으로 오독할 여지가 있다.
  - 제안: §12.16 서두 또는 §1 "무제한 대기" 비고에 "(LLM 자체 응답 생성 시간은 §12.16 app-level timeout 대상이며, 여기서 말하는 무제한 대기는 사용자의 다음 메시지 도착까지의 park 시간에 한정)" 같은 1줄 상호 참조를 추가하면 명확해진다. 필수는 아님.

검증 과정에서 CRITICAL/WARNING 급 위반은 발견되지 않았다. 특히 다음 항목들은 오히려 **Rationale 연속성이 잘 지켜진 사례**로 확인됐다:

- §10 "도구 정의 payload 예산 경고" 를 `⚠ 구현 현황(Planned)` → 구현 완료 서술로 바꾼 것은 `plan/in-progress/ai-agent-tool-payload-budget-followups.md` 항목 A 완료(PR #955, 커밋 `7231f7006`/`2ccc442eb` 등)와 정확히 대응하며, §12.15 의 기존 결정("왜 config 는 warn 기본인가")과 충돌 없이 근사치 한계(`generic MCP best-effort skip`)를 추가 명시했을 뿐이다.
- 신규 §12.16 은 §4.2/§12.15 가 이미 확립한 "return-vs-throw 비대칭" 패턴, §10 에러코드 표의 기존 `LLM_CALL_FAILED`(network timeout, retryable=true) 분류, `spec/5-system/7-llm-client.md` §8.3 의 기존 `LlmCallOptions.timeoutMs`, `spec/conventions/node-cancellation.md` `## Rationale` 이 예견한 `AbortSignal.any` 활용을 모두 그대로 재사용·연장한다 — 신규 에러 코드를 만들지 않고 기존 taxonomy 를 재사용한 것도 §10 의 "sub-case 분리 vs passthrough" 기존 정책과 정합적이다.
- `spec/conventions/node-cancellation.md` / `spec/conventions/cross-node-warning-rules.md` 동반 갱신은 `spec/4-nodes/3-ai/1-ai-agent.md` 의 신규 서술과 상호 참조가 일치하며 별도의 모순을 만들지 않는다.
- plan 파일(`ai-agent-tool-payload-budget-followups.md`)의 impl-prep 체크리스트에 "§12.16 error-routing overclaim·LLM_TIMEOUT disambiguation" 이 과거 발견되어 조치 완료로 기록돼 있으며, 현재 §12.16 본문은 single-turn 의 미해결 gap 을 "신규로 만들지도 해소하지도 않는다(스코프 밖)"로 정직하게 스코프 한정해 서술하고 있어 과잉주장(overclaim) 흔적이 남아있지 않다.

### 요약

이번 diff(`spec/4-nodes/3-ai/1-ai-agent.md` 의 §10 구현완료 마킹 + 신규 §12.16, 그리고 이를 뒷받침하는 `node-cancellation.md`/`cross-node-warning-rules.md` 동반 갱신)는 과거 `## Rationale` 결정을 재도입·번복하거나 합의 원칙을 위반하는 사례가 없다. 오히려 §4.2/§12.15 의 return-vs-throw 비대칭 패턴, §10 의 에러 taxonomy 재사용 원칙, `llm-client.md`/`node-cancellation.md` 의 기존 timeout/signal 인프라 설계를 정확히 연장한 사례로, Rationale 연속성 측면에서 모범적이다. 발견된 두 건은 모두 INFO 수준의 문서 명확화 제안(3-노드 drift-방지 원칙과의 스코프 경계 명시, "무제한 대기" 문구와의 phase 구분 명시)이며 즉시 조치를 요하지 않는다.

### 위험도
LOW
