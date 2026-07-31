# 테스트(Testing) 리뷰 — workflows duplicate() 팔로우업 재검토 (2차 라운드)

## 검증 방법

프롬프트에 첨부된 diff 외에 실제 코드베이스를 직접 열어 `workflows.service.spec.ts`(전체), `workflows.service.ts`,
`workflows.controller.spec.ts`를 확인했고, 신규 테스트 2건의 non-vacuous 여부를 독립적으로 재검증하기 위해
`duplicate()`의 `nodeRows`/`edgeRows` 가드에 3가지 mutation을 직접 적용 → `npx jest` 실행 → `cp` 백업으로 원복(작업
트리는 각 실험 후 `git status`/`git diff --stat`로 클린 확인)했다. 원복 후 최종 상태는 클린하다.

## 발견사항

- **[INFO]** 신규 테스트의 존재 근거로 서술된 mutation 설명이 실측과 다르다 — 실제로 새 테스트가 잡는 것은 "가드
  제거"가 아니라 "가드가 반대쪽 변수를 참조하는" 변수-교체(swap) 결함이다
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.spec.ts:675-676`(테스트 바로 위 주석),
    `plan/in-progress/review-info-followups.md:37-38`(§1.2 INFO #9 설명) — 두 곳 모두 "기존 '빈 캔버스' 케이스는
    둘 다 0 이라 한쪽 가드를 지워도 통과하므로, 노드만 있고 엣지가 0건인 조합이 별도로 필요하다"고 서술한다.
  - 상세: 직접 mutation으로 재현했다. `duplicate()`의 `if (edgeRows.length > 0) { await manager.insert(Edge,
    edgeRows...) }`에서 `if` 가드를 제거해 무조건 호출하도록 바꾸면(edgeRows가 `[]`인 채로 호출), 기존 "빈
    캔버스는 노드·엣지 insert 를 호출하지 않는다" 테스트(`expect(mockTransactionManager.insert).not
    .toHaveBeenCalled()`)가 **이미 그 자리에서 RED**가 된다 — `insert(Edge, [])` 호출 자체가 `not
    .toHaveBeenCalled()`를 깨기 때문이다(실측: duplicate 21건 중 2 failed — "빈 캔버스" 자신 + 신규 테스트).
    대칭적으로 `nodeRows.length > 0` 가드를 제거해도 동일하게 "빈 캔버스" 테스트 단독으로 RED(1 failed)가
    확인됐다. 즉 "가드를 완전히 지워 무조건 호출"이라는 뮤테이션 클래스는 이미 기존 테스트가 잡는다.
    신규 테스트가 실제로 고유하게 잡아내는 것은 **가드가 서로 다른 변수를 검사하도록 뒤바뀌는(swap) 결함**이다
    — `if (edgeRows.length > 0)`를 `if (nodeRows.length > 0)`로 바꿔 재현하면, "빈 캔버스"(둘 다 0)에서는
    두 변수 값이 우연히 같아(0==0) 차이가 관측되지 않아 통과하지만, 신규 테스트(노드 5·엣지 0)에서는 정확히
    `toHaveBeenCalledTimes(1)`/`insertedRows(Edge)).toBeUndefined()`가 실패한다(직접 재현 확인: 1 failed —
    신규 테스트만). 신규 테스트 자체는 유효하고 실제 가치가 있으나, 그 존재 이유로 서술된 뮤테이션 설명이
    부정확하다 — "가드 제거"가 아니라 "가드 변수 교체"라고 정정해야 정확하다.
  - 제안: 주석과 plan 문서의 근거 문구를 "가드가 반대쪽 변수를 검사하도록 뒤바뀌는 경우"로 정정. 코드/테스트
    자체는 수정 불필요 — 서술의 정확성 문제일 뿐이다.

- **[INFO]** plan/RESOLUTION 문서의 테스트 개수 claim("duplicate describe 22건", "스펙 전체 81/81")이 실측과 다르다
  — 이 PR이 바로 직전에(§INFO#3) 정정했던 것과 같은 유형의 수치 오차가 같은 문서에 재발
  - 위치: `plan/in-progress/review-info-followups.md:55`("`duplicate` describe 22건 기준(전체 스펙 81건)"),
    `:87`("`workflows.service.spec.ts` duplicate describe **22건** 통과 (기존 19 + 신규 3)"), `:98`("해당 스펙
    81/81"); `review/code/2026/07/31/18_00_00/RESOLUTION.md:51-52`("`workflows.service.spec.ts` 단독 **81/81**
    (duplicate describe 22건)")
  - 상세: 직접 `npx jest workflows.service.spec.ts`를 실행하면 **80 passed / 80 total**이고(81이 아님),
    `describe('duplicate', () => { ... })` 블록 안의 `it(`을 직접 세면 **정확히 16건**이다(22가 아님). 이번 diff는
    그중 2건만 신규 추가함을 unified diff로 직접 확인했으므로(기존 14 + 신규 2 = 16), "기존 19 + 신규 3 = 22"라는
    claim도 신규 건수(3 vs 실제 2)·기존 건수(19 vs 실제 14) 둘 다 틀렸다. "22"라는 수치는 `duplicate`라는
    문자열을 우연히 포함하는 무관한 테스트 5건 — `should reject canvas with duplicate node labels`(saveCanvas),
    `rejects payload with duplicate node labels`(importWorkflow), `describe('importWorkflow·duplicate 전제 —
    ...')` 하위 3건(W3c 가드) — 을 함께 세는 문자열-매칭 기반 카운트(16+5=21)에서 비롯된 것으로 보이며, 21에서
    22로 한 번 더 벌어진 정확한 경위는 확인하지 못했다. 흥미로운 점은 같은 diff에 포함된 이전 라운드의
    `review/code/2026/07/31/18_00_00/testing.md`(다른 리뷰어의 산출물)는 "service 80/80"으로 **정확히**
    기재하고 있어, 같은 PR 안에서도 문서 간 수치가 서로 어긋난다는 것이다. 실제 코드 결함은 아니며 테스트
    자체의 유효성에도 영향이 없다 — 근거 문서(§실측 검증, §TEST 결과)의 수치 정확성 문제다.
  - 제안: "duplicate describe 16건(기존 14 + 신규 2), 스펙 전체 80/80"으로 정정. 이 PR의 §INFO#3이 이미
    "mutation 실측 수치 오기"를 재현·정정한 사례이므로, 같은 문서에 남아있는 유사한 성격의 수치 오기(이번엔
    테스트 개수)도 함께 바로잡는 편이 "근거로 남긴다"는 이 PR의 취지에 부합한다.

- **[INFO]** `POST /:id/duplicate` 컨트롤러 wiring 테스트 부재 (기존 갭 재확인 — 이전 라운드 INFO#5와 동일,
  이번 diff 책임 아님)
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.spec.ts`(전체 — `describe(` 6개 블록
    중 `duplicate` 없음, 직접 grep으로 재확인)
  - 상세: 이전 리뷰 라운드(`review/code/2026/07/31/18_00_00/testing.md` INFO 항목, plan §3 #5)에서 이미
    지적되고 "이번 diff는 Swagger만 건드렸고 동작 변경 없음(byte-identical 확인)"이라는 근거로 비조치 종결된
    항목이다. Swagger description의 byte-identical 여부도 Node 스크립트로 직접 재검증했다(원본 237자 단일
    문자열 === 배열+join(' ') 결과, `true`) — 회귀 테스트가 필요 없다는 결론은 유효하다.
  - 제안: 조치 불필요(이미 근거 문서화됨). 향후 `duplicate()` 컨트롤러를 다시 손볼 때 최소 wiring 테스트
    (id/workspaceId/user.sub 전달 확인) 추가를 검토.

## 확인된 항목 (문제 없음)

- `edge.condition` 얕은 복사 수정(핵심 동작 변경)은 값·참조·**null 분기** 3축을 모두 단언하는 전용 테스트로
  뒷받침되며, 3종 mutation(조건 전체 제거, 삼항 false 분기 → `undefined`, 가드 변수 교체) 전부 직접 재현해
  RED 확인 → 원복 후 GREEN, non-vacuous임을 실증했다.
- `nodeEntities`/`edgeEntities` → `nodeRows`/`edgeRows` 리네이밍: `grep -rn "nodeEntities\|edgeEntities"
  codebase/` 전역 재검색 0건 — 잔존 참조 없이 완전히 치환됐다(회귀 위험 없음).
- `workflows.controller.spec.ts` 19/19, `workflows.service.spec.ts` 80/80 전체 재실행 — 모두 GREEN, 회귀 없음
  (단, 후자의 "80"은 문서에 적힌 "81"과 다르며 위 INFO 항목 참조).
- 신규 테스트 2건 모두 독립적으로 실행 가능(각자 `mockTransactionManager.find`를 자신의 테스트 본문에서
  재대입하며, describe 레벨 `beforeEach`가 매 테스트 전 초기화하는 기존 패턴을 그대로 따름) — 테스트 간
  의존성 없음.

## 요약

이번 diff의 실제 동작 변경(`edge.condition` 얕은 복사 누락 수정)은 신규 테스트 2건으로 견고하게 뒷받침되며,
직접 3종 mutation(가드 제거·삼항 null 분기·가드 변수 교체)을 적용/원복해 재현한 결과 모두 non-vacuous함을
확인했다 — 다만 "가드 제거" 클래스는 실은 기존 "빈 캔버스" 테스트가 이미 잡고 있었고, 신규 테스트가 고유하게
잡는 것은 "가드 변수 교체" 클래스임을 실측으로 밝혀냈다. 이 차이로 인해 신규 테스트의 존재 근거로 서술된
주석/plan 문서 문구가 부정확하다는 점, 그리고 plan/RESOLUTION 문서의 "duplicate describe 22건/스펙 81/81"
claim이 실측(16건/80/80)과 다르다는 점을 발견했다 — 둘 다 실제 코드나 테스트의 결함이 아니라 근거 문서의
서술 정확성 문제이며, 특히 후자는 이 PR이 바로 앞 절(§INFO#3)에서 정정한 것과 같은 유형(mutation/테스트
수치 claim이 재현값과 불일치)의 오차가 같은 문서 안에서 재발한 사례라 기록해 둘 가치가 있다. 리네이밍
전역 완결성(grep 0건)과 Swagger description byte-identical 여부도 직접 재검증해 문제없음을 확인했고,
`duplicate()` 컨트롤러 wiring 테스트 부재는 이전 라운드에서 이미 근거와 함께 종결된 기존 갭으로 이번 diff의
책임이 아니다. 종합하면 테스트 커버리지 자체는 견고하고 회귀도 없으나, 근거 문서(plan/RESOLUTION)의 수치
정확성에는 개선 여지가 있다.

## 위험도

LOW
