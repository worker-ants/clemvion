### 발견사항

- **[INFO]** 프론트엔드 `ModelCombobox` - stale response 가능성
  - 위치: `model-combobox.tsx` `loadMutation` onSuccess/onError 콜백
  - 상세: `useMutation`은 `useQuery`와 달리 중복 요청을 자동으로 취소하지 않는다. 버튼이 `isPending` 동안 비활성화되어 동시 발사는 막히지만, props(`provider`, `apiKey`)가 요청 중에 변경된 경우 응답 도착 시점의 form 상태와 맞지 않는 모델 목록이 렌더링될 수 있다. (예: openai로 로드 중 → provider를 anthropic으로 바꿈 → openai 목록이 세팅됨)
  - 제안: `onSuccess` 콜백에서 응답 시점의 `provider`/`apiKey`를 클로저로 캡처해 현재 props와 비교하거나, `useMutation`의 `variables`를 활용해 검증 후 무시하는 가드 추가.

- **[INFO]** 백엔드 `createClient` check-then-set 패턴
  - 위치: `llm.service.ts` `createClient()` 메서드 (변경 외 기존 코드)
  - 상세: `clientCache.get` → `clientCache.set` 사이에 `await`가 없으므로 Node.js 단일 스레드 특성상 실제 경쟁 조건은 발생하지 않는다. 다만 `previewModels`가 이 캐시를 우회하도록 설계된 것은 올바른 결정.
  - 제안: 현행 유지. 설계 의도가 명확하고 안전하다.

- **[INFO]** `previewModels` 임시 클라이언트 캐시 격리 - 올바른 설계
  - 위치: `llm.service.ts` `previewModels()`
  - 상세: 요청마다 `clientFactory.create()`로 새 클라이언트를 생성하고 `clientCache`에 저장하지 않는다. 여러 요청이 동시에 들어와도 각 요청이 독립된 클라이언트를 사용하므로 공유 상태 오염 없음. Node.js 이벤트 루프 모델에서 안전하다.

---

### 요약

변경된 코드는 동시성 관점에서 전반적으로 안전하다. 백엔드의 `previewModels`는 공유 `clientCache`를 의도적으로 우회해 각 호출이 독립 클라이언트를 사용하도록 설계되어 있으며, Node.js 단일 스레드 특성상 `createClient`의 check-then-set도 원자적으로 동작한다. 프론트엔드의 `ModelCombobox`는 `isPending` 가드로 중복 발사를 막지만, props 변경과 응답 도착 타이밍이 겹치는 stale response 시나리오가 이론적으로 존재한다. 이는 critical한 데이터 손상으로 이어지지는 않으며(모델 선택 UX 오류 수준) 실제 발생 빈도도 낮다.

### 위험도

**LOW**