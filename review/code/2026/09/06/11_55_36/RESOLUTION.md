# RESOLUTION — `review/code/2026/09/06/11_55_36` (+ consistency `11_55_37`)

**원 결과**: 코드 리뷰 Critical **0** · WARNING 7 · 위험도 MEDIUM ·
consistency BLOCK: NO · Critical 0 · WARNING 3
**처분**: 실행 가능한 WARNING 5건 + INFO 2건 수정 · SPEC-DRIFT 2건은 권한 밖(재확인) ·
1건 defer 등재

## W1 (testing, MEDIUM) — 내가 방금 넣은 축의 **검출력이 0이었다**

직전 라운드에 `findEagerUserRelations` 를 세우고 *"현재 0건이고 그 0을 계약으로 고정한다"*
고 썼다. 리뷰어가 `hasEagerDecorator` 를 `return false` 로 무력화하고 돌려 보니 스위트가
**15/15 초록**이었다.

*"현재 0건이다"* 와 *"이 함수가 실제로 잡는다"* 는 **다른 주장**이다. 술어가 죽어 있어도
0건은 0건이므로, 전자만 단언하면 후자는 아무도 안 본다. 이 저장소가 이미 겪은
*"fixture 없는 래칫은 술어가 죽어도 그린"* 과 **같은 형태**인데, 나는 그 교훈을 인용하는
파일 안에서 그것을 반복했다.

**수정** — `fixtures/user-eager-relation.fixture.ts` 신설. 양성 2(`eager:true` 인 `User`
관계, 데코레이터 두 종류)와 음성 3(옵션 없음 · `eager:false` · `User` 아님)을 함께 문다.

**리뷰어의 뮤턴트를 그대로 재현해 확인했다** — `hasEagerDecorator` → `return false`:

| | 이전 | 지금 |
|---|---|---|
| 스위트 | 15/15 GREEN (생존) | **1 failed** — `[대조군] eager User 관계를 잡고…` |

## W4 (documentation) — JSDoc 이 또 대상에서 분리됐다

`collectUserRelationNames` 를 설명하는 JSDoc 이 함수 삽입 과정에서 밀려
`findEagerUserRelations` 위에 얹혔고, 정작 `collectUserRelationNames` 는 무주석이 됐다.
이 브랜치 계열이 반복해서 밟는 자리다.

## W5 (maintainability) — 순회 로직을 복제했다

엔티티에서 `User` 타입 속성을 찾는 AST 순회가 두 함수에 거의 그대로 복제돼 있었다.
리뷰어 지적대로, 이 PR 이 강조한 *"목록을 손으로 늘리지 말고 출처를 바꿔라"* 를 **순회
로직 자체에는 안 쓴 것**이다.

`forEachUserTypedProperty(entityFiles, visit)` 로 뽑고 두 함수는 필터·출력만 남겼다.
W4 와 같은 편집으로 JSDoc 도 제자리에 돌려놨다.

## W3 (architecture) — 옆자리에 같은 타입-런타임 간극이 남아 있었다

`WorkflowVersionListItem`/`Detail` 이 `workflow` 관계를 **비-옵셔널로 약속**하는데 두 조회는
`relations: { creator: true }` 만 준다 — 런타임에는 **항상 `undefined`** 다. `creator` 에
대해 방금 고친 것과 같은 형태가 바로 옆에 있었다.

`UnloadedRelations = 'workflow'` 를 두고 두 타입에서 뺐다. `audit-logs.service.ts` 의
`AuditLogListItem` 이 같은 이유로 `workspace` 를 뺀 선례를 따랐다.

## W6·W7 (SPEC-DRIFT) — 권한 밖, 재확인

*"두 검증자"* 문구 stale · `User` 7컬럼 노출 금지 규범 부재. 둘 다 `spec/` 쓰기이고
`plan` 에 planner 항목으로 등재돼 있다(이번이 4차 재확인). 리뷰어도 *"developer 권한 밖,
신규 조치 아님"* 이라고 적었다.

## W2 (architecture) — defer, 등재

`User` 안전 반환 방식이 세 서비스에서 각자 재발명된다. 리뷰어 스스로 *"급하지 않음,
다섯 번째 자리 생길 때 재검토"* 라고 적었다. 지금 공유 헬퍼로 수렴하면 세 자리의 요구가
서로 다른 상태에서 API 를 먼저 굳히게 된다 — 이 저장소가 `find → assert` 헬퍼에 대해 같은
이유로 유예한 선례가 있다.

## INFO 함께 처리

| # | 항목 | 처분 |
|---|---|---|
| 6 | `CREATOR_PROJECTION` 이 런타임 동결 아님 | `Object.freeze` 추가 |
| 10 | `schemasOf(doc)` 직접 인덱싱 | `schemaOf(doc, name)` 로 교체 — 그 헬퍼가 **정확히 이 실패**(무명 `TypeError`)를 막으려고 있다 |

## consistency W3 — 필드 JSDoc 에 내부 서사를 또 넣었다

`WorkspaceMemberDto.joinedAt` JSDoc 에 §5.4 근거·실측 날짜·내부 서비스 동작을 담았다.
필드 JSDoc 은 `introspectComments` 로 **공개 OpenAPI description** 이 된다(`swagger.md §3`).
**이 브랜치 계열이 세 번째로 같은 위반**을 한 것이다.

공개 문장은 한 줄로 줄이고 내부 서사는 `//` 로 내렸다.

고치면서 전수 grep 을 돌려 **클래스 JSDoc 두 곳**에도 같은 형태(리뷰 인용)가 있는 것을
찾았다 — `ScheduleTriggerWorkflowRefDto` · `TriggerWorkflowRefDto`. **둘 다 #1291 이 넣었고
그 PR 의 게이트를 통과했다.** 이 브랜치 diff 밖이라 손대지 않고 plan 에 등재했다. 등재문에
*"`review-citations.md §3` 표가 필드/클래스를 안 가른다 — 고치기 전에 그 문장부터 갈라야
같은 질문이 또 안 생긴다"* 를 함께 적었다.

## 검증

| 단계 | 결과 |
|---|---|
| lint | PASS — 첫 실행에서 fixture 의 불필요한 `eslint-disable` 1건, 제거 후 통과 |
| unit | PASS |
| build | PASS |
| e2e | PASS — **299** |

가드 spec **16/16**. eager 축은 리뷰어의 뮤턴트로 검출력을 직접 확인했다.
