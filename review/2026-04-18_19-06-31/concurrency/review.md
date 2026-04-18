### 발견사항

이미 이전 리뷰(2026-04-18_18-17-32)에서 지적된 사항들이 RESOLUTION.md에 따라 반영된 이후의 코드입니다.

---

- **[INFO]** 모듈 상수 정규식에 `g` 플래그 사용
  - 위치: `core.ts:12` — `const INTERPOLATION_RE = /\{\{\s*(\w+)\s*\}\}/g`
  - 상세: `g` 플래그가 붙은 정규식 객체는 `lastIndex` 상태를 가집니다. 그러나 `String.prototype.replace()`는 호출 전 `lastIndex`를 0으로 리셋하므로 현재 사용 패턴에서는 안전합니다. JavaScript 단일 스레드 모델상 `replace()` 실행 중 다른 호출이 끼어들 수 없습니다.
  - 제안: 현 사용 방식은 안전. 다만 향후 `exec()`나 `test()` 루프로 변경 시 `lastIndex` 오염이 발생할 수 있으므로 `g` 플래그 없는 버전(`/\{\{\s*(\w+)\s*\}\}/`)으로 교체를 고려하세요.

- **[INFO]** `setLocale` 내 DOM → storage → state 순서
  - 위치: `locale-store.ts:29-40`
  - 상세: RESOLUTION.md의 #7 조치대로 `applyHtmlLang` → `localStorage.setItem` → `set({ locale })` 순서로 정렬되어 있습니다. Zustand 구독자는 DOM·storage가 이미 갱신된 상태에서 알림을 받으므로 일관성이 보장됩니다. JS 단일 스레드 환경에서 세 연산은 이벤트 루프를 양보하지 않으므로 원자성이 실질적으로 충족됩니다.
  - 제안: 현 구조 유지.

- **[INFO]** 비동기 핸들러 내 locale 스냅샷 타이밍
  - 위치: `locale-sync.tsx`의 `useEffect` — `userLocale` 클로저 캡처
  - 상세: effect가 시작되는 시점에 `userLocale`을 캡처하여 사용합니다. `await` 구간이 없으므로 비동기 중 locale 변경 불일치 문제는 이 컴포넌트에서는 발생하지 않습니다.

---

### 요약

리뷰 대상 파일들은 i18n 로케일 관리 인프라로, JavaScript 단일 스레드 모델 덕분에 전통적 멀티스레드 동시성 문제(데드락, 레이스 컨디션)는 존재하지 않습니다. 이전 리뷰에서 지적된 이중 `useEffect`(#6)와 state 발행 순서(#7) 문제는 RESOLUTION.md대로 수정이 반영되었습니다. `useSyncExternalStore` 사용으로 React 18 concurrent mode tearing이 방지되고 있으며, 남은 사항은 모듈 상수 정규식의 `g` 플래그 사용에 대한 주의 정도입니다.

### 위험도
**LOW**