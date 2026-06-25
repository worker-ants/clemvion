# Testing Review — refactor(frontend): m-3 integrations/new split

## 발견사항

### [WARNING] `useOauthPopupReturn` 훅 단위 테스트 부재
- 위치: `codebase/frontend/src/lib/integrations/use-oauth-popup-return.ts`
- 상세: 이번 리팩터링의 핵심 추출물이다. 5분 타임아웃, popup.closed 폴링, stale-read 방지 ref, postMessage 수신, 이중 에러 토스트 억제 등 회귀 민감 타이밍 로직이 162줄 안에 집중되어 있다. 기존에는 page.tsx 전체에 묻혀 있어 커버하기 어려웠지만, 훅으로 분리된 지금은 `renderHook` + fake-timer 조합으로 독립 단위 테스트가 가능하다. `use-cafe24-pending-polling.test.tsx`·`use-makeshop-pending-polling.test.tsx` 가 동일 패턴(renderHook + vi.useFakeTimers + vi.advanceTimersByTime)을 이미 구현해 두었고, 커밋 메시지도 "회귀 민감" 이라고 명시한다. 그럼에도 대응 테스트가 추가되지 않았다.
- 제안: `src/lib/integrations/__tests__/use-oauth-popup-return.test.tsx` 를 신설하고 다음 케이스를 최소 포함한다.
  1. 성공 postMessage 수신 → previewToken 설정 + onAuthorized 호출
  2. 에러 postMessage 수신 → oauthError 설정 + 에러 토스트
  3. 팝업 수동 닫힘(popup.closed) → 1.5s 후 oauthError 설정 (success가 먼저 오면 억제)
  4. 5분 타임아웃 → 에러 상태 + 팝업 닫기
  5. 다른 origin postMessage 무시 (보안)
  6. unmount 후 message handler 제거(메모리 누수 방지)

### [WARNING] `useUnsavedChangesWarning` 훅 단위 테스트 부재
- 위치: `codebase/frontend/src/lib/hooks/use-unsaved-changes-warning.ts`
- 상세: `active=true/false` 전환에 따른 `beforeunload` 리스너 탈부착이 동작의 전부다. `lib/hooks/__tests__/` 디렉터리에는 이미 `use-copy-to-clipboard.test.tsx`·`use-page-param.test.tsx` 가 있어 패턴이 확립되어 있다. 훅 자체가 23줄이지만 이탈 가드 해제 누락은 사용자 UX 회귀로 이어진다.
- 제안: `src/lib/hooks/__tests__/use-unsaved-changes-warning.test.ts` 를 신설하고 세 케이스(active=false이면 리스너 미등록, active=true이면 등록 + beforeunload 이벤트 preventDefault 호출, active가 false로 전환되면 리스너 제거)를 커버한다.

### [INFO] `AuthStep` 컴포넌트 — 새 파일이지만 직접 테스트 없음 (기존 통합 테스트로 커버 중)
- 위치: `codebase/frontend/src/app/(main)/integrations/new/_components/auth-step.tsx`
- 상세: `Cafe24ExtraFields`(useEffect로 credentials coerce) 및 `toggleScope` 로직은 `cafe24-precheck.test.tsx` 가 page.tsx 를 통해 간접 커버한다. 단, `Cafe24ExtraFields` 내 `publicAppAvailable=false` 시 app_type coerce effect 경로는 `cafe24-precheck.test.tsx` 의 CAFE24_SERVICE fixture 가 `publicAppAvailable: true` 를 고정해 커버하지 못한다. 컴포넌트가 분리된 지금은 독립 단위 테스트가 용이하다.
- 제안: 즉각 수정 우선순위는 낮지만, 추후 `auth-step.test.tsx` 신설 시 `publicAppAvailable=false` → coerce effect 케이스와 `conflictDescKey` 분기(connected/pending_install/expired/error)를 커버하면 cafe24-precheck.test.tsx 의 부하를 줄일 수 있다.

### [INFO] `TestStep` 컴포넌트 — `skipProbe=true` 경로(OAuth flow) 테스트 누락
- 위치: `codebase/frontend/src/app/(main)/integrations/new/_components/test-step.tsx`
- 상세: `skipProbe=true`(OAuth 완료 후 사전 검증 불필요 경로)이면 `useQuery` 가 disabled 되고 `pending=false, failed=false` 가 되어 저장 버튼이 즉시 활성화된다. 이 경로는 OAuth 전체 플로우 e2e 로만 검증 가능하며, e2e 는 현재 환경 아웃티지로 미실행 상태다. 단위 테스트에서 직접 컴포넌트 렌더로 커버 가능하다.
- 제안: `test-step.test.tsx` 신설 시 `skipProbe=true` + `savedError=null` 조합에서 저장 버튼이 enabled 인지 확인하는 케이스를 추가한다.

### [INFO] `Cafe24PrivatePendingStep` / `MakeshopPendingStep` — 폴링 훅은 별도 테스트 있으나 컴포넌트 자체 테스트 없음
- 위치: `codebase/frontend/src/app/(main)/integrations/new/_components/cafe24-private-pending-step.tsx`, `makeshop-pending-step.tsx`
- 상세: 폴링 상태기계는 `use-cafe24-pending-polling.test.tsx`·`use-makeshop-pending-polling.test.tsx` 로 충분히 커버된다. 컴포넌트 내 `navigator.clipboard.writeText` 호출 후 2초 후 리셋되는 copy 상태, `poll.status === "expired" && poll.statusReason === "install_timeout"` 조건 분기는 미커버다. 회귀 위험 낮음.
- 제안: 우선순위 LOW. 향후 컴포넌트 테스트 추가 시 copy 버튼 상태 전환과 terminal status 분기를 포함한다.

### [INFO] `cafe24-precheck.test.tsx` — `useMakeshopPendingPolling` stub 미포함이지만 영향 없음
- 위치: `codebase/frontend/src/app/(main)/integrations/new/__tests__/cafe24-precheck.test.tsx` (L39-42)
- 상세: `useCafe24PendingPolling` 은 stub 처리되어 있으나 `useMakeshopPendingPolling` 은 stub 이 없다. 현재 테스트 시나리오는 auth step 만 렌더하므로 `MakeshopPendingStep` 가 마운트되지 않아 문제없다. 단, 향후 makeshop pending 경로를 동일 테스트 파일에서 검증할 경우 stub 이 필요하다.
- 제안: 현재 상태에서는 문제없음. 주의 사항으로 기록.

### [INFO] `TestStep.useQuery` queryKey 에 credentials 미포함 — 캐시 히트 주의
- 위치: `codebase/frontend/src/app/(main)/integrations/new/_components/test-step.tsx` (L1331-1345 in diff, 실제 컴포넌트 L25-40)
- 상세: `queryKey: ["integrations", "preview-test", serviceType, authType]` 에 `credentials` 가 빠져 credentials 변경 후 test step 재방문 시 이전 결과가 캐시에서 반환될 수 있다. 이는 기존 코드(page.tsx 원본)와 동일하므로 이번 리팩터링이 새로 도입한 문제는 아니다. 단위 테스트로 이 동작을 명시적으로 검증하는 케이스가 없다.
- 제안: credentials 변경 시나리오 테스트를 추가하거나, queryKey 에 credentials hash 를 포함하는 것을 별도 이슈로 트래킹한다.

## 요약

이번 리팩터링은 page.tsx 를 behavior-preserving 방식으로 분할했으며, 기존 `cafe24-precheck.test.tsx` 와 `use-cafe24-pending-polling.test.tsx`·`use-makeshop-pending-polling.test.tsx` 는 분할 후에도 유효하게 유지된다. 가장 큰 테스트 갭은 `useOauthPopupReturn` 훅으로, 타이밍 의존적인 OAuth 상태기계(postMessage, popup.closed 폴링, 5분 타임아웃, stale-ref 패턴)를 캡슐화하며 커밋 메시지가 "회귀 민감" 이라고 명시함에도 대응 단위 테스트가 없다. `useUnsavedChangesWarning` 도 동일 패턴의 기존 훅 테스트 인프라가 있어 즉시 추가 가능하다. 컴포넌트 레벨(AuthStep, TestStep, Pending steps) 은 indirect 커버리지가 존재하나 일부 엣지 케이스(publicAppAvailable=false coerce, skipProbe=true, copy 상태 전환)가 미커버다. e2e 는 환경 아웃티지로 미실행이며 이는 별도 위험 요인이다.

## 위험도

MEDIUM
