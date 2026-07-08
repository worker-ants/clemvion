## 동시성(Concurrency) 리뷰

### 검토 대상 요약

이번 diff(커밋 `6248480` — "슬러그 라우팅 round-2 ai-review/impl-done Warning 조치")의 실질 코드 변경은 다음 4건뿐이다.

1. `codebase/frontend/src/lib/stores/workspace-store.ts` — `setWorkspaces` 의 인라인 폴백 삼항식(`stillExists ? current : list[0]?.id ?? null`)을 `resolveFallbackWorkspace(list, get().currentWorkspaceId)?.id ?? null` 위임으로 교체 (DRY, 동작 동일).
2. `codebase/frontend/src/lib/workspace/href.ts` — `buildWorkspaceHref` 의 open-redirect 방어 정규식에 backslash·제어문자(tab/CR/LF) 정규화 추가.
3. `codebase/frontend/src/lib/workspace/__tests__/href.test.ts` — 위 방어에 대한 테스트 4건 추가.
4. `codebase/frontend/src/lib/workspace/resolve-fallback.ts` — 함수 본체 무변경, JSDoc 만 갱신(3번째 소비처 `workspace-store.setWorkspaces` 추가 언급).

나머지(CHANGELOG.md, RESOLUTION.md, spec/*.md 6개)는 문서/스펙 산문이며 실행 코드가 없다.

### 분석

- `setWorkspaces` 변경은 Zustand `set()` 콜백 내부의 **동기(sync) 순수 계산**을 다른 동기 순수 함수(`resolveFallbackWorkspace`)로 대체한 것뿐이다. 새 비동기 연산·타이머·이벤트 리스너·공유 가변 상태를 도입하지 않으며, 기존과 동일하게 단일 `set()` 호출로 상태를 원자적으로 갱신한다(zustand 의 `set` 은 단일 동기 호출이라 tearing 없음). `resolveFallbackWorkspace` 자체도 인자만 참조하는 순수 함수라 3개 소비처(`[slug]` layout, `(main)/[...rest]` catch-all, `workspace-store.setWorkspaces`)가 공유해도 동시성 문제가 없다.
- `href.ts` 변경은 문자열 정규화 로직(정규식 치환)만 추가된 것으로, 순수 동기 함수이며 공유 상태·비동기 흐름과 무관하다.
- 파일 컨텍스트에 표시된 `workspace-store.ts` 의 `switchWorkspace`/`latestSwitchTarget`(모듈 스코프 "최신 전환 대상" 변수로 stale 응답을 무시하는 패턴)는 **이번 diff 의 변경 대상이 아니다** — hunk(`@@ -40,9 +43,9 @@`)는 `setWorkspaces` 블록에만 적용되고 `switchWorkspace` 본문은 그대로다. 참고로 이 기존 패턴 자체는 "가장 최근에 시작된 요청만 상태에 반영"하는 표준적 stale-response 가드로, JS 단일 스레드 이벤트 루프 특성상 별도 락 없이 올바르게 동작한다(다만 `switchWorkspaceApi` 내부에서 메모리 토큰을 교체하는 부분까지 이 가드가 커버하는지는 이번 diff 범위 밖이라 기존 상태 유지로 판단, 새로 도입된 리스크 아님).

### 발견사항

없음 — 이번 변경분에는 경쟁 조건·데드락·비동기 오용·원자성 붕괴에 해당하는 코드가 포함되어 있지 않다.

### 요약

이번 diff 는 슬러그 라우팅 기능의 round-2 정리(DRY 리팩터 1건 + 보안 정규식 강화 1건 + 테스트/문서)로, 신규 비동기 로직·공유 가변 상태·락/세마포어 사용이 전혀 없다. 변경된 `setWorkspaces` 는 동기 순수 함수 위임이라 기존 동작과 동시성 특성이 동일하며, `href.ts` 변경도 순수 문자열 정규화라 동시성과 무관하다. 해당 없음.

### 위험도

NONE
