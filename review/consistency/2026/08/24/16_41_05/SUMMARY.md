# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 1건(B3 carve-out 각주가 `node-output.md` Principle 1.1.4 및
`6-websocket-protocol.md` 자신의 C3 Rationale 과 정면 충돌)이 있어 호출자가 차단해야 함.

## 전체 위험도
**HIGH** — 기능 파손(런타임 회귀)은 없으나, 문서 정합화가 목적인 이 PR 자신이 SoT 원칙
(Principle 1.1.4)의 명시적 금지 사유를 부정확하게 재해석해 그 원칙을 사실상 무력화하는
각주를 신설했다. 그 외 발견은 전부 순수 표기 일관성(WARNING)·정보성(INFO) 수준이다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity | B3 carve-out 각주("Principle 1.1.4 는 `{type,data}` wrapper 만 금지, 이름은 무관")가 원칙 원문에 없는 해석으로 `nodeOutput.nodeType` 판별자 재도입을 정당화. 실측(`discord-message.renderer.ts:306-330`)상 `nodeOutput.nodeType` 은 같은 이벤트·같은 노드의 종류를 담는 진짜 중복 판별자이며, 이는 WS 자신의 C3 Rationale("노드 종류는 상위 `payload.nodeType` 로 이미 식별되므로 `nodeOutput` 안의 판별자는 불필요·중복")이 명시적으로 기각한 패턴 그 자체 | `spec/5-system/6-websocket-protocol.md` §4.4, `buttonConfig.nodeOutput` 행 뒤 신규 각주(커밋 `4af06d951`) | `spec/conventions/node-output.md` §1.1.4 (line 112-114, 원문 미갱신) · `6-websocket-protocol.md` 자신의 `## Rationale` C3(2026-06-03) | 각주 논거를 "wrapper 형태 금지" 에서 "레이어 분리"(1.1.4 는 핸들러 반환 `NodeHandlerOutput.output` 을 규율, `nodeOutput.nodeType` 은 wire 조립 레이어가 legacy 렌더러 하위호환을 위해 얹은 값)로 교체. `node-output.md` §1.1.4 본문에도 이 legacy wire-only 예외를 교차 참조로 명시해 원칙의 SoT 자신이 예외를 인정하도록 갱신(이 planner 턴에서 직접 반영 — developer 소정정 대상 아님) |

## planner 인계 (권한 밖 Critical)

> (없음) — target 자체가 planner 턴의 spec 문서 편집물이며, 위 Critical 은 이 세션(project-planner
> 권한 범위인 `spec/**`)에서 직접 정정 가능하다. 별도 developer 관측·권한 밖 사유 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, convention_compliance, naming_collision (중복 3건 통합) | B5 신설 행 `background:run:{runId}` 가 같은 문서 §3.3 형제 행 및 plan 자신이 명시한 결정("브래킷은 그 문서 컨벤션 `{id}`")과 어긋남. `{runId}` 는 spec 전체에서 이 한 곳에만 나타나는 새 토큰 | `spec/5-system/6-websocket-protocol.md` §3.2, line 128 (신설) | 같은 파일 §3.3 line 155(`background:run:{id}`) · `redis-keys.md:84`(`<id>`) · `12-background.md:274`(`<backgroundRunId>`) · `plan/in-progress/planner-doc-batch.md:160` (B5 결정문) | `{runId}` → `{id}` 로 정정해 §3.3 과 문자 그대로 일치시킴. 필요하면 `{id}` 뒤에 "(= `backgroundRunId`)" 괄호 부기 |
| 2 | cross_spec | WS §4.4 신설 각주가 EIA §R17 기존 각주와 같은 대상("대기 표면의 노드-종류 식별자")을 다른 이름(`payload.nodeType` vs `waitingNodeType`)으로 지칭. §4.4 자신의 기존 wire-caveat 블록쿼트가 이미 그 실제 wire 필드명이 `waitingNodeType` 임을 명시 | `spec/5-system/6-websocket-protocol.md` §4.4, line 509-521 (신설 각주) | `spec/5-system/14-external-interaction-api.md` §R17, line 1839-1848 (기존 각주) · `6-websocket-protocol.md` §4.4 자신의 wire-caveat 블록쿼트(line 451) | 신설 각주에 EIA §R17 로의 상호 참조 한 줄 추가, 또는 표 라벨을 `payload.nodeType` 대신 실제 wire 이름 `waitingNodeType` 으로 교체 |
| 3 | convention_compliance | B1 신설 각주("갈래 라벨은 그 상수의 주석과 같은 문구를 쓴다")가 실제로는 `node-output-allowlist.ts` JSDoc(짧은형 `wire 전용 (위젯)`/`(chat-channel)`)과 다르고, 대신 EIA §R17(긴형)과만 일치 — 코드가 아니라 스펙을 베낀 것이라 주장이 부정확 | `spec/conventions/node-output.md` Principle 0 신설 각주 | `codebase/backend/src/shared/utils/node-output-allowlist.ts:47-48,73,78` (실측: 접미어 없는 짧은형, "위젯 파서" 문구 0건) | "그 상수의 주석과 같은 문구" 문장을 "EIA §R17 과 동일 문구(코드 JSDoc 은 접미어 없는 축약형)"로 정정. 값 배열 자체는 정확히 일치하므로 기능 위험은 없음 |
| 4 | rationale_continuity | `node-output.md`/`egress-masking.md`/`chat-channel-adapter.md`/`conversation-thread.md` 4개 conventions 문서의 `## Rationale` 본문이 이번 회차 checker 프롬프트 번들에도 구조적으로 누락(예산과 무관, 후보 선정 자체가 미도달) — 이번 세션은 Read 직접 대조로 우회해 B3 Critical 을 잡았지만, payload 만 소비하는 다른 라운드는 계속 사각지대에 놓임 | `_prompts/rationale_continuity.md` (헤더 76개 중 위 4개 파일 헤더 자체 부재) | 동일 plan 커밋 `74186fd51` 자기진단 · `13_30_49` 회차 동일 CRITICAL 재발 | orchestrator 번들러가 `spec_impact` 목록 파일의 `## Rationale` 을 랭킹·예산 절단과 무관하게 항상 포함하도록 개선(기존 `feedback_consistency_spec_mode_budget.md` 재발 사례에 추가). 단기: plan 검증 기준에 "spec_impact 문서는 매 회차 직접 Read 재확인"을 상시 항목으로 명시 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec, naming_collision (중복 통합) | `wire 전용 (위젯 파서)`/`(chat-channel 렌더러)` 긴형 라벨이 이제 spec 3곳(EIA·node-output.md·WS)에 정착됐으나 코드(`node-output-allowlist.ts`) 는 여전히 짧은형 — target 이 새로 만든 불일치는 아니고 EIA §R17 의 기존 긴형을 정확히 재사용한 결과 | `node-output.md` line 52-55, `6-websocket-protocol.md` line 511-514 vs `node-output-allowlist.ts` line 47-48/73/78 | 액션 불필요(이번 PR 범위 밖). 후속 developer 턴에서 allowlist 코드 JSDoc 라벨을 긴형으로 통일하면 완전 해소 |
| 2 | convention_compliance | `node-output.md` 가 CLAUDE.md 권장 Overview/본문/Rationale 3섹션 구조 없이 각주만 누적(pre-existing, 이번 PR 책임 아님) | `spec/conventions/node-output.md` 전체 | 이번 PR 범위 밖. 다음 대규모 편집 시 별도 plan 항목으로 검토 권장 |
| 3 | plan_coherence | target 의 B1~B7 판정·근거가 정본 트래커 `spec-sync-external-interaction-api-gaps.md` 와 문장 단위로 일치(실측 확인), 2회차 게이트·`/ai-review` 미완료 체크박스도 정확히 미체크 유지, 후속 5건(system_error 배너 CRITICAL 포함)은 target scope 밖으로 명시 분리, `node-output-redesign/**` 등 인접 in-progress plan 과 충돌 없음 | `plan/in-progress/planner-doc-batch.md` 전체 | 조치 불요 — 정합 확인 기록 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | WS §3.2/§4.4 신설 각주 2건이 문서 내부 명명 일관성 원칙을 재현하지 못함(WARNING 2) |
| rationale_continuity | HIGH | B3 각주가 `node-output.md` Principle 1.1.4 + WS 자신의 C3 Rationale 과 정면 충돌(CRITICAL 1) + checker 번들 구조적 갭(WARNING 1) |
| convention_compliance | LOW | B1 각주의 "코드와 동일 문구" 주장 부정확, B5 placeholder 불일치(WARNING 2) |
| plan_coherence | NONE | 트래커·정본 대비 전수 일치, 충돌 없음 |
| naming_collision | LOW | B5 신규 행이 같은 문서 형제 표와 토큰 이름 불일치(WARNING 1) |

## 권장 조치사항
1. (BLOCK 해소 우선) B3 각주의 정당화 논거를 "wrapper 형태만 금지" 에서 "레이어 분리"(핸들러 output vs wire 조립)로 교체하고, `node-output.md` §1.1.4 본문에 legacy wire-only 예외를 교차 참조로 명시 — 이 planner 턴에서 직접 반영.
2. `6-websocket-protocol.md` §3.2 의 `background:run:{runId}` 를 `{id}` 로 정정해 §3.3 형제 행과 일치시킨다(plan 자신의 B5 결정문과도 일치시킴).
3. WS §4.4 신설 각주에 EIA §R17 상호 참조를 추가하거나 표 라벨을 실제 wire 필드명 `waitingNodeType` 으로 교체.
4. `node-output.md` Principle 0 각주의 "그 상수의 주석과 같은 문구" 문장을 "EIA §R17 과 동일 문구(코드 JSDoc 은 축약형)"로 정정.
5. (별도 트래킹) orchestrator 번들러가 `spec_impact` 문서의 `## Rationale` 을 예산 절단과 무관하게 항상 포함하도록 개선 — 반복 재발 항목.