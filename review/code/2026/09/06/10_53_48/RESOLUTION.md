# RESOLUTION — `review/code/2026/09/06/10_53_48` (+ consistency `10_53_50`)

**원 결과**: 코드 리뷰 Critical **0** · WARNING 4 · 위험도 LOW ·
consistency BLOCK: NO · Critical 0 · WARNING 2
**처분**: 코드 리뷰 WARNING 4건 전부 수정 + INFO 3건 함께 · consistency 2건은 이미 등재된
planner 항목이라 지시를 더 정확히 고쳤다.

**직전 Critical 은 닫혔다** — security·requirement 두 reviewer 가 실측으로 확인했다.

## W1 (maintainability) — 내가 강조한 원칙을 정작 여기에 안 썼다

`creator` 투영 리터럴 `{ id: true, name: true, email: true }` 이 production 2곳 + spec 2곳,
**네 곳에 손으로 복제**돼 있었다. 이 PR 은 다른 자리(`collectUserRelationNames`)에서
*"목록을 넓히지 말고 출처를 바꿔라"* 를 근거로 삼았는데, **보안 경계를 이루는 이 리터럴에는
그 원칙을 적용하지 않았다.** 그리고 그 복제가 정확히 Critical 의 원인이었다 —
`findByWorkflow` 는 투영이 있고 `findOne` 은 없었던 것은 같은 값이 두 곳에 따로 적혀
있었기 때문이다.

**수정** — `CREATOR_PROJECTION` 단일 상수로 통합했다.

**주석으로 묶지 않았다.** `WorkflowVersionCreatorDto` 와의 일치를 테스트가 강제한다:

```ts
const declared = Object.keys(schemasOf(doc).WorkflowVersionCreatorDto.properties ?? {}).sort();
expect(declared.length).toBeGreaterThan(0);          // 스키마가 비면 vacuous
expect(Object.keys(CREATOR_PROJECTION).sort()).toEqual(declared);
```

두 목록을 맞대지 않고 **DTO 의 OpenAPI 스키마**에서 뽑는다 — 손으로 적은 둘을 비교하면
둘 다 같이 틀린 경우를 못 잡는다.

## W2 (testing/requirement) — 가드가 또 한 칸 좁았다

`relations: { workflow: { creator: true } }` **중첩 객체**를 스캔하지 않았다. 배열 쪽은
`'member.user'` 로 중첩을 잡으면서 객체 쪽은 최상위만 봤다 — 리뷰어 표현대로 *"이 가드가
막으려는 결함 클래스를 자신이 반복하는 자리"* 다.

**수정** — 객체 분기를 재귀로 넓혔다. 그런데 fixture 를 쓰다 **두 번째 구멍**이 드러났다:

`{ … } as unknown as Record<…>` 로 감싸자 검출이 **0건**이 됐다. `ts.isObjectLiteralExpression`
이 캐스트 한 겹에 거짓이 된다. `unwrap()` 을 넣어 `as`·`satisfies`·괄호·`<T>` 를 벗긴다.

fixture 는 `satisfies` 로 썼다 — `as` 로 쓰면 저장소 lint 가 **중복 단언**으로 막는다(실제로
막혔다). 즉 이 저장소의 프로덕션 코드에 남을 수 있는 형태가 `satisfies` 쪽이고, 가드는 둘을
같은 `unwrap` 으로 처리하므로 하나가 두 경로를 함께 태운다.

## INFO#4 함께 — `enclosingName` 의 설계 근거가 관측되지 않았다

*"메서드가 변수보다 우선"* 이라고 적어 뒀는데 그 근거로 든 형태(`const stored = await …`)가
어떤 fixture 에서도 실행되지 않았다 — 우선순위를 뒤집는 뮤턴트도 초록이었다.
`violationViaIntermediateVariable` 을 넣어 키가 `#<함수명>` 으로 잡히는지 직접 문다.

가드 대조군은 이제 **위반 11형태 / 준수 4형태**다.

## W3 (maintainability) — e2e 라벨 순서

`J.` 가 유일성은 회복했지만 물리적으로 `D.`와 `E.` 사이에 있어 이 파일의 "라벨=등장 순서"
관례를 깼다. 블록(51줄)을 파일 끝으로 옮겨 `A…I, J` 로 복구했다.

INFO#3 도 같은 축이라 함께 처리 — `workflow-crud.e2e-spec.ts` 의 신규 테스트가 그 파일의
레터 관례를 안 따르고 있었다. 전수로 세어 미사용 레터 **`H.`** 를 부여했다.

## W4 (documentation) — plan 수치 stale

*"§5.4 계약 대조 DTO 가 하나 늘었다"* 라고 적었는데 같은 브랜치가 Critical 을 닫으며 버전
단건 조회 e2e 를 더해 **둘**이 됐다(`WorkspaceMemberDto` · `WorkflowVersionDto`). 정정하고
왜 둘이 됐는지도 적었다.

## consistency WARNING 2 — 이미 등재된 planner 항목

checker 스스로 *"신규 항목 생성 불필요, 우선 처리만 권고"* 라고 적었다. 다만 **지시를 더
정확히** 고쳤다: spec 본문에 *"두 검증자"* 라고 못 박은 문장이 **둘** 있는데(§5.4 검증 층 ·
`swagger.md §5-1`) 그 표현이 이제 거짓이다. 대상 문장을 표로 명시하고,
**새 개수를 적어 넣지 말고 나열하라**고 못 박았다 — 이 문서가 이미 두 번 겪은 실패다.

## 남긴 것

| 항목 | 판단 |
|---|---|
| INFO#1 `findOne` 반환 타입이 여전히 `WorkflowVersion` | 타입이 런타임보다 **넓다** — 안전한 방향. 좁히면 `restoreVersion` 등 내부 소비처가 걸린다. 범위 밖 |
| INFO#2 spec §7.2 에 `creator` 필드 형태 미명시 | `spec/` 쓰기 — planner 후속에 묶임 |
| INFO#5 배열 `relations` + `select` 준수 대조군 | production 이 객체 형태만 쓴다 — 실질 위험 낮음 |
| INFO#6 `lastPathSegment` 헬퍼 통합 | 3곳 인라인, 폴백이 달라 통합 시 오히려 분기가 는다 |
| INFO#9 `_retry_state.json` 커밋 | 저장소 관례(`review/**` 전체 커밋)에 부합 |

## 검증

| 단계 | 결과 |
|---|---|
| lint | PASS — 첫 실행에서 `no-unnecessary-type-assertion` 1건(위 `satisfies` 로 해소) |
| unit | PASS |
| build | PASS |
| e2e | PASS — **299** |
