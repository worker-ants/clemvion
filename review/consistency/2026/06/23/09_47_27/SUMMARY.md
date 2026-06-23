# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 착수 가능.

## 전체 위험도
**LOW** — Warning 2건(plan-coherence 1, naming-collision 1) + INFO 다수. 모두 비차단.

## Critical 위배 (BLOCK 사유)

Critical 위배 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Plan Coherence | M-8 2단계 카드 분리 시 "5카드(현행) vs 6카드(spec §2.3.1 암묵 전제)" 구조 결정이 plan 에 "별개 결정"으로 유보된 채 착수 직전 미확정 | `spec/2-navigation/2-trigger-list.md §2.3.1` + `plan/in-progress/refactor/02-architecture.md` M-8 2단계 | spec §2.3.1 Auth Config 카드 독립 행 vs 현행 WebhookConfigCard 병합 5카드 구현 | plan 에 "2단계는 현행 5카드 behavior-preserving 유지 — AuthConfigCard 분리는 별도 PR" 명시, 또는 planner 에게 spec §2.3.1 Auth Config 독립 의도 확인 의뢰 |
| W-2 | Naming Collision | `OverviewCard` 이중 정의 — 신규 `cards/trigger-overview-card.tsx:22`(named export)와 기존 `trigger-detail-drawer.tsx:117`(module-private)가 동일 이름 공존. plan 제안 이름 `TriggerOverviewCard` 와도 불일치 | `codebase/frontend/src/components/triggers/cards/trigger-overview-card.tsx` | `codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx` | 신규 파일 export 를 `TriggerOverviewCard` 로 변경하거나, drawer 리팩토링 완료 즉시 기존 `OverviewCard` 정의 제거 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Cross-Spec | `GET /api/triggers/:id/history` 응답 shape(필드·최대 건수·정렬)이 spec 에 미정의. `6-config.md §A.3 recentCalls` shape 과 암묵 이중 계약 가능성 | `spec/2-navigation/2-trigger-list.md §3 API` | `2-trigger-list.md §3` 에 응답 예시 추가 또는 `6-config.md §A.3 recentCalls` 를 SoT 로 명시 참조 |
| I-2 | Cross-Spec | R-13 drill-down Link 에 `executionId` 필요하나 `recentCalls` shape 의 `id` 가 Execution.id 임을 spec 이 명기하지 않음 | `spec/2-navigation/2-trigger-list.md Rationale R-13` + `spec/2-navigation/6-config.md §A.3` | `GET /api/triggers/:id/history` 응답에 `executionId` 명시 선언, 또는 `6-config.md §A.3 id` 필드가 `Execution.id` 임을 명기 |
| I-3 | Cross-Spec | 트리거 목록 `sort`/`order` 미구현 ⚠️ 주석에 plan 링크 미연결 — 구현 결정 근거 추적 불가 | `spec/2-navigation/2-trigger-list.md §3 API` | ⚠️ 주석에 `pending_plan` 링크 추가, 또는 M-8 2단계 범위에서 명시적 defer 표기 |
| I-4 | Cross-Spec | `GET /api/triggers` `status` 쿼리 파라미터 허용값 미명시 (`1-workflow-list.md` 는 `active\|inactive` 명시) | `spec/2-navigation/2-trigger-list.md §3 API` + `§2.2 필터` | API 표 `status` 파라미터에 `active` / `inactive` 허용값 추가 |
| I-5 | Convention Compliance | `spec/2-navigation` 대부분 파일에 `## Overview` 섹션 없이 `## 1. 개요` 로 시작 — 3섹션 권장 불완전 | `spec/2-navigation/` 다수 파일 | 현 상태 유지 가능(Rationale 100% 준수). 신규 작성 시 3섹션 패턴 적용 권장 |
| I-6 | Convention Compliance | `spec/2-navigation/` 파일 번호 12 누락(폐기 파일 공백) | `spec/2-navigation/` 디렉토리 | 신규 spec 추가 시 17번부터 연속 할당. 소급 정정 불필요 |
| I-7 | Convention Compliance | `spec/2-navigation/_layout.md` 가 면제 대상임에도 frontmatter 자발 보유(초과 준수) | `spec/2-navigation/_layout.md` | 변경 불필요 |
| I-8 | Plan Coherence | spec Rationale R-2(v1.1 rotate TBD)가 plan 에서 이미 폐기 처리됐으나 spec 에 cleanup 미반영 | `spec/2-navigation/2-trigger-list.md Rationale R-2` | spec R-2 에 "R-14 채택으로 본 v1.1 예약 폐기됨" 주석 추가 요청(planner 위임, 비차단) |
| I-9 | Naming Collision | `TYPE_BADGE_STYLES` 상수 중복 정의 — `trigger-overview-card.tsx` 와 `trigger-detail-drawer.tsx` 양쪽 존재(런타임 충돌 없으나 불필요 중복) | `codebase/frontend/src/components/triggers/cards/trigger-overview-card.tsx:16` + `trigger-detail-drawer.tsx:45` | 카드 분리 완료 시 `cards/_shared.ts` 로 통합 |
| I-10 | Naming Collision | `useTrigger` hook 과 drawer inline `useQuery` 가 동일 query key `["trigger-detail", triggerId]` 이중 관리 | `hooks/use-trigger.ts:7` + `trigger-detail-drawer.tsx:61` | 카드 파일 추출 시 drawer 도 `useTrigger` hook 사용으로 교체 |
| I-11 | Naming Collision | plan 제안 이름(`EiaNotificationCard`, `ScheduleCard`) vs 현행 코드(`ExternalInteractionCard`, `ScheduleConfigurationCard`) vs spec §2.3.1 라벨 3방향 불일치 | `plan/in-progress/refactor/02-architecture.md:383` + `trigger-detail-drawer.tsx` | spec §2.3.1 카드 라벨 기준으로 `ExternalInteractionCard` / `ScheduleConfigurationCard` 유지 권장. `EiaNotificationCard` 사용 금지 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | 직접 모순 없음. INFO 4건 — 주요: `GET /api/triggers/:id/history` 응답 shape 미정의, `executionId` 미선언 |
| Rationale Continuity | NONE | R-1~R-16, R-CC-10 전체 Rationale 결정과 완전 정합. 기각된 대안 재도입 없음 |
| Convention Compliance | NONE | 핵심 규약(frontmatter, status, API 봉투, 에러코드) 전체 준수. INFO 3건 구조 제안만 |
| Plan Coherence | LOW | WARNING 1건 — 5카드 vs 6카드 구조 결정 미확정 상태로 착수 직전. INFO 1건 — spec R-2 cleanup 미반영 |
| Naming Collision | LOW | WARNING 1건 — `OverviewCard` 이중 정의(신규 vs 기존 + plan 명칭 불일치). INFO 3건 — 중복 상수, query key, 카드 이름 3방향 불일치 |

## 권장 조치사항

1. **(W-1 — 착수 전 해소 권장)** `plan/in-progress/refactor/02-architecture.md` M-8 2단계 항목에 "2단계는 현행 5카드 behavior-preserving 유지 — `AuthConfigCard` 분리는 spec §2.3.1 갱신 및 UX 결정 이후 별도 PR" 을 명시한다. spec §2.3.1 Auth Config 카드가 현행 5카드와 drift 인지 여부를 planner 에게 확인하거나, 2단계 범위가 behavior-preserving 임을 plan 에 선언하는 것으로 충분하다.
2. **(W-2 — 착수 직후 또는 카드 파일 추출 시)** `cards/trigger-overview-card.tsx` 의 export 이름을 `TriggerOverviewCard` 로 변경해 plan 명칭과 정렬하고, drawer 내 module-private `OverviewCard` 와의 이름 충돌을 제거한다. drawer 리팩토링 완료 후 기존 정의를 즉시 삭제한다.
3. **(I-11 — 카드 파일 신규 생성 시)** 카드 이름을 spec §2.3.1 라벨(`External Interaction`, `Schedule Configuration`) 기준으로 결정하고 plan 의 `EiaNotificationCard` 표기는 사용하지 않는다.
4. **(I-9, I-10 — 카드 분리 완료 후)** `TYPE_BADGE_STYLES` 를 `cards/_shared.ts` 로 통합하고, drawer 의 inline `useQuery` 를 `useTrigger` hook 으로 교체해 query 관리 단일 진실을 확립한다.
5. **(I-1, I-2 — planner 위임, 비차단)** `2-trigger-list.md §3` 에 `GET /api/triggers/:id/history` 응답 shape 및 `executionId` 필드를 추가하거나 `6-config.md §A.3` 를 SoT 로 명시 참조하도록 spec 갱신을 planner 에게 요청한다.