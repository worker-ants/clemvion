# 유지보수성(Maintainability) 리뷰

## 검토 범위 메모

`origin/main...HEAD` 는 이미 10차례의 `/ai-review` 라운드(`10_13_22` → `15_52_58`)를 거친
`User` 엔티티 컬럼 노출 방어(구조 축 `user-entity-exposure-guard.ts`, JSDoc 인용 축
`dto-jsdoc-citation-guard.ts`, 값 축 `user-secret-absence.ts`)와 그 소비 지점
(`WorkflowVersionsService.findOne`/`findByWorkflow` 의 `creator` 투영 통일,
`TriggersService` 의 `endpoint_path` UNIQUE 충돌 계약, `review_guard.py` 의 YAML
frontmatter 파서 보강)으로 구성된다. 직전 라운드들이 지적한 항목(e2e 라벨 충돌, fixture
경로 인라인 중복, 검출력 0건, JSDoc orphan/빈 줄, `it.each` 중복 호출 등)은 해당 파일을
직접 열어 재확인했고 전부 해소되어 재발이 없었다 — 예: `pg-error-fixtures.ts` 로 두 spec
의 fixture 중복이 통합됐고(`15_52_58` W3), `isEndpointPathUniqueViolation` 위 JSDoc 의
빈 줄도 제거됐다(`15_52_58` W4). `review/**`·`plan/**`·`CHANGELOG.md` 등 다수 파일은
이전 라운드들의 산출물·문서 정정이라 이 관점에서 별도로 다루지 않았다.

이번 라운드에서 실질적으로 새로 볼 것은 최신 커밋(`8bbae332a`, 직전 라운드 `15_52_58`
WARNING/INFO 반영분)뿐이며, 아래 한 건을 새로 찾았다. 저장소에 뮤테이션은 가하지 않았다
(`git status --short` 확인 — 이번 세션 산출물 디렉터리만 untracked).

## 발견사항

- **[WARNING]** 테스트를 `it` → `it.each` 로 바꾸며 삽입한 헬퍼가 기존 JSDoc 을 그 대상(테스트)에서 떼어냈다 — 이 브랜치가 반복 지적한 "orphan JSDoc" 결함 클래스의 재발
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts:2874`~`2891` (JSDoc 블록 `2874-2877` "**반대 방향 대조군**...", 바로 아래 두 번째 JSDoc 블록 `2878-2882` "**부정 케이스도 두 경로를...**", `const callFor` 선언 `2883-2891`). 실제 대상 테스트는 11줄 아래 `2893-2894`의 `it.each([['update'], ['create']] as const)('%s — 다른 UNIQUE 인덱스 위반은 가로채지 않고 그대로 흘려보낸다', ...)`.
  - 상세: 최신 커밋(`8bbae332a`)이 `it('다른 UNIQUE 인덱스 위반은 가로채지 않고 그대로 흘려보낸다', ...)` 단건 테스트를 `update`/`create` 양쪽을 도는 `it.each` 로 바꾸면서, 그 호출부를 만드는 `callFor` 헬퍼를 새로 뽑아 그 테스트 **바로 위**에 얹었다. 그런데 이 테스트를 원래 설명하던 JSDoc("반대 방향 대조군 — 이게 없으면 술어가 `23505` 만 보는 쪽으로 넓어져도 통과해 ... 오보한다")은 이동하지 않고 옛 자리(테스트 바로 위)에 그대로 남았고, 그 결과 지금은 `callFor` 의 새 JSDoc 과 함께 `callFor` 선언 위에 두 블록이 나란히 쌓여, 실제 대상인 `it.each` 와는 코드 11줄만큼 떨어지게 됐다. 사람이 위에서 아래로 훑으면 "반대 방향 대조군" 서술을 `callFor`(단순 호출부 팩토리)에 대한 설명으로 오독하기 쉽고, 정작 그 서술이 뒷받침하는 술어("다른 UNIQUE 인덱스는 가로채지 않는다")의 근거는 시각적으로 분리된다. 이 브랜치는 정확히 같은 성격의 결함(JSDoc 이 대상 선언에서 분리됨)을 이미 두 번 스스로 잡아 고쳤다 — `user-entity-exposure-guard.ts` 의 `findEagerUserRelations`/`collectUserRelationNames` orphan JSDoc(`review/code/2026/09/06/11_55_36` WARNING), `isEndpointPathUniqueViolation` 위 빈 줄(`review/code/2026/09/06/15_52_58` W4, 같은 파일의 자매 함수). 기능적 영향은 없다(TypeScript/Jest 는 주석 위치와 무관하게 동작한다) — 순수 가독성 문제다.
  - 제안: 첫 JSDoc 블록(`2874-2877`)을 `callFor` 위에서 떼어 `it.each` 호출(`2893` 줄) 바로 위로 옮기고, `callFor` 위에는 그 헬퍼를 설명하는 두 번째 블록(`2878-2882`)만 남긴다.

## 요약

핵심 코드(가드 3축, `WorkflowVersionsService`/`TriggersService` 프로덕션 로직, `review_guard.py`
파서)는 함수가 단일 책임을 유지하고 네이밍이 역할을 정확히 드러내며(`ProjectedCreator`/
`CREATOR_PROJECTION`/`isEndpointPathUniqueViolation`/`findUserSecretLeaks` 등), 각 결정의
근거를 실측과 함께 인접 주석에 남기는 이 브랜치 고유의 관례를 그대로 따른다. 이전 9~10
라운드가 지적한 결함은 직접 코드를 열어 재확인한 결과 전부 재발 없이 해소돼 있었다.
이번 라운드에서 새로 찾은 것은 최신 커밋 하나가 테스트를 파라미터화하며 만든 국소적인
JSDoc-대상 분리 1건뿐이며, 기능에는 영향이 없고 수정 비용도 낮다. Critical 급 유지보수성
결함은 없다.

## 위험도

LOW
