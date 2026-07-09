# 부작용(Side Effect) 리뷰 결과

대상 커밋: `62484807` refactor(navigation): 슬러그 라우팅 round-2 ai-review/impl-done Warning 조치
범위: `codebase/frontend/src/lib/workspace/{href.ts,resolve-fallback.ts,__tests__/href.test.ts}`, `codebase/frontend/src/lib/stores/workspace-store.ts`, `CHANGELOG.md`, `review/.../RESOLUTION.md`, spec 문서 4건(각주 추가). 이전 라운드(ai-review round1) Warning 4건에 대한 후속 조치로, 신규 기능이 아니라 기존 동작의 정합화(security hardening + DRY 통합)다.

## 발견사항

- **[INFO]** `buildWorkspaceHref` 정규화 로직 확장 — 신규 문자 클래스 제거가 기존 정상 입력에 영향 없는지 확인
  - 위치: `codebase/frontend/src/lib/workspace/href.ts:16-20` (`clean` 계산)
  - 상세: 기존 "선두 슬래시만 접기"에서 "tab/CR/LF 제거 + 선두 `/`·`\` 접기"로 정규화 규칙이 확장됐다. 두 `.replace()` 가 순서대로 적용(제어문자 제거 → 선두 구분자 접기)되므로 `"/\t/evil.com"` → `"//evil.com"` → `"/evil.com"` 로 의도대로 축약된다. `buildWorkspaceHref` 는 pure 함수이고 호출부(내부 링크 생성)는 코드 리터럴 path 만 넘기므로 실사용 입력에 tab/CR/LF 가 섞일 가능성은 낮다 — 신규 테스트 4건(`href.test.ts`)이 회귀를 커버한다. 부작용 관점에서는 함수 시그니처·반환 타입 불변, 순수성 유지로 안전.
  - 제안: 없음(참고용). 향후 path 에 정당한 제어문자가 포함되는 케이스(예: 사용자 입력을 그대로 path 로 넘기는 새 호출부)가 생기면 이 정규화가 데이터를 조용히 변형한다는 점을 인지할 것.

- **[INFO]** `workspace-store.setWorkspaces` 폴백 로직을 `resolveFallbackWorkspace` 위임으로 대체 — 동작 동등성 확인
  - 위치: `codebase/frontend/src/lib/stores/workspace-store.ts:44-49`
  - 상세: 기존 인라인 로직(`current && list.some(...) ? current : list[0]?.id ?? null`)을 `resolveFallbackWorkspace(list, get().currentWorkspaceId)?.id ?? null` 로 교체했다. `resolveFallbackWorkspace` 는 `workspaces.find(w => w.id === currentWorkspaceId) ?? workspaces[0] ?? null` 로 구현되어 있어, `currentWorkspaceId` 가 `null`/빈 문자열이거나 목록에 없으면 첫 항목으로, 있으면 매칭된 항목(동일 id)으로 귀결 — 기존 분기와 결과가 동일하다. 이 함수는 `set({ workspaces, currentWorkspaceId, loaded })` 를 호출하는 zustand persist store 의 핵심 상태 갱신 경로이므로, 폴백 규칙이 달라지면 활성 워크스페이스가 예상과 다르게 바뀌는 부작용으로 이어질 수 있는 민감한 지점이다 — 다만 이번 변경은 로직 이관일 뿐 규칙 자체는 불변이라 위험 낮음.
  - 제안: 없음(참고용). `resolveFallbackWorkspace` 는 이제 3개 소비처(`[slug]` layout, `[...rest]` catch-all, `workspace-store`)가 공유하는 단일 진실이 됐으므로, 향후 이 함수를 수정할 때는 세 지점 전부의 영향을 함께 검토해야 한다(현재는 회귀 아님, 향후 변경 시 주의사항).

- **[INFO]** `resolve-fallback.ts` → `workspace-store.ts` 의 `import type` 순환 참조 — 런타임 순환 없음 확인
  - 위치: `codebase/frontend/src/lib/workspace/resolve-fallback.ts:1`, `codebase/frontend/src/lib/stores/workspace-store.ts:5`
  - 상세: `resolve-fallback.ts` 가 `workspace-store.ts` 의 `WorkspaceSummary` 타입을 `import type` 으로, `workspace-store.ts` 가 `resolve-fallback.ts` 의 `resolveFallbackWorkspace` 함수를 값으로 import — 상호 참조 형태다. `import type` 은 TS 컴파일 시 완전히 제거되므로(`isolatedModules`/`verbatimModuleSyntax` 하에서도) 번들 결과에는 단방향 의존(store → resolve-fallback)만 남아 런타임 순환 import 는 발생하지 않는다. 커밋 메시지의 주장과 실제 코드가 일치함을 확인.
  - 제안: 없음.

- **[INFO]** 시그니처/공개 인터페이스 변경 없음
  - 위치: 전체 diff
  - 상세: `buildWorkspaceHref(slug, path)`, `resolveFallbackWorkspace(workspaces, currentWorkspaceId)`, `setWorkspaces(list)` 모두 파라미터·반환 타입 변경 없이 내부 구현만 교체됐다. 신규 export·신규 전역 변수·신규 env 변수·신규 네트워크 호출·신규 파일 I/O 없음. `CHANGELOG.md`/`RESOLUTION.md`/spec 4건은 문서 텍스트 추가뿐이며 코드 실행 경로에 영향 없음.
  - 제안: 없음.

## 요약

이번 커밋은 이전 ai-review 라운드의 Warning 조치(보안 정규화 확장 1건, DRY 통합 1건)와 문서 갱신으로 구성되어 있으며, 신규 상태·전역 변수·API·네트워크 호출·파일시스템 부작용이 전혀 도입되지 않았다. `buildWorkspaceHref`/`resolveFallbackWorkspace`/`setWorkspaces` 세 함수 모두 시그니처가 그대로 유지된 채 내부 로직만 안전하게 통합·강화됐고, 리팩터가 주장하는 "동작 동등성"(폴백 규칙)과 "런타임 순환 없음"(type-only import)을 코드 레벨에서 직접 확인했다. 테스트(`href.test.ts` 4건 추가)가 새 정규화 케이스를 커버하고 있어 회귀 위험도 낮다.

## 위험도

NONE
