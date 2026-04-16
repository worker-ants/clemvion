### 발견사항

- **[INFO]** `@next/mdx` 버전이 `next`와 동일한 범위(`^16.2.3`)로 맞춰짐
  - 위치: `package.json`
  - 상세: `@next/mdx`는 Next.js 메이저 버전과 반드시 일치해야 하며, 두 패키지 모두 `^16.2.3`으로 정렬되어 있어 올바름
  - 제안: 향후 Next.js 메이저 버전 업그레이드 시 두 패키지를 함께 올려야 함을 주석 또는 README에 기록 권장

- **[INFO]** `rehype-autolink-headings`, `rehype-slug`, `remark-gfm`은 빌드 타임(`next.config.ts`)에만 사용됨
  - 위치: `package.json` dependencies
  - 상세: 세 패키지 모두 MDX 컴파일 시점에만 동작하며 런타임 번들에 포함되지 않음. 그러나 `dependencies`에 배치되어 있음 (Next.js 빌드가 서버 환경에서 수행되므로 기술적으로 허용됨)
  - 제안: 엄밀히는 `devDependencies`로 이동해도 무방하나, CI/CD 파이프라인이 `--production` 플래그 없이 빌드한다면 현재 위치도 문제 없음. 일관성을 위해 팀 기준 확인 권장

- **[WARNING]** 동적 경로 MDX 임포트(`await import(\`@/content/docs/${slugPath}.mdx\`)`)
  - 위치: `frontend/src/app/(main)/docs/[...slug]/page.tsx`
  - 상세: Webpack/Turbopack 기반 번들러는 동적 임포트의 경로 패턴으로 chunk 경계를 결정함. 변수 템플릿 리터럴을 사용하면 `@/content/docs/**/*.mdx` 전체를 추적 대상으로 포함할 수 있어, MDX 파일이 늘어날수록 초기 빌드 시간과 청크 수에 영향을 줌. `dynamicParams = false` + `generateStaticParams`로 정적 생성이 보장되어 런타임 안전성은 확보됨
  - 제안: 현재 문서 수(~20개) 규모에서는 실용적 문제 없음. 100개 이상으로 증가 시 빌드 성능을 모니터링하고, 필요하다면 registry 기반 정적 맵 방식으로 전환 검토

- **[INFO]** `gray-matter`가 `dependencies`에 배치
  - 위치: `package.json`
  - 상세: `gray-matter`는 `lib/docs/registry`의 서버 사이드 코드에서만 사용됨. Next.js App Router의 서버 컴포넌트 및 서버 함수는 런타임에도 `node_modules`를 참조하므로, `dependencies` 배치는 정확함 (서버리스 배포 환경 포함)
  - 제안: 현재 배치 유지

- **[INFO]** 라이선스 호환성 확인
  - 위치: 신규 패키지 전체
  - 상세: `@mdx-js/loader`, `@mdx-js/react`, `@next/mdx`, `gray-matter`, `rehype-autolink-headings`, `rehype-slug`, `remark-gfm`, `@types/mdx` 모두 MIT 라이선스. 기존 프로젝트 라이선스와 충돌 없음

- **[INFO]** 내부 모듈 의존성 구조 적절
  - 위치: `canvas-empty-state.tsx`, `shared/field-help.tsx`
  - 상세: `workflow-canvas.tsx` → `canvas-empty-state.tsx`, `ai-configs.tsx` → `shared/field-help.tsx` 방향이 올바름. 역방향 참조 없음

---

### 요약

이번 변경에서 추가된 8개 신규 의존성은 모두 MDX 기반 인앱 문서 시스템 구현에 직접 필요한 패키지이며, 전부 MIT 라이선스로 호환성 문제가 없다. `@next/mdx`와 `next`의 버전 범위가 일치하고, rehype/remark 플러그인들은 빌드 타임 전용으로 런타임 번들 크기에 영향을 주지 않는다. 유일한 주의 사항은 동적 경로 패턴을 사용하는 MDX 동적 임포트로, 문서 수가 대폭 증가할 경우 빌드 시간을 모니터링할 필요가 있으나 현재 규모에서는 실용적 위험이 없다. 전반적으로 의존성 관리가 적절히 이루어졌다.

### 위험도

**LOW**