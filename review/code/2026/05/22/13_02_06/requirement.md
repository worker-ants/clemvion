# 요구사항(Requirement) 리뷰 결과

> 대상 커밋: `0218cb318420974f92140782d421cde725a41dd0`
> 대상 파일: `triggers.service.spec.ts`, `triggers.service.ts`, `trigger-detail-drawer.tsx`, `en/triggers.ts`, `ko/triggers.ts`, `plan/in-progress/trigger-detail-edit-meta.md`

---

## 발견사항

### [CRITICAL] spec §2.3.1 및 PRD NAV-TR-10 이 spec 문서에 존재하지 않음

- 위치: 커밋 메시지, i18n 파일 주석, plan 문서의 spec 레퍼런스
- 상세: 커밋 메시지·plan 파일은 `spec/2-navigation/2-trigger-list.md §2.3.1` (필드 권한 매트릭스)와 PRD `NAV-TR-10` 을 근거로 명시하고 있다. 그러나 현재 `spec/2-navigation/2-trigger-list.md` 에는 §2.3.1 소섹션이 존재하지 않으며(`§2.3` 은 트리거 상세 패널 목차 수준으로 끝남), §3 에는 PATCH fine-print (schedule 타입에 대한 필드 제한 행위 명세) 가 없다. PRD `_product-overview.md` 에는 NAV-TR-01 ~ NAV-TR-08 만 있고 NAV-TR-09 · NAV-TR-10 이 존재하지 않는다. 코드가 참조하는 spec 본문 자체가 누락된 상태이므로 구현이 spec 에 기반하는지 검증 불가능하다. spec 결함이 의심되며 `project-planner` 위임이 필요하다.
- 제안: `project-planner` 에게 위임하여 `spec/2-navigation/2-trigger-list.md` 에 §2.3.1 필드 권한 매트릭스(schedule 타입 PATCH 제한 포함)와 §3 PATCH fine-print 를 추가하고, PRD `_product-overview.md` 에 NAV-TR-09 · NAV-TR-10 을 추가하도록 한다.

---

### [WARNING] `ExternalInteractionCard` 의 RBAC 가드 누락

- 위치: `trigger-detail-drawer.tsx` — `ExternalInteractionCard` 함수 내부
- 상세: `OverviewCard` 와 `WebhookConfigCard` 는 `useHasRole("editor")` 로 편집 버튼을 guard 하고 있다. 그러나 `ExternalInteractionCard` 의 편집 버튼(`{!editing ? <Button onClick={setEditing(true)}>편집</Button> ...}`) 에는 동일한 role guard 가 없다. viewer 가 External Interaction 섹션의 Edit 버튼을 클릭할 수 있게 된다. 커밋 메시지는 "viewer 역할: 모든 Edit 토글 비노출"이라고 명시하나 구현이 일치하지 않는다.
- 제안: `ExternalInteractionCard` 에도 `const canEdit = useHasRole("editor")` 를 추가하고 `!editing` 조건과 함께 `canEdit && !editing` 으로 렌더 조건을 변경한다.

---

### [WARNING] `WebhookConfigCard` 의 cancel 후 상태 오류 — `authType` / `hmacHeader` 초기화 기반이 stale

- 위치: `trigger-detail-drawer.tsx` — `WebhookConfigCard` 의 `cancelEdit()` 함수
- 상세: `cancelEdit()` 는 `setAuthTypeValue(authType)` 와 `setHmacHeaderValue(hmacHeader)` 를 호출한다. 여기서 `authType` 와 `hmacHeader` 는 컴포넌트 최초 렌더 시 `trigger.config?.authType ?? "none"` 와 `trigger.config?.hmacHeader ?? "X-Hub-Signature-256"` 로 초기화된 클로저 값이다. PATCH 성공 후 `onSaved()` → `queryClient.invalidateQueries` 가 실행되면 부모 drawer 가 새 데이터로 `trigger` prop 을 갱신하고 `WebhookConfigCard` 가 리마운트되므로 이 경우는 문제가 없다. 그러나 PATCH 성공과 무관하게 편집 도중 cancel 하는 경우 `authType` / `hmacHeader` 가 최초 마운트 시 값으로 복원되는 것은 의도된 동작이므로 현재 구현은 정확하다. 다만 `getCurlExample()` 내부는 `authType` (클로저) 를 참조하고 있어 편집 중 authType 이 바뀌어도 curl 예제는 갱신되지 않는다. 이는 UX 불일치이다.
- 제안: `getCurlExample()` 이 `authTypeValue` (편집 상태 값) 대신 `authType` (원본 값) 을 참조하는 점을 검토하고, 편집 모드 중 curl 예제를 숨기거나 `authTypeValue` 를 반영하도록 수정을 검토한다.

---

### [WARNING] `OverviewCard` 의 `saveDisabled` 로직이 trim 된 값과 원본을 비교

- 위치: `trigger-detail-drawer.tsx` — `OverviewCard` 의 `saveDisabled` 계산
- 상세: `saveDisabled` 는 `nameValue === trigger.name` 조건을 포함한다. 그러나 실제 저장 시에는 `nameValue.trim()` 이 전송된다. 사용자가 기존 이름에 공백만 추가하면 (`"daily"` → `"daily "`) `nameValue !== trigger.name` 이므로 Save 버튼이 활성화되고, 백엔드에 `"daily"` 가 전송된다. UI 상 변경된 것처럼 보이나 실제 저장 값이 동일하다. 심각한 결함은 아니나 `nameValue.trim() === trigger.name` 을 조건으로 사용하는 편이 더 정확하다.
- 제안: `saveDisabled` 를 `updateMutation.isPending || nameValue.trim().length === 0 || nameValue.trim() === trigger.name` 으로 변경한다.

---

### [WARNING] `ScheduleConfigurationCard` 의 deep link URL 이 `/schedules` 화면의 파라미터 수용 여부 미검증

- 위치: `trigger-detail-drawer.tsx` — `ScheduleConfigurationCard`
- 상세: 링크 URL 이 `/schedules?triggerId=${encodeURIComponent(trigger.id)}` 로 생성되어 있다. spec §2.3 은 "스케줄 관리에서 편집" 링크 → Schedule 화면 이동을 요구하며 NAV-SC-09 도 동일 방향을 명시한다. 그러나 `spec/2-navigation/3-schedule.md` 또는 Schedule 화면 코드가 `triggerId` 쿼리 파라미터를 수신하여 해당 schedule 을 하이라이트/필터하는 동작을 구현하고 있는지는 본 변경 범위에서 확인되지 않는다. 링크가 동작해도 Schedule 화면이 파라미터를 무시하면 사용자 경험 저하가 있다.
- 제안: Schedule 화면(`/schedules`)이 `triggerId` 쿼리 파라미터를 처리하는지 확인하고, 미구현이라면 해당 작업을 후속 plan 에 명시한다.

---

### [WARNING] 수용 기준 `HMAC secret / Bearer token 은 마스킹된 값으로 표시` 가 미충족

- 위치: `plan/in-progress/trigger-detail-edit-meta.md` — 수용 기준 4번
- 상세: plan 수용 기준 "HMAC secret / Bearer token 은 마스킹된 값으로 표시되고, 신규 입력만 plain 으로 받는다"는 아직 구현되지 않았다. plan 문서 자체는 별 plan 으로 분리됨을 명시하고 있다. 그러나 현재 `WebhookConfigCard` 는 편집 모드의 password input 에 placeholder `"•••••••• (leave blank to keep)"` 를 제공하고 기존 값을 노출하지 않는 write-only 방식이다. 이것은 보안상 올바른 처리이나, 수용 기준 문구가 "마스킹된 값으로 표시"(예: `••••ab12`)를 별도로 요구한다면 현행 구현은 기존 값 자체를 아예 표시하지 않는 방식으로 기준 문구와 다소 다르다. plan 이 수용 기준 미충족을 인지하고 명시적으로 분리 처리하고 있으므로 blocking issue 는 아니나, 수용 기준이 현재 상태로 4/6 충족이라고 표시된 점과 실제 기준 달성 여부를 재확인할 필요가 있다.
- 제안: plan 문서의 수용 기준에 미충족 기준을 명시적으로 "(후속 plan 으로 이관)" 표기하여 혼동을 방지한다.

---

### [INFO] spec §2.9.1 은 `Schedule is_active` 변경 시 Trigger 도 동기화를 명시하나, PATCH guard 의 범위 설계는 spec 명시 부재

- 위치: `triggers.service.ts` — schedule 타입 PATCH guard
- 상세: data-model §2.9.1 은 "Trigger is_active 변경 → Schedule is_active 동기화 (역방향도 동일)"를 명시한다. 코드는 schedule 타입 트리거에 대해 `isActive` 변경을 허용한다. 이는 §2.9.1 의 역방향 동기화 규칙과 일치한다. 그러나 `isActive` 변경 시 연결된 Schedule row 의 `is_active` 를 실제로 동기화하는 코드가 `update()` 내에 있는지는 이번 변경 범위에서 확인되지 않는다. spec 에 행위 명세가 있으나 구현 경로(backend trigger.update → schedule.is_active sync)가 이번 diff 에서 보이지 않는다.
- 제안: `TriggersService.update` 가 `isActive` 변경 시 `Schedule.is_active` 를 동기화하는 코드를 포함하고 있는지 확인한다. 미구현이라면 spec §2.9.1 준수 미달이다.

---

### [INFO] `ExternalInteractionCard.handleSave` 의 `window.location.reload()` 주석이 있으나 실제 코드에 남아 있음

- 위치: `trigger-detail-drawer.tsx` — `ExternalInteractionCard.handleSave`
- 상세: `handleSave` 내에 `// 페이지 reload 대신 query invalidate 가 이상적이지만 본 PR 은 단순 reload — drawer 가 재open 시 갱신.` 주석과 함께 `window.location.reload()` 호출이 실제 코드로 남아 있다. plan 문서는 "window.reload 금지"를 명시하고 있으며 OverviewCard / WebhookConfigCard 는 `queryClient.invalidateQueries` 를 사용한다. `ExternalInteractionCard` 는 EIA 카드로서 이번 변경의 직접 대상은 아니나, 동일 drawer 컴포넌트 내의 불일치이다.
- 제안: `ExternalInteractionCard.handleSave` 의 `window.location.reload()` 를 `queryClient.invalidateQueries` 방식으로 교체하는 후속 작업을 plan 에 추가한다.

---

### [INFO] `OverviewCard` 의 편집 가능 필드가 `name` 만이며 `isActive` 토글은 미포함

- 위치: `trigger-detail-drawer.tsx` — `OverviewCard`
- 상세: spec §2.3 의 기본 정보 섹션은 "이름, 유형, 상태, 연결된 워크플로우"를 포함한다. 현재 구현은 `name` 만 편집 가능하고 `isActive` 는 read-only 배지로만 표시된다. plan 수용 기준과 task 목록도 `name` 수정만을 명시하므로 의도된 범위이다. 다만 spec §2.3 에 "상태" 필드가 포함되어 있어 장기적으로 상태 편집도 드로어에서 가능해야 할 수 있다. 현재 커밋 범위에서는 INFO.
- 제안: 향후 `isActive` 토글 기능이 드로어에서도 제공되어야 하는지 spec 관점에서 확인한다.

---

## 요약

이번 변경은 Trigger 상세 드로어에 OverviewCard / WebhookConfigCard 편집 모드를 추가하고, ScheduleConfigurationCard 에 "스케줄 관리에서 편집" 딥링크를 구현하며, 백엔드에 schedule 타입 PATCH 키 제한 가드를 추가한 것이다. 핵심 기능 흐름(save → invalidate, RBAC guard, schedule PATCH 거부)은 대체로 올바르게 구현되었다. 그러나 커밋 메시지·plan 에서 근거로 제시한 `spec/2-navigation/2-trigger-list.md §2.3.1` 과 PRD `NAV-TR-10` 이 현행 spec 에 존재하지 않아 spec fidelity 점검이 불가한 CRITICAL 상황이며, `ExternalInteractionCard` 의 RBAC guard 누락도 "viewer 는 모든 Edit 토글 비노출" 요건을 위반한다. `spec-fidelity` 관점에서 spec 문서 자체의 보완이 선행되어야 하며, RBAC 누락은 즉시 수정이 필요하다.

---

## 위험도

**HIGH**

- CRITICAL: spec §2.3.1 · NAV-TR-10 이 spec 에 부재 → 구현의 spec 기반을 검증할 수 없음
- WARNING: `ExternalInteractionCard` RBAC guard 누락 → "viewer 는 Edit 불가" 수용 기준 위반
