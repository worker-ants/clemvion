# 문서화(Documentation) Review — 2라운드 (`14_11_34`)

대상: `bafa7c007`(직전 라운드 Critical 0 / Warning 6 전부 처분) 이후 상태. 지시대로
`review/code/2026/08/11/13_51_44/{documentation.md,RESOLUTION.md}` 를 먼저 읽고, 그 라운드가
"정정했다"고 주장한 숫자들이 **지금 트리 기준으로도** 맞는지 전부 재실측했다. 오래된 사고
패턴("정정문이 또 틀린다")을 세 번째로 반복하지 않았는지가 이번 라운드의 핵심 점검이었다.

## 실측 재검증

| # | 확인 대상 | 방법 | 결과 |
|---|---|---|---|
| 1 | "2075 → 2077" (현재 트리 기준) | `CODEBASE_SOURCE_ROOTS`+`CODEBASE_SKIP_DIRS` 그대로 Node 스크립트로 전수 재순회 | **2077개** — 정확히 일치. `bafa7c007` 은 파일을 추가/삭제하지 않았으므로(전부 `M`, plan 은 `R090`) 이 라운드에서도 값이 그대로 유지된다 |
| 2 | "통과 247개(11.9%)" (`spec-links.ts:94`) | 같은 2077개 파일에 `!text.includes("](") && !text.includes("]\`")` 역조건 적용 | `"]("` **35개(1.7%)**, 합집합(필터 통과) **247개(11.89%)** — JSDoc 의 "247개(11.9%)" 와 정확히 일치. 직전 라운드가 지적한 "246/211/11.8%" 오차는 이 라운드에서 해소됨 |
| 3 | `plan-scan.ts` 헤더 갱신문 | `Read` 로 직접 대조 | "**2026-08-11 후속**: ... 저장소의 손수 짠 DFS 는 **여섯 벌**이었다(당시엔 넷으로 셌다 — spec/codebase 트리를 보는 것들을 세는 범위 밖에 뒀기 때문이다)." — 지시받은 정정 취지와 정확히 일치 |
| 4 | `impl-anchor-parse.ts`/`tree-walk.test.ts` 축약 주석의 SoT 참조 | `tree-walk.ts` 헤더(1-12행) 직접 대조 | 두 파일 모두 "`tree-walk.ts` 헤더가 SoT" 라고 가리키고, 그 헤더는 실제로 "`plan-scan.ts` 는 `_` 접두를 파일명에, `impl-anchor-parse.ts` 는 디렉터리명에 적용한다"는 문장을 담고 있음 — 포인터가 가리키는 대상이 실재하고 정확함 |
| 5 | 완료 plan 서술 vs 실제 상태 | `plan/complete/docs-guard-walker-dedup.md` 전문 + `git diff bf0dfc98c bafa7c007` | 대부분 일치(아래 WARNING 1건 제외). `docs 가드 2892 passed` 는 `pnpm exec vitest run src/lib/docs/__tests__` 직접 재실행으로 **2892 passed (20 test files)** 확인 |
| 6 | `spec_impact` 선언 vs 실제 diff | `git show bafa7c007 -- spec/conventions/spec-impl-evidence.md` | `code:` 목록에 `tree-walk.ts`/`tree-walk.test.ts` 실제 추가됨. `spec_impact: [spec/conventions/spec-impl-evidence.md]` 와 정확히 일치 |
| 7 | `SpecMdFile` 잔존 여부 | `grep -rn "SpecMdFile" codebase/` | 텍스트 설명(주석) 3곳만 남고 타입 참조는 0건. `findBrokenLinksInFiles` 파라미터도 `MdFileRef[]` 로 갱신돼 직전 라운드의 자기모순 INFO 도 함께 해소됨 |
| 8 | `harness-env-value-subpattern-dedup.md` 상대링크 정정 | 파일 존재 + 경로 재계산 | `../complete/docs-guard-walker-dedup.md` → `plan/complete/docs-guard-walker-dedup.md` 로 정확히 해석되고 그 파일이 실재함 |

## 발견사항

- **[WARNING]** 완료 plan 의 "### plan 이 제안한 최적화 조건이 건전하지 않았다" 절이 이번 fix
  가 코드에 반영한 **바로 그 숫자**(11.8% → 11.9%)를 반영하지 않은 채 옛 값으로 남아 있다.
  - 위치: `plan/complete/docs-guard-walker-dedup.md:197`
    (`가드에서 **영영 빠진다**. 필요조건을 둘로 잡아 거짓 음성을 없앴고(통과 11.8%, 여전히 88%`)
  - 상세: `bafa7c007` 커밋 메시지·`spec-links.ts:94` JSDoc 은 정확히 "사전 필터 JSDoc 수치도
    같은 이유로 밀려 있었고, 이번엔 모든 편집을 끝낸 뒤 다시 재서 넣었다(통과 247개 =
    11.9%)"라고 밝히며 그 자리를 명시적으로 고쳤다. 그런데 같은 사실(필터 통과율)을 서술하는
    plan 문서의 이 문장은 `git diff bf0dfc98c bafa7c007 -- plan/complete/docs-guard-walker-dedup.md`
    로 확인하면 **이 라운드의 diff 가 건드리지 않은 줄**이라, `bf0dfc98c` 시점(즉 직전 리뷰가
    지적하기 **전**)의 "11.8%" 가 그대로 남았다. 코드가 옳고(247개/11.9%, 직접 재현으로 확인)
    이 plan 문장만 이제 stale 하다 — 정확히 이 PR 이름 자체("문서 가드의 디렉터리 순회 walker
    통합")가 경계하는 "자매 문장이 안 고쳐지는 형태"를, **바로 그 자매 문장을 고친 커밋 안에서**
    또 하나 만들었다. 동작에는 영향 없음(코드 값이 맞고 plan 은 서술일 뿐).
  - 제안: `plan/complete/docs-guard-walker-dedup.md:197` 의 "통과 11.8%" 를 "통과 11.9%"(또는
    "247개, 11.9%")로 정정. 완료 plan 은 보통 재수정 대상이 아니지만, 이 파일 자체가 "정정
    이력"을 여러 번 남긴 문서이므로 다음에 이 문서를 손댈 일이 생기면 각주로 정정해도 무방하다.
    CRITICAL 로 올릴 사안은 아니다.

- **[없음/참]** 직전 라운드가 처분(`bafa7c007`)했다고 주장한 항목들을 재현했다:
  - "2075 → 2077"(현재 트리 기준 그대로 유지, 코드/plan 서술 모두 `2077` — 이 라운드가 파일을
    추가/삭제하지 않아 변할 이유가 없었고 실제로 안 변했다).
  - `spec-links.ts:94` 의 "통과 247개(11.9%)" — 현재 트리로 정확히 재현됨(직전 라운드가
    "±1건 오차"로 지적했던 것이 이번엔 정확히 닫혔다).
  - `plan-scan.ts` 헤더의 "당시엔 넷으로 셌다" 갱신문 — 지시받은 문구와 의미상 정확히 일치.
  - `impl-anchor-parse.ts`/`tree-walk.test.ts` 의 축약 주석이 가리키는 `tree-walk.ts` 헤더가
    실제로 그 내용을 담고 있음(포인터가 허공을 가리키지 않는다).
  - `SpecMdFile` `@deprecated` 자기모순(직전 라운드 INFO) — 별칭 완전 삭제 + 유일한 내부
    사용처(`findBrokenLinksInFiles`)도 `MdFileRef` 로 전환돼 근본 해소.
  - `docs 가드 2892 passed` — 직접 재실행(`vitest run src/lib/docs/__tests__`)으로 확인.
  - 이 항목들은 "정정문이 세 번째로 또 틀렸는지" 를 겨눈 이번 라운드의 핵심 의심이었는데,
    위 WARNING 1건을 제외하면 전부 참으로 재확인됐다.

새로 발견된 CRITICAL 은 없다.

## 요약

직전 라운드가 fix 커밋(`bafa7c007`)에서 정정했다고 주장한 숫자·서술을 전부 현재 트리 기준으로
재실측했고, 핵심 두 숫자(파일 수 2077, 필터 통과율 247개/11.9%)와 `plan-scan.ts` 헤더 갱신문·
`impl-anchor-parse.ts`/`tree-walk.test.ts` 의 SoT 포인터·`spec_impact` 선언·테스트 통과 수
(2892)는 모두 정확했다 — "정정문이 또 틀렸다"는 세 번째 반복은 이번 라운드에서는 일어나지
않았다. 다만 같은 fix 커밋이 코드 주석(`spec-links.ts:94`)의 필터 통과율을 11.8%→11.9%로
정확히 고치면서도, 완료 plan 문서 안의 같은 사실을 서술한 다른 한 문장(`:197`)은 옛 값(11.8%)
그대로 남겨 뒀다 — 이 PR 이 이름 그대로 경계해 온 "자매 문장 drift" 를 그 문장을 고치는 커밋
안에서 소규모로 재생산한 형태다. 동작 영향은 없고 WARNING 이면 충분하다.

## 위험도

LOW

STATUS: OK
