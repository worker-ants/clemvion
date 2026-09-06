# Code Review 통합 보고서

## 전체 위험도
**HIGH** — 핵심 보안 수정(`User` 컬럼 노출 차단)과 검출 3축 신설은 견고하고 9개 reviewer 전원이 결과를 확보했으나(강제 화이트리스트 미이행 없음), `scope` reviewer 가 CRITICAL 로 지목한 **developer 의 harness(`.claude/**`) 쓰기 권한 밖 수정이 승인 없이 이미 커밋에 반영된 상태**가 이 라운드의 전체 위험도를 끌어올린다 — 이는 "clean" 판정을 내리기 전에 반드시 확인해야 할 절차적 미결 사안이다.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SCOPE | developer 가 `CLAUDE.md` Skill 표에 쓰기 권한이 명시되지 않은 `.claude/**` harness 코드(`review_guard._parse_frontmatter_code` 파서)를 스스로 권한 불확실성을 인지한 채(`plan/in-progress/spec-draft-nullable-notation-followups.md` 미결 체크박스로 기록) 이미 커밋(`8b67300b5`)해 HEAD 에 반영했다. 사후 승인이 아직 없는 상태로 실효 중이다. | `.claude/hooks/_lib/review_guard.py`(`_parse_frontmatter_code`, `_strip_comment`), `.claude/tests/test_review_guard.py`, `plan/in-progress/spec-draft-nullable-notation-followups.md` | 되돌리지 말 것(되돌리면 41개 spec entry 유실 회귀 재발). 대신 이 발견을 승인 트랙(planner 턴)에 올려 `CLAUDE.md` Skill 표에 harness 쓰기 권한 조항을 명시하는 결정을 이 PR 머지 전에 받을 것 |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 2 | SCOPE | JSDoc 인용 유출 가드(`dto-jsdoc-citation-guard.ts`)는 "User 엔티티 컬럼 방어"와 무관한 별개 관심사(DTO 주석 위생)인데, CHANGELOG/plan 이 "검출 3축"이라는 이름으로 같은 절에 묶어 서술해 diff 목적 판단을 어렵게 한다 | `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation-guard.ts` 외, `spec/conventions/review-citations.md` §3 | 별도 plan 항목/커밋 계열로 분리하거나 최소한 CHANGELOG 절 제목을 두 개(User 컬럼 검출 / DTO JSDoc 주석 위생)로 나눌 것 |
| 3 | SCOPE | 트리거 `endpoint_path` UNIQUE 409 계약 구현은 "harness 파서 수정 → 게이트 스코프 확대 → 기존 spec-impl 갭 발견"이라는 4단 연쇄로 원 작업(User 컬럼 방어)과 무관하게 같은 diff 에 섞여 들어왔다 | `codebase/backend/src/modules/triggers/triggers.service.ts`, `codebase/backend/src/common/db/pg-error.ts` | 이미 커밋된 것을 되돌릴 필요는 없음(정당한 additive 수정). 별도 plan 항목/커밋 계열로 분리했어야 함을 기록으로 남길 것 |
| 4 | MAINTAINABILITY | `it` → `it.each` 파라미터화 리팩터 시 신설한 `callFor` 헬퍼가 기존 JSDoc(테스트 대상 설명)과 그 대상(`it.each` 호출부) 사이에 끼어들어 orphan JSDoc 이 재발했다 — 이 브랜치가 이미 두 번 스스로 잡아 고친 것과 같은 결함 클래스 | `codebase/backend/src/modules/triggers/triggers.service.spec.ts:2874-2894` | 첫 JSDoc 블록(2874-2877)을 `it.each` 호출(2893) 바로 위로 옮기고, `callFor` 위에는 헬퍼 설명 블록만 남길 것 |
| 5 | DOCUMENTATION | `plan/in-progress/` 문서 안에서, 아직 열려 있는 체크리스트 항목(375행)의 캐비아트가 "`code:` 에 YAML 주석 넣지 마라"고 지시하는데, 같은 문서 뒤쪽(1257행)은 그 파서 버그가 이미 해소됐고 `review-citations.md` 가 실제로 인라인 YAML 주석을 쓰고 있음을 기록한다 — 시점이 다른 두 서술이 공존해 다음 사람을 오도할 수 있다 | `plan/in-progress/spec-draft-nullable-notation-followups.md:410`(대조: `:1257-1258`) | 410~412행에 "2026-09-06(`8b67300b5`) 파서 수정으로 해소됨" 정정 주석을 추가하거나 캐비아트를 지우고 1257행 항목 링크로 대체 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 6 | SECURITY/REQUIREMENT/SIDE_EFFECT | `WorkflowVersionsService.findOne` 의 `User` 전체 컬럼(passwordHash·2FA 시크릿·복구코드·토큰) 유출이 `CREATOR_PROJECTION` 투영으로 실제로 닫혔고, 스키마 대조 테스트 + e2e 3중(계약/이름/양성) 검증으로 고정됨 — 확인 완료 | `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` | 조치 불요 |
| 7 | SECURITY | 구조 축 가드(`user-entity-exposure-guard.ts`)는 TypeORM 관용구(`relations`/`*JoinAndSelect`/`eager`)만 보는 태생적으로 좁은 정적 스캔이라 raw SQL·수동 JS 매핑 확장은 못 잡음 — 팀이 이미 인지하고 `listMembers` 등에 별도 이름-축 e2e/unit 으로 보완한 문서화된 잔여 한계 | `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts`, `workspaces.service.ts#listMembers` | 향후 `User` 를 새 응답 경로에 노출할 때 이름-축 e2e/unit 배선을 강제하는 체크리스트 유무 확인 권장 |
| 8 | SECURITY/REQUIREMENT/SIDE_EFFECT/API_CONTRACT | `TriggersService.rethrowEndpointPathConflict` 는 원본 DB 에러를 노출하지 않고 spec(`2-trigger-list.md §3`)이 요구한 `409 RESOURCE_CONFLICT`(`details.field`/`details.code`) 형태를 정확히 발행하며, 다른 UNIQUE 위반은 원본 그대로 rethrow — 확인 완료 | `codebase/backend/src/modules/triggers/triggers.service.ts` | 조치 불요 |
| 9 | REQUIREMENT | 신설 `pgErrorConstraint()` 헬퍼가 정확히 대체할 수 있는 손-작성 패턴(`constraint ?? driverError?.constraint`)이 `integration-oauth.service.ts` 2곳(1269-1273, 1828-1832)에 남아 있고, 이번 PR 이 마이그레이션도 plan disclose 도 하지 않음(기능 결함 아님) | `codebase/backend/src/modules/integrations/integration-oauth.service.ts` | 다음에 이 파일을 건드릴 때 `pgErrorConstraint()` 로 치환하거나, 최소한 plan 후속 항목에 "확인함·의도적 보류" 한 줄 기록 |
| 10 | SCOPE/USER_GUIDE_SYNC/API_CONTRACT | `WorkspaceMemberDto.joinedAt` 필드 추가는 핵심 작업의 파생 갭(e2e 계약 검증이 처음으로 드러낸 선언 누락)이며 CHANGELOG/DTO 주석/plan 세 곳에 투명하게 disclose됨. 실제 UI 렌더링 없어 유저 가이드 갱신 대상 없음 | `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts` | 조치 불요. 향후 `joinedAt` 이 UI(예: 멤버 목록 "가입일")로 노출되면 `workspaces-and-members.mdx`(+`.en.mdx`) 동반 갱신 필요 |
| 11 | TESTING | 직전 라운드(15_52_58) 지적 2건 — `listMembers` null-vs-missing mock 비사실성, 트리거 409 부정 케이스 create/update 비대칭 — 이번 커밋(`8bbae332a`)에서 정확히 해소됨을 jest 실행(7 suites/201 pass, 1 skip)으로 직접 확인 | `workspaces.service.spec.ts`, `triggers.service.spec.ts` | 조치 불요 |
| 12 | TESTING/API_CONTRACT | `joinedAt` 의 `nullable: true` 선언이 실제 `null` 값 경로로 검증된 적 없음(현재 4개 채움 지점 전부 `new Date()`) — 값이 좁고 선언이 넓은 안전한 방향 미스매치, 이미 저비용·저위험으로 처분됨 | `workspace-response.dto.ts`, `workspace-rbac.e2e-spec.ts` | 조치 불요(향후 null 도달 경로 생기면 그때 테스트 추가) |
| 13 | API_CONTRACT | 에러 봉투 `details` 필드가 배열(§5.3 예시)/객체(이번 트리거 구현) 두 형태로 쓰이는 것이 spec 에 아직 명문화되지 않음 — developer 권한 밖, plan 에 이미 등재됨 | `spec/5-system/2-api-convention.md §5.3`, `triggers.service.ts` | 조치 불요 — planner 턴 반영 대기 |
| 14 | API_CONTRACT | 트리거 `endpoint_path` UNIQUE 409 응답을 실 DB 유니크 제약 경로로 검증하는 e2e 가 없음(unit mock 검증만 존재) | `triggers.service.spec.ts` | 필수는 아님. 형평을 위해 웹훅 트리거 e2e 에 2차 생성→409 단언 케이스 추가 권장 |
| 15 | SECURITY | `.claude/hooks/_lib/review_guard.py` 의 YAML frontmatter `code:` 파서 수정은 애플리케이션 보안이 아니라 감사 게이트 자신의 커버리지 결함(spec 387개 중 41개 entry 유실, 이 PR 자신의 대상 파일 포함)을 닫음 — 앱 런타임 영향 없음, 회귀 테스트로 검증됨 | `.claude/hooks/_lib/review_guard.py`, `.claude/tests/test_review_guard.py` | 조치 불요(단, 권한 이슈는 위 CRITICAL #1 참조) |
| 16 | USER_GUIDE_SYNC | `spec/conventions/review-citations.md`/`spec-impl-evidence.md` 변경이 doc-sync-matrix `spec-major-change` trigger 를 매칭하나 본 reviewer(유저 가이드/i18n/backend-labels) 관할 밖이며 `spec-frontmatter` 가드/consistency-checker 소관 | `spec/conventions/review-citations.md`, `spec/conventions/spec-impl-evidence.md` | 조치 불요(정보 제공용) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | `WorkflowVersionsService` 유출 차단 확인, 구조 가드 한계는 문서화된 잔여 위험 |
| requirement | LOW | 8라운드 수렴 확인, spec 일치. `pgErrorConstraint` 미마이그레이션 잔여 자리 1건 |
| scope | HIGH | **CRITICAL**: harness 권한 밖 수정 미승인 반영. WARNING 2건: 무관한 갈래(JSDoc 가드·트리거 계약)가 같은 diff 에 섞임 |
| side_effect | LOW | 3개 부작용 표면(트리거 예외 형태·findOne 반환 타입·파서 전역 영향) 모두 의도되고 검증됨 |
| maintainability | LOW | WARNING 1건: `it.each` 리팩터가 만든 orphan JSDoc 재발 |
| testing | LOW | 직전 라운드 지적 2건 해소 확인(jest 실행 검증), `joinedAt` null 미검증 잔여 유지 |
| documentation | LOW | WARNING 1건: plan 문서 내 stale caveat(이미 해소된 제약을 여전히 유효한 것처럼 지시) |
| api_contract | LOW | 트리거 409/투영/joinedAt 계약 정합 확인. `details` 형태 미명문화·e2e 부재 잔여 INFO 2건 |
| user_guide_sync | NONE | 22개 매트릭스 행 중 2건만 매칭, 실질 유저 가이드 갱신 누락 없음 |

## 발견 없는 에이전트

해당 없음 — 전 에이전트가 최소 1건 이상의 관찰(INFO 이상)을 보고함.

## 권장 조치사항
1. **[CRITICAL 대응]** `.claude/hooks/_lib/review_guard.py` harness 수정에 대해 planner 턴으로 `CLAUDE.md` Skill 표에 developer 의 `.claude/**` 쓰기 권한(또는 예외 조항)을 명시하는 사후 승인 결정을 이 PR 머지 전에 받는다. 코드 자체는 되돌리지 않는다(회귀 재발 방지).
2. `triggers.service.spec.ts` 의 orphan JSDoc(WARNING #4)을 `it.each` 호출 바로 위로 이동시켜 대상-설명 인접성을 복원한다.
3. `plan/in-progress/spec-draft-nullable-notation-followups.md:410` 의 stale caveat 을 정정하거나 1257행 항목 링크로 대체해 다음 planner 턴의 오판을 방지한다.
4. (선택) CHANGELOG/plan 상 "검출 3축"으로 묶인 서술 중 User 컬럼 방어와 무관한 두 갈래(JSDoc 인용 가드, 트리거 409 계약)를 별도 항목으로 분리 기록해 향후 리뷰 스코프 판단을 쉽게 한다.
5. (낮은 우선순위) `integration-oauth.service.ts` 의 손-작성 constraint 추출 패턴을 `pgErrorConstraint()` 로 치환하거나 plan 에 의도적 보류로 명시한다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync` (9명)
  - **제외**: 아래 표 (5명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (forced 전원 결과 확보됨 — 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단: 이번 diff 성능 영향 범위 아님 |
  | architecture | router 판단: 아키텍처 구조 변경 아님 |
  | dependency | router 판단: 의존성 변경 없음 |
  | database | router 판단: 스키마/마이그레이션 변경 없음(투영·인덱스 명 참조만) |
  | concurrency | router 판단: 동시성 로직 변경 아님 |