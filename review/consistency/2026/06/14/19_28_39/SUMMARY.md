# Consistency Check 통합 보고서 (--spec, doc-sync)

**BLOCK: NO** — Critical 0. 차단 사유 없음.

## 전체 위험도
**LOW** — WARNING 1건(선존 §1.4 Email — 본 PR 무관) + INFO 다수(대부분 선존/스타일).

## Critical
없음.

## 경고 (WARNING) — 본 PR 무관 (선존, 별도)
| # | Checker | 위배 | 처리 |
|---|---------|------|------|
| 1 | Cross-Spec | §1.4 Email 행의 `details.integrationCode` 등장 조건 역전 기술 (`INTEGRATION_*` 는 `IntegrationError` 직접 surface) | **선존 nit, 본 doc-sync 무관** — 별도 후속. send-email §5.3 와 정합 정정 필요. |

## 참고 (INFO) — 본 PR §1.6 관련 + 선존
- **I7** (convention): §1.6 `TOKEN_REVOKED/SCOPE/AUDIENCE` 3코드 한 행 — naming_collision(I9)은 "현행 유지·주석 충분" 으로 상충 판정. 공유 401 비고라 의도적 그룹 유지.
- **I3/I5** (rationale): §1.5·§1.6 표면별 분리 원칙이 ## Rationale 미기재(EIA R13/R14 가 SoT). 선택 보강.
- I1(WS spec `ExecutionError`→`MessageTooLongError` 정정) · I2(§3.2 Email 축약) · I6(## Overview 부재) · I8(§3.2 모호 참조) = 선존, 본 PR 무관.
- I9~I11 naming: 전부 실제 충돌 없음(의도된 레이어 구분).

## Checker별
| Checker | 위험도 |
|---------|--------|
| Cross-Spec | LOW (선존 §1.4 Email WARNING) |
| Rationale/Convention/Naming | NONE/LOW (INFO만) |
| Plan Coherence | 재시도 필요(output 미생성, 비차단) |

## 결론
**BLOCK: NO.** 본 doc-sync 추가(16-system-status 큐·3-error-handling §1.6 EIA 카탈로그·1-data-model execution_token·R10 정정)는 정합. WARNING/INFO 는 선존 nit 또는 §1.6 스타일(상충 판정, 의도 유지) — 별도 후속. spec-only PR → push.
