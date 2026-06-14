# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다.

## 전체 위험도
**HIGH** — `spec/5-system/_product-overview.md` §5 테이블에 NF-OB-07 행이 없어 코드→spec 참조가 dangling reference 상태 (Convention Compliance CRITICAL). 나머지 checker 는 LOW/NONE.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | `NF-OB-07` 행 부재 — 코드 17곳 이상(주석·JSDoc)이 `spec/5-system/_product-overview.md §5` 를 SoT 로 참조하나 해당 §5 테이블에 NF-OB-07 행이 없어 dangling reference 발생. `spec-impl-evidence.md §2–§3` 위반 | `spec/5-system/_product-overview.md` §5 관측성 테이블 (NF-OB-01~NF-OB-06 까지만 존재) | `business-metrics.service.ts` JSDoc, `app.module.ts`, `continuation-dlq-monitor.service.ts`, `execution-engine.service.ts`, `llm-usage-log.service.ts` 의 `NF-OB-07` 주석 | §5 테이블에 NF-OB-07 행 추가: `\| NF-OB-07 \| 도메인/비즈니스 커스텀 메트릭 — 워크플로 실행 수·큐 깊이·LLM 토큰 사용량을 OTel Counter/Histogram/ObservableGauge 로 Prometheus 노출. 관측·알람용 보조 노출이며 제품 분석 SoT 는 DB 집계 기반 Statistics API (이원화 정책) \| 권장 \| ✅ (BusinessMetricsService + MetricsModule) \|` |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | NF-OB-02 상태 셀 "비즈니스 커스텀 메트릭은 후속" 문구 stale — 구현 완료 후에도 미구현으로 오인 가능 | `spec/5-system/_product-overview.md` line 70, NF-OB-02 상태 셀 | `BusinessMetricsService` + `MetricsModule` 구현 완료 diff | "비즈니스 커스텀 메트릭은 본 파이프라인 위 후속" → "→ NF-OB-07 로 구현 완료" 로 교체 또는 제거 |
| 2 | Rationale Continuity | DLQ Rationale 갱신이 인라인 주석 형태로만 삽입돼 "OTel Gauge 기각→채택 전환"의 경계가 불명확 — 향후 독자가 기각이 여전히 유효한지 오인할 여지 | `spec/5-system/4-execution-engine.md` §Rationale "DLQ 모니터링" — `(a)` 항목 인라인 블록 | `continuation-dlq-monitor.service.ts` `registerQueueDepthProvider` 호출부; 과거 기각 결정 | Rationale `(a)` 항목을 "~~OTel Meter Gauge 신설~~ → **채택으로 전환 (NF-OB-07, 조건 충족)**: 관측(gauge)과 알람(log cooldown) 역할 분리" 형식으로 교체하거나, "DLQ 모니터링 Rationale 현행화 (NF-OB-07)" 를 독립 소항목으로 추출 |
| 3 | Plan Coherence | 메인 트리 `plan/in-progress/spec-sync-5-system-metrics-gap.md` 의 "비즈니스 커스텀 메트릭" 항목이 `[ ]` 미완료 — 워크트리 로컬 plan 은 `[x]` 완료 처리됐으나 메인 트리 반영 전 | `plan/in-progress/spec-sync-5-system-metrics-gap.md` (origin/main, 메트릭 이름/라벨 셋 항목) | 워크트리 로컬 plan (동 항목 `[x]` + 결정 기록 존재) | PR merge 시 메인 트리 plan 의 해당 항목을 `[x]` 완료로 체크하고 후속 항목(W-10·W-12·I-11·I-3·I-12)을 `[ ]` 로 이월 등재 |
| 4 | Naming Collision | `TERMINAL_STATUSES` 동명 중복 선언 — `execution-engine.service.ts` (private static) 와 `interaction.service.ts` (module-level const) 에 내용이 동일한 집합이 이중 존재 (DRY 위반, 의미 충돌 아님) | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` line 701 | `codebase/backend/src/modules/external-interaction/interaction.service.ts` line 30 | 공유 상수를 `execution-engine/entities/execution-status.ts` 등 단일 파일로 추출 후 양쪽 import (이번 PR 범위 밖이면 후속 리팩터로 이월 가능) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `clemvion.execution.total` status 라벨값 대소문자 — `ExecutionStatus` enum 이 소문자(`'completed'` 등)이면 문제없음, 확인 권장 | `execution-engine.service.ts` `emitTerminalExecutionMetrics` → `recordExecutionTerminal(newStatus)` | `ExecutionStatus` enum 값이 소문자임을 테스트/코드에서 확인. `business-metrics.service.spec.ts` 는 이미 소문자로 assert 함 |
| 2 | Cross-Spec | `spec/0-overview.md §6.1` 시스템 행에 비즈니스 메트릭(NF-OB-07) 미언급 — 요약 문서 미동기화. 직접 모순 아님 | `spec/0-overview.md §6.1` 시스템 행 | 선택 사항: 개요 동기화 시 `비즈니스 메트릭(NF-OB-07)` 추가 또는 기존 비기능 항목 미열거 정책 유지 |
| 3 | Rationale Continuity | NF-OB-02 → NF-OB-07 전제 충족 연속성이 `_product-overview.md` 본문으로만 기술, 독립 Rationale 절 없음 | `spec/5-system/_product-overview.md` NF-OB-07 항목 | `_product-overview.md` 끝에 `## Rationale` 섹션 신설, "NF-OB-07 카탈로그 선택 근거·이원화 정책" 항 추가 (강제 아님) |
| 4 | Rationale Continuity | "임계 초과 알람(log 기반) vs 큐 깊이 관측(gauge)" 역할 분리 원칙은 구현에서 올바르게 보존됨 | `continuation-dlq-monitor.service.ts` + `spec/5-system/4-execution-engine.md` 현행화 블록 | 보완 불필요 |
| 5 | Convention Compliance | `spec/5-system/_product-overview.md` frontmatter 없음 — `_` prefix 면제 대상, 정상 | 파일 최상위 | 변경 불필요 |
| 6 | Convention Compliance | `spec/5-system/_product-overview.md` `## Rationale` 섹션 부재 — `_` prefix 면제 파일, 강제 아님 | 파일 전체 | NF-OB-07 행 추가 시 이원화 정책 근거를 §5 하단 또는 Rationale 절에 한 줄 추가 권장 |
| 7 | Convention Compliance | 코드 파일·식별자 명명 이상 없음 — NestJS kebab-case/PascalCase, OTel instrument 이름 일관성 모두 정상 | `metrics/` 모듈 전체 | 없음 |
| 8 | Plan Coherence | 후속 아키텍처 개선 항목(W-10·W-12·I-11·I-3·I-12) — 워크트리 로컬 plan 에 이월 기록 존재, 메인 트리 반영 필요 | `plan/in-progress/spec-sync-5-system-metrics-gap.md` 워크트리 로컬 §후속 | merge 시 메인 트리 plan 에 `[ ]` 항목으로 등재 |
| 9 | Naming Collision | `LlmTokenUsage` private 인터페이스 — 기존 `TokenUsage` 와 이름 달라 직접 충돌 없음. 타입 이중화만 존재 | `business-metrics.service.ts` line 25 | `TokenUsage` 또는 `Pick<TokenUsage, ...>` 사용으로 단순화 가능 (강제 아님) |
| 10 | Naming Collision | `NF-OB-07` ID — 시퀀스 연속, 기존에 다른 의미로 선점된 사용처 없음 | `spec/5-system/_product-overview.md` worktree | 없음 |
| 11 | Naming Collision | `clemvion.*` OTel 메트릭 이름 5종 — 기존 코드베이스에 사전 선언 없음, 충돌 없음 | `business-metrics.service.ts` | 없음 |
| 12 | Naming Collision | `metrics/` 모듈 폴더 신규 생성 — 인접 폴더명과 prefix 충돌 없음, 명명 컨벤션 일치 | `codebase/backend/src/modules/metrics/` | 없음 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | 타 spec 영역과 직접 모순 없음. status 라벨 대소문자 확인 권장(INFO) |
| Rationale Continuity | LOW | DLQ Rationale 갱신이 인라인 삽입으로 기각→채택 경계 불명확(WARNING). 핵심 로그 기반 알람 원칙은 보존됨 |
| Convention Compliance | HIGH | NF-OB-07 행 부재로 dangling reference (CRITICAL). NF-OB-02 stale 문구(WARNING) |
| Plan Coherence | LOW | 메인 트리 plan 미완료 체크박스 갱신 필요(WARNING). 구조적 차단 이슈 없음 |
| Naming Collision | LOW | `TERMINAL_STATUSES` 이중 선언(DRY 위반, 의미 충돌 아님, WARNING). 그 외 신규 식별자 충돌 없음 |

## 권장 조치사항

1. **(BLOCK 해소 필수)** `spec/5-system/_product-overview.md` §5 테이블에 NF-OB-07 행 추가. 내용: 도메인/비즈니스 커스텀 메트릭(실행 수·큐 깊이·LLM 토큰 사용량), OTel Counter/Histogram/ObservableGauge, Prometheus 노출, 이원화 정책, ✅ 완료 상태 명시.
2. **(WARNING 해소 권장)** `spec/5-system/_product-overview.md` NF-OB-02 상태 셀의 "비즈니스 커스텀 메트릭은 후속" 문구를 "→ NF-OB-07 로 구현 완료" 로 교체.
3. **(WARNING 해소 권장)** `spec/5-system/4-execution-engine.md` §Rationale "DLQ 모니터링" 의 `(a)` 항목을 "기각 → 채택 전환" 형식으로 명확히 재구조화하거나 독립 소항목으로 추출.
4. **(WARNING, merge 전)** 메인 트리 `plan/in-progress/spec-sync-5-system-metrics-gap.md` 의 비즈니스 커스텀 메트릭 항목을 `[x]` 완료로 전환하고, 후속 항목(W-10·W-12·I-11·I-3·I-12)을 `[ ]` 로 이월 등재.
5. **(WARNING, 후속 리팩터)** `TERMINAL_STATUSES` 중복 상수를 `execution-engine/entities/execution-status.ts` 단일 파일로 통합 추출.
6. **(INFO, 선택)** `ExecutionStatus` enum 값이 소문자 문자열임을 코드·테스트에서 명시적 확인 후 cross-spec 항목 해소.
7. **(INFO, 선택)** `spec/5-system/_product-overview.md` 끝에 `## Rationale` 섹션 신설 및 NF-OB-07 카탈로그 선택 근거(이원화 정책 포함) 기재.