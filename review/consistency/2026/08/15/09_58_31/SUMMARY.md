# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 CRITICAL 0건)

## 전체 위험도
**MEDIUM** — cross_spec 이 지적한 `durationMs` nullable 타입 drift(2곳 TS 선언)와 plan_coherence 가 지적한 자매 트래커 2곳 미동기화가 실질 위험의 대부분. convention_compliance 의 JSON 예시 콤마 누락도 normative SoT 절의 구문 오류라 실무 영향이 있음.

## Critical 위배 (BLOCK 사유)

(없음 — 5개 checker 모두 CRITICAL 0건)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `durationMs` 의 "키 항상 존재·값 `null` 가능" 계약이 TS 타입 선언 2곳에 미반영(`durationMs?: number`, optional/non-nullable) | `spec/5-system/14-external-interaction-api.md` §6 필드 집합 표(575행) | `spec/conventions/chat-channel-adapter.md` §1.2 `EiaEvent` union 3 variant + `codebase/backend/src/modules/chat-channel/types.ts:392,410,423` `EiaCompletedEvent`/`EiaFailedEvent`/`EiaCancelledEvent` | 6곳 모두 `durationMs?: number` → `durationMs: number \| null` 로 정정. 직전 PR `error.code`/`nodeId` 와 동일 패턴 재발이므로 `eia-terminal-payload.md` 후속 체크리스트에 등재 |
| 2 | plan_coherence | `durationMs` Planned→구현됨 전환이 "정본" 자매 트래커 2곳에 미반영(4번째 재발 패턴) | `spec/5-system/14-external-interaction-api.md` §6/§6.3/§6.4/§6.5 | `plan/in-progress/spec-sync-external-interaction-api-gaps.md` L22-28(체크박스 미체크) · `plan/in-progress/spec-draft-eia-notification-payload-contract.md` L108(표 행 `미구현 (Planned)` 잔존)+L187-189(미체크) | (1) `spec-sync-...` L22-28 체크박스 `[x]` + 완료 근거 커밋 SHA 기재. (2) `spec-draft-eia-notification-payload-contract.md` L108 표를 `구현됨`으로 갱신, L187-189 `[x]` |
| 3 | convention_compliance | 정규(normative) JSON 예시 2곳에 콤마 누락 — 그대로 두면 파싱 불가 | `spec/5-system/14-external-interaction-api.md` §6.3(`"status": "completed"` 뒤)·§6.4(`error` 객체 닫는 `}` 뒤) | §6 도입부 "이 절이 outbound 이벤트 계약의 SoT" 선언, §6.2 의 비-literal 면책 각주 부재 | §6.3: `"status": "completed",` / §6.4: `error` 를 닫는 `    },` 로 콤마 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | (기지 재확인) `15-chat-channel.md` 가 `InteractionRequestContext` 를 단일 인터페이스+optional 로 서술, EIA §3.3.1 discriminated union 과 형태 불일치 | `spec/5-system/15-chat-channel.md:319,507` vs EIA §3.3.1 | planner 턴에서 EIA §3.3.1 포인터로 교체 (이미 `spec-sync-external-interaction-api-gaps.md` 등재됨) |
| 2 | cross_spec | (기지 재확인) `12-webhook.md` 를 "legacy statusCode/errors shape" 로 대비하나 이미 표준 형식으로 정합화되어 대비 문구가 실체 없음 | `spec/5-system/14-external-interaction-api.md:317` | "legacy" 문구 제거 또는 정정 (이미 등재됨) |
| 3 | cross_spec | (기지 재확인) `EIA-AU-09` dangling 참조 (EIA §3.3 은 `EIA-AU-01~08`까지만 정의) | `spec/data-flow/15-external-interaction.md:119` | `EIA-AU-09` 제거 또는 실제 ID로 교체 (이미 등재됨) |
| 4 | rationale_continuity | plan 이 "동반 변경 대상"으로 지목한 시퀀스 다이어그램이 이번 diff 에서 미편집(결과적으로 거짓은 아니나 신규 caveat 미반영) | `spec/data-flow/3-execution.md:111` | SoT 포인터 캐비엇 추가 또는 plan 에 "액션 불요" 사유 명시 |
| 5 | plan_coherence | `eia-terminal-payload.md` 자신의 `### 다음 PR (이연)` 체크박스·`## 체크리스트` 가 이번 durationMs 구현 라운드 미반영 | `plan/in-progress/eia-terminal-payload.md` L199, L292-323 | L199 `[x]`, 체크리스트에 durationMs 라운드 항목 추가 |
| 6 | plan_coherence | `retry-turn-terminal-guard.md` #2 의 줄 번호 인용이 이번 diff 로 stale (emit 블록 위치 이동) | `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` `failRetryExecution` | 우선순위 낮음 — 착수 시 자연히 갱신되거나 심볼 참조로 전환 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | MEDIUM | `durationMs` nullable 계약이 TS 타입 선언 2곳(6개 위치)에 미반영 — `error.code`/`nodeId` 와 동일 drift 패턴 재발 |
| rationale_continuity | LOW | CRITICAL/WARNING 없음. Planned→구현 전환이 "해소" 보존 관행을 정확히 따름을 확인. INFO 1건(다이어그램 미갱신)만 |
| convention_compliance | LOW | JSON 예시 2곳 콤마 누락(WARNING). null 부재표현·Re-run 경로 정정은 규약 정합 확인 |
| plan_coherence | MEDIUM | 자매 트래커 2곳(`spec-sync-...`, `spec-draft-...`) 체크박스/표 미동기화 — 동일 plan 문서가 이미 3회 자인한 패턴의 4번째 재발 |
| naming_collision | NONE | 신규 식별자 충돌 없음(6개 관점 전수 확인) |

## 권장 조치사항
1. (WARNING #3, BLOCK 무관이나 즉시 저비용) `spec/5-system/14-external-interaction-api.md` §6.3/§6.4 JSON 예시 콤마 2곳 수정 — 구문 파싱 가능하게.
2. (WARNING #1) `chat-channel-adapter.md` `EiaEvent` union 3곳 + `types.ts` 3개 인터페이스의 `durationMs?: number` 를 `durationMs: number | null` 로 정정.
3. (WARNING #2) `spec-sync-external-interaction-api-gaps.md` L22-28, `spec-draft-eia-notification-payload-contract.md` L108/L187-189 체크박스·표를 이번 구현과 동기화.
4. (INFO 일괄) `eia-terminal-payload.md` 자체 체크리스트를 이번 라운드로 갱신하고, 남은 INFO 3건(15-chat-channel.md 형태 불일치·webhook legacy 문구·EIA-AU-09 dangling)은 다음 planner 턴에서 일괄 정정 권장.