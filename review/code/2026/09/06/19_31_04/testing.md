# 테스트(Testing) 리뷰

## 개요

이 브랜치는 이미 `10_13_22` ~ `16_58_14` 까지 10회 이상의 `/ai-review` + `/consistency-check`
라운드를 거쳤고, `git diff origin/main...HEAD`(23 files, +2423/-18)를 직접 열어 새 코드
경로(`pg-error.ts` 두 wrap 표면, `TriggersService` 의 `endpoint_path` UNIQUE 충돌,
`WorkflowVersionsService.findOne` 의 `creator` 투영, `user-entity-exposure-guard`/
`user-secret-absence` 두 축 검출 가드, `dto-jsdoc-citation-guard`, `.claude/hooks/_lib/
review_guard.py` 의 YAML frontmatter 주석 파싱) 각각을 실제로 추적했다. 과거 라운드가
지적한 테스트 갭(검출력 0 상태에서도 그린이던 eager 축, 관측 불가능한 정규식 분기,
`listMembers` 단위 테스트 0건, JSDoc orphan, e2e 라벨 중복, promise 이중 호출, 표면 축 편중
등)은 전부 현재 코드에서 해소가 확인됐다 — 뮤테이션으로 직접 죽여 본 결과 각 술어가
실제로 관측 가능하다.

새로 발견한 것은 이미 이전 라운드(`api_contract` `15_52_58`/`16_28_58`)가 지적하고 plan 에
등재된 항목 하나뿐이며, 아래에 테스트 관점에서 다시 확인한다.

## 발견사항

- **[INFO]** 트리거 `endpoint_path` UNIQUE 충돌의 409 응답을 **실제 Postgres 유니크 제약**
  경로로 검증하는 e2e 가 여전히 없다 — unit 은 손으로 만든 mock 에러로만 검증
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts` —
    `describe('TriggersService — endpoint_path UNIQUE 충돌 계약')` 안의
    `it.each([['update','driverError'],['update','top'],['create','driverError'],['create','top']])`
    (409 + `details` 두 키 단언). 대응하는 e2e 부재 확인:
    `codebase/backend/test/webhook-trigger.e2e-spec.ts`,
    `codebase/backend/test/trigger-expression.e2e-spec.ts` 어디에도 `RESOURCE_CONFLICT`/
    `TRIGGER_ENDPOINT_PATH_CONFLICT`/409 케이스가 없다(grep 0건, 직접 확인).
  - 상세: unit 커버리지는 `create`/`update` × 두 wrap 표면(`driverError`/최상위) 4조합에
    반대 방향 대조군(다른 UNIQUE 인덱스는 통과)까지 매우 촘촘하지만, 전부
    `triggerRepo.save`를 `makePgUniqueViolation()` 으로 목(mock) reject 시켜 만든 합성
    에러다. 실제 `pg` 드라이버가 `idx_trigger_workspace_endpoint` 위반 시 던지는 에러가
    이 fixture 가 가정하는 두 표면(`err.driverError.constraint` / `err.constraint`)과
    정말 같은 모양인지, 그리고 `GlobalExceptionFilter` 를 거친 최종 wire 형태가 계약과
    일치하는지는 e2e 로 닫히지 않았다. 같은 PR 의 다른 두 갈래
    (`WorkflowVersionsService.findOne`/`WorkspaceMemberDto`)는 각각 실 인프라 e2e
    (`workflow-crud.e2e-spec.ts` H., `workspace-rbac.e2e-spec.ts` J.)로 보강됐는데,
    트리거 갈래만 그 계층이 비어 있어 형평이 어긋난다. 다만 이 항목은 이미
    `review/code/2026/09/06/15_52_58`·`16_28_58` 의 api_contract 리뷰가 독립적으로
    지적했고 `plan/in-progress/spec-draft-nullable-notation-followups.md:541`
    (`developer, 2026-09-06 등재`)에 후속 항목으로 명시 등재돼 있다 — 새로 발견한
    결함이 아니라 기존 처분(필수 아님·plan 추적)이 여전히 유효함을 테스트 관점에서
    재확인한 것이다.
  - 제안: `plan` 항목이 이미 제안한 대로 `webhook-trigger.e2e-spec.ts` 에 같은
    `endpointPath` 로 트리거를 두 번 생성 → 두 번째가 409 + `details.field`/`details.code`
    를 갖는지 확인하는 케이스 1건을 추가한다(권장, 차단 사유 아님). 이 한 건이 unit mock
    이 가정한 에러 형태가 실제 드라이버와 일치하는지를 검증하는 유일한 자리가 된다.

## 요약

이번 diff 는 8개 이상의 신규/변경 spec 파일에 걸쳐 양성·음성 대조군, 두 wrap 표면 각각의
fixture, 반대 방향 대조군("넓힌 술어가 잘못된 방향으로 새지 않는가"), `[전제]`/`[대조군]`
단언(스캔이 비어 있으면 뒤 단언이 조용히 통과하는 것을 막음), 소스-대조 카나리아
(`USER_SECRET_KEYS` ↔ 엔티티 컬럼 수, `CREATOR_PROJECTION` ↔ DTO OpenAPI 스키마)까지
갖춘 매우 높은 수준의 테스트로 구성돼 있다. 특히 `user-entity-exposure-guard`/
`user-relation-load.fixture.ts` 는 15개 위반 형태(배열/객체/중첩/대소문자/`as`·
`satisfies` 캐스트/변수 경유/한 함수 내 중복 등)를 하나하나 리뷰어의 실제 뮤테이션
실패 이력과 함께 고정해, "관측되지 않는 분기는 다음 편집에서 조용히 죽는다"는 이
저장소가 반복 학습한 교훈을 코드로 실천하고 있다. `.claude/hooks/_lib/review_guard.py`
의 YAML 프런트매터 파서 수정도 인용 스칼라·언쿼트 스칼라·빈 줄·다음 키·안쪽 `#` 등
모든 분기를 개별 회귀 테스트로 덮었다(이전 라운드가 지적한 "인용 스칼라 + 단일값/
인라인 리스트" 갭도 현재는 해소됨을 확인). 새로 찾은 유일한 항목은 트리거
`endpoint_path` 409 계약이 unit mock 으로만 검증되고 실 Postgres 유니크 제약을 타는
e2e 가 없다는 것인데, 이는 이미 이전 라운드가 발견해 plan 에 등재하고 "필수 아님"으로
처분한 항목의 재확인이라 위험도를 올릴 근거는 없다.

## 위험도

LOW
