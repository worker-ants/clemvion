# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다.

## 전체 위험도
**LOW** — Critical 1건은 현재 브랜치 target 파일(`spec/2-navigation` 영역) 밖의 `spec/conventions/cafe24-api-catalog/application.md` 에 있는 기존 규약 위반으로, M-8 1단계 리팩터링이 새로 유발한 위반은 없음. Warning 2건 모두 조치 불필요. 전반적 코드 변경 품질은 양호.

---

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | `applications_list`·`webhooks_list` row 가 `status: supported` 이나 Cafe24 공식 docs 에 해당 endpoint 없어 "supported 시 docs 필수" 규약 직접 위반 | `spec/conventions/cafe24-api-catalog/application.md` — `applications_list`·`webhooks_list` row 및 하단 ⚠ 주석 | `spec/conventions/cafe24-api-catalog/_overview.md §2` (docs 컬럼 "supported 시 ✓ 필수") + `§3 status enum` | 두 row 의 `status` 를 `planned` 로 강등하거나, `_overview.md §3` 에 "backwards-compat seed" 예외 escape hatch 를 추가한다. 또는 `G-2` 플랜 완료 후 docs 검증 시 `supported` 로 재승격. |

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | `10-auth-flow.md §5.4` `error=` redirect query param 이 `lower_snake_case` — 이미 historical-artifact 레지스트리에 등재되어 있어 실질 위반 아님 (INFO 재분류됨) | `spec/2-navigation/10-auth-flow.md §5.4` | `spec/conventions/error-codes.md §3 Historical-artifact 예외 레지스트리` | 현 상태 유지. 레지스트리 등재로 명시적 예외. |
| 2 | Convention Compliance | `_overview.md §5 Coverage Matrix` 숫자 수동 갱신 의무 — 본 검토 범위 내 `application` resource 는 수치 일치(19개) 확인됐으나, 나머지 resource 의 카운트 정합성은 자동 검증 미적용 | `spec/conventions/cafe24-api-catalog/_overview.md §5 Coverage Matrix` | `_overview.md §6` 수동 갱신 규약 | 구현 변경 시 Coverage Matrix 카운트를 함께 갱신하는 체크리스트 추가 권장. |
| 3 | Naming Collision | 프론트엔드 `TriggerDetail` 인터페이스(UI 뷰 모델)와 백엔드 `TriggerDetail` 타입(내부 조합 타입) 동명 — 컴파일 충돌 없으나 개발자 혼선 가능성 | `codebase/frontend/src/lib/api/triggers.ts:32` | `codebase/backend/src/modules/triggers/triggers.service.ts:36` | 백엔드 측을 `TriggerWithSchedule` (또는 `TriggerWithMeta`) 으로 rename 하거나, 프론트엔드 측을 `TriggerDetailView` 로 변경해 레이어 구분을 명시한다. |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `2-trigger-list.md §4.1`/R-4 감사 액션이 현재형(`trigger.delete`/`trigger.update`) — `audit-actions.md` 레지스트리 과거분사 표기(`trigger.deleted`/`trigger.updated`)와 불일치. 미구현(Planned) 상태라 런타임 영향 없음 | `spec/2-navigation/2-trigger-list.md` 182행, Rationale R-4 252행 | `spec/conventions/audit-actions.md §3`, `spec/5-system/1-auth.md §4.1` | `trigger.delete` → `trigger.deleted`, `trigger.update` → `trigger.updated` 로 정정 |
| 2 | Rationale Continuity | `triggersApi.getHistory` 포함 — R-7 경계("drawer 가 history 를 호출하지 않는다") 유지 확인됨 | `codebase/frontend/src/lib/api/triggers.ts` `getHistory` 함수 | `spec/2-navigation/2-trigger-list.md ## Rationale R-7` | 현 구조 올바름. 추가 조치 불필요. |
| 3 | Rationale Continuity | `rotateNotificationSecret` 응답 타입이 spec R-2 TBD(평문 vs masked 미결정) 영역을 코드 레벨에서 암묵적으로 고정하는 효과 — 기존 구현 추출이므로 신규 결정 아님 | `codebase/frontend/src/lib/api/triggers.ts:181-189` | `spec/2-navigation/2-trigger-list.md §R-2 TBD` | JSDoc 에 "v1.1 TBD — 응답 shape 확정 후 타입 재검토 필요" 주석 추가 (선택). |
| 4 | Rationale Continuity | R-4 단일 PATCH 경로, R-CC-10 bot token single-path, R-14 inline 인증 폐기 — 모두 API 카탈로그 타입 수준에서 완전 준수 확인 | `codebase/frontend/src/lib/api/triggers.ts` 전체 | `spec/2-navigation/2-trigger-list.md` Rationale 각 항목 | 위반 없음. |
| 5 | Convention Compliance | `14-execution-history.md` 에 `## Overview (제품 정의)` + `## 1. 개요` 이중 구조 — 타 파일과 구조 불일치 | `spec/2-navigation/14-execution-history.md` 상단 | CLAUDE.md 문서 구조 규약 (Overview / 본문 / Rationale 3섹션) | Overview 섹션을 `_product-overview.md` 로 분리하거나 요구사항 표를 §1 에 통합 |
| 6 | Convention Compliance | `15-system-status.md` — frontmatter 직후 헤딩 없이 단락으로 시작 | `spec/2-navigation/15-system-status.md` | CLAUDE.md 문서 구조 규약 | `## 1.` 전 명시적 개요 헤딩 추가 (선택). |
| 7 | Convention Compliance | `16-agent-memory.md` `id: nav-agent-memory` — basename 불일치처럼 보이나 `spec/5-system/17-agent-memory.md` 와의 충돌 회피를 위한 spec-impl-evidence §2.1 의 의도된 패턴 | `spec/2-navigation/16-agent-memory.md` frontmatter | `spec/conventions/spec-impl-evidence.md §2.1` | 현 상태 유지. |
| 8 | Plan Coherence | M-8 2단계 "6카드 분리 결정" 이 spec §2.3.1 과 gap — plan 에 이미 "별개 결정" 으로 명시됨 | `plan/in-progress/refactor/02-architecture.md §M-8 2단계` | `spec/2-navigation/2-trigger-list.md §2.3.1` | 2단계 착수 전 플래너에게 6카드 vs 5카드 결정 확인 요청. |
| 9 | Plan Coherence | V-10(트리거 목록 Cron/nextRun 미결) 과 M-8 1단계 API 레이어 무충돌 확인 | `codebase/frontend/src/lib/api/triggers.ts` `list` 함수 | `plan/in-progress/spec-code-cross-audit-2026-06-10.md §V-10` | V-10 결정 시 `TriggerListItem` 타입 갱신 체크리스트 추가 권장. |
| 10 | Naming Collision | `triggersApi` 네임스페이스 신규 도입 — `executionsApi`, `workflowsApi` 등 기존 `*Api` 컨벤션과 정합, 충돌 없음 | `codebase/frontend/src/lib/api/triggers.ts:126` | 기존 `lib/api/` 파일들 | 없음. |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | `2-trigger-list.md §4.1`/R-4 감사 액션 현재형 표기 — INFO 1건. API 계약·RBAC·상태 전이 전 영역 Critical/Warning 없음 |
| Rationale Continuity | NONE | M-8 1단계 Rationale 연속성 완전 준수. 기각 대안 재도입 없음 |
| Convention Compliance | LOW | `spec/conventions/cafe24-api-catalog/application.md` `supported`+docs 미검증 1건 Critical. 나머지 INFO 수준 구조 개선 여지만 존재 |
| Plan Coherence | LOW | `rotateNotificationSecret` TBD 암묵 고정, M-8 2단계 6카드 결정 미확정 — 모두 INFO. 우회/충돌 항목 없음 |
| Naming Collision | LOW | `TriggerDetail` 동명 WARNING 1건 (레이어 분리라 컴파일 충돌 없음). 나머지 신규 식별자 모두 충돌 없음 |

---

## 권장 조치사항

1. **(BLOCK 해소 필수)** `spec/conventions/cafe24-api-catalog/application.md` 의 `applications_list`·`webhooks_list` row `status` 를 `planned` 로 강등하거나, `spec/conventions/cafe24-api-catalog/_overview.md §3` 에 "docs 미검증 supported" 허용 예외(backwards-compat seed) 를 명시한다. 현재 ⚠ 주석 + `cafe24-backlog-residual.md §G-2` 추적만으로는 규약 위반 해소가 안 됨.
2. **(Warning — 권장)** `codebase/backend/src/modules/triggers/triggers.service.ts:36` 의 `TriggerDetail` 타입을 `TriggerWithSchedule` 또는 `TriggerWithMeta` 로 rename 하여 프론트엔드 동명 뷰 모델과의 혼선 예방.
3. **(INFO — 선택)** `spec/2-navigation/2-trigger-list.md` §4.1 의 `trigger.delete` → `trigger.deleted`, R-4 의 `trigger.update` → `trigger.updated` 정정 (과거분사 통일).
4. **(INFO — 선택)** `rotateNotificationSecret` 함수에 JSDoc "v1.1 TBD — 응답 shape 확정 후 타입 재검토" 주석 추가.
5. **(INFO — 선택)** M-8 2단계 착수 전 `plan/in-progress/refactor/02-architecture.md` 에 플래너 확인 체크리스트(6카드 vs 5카드 결정) 추가.