# 유지보수성(Maintainability) 리뷰

## 검토 범위 메모

`origin/main...HEAD` 는 이미 12차례의 `/ai-review` 라운드(`10_13_22` → `16_58_14`)를 거친
`User` 엔티티 컬럼 노출 방어(구조 축 `user-entity-exposure-guard.ts`, JSDoc 인용 축
`dto-jsdoc-citation-guard.ts`, 값 축 `user-secret-absence.ts`)와 그 소비 지점
(`WorkflowVersionsService.creator` 투영 통일, `TriggersService` 의 `endpoint_path` UNIQUE
충돌 계약, `review_guard.py` 의 YAML frontmatter 파서 보강)으로 구성되며, 가장 최근 커밋
(`e008dd009`)이 직전 라운드(`16_58_14`)가 지적한 두 결함(백틱 없는 bare 시각 인용 미검출,
`@ApiConflictResponse` 선언 누락)을 닫았다. `review/**`·`plan/**`·`CHANGELOG.md` 는 대부분
이전 라운드들의 산출물·문서 정정이라 이 관점에서 별도로 다루지 않았고, 프로덕션·가드·spec
파일을 직접 열어 대조했다.

`triggers.controller.ts` 에 새로 추가된 `@ApiConflictResponse` description 문자열이
`create`/`update` 두 자리에 완전히 동일하게 인라인 중복돼 있는 점을 처음엔 지적하려 했으나,
같은 디렉터리의 `workflow-test-datasets.controller.ts`(77·99행 `'같은 이름 데이터셋 중복'`)와
`nodes.controller.ts`(110·131행 `'동일 워크플로우 내 라벨 중복'`)가 정확히 같은 패턴(상수화
없이 create/update 데코레이터에 같은 문자열 인라인 반복)을 이미 쓰고 있어, 이번 PR 이
새로 벗어난 관례가 아니라 기존 코드베이스 관례를 그대로 따른 것으로 판단해 발견사항에서
제외했다.

## 발견사항

- **[INFO]** `_parse_frontmatter_code` 가 여러 라운드의 점진적 하드닝을 거치며 함수 하나에
  2개의 중첩 클로저 + 3-way 분기 + 이중 while 루프가 누적됐다
  - 위치: `.claude/hooks/_lib/review_guard.py` — `_parse_frontmatter_code` 함수 전체(내부
    `_strip_comment`/`_clean` 두 클로저 포함, 총 약 95줄)
  - 상세: 원래 "인라인 리스트/단일값/블록 리스트" 세 형태를 파싱하는 단순 함수였는데,
    이번 PR 동안 트레일링 YAML 주석 처리(따옴표 유무 분기)·빈 줄/주석 줄 skip 로직이
    차례로 추가되면서 함수 하나의 길이와 분기 수가 상당히 늘었다. 각 분기는 개별적으로
    잘 테스트돼 있고(`.claude/tests/test_review_guard.py` 에 12개 이상의 단위 테스트가
    반대 방향 대조군까지 포함해 문고 있음) 회귀 위험은 낮지만, 함수 하나가 "인라인 리스트
    파싱" · "블록 리스트 파싱" · "주석 스트리핑" 세 관심사를 동시에 담당하는 형태가 됐다.
  - 제안: 급하지 않음. 다음에 이 함수를 다시 만질 일이 생기면 `_strip_comment`/`_clean` 을
    모듈 레벨 private 함수로 승격하거나, 인라인/블록 두 파싱 경로를 별도 헬퍼로 분리하는
    것을 고려한다.

## 요약

이번 diff 는 함수 단위가 단일 책임을 유지하고(`isEndpointPathUniqueViolation`/
`rethrowEndpointPathConflict`/`findUserSecretLeaks`/`findDtoJsDocCitations`/
`collectUserRelationNames`/`findEagerUserRelations`/`forEachUserTypedProperty` 등 이름이
역할을 정확히 드러낸다), 매직 넘버·매직 스트링은 상수(`TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX`,
`USER_SECRET_KEYS`, `CREATOR_PROJECTION`, `CITATION_PATTERNS`)로 명명돼 있다. AST 를 직접
순회하는 가드 코드(`user-entity-exposure-guard.ts`, `dto-jsdoc-citation-guard.ts`)는 도메인
특성상 분기가 많지만 공통 순회 로직(`forEachUserTypedProperty`, `unwrap`, `propKeyText`,
`isResponseDtoFile` re-export)을 추출해 중복을 피했고, 각 분기가 왜 필요한지를 fixture 의
양성/음성 대조군과 1:1 로 연결해 설명한다. `workflow-versions.service.ts` 는 `creator` 투영
리터럴이 두 메서드에 손으로 복제돼 있던 것을 `CREATOR_PROJECTION` 상수로 통합했고,
`triggers.service.ts` 는 `pg-error.ts`/`pg-error-fixtures.ts` 를 SoT 로 재사용해 두 wrap
표면을 흡수하는 로직·fixture 중복을 막았다. 이전 12라운드가 지적한 항목(e2e 시나리오 라벨
중복(`F.`→`J.`), JSDoc이 엉뚱한 함수 위에 남은 것, fixture 검출력 0건, fixture 경로 인라인
중복, 백틱 없는 bare 시각 인용 미검출)은 전부 파일을 직접 열어 재확인한 결과 재발 없이
해소돼 있다. 새로 찾은 것은 `review_guard.py` 의 파서 함수 하나가 점진적 하드닝으로 다소
비대해졌다는 INFO 수준 관찰뿐이며, 테스트 커버리지가 두터워 실질 위험은 낮다. Critical/
Warning 급 유지보수성 이슈는 없다.

## 위험도

NONE
