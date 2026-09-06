# 요구사항(Requirement) 리뷰

## 컨텍스트

이 diff(`origin/main...HEAD`, 12 커밋)는 이미 8차례의 `/ai-review`+`/consistency-check`
라운드(`10_13_22`→`10_53_48`→`11_27_53`→`11_55_36`→`12_28_02`→`12_53_28`→`13_39_20`→
`14_25_40`→`14_59_48`→`15_30_59`)를 거친 최종 상태다. 핵심 산출물은 `User` 엔티티 컬럼
노출 검출 3축(`user-entity-exposure-guard.ts` 구조 축·`user-secret-absence.ts` 이름
축·`dto-jsdoc-citation-guard.ts` JSDoc 인용 축), 그 축들이 실제로 찾아낸 두 개의 살아있는
결함 수정(`WorkflowVersionsService.findOne` 의 `User` 전 컬럼 유출, `2-trigger-list.md §3`
이 약속했지만 코드에 0건이던 `endpoint_path` 충돌 계약), 그리고 그 과정에서 발견된 harness
게이트 버그(`review_guard._parse_frontmatter_code` 의 YAML 블록 리스트 파싱 결함) 수정으로
구성된다.

## 검증 방법

- 각 diff 를 `git diff origin/main...HEAD -- <file>` 로 직접 열어 최종 상태를 확인(프롬프트가
  생략한 파일 다수 포함).
- 관련 spec 본문을 라인 단위로 대조: `spec/5-system/2-api-convention.md §5.4`,
  `spec/2-navigation/2-trigger-list.md §3`, `spec/conventions/review-citations.md`.
- `npx jest user-entity-exposure dto-jsdoc-citation user-secret-absence pg-error.spec
  workflow-versions.service.spec triggers.service.spec workspaces.service.spec` →
  **7 suites / 201 passed, 1 skipped**.
- `python3 -m pytest .claude/tests/test_review_guard.py` → **48 passed**.
- 저장소에 뮤테이션 없음 — 읽기 전용 검증만 수행, `git status --short` 는 리뷰 산출물
  디렉터리(`review/code/2026/09/06/16_28_58/`, `review/consistency/2026/09/06/16_29_00/`)의
  untracked 항목만 보여 이 리뷰가 만든 흔적 외에 없음을 확인.

## 발견사항

- **[INFO]** `pgErrorConstraint` 신설 후에도 **기존에 동일 패턴을 손으로 짠 자리**가 하나
  더 남아 있고, 마이그레이션되지 않았다
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts:1269-1273`,
    `:1828-1832` (`constraint ?? driverError?.constraint` 를 인라인으로 두 번 반복)
  - 상세: `codebase/backend/src/common/db/pg-error.ts` 에 신설된 `pgErrorConstraint()`
    의 JSDoc 은 그 함수가 "제약/인덱스 이름" 추출의 SoT 이며, 이 PR 의 `triggers.service.ts`
    가 그것을 손으로 다시 짜면 "4번째 사본" 이 됐을 것이라고 명시한다. 그런데 정확히 같은
    형태(`constraint ?? driverError?.constraint`)가 `integration-oauth.service.ts` 두 곳에
    이미 존재하고, 이 파일은 이미 같은 모듈(`pg-error.ts`)에서 `isPostgresUniqueViolation`
    을 import 해 쓰고 있어(1272행) `pgErrorConstraint` 로 갈아 끼우는 데 추가 배선이 필요
    없다. 이번 PR 이 `CREATOR_PROJECTION` 상수화의 근거로 든 논리("같은 리터럴이 두 곳에
    손으로 복제돼 있어 한쪽만 옳았다")가 정확히 이 자리에도 적용되는데, 이 두 곳은 이번
    작업의 어느 문서(CHANGELOG·plan 후속 항목)에도 "확인했고 이번 PR 범위 밖" 이라고
    명시적으로 disclose 되지 않았다 — 다른 유사 스코프 결정(예: `listMembers` DB 투영 전환
    보류)은 전부 plan 에 명시 등재된 것과 대비된다. 기능적으로는 문제없다 — 기존 코드가
    이미 양쪽 표면을 올바르게 검사하고 있어 버그는 아니다.
  - 제안: 조치 불요에 가깝다(동작 결함 없음). 다만 다음에 `integration-oauth.service.ts`
    를 건드릴 때 `pgErrorConstraint(err) === STORE_IDENTIFIER_UNIQUE_CONSTRAINT` 로
    치환해 SoT 를 실질적으로 통일하거나, 최소한 plan 의 관련 후속 항목에 "확인함·의도적
    보류" 로 한 줄 남겨 다음 사람이 "놓친 자리" 로 재발견하지 않게 한다.

## 기능 완전성 / spec fidelity 확인 사항 (문제 없음, 기록용)

- `WorkflowVersionsService.findOne` 의 `creator` 투영(`CREATOR_PROJECTION`)이
  `WorkflowVersionCreatorDto` 의 OpenAPI 스키마와 **런타임 introspection 으로** 대조되고
  (`workflow-versions.service.spec.ts` 신규 `describe`), 실제 DTO 필드(`id`/`name`/`email`,
  모두 `@ApiProperty` 필수)와 정확히 일치함을 확인했다.
- `TriggersService.rethrowEndpointPathConflict` 의 에러 형태(`409` + `code:
  'RESOURCE_CONFLICT'` + `details: { field: 'endpoint_path', code:
  'TRIGGER_ENDPOINT_PATH_CONFLICT' }`)가 `spec/2-navigation/2-trigger-list.md:94,164`
  의 문구와 **정확히 일치**한다(필드명·코드 문자열까지). 다른 UNIQUE 위반은 그대로
  rethrow 하고(`else` 없이 함수 끝에서 `throw err`), 단위 테스트가 이 두 경로를 각각
  대칭으로(`update`/`create` × `driverError`/`top` 표면) 검증한다.
- `WorkspaceMemberDto.joinedAt` 필드의 `@ApiProperty({ nullable: true }) joinedAt: string
  | null` 선언이 `spec/5-system/2-api-convention.md §5.4`(*"상시 존재 + null" 기본형*
  규칙, `ApiPropertyOptional` 금지)과 line-level 로 일치하고, JSDoc 본문(공개 설명)과 `//`
  주석(내부 서사+리뷰 인용)의 분리도 `review-citations.md §3`/`swagger.md §3` 규약대로다.
- `dto-jsdoc-citation-guard.ts` 가 세는 세 인용 형태(전체 경로·날짜+시각·bare 시각)와 스캔
  범위(`isResponseDtoFile` → `/dto/responses/` 포함 경로만, `swagger-dto-contract-guard.ts`
  의 동일 함수를 재사용해 판정 로직 단일화)가 `review-citations.md §2/§3` 본문과 정확히
  일치한다.
- `.claude/hooks/_lib/review_guard.py._parse_frontmatter_code` 의 YAML 블록 리스트 파싱
  수정(빈 줄·`#` 주석 skip, 따옴표 유무에 따른 트레일링 주석 절단)에 대해 `.claude/tests/
  test_review_guard.py` 가 정상/경계(다음 키에서는 여전히 멈춤·따옴표 안쪽 `#`·닫는 따옴표
  없음·공백 없는 `#`) 양방향을 모두 대조군으로 걸어 뮤테이션 저항성이 높다.
- 새 e2e 3건(`workspace-rbac.e2e-spec.ts` `J.`, `workflow-crud.e2e-spec.ts` `H.`,
  `audit-logs.e2e-spec.ts` 확장)의 라벨이 기존 시퀀스(A~I/A~G)와 충돌 없이 유일하며, 실제
  실행 순서(이름 축 단언을 계약 대조보다 먼저 실행)가 "각 축이 독립적으로 관측 가능해야
  한다"는 그 자신의 설계 근거와 일치한다.
- `user-entity-exposure.spec.ts` 의 화이트리스트(`EXPECTED_USER_RELATION_LOADS`, 2건:
  `auth.service.ts#logout`/`#refresh`, `workspaces.service.ts#listMembers`)와 eager 관계
  0건 계약을, 프로덕션 코드를 직접 열어 대조한 결과 모두 정확했다.

## 요약

이 diff 는 이미 8차례 리뷰 라운드를 거치며 스스로 반증-정정을 반복해 수렴한 상태이며, 이번
라운드에서 spec 본문(§5.4, §3 트리거 충돌, review-citations.md)과 코드를 line-level 로
대조한 결과 불일치를 찾지 못했다. 핵심 보안 수정(`WorkflowVersionsService.findOne` 유출
차단, 트리거 충돌 계약 구현)은 spec 이 요구한 형태와 필드명까지 정확히 일치하고, 신설된 검출
가드 3종은 각각 대조군 fixture 로 검출력(0건이 아니라 "잡는다")을 실측 검증했다. 전체 관련
단위 테스트(201개)와 harness 테스트(48개)가 통과한다. 유일하게 새로 찾은 것은 신설
`pgErrorConstraint` 헬퍼가 정확히 대체할 수 있는 기존 손-작성 패턴이
`integration-oauth.service.ts` 에 두 곳 남아 있고 이번 PR 이 그것을 마이그레이션하지도,
plan 에 명시적으로 disclose 하지도 않았다는 점인데, 기능적 결함은 아니며(기존 코드가 이미
두 표면을 올바르게 검사) 수정 비용도 낮은 INFO 급 사안이다.

## 위험도

LOW
