### 발견사항

- **[WARNING]** `buildSearchIndex` 동기 파일 I/O가 모든 locale × 모든 문서 수만큼 레이아웃 렌더 시 반복 실행됨
  - 위치: `frontend/src/app/(main)/docs/layout.tsx` — `LOCALES.map(locale => buildSearchIndex(index, locale))`; `registry.ts` — `fs.readFileSync(bodyPath, "utf8")` in loop
  - 상세: `DocsLayout`는 sync 서버 컴포넌트이므로 Next.js Full Route Cache가 miss 될 때마다 모든 로케일에 대해 전체 MDX 파일을 동기 I/O로 읽어 들임. Node.js는 단일 스레드이므로 동시 요청이 몰리면 이 루프가 이벤트 루프를 블로킹하여 다른 요청의 응답 지연을 유발함
  - 제안: `buildSearchIndex` 결과를 모듈 수준 Map으로 메모이즈하거나(`index` 버전 기반 캐시 키 사용), `getDocsIndex()`와 같은 lazy singleton 패턴 적용. 또는 `fs.readFile` 비동기 버전으로 교체 후 `Promise.all`로 병렬화 고려

- **[INFO]** `DocsLocaleUrlSync` useEffect에서 locale 빠른 전환 시 중복 `router.replace` 가능성
  - 위치: `docs-locale-url-sync.tsx` — `useEffect([locale, pathname, router])`
  - 상세: locale이 빠르게 연속 변경될 경우 pathname이 아직 갱신되지 않은 상태에서 effect가 재실행되어 `router.replace`가 중복 호출될 수 있음. Next.js App Router는 내부적으로 이를 병합 처리하므로 실제 버그로 이어지진 않음
  - 제안: debounce 적용 또는 현재 구현 유지 (Next.js 라우터가 멱등 처리)

- **[INFO]** `detectAvailableLocales` — `fs.existsSync` 동기 호출이 인덱스 빌드 시 중첩 루프 실행
  - 위치: `registry.ts` — `detectAvailableLocales` 내 `fs.existsSync(siblingPath)` per locale per page
  - 상세: 빌드/초기화 시점에만 실행되므로 실제 동시성 문제는 없으나, 문서 수가 늘면 HMR reload 속도에 영향
  - 제안: `fs.readdirSync` 결과를 Set으로 변환 후 lookup으로 교체하면 syscall 횟수를 O(pages × locales) → O(pages) 로 줄일 수 있음

---

### 요약

이 변경셋은 프론트엔드 Next.js SSR/클라이언트 코드이며 진통적인 멀티스레드 동시성 문제(락, 데드락, 레이스컨디션)와는 거리가 멀다. Node.js 단일 스레드 이벤트 루프 관점에서 가장 주목할 부분은 `buildSearchIndex`가 매 레이아웃 렌더 시 전체 로케일×전체 문서를 동기 파일 I/O로 처리하는 점으로, 동시 요청 폭증 시 이벤트 루프 블로킹을 야기할 수 있다. 쿠키 미러링(`writeLocaleCookie`)과 서버 사이드 `readLocaleCookie`는 각각 브라우저 단일 스레드와 Next.js 요청 스코프 내에서 안전하게 동작한다.

### 위험도
**LOW**