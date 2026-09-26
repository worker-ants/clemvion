# Requirement Review — workflow-version-creator (`creator`/`changeSummary` §5.4 계약 정정 + 공유 `select` 상수화)

## 검증 방법

프롬프트 조립 문서에 더해, 실제 저장소 파일(`Read`/`Grep`, 저장소 뮤테이션 없음)로 다음을 직접 대조했다:

- `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` — 현재 상태 전문
- `codebase/backend/src/modules/workflow-versions/dto/responses/workflow-version-response.dto.ts` — 현재 상태 전문
- `codebase/backend/src/modules/workflow-versions/workflow-versions.service.spec.ts` — 신규 대칭 단언 포함 전문
- `codebase/backend/test/workflow-crud.e2e-spec.ts` (H/I 테스트 구간)
- `spec/3-workflow-editor/5-version-history.md` §7.1/§7.2
- `spec/5-system/2-api-convention.md` §5.4 (부재 표현 규칙)
- `codebase/backend/migrations/V001__initial_schema.sql` (`workflow_version.created_by` FK · `user.name`/`user.email` 제약을 DB 레벨에서 직접 확인 — plan 의 "실측" 주장을 재검증)
- `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts` (`EXPECTED_OPTIONAL_NULLABLE_DRIFT` 배열 비교 로직)

저장소 파일은 읽기만 했고 수정하지 않았다. `git status --short` 로 별도 확인은 하지 않았으나(뮤테이션을 가하지 않았으므로 불필요) 세션 종료 시점 기준 저장소에 쓰기 명령을 실행하지 않았음을 명시한다.

## 발견사항

- **[INFO]** spec `5-version-history.md` §7.2 가 응답 타입을 엔티티와 동명(`WorkflowVersion`)으로 표기하고 있어 실제 DTO(`WorkflowVersionDto`)와 문면이 어긋난다. `[SPEC-DRIFT]` 성격이지만 이번 PR 의 신규 결함이 아니다 — `plan/in-progress/workflow-version-creator.md`(`--impl-prep` W1) 와 `plan/in-progress/spec-draft-nullable-notation-followups.md:1056-1062` 에 planner 처분 대상으로 이미 등재돼 있다.
  - 위치: `spec/3-workflow-editor/5-version-history.md` §7.2 (실측: 108행 `응답: \`WorkflowVersion\` 단건 + \`snapshot\` 포함.`); 대응 트래커 항목은 `plan/in-progress/spec-draft-nullable-notation-followups.md:1056`
  - 제안: 이미 planner 트래커에 등재됐으므로 이 라운드에서 추가 조치 불요. 재-flag 로 중복 집계하지 말 것 — 처분은 project-planner 몫.

- **[INFO]** `plan/in-progress/workflow-version-creator.md` 체크리스트가 `- [ ] /ai-review`, `- [ ] --impl-done`, `- [ ] 트래커 두 항목 닫기` 로 미완 상태다. 1R RESOLUTION(`69b1afca0`)까지는 반영됐으나 이번 2회차 리뷰(`00_39_57`) 결과 반영과 마무리 커밋(`--impl-done`, 트래커 닫기)이 아직 남아 있다.
  - 위치: `plan/in-progress/workflow-version-creator.md` (체크리스트 섹션, 신규 파일 79~86행)
  - 제안: 기능 결함 아님 — 이번 라운드 SUMMARY 반영 후 마무리 커밋에서 체크.

- **[INFO]** `createVersion()` 의 `changeSummary: changeSummary || undefined` 는 빈 문자열(`''`)을 `undefined`로 뭉갠다. 이번 PR 이 `changeSummary` 를 "항상 실리고 null 일 수 있다"는 강한 계약으로 승격시켰지만, 이 분기 자체는 diff 범위 밖(변경 없음)이고 결과적으로 DB 컬럼이 nullable 이라 응답에서는 여전히 `null`로 정상 관측된다 — 계약 위반은 아니다. 이전 1R 리뷰에서 이미 INFO 12로 동일하게 식별·처분됐다.
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:219`
  - 제안: 조치 불요(범위 밖, 계약상 안전). 향후 이 라인을 다시 만질 기회가 있으면 `changeSummary ?? null` 로 의도를 명시하는 정도의 개선 여지만 있음.

## 상세 검증 결과 (문제 없음, 근거로 기록)

- `WorkflowVersionCreatorDto.id/name/email` required 선언은 `workflow_version.created_by UUID NOT NULL REFERENCES "user"(id)`(ON DELETE 없음 = NO ACTION, `V001__initial_schema.sql:258`)와 `user.name`/`user.email` NOT NULL(`V001__initial_schema.sql:13,15`) 제약을 DB 레벨에서 직접 확인해 plan 의 "실측" 주장과 일치함을 재검증했다. 이후 마이그레이션(V002~V133) 중 `workflow_version`/`user` 스키마를 건드린 것은 없다.
- `creator: WorkflowVersionCreatorDto`(required, non-nullable) 및 `changeSummary: string | null`(`@ApiProperty({ type: String, nullable: true })`) 선언은 `spec/5-system/2-api-convention.md` §5.4 "상시 존재 필드 → `@ApiProperty({ nullable: true })` + `field: T | null`" / "상시 존재인데 optional 데코레이터 쓰면 모순" 규칙과 line-level 로 일치한다.
- `spec/3-workflow-editor/5-version-history.md` §7.1 표(`id·workflowId·version·changeSummary·createdBy·createdAt·creator | 포함 | 포함`)는 목록·상세 둘 다 `creator`·`changeSummary` 를 "포함"으로 명시 — 이번 required 전환과 정합.
- `VERSION_METADATA_SELECT` 상수화 + `findByWorkflow`/`findOne` 적용은 실제 소스에서 확인됨. 단위 테스트가 기존 리터럴 단언(각 조회 개별) + 신규 대칭 단언("select 는 snapshot 하나만 다르다")으로 이중 방어한다 — 리터럴만으로는 "한쪽만 키 추가" 회귀를 못 잡는데 대칭 단언이 그 갭을 메운다.
- `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 래칫에서 4행 제거는 배열 전체 비교(`toEqual` on sorted arrays)로 검증되므로 하드코딩된 카운트 drift 위험이 없다.
- e2e H(`changeSummary: 'v1'`, non-null)와 I(`changeSummary` 생략 → null) 두 케이스가 목록·상세 양쪽에서 `assertMatchesContract` + `expectNoUserSecrets`로 대조된다 — 이전 1R WARNING("null 값 wire 미검증")이 `69b1afca0`(e2e I `toBeNull()` + 목록 계약 대조 추가)로 실제 해소됐음을 코드에서 직접 확인.
- CHANGELOG 제목이 `creator` · `changeSummary` 둘 다 언급하도록 이미 수정돼 있다(1R INFO 14 해소 확인).
- TODO/FIXME/HACK/XXX 주석 없음(변경된 6개 소스/테스트 파일 전수 grep).

review/ 하위의 이전 라운드(00_20_58) 산출물·consistency 산출물(23_55_27)은 리뷰 메타 아티팩트이며 애플리케이션 코드가 아니므로 기능 요구사항 관점에서 별도 결함으로 보지 않았다.

## 요약

`creator`/`changeSummary` §5.4 금지 조합(optional+nullable) 정정과 `VERSION_METADATA_SELECT` 공유 상수화는 spec(§5.4, §7.1)·DB 제약(FK NOT NULL, 컬럼 nullable)과 line-level 로 정확히 일치하며, 1R 리뷰에서 지적된 WARNING(null 값 wire 미검증)도 커밋 `69b1afca0`로 실제 해소됐음을 코드에서 직접 재확인했다. 뮤턴트 5건 전부 KILLED 주장도 테스트 파일 구조(대칭 단언, DTO 캐너리, e2e 계약 대조)와 부합한다. 남은 항목은 모두 이번 PR 범위 밖이거나 이미 planner 트래커에 등재된 기존 spec 이격(§7.2 명칭)과 plan 마무리 체크리스트(bookkeeping)뿐이며, 신규 CRITICAL/WARNING 은 발견되지 않았다.

## 위험도

NONE
