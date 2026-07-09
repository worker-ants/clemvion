# 유지보수성(Maintainability) 리뷰 결과

검토 대상 18개 파일 중 실질적인 애플리케이션 코드는 `codebase/frontend/src/lib/workspace/{href.ts,resolve-fallback.ts}`(신규/수정),
`codebase/frontend/src/app/(main)/[...rest]/page.tsx`·`(main)/w/[slug]/layout.tsx`(리팩터 소비처), 그리고 신규/보강된 테스트 5종이다.
나머지(`review/code/2026/07/08/18_24_41/**` 산출물 9개)는 직전 라운드의 리뷰 산출물(SUMMARY/RESOLUTION/개별 reviewer md/meta.json/retry-state)이 이번
커밋에 함께 커밋된 것으로, 유지보수성 관점에서 코드 품질을 논할 대상이 아니다(문서 산출물 그대로 보존).

이번 커밋은 직전 라운드 WARNING 4건(테스트 커버리지 2건 + architecture DRY 1건 + security open-redirect 1건)에 대한 조치이며, 전반적으로
유지보수성을 개선하는 방향(중복 제거, 순수 함수 추출, 테스트 보강)이다. 새로 도입된 이슈는 없고, 아래는 이번 diff 범위 내에서 발견한 경미한 잔여 사항이다.

## 발견사항

- **[INFO]** `resolveFallbackWorkspace` 네이밍이 실제 두 소비처의 의미를 완전히 포괄하지 못함
  - 위치: `codebase/frontend/src/lib/workspace/resolve-fallback.ts`; 소비처 `codebase/frontend/src/app/(main)/[...rest]/page.tsx:100`, `codebase/frontend/src/app/(main)/w/[slug]/layout.tsx:228`
  - 상세: 함수 본질은 "활성 워크스페이스, 없으면 첫 워크스페이스"(active-or-first) 해소다. `layout.tsx` 에서는 실제로 "무효/비멤버 slug 폴백" 문맥이라 이름이 자연스럽지만, `[...rest]/page.tsx` 의 catch-all 에서는 slug 자체가 없는 경로라 "폴백"이 아니라 "현재 활성 워크스페이스를 구하는" 주 용도로 쓰인다. JSDoc 이 두 용도를 명시하므로 오독 위험은 낮지만, 이름만 보면 catch-all 쪽 호출 의도가 즉시 와닿지 않는다.
  - 제안: 현재로도 문제 없음(JSDoc 이 이미 설명). 향후 세 번째 소비처가 생기면 `resolveActiveOrFirstWorkspace` 같은 중립적 이름을 고려.

- **[INFO]** `buildWorkspaceHref` 의 `String(path)` 캐스팅이 타입 시그니처와 불일치하는 방어 코드
  - 위치: `codebase/frontend/src/lib/workspace/href.ts:953` — `` const clean = `/${String(path).replace(/^\/+/, "")}`; ``
  - 상세: 함수 시그니처가 `path: string` 이라 컴파일 타임에 항상 문자열임이 보장된다. `String(path)` 는 실질적으로 no-op 이며, 런타임에 타입을 벗어난 값(any 캐스트 경유 호출 등)을 가정한 방어처럼 보여 읽는 사람이 "path 가 string 이 아닐 수 있나?"라는 불필요한 의문을 갖게 한다. 직전 라운드에 지적된 `use-workspace-slug.ts` 의 `params &&` 도달불가 가드와 같은 계열의 사소한 인지 부하다.
  - 제안: `path.replace(/^\/+/, "")` 로 단순화하거나, 방어 목적이 있다면(예: 호출부가 아직 `any` 를 쓰는 레거시 지점이 있어서) 주석으로 근거를 남길 것.

- **[INFO]** cafe24/makeshop pending-polling 테스트 파일 간 신규 테스트 삽입 위치 불일치
  - 위치: `use-cafe24-pending-polling.test.tsx` — "routes to the slug-prefixed detail path" 케이스가 "transitions on connected" **다음**, "surfaces lastError.message" **이전**에 삽입; `use-makeshop-pending-polling.test.tsx` — 동일 케이스가 "transitions on connected" **이전**에 삽입.
  - 상세: 두 파일은 프로젝트 컨벤션상 의도적으로 대칭 미러 구조를 유지한다(cafe24/makeshop 중복은 기존 결정으로 유지 확정됨). 그런데 이번에 추가된 테스트의 상대적 위치가 두 파일에서 서로 달라, 두 파일을 나란히 diff 비교하거나 향후 세 번째 케이스를 대칭으로 추가할 때 순서 기준점이 흔들린다. 기능적 결함은 아니고 순수 가독성/일관성 사안.
  - 제안: 우선순위 낮음 — 다음에 두 파일을 함께 건드릴 기회에 테스트 순서를 맞춰도 무방.

- **[INFO]** `use-workspaces.test.tsx` 의 mock 선언 스타일이 인접 파일(`use-cafe24/makeshop-pending-polling.test.tsx`)의 `vi.hoisted()` 패턴과 다름
  - 위치: `codebase/frontend/src/lib/workspace/__tests__/use-workspaces.test.tsx:5-15` (module-scope `const listMock = vi.fn()` + `vi.mock(...)` 직접 참조, `vi.hoisted` 미사용)
  - 상세: 동작은 정상(참조가 클로저 내부에 있어 TDZ 문제 없음)이지만, 같은 폴더 계열의 다른 신규 테스트들이 `vi.hoisted(() => ({...}))` 로 mock 변수를 명시적으로 호이스팅하는 것과 스타일이 갈린다. 두 패턴이 혼재하면 다음에 테스트를 복사-수정할 때 어느 쪽을 표준으로 따라야 할지 판단 비용이 생긴다.
  - 제안: 우선순위 낮음 — 여유 있을 때 `vi.hoisted` 패턴으로 통일 검토.

## 정상 확인된 항목

- `resolveFallbackWorkspace()` 추출은 `layout.tsx`/`[...rest]/page.tsx` 의 동일 표현식 중복을 정확히 제거했고, 함수 자체는 10줄 내외 단일 책임·조건 분기 없이 `??` 체인만 사용해 순환 복잡도가 사실상 1이다. 전용 단위테스트 4건(활성 매치/첫 워크스페이스 폴백/알 수 없는 id/빈 배열)이 경계값을 빠짐없이 커버한다.
- `buildWorkspaceHref` 의 선두 슬래시 정규화는 정규식 하나로 목적을 명확히 달성하고, 주석이 "왜"(open-redirect 방어)와 "무엇"(`//evil.com` → `/evil.com`)을 모두 설명해 가독성이 좋다.
- `use-workspaces.test.tsx`/`use-cafe24-pending-polling.test.tsx`/`use-makeshop-pending-polling.test.tsx`/`href.test.ts`/`resolve-fallback.test.ts` 신규·보강 테스트는 각각 한 가지 동작만 단언하는 단일 목적 테스트로 작성되어 있고, 이름이 검증 대상을 정확히 서술한다(예: "routes to the slug-prefixed detail path when a workspace is active").
- 중첩 깊이·매직 넘버 문제 없음. `layout.tsx`/`page.tsx` 는 여러 `useEffect` 로 관심사(reconcile / 멤버십 폴백 / gate)가 분리되어 있어 각 블록이 짧고 평평하다.
- 리뷰 산출물 파일(`review/code/2026/07/08/18_24_41/**`)은 문서 성격이라 유지보수성 관점 코드 이슈 대상 아님 — 별도 언급 불요.

## 요약

이번 diff 는 직전 ai-review WARNING 4건 중 architecture(DRY)·security(open-redirect)·testing 2건을 정확히 겨냥한 조치 커밋으로, 유지보수성을 실질적으로
개선한다: 중복 폴백 로직을 순수 함수로 뽑아 단일 진실점을 만들고, 각 변경마다 대응 단위테스트를 동반해 회귀 방지력을 높였다. 새로 발견된 문제는 전부 INFO
수준(네이밍이 다목적 함수를 완전히 담아내지 못하는 점, 불필요한 `String()` 캐스팅, 미러 테스트 파일 간 삽입 순서 불일치, mock 스타일 혼재)이며 즉시 조치가
필요한 사항은 없다. 함수 길이·중첩 깊이·매직 넘버·순환 복잡도 어느 항목에서도 문제가 관찰되지 않았고, 문서화(JSDoc)가 전반적으로 우수하다.

## 위험도

LOW
