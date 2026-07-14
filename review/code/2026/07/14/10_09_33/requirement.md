# 요구사항(Requirement) 충족 리뷰 — AI Agent 도구 정의 payload 예산 가드레일

대상: `codebase/backend/src/nodes/ai/ai-agent/{ai-turn-executor.ts,ai-turn-executor.spec.ts,tool-payload-budget.ts,tool-payload-budget.spec.ts}`, `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/5-system/11-mcp-client.md`, `spec/conventions/cross-node-warning-rules.md`, `plan/in-progress/ai-agent-tool-payload-budget-{guardrail,followups}.md`

## 발견사항

- **[INFO]** `toolProviderGroupKey` 의 "sid = 첫 `__` 앞 세그먼트" 휴리스틱이 `sanitizeSid` 산출값에 `__` 가 우연히 포함되면 culprit provider 오귀속 가능
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-payload-budget.ts` `toolProviderGroupKey()` (`rest.split('__', 1)[0]`)
  - 상세: `cafe24-mcp-tool-provider.ts`/`makeshop-mcp-tool-provider.ts` 의 `sanitizeSid(integrationId) = integrationId.slice(0,16).replace(/[^a-z0-9]/gi, '_')` 는 integrationId 안의 각 비영숫자 문자를 개별적으로 `_` 로 치환한다. integrationId 에 연속된 특수문자(예: `--`)가 있으면 sid 자체에 `__` 가 생겨 `mcp_<sid>__<op>` 이름에서 `toolProviderGroupKey` 가 sid 를 반으로 잘라 잘못된 (더 짧은) provider key 로 그룹핑한다. 실무에서 integrationId 는 UUID(하이픈 단일 문자, 연속 없음)라 현재는 발현 가능성이 낮고, 이 필드는 진단용 `culpritProvider` (에러 message/`details`) 에만 영향 — 예산 초과 판정 자체(`bytes`/`toolCount` 합계)는 영향 없음.
  - 제안: 낮은 우선순위. 필요 시 `toolProviderGroupKey` 를 "마지막 `__`" 기준으로 바꾸거나 sid 생성 시 `_` 대신 다른 sanitize 문자를 쓰는 방안 검토 (필수 아님).

- **[INFO]** payload-budget error 포트의 `meta` 가 §7.3 JSON 예시(`turnDebug`/암묵적 `ragSources` 등)보다 얇고, `durationMs` 산정 기준점이 정상 종결 경로와 다름
  - 위치: `ai-turn-executor.ts` `executeSingleTurn` 신규 catch 분기 (`singleTurnEnteredAt` 사용) vs 정상 `out` 종결의 `singleTurnStartedAt`(§7.1)
  - 상세: §7.3 JSON 예시는 `meta.turnDebug: [{ turnIndex:1, llmCalls:[], totalDurationMs }]` 를 포함하지만, 신규 payload-budget 에러 분기는 `meta.{model, durationMs}` 만 반환한다. §7.3 필드표 자체에는 `meta.*` 행이 없어(오직 `output.error.*`/`port`/`status` 만 명문화) **CRITICAL 은 아님** — 이 케이스는 LLM 호출 자체가 발생하기 전(pre-flight)이라 `turnDebug`(LLM 호출 트레이스)가 원천적으로 비어있는 게 맞다. 다만 `durationMs` 는 method 진입 시각(`singleTurnEnteredAt`, resolveConfig+memory injection 포함)부터인 반면 정상 경로의 `singleTurnDurationMs` 는 `singleTurnStartedAt`(buildTools 성공 이후, 순수 turn-loop 구간)부터라 같은 필드가 포트마다 다른 구간을 측정한다. 프론트엔드는 `meta.turnDebug` 를 `extractTurnDebug()` 로 안전하게 `[]` 로 정규화하므로 크래시 위험은 없음(`codebase/frontend/src/components/editor/run-results/output-shape.ts`).
  - 제안: spec §7.3 본문에 "pre-flight 에러는 `turnDebug` 생략 가능" 명시 추가를 project-planner 에 권고(선택).

- **[INFO]** `ai-agent.md §10` "도구 정의 payload 예산 경고 (저장 시점)" 문단과 `AI_AGENT_TOOL_BUDGET_STRICT_SAVE` 관련 서술이 미구현 상태임을 해당 문단 내에서 직접 표시하지 않음 (문서 스타일 일관성)
  - 위치: `spec/4-nodes/3-ai/1-ai-agent.md` §10 "도구 정의 payload 예산 경고 (저장 시점)" 문단, §4.2 예산 표의 `AI_AGENT_TOOL_BUDGET_STRICT_SAVE` 행
  - 상세: 실제 코드에는 `AI_AGENT_TOOL_BUDGET_STRICT_SAVE`/`evaluateAiAgentToolPayloadWarnings`/config-time graph warning 이 전혀 구현돼 있지 않다(grep 결과 없음) — `plan/in-progress/ai-agent-tool-payload-budget-followups.md` 로 명시적으로 후속 분리됐고, `pending_plans:` frontmatter(양쪽 spec 문서) + `cross-node-warning-rules.md` §8 rule 행에 "⚠ 구현 예정(Planned)" 주석이 정확히 붙어 있어 **전체적으로는 추적이 정상**이다. 다만 `1-ai-agent.md` §10 해당 문단 자체는 현재형 서술("표면화된다", "차단한다")만 쓰고 바로 위 §11 캔버스 요약 문단처럼 "⚠ 미구현(Planned)" 인라인 주석을 붙이지 않아, `cross-node-warning-rules.md` 를 따라가지 않고 `ai-agent.md` 만 읽는 독자는 이미 구현된 것으로 오해할 소지가 있다. 코드는 옳고(구현 범위를 본 PR 밖으로 정확히 뺐음) 문서 스타일만 국지적으로 비일관 — SPEC-DRIFT 아님(구현이 spec 을 앞서간 게 아니라 반대로 spec 이 미구현 기능을 현재형으로 서술).
  - 제안: project-planner 가 §10 해당 문단 앞에 §11 과 동일한 "⚠ 미구현(Planned)" 인라인 표기를 추가하는 것을 권고 (강제 아님, 정보 전달성 개선).

- **[INFO]** (본 PR 범위 밖, 기존 갭 재확인) single-turn 의 `llmService.chat()` 호출은 여전히 try/catch 로 감싸지지 않아 `TOOL_DEFINITION_PAYLOAD_EXCEEDED` 이외의 single-turn LLM 오류(타임아웃/429/5xx 등)는 계속 `output.error`+`error` 포트 없이 engine-level FAILED 로만 떨어짐
  - 위치: `ai-turn-executor.ts` `executeSingleTurn` 의 `this.llmService.chat(...)` 호출부(여러 곳) — 신규 try/catch 는 `buildTools` 호출 1곳에만, 그것도 `ToolDefinitionPayloadExceededError` 로 좁게 한정
  - 상세: `plan/in-progress/node-output-redesign/ai-agent.md` 에 이미 "CRITICAL (single-turn 잔여)" 로 미해결 등재된 기존 갭이며, 본 PR 의 plan(`ai-agent-tool-payload-budget-guardrail.md`)도 "본 에러코드만이라도 명시 라우팅 보장" 이라고 스코프를 의도적으로 좁혔음을 명시한다 — 즉 회귀가 아니라 **의도된 부분 해결**. "6분 hang 제거" 라는 이번 사고의 근본 원인(도구 payload 팽창)은 이 변경으로 완전히 막히지만, single-turn 에서 발생 가능한 *다른* 무한 대기/미분류 실패는 여전히 원인불명 FAILED 로 남는다는 점만 재확인차 기록.
  - 제안: 조치 불요(이미 별도 plan 에 추적 중). 최종 사용자 관점에서 "single-turn 에러가 여전히 불투명할 수 있다"는 잔여 리스크만 인지.

- **[INFO]** `readByteBudget` 의 `Number(env) || fallback` 패턴상 env 값이 `"0"` 이면 fallback 으로 대체됨 (0 은 falsy)
  - 위치: `tool-payload-budget.ts` `readByteBudget()`
  - 상세: docstring 이 "빈 문자열/비수치/0 은 fallback 으로 방어된다" 라고 명시적으로 의도한 동작이며 `mcp-tool-provider.ts` `MAX_RESPONSE_BYTES` 선례와 동형이라 버그 아님. 다만 "예산을 0(=즉시 전부 차단)으로 강제 설정"은 이 스킴으로는 불가능 — 실무상 필요성 낮아 문제 삼지 않음.

## 요구사항 충족 여부 상세

- **기능 완전성**: 본 PR 의 명시 스코프(estimator SoT + 런타임 fail-fast + single-turn/multi-turn 공통 에러 라우팅)는 완전히 구현됨. `enforceToolPayloadBudget` 가 soft(warn)/hard·count(throw) 를 spec §4.2 표(98304/262144/128 기본값)와 정확히 일치시키고, `buildTools` 최종 tools 배열에 대해 single-turn·multi-turn(resume) 양쪽 choke point 에서 호출됨을 코드로 확인(`ai-turn-executor.ts:3499-3503`).
- **에러 시나리오 / 반환값**: single-turn 은 `buildTools` 의 `ToolDefinitionPayloadExceededError` 를 잡아 `{config, output.error, meta, port:'error', status:'ended'}` 를 **return**(throw 아님)하고, multi-turn(resume) 은 동일 에러를 **의도적으로 무캐치 throw**해 엔진 `handleAiMessageTurn`→`handleAiTurnError`→`extractAiTurnErrorPayload`(explicit-code passthrough, `retryable:false`)로 흡수되는 것을 실제 orchestrator 코드(`ai-turn-orchestrator.service.ts:594-615`, `:1112-1198`)로 교차 검증 — 두 경로 모두 spec §7.3/§7.9·§10 shape 과 line-level 일치.
- **엣지 케이스**: soft-only(warn, no throw)/hard bytes 초과/count 초과/count+hard 동시 초과 시 `budgetBytes` 고정(=hard) 규칙/logger 미주입 시 안전 degrade/빈 tools 배열(`estimateAgentToolPayload([])`)/env 빈 문자열·비수치·0 방어를 unit test 로 모두 고정(`tool-payload-budget.spec.ts`). culprit provider 최댓값 tie-break(첫 항목 유지)도 결정적.
- **TODO/FIXME**: diff 전체에 TODO/FIXME/HACK/XXX 없음.
- **데이터 유효성**: env override 는 `Number(x) || fallback` 로 NaN/빈값/음수 방어(0 은 fallback, 위 INFO 참고). `ToolDef[]` 입력에 대한 별도 스키마 검증은 없으나 `buildTools` 내부에서 항상 provider 가 생성한 형태만 들어오므로 범위 밖.
- **비즈니스 로직**: "개수 아닌 bytes 우선" 원칙(#828 회귀 배경)이 `toolCount > countMax || bytes > hardBytes` 우선순위와 `budgetBytes` 는 항상 hard로 고정하는 구현에 정확히 반영됨. `retryable: false` 가 항상 details 안에 위치(§7.3/§3.2.1 필수 필드) — `AiTurnOrchestrator.classifyLlmError` 의 explicit-code passthrough 규칙과도 값이 일치해 재계산 시에도 어긋나지 않음.
- **spec fidelity**: SoT 는 `spec/4-nodes/3-ai/1-ai-agent.md` §4.2(신규)·§10 에러 코드 표(신규 행, "10. 에러 코드" 표에 배치 — "Pre-flight 에러"(config validate) 표가 아닌 runtime 표에 정확히 위치)·§12.15(Rationale), `spec/5-system/11-mcp-client.md` §5.8(신규), `spec/conventions/cross-node-warning-rules.md` §5(backend-only 예외 신설)·§8(신규 행, "⚠ 구현 예정(Planned)" 명시)·frontmatter `status: implemented→partial`+`pending_plans`. 함수 시그니처(`estimateAgentToolPayload(tools) → {bytes, approxTokens, toolCount, perProvider}`), 에러코드명(`TOOL_DEFINITION_PAYLOAD_EXCEEDED`), 기본값(96KB/256KB/128), `details` shape(`retryable/totalBytes/budgetBytes/toolCount/culpritProvider?`), 메시지에 `mcpServers[].enabledTools` 문구 포함까지 코드·테스트·spec 3자가 line-level 로 일치. `PATCH /workflows/:id` 오용, 별도 `warnings[]` 필드 신설, 잘못된 에러코드명(`AI_TOOL_BUDGET_EXCEEDED`) 등 사전 consistency-check(파일 7~17)가 잡아낸 Critical 들은 최종 spec draft(파일 18~20)에서 전부 정정 반영된 것을 diff 로 직접 확인.

## 요약

이번 변경은 §4.2/§10/§12.15(ai-agent.md)·§5.8(mcp-client.md)·§5/§8(cross-node-warning-rules.md) 로 정의된 "도구 정의 payload 예산 런타임 fail-fast" 범위를 코드·테스트·spec 3자 모두 line-level 로 정확히 구현했다. single-turn 은 신규 로컬 try/catch 로 `error` 포트를 **return**, multi-turn(resume) 은 무캐치 **throw** 로 기존 엔진 catch 인프라(`handleAiMessageTurn`/`extractAiTurnErrorPayload`)에 흡수시키는 비대칭 설계가 실제 코드로 검증됐고, 이는 plan 이 명시한 "본 에러코드만 명시 라우팅 보장" 의도와 일치한다. estimator 단일 진실(`estimateAgentToolPayload`)·bytes 우선 지표·hard/soft/count 3단 정책·`retryable:false`·구조화 `details`(culpritProvider 포함) 모두 테스트로 고정됐고 spec 표와 정확히 대응한다. 발견된 사항은 모두 INFO 수준(진단용 culprit provider 그룹핑의 이론적 edge case, 에러 포트 meta 필드가 정상 종결보다 얇은 것에 대한 spec 문서화 여지, 저장 시점 config 경고가 "Planned" 임을 §10 본문 자체에는 인라인으로 안 적은 문서 스타일, 그리고 본 PR 스코프 밖의 기존 single-turn 일반 에러 라우팅 갭 재확인)이며, 어느 것도 CRITICAL/WARNING 급 코드 결함이나 spec 위반이 아니다. TODO/FIXME 없음, 모든 실행 경로에서 적절한 반환값 확인.

## 위험도

LOW
