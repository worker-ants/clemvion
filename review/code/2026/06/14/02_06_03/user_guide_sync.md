# 유저 가이드 동반 갱신(User Guide Sync) Review

## 발견사항

### [WARNING] 워크스페이스 설정 timezone API 노출 — user-guide 미갱신

- **변경 파일**: `codebase/backend/src/modules/workspaces/dto/update-workspace-settings.dto.ts`
- **매트릭스 항목**: `backend-api-change` — "API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지"
- **누락된 동반 갱신**:
  - `/Volumes/project/private/clemvion/codebase/frontend/src/content/docs/07-workspace-and-team/workspaces-and-members.mdx`
  - `/Volumes/project/private/clemvion/codebase/frontend/src/content/docs/07-workspace-and-team/workspaces-and-members.en.mdx`
- **상세**: `UpdateWorkspaceSettingsDto` 에 `timezone?: string` 필드가 추가돼 `PATCH /api/workspaces/:id/settings` 가 IANA 타임존 설정을 새로 수신한다. 이는 사용자가 "워크스페이스 설정 → 타임존" 을 통해 스케줄 기본 타임존을 제어할 수 있는 신규 capability 이다. 현재 `workspaces-and-members.mdx` / `.en.mdx` 에는 `timezone` 키워드 자체가 없으며, `interactionAllowedOrigins` 설정도 문서화되어 있지 않아 워크스페이스 settings API 가 사용자 가이드에 전혀 안내되지 않는 상태다. 이 변경으로 새 사용자 기능(스케줄 타임존 기본값 제어)이 추가됐으므로 관련 페이지 갱신이 필요하다.
- **제안**: `workspaces-and-members.mdx` + `.en.mdx` 에 워크스페이스 설정 섹션을 추가하거나, 기존 섹션에 "타임존 설정(`PATCH /api/workspaces/:id/settings` 의 `timezone` 필드): 스케줄 생성 시 타임존을 지정하지 않으면 여기 설정된 IANA 타임존을 기본값으로 사용한다 (미설정 시 `Asia/Seoul`)" 내용을 보강한다. 단, plan 파일 및 spec 모두 "workspace settings 폼의 timezone 입력 UI 는 frontend cluster 에서 별도 PR 처리 예정(Planned)" 으로 명시했으므로, frontend UI 가 없는 현 상태에서 API-only 기능임을 문서에도 명시하는 것이 적절하다. 이 WARNING 은 frontend UI 구현 PR 과 함께 일괄 반영해도 무방하나, API 레벨 안내는 지금 동반하는 것이 `backend-api-change` 매트릭스 규약이다.

---

### [INFO] spec `code:` 글로브 — workspace 구현 파일 미등재

- **변경 파일**: `spec/2-navigation/3-schedule.md`
- **매트릭스 항목**: `spec-major-change` — "frontmatter `code:` / `status:` / `pending_plans:` 정합 갱신 — `status: implemented` 이면 `code:` 글로브 ≥1 매치 보장"
- **누락된 동반 갱신**: 없음 (status 가 `partial` 이므로 `code:` 완전성 의무 미발동). 단, §2.2 의 실제 구현 파일인 아래 2건이 `code:` 목록에 없어 coverage tracking 관점에서 불완전하다:
  - `codebase/backend/src/modules/workspaces/workspaces.service.ts`
  - `codebase/backend/src/modules/workspaces/dto/update-workspace-settings.dto.ts`
- **상세**: `spec/conventions/spec-impl-evidence.md` 의 `code:` 글로브는 spec 약속이 어느 파일에 구현됐는지 추적하는 SoT 다. §2.2 타임존 fallback 은 schedules.service.ts 외에도 workspaces.service.ts 의 `resolveTimezone` 로직과 dto 가 핵심 구현을 담당한다. `status: partial` 에서는 `code:` 완전성 의무가 강제 차단되지 않으므로 CRITICAL/WARNING 으로 올리지 않는다.
- **제안**: 현재 PR 또는 frontend cluster PR 에서 `spec/2-navigation/3-schedule.md` 의 `code:` 에 `codebase/backend/src/modules/workspaces/workspaces.service.ts` 와 `codebase/backend/src/modules/workspaces/dto/update-workspace-settings.dto.ts` 를 추가하면 spec-coverage 추적이 더 정확해진다.

---

## 요약

매트릭스 총 19개 trigger 중 이번 변경 set (`schedules.service.ts`, `schedules.module.ts`, `workspaces.service.ts`, `update-workspace-settings.dto.ts`, `spec/2-navigation/3-schedule.md`, 테스트 파일 2건, `plan/in-progress/spec-sync-schedule-gaps.md`) 에 매칭되는 trigger 는 `backend-api-change`(dto 글로브 매치) + `spec-major-change`(spec/2-** 글로브 매치) 2건이다. 인증·권한·세션 흐름(`auth-session-flow-change`)은 auth 모듈이 아닌 workspace 모듈 변경이므로 미매칭. 누락 발견은 2건 — WARNING 1건(workspace-and-team 유저 가이드 미갱신, user-facing timezone API 노출에 대응하는 문서 부재), INFO 1건(spec code: 글로브 불완전, 강제 차단 불발동). 신규 `INVALID_TIMEZONE` 오류는 `error-codes.ts` 기반 ErrorCode enum 이 아니라 인라인 BadRequestException 이므로 `new-error-code` trigger 미매칭.

## 위험도

WARNING
