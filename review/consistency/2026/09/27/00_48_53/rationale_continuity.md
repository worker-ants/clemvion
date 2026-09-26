# Rationale 연속성 검토 — workflow-version-creator

## 검토 범위

- scope 문서(`spec/3-workflow-editor/`)의 git 델타는 0개(코드 전용 PR, 정상).
- 실제 변경은 `codebase/backend/src/modules/workflow-versions/**`(DTO·서비스·테스트)이며, 대상 spec 은
  `spec/3-workflow-editor/5-version-history.md`, 관련 규약은 `spec/5-system/2-api-convention.md §5.4`,
  `spec/conventions/swagger.md §1-3/§1-4`, `spec/1-data-model.md` §2.15/Rationale.
- 컨텍스트 예산으로 프롬프트에서 잘린 `5-version-history.md`·git diff 본문·`1-node-common.md`·`4-ai-assistant.md`·
  `_product-overview.md` 는 워킹트리 절대경로(`/Volumes/project/private/clemvion/.claude/worktrees/workflow-version-creator`)에서
  직접 `Read`/`git diff`/`git show` 로 재확인했다.
- 함께 확인한 근거: `plan/in-progress/workflow-version-creator.md`(실측·방향·뮤턴트·`--impl-prep` 처분 전문),
  `plan/in-progress/spec-draft-nullable-notation-followups.md`(해당 부채 두 항목의 원 등재 텍스트 + 이번 PR 이 새로
  등재한 planner 항목).

## 발견사항

이 PR 이 과거 Rationale 을 뒤집거나 기각된 대안을 재도입하는 지점은 찾지 못했다. 오히려 이 diff 는 아래 세 Rationale 이
명시적으로 요구하는 방향과 정확히 일치한다.

- **[INFO] `select` 투영 패턴은 과거에 "기각된 대안 재도입" 으로 세 차례 오판된 전례가 있는 모양 그대로다 — 이번엔 정상**
  - target 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` 의 신규 `VERSION_METADATA_SELECT`
    상수 + `findByWorkflow`/`findOne` 의 `select: { ...VERSION_METADATA_SELECT, creator: CREATOR_PROJECTION }`.
  - 과거 결정 출처: `spec/1-data-model.md` Rationale "`User` 민감 컬럼 방어를 `select: false` 가 아니라 응답 경계에 둔 이유
    (2026-09-06)" — 이 문서는 **바로 이 서비스의 이 코드**(`WorkflowVersionsService.findOne`(`CREATOR_PROJECTION`))를
    "채택안(쿼리 범위 `select` 투영)" 의 사례로 직접 지목하고, "표만 읽은 다음 검토자가 `select: {…}` 를 보고 1행이 기각한
    대안(엔티티 `select: false`)의 재도입으로 오판할 수 있다" 고 선제적으로 경고한다(`--impl-done` 이 세 라운드 연속
    이 오판을 지적했다는 이력도 함께 적혀 있다).
  - 상세: 이번 diff 는 그 경고가 지목한 정확히 그 패턴(쿼리 범위 select, 엔티티 컬럼 `select: false` 아님)을 `findByWorkflow`
    와 `findOne` 양쪽에서 공유 상수로 승격시킨 것뿐이다. 기각된 대안(엔티티 `@Column({ select: false })`)은 diff 어디에도
    없다 — `git grep -n "select: false" codebase/backend/src/modules/workflow-versions` 결과 0건.
  - 제안: 조치 불필요. 다만 이 오판이 반복 이력이 있는 지점이므로, 향후 검토자를 위해 위 데이터 모델 Rationale 링크를
    `workflow-versions.service.ts` 상단 주석에 한 줄 추가하는 것도 고려할 만하다(선택 사항, blocking 아님).

- **[INFO] `changeSummary`/`creator` DTO 선언을 required 로 좁힌 것은 "번복" 이 아니라 등재된 부채 상환 — 새 Rationale 필요 없음**
  - target 위치: `codebase/backend/src/modules/workflow-versions/dto/responses/workflow-version-response.dto.ts` —
    `WorkflowVersionDto`/`WorkflowVersionListItemDto` 의 `creator`·`changeSummary` 를 `@ApiPropertyOptional({ nullable: true })`
    +`?: T | null` 에서 `@ApiProperty(...)` + `T`/`T | null`(required)로 변경.
  - 과거 결정 출처: `spec/5-system/2-api-convention.md` §5.4 "부재 표현 — `null` vs 키 생략" — "`null` 을 쓰는(상시 존재)
    필드 → `@ApiProperty({ nullable: true })` + `field: T | null`" / "TS 타입이 `| null` 인데 `nullable: true` 를 선언하지
    않는 것은 어느 쪽에서도 틀렸다". 같은 문서 §5.4 에 "optional+nullable 동시 조합은 금지" 원칙이 있고, 그 위반 4행이
    이미 `swagger-dto-contract.spec.ts` 의 `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 에 **등재된 기존 부채**로 동결돼 있었다
    (실측: `plan/in-progress/workflow-version-creator.md` §실측, `plan/in-progress/spec-draft-nullable-notation-followups.md`
    의 원 항목 텍스트 — "즉 추적 안 되는 갭이 아니라 등재된 부채다").
  - 상세: 이 diff 는 §5.4 원칙을 거스르는 것이 아니라 그 원칙이 요구하는 형태로 **되돌리는(remediate)** 변경이다. 방향
    전환의 근거(2026-09-06 실측: `created_by NOT NULL REFERENCES user(id)` FK 무-CASCADE-DELETE 로 `creator` 가 항상
    로드됨)는 plan 문서에 실측과 함께 이미 기록돼 있고, `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 4행 삭제는 그 부채를 갚았다는
    래칫 증거다. spec 본문(`5-version-history.md` §7.1 표: "포함 | 포함")도 이미 required 를 전제하고 있어 spec 과의
    사전 불일치도 없었다(`spec_impact: none` 이 plan 에 명시).
  - 제안: 조치 불필요. formal `## Rationale` 절이 spec 문서 자체(`5-version-history.md`)에는 없지만, 이는 이 PR 이전부터
    있던 별개의 기존 이격이며(아래 항목 참조) 이 PR 이 새로 만든 결함이 아니다.

- **[INFO] 프런트엔드 미러(`creator?: {…} | null`)를 의도적으로 좁히지 않은 결정 — 근거는 기록됐으나 spec 이 아닌 코드에만 있음**
  - target 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` 의
    `WorkflowVersionDetailProjection` JSDoc에 추가된 문단("프런트엔드 미러는 그대로 넓게 둔다…").
  - 과거 결정 출처: 해당 사안을 직접 다루는 기존 spec Rationale 은 없음 — plan 수준 결정(`plan/in-progress/workflow-version-creator.md`
    §실측 마지막 항목)이다.
  - 상세: 백엔드 계약을 좁히면서 프런트엔드 타입은 의도적으로 넓게 유지하는 비대칭 결정이다. 런타임 안전(넓은 선언이 실제
    값보다 넓을 뿐 좁지 않음)과 소비처(`version-history-panel.tsx`)의 방어 분기·테스트 보존을 근거로 들었고, 이 근거를
    코드 JSDoc 에 남겨 "무근거 번복" 은 아니다. 다만 이 근거는 spec 문서의 `## Rationale` 이 아니라 서비스 파일 주석에만
    있어, 다음 사람이 spec 만 보고 이 비대칭을 발견하기 어렵다.
  - 제안: 조치 불요(코드 리뷰 2라운드에서 이미 INFO 로 처분됨 — plan 상 "INFO 2" 참조). spec 쓰기가 필요하면 planner
    턴이며, 이번 PR 의 `spec_impact: none` 판단과 상충하지 않는다(계약 자체는 spec §7.1 표와 일치, 미러 정책은 구현
    세부사항).

- **[정보성, 새 발견 아님] `5-version-history.md` 자체의 `## Rationale` 부재 · §7.2 응답 타입명 오기**
  - target 위치: `spec/3-workflow-editor/5-version-history.md` §7.2("`WorkflowVersion` 단건" — 엔티티명이지 실제 DTO 명
    `WorkflowVersionDto` 가 아님), 문서 전체(같은 디렉터리 다른 5개 문서와 달리 `## Rationale` 섹션 없음).
  - 과거 결정 출처: 없음(이 두 가지는 애초에 spec 자체의 기존 이격이지 Rationale 충돌이 아니다).
  - 상세: 이 두 항목은 `--impl-prep`(`review/consistency/2026/09/26/23_55_27` W1·W2)에서 이미 지적됐고, 이번 PR 과
    무관한 선행 상태로 판정되어 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 신규 planner 항목으로
    올바르게 등재됐다(diff 로 확인). 이번 코드 변경이 만든 결함이 아니므로 본 리뷰의 CRITICAL/WARNING 대상이 아니다.
  - 제안: 조치 불요(이미 트래커에 등재됨). 참고용으로만 표기.

## 요약

diff 는 §5.4("null 상시 존재 필드는 required+nullable, optional+nullable 동시 조합 금지") 원칙을 거스르지 않고 오히려
그 원칙이 요구하는 형태로 기존에 등재돼 있던 부채(`EXPECTED_OPTIONAL_NULLABLE_DRIFT` 4행)를 갚는 변경이다. `select`
투영 방식도 `spec/1-data-model.md` Rationale 이 명시적으로 "채택안" 으로 지목한 패턴을 그대로 확장한 것이며, 그 Rationale
은 이 패턴을 "기각된 대안(`select: false`)의 재도입" 으로 오판하지 말라고 선제적으로 경고까지 해 둔 상태다. 방향 전환의
근거는 plan 문서에 실측과 함께 기록돼 있고, 프런트엔드 미러를 의도적으로 좁히지 않은 비대칭 결정도 코드 주석에 근거가
남아 있다. 이 PR 과 무관한 두 개의 기존 spec 이격(§7.2 타입명, `## Rationale` 부재)은 스스로 식별해 planner 트래커에
등재했을 뿐 은폐하거나 방치하지 않았다. Rationale 연속성 관점에서 문제 삼을 지점이 없다.

## 위험도

NONE
