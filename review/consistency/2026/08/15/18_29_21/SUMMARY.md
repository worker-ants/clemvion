# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. WARNING 6건(교차 문서 갱신 누락·명명 근접·필드명 자기모순 등)만 존재하며 모두 이번 작업(종결 이벤트 emit 타입 파사드화)을 차단할 사유는 아님.

## 전체 위험도
**LOW** — cross_spec/convention_compliance/naming_collision 은 LOW, plan_coherence 만 MEDIUM(교차 plan 갱신 누락 2건). Critical 없음.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | outbound HMAC 서명 알고리즘 내부 저장 필드명이 §7.1 자신의 JSONB 예시와 자기모순이며, `12-webhook.md` V066 이 폐기 선언한 필드명(`hmacAlgorithm`)을 재사용 (직전 라운드 승계, 미해결) | `spec/5-system/14-external-interaction-api.md` §3.1 EIA-NX-03 vs §7.1 예시 | `spec/5-system/12-webhook.md` §167 (V066 inline auth 필드 폐기) | EIA-NX-03 괄호 서술을 §7.1 실제 스키마(`signing.algorithm: 'hmac-sha256'`)에 맞춰 정정. bare-form 이 필요하면 다른 식별자명 사용 |
| 2 | cross_spec | `notification_url_allow_pattern` 워크스페이스 설정 필드가 SoT 인벤토리에 미등재된 채 실재하는 것처럼 서술 (직전 라운드 승계, 미해결) | `14-external-interaction-api.md` §8.1, §3.1 EIA-NX-10 | `spec/1-data-model.md` §2.2 `Workspace.settings` known-keys 인벤토리 (미등재, 코드 구현 흔적도 없음) | `1-data-model.md` §2.2 에 정식 등재하거나, 미구현이면 target 에 "미구현 (Planned)" 표기 추가 |
| 3 | rationale_continuity | `cancelledBy: 'user'` 하드코딩의 causal 부정확성 한계를 "별도 항목으로 등재한다"고 plan 에 적었으나 실제로 등재되지 않음 | `plan/in-progress/eia-terminal-emit-facade.md:27-38` vs `retry-turn.service.ts:981-995` | `spec/5-system/14-external-interaction-api.md` §6.5 (닫힌 3값 union의 causal 계약) | (a) `spec-sync-external-interaction-api-gaps.md` 에 후속 항목 실제 등재, 또는 (b) 이 한계를 spec `## Rationale` 각주로 승격 |
| 4 | rationale_continuity | 동일 한계가 spec §6 표·CHANGELOG 에는 캐비엇 없이 "완전 해소"로만 전파됨 | `14-external-interaction-api.md` §6 표 `result.cancelledBy` 행, `CHANGELOG.md` 신규 절 | 위 §6.5 causal 계약 | 위 WARNING(3)의 (b) 적용 시 함께 해소. 최소한 표 비고에 "동시 시스템 취소 레이스에서 `'user'` 로 근사될 수 있음" 한 줄 추가 |
| 5 | convention_compliance | `14-external-interaction-api.md` frontmatter `code:` 가 §6 wire 조립을 사실상 전담하게 된 `execution-event-emitter.service.ts` 를 가리키지 않음 | `14-external-interaction-api.md` frontmatter `code:` | `spec/conventions/spec-impl-evidence.md` §2.1, R-1 | frontmatter `code:` 에 `execution-engine/events/execution-event-emitter.service.ts`(필요시 `execution-engine.service.ts`/`retry-turn.service.ts`)추가 |
| 6 | plan_coherence | `cancelledBy` 해소가 "동시 갱신 대상"으로 명시 지목된 다른 두 plan(`spec-draft-eia-notification-payload-contract.md`, `backend-lint-gate-broken-on-main.md`)에 반영되지 않아 stale "미완료" 서술 잔존 | `spec-draft-eia-notification-payload-contract.md:106,212-213`, `backend-lint-gate-broken-on-main.md:786-791` | `plan/in-progress/eia-terminal-payload.md:283-292` (동시 갱신 예고), `retry-turn-terminal-guard.md` #2(완료) | 두 문서의 해당 표/체크박스를 해소 사실로 갱신하거나 완료 항목을 가리키는 각주 추가 |
| 7 | plan_coherence | "별도 항목으로 등재한다"는 plan 자신의 약속이 실제로 등재되지 않음 (WARNING 3과 동일 사실, 다른 checker 관점 — 같은 정본 트래커가 이 세션 내에서 이미 한 차례 자백한 패턴의 재발) | `eia-terminal-emit-facade.md:36-38` | `spec-sync-external-interaction-api-gaps.md` (정본 트래커, grep 0건) | 실제 등재하거나 "등재한다"→"등재가 필요하나 아직 하지 않았다"로 문구 정정 |
| 8 | naming_collision | 신규 `emitTerminalExecution` 이 기존 `emitTerminalExecutionMetrics`(#600, NF-OB-07 메트릭 전용, 무관 기능)와 접두어 거의 동일, 같은 파일에 공존 | `execution-event-emitter.service.ts:104` (`emitTerminalExecution`) | `execution-engine.service.ts:8732` (`emitTerminalExecutionMetrics`) | 양쪽 JSDoc 에 상호 참조("Not to be confused with...") 한 줄 추가. 시그니처가 달라 컴파일 타임 오용 불가 — 이름 변경은 불요 |

> WARNING #3 과 #7 은 동일 사실(등재 미이행)을 rationale_continuity 와 plan_coherence 가 각자 관점에서 지적한 중복 발견이나, 근거 각도가 달라(Rationale 연속성 vs plan 간 정합) 표에서는 분리 유지. 조치는 1건으로 해소 가능.

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | §11 WS↔REST 명령 매핑 표가 권위 표(WS §4.6)의 부분집합만 미러링 (직전 라운드 승계, 미해결) | `14-external-interaction-api.md` §11 vs `5-system/6-websocket-protocol.md` §4.6 | 누락 3행 추가 또는 "완전한 목록은 WS §4.6 이 SoT" 캐비엇 명시 |
| 2 | cross_spec | 이전 라운드 WARNING(`TerminalEmitPayload`↔`TerminalErrorPayload` 혼동 우려)이 이번 구현에서 해소됨 확인 | `execution-event-emitter.service.ts` (`TerminalEventPayload` 명명 + JSDoc 명시) | 조치 불요 |
| 3 | naming_collision | `TerminalEventPayload` vs 기존 `TerminalErrorPayload` 한 단어 차이 — 코드 JSDoc 이 이미 자체 인지·문서화한 의도적 트레이드오프 | `execution-event-emitter.service.ts:31` | 현행 유지 가능. 필요시 `TerminalEmitPayload`/`TerminalWirePayload` 대안 고려(필수 아님) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 이번 diff(§6 표 1줄) 자체는 코드와 정합. 직전 라운드 승계 WARNING 2건(HMAC 필드명 자기모순, `notification_url_allow_pattern` 미등재) 미해결 상태로 유효 |
| rationale_continuity | LOW | 종결 이벤트 파사드는 R10 단일 sink·§6.5 닫힌 union·부재 표현 규약 모두 준수. `cancelledBy: 'user'` causal 부정확성의 후속 등재 약속 미이행 |
| convention_compliance | LOW | §6/§5.4 규약을 코드·신규 테스트 양쪽에서 정확히 재현. frontmatter `code:` 글로브가 새 구현 소재를 못 가리키는 pre-existing 부정확성 1건 |
| plan_coherence | MEDIUM | 정본 트래커·흡수 대상 plan 간 정합은 양호하나, 명시적으로 예고된 동시 갱신 대상 plan 2곳에 stale 서술 잔존 + 등재 약속 미이행 |
| naming_collision | LOW | 신규 식별자 2개(`TerminalEventPayload`/`emitTerminalExecution`) 모두 요구사항ID·API·이벤트명·ENV var 차원 충돌 없음. 코드 레벨 명명 근접 1건(컴파일 타임 안전) |

## 권장 조치사항
1. (BLOCK 해소 사유는 없으나 우선 권장) `plan/in-progress/spec-draft-eia-notification-payload-contract.md`(§표, 체크박스) 와 `plan/in-progress/backend-lint-gate-broken-on-main.md`(786-791행)의 `cancelledBy` 관련 stale "미완료" 서술을 이번 PR 의 해소 사실로 갱신한다.
2. `cancelledBy` causal 부정확성(`'user'` 하드코딩이 실제 timeout/system 취소를 오분류할 수 있음) 후속 개선을 `spec-sync-external-interaction-api-gaps.md` 에 실제로 등재하거나, spec `14-external-interaction-api.md` §6 근처 `## Rationale`/표 비고에 한계를 명시한다.
3. `emitTerminalExecution` / `emitTerminalExecutionMetrics` 양쪽 JSDoc 에 상호 참조 한 줄을 추가해 grep 상 오인을 방지한다.
4. (경미) `14-external-interaction-api.md` frontmatter `code:` 에 `execution-event-emitter.service.ts` 를 추가해 §6 구현 소재 추적성을 높인다.
5. (직전 라운드 승계, 이번 작업 범위 밖이나 별도 정리 권장) EIA-NX-03 의 HMAC 필드명 자기모순, `notification_url_allow_pattern` SoT 미등재 — 별도 문서 정정 세션에서 처리.