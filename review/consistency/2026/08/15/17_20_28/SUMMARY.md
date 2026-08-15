# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (WARNING 4건, INFO 4건)

## 전체 위험도
**LOW** — target(`spec/5-system/14-external-interaction-api.md`, --impl-prep)은 최근 여러 라운드 정합화를 거쳐 대부분 정합. 실질 위반은 문서 정정/명명 정리 수준의 WARNING 뿐이며, plan_coherence 가 지적한 소유권 교차참조 누락 1건이 실행 순서 리스크가 가장 크다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | `eia-terminal-emit-facade.md` 가 `retry-turn.service.ts:989`(`failRetryExecution`)의 `cancelledBy` 누락 결함을 이관 대상 11곳 중 하나로 건드리면서도, 이미 이 결함의 집행처로 명시 위임된 `retry-turn-terminal-guard.md` #2 를 참조하지 않는다 | `spec/5-system/14-external-interaction-api.md` §6 `result.cancelledBy` 행 ("경로 1곳 누락 \| retry-turn-terminal-guard #2") | `plan/in-progress/retry-turn-terminal-guard.md` #2 (P2, 미해결) / `plan/in-progress/spec-draft-eia-notification-payload-contract.md` 의 명시적 위임 역포인터 | `eia-terminal-emit-facade.md` "다른 plan 과의 관계"/"조치" 절에 `retry-turn-terminal-guard.md` #2 흡수를 명시하고, `retry-turn.service.ts:989` cancelled 분기의 `cancelledBy: 'user'` 값을 확정. 구현 완료 시 같은 커밋에서 그 plan #2 체크 + target §6 "경로 1곳 누락" 각주 제거를 동시 수행 |
| 2 | cross_spec | `notification_url_allow_pattern` 워크스페이스 설정 필드가 `1-data-model.md` §2.2 `Workspace.settings` SoT 인벤토리에 미등재된 채 "구현됨"처럼(다른 미구현 항목과 달리 "미구현 (Planned)" 표기 없이) 서술 | §8.1 SSRF 방지, §3.1 EIA-NX-10 | `spec/1-data-model.md` §2.2 `Workspace.settings` known-keys (camelCase 3종만 등재) | `1-data-model.md` §2.2 에 정식 등재(camelCase 로 통일) 또는 target 에 "미구현 (Planned)" 표기 추가 |
| 3 | cross_spec | outbound 서명 알고리즘 내부 저장 필드명(`hmacAlgorithm: 'sha256'`, EIA-NX-03)이 §7.1 자신의 JSONB 예시(`signing.algorithm: 'hmac-sha256'`)와 자기모순이며, `12-webhook.md` 가 V066 로 폐기 선언한 inline 필드명과 동일 이름을 재사용 | §3.1 EIA-NX-03 vs §7.1 Trigger 엔티티 JSONB 예시 | `spec/5-system/12-webhook.md` §167/§481~488 (`hmacAlgorithm` 폐기 명시) | EIA-NX-03 서술을 §7.1 실제 스키마에 맞춰 정정, 또는 별도 필드명(`notificationSigningAlgorithm`) 채택 후 양쪽 동기화 |
| 4 | naming_collision | 신규 타입 `TerminalEmitPayload` 가 기존 `TerminalErrorPayload` 와 한 단어 차이로 유사(포함 관계이나 이름에서 안 드러남) | plan 설계 `emitTerminalExecutionEvent(executionId, payload: TerminalEmitPayload)` | `codebase/backend/src/shared/utils/terminal-error-payload.ts:36` `TerminalErrorPayload` | 구현 시 `TerminalEventPayload`/`TerminalExecutionEmitPayload` 등 포함관계가 드러나는 이름 검토 또는 JSDoc 으로 관계 명시 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | §11 WS↔REST 명령 매핑 표가 권위 표(WS §4.6)의 부분집합만 미러링(3행 누락: `retry_last_turn`/`auth.refresh`/`subscribe`,`unsubscribe`) | §11 표 vs `6-websocket-protocol.md` §4.6 | 누락 3행 추가 또는 "본 표는 EIA 활성 명령만 발췌, SoT 는 WS §4.6" 캐비엇 명시 |
| 2 | rationale_continuity | `durationMs` 구현 완료가 신규 `## Rationale` 항목 없이 §6 인라인 각주로만 기록 — 단, 이는 2026-08-14 `error` object 일원화와 동일한 기존 문서 관행이라 위반 아님 | §6 `durationMs` 행, §6.5 | 조치 불요(참고) |
| 3 | rationale_continuity | 취소 경로 수치 표기 불일치("6곳 중 4곳" §6.5 vs "5경로" §6 표) — 모수가 다를 가능성, 확정 불가 | §6.5 vs §6 필드 집합 표 | 구현 착수 시 실코드(`terminal-duration.ts`) 대조로 두 수치가 같은 집합인지 확정하고 표기 통일 |
| 4 | naming_collision | `emitTerminalExecutionEvent` 와 기존 `emitExecution` 이름 유사(계층 관계, 의도된 설계) | plan 신규 메서드 vs `execution-event-emitter.service.ts:37` | JSDoc 에 "종결 이벤트 전용, 그 외는 `emitExecution` 직접 호출" 명시 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 20여 교차참조 실측 대조 정합 확인. WARNING 2건(설정 필드 미등재, 서명 필드명 자기모순) + INFO 1건(WS 매핑 표 부분집합) |
| rationale_continuity | LOW | R1~R19 등 기존 Rationale 전부 유지·정합. INFO 2건(각주 관행 확인, 수치 표기 불일치) |
| convention_compliance | NONE | Redis 키·에러코드·감사액션·swagger·frontmatter·문서구조 5관점 전수 대조, 위반 0건 |
| plan_coherence | MEDIUM | `eia-terminal-emit-facade.md` 가 `retry-turn-terminal-guard.md` #2 소유 결함을 같은 턴에 건드리면서 교차참조 누락 — 실행 순서 충돌 위험 |
| naming_collision | LOW | 요구사항ID/endpoint/env/엔티티명 실충돌 0건. WARNING 1건(`TerminalEmitPayload` vs `TerminalErrorPayload` 유사) + INFO 1건 |

## 권장 조치사항
1. (최우선) `eia-terminal-emit-facade.md` 에 `retry-turn-terminal-guard.md` #2 교차참조를 추가하고, `retry-turn.service.ts:989` 의 `cancelledBy` 값을 확정 — 구현 완료와 동시에 두 plan/spec 각주를 함께 갱신해 stale 화 방지 (plan_coherence #1).
2. 구현 시 신규 타입명을 `TerminalEmitPayload` 대신 포함관계가 드러나는 이름으로 채택 (naming_collision #1).
3. `spec/1-data-model.md` §2.2 에 `notification_url_allow_pattern` 등재 또는 target 에 Planned 표기 추가 (cross_spec #1).
4. EIA-NX-03 outbound 서명 필드명을 §7.1 실제 스키마와 동기화, 폐기된 `hmacAlgorithm` 재사용 회피 (cross_spec #2).
5. (선택) §11 WS↔REST 매핑 표에 누락 3행 추가 또는 subset 캐비엇 명시; 취소 경로 수치("6곳 중 4곳" vs "5경로") 실코드 대조로 통일.