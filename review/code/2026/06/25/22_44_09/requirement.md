# 요구사항(Requirement) 리뷰

대상 커밋: `174bd90` — `refactor(frontend): m-3 — integrations/new/page.tsx 1444→448줄 분할 (03-maintainability)`

---

## 발견사항

### [INFO] `useCafe24PendingPolling` 의 `lastError` 타입 캐스트 불필요
- 위치: `/Volumes/project/private/clemvion/codebase/frontend/src/lib/integrations/use-cafe24-pending-polling.ts` line 86
- 상세: `(poll.lastError as { message?: string } | null)?.message` — `IntegrationDto.lastError` 는 이미 `{ code?: string; message?: string; … } | null | undefined` 로 정확히 타입이 선언되어 있어 강제 캐스트가 불필요하다. 기능 영향은 없으나 타입 안전성보다는 명시성이 낮아진다.
- 제안: `poll.lastError?.message ?? poll.statusReason ?? null` 로 캐스트 제거. (`use-makeshop-pending-polling.ts` 는 `statusReason` 만 직접 참조하는 더 깔끔한 패턴 사용 중)

### [INFO] `useCafe24PendingPolling` 의 라우팅에 `encodeURIComponent` 미적용 — `useMakeshopPendingPolling` 과 불일치
- 위치: `/Volumes/project/private/clemvion/codebase/frontend/src/lib/integrations/use-cafe24-pending-polling.ts` line 80
- 상세: `router.replace(\`/integrations/${integrationId}\`)` — `integrationId` 가 UUID 임을 전제하지만 `encodeURIComponent` 를 적용하지 않는다. `use-makeshop-pending-polling.ts` line 98 은 동일 패턴에 `encodeURIComponent(integrationId)` 를 적용하고 있다. 실무적으로 UUID 는 path-safe 하지만 두 훅 간 불일치가 존재한다.
- 제안: `router.replace(\`/integrations/${encodeURIComponent(integrationId)}\`)` 로 통일하거나, 이유(UUID assumption)를 주석으로 명시.

### [INFO] `TestStep.queryKey` 에 `credentials` 미포함 — 동일 authType 재방문 시 stale 캐시 가능성
- 위치: `/Volumes/project/private/clemvion/codebase/frontend/src/app/(main)/integrations/new/_components/test-step.tsx` line 1333
- 상세: `queryKey: ["integrations", "preview-test", serviceType, authType]` — `credentials` 가 queryKey 에 없어 동일 serviceType/authType 에서 credentials 변경 후 TestStep 이 재렌더되면 이전 결과를 캐시 히트할 수 있다. page.tsx 의 step 전환이 URL 변경이므로 정상 흐름에서는 항상 새 mount 로 진입한다. 원본 동작 그대로 보존한 것.
- 제안: 향후 `credentials` 또는 `JSON.stringify(credentials)` 를 queryKey 에 추가. 이번 PR 범위 밖.

### [INFO] `Cafe24ExtraFields` `useEffect` dep 에서 `set` 함수 제외 (`eslint-disable`)
- 위치: `auth-step.tsx` lines 371–376
- 상세: `set` 은 매 render 마다 새로 생성되어 deps 에 포함하면 무한 루프가 발생하므로 eslint-disable 로 제외한 것이며, 주석으로 이유가 명시되어 있다. mount 직후 1회 실행이고 그 시점 `credentials` 는 초기값만 있으므로 실질적 데이터 손실 위험은 없다. 원본 동작 보존.
- 제안: INFO 수준. 향후 `setCredentials(prev => {...prev, app_type: "private"})` 함수형 업데이트 패턴으로 개선 가능.

### [INFO] `useOauthPopupReturn` — `onAuthorized` 콜백이 mount-only effect closure 에서 stale 될 수 있음
- 위치: `/Volumes/project/private/clemvion/codebase/frontend/src/lib/integrations/use-oauth-popup-return.ts` lines 3374–3399
- 상세: `window.addEventListener('message', handler)` 가 `[]` 의존으로 mount-only 에 등록된다. `onAuthorized` 가 re-render 시 새 참조로 교체되더라도 handler 는 mount 시의 값을 캡처한다. 현재 `page.tsx` 의 `onAuthorized: () => goToStep("test")` 는 `router`(안정), `serviceType`(URL 기반으로 불변) 을 사용하므로 stale 위험이 없다. 원본 `// eslint-disable-next-line react-hooks/exhaustive-deps` 패턴 그대로 보존.
- 제안: INFO 수준. `onAuthorized` 를 `useRef` 에 보관하는 패턴으로 방어적으로 개선 가능하나 현재 시나리오에서는 불필요.

---

## 요약

본 변경은 `integrations/new/page.tsx` 1444줄을 448줄로 분할하는 순수 behavior-preserving 리팩터링이다. OAuth 팝업 상태기계(§3.5), beforeunload 이탈 가드(§3.6), Cafe24 Private pending 흐름(§3.2 Private), MakeShop install-first pending 흐름(§3.2 MakeShop 절 / §5.9), 3초 폴링 + 10분 soft timeout, `connected` 전이 시 토스트·쿼리 invalidate·상세 페이지 라우팅 등 spec 이 요구하는 모든 행위가 원본과 동일하게 유지된다. MakeShop 훅(`use-makeshop-pending-polling`)이 Cafe24 훅보다 `statusReason` 매핑 보안(raw 에러 텍스트 차단)과 `encodeURIComponent` 처리에서 더 방어적이며, Cafe24 훅도 동일 수준으로 보완하는 것이 권장되지만 기능 정확성에 영향을 주지는 않는다. 발견된 이슈는 모두 INFO 수준이며, 요구사항 충족을 저해하는 CRITICAL/WARNING 은 없다.

---

## 위험도

LOW
