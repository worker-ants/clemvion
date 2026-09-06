# 문서화(Documentation) 리뷰

## 개요

이번 diff 는 세 개의 시간대가 누적된 상태다: (1) `User` 컬럼 방어 2축 검출기 신설(구조 가드
`user-entity-exposure-guard.ts` + 이름 가드 `user-secret-absence.ts`)과 그 소비 e2e, (2) 그
직후 진행된 코드/일관성 리뷰 산출물(`review/code/2026/09/06/10_13_22/**`,
`review/consistency/2026/09/06/10_13_23/**`, 커밋된 아카이브), (3) 그 리뷰가 찾아낸
Critical 1(`WorkflowVersionsService.findOne` 이 `User` 전 컬럼을 투영 없이 반환)을 닫은
후속 수정(`workflow-versions.service.ts`/`.spec.ts`, `workflow-crud.e2e-spec.ts`). (2)는
과거 라운드의 아카이브이므로 이번 리뷰의 신규 결함 대상이 아니고, 실제로 새로 검토할 대상은
(1)·(3)이다.

문서화 품질 자체는 전반적으로 높다 — 신규 가드/헬퍼(`user-entity-exposure-guard.ts`,
`user-secret-absence.ts`)와 그 fixture 는 "왜 이 방식을 택했는가"·"왜 이름이 아니라 타입인가"
등을 실측치와 함께 JSDoc 에 남겼고, `workflow-versions.service.ts`/`.spec.ts` 의 신규 인라인
주석·docstring 은 코드와 대조한 결과 전부 일치했다(`findByWorkflow` 가 처음부터 투영을 가졌다는
서술, `WorkflowVersionCreatorDto` 의 3필드 집합, `EXPECTED_USER_RELATION_LOADS` 3건 베이스라인
등을 직접 열어 확인). 다만 아래 두 가지는 이번 검토에서 새로 발견됐다.

## 발견사항

- **[WARNING]** plan 완료 노트의 "§5.4 계약 대조 DTO 증가분" 서술이 같은 브랜치의 후속 수정으로
  이미 사실과 어긋난다 — "하나 늘었다"가 실제로는 둘이다
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:356-359` (`> 곁가지
    성과: ...` 단락, 특히 `358`행 "`§5.4 계약 대조를 받는 DTO 가 하나 늘었다`")
  - 상세: 이 문장은 `WorkspaceMemberDto`(`GET /:id/members` e2e 신설로 `assertMatchesContract`
    에 처음 배선됨)만을 가리켜 "하나 늘었다"고 적었다. 그런데 같은 plan 항목·같은 diff 안에서
    나중에 Critical 1 을 닫으며 추가된 `workflow-crud.e2e-spec.ts` 의 신규 테스트(게이트 561-564,
    `assertMatchesContract(detail.body.data, await contractForDto(WorkflowVersionDto))`)가
    `WorkflowVersionDto` 를 처음으로 `assertMatchesContract` 스윕에 배선한다 — 저장소 전체를
    `grep -rn "contractForDto(WorkflowVersionDto)"` 로 확인한 결과 이 한 줄이 유일한 사용처다.
    즉 이번에 병합되는 전체 변경분에서 신규로 계약 대조를 받게 된 DTO 는 `WorkspaceMemberDto`
    와 `WorkflowVersionDto` **둘**인데, 완료 노트는 그중 하나만 반영한 채로 남아 있다. 이 노트가
    작성된 시점(Critical 1 발견 이전)에는 맞는 서술이었지만, 최종 diff 상태에서는 그렇지 않다 —
    "다음에 열 때 재실측한다"고 미룬 것은 별개의 큰 카운트(`§5.4 drift 배치 — 2단계`, "4→18개
    DTO")이고, 이 "하나" 문장 자체는 재실측 대상으로 명시되지 않았다.
  - 제안: `358`행의 "하나 늘었다"를 "둘 늘었다(`WorkspaceMemberDto`·`WorkflowVersionDto`)"로
    고치거나, 이 문장도 "다음에 그 항목을 열 때 그 시점 실측치로 다시 센다"는 재실측 대상에
    포함시켜 두 카운트가 같은 방식으로 취급되게 한다.

- **[INFO]** 신규 e2e 케이스가 파일이 확립하고 다른 문서가 실제로 참조하는 "테스트 레터"
  관례를 따르지 않는다 (중복은 아님 — 단순 누락)
  - 위치: `codebase/backend/test/workflow-crud.e2e-spec.ts` 의 신규
    `it('버전 단건 조회 — \`creator\` 가 참조 3필드로 좁혀지고 \`User\` 비밀이 없다', ...)`
    (게이트 513, 파일 끝에 위치 — 직전 테스트는 게이트 456의 `it('G. import settings...')`)
  - 상세: 이 파일의 다른 모든 테스트는 `A.`~`G.`(+`B2.`) 로 시작해 시나리오를 식별하고, 이
    관례는 이 파일 밖에서도 실제로 인용된다 — `plan/complete/workflow-duplicate-nodes-edges.md`
    가 `codebase/backend/test/workflow-crud.e2e-spec.ts:142 (C 케이스)`처럼 레터로 이 파일의
    테스트를 가리킨다. 신규 테스트는 이 관례를 따르지 않아 레터가 없다 — 흥미롭게도 이 테스트의
    JSDoc(게이트 510)은 "이름 축을 먼저 두는 이유는 자매 e2e(`workspace-rbac` J)와 같다"며
    **다른 파일**의 레터(같은 PR 이 `F.`→`J.` 로 고친 바로 그 케이스)는 정확히 인용하면서,
    정작 자신이 속한 파일의 레터 관례는 적용하지 않았다. 중복이 아니므로 워크스페이스 리뷰의
    `F.`/`F.` 충돌과 같은 등급의 혼동을 즉시 만들지는 않지만, 향후 이 파일의 테스트를 레터로
    인용하는 관례(위 plan 문서 선례)가 이 케이스만 예외로 남는다.
  - 제안: 다음 미사용 레터 `H.` 를 제목 앞에 붙인다(예: `'H. 버전 단건 조회 — ...'`).

## 요약

`User` 컬럼 방어 2축 검출기와 Critical 1 마무리 수정 모두 "왜 이 방식인가"를 실측치·상호
참조와 함께 촘촘히 남겼고, 새로 작성된 인라인 주석·JSDoc 을 코드와 하나하나 대조한 결과 전부
정확했다(허위 주석·오래된 주석 없음). 새로 찾은 두 건 모두 이번 diff 가 두 개의 시간대(최초
검출기 신설 + Critical 1 수정)를 한 번에 병합하면서 앞서 쓴 문서(plan 완료 노트의 DTO 증가
카운트, workflow-crud 파일의 레터 관례)를 뒤이은 변경이 갱신하지 않은 데서 생겼다. 둘 다 국소적
서술 정정이고 코드 동작에는 영향이 없다 — WARNING 은 이미 존재하는 구체적 숫자 주장이 최종
diff 기준으로 틀렸다는 점에서, INFO 는 외부에서 참조되는 관례의 단순 누락(중복 아님)이라는
점에서 등급을 나눴다.

## 위험도

LOW
