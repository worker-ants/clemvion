# 정식 규약 준수 검토 결과

**검토 모드**: spec draft (`--spec`)
**Target**: `plan/in-progress/spec-draft-workspace-settings-api.md`
**검토 일시**: 2026-06-03

---

## 발견사항

### [WARNING] plan 문서는 spec 규약 적용 대상 아님 — 검토 범위 명확화
- **target 위치**: 문서 전체 (plan 파일)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §1` 적용 대상
- **상세**: `spec/conventions/spec-impl-evidence.md §1` 의 frontmatter 의무 대상은 `spec/2-navigation/**`, `spec/5-system/**` 등 `spec/` 경로의 파일이다. `plan/in-progress/*.md` 는 spec 규약의 적용 대상이 아니고 plan-lifecycle frontmatter 스키마를 따른다. 따라서 "spec draft 규약 준수" 검토는 plan 파일 자체보다 **plan 이 예정한 spec 파일들이 작성된 이후** 에 수행해야 한다.
- **제안**: 본 검토는 plan 이 기술한 "Phase: Spec 갱신" 에서 실제 작성될 각 spec 파일이 규약을 따르는지를 사전 점검하는 의미로 해석하고 아래 항목들을 분석한다.

---

### [INFO] Frontmatter — plan 규약 정상 준수
- **target 위치**: 파일 상단 frontmatter (line 1-5)
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4` Frontmatter 스키마
- **상세**: `worktree`, `started`, `owner` 세 필드가 모두 존재하며 값 형식도 규약(`worktree: feat-web-chat-demo`, `started: 2026-06-03` ISO 날짜, `owner: project-planner`)에 부합한다. 위반 없음.
- **제안**: 유지.

---

### [WARNING] 계획된 spec 파일 `spec/5-system/3-error-handling.md` 갱신 항목에 error code 명명 규약 선행 검증 필요
- **target 위치**: "Phase: Spec 갱신" > `spec/5-system/3-error-handling.md §1.2` 항목
- **위반 규약**: `spec/conventions/error-codes.md §1` (의미 기반 명명), `spec/conventions/error-codes.md §2` (안정성/rename 정책)
- **상세**: plan 은 `ADMIN_REQUIRED`(403) 를 에러 코드 카탈로그에 정식 등재하겠다고 명시한다. 그러나 현재 `spec/5-system/3-error-handling.md §1.2` 카탈로그를 보면 의미상 유사한 `FORBIDDEN`(403, "역할 권한 부족") 이 이미 등재돼 있다. `ADMIN_REQUIRED` 와 `FORBIDDEN` 은 의미 중복 가능성이 있다. `error-codes.md §1` 은 "의미가 분기될 때만 신설"을 원칙으로 한다. 실제 `assertAdmin()` 이 발행하는 코드가 `ADMIN_REQUIRED` 라면 기존 `FORBIDDEN` 과 다른 의미(권한 종류, 컨텍스트)인지를 spec 문서에 명시해야 하며, 그렇지 않으면 `FORBIDDEN` 을 재사용하거나 `ADMIN_REQUIRED` 를 historical-artifact 레지스트리(`error-codes.md §3`)에 동시 등재해야 한다.
- **제안**: `spec/5-system/3-error-handling.md §1.2` 에 `ADMIN_REQUIRED` 를 등재할 때 `FORBIDDEN` 과의 의미 차이를 명시하거나, `assertAdmin()` 이 발행하는 코드가 실제로 `ADMIN_REQUIRED` 인지 구현 코드를 확인해 규약(`error-codes.md §1·§3`)에 맞게 처리한다.

---

### [WARNING] 계획된 API endpoint 경로 표기 — spec 파일 작성 시 Swagger 규약 반영 확인 필요
- **target 위치**: "결정" 섹션 및 sequenceDiagram 내 `PATCH /api/workspaces/:id/settings`
- **위반 규약**: `spec/conventions/swagger.md §2-4`, `§5-4`
- **상세**: plan 이 제안하는 신규 endpoint `PATCH /api/workspaces/:id/settings` 는 plan 수준의 기술로 규약 위반이 아니나, 실제 구현 시 swagger.md 규약에 따라 (a) `@ApiForbiddenResponse` 추가 의무(`@Roles(...)` 가 붙은 엔드포인트), (b) path UUID 파라미터 `@ApiParam({ format: 'uuid' })` 적용, (c) 응답 래퍼 헬퍼 `ApiOkWrappedResponse(WorkspaceResponseDto)` 사용이 요구된다. plan 에는 "응답 래핑: `{ data: workspace }`([2-api-convention §5.1])" 로 올바르게 적혀 있어 의식은 있으나, 구현 phase 에서 swagger.md §5-4 체크리스트 전체를 따라야 한다.
- **제안**: 구현 phase plan 에 swagger.md §5-4 체크리스트를 명시적으로 포함하거나, developer SKILL 을 통해 구현 착수 시 해당 규약을 확인한다. spec 갱신 문서 자체에는 별도 위반 없음.

---

### [INFO] 문서 구조 — 3섹션 (Overview / 본문 / Rationale) 권장 구조 부합
- **target 위치**: 문서 전체 구조
- **위반 규약**: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)"
- **상세**: plan 문서는 spec 파일이 아니므로 3섹션 의무 대상이 아니다. 그러나 본 문서는 "## 결정", "## ★ 빈 배열 의미", "## Phase: Spec 갱신", "## data-flow/12-workspace.md §1.7", "## UI", "## Rationale" 구조를 갖추어 충분한 가독성을 제공한다. plan 문서로서 위반 없음.
- **제안**: 유지. 단, 실제 spec 파일 작성 시 `spec/2-navigation/9-user-profile.md`, `spec/data-flow/12-workspace.md` 등에 Overview 섹션이 없다면 `## Overview` 또는 문서 도입부를 CLAUDE.md 권장 구조에 맞게 구성해야 한다.

---

### [INFO] 계획된 spec 참조 경로가 worktree 상대경로로 기술됨
- **target 위치**: "결정" 및 전체 문서 내 링크 (예: `../../spec/2-navigation/9-user-profile.md`)
- **위반 규약**: CLAUDE.md 정보 저장 위치 (단일 진실 원칙)
- **상세**: plan 문서 내 cross-reference 링크가 `../../spec/...` 형태로 worktree 상대경로를 사용하고 있다. plan-lifecycle 규약에는 이 형식을 금지하는 명시 조항이 없으나, worktree 경로가 변경되거나 main 트리에서 열 때 링크가 깨진다. 기능적 영향은 낮으나 일관성 관점에서 주목.
- **제안**: plan 문서의 spec cross-reference 는 레포 루트 기준 경로(`spec/2-navigation/9-user-profile.md`)를 쓰거나 worktree 상대경로임을 인식하면 된다. INFO 수준이므로 선택적 개선.

---

### [INFO] `spec/5-system/14 §8.5` 참조 — 번호 형식 불명확
- **target 위치**: "Phase: Spec 갱신" 4번째 항목 `spec/5-system/14 §8.5`
- **위반 규약**: 없음 (명시적 규약 부재), 가독성 이슈
- **상세**: `spec/5-system/14 §8.5` 는 `spec/5-system/14-<name>.md §8.5` 를 줄인 표기로 보이나 파일명 전체가 생략돼 있어 대상 파일을 특정하기 어렵다.
- **제안**: 파일 전체 경로를 명시하거나(예: `spec/5-system/14-embed-interaction-api.md §8.5`) 링크 형식으로 기술한다.

---

## 요약

`plan/in-progress/spec-draft-workspace-settings-api.md` 는 plan 라이프사이클 규약(frontmatter 스키마·3-필드)을 정상 준수하고 있다. 정식 규약(`spec/conventions/`) 직접 위반은 발견되지 않았다. 다만 plan 이 예고하는 spec 갱신 작업 중 `ADMIN_REQUIRED` 에러 코드 등재 계획이 `spec/conventions/error-codes.md §1` 의 "의미 중복 시 신설 대신 기존 코드 재사용" 원칙과 충돌할 가능성이 있어 사전 확인이 필요하다(WARNING). 신규 endpoint 의 Swagger 문서화 규약 적용도 구현 phase 에서 명시적 추적이 권장된다(WARNING). 나머지는 INFO 수준의 가독성 제안이다.

---

## 위험도

LOW
