# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-workspace-settings-api.md`

검토 모드: spec draft 검토 (--spec)
검토 일시: 2026-06-03

---

## 발견사항

### 1. [WARNING] API 응답 포맷 — `{ workspace }` 표기가 `{ data: ... }` 래핑 규약과 불일치
- **target 위치**: `## 변경 내용 > data-flow/12-workspace.md` 섹션의 sequenceDiagram — `Svc-->>C: 200 { workspace }`
- **위반 규약**: `spec/conventions/swagger.md §2-5` 및 `spec/5-system/2-api-convention.md §5.1` — 프로젝트는 `TransformInterceptor` 로 모든 성공 응답을 `{ data: ... }` 로 감싼다. Swagger 응답 스키마 표기 시에도 이 구조를 반영해야 한다.
- **상세**: 시퀀스 다이어그램의 응답 표기가 `200 { workspace }` 로 되어 있어 실제 API 계약(`{ data: { ...workspace } }`)과 다른 형태를 spec 에 기술하고 있다. 구현자가 이 draft 를 그대로 따르면 응답 래핑 계층을 누락할 수 있다.
- **제안**: `200 { data: workspace }` 로 정정. data-flow spec 에 반영 시에도 동일하게 수정.

---

### 2. [WARNING] 에러 코드 `ADMIN_REQUIRED` — 기존 카탈로그에 미등재된 인라인 코드
- **target 위치**: `## 변경 내용` 섹션의 sequenceDiagram — `Svc-->>C: 403 ADMIN_REQUIRED`
- **위반 규약**: `spec/conventions/error-codes.md §1` (의미 기반 명명 + 도메인 prefix 권장) 및 `spec/5-system/3-error-handling.md §1.2` (인가 에러 카탈로그)
- **상세**: `ADMIN_REQUIRED` 는 현재 코드베이스에서 `workspaces.service.ts` 에서 인라인 문자열로 발행되고 있으나, `spec/5-system/3-error-handling.md §1.2` 의 공식 인가 에러 카탈로그에는 `FORBIDDEN` 만 정의되어 있고 `ADMIN_REQUIRED` 는 등재되지 않았다. 에러 코드 컨벤션(`spec/conventions/error-codes.md §2`)은 에러 코드 rename 이 breaking change 이므로, 이미 인라인 코드로 사용 중인 경우 spec 카탈로그에 명시적으로 등재하거나 기존 코드인 `FORBIDDEN` 을 사용하는 것이 규약에 부합한다. Draft 에서 신규 코드인 것처럼 사용하고 있지만 spec SoT(`3-error-handling.md`)에 등재가 없다.
- **제안**: (a) `3-error-handling.md §1.2` 에 `ADMIN_REQUIRED | 관리자 권한 필요 | 역할이 owner/admin 이 아님 | 403` 행을 추가하는 것을 "영향 spec" 항목으로 명시하거나, (b) 기존 `FORBIDDEN` 코드를 사용하고 시퀀스 다이어그램도 `403 FORBIDDEN` 으로 표기. 어느 방향이든 draft 에서 명시적으로 선택해야 함.

---

### 3. [WARNING] Plan 문서에 spec 갱신 내용이 "영향 spec" 목록에만 있고 정식 phase 로 없음
- **target 위치**: `## 영향 spec` 섹션 전체
- **위반 규약**: CLAUDE.md memory `feedback_plan_must_include_spec_updates` — 구현 plan 은 spec 갱신까지 정식 phase 로 포함해야 하며, "영향 spec" 목록 한 줄로 묶지 말 것.
- **상세**: 대상 문서는 `## 영향 spec` 섹션에서 4개의 spec 파일 갱신이 필요함을 열거하고 있으나, 각 spec 을 어떻게 갱신할지(before/after, 대상 §, 구체 문구)를 정식 phase 로 분리하지 않았다. Plan-lifecycle 규약(`plan-lifecycle.md §2`)에 따르면 "남은 작업"이 있으면 체크박스를 포함한 구체 항목이 있어야 한다. 또한 memory 피드백 규약은 구현 plan 이 spec 갱신을 별도 phase 로 두도록 강제한다.
- **제안**: `## Phase N: Spec 갱신` 섹션을 신설하고 영향 4개 spec 파일 각각에 대해 (대상 파일 · § 위치 · before/after 또는 추가 내용)를 체크박스로 나열.

---

### 4. [INFO] Plan frontmatter `worktree` 값이 실존하지 않는 worktree 를 가리킴
- **target 위치**: frontmatter `worktree: workspace-allowed-origins-settings`
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4` — `worktree` 필드는 이 plan 이 살아있는 worktree 디렉토리 이름을 명시한다.
- **상세**: `.claude/worktrees/` 하위에 `workspace-allowed-origins-settings` 디렉토리가 존재하지 않는다. 현재 worktree 목록에는 해당 이름의 디렉토리가 없어 동시 작업 추적 및 consistency-checker 의 `plan_coherence` 검사에서 불일치가 발생할 수 있다.
- **제안**: worktree 가 아직 미생성이라면 `ensure-worktree.sh workspace-allowed-origins-settings` 로 생성 후 plan 을 해당 worktree 안으로 이동. 또는 현재 작업이 다른 worktree 에서 진행 중이라면 frontmatter 를 실제 worktree 이름으로 수정.

---

### 5. [INFO] Spec 링크 경로가 `../../spec/...` 상대경로 — plan/in-progress 내 위치에 의존
- **target 위치**: `## 영향 spec` 및 본문의 링크들 — 예: `[1-auth §3.2](../../spec/5-system/1-auth.md)`, `[7-channel-web-chat/4-security §3](../../spec/7-channel-web-chat/4-security.md)`
- **위반 규약**: 명시적 금지 규약은 없으나, plan 문서는 `plan/in-progress/` 에 위치하며 여기서의 `../../spec/` 상대경로는 구조적으로 맞다. 단, worktree 안에서 작성 중인 이 문서(`feat-web-chat-demo/plan/in-progress/...`)에서는 `../../spec/` 가 `feat-web-chat-demo/spec/` 를 가리키므로 실제 `spec/` 루트와 다를 수 있다.
- **상세**: worktree 내 plan 파일의 `../../spec/` 링크는 worktree 로컬 `spec/` 을 가리키는데, worktree 가 sparse 또는 별 구조일 경우 링크 해석이 달라질 수 있다. 현재 이 draft 는 `feat-web-chat-demo` worktree 에 있으므로 해당 worktree 의 spec 경로를 가리킨다.
- **제안**: 링크 정확성 확인 필요. worktree 가 `workspace-allowed-origins-settings` 로 이동되면 경로가 동일하게 동작하는지 검증.

---

## 요약

대상 plan 문서(`spec-draft-workspace-settings-api.md`)는 frontmatter 스키마(worktree/started/owner 3필드)를 올바르게 갖추고 있으며 `## Rationale` 섹션도 포함하고 있다. 그러나 두 가지 실질적 규약 위반이 있다: (1) API 응답 포맷이 프로젝트 전역 `{ data: ... }` 래핑 규약을 반영하지 않고 `{ workspace }` 로 표기되어 구현 오류를 유도할 위험이 있고, (2) `ADMIN_REQUIRED` 에러 코드가 공식 에러 카탈로그(`3-error-handling.md §1.2`)에 미등재된 채로 spec draft 에 사용되어 에러 코드 명명 안정성 규약과 충돌한다. 추가로 구현 plan 이 spec 갱신 내용을 정식 phase 로 분리하지 않은 점은 CLAUDE.md memory 피드백 규약 위반이며, `worktree` frontmatter 값이 실존하지 않는 디렉토리를 가리키는 점은 추적 정합성에 영향을 준다.

---

## 위험도

**MEDIUM**
