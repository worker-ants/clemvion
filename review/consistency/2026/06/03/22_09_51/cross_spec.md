# Cross-Spec 일관성 검토 결과

## 검토 범위

- target: `spec/0-overview.md`, `spec/1-data-model.md`, `spec/2-navigation/0-dashboard.md`, `spec/2-navigation/1-workflow-list.md`
- 비교 대상: `spec/2-navigation/4-integration.md`, `spec/2-navigation/9-user-profile.md`, `spec/2-navigation/14-execution-history.md`, `spec/5-system/4-execution-engine.md`, `spec/data-flow/8-notifications.md`

---

## 발견사항

### [CRITICAL] Integration RBAC — `@Roles('editor')` vs Admin 이상 3-way 충돌

- **target 위치**: `spec/0-overview.md` §6.1 "워크스페이스 단위 Integration 공유·RBAC" 행
- **충돌 대상**:
  - `spec/2-navigation/4-integration.md` §8 권한 규칙 표 (조직: 생성/수정/Reauthorize/Rotate/Scope추가/삭제 = "Admin 이상")
  - `spec/2-navigation/9-user-profile.md` §4.2 역할 권한 매트릭스 (Integration 생성 Org = Owner✅ Admin✅ Editor❌ Viewer❌)
- **상세**:
  - `spec/0-overview.md` §6.1 은 "작성/수정/삭제(create·update·delete·rotate)는 `@Roles('editor')` 가드로 Editor+ 로 제한된다" 고 기술 → Editor 포함 허용.
  - `spec/2-navigation/4-integration.md` §8 은 "생성: Admin 이상" 으로 명시 → Editor 불허.
  - `spec/2-navigation/9-user-profile.md` §4.2 매트릭스에서 Editor 행이 ❌ → Editor 불허.
  - 세 문서가 동시에 canonical 로 유지되면 코드 레벨 가드 설계와 UI 표시가 분기를 가질 수밖에 없다. 코드 레퍼런스(`integrations.controller.ts`)는 overview 에 인용되어 있으므로 실제 구현이 어느 쪽인지를 확인한 후 나머지 두 문서 중 하나를 수정해야 한다.
- **제안**:
  - `codebase/backend/src/modules/integrations/integrations.controller.ts` 의 `@Roles` 데코레이터를 확인해 실제 구현 기준을 결정한다.
  - 구현이 `editor` 허용이라면: `spec/2-navigation/4-integration.md` §8 과 `spec/2-navigation/9-user-profile.md` §4.2 를 Editor✅ 로 통일.
  - 구현이 Admin 이상이라면: `spec/0-overview.md` §6.1 의 `@Roles('editor')` 표현을 `@Roles('admin')` 으로 수정.

---

### [WARNING] `0-overview.md` 내부 — Parallel 노드가 §6.1(완료)과 §6.2(부분구현) 양쪽에 동시 등장

- **target 위치**: `spec/0-overview.md` §6.1 "노드 시스템" 행 (Parallel 포함) + §6.2 "Parallel 노드 (P1+P2)" 행
- **충돌 대상**: 동일 문서 내 §6.1 ↔ §6.2
- **상세**:
  - §6.1 "노드 시스템" 표에서 구현 완료(✅) 항목으로 "Parallel" 을 Logic 노드 목록에 포함.
  - §6.2 "백엔드만 존재 / 부분 구현(🚧)" 섹션에도 "Parallel 노드 (P1+P2)" 가 독립 행으로 기재.
  - 문서를 처음 읽는 독자는 Parallel 의 구현 상태를 확정할 수 없다.
- **제안**:
  - §6.2 의 P1+P2 설명(branchCount, maxConcurrency, 중첩 제한 등)은 유지하되, §6.1 "노드 시스템" 셀의 Parallel 목록 포함이 "노드 타입 존재" 를 의미하고 §6.2 가 "UI 미노출 등 부분 상태" 임을 명확히 하는 주석을 추가하거나, §6.1 에서 Parallel 을 제거하고 §6.2 로 단일화한다.

---

### [INFO] `0-overview.md` §6.1 노드 시스템 목록에서 `cafe24` Integration 노드 누락

- **target 위치**: `spec/0-overview.md` §6.1 "노드 시스템" 행, Integration 절 `(HTTP·Database·Send Email)`
- **충돌 대상**: `spec/1-data-model.md` §2.6 Node.type 전체 목록 (`integration | cafe24` 행) + 동일 §6.1 "Cafe24 통합" 독립 행
- **상세**:
  - `spec/1-data-model.md` 에는 `integration` 카테고리 노드로 `cafe24` 가 포함된다.
  - `spec/0-overview.md` §6.1 의 "노드 시스템" 요약 표는 Integration 노드를 `HTTP·Database·Send Email` 세 종으로만 기술하고 `cafe24` 를 명시하지 않는다.
  - 같은 §6.1 의 "Cafe24 통합" 별도 행에서 `cafe24` 노드가 언급되므로 실질적 누락보다는 요약 표의 동기화 미흡에 가깝다.
- **제안**: `spec/0-overview.md` §6.1 "노드 시스템" 행의 Integration 노드 열거에 `Cafe24` 를 추가해 `1-data-model.md` Node.type 목록과 일치시킨다.

---

### [INFO] `9-user-profile.md` §5.1 알림 설정 표가 `background_failed`·`integration_action_required` 두 타입을 누락

- **target 위치**: `spec/1-data-model.md` §2.19 Notification.type Enum (7종: `execution_failed` / `background_failed` / `schedule_failed` / `integration_expired` / `integration_action_required` / `marketplace_update` / `team_invite`)
- **충돌 대상**: `spec/2-navigation/9-user-profile.md` §5.1 알림 유형별 채널 표 (5종: 워크플로우 실행 실패 / 스케줄 실행 실패 / Integration 만료 / 마켓플레이스 업데이트 / 팀 초대)
- **상세**:
  - `background_failed` 와 `integration_action_required` 가 데이터 모델에는 존재하지만 사용자 설정 화면 표에는 없다.
  - `background_failed` 는 `spec/4-nodes/1-logic/12-background.md` 에서 `notifyOnFailure: true` 조건부 발송임이 명시되어 있고, `integration_action_required` 는 `spec/2-navigation/4-integration.md` §11.2 에서 별도 정의된다. 두 타입이 "알림 설정 화면에서 채널 on/off 불가" 인지, 아니면 표 누락인지 불명확하다.
- **제안**: `spec/2-navigation/9-user-profile.md` §5.1 에 두 타입의 채널 정책(사용자 변경 가능 여부)을 추가하거나, "이 타입은 설정 불가 — 항상 in_app 발송" 임을 주석으로 명시해 의도를 드러낸다.

---

## 요약

이번 검토 대상(`spec/0-overview.md`, `spec/1-data-model.md`, `spec/2-navigation/0-dashboard.md`, `spec/2-navigation/1-workflow-list.md`) 중 가장 심각한 충돌은 Integration RBAC 규정의 3-way 불일치다. `0-overview.md` §6.1 은 Editor+ 가드를 코드 레퍼런스로 인용하고 있으나, `4-integration.md` §8 과 `9-user-profile.md` §4.2 는 Admin 이상을 요구한다. 실제 구현이 어느 쪽인지 단일 진실을 결정하고 나머지 두 문서를 갱신해야 한다. Parallel 노드의 §6.1/§6.2 중복 기재(WARNING)는 독자 혼란을 유발하지만 기능 자체의 작동 불가를 초래하지는 않는다. INFO 두 건(`cafe24` 노드 목록 누락, Notification 타입 설정 표 누락)은 문서 동기화 품질 이슈다.

## 위험도

HIGH
