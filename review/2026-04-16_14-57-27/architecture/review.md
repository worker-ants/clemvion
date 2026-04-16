### 발견사항

- **[INFO]** `getDocsIndex()`의 모듈 수준 싱글턴 캐시
  - 위치: `registry.ts` L166–170 (`let cachedIndex: DocsIndex | null = null`)
  - 상세: 모듈 캐시는 Next.js의 `--turbopack` 또는 HMR 환경에서 갱신되지 않아 개발 중 stale 데이터를 반환할 수 있음. 또한 테스트 격리가 깨질 위험이 있음(테스트에서는 `loadDocsIndex`를 직접 호출하므로 현재는 안전).
  - 제안: `process.env.NODE_ENV === 'development'`이면 캐시를 건너뛰거나, Next.js `unstable_cache` / React `cache()`를 활용해 요청 범위 캐시로 격상

- **[INFO]** `assertFrontmatter`의 순차적 타입 검증 중복
  - 위치: `registry.ts` L62–96
  - 상세: 필수 키 존재 검사와 타입 검사가 두 번의 루프+조건문으로 분리되어 있음. 코드량이 증가하며 필드 추가 시 두 곳을 동시에 수정해야 함(SRP 경계 내부의 유지보수 부담).
  - 제안: `zod` 또는 `valibot` 같은 스키마 검증 라이브러리로 교체하면 `DocFrontmatter` 타입과 검증 로직이 단일 소스로 통합됨

- **[INFO]** `SECTION_LABELS` 하드코딩과 파일시스템 레이블 생성 혼용
  - 위치: `registry.ts` L35–52 (`SECTION_LABELS`, `humanize`, `sectionLabel`)
  - 상세: 섹션 레이블이 코드 내 상수(6개 항목)와 `humanize()` 폴백으로 이원화되어 있음. 새 섹션 디렉터리를 추가할 때 상수 갱신을 잊으면 영문 자동 변환 레이블이 노출됨.
  - 제안: 각 섹션 디렉터리에 `_meta.json` (또는 `index.mdx` 프론트매터의 `label` 필드)를 두어 레이블 소스를 파일시스템으로 통일. 코드 수정 없이 섹션 추가 가능.

- **[INFO]** `section` 프론트매터 필드 중복성
  - 위치: `registry.ts` L118, spec §4
  - 상세: `section` 값이 파일이 속한 디렉터리명과 항상 일치해야 하지만, 파일에 직접 기재하도록 설계되어 있음. 잘못된 섹션 키 입력 시 탐지 로직이 없음.
  - 제안: `loadDocsIndex` 내에서 `frontmatter.section !== sectionKey`를 검출해 경고 또는 에러 처리. 또는 `section` 필드를 파일시스템에서 자동 주입하고 프론트매터에서 제거.

- **[INFO]** `useMDXComponents` 기본 파라미터와 타입 안전성
  - 위치: `mdx-components.tsx` L32
  - 상세: `components: MDXComponents = {}` 기본값은 `useMDXComponents(undefined)` 호출을 허용하나, Next.js MDX 계약에서는 항상 전달됨. 실질적 위험은 낮으나 인터페이스 명확성 저하.
  - 제안: 기본값 제거하고 `components: MDXComponents`로 변경해 Next.js 계약을 코드에 명시.

- **[INFO]** `fixtures-broken` 테스트의 외부 의존성
  - 위치: `registry.test.ts` L48 (`path.resolve(__dirname, "fixtures-broken")`)
  - 상세: `fixtures-broken` 디렉터리가 존재하지 않으면 `loadDocsIndex`가 `[]`를 반환해 예외 없이 통과할 수 있음. 테스트가 디렉터리 존재를 가정하는 암묵적 전제 보유.
  - 제안: 테스트 내에서 `tmp` 디렉터리를 생성·정리하거나 `beforeEach`/`afterEach`로 broken fixture를 동적 생성해 테스트 자급성 확보.

---

### 요약

전반적으로 `registry.ts`는 파일시스템 스캔·파싱·인덱스 구축 책임이 한 모듈에 응집되어 있고, 프레젠테이션(`mdx-components.tsx`)과 데이터(`registry.ts`) 레이어 분리도 명확하다. 인터페이스 정의, 옵션 파라미터, 필터링 정책이 스펙과 일치하며 테스트 커버리지도 충분하다. 다만 모듈 수준 싱글턴 캐시의 환경별 동작 차이, `SECTION_LABELS` 하드코딩으로 인한 OCP(개방-폐쇄 원칙) 위반 잠재성, `section` 프론트매터 중복 입력이 개선 여지로 남아 있다. 현재 규모에서 큰 위험은 없으나 섹션이 늘어날수록 하드코딩된 레이블 테이블이 병목이 될 수 있다.

### 위험도

**LOW**