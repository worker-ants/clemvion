# Plan 정합성 검토 — target: `spec/2-navigation/` (--impl-prep)

## 검토 범위에 대한 선행 고지 (중요)

번들이 컨텍스트 예산 초과로 `spec/2-navigation/` 18개 파일 중 **3개**
(`1-workflow-list.md` · `2-trigger-list.md` · `3-schedule.md`)만 본문을 실었고, 나머지 15개
(`4-integration.md`(168KB) · `5-knowledge-base.md` · `6-config.md` · `8-marketplace.md` ·
`9-user-profile.md` · `_product-overview.md` · `0-dashboard.md` · `7-statistics.md` ·
`10-auth-flow.md` · `11-error-empty-states.md` · `13-user-guide.md` · `14-execution-history.md` ·
`15-system-status.md` · `16-agent-memory.md` · `_layout.md`)는 "본문 생략됨 — 컨텍스트 예산
초과" 스텁으로만 존재한다. 이는 조립 실패가 아니라 **이미 트래킹 중인 harness 결함의 재발**이다
— `plan/in-progress/harness-review-gate-followups.md` "승격은 됐는데 굶는다 — tier 안의 거대
파일 하나가 corpus 몫을 다 먹는다"(2026-09-10 등재, 미해결 `[ ]`) 및
`plan/in-progress/spec-draft-nullable-notation-followups.md:4188` "`--impl-prep`/`--spec`
번들이 `spec/` 코퍼스를 통째로 절단한다"(2026-09-14 등재, 미해결 `[ ]`)가 같은 증상(꼬리 파일
전멸)을 이미 두 번 실측해 두었다. 아래 발견사항은 **본문이 실린 3개 파일에 한정**되며,
`4-integration.md`(연동/폴더 인접 영역) 등 나머지 15개 파일에 대한 정합성은 **이번 실행으로는
검증 불가**임을 밝힌다.

## 발견사항

- **[WARNING]** 새로 등재될 트래커 항목이 이미 "won't-do"로 정리된 아키텍처 결정을 다시 "결정
  필요"로 되돌릴 위험
  - target 위치: `spec/2-navigation/1-workflow-list.md §3.1`(`PATCH /api/folders/:id`) ·
    `§3`(`PATCH /api/workflows/:id`) — 두 endpoint 모두 이 문서의 `code:` 프런트매터가
    `codebase/backend/src/modules/folders/**` · `workflows.service.ts` 를 명시적으로 문다.
  - 관련 plan: `plan/in-progress/patch-body-followups.md` §방향 항목 6 (아직 미체크, 체크리스트
    전부 `[ ]`) vs `plan/in-progress/keyset-cursor-uuid-validation.md §A`(이미 `won't-do`로
    귀결).
  - 상세: `patch-body-followups.md` 는 실측으로 `PATCH /folders/:id { name: null }` ·
    `PATCH /workflows/:id { name/tags/isActive: null }` 등이 Postgres `NOT NULL` 위반
    (23502)으로 500 `INTERNAL_ERROR` 를 낸다는 걸 확인했고, 이를 "이 PR 의 축이 아니다"로
    미루면서 "처방(검증 데코레이터 **vs 필터의 23502 매핑**)이 결정 사항이라 트래커에 새 항목으로
    등재한다"고 적었다. 그런데 `keyset-cursor-uuid-validation.md §A`는 같은 저장소에서 **거의
    동일한 질문**(SQLSTATE 를 `GlobalExceptionFilter` 레벨에서 400 으로 재매핑할지)을 이미
    실측 기반으로 결론지었다 — "23502(앱이 만든 잘못된 row) → 500 유지(캐너리 2개가 고정 중)"를
    기존 설계로 명시하고, `spec/5-system/3-error-handling.md §1`(JWT 클레임 미검증 근거)과
    `spec/data-flow/12-workspace.md`(UUID 검증 강도 비대칭 Rationale)를 인용해 "필터는 값의
    출처를 모른다 · 저장소 전략은 입구마다 조기 거부이고 필터의 500 은 그 전략의 미이행
    알람이다 · 그래서 필터 대신 입구를 고쳤다"로 **일반 정책 수준에서 필터 매핑을 기각**했다.
    새로 등재될 트래커 항목이 이 선례를 인용하지 않으면, 다음 담당자가 "결정 사항"이라는
    문구만 보고 이미 기각된 "필터의 23502 매핑" 쪽을 다시 검토하거나 채택할 위험이 있다.
  - 제안: `patch-body-followups.md` §방향 6이 실제로 트래커에 새 항목을 적을 때
    `keyset-cursor-uuid-validation.md §A`를 근거로 교차 인용해 "필터 매핑은 이미 기각된 방향"
    임을 명시하고, 항목 범위를 "PATCH DTO 마다 필드 단위 `@IsNotEmpty()`/`nullable` 선언 정합"
    으로 좁혀 적을 것. (patch-body-followups.md 는 아직 체크리스트가 전부 미완료 상태이므로
    지금은 실제 충돌이 아니라 **다음 단계에서 발생할 수 있는 리스크**다.)

- **[INFO]** `spec/2-navigation/2-trigger-list.md §2.3.1` 의 `eia-trigger-edit-ui` plan 참조가
  여전히 dangling
  - target 위치: `2-trigger-list.md:133` (External Interaction (Notification) 행,
    "별 plan `eia-trigger-edit-ui` 가 구현")
  - 관련 plan: 저장소 전체에 `eia-trigger-edit-ui` 라는 이름의 plan 파일이 없음(`plan/in-progress`,
    `plan/complete` 모두 grep 0건).
  - 상세: 이미 `plan/complete/spec-draft-webhook-endpoint-path-global-unique.md:192`가 이
    dangling 참조를 "이 변경과 무관한 기존 상태, 조치 안 함"으로 명시 triage 했다 — 새로
    발견된 문제가 아니라 **기지(旣知) 사안**이다. 재조치를 요구하는 것이 아니라, 현재도 해소되지
    않은 채 남아 있음을 기록해 둔다.
  - 제안: 조치 불요(이미 triage 완료). 다음에 `2-trigger-list.md` 를 다른 사유로 편집할 기회가
    있으면 그 참조를 실제 구현 PR/plan 이름으로 갱신하거나 제거를 고려.

## 요약

본문이 실제로 실린 `1-workflow-list.md` · `2-trigger-list.md` · `3-schedule.md` 세 파일
범위에서는 `plan/in-progress/**` 와 충돌하는 미해결 결정이나 무효화된 후속 항목을 찾지 못했다.
`marketplace-and-plugin-sdk.md`(워크플로 목록 §2.7 Planned 표기) · `spec-sync-auth-gaps.md`
(audit action 오기 정정)는 이미 target 과 정합한 상태로 반영돼 있었다. 유일한 리스크는
`patch-body-followups.md` 가 다음 단계에서 새로 등재할 트래커 항목이 `keyset-cursor-uuid-
validation.md` 가 이미 기각한 "필터의 23502 매핑" 옵션을 인용 없이 다시 "결정 사항"으로
띄울 가능성이다(WARNING, 아직 미발생·다음 단계 리스크). 다만 이번 실행은 컨텍스트 예산 초과로
`4-integration.md` 등 15개 파일을 전혀 검증하지 못했으므로, 이 리포트는 `spec/2-navigation/`
전체가 아니라 위 3개 파일에 대한 부분 인증으로 읽어야 한다.

## 위험도

LOW
