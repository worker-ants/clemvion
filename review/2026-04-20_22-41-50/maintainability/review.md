### 발견사항

---

**[WARNING]** `docs-link.tsx`에서 `rest` 변수 섀도잉
- 위치: `docs-link.tsx:38` 내부 `if (href.startsWith("/docs/") ...)` 블록
- 상세: 함수 인자로 디스트럭처링된 `...rest` (props 객체)와 내부에서 선언한 `const rest = href.slice("/docs/".length)`가 동일한 이름으로 충돌합니다. 내부 `rest`가 props를 가리므로, 이후 `<Link href={resolved} {...rest}>` 에서 `rest`가 어떤 값인지 즉시 알기 어렵습니다.
- 제안: 내부 변수를 `docPath`, `pathSuffix` 등으로 명명

---

**[WARNING]** 쿠키 키 문자열이 두 파일에 별도 상수로 중복 선언
- 위치: `locale-store.ts:6` (`COOKIE_KEY`), `server-locale.ts:4` (`LOCALE_COOKIE_NAME`)
- 상세: 두 상수 모두 `"idea-workflow.locale"` 값을 갖지만 별도 파일에 독립적으로 선언되어 있습니다. 한 쪽만 수정하면 서버-클라이언트 쿠키 동기화가 조용히 깨집니다.
- 제안: 공유 상수를 `lib/i18n/types.ts` 또는 별도 `constants.ts`에 선언하고 두 파일에서 import

---

**[WARNING]** `importEn` 변수명이 특정 locale에 종속
- 위치: `page.tsx:92`
- 상세: `const importEn = locale !== DEFAULT_LOCALE && doc.availableLocales.includes(locale);` — 변수명이 "영어만" 임포트한다는 의미로 읽히지만, 실제로는 "현재 locale에 번역본이 존재하는가"의 의미입니다. `ja`, `zh` 등 새 locale 추가 시 이름이 오해를 유발합니다.
- 제안: `const hasTranslation = ...` 또는 `const shouldImportTranslation = ...`으로 변경

---

**[WARNING]** `isLocaleSibling`의 locale 코드 정규식이 `[a-z]{2}` 2자로 고정
- 위치: `registry.ts:158`
- 상세: `zh-TW`, `pt-BR` 등 BCP 47 형식의 locale 코드가 추가될 경우 regex가 매칭하지 못해, sibling 파일이 canonical로 잘못 등록될 수 있습니다.
- 제안: `[a-z]{2,3}(-[A-Z]{2})?` 수준으로 확장하거나, 단순히 `LOCALES` 배열 기반으로 파일명 suffix를 직접 확인

---

**[WARNING]** `page.tsx`의 unknown locale 처리 주석이 실제 동작과 불일치
- 위치: `page.tsx:83-84`
- 상세: `// 알 수 없는 locale 코드("fr" 등)도 여기로 빠짐. DEFAULT_LOCALE로 교체.`라고 쓰여 있지만, 실제로는 `fr`가 docSlug의 일부로 포함된 `/docs/${cookieLocale}/fr/section/page` 경로로 redirect됩니다. 이후 `getDocBySlug`가 실패해 notFound가 되는 방식이지 "fr가 DEFAULT_LOCALE로 교체"되는 것은 아닙니다.
- 제안: 주석을 `// Unknown locale segment → ends up in docSlug → getDocBySlug returns null → notFound`로 정정

---

**[INFO]** `localizedDocsHref`가 `locale.ts`와 `registry.ts` 두 경로로 import 가능
- 위치: `locale.ts:58`, `registry.ts` re-export 블록
- 상세: `docs-sidebar.tsx`는 `@/lib/docs/locale`에서, `registry.test.ts`는 `@/lib/docs/registry`에서 동일 함수를 import합니다. 일관성 부재로 함수의 "소유권"이 모호합니다.
- 제안: 팀 convention을 정하고 하나의 경로만 사용

---

**[INFO]** `DocMeta.href`가 non-localized canonical href인데 네비게이션 코드와 혼용 위험
- 위치: `registry.ts:54`
- 상세: `href` 필드는 `/docs/section/slug` 형태지만 실제 링크는 항상 `localizedDocsHref(page.slug, locale)`을 사용해야 합니다. `page.href`를 직접 링크에 쓰면 locale 프리픽스 없는 경로가 생성되는데, 타입 시스템이 이를 막지 못합니다.
- 제안: 필드 이름을 `canonicalHref`나 `internalKey`로 바꾸거나, 링크 생성 전용 helper만 노출

---

**[INFO]** `registry.ts` `buildSearchIndex` 함수 끝에 불필요한 빈 줄 2개
- 위치: `registry.ts:309-310`
- 제안: 공백 1개로 통일

---

### 요약

전반적으로 locale 인식 URL 체계를 도입하는 설계가 명확하고 코드 구조도 일관성이 있습니다. 다만, 쿠키 키 상수 중복(`COOKIE_KEY` / `LOCALE_COOKIE_NAME`)과 `docs-link.tsx`의 `rest` 변수 섀도잉은 실제 버그로 이어질 수 있는 유지보수 위험입니다. `importEn` 네이밍과 `isLocaleSibling` 정규식의 locale 코드 제약은 locale 확장 시 조용히 깨질 수 있는 fragile 포인트입니다. 추가로, page.tsx 내 redirect 흐름의 주석이 실제 동작과 달라 코드 독해를 방해합니다.

### 위험도

**MEDIUM**