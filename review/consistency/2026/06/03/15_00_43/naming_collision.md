# 신규 식별자 충돌 검토 — spec-draft-workspace-settings-api

## 발견사항

### [INFO] `ADMIN_REQUIRED` 에러 코드 — spec 미등재이나 코드에서 이미 사용 중
- **target 신규 식별자**: `403 ADMIN_REQUIRED` (시퀀스 다이어그램의 `alt role ∉ {owner, admin}` 분기)
- **기존 사용처**: `codebase/backend/src/modules/workspaces/workspaces.service.ts:525` — `assertAdmin()` 내부에서 `code: 'ADMIN_REQUIRED'` 를 이미 발행. `workspaces.service.spec.ts:325`, `workspaces.controller.spec.ts:83` 에서도 동일 코드 참조.
- **상세**: 충돌은 아니다. target 이 새로 발명하는 코드가 아니라 기존 `WorkspacesService.assertAdmin()` 가 이미 발행하는 코드이므로 재사용이 자연스럽다. 다만 `spec/conventions/error-codes.md` 의 카탈로그(`spec/5-system/3-error-handling.md`)에 `ADMIN_REQUIRED` 가 공식 등재되어 있지 않다. spec 에서 "403 ADMIN_REQUIRED" 를 처음 문서화하는 셈이 되어 향후 다른 도메인에서 같은 코드를 다른 의미로 재정의할 위험이 생긴다.
- **제안**: target spec 에 "이 에러 코드는 기존 `WorkspacesService.assertAdmin()` 가 발행하는 `ADMIN_REQUIRED` 를 재사용" 임을 명시하고, `spec/5-system/3-error-handling.md` 카탈로그에 `ADMIN_REQUIRED` 를 정식 등재하는 후속 작업을 plan 에 추가.

### [INFO] `PATCH /api/workspaces/:id/settings` — 기존 PATCH 엔드포인트와 경로 분리는 적절하나 spec 기재 위치 점검 필요
- **target 신규 식별자**: `PATCH /api/workspaces/:id/settings`
- **기존 사용처**: `spec/2-navigation/9-user-profile.md:281` — `PATCH /api/workspaces/:id` (워크스페이스 이름 변경, Admin+). `spec/data-flow/12-workspace.md` — 동일 엔드포인트 목록 포함.
- **상세**: 경로가 다르므로 HTTP endpoint 충돌은 없다. target 의 Rationale 에서도 기존 `PATCH /:id` 가 `name` 필수(rename 전용)라 분리한 근거를 명확히 밝히고 있다. 다만 신규 엔드포인트 `PATCH /api/workspaces/:id/settings` 가 현재 `spec/2-navigation/9-user-profile.md §6.1 API 표` 및 `spec/data-flow/12-workspace.md §1` 에 기재되어 있지 않다. target 이 `data-flow/12-workspace.md §1.x` 신설을 언급하고 있으나, `9-user-profile.md` API 표에도 동일 엔드포인트 행을 추가해야 단일 진실이 완성된다.
- **제안**: target spec 영향 목록에 `spec/2-navigation/9-user-profile.md §6.1 API 표` 추가 행을 포함.

### [INFO] `useHasRole("admin")` — target 이 도입하는 프론트엔드 hook 호출 패턴
- **target 신규 식별자**: UI 명세에서 `useHasRole("admin")` 으로 owner+admin 판별 제안
- **기존 사용처**: `codebase/frontend/src/app/(main)/workspace/settings/page.tsx:179,277` 에서 이미 `useHasRole("admin")` 을 owner+admin 접근 제어에 사용 중.
- **상세**: 충돌이 아니라 기존 패턴과 일치한다. target 이 새 패턴을 발명하는 것이 아니라 기존 관례를 따른다. 다만 `spec/5-system/1-auth.md §3.2` RBAC 매트릭스에서 "Workspace 설정"은 owner=CRUD, admin=RU 로 정의되어 있으므로 `useHasRole("admin")` 이 owner 도 포함하는 "admin 이상" 의미인지 코드 semantics 를 확인할 필요가 있다(hook 이 "admin 이상" 을 리턴하는지 "admin 정확 일치" 인지에 따라 owner 가 배제될 수 있음).
- **제안**: `useHasRole` 의 semantics("admin 이상" vs "admin 정확히") 를 spec 에 명시. 현재 코드(`workspace/settings/page.tsx:179`)가 owner 도 같은 섹션을 편집할 수 있는 형태라면 hook semantics 가 "admin 이상" 임을 확인하는 것으로 충분.

### [INFO] `notification_url_allow_pattern` — Workspace.settings 의 다른 알려진 키와의 혼동 가능성
- **target 신규 식별자**: `interactionAllowedOrigins` (Workspace.settings JSONB 키)
- **기존 사용처**: `spec/5-system/14-external-interaction-api.md:621` — `workspace_settings.notification_url_allow_pattern` 이라는 다른 설정 키가 언급됨. `spec/1-data-model.md §2.2` 의 "알려진 키" 목록에는 `timezone` 과 `interactionAllowedOrigins` 만 열거되어 있음.
- **상세**: `interactionAllowedOrigins` 는 이미 `spec/1-data-model.md §2.2` 에 등재된 키로 target 이 신규 발명하는 것이 아니다. 충돌이나 중복이 없다. 다만 `notification_url_allow_pattern` 이라는 EIA spec 의 언급이 "알려진 키" 목록 밖에 따로 존재하여 Workspace.settings 의 완전한 키 목록이 분산되어 있는 상황이다. target 이 `spec/1-data-model.md §2.2` 의 cross-ref 를 강화하는 시점에 이 점도 함께 확인 권장.
- **제안**: 별도 작업으로, `spec/1-data-model.md §2.2` "알려진 키" 목록에 `notification_url_allow_pattern` 이 실제 키인지 확인 후 포함 여부 결정.

---

## 요약

target 문서(`spec-draft-workspace-settings-api`)가 도입하는 식별자(`PATCH /api/workspaces/:id/settings`, `ADMIN_REQUIRED`, `interactionAllowedOrigins`, `useHasRole("admin")`)는 기존 사용처와 **의미 충돌이 없다**. `ADMIN_REQUIRED` 에러 코드는 기존 `WorkspacesService.assertAdmin()` 가 이미 발행하는 코드를 재사용하는 것이며, `interactionAllowedOrigins` 는 이미 `spec/1-data-model.md §2.2` 에 등재된 키다. `PATCH /api/workspaces/:id/settings` 는 기존 `PATCH /api/workspaces/:id` 와 경로가 분리되어 endpoint 충돌이 없다. 다만 `ADMIN_REQUIRED` 가 공식 에러 코드 카탈로그에 미등재인 점, 신규 endpoint 가 `spec/2-navigation/9-user-profile.md` API 표에 미기재인 점이 후속 보완 사항으로 남는다.

## 위험도

LOW
