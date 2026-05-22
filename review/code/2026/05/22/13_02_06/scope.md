# 변경 범위(Scope) 리뷰 결과

## 발견사항

### [INFO] ExternalInteractionCard — `canEdit` RBAC 가드 미적용
- 위치: `codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx` — `ExternalInteractionCard` 함수 (약 line 2535 이후)
- 상세: 이번 PR 의 핵심 목표 중 하나는 viewer 역할에게 Edit 토글을 숨기는 것이다 (`useHasRole("editor")` 가드). `OverviewCard`와 `WebhookConfigCard` 에는 `canEdit` 가드가 정상 적용됐으나, `ExternalInteractionCard` 의 Edit 버튼은 이번 diff 에서 변경되지 않았으며 기존 상태 그대로 `canEdit` 없이 노출된다. 이 카드는 이번 PR 이 건드리는 같은 파일, 같은 drawer 안에 있다.
- 평가: 이 함수 자체는 이전 PR 에서 구현된 것이고 이번 diff 에서 `ExternalInteractionCard` 내부 로직을 직접 수정하지는 않았다. 따라서 범위를 벗어난 수정은 아니다. 다만 plan §2 의 수용 기준 "EIA 카드의 기존 edit 흐름과 충돌 없음"을 언급하면서, viewer RBAC 누락이 동일 파일에 공존하는 점은 후속 이슈로 남는다.
- 제안: 이번 PR 범위를 벗어나므로 차단하지 않되, 별 plan 또는 다음 PR 에서 `ExternalInteractionCard` 에도 `useHasRole("editor")` 가드를 일관되게 적용할 것을 권장.

### [INFO] plan 파일 i18n 키 목록과 실제 구현 간 미세 불일치
- 위치: `plan/in-progress/trigger-detail-edit-meta.md` §3 (i18n 체크리스트)
- 상세: plan 의 §3 체크리스트에는 `triggers.detail.editName`, `triggers.webhook.editAuth.{none,hmac,bearer}`, `triggers.webhook.endpointPathChangeWarning`, `triggers.webhook.hmacSecretHelp`, `triggers.schedule.editInSchedule` 등의 키 경로가 기재돼 있다. 그러나 실제 구현된 i18n 키는 `triggers.detail.*` 단일 네임스페이스 하에 `endpointPathChangeWarning`, `hmacSecretHelp` 등을 모두 담았고, `triggers.webhook.*` / `triggers.schedule.*` 분리 구조는 사용되지 않았다. plan 이 아직 `in-progress` 상태이므로 이력 불일치에 해당하지만, 구현 코드 자체의 범위 문제는 아니다.
- 제안: plan 완료 시점(complete 이동)에 §3 체크리스트를 실제 키 경로로 정정할 것.

### [INFO] `WebhookConfigCard` — `window.confirm` 사용
- 위치: `codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx` — `updateMutation.mutationFn` 내부
- 상세: commit message 에 `window.confirm` 사용을 명시적으로 언급하고 plan 수용 기준에도 "cascading 경고 다이얼로그를 거친다"고 기재돼 있어, 의도된 구현이다. 범위 이탈이 아니며 단순 참고 사항으로 기록.
- 제안: 향후 modal 기반 확인 다이얼로그로 교체를 고려할 수 있으나 현재 기능 범위 내에서는 허용.

## 범위 이탈 여부 총평

5개 파일(backend spec, backend service, frontend drawer, 2개 i18n) + plan 업데이트 모두 커밋 메시지에 명시된 작업 범위(`spec/2-navigation/2-trigger-list.md §2.3.1` 필드 권한 매트릭스 구현) 안에 있다. 불필요한 리팩토링, 무관 파일 수정, 포맷팅 전용 변경, 미사용 임포트 추가는 발견되지 않았다. 추가된 임포트(`useMutation`, `useQueryClient`, `Input`, `Label`, `useHasRole`, `Pencil`, `ExternalLink`)는 모두 신규 기능에서 실제 사용된다. `ScheduleConfigurationCard` 의 기존 인라인 블록 추출은 "스케줄 관리에서 편집" 링크 추가와 결합된 최소 리팩토링으로, 기능 목적이 명확하다. plan 미충족 2건(`UNIQUE 409 매핑`, `hmacSecret 마스킹`)은 커밋 메시지에 명시적으로 별 plan 분리 사유가 기재돼 있어 의도된 deferrment 이다.

## 위험도

NONE
