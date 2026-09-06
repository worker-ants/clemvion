# 테스트(Testing) 리뷰

## 개요

리뷰 대상(`origin/main...HEAD`, 21개 코드 파일)은 `User` 엔티티 컬럼 노출을 잡는 검출
3축(구조 `user-entity-exposure-guard` · 값 `user-secret-absence` · JSDoc 인용
`dto-jsdoc-citation-guard`), `WorkflowVersionsService`/`TriggersService` 의 실유출·계약
갭 수정, `WorkspacesService.listMembers` 단위 테스트, 관련 e2e 3건, 그리고 `.claude/hooks`
YAML frontmatter 파서 수정(+ 11개 신규 pytest)으로 구성된다. 이 브랜치는 이미
`10_13_22`부터 `15_52_58`까지 9차례의 `/ai-review` 라운드를 거쳤고, 매 라운드 testing
관점 지적(eager 축 검출력 0건, `unwrap`/인용 3형태 편중 관측, 표면 축 통합 테스트 누락,
`listMembers` null-vs-missing mock, create/update 부정 케이스 비대칭 등)이 fixture·
`it.each` 확장으로 해소된 이력이 `RESOLUTION.md` 들에 남아 있다.

이번 라운드(최종 커밋 `8bbae332a`)는 정확히 직전 `15_52_58` testing 라운드가 낸 INFO 3건
중 2건(`listMembers` null-vs-missing mock, create/update 패스스루 비대칭)을 해소한 판이라,
그 두 수정이 실제로 올바른지와 나머지 결함이 재발하지 않았는지를 중심으로 확인했다.

**직접 실행 확인**: 관련 unit spec 7개(`user-entity-exposure.spec.ts`,
`dto-jsdoc-citation.spec.ts`, `user-secret-absence.spec.ts`, `pg-error.spec.ts`,
`workflow-versions.service.spec.ts`, `workspaces.service.spec.ts`,
`triggers.service.spec.ts`)를 `npx jest`로 실행해 **7 suites 전부 통과, 202 중 201 pass
· skip 1건**(`triggers.service.spec.ts:964` 의 기존 `it.skip('structural anchor', …)` —
이 diff 와 무관, 재확인 결과 신규 아님)을 확인했다. `.claude/tests/test_review_guard.py`
도 `python3 -m pytest` 로 **48 passed** 를 직접 확인했다(RESOLUTION.md 이 적은 수치와 일치).

## 발견사항

- **[INFO]** 직전 라운드(`15_52_58`)가 낸 두 건이 이번 커밋에서 정확히 해소됐음을 확인 — 조치 불요
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts`
    (`describe('listMembers — 수동 투영이 좁은지'` 안의 `it.each([['관계가 `null`', {
    user: null }], ['키 자체가 없음', {}]])`), `codebase/backend/src/modules/triggers/
    triggers.service.spec.ts`(`callFor` 팩토리 + `it.each([['update'], ['create']])`
    두 곳 — "다른 UNIQUE 인덱스 위반" / "unique 위반이 아닌 오류")
  - 상세: (1) `listMembers` 관계-부재 테스트가 이제 TypeORM 이 실제로 돌려주는 두 형태
    (`user: null` / 키 자체 없음)를 `it.each` 로 모두 mock 한다 — 이전에는 "키 없음" 한
    형태만 mock 해 실제 null 관계 경로를 태우지 않고 있었다. (2) `endpoint_path` UNIQUE
    충돌의 두 부정 케이스(다른 인덱스 통과·非unique 오류 통과)가 이제 `update`/`create`
    양쪽을 도는 대칭 구조로 바뀌었다 — 이전에는 `update` 한쪽에만 있었다. 두 수정 모두
    직접 코드를 열어 대조했고, `npx jest` 실행으로 통과를 확인했다. 새로 지적할 것이
    아니라 이전 지적이 올바르게 처리됐음을 확인차 기록한다.
  - 제안: 없음.

- **[INFO]** 직전 라운드의 세 번째 항목(`WorkspaceMemberDto.joinedAt` 의 `nullable: true`
  선언이 실제 `null` 값으로 검증된 적이 없음)은 이번 커밋에서도 그대로이며, 그 자체가
  "조치 불요 수준"으로 이미 처분된 항목이라 재차 지적하지 않는다
  - 위치: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts`
    (`joinedAt: string | null` 선언), 소비 e2e `codebase/backend/test/
    workspace-rbac.e2e-spec.ts` 의 `it('J. GET /:id/members …'`
  - 상세: DTO 주석 자체가 "workspace_member 를 만드는 네 자리가 전부 `joinedAt: new
    Date()` 로 즉시 채운다"고 실측 근거를 남겨, 현재 코드 경로로는 `null` 값이 도달
    불가능함을 자인하고 있다. 그 결과 "스키마가 `null` 을 선언했을 때 계약 검증기가
    실제 `null` 값도 통과시키는가"는 이 저장소 어디에도 테스트되지 않은 채 남아 있다.
    다만 이는 값이 좁고 선언이 넓은 안전한 방향의 미스매치이고, 직전 라운드가 이미
    "다음에 null 도달 경로가 생기면 그때 추가" 로 명시 처분했다 — 새 라운드마다 같은
    사실을 재지적하는 것 자체가 소음이라, 상태 변화 없음만 확인하고 등급을 올리지
    않는다.
  - 제안: 없음(향후 `joinedAt` 이 실제로 null 이 될 수 있는 경로가 생기면 그때 추가).

## 요약

이번 라운드는 새로운 결함을 만들지 않았고, 직전 라운드가 지적한 두 건(listMembers
null-vs-missing mock 사실성, endpoint_path 충돌 부정 케이스의 create/update 대칭성)을
정확히 겨냥해 해소했음을 코드 대조와 실행(jest 7 suites/202, pytest 48)으로 직접
확인했다. `pg-error-fixtures.ts` 를 `common/db/__test-utils__/` 에서 `shared/testing/`
으로 옮긴 것도 `tsconfig.build.json` exclude 세 항목과 대조해 dist 미포함을 확인했고,
남은 잔여 파일이 없음을 `find` 로 확인했다. 9차례에 걸친 반복 리뷰 끝에 도달한 이번
상태는 가드 3종 모두 양성/음성 fixture·술어 단위 테스트·통합(e2e) 캐너리 세 층을
갖추고, 과거 라운드에서 실제로 반증된 실수(검출력 0인데 그린이던 상태·인용 3형태 중
1개만 관측·`unwrap` 두 형태 중 하나만 관측·표면 축 통합 테스트 누락)를 전부 전용
fixture/it.each 로 고정해 재발 방지 구조가 되어 있다. 새로 발견한 결함은 없으며, 유일한
잔여 항목(`joinedAt` nullable 미검증)은 이미 저비용·저위험으로 명시 처분되어 있어
재차 등급을 올릴 근거가 없다.

## 위험도

LOW
