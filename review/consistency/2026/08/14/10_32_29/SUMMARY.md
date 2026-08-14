# Consistency Check 통합 보고서

**BLOCK: YES** — CRITICAL 1건(`turnDebug` 이름 충돌, naming_collision checker)이 발견됨. 단, 이 세션의 실제 코드 diff(`websocket.service.ts` strip 하드닝, `81f2c60d6`) 자체가 만든 문제는 아니며, 근본 원인은 아직 미착수인 planner 턴(§6.2 실측 재작성)의 권한 범위에 있음 — 아래 §planner 인계 참고.

## 전체 위험도
**MEDIUM** — 코드 diff 자체(llmCalls strip depth-agnostic 화)는 spec 과 정합하고 안전한 보안 하드닝이나, 대기 중인 두 plan(`spec-draft-eia-62-waiting-payload.md`, `eia-terminal-payload.md`)의 문서 상태가 실제 커밋·상호 의존 관계를 반영하지 못해 stale 하고, 그 미확정 상태 그대로 다음 planner 턴이 진행되면 spec 에 정식 이름 충돌(`turnDebug` object vs array)이 고착될 위험이 실재한다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | naming_collision | `turnDebug` 필드명이 같은 `execution.waiting_for_input` payload 안에서 두 개의 다른 shape(top-level object `{llmCalls, metadata}` vs `nodeOutput.meta.turnDebug` 배열)를 가리킨다. 다음 planner 턴이 EIA §6.2 를 실측 wire 로 재작성할 때 이 이름을 그대로 spec 에 등재하기로 계획돼 있어, 문서 차원의 정식 이름 충돌로 굳어질 위험 | 소스(코드, 기존): `ai-turn-orchestrator.service.ts:615-623`(top-level, object) vs `ai-conversation-helpers.ts:82-99`(`nodeOutput.meta.turnDebug`, 배열). 향후 target(spec, 미착수): `spec/5-system/14-external-interaction-api.md` §6.2 재작성 예정 | `spec/5-system/6-websocket-protocol.md:449` §4.4 표의 기존 정본 `nodeOutput.meta.turnDebug`(배열) 정의 | planner 턴에서 §6.2 재작성 시 top-level 필드를 리네임(예: `turnDebugSnapshot`) 하거나, §4.2 `resumed` 필드에 이미 쓰인 disambiguation 문구 패턴을 §6.2 예시 옆에 명시 부착 |

## planner 인계 (권한 밖 Critical)

> 위 Critical 은 **현재 세션의 코드 diff(`81f2c60d6`, `websocket.service.ts` strip 하드닝)가 만든 문제가 아니다** — 이 이름 충돌은 기존 코드에 이미 존재했고, 이번 diff 는 오히려 거기서 새는 secret 을 막는 정당한 보안 패치다. 근본 원인은 **아직 착수 전인 planner 턴**(`spec-draft-eia-62-waiting-payload.md` §"변경 제안 (1)" — EIA §6.2 를 실측 wire 로 재작성하며 이 이름을 그대로 옮겨 적기로 계획된 상태)에 있다. developer 세션은 `spec/` 을 read-only 로만 다루므로 이 CRITICAL 을 여기서 해소할 권한이 없다. **등급은 CRITICAL, BLOCK: YES 그대로다** — 아래 표는 차단을 푸는 장치가 아니라 다음 행동을 지정하는 장치다.

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| 1 | 이름 충돌 해소는 `spec/` 쓰기가 필요한 결정(리네임 또는 disambiguation 문구 채택)이며, developer 는 `spec/` read-only | project-planner | `spec/5-system/14-external-interaction-api.md` §6.2 (재작성 시 top-level `turnDebug` 리네임 or disambiguation), 필요 시 `spec/5-system/6-websocket-protocol.md` §4.4 도 상호 참조 갱신 | `plan/in-progress/spec-draft-eia-62-waiting-payload.md` §"🔴 조사 중 발견" → "다음 (별건)"; 원 출처 `review/consistency/2026/08/14/09_38_17/naming_collision.md` |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | 신규 JSDoc/테스트가 미문서화된 top-level `turnDebug` 경로를 정본처럼 명시 인용하기 시작함 (spec 미반영 상태 고착 심화) | `codebase/backend/src/modules/websocket/websocket.service.ts`(+spec test), 커밋 `81f2c60d6` | `spec/5-system/6-websocket-protocol.md` §4.4 필드 테이블(라인 ~188, ~449), `spec/5-system/14-external-interaction-api.md` §6.2 | Critical #1 처리와 함께 §4.4 payload 필드 테이블에 top-level `turnDebug` 를 명시하거나 리네임 결정 반영 |
| 2 | plan_coherence | `spec-draft-eia-62-waiting-payload.md` 의 "처방 후보 (a)(b)(c)" 결정이 이미 커밋 `81f2c60d6`(옵션 (a) 채택)으로 내려졌는데 체크리스트가 갱신되지 않음 | `plan/in-progress/spec-draft-eia-62-waiting-payload.md` §"다음 (별건)"(130~137행), 하단 "## 체크리스트"(150~155행) | (문서 자기정합) | "실증 테스트" 항목 완료 표시, "처방 후보" 항목을 "(a) 채택·커밋 `81f2c60d6`" 로 정정해 체크 |
| 3 | plan_coherence | "이 처방과 함께 정리" 하기로 한 이름 충돌 정리가 실제로는 분리됐는데(strip 패치만 landed) 그 분리가 plan 에 기록되지 않음 | `plan/in-progress/spec-draft-eia-62-waiting-payload.md` 137행 | Critical #1 (동일 이름 충돌) | "다음 (별건)" 에 "이름 충돌 정리는 `81f2c60d6` 에 미포함, 별도 잔여" 메모 추가 + "변경 제안 (1)" 실행 시 리네임을 체크리스트 항목으로 명시 |
| 4 | plan_coherence | `eia-terminal-payload.md` (BLOCK:YES 로 차단 중)의 "다른 plan 과의 관계" 절이, 자신을 실제로 풀어 줄 `spec-draft-eia-62-waiting-payload.md` 를 누락 | `plan/in-progress/eia-terminal-payload.md` "## 다른 plan 과의 관계"(1817~1828행) | `plan/in-progress/spec-draft-eia-62-waiting-payload.md` | `spec-draft-eia-62-waiting-payload.md` 를 "차단 해제 조건(정본 planner draft)" 으로 추가, 체크리스트 "planner 턴" 항목에 경로 링크 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `EXTERNAL_STRIPPED_FIELDS` strip 은 이미 spec 이 "top-level 한정" 없이 깊이 무관 보장을 서술 중이었고, 이번 코드 수정은 그 문서화된 보장을 뒤늦게 따라잡은 것 — 새 모순 아님 | `spec/5-system/6-websocket-protocol.md` §4.4:519, §6.5, `15-chat-channel.md` CCH-MP-01 | (확인 완료, 조치 불요) |
| 2 | cross_spec | `emitNodeEvent` 의 "node 이벤트는 현재 llmCalls 미포함" 전제는 정확히는 "현재 관측된 emit 경로에서는"으로 좁혀 읽어야 하나, strip 자체가 깊이 무관이라 실질 위험 없음 | `websocket.service.ts` | (조치 불요, 코드 review 영역) |
| 3 | rationale_continuity | 보안 버그 수정에 대한 짧은 Rationale addendum 부재 — 필수 아님 | `spec/5-system/6-websocket-protocol.md` `## Rationale` "strip-only 결정" 항목 | "2026-08-14: depth-1 이라 실제 누출 발견·깊이 무관 strip 으로 강화(`81f2c60d6`)" 한 줄 추가 권고 |
| 4 | convention_compliance | §5.4 가 `nullable:true` 패턴 근거로 swagger.md §1-3 만 인용하나 실제 예시는 §1-4 에 있음 | `spec/5-system/2-api-convention.md` §5.4 | 인용을 `§1-3·§1-4` 로 확장 or 문장 분리 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 코드-spec 정합 확인됨(strip 하드닝은 기존 spec 보장을 뒤늦게 충족). top-level `turnDebug` 미문서화가 이번 diff 로 코드 주석 차원에서 더 굳어짐(WARNING) |
| rationale_continuity | NONE | strip-only 결정 번복 아님, 결정 취지에 더 정합시킨 보안 수정. Rationale addendum 은 선택 사항(INFO) |
| convention_compliance | NONE | 실 코드 diff 는 REST DTO 표면 밖이라 명명·Swagger 규약 적용 대상 아님. 인용 절 번호 사소한 부정확(INFO) |
| plan_coherence | MEDIUM | 코드 diff 자체는 CRITICAL 없음이나, 3개 WARNING 전부 "plan 체크박스 = 실제 상태" 원칙 위반(stale plan, 처방 반전 미반영, 교차 참조 누락) |
| naming_collision | MEDIUM(CRITICAL 1건 포함) | 이번 diff 자체는 신규 식별자 충돌 없음(INFO). 단, 대기 중인 plan 이 `turnDebug` 이름 충돌을 그대로 spec 에 옮겨 적을 계획임을 실측 확인 — CRITICAL, planner 인계 대상 |

## 권장 조치사항
1. (BLOCK 해소 우선) **planner 턴 착수**: `spec-draft-eia-62-waiting-payload.md` §6.2 재작성 시 top-level `turnDebug` 를 리네임하거나 명시적 disambiguation 문구를 §6.2 예시 옆에 부착 — Critical #1 해소.
2. `spec-draft-eia-62-waiting-payload.md` 의 "다음 (별건)" 체크리스트를 실제 landed 상태(옵션 (a) 채택·`81f2c60d6`)로 갱신하고, 이름 충돌 정리가 별도 잔여임을 명기.
3. `eia-terminal-payload.md` "다른 plan 과의 관계" 절에 `spec-draft-eia-62-waiting-payload.md` 를 차단 해제 조건으로 추가.
4. (선택) `spec/5-system/6-websocket-protocol.md` `## Rationale` 에 이번 보안 수정 이력 한 줄 addendum.
5. (선택) `spec/5-system/2-api-convention.md` §5.4 인용 절 번호를 `§1-3·§1-4` 로 정정.