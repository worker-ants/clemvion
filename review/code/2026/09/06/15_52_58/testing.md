# 테스트(Testing) 리뷰

## 개요

리뷰 대상은 `origin/main...HEAD` 의 `codebase/**` 변경 20개 파일 — `User` 엔티티 컬럼 노출
방어 3축(구조 `user-entity-exposure-guard` · 값 `user-secret-absence` · JSDoc 인용
`dto-jsdoc-citation-guard`), `WorkflowVersionsService`/`TriggersService` 의 실유출·계약 갭
수정, `WorkspacesService.listMembers` 단위 테스트 신설, 관련 e2e 3건이다. 이 브랜치는 이미
`10_13_22`부터 `15_31_00`까지 8차례의 `/ai-review`+`/consistency-check` 라운드를 거쳤고,
testing 관점 지적(eager 축 검출력 0건, `unwrap` 분기 편중, 인용 3형태 중 1개만 관측, 표면
축 통합 테스트 누락 등)이 매 라운드 fixture·`it.each` 확장으로 해소된 이력이 `RESOLUTION.md`
에 남아 있다. 이번 라운드에서 새 코드를 직접 열어 확인하고 신규/변경 unit spec 7개
(`user-entity-exposure.spec.ts`, `dto-jsdoc-citation.spec.ts`, `user-secret-absence.spec.ts`,
`pg-error.spec.ts`, `workflow-versions.service.spec.ts`, `triggers.service.spec.ts`,
`workspaces.service.spec.ts`)를 `npx jest`로 직접 실행해 **198 passed, 1 skipped(무관한
기존 `it.skip`), 7 suites 전부 통과**를 확인했다.

## 발견사항

- **[INFO]** `listMembers` "관계 미로드" 테스트가 TypeORM 의 실제 null 관계 형태(`user: null`)가
  아니라 **키 자체가 없는** 객체를 mock 한다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` — `it('관계가 안 실려 와도(`user` 부재) 터지지 않고 빈 문자열로 채운다'` 블록의 `memberRepo.find.mockResolvedValue([{ id: 'm-2', userId: 'u-2', role: 'viewer', joinedAt: null }])`
  - 상세: `WorkspacesService.listMembers` 는 `relations: ['user']` 로 LEFT JOIN 하므로, 매칭되는 `User` 행이 없을 때 TypeORM 이 실제로 돌려주는 값은 보통 `user: null`(키는 존재, 값이 null)이지 키 자체의 부재가 아니다. 테스트는 `user` 프로퍼티를 아예 생략한 객체로 그 경로를 흉내 낸다. 구현이 `m.user?.email ?? ''` 형태의 옵셔널 체이닝을 쓰므로 `undefined`·`null` 두 경우 모두 같은 결과(`''`)로 귀결되어 **지금은 결과에 차이가 없지만**, 테스트가 실제 러너타임 형태를 재현하지 않으므로 "관계 부재" 시나리오의 신뢰도가 이름이 암시하는 것보다 약하다.
  - 제안: `user: null` 을 명시적으로 넣어 실제 TypeORM 반환 형태에 더 가깝게 만든다(동작에 영향 없음, 테스트 정확도만 개선).

- **[INFO]** `endpoint_path` UNIQUE 충돌의 "매칭 안 되면 그대로 흘려보낸다" 회귀 테스트가 `update()` 경로로만 있고 `create()` 경로엔 없다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts` — `it('다른 UNIQUE 인덱스 위반은 가로채지 않고 그대로 흘려보낸다'` 및 `it('unique 위반이 아닌 오류도 그대로 흘려보낸다'` (둘 다 `service.update(...)` 만 호출)
  - 상세: `create()`와 `update()` 모두 동일한 `.catch((err) => this.rethrowEndpointPathConflict(err))` 를 붙였고(`triggers.service.ts` `create()`/`update()` 각각), "매칭되는 인덱스 충돌 → 409" 케이스는 `it.each`로 `create`/`update` 양쪽을 도는 반면, "매칭 안 됨 → 원본 에러 그대로" 케이스는 `update()` 한쪽만 돈다. 두 메서드가 지금은 완전히 같은 private 헬퍼를 공유하므로 실질 위험은 낮지만, 나중에 `create()` 쪽에만 다른 `.catch` 체인이 추가되거나 헬퍼가 갈라지면 이 비대칭 때문에 `create()`의 패스스루 회귀가 한 라운드 늦게 발견된다.
  - 제안: 두 부정 케이스 `it.each`에도 `['update']`/`['create']` 축을 추가해 대칭을 맞춘다(비용 낮음, 이미 있는 `call` 팩토리 패턴 재사용 가능).

- **[INFO]** `WorkspaceMemberDto.joinedAt` 의 `nullable: true` 선언이 실제 `null` 값으로 검증된 적이 없다
  - 위치: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts` (`joinedAt: string | null`), 소비 e2e `codebase/backend/test/workspace-rbac.e2e-spec.ts` 의 `it('J. GET /:id/members …'`
  - 상세: DTO 주석 자체가 "실측: `workspace_member` 를 만드는 네 자리가 전부 `joinedAt: new Date()` 로 즉시 채운다"고 밝혀 현재는 `null` 도달 불가능임을 인지하고 있다. 다만 그 결과로 `nullable: true` 선언의 참/거짓을 실제 값으로 검증하는 테스트(계약 검증기가 `null` 을 받아도 통과하는지)는 이 저장소 어디에도 없다 — 스키마가 허용하는 값 하나가 코드로 도달 불가라는 사실은 문서화돼 있지만, "도달했을 때도 계약을 지킨다"는 것 자체는 미확인 주장으로 남는다. 위험은 낮다(선언을 넓히는 방향의 안전한 미스매치).
  - 제안: 조치 불요 수준. 다음에 `joinedAt` 이 실제로 null 이 될 수 있는 경로(예: 초대 수락 전 상태를 이 테이블에 편입)가 생기면 그때 null 값에 대한 계약 테스트를 추가한다.

## 요약

새로 추가/변경된 테스트는 전반적으로 매우 높은 완성도를 보인다 — 각 가드(`user-entity-exposure-guard`, `dto-jsdoc-citation-guard`, `user-secret-absence`)마다 양성/음성 fixture, 술어 단위 테스트, 통합(e2e) 캐너리 세 층을 갖추고, 이전 라운드에서 실제로 반증된 실수(검출력 0건 상태로도 그린이던 것·인용 3형태 중 1형태만 관측·`unwrap`이 벗기는 두 형태 중 하나만 관측)를 각각 전용 fixture 케이스로 고정해 재발 방지 구조를 만들었다. `TriggersService`의 `endpoint_path` UNIQUE 충돌 처리는 `(method × surface)` 4조합 `it.each` + 반대 방향 대조군(다른 인덱스 통과) + 술어 단독 테스트로 촘촘하고, `WorkflowVersionsService`는 DTO의 OpenAPI 스키마에서 직접 뽑은 키 집합과 상수를 대조해 "같은 리터럴을 두 곳에 손으로 복제"하는 결함 클래스를 코드로 봉쇄했다. `WorkspacesService.listMembers` 신규 단위 테스트는 e2e 하나에만 의존하던 유일한 안전망을 단위 레벨로 보강했고, `findUserSecretLeaks`를 함께 걸어 이름 축 이중 방어를 검증한다. 직접 `jest`로 실행해 7개 관련 spec 스위트 198개 테스트가 모두 통과함을 확인했다. 이번 라운드에서 새로 발견한 것은 실질적 결함이 아니라 INFO 수준 3건(관계-부재 mock 형태의 사실성, create/update 패스스루 대칭성, nullable 선언의 미검증 방향)뿐이며 전부 저비용·저위험이다.

## 위험도

LOW
