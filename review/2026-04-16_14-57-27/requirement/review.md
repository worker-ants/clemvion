## 발견사항

### [CRITICAL] `fixtures-broken` 디렉터리 미존재 시 테스트가 실패하거나 오탐을 낳아요
- **위치**: `registry.test.ts` — `"frontmatter 필수 필드 검증에 실패하면 예외를 던져요"` 케이스
- **상세**: `listSectionDirs`는 루트 경로가 없으면 `[]`를 반환하고, `loadDocsIndex`는 예외 없이 `{ sections: [], byHref: Map{} }`를 반환해요. `fixtures-broken` 디렉터리가 실제로 존재하지 않으면 `expect(...).toThrow()` 단언이 실패해요. 제공된 파일 목록에 해당 디렉터리가 보이지 않아요.
- **제안**: `fixtures-broken/01-section/invalid.mdx` 픽스처를 생성하거나, 존재하지 않는 루트가 예외를 던지지 않는 현재 동작이 의도한 것이라면 테스트 케이스를 수정해야 해요.

---

### [WARNING] `index.mdx` 섹션 랜딩 페이지 처리가 구현되지 않았어요 (Spec §9 누락)
- **위치**: `registry.ts` — `loadDocsIndex` 함수 전체
- **상세**: Spec §9는 "섹션 디렉터리에 `index.mdx`가 있으면 해당 섹션의 랜딩 페이지"로 처리해야 한다고 명시해요. 현재 구현은 `index.mdx`를 일반 파일로 취급해 `/docs/<section>/index` 슬러그를 생성해요. 섹션 진입점(예: `/docs/02-nodes`)으로의 리다이렉트 또는 특별 처리가 없어요.
- **제안**: `index.mdx`는 섹션 랜딩 슬러그(`/docs/<section>`)로 등록하거나, `DocsSection`에 `landingPage?: DocMeta` 필드를 추가해 별도 처리해야 해요.

---

### [WARNING] `spec`/`code` 경로 존재 검증 테스트가 없어요 (Spec §11 명시 요건)
- **위치**: `registry.test.ts` 전체
- **상세**: Spec §11은 "빌드 시 검증: `registry.ts` 단위 테스트에서 모든 `spec:`/`code:` 경로 존재 확인"을 **명시적으로 요구**해요. 현재 테스트 파일에는 해당 검증이 전혀 없어요. `DocFrontmatter` 인터페이스에 `spec`/`code` 필드가 있고 픽스처들에도 해당 필드를 쓸 수 있지만, 경로 실존 여부를 검사하는 테스트 케이스가 없어요.
- **제안**: `spec` 또는 `code` 필드에 존재하지 않는 경로가 있을 때 예외를 던지는 검증 로직과 대응 테스트를 추가해야 해요.

---

### [WARNING] `getDocsIndex()` 캐싱 함수가 테스트되지 않아요
- **위치**: `registry.ts:155–163`, `registry.test.ts` 전체
- **상세**: `getDocsIndex`는 모듈 수준 싱글턴(`cachedIndex`)을 사용하는 공개 API이지만 테스트가 없어요. 특히 `NODE_ENV !== 'production'`일 때 draft 포함 여부가 달라지는 분기, 그리고 캐시가 한 번 채워진 뒤 재호출해도 같은 인스턴스를 반환하는지가 검증되지 않아요.
- **제안**: `getDocsIndex` 캐싱 동작과 환경 변수에 따른 draft 포함 여부를 테스트해야 해요.

---

### [INFO] `cachedIndex` 모듈 싱글턴이 테스트 간 오염을 일으킬 수 있어요
- **위치**: `registry.ts:153`
- **상세**: `cachedIndex`가 모듈 스코프 변수이므로 같은 프로세스에서 여러 테스트 스위트가 `getDocsIndex()`를 호출하면 첫 번째 호출 결과가 고정돼요. 현재 테스트는 `loadDocsIndex`를 직접 호출하므로 문제가 없지만, 향후 `getDocsIndex` 테스트 추가 시 모듈 재임포트나 캐시 초기화 메커니즘이 필요해요.
- **제안**: `cachedIndex = null` 리셋용 `resetDocsIndexCache()` 함수를 테스트 전용으로 export하거나, `vi.resetModules()` 패턴을 사용하는 것을 검토해요.

---

### [INFO] `getAllSlugs`의 `includeDrafts: true` 경로가 테스트되지 않아요
- **위치**: `registry.test.ts:68–79`
- **상세**: `getAllSlugs` 테스트는 draft 제외 케이스만 검증하고, draft 포함 시 슬러그 목록에 draft 슬러그가 포함되는지 확인하지 않아요.
- **제안**: `includeDrafts: true`로 로드한 인덱스에서 `getAllSlugs`를 호출해 draft 슬러그(`02-second/c`)가 포함되는지 테스트를 추가해요.

---

### [INFO] `mdx-components.tsx`에서 `href`가 `undefined`이고 `children`도 없는 케이스 미처리
- **위치**: `mdx-components.tsx:12–28`
- **상세**: `typeof href === "string"` 체크로 `undefined` href는 외부 링크 분기로 처리되지만, `href={undefined}`인 앵커는 `<a href={undefined} target="_blank">` 로 렌더링돼요. 실제 MDX 콘텐츠에서 발생 가능성은 낮지만 명시적 처리가 없어요.
- **제안**: Spec §6 딥링크 규약에 따라 `/docs/...` 패턴만 내부 링크로 판별하는 것도 고려할 수 있어요(현재는 `/`로 시작하는 모든 경로를 내부로 처리).

---

## 요약

핵심 요구사항인 docs 레지스트리 스캔·필터링·정렬 로직은 스펙(§4, §5, §9 일부, §10)을 충실히 구현하고 있으나, **Spec §9의 `index.mdx` 랜딩 페이지 처리**와 **Spec §11이 명시적으로 요구하는 `spec`/`code` 경로 존재 검증 테스트**가 누락되어 있어요. 또한 `fixtures-broken` 픽스처 미존재 시 프론트매터 유효성 검증 테스트 자체가 올바르게 동작하지 않을 가능성이 높아, 핵심 오류 경로 보장이 취약한 상태예요.

## 위험도

**MEDIUM**