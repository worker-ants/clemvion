# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**MEDIUM** — target(`spec/data-flow/8-notifications.md`)은 정확하나, 인접 spec 2곳(§11.2 integration dedup 서술, data-model §2.19 Notification.type Enum)이 뒤처져 모순 발생. 나머지 3개 checker(rationale_continuity / plan_coherence / naming_collision)는 output 파일이 디스크에 존재하지 않아 재시도 필요.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | `integration_action_required` 중복 방지 메커니즘 서술 상충 — target 은 실제 코드(`IntegrationActionRequiredNotifier.notify`, `hasRecentByResource` 24h rolling window)를 정확히 반영하나, `4-integration.md §11.2` 는 구 메커니즘("`(integration_id, status_reason)` 영구 UNIQUE + 재연결 리셋")을 그대로 서술 | `spec/data-flow/8-notifications.md` §1.1, §4.4, Rationale | `spec/2-navigation/4-integration.md` §11.2 | `4-integration.md §11.2` 를 target 의 24h rolling window 서술로 갱신하거나, target 에 "본 서술이 §11.2 구 서술을 대체하는 canonical 정의"라는 우선순위 각주 추가 |
| 2 | Cross-Spec | `Notification.type` Enum 목록 미갱신 — target 은 V070 마이그레이션(`alert_failure_rate`/`alert_duration`/`alert_llm_cost` 3종 추가)을 정확히 반영하나 data-model 은 V052 시점(7개)에 머묾 | `spec/data-flow/8-notifications.md` §1.1 | `spec/1-data-model.md` §2.19 Notification `type` 필드 | `spec/1-data-model.md §2.19` 의 `type` Enum 열거에 `alert_<rule.type>` (3종 구체값) 추가. project-planner 승인 시 함께 갱신 |
| 3 | Convention Compliance | 읽음/dismiss 액션 endpoint(`PATCH :id/read`, `POST mark-all-read`, `POST :id/dismiss`, `POST dismiss-all`)가 `spec/5-system/2-api-convention.md §12.1` "상태 토글은 PATCH body 방식, 전용 endpoint 금지" 규약과 형태상 어긋나며 (`is_read` 가 §12.1 적용 대상 표에 명시), target Rationale 이 이 divergence 를 §12.1 과 짝지어 설명하지 않음 | `spec/data-flow/8-notifications.md` §3, §4.2, Rationale "Dismiss endpoint 의 HTTP 동사" | `spec/5-system/2-api-convention.md §12.1` | target Rationale 에 "`is_read` 는 §12.1 신규 적용 대상에서 제외되는 historical sub-path 액션" 각주 추가, 또는 `2-api-convention.md §12.1` 표에서 `is_read (Notification)` 항목에 예외 각주 추가. 코드 변경(breaking change)은 권고 범위 아님 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Convention Compliance | `POST /notifications/:id/dismiss` 라우트 선언 순서(`dismiss-all` 이 `:id/dismiss` 보다 선행 필요) 코멘트가 코드에만 있고 target 문서 §4.2 에는 없음 | `spec/data-flow/8-notifications.md` §4.2 | 필수는 아니나 §4.2 근처에 라우트 등록 순서 한 줄 추가하면 향후 회귀 방지에 도움 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | MEDIUM | target 은 코드 정확히 반영, 다만 `4-integration.md §11.2`(dedup 메커니즘)와 `1-data-model.md §2.19`(Notification.type Enum) 2곳이 target 대비 뒤처져 모순 |
| Convention Compliance | LOW | 알림 읽음/dismiss endpoint 가 `2-api-convention.md §12.1` 상태 토글 규약과 형태상 divergence(기존부터 존재, 신규 위반 아님) — Rationale 에 명시적 각주 필요 |
| Rationale Continuity | NONE (재실행 완료) | 0 Critical — 신설 Rationale "team_invite 채널 — 이메일 중복 회피" 가 과거 결정을 무근거로 번복하지 않고 (a)/(b)/(c) 대안 기각 근거를 명시. 기각된 대안 재도입·합의 원칙 위반 없음 |
| Plan Coherence | WARNING (재실행 완료) | 0 Critical — plan `spec-update-notifications-firing.md` 의 team_invite OPEN 항목이 옵션 (c) 채택으로 해소됐으므로 같은 PR 에서 체크박스·완료조건 갱신 + plan/complete 이동 필요(본 마무리 단계에서 수행). 결정 충돌 아님 |
| Naming Collision | NONE (재실행 완료) | 0 Critical — 신규 식별자 충돌 없음 |

## 권장 조치사항

1. **rationale_continuity / plan_coherence / naming_collision 3개 checker 재실행** — status 는 success 로 보고되었으나 지정 output_file 경로(`.../20_57_56/{name}.md`)에 실제 파일이 생성되지 않음(`_prompts/` 하위의 동명 파일은 입력 프롬프트이지 결과가 아님). 재실행 후 본 SUMMARY 를 갱신해야 최종 판정 완결.
2. `spec/2-navigation/4-integration.md §11.2` 의 `integration_action_required` 중복 방지 서술을 target(24h rolling window, `hasRecentByResource`)에 맞춰 갱신 — 두 spec 이 같은 기능을 다르게 설명하는 모순 해소.
3. `spec/1-data-model.md §2.19` Notification `type` Enum 에 `alert_<rule.type>` 3종(`alert_failure_rate`/`alert_duration`/`alert_llm_cost`) 추가 — V070 마이그레이션 실제 스키마와 데이터 모델 SoT 정합.
4. target 문서 Rationale 에 알림 읽음/dismiss endpoint 가 `2-api-convention.md §12.1` 표준 패턴이 아닌 이유(기존 sub-path 액션 정착, breaking change 회피)를 명시적으로 짝지어 서술 — 규약 문서와의 표류 방지.

---

## 후속 (재실행 결과 반영) — 최종 판정

3개 누락 checker(rationale_continuity / plan_coherence / naming_collision)를 재실행해 output 파일을
정상 생성했다. 결과: **5개 checker 전부 완료, Critical 0건 → 최종 BLOCK: NO.**

| Checker | 재실행 STATUS | Critical |
|---------|--------------|----------|
| Cross-Spec | (1차 완료) highest=WARNING | 0 |
| Convention Compliance | (1차 완료) highest=WARNING | 0 |
| Rationale Continuity | highest=NONE | 0 |
| Plan Coherence | highest=WARNING | 0 |
| Naming Collision | highest=NONE | 0 |

**WARNING 처분(본 team_invite 변경 관점):**
- Cross-Spec WARNING #1(§11.2 dedup 서술)·#2(data-model §2.19 Enum)·Convention WARNING #3(dismiss/read
  endpoint §12.1)은 **본 변경(team_invite channel 하향)과 무관한 기존 drift** — 알림 파이프라인 PR3
  이전부터 존재한 인접 spec 표류다. 본 plan 범위 밖이며 별도 grooming 대상(`spec-drift-gate-backlog`
  계열)으로 이월. team_invite 변경이 새로 유발한 위반은 없다.
- Plan Coherence WARNING 은 "옵션 (c) 채택 해소를 plan 체크박스/완료조건에 반영하고 plan/complete 로
  이동하라" 는 라이프사이클 지시 — 본 마무리 단계에서 수행하므로 커밋 시점에 해소된다.

target 문서(`spec/data-flow/8-notifications.md`) 및 동반 diff 는 BLOCK 사유 없음 → spec write 확정.
