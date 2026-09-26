# 정식 규약 준수 검토 — workflow-version-creator (`spec/3-workflow-editor/`, --impl-done)

## 검토 범위 요약

- scope(`spec/3-workflow-editor/`) 델타: **0개 파일** — 이 PR 은 해당 spec 영역을 바꾸지 않았다 (정상, CRITICAL 근거 아님).
- 실제 구현 diff: `codebase/backend/src/modules/workflow-versions/**` 6개 파일 / 297줄 — `WorkflowVersionDto` ·
  `WorkflowVersionListItemDto` 의 `creator` · `changeSummary` 를 `@ApiPropertyOptional` + `nullable` (§5.4 금지 조합)에서
  기본형(`creator` required, `changeSummary` required+nullable)으로 정정 + 두 조회(`findByWorkflow`/`findOne`)의 공유
  `select` 를 `VERSION_METADATA_SELECT` 상수로 추출.
- 대조 규약: `spec/conventions/swagger.md` §1-4·§1-6·§5-1·§3, `spec/5-system/2-api-convention.md` §5.4 (부재 표현).
- 참고: `plan/in-progress/workflow-version-creator.md` 에 `--impl-prep` 결과(`review/consistency/2026/09/26/23_55_27`,
  BLOCK:NO)와 `/ai-review` 2라운드(Critical 0 · Warning 0 수렴) 처분이 이미 기록돼 있다.

## 발견사항

### [INFO] 구현 diff 자체는 §5.4 / swagger §1-4 규약을 정확히 따른다

- target 위치: `codebase/backend/src/modules/workflow-versions/dto/responses/workflow-version-response.dto.ts` (`creator` ·
  `changeSummary` 필드), `workflow-versions.service.ts` (`VERSION_METADATA_SELECT`)
- 위반 규약: 해당 없음 — 오히려 `spec/conventions/swagger.md` §1-4(`nullable: true` vs `ApiPropertyOptional` 선택 기준) ·
  `spec/5-system/2-api-convention.md` §5.4(표: "`null` 을 쓰는(상시 존재) 필드 → `@ApiProperty({ nullable: true })` +
  `field: T | null`", "TS 타입이 `| null` 인데 `nullable: true` 를 선언하지 않는 것은 어느 쪽에서도 틀렸다")를 **준수하는 방향으로
  기존 위반을 정정**한 diff다.
- 상세: 종전 선언(`@ApiPropertyOptional({ nullable: true })` + `field?: T | null`)은 §5.4 가 명시적으로 금지하는 조합("optional
  + nullable" — `ApiPropertyOptional` 은 `required: false` 별칭이라 상시 존재 필드에 쓰면 계약과 모순)이었다. 이번 diff 는 이를
  `creator: WorkflowVersionCreatorDto`(required, non-null — 관계가 `NOT NULL FK` 라 항상 채워짐) / `changeSummary: string |
  null`(required + `nullable: true`)로 좁혀 규약과 실측(런타임)을 일치시켰다. `swagger-dto-contract.spec.ts` 의
  `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 래칫에서 해당 4행을 제거한 것도 §5.4 준수 방향과 일치한다(래칫 목적 자체가 이 금지 조합의
  잔존 목록이므로, 고쳤으면 빼는 것이 맞다).
- 제안: 조치 불요 — 규약 준수 사례로 기록.

### [WARNING] `5-version-history.md` §7.2 가 응답 타입을 DTO 가 아닌 엔티티명으로 표기 (기존 이격, 본 PR 무관·이미 등재됨)

- target 위치: `spec/3-workflow-editor/5-version-history.md` §7.2 "버전 상세" — "응답: `WorkflowVersion` 단건 + `snapshot`
  포함."
- 위반 규약: `spec/conventions/swagger.md` §5-1 — "엔티티(`entities/*.entity.ts`)를 그대로 노출하지 말고, API 응답 형태에 맞춰
  별도 DTO 를 만듭니다", 응답 DTO 클래스명은 저장소 전체에서 유일해야 한다는 명명 규약.
- 상세: 실제 구현·같은 문서 §7.1 은 정확히 `WorkflowVersionListItemDto[]` 로 DTO 클래스명을 적는데, §7.2 만 엔티티명과 동일한
  `WorkflowVersion` 을 쓴다. 실제 상세 응답 DTO 는 `WorkflowVersionDto` 다. **이 이격은 이번 PR 의 diff 로 생긴 것이 아니라
  기존 상태**이며, 동일 이슈가 이미 `--impl-prep` 단계 `review/consistency/2026/09/26/23_55_27` W1 로 발견되어
  `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 후속 항목으로 2026-09-27 등재돼 있다(`spec/`
  쓰기는 developer 권한 밖이므로 정당한 위임).
- 제안: 신규 조치 불요 — 이미 올바른 절차(consistency-check 발견 → spec 변경은 planner 위임 → 트래커 등재)를 거쳤다. planner
  세션에서 해당 항목 처리 시 `WorkflowVersion` → `WorkflowVersionDto` 로 정정 권고.

### [WARNING] `5-version-history.md` 에 `## Rationale` 섹션 부재 (기존 이격, 본 PR 무관·이미 등재됨)

- target 위치: `spec/3-workflow-editor/5-version-history.md` 전체 구조
- 위반 규약: CLAUDE.md "정보 저장 위치" 표 — "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`" 및 각 SKILL.md 가 권장하는
  Overview / 본문 / Rationale 3섹션 구성.
- 상세: 같은 `spec/3-workflow-editor/` 디렉터리의 다른 문서들(`0-canvas.md`, `2-edge.md`, `3-execution.md` 등)은 모두 말미에
  `## Rationale` 섹션을 갖추고 있으나 `5-version-history.md` 만 없다. §7.1 의 "`snapshot` 제외(m-3)", §6 의 "페이지 리로드"
  근거가 본문에 산재해 있다. **이 역시 본 PR 이전부터의 상태**이며, 위와 같은 트래커 항목(W2)으로 이미 등재돼 있다.
- 제안: 신규 조치 불요 — planner 세션에서 후속 항목 처리 시 함께 반영 권고.

### [INFO] 내부 서사 주석(`//`)과 JSDoc 의 상대 순서가 저장소 선례와 다르다

- target 위치: `workflow-version-response.dto.ts` 의 `creator` · `changeSummary` 필드 — JSDoc(`/** */`) 이 먼저, 그 아래
  `//` 내부 서사, 그 아래 `@ApiProperty` 순.
- 위반 규약: 엄밀한 위반은 아님 — `spec/conventions/swagger.md` §3 "JSDoc 은 공개 OpenAPI 로 나간다 — 내부 서사를 담지 않는다"
  규칙 자체(무엇이 JSDoc 에, 무엇이 `//` 에 가는지)는 정확히 지켰다. 다만 규약이 예시로 드는 저장소 선례
  (`alert-rule-response.dto.ts` 의 `threshold`)는 `//` 내부 서사를 JSDoc **위**에 두는 반면, 이번 diff 는 JSDoc 을 먼저 두고
  `//` 를 그 아래(데코레이터 바로 위)에 둔다. 규약 문장 자체("바로 위 `//` 주석")는 두 순서 모두와 양립 가능해 형식 위반으로
  단정하기는 어렵다.
- 제안: 조치 불요 — 규약 문서에 순서 고정이 없으므로 INFO 로만 기록. 추후 규약을 갱신해 순서까지 못박을지는 planner 판단.

## 요약

이번 PR 의 실제 코드 변경(`workflow-versions` 모듈의 `creator`/`changeSummary` DTO 선언 정정 + 공유 `select` 상수화)은
`spec/conventions/swagger.md` §1-4·§5-1·§3 과 `spec/5-system/2-api-convention.md` §5.4 를 정확히 따르며, 오히려 기존에
존재하던 "optional + nullable 금지 조합" 위반을 규약에 맞게 정정한 사례다. `spec/3-workflow-editor/` 스코프 델타는 0으로
정상이다. 발견된 두 건의 WARNING(§7.2 응답 타입명 표기, `## Rationale` 부재)은 모두 이 PR 이전부터 있던 spec 문서 이격이며,
이미 `--impl-prep` 단계에서 정식으로 발견되어 developer 권한 밖(spec 쓰기)이라 planner 트래커
(`plan/in-progress/spec-draft-nullable-notation-followups.md`)에 올바르게 위임·등재된 상태다. 금지 항목을 새로 답습하거나
명명·출력 포맷 규약을 새로 어긴 지점은 발견되지 않았다.

## 위험도

LOW
