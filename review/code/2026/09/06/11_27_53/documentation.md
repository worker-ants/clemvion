# 문서화(Documentation) 리뷰

## 개요

이번 diff 는 `User` 엔티티 민감 컬럼 노출을 잡는 검출 2축(`user-entity-exposure-guard.ts` 구조
축, `user-secret-absence.ts` 이름 축) 신설 커밋(`96d3856a9`)과, 그 직후 두 라운드의
`/ai-review`·`/consistency-check` 가 찾은 Critical 1(`WorkflowVersionsService.findOne` 이
`User` 전 컬럼을 투영 없이 반환) + WARNING 다수를 처분한 fix 커밋(`4d49aa575`, `9a186fa31`),
그리고 그 세 라운드의 리뷰 산출물(`review/code/**`, `review/consistency/**`) 커밋으로 구성된다.
리뷰 산출물(파일 14~54)은 이미 지나간 라운드의 기록이라 이번 라운드의 신규 결함 대상이
아니고, 실제 신규 검토 대상은 프로덕션/테스트 코드 10개 파일(파일 1~13)이다.

문서화 품질은 전반적으로 매우 높다. `CREATOR_PROJECTION`·`user-entity-exposure-guard.ts`·
`user-secret-absence.ts`·`WorkspaceMemberDto.joinedAt` 의 JSDoc/인라인 주석을 실제 코드·DTO
스키마·컨트롤러 구현과 직접 대조한 결과 전부 일치했다:

- `CREATOR_PROJECTION`(`id`·`name`·`email`)이 `WorkflowVersionCreatorDto` 의 실제 프로퍼티
  (`workflow-version-response.dto.ts:3-15`)와 정확히 같고, 그 일치를 테스트가 OpenAPI 스키마
  대조로 강제한다는 주석(`workflow-versions.service.ts:30-33`)도 실제
  `workflow-versions.service.spec.ts` 테스트와 일치한다.
- `findOne` 이 "컨트롤러가 가공 없이 반환한다"는 주석(`workflow-versions.service.ts:97-98`)은
  `workflow-versions.controller.ts:81` (`return this.workflowVersionsService.findOne(...)`)
  과 실제로 일치한다.
- `USER_SECRET_KEYS` 가 "민감 7컬럼"이라는 주석과 실제 배열 길이(7)가 일치한다.
- 이전 라운드가 지적했던 항목(`CREATOR_PROJECTION` 4곳 중복, e2e 라벨 `F.` 중복, plan 의
  DTO 증가분 "하나"→실제 "둘" stale, `workflow-crud.e2e-spec.ts` 신규 케이스 레터 누락)은
  전부 실제 코드에서 해소된 상태를 직접 열어 확인했다 — `workspace-rbac.e2e-spec.ts` 는
  `A,S,B,C,D,E,F,G,H,I,J` 순서로 라벨이 정상 복구돼 있고, `workflow-crud.e2e-spec.ts` 는
  새 케이스가 `H.` 로 정확히 이어진다.

다만 그 처분 과정에서 새로 생긴 카운트 불일치 하나를 이번 라운드에서 새로 찾았다.

## 발견사항

- **[WARNING]** 가드 spec 의 테스트 제목이 "위반 10형태"라고 주장하지만 실제 fixture 는
  11형태다 — 직전 fix 라운드가 `violationViaIntermediateVariable` 을 추가하며 이 숫자를
  갱신하지 않았다
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure.spec.ts:135`
    (`it('위반 10형태를 전부 잡는다 (한 함수 안 두 번은 두 건으로)', () => { ... }`)
  - 상세: 이 테스트가 대조하는
    `codebase/backend/src/repo-guards/__tests__/fixtures/user-relation-load.fixture.ts` 는
    스스로 "위반 1" ~ "위반 11" 로 11개 형태를 번호 매겨 문서화하고 있고(파일 헤더 아래
    각 함수 JSDoc), 실제 `export async function` 위반 케이스도
    `violationRelationsUser`·`violationNestedRelationPath`·`violationCreatorRelation`·
    `violationObjectRelations`·`violationUppercaseRelation`·`violationLeftJoinAndSelect`·
    `violationInnerJoinAndSelect`·`violationTwiceInOneFunction`·
    `violationNestedObjectRelations`·`violationViaIntermediateVariable`·
    `violationSatisfiesRelations` 로 **11개**다(`violationTwiceInOneFunction` 은 같은 함수
    안에서 두 번 로드해 2건으로 잡히므로 스펙의 기대 배열은 12개 항목이지만 "형태" 수는
    11이다). 같은 브랜치의 `review/code/2026/09/06/10_53_48/RESOLUTION.md` 도 이 fix 를
    반영해 "가드 대조군은 이제 **위반 11형태 / 준수 4형태**다" 라고 명시적으로 기록했다.
    그런데 `user-entity-exposure.spec.ts:135` 의 테스트 제목은 여전히 "위반 10형태"로
    남아 있다 — `git log -p` 로 확인한 결과 이 문자열은 최초 feat 커밋(`96d3856a9`)에서부터
    "10형태"였고, 이후 두 fix 커밋이 `violationViaIntermediateVariable`(INFO#4 대응,
    `10_53_48`)과 그 이전 라운드의 다른 위반 형태들을 fixture 에 추가하면서도 이 제목
    문자열은 갱신하지 않았다. 기능적으로는 `.sort()` 로 배열 전체를 비교하므로 테스트
    자체는 올바르게 동작하지만(개수가 실제로 11형태분 다 들어 있음), 사람이 읽는 테스트
    설명과 실제 검증 범위가 어긋나 다음에 이 테스트를 유지보수하는 사람이 "형태가 몇 개
    있어야 하는가"를 이 제목으로 오판할 수 있다. 이 저장소가 이미 여러 번 겪은 "숫자가
    한 곳에서만 갱신되고 나머지에 남는다"는 실측된 패턴(`plan` 의 "DTO 하나→둘" stale,
    CHANGELOG 실측치 4곳 복제 등)이 이번엔 소스 코드 테스트 제목 자체에서 재발한 사례다.
  - 제안: `135`행의 `'위반 10형태를 전부 잡는다 (...)'` 을 `'위반 11형태를 전부 잡는다
    (...)'` 로 정정한다. 다음에 fixture 에 위반 형태를 추가할 때 이 숫자도 함께 갱신해야
    함을 상기시키려면, fixture 파일 헤더에 "이 파일에 위반 형태를 추가하면
    `user-entity-exposure.spec.ts` 의 테스트 제목 숫자도 갱신" 같은 상호 참조를 남기는
    것도 고려할 만하다(이 PR 자신이 `workflow-versions.service.ts` 의 `CREATOR_PROJECTION`
    주석에서 이미 같은 형태의 상호 참조를 다른 자리에 남겨 두었다).

- **[INFO]** 신규 검출 가드 2쌍이 spec `code:` frontmatter 미등재 — 이미 발견·처분 완료,
  재발 아님(참고용 재확인)
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:367-393`
  - 상세: 이 갭은 `review/code/2026/09/06/10_13_22/documentation.md` WARNING 으로 이미
    보고됐고, 같은 라운드 `RESOLUTION.md` W3 이 "`spec/` 쓰기는 권한 밖" 이라는 이유로
    planner 후속 항목으로 등재하는 것으로 처분했다. 실제로 plan 파일에 체크박스 미완료
    항목("신규 검출 2축을 §5.4 「검증 층」과 `code:` 에 등재")으로 정확히 등재돼 있고,
    "두 검증자"라고 못 박은 두 문장(`2-api-convention.md` §5.4, `swagger.md` §5-1)도
    표로 명시돼 있다. 새로 지적할 결함이 아니라 처분이 정상적으로 이행됐음을 확인하는
    수준의 재확인이다.
  - 제안: 조치 불요 — 이미 tracked. 참고용 기록만.

## 요약

이번 diff 의 문서화 품질은 세 라운드에 걸친 리뷰·정정을 거치며 매우 높은 수준에 도달했다 —
JSDoc·인라인 주석이 실측치·타 파일 상호 참조와 함께 촘촘히 남아 있고, 실제 코드·DTO 스키마와
대조한 결과 오래된 주석·허위 서술은 발견되지 않았다. 이번 라운드에서 새로 찾은 것은 하나뿐이다:
가드 spec 의 테스트 제목이 여전히 "위반 10형태"라고 말하지만 직전 fix 커밋이 fixture 에
`violationViaIntermediateVariable` 을 추가해 실제로는 11형태가 됐고, 같은 브랜치의
RESOLUTION.md 는 이미 "11형태"로 정정된 서술을 쓰고 있다 — 소스 코드 안의 이 한 문자열만
갱신에서 빠졌다. 테스트 동작 자체(배열 비교)는 정확하므로 기능적 결함은 아니지만, 사람이
읽는 설명과 실제 커버리지가 어긋나는 국소적 문서 정확성 문제다. 나머지는 이미 이전 라운드가
찾아 처분을 마친 항목들이 실제로 해소됐음을 재확인한 수준이다.

## 위험도

LOW
