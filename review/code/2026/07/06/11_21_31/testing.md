# 테스트 리뷰 — 워크플로우 목록 단일 태그 필터

대상: `codebase/frontend/src/app/(main)/workflows/__tests__/workflows-page.test.tsx`
신규 `describe("WorkflowsPage — tag filter (NAV §2.3)")`(4 테스트) + `codebase/frontend/src/app/(main)/workflows/page.tsx` 구현.

검증 방법: 정적 리뷰 + mutation testing(구현을 임시로 훼손해 해당 assertion 이 실제로 fail 하는지 확인 후 원복). 전체 23개 테스트, 단독 필터 실행(`-t "tag filter"`, 4/23) 모두 통과 재확인함.

## 발견사항

- **[WARNING]** "sends ?tag=... on the first page" 테스트의 `page="1"` 단언은 vacuous — page-reset 로직을 지워도 그린이 유지된다
  - 위치: `codebase/frontend/src/app/(main)/workflows/__tests__/workflows-page.test.tsx:730` (`expect(String(lastParams?.page)).toBe("1")`), 대응 구현 `codebase/frontend/src/app/(main)/workflows/page.tsx:144` (`setPageRef.current(1)`, tag debounce effect 내부)
  - 상세: `next/navigation` mock 의 `useSearchParams`는 파일 상단(`workflows-page.test.tsx:12,16`)에서 모듈 레벨 `currentSearchParams`(매 `beforeEach`에서 새 빈 `URLSearchParams`)를 반환하는 non-reactive 값이다. `usePageParam`(`use-page-param.ts:27`)의 `page`는 `parsePage(searchParams.get("page"))`로만 계산되고, `setPage`가 호출하는 `router.replace`는 mock(`mockReplace = vi.fn()`)이라 `currentSearchParams`를 갱신하지 않는다. 따라서 이 테스트 컨텍스트에서 `page`는 **debounce effect 의 `setPageRef.current(1)` 호출 여부와 무관하게 항상 `"1"`**이다. 실제로 `setPageRef.current(1)` 호출을 제거해도 23/23 테스트가 그대로 통과함을 확인했다(mutation testing). 즉 이 assertion 은 "page 리셋 회귀"를 전혀 탐지하지 못한다.
  - 참고: 바로 앞의 folder filter describe (`workflows-page.test.tsx:577-580`)는 동일한 구조적 한계를 인지하고 `// This mock's searchParams is static, so we assert the emitted page param rather than a live 2→1 transition.` 주석을 명시적으로 남겼다. 신규 tag filter 테스트는 이 배경 설명이 빠진 채 `// The 300ms debounce fires within waitFor's window.`라는, 이 assertion 의 실제 한계와 무관한 주석만 달려 있어 리뷰어/유지보수자가 "page=1 이 실제 검증됐다"고 오인할 소지가 있다.
  - 제안: folder filter 케이스와 동일한 주석("static searchParams mock 이므로 emitted param 만 검증하며 live page 전환은 검증하지 않는다")을 추가하거나, `setPageRef.current` 호출 자체를 스파이해 `toHaveBeenCalledWith(1)`로 직접 단언해 실질적 회귀 탐지력을 확보할 것. 최소한 오해를 부르는 주석은 수정 필요.

- **[INFO]** "treats a typed tag as an active filter and clears it on reset" 는 비-vacuous — 실검증됨
  - 위치: `workflows-page.test.tsx:678-777`, `hasActiveFilters` 정의 `page.tsx:384` (`!!debouncedTag ||`)
  - 상세: `hasActiveFilters`에서 `!!debouncedTag ||` 항을 제거하는 mutation 을 가했더니 이 테스트가 정확히 `findByRole("button", { name: /Reset Filters/i })` 단계에서 fail(23개 중 1개 실패, 나머지 22개는 그대로 통과)했다. 즉 이 테스트는 실제로 `debouncedTag`가 `hasActiveFilters`에 반영되는지를 유효하게 커버한다. 결함 아님, 확인 사항으로 기록.

- **[INFO]** `tag` 파라미터 값 자체의 전달 정확성은 실검증됨
  - 위치: `workflows-page.test.tsx:724` (`expect(lastParams?.tag).toBe("sales")`), 구현 `page.tsx:208` (`if (debouncedTag) params.tag = debouncedTag;`)
  - 상세: `params.tag = debouncedTag`를 `params.tag = "WRONG_" + debouncedTag`로 변형한 mutation 이 해당 assertion 을 정확히 실패시켰다. `tag` 값 단언은 vacuous 하지 않다.

- **[WARNING]** 공백-only 입력(whitespace-only tag)에 대한 커버리지 갭 — 트리밍 부재
  - 위치: `page.tsx:96,208`(구현에 `.trim()` 없음), 테스트 파일 전체(해당 케이스 테스트 없음)
  - 상세: `tagFilter`/`debouncedTag`는 어떤 트리밍도 거치지 않는다. 사용자가 스페이스만 입력(`"   "`)하면 `!!debouncedTag`가 truthy 이므로 `hasActiveFilters=true`가 되고 서버로 `?tag=%20%20%20`이 그대로 송신된다. spec(`spec/2-navigation/1-workflow-list.md` §2.3, "빈 값이면 미송신")은 "빈 문자열"만 명시하고 공백-only 취급은 문면상 불명확하지만, 실사용 시 사용자가 실수로 스페이스만 입력한 뒤 지우지 않으면 "필터 활성" UI(Reset Filters CTA)가 계속 뜨는 등 UX 상 의아한 상태가 될 수 있다. 이 경계값에 대한 테스트가 전혀 없어, 향후 트리밍을 추가하거나 반대로 의도적으로 안 하기로 결정하더라도 회귀를 잡을 안전망이 없다.
  - 제안: 최소 하나의 테스트로 현재 동작(트리밍 없음 → 공백도 활성 필터로 취급/송신됨)을 명시적으로 고정하거나, 트리밍을 구현에 추가하고 그에 맞는 테스트를 추가할 것. 어느 쪽이든 현재는 미정의 동작으로 남아있다.

- **[INFO]** "renders the tag filter input" 테스트는 존재 확인(smoke)에 그침
  - 위치: `workflows-page.test.tsx:687-696`
  - 상세: `data-testid="workflow-tag-filter"`가 DOM 에 존재하는지만 확인. placeholder/aria-label i18n 키(`workflows.tagFilter.aria`, `.placeholder`) 검증이나 폴더 필터처럼 `folders.length > 0` 조건부 노출과 달리 태그 필터는 항상 노출되는지에 대한 명시적 커버리지는 없음(구현상 조건 없이 항상 렌더링되므로 로직 갭은 아니나, 회귀 방지 관점에서 "always visible" 이라는 의도를 assert 하는 테스트는 없음). 크리티컬하지 않음.

- **[INFO]** 테스트 격리 양호
  - 위치: `workflows-page.test.tsx:679-686` (`beforeEach`: `vi.clearAllMocks()`, `currentSearchParams` 재생성, 스토어 리셋, `cleanup()`), `afterEach`: `cleanup()`
  - 상세: 폴더 필터 describe 와 동일한 격리 패턴을 그대로 재사용. `-t "tag filter"` 단독 실행(4/23)과 전체 실행(23/23) 모두 통과 확인 — describe 간 숨은 의존성 없음.

## 요약

신규 4개 테스트 중 태그 활성 필터 반영(`hasActiveFilters`)과 전송 `tag` 값의 정확성은 mutation testing 으로 실검증을 확인했고, 격리도 기존 폴더 필터 describe 패턴을 그대로 따라 양호하다. 다만 "sends ?tag=... on the first page" 테스트의 `page="1"` 단언은 `next/navigation` mock 의 non-reactive 한계로 인해 실질적으로 vacuous 하며(page-reset 로직을 제거해도 그린 유지, mutation 으로 확인), 바로 위 folder filter 테스트가 남긴 정직한 한계 주석이 이번 테스트에는 빠져 있어 오해를 유발할 수 있다. 또한 공백-only 입력 시 트리밍 부재로 인한 동작(활성 필터로 취급 + 그대로 서버 송신)에 대한 테스트가 없어 향후 회귀를 잡을 안전망이 부족하다. 두 항목 모두 기능 자체의 정합성보다는 테스트의 신뢰도·커버리지 문제이며, 즉각적인 프로덕션 결함으로 이어지진 않는다.

## 위험도

LOW
