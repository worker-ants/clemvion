이제 리뷰를 작성합니다.

---

### 발견사항

---

**[INFO]** `interpolate` 내 `value === null` 방어 코드가 타입과 불일치하는 dead code

- **위치**: `core.ts:41`
- **상세**: `params` 타입이 `Record<string, string | number>`이므로 TypeScript 상 `null`은 전달 불가능하다. 그러나 `value === undefined || value === null` 조건이 존재하며, `null` 분기는 컴파일러상 도달 불가 코드다. 이 분기가 `undefined`와 함께 묶여 있어 `null`이 빈 문자열로 조용히 처리되는데, 런타임으로 `as any`를 통해 `null`이 유입될 경우 `String(null)` = `"null"` 이 더 탐지하기 쉬운 결과를 냈을 것이다.
- **제안**: `undefined` 케이스만 남기고 `null` 분기를 제거하거나, `null`에 대해서도 `development` 경고를 추가. 현재 구현은 `null`을 무음으로 숨긴다.

---

**[INFO]** `translate` params 타입이 placeholder 이름을 컴파일 타임에 강제하지 않음

- **위치**: `core.ts:60`, `core.ts:79`
- **상세**: `TranslationKey` 타입으로 키 이름은 보호되나, `params: Record<string, string | number>`는 임의의 문자열 키를 허용한다. `translate("ko", "workspace.created", { nme: "Test" })` 같은 파라미터 이름 오타는 컴파일 타임에 감지되지 않고, 프로덕션에서 `""` 으로만 나타난다. 개발 환경 `console.warn`이 존재하지만 production 배포 전 테스트를 통과해도 파라미터 불일치가 은닉된다.
- **제안**: 현재 규모에서 타입 수준 강제는 복잡성이 크므로 낮은 우선순위. 단, 개발 환경 경고(`core.ts:42-44`)가 이미 존재하므로 실용적으로는 허용 가능하다.

---

**[INFO]** `useT()`·`useLocale()` 훅의 테스트가 리뷰 대상에 포함되지 않음

- **위치**: `index.ts:17-39` — `useT`, `useLocale` 내보내기
- **상세**: 리뷰 대상 테스트 파일(`locale-sync.test.tsx`, `locale-store.test.ts`)은 store와 `LocaleSync` 컴포넌트를 검증하지만, 공개 API인 `useT()`와 `useLocale()` 훅 자체의 동작(locale 변경 시 리렌더 유발, `useCallback` 메모이제이션)을 검증하는 테스트가 포함되지 않았다. `useSyncExternalStore` 기반 구독이 올바르게 동작하는지 통합 레벨에서 검증이 없다.
- **제안**: `index.test.tsx` 또는 `useT.test.tsx`를 추가해 locale 변경 시 컴포넌트 리렌더, `TFunction` 반환값 동작을 최소 2개 케이스로 검증.

---

**[INFO]** 이전 리뷰에서 지적된 다수 항목이 이미 조치됨 — 상태 확인

아래 항목들은 이전 리뷰(2026-04-18_17-14-03)에서 WARNING으로 지적되었으나 현재 코드에서 해소 확인:

| 이전 지적 | 조치 여부 |
|---|---|
| `INTERPOLATION_RE` 매 호출 재생성 | ✓ 모듈 상수로 이동 (line 21) |
| `locale === "ko"` 이중 lookup | ✓ `locale === DEFAULT_LOCALE` 분기로 단락 처리 (line 65-67) |
| `applyHtmlLang` 동일 값 무조건 갱신 | ✓ 변경 시에만 갱신 guard 추가 (line 24) |
| 로그아웃 정책 미명시 | ✓ JSDoc 주석으로 명시 (locale-sync.tsx:8-18) |
| `user → null` 테스트 없음 | ✓ "keeps the last known locale on logout" 테스트 추가 (line 87-102) |
| `document.documentElement.lang` 미검증 | ✓ localStorage init 테스트에 검증 추가 (line 46) |
| localStorage `setItem` 예외 미테스트 | ✓ `QuotaExceededError` 케이스 추가 (locale-store.test.ts:34-47) |
| user locale 양방향 전환 미테스트 | ✓ "flips locale" 케이스 추가 (line 72-85) |
| `afterEach` 정리 비대칭 | ✓ `cleanup()` 후 localStorage·DOM 초기화로 대칭 정리 |
| 두 `useEffect` 순서 의존 미명시 | ✓ 단일 effect로 병합, 의도 주석 포함 |

---

**[INFO]** `translate()` 함수의 직접 단위 테스트가 리뷰 범위에 없음

- **위치**: `core.ts:57-75`
- **상세**: `translate()`의 폴백 체인(ko fallback), 누락 키 경고, interpolation 경계값(params=`{}`, `0` 값 등)을 검증하는 `core.test.ts` 또는 `i18n.test.ts`가 리뷰 대상에 포함되지 않았다. 이 파일의 존재 여부를 확인할 수 없어 기능 완전성 판단에 한계가 있다.
- **제안**: `i18n/__tests__/core.test.ts`가 존재한다면 리뷰 대상에 포함. 없다면 `translate()`의 핵심 경로(ko→en fallback, 누락 키 반환값, params 보간)를 커버하는 테스트 추가.

---

### 요약

핵심 i18n 인프라(타입 안전 키, 폴백 체인, Zustand store, `LocaleSync` 초기화)는 요구사항을 충실히 구현하고 있다. 이전 리뷰에서 지적된 WARNING 수준 이슈들(regex 재생성, 이중 lookup, `applyHtmlLang` 중복 DOM mutation, 로그아웃 정책 미명시, 테스트 갭)이 모두 해소된 것을 확인했다. 현재 남은 사항은 `null` 방어 코드의 타입 불일치(dead code), params 이름 오타의 컴파일 타임 미감지, 그리고 공개 훅(`useT`, `useLocale`)과 `translate()` 함수에 대한 직접 테스트 부재다. 구현 완성도는 높으나 공개 API 레벨 테스트 보강이 권장된다.

### 위험도

**LOW**