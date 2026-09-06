# 정식 규약 준수 검토 — spec/2-navigation/ (impl-done)

검토 범위: `spec/2-navigation/2-trigger-list.md` · `spec/2-navigation/3-schedule.md` (프롬프트 번들에서 전문 확보). 나머지 15개 영역 파일은 컨텍스트 예산 절단으로 본문 미확보 — 해당 파일들에 대해 "위반 없음" 결론을 내리지 않는다. 코드 diff는 프롬프트 예산에서 절단되어, 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/user-entity-column-defense`)에서 `git diff origin/main...HEAD` 를 직접 실행해 실측했다 — `triggers.service.ts`, `workspace-response.dto.ts`, 신규 guard 파일(`user-entity-exposure-guard.ts`, `dto-jsdoc-citation-guard.ts`, `user-secret-absence.ts`) 등 target 스코프와 관련된 diff를 직접 대조했다.

이 세션은 이미 18라운드의 `/consistency-check` 를 거쳤다(`review/consistency/2026/09/06/00_01_16` ~ `15_31_00`). 직전 라운드(`15_31_00`)가 남긴 WARNING 5건을 `plan/in-progress/spec-draft-nullable-notation-followups.md`(2026-09-06 커밋 `fc6208adb`)에 planner/developer 턴 항목으로 전량 등재했는지를 1차로 재확인했고, 그 사이 커밋(`0fd4d2f29`, `fc6208adb`)이 target scope에 새 규약 위반을 추가했는지를 2차로 확인했다.

## 발견사항

### INFO — 직전 라운드 WARNING 5건은 전량 plan 등재 확인, target 문서 자체는 여전히 미수정
- target 위치: `spec/2-navigation/2-trigger-list.md` frontmatter(`status: implemented`) · `### R-2` · §2.3.1 Auth Config 행 · Rationale 번호 결번(해당 없음, 별건)
- 위반 규약: `spec/conventions/spec-impl-evidence.md` §3 (status 라이프사이클), CLAUDE.md Rationale 정정 관행(취소선+정정 콜아웃)
- 상세: 직전 라운드(`15_31_00`)가 지적한 아래 항목들이 이번 라운드 시점(HEAD `fc6208adb`)에도 target 문서에 그대로 남아 있음을 실측 확인했다.
  - frontmatter `status: implemented` (pending_plans 없음) vs 본문 §3 "`GET /api/triggers` sort/order 는 미구현/Planned" 자백 — 여전히 모순.
  - `### R-2` (hmacSecret 입력/rotate 이원 설계)가 취소선·정정 콜아웃 없이 남아, 같은 문서 §2.3.1/R-14/§3 각주 및 `5-system/15-chat-channel.md` R-CC-10 인용과 여전히 어긋남.
  - §2.3.1 Auth Config "새 인증 설정 만들기" 링크의 `editor+` 노출이 `6-config.md §A.4`의 Admin+ 생성 권한과 여전히 dead-end.
  다만 이 세 항목 모두 `plan/in-progress/spec-draft-nullable-notation-followups.md`(455~491행)에 **planner 턴 항목으로 정확한 인용(`review/consistency/2026/09/06/15_31_00` W1/W2/W3)과 함께 등재**돼 있음을 확인했다 — `developer` 는 `spec/` 쓰기 권한이 없어(CLAUDE.md Skill 체계) 이 라운드에서 직접 고칠 수 없는 것이 정상이다.
- 제안: 조치 불필요(이미 추적됨). 다음 planner 턴에서 위 plan 파일의 해당 체크박스를 일괄 처리할 것.

### INFO — `details` 컨테이너 형태(object vs array) 미정식화도 plan 등재 확인, 구현 자체는 target 문서가 선언한 계약과 정합
- target 위치: `spec/2-navigation/2-trigger-list.md` §3 "`(workspace_id, endpoint_path)` UNIQUE 위반 시 409 `RESOURCE_CONFLICT` (세부 코드 `TRIGGER_ENDPOINT_PATH_CONFLICT`, `details.field='endpoint_path'`)" ↔ `codebase/backend/src/modules/triggers/triggers.service.ts` `rethrowEndpointPathConflict()`
- 위반 규약: `spec/5-system/2-api-convention.md §5.3`(에러 응답 — 표준 예시는 `details`를 배열로 정의) vs `spec/conventions/error-codes.md §4.2`(`error.details[].code`)
- 상세: 신규 구현은 `details: { field: 'endpoint_path', code: 'TRIGGER_ENDPOINT_PATH_CONFLICT' }` (단일 object)를 던진다. target 문서가 이미 `details.field='...'` (object 표기)로 계약을 선언해 뒀으므로 **구현은 target 문서가 선언한 대로 정확히 구현됐다** — 이 자체는 위반이 아니다. 다만 §5.3 표준 예시(`details: [{field, message, code}]`, 배열)와 이 코드베이스에 이미 존재하는 다른 domain-specific object 형 `details`(예: `15-chat-channel.md` `error.details.statusCode`) 사이의 어느 쪽이 "기본"인지 `2-api-convention.md §5.3`가 아직 명문화하지 않는다는 사실을 확인했다. 이 gap은 이번 PR이 만든 것이 아니라 기존 관행의 연장이며, `plan/in-progress/spec-draft-nullable-notation-followups.md`(508~526행)에 이미 planner 항목("도메인 세부 에러 코드의 표현 방식을 정식화한다", `review/consistency/2026/09/06/14_59_49` W1/INFO#4 인용)으로 등재돼 있다.
- 제안: 조치 불필요(이미 추적됨).

### 확인했으나 위반 아님으로 판정한 항목 (신규 diff 대상, 이번 라운드에서 직접 검증)
- `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts`의 신규 `WorkspaceMemberDto.joinedAt` 필드 — `@ApiProperty({ format: 'date-time', nullable: true, type: String })` + `joinedAt: string | null` 조합은 `2-api-convention.md §5.4`("상시 존재 + null" 기본형: `@ApiProperty({ nullable: true })` + `field: T | null`)를 정확히 준수한다. 동일 패턴이 `webauthn-response.dto.ts:70`·`trigger-response.dto.ts:121,125,137`에 이미 있어 저장소 관행과도 일치. 내부 서사(실측 수치·이전 위반 이력)를 `/** */` JSDoc이 아니라 바로 위 `//` 블록에 둔 것도 `swagger.md §3`("JSDoc은 공개 OpenAPI description으로 나간다")과 `review-citations.md §3`(DTO JSDoc은 리뷰 인용 대상 아님, `//` 주석에 적는다)를 정확히 지킨다.
- `codebase/backend/src/modules/triggers/triggers.service.ts`의 신규 `TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX = 'idx_trigger_workspace_endpoint'` 상수 — `codebase/backend/migrations/V002__indexes.sql`의 실제 인덱스명과 문자 그대로 일치함을 grep으로 확인. 명명 드리프트 없음.
- 신규 guard 파일 `dto-jsdoc-citation-guard.ts`/`dto-jsdoc-citation.spec.ts`, `user-entity-exposure-guard.ts`/`user-entity-exposure.spec.ts` — `codebase/backend/src/repo-guards/__tests__/` 기존 파일(`audit-action-binding-guard.ts`/`.spec.ts`, `swagger-dto-contract-guard.ts`/`.spec.ts` 등)과 동일한 `<name>-guard.ts` + `<name>.spec.ts` 명명 패턴을 그대로 따른다.
- 신규 guard·테스트 파일 내 리뷰 인용은 전부 `review/code/2026/09/06/<hh_mm_ss>` 전체 경로 형태(날짜 포함)를 쓰고 있어 `review-citations.md §2`(bare `hh_mm_ss` 금지) 위반 없음.
- `error-codes.md §1` 의미 기반 명명 원칙 대비 `TRIGGER_ENDPOINT_PATH_CONFLICT`(도메인 prefix `TRIGGER_`, UPPER_SNAKE_CASE) — 부합.

## 요약
target(`spec/2-navigation/`)의 델타는 이번 PR에서 0이며, 구현 diff는 target 문서(특히 `2-trigger-list.md` §3의 `RESOURCE_CONFLICT`/`TRIGGER_ENDPOINT_PATH_CONFLICT` 계약)가 이미 선언한 대로 정확히 구현됐고 새로 추가된 `WorkspaceMemberDto.joinedAt` 필드·guard 파일들도 명명·JSDoc·리뷰 인용 규약을 정확히 지킨다 — 이번 라운드에서 직접 관측한 신규 diff에는 규약 위반이 없다. 반면 `2-trigger-list.md` 자체에 이전부터 존재하던 문서-내부 규약 이탈(frontmatter status 오표기, 폐기된 R-2 미정정, Auth Config 링크 RBAC 불일치, `details` 컨테이너 형태 미정식화)은 이번 라운드에도 그대로 남아 있으나, 전부 `plan/in-progress/spec-draft-nullable-notation-followups.md`에 정확한 근거·인용과 함께 planner/developer 턴 항목으로 등재돼 있어 신규 미추적 리스크는 없다. CRITICAL 없음.

## 위험도
LOW
