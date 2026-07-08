# Requirement Review — 슬러그 라우팅 round-2 ai-review/impl-done Warning 조치

대상 커밋: `62484807` (refactor(navigation): 슬러그 라우팅 round-2 ai-review/impl-done Warning 조치)
범위: `href.ts`/`href.test.ts`/`resolve-fallback.ts`/`workspace-store.ts` (코드 4건), `CHANGELOG.md`/`RESOLUTION.md` (문서 2건), spec 5건(`0-dashboard`·`1-workflow-list`·`11-error-empty-states`·`4-ai-assistant`·`13-replay-rerun` bare-path slug-aware 각주).

## 발견사항

- **[WARNING]** `rerun-modal.tsx` 의 재실행 성공 후 네비게이션이 이번 diff 로 갱신된 spec 문구와 어긋난다 (slug 미부착).
  - 위치: `codebase/frontend/src/components/executions/rerun-modal.tsx:290-292` (`handleSubmit`), JSDoc `:59-62`. 대조 spec: 본 커밋이 수정한 `spec/5-system/13-replay-rerun.md` §10.2 "재실행" 버튼 행(`/w/<slug>/workflows/:workflowId/executions/:newId` 로 갱신됨).
  - 상세: `handleSubmit` 은 `onSuccess` 콜백이 없을 때 `router.push(\`/workflows/${original.workflowId}/executions/${result.id}\`)` 로 **bare path**(슬러그 미부착)를 직접 호출한다. 같은 파일의 원본 ID 링크(`:320-323`)는 `buildWorkspaceHref(slug, ...)` 를 정확히 쓰고, `slug` 는 `useWorkspaceSlug()`(`:156`)로 이미 스코프에 있는데 `handleSubmit` 분기만 이를 참조하지 않는다. 실제 호출부 2곳(`workflows/[id]/executions/[executionId]/page.tsx`, `run-results-drawer.tsx`) 모두 `onSuccess` 를 넘기지 않으므로 이 bare-path 분기가 **항상** 실행 경로다. `(main)` 그룹에 non-slug `/workflows/...` 라우트가 없어 `(main)/[...rest]` catch-all 이 흡수해 최종적으로는 올바른 페이지(`/w/<slug>/workflows/.../executions/...`)로 도달하지만(catch-all 은 `router.replace` 라 히스토리 오염은 없음), 문서화된 대로 직접 slug 경로로 라우팅하지 않고 불필요한 리다이렉트 바운스(로딩 스피너 플래시)를 한 번 더 거친다 — "URL slug = FE 라우팅 SoT" 컨벤션과 이번 라운드가 강화한 "buildWorkspaceHref 단일 경계" 원칙에 line-level 로 어긋난다.
  - 참고: 이 버그 자체는 이번 diff 가 건드린 라인이 아니라 phase-1 원 커밋에서 남은 기존 갭이다. 다만 이번 diff 가 바로 그 spec 문구(§10.2 재실행 버튼 행)를 slug-aware 로 갱신했으므로, "spec 본문과 코드 구현이 line-level 로 일치하는지" 점검 결과 불일치가 확인된다.
  - 제안: `handleSubmit` 의 `router.push` 를 `router.push(buildWorkspaceHref(slug, \`/workflows/${original.workflowId}/executions/${result.id}\`))` 로 교정하고, JSDoc(`:59-62`)·회귀 테스트(`rerun-modal.test.tsx:192-211`, 현재 bare path 를 단언 중)를 함께 갱신.

- **[WARNING]** `RESOLUTION.md` 갱신 문구가 실제 재검증 결과를 과대평가.
  - 위치: `review/code/2026/07/08/18_24_41/RESOLUTION.md` (이번 diff 편집분, "리뷰 커버리지 갭" 항목).
  - 상세: 새 문구는 "fresh `/ai-review`(`review/code/2026/07/09/07_56_16/`) 재수행으로 재검증 완료 — scope/side_effect/documentation 포함 **9 reviewer 산출**, Critical 0" 이라 적었으나, 실제 `review/code/2026/07/09/07_56_16/` 디렉터리에는 reviewer 출력 md 파일이 7개(`architecture`·`documentation`·`maintainability`·`scope`·`security`·`side_effect`·`user_guide_sync`)뿐이다. `requirement`·`testing` 두 reviewer 는 그 세션의 `SUMMARY.md` 자신이 "매니페스트상 success 로 보고됐으나 산출 파일 부재 — **재시도 필요**" 라고 명시한 대로 여전히 미산출 상태였다(디스크-write 갭이 재발). 즉 "9 reviewer 산출"·"재검증 완료" 는 그 세션 자체의 결론과 모순되는 과대 서술이다.
  - 제안: "7/9 reviewer 산출(Critical 0), requirement·testing 2건은 갭 재발 — 별도 세션에서 재시도"로 정정하거나, 실제로 이 diff 리뷰 세션(`08_18_37`)에서 두 reviewer 가 산출되었는지 확인 후 그 경로로 참조를 갱신.

- **[INFO]** `href.ts` 의 제어문자 제거(`.replace(/[\t\r\n]/g, "")`)가 선두 위치에 앵커링되지 않고 문자열 전체에서 tab/CR/LF 를 제거한다. WHATWG URL 파싱 알고리즘의 "ASCII tab/newline 전체 제거" 규칙과 정확히 일치해 의도된 동작으로 보이며 3개 신규 테스트(`href.test.ts:579-585`)로 선두 케이스는 검증됐으나, 경로 중간에 리터럴 제어문자가 있는 케이스(예: `/foo\tbar`)에 대한 명시 테스트는 없다. 현재 모든 실호출부가 정적 리터럴/UUID 조합이라(약 50개 호출부 확인) 실질 위험은 낮음.
  - 위치: `codebase/frontend/src/lib/workspace/href.ts:718-720`.

- **[INFO]** `workspace-store.ts` 의 `setWorkspaces` 리팩터(3번째 인라인 폴백 → `resolveFallbackWorkspace` 위임)에 대한 전용 단위 테스트가 없다. `codebase/frontend/src/lib/stores/__tests__/workspace-store.test.ts` 는 `switchWorkspace` 만 다루고 `setWorkspaces` 케이스가 없다. `resolveFallbackWorkspace` 자체는 `resolve-fallback.test.ts` 로 별도 커버되고 위임이 순수 함수 호출 1줄이라 회귀 위험은 낮다.
  - 위치: `codebase/frontend/src/lib/stores/workspace-store.ts:481-486`.

- **[정상 확인]** 아래 항목은 line-level 로 대조해 문제 없음을 확인했다:
  - `buildWorkspaceHref` 신규 정규화 로직이 `href.test.ts` 의 4개 신규 케이스(`\\\\evil.com/x`, `/\\evil.com`, `/\t/evil.com`, slug 조합)를 모두 정확히 만족.
  - `resolveFallbackWorkspace` 위임이 종전 `setWorkspaces` 인라인 로직과 동작 동치("현재 id 존재 시 유지, 아니면 첫 항목, 없으면 null") — 회귀 없음.
  - `resolve-fallback.ts` JSDoc 이 주장하는 "3개 소비처" 는 실제로 `[slug]/layout.tsx`·`(main)/[...rest]/page.tsx`·`workspace-store.ts` 3곳 뿐임을 grep 으로 확인 — 과장 없음.
  - `resolve-fallback.ts` 의 `import type { WorkspaceSummary }` (type-only) ↔ `workspace-store.ts` 의 런타임 `import { resolveFallbackWorkspace }` 조합은 TS 컴파일 시 type-only import 가 소거되므로 런타임 순환 없음 — 커밋 메시지 주장과 일치.
  - spec 각주 5건(`0-dashboard`·`1-workflow-list §2.6`·`11-error-empty-states §1.3`·`13-replay-rerun §10.2` 텍스트 자체) 은 각 페이지의 실제 `buildWorkspaceHref` 호출부와 대조해 경로 형식이 일치함(단, `13-replay-rerun` 은 위 WARNING 대로 실제 라우팅 코드가 그 문구를 아직 충족하지 못함).
  - TODO/FIXME/HACK/XXX 주석 없음 (4개 코드 파일 전수 grep).

## 요약

이번 round-2 diff 자체(`href.ts` 보안 정규화 강화, `workspace-store.ts` DRY 위임, 대응 테스트)는 커밋 메시지가 주장하는 대로 정확히 구현되어 있고 회귀 없음을 라인 단위로 확인했다. 다만 spec fidelity 점검 과정에서, 이번 diff 가 갱신한 `spec/5-system/13-replay-rerun.md` §10.2 "재실행" 버튼 경로 문구와 실제 `rerun-modal.tsx` 의 성공 후 네비게이션 코드가 어긋나는 기존 갭을 발견했다(slug 미부착 bare path, `(main)/[...rest]` catch-all 로 기능적으로는 구제되나 문서화된 직접 경로와 불일치). 또한 이번 diff 가 편집한 `RESOLUTION.md` 문구가 실제 fresh-review 세션의 reviewer 산출 현황(7/9, 2건 갭 재발)을 과대 서술한다. 두 건 모두 CRITICAL 급 기능 훼손은 아니나(전자는 UX 상 눈에 띄는 리다이렉트 바운스, 후자는 감사 기록 정확성 문제) 조치를 권장한다.

## 위험도
MEDIUM
