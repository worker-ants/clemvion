## 동시성 코드 리뷰

### 발견사항

- **[INFO]** `ModelCombobox` — props 변경과 응답 도착 타이밍 겹칠 때 stale 모델 목록 렌더 가능성
  - 위치: `model-combobox.tsx` — `loadMutation` `onSuccess` 콜백
  - 상세: `mutationFn`은 호출 시점의 `provider`/`apiKey`/`configId`를 클로저로 캡처한다. 버튼이 `isPending` 동안 비활성화(`disabled={... || loadMutation.isPending}`)되어 **동시 중복 발사는 막히지만**, 요청 진행 중 부모 폼에서 `provider`를 openai → anthropic으로 바꿔도 응답 도착 시 `onSuccess: (fetched) => setModels(fetched)`가 구(舊) provider의 모델 목록으로 state를 덮는 시나리오는 차단되지 않는다.
  - 제안 (기존 I-3 보류 유지): `useMutation`의 `variables`에 요청 시점 파라미터를 담아 `onSuccess` 내에서 현재 props와 비교 후 불일치 시 무시하는 가드. 단, 사용자 인터랙션(버튼 클릭) 기반이고 실제 발생 빈도가 낮아 현재 복잡도 대비 이득이 낮음 — 기존 보류 판단 유지.

- **[INFO]** `models` state와 `useMutation.data`의 이중 관리
  - 위치: `model-combobox.tsx:27–31`
  - 상세: `useState<ModelInfo[]>`(models)와 `useState<string|null>`(errorMessage)가 `onSuccess`/`onError` 콜백을 통해 갱신된다. React 렌더 사이클 특성상 mutation 완료 → `setState` → 리렌더 사이에 `loadMutation.data`와 `models` state가 일시적으로 불일치할 수 있다. 실무상 문제가 될 가능성은 낮으나 두 개의 진실 소스(source of truth)가 존재한다.
  - 제안 (기존 I-4 보류 유지): `loadMutation.data`를 직접 파생해 local state 제거. 현재 구조도 React 단일 스레드 특성상 실질적 데이터 오염은 없으므로 보류 유지.

- **[INFO]** `withTimeout` `Promise.race` + `finally clearTimeout` — 올바른 구현 확인
  - 위치: `llm.service.ts:238-253` (RESOLUTION W-4 조치 내용)
  - 상세: `Promise.race([operation, timeoutPromise])`로 30초 경과 시 reject, `finally { clearTimeout(timer) }`로 리소스 누수 방지. 패턴이 정확하다. Node.js 단일 스레드 이벤트 루프에서 경쟁 조건 없음.

- **[INFO]** `createClient` check-then-set — 안전 확인
  - 위치: `llm.service.ts` `createClient()` (기존 코드)
  - 상세: `clientCache.get` → `clientCache.set` 사이에 `await`가 없으므로 동기 원자 연산. `previewModels`가 이 캐시를 우회하는 설계도 올바르다 — 요청마다 독립 클라이언트 생성으로 공유 상태 오염 없음.

---

### 요약

변경된 코드는 동시성 관점에서 전반적으로 안전하다. 백엔드 `previewModels`는 공유 `clientCache`를 의도적으로 우회하고 요청당 독립 클라이언트를 사용하며, `withTimeout`의 `Promise.race + finally clearTimeout` 패턴도 리소스 누수 없이 올바르게 구현되어 있다. 프론트엔드 `ModelCombobox`는 `isPending` 가드로 동시 중복 발사를 차단하지만, props 변경과 응답 도착 타이밍이 겹치는 stale response 시나리오가 이론적으로 존재한다 — 이는 치명적 데이터 손상이 아닌 UX 수준의 이슈이며, 버튼 클릭 기반 사용자 인터랙션에서 실제 발생 빈도가 극히 낮아 기존 보류(I-3, I-4) 판단이 여전히 타당하다.

### 위험도

**LOW**