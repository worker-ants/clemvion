### 발견사항

---

**[WARNING] `setLocale` / `initFromStorage` 의 순서가 암묵적 계약을 만듦**
- 위치: `locale-store.ts:29-36` (`setLocale`), `locale-store.ts:40-43` (`initFromStorage`)
- 상세: 현재 순서는 `applyHtmlLang(DOM)` → `localStorage.setItem` → `set(Zustand)`. Zustand 상태 알림이 DOM/storage 갱신 뒤에 오도록 의도적으로 재정렬된 것(RESOLUTION #1)이지만, 이 미세한 창(DOM은 새 locale, Zustand는 아직 이전 locale) 동안 두 값을 동시에 읽는 코드는 불일치를 봅니다. `setLocale` 호출 직후 `useLocaleStore.getState().locale`로 스냅샷을 읽는 비동기 콜백이 있다면 DOM과 불일치할 수 있습니다.
- 제안: `setLocale` / `initFromStorage` 내에 `// DOM and storage are updated before state notification so subscribers observe a consistent world` 주석을 추가해 의도를 명시하세요.

---

**[WARNING] `locale-sync.test.tsx` — `useAuthStore.setState`가 부분 병합(merge) 방식으로 리셋**
- 위치: `locale-sync.test.tsx:8-11` — `useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false })`
- 상세: Zustand v4의 `setState`는 기본적으로 partial merge입니다. `useAuthStore`에 `user`/`isAuthenticated`/`isLoading` 외 추가 필드(예: 토큰, 권한)가 있거나 향후 추가되면, 해당 필드는 이전 테스트 결과값이 잔존합니다. 현재는 `LocaleSync`가 `user?.locale`만 읽으므로 문제가 없지만, `useAuthStore` 형태가 변경되면 테스트 간 상태 오염이 발생할 수 있습니다.
- 제안: `useAuthStore.setState({...}, true)`로 replace mode를 사용하거나, `useAuthStore.getState().__resetState?.()` 패턴을 고려하세요. 최소한 `useAuthStore`의 전체 초기 상태를 명시적으로 지정하세요.

---

**[INFO] 모듈 레벨 `INTERPOLATION_RE`에 `g` 플래그 — 미래 사용 시 footgun**
- 위치: `core.ts:10` — `const INTERPOLATION_RE = /\{\{\s*(\w+)\s*\}\}/g`
- 상세: `String.prototype.replace`는 호출 시작 시 `lastIndex`를 0으로 초기화하므로 현재 사용은 안전합니다. 그러나 모듈 레벨 공유 regex에 `g` 플래그가 있으면, 향후 누군가 `INTERPOLATION_RE.exec(template)` 또는 `INTERPOLATION_RE.test(template)`를 루프에서 사용할 경우 stale `lastIndex`로 인한 매칭 오류가 발생합니다. 이 상수는 non-exported이라 현재는 `core.ts` 내부에서만 접근 가능해 위험이 제한적입니다.
- 제안: `// safe to reuse with replace(); do not use with exec()/test() loops` 주석 추가, 또는 `g` 플래그 없이 `replaceAll` 전환을 검토하세요.

---

**[INFO] `LocaleSync` effect — 로그아웃 시 `initFromStorage()` 호출로 DOM 재변경**
- 위치: `locale-sync.tsx:20-25`
- 상세: `userLocale`이 `undefined`가 되는 모든 경우(로그아웃, 알 수 없는 locale 값)에 `initFromStorage()`가 호출되어 `localStorage`를 읽고 `applyHtmlLang`을 통해 `document.documentElement.lang`을 다시 씁니다. 이는 JSDoc에 문서화된 의도된 동작이지만, 로그아웃 이벤트가 DOM 갱신 부작용을 유발한다는 점이 호출자 입장에서는 비직관적일 수 있습니다. 이미 JSDoc으로 문서화되어 있어 현재 상태는 허용 가능합니다.
- 제안: 조치 불필요. 현재 JSDoc이 정책을 명시하고 있습니다.

---

**[INFO] `useLocaleStore` 모듈 레벨 싱글턴 — 테스트 간 전역 상태 공유**
- 위치: `locale-store.ts:28` — `export const useLocaleStore = create<LocaleState>(...)`
- 상세: 모듈 import 시 즉시 Zustand 스토어 인스턴스가 생성됩니다. 모든 테스트 파일이 동일 인스턴스를 공유하므로, `beforeEach`에서 `resetStore()`를 누락한 테스트 파일이 추가되면 다른 파일의 테스트에 영향을 줍니다. 현재 테스트 파일들은 모두 `beforeEach`에서 초기화하고 있어 문제없습니다.
- 제안: `vitest.setup.ts`에 전역 `beforeEach(() => useLocaleStore.setState({ locale: "ko" }))` 추가를 검토하세요.

---

### 요약

이번 변경에서 의도된 부작용(`applyHtmlLang`의 DOM 갱신, `setLocale`의 localStorage 쓰기)은 모두 SSR 가드와 예외 처리를 갖추고 있으며, 단일 `useEffect`로 통합된 `LocaleSync`는 이중 실행 문제를 해소했습니다. 핵심 우려 사항은 두 가지입니다: `applyHtmlLang` → `localStorage` → Zustand `set()` 순서가 의도적이지만 문서화 없이는 암묵적 계약이 되며, `locale-sync.test.tsx`의 `useAuthStore` 부분 리셋이 `replace: true` 없이 수행되어 `useAuthStore` 형태 확장 시 테스트 오염 위험이 있습니다. 모듈 레벨 `g` 플래그 정규식은 현재 `replace()` 사용에서는 안전하지만 향후 `exec()`/`test()` 오용 가능성에 대한 주석이 권장됩니다.

### 위험도
**LOW**