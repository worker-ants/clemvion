# 유지보수성(Maintainability) 리뷰

## 검토 범위 메모

`origin/main...HEAD` 는 이미 10차례의 `/ai-review` 라운드(`10_13_22` → `16_28_58`)를 거친
`User` 엔티티 컬럼 노출 방어(구조 축 `user-entity-exposure-guard.ts`, JSDoc 인용 축
`dto-jsdoc-citation-guard.ts`, 값 축 `user-secret-absence.ts`)와 그 소비 지점
(`WorkflowVersionsService`의 `creator` 투영 통일, `TriggersService`의 `endpoint_path`
UNIQUE 충돌 계약, `review_guard.py`의 YAML frontmatter 파서 보강)으로 구성된다. `review/**`·
`plan/**`·`CHANGELOG.md` 는 대부분 이전 라운드들의 산출물·문서 정정이라 이 관점에서 별도로
다루지 않았다.

직전 라운드(`16_28_58`)가 지적한 유일한 WARNING(테스트 파라미터화 과정에서 `callFor` 위에
JSDoc 두 블록이 쌓여 대상 `it.each`와 시각적으로 분리된 것)은 `codebase/backend/src/modules/
triggers/triggers.service.ts` 내 `triggers.service.spec.ts` 를 직접 열어 재확인한 결과 이미
해소돼 있다 — "반대 방향 대조군" JSDoc(2888~2894줄)이 그 대상 `it.each` 호출(2895줄) 바로
위로 옮겨졌고, `callFor` 자신의 JSDoc(2874~2877줄)만 그 선언(2878줄) 위에 남아 있다.

핵심 프로덕션·가드 파일(`user-entity-exposure-guard.ts`, `dto-jsdoc-citation-guard.ts`,
`user-secret-absence.ts`, `pg-error.ts`/`pg-error-fixtures.ts`, `workflow-versions.service.ts`,
`triggers.service.ts`, `.claude/hooks/_lib/review_guard.py`)와 그 fixture·spec 을 전부 직접
열어 대조했다. 이번 라운드에서 새로 지적할 만한 유지보수성 결함은 발견하지 못했다.

## 발견사항

(신규 발견 없음 — 이전 라운드 지적 사항은 전부 재발 없이 해소됨을 확인)

## 요약

이 PR 은 함수 단위가 단일 책임을 유지하고(`isEndpointPathUniqueViolation`/
`rethrowEndpointPathConflict`/`findUserSecretLeaks`/`findDtoJsDocCitations`/
`collectUserRelationNames`/`findEagerUserRelations` 등 이름이 역할을 정확히 드러낸다), 매직
넘버·매직 스트링은 상수(`TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX`, `USER_SECRET_KEYS`,
`CREATOR_PROJECTION`)로 명명돼 있으며, `user-secret-absence.spec.ts` 의 컬럼 수 카나리아
(`23`)처럼 숫자가 남는 자리도 "왜 이 숫자인가"를 실측 근거와 함께 인접 주석에 남긴다. AST 를
직접 순회하는 가드 코드(`user-entity-exposure-guard.ts`, `dto-jsdoc-citation-guard.ts`)는
도메인 특성상 분기가 많지만, 공통 순회 로직(`forEachUserTypedProperty`, `unwrap`,
`propKeyText`)을 추출해 중복을 피했고 각 분기가 왜 필요한지(어떤 실제 유출/사각지대를
막는지)를 fixture 의 양성/음성 대조군과 1:1 로 연결해 설명한다. `review_guard.py` 의
YAML frontmatter 파서(`_parse_frontmatter_code`/`_strip_comment`)는 상태가 있는 파싱
로직치고 중첩이 깊지 않고, 12개 이상의 단위 테스트(빈 줄·주석·인용 스칼라·미종결 인용·
공백 없는 `#` 등 반대 방향 대조군 포함)가 각 분기를 개별적으로 문다. 이전 10라운드가
지적한 항목(e2e 시나리오 라벨 중복(`F.`→`J.`로 정정), JSDoc이 엉뚱한 함수 위에 남은 것,
fixture 검출력 0건, `it.each` 파라미터화 후 JSDoc 분리)은 모두 파일을 직접 열어 재확인한
결과 재발 없이 해소돼 있다. 새로 발견한 결함은 없으며, Critical/Warning 급 유지보수성
이슈는 없다.

## 위험도

NONE
