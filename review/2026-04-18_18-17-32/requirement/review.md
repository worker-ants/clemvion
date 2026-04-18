### 발견사항

---

**[WARNING]** `interpolate`에서 누락된 파라미터를 빈 문자열로 무음 치환

- **위치**: `core.ts:27-31`
- **상세**: `params` 객체에 존재하지 않는 `{{key}}`는 `""` 으로 치환된다. 예를 들어 `translate("ko", "workspace.created", { nme: "Test" })` (오타)는 `"팀 워크스페이스 ''을(를) 만들었어요"` 를 반환한다. `TranslationKey` 타입이 키 이름은 보호하지만 `params` 는 `Record<string, string | number>` 이어서 파라미터 이름 오타는 컴파일 타임에 잡히지 않는다. 프로덕션에서 빈 텍스트로만 나타나 탐지가 어렵다.
- **제안**: `process.env.NODE_ENV !== "production"` 블록 안에서 `params` 에 존재하는데 template에서 사용되지 않는 키, 또는 template에 있는데 `params`에 없는 키를 `console.warn` 으로 경고. 혹은 반환 전 `""` 대신 `_match` (원본 `{{key}}`) 를 유지하는 방어적 옵션 제공.

---

**[WARNING]** 사용자 로그아웃 후 locale 처리 정책이 구현·테스트 모두에 빠져 있음

- **위치**: `locale-sync.tsx:17-21`, `locale-sync.test.tsx`
- **상세**: `user` 가 `{locale: "en"}` → `null` 로 전환될 때 effect 가 재실행되지만 조건 `user?.locale && isLocale(user.locale)` 이 false 여서 아무 일도 일어나지 않는다. locale 은 이전 값 유지된다. localStorage 에 동일 값이 기록되어 있으므로 실질적 오작동은 아니지만, 다음 사용자가 같은 브라우저에서 로그인하면 `initFromStorage` 가 전 사용자의 locale 로 초기화한 뒤 프로필 로드 전까지 해당 언어로 UI 가 노출된다. 이 동작이 의도적인지 여부가 코드·주석·테스트 어디에도 명시되지 않아 회귀 감지가 불가능하다.
- **제안**: `locale-sync.test.tsx` 에 `user → null` 전환 케이스 추가. 동작이 의도적이라면 `locale-sync.tsx` 에 주석으로 명시.

---

**[INFO]** `initFromStorage` 재호출 시 user-synced locale을 덮어쓸 수 있는 경로

- **위치**: `locale-sync.tsx:12-15`
- **상세**: `initFromStorage` 의 의존성은 zustand 함수 참조로 안정적이어서 실제로는 마운트 1회만 실행된다. 그러나 만약 `LocaleSync` 가 언마운트/재마운트되는 시나리오(레이아웃 전환, Strict Mode 이중 호출 등)가 생기면 `initFromStorage` 가 localStorage 값으로 store 를 덮어쓴 뒤 두 번째 effect 가 `user.locale` 로 재설정하는 순서가 보장되지 않을 수 있다. React Strict Mode 에서는 effect 가 mount→unmount→mount 순서로 두 번 실행된다.
- **제안**: `initFromStorage` 를 `useRef` 로 래핑하거나, `LocaleSync` 가 반드시 한 번만 마운트된다는 전제를 문서화. 현재 테스트에서 Strict Mode 시나리오 미검증.

---

**[INFO]** `interpolate`의 `value === null` 방어 코드가 타입과 불일치

- **위치**: `core.ts:29`
- **상세**: `params` 타입이 `Record<string, string | number>` 이므로 `null` 은 TypeScript 상 전달 불가. 그러나 런타임 방어 코드 `value === null ? "" : String(value)` 가 존재한다. 이 코드가 없어도 `String(null)` 은 `"null"` 을 반환하여 오히려 UI 에서 파라미터 누락을 감지하기 쉬워진다. 현재 구현은 null 도 빈 문자열로 숨긴다.
- **제안**: 타입 선언과 런타임 방어를 일치시키거나(null 제거), null 의 경우에도 개발 환경 경고를 남기는 방향 검토.

---

**[INFO]** `locale-sync.test.tsx`의 `initFromStorage` 케이스에서 `document.documentElement.lang` 미검증

- **위치**: `locale-sync.test.tsx:24-30`
- **상세**: `"initializes from localStorage on mount"` 테스트가 locale store 상태는 확인하지만 `document.documentElement.lang` 갱신 여부를 확인하지 않는다. `locale-store.test.ts` 는 이를 검증하므로 `LocaleSync` 통합 레벨에서도 같은 확인이 필요하다.
- **제안**: `expect(document.documentElement.lang).toBe("en")` 를 해당 테스트에 추가.

---

### 요약

핵심 i18n 인프라(타입 안전 키, 폴백 체인, Zustand 기반 store, `LocaleSync` 초기화 흐름)는 요구사항을 충실히 구현하고 있다. 주요 기능 완전성 문제는 `interpolate` 의 파라미터 누락 무음 처리로, 파라미터 이름 오타가 빈 텍스트로만 나타나 프로덕션에서 탐지하기 어렵다. 또한 로그아웃 시 locale 유지 동작이 의도적인지 여부가 코드·테스트 어느 곳에도 명시되지 않아 사양의 공백이 존재한다. 나머지는 에지 케이스 문서화 수준의 개선 사항이다.

### 위험도
**MEDIUM**