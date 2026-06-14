# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 불필요.

## 전체 위험도
**LOW** — 기능 오동작·계약 모순 없음. 카탈로그 동기화 누락·문서 구조 개선 사항(WARNING 4건) + 참고(INFO 8건)만 존재.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W1 | Cross-Spec | 신규 WS ack 에러 코드 2개(`EXECUTION_INTERNAL_ERROR`, `EXECUTION_MESSAGE_TOO_LONG`)가 공용 카탈로그에 미등재 | `spec/5-system/4-execution-engine.md §7.5.2` / `spec/5-system/6-websocket-protocol.md §4.2` | `spec/5-system/3-error-handling.md §1.5` WS commands 에러 코드 카탈로그 | `3-error-handling.md §1.5` 표에 두 행 추가 (각 행에 SoT 참조 명시) |
| W2 | Convention Compliance | 섹션 번호 순서 역전 — §1.3이 §1.2 앞, §3.3이 §3.4 뒤 배치 | `spec/5-system/4-execution-engine.md` §1 및 §3 | spec 번호 체계 암묵 규약 (번호 순서 = 읽기 순서) | §1.2·§1.3 물리적 위치 교환; §3.3을 §3.4 앞으로 이동 (번호 재부여 불필요) |
| W3 | Convention Compliance | `## Overview` 섹션 부재 — 문서 3섹션 구성 미준수 | `spec/5-system/4-execution-engine.md` 전체 구조 | CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" | `## 1.` 앞에 `## Overview` 추가 (범위 요약·관련 SoT 책임 경계·구현 상태 설명) |
| W4 | Plan Coherence | `pending_plans`에 완료된 plan 2건이 `in-progress/` 경로로 stale 참조 | `spec/5-system/4-execution-engine.md` frontmatter `pending_plans:` (lines 30–35) | `plan/complete/spec-sync-resume-dispatch-registry.md`, `plan/complete/spec-update-execution-context-options-bag.md` | `pending_plans:`에서 두 항목 제거 (해당 plan은 `complete/`로 이미 이동 완료) |

> W1과 Naming-Collision checker의 INFO-3은 동일 카탈로그 미등재 이슈 — W1로 통합.

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I1 | Cross-Spec | `conventions/error-codes.md`에 신규 코드 2개 미언급 (문서화 gap) | `spec/5-system/4-execution-engine.md §7.5.2` | 최소 조치: 의미 기반 원칙(§1) 준수 명확하므로 별도 등재 불필요. 원할 경우 §5 형식으로 도입 배경 메모 추가 |
| I2 | Cross-Spec | `EXECUTION_MESSAGE_TOO_LONG`의 EIA REST 진입점 에러 표현 미정의 | `spec/5-system/6-websocket-protocol.md §4.2` | EIA §5 에러 코드 표에 메시지 길이 초과 행 추가, 또는 WS §4.2에 "WS 진입점 전용 — EIA 경로 결정 대기" 주석 추가 |
| I3 | Convention Compliance | `NodeHandlerOutput.status` 타입이 `string`으로 과도하게 느슨 (JSDoc에 '등' 얼버무림) | `spec/5-system/4-execution-engine.md §5.1` L494-496 | JSDoc을 닫힌 enum 전체 열거형(`waiting_for_input \| resumed \| ended \| requires_integration \| requires_playwright`)으로 교체 |
| I4 | Convention Compliance | `interaction.data`의 `form_submitted` 행에 `via?: 'ai_render'` sentinel 누락 | `spec/5-system/4-execution-engine.md §1.3` | `node-output.md §4.5`와 동기화해 `{ [fieldName]: value, via?: 'ai_render' }`로 갱신, 또는 "상세: node-output §4.5 참조" 주석으로 의도 명시 |
| I5 | Convention Compliance | `WORKER_HEARTBEAT_TIMEOUT` 의미 재정의 후 `error-codes.md §3` Historical-artifact 예외 레지스트리 미등재 | `spec/5-system/4-execution-engine.md §7.1`, §9.2 | `spec/conventions/error-codes.md §3`에 등록 (이름 부정확 이유·진실·근거 명시) |
| I6 | Naming Collision | `INTERNAL_ERROR`(WsErrorCode, WS §7.1) vs `EXECUTION_INTERNAL_ERROR`(ErrorCode, §7.5.2) — scope 구분 미명시로 독자 혼동 가능 | `spec/5-system/6-websocket-protocol.md §7.1` | §7.1 표 `INTERNAL_ERROR` 행에 "(`WsErrorCode` — retry_last_turn 전용, `EXECUTION_INTERNAL_ERROR`와 별개)" 주석 추가 |
| I7 | Naming Collision | `ExecutionError`(신규 추상 기반 클래스) vs `CodeExecutionError`(기존 Code 노드 내부 인터페이스) — 실질 충돌 없으나 prefix 유사 | `spec/5-system/4-execution-engine.md §7.5.2` / `codebase/backend/src/nodes/data/code/code.handler.ts` L129 | 실질 충돌 없으므로 그대로 진행 가능. `CodeExecutionError`는 non-export 내부 타입이므로 namespace 분리 충분 |
| I8 | Plan Coherence | `execution-engine-typed-errors.md`의 "선행 의존" 항목이 이번 spec 변경으로 해소됐으나 plan에 미반영 | `plan/in-progress/execution-engine-typed-errors.md` | "선행 의존" 항목에 "(spec 반영 완료 2026-06-14)" 추가; "결정 필요" 항목 1~4를 `[x]` 완료 체크로 전환 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | 신규 WS ack 코드 2개가 `3-error-handling.md §1.5` 공용 카탈로그에 미등재 (W1); EIA REST 매핑 미정의 (I2) |
| Rationale Continuity | NONE | 기각된 대안 재도입·원칙 위반 없음. 신규 Rationale 4개 결정점 모두 기존 합의와 정합 |
| Convention Compliance | LOW | 섹션 번호 순서 역전 (W2), `## Overview` 부재 (W3), `WORKER_HEARTBEAT_TIMEOUT` §3 미등재 (I5) |
| Plan Coherence | LOW | `pending_plans` stale 참조 2건 (W4); `execution-engine-typed-errors.md` 선행 의존 미갱신 (I8) |
| Naming Collision | LOW | `INTERNAL_ERROR` vs `EXECUTION_INTERNAL_ERROR` scope 미명시 (I6); 나머지 신규 식별자는 충돌 없음 |

## 권장 조치사항

1. **(W4 — 즉시)** `spec/5-system/4-execution-engine.md` frontmatter `pending_plans:`에서 `spec-sync-resume-dispatch-registry.md`·`spec-update-execution-context-options-bag.md` 두 항목 제거. `spec-impl-evidence.md §3` guard 실패 방지.
2. **(W1 — 높은 우선순위)** `spec/5-system/3-error-handling.md §1.5` 표에 `EXECUTION_INTERNAL_ERROR`·`EXECUTION_MESSAGE_TOO_LONG` 두 행 추가 (SoT: 실행 엔진 §7.5.2 / WS Protocol §4.2). 카탈로그 단일 진실 복원.
3. **(W2)** `spec/5-system/4-execution-engine.md` §1에서 §1.2·§1.3 물리적 위치 교환; §3에서 §3.3을 §3.4 앞으로 이동.
4. **(W3)** `spec/5-system/4-execution-engine.md`에 `## Overview` 섹션 추가 (범위·SoT 책임 경계·구현 상태 설명).
5. **(I5)** `spec/conventions/error-codes.md §3`에 `WORKER_HEARTBEAT_TIMEOUT` 등록 (이름 부정확 이유 및 의미 재정의 근거 명시).
6. **(I6)** `spec/5-system/6-websocket-protocol.md §7.1` `INTERNAL_ERROR` 행에 scope 구분 주석 추가.
7. **(I8)** `plan/in-progress/execution-engine-typed-errors.md` 선행 의존 완료 표기 및 결정 1~4 체크 전환.
8. **(I2·I3·I4)** 차기 EIA·node-output 관련 spec 갱신 시 병행 처리.

---

## 처리 결정 (main, 2026-06-14)

본 PR(A-1 typed-error) 직접 유발 항목은 본 PR 에서 fix, 그 외 선존(pre-existing) 항목은 planner follow-up 으로 분리:

- **본 PR fix**: W1(카탈로그 등재), W4(stale pending_plans 제거 — guard 위험), I6(scope 주석), I8(plan 갱신).
- **planner follow-up (선존, 본 변경 무관)**: W2(섹션 순서), W3(Overview 부재), I3·I4·I5(기존 문서 nit). → `plan/in-progress/spec-sync-execution-gaps.md` 등에 위임.
- **defer (저가치/결정 대기)**: I1(error-codes.md 메모 — 불요), I2(EIA REST 매핑 — 별도 결정), I7(충돌 없음).
