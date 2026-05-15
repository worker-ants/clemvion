## 성능 코드 리뷰

### 발견사항

---

**[WARNING]** `loadDocsIndex` 내 동기 I/O 반복 호출
- 위치: `registry.ts` — `loadDocsIndex` 함수 내 이중 루프
- 상세: `fs.readFileSync`가 파일 수만큼 동기적으로 호출됨. Node.js 이벤트 루프를 블로킹하는 구조. 파일 수가 수십 개 이하인 현재 규모에서는 빌드타임 전용이라 실질적 영향은 제한적이나, 콘텐츠가 증가할수록 빌드 시간이 선형적으로 늘어남.
- 제안: Next.js 빌드 컨텍스트(`generateStaticParams`, `getDocsIndex`)에서만 호출되므로 현재는 허용 범위. 파일 수가 50개 이상이 되면 `fs.promises.readFile`을 사용해 `Promise.all`로 병렬 처리로 전환 권장.

---

**[WARNING]** `getDocsIndex` 캐시가 프로세스 재시작에만 무효화됨
- 위치: `registry.ts:176-182`
- 상세: 모듈 수준 `cachedIndex` 변수는 개발 서버(HMR)에서 모듈이 교체되지 않으면 갱신되지 않음. 콘텐츠 파일 수정 후 인덱스가 오래된 상태를 반환할 수 있음.
- 제안: 개발 환경에서는 캐싱을 비활성화하거나, `process.env.NODE_ENV !== 'production'` 시 `cachedIndex = null`로 초기화하는 조건 추가.

```ts
export function getDocsIndex(): DocsIndex {
  if (!cachedIndex || process.env.NODE_ENV === 'development') {
    const includeDrafts = process.env.NODE_ENV !== "production";
    cachedIndex = loadDocsIndex(DEFAULT_DOCS_ROOT, { includeDrafts });
  }
  return cachedIndex;
}
```

---

**[WARNING]** `getAllSlugs`에서 slug 배열 전체 복사
- 위치: `registry.ts:163-170`
- 상세: `[...page.slug]`로 모든 slug 배열을 복사. `DocsIndex.sections`의 `page.slug`가 이미 고정된 값인데 방어적 복사를 수행함. 페이지 수가 수백 개가 되면 불필요한 메모리 할당 증가.
- 제안: 반환된 slug 배열이 외부에서 변경되지 않는다면 얕은 참조 반환으로 충분. 변경 가능성이 있다면 `readonly string[][]` 타입으로 반환 타입을 강화하는 것이 복사보다 효율적.

---

**[INFO]** `assertFrontmatter`에서 requiredKeys 반복 + 개별 타입 검사 이중 순회
- 위치: `registry.ts:60-95`
- 상세: 필수 키 존재 확인을 위한 루프 후, 타입 검사를 위한 `typeof` 분기가 별도로 실행됨. 파일당 두 번 순회하는 구조. 파일 수가 적으므로 영향은 미미하지만, 단일 패스로 통합 가능.
- 제안: 단일 루프에서 존재 확인과 타입 검사를 함께 처리.

---

**[INFO]** `listSectionDirs`와 `listMdxFiles`에서 `fs.existsSync` + `fs.readdirSync` 이중 syscall
- 위치: `registry.ts:97-115`
- 상세: 존재 확인 후 읽기를 위해 syscall이 두 번 발생. `readdirSync`를 try/catch로 감싸거나, 존재하지 않는 경우 빈 배열을 반환하는 단일 syscall 패턴으로 대체 가능.
- 제안:
```ts
function listSectionDirs(root: string): string[] {
  try {
    return fs.readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
      .map((d) => d.name)
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}
```

---

**[INFO]** `useMDXComponents`에서 스프레드 연산으로 매 렌더링마다 객체 재생성
- 위치: `mdx-components.tsx:31-33`
- 상세: `{ ...docsComponents, ...components }`가 컴포넌트 렌더링마다 새 객체를 생성. `docsComponents`는 모듈 레벨 상수이므로 `components`가 빈 객체일 경우 재생성 비용이 낭비됨.
- 제안: `components`가 빈 객체이거나 키가 없는 경우 `docsComponents`를 직접 반환.

```ts
export function useMDXComponents(components: MDXComponents = {}): MDXComponents {
  if (Object.keys(components).length === 0) return docsComponents;
  return { ...docsComponents, ...components };
}
```

---

### 요약

이 코드셋은 **빌드타임 전용 파일 스캔 레지스트리**로 설계되어 있어, 런타임 성능보다 빌드/개발 환경에서의 I/O 효율이 핵심 관점이다. 전반적으로 Map 자료구조를 통한 O(1) slug 조회, 모듈 레벨 캐싱, draft 필터링 등 합리적인 설계를 갖추고 있다. 주요 위험 요소는 개발 서버에서 캐시가 무효화되지 않는 문제(콘텐츠 수정 시 stale 인덱스 반환)와 동기 I/O 반복 호출이며, 현재 콘텐츠 규모에서는 치명적이지 않으나 콘텐츠가 수십 페이지 이상 증가하면 재검토가 필요하다. 나머지 사항은 코드 품질 개선 수준의 마이너 이슈다.

### 위험도

**LOW**