# 테스트(Testing) 리뷰

대상: 슬러그 라우팅 round-2 ai-review/impl-done Warning 조치 커밋 (62484807118bdf5573ce21507bd4db84a186691a)
핵심 코드 변경: `codebase/frontend/src/lib/stores/workspace-store.ts`(setWorkspaces → resolveFallbackWorkspace 위임), `codebase/frontend/src/lib/workspace/href.ts`(open-redirect 정규화 확장) + 대응 테스트 `href.test.ts`. `resolve-fallback.ts`·spec 문서·CHANGELOG·RESOLUTION.md 는 주석/문서 변경뿐.

## 발견사항

- **[WARNING]** `workspace-store.setWorkspaces` 델리게이션에 대한 직접 유닛 테스트 부재
  - 위치: `codebase/frontend/src/lib/stores/workspace-store.ts:421-428` (`setWorkspaces`), 테스트 파일 `codebase/frontend/src/lib/stores/__tests__/workspace-store.test.ts`
  - 상세: 이번 커밋이 `setWorkspaces` 의 폴백 로직(3번째 인라인 구현)을 `resolveFallbackWorkspace` 위임으로 교체했으나, `workspace-store.test.ts` 는 `describe("workspace-store switchWorkspace", ...)` 뿐이고 `setWorkspaces` 를 호출/검증하는 `it` 이 전무하다(리팩터링 전에도 없던 pre-existing 갭이지만, 바로 이 커밋이 그 함수 본문을 바꿨으므로 지금이 메꿀 시점). `resolveFallbackWorkspace` 자체는 `resolve-fallback.test.ts` 로 (일치/null/unknown/empty 4케이스) 잘 커버되지만, 이는 순수 함수 단위 테스트이고 스토어 액션 통합(“list 를 실제로 `workspaces` state 에 반영하는지”, “`loaded: true` 로 전환되는지”, “`get().currentWorkspaceId` 를 올바른 인자로 넘기는지”)은 별개 관심사라 커버되지 않는다. `setWorkspaces` 는 `useWorkspaces()` (list refetch) → `[slug]` layout reconcile 게이팅의 입력이 되는 상태 전이라, 여기서 회귀(예: 위임 인자 순서 오류, `loaded` 플래그 누락)가 나도 잡아낼 유닛 테스트가 없다.
  - 제안: `workspace-store.test.ts` 에 `describe("setWorkspaces", ...)` 블록 추가 — (a) 현재 id 가 새 목록에 존재하면 유지, (b) 존재하지 않으면 첫 항목으로 폴백, (c) 빈 목록이면 `currentWorkspaceId: null`, (d) `workspaces` state 갱신 + `loaded: true` 전환을 각각 단언.

- **[WARNING]** 신규 보안 회귀 테스트가 4개 우회 클래스를 단일 `it` 에 뭉쳤고 CR/LF 는 실제로 exercise 되지 않음
  - 위치: `codebase/frontend/src/lib/workspace/__tests__/href.test.ts:35-41` (`"neutralizes backslash and control-char open-redirect bypasses"`)
  - 상세: `href.ts` 의 신규 정규식은 `/[\t\r\n]/g` 로 tab·CR·LF 3종을 동일 취급하는데, 테스트는 tab(`\t`) 케이스 하나만 값을 통해 검증한다. CR(`\r`)/LF(`\n`) 개별 분기가 회귀해도(예: 누군가 정규식을 `/[\t\r]/g` 로 축소) 이 테스트만으로는 감지되지 않는다. 또한 4개의 서로 다른 우회 클래스(더블 백슬래시/단일 백슬래시/탭/슬러그+백슬래시) 를 한 `it` 안에 순서대로 나열해, 첫 assert 가 실패하면 나머지 케이스가 통과 상태인지 여부를 그 실행에서 알 수 없다(부분 회귀 진단 어려움 — CI 로그만으로는 "어느 우회 클래스가 깨졌는지" 바로 안 보임).
  - 제안: `it.each` 또는 케이스별 개별 `it` 으로 분리하고 `\r`, `\n` 케이스(`"/\r/evil.com"`, `"/\n/evil.com"`)를 명시적으로 추가.

- **[INFO]** slug 존재 분기(`buildWorkspaceHref("team-a", ...)`)에서 tab/CR/LF 우회는 테스트되지 않음(backslash 만 커버)
  - 위치: 위와 동일 `it` 블록, 4번째 assert(`buildWorkspaceHref("team-a", "\\\\evil.com")`)만 slug 분기.
  - 제안: slug 유/무 × 우회 클래스(backslash/tab/CR/LF) 매트릭스 중 미실행 칸(slug+tab, slug+CR, slug+LF)을 최소 1~2개 채우면 충분.

- **[INFO]** 회귀 유효성: 기존 protocol-relative(`//evil.com`) 테스트는 정규식 확장(`^/+` → `^[/\\]+`) 후에도 그대로 유효함을 직접 실행으로 확인. `href.test.ts`/`resolve-fallback.test.ts`/`workspace-store.test.ts` 3파일 15개 테스트 전부 로컬 `vitest run` 통과 — RESOLUTION.md 의 "unit: 260 files, 5102 pass" 주장과 상충 없음. `resolve-fallback.ts` 자체 diff 는 주석뿐(로직 무변경)이라 회귀 위험 없음.

## 요약

이번 round-2 커밋의 핵심 로직 변경은 두 곳(`href.ts` 정규화 확장, `workspace-store.setWorkspaces` DRY 위임) 이며 전자는 신규 회귀 테스트가 동반됐으나 커버리지가 tab 케이스와 결합-assert 스타일에 그쳐 CR/LF·slug 분기 조합이 비어 있고, 후자는 위임 대상 순수 함수(`resolveFallbackWorkspace`)만 잘 테스트돼 있을 뿐 스토어 액션 자체(`setWorkspaces`)에 대한 직접 유닛 테스트가 완전히 부재해 이 상태 전이가 게이팅하는 slug reconcile 흐름의 회귀 방어망이 얇다. 두 갭 모두 차단 수준은 아니며(순수 함수 위임이라 실질 로직 오류 가능성은 낮고, e2e `slug-routing.spec.ts` 4종이 상위 흐름을 커버) 후속 커밋에서 간단히 메울 수 있는 WARNING 성격이다.

## 위험도

LOW
