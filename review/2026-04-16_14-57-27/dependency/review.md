## 의존성 코드 리뷰

### 발견사항

- **[INFO]** `gray-matter` 패키지 신규 사용
  - 위치: `registry.ts:3` — `import matter from "gray-matter"`
  - 상세: MDX 파일의 YAML 프론트매터 파싱을 위해 `gray-matter`를 사용. 활발히 유지되는 패키지(주간 다운로드 수백만)이며 MIT 라이선스로 호환성 문제 없음. `package.json`에 이미 등록되어 있어야 사용 가능.
  - 제안: `frontend/package.json`에 `"gray-matter"` 항목이 존재하는지 확인 필요.

- **[INFO]** `mdx/types` 타입 패키지 사용
  - 위치: `mdx-components.tsx:1` — `import type { MDXComponents } from "mdx/types"`
  - 상세: `@mdx-js/mdx` 또는 `@next/mdx` 패키지에서 제공하는 타입. `next.config.ts`에 MDX 플러그인 설정이 추가된 것과 연동되므로, `@next/mdx` 및 관련 패키지(`@mdx-js/loader`, `@mdx-js/react`)가 `package.json`에 포함되어야 함.
  - 제안: 의존성 누락 시 빌드 오류 발생 — `package.json` 의존성 목록과 교차 확인 필요.

- **[INFO]** `node:fs`, `node:path` 내장 모듈 사용 (빌드 경계 주의)
  - 위치: `registry.ts:1-2`
  - 상세: Node.js 빌드타임 전용 API를 사용. 스펙(11절)에 명시된 대로 서버 전용 코드이므로 클라이언트 번들에 포함되지 않아야 함. 현재 코드 자체는 올바르나, 이 모듈을 `'use client'` 컴포넌트에서 임포트할 경우 빌드 오류 발생.
  - 제안: 추가적인 safeguard로 파일 상단에 `import "server-only"`를 추가하는 방안 고려.

- **[INFO]** 테스트 코드에서 `vitest` 직접 임포트
  - 위치: `registry.test.ts:2` — `import { describe, it, expect } from "vitest"`
  - 상세: `vitest`가 dev 의존성에 등록되어 있어야 함. 기존 코드베이스에서 이미 사용 중인 것으로 추정되므로 신규 의존성 추가는 없을 것으로 판단.
  - 제안: 해당 없음.

- **[WARNING]** `getDocsIndex()` 모듈 레벨 캐시(`cachedIndex`)가 Next.js 핫 리로드 환경에서 재설정되지 않음
  - 위치: `registry.ts:155-163`
  - 상세: 이것은 의존성 문제라기보다는 런타임 의존 관계 문제. Next.js 개발 서버의 HMR(Hot Module Replacement) 사이클에서 모듈이 재로드되더라도 `cachedIndex`가 파일 시스템 변경을 반영하지 못할 수 있음. `global` 객체를 활용하는 패턴(`globalThis.__docsIndex`)이 더 안전.
  - 제안:
    ```ts
    // 개발 환경에서 HMR safe cache
    const g = globalThis as typeof globalThis & { __docsIndex?: DocsIndex };
    export function getDocsIndex(): DocsIndex {
      if (!g.__docsIndex) {
        const includeDrafts = process.env.NODE_ENV !== "production";
        g.__docsIndex = loadDocsIndex(DEFAULT_DOCS_ROOT, { includeDrafts });
      }
      return g.__docsIndex;
    }
    ```

---

### 요약

이번 변경에서 실질적으로 신규 추가된 외부 의존성은 `gray-matter` 하나이며, MIT 라이선스의 안정적인 패키지로 도입 리스크가 낮다. MDX 관련 패키지(`@next/mdx`, `@mdx-js/*`)는 `next.config.ts` 변경과 함께 이미 추가되었을 것으로 보이므로 `package.json` 일치 여부만 확인하면 된다. 내부 모듈 경계(서버 전용 `fs`/파일 시스템 접근) 설계는 스펙과 일치하며, 클라이언트 번들 오염 위험도 낮다. 다만 `getDocsIndex()`의 모듈 레벨 싱글톤 캐시는 Next.js 개발 환경의 HMR과 충돌할 수 있어 `globalThis` 기반 패턴으로 개선을 권장한다.

### 위험도

**LOW**