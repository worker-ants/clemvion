# 요구사항(Requirement) 리뷰

## 범위 확정

`git diff --stat origin/main...HEAD -- ':!review/**' ':!plan/complete/**'` 기준 실제 기능 변경은
29개 파일이다 (프롬프트에 나열된 312개 중 나머지는 과거 리뷰 라운드의 `review/**`·
`review/consistency/**` 산출물이며 이번 리뷰의 기능 대상이 아니다). 핵심 변경은 세 갈래다:

1. `User` 엔티티 민감 컬럼 노출 검출 3축 신설 — `user-entity-exposure-guard.ts`(구조),
   `user-secret-absence.ts`(이름), `dto-jsdoc-citation-guard.ts`(JSDoc 인용)
2. 그 축이 찾아낸 실유출 수정 — `WorkflowVersionsService.findOne` 의 `creator` 투영 누락
3. `(workspace_id, endpoint_path)` UNIQUE 위반의 문서화된 409 계약(`details.field`/
   `details.code`) 실제 발행 — `triggers.service.ts` + `pg-error.ts`(SoT 헬퍼) 신설
4. `review_guard._parse_frontmatter_code` YAML 파서 강화(주석/빈 줄/인용 스칼라)

각 항목을 spec 본문·실측·테스트 실행으로 검증했다(아래 "실행 검증" 참조).

## 발견사항

- **[WARNING]** `dto-jsdoc-citation-guard.ts` 의 "bare 시각" 축이 **백틱으로 감싸지 않은**
  `hh_mm_ss` 인용을 놓친다 — 세 형태를 대칭적으로 잡는다는 자체 서술과 어긋난다
  - 위치: `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation-guard.ts` —
    `CITATION_PATTERNS` 배열 3번째 원소 `` /`\d{2}_\d{2}_\d{2}`/ `` (파일 전체 40~47줄,
    특히 46줄). 대조: 같은 배열의 1·2번째 패턴(`review\/(?:code|consistency|merge)/...` ·
    `\d{4}-\d{2}-\d{2}\s+\d{2}_\d{2}_\d{2}`)은 백틱 유무와 무관하게 매치된다.
  - 상세: `review-citations.md §2` 는 "bare `hh_mm_ss` 는 쓰지 않는다" 고 정의하며, 이 가드의
    자체 주석(같은 파일 39~41줄)도 "규약이 금지하는 형태라고 해서 이 가드가 안 봐도 되는
    것은 아니다" 라고 세 형태 모두 대칭적으로 잡겠다고 선언한다. 그런데 실제 패턴 3만
    앞뒤 백틱(`` ` ``)을 요구해, JSDoc 안에 백틱 없이 쓴 bare 시각(예: `17_09_09 W1` 처럼
    prose 안에 그대로 적은 경우)은 검출되지 않는다. 저장소 밖 scratch 디렉터리에서
    `findDtoJsDocCitations` 를 직접 호출해 재현했다(저장소 파일은 건드리지 않음) —
    백틱 없는 JSDoc 인용은 `[]`(미검출), 동일 문자열에 백틱만 두른 버전은 정상 검출됨을
    확인했다. `dto-jsdoc-citation.spec.ts:108` 의 대조군 단언(`/^`\d{2}_\d{2}_\d{2}`$/`)도
    이 백틱 전제를 그대로 굳혀 두어, 향후 누군가 fixture 에 백틱 없는 bare 시각을 추가해도
    실패하지 않는다(그 분기 자체가 fixture 에 없다).
  - 근거(재현, 저장소 비변경): scratch 파일 `probe-dto/dto/responses/probe.dto.ts` 에
    ``bare 시각 without backticks: 17_09_09 W1`` 을 JSDoc 으로 넣고
    `findDtoJsDocCitations` 를 직접 호출 → `[]`. 같은 문자열에 백틱만 둘러
    `` `17_09_09` `` 로 바꾸면 → 정상 검출(`ProbeDto2.name`, citation `` `17_09_09` ``).
  - 제안: 패턴 3 을 `` /(?<!\S)\d{2}_\d{2}_\d{2}(?!\S)/ `` 류로 완화해 백틱 유무와 무관하게
    잡거나(단 오탐 방지를 위해 앞뒤 경계 조건은 유지), 백틱을 요구하는 것이 의도된 설계라면
    그 이유(예: "bare 시각의 실제 표기 관례가 항상 백틱을 두른다")를 코드 주석과
    `review-citations.md §2` 에 명시한다. 반대 방향 대조군(백틱 없는 bare 시각 fixture)도
    함께 추가해 이 분기가 향후에도 관측되게 한다.

- **[INFO]** `spec/5-system/2-api-convention.md §5.4` "검증 층" 이 아직 신규 검출 축을
  반영하지 않은 상태이지만, 이는 이미 알려진 갭이고 `plan/in-progress/
  spec-draft-nullable-notation-followups.md:383` 에 planner 후속 항목으로 정확히 등재돼
  있어 조치 불요
  - 위치: `spec/5-system/2-api-convention.md` "본 절은 **선언과 실제가 같아야 한다**고
    요구하지만... 그 자리를 **두 검증자**가 나눠 맡는다" 문장(§5.4 검증 층 도입부) —
    이제 `user-entity-exposure-guard.ts`/`user-secret-absence.ts` 라는 제3의 검증 축이
    생겼으므로 "두 검증자" 는 더 이상 전수가 아니다.
  - 상세: `CLAUDE.md` 규약상 `spec/` 은 `project-planner` 소관이라 developer 가 직접 고칠
    수 없고, 실제로 diff 는 그 문서를 건드리지 않고 대신 plan 항목으로 등재해 다음 planner
    턴에 위임했다(정확한 처리). `spec-draft-nullable-notation-followups.md:383~445` 가
    등재할 정확한 표 행·문서 위치까지 명시하고 있어 후속 turn 이 그대로 집행 가능한 상태다.
  - 제안: 조치 불요 — 다음 planner 턴에서 §5.4 갱신.

- **[INFO]** `WorkflowVersionCreatorDto` 를 감싸는 필드 선언이 §5.4 DTO 선언 규칙과
  다르지만, 이번 diff 가 만든 파일이 아니라 사전 존재 코드라 범위 밖
  - 위치: `codebase/backend/src/modules/workflow-versions/dto/responses/
    workflow-version-response.dto.ts:45-49`, `:82-86` — `@ApiPropertyOptional({ type: () =>
    WorkflowVersionCreatorDto, nullable: true })` + `creator?: WorkflowVersionCreatorDto |
    null;`
  - 상세: `2-api-convention.md §5.4` 는 "키 생략" 필드는 `@ApiPropertyOptional()` +
    `field?: T`(`| null` 금지), "`null` 상시 존재" 필드는 `@ApiProperty({ nullable: true })`
    + `field: T | null` 로 양분한다. 이 필드는 `ApiPropertyOptional`(키 생략 신호)과
    `nullable: true` + `| null`(상시 존재 신호)을 동시에 써서 어느 쪽에도 온전히 맞지 않는다.
    다만 `git log --oneline -- <파일>` 로 확인한 결과 이 파일은 `#593`(구 커밋)부터 있던
    코드이고 이번 diff 는 이 파일을 전혀 건드리지 않았다 — `ProjectedCreator`/
    `CREATOR_PROJECTION` 이 이 DTO 의 필드 **집합**(id/name/email)과 일치하는지는 이번 PR 이
    테스트로 강제하지만(`workflow-versions.service.spec.ts` 의 OpenAPI 스키마 대조), 그
    래퍼 필드의 optional/nullable 선언 방식 자체는 이번 변경의 대상이 아니다.
  - 제안: 조치 불요(이번 diff 범위 밖). 다음에 이 DTO 를 만질 때 §5.4 형태로 함께 정정.

## 실행 검증 (저장소 비변경)

- `jest src/repo-guards/__tests__/user-entity-exposure.spec.ts
  src/repo-guards/__tests__/dto-jsdoc-citation.spec.ts src/common/db/pg-error.spec.ts` →
  3 suites / 31 tests 전부 통과.
- `jest src/modules/workflow-versions/workflow-versions.service.spec.ts
  src/modules/triggers/triggers.service.spec.ts
  src/modules/workspaces/workspaces.service.spec.ts
  src/shared/testing/user-secret-absence.spec.ts` → 4 suites / 170 passed + 1 skipped(사전
  존재 `it.skip('structural anchor', ...)`, `triggers.service.spec.ts:964`, 이번 diff 와 무관).
- `python3 -m pytest .claude/tests/test_review_guard.py` → 48 passed.
- `2-trigger-list.md:164` 의 문구("409 `RESOURCE_CONFLICT` (세부 코드
  `TRIGGER_ENDPOINT_PATH_CONFLICT`, `details.field='endpoint_path'`)")와
  `triggers.service.ts` 의 `rethrowEndpointPathConflict` 발행 객체가 필드명·값 모두
  line-level 로 일치. 인덱스 이름(`idx_trigger_workspace_endpoint`)도
  `migrations/V002__indexes.sql:26` 과 일치.
- `workspace-response.dto.ts` 의 `joinedAt` 주석이 주장하는 "네 자리가 전부 `new Date()`
  로 채운다" 를 grep 으로 재확인 — `workspace-invitations.service.ts:471`,
  `workspaces.service.ts:65/184/262` 4곳 전부 확인됨.
- `pg-error.ts` 의 `.constraint` 필드명·`driverError` 이중 표면 처리 방식이
  `integration-oauth.service.ts` 의 기존 선례와 일치 — 새 규약이 아니라 기존 관행의 통합.

## 요약

핵심 3갈래 변경(검출 3축 신설, `WorkflowVersionsService.findOne` 실유출 수정,
트리거 endpoint_path 충돌 계약 구현) 모두 관련 spec 본문(`2-trigger-list.md §3`,
`2-api-convention.md §5.3/§5.4`)과 line-level 로 정확히 일치하고, 관련 유닛·가드 테스트를
직접 실행해 전부 green 임을 확인했다. 엣지 케이스(관계가 `null`/키 없음, unique 위반이 아닌
에러, 다른 인덱스 위반, eager 관계 대조군, select 값이 boolean 인 위장 투영 등) 처리도
fixture 로 양방향 대조돼 있다. 유일한 실질 결함은 `dto-jsdoc-citation-guard.ts` 의 "bare
시각" 패턴이 백틱으로 감싸지 않은 인용을 놓치는 검출 갭으로, 저장소 비변경 재현으로
확인했다(WARNING). 나머지 두 건은 이미 plan 에 등재됐거나 이번 diff 범위 밖의 사전 존재
코드라 조치 불요.

## 위험도

LOW
