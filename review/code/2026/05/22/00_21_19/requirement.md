# Requirement Review

## 리뷰 대상

- `codebase/backend/src/modules/llm/llm.service.spec.ts` — `withRetry` Retry-After 통합 테스트 3건 추가
- `codebase/frontend/src/components/layout/sidebar.tsx` — 알림 popover close/toggle 리팩터링

---

## 발견사항

### 파일 1: `llm.service.spec.ts`

---

**[INFO] useEffect 의존성 배열에 `closeNotif` 누락 (sidebar — 파일2 선행 분석 중 확인)**

이 항목은 아래 파일2 섹션에 기술됩니다. 파일1(spec.ts) 자체에는 관련 없음.

---

**[INFO] plan 체크리스트 항목과 테스트 커버리지 100% 일치**

- 위치: `plan/in-progress/llm-retry-after.md §2` 체크리스트 vs 추가된 3개 `it` 블록
- 상세: plan §2 마지막 3개 항목 ("429 + Retry-After=2", "429 + Retry-After 없음 → 1s exponential", "429 + Retry-After=100 > 60s") 이 각각 `it` 케이스에 정확히 대응. 기능 완전성 측면 결손 없음.

---

**[INFO] spec 문서로 직접 정의된 `withRetry` backoff 알고리즘 명세 부재 — spec fidelity grey zone**

- 위치: 코드 주석 `// plan/llm-retry-after.md §2`
- 상세: `spec/4-nodes/3-ai/1-ai-agent.md §?` 에는 `LLM_RATE_LIMITED` 에러 코드와 `error` 포트 라우팅이 정의되어 있으나, `withRetry` 의 backoff 알고리즘(Retry-After 헤더 우선, 60s 상한, exponential fallback) 은 `plan/in-progress/llm-retry-after.md` 의 "결정 사항" 섹션에만 있고 `spec/` 에는 명세가 없다. 코드는 plan 과 완전히 일치하므로 구현 자체의 결함은 없다. 단, spec 에 요구사항이 기술되지 않은 상태는 향후 spec 동기화 대상임. 수정은 `project-planner` 위임.

---

**[INFO] `Retry-After` 헤더 대소문자 처리 — 테스트는 소문자 key 만 검증**

- 위치: spec.ts `makeRateLimitError` 헬퍼 / 통합 테스트 3건
- 상세: 통합 테스트의 `makeRateLimitError` 는 `err.headers = { 'retry-after': '2' }` 소문자 키만 사용. `extractRetryAfterMs` 의 대소문자 무관 처리(`headers['retry-after'] ?? headers['Retry-After'] ?? headers['RETRY-AFTER']`)는 별도 단위 테스트(`describe('extractRetryAfterMs')` 의 `Retry-After` / `RETRY-AFTER` 케이스)에서 이미 커버됨. 통합 테스트에서 중복 커버할 필요는 없으나, 실 SDK(`Anthropic APIError`) 가 어떤 케이스로 헤더를 노출하는지에 대한 통합 케이스는 없음. 기능 완전성 위협 없음 — INFO 수준.

---

**[INFO] `jest.advanceTimersByTimeAsync` 가 `closeNotif` 의 두 번째 `setNotifFilter` setState 와 race 할 가능성 없음 — 정상**

- 위치: 3개 `it` 블록 공통
- 상세: 테스트는 `service.chat(...)` 만 호출하므로 React state 와 무관. fake timer 패턴은 `withRetry` 내부 `setTimeout` 을 정확하게 제어. 케이스 패턴에 논리적 결함 없음.

---

### 파일 2: `sidebar.tsx`

---

**[WARNING] `useEffect` 의존성 배열에 `closeNotif` 누락**

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/llm-retry-after-a24e5e/codebase/frontend/src/components/layout/sidebar.tsx` 라인 312–334
- 상세: `handleClickOutside` 클로저 내부에서 `closeNotif` 를 호출하지만 의존성 배열은 `[userMenuOpen, notifOpen, workspaceMenuOpen]` 만 포함하고 `closeNotif` 가 빠져 있다. `closeNotif` 는 `useCallback([], [])` 로 생성되어 레퍼런스가 불변이기 때문에 실제 런타임 버그가 발생할 가능성은 낮다. 그러나 `exhaustive-deps` ESLint 규칙에 위배되며, 향후 `closeNotif` 의 dependency 가 확장될 경우 stale closure 버그가 잠재한다.
- 제안: 의존성 배열을 `[userMenuOpen, notifOpen, workspaceMenuOpen, closeNotif]` 로 수정.

---

**[INFO] `toggleNotif` 내부에서 `setNotifFilter("all")` 을 `setNotifOpen` 의 updater 함수 안에서 호출하는 패턴의 안전성**

- 위치: 라인 271–276 (`toggleNotif` 콜백)
- 상세: `setNotifOpen((prev) => { if (prev) setNotifFilter("all"); return !prev; })` 패턴은 React 의 배치 업데이트 보증 하에 동작한다. updater 함수 내부에서 다른 setter 를 호출하는 것은 React 18+ 에서 `flushSync` 없이 허용되나 공식 패턴이 아니다. 그러나 주석에 의도가 명시되어 있고, 대안(`closeNotif` 에서 두 setState 를 순서대로 호출) 도 코드에 이미 존재하므로 기능 완전성 위협은 없음.

---

**[INFO] spec/2-navigation/_layout.md §3.1 에 notification filter chip 정의 부재 — spec fidelity gap**

- 위치: sidebar.tsx 라인 478 주석 `spec/2-navigation/4-integration.md §11.2`
- 상세: `spec/2-navigation/_layout.md §3.1` (알림 벨 명세) 는 팝오버 열기/닫기·읽음/닫기 액션만 기술하며 "type 필터 칩" 에 대한 요구사항이 없다. sidebar.tsx 는 이 기능을 `spec/2-navigation/4-integration.md §11.2` 의 `integration_action_required` 를 근거로 구현하나, §11.2 에도 sidebar popover 의 칩 필터 UI 명세는 없다. 기능 동작 자체는 plan 의도와 일치하지만 spec 에 명세가 없다. `project-planner` 가 `_layout.md §3.1` 또는 신규 섹션에 칩 필터 요구사항을 추가해야 한다.

---

**[INFO] `handleCtaClick` 이 `href` 없는 `integration_action_required` 알림에 대해 popover 만 닫고 이동하지 않는 동작 — 의도적**

- 위치: 라인 295–309 (`handleCtaClick`)
- 상세: `closeNotif()` 는 href 유무와 무관하게 호출되고 `if (href) router.push(href)` 는 href 가 없으면 건너뛴다. `integration_action_required` 타입은 `notificationHref` 에서 항상 `/integrations` 를 반환하므로 실질적으로 href 가 null 이 되지 않는다. 단, 향후 새 알림 타입에 동일 CTA 패턴이 적용되고 href 가 null 인 경우 popover 만 닫히고 이동 없이 종료된다. 이는 JSDoc 주석에 "href 유무에 관계없이 popover 닫힘을 보장" 으로 의도가 명시되어 있어 기능 완전성 결함이 아님.

---

**[INFO] `notifListQuery` 가 `notifOpen = true` 일 때만 활성화되는데, `closeNotif` 가 `notifOpen` 을 false 로 전환한 직후 query 가 비활성화되어 다음 진입 시 재조회됨 — 의도적**

- 위치: 라인 212–219 (`notifListQuery`)
- 상세: `enabled: notifOpen` 이므로 popover 가 닫히면 query 가 비활성화된다. 이는 서버 데이터 최신화를 위해 재진입마다 조회를 다시 트리거하는 의도된 설계. 기능 결함 없음.

---

## 요약

**파일 1 (llm.service.spec.ts):** `plan/in-progress/llm-retry-after.md §2` 가 명시한 3개 통합 테스트 시나리오(Retry-After 존중 / exponential fallback / 60s cap)가 빠짐없이 구현되어 있으며, fake timer 패턴으로 실제 대기 없이 `setTimeout` 인자를 정확히 검증한다. `extractRetryAfterMs` 의 edge case 커버리지(대소문자, HTTP-date, 음수, null 등)도 별도 단위 테스트로 충분히 확보되어 있다. plan 대비 기능 완전성은 결함이 없다. 다만 `withRetry` 의 backoff 알고리즘은 `spec/` 에 명세가 없고 `plan/` 에만 정의되어 있어 spec 동기화가 필요하다.

**파일 2 (sidebar.tsx):** `useEffect` 의존성 배열에 `closeNotif` 가 누락된 WARNING 한 건이 발견된다. `closeNotif` 의 `useCallback` 의존성이 현재 비어 있어 런타임 버그 발생 가능성은 낮지만 `exhaustive-deps` 규칙 위배이며 stale closure 잠재 위험이 있다. 그 외 `toggleNotif` / `closeNotif` 의 setState 분리, CTA 클릭 시 popover 닫힘 보장, filter chip 등 변경 사항의 기능 완전성은 plan 의도와 일치한다. `_layout.md §3.1` 에 filter chip 요구사항이 누락되어 있어 spec fidelity gap이 존재한다.

## 위험도

LOW
