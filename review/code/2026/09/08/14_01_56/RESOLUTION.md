# RESOLUTION — `review/code/2026/09/08/14_01_56` (`--route=all`, 3라운드)

Critical **0** · Warning **4** · INFO 9. forced 7/7. 넷 다 반영했다(3건 수정 + 1건 defer).

**뮤테이션 잔여물 확인 (INFO#9)**: 리뷰어 여럿이 `source-scan.ts` 에서 자기가 만들지 않은
`const isFn = false; // MUTATION` 을 관측했다고 보고했다 — 이 저장소가 기록해 둔 *"병렬
리뷰어가 저장소를 뮤테이션해 서로를 오염시킨다"* 형태다. **`git status` 로 확인했고 잔여물은
없다**(그 리뷰어가 원복했다). `grep -rn "MUTATION" codebase/backend/src` → 0건.

---

## W1 (MEDIUM, testing) — 내가 넣은 분기가 죽은 코드였다 → **지웠다**

리뷰가 **뮤테이션으로 실측**했다: `enclosingScopeName` 의 `isFn` 계산을 `false` 로 바꿔도
두 소비 가드 스위트가 **전부 GREEN**. 즉 *"초기자가 함수인 변수를 우선"* 하는 갈래는 어떤
fixture 로도 관측되지 않는다.

**fixture 를 만들어 정당화하는 대신 지웠다.** 그 갈래는 *"감싸는 변수가 둘 이상이고 그중
하나만 함수 초기자"* 일 때만 다른 답을 내는데 저장소에 그런 형태가 없다. 없는 경우를 위해
검증되지 않은 코드를 두는 것보다, 두 가드가 **실제로 검증한** 알고리즘(형제 원본) 하나만
남기는 편이 낫다.

**제거 후 실측: 50 suites / 728 tests GREEN** — 뮤테이션했을 때와 같다. 그것이 죽은 코드였다는
증거다.

## W2 (architecture) — **defer**. 같아 보이는 넷이 서로 다른 계약에 묶여 있다

리뷰: *"`{id, email, name}` 이 `CREATOR_PROJECTION` 이 있는데도 인라인으로 또 적혔다 — 이 PR 이
`pg-error.ts` 에서 실천한 원칙과 반대"*.

전수 실측(`grep`)해 보니 넷이고, **값이 겹치는 것은 둘뿐**이다:

| 자리 | 모양 | 무엇에 묶여 있나 |
|---|---|---|
| `CREATOR_PROJECTION` | `{id, name, email}` | **`WorkflowVersionCreatorDto` 와 대조 테스트로 고정** |
| `listMembers` | `{id, email, name}` | 그 메서드의 6키 반환 형태 |
| `notifications.service.ts:449` | `{id, email}` | 알림 발송 대상 |
| `notifications.service.ts:353·367·417` | `{id, notificationPreferences}` | 용도 자체가 다름 |

묶으면 `WorkflowVersionCreatorDto` 에 필드가 늘 때 `listMembers` 가 **조용히** 그 컬럼을 함께
싣는다 — 리뷰가 말한 *"서로 다른 바운디드 컨텍스트"* 가 오히려 결합하면 안 되는 이유다.
`pg-error.ts` 와 다르다: 거기는 **같은 개념**(두 표면을 흡수하는 판정)이 네 벌이었고, 여기는
**우연히 같은 값**이다.

**리뷰가 걱정한 위험은 다른 축으로 이미 닫혔다** — B-4 가 `listMembers` 를
`user-entity-exposure-guard` 보호 범위에 넣었으므로, 그 투영이 **넓어지면** 래칫이 문다.

→ 트래커에 재개 신호와 함께 등재했다: **셋째 자리가 같은 값으로 생기거나** 두 계약이 실제로
한 개념으로 수렴하면 그때 승격한다.

## W3 (requirement/side_effect) — 내가 놓친 두 번째 계약 파손

B-1 이 ratchet 을 `run-test.sh build` 로 들여왔는데, **그 스크립트 두 개 자신의 docstring** 이
여전히 *"`run-test.sh` 의 4단계에는 **없다**"* 라고 적고 있었다. `PROJECT.md` 는 고쳤으면서
대상 스크립트는 빠뜨렸다.

**같은 형태를 이 세션에서 두 번째로 만든 것이다** — 첫 번째는 `__test-utils__` docstring 세
개(2라운드에서 발견). 취소선 + 정정으로 갈았다.

## W4 (documentation) — plan 체크리스트가 자기 이력을 못 따라갔다

`/ai-review` 줄이 1라운드만 인용하고 2라운드를 반영하지 않았다. 3라운드 표로 바꾸고 **왜
라운드가 늘었는지**(fix→stale 루프)와 **발견의 성격이 내려간 궤적**을 함께 적었다.

---

## INFO 처분

| # | 항목 | 처분 |
|---|---|---|
| 1·3·5·6·7·8 | listMembers / 예외 필터 / 헬퍼 승격 / pgErrorConstraint / exclude / e2e | 확인만 (전부 긍정) |
| 2 | `select` 키와 `.map` 반환 키가 손으로 동기화된다 | **defer** — 다음에 필드를 더할 때 단언 범위를 top-level 까지 넓힌다 |
| 4 | destructuring 별칭(`const {triggerRepository} = this`) 경유는 스캔에서 빠진다 | **defer** — 저장소에 그 형태 0건. 가드 헤더가 이미 *"좁고 눈먼 술어"* 로 자기 한계를 적는다 |
| 9 | 리뷰어 뮤테이션 잔여물 | 확인 완료 — 잔여 0 |

---

## 수렴 판단

| 라운드 | Critical | Warning 의 성격 |
|---|---|---|
| 1 `12_53_08` | 0 | 문서(CHANGELOG) |
| 2 `13_34_28` | 0 | 구조(중복) + 문서(orphan) |
| 3 `14_01_56` | 0 | **죽은 코드 1 + 낡은 문서 2 + plan 자기서술 1** |

**동작 결함은 세 라운드 내내 0건**이고, 2·3라운드가 문 것은 전부 **그 라운드의 fix 자신**이다.
이번 fix 는 **삭제 1건 + 문서 3건**이라 새 표면을 만들지 않는다.
