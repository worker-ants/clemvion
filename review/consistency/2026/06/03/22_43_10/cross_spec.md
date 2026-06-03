# Cross-Spec 일관성 검토 결과

검토 범위: `spec/0-overview.md`, `spec/1-data-model.md`, `spec/2-navigation/0-dashboard.md`, `spec/2-navigation/1-workflow-list.md`
검토 모드: 구현 완료 후 검토 (--impl-done)

---

## 발견사항

### 1. [INFO] `workspace.owner_id` vs `workspace.ownerId` 명명 비일관성

- **target 위치**: `spec/1-data-model.md §2.2` — `owner_id` (snake_case 컬럼명)
- **충돌 대상**: `spec/2-navigation/9-user-profile.md §4.1` — "…`workspace.ownerId` 동기화"
- **상세**: 데이터 모델은 `owner_id` (snake_case)로 정의하지만, user-profile spec 의 Owner 이양 설명과 API 테이블(`POST /api/workspaces/:id/transfer-ownership` 설명)에서 `ownerId` (camelCase)로 혼용한다. 서로 다른 layer 의 표기(DB column vs DTO field)일 수 있으나, 같은 spec 내에서 혼용될 경우 혼동 유발 가능.
- **제안**: `spec/2-navigation/9-user-profile.md` 에서 DB 컬럼을 언급할 때는 `owner_id`, DTO 필드를 언급할 때는 `ownerId` 로 명확히 구분하거나, 둘이 같은 맥락이면 통일.

---

### 2. [INFO] `AssistantMessage` vs `WorkflowAssistantMessage` 엔티티 명 비일관성

- **target 위치**: `spec/1-data-model.md §2.22` — 엔티티명 `AssistantMessage`
- **충돌 대상**: `spec/3-workflow-editor/4-ai-assistant.md` 여러 곳 — `WorkflowAssistantMessage` entity 를 직접 언급
- **상세**: 데이터 모델은 `AssistantMessage` 로 정의하지만, AI Assistant spec 은 `WorkflowAssistantMessage` 라는 이름을 사용한다. 코드베이스의 실제 entity 명이 어느 쪽인지에 따라 한쪽이 spec drift 상태.
- **제안**: `spec/3-workflow-editor/4-ai-assistant.md` 를 `AssistantMessage` 로 통일하거나, `spec/1-data-model.md` 에 "코드베이스 entity class 명은 `WorkflowAssistantMessage`" 라는 주석을 추가해 두 spec 의 의도를 정렬.

---

### 3. [INFO] `successRate` 정의: `dashboard` vs `statistics` 간 분모 정책 명시 부재

- **target 위치**: `spec/2-navigation/0-dashboard.md §3` — "분모는 status 무관 7일 내 전체 실행 건수(running·pending·cancelled 포함)" + §7 응답 필드 설명 "completed / runs7d × 100"
- **충돌 대상**: `spec/2-navigation/7-statistics.md §2.2` — `Success Rate` 카드가 "성공 비율 (%)" 라고만 표기, 분모 정책 미기재
- **상세**: 대시보드는 분모를 "status 무관 전체 실행 건수(running·pending·cancelled 포함)" 로 명시하고 Rationale 에 근거를 남겼다. 통계 화면의 `Success Rate` 는 동일 지표인지, 혹은 `completed/(completed+failed)` 같은 다른 분모를 쓰는지 spec 에 명시가 없다. 두 화면이 다른 정의를 쓴다면 사용자 혼란을 일으킬 수 있다.
- **제안**: `spec/2-navigation/7-statistics.md §2.2` 에 `Success Rate` 분모 정의를 명시. 대시보드와 동일 정의라면 동일 명시, 다르면 의도적 차이임을 Rationale 로 기록.

---

### 4. [INFO] `spec/1-data-model.md` 의 Workspace §2.2 `settings` 필드: 편집 endpoint 참조 비일관성

- **target 위치**: `spec/1-data-model.md §2.2 Workspace.settings` — `편집: PATCH /api/workspaces/:id/settings` (Admin+) 로 기술
- **충돌 대상**: `spec/2-navigation/9-user-profile.md §6.1` — 동일 endpoint `PATCH /api/workspaces/:id/settings` 정의 존재
- **상세**: 모순은 없지만 데이터 모델 테이블 셀 안에 API endpoint 경로를 인라인으로 적어두어 단일 진실 원칙이 다소 흐려진다. 실질적 충돌은 아니나, 향후 endpoint 경로 변경 시 데이터 모델 문서를 추가로 갱신해야 하는 이중 유지보수 지점이 된다.
- **제안**: 데이터 모델 `settings` 필드 설명에서 endpoint 를 직접 기술하는 대신 "편집 방법은 [Spec 사용자/워크스페이스 §6.1](./2-navigation/9-user-profile.md) 참조" 형태로 포인터만 두는 방향 권장.

---

### 5. [INFO] `spec/1-data-model.md §2.19 Notification.type`: 분리 원칙 설명 중 `spec/2-navigation/4-integration.md` 경로 인라인 기재

- **target 위치**: `spec/1-data-model.md §2.19 Notification.type` 필드 셀
- **충돌 대상**: `spec/2-navigation/4-integration.md §11.2`
- **상세**: 모순 없음. 다만 데이터 모델 필드 정의 셀에서 `integration_action_required` / `integration_expired` 의 상세한 비교 설명이 인라인으로 작성되어 있고, 이는 사실상 Integration spec 의 비즈니스 로직 서술이다. 분리 원칙 설명이 `spec/2-navigation/4-integration.md §11.2` 에도 중복 존재할 경우 두 곳이 불일치할 위험.
- **제안**: 데이터 모델은 enum 값 나열만 하고 분리 원칙 상세는 Integration spec 으로 포인터만 두는 방향 검토.

---

## 요약

검토 대상 네 파일(`0-overview.md`, `1-data-model.md`, `0-dashboard.md`, `1-workflow-list.md`) 사이에서 **작동 불가를 일으키는 직접 모순(CRITICAL)** 이나 **즉각적 우선순위 결정이 필요한 잠재 충돌(WARNING)** 은 발견되지 않았다. 주요 API 계약(`GET /api/workflows?status=active|inactive`, `GET /api/dashboard/summary` 등), Execution status enum(6종), Node.category(7종), Trigger.type(webhook/schedule/manual), Integration.scope(personal/organization), WorkspaceMember.role(owner/admin/editor/viewer) 은 관련 spec 전반에서 일관되게 기술되어 있다. 다만 DB 컬럼명(`owner_id`)과 DTO 필드명(`ownerId`) 혼용, `AssistantMessage` vs `WorkflowAssistantMessage` 엔티티 명 불일치, 통계 화면의 `successRate` 분모 미명시 등 **명명·정의 동기화가 필요한 INFO 수준 항목** 4건이 확인되었다.

---

## 위험도

LOW
