# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 사유 없음.

## 전체 위험도
**LOW** — 5개 checker 모두 Critical 0건. WARNING 3건(cross_spec 1, convention_compliance 2)은 동일 근원(`INVALID_SCHEMA` 누락)으로 통합 가능. 비차단.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec / convention_compliance / rationale_continuity / plan_coherence (통합) | `INVALID_SCHEMA` field code 가 `12-webhook.md §5.2` 구현 불릿 및 JSON 예시에서 누락 — `3-error-handling.md §1.7` · `1-manual-trigger.md §6` · 구현 코드(`toTriggerParameterErrorDetails`) 와 불일치 | `spec/5-system/12-webhook.md` §5.2 L313–314, JSON 예시 L298–310 | `spec/5-system/3-error-handling.md §1.7` (각주 3종 열거) / `spec/4-nodes/7-trigger/1-manual-trigger.md §6` L181 / `trigger-parameter.types.ts` | (A) `12-webhook.md §5.2` 구현 불릿에 `invalid_schema` 추가 + JSON 예시에 `INVALID_SCHEMA` 케이스 항목 추가. 또는 (B) `3-error-handling.md §1.7` 각주에 "webhook 런타임 미발생" 조건 명시 후 세 문서 기술 동기화. 어느 옵션이든 `12-webhook.md §5.2`, `3-error-handling.md §1.7`, `1-manual-trigger.md §6` 세 문서를 단일 진실로 정렬해야 함. |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | `WH-EP-05-2` 요구사항 표 행에 `(목표)` 표기 잔존 — §5.2 본문은 이미 "구현"으로 통합됐고 plan 체크박스도 `[x]` 완료 | `spec/5-system/12-webhook.md` §3.1 요구사항 표 56행 | `(목표)` 를 제거하고 `(구현)` 또는 구현 완료 표시로 갱신 |
| 2 | plan_coherence | WH-NF-02 인증 webhook 1MB 게이트 — spec 반영 완료, 구현 plan 체크박스는 미완료 상태로 open | `spec/5-system/12-webhook.md` WH-NF-02 요구사항(106행) / `plan/in-progress/spec-sync-webhook-gaps.md` 세 번째 항목 | 정합 상태. 구현 완료 후 plan 체크박스 갱신하면 됨. 현 시점 조치 불필요 |
| 3 | convention_compliance | `INVALID_SCHEMA` field code 가 `3-error-handling.md §1.7` 테이블 본행이 아닌 각주에만 등재 | `spec/5-system/3-error-handling.md` §1.7 132–140행 | §1.7 표 아래 sub-table 또는 note 로 field-level code 3종 등재, 또는 각주에 "UPPER_SNAKE_CASE 공개 코드 계약 준수" 명시 1행 추가 |
| 4 | naming_collision | `INVALID_SCHEMA` 가 `12-webhook.md §5.2` 응답 예시 JSON 에서 생략됨 (충돌 아님, 문서 커버리지 누락) | `spec/5-system/12-webhook.md` §5.2 응답 예시 | WARNING #1 과 동일 수정으로 해소됨 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | `INVALID_SCHEMA` 코드가 `12-webhook.md §5.2` 에 누락되어 `3-error-handling.md §1.7` · `1-manual-trigger.md §6` 과 불일치 (WARNING 1건) |
| rationale_continuity | LOW | Rationale 연속성 위반 없음. INFO 2건: `WH-EP-05-2` `(목표)` 표기 잔존, `INVALID_SCHEMA` 열거 불일치 |
| convention_compliance | LOW | `error-codes.md §4` 내부 분류 목록 불완전(WARNING), `node-output.md Principle 11` JSON 예시 케이스 누락(WARNING), `error-codes.md §1` 카탈로그 가시성 INFO |
| plan_coherence | LOW | `INVALID_SCHEMA` 의 `12-webhook.md §5.2` 누락 INFO. WH-NF-02 구현 open 은 plan 에서 정상 추적 중 |
| naming_collision | NONE | 신규 식별자 충돌 전무. INFO 1건(INVALID_SCHEMA 예시 미포함)은 비차단 |

## 권장 조치사항
1. **(BLOCK 해소 우선)** — 없음. BLOCK 사유 없음.
2. **(WARNING 해소)** `spec/5-system/12-webhook.md §5.2` 수정 — 구현 불릿(L314)에 `invalid_schema` 추가, JSON 예시(L298–310)에 `{ "field": "(root)", "code": "INVALID_SCHEMA", "message": "..." }` 항목 추가. `project-planner` 가 단독 처리 가능하며 수정 후 `consistency-check --spec` 재실행 권장.
3. **(INFO 보완, 선택)** `spec/5-system/12-webhook.md §3.1` 요구사항 표 `WH-EP-05-2` 행의 `(목표)` → `(구현)` 갱신. `spec/5-system/3-error-handling.md §1.7` 각주에 "UPPER_SNAKE_CASE 공개 코드 계약 준수" 명시 추가.