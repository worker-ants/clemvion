### 발견사항

**[WARNING] 모듈 레벨 전역 캐시 (`cachedIndex`)**
- 위치: `registry.ts:174` — `let cachedIndex: DocsIndex | null = null;`
- 상세: `getDocsIndex()`가 모듈 싱글턴 캐시를 사용한다. Node.js 프로세스 내에서 `NODE_ENV`가 변경되거나, 테스트 간 모듈 상태가 공유되면 캐시가 오염된다. Vitest 등의 테스트 환경에서 모듈이 재사용될 경우 첫 번째 호출 시점의 값이 고정되어 이후 테스트에서 다른 `root`나 옵션을 사용하더라도 캐시된 결과를 반환하는 문제가 발생할 수 있다.
- 제안: 테스트 코드가 `getDocsIndex()` 대신 `loadDocsIndex()`를 직접 호출하고 있어 현재는 안전하지만, `cachedIndex`를 초기화할 수 있는 `resetDocsCache()` 함수를 export하거나, Next.js의 `unstable_cache` 등 프레임워크 수준 캐싱으로 교체하는 것을 권장한다.

---

**[WARNING] `getDocsIndex()`의 `process.env.NODE_ENV` 읽기 타이밍**
- 위치: `registry.ts:176-179`
- 상세: `NODE_ENV`를 캐시 초기화 시점(첫 호출)에만 읽는다. 캐시가 한 번 채워지면 이후 `NODE_ENV`가 변경되어도 반영되지 않는다. 특히 테스트 환경에서 `NODE_ENV=production`으로 변경 후 호출하면 draft 포함 여부가 잘못 동작할 수 있다.
- 제안: 현재 구조상 빌드타임 전용 함수이므로 허용 범위 내이지만, 주석으로 "캐시는 프로세스 생명주기 동안 유지"임을 명시할 것.

---

**[INFO] `useMDXComponents`의 컴포넌트 병합 순서**
- 위치: `mdx-components.tsx:32`
- 상세: `{ ...docsComponents, ...components }` — 호출자가 전달하는 `components`가 `docsComponents`의 `a` 태그 override를 덮어쓸 수 있다. 이는 의도된 설계일 수 있으나, `a` 태그의 보안 속성(`rel="noopener noreferrer"`)이 호출자 컴포넌트로 교체될 경우 외부 링크에 대한 보안 처리가 사라진다.
- 제안: 문서화로 충분하나, `a` 컴포넌트만큼은 호출자가 override하지 못하도록 병합 순서를 반전(`{ ...components, ...docsComponents }`)하거나 명시적 주의사항을 추가하는 것을 권장한다.

---

**[INFO] `fixtures-broken` 디렉터리 미존재 처리**
- 위치: `registry.test.ts:46-48`
- 상세: `loadDocsIndex(brokenRoot)`에서 `brokenRoot`가 존재하지 않으면 `listSectionDirs()`가 빈 배열을 반환하여 예외가 던져지지 않는다. 테스트의 의도(frontmatter 검증 실패 시 예외)와 실제 동작이 다를 수 있다.
- 제안: `fixtures-broken` 디렉터리와 잘못된 frontmatter를 가진 `.mdx` 파일을 실제로 추가하거나, 테스트 내에서 존재 여부를 사전 확인하는 코드를 추가해야 한다.

---

**[INFO] `fs.readFileSync`의 동기 I/O**
- 위치: `registry.ts:114-115`
- 상세: 빌드타임 전용 함수이므로 현재는 문제없지만, 만약 런타임 요청 경로에서 `loadDocsIndex()`가 호출될 경우 동기 파일 I/O가 이벤트 루프를 블로킹한다.
- 제안: `getDocsIndex()`의 호출이 서버 컴포넌트 또는 `generateStaticParams()`로만 이루어지도록 아키텍처를 제한하고, 주석으로 명시한다.

---

### 요약

전반적으로 부작용 위험도는 낮다. `registry.ts`의 모듈 레벨 싱글턴 캐시(`cachedIndex`)가 가장 주목할 부분으로, 테스트 격리나 `NODE_ENV` 변경 시나리오에서 예상치 못한 캐시 오염이 발생할 수 있다. 테스트 코드가 현재 `loadDocsIndex()`를 직접 사용하므로 즉각적인 문제는 없으나, `getDocsIndex()`를 사용하는 코드가 추가될 경우 캐시 초기화 수단이 없어 테스트 신뢰성이 저하된다. `mdx-components.tsx`의 컴포넌트 병합 순서는 의도를 명확히 해야 하며, `fixtures-broken` 테스트는 실제 깨진 픽스처 파일 없이는 의도한 동작을 검증하지 못한다.

### 위험도

**LOW**