# Cross-Spec 일관성 검토 — target: `spec/2-navigation/`

검토 모드: 구현 착수 전 검토 (--impl-prep). 대상은 `spec/2-navigation/1-workflow-list.md` · `2-trigger-list.md` · `3-schedule.md` (프롬프트 예산 내 전문 로드) + `0-overview.md`(전문). 나머지 15개 파일(`4-integration.md` 등)은 조립 프롬프트가 컨텍스트 예산 초과로 절단해, 저장소의 실제 파일(`spec/1-data-model.md`, `spec/5-system/1-auth.md`, `2-api-convention.md`, `14-external-interaction-api.md`, `15-chat-channel.md`, `3-error-handling.md`, `spec/data-flow/10-triggers.md`, `11-workflow.md`, `spec/4-nodes/7-trigger/providers/_overview.md`)을 직접 읽어 대조했다.

## 검증한 교차 참조 (충돌 없음 확인)

아래는 target 문서가 다른 영역의 사실을 인용한 자리를 실제 SoT 문서와 대조해, **일치를 확인**한 항목이다 (발견사항이 아니라 검증 커버리지 기록):

- `Trigger.workflow_id` / `Trigger.workspace_id` 의 `ON DELETE CASCADE` (`2-trigger-list.md §4.3`) ↔ `spec/1-data-model.md §2.8` 실제 선언 — 일치.
- `Trigger.endpoint_path` 전역 UNIQUE (`2-trigger-list.md §2.3.1`/`§3`) ↔ `1-data-model.md §2.8` + `2-api-convention.md §12.2` (2026-09-18 V131/V132 결정) — 일치.
- `Folder` 제약 — `(workspace_id, parent_id, name)` UNIQUE·깊이 5·비순환 (`1-workflow-list.md §3.1`) ↔ `1-data-model.md §2.5` — 일치.
- `Workflow.settings.maxConcurrentExecutions` strict 검증 대상 단일 키 (`1-workflow-list.md §3.2`, Rationale §2) ↔ `1-data-model.md §2.4` + `5-system/4-execution-engine.md §8` (워크플로우당 기본 3) — 일치.
- Auth Config 권한 — "Add Config 는 Admin+ 전용, editor 는 binding 만" (`2-trigger-list.md §2.3.1`) ↔ `5-system/1-auth.md §3.2` 매트릭스(Auth Config: Owner/Admin=CRUD, Editor/Viewer=R) — 일치.
- 감사 액션 카탈로그 — `trigger.created/updated/deleted`, `trigger.notification_secret_rotated`, `trigger.chat_channel_bot_token_rotated`, `trigger.interaction_token_revoked` (`2-trigger-list.md §3`) ↔ `5-system/1-auth.md §4.1` 구현 액션 표 — 일치.
- `PATCH .../notification/rotate-secret`, `.../interaction/revoke-token` 엔드포인트·감사 매핑 (`2-trigger-list.md §3`) ↔ `5-system/14-external-interaction-api.md` EIA-NX-12 / EIA-AU-07 — 일치.
- `notification_secret_v2`/`chat_channel_token_v2` 저장 형태(평문 vs ref) 비대칭 서술 ↔ `14-external-interaction-api.md §7.1` + `15-chat-channel.md §R-K` — 일치.
- `isActive` 토글이 `PATCH /:id { isActive }` 단일 경로이고 `/toggle` 서브라우트가 없다는 것(R-4, `3-schedule.md §4`) ↔ `2-api-convention.md §12.1 상태 토글 패턴` — 일치.
- Chat Channel provider 3종(telegram/slack/discord) ↔ `4-nodes/7-trigger/providers/_overview.md §1` — 일치.
- 트리거 AuthConfig binding 에러 코드가 endpointPath 충돌 코드와 별개(§1.11 vs §1.10) ↔ `5-system/3-error-handling.md` — 일치.
- workflow 복제 범위(캔버스 전체 복제, 버전/트리거/데이터셋 미승계, `is_active=false`, "(Copy)" 접미) ↔ `data-flow/11-workflow.md §1.5` — 일치.

## 발견사항

- **[WARNING]** Folder 리소스가 중앙 RBAC 매트릭스(`5-system/1-auth.md §3.2`)에 없다
  - target 위치: `spec/2-navigation/1-workflow-list.md §3.1` (`POST/PATCH/DELETE /api/folders` 모두 `editor+` 로 게이트)
  - 충돌 대상: `spec/5-system/1-auth.md §3.2 "리소스별 권한 매트릭스"` — Workspace/Workflow/Trigger/Schedule/Integration/Knowledge Base/Auth Config/Model Config/Statistics/System Status/Marketplace/Audit Log 는 행이 있으나 **Folder 행이 존재하지 않는다** (`grep -in folder spec/5-system/1-auth.md` 0건).
  - 상세: 이 매트릭스는 §3.2 본문이 스스로 "리소스별 권한 매트릭스"라고 선언하며 Knowledge Base·Model Config 등 상대적으로 지엽적인 리소스까지 개별 행으로 열거한다. Folder 는 자신만의 CRUD API(`GET/POST/PATCH/DELETE /api/folders`)와 명시적 role 게이트(`editor+`)를 가진 독립 리소스인데 이 SoT 표에서 빠져 있다. 직접적인 값 모순(예: "Folder 는 viewer 도 쓸 수 있다"는 반대 서술)은 없으므로 CRITICAL 은 아니지만, 다음 사람이 §3.2 를 "전체 리소스 인가 목록"으로 신뢰하고 참조하면 Folder 권한 근거를 놓치거나, 향후 Folder 권한이 변경될 때 두 문서 중 하나만 갱신되는 drift 가 생기기 쉽다.
  - 제안: `5-system/1-auth.md §3.2` 표에 `Folder | CRUD | CRUD | CRUD | R` 행(Workflow 와 동일 floor)을 추가하거나, 최소한 "Folder 는 Workflow 하위 리소스로 동일 floor 를 따른다"는 각주를 남긴다. `spec/2-navigation/1-workflow-list.md` 는 수정 불필요 — SoT 쪽(auth.md)의 커버리지 갭.

## 검토 범위 제한 (참고, 발견사항 아님)

- `spec/2-navigation/4-integration.md`·`5-knowledge-base.md`·`6-config.md`·`8-marketplace.md`·`9-user-profile.md`·`_product-overview.md`·`0-dashboard.md`·`7-statistics.md`·`10-auth-flow.md`·`11-error-empty-states.md`·`13-user-guide.md`·`14-execution-history.md`·`15-system-status.md`·`16-agent-memory.md`·`_layout.md` 는 조립 프롬프트에서 컨텍스트 예산 초과로 본문이 절단되어 이번 라운드에서 직접 대조하지 못했다. 이 파일들과 다른 영역 간의 충돌 여부는 "발견 없음"이 아니라 "미검토"로 남는다 — 특히 `6-config.md`(Auth Config 화면), `4-integration.md`(Cafe24/MakeShop RBAC), `9-user-profile.md`(역할·권한 매트릭스 §4.2, `0-overview.md §6.1` 이 이 문서를 Integration RBAC 의 "상보 SoT"로 직접 인용한다)는 이번에 target 문서 자체가 아니라서 스코프 밖이지만, 후속 라운드에서 `2-navigation/` 전체를 다시 검토할 때는 이 절단 없이 재확인이 필요하다.
- `spec/1-data-model.md`(103,948자)도 원 프롬프트에서는 절단됐으나, 본 검토자가 저장소에서 직접 읽어 위 검증 목록에 반영했다.

## 요약

`spec/2-navigation/` (검토 가능했던 `1-workflow-list.md`/`2-trigger-list.md`/`3-schedule.md`)은 데이터 모델(엔티티 FK 동작·제약)·RBAC·감사 로그 액션·EIA 데이터 모델·Chat Channel provider 목록·API 공통 규약(상태 토글·유니크 범위)·data-flow(복제/내보내기/가져오기) 등 실제 SoT 문서와 대조한 10여 개 교차 참조 전부에서 사실 일치가 확인됐다 — 최근 데이터 모델 FK 정정(2026-09-19)·webhook endpoint_path 전역화(2026-09-18) 등 당일 변경사항까지 정확히 반영돼 있다. 유일한 발견은 CRITICAL 이 아닌 WARNING 하나로, Folder 리소스가 중앙 RBAC 매트릭스(`5-system/1-auth.md §3.2`)에서 개별 행으로 열거되지 않은 커버리지 갭이다(값 모순은 아님, SoT 완결성 문제). 다만 나머지 15개 navigation 문서는 프롬프트 예산 절단으로 이번 라운드에서 대조하지 못했으므로, 이 영역들에 대한 결론은 유보한다.

## 위험도
LOW
