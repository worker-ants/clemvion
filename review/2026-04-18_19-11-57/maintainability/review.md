### 발견사항

---

**[WARNING]** `STORAGE_KEY`가 스토어와 테스트 파일에 중복 정의됨
- 위치: `locale-store.ts:6`, `locale-store.test.ts:4`
- 상세: `"idea-workflow.locale"` 문자열 상수가 두 파일에 각각 별도로 선언되어 있다. 스토어에서 키를 변경해도 테스트 파일은 컴파일 에러 없이 무음으로 틀어진다. 테스트가 실제 스토어 동작을 검증하는 것처럼 보이지만, 암묵적으로 다른 키를 바라볼 수 있다.
- 제안: `STORAGE_KEY`를 `locale-store.ts`에서 export하고 테스트에서 임포트하여 단일 소스로 관리

---

**[WARNING]** `PathInto<T>` 타입의 비표준 명명과 제약 미문서화
- 위치: `core.ts:10-17`
- 상세: 재귀 조건부 타입의 이름 `PathInto`는 생태계에서 통용되는 명칭(`DeepKeyOf`, `Paths`, `DotNotation`)과 다르다. 더 중요하게는, `Dict` 의 값이 `undefined`이거나 필드가 optional이 되거나 배열을 포함할 경우 `PathInto`가 해당 키를 `never`로 처리하여 조용히 키를 누락시킨다. 이 동작 제약이 어디에도 문서화되지 않아, `Dict` 구조 변경 시 예상치 못한 타입 오류 혹은 무음 누락이 발생할 수 있다.
- 제안: 타입 이름을 `DotKeyOf<T>` 등 관용적인 이름으로 변경하거나, 현재 이름 유지 시 "string values only, no arrays, no optional fields" 제약을 주석에 명시

---

**[INFO]** `useT()`와 `useLocale()`에서 스토어 구독 보일러플레이트 중복
- 위치: `index.ts:18-22`, `34-37`
- 상세: `useSyncExternalStore(useLocaleStore.subscribe, () => useLocaleStore.getState().locale, () => DEFAULT_LOCALE)` 구문이 두 훅에 동일하게 반복된다. 현재 두 곳이지만, 세 번째 훅 추가 시 패턴이 세 곳으로 늘어난다.
- 제안: 파일 내부 전용 헬퍼 `function useCurrentLocale()` 로 추출하여 두 훅이 재사용

---

**[INFO]** `setUser` 테스트 헬퍼가 User 타입을 인라인 객체 리터럴로 구성
- 위치: `locale-sync.test.tsx:12-24`
- 상세: `{ id: "1", email: "a@b.c", name: "A", locale, theme: "light" }` 형태로 User 객체를 직접 조립하고 있다. `auth-store`의 `User` 타입이 필수 필드를 추가하거나 변경하면 런타임 테스트 실패로만 감지된다.
- 제안: auth 스토어에서 `User` 타입을 임포트하여 헬퍼 파라미터 또는 반환값에 명시적으로 타입 지정

---

**[INFO]** `resetStore`(singular) / `resetStores`(plural) 네이밍 불일치
- 위치: `locale-store.test.ts:6`, `locale-sync.test.tsx:7`
- 상세: 동일한 개념의 테스트 초기화 함수가 각 파일에서 다른 이름으로 선언되어 있다. 각자의 파일 스코프이므로 동작 문제는 없으나, 두 파일을 함께 읽을 때 혼란을 준다.
- 제안: 둘 다 `resetStore`로 통일하거나, 공유 테스트 픽스처 파일로 추출

---

**[INFO]** `locale-sync.tsx` JSDoc이 구현 대비 과도하게 장황함
- 위치: `locale-sync.tsx:8-18`
- 상세: 36줄짜리 컴포넌트에 11줄 JSDoc이 붙어 있다(전체의 약 30%). 로그아웃 시 locale 유지 정책처럼 비자명한 동작의 설명은 가치 있지만, `"Side effects … are issued through …"` 단락은 코드를 읽으면 자명한 내용이다.
- 제안: 로그아웃 locale 보존 정책 설명만 남기고, 구현 구조(side effect 경로)에 대한 설명은 제거하여 4-5줄로 압축

---

### 요약

이번 i18n 구현은 유지보수성 관점에서 전반적으로 우수하다. 특히 두 개의 `useEffect`를 단일 if/else로 통합한 `LocaleSync` 리팩토링은 이전에 지적된 암묵적 실행 순서 의존을 완전히 제거한 탁월한 개선이며, `INTERPOLATION_RE` 상수화, `applyHtmlLang` 이중 mutation 방지, `translate()`의 fallback 이중 lookup 최적화도 모두 적절히 반영되어 있다. 핵심 유지보수 리스크는 `STORAGE_KEY` 상수의 이중 정의 — 이 값이 변경되면 테스트가 조용히 틀어진다 — 와 `PathInto<T>` 타입의 동작 제약이 문서화되지 않은 점이다. 나머지 항목은 코드베이스 성장 시 복잡도를 줄이는 경량 개선들이다.

### 위험도

**LOW**