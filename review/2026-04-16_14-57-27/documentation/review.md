## 문서화 코드 리뷰 결과

---

### 발견사항

**[INFO]** `registry.ts` 공개 함수에 JSDoc 없음
- 위치: `registry.ts` — `loadDocsIndex`, `getDocBySlug`, `getAllSlugs`, `getDocsIndex`
- 상세: 4개의 export 함수가 모두 문서화되지 않음. 특히 `getDocsIndex()`는 싱글턴 캐시 동작 및 `NODE_ENV`에 따른 draft 포함 여부라는 비자명한 부수효과가 있어 주석이 없으면 오해하기 쉬움
- 제안: 최소한 `getDocsIndex()`에 캐싱 동작과 production/development 차이를 명시하는 JSDoc 추가

**[INFO]** `SECTION_LABELS` 매핑 확장 방법이 문서화되지 않음
- 위치: `registry.ts:34-41`
- 상세: 새 섹션을 추가할 때 이 맵을 함께 업데이트해야 한다는 사실이 코드 어디에도 언급되지 않음. 미등록 섹션은 `humanize()` 폴백으로 처리되지만 이 동작이 의도적인지 불명확
- 제안: 인라인 주석으로 "새 섹션 추가 시 이 맵에도 한글 레이블을 등록하세요" 한 줄 추가

**[INFO]** `DocFrontmatter` 인터페이스 필드 설명 부재
- 위치: `registry.ts:6-15`
- 상세: `spec`, `code` 선택 필드의 용도(glob 허용 여부, 빌드 검증에 사용됨)가 spec 문서에는 기술되어 있으나 타입 정의 자체에는 없음. 타입만 보는 개발자는 용도를 알 수 없음
- 제안: spec 문서의 표(섹션 4)와 같은 수준의 JSDoc을 인터페이스에 추가

**[INFO]** `useMDXComponents` 함수의 병합 우선순위가 문서화되지 않음
- 위치: `mdx-components.tsx:33-35`
- 상세: `{ ...docsComponents, ...components }` 순서로 인해 호출자가 전달한 컴포넌트가 기본 컴포넌트를 오버라이드함. 이 설계 의도가 주석 없이 암묵적
- 제안: 함수 위에 한 줄 주석으로 오버라이드 방향 명시

**[INFO]** 테스트 픽스처 파일에 용도 설명 없음
- 위치: `fixtures/02-second/c.mdx`, `fixtures/02-second/d.mdx`, `fixtures/_hidden/ignored.mdx`
- 상세: 각 픽스처가 어떤 테스트 시나리오를 위해 존재하는지 파일 자체에 표시되지 않음. `c.mdx`는 draft 테스트용, `d.mdx`는 정상 페이지, `ignored.mdx`는 `_` 프리픽스 제외 테스트용이지만 파일명/frontmatter만으로는 테스트 목적이 불명확함
- 제안: 허용된다면 frontmatter `summary` 필드를 활용해 각 픽스처의 테스트 목적을 명시 (예: `summary: "draft 필터링 테스트용 픽스처"`)

**[INFO]** `spec/2-navigation/13-user-guide.md` 섹션 9에서 `index.mdx` 랜딩 페이지 기능 언급되나 registry.ts에 미구현
- 위치: `spec/13-user-guide.md:섹션 9`, `registry.ts:loadDocsIndex`
- 상세: 스펙은 "섹션 디렉터리에 `index.mdx`가 있으면 해당 섹션의 랜딩 페이지"라고 명시하나, `registry.ts`에는 `index.mdx`를 특별 처리하는 로직이 없음. 스펙과 구현 간 불일치가 문서화 관점에서 혼란을 유발
- 제안: 스펙의 해당 항목을 "Phase 2" 또는 "미구현(TODO)" 으로 표시하거나, registry.ts에 `// TODO: index.mdx 랜딩 페이지 처리` 주석 추가

---

### 요약

전반적으로 스펙 문서(`13-user-guide.md`)는 IA, 라우트, 프론트매터 스키마, 딥링크 규약, 작성 정책 등을 충실하게 기술하고 있으며 구현의 설계 근거를 이해하는 데 충분하다. 다만 구현 코드(`registry.ts`, `mdx-components.tsx`) 자체에는 공개 API에 대한 JSDoc이 전무하여, 스펙 문서를 읽지 않은 개발자가 `getDocsIndex()`의 캐싱·환경 분기 동작이나 `SECTION_LABELS` 맵의 확장 방법을 파악하기 어렵다. 또한 스펙의 `index.mdx` 랜딩 페이지 기능이 구현에 반영되지 않은 채 스펙에만 기술되어 있어 스펙-구현 간 불일치가 존재한다. 테스트 픽스처는 frontmatter의 `summary` 필드를 테스트 시나리오 설명으로 활용하면 의도를 더 명확히 전달할 수 있다.

---

### 위험도

**LOW**