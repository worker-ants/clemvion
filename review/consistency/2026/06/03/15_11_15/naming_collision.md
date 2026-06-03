# 신규 식별자 충돌 검토 — spec-draft-workspace-settings-api.md

## 발견사항

### [WARNING] `ADMIN_REQUIRED` 에러 코드 — spec §1.2 카탈로그 미등재, 의미 모호성
- **target 신규 식별자**: `ADMIN_REQUIRED` (403) — target 의 `spec/5-system/3-error-handling.md §1.2` 정식 등재 제안
- **기존 사용처**:
  - `codebase/backend/src/modules/workspaces/workspaces.service.ts:525` — `assertAdmin()` 이 이미 `code: 'ADMIN_REQUIRED'` 로 `ForbiddenException` 발행 중
  - `codebase/backend/src/modules/workspaces/workspace-invitations.service.ts` — 동일 `assertAdmin()` 패턴 사용
  - `codebase/backend/src/modules/workspaces/workspaces.controller.spec.ts:83` — 테스트에서 `ADMIN_REQUIRED` 코드 검증
- **상세**: 코드에서 이미 사용 중이지만 `spec/5-system/3-error-handling.md §1.2` 의 인증/인가 에러 카탈로그에 미등재. 현재 §1.2 는 `FORBIDDEN` (403, "역할 권한 부족") 만 등재되어 있음. `ADMIN_REQUIRED` 와 `FORBIDDEN` 이 동일한 403 HTTP 상태에 서로 다른 의미(더 세분화된 맥락)로 공존하게 됨. target 이 "정식 등재" 하려는 대상은 신규 도입이 아니라 이미 구현에 존재하는 코드인데, spec 의 §1.2 에는 없어서 FORBIDDEN 과의 관계가 불명확함.
- **제안**: `spec/5-system/3-error-handling.md §1.2` 에 `ADMIN_REQUIRED` 를 등재할 때 `FORBIDDEN` 과의 관계를 명시. 예: "`ADMIN_REQUIRED` (403) — 워크스페이스 내 admin 이상의 역할 요구 시 발행. 범용 역할 권한 부족(`FORBIDDEN`)의 워크스페이스 도메인 특화 코드." 로 구분해 두 코드가 겹치지 않음을 명확히 해야 함.

### [WARNING] `PATCH /api/workspaces/:id/settings` — 기존 `PATCH /api/workspaces/:id` 와의 경로 유사성
- **target 신규 식별자**: `PATCH /api/workspaces/:id/settings`
- **기존 사용처**:
  - `spec/2-navigation/9-user-profile.md:281` — `PATCH /api/workspaces/:id` (워크스페이스 이름 변경, Admin+)
  - `codebase/backend/src/modules/workspaces/workspaces.controller.ts:113` — `@Patch(':id')` 로 `renameWorkspace` 구현 중
- **상세**: target 은 두 엔드포인트의 의미 차이를 잘 설명하고 있음(`{ name }` rename 전용 vs `{ interactionAllowedOrigins }` settings 부분 갱신). 충돌은 없지만 `spec/2-navigation/9-user-profile.md §6.1` API 표에 기존 `PATCH /api/workspaces/:id` 의 body 스키마가 `{ name }` 임이 현재 명시되지 않아, 두 엔드포인트를 나란히 놓으면 독자가 "왜 settings 가 기존 PATCH 에 포함되지 않는가" 를 파악하기 어렵다.
- **제안**: target 이 §6.1 에 두 엔드포인트를 병기할 때 기존 `PATCH /api/workspaces/:id` 행에 `body: { name: string }` (rename-only) 를 명시하고, 신규 `PATCH /api/workspaces/:id/settings` 행에 `body: { interactionAllowedOrigins: string[] }` 를 명시하는 것으로 의미 분리를 표 수준에서 완성.

### [INFO] `spec/data-flow/12-workspace.md §1.7` — 신규 섹션 번호 충돌 없음, 단 기존 연속성 확인
- **target 신규 식별자**: `spec/data-flow/12-workspace.md §1.7` (워크스페이스 설정 변경 플로우 신설)
- **기존 사용처**: `spec/data-flow/12-workspace.md` 의 현행 최하위 섹션은 `§1.6 역할 변경 / 소유권 이전`. 파일 확인 결과 `§1.7` 은 미사용 — 번호 충돌 없음.
- **상세**: 번호 체계상 문제 없음. 단, data-flow 파일은 "Source → Sink" 시퀀스 흐름 문서이므로 `§1.7` 신설 시 기존 `§1.6` (역할 변경/소유권 이전) 이후에 논리적 순서로 배치되는지 확인 필요.
- **제안**: 번호 체계 충돌 없으므로 INFO 수준. 확인만.

### [INFO] `interactionAllowedOrigins` — 기존 키와 동일, 신규 도입 아님
- **target 신규 식별자**: `interactionAllowedOrigins` (settings JSONB 키)
- **기존 사용처**:
  - `spec/1-data-model.md §2.2` Workspace.settings 알려진 키로 이미 정의됨
  - `spec/7-channel-web-chat/4-security.md §2/§3` 에서 이미 참조됨
  - `spec/5-system/14-external-interaction-api.md §8.5` 에서 이미 참조됨
- **상세**: target 이 "편집 표면을 추가하는" 것이지 새 식별자를 도입하는 것이 아님. spec 상 이미 알려진 키로 정의되어 있으며 의미 충돌 없음. target 의 `spec/1-data-model.md §2.2` cross-ref 추가 작업은 이미 존재하는 정의에 편집 경로를 추가하는 것으로 적절.
- **제안**: 충돌 없음. 기존 정의와 일관되게 유지.

### [INFO] `useHasRole("admin")` — 기존 패턴과 일관성 확인
- **target 신규 식별자**: `useHasRole("admin")` 게이트 (UI 편집 권한 제어)
- **기존 사용처**: `codebase/frontend/src/app/(main)/workspace/settings/page.tsx:179,277` 에서 `useHasRole("admin")` 으로 기존 워크스페이스 설정 편집 제어 중
- **상세**: target 이 제안하는 `useHasRole("admin")` 패턴은 기존 워크스페이스 설정 페이지 (`workspace/settings/page.tsx`) 와 동일한 패턴. 이름 충돌 없고, 오히려 기존 관행과 일관됨. `ROLE_LEVEL` 상 owner≥admin 이므로 owner 도 편집 가능한 spec 요구사항과 일치.
- **제안**: 충돌 없음. 기존 구현 패턴과 일관.

---

## 요약

target 문서가 도입하는 신규 식별자는 전체적으로 기존 사용처와 심각한 충돌이 없다. 가장 주의해야 할 점은 `ADMIN_REQUIRED` 에러 코드인데, 이는 신규 도입이 아니라 코드에 이미 존재하는 코드를 spec 카탈로그에 등재하는 작업이다. 이때 `spec/5-system/3-error-handling.md §1.2` 에 이미 등재된 `FORBIDDEN` (403) 과의 의미 구분이 명시되지 않으면 두 코드가 같은 HTTP 상태(403)를 두 이름으로 다루게 되어 API 소비자 혼란이 발생할 수 있다. `PATCH /api/workspaces/:id/settings` 신규 엔드포인트는 기존 `PATCH /api/workspaces/:id` 와 겹치지 않으나, spec API 표에 두 엔드포인트의 body 스키마를 나란히 명시해야 의미 분리가 명확해진다. `interactionAllowedOrigins` 키, `§1.7` 섹션 번호, `useHasRole("admin")` 패턴 모두 충돌이 없다.

## 위험도

LOW
