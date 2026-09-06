# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** 보안 경계로 명시된 `creator` 투영 리터럴 `{ id: true, name: true, email: true }` 이 SoT(`WorkflowVersionCreatorDto`)에서 파생되지 않고 4곳에 손으로 복제돼 있다
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:62`(`findByWorkflow`) · `:89`(`findOne`), `codebase/backend/src/modules/workflow-versions/workflow-versions.service.spec.ts:60`·`:85`(동일 리터럴을 단언에도 복제)
  - 상세: `findOne` 의 주석 자신이 "**투영이 이 메서드의 보안 경계다**" 라고 명시하고, `WorkflowVersionCreatorDto` 가 광고하는 "세 필드와 같은 집합" 이라고 서술한다. 즉 이 리터럴의 정본은 이미 `codebase/backend/src/modules/workflow-versions/dto/responses/workflow-version-response.dto.ts` 의 `WorkflowVersionCreatorDto`(`id`·`name`·`email`)인데, TypeORM `select` 절에는 그 타입에서 파생하지 않고 같은 세 키를 손으로 다시 적었다. `grep -rn "id: true, name: true, email: true"` 결과 production 2곳 + spec 2곳, 총 4곳에서 완전히 동일한 리터럴이 나타난다. 이 PR 은 정확히 같은 문제(관계 이름을 손으로 나열하면 다음 사람이 놓친다)를 `collectUserRelationNames` 로 "출처를 바꿔" 해결했다고 CHANGELOG·가드 JSDoc 에서 여러 번 강조하는데, 그 원칙이 이 리터럴에는 적용되지 않았다. 누군가 `WorkflowVersionCreatorDto` 에 필드를 추가·제거해도 이 4곳 select 문은 자동으로 따라가지 않으며, 반대로 `findOne`/`findByWorkflow` 둘 중 하나만 고치면(이번 Critical 이 실제로 그런 "한쪽만 옳았다" 사례였다) 다시 비대칭이 생길 수 있다.
  - 제안: `WorkflowVersionsService` 모듈에 `CREATOR_PROJECTION = { id: true, name: true, email: true } as const satisfies FindOptionsSelect<User>` 같은 단일 상수를 두고 두 메서드가 그것을 참조하게 한다. 이상적으로는 `WorkflowVersionCreatorDto` 의 필드 목록에서 파생시켜(예: `Object.keys` 기반 헬퍼 또는 타입 레벨 매핑) select 리터럴과 DTO 선언이 구조적으로 묶이게 하면, 이 PR 이 다른 곳에서 이미 확립한 "손 열거 금지, SoT 파생" 원칙과 일관된다.

- **[WARNING]** 신규 e2e 케이스 라벨 `J.` 가 알파벳 순서상 마지막 자리가 아니라 `D.`와 `E.` 사이 물리적 위치에 삽입되어, 파일의 "라벨 = 등장 순서" 관례가 깨진다
  - 위치: `codebase/backend/test/workspace-rbac.e2e-spec.ts:287`(`it('J. GET /:id/members …')`) — 바로 앞 `:231`(`D.`), 바로 뒤 `:326`(`E.`)
  - 상세: 이 파일은 `A → S → B → C → D → E → F → G → H → I` 순서로 시나리오 라벨이 등장하며, 파일 안 주석들이 서로를 "테스트 A 는…" 식으로 라벨로 참조하는 관례를 쓴다(직전 리뷰 라운드 `review/code/2026/09/06/10_13_22/maintainability.md` WARNING 이 지적한 `F.` 중복은 `J.` 로 개명해 유일성은 회복됐다 — `grep -n "it('[A-Z]\."` 로 전수 확인, 중복 없음). 그러나 개명 시 라벨만 바꾸고 물리적 위치는 옮기지 않아, 지금 파일을 위에서 아래로 읽으면 `A, S, B, C, D, J, E, F, G, H, I` 순서로 `J` 가 알파벳상 가장 마지막 값인데도 6번째 자리에 나타난다. 이 파일의 라벨은 "몇 번째로 추가됐나" 가 아니라 "어떤 invariant 를 지키나" 를 가리키는 식별자이므로 순서 자체가 핵심은 아니지만, 지금까지는 라벨 순서와 물리적 순서가 우연히도 일치해 왔고(`A`~`I` 는 실제로 그 순서로 등장) 이번이 그 불변식을 처음 깨는 사례라 다음 사람이 라벨로 "몇 번째 테스트인지" 를 추정하면 틀린다.
  - 제안: `J.` 를 `I.`(:585) 바로 뒤로 옮겨 물리적 순서와 라벨 순서를 다시 맞추거나, 혹은 애초에 논리적으로 인접한 자리(멤버/RBAC 조회 계열인 `D.`~`G.` 부근)에 두고 싶다면 그 사이 라벨들을 한 칸씩 밀어 재정렬한다. 라벨이 "추가 순서" 를 의미하지 않는다는 점을 헤더 docstring 에 한 줄 남기는 것도 대안이다.

- **[INFO]** `UserRelationLoad.relation` 과 사촌 필드 설계는 일관되나, `findUserRelationLoads` 의 두 매칭 경로(“`relations` 초기자” vs “`leftJoinAndSelect`/`inner`”)가 “문자열에서 마지막 세그먼트를 잘라 관계 이름을 구한다”는 같은 연산을 각각 인라인으로 반복한다
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts` — `userRelationInInitializer` 내부 `el.text.split('.').pop() ?? el.text`, `findUserRelationLoads` 내부 `first.text.split('.').pop() ?? ''`(약 141행·263행 부근; 정확한 위치는 `Read` 로 재확인 요망 — 해당 함수들 안)
  - 상세: 두 자리 모두 "점으로 구분된 경로의 마지막 세그먼트" 를 구하는 동일한 표현식을 쓰는데, 폴백값만 다르다(`el.text` vs `''`). `isUserRelationPath` 안에도 `value.split('.').pop() ?? value` 로 세 번째 사본이 있다. 로직 자체는 한 줄짜리라 지금 당장 버그를 만들지는 않지만, 세 곳 중 하나만 폴백 규칙을 바꾸면(예: 빈 문자열 대신 원본 유지로) 조용히 갈라질 수 있다.
  - 제안: `lastPathSegment(value: string): string` 헬퍼 하나로 통합해 세 호출부가 공유하게 한다. 우선순위는 낮음 — 급하지 않다.

## 요약

전반적으로 가독성·네이밍·문서화 수준이 높다. 가드(`user-entity-exposure-guard.ts`)는 순수 스캔 로직과 소비 spec 을 분리하는 형제 규약을 그대로 따르고, 함수는 짧고 단일 책임이며 중첩도 얕다(최대 2~3단). 직전 리뷰 라운드(`10_13_22`)가 지적한 `F.` 라벨 중복·`.toLowerCase()` 비관측 분기·`line` 미사용 필드는 모두 실제로 해소된 상태로 확인했다(RESOLUTION.md 서술과 현재 코드가 일치). 다만 이번 라운드에서 새로 드러난 것이 둘 있다: (1) 이 PR 이 스스로 강조하는 "손 열거 대신 SoT 파생" 원칙이 `creator` 프로젝션 리터럴에는 적용되지 않아 보안 경계를 이루는 세 필드 집합이 4곳에 수기 복제돼 있고, (2) `F.` 중복을 해소하며 붙인 새 라벨 `J.` 가 유일성은 회복했지만 파일의 "라벨=등장 순서" 관례를 처음으로 깼다. 둘 다 국소적이고 지금 당장 기능 결함을 만들지는 않지만, 다음 사람이 같은 패턴(창법·라벨)을 복제할 때 혼동의 씨앗이 될 수 있다.

## 위험도

LOW
