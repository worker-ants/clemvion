# Code Review 통합 보고서

## 전체 위험도
**HIGH** — `User` 엔티티 컬럼 전체 유출이라는 실제 Critical 취약점(`WorkflowVersionsService.findOne`)은 이번 diff 가 올바르게 닫았음을 5개 reviewer(security/requirement/scope/side_effect/api_contract)가 교차 확인했다. 그러나 같은 diff 의 마지막 커밋이 "가드 약화 시 게이트가 문다"를 선언하며 `review-citations.md` 의 `code:` frontmatter 블록에 등재한 것 자체가, **같은 브랜치의 plan 문서가 하루 전 이미 경고한 YAML 주석 파서 버그**를 재현해 게이트 파서(`_parse_frontmatter_code`)를 조기 종료시킨다 — `_spec_linked_changes()` 를 직접 실행해 빈 배열 반환을 확인했다(requirement reviewer, CRITICAL). forced reviewer(documentation·maintainability·requirement·scope·security·side_effect·testing) 전원 결과가 확보되어 누락은 없다.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement | `review-citations.md` 의 `code:` frontmatter 블록에 섞인 YAML 주석 2줄이 게이트 파서 `_parse_frontmatter_code()`(`.claude/hooks/_lib/review_guard.py:637-646`)의 block-list 루프를 첫 줄에서 즉시 `break` 시켜, 실행 결과 `_spec_linked_changes()` 가 **빈 배열**을 반환함(직접 실행으로 확인). `dto-jsdoc-citation-guard.ts`/`.spec.ts` 를 spec-linked 로 만들려던 목표가 미달성일 뿐 아니라, `origin/main` 에서 이미 spec-linked 였던 `sanitize-loader-error.ts` 도 함께 이 감사망에서 빠지는 **회귀**다. 같은 브랜치의 `plan/in-progress/spec-draft-nullable-notation-followups.md` 가 하루 전 이미 이 정확한 결함 클래스를 경고했다(체크박스 미해결). | `spec/conventions/review-citations.md:4-9` (frontmatter `code:` 블록) | `code:` 블록에서 YAML 주석 두 줄을 제거(범주 구분은 산문/표로 이동)하고, `_parse_frontmatter_code('spec/conventions/review-citations.md')` 를 직접 실행해 최소 4개 항목이 파싱되는지 그 자리에서 확인한다. 근본적으로는 파서가 `#`/빈 줄을 스킵하도록 고치는 harness 항목의 우선순위를 올린다. |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 2 | architecture | 신규 구조 가드의 허용 목록(`EXPECTED_USER_RELATION_LOADS`)이 방어 강도가 다른 두 패턴을 동일 등급으로 통과시킨다 — 이번에 고친 `WorkflowVersionsService.findOne` 은 **DB 레벨 `select` 투영**(컬럼 자체가 로드되지 않음)인 반면, 동결된 `workspaces.service.ts#listMembers` 는 `User` 전체를 투영 없이 로드한 뒤 **JS 단에서 수동으로 필드를 골라내는** 방식이라, 그 매핑 코드가 나중에 넓어져도(`...m.user` 스프레드 등) 구조 가드는 여전히 초록이다. 유일한 안전망이 e2e(`workspace-rbac` J) 하나다. | `codebase/backend/src/repo-guards/__tests__/user-entity-exposure.spec.ts`(`EXPECTED_USER_RELATION_LOADS`), `codebase/backend/src/modules/workspaces/workspaces.service.ts#listMembers` | 허용 목록 항목에 방어 메커니즘 종류(`db-projected` vs `manual-js-projection`) 태그를 구분하거나, 로드 후 반환/응답 구성 지점까지 보는 2차 술어를 추가. 최소한 주석에 "이 항목은 e2e(workspace-rbac J)가 유일한 안전망"임을 명시. |
| 3 | maintainability | 신규 `dto-jsdoc-citation.spec.ts` 의 세 `it()` 블록이 동일 fixture 경로(`path.join(__dirname, 'fixtures', 'dto', 'responses', 'jsdoc-citation.fixture.ts')`)를 5줄짜리 리터럴로 3곳에 인라인 중복. 같은 디렉터리의 형제 파일 `swagger-dto-contract.spec.ts` 는 동일 상황에서 모듈 최상위 `const RATCHET_FIXTURE = ...` 로 한 번만 선언해 재사용하는 확립된 관례가 있는데 이를 따르지 않았다. | `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation.spec.ts:66-72, 100-106, 118-124` | `describe` 블록 상단(또는 모듈 최상위)에 `const CITATION_FIXTURE = path.join(...)` 로 한 번만 선언하고 세 `it()` 이 참조하도록 통합 — `swagger-dto-contract.spec.ts` 의 `RATCHET_FIXTURE` 패턴을 그대로 따른다. |
| 4 | documentation | `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 §5.4 등재 인계 표 1행(구조 축)이 지시하는 glob `user-entity-exposure-guard*.ts` 가 `-guard` 접미어를 요구해, 베이스라인 래칫이 실제로 사는 `user-entity-exposure.spec.ts`(접미어 없음)를 매치하지 못한다 — 같은 문서가 세 줄 아래(`:400`)에서 "이렇게 하면 베이스라인/fixture 대조군이 spec-linked 판정에서 빠진다"고 명시적으로 경고하는 바로 그 형태를 표 1행 자신이 재현하고 있다. 이 표는 다음 planner 턴이 문자 그대로 집행할 지시문이다. | `plan/in-progress/spec-draft-nullable-notation-followups.md:396` (표 1행) vs `:400` (경고 문구) | 표 1행의 glob 을 `user-entity-exposure*.ts`(또는 `-guard` 없는 공통 접두어 기준)로 정정해 가드·스펙 파일 모두 포함시키고, 캐비아트를 표 각 행 옆에 직접 반영한다. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 5 | security/requirement/scope/side_effect/api_contract (교차확인) | `WorkflowVersionsService.findOne`(`GET /api/workflows/:wfId/versions/:versionId`)이 `User` 전 컬럼(`passwordHash`·`twoFactorSecret`·복구코드·토큰류)을 투영 없이 반환하던 실제 Critical 취약점을 `CREATOR_PROJECTION`(`id`/`name`/`email`) 투영으로 수정 — 5개 reviewer 가 코드를 직접 열어 완전성(양쪽 조회 메서드, 컨트롤러 가공 없음, 유일한 내부 호출자 `restoreVersion` 영향 없음)을 확인. 스키마 대조 테스트 + 3축 e2e(이름 부재/계약 대조/필드 양성)로 회귀 방지 배선됨. | `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` | 조치 불요. 다만 이미 나간 응답은 회수 불가하므로, 과거 이 엔드포인트를 호출한 뷰어 권한 이상 사용자가 있었다면 토큰/비밀번호 로테이션 필요성을 스코프 밖에서 별도 검토(api_contract 제안). |
| 6 | scope/side_effect/api_contract (교차확인) | `WorkspaceMemberDto.joinedAt` 필드 추가는 이미 wire 로 나가고 있던 값(`WorkspacesService.listMembers`, 프런트엔드도 이미 소비 중)의 사후 문서화 — 순수 additive, breaking change 아님. | `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts:81-93` | 조치 불요. |
| 7 | scope/maintainability/testing (교차확인) | 이전 라운드(10:13:22)가 지적한 e2e 라벨 충돌(`F.` 중복)은 이번 diff 에서 해소됨 — `workflow-crud.e2e-spec.ts` 신규 케이스는 `H.`, `workspace-rbac.e2e-spec.ts` 신규 케이스는 `J.` 로 유일하게 재명명, 전수 grep 으로 A~J·S 라벨 중복 없음 확인. | `codebase/backend/test/{workflow-crud,workspace-rbac}.e2e-spec.ts` | 조치 불요(회귀 없음 확인 차 기록). |
| 8 | security | 신규 검출 가드 3종(구조/이름/문서 축)은 정적·테스트 시점 검출이며, 런타임 방어(`select:false` 전역 재배선, 전역 `ClassSerializerInterceptor`)는 실측 근거(19곳 공유 로더/46개 호출지점, wire 전체 변경 위험)로 명시적으로 기각됨 — 이미 배포된 코드나 스캔 범위 밖 우회 경로는 못 막는 래칫형 방어라는 한계가 CHANGELOG·가드 JSDoc 에 투명하게 명시됨. | `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts`, `shared/testing/user-secret-absence.ts` | 조치 불요. `select:false`/직렬화 인터셉터 도입 트리거 조건을 plan 에 남겨두면 트레이드오프가 영구 방치로 굳어지지 않는다. |
| 9 | security | 이름 축(`expectNoUserSecrets`) 배선이 아직 3개 e2e 파일에만 존재 — 점진적 확장이며 이미 plan 에 후속 등재됨. DTO JSDoc 인용 가드 베이스라인에 남은 2자리(`schedule-response.dto.ts`, `trigger-response.dto.ts`)는 내부 리뷰 경로 노출을 의도적으로 동결 중(민감도 낮음, `#1291` 기존 자리). | `spec/conventions/review-citations.md §4`(동결 근거) | 조치 불요 — 이미 문서화·plan 등재됨. |
| 10 | architecture | `User` 안전 투영(`id`/`name`/`email`) 로직이 `workflow-versions.service.ts`(`CREATOR_PROJECTION` 객체 상수)와 `audit-logs.service.ts`(`.addSelect` 문자열 배열)에 서로 다른 문법으로 독립 중복 구현되어 있다 — 공유 프리미티브 없음. | `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:69` vs `audit-logs.service.ts` | 급하지 않음(필드 3개, 각자 회귀 테스트 보유). 세 번째 자리가 필요해지면 `shared/` 공용 상수로 승격 고려. |
| 11 | architecture | (긍정 기록) `repo-guards/__tests__/` 의 "순수 스캔 로직/소비 spec 분리" 관례가 3번째 가드(`dto-jsdoc-citation-guard.ts`)에도 일관 적용됐고, `isResponseDtoFile` 재사용으로 "응답 DTO 파일 판정" SoT 를 단방향 의존으로 통일(순환 없음). `findOne`/`findByWorkflow` 반환 타입 좁히기도 컴파일 타임 계약으로 설계 의도와 메커니즘이 정확히 일치. | `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation-guard.ts:12` | 조치 불요. |
| 12 | requirement | `spec/5-system/2-api-convention.md` §5.4 「검증 층」이 여전히 "두 검증자"로 서술 — 실제로는 3축(구조·이름·JSDoc 인용). 이미 plan(`spec-draft-nullable-notation-followups.md`)에 planner 후속으로 등재된 known gap이며 developer 쓰기 권한(`spec/`) 밖. | `spec/5-system/2-api-convention.md:227` | 조치 불요(추적 중) — 다음 planner 턴에서 §5.4 표에 세 번째 행 추가, "두 검증자"→"세 검증자" 정정. |
| 13 | scope | `dto-jsdoc-citation-guard` 서브시스템(파일 3종 + spec 문서 정정)은 "User 컬럼 노출 방어"와는 결이 다른 별개 axis(주석-인용 규약 시행)이며 실질 diff 의 약 21%(470/2214줄)를 차지 — 다만 별도 plan 트래커, planner 턴, `--spec` consistency-check(BLOCK:NO)를 거친 통제된 확장으로 투명하게 disclose 됨. | `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation-guard.ts` 등 5개 파일 | 조치 불요. 향후 유사 상황에서 부수 발견 서브시스템을 별도 PR 로 분리할지 여부는 사용자 확인 고려. |
| 14 | side_effect | 신규 가드 3종은 파일 스캔(`fs.readFileSync`)만 하며 쓰기·네트워크·환경변수 접근 없음(전수 grep 0건). 신규 e2e 는 기존 헬퍼(`registerAndLogin`, `createTeamWorkspace` 등)만 재사용해 새로운 종류의 부작용 없음. `spec/conventions/*` 정정은 CLAUDE.md 자기-반증형 소정정 절차(원문 보존+취소선)를 준수한 순수 문서 변경. | 신규 가드 3파일, 신규 e2e 3케이스, `spec/conventions/*.md` | 조치 불요. |
| 15 | testing | `enclosingName` 의 `'<module>'` 폴백 분기가 어떤 fixture 로도 실행되지 않음(모듈 최상위 직접 호출 형태 fixture 부재) — 직전 라운드(12:53:28)가 이미 조치 불요로 처분한 항목의 재확인. `findUserSecretLeaks` 가 응답 최상위(depth 0, 봉투 없음)에 금지 키가 오는 경로를 명시적으로 단언하는 테스트가 없음(구조적으로는 동작하나 미검증) — 이번 라운드 신규 발견, 실 응답이 전부 봉투 구조라 실질 위험 낮음. | `user-entity-exposure-guard.ts`(`enclosingName`), `shared/testing/user-secret-absence.spec.ts` | 낮은 우선순위. `findUserSecretLeaks({ passwordHash: 'x' })` 한 줄 테스트 추가로 depth-0 분기를 명시적으로 문는다. |
| 16 | api_contract | `WorkflowVersionDetail.creator: ProjectedCreator` 는 non-optional/non-nullable 인데, 공개 DTO(`WorkflowVersionCreatorDto`)는 `creator?: ... | null` 로 더 느슨하게 선언 — 방향 불일치(FK NOT NULL 이라 즉시 깨지는 결함은 아님). | `workflow-versions.service.ts`(내부 타입) vs `dto/responses/workflow-version-response.dto.ts:44-49,81-86` | 급하지 않음. 여유 될 때 DTO 를 `required`+non-nullable 로 좁히거나 서비스 타입을 `| null` 로 넓혀 엄격도 방향을 맞춘다. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | Critical 취약점(User 전 컬럼 유출) 수정 완전성 확인, 검출 가드 3종 설계 근거 실측 확인 |
| architecture | LOW | 허용 목록이 DB투영/JS수동매핑을 동일 등급 취급(WARNING), CREATOR_PROJECTION 이중 구현(INFO) |
| requirement | HIGH | `review-citations.md` code: 블록 YAML 주석이 게이트 파서 조기종료 → spec-link 목표 미달성+회귀(CRITICAL) |
| scope | LOW | 실질 20개 파일 전부 단일 목적 또는 직접 파생, 무관 변경 없음 |
| side_effect | NONE | 8축 side effect 위험 없음, 시그니처 축소·필드 추가 모두 안전 확인 |
| maintainability | LOW | dto-jsdoc-citation.spec.ts fixture 경로 인라인 중복(WARNING), 과거 지적 2건 해소 확인 |
| testing | LOW | 6라운드 검출력 결함 전부 반영 확인(40/40 통과), 낮은 우선순위 분기 커버리지 갭 2건 |
| documentation | LOW | 과거 문서화 결함 전부 해소 확인, plan 인계표 1행 narrow glob 재발(WARNING) |
| api_contract | LOW | 응답계약 위반 수정 확인, 내부타입 vs DTO 엄격도 방향 불일치(INFO) |

## 발견 없는 에이전트

없음 — 전 reviewer 가 최소 1건 이상의 발견(대다수 INFO, 일부 WARNING/CRITICAL)을 보고함.

## 권장 조치사항

1. **[최우선/Critical]** `spec/conventions/review-citations.md` frontmatter `code:` 블록에서 YAML 주석 2줄을 제거하고, `_parse_frontmatter_code()` 를 직접 실행해 `dto-jsdoc-citation-guard.ts`/`.spec.ts` 를 포함한 최소 4개 항목이 실제로 파싱되는지 확인한다. 이 정정 없이는 이번 PR 이 선언한 "가드 약화 시 게이트가 문다"는 목표가 미달성 상태로 머지된다.
2. `plan/in-progress/spec-draft-nullable-notation-followups.md` §5.4 인계 표 1행의 glob 을 `user-entity-exposure*.ts` 로 정정해, 다음 planner 턴이 narrow glob 결함을 그대로 집행하지 않도록 한다.
3. `dto-jsdoc-citation.spec.ts` 의 fixture 경로를 모듈 최상위 상수로 통합(`swagger-dto-contract.spec.ts` 의 `RATCHET_FIXTURE` 패턴 준용).
4. `user-entity-exposure.spec.ts` 의 `EXPECTED_USER_RELATION_LOADS` 허용 목록에 방어 메커니즘 종류(DB 투영 vs JS 수동 매핑) 구분 태그 또는 2차 술어를 추가하는 것을 검토한다 — 최소한 `listMembers` 항목이 e2e 하나에만 의존한다는 사실을 주석에 명시한다.
5. (낮은 우선순위) `findUserSecretLeaks` 의 depth-0 분기 테스트 1줄 추가, `WorkflowVersionCreatorDto` 의 optional/nullable 엄격도를 내부 타입과 맞추는 것을 여유 될 때 처리한다.
6. (스코프 밖 권고) 과거 `GET /api/workflows/:wfId/versions/:versionId` 를 호출했던 뷰어 권한 이상 사용자가 있었다면, 이미 유출됐을 수 있는 자격증명(비밀번호 해시·2FA 시크릿·복구 코드·토큰)에 대한 로테이션 필요성을 별도로 검토한다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract (9명)
  - **제외**: 아래 표 (5명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (forced 전원 결과 확보됨 — 누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단 — 이번 diff 는 성능 영향 축 해당 없음 |
  | dependency | router 판단 — 의존성 변경 없음 |
  | database | router 판단 — 스키마/마이그레이션 변경 없음(TypeORM `select` 옵션만 변경) |
  | concurrency | router 판단 — 동시성 관련 변경 없음 |
  | user_guide_sync | router 판단 — 사용자 가이드 동기화 대상 아님 |