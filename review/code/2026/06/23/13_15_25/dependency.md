# 의존성(Dependency) 리뷰 결과

## 발견사항

### 발견사항 없음 (새 외부 패키지 추가 없음)

이번 변경에서 `package.json` 에 추가된 항목은 `build:widget` **스크립트** 하나뿐이며, `dependencies` / `devDependencies` 에 새 외부 패키지는 추가되지 않았다.

---

- **[INFO]** `copy-widget.mjs` 가 Node.js 표준 라이브러리만 사용
  - 위치: `codebase/frontend/scripts/copy-widget.mjs`
  - 상세: `node:child_process`, `node:fs`, `node:url`, `node:path` 만 import. 외부 npm 패키지 의존 없음. 적절한 선택.
  - 제안: 없음.

- **[INFO]** `build:widget` 스크립트가 `pnpm --filter` 로 내부 워크스페이스 빌드를 orchestrate
  - 위치: `codebase/frontend/package.json` → `scripts.build:widget`, `copy-widget.mjs` 41·44행
  - 상세: `pnpm --filter channel-web-chat build` + `pnpm --filter @workflow/web-chat build:loader` 를 호출한다. 이는 pnpm workspace 내부 패키지(`channel-web-chat`, `@workflow/web-chat`)에만 의존하며, 외부 의존성을 신규로 끌어오지 않는다.
  - 제안: CI/Dockerfile 에서 `build:widget` 호출 순서(next build 이전)가 명확히 문서화되어 있어야 한다. 스크립트 헤더 주석에 이미 "배포/CI 의 `next build` 앞단계"로 기술되어 있어 현재는 양호.

- **[INFO]** `live-preview.tsx` 의 내부 의존 관계 점검
  - 위치: `codebase/frontend/src/components/web-chat/live-preview.tsx`
  - 상세: 새로 import 된 모듈은 모두 같은 프로젝트 내부 모듈이다 (`@/lib/utils/webhook-url`, `@/lib/web-chat/snippet`, `@/lib/web-chat/widget-base`, `./snippet-input`, `./use-appearance-draft`). React 훅(`useEffect`, `useMemo`, `useRef`, `useState`)은 기존 의존 `react: 19.2.4` 에서 공급된다. 외부 신규 패키지 없음.
  - 제안: 없음.

- **[INFO]** `widget-base.ts` — `getWidgetOrigin()` 신규 함수가 `node:url` 없이 브라우저 내장 `URL` 생성자만 사용
  - 위치: `codebase/frontend/src/lib/web-chat/widget-base.ts`
  - 상세: SSR/브라우저 양 컨텍스트에서 동작하는 순수 유틸로, 추가 의존 없음. `try/catch` 로 파싱 실패 방어도 적절.
  - 제안: 없음.

- **[INFO]** 테스트(`live-preview.test.tsx`)의 의존성
  - 위치: `codebase/frontend/src/components/web-chat/__tests__/live-preview.test.tsx`
  - 상세: `vitest`, `@testing-library/react` 는 기존 devDependencies. `next/navigation` 은 `next` 패키지에서 공급. 신규 패키지 없음.
  - 제안: 없음.

- **[INFO]** `eslint.config.mjs` — `public/_widget/**` ignore 추가가 빌드 아티팩트 lint 스캔 방지
  - 위치: `codebase/frontend/eslint.config.mjs`
  - 상세: 동봉 위젯 번들(빌드 시 생성, gitignore 처리)을 ESLint 가 스캔하지 않도록 처리. 의존성 관점에서 문제 없음.
  - 제안: 없음.

---

## 요약

이번 변경(증분 2 — 위젯 co-deploy 빌드 + 라이브 미리보기 iframe)은 외부 npm 패키지를 **단 하나도 추가하지 않는다**. `build:widget` 스크립트는 Node.js 표준 라이브러리와 기존 pnpm 워크스페이스 내부 패키지(`channel-web-chat`, `@workflow/web-chat`)에만 의존하며, `LivePreview` 컴포넌트·`widget-base.ts` 유틸·테스트 코드 모두 기존 의존성(`react`, `vitest`, `@testing-library/react`, `next`)과 프로젝트 내부 모듈만 참조한다. 버전 고정·라이선스·취약점·번들 크기 측면에서 추가 검토가 필요한 항목이 없다.

## 위험도

NONE
