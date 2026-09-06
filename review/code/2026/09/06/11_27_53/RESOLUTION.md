# RESOLUTION — `review/code/2026/09/06/11_27_53` (+ consistency `11_27_54`)

**원 결과**: 코드 리뷰 Critical **0** · WARNING 4 · 위험도 LOW ·
consistency BLOCK: NO · Critical 0 · WARNING 2
**처분**: 코드 리뷰 WARNING 4건 전부 수정. consistency 2건은 3차 재확인된 planner 항목이라
코드 변경 없음.

**직전 Critical 은 닫혀 있다** — 10개 reviewer 전원이 재확인했다.

## W2 (testing) — 내 가드가 "겉은 투영, 실은 전체 노출" 을 통과시켰다

`hasProjectionFor` 가 `select.<relation>` **키의 존재만** 봤다. `select: { creator: true }` 는
컬럼을 하나도 안 좁히는데 — `relations: { creator: true }` 단독과 같은 오버페치 — "투영
있음" 으로 통과했다. **이 PR 전체가 막으려는 결함 클래스를 가드 자신이 재현한 자리**다.

### 첫 수정이 과했고, 그것을 실측이 잡았다

`ts.isObjectLiteralExpression` 을 요구하도록 고쳤더니 래칫이 **두 자리를 새로 물었다**:

```
+ "modules/workflow-versions/workflow-versions.service.ts#findByWorkflow"
+ "modules/workflow-versions/workflow-versions.service.ts#findOne"
```

둘 다 `select: { creator: CREATOR_PROJECTION }` — **이름 있는 상수**로 투영하는 정상
형태이고, 바로 이번 라운드에 내가 그렇게 바꾼 것이다. 식별자를 따라가려면 타입 체커가
필요한데 이 가드는 단일 파일 AST 만 본다.

**술어를 뒤집었다** — "객체인가" 가 아니라 **"불리언이 아닌가"**. 결함의 실제 형태는
불리언이므로 그것만 배제한다. 모르는 것(식별자·스프레드)은 통과시키되 아는 결함은 확실히
잡는, 좁고 눈먼 술어다. fixture 에 양쪽을 다 넣었다 — `select: { creator: true }`(위반),
`select: { creator: NAMED_PROJECTION }`(준수).

## W1 (security) — eager 관계는 호출부에 텍스트가 없다

`@ManyToOne(() => User, { eager: true })` 는 **호출부에 `relations` 도 `*JoinAndSelect` 도
남기지 않는다** — TypeORM 이 자동으로 조인해 전 컬럼을 싣는다. 호출부만 훑는
`findUserRelationLoads` 는 원리적으로 볼 수 없다.

`findEagerUserRelations` 를 신설해 **엔티티 데코레이터**를 본다. 실측상 현재 `User` 를
가리키는 eager 관계는 **0건**이고, 그 0을 계약으로 고정했다.

## W3 (documentation) — 테스트 제목의 stale count

*"위반 10형태"* 라고 적었는데 fixture 는 11개였고, 같은 브랜치의 RESOLUTION 은 *"11형태"*
라고 적어 **두 문서가 갈렸다**.

**숫자를 고치지 않고 없앴다** — 제목을 *"fixture 의 위반 함수를 하나도 빠짐없이 잡는다"* 로
바꿨다. 단언 자체가 전체 목록을 비교하므로 숫자는 애초에 필요 없었다. 준수 쪽 제목도 같은
이유로 개수를 뺐다. (이 브랜치가 같은 실패를 세 번째 겪는 자리라 숫자를 갱신하는 처방은
택하지 않았다.)

## W4 (requirement) — 타입이 여전히 `creator: User` 전체를 약속했다

런타임은 3필드인데 TS 타입은 `User` 그대로여서, 새 소비자가 `version.creator.passwordHash`
를 써도 컴파일러가 안 막는다(리뷰어가 `tsc --noEmit` 오류 0건으로 실측). 값이 좁고 타입이
넓은 방향이라 유출은 아니지만, 이 PR 이 `select:false` 를 기각한 이유(*"undefined 를 받고
조용히 실패"*)와 **같은 형태의 위험을 읽기 쪽에 재생산**한다.

`ProjectedCreator = Pick<User,'id'|'name'|'email'>` 를 두고 두 반환 타입을 좁혔다
(`WorkflowVersionListItem` · 신설 `WorkflowVersionDetail`). `WorkflowVersionListItem` 이
`snapshot` 을 `Omit` 으로 좁힌 선례를 그대로 따랐다.

**소비처를 먼저 확인했다** — `findOne` 의 결과를 쓰는 자리는 컨트롤러(그대로 반환)와
`WorkflowsService.restoreVersion` 둘이고, 후자는 `target.snapshot` 만 읽는다. `tsc --noEmit`
오류 0건.

## consistency WARNING 2 — 3차 재확인, 코드 변경 없음

둘 다 `spec/` 쓰기라 권한 밖이고 checker 들이 *"이미 plan 에 등재됨"* 이라고 적었다.
상세는 `review/consistency/2026/09/06/11_27_54/RESOLUTION.md` — 그중 INFO#1 은 실측 결과
**이미 78건 래칫에 동결**돼 있어 신규 항목을 만들지 않았다.

## 남긴 것

| 항목 | 판단 |
|---|---|
| INFO#2 `listMembers` 오버페치 잔존 | 래칫이 그 자리를 동결해 "늘지 않게" 는 막는다. 투영 적용은 별도 |
| INFO#6 `enclosingName` 이 화살표 필드 메서드 미인식 | 검출 자체는 안 잃는다(정확 일치 단언이 새 키를 실패시킴). `User` 관계를 다루는 화살표 필드는 0건 |
| INFO#7 중첩 투영 미인식 | **오탐 방향**(안전 쪽) — 실제 형태가 나오면 재귀 확장 |
| INFO#8 `<T>expr` 구식 단언 미관측 | `unwrap` 이 처리하지만 fixture 없음. 이 저장소 코드베이스에 그 문법 0건 |

## 검증

| 단계 | 결과 |
|---|---|
| lint | PASS |
| unit | PASS |
| build | PASS |
| e2e | PASS — **299** |

가드 spec **15/15**. 첫 수정이 정상 형태를 잡은 것은 래칫이 실제로 물어서 드러났다 — 그
자체가 래칫이 살아 있다는 증거다.
