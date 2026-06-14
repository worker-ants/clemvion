# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음, 구현 진행 가능

## 전체 위험도
**LOW** — `spec/data-flow/9-observability.md §4` note 의 "비즈니스 메트릭 후속" 구문이 NF-OB-07 ✅ 완료 사실과 어긋나는 단일 INFO, 그리고 `TERMINAL_STATUSES` 상수 다중 독립 정의(WARNING) 외에 Critical/구조적 위반 없음

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Naming Collision | `TERMINAL_STATUSES` 상수가 `ExecutionEngineService`(static member) 와 `interaction.service.ts`(모듈 레벨 const) 두 곳에 동일 의미로 독립 정의 — 스코프 달라 직접 충돌은 없으나 `ExecutionStatus` 값 추가 시 드리프트 위험 | `execution-engine.service.ts` L700 | `external-interaction/interaction.service.ts` L30 | `execution-status.enum.ts` 또는 공유 util 에 `TERMINAL_EXECUTION_STATUSES` 로 통합 후 양 서비스 import. 본 PR 범위 밖 — 후속 백로그 등재 권장 |
| 2 | Plan Coherence | `plan/in-progress/spec-sync-5-system-metrics-gap.md` (main branch) 의 메트릭 이름·라벨 셋 "합의 필요" 항목 및 `/consistency-check --impl-done` 항목이 `[ ]` 미체크 상태 | `plan/in-progress/spec-sync-5-system-metrics-gap.md` L19-21 (main) | worktree plan 은 사용자 합의 기록 반영·`[x]` 체크 완료 | consistency-check 완료 후 plan 항목을 `[x]` 로 닫고 PR 에 포함 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `spec/data-flow/9-observability.md §4` note "비즈니스 커스텀 메트릭은 후속이다" — NF-OB-07 ✅ 완료와 사실 충돌 | `spec/data-flow/9-observability.md` L202 | NF-OB-07 구현 완료 사실 반영, "후속이다" 문구 제거. Cross-Spec 발견사항 3(Prometheus host 참조 동기화)과 함께 처리 |
| 2 | Cross-Spec | `spec/5-system/4-execution-engine.md` Rationale DLQ 현행화 — worktree 에서 이미 처리됨 | worktree `spec/5-system/4-execution-engine.md` L1376-1381 | 해당 없음, 이미 완료 |
| 3 | Rationale Continuity | NF-OB-07 "이원화 정책"(OTel 보조 vs Statistics API SoT)이 spec 인라인 기술에 그침 — 향후 오용 방지용 ADR 정식화 미완 | `spec/5-system/_product-overview.md` NF-OB-07 인라인 단락 | 선택적 보완 — `§ Rationale` 에 ADR 형태로 추가 시 향후 Rationale 연속성 검토에서 즉시 포착 가능 |
| 4 | Rationale Continuity | `plan/in-progress/spec-sync-5-system-metrics-gap.md` 비즈니스 커스텀 메트릭 체크박스 미갱신(plan lifecycle 사안) | `plan/in-progress/spec-sync-5-system-metrics-gap.md` L20 (main) | WARNING #2 와 동일 조치 — consistency-check 완료 후 `[x]` 갱신 |
| 5 | Plan Coherence | W-10·W-12·I-3·I-11·I-12·I-13 후속 아키텍처 개선 항목이 별도 plan 없이 현 plan 하위 목록에만 존재 | `plan/in-progress/spec-sync-5-system-metrics-gap.md` §후속(아키텍처 개선) | 선택적 — 단기 백로그 수준이면 현 목록 유지 가능; 추적 필요 시 별도 plan 신설 |
| 6 | Naming Collision | `LlmTokenUsage` (파일-private interface, 모두 optional) 가 기존 `TokenUsage` (모든 필드 required)와 의미 중복 | `business-metrics.service.ts` L49-52 | `import type { TokenUsage }` 또는 `Pick<TokenUsage, ...>` 재활용 권장. 현재 private 스코프라 즉각 충돌 없음 |
| 7 | Naming Collision | `NF-OB-07` ID 신설 — 기존 NF-OB-01~06 연번 정합 확인, 충돌 없음 | `spec/5-system/_product-overview.md` L75 | 없음 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | `9-observability.md §4` "후속이다" note 만 NF-OB-07 ✅ 와 사실 어긋남. 데이터 모델·API·요구사항 ID 충돌 없음 |
| Rationale Continuity | NONE | DLQ OTel Gauge 재도입은 spec Rationale 현행화 주석(전제 변화 명시)으로 근거 있는 번복 확인. 이원화 정책 spec·코드 양쪽 일치 |
| Convention Compliance | NONE | 파일·클래스·메트릭 명명, frontmatter 면제, 테이블 구조, anchor 참조 모두 규약 준수 |
| Plan Coherence | LOW | 메트릭 이름/라벨 셋 합의가 worktree plan 에 기록됨. main branch plan 미체크는 PR 전 상태의 당연한 결과 |
| Naming Collision | LOW | `TERMINAL_STATUSES` 다중 독립 정의(드리프트 위험), `LlmTokenUsage` 중복 private 인터페이스. 직접 충돌 없음 |

## 권장 조치사항

1. **(즉시 — PR 포함)** `plan/in-progress/spec-sync-5-system-metrics-gap.md` 의 `/consistency-check --impl-done` 항목을 `[x]` 로 닫고 PR 커밋에 포함 (WARNING #2).
2. **(단기 — 별도 spec PR)** `spec/data-flow/9-observability.md §4` note 의 "비즈니스 커스텀 메트릭은 후속이다" 문구를 NF-OB-07 완료 사실로 교체 (INFO #1). 해당 파일의 NF-OB-07 링크 및 Prometheus host 참조 동기화(INFO #1 연계)도 함께 처리.
3. **(백로그)** `TERMINAL_STATUSES` 공유 상수 통합 (`execution-status.enum.ts` 또는 공유 util, WARNING #1). `LlmTokenUsage` → `TokenUsage` 재활용 (INFO #6). W-10·W-12 등 후속 아키텍처 개선 추적 plan 여부 결정 (INFO #5).
4. **(선택적)** `spec/5-system/_product-overview.md § Rationale` 에 "NF-OB-07 이원화 정책" ADR 추가 (INFO #3).