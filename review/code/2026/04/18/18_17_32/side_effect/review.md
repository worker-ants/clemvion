## 발견사항

---

- **[WARNING]** `initFromStorage` 내에서 `set()` 이후 `applyHtmlLang()` 호출 순서 — 잠재적 DOM 불일치
  - 위치: `locale-store.ts:40-43` — `initFromStorage` 구현부
  - 상세: `set({ locale: next })`가 Zustand 구독자에게 동기적으로 상태를 전파한 **후** `applyHtmlLang(next)`가 호출된다. 구독자 중 `document.documentElement.lang`을 의존하는 코드가 있다면, 상태는 "en"인데 `lang` 속성은 아직 "" 또는 "ko"인 프레임이 존재할 수 있다. `setLocale` 경로는 `set()` 전에 `applyHtmlLang`을 호출하므로 동일 스토어 내에서 순서가 불일치한다.
  - 제안: `setLocale`과 동일하게 `set()` 호출 이후 즉시 `applyHtmlLang`을 호출하는 순서를 유지하거나, 혹은 `set()` 내부 미들웨어로 통합할 것. 현재는 기능적 버그가 아니지만 두 경로의 순서 불일치는 유지보수 혼란을 유발한다.

---

- **[WARNING]** `locale-sync.tsx`의 두 `useEffect`가 마운트 시 모두 실행될 경우 locale 덮어쓰기 경쟁 없음은 보장되나 문서화 부재
  - 위치: `locale-sync.tsx:11-20` — 두 `useEffect` 블록
  - 상세: React는 effects를 선언 순서대로 실행하므로 `initFromStorage()`(storage → store)가 먼저 실행된 후 `user?.locale`(server locale → store) 동기화가 따라온다. 이 순서는 "서버 설정이 로컬 캐시를 덮어쓴다"는 의도에 부합하나, 코드만으로는 의도가 불명확하다. 만약 두 effect의 순서가 바뀌면 로직 역전이 발생한다.
  - 제안: 두 effect 사이의 의도적 순서 의존을 주석으로 명시 (`// runs first: seed from storage; second effect below overrides with server locale if present`).

---

- **[INFO]** `useLocaleStore`의 Zustand `create()` 가 모듈 로드 시 즉시 실행 — SSR 환경에서 스토어 초기화
  - 위치: `locale-store.ts:22` — `export const useLocaleStore = create<LocaleState>(...)` 
  - 상세: `create()` 호출은 모듈 임포트 시 즉시 실행된다. 초기 상태 설정은 `DEFAULT_LOCALE`("ko")으로 순수하지만, Zustand의 `create` 자체가 내부적으로 구독자 Set과 같은 가변 객체를 생성한다. Next.js의 per-request 격리 없는 SSR 환경에서는 이 싱글톤이 요청 간 공유될 수 있다. 현재 locale은 사용자별 민감 정보가 아니므로 위험도는 낮지만, 확장 시 고려 필요.
  - 제안: 현재 구조(locale은 공유 가능한 기본값)에서는 허용 가능. 향후 per-user 상태 추가 시 factory 패턴으로 전환 검토.

---

- **[INFO]** `core.ts`의 `console.warn` 이 non-production 환경 전체에서 발생 — 테스트 노이즈
  - 위치: `core.ts:43-45` — 누락된 번역 키 경고
  - 상세: `process.env.NODE_ENV !== "production"` 조건으로 development와 **test** 환경 모두에서 `console.warn`이 실행된다. `translate()`를 직접 호출하는 테스트에서 잘못된 키로 호출하면 콘솔에 경고가 출력되어 테스트 로그를 오염시킨다. 현재 테스트에서는 유효한 키만 사용하므로 실제 노이즈는 없으나, 향후 fallback 경로를 테스트할 때 문제가 된다.
  - 제안: `process.env.NODE_ENV === "development"`로 좁히거나, 테스트에서 `vi.spyOn(console, "warn")`으로 억제하는 관례를 `i18n.test.ts`에 추가.

---

- **[INFO]** `locale-store.test.ts`의 `afterEach`에서 `document.documentElement.lang`를 초기화하지 않음
  - 위치: `locale-store.test.ts:16-18` — `afterEach` 블록
  - 상세: `afterEach`는 `localStorage.clear()`만 수행하고, `document.documentElement.lang`은 초기화하지 않는다. `beforeEach`에서 `document.documentElement.lang = ""`로 리셋하므로 현재는 테스트 격리가 유지된다. 그러나 `afterEach`만 보면 DOM 상태가 누출되는 것처럼 보여 의도 파악이 어렵다.
  - 제안: `afterEach`에도 `document.documentElement.lang = ""`를 추가해 대칭적 정리를 명시.

---

## 요약

핵심 i18n 인프라(`locale-store`, `LocaleSync`, `core.ts`)는 SSR 가드, `typeof window/document` 체크, `isLocale()` 타입 가드를 모두 갖추고 있어 의도치 않은 전역 상태 변경이나 네트워크 호출은 발생하지 않는다. 주요 부작용(localStorage 쓰기, `document.documentElement.lang` 갱신)은 명시적이고 격리되어 있다. 다만 `initFromStorage`와 `setLocale`의 `applyHtmlLang` 호출 순서가 비대칭적이고, 두 `useEffect`의 실행 순서 의존이 암묵적이며, Zustand 스토어가 모듈 레벨 싱글톤으로 존재한다는 구조적 주의점이 있다. 테스트 격리는 전반적으로 양호하나 `afterEach` 정리가 비대칭적이다.

## 위험도

**LOW**