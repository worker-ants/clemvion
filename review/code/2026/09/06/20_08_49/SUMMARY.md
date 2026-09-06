# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 없음. 핵심 산출물(`User` 컬럼 노출 방어 2축 신설 + 실유출 1건 수정)은 견고하나, (1) 같은 브랜치에 "User 컬럼 방어"와 무관한 harness 파서 수정·트리거 API 계약 신규 구현·JSDoc 인용 가드가 함께 실려 리뷰/롤백 단위가 불명확하고(scope WARNING), (2) `WorkspacesService.listMembers` 가 `findOne` 이 방금 고친 것과 같은 클래스의 DB 과다조회(투영 없는 `User` 전체 로드)를 아직 갖고 있으며(database WARNING), (3) `CHANGELOG.md` 에 Markdown 렌더링 결함이 있다(documentation WARNING). 11개 reviewer 전원(forced 7명 포함) 전문을 인라인으로 확보했고 누락된 reviewer 는 없다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Scope | 주 목적("User 컬럼 방어")과 무관한 관심사 3개(harness YAML frontmatter 파서 버그 수정, 그로 인해 드러난 트리거 `endpoint_path` UNIQUE 충돌 409 계약 신규 구현, `dto-jsdoc-citation-guard` JSDoc 인용 위생)가 같은 브랜치/PR 에 함께 실림. 인과관계는 CHANGELOG·plan·커밋 메시지에 투명하게 disclose 되어 있고 대부분 `--impl-done` 게이트 강제 조치에서 파생됐지만, 별도 PR 이었다면 리뷰·롤백 단위가 더 명확했을 것 | `.claude/hooks/_lib/review_guard.py:600,626,650`, `codebase/backend/src/modules/triggers/{triggers.controller,triggers.service}.ts`, `codebase/backend/src/common/db/pg-error.ts`, `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation-guard.ts` | 조치 불요(투명 disclose 확인). 향후 유사 상황에서는 harness 파서 수정과 그로 인해 드러난 무관 계약 구현을 별도 커밋/PR 로 분리 |
| 2 | Database | `WorkspacesService.listMembers` 가 `relations: ['user']` 로 `User` 관계를 컬럼 프로젝션 없이 전체 로드 — `WorkflowVersionsService.findOne` 이 이번 PR 에서 정확히 같은 패턴을 실유출로 확인·수정한 것과 동일 클래스의 DB 쿼리. 현재는 JS 단 수동 매핑(`email`/`name` 만 추출)이 안전망이나, DB 쿼리 자체는 여전히 비밀 컬럼을 물리적으로 가져온다. 정적 가드(구조 축)가 원리적으로 포착 못 하는 형태임이 이번 PR 자체 주석(`EXPECTED_USER_RELATION_LOADS`)에 명시돼 있고, 안전망은 e2e 1건(`workspace-rbac` J.)에만 의존 | `codebase/backend/src/modules/workspaces/workspaces.service.ts:213-216` (`listMembers`) | `findOne`/`findByWorkflow` 와 동일하게 `select: { user: { id: true, email: true, name: true } }` 프로젝션을 쿼리 자체에 추가해 "검출"에서 "방지"로 승격 |
| 3 | Documentation | `CHANGELOG.md` 에서 리스트 항목 뒤 빈 줄 누락으로 독립 문단이 직전 불릿에 흡수됨(CommonMark lazy continuation) — "이 두 축이 `User` 컬럼 방어의 전부다..." 문장이 `user-entity-exposure-guard.ts` 불릿의 일부처럼 렌더링되어, 아직 서술되지 않은 두 번째 축을 가리키는 결론 문장이 첫 번째 축 세부사항인 것처럼 오독될 수 있음. 문서 내 다른 자리(73~78행)는 빈 줄을 정확히 둬 이 자리만의 누락임 | `CHANGELOG.md:57-59` | 58행 앞에 빈 줄 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security/Database/Performance/API Contract | `WorkflowVersionsService.findOne` 이 `creator` 관계를 투영 없이 로드해 `User` 전 컬럼(비밀번호 해시·2FA 시크릿·복구 코드 등 7종)을 워크스페이스 멤버 누구에게나 노출하던 실제 Critical 취약점이 이번 diff 에서 `CREATOR_PROJECTION`(3필드) 상수로 수정됨. mutation 검증 + e2e(`workflow-crud` H.) 로 회귀 봉인 확인 | `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` (`findOne`, `CREATOR_PROJECTION`) | 조치 불요. 과거 배포 이력이 있다면 유출 시점 이후 발급된 워크플로우 버전 작성자 비밀번호 해시·2FA 시크릿 로테이션 별도 검토 권고 |
| 2 | Security/Maintainability/Testing | 신규 이중 검출 가드(구조 축 `user-entity-exposure-guard.ts` — AST 로 투영 없는 `User` 관계 로드 탐지 + 값 축 `user-secret-absence.ts` — 응답 본문 재귀 훑기)가 재발 방지 계층으로 신설됨. 양쪽 다 mutation 검증(술어 무력화 시 실패 확인) 완료 | `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts`, `codebase/backend/src/shared/testing/user-secret-absence.ts` | 조치 불요 |
| 3 | Requirement/Database/API Contract/Side Effect | 트리거 `(workspace_id, endpoint_path)` UNIQUE 충돌이 spec(`2-trigger-list.md §3`)이 약속한 409 `RESOURCE_CONFLICT` + `details.field`/`details.code` 형태로 정확히 구현됨. DB 파티셜 UNIQUE 인덱스에 기대는 TOCTOU-안전 패턴, 4케이스(wrap 표면×메서드) + 부정 대조군까지 테스트됨 | `codebase/backend/src/modules/triggers/triggers.service.ts` (`rethrowEndpointPathConflict`, `isEndpointPathUniqueViolation`) | 조치 불요 |
| 4 | Requirement/API Contract | 도메인 세부 에러 코드 표현이 저장소 내 두 관례(`details.code` vs top-level `code` 교체)로 이원화되어 있음 — spec 문면이 "세부 코드" 배치를 명문화하지 않아 발생. 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 후속 항목으로 등재됨 | `triggers.service.ts` `rethrowEndpointPathConflict` vs 같은 파일 기존 7건 선례 | 조치 불요(이미 등재). `2-api-convention.md §5.3` 갱신 시 택일 기준 명문화 권고 |
| 5 | API Contract | 신규 SoT `pgErrorConstraint()` 가 같은 클래스의 기존 중복 지점(`integration-oauth.service.ts` 2곳)을 아직 대체하지 않음 — developer 백로그에 "의도적 보류(scope 확산 방지)"로 이미 등재됨 | `codebase/backend/src/modules/integrations/integration-oauth.service.ts:1268-1272,1827-1831` (이번 diff 밖) | 조치 불요(이미 등재), 다음 편집 시 치환 |
| 6 | API Contract | `WorkflowVersionDetail` 타입이 프런트(`workflows.ts`)와 백엔드(`workflow-versions.service.ts`)에 이름이 같은 채 손-미러되어 있어 구조 drift 위험(3라운드 연속 grep 오판 이력). 공유 패키지화는 이미 defer 등재됨 | `codebase/frontend/src/lib/api/workflows.ts` vs `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` | 조치 불요(투명 추적됨). 향후 `creator` 계약 변경 시 양쪽 동시 확인 |
| 7 | Side Effect/User Guide Sync/Scope | `WorkspaceMemberDto.joinedAt` 필드 신설 — 값은 이전부터 이미 wire 에 실리고 있었고(4개 생성 지점 실측 확인) 이번엔 DTO 선언만 추가. 신규 화면 노출·i18n 갭 없음(프런트 어떤 `.tsx` 도 이 필드를 렌더링하지 않음) | `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts:81-93` | 조치 불요 |
| 8 | Side Effect/Scope | `.claude/hooks/_lib/review_guard.py` 의 YAML frontmatter 파서 수정은 공유 hook 라이브러리라 이 PR 파일 범위를 넘어 저장소 전체 387개 spec 파일의 게이트 판정에 다음 실행부터 즉시 적용됨(41개 entry 가 조용히 유실되던 것이 편입됨). 의도된 수정이고 양방향 대조군 테스트 충분 | `.claude/hooks/_lib/review_guard.py:600` (`_parse_frontmatter_code`), `:709` (호출부) | 조치 불요. 이후 다른 브랜치에서 게이트가 갑자기 엄격해지는 사례가 보고되면 이 커밋을 원인으로 우선 검토 |
| 9 | Documentation | `JsDocCitation.citations` 필드 주석의 "매치된 텍스트 **전부**" 표현이 실제로는 정규식 패턴당 첫 매치만 수집하는 구현보다 넓게 읽힘(현재 목적엔 무해) | `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation-guard.ts` (`findCitations`) | 낮은 우선순위. 표현을 "형태별 대표 매치"로 좁히거나 조치 불요 |
| 10 | Maintainability | `@ApiConflictResponse` 설명 문자열이 `rethrowEndpointPathConflict` 가 실제로 던지는 `code`/`details` 리터럴 값을 그대로 옮겨 적은 채 두 데코레이터(`create`/`update`)에 문자 그대로 중복 — 서비스 쪽 값이 바뀌면 양쪽 다 손으로 따라가야 함 | `codebase/backend/src/modules/triggers/triggers.controller.ts` (`create`/`update` `@ApiConflictResponse`) | 값을 상수화해 템플릿으로 삽입하거나, 최소한 동기화 필요 주석 추가 |
| 11 | Maintainability | `_parse_frontmatter_code` 가 지역 헬퍼 2개 + 중첩 while/if 로 책임(인라인 리스트/블록 리스트/주석·인용 처리)이 늘어 복잡도가 커짐. 회귀 근거 주석은 충실 | `.claude/hooks/_lib/review_guard.py` (`_parse_frontmatter_code`) | 급하지 않음. 다음 편집 시 block-list 스캔을 별도 함수로 분리 고려 |
| 12 | Testing | `isEndpointPathUniqueViolation` 술어 테스트가 "제약 이름 자체가 없는(undefined)" 하위 경로를 별도로 관측하지 않고 "다른 이름이 있는" 케이스로만 대리 검증됨 | `codebase/backend/src/modules/triggers/triggers.service.spec.ts` | 낮은 우선순위. `constraint` 필드 자체가 없는 에러 fixture 케이스 추가 권고 |
| 13 | Testing | `dto-jsdoc-citation-guard.ts` 의 bare 시각 정규식이 리뷰 인용이 아닌 우연한 6자리 밑줄 토큰에 오탐할 가능성이 fixture 로 반증되지 않음(현재 실제 오탐 사례 없음, CI 차단 아닌 사람이 보는 래칫) | `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation-guard.ts` (정규식), `fixtures/dto/responses/jsdoc-citation.fixture.ts` | 낮은 우선순위. 오탐 대조 fixture 추가 검토 |
| 14 | Performance | 신규 AST 스캔 가드 2종이 매 jest 실행마다 `src/modules` 전체를 재파싱 — 프로덕션 런타임 무관, CI 시간만 가드 수만큼 선형 누적(형제 가드들도 이미 같은 관례) | `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts`, `dto-jsdoc-citation-guard.ts` | 지금 규모는 조치 불요. 가드가 더 늘면 파서 결과 캐싱 공용 유틸 고려 |
| 15 | Scope | 다른 워크트리(`spec-api-convention-code-and-overview-d81cd6`) 소유 plan 항목의 lifecycle 정리(`in-progress`→`complete`, `status` 필드 1줄)가 이 브랜치에 포함됨 — 내용 변경 없이 기계적 이동, 커밋 메시지에 근거(#1289 머지 확인, consistency-check WARNING 정정) 명시 | `plan/complete/spec-draft-api-convention-verifier-registration.md` (신규 이동) | 조치 불요(근거 검증 가능) |
| 16 | User Guide Sync | `doc-sync-matrix` 매칭 2건(트리거 409 conflict, `WorkspaceMemberDto.joinedAt`) 모두 frontend 소비 지점을 직접 열람해 신규 사용자 가시 문구·화면 변경이 없음을 확인 — 동반 문서 갱신 갭 없음 | `codebase/frontend/src/app/(main)/w/[slug]/triggers/**`, `codebase/frontend/src/lib/api/workspaces.ts` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 실제 Critical 유출(`findOne`) 수정 확인, 이중 검출 가드 신설 확인, 신규 취약점 없음 |
| performance | NONE | `findOne` 투영 추가는 성능 개선, 가드 재파싱 오버헤드는 CI 한정 INFO |
| requirement | NONE | 3갈래 핵심 변경 모두 spec 과 line-level 일치, 엣지케이스 테스트 충분 |
| scope | MEDIUM | 무관 관심사 3개(harness 파서·트리거 계약·JSDoc 가드)가 한 브랜치에 동반 |
| side_effect | LOW | review_guard.py 블라스트 반경이 PR 파일 범위 초과(전역 게이트 즉시 적용) |
| maintainability | LOW | ApiConflictResponse 문자열 중복, 파서 함수 복잡도 증가 |
| testing | LOW | 202 jest + 19 pytest 직접 실행 통과, 미관측 하위 분기 2건(예방적) |
| documentation | LOW | CHANGELOG Markdown lazy continuation 렌더링 결함 |
| database | LOW | `listMembers` 가 `findOne` 과 동일 클래스의 투영 없는 `User` 전체 로드 잔존 |
| api_contract | NONE | 트리거 409 계약 실현 확인, 에러코드 이원화·타입 drift 는 이미 등재됨 |
| user_guide_sync | LOW | matched 2건 모두 실측 결과 갱신 갭 없음 |

## 발견 없는 에이전트

없음 — 11개 reviewer 전원이 최소 1건 이상의 INFO/WARNING 을 보고함(순수 "문제 없음"만 보고한 에이전트 없음).

## 권장 조치사항

1. `WorkspacesService.listMembers` 에 `select: { user: { id: true, email: true, name: true } }` 프로젝션을 추가해 `findOne` 과 동일한 방식으로 DB 레벨 방지로 승격한다(database WARNING #2).
2. `CHANGELOG.md:58` 앞에 빈 줄을 추가해 Markdown 렌더링 결함을 수정한다(documentation WARNING #3).
3. (선택) 향후 유사 상황에서는 harness 파서 버그 수정과 그로 인해 드러난 무관 API 계약 구현을 별도 PR 로 분리해 리뷰·롤백 단위를 좁힌다(scope WARNING #1) — 이번 PR 자체는 인과관계가 투명히 disclose 되어 있어 강제 조치는 아님.
4. `@ApiConflictResponse` 설명 문자열의 계약 리터럴 값을 상수화하거나 동기화 주석을 추가한다(INFO #10, 낮은 우선순위).
5. 그 외 INFO 항목(에러코드 표현 이원화, `pgErrorConstraint` 부분 적용, 타입 미러 drift 등)은 이미 planner/developer 백로그(`plan/in-progress/spec-draft-nullable-notation-followups.md`)에 등재되어 있으므로 이번 PR 범위에서 추가 조치 불요.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, performance, requirement, scope, side_effect, maintainability, testing, documentation, database, api_contract, user_guide_sync (11명)
  - **제외**: 아래 표 (3명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 결과 확보됨(누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | architecture | 라우터 판단(사유 상세 미제공 — 프롬프트에 세부 사유 텍스트 없음) |
  | dependency | 라우터 판단(사유 상세 미제공) |
  | concurrency | 라우터 판단(사유 상세 미제공) |