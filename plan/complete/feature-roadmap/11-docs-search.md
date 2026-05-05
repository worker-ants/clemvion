# Stage 11 · 매뉴얼 검색

## 배경

`NAV-UG-07` — `/docs` 내 검색. 미구현.

## 설계

### 구현 방식

클라이언트 사이드 검색. 서버 인덱스 불필요.

1. 빌드 타임에 `lib/docs/registry.ts`가 모든 MDX의 `title + summary + headings`를 수집 → `lib/docs/search-index.json`
2. `/docs` 레이아웃 상단에 검색 입력 추가
3. 입력 시 `fuse.js` 같은 fuzzy 검색으로 즉석 결과 필터
4. 결과 클릭 시 해당 페이지·앵커로 이동

### 영향받는 파일

- 수정: `frontend/src/lib/docs/registry.ts` (헤딩 수집 함수 추가)
- 신규: `frontend/src/components/docs/docs-search.tsx`
- 수정: `frontend/src/app/(main)/docs/layout.tsx` 상단에 DocsSearch 배치
- 의존성 추가: `fuse.js`
- 수정: PRD `NAV-UG-07` → ✅

### 테스트

- registry의 헤딩 수집 테스트
- DocsSearch 결과 필터 테스트

### 검증

- "표현식" 검색 시 관련 페이지 모두 노출
- 키보드만으로 결과 항목 선택 가능
