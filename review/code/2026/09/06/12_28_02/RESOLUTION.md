# RESOLUTION — `review/code/2026/09/06/12_28_02` (+ consistency `12_28_03`)

**원 결과**: 코드 리뷰 Critical **0** · WARNING 3 · 위험도 LOW ·
consistency BLOCK: NO · Critical 0 · WARNING 2
**처분**: 코드 리뷰 WARNING 3건 + INFO 3건 수정 · consistency 는 5차 재확인 planner 항목 +
INFO 1건 수정

## W2 (testing) — 세 번 난 위반을 사람이 세 번 잡았다. 가드를 세웠다

DTO 의 JSDoc 은 `introspectComments` 로 **공개 OpenAPI `description`** 이 된다. 그래서
`review-citations.md §3` 이 그 자리를 인용 대상에서 빼고 `//` 를 회피처로 처방한다.
그런데 이 브랜치 계열에서 같은 위반이 **세 번** 났고, 세 번 다 **사람이 읽고 잡았다**.

**`dto-jsdoc-citation-guard.ts` 신설.** `dto/responses/**` 의 클래스·프로퍼티 JSDoc 에서
리뷰 인용(`review-citations.md §2` 의 세 형태 — 전체 경로 · 날짜+시각 · **bare 시각**)을
센다. `//` 는 보지 않는다 — 그것이 규약이 처방하는 자리다.

**bare 시각을 뺄 뻔했다.** 규약이 금지하는 형태니 안 봐도 된다고 생각했는데, 반대다 —
금지된 형태일수록 JSDoc 에 남을 확률이 높다. 세 패턴을 다 넣었다.

**베이스라인이 0이 아니다.** 두 자리가 이미 있고 **둘 다 `#1291` 이 넣었다**(그 PR 의
게이트도 "필드 JSDoc" 만 봤다). `§4`(소급 정리 대상 아님)에 따라 지우지 않고 동결한다.

> **가드가 내 손 grep 을 독립적으로 재현했다.** 직전 라운드에 grep 으로 찾아 plan 에 등재한
> 그 두 자리를, 가드가 스캔해서 정확히 같은 목록으로 내놨다.

## W1 (testing) — `unwrap` 의 4분기 중 1개만 관측되고 있었다

`satisfies` 만 fixture 에 있었다. 나머지 셋을 살펴보니:

| 분기 | 처분 |
|---|---|
| `as` | **fixture 추가** — `relations` 를 `string[]` 으로만 받는 `strictRepo` 를 두어 `as unknown as string[]` 이 **필요한** 단언이 되게 했다. 그래야 lint 의 `no-unnecessary-type-assertion` 이 막지 않는다 |
| 괄호 | **분기 제거** — prettier 가 불필요한 괄호를 지운다. fixture 에 써도 포맷 단계에서 사라져 **관측할 수 없다** |
| `<T>expr` | **분기 제거** — 저장소 전체 0건이고 lint 가 `as` 를 권한다 |

관측할 수 없는 분기는 지워져도 아무도 모른다. 남기면 *"덮었다"* 는 인상만 주므로 잘라냈다.

## W3 (documentation) — eager 축이 코드에만 있고 문서 셋에 없었다

`findEagerUserRelations` 를 세우고도 상위 문서 셋(가드 spec 헤더 · CHANGELOG · plan 완료
노트)이 여전히 *"호출부 스캔 세 형태"* 만 적고 있었다. 셋 다 **호출부 축 / 엔티티 축**으로
갈라 적었다 — 엔티티 축이 왜 별도인지(호출부에 텍스트를 안 남긴다)를 함께.

## INFO 함께 처리

| # | 항목 | 처분 |
|---|---|---|
| 2·12 | 따옴표 벗기기가 일부 지점에만 적용 | `propKeyText()` 로 통합하고 **안 벗기던 두 자리**(`relations`/`select` 키 비교)에도 적용 |
| 14 | `J.` 테스트에 옛 `F` prefix 문자열 잔존 | `rbac-j-*` · `uniqueName('J')` 로 정정. 파일에 `rbac-f-own` 이 **둘** 있어(원래 `F.` 테스트) `J.` 블록 안에서만 치환했다 |

## consistency `12_28_03`

WARNING 2건은 **5차 재확인**된 planner 항목 — checker 도 *"신규 plan 항목 생성 불요"*.
INFO 1건은 수정했다: `workspace-rbac.e2e-spec.ts` 헤더가 RBAC 계약을 `1-auth.md §1.3` 이라
적었는데 실측하면 `§1.3` 은 *"셀프 호스팅 추가 인증(미구현·Planned)"* 이고 RBAC 는 `§3`
이다. checker 는 *"diff 밖"* 으로 분류했지만 **이 브랜치가 이미 그 파일을 편집한다**.

## 남긴 것

| 항목 | 판단 |
|---|---|
| INFO#1 스캔 범위가 `src/modules` 로 한정 | 서비스가 전부 그 아래라는 실측 전제. 넓히면 fixture 가 베이스라인을 오염시킨다 |
| INFO#13 `sameRelationName()` 헬퍼 | 비교 규칙이 한 곳(`isUserRelationPath`)에 있고 `hasProjectionFor` 는 관계명 대 관계명이라 축이 다르다 |
| INFO#3·#4 spec 침묵 2건 | `spec/` 쓰기 — planner 항목으로 추적 중 |

## 검증

| 단계 | 결과 |
|---|---|
| lint | PASS |
| unit | PASS |
| build | PASS |
| e2e | PASS — **299** |

가드 spec: `user-entity-exposure` **16/16** · `dto-jsdoc-citation` **4/4**(신설).
