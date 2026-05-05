### 발견사항

- **[INFO]** `document.body.style.overflow` 공유 상태 경합
  - 위치: `slide-drawer.tsx` — `useEffect` (overflow 제어)
  - 상세: 두 개의 `SlideDrawer` 인스턴스가 동시에 마운트되어 있을 때, 하나가 닫히면 `document.body.style.overflow = ""` 를 무조건 초기화한다. 다른 드로어가 여전히 열려 있어도 마찬가지여서 body 스크롤이 복원돼버린다. 이 diff 에서 도입된 코드는 아니지만, `FocusScope` 추가로 드로어가 중첩 사용될 가능성을 높였다.
  - 제안: ref counter 또는 전역 count 방식으로 보호 — `open` 될 때 +1, 닫힐 때 -1, count가 0일 때만 overflow 복원

- **[INFO]** Playwright `fullyParallel: true` + `retries: 0` 조합의 플래키 위험
  - 위치: `playwright.config.ts` lines 13–14
  - 상세: 로컬에서 `workers` 가 `undefined`(CPU 코어 수 자동)이므로 여러 브라우저 컨텍스트가 동시에 동일한 dev 서버에 요청을 보낸다. 테스트 자체는 read-only 이지만, dev 서버 cold start 중이거나 axe 분석이 오래 걸릴 때 `retries: 0` 이면 일시적 타임아웃이 바로 실패로 기록된다.
  - 제안: CI 조건에 `retries: process.env.CI ? 1 : 0` 을 추가해 transient 장애 대응. 이미 주석에 "CI 도입 시 1~2로 올림"이 언급되어 있으므로 이를 코드로 반영 권장

- **[INFO]** `aria-live="polite"` + `aria-atomic="true"` 의 동시 업데이트 처리
  - 위치: `run-results-drawer.tsx` — header 의 `role="status"` div
  - 상세: `aria-atomic="true"` 로 region 전체를 원자적으로 announce 하도록 지정한 것은 올바르다. 단, 실행 상태가 빠르게 연속 변경될 때(`running → completed` 를 밀리초 단위로 반복) 일부 스크린 리더는 중간 announce 를 건너뛸 수 있다. `aria-live="assertive"` 로 바꿔 끼어들기를 허용하면 즉각성은 높아지나 UX 가 시끄러워질 수 있다. 현재 `polite` 선택은 적절한 트레이드오프.
  - 제안: 현 상태 유지. 추후 실행 상태 전환이 100 ms 이내로 연속 발생하는 경우에만 재검토

---

### 요약

이번 변경은 ARIA 속성 추가, 스킵 링크, FocusScope 도입 등 접근성 개선이 주목적이며, 본질적으로 동시성 위험이 낮은 UI 레이어 코드다. `document.body.style.overflow` 공유 DOM 상태 경합은 기존 코드에서 이어진 잠재적 문제로 이번 diff 가 `FocusScope` 를 추가해 드로어 중첩 가능성을 소폭 높였지만 실제 앱 흐름에서 두 드로어가 동시에 열릴 시나리오는 드물다. Playwright 설정의 `fullyParallel: true` + `retries: 0` 조합은 dev 서버 공유 환경에서 일시적 실패를 대비하지 못하는 점만 주의하면 된다.

### 위험도
**LOW**