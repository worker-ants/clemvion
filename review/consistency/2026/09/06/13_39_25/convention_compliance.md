# 정식 규약 준수 검토 — `spec/5-system/**` (--impl-done, diff 15파일/1977줄)

## 검토 방법

프롬프트 번들의 `spec/5-system` 파일들은 대부분 컨텍스트 예산으로 절단됐고, 실제 구현 diff
(`<git diff origin/main...HEAD -- code_areas>`)도 절단돼 있었다. 절단된 자리는 지시대로
워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/user-entity-column-defense`)를
절대경로로 직접 열어 대조했다 — `git diff origin/main...HEAD --stat`, 변경 파일 전문
(`workspace-response.dto.ts`, `workflow-versions.service.ts`, `dto-jsdoc-citation-guard.ts`,
`user-entity-exposure-guard.ts`/`.spec.ts`, `user-secret-absence.ts`, `workflow-version-response.dto.ts`,
`user.entity.ts`), 그리고 이번 diff 가 건드린 두 정식 규약(`spec/conventions/review-citations.md`,
`spec/conventions/spec-impl-evidence.md`) 전문 + `spec/conventions/swagger.md` 전문 +
`spec/5-system/2-api-convention.md` §5.4(프롬프트에 완전판 포함)를 대조했다.

이 브랜치는 이미 6라운드의 코드 리뷰(`review/code/2026/09/06/{10_13_22..12_53_28}`)와
5라운드의 컨시스턴시 체크(`review/consistency/2026/09/06/{10_13_23..13_18_59}`)를 거친
수렴 후반부 상태다 — 발견 다수가 이미 코드·문서 양쪽에 반영돼 있다. 본 라운드는 그 반영
결과가 실제로 정식 규약과 합치하는지 재확인하는 데 집중했다.

## 발견사항

- **[INFO]** 신규 검출 3축(`user-entity-exposure-guard*.ts` · `user-secret-absence*.ts`)이
  아직 어느 spec 의 `code:` 에도 등재되지 않음
  - target 위치: `spec/5-system/2-api-convention.md` §5.4 「검증 층」· `spec/conventions/swagger.md`
    §5-1 (신규 등재 대상으로 지목된 자리)
  - 위반 규약: 엄밀히는 위반이 아니다 — `spec-impl-evidence.md` §4 의 build 가드
    (`spec-code-paths.test.ts`)는 "글로브가 ≥1 파일에 매치"만 요구하고, 두 문서 모두
    `status: implemented`(기존 `code:` 글로브가 이미 매치 조건을 만족)라 build 는 통과한다.
  - 상세: `git -C <worktree> grep -rn "user-entity-exposure\|user-secret-absence" spec/` 이
    0건이라, 실측으로 두 파일이 어느 spec 의 `code:` glob 에도 걸리지 않음을 확인했다. 다만
    이는 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 미체크
    항목("신규 검출 3축을 §5.4 「검증 층」과 `code:` 에 등재")으로 명시 추적 중이고, 그
    등재문 자체가 `review_guard._spec_linked_changes()` 를 직접 호출해 "0/4 파일이
    spec-linked" 임을 실측·기록했다. `dto-jsdoc-citation*.ts` 축은 같은 세션에서 이미
    `review-citations.md` 의 `code:` 에 편입됐고(커밋 `0f689bb7e`), 남은 두 축(구조·이름)만
    미편입 상태다.
  - 제안: 규약 갱신이 필요하다기보다 실행 순서 문제다 — `codebase/` 변경은 `developer`
    권한, `spec/` 변경은 `project-planner` 권한이라는 CLAUDE.md 역할 분리를 developer 가
    정확히 지켜 이월한 것(자기-반증형 소정정 조건도 아니고, `spec/` 쓰기 권한도 없음)이므로
    이번 라운드에서 새로 지적할 사항이 아니라 이미 올바르게 추적된 상태임을 확인만 한다.

## 검증한 항목 (위반 없음 확인)

- **명명 규약** — 신규 가드 4쌍(`dto-jsdoc-citation-guard.ts`/`.spec.ts`,
  `user-entity-exposure-guard.ts`/`.spec.ts`)이 기존 `repo-guards/__tests__/` 관례
  (`<name>-guard.ts` + `<name>.spec.ts`, 예: `swagger-dto-contract-guard.ts` /
  `swagger-dto-contract.spec.ts`)를 그대로 따른다. 신규 fixture
  (`fixtures/dto/responses/jsdoc-citation.fixture.ts`, `fixtures/user-eager-relation.fixture.ts`,
  `fixtures/user-relation-load.fixture.ts`)도 `fixtures/` 서브디렉터리 안의 기존 명명
  (`fixtures/dto/responses/optional-nullable.fixture.ts`, 점 구분자)과 일치한다 — `__tests__/`
  루트의 구관례(하이픈 구분자)와는 다르지만, 신규 파일들이 놓인 자리(=`fixtures/` 서브디렉터리)
  기준으로는 기존 관례와 합치한다.
- **API 문서 규약(Swagger)** — `WorkspaceMemberDto.joinedAt` 신규 필드가
  `@ApiProperty({ format: 'date-time', nullable: true, type: String })` +
  `joinedAt: string | null` 로, `2-api-convention.md §5.4`("상시 존재 + null" 케이스 →
  `@ApiProperty({nullable:true})` + `field: T | null`, `@ApiPropertyOptional` 금지)와
  정확히 일치했다. 내부 서사(왜 이 필드가 이 형태인지, 리뷰 인용)는 JSDoc `/** */` 가 아니라
  바로 위 `//` 에 있어 `swagger.md §3`("JSDoc 은 공개 OpenAPI 로 나간다 — 내부 서사를 담지
  않는다") 및 `review-citations.md §3`(DTO JSDoc 은 리뷰 인용 대상 아님)을 모두 지켰다.
- **금지 항목 — 엔티티 그대로 노출** — 이번 diff 의 핵심 수정(`WorkflowVersionsService.findOne`)이
  `relations: ['creator']`(투영 없음, `User` 전 컬럼 유출)를 `select: { ..., creator:
  CREATOR_PROJECTION }` 투영으로 교체해 `swagger.md §5-1`("엔티티를 그대로 노출하지 말 것")을
  충족시켰다. 투영 상수(`CREATOR_PROJECTION`)를 두 조회 메서드가 공유하고, 그 일치를
  `workflow-versions.service.spec.ts` 가 OpenAPI 스키마와 대조해 재발(형제 메서드만 옳고
  한쪽이 손 복제로 갈리는 패턴, 이미 한 번 실제로 발생)을 구조적으로 막는다.
- **JSDoc 인용 금지 회피처 검증** — `dto-jsdoc-citation-guard.ts` 가 실제로
  `swagger-dto-contract-guard.ts` 의 `isResponseDtoFile()`(단일 판정처, `import`로 재사용)을
  그대로 쓰는지 코드로 확인했다 — 재구현 아님, 판정 기준 이원화 없음.
  `jsdoc-citation.fixture.ts` 안의 "위반" 샘플(JSDoc 안 리뷰 인용)은 가드가 잡아야 할 음성
  대조군이지 실제 프로덕션 DTO 코드가 아니라는 것도 확인했다.
- **`spec/conventions/review-citations.md`·`spec-impl-evidence.md` 자체 수정** — CLAUDE.md
  "자기-반증형 소정정" 5조건 중 조건 1(developer 가 그 문장을 직접 썼는가)이 `git blame`
  으로 미충족 판정됐고(원 문장 작성자는 planner 턴 커밋 `90c1751e8`), 커밋 메시지가 이를
  명시하며 우회하지 않고 정식 `--spec` 게이트(`review/consistency/2026/09/06/13_18_59`
  BLOCK:NO)를 거쳐 편집했다. 정정 형식(취소선 + `> **정정 (2026-09-06)**:`)도 같은 문서
  §4.2 의 기존 관행(`spec-link-integrity.test.ts` 행의 2026-08-27/07-16 정정)과 일치한다.
  `code:` frontmatter 에 신규 glob 을 추가하며 "준수 예시 / 시행 코드" 두 범주를 인라인 YAML
  주석으로 가른 것도 `spec-impl-evidence.md` §2.1 자신이 방금 명문화한 "축 단위로 갈라 담아도
  된다"는 규칙과 합치한다.
- **numeric/DTO 무관 영역** — 이번 diff 에 numeric 컬럼 wire 타입(swagger.md §1-6), 페이지네이션
  wrapping(§5-2), 상태 토글류(§12) 등 다른 규약 축을 건드리는 변경은 없었다.

## 요약

diff 15개 파일이 도입한 신규 코드(User 엔티티 노출 방지 가드 2종 + DTO JSDoc 인용 가드 +
`WorkspaceMemberDto.joinedAt` 필드 + `WorkflowVersionsService` 투영 수정)를 워킹트리에서
직접 열어 관련 정식 규약(`swagger.md`, `spec/5-system/2-api-convention.md §5.4`,
`review-citations.md`, `spec-impl-evidence.md`)과 대조한 결과 CRITICAL·WARNING 급 위반은
발견되지 않았다. 명명 패턴은 기존 `repo-guards/__tests__/` 관례를 그대로 따르고, 신규
DTO 필드는 §5.4 의 null-vs-키생략 규칙과 JSDoc/`//` 서사 분리 규칙을 모두 충족하며, 핵심
보안 수정(엔티티 그대로 노출 차단)은 swagger.md §5-1 을 정확히 구현했다. 이미 진행된
5~6라운드의 코드·컨시스턴시 리뷰가 발견한 문제들(eager 관계 축 누락, select 축 unwrap 누락,
날짜+시각 정규식 소실, 절 단위 강제 범위 과장 등)은 모두 diff 에 반영돼 있음을 재확인했다.
유일한 잔여 사항(신규 가드 3축이 spec `code:` 에 아직 미등재)은 이미
`plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 턴 대상으로
정확히 추적 중이며, developer 가 `spec/` 쓰기 권한 밖의 일을 올바르게 이월한 것이라
새 지적이 아니라 INFO 로만 재확인했다.

## 위험도

NONE
