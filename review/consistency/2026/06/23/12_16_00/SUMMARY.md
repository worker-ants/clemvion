# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 구현 착수 비차단.

## 전체 위험도
**LOW** — 5개 checker 전원 Critical/Warning 0건. Plan Coherence checker 에서 `endpoint_path` 생성 주체 미결 건(W1) 확인 권장 항목이 LOW 위험도를 유발하나 착수 차단 사유 아님.

## Critical 위배 (BLOCK 사유)

해당 없음.

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| — | — | 발견된 Critical 위배 없음 | — | — | — |

## 경고 (WARNING)

해당 없음.

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| — | — | 발견된 Warning 없음 | — | — | — |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `activeWorkflows` 부연 — `Workflow.is_active` vs `Trigger.is_active` 혼동 가능 표현 | `spec/2-navigation/0-dashboard.md §3` | 괄호 부연을 "워크플로우 자체가 활성(`Workflow.is_active = true`)인 수"로 명확화 (선택) |
| 2 | Cross-Spec | `pending` 상태 — 실행 이력 필터에서 의도적 제외, 대시보드 아이콘에는 묶음 표기 비대칭 | `spec/2-navigation/14-execution-history.md §2.3` / `0-dashboard.md §5` | 실질 충돌 없음. 상호 참조 주석 보강 선택 |
| 3 | Cross-Spec | `GET /api/triggers` sort/order 파라미터 수신 후 무시 — known gap | `spec/2-navigation/2-trigger-list.md §3` | 구현 착수 시 현황 그대로 수용할지 실제 정렬 구현할지 결정 |
| 4 | Cross-Spec | `triggerSource`(DTO 5종) vs `__triggerSource`(엔진 내부 3종) 이중 네임스페이스 | `spec/2-navigation/14-execution-history.md §2.4 R-2` | spec 에 이미 명시됨. 구현 시 `ExecutionsService`의 `parent_execution_id` 최우선 판정 확인 |
| 5 | Convention | `spec/2-navigation/_layout.md` — 밑줄 prefix 파일에 frontmatter 존재 | `spec/2-navigation/_layout.md` lines 1-8 | 빌드 게이트 영향 없음. 불필요하다면 frontmatter 제거 고려 |
| 6 | Convention | Overview 섹션 채택 불균일 (파일 간 `## Overview` / `## 1. 개요` / 섹션 없음 혼재) | `spec/2-navigation/` 전체 (17개) | 신규 spec 작성 시 Overview / 본문 / Rationale 3섹션 채택 권장. 기존 소급 불필요 |
| 7 | Convention | `spec/2-navigation/2-trigger-list.md` `code:` glob — 구현 완료 후 경로 변동 시 빌드 게이트 가능 | `spec/2-navigation/2-trigger-list.md` frontmatter | 구현 완료 후 `code:` 목록이 실제 변경 파일을 커버하는지 확인 |
| 8 | Plan Coherence | `1-workflow-list.md` 미구현 3건(태그 필터 / 폴더 필터 / 마켓플레이스 빈 상태 링크) — plan 에도 열려있음 | `spec/2-navigation/1-workflow-list.md §2.3, §2.7` | 현 impl-prep 조치 불필요. 미구현 인지 유지 |
| 9 | Plan Coherence | M-8 후속 4건(`useCreateTriggerForm`, 뷰모델 매핑, `TriggerDetail` 개칭, `onDeleted?`) 미착수 | `plan/in-progress/refactor/02-architecture.md §M-8 후속` | 현 구현 범위와 직교. 별도 PR/플래너 위임 |
| 10 | Plan Coherence | `trigger-review-deferred-fixes.md` W1 — `endpoint_path` 생성 주체(클라이언트 vs 서버) 미결 | `spec/2-navigation/2-trigger-list.md §3` (webhook endpoint API) | 착수 전 spec 서술과 plan W1 방향 일치 여부 교차 확인 권장 |
| 11 | Plan Coherence | `spec-sync-structural-followups.md` cross-ref 항목 미착수 (observability / `/docs` 단일언어) | `spec/2-navigation/` 관련 cross-ref | target spec 수정 시 cross-ref 유효성 점검 |
| 12 | Naming Collision | `id: system-status` vs `id: system-status-api` — suffix 로 명시 구분 | `spec/2-navigation/15-system-status.md` / `spec/5-system/16-system-status-api.md` | 현행 유지 |
| 13 | Naming Collision | `id: nav-agent-memory` vs `id: agent-memory` — `nav-` prefix 로 의도적 분리 | `spec/2-navigation/16-agent-memory.md` / `spec/5-system/17-agent-memory.md` | 현행 유지 |
| 14 | Naming Collision | `RESEND_COOLDOWN_SECONDS` 두 파일 중복 정의 — 코드 레벨 DRY 이슈 | `verify-email-content.tsx` / `forgot-password-form.tsx` | M-2 구현에서 해당 파일 수정 시 통일 여부 확인 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | Critical/Warning 0건. INFO 6건(전부 known gap 또는 이미 spec 명시된 의도적 설계) |
| Rationale Continuity | NONE | 기각 대안 재도입·합의 번복·암묵적 가정 충돌 0건. `spec/2-navigation` 전 문서 Rationale 연속성 양호 |
| Convention Compliance | NONE | frontmatter 의무(`id`, `status`) 전 파일 충족. INFO 3건(빌드 게이트 영향 없음) |
| Plan Coherence | LOW | Critical 0건. `endpoint_path` W1 미결(INFO) — 착수 전 교차 확인 권장 |
| Naming Collision | NONE | 실질 ID 충돌 0건. 유사 이름 쌍은 suffix/prefix 로 명시 분리. 코드 DRY 이슈 1건(INFO) |

## 권장 조치사항

1. **(착수 전 확인)** `spec/2-navigation/2-trigger-list.md §3` 의 `endpoint_path` 생성 계약 서술이 `plan/in-progress/trigger-review-deferred-fixes.md` W1 의 미결 방향과 일치하는지 확인. 불일치 시 plan W1 먼저 해소하거나 spec 에 `결정 필요` 표기 후 착수.
2. **(구현 완료 후 확인)** `spec/2-navigation/2-trigger-list.md` frontmatter `code:` glob 이 실제 변경 파일을 커버하는지 검증 (`spec-code-paths.test.ts` 게이트).
3. **(선택, 낮은 우선순위)** `spec/2-navigation/0-dashboard.md §3` 괄호 부연 문구를 `Workflow.is_active` 기반으로 명확화. spec 정확도 향상이나 차단 사유 아님.
4. **(이월)** M-8 후속 4건 및 planner 후속(`INTEGRATION_INVALID_SERVICE` error-codes 등재) 은 별도 PR/플래너 위임으로 처리. 현 M-2 범위 외.