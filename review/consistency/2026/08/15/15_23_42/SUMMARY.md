# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 정상 응답, CRITICAL 0건)

## 전체 위험도
**LOW** — 실질 코드/spec 변경은 정합적이며 차단 사유 없음. WARNING 2건 + INFO 3건은 cross-reference 누락·문서 앵커 오류 수준.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | §6.5 "DB=wire 해소" 선언의 근거 메커니즘(COALESCE UPDATE + `.returning()`)이 자매 plan(`retry-turn-terminal-guard.md` #4)이 이미 "실 DB 미검증(mock 전용, e2e 0건)"으로 등재해 둔 코드 경로를 그대로 확장한 것인데, `eia-db-wire-invariant.md`가 그 열린 항목(#4)을 인지·참조하지 않음 | `spec/5-system/14-external-interaction-api.md` §6.5 (`execution.cancelled` payload, "(2026-08-15 해소)") | `plan/in-progress/retry-turn-terminal-guard.md` 후속표 #4 (P2, 미해결) | (a) `eia-db-wire-invariant.md`/정본 트래커에 #4 참조 추가 + §6.5 "해소" 문구에 "메커니즘은 mock 검증까지, 실 DB e2e 는 별도 트랙(#4)" 캐비엇 부기, 또는 (b) #4 를 이 PR 범위로 끌어와 실 DB e2e 추가 후 "해소" 확정 |
| 2 | convention_compliance | `§5.4 부재 표현 규약` 링크가 진짜 SoT(`2-api-convention.md#54-...`)가 아니라 같은 문서 자신의 엉뚱한 절("§5.4 명시적 취소 — POST .../cancel")을 가리킴(사전 존재 결함이나 이번 diff가 같은 문구를 반복 사용해 오독 위험 1곳 추가) | `spec/5-system/14-external-interaction-api.md:625` (`### execution.cancelled 의 행동 계약`) | `spec/5-system/2-api-convention.md §5.4` (진짜 SoT) — 같은 문서 line 497/795/1390 은 정확히 링크 | 앵커를 `./2-api-convention.md#54-부재-표현--null-vs-키-생략` 로 정정 (line 497 표기와 동일 패턴) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | web-chat 위젯 SDK 타입 `ExecutionStatus`(spec 이 지정한 코드 SoT)가 신규 `durationMs` 필드를 미러하지 않음 — 기능 파급 없음(현재 아무도 안 읽음), 타입 안전성만 결여 | `codebase/channel-web-chat/src/lib/eia-types.ts` L172-188 vs `spec/5-system/14-external-interaction-api.md` §5.3 | `ExecutionStatus`에 `durationMs?: number | null;` 추가 (backend DTO와 동형) |
| 2 | rationale_continuity | `durationMs` GET status 노출에 R17 급 전용 Rationale 서브섹션 없음(필수는 아님 — §6 기존값 재노출이라 신규 트레이드오프 없음) | `spec/5-system/14-external-interaction-api.md` §5.3/`## Rationale` | (선택) 짧은 R20 포인터로 "durationMs는 §6 재노출, 신규 표면 아님" 명시 |
| 3 | convention_compliance | 신규 `durationMs` 캐비엇 주석의 `§5.4` 참조가 문서-로컬/외부 어느 쪽인지 모호(JSON 코드펜스라 링크 불가) — 코드 쪽 DTO JSDoc은 이미 "API 규약 §5.4"로 명확히 표기, spec만 뒤처짐 | `spec/5-system/14-external-interaction-api.md:487` | `§5.4 부재 표현` → `API 규약 §5.4 부재 표현`으로 문서명 명시 (WARNING #2와 함께 처리) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | web-chat SDK 타입(`eia-types.ts`)이 `durationMs` 미러 누락 (INFO) — 나머지 인접 영역(idempotency 캐시 키, 취소 이벤트 경로, WS `duration` 캐비엇)은 전부 정합 |
| rationale_continuity | NONE | 위반 없음. `finalizeCancelledExecution` 두 차례 정정이 `node-cancellation.md` Rationale에 반증 이력째로 투명 기록된 모범 사례로 확인. durationMs Rationale 포인터 부재는 INFO |
| convention_compliance | LOW | §5.4 앵커 오류(사전 존재, WARNING) + 신규 캐비엇 표기 모호(INFO). 명명/DTO/audit-action/error-code 규약은 전부 준수 확인 |
| plan_coherence | LOW | §6.5 "해소" 선언과 자매 plan(#4 실DB 미검증) 간 cross-reference 누락 (WARNING). 나머지는 정본 트래커와 1:1 대응 확인 |
| naming_collision | NONE | 신규 식별자(`durationMs` 필드, `toPersistedDate` 함수, RETURNING 컬럼명) 전부 충돌 없음. 신규 채널/엔드포인트/이벤트/ENV 없음 |

## 권장 조치사항
1. `retry-turn-terminal-guard.md` #4(실 DB e2e 미검증)를 `eia-db-wire-invariant.md`/정본 트래커에서 참조하고, §6.5 "해소" 문구에 검증 범위 캐비엇을 부기하거나 이번 PR 범위로 e2e를 추가해 "해소" 단정을 근거로 뒷받침 (WARNING #1 해소)
2. `spec/5-system/14-external-interaction-api.md:625`의 `§5.4 부재 표현 규약` 앵커를 `2-api-convention.md#54-...`로 정정하고, line 487 캐비엇도 "API 규약 §5.4"로 명시해 문서명 모호성 제거 (WARNING #2 + INFO #3 동시 해소)
3. (선택) `codebase/channel-web-chat/src/lib/eia-types.ts`의 `ExecutionStatus`에 `durationMs?: number | null;` 추가해 spec 지정 코드 SoT 4개 표면을 동기화 (INFO #1)
4. (선택) `## Rationale`에 durationMs GET status 노출에 대한 짧은 포인터(R17 관행과 대칭) 추가 (INFO #2)