# 테스트 리뷰 (Fresh, resolution 후 재검토) — 워크플로우 목록 단일 태그 필터

대상: `git diff origin/main...HEAD`(2 commits: `2d0eb622c` feat, `beedb9905` test)
직전 리뷰: `review/code/2026/07/06/11_21_31/testing.md` WARNING 2건에 대한 fix 검증.
파일: `codebase/frontend/src/app/(main)/workflows/__tests__/workflows-page.test.tsx`,
`codebase/frontend/src/app/(main)/workflows/page.tsx`

검증 방법: 정적 리뷰 + mutation testing(실제 실행).
- `page.tsx`의 `if (debouncedTag) params.tag = debouncedTag;` 를
  `if (debouncedTag.trim()) params.tag = debouncedTag.trim();` 로 임시 변경 → 전체
  스위트 재실행 → 신규 whitespace 테스트(`currently sends a whitespace-only tag as-is`)만
  단독 실패(`expected undefined to be '   '`), 나머지 23건 그대로 통과 확인 → 즉시 원복
  (`git diff --stat` 로 원본과 동일함 재확인).
- 원복 후 전체 재실행 24/24 통과 재확인.

## W1 재검증 — page="1" 단언 주석

- 위치: `workflows-page.test.tsx:730-734`
- 신규 tag 테스트에 folder 테스트(`:578-580`)와 동일 취지의 한계 고지 주석이 추가됨:
  "Documents the emitted first-page param. Like the folder-filter test, this mock's
  searchParams is static (router.replace is a no-op), so page stays 1 regardless of
  setPage — this asserts the emitted value, not a live 2→1 reset transition."
- folder 테스트 주석("This mock's searchParams is static, so we assert the emitted page
  param rather than a live 2→1 transition.")과 취지·문구 구조가 사실상 동일 — 오해
  소지(이 단언이 실질적 page-reset 회귀를 잡는다는 착각)는 해소됨. **WARNING 1 해소 확인.**

- **[INFO]** 주석 말미의 `See use-page-param mock note above` 참조가 실제로는 가리키는
  대상이 파일 내에 없음
  - 위치: `workflows-page.test.tsx:733`
  - 상세: 파일을 전수 검색한 결과(`grep -n "use-page-param"`) 이 문구가 나타나는 곳은
    이 줄 자체뿐이다. `next/navigation` mock 자체는 파일 최상단(`:9-16`,
    `currentSearchParams`/`mockReplace`)에 있지만 그 mock 을 "note" 형태로 설명하는
    별도 주석 블록은 존재하지 않는다(folder 테스트의 대응 주석에도 이런 역참조는 없음).
    기능·회귀탐지력에는 영향 없는 순수 문서 정확성 이슈이며, 다음 리뷰어가 "above" 를
    찾다가 못 찾는 사소한 혼선을 유발할 수 있다.
  - 제안: 필수 아님. `See use-page-param mock note above` 구절을 삭제하거나, 실제로
    `use-page-param.ts` mock 설명 주석을 파일 상단에 추가하고 참조를 그쪽으로 정정.

## W2 재검증 — 공백-only 입력 테스트

- 위치: `workflows-page.test.tsx:753-779`, 대응 구현 `page.tsx:207-210`
- `page.tsx`에 no-trim 을 의도로 확정하는 근거 주석 추가됨("검색 필터와 동일하게 trim
  하지 않는다 — 공백-only 입력은 서버 `= ANY(tags)` 에서 안전하게 0건으로 수렴하며, 두
  텍스트 필터의 동작을 일관되게 유지한다").
- 신규 테스트 `currently sends a whitespace-only tag as-is (no trimming, matching the
  search filter)`:
  - `"   "` 타이핑 → `lastParams.tag === "   "` 단언 + Reset CTA 노출 단언.
  - **실제 mutation testing 으로 비-vacuous 확인**: `debouncedTag` 송신부에 `.trim()`
    을 추가하자 이 테스트만 정확히 `expected undefined to be '   '` 로 실패, 나머지
    23건은 영향 없음 — 이 테스트가 실제로 trim 회귀(공백 입력 시 미송신으로 바뀌는
    변경)를 단독으로 잡아낸다는 것을 실증했다. **WARNING 2 해소 확인 — vacuous 아님.**
  - Reset CTA 단언(`findByRole("button", { name: /Reset Filters/i })`)도 `hasActiveFilters`
    의 `!!debouncedTag` 항이 공백 문자열에 대해 truthy 로 평가되는 경로를 함께 검증한다
    (직전 리뷰에서 이미 별도 mutation 으로 `!!debouncedTag ||` 제거 시 유사 reset-CTA
    테스트가 실패함을 확인한 바 있음 — 동일 메커니즘이 이 테스트에도 적용된다).

## 회귀 확인

- 전체 24개 테스트(기존 23 + 신규 whitespace 1) 통과 재확인(`vitest run
  "src/app/(main)/workflows/__tests__/workflows-page.test.tsx"`).
- 기존 folder-filter/search 관련 describe 블록은 diff 에 나타나지 않음(append-only) —
  회귀 없음.

## 요약

직전 리뷰의 testing WARNING 2건이 모두 실질적으로 해소되었다. W1은 folder 테스트와
동일한 정직한 한계 고지 주석이 추가되어 "page=1 단언이 static mock 하에서 emitted
value 만 검증하며 live page-reset 전환은 검증하지 않는다"는 사실이 명확히 드러난다.
W2는 no-trim 을 의도로 확정하는 page.tsx 주석과 함께 신규 whitespace 테스트가
추가되었고, 실제 mutation testing(`.trim()` 삽입 후 재실행)으로 이 테스트가 vacuous 가
아니라 실제로 trim 회귀를 단독으로 탐지함을 실증했다(원복 완료, `git diff --stat` 로
원본과 동일함 확인). 유일하게 남은 것은 신규 페이지 참조 주석의 dangling
`See ... note above` 문구 하나로, 기능에는 영향이 없는 INFO 수준의 문서 정확성
사항이다. Critical/Warning 없음.

## 위험도

NONE
