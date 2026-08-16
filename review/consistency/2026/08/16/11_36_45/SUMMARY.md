# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**MEDIUM** — `spec/**` 변경 0줄인 좁은 보안 하드닝(EIA 종결 이벤트 `error` 필드 egress 마스킹 신설) PR. Critical 은 없으나, 이 변경이 스스로 만든 spec 문서 갭(§6.4/§R17 마스킹 카탈로그 미반영)과 그 follow-up 이 정본 트래커에 등재되지 않은 WARNING 2건이 남아 있다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W1 | cross_spec, plan_coherence | 신규 egress 마스킹(`toTerminalErrorPayload`/`redactTerminalError` → `Execution.error`)이 EIA §6.4 정본 필드 표·§R17 마스킹 카탈로그에 반영되지 않음. 관련 follow-up 도 로컬 plan(`eia-terminal-error-sanitize.md` "후속")에만 남고 정본 트래커(`spec-sync-external-interaction-api-gaps.md`)에는 등재되지 않음 | `spec/5-system/14-external-interaction-api.md` §6.4(L770-806), §R17(L1414-1457) | 같은 파일의 R17 기존 3개 마스킹 불릿 선례(`conversationThread`/`ai_message`/`nodeOutput.conversationConfig`), "이 표가 전부다" 자기 선언(L568-569, L836) | `project-planner` 턴: §6.4 필드표 + §R17 에 5번째 caveat/불릿(`Execution.error` egress 마스킹, 잔여 갭 명시) 추가. 동시에 `spec-sync-external-interaction-api-gaps.md` 에 이 follow-up 을 정본 bullet 으로 신설(로컬 plan 참조만 남기지 않기) |
| W2 | convention_compliance | `interaction.triggerToken` 이 `SecretResolver` 를 경유하지 않고 JSONB 평문 보관 (선존 위반, 이번 라운드 재확인) | `spec/5-system/14-external-interaction-api.md` §7.1(L903) | `spec/conventions/secret-store.md` Overview — "모든 도메인 모듈은 `SecretResolver` 를 경유" | `project-planner` 턴 택일: (a) `secret://triggers/{triggerId}/interaction-token` 슬롯으로 이관 + 구현 plan 신설, 또는 (b) `secret-store.md §1` 비대상 절에 명시적 예외로 등재하고 근거를 Rationale 에 기록 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I1 | cross_spec | 동일 `Execution.error` 가 내부 REST(`GET /api/executions/:id`, 비마스킹)와 내부 WS(`execution.failed`, 마스킹) 사이에서 값이 갈릴 수 있음 — 비대칭 미문서화 | `executions.service.ts:862` vs 신규 `toTerminalErrorPayload` 경로 | 의도된 trade-off 면 R17/§6.4 caveat 옆에 한 줄 명시(R17 의 `llmCalls` 비대칭 선례와 동형). 의도치 않았다면 `developer` 턴에서 REST 응답도 `redactTerminalError` 적용 검토 |
| I2 | plan_coherence | `eia-terminal-emit-facade.md` 체크리스트 마지막 3항목이 `[ ]`로 남아 있으나 해당 작업(#1174, `8e0728a90`)은 이미 머지됨 — 이미 별도 턴으로 인지·기록됨 | `plan/in-progress/eia-terminal-emit-facade.md` | 별도 턴에서 체크박스 갱신 + `plan/complete/` 이동(이미 계획대로) |
| I3 | rationale_continuity, convention_compliance | W1 의 R17/§6.4 카탈로그 갭은 신규 발견이 아니라 이미 `eia-terminal-error-sanitize.md` "후속" 절에 추적 항목으로 존재(다만 정본 트래커 미등재는 W1 로 별도 지적) | `plan/in-progress/eia-terminal-error-sanitize.md` | W1 처리 시 함께 해소, 별도 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | `spec/**` 변경 0줄. §6.4/R17 마스킹 카탈로그 미반영(WARNING, W1) · REST/WS 값 비대칭 미문서화(INFO, I1) |
| rationale_continuity | LOW | R17 "egress-only masking" 원칙을 정확히 준수, 기각된 대안 재도입·무근거 번복 없음. 카탈로그 갭은 이미 추적됨(INFO) |
| convention_compliance | LOW | 이번 diff 가 여는 규약 표면 거의 없음. 선존 `secret-store.md` 위반(`interaction.triggerToken`) 재확인(WARNING, W2). R17 갭은 교차 참조(INFO) |
| plan_coherence | MEDIUM | masking 위치·범위 결정은 정본 트래커 처방을 그대로 집행(정합). 다만 이번에 새로 생긴 follow-up 이 정본 트래커에 미등재(WARNING, W1) |
| naming_collision | NONE | 신규 식별자는 module-private `redactTerminalError` 1개뿐, 전역 유일 정의로 충돌 없음 |

## 권장 조치사항
1. `project-planner` 턴: `spec/5-system/14-external-interaction-api.md` §6.4 필드 표 + §R17 마스킹 카탈로그에 5번째 egress 지점(`Execution.error` → `toTerminalErrorPayload`/`redactTerminalError`) 추가.
2. `project-planner` 턴: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 위 follow-up 을 정본 bullet 으로 신설(로컬 plan 에만 남기지 않기).
3. `project-planner` 턴: `interaction.triggerToken` 의 `secret-store.md` 준수 여부 택일 — SecretResolver 슬롯 이관 또는 명시적 예외 등재.
4. (선택) 내부 REST vs WS 종결 이벤트 마스킹 비대칭을 R17/§6.4 caveat 로 문서화하거나, 의도치 않았다면 REST 경로도 마스킹 적용 검토.
5. (이미 계획됨) 별도 턴에서 `eia-terminal-emit-facade.md` 체크리스트 갱신 + `plan/complete/` 이동.