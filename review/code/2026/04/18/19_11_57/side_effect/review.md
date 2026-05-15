---

### 발견사항

---

**[WARNING]** `INTERPOLATION_RE` — `/g` 플래그가 있는 모듈 스코프 공유 정규식은 `lastIndex` 변이 발생
- 위치: `core.ts:21`
- 상세: `String.prototype.replace(regex, ...)` 는 완료 후 `lastIndex`를 0으로 리셋하므로 현재 `interpolate()` 호출은 안전하다. 그러나 `/g` 플래그는 정규식 인스턴스에 상태(`lastIndex`)를 부여한다. 모듈 스코프 단일 인스턴스이기 때문에, 미래에 누군가 `INTERPOLATION_RE.test()` 나 `INTERPOLATION_RE.exec()` 루프를 추가하면 이전 `interpolate()` 호출이 남긴 `lastIndex` 오염으로 매칭이 문자열 중간부터 시작되는 버그가 발생한다. 현재는 `replace()` 전용이라 기능 결함은 없지만, `/g` 를 붙인 모듈 스코프 상수는 잘 알려진 foot-gun 패턴이다.
- 제안: `replace()` 내에서 `lastIndex`는 정상 리셋되므로 현재 동작은 안전하다. 단, 향후 `exec()`/`test()` 사용을 막기 위해 사용 제약을 주석으로 명시하거나, `replace()` 내부에서 `new RegExp(INTERPOLATION_RE.source, 'g')` 로 매 호출마다 fresh 인스턴스를 생성하는 방어적 패턴 검토.

---

**[WARNING]** `index.ts` — `"use client"` 배럴 익스포트가 서버 측 `translate` 접근 경로를 차단
- 위치: `index.ts:1`
- 상세: `index.ts`는 `"use client"` 선언을 가지고 있으며, 동시에 순수 함수인 `translate`, `isLocale`, `DEFAULT_LOCALE` 을 re-export한다. Next.js App Router에서 Server Component가 `@/lib/i18n`(배럴)을 import하면 빌드 오류가 발생한다. 서버 컴포넌트는 반드시 `@/lib/i18n/core`를 직접 import해야 한다. 이 split convention이 파일 어디에도 문서화되지 않아, 팀원이 `@/lib/i18n`을 사용했다가 서버 컴포넌트 빌드 오류를 만날 위험이 있다.
- 제안: `index.ts` 상단 주석 또는 별도 `server.ts` 배럴로 "Server Component는 `@/lib/i18n/core`에서 import" 규칙을 명시. 또는 `"use client"` 가 필요한 훅(`useT`, `useLocale`)만 별도 파일로 분리해 배럴 자체의 서버 호환성 복원 검토.

---

**[INFO]** `locale-sync.tsx` — `initFromStorage()` 가 마운트 1회 실행이 아닌 `userLocale` falsy 전환마다 재실행
- 위치: `locale-sync.tsx:24-33`
- 상세: 이전 2-effect 설계와 달리 단일 effect에서 `userLocale`이 falsy(undefined/유효하지 않은 locale)일 때마다 `initFromStorage()`를 호출한다. 즉 로그아웃, 유저 프로필에 잘못된 locale 문자열이 설정된 경우, 마운트 시 모두 `initFromStorage()` 경로를 탄다. 로그인 후 localStorage가 다른 탭에서 변경된 상태로 로그아웃하면 예상치 못한 locale 값으로 초기화될 수 있다. JSDoc에 로그아웃 동작은 명시되어 있으나 "유효하지 않은 user.locale → storage 폴백" 경로는 미문서화.
- 제안: 현재 설계는 의도적이며 허용 가능한 수준. `locale-sync.test.tsx`의 `"ignores unknown locale values"` 테스트가 이 경로를 부분 검증하고 있으나, localStorage 값 변경 후 재폴백 케이스는 미검증.

---

**[INFO]** `setLocale` vs `initFromStorage` 내 `applyHtmlLang` 호출 순서 — 이전 리뷰 지적 해소 확인
- 위치: `locale-store.ts:40, 52`
- 상세: `setLocale`은 `applyHtmlLang` → `localStorage.setItem` → `set()` 순서이며, `initFromStorage`는 `applyHtmlLang` → `set()` 순서다. 두 경로 모두 DOM 변경이 Zustand 상태 발행 **이전**에 완료되어, 구독자가 알림을 받을 때 `document.documentElement.lang`은 이미 갱신된 상태다. 이전 side_effect 리뷰에서 제기된 순서 불일치 우려는 현재 코드에서 해소되어 있다.

---

**[INFO]** `applyHtmlLang` — 현재 값 비교 후 조건부 DOM 변이 (이전 리뷰 제안 반영)
- 위치: `locale-store.ts:22-27`
- 상세: `document.documentElement.lang !== locale` 조건 추가로 동일 값 재설정 시 불필요한 DOM mutation이 제거되었다. MutationObserver 콜백 오발화 위험이 제거됨. 이전 performance 리뷰의 WARNING이 반영된 결과이며 긍정적 개선이다.

---

**[INFO]** `locale-store.test.ts` `afterEach` — DOM 상태 정리 대칭성 확보 (이전 리뷰 제안 반영)
- 위치: `locale-store.test.ts:17-20`
- 상세: `afterEach`에 `localStorage.clear()`와 `document.documentElement.lang = ""` 가 모두 포함되어 있어 테스트 간 DOM 상태 누출이 방지된다. 이전 side_effect 리뷰의 INFO 항목이 해소되었다.

---

### 요약

현재 코드는 핵심 부작용(localStorage 읽기/쓰기, `document.documentElement.lang` DOM 변이, Zustand 상태 발행)이 모두 명시적이고 격리되어 있으며, 이전 리뷰에서 제기된 `applyHtmlLang` 호출 순서 불일치, 2-effect 경쟁 조건, DOM 정리 비대칭성 등의 WARNING들은 현재 코드에서 해소된 상태다. 새로 주목해야 할 부분은 두 가지다: 모듈 스코프 `/g` 플래그 정규식 `INTERPOLATION_RE`는 현재 `replace()` 사용에서는 안전하지만 `exec()`/`test()` 직접 사용 시 `lastIndex` 오염 위험이 잠재하며, `index.ts`의 `"use client"` 선언이 `translate` 같은 순수 함수를 서버 컴포넌트 import 경로에서 차단하여 암묵적인 split convention을 강제한다.

### 위험도

**LOW**