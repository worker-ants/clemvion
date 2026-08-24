# Consistency Check 통합 보고서

**BLOCK: YES** — cross_spec 이 CRITICAL 1건을 발견했다 (WS §4.1 `execution.node.failed` 의 `error` 필드 클레임이 전 emit 경로와 모순되어, `conversation-thread.md` 가 규정한 `system_error` 재시도 배너가 라이브 세션에서 non-functional).

## 전체 위험도
**HIGH** — 5개 checker 중 4개는 위반 없음(NONE/LOW) 이지만, cross_spec 이 발견한 CRITICAL 1건은 실제 사용자 기능(멀티턴 AI 에이전트의 retryable 에러 재시도 배너)이 라이브 WS 경로에서 동작하지 않음을 코드·테스트 근거로 확정했다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | WS §4.1 `execution.node.failed` row 의 "`error` 는 `output.error` 전체 구조(`{code, message, details}`)" 클레임이, 실제 backend emit 사이트 4곳(`execution-engine.service.ts:6297`, `:6372`, `:8013`, `ai-turn-orchestrator.service.ts:1532`) 전부에서 top-level `error` 가 **string(message only)** 로만 나가는 것과 모순. 구조화 객체는 `output.output.error` 에만 존재. Frontend `use-execution-events.ts` 의 `handleNodeFailed` 가 `extractNodeErrorPayload(payload.error, undefined)` 로 `rawOutput` 을 고정 `undefined` 전달해 `errorPayload` 가 라이브 이벤트에서 항상 `null` → `system_error` APPEND 블록이 한 번도 실행되지 않음. `CT-S9`/`CT-S10` 테스트가 존재하지 않는 shape 을 fixture 로 쓰고, 실제 shape(string)을 "legacy" 로 오분류한 채 배너 미표시를 의도된 동작으로 단언 | `spec/5-system/6-websocket-protocol.md` §4.1, `execution.node.failed` row (이번 diff 가 `output` 필드 설명을 추가하며 편집한 바로 그 행) | `spec/conventions/conversation-thread.md` §1.1.1/§8.3/§9.7/§1.2.1 (`system_error` 재시도 배너 규정), `spec/conventions/node-output.md` §3.2/§3.2.1, `codebase/backend` 4개 emit 사이트, `codebase/frontend/src/lib/websocket/use-execution-events.ts` (`handleNodeFailed`, `extractNodeErrorPayload`), `use-execution-events.test.ts` (`CT-S9`/`CT-S10`/"legacy string" 테스트) | (a) WS §4.1 문구를 실측대로 정정 — top-level `error` 는 항상 string, 구조화 객체는 `output.output.error` 에만 존재. (b) `handleNodeFailed` 가 `extractNodeErrorPayload(payload.error, payload.output)` 로 `rawOutput` 전달 + `nested` 분기를 `rawOutput.output.error` 2단 접근으로 수정(`handleNodeCompleted` 호출부도 동일 결함 점검). (c) `CT-S9`/`CT-S10` fixture 를 실 backend shape 으로 교체, "legacy" 코멘트 정정 |

## planner 인계 (권한 밖 Critical)

> 위 Critical 중 근본 원인이 호출자 권한 밖인 항목만. **여기 실려도 등급은 CRITICAL 그대로이고
> `BLOCK: YES` 도 그대로입니다** — 이 표는 차단을 푸는 장치가 아니라 다음 행동을 지정하는
> 장치입니다.

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| 1 | `spec/5-system/6-websocket-protocol.md` §4.1 의 "error 는 output.error 전체 구조" 문구 정정은 CLAUDE.md 자기-반증형 소정정 5조건 중 **조건 1(대상 문장을 developer 자신이 그 문서에 썼다)을 충족하지 못함** — cross_spec 확인상 이 문장은 이번 diff 이전부터 존재했고, 이번 diff 는 인접 `output` 필드 설명만 추가하며 이 문장을 검증 없이 그대로 재확산시켰을 뿐 developer 가 이번 세션에 작성한 문장이 아니다. 따라서 developer 턴에서 직접 정정할 권한이 없다 | project-planner | `spec/5-system/6-websocket-protocol.md` §4.1 `execution.node.failed` row — "top-level `error` 는 항상 string(message only), 구조화 객체(`{code, message, details}`)는 `output.output.error` 에만 존재"로 정정(취소선 보존). 필요 시 `spec/conventions/conversation-thread.md` §1.2.1 의 `data.retryable`/`data.retryAfterSec` 출처 서술도 함께 갱신하여 실제로 어느 필드에서 이 값을 합성해야 하는지 명시 | `plan/in-progress/spec-sync-external-interaction-api-gaps.md` — 신규 `[ ]` 항목으로 등재 권장(정본 트래커) |

> 참고: 이 CRITICAL 의 **codebase 쪽 수정**(frontend `use-execution-events.ts` 의 `handleNodeFailed`/`extractNodeErrorPayload` 수정, 테스트 fixture 교정)은 `codebase/**` 이므로 developer 권한 **내**에 있다 — planner 인계는 spec 문구 정정 부분에 한정된다. 두 작업을 병행하되, spec 정정이 확정되기 전에 frontend 로직만 먼저 고치는 것도 가능(코드가 실제 payload shape 을 정확히 다루도록 하는 것은 spec 서술과 독립적으로 옳다).

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | 이번 diff 가 신규 추가한 "`output` 도 함께 실린다(=`NodeExecution.outputData` 전체)" 클레임이, 실제로는 emit 사이트 4곳 중 **2곳**(`finalizeErrorPortNode`, `ai-turn-orchestrator` 종결)에서만 성립하고 나머지 2곳(continue-on-error `stop`/`default` 분기, container-level 실패)은 emit payload 에 `output` 키 자체가 없음 — 행 문구가 일반 클레임처럼 읽힘 | `spec/5-system/6-websocket-protocol.md` §4.1, `execution.node.failed` row | `codebase/backend` 4개 emit 사이트 중 2곳 | 행 문구를 "error-port 종결·AI turn 종결은 `output` 동봉, 일반 pre-flight throw/container 실패 경로는 미동봉"으로 세분화. 기능적으로는 `narrowTopLevelNodeOutput` 의 null/non-object 가드가 안전하게 처리하므로 무해 — 순수 문서 정확도 이슈 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | provider spec 3곳(`telegram.md:160`, `discord.md:256`, `slack.md:233`, CCH-MP-06 fallback 행)이 이번 PR 의 "wire `output` 은 래퍼 전체, 도메인 값은 `output.output`" 재정정을 아직 반영하지 않고 구 표현(`output.rendered`)을 그대로 씀. 동작은 `extractRendered` 헬퍼가 3후보를 순회해 깨지지 않으나 문면상 정정 이전 이해를 담고 있음 | `spec/4-nodes/7-trigger/providers/{telegram,discord,slack}.md` | 이미 `plan/in-progress/spec-sync-external-interaction-api-gaps.md:204-210` 에 별도 `[ ]` 항목으로 등재·추적 중 — 추가 조치 불요. 처리 시 "노드가 무엇을 만드나" vs "렌더러가 어디서 읽나" 중 문장 주어를 provider 코드 확인 후 특정할 것 |
| 2 | convention_compliance | `> **정정 (YYYY-MM-DD, ...)**: ~~원문~~` 형태의 correction block 패턴이 최소 4개 이상 spec/conventions 파일에서 반복 사용되지만, 이 표기 스타일 자체를 규정하는 정식 컨벤션 문서가 없음(emergent convention) | `spec/conventions/conversation-thread.md` L390, `spec/5-system/14-external-interaction-api.md` §R17, `spec/5-system/6-websocket-protocol.md` §4.4 | 급하지 않음 — 여유 있을 때 `spec/conventions/`에 정정 표기 스타일을 짧게 codify 하면 향후 작성자 간 형식 편차를 예방 |
| 3 | naming_collision | `output.output.<field>` 표기가 `spec/conventions/node-output.md` §Principle 8.1 이 금지 패턴으로 등재한 `output.output.extracted.*`(핸들러 내부 이중 중첩)와 토큰 형태가 겹침. 다만 두 문서가 가리키는 층위가 다름(핸들러 내부 이중중첩 vs WS wire envelope 래퍼/도메인 구분)이고 양쪽 다 JSDoc·표 셀에서 층위를 명시적으로 구분해 설명 중이라 실제 혼동 위험은 낮음 | `spec/conventions/chat-channel-adapter.md` §1.3, `spec/conventions/node-output.md` §Principle 8.1 | 여유 있을 때 `chat-channel-adapter.md` §1.3 JSDoc 에 두 표기가 다른 층위임을 밝히는 상호 참조 각주 1문장 추가 — CRITICAL/WARNING 사유는 아님 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | HIGH | WS §4.1 `execution.node.failed` `error` 필드 클레임이 전 emit 경로와 모순 → 라이브 `system_error` 재시도 배너 non-functional (CRITICAL). "output 도 함께 실린다" 클레임도 emit 사이트 절반에서만 성립 (WARNING). 직전 라운드(`12_13_36`) CRITICAL(같은 파일 내 미러 누락)은 해소 확인 |
| rationale_continuity | LOW | `#1208` 유예 번복이 취소선 보존 + 새 Rationale 로 3개 문서에 일관 기록됨. C3/R10 등 과거 명시 기각 결정과 충돌 없음. provider spec 3곳 미반영은 트래커에 등재된 의도적 스코프 분리 (INFO) |
| convention_compliance | NONE | Principle 0(SoT)·EIA §R17 13키 allowlist·Rationale ID 컨벤션·테스트 캐너리 네 축 대조 결과 위반 없음. 정정 표기 패턴 미정식화만 INFO |
| plan_coherence | NONE | `spec_impact` 범위와 diff 정확히 일치. 정본 트래커·형제 draft plan 이 동일 사실로 이미 갱신됨. 미해결 결정 우회·후속 항목 누락 없음 |
| naming_collision | NONE | 신규 요구사항 ID·엔티티·endpoint·이벤트명·ENV var·spec 파일 없음. 재인용 식별자 전부 diff 이전부터 실재. `output.output` 토큰 중첩은 층위가 달라 INFO |

## 권장 조치사항

1. **(BLOCK 해소 최우선, planner 턴 필요)** `spec/5-system/6-websocket-protocol.md` §4.1 `execution.node.failed` row 의 "error 는 output.error 전체 구조" 문구를 실측(4개 emit 사이트 전부 string)에 맞게 정정 — §planner 인계 표 참고. 정정 확정 전이라도 아래 2번(codebase 수정)은 developer 권한 내에서 독립적으로 병행 가능.
2. **(developer 권한 내, 병행 가능)** `codebase/frontend/src/lib/websocket/use-execution-events.ts` 의 `handleNodeFailed` 가 `extractNodeErrorPayload(payload.error, payload.output)` 로 `rawOutput` 을 전달하고, `nested` 분기를 `rawOutput.output.error` 2단 접근으로 수정. `handleNodeCompleted` 호출부의 동일 패턴도 함께 점검. `CT-S9`/`CT-S10` fixture 를 실제 backend shape(`error: string`, `output.output.error` 구조화 객체)으로 교체하고 "legacy string" 코멘트 정정.
3. WS §4.1 "output 도 함께 실린다" 문구를 emit 사이트별로 세분화(error-port·AI turn 종결만 해당) — WARNING 해소, 급하지 않음.
4. INFO 3건은 이미 트래커 등재(1번) 또는 급하지 않은 문서 개선 제안(2·3번)으로, 이번 턴 조치 불요.