# 유지보수성(Maintainability) Review

## 리뷰 대상
- `codebase/frontend/src/app/(main)/w/[slug]/integrations/[id]/__tests__/usage-node-list.test.tsx` (신규)
- `codebase/frontend/src/app/(main)/w/[slug]/triggers/__tests__/triggers-page.test.tsx` (테스트 1개 추가)
- `codebase/frontend/src/components/triggers/cards/__tests__/overview-card.test.tsx` (신규)

테스트 전용 diff(production 코드 무변경). `buildEditorHref`/`useWorkspaceSlug` 콜사이트에 대한 회귀 가드 3건 추가.

## 발견사항

- **[INFO]** `next/navigation` mock + SoT 설명 주석의 소규모 중복
  - 위치: `usage-node-list.test.tsx:53-56` / `overview-card.test.tsx:574-577` (diff 기준 라인)
  - 상세: `// URL slug 이 SoT — useWorkspaceSlug 이 params.slug 를 우선 반환한다.` 주석과 `vi.mock("next/navigation", () => ({ useParams: () => ({ slug: "team-x" }) }))` 블록이 두 파일에 토씨 하나 다르지 않게 반복된다. vitest 의 `vi.mock` 은 파일 스코프 hoist 라 완전한 공용화는 어렵지만, 문서 주석까지 동일하게 복붙된 점은 향후 문구 수정 시 한쪽만 갱신되는 drift 위험을 만든다.
  - 제안: 현재 2곳뿐이라 즉시 조치는 불요. 3번째 콜사이트가 같은 패턴을 필요로 하면 `test-utils` 에 `mockWorkspaceSlugParam(slug)` 같은 헬퍼(factory 함수 반환, 호출부에서 `vi.mock` 팩토리에 위임)로 추출 고려.

- **[INFO]** `closest("a")` 를 이용한 href 단언 패턴 반복
  - 위치: `usage-node-list.test.tsx` (2회), `overview-card.test.tsx` (1회), 세 파일 통틀어 유사 패턴 3회
  - 상세: `screen.getByText(...).closest("a")` → `toHaveAttribute("href", ...)` 형태가 파일마다 개별 구현되어 있다. 각 사용처가 2~3줄 수준으로 짧아 지금 당장 가독성을 해치진 않지만, 향후 콜사이트가 늘어날 경우(에디터 slug 화 후속 회귀 가드가 이미 여러 건 이어지는 추세) 공용 단언 헬퍼(`expectLinkHref(text, href)`) 로 정리할 여지가 있다.
  - 제안: 즉시 리팩터 불필요. 4번째 유사 테스트가 추가되는 시점에 헬퍼 추출을 재고.

- **[INFO]** 신규 테스트의 describe 블록 배치가 RBAC 관점과 다소 어긋남
  - 위치: `triggers-page.test.tsx:161-168` (신규 `it`), `describe("TriggersPage — RBAC", ...)` 내부
  - 상세: 추가된 "workflow 이름이 slug 경로 에디터 링크로 렌더된다" 테스트는 role 별 분기 검증이 아니라 slug 프리픽스 렌더링을 검증하는 것으로, 같은 블록의 다른 테스트들(Editor/Viewer 권한별 UI 노출)과 관점이 다르다. 다만 `setRole`/`mockTriggersResponse` 헬퍼를 그대로 재사용하기 위해 기존 블록에 넣은 것으로 보이며, 파일 전체 구조(RBAC/pagination/auth column/deep-link 로 이미 관점별 describe 분리)를 고려하면 별도 `describe("TriggersPage — editor link (phase 2)", ...)` 로 분리했을 때 테스트 의도가 더 명확해진다.
  - 제안: 기능상 문제는 없음. 향후 유사 콜사이트 테스트가 이 파일에 더 추가된다면 별도 describe 로 분리 권장.

## 요약
세 파일 모두 테스트 전용 변경으로, 함수 길이·중첩 깊이·순환 복잡도 측면에서 우려할 부분이 없고, describe/it 네이밍이 기존 코드베이스 컨벤션(한국어 설명 + "phase 2" 태그, "왜" 를 설명하는 주석)과 일관되게 유지된다. `useWorkspaceSlug` 의 URL-우선/store-폴백 우선순위에 맞춰 파일별로 다른 mock 전략(usage-node-list/overview-card 는 `useParams` 직접 slug 주입, triggers-page 는 기존 `setRole` → workspace store 폴백 재사용)을 선택한 점도 각 컴포넌트의 실제 라우팅 컨텍스트에 부합해 타당하다. 지적한 항목은 모두 INFO 수준의 경미한 반복(주석/mock 블록, href 단언 패턴)과 describe 배치 뉘앙스로, 즉시 수정이 필요한 사안은 아니며 향후 콜사이트가 늘어날 때 공용 헬퍼 추출을 고려하면 된다.

## 위험도
LOW
