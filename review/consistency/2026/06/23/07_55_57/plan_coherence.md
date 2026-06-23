# Plan 정합성 검토 결과

검토 모드: 구현 착수 전 검토 (--impl-prep, scope=spec/2-navigation)

## 발견사항

### [INFO] M-8 plan 과 target spec 의 정합성 — 충돌 없음, 의존 관계 명확

- target 위치: `spec/2-navigation/2-trigger-list.md §2.3.1 필드 권한 매트릭스`, `§3 API`
- 관련 plan: `/Volumes/project/private/clemvion/plan/in-progress/refactor/02-architecture.md` M-8 항목
- 상세: M-8 은 `trigger-detail-drawer.tsx` 리팩터링을 위해 `spec/2-navigation/2-trigger-list.md` 의 §2.3.1 카드 경계 매트릭스를 분리 기준으로 명시적으로 참조한다. target spec 이 해당 카드 경계(TriggerOverviewCard / WebhookConfigCard / AuthConfigCard / ChatChannelCard / EiaNotificationCard / ScheduleCard)를 이미 확립하고 있어 M-8 이 가정하는 설계 근거가 target 에 실재한다.
- 제안: 추가 조치 불요.

### [INFO] `spec/2-navigation/2-trigger-list.md` 의 `pending_plans` frontmatter 미등재 — M-8 plan 미참조

- target 위치: `spec/2-navigation/2-trigger-list.md` frontmatter
- 관련 plan: `/Volumes/project/private/clemvion/plan/in-progress/refactor/02-architecture.md` M-8 항목
- 상세: `spec/2-navigation/1-workflow-list.md` 은 frontmatter 에 `pending_plans: [plan/in-progress/spec-sync-workflow-list-gaps.md]` 를 등재하고 있으나, `spec/2-navigation/2-trigger-list.md` 의 frontmatter 에는 `pending_plans` 가 없다. M-8 이 이 spec 을 직접 구현 대상으로 삼으므로, 진행 중 plan 을 추적하는 `pending_plans` 항목 등재를 고려할 수 있다.
- 제안: 필수 아님(M-8 은 refactor 백로그 plan 으로 spec 자체에 대한 변경이 아니라 구현 리팩터링). 단 spec frontmatter 에 `pending_plans` 추가를 원할 경우 planner 트랙에서 처리.

### [INFO] TBD 미결정 항목(R-2, `hmacSecret` v1.1 rotate) — M-8 구현 범위와 직교

- target 위치: `spec/2-navigation/2-trigger-list.md §R-2 (Rationale)`, 라인 234 `TBD (미결정)`
- 관련 plan: `/Volumes/project/private/clemvion/plan/in-progress/refactor/02-architecture.md` M-8 항목
- 상세: spec 은 `hmacSecret` v1.1 rotate 의 응답 shape / grace 기간 / 경로 세그먼트를 `TBD (미결정)` 으로 명시한다. M-8 의 개선 방안은 §2.3.1 기존 카드 경계대로 분리하는 것이며 v1.1 rotate API 신설을 포함하지 않는다. M-8 이 이 미결정 항목을 일방적으로 결정하거나 구현할 범위는 없다.
- 제안: M-8 구현 시 rotate-bot-token(ChatChannel) 외에 `hmacSecret` rotate API 호출 UI 를 추가하지 않도록 주의. TBD 는 별도 spec 결정 트랙에서 처리.

### [INFO] `trigger-review-deferred-fixes.md` W1(endpoint_path 서버 검증 미강제) — M-8 구현과 간접 연관

- target 위치: `spec/2-navigation/2-trigger-list.md §3 API`, `spec/2-navigation/2-trigger-list.md §5 생성 정책`
- 관련 plan: `/Volumes/project/private/clemvion/plan/in-progress/trigger-review-deferred-fixes.md` W1 항목
- 상세: `trigger-review-deferred-fixes.md` W1 은 `endpoint_path` 의 서버 UUID 강제 검증 미적용 보안 사안이다. M-8 은 `lib/api/triggers.ts` 신설 시 `endpointPath` 생성 로직(`crypto.randomUUID()`)을 API wrapper 로 감싸게 된다. W1 이 미해소인 채로 M-8 이 API 레이어를 정리하면, 새 API wrapper 에도 클라이언트 측 UUID 생성이 그대로 유지된다. 두 plan 이 **충돌하지는 않으나** M-8 완료 후 W1 fix 에서 서버 강제 발급으로 전환할 경우 `lib/api/triggers.ts` 의 `endpointPath` 인수 전달 부분을 재방문해야 할 수 있다.
- 제안: M-8 구현 메모로 등록. W1 fix 착수 시 `lib/api/triggers.ts` 변경 범위 확인.

### [INFO] `spec-sync-schedule-gaps.md` frontend cluster 잔여 항목 — M-8 과 직교

- target 위치: `spec/2-navigation/3-schedule.md` (schedules 페이지)
- 관련 plan: `/Volumes/project/private/clemvion/plan/in-progress/spec-sync-schedule-gaps.md`
- 상세: `spec-sync-schedule-gaps.md` 에는 schedules 페이지의 frontend cluster 잔여 항목(더보기 메뉴·트리거 링크·워크플로 editor 링크·timezone 설정 UI)이 미착수 상태다. M-8 의 개선 방안 4번은 `m-2 의 triggers/page.tsx 와 같은 PR` 로 묶는 안을 제안하지만 schedules 는 포함되지 않는다. schedules frontend cluster 는 별도 plan 이 담당하며 M-8 과 충돌하지 않는다.
- 제안: 추가 조치 불요.

## 요약

`spec/2-navigation` target 은 `plan/in-progress/refactor/02-architecture.md` M-8 의 구현 착수 조건을 충분히 충족한다. M-8 이 참조하는 `§2.3.1 필드 권한 매트릭스`(카드 분리 경계)가 target spec 에 확립돼 있고, M-8 이 건드려서는 안 되는 미결정 사항(R-2 TBD, `inboundSigning` rotation v1 미정의, `endpoint_path` 서버 강제 발급)은 모두 M-8 의 리팩터링 범위 밖이다. CRITICAL 충돌 없음, 선행 plan 미해소 차단 없음. INFO 4건은 모두 구현 참고용이며 착수를 막지 않는다.

## 위험도

NONE
