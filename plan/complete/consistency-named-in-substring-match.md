---
title: consistency 번들 — `_named_in` 이 부분 문자열로 매치해 코드 diff 를 예산 밖으로 밀어냈다
worktree: named-in-boundary
started: 2026-08-11
owner: developer
status: complete
priority: P2
spec_impact: none
---

## Overview

`--impl-done` 번들의 파일 우선순위 판정(`_named_in`)이 파일명을 **경계 없이 부분 문자열로**
찾는다. 그래서 브랜치 plan 이 `secret-store.md` 를 **사례로 나열**하기만 해도 무관한
`cafe24-api-catalog/store.md` 가 최상위 티어로 승격되고, 그 자리를 잃은 것이 **코드 diff** 였다.

`--impl-done` 은 "spec 이 약속한 것 vs 구현이 하는 것" 을 판정하는 모드다. 그 모드에서
**구현 쪽 입력이 통째로 빠지면** checker 는 spec 만 보고 BLOCK:NO 를 낸다 — "봤는데 괜찮다"
가 아니라 **"못 봤다"** 인데 출력은 같다.

## 어떻게 드러났나 — 조건이 통제된 관측

`spec-sync-stop-editor-and-forbidden-routes` PR 의 연속 두 라운드. 같은 저장소·같은 scope
(`spec/conventions`)·같은 checker(`cross_spec`):

| | 라운드 1 (`17_21_43`) | 라운드 2 (`17_42_52`) |
| --- | --- | --- |
| diff `@@` hunk | **57** | **0** |
| diff 본문 | 25,066자 **포함** | 31,525자 **탈락** |
| diff 앞 헤드 | 39,768자 · 청크 2 | **87,953자 · 청크 4** |

헤드에 새로 들어온 두 청크가 원인이다:

| 파일 | 크기 | 왜 들어왔나 |
| --- | --- | --- |
| `conventions/secret-store.md` | 17,616 | 브랜치 plan 이 **사례로** 언급 (정당한 매치) |
| `cafe24-api-catalog/store.md` | **30,559** | **오매치** — `secret-store.md` 안의 `store.md` |

두 파일이 48,185자를 먹었고 31,525자 diff 가 밀려났다. 라운드 사이에 내가 편집한 것은
`harness-review-gate-followups.md` 하나이고, 거기 적은 **가드 사각지대 사례 목록**이
방아쇠였다.

> **이 결함은 자기를 숨긴다.** 사례를 많이 적은 plan일수록 무관한 파일을 더 많이 끌어올리고,
> 그만큼 diff 가 밀려난다. 즉 **문서를 잘 쓸수록 리뷰 입력이 나빠진다.**

## 원인

```python
return bool(plan_text) and (
    rel in plan_text or os.path.basename(rel) in plan_text
)
```

`basename("…/cafe24-api-catalog/store.md")` = `store.md`, plan 본문의 `secret-store.md` 가
그것을 부분 문자열로 포함한다. 경계 검사가 없다.

**바로 위 코드 주석이 이 경로를 명시적으로 부정하고 있었다**:

> a catalog page sits in tier 4 (last) and **cannot reach the prefix unless the branch edited
> it** … Mutating the check away left every test green, which is what unreachable defence
> looks like.

주석의 단언이 틀렸다. 그리고 "뮤테이션해도 전부 초록" 은 **도달 불가의 증거가 아니라
그 경로를 덮는 테스트가 없다는 증거**였다 — 저자는 도달 경로를 `changed` 하나로만 생각했고
`_named_in` 을 통한 두 번째 경로를 세지 않았다.

## 수정

`_named_in` 을 **경계 고정** 매치로 바꾼다.

```python
_NAME_START = r"(?<![A-Za-z0-9_.\-])"
_NAME_END   = r"(?![A-Za-z0-9_\-])"
```

- 앞 경계에 `.` 을 넣는다 — `v2.store.md` 가 `store.md` 에 답하지 않게.
- 뒤 경계에는 `.` 을 **넣지 않는다** — needle 이 이미 `.md` 로 끝나고, 뒤따르는 `.` 은
  평범한 산문(`… store.md.`)이다. 넣으면 그 형태가 죽는다.
- `rel` 쪽도 같이 감싼다. `a/store.md` 가 `b/a/store.md` 안에 있는 형태는 드물지만 **같은
  결함이고**, 한쪽만 고치는 것이 이 저장소가 반복해 값을 치른 형태다.
- `in` 을 먼저 돌려 싼 거절을 유지한다(정규식은 생존자에만). 리터럴 + lookaround 라 선형이다.

`_n_on_topic` 의 틀린 주석도 정정했다 — "도달 불가" 를 "이 경로로 도달했고, 경계 수정이
그것을 닫는다. tier-4 강등은 유일한 방어가 아니라 두 번째 줄" 로.

## 검증 — 양방향 뮤테이션

| 뮤턴트 | 잡히는 테스트 |
| --- | --- |
| **경계 제거**(원래 `in` 복원) | 2건 RED — 부분 문자열 승격 · `.mdx` 접미 |
| **과잉 조임**(`(?<=/)` 로 앞에 `/` 강제) | **4건** RED — 기존 basename 테스트 1 + 신규 subTest 2(백틱·문장 끝) + 브랜치-plan 티어 1 |

양쪽을 다 건 이유: 경계 수정은 **덜 잡거나 더 잡거나** 둘 다로 틀릴 수 있고, 한 방향만 걸면
반대 방향 회귀가 조용히 지나간다. 언급 형태 4종(frontmatter · 마크다운 링크 · 백틱 basename ·
문장 끝 bare)은 **subTest 로 각각** 단언한다 — 한 `plan_text` 에 몰아넣으면 하나만 살아도
통과한다.

**실제 관측 케이스 재현**: 라운드 2 의 그 plan 본문을 그대로 넣어 판정하니
`store.md` → `False`, `secret-store.md`·`swagger.md`·`1-auth.md` → `True`,
`error-codes.md`(미언급) → `False`. 오매치만 사라지고 진짜 신호는 전부 남았다.

전체: `test_consistency_bundle_priority` · `test_consistency_context_budget` ·
`test_consistency_impl_done` **66 passed / 33 subtests**.

## Rationale

**왜 tier-4 강등을 더 조이지 않았나.** `cafe24-api-catalog/store.md` 는 top-level 인덱스라
`_CATALOG_BULK_RE`(`…-api-catalog/<resource>/**`)의 대상이 아니고, 그건 **의도된 설계**다
(인덱스는 정식 spec). 이 사건의 원인은 카탈로그 분류가 아니라 **이름 매칭**이므로 그쪽을
고쳤다. 강등 규칙을 넓혔다면 정당한 인덱스 페이지가 함께 죽는다.

**왜 diff 에 예산 바닥을 깔지 않았나.** 그것도 유효한 방어지만 **다른 결함**이다 —
"무관한 파일이 승격된다" 를 고치지 않은 채 diff 만 보호하면, 그 무관한 파일은 여전히
**진짜 관련 spec** 을 밀어낸다. 원인을 먼저 닫는다. diff 바닥은 별도 항목으로 남긴다
(아래 후속).

**왜 P2 인가.** 동작 결함은 아니지만 **리뷰의 입력을 조용히 훼손**한다. 그리고 침묵한다 —
`--impl-done` 이 구현을 못 본 채 BLOCK:NO 를 내면 그 출력은 정상과 구분되지 않는다.

## 후속 (등재만)

- [ ] **`--impl-done` 의 code diff 에 예산 바닥을 깔지 판정** — 이번 수정은 *오매치로 인한*
      압박을 없앴을 뿐, 브랜치가 대형 spec 파일을 정당하게 여럿 편집하면 diff 는 여전히
      밀려날 수 있다. 후보: (a) diff 를 head 구간(절대 드롭 안 됨)으로 옮긴다,
      (b) 통째 드롭 대신 **diff 자체를 잘라** 파일·hunk 헤더만 남긴다. (b)가 "부분이라도
      보여준다" 는 이 저장소의 자리-표식 원칙과 같은 결이다.
