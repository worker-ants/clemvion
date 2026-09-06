# 테스트(Testing) 리뷰

## 검증 방법

프롬프트가 크기 제한으로 diff 를 생략한 파일은 저장소에서 직접 `git diff origin/main...HEAD -- <path>` 로 열람했고, 새로 추가된 가드/spec/fixture 는 `Read` 로 전문을 확인했다. 다음 jest 스위트를 실제로 실행해 통과를 확인했다(뮤테이션 아님, 있는 그대로 실행):

```
codebase/backend: npx jest src/repo-guards/__tests__/user-entity-exposure.spec.ts \
  src/repo-guards/__tests__/dto-jsdoc-citation.spec.ts src/common/db/pg-error.spec.ts \
  src/shared/testing/user-secret-absence.spec.ts src/modules/triggers/triggers.service.spec.ts \
  src/modules/workflow-versions/workflow-versions.service.spec.ts \
  src/modules/workspaces/workspaces.service.spec.ts
→ Test Suites: 7 passed, 7 total / Tests: 1 skipped, 202 passed, 203 total
```

```
python3 -m pytest .claude/tests/test_review_guard.py -k GlobAndFrontmatterTest
→ 19 passed, 29 deselected
```

`USER_SECRET_KEYS` 캐너리(`entityColumnNames()` == 23)도 `grep -c '@Column' user.entity.ts` 로 직접 재실측해 23과 일치함을 확인했다. 저장소를 뮤테이션하지 않았다 — `git status --short` 로 변경 없음 확인.

## 발견사항

- **[INFO]** `isEndpointPathUniqueViolation` 의 술어 테스트가 "제약 이름이 아예 없는" 하위 경로를 별도로 묻지 않는다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts` — `'%s — 다른 UNIQUE 인덱스 위반은 가로채지 않고 그대로 흘려보낸다'` (`it.each([['update'], ['create']])`)
  - 상세: `pgErrorConstraint`(`codebase/backend/src/common/db/pg-error.ts:43-47`)는 `e.constraint ?? e.driverError?.constraint` 로, "다른 이름" 케이스와 "이름 자체가 없는(undefined)" 케이스를 모두 `undefined`/불일치로 처리하지만 두 경로가 실제로 같은 비교 분기(`pgErrorConstraint(err) === TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX`)를 타는지는 현재 `idx_trigger_workspace_name` 처럼 **다른 이름이 있는** 케이스로만 대리 검증되고 있다. 동작은 동일하겠지만, `pgErrorConstraint` 가 `??` 대신 다른 결합으로 바뀌는 뮤턴트가 있다면 "이름 없음" 쪽만 놓칠 여지가 이론적으로 있다.
  - 제안: `uniqueViolation('23505' 코드에 constraint 필드 자체가 없는 에러)` 케이스를 하나 추가해 두 결측 경로를 모두 관측 가능하게 한다. 우선순위는 낮다 — 실질 결함이 아니라 "관측되지 않는 하위 분기"에 대한 예방적 지적이다.

- **[INFO]** `dto-jsdoc-citation-guard.ts` 의 bare 시각 정규식(`(?<![\w/-])\d{2}_\d{2}_\d{2}(?![\w-])`)이 리뷰 인용이 아닌 우연한 6자리 밑줄 토큰(예: 버전 문자열·예시 값)에 대해 오탐할 수 있는 가능성이 fixture 로 반증되지 않는다
  - 위치: `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation-guard.ts:43-54`(정규식 정의) / `codebase/backend/src/repo-guards/__tests__/fixtures/dto/responses/jsdoc-citation.fixture.ts`(양성/음성 대조군)
  - 상세: 현재 fixture 는 "인용이 있는 형태 4가지"와 "인용이 없는 형태(`//` 회피)"만 대조하고, "리뷰 인용처럼 보이지만 리뷰 인용이 아닌 6자리 숫자"(false positive) 케이스는 없다. 이 가드는 CI 차단이 아니라 사람이 보는 래칫(EXPECTED 목록 대조)이라 실질 위험은 낮지만, 다음에 DTO JSDoc 에 `12_34_56` 같은 우연한 패턴이 들어오면 목록에 등재해야 통과하는데 그 등재가 "진짜 인용" 인지 "우연한 숫자" 인지 구분하는 테스트가 없다.
  - 제안: 필요 시 "6자리 숫자이지만 리뷰 인용이 아닌" 준수 케이스를 fixture 에 추가해 오탐 여부를 명시적으로 문서화한다. 낮은 우선순위 — 현재 실제 오탐 사례는 없다.

## 요약

이번 diff 는 테스트 관점에서 매우 높은 완성도를 보인다. 새로 추가된 두 축의 `User` 컬럼 노출 검출 가드(`user-entity-exposure-guard`/`user-secret-absence`)는 실측(19곳·46곳·23컬럼·731 파싱 일치)과 함께 양성/음성 대조군을 갖추고, 여러 선행 리뷰 라운드(10_13_22 ~ 16_58_14)에서 지적된 검출력 0(무력화해도 15/15 그린), vacuous 카운트 단언, 반쪽 표면 검증, 순서 의존적 이중 축 테스트 등은 모두 실제 뮤테이션으로 재확인 후 수정된 흔적이 코드/주석에 남아 있고, 현재 파일 상태를 직접 열어 그 수정이 실제로 반영됐음을 확인했다(예: `UserRelationLoad.line` 필드 제거됨, `collectUserRelationNames` JSDoc 위치 정상, `workspace-rbac.e2e-spec.ts`/`workflow-crud.e2e-spec.ts`의 시나리오 라벨 `J.`/`H.` 중복 없음). `pg-error.ts`/`pg-error-fixtures.ts` 는 두 wrap 표면을 단일 SoT 로 묶어 `triggers.service.spec.ts`·`pg-error.spec.ts` 양쪽에서 재사용하며 중복 fixture 재발을 막았고, `CREATOR_PROJECTION` 은 손으로 적은 두 목록을 비교하는 대신 실제 OpenAPI 스키마와 코드로 대조해 "둘 다 같이 틀리는" 결함 클래스를 닫았다. `.claude/hooks/_lib/review_guard.py` 의 YAML frontmatter 파서 수정도 반대 방향 대조군(다음 키에서는 멈춘다·따옴표 안 `#` 은 값이다·공백 없는 `#` 은 주석 아니다)까지 포함해 술어가 넓어지는 방향의 회귀를 함께 막는다. 직접 실행한 jest 202개·pytest 19개가 모두 통과했다. 남은 지적 2건은 모두 INFO 로, 실질 결함이 아니라 예방적으로 관측되지 않은 하위 분기에 대한 것이다.

## 위험도

LOW
