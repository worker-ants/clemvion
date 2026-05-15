### 발견사항

- **[WARNING] 쿠키 이름 상수 3중 중복 정의**
  - 위치: `locale-store.ts:5` (`COOKIE_KEY`), `server-locale.ts:3` (`LOCALE_COOKIE_NAME`), 테스트 파일
  - 상세: 모두 `"idea-workflow.locale"`로 동일한 값을 독립적으로 선언. `server-locale.ts`가 `LOCALE_COOKIE_NAME`을 export하지만 `locale-store.ts`는 이를 import하지 않고 자체 상수를 사용함. 쿠키 이름 변경 시 3곳을 동기화해야 함.
  - 제안: `server-locale.ts`의 `LOCALE_COOKIE_NAME`을 단일 진실 소스로 삼고, `locale-store.ts`에서 import하여 사용

- **[WARNING] 클라이언트 쿠키에 `Secure` 플래그 미설정**
  - 위치: `locale-store.ts:11`
  - 상세: `document.cookie = \`...; SameSite=Lax\`` — `Secure` 플래그 누락. HTTPS 프로덕션 환경에서도 HTTP로 쿠키가 전송될 수 있음. locale 자체는 민감하지 않으나 보안 hygiene 위반
  - 제안: `typeof window !== 'undefined' && location.protocol === 'https:'` 조건부로 `; Secure` 추가, 또는 무조건 포함

- **[INFO] 클라이언트 컴포넌트에서 서버 전용 모듈로의 타입 import**
  - 위치: `docs-search.tsx:8` — `import type { DocsSearchEntry } from "@/lib/docs/registry"`
  - 상세: `registry.ts`는 `node:fs`, `node:path`를 사용하는 서버 전용 모듈. `import type`은 빌드 시 제거되어 현재는 안전하지만, 향후 type이 value import로 바뀌면 클라이언트 번들에 `node:fs`가 포함되어 빌드 실패 가능
  - 제안: `DocsSearchEntry` 타입을 `locale.ts` 또는 별도 `types.ts`로 분리하거나, `registry.ts`에 `// @server-only` 주석 명시

- **[INFO] `localizedDocsHref` 이중 export 경로**
  - 위치: `locale.ts` (클라이언트 safe) + `registry.ts` (서버 전용) 양쪽에서 re-export
  - 상세: 클라이언트 컴포넌트(`docs-sidebar.tsx`, `docs-link.tsx`)는 `locale.ts`에서, 서버 컴포넌트(`page.tsx`)는 `registry.ts`에서 import — 현재는 올바르게 분리됨. 단, 경계가 암묵적이어서 실수 가능성 존재
  - 제안: `registry.ts` 상단에 `// server-only` 주석 추가 또는 `import 'server-only'` 적용 고려

- **[INFO] 새 외부 패키지 없음**
  - 모든 변경사항은 기존 의존성(`next`, `react`, `fuse.js`, `zustand`, `gray-matter`, `lucide-react`) 내에서 처리됨. `package.json` 변경 없음.

---

### 요약

이번 변경은 i18n 라우팅(locale 프리픽스 URL) 도입을 위한 내부 모듈 재구성이 핵심이며, **신규 외부 의존성은 전혀 없다**. 서버/클라이언트 경계는 대체로 올바르게 유지되어 있으나, 쿠키 이름 상수의 3중 중복 선언과 `Secure` 플래그 누락이 유지보수성·보안 hygiene 관점에서 개선이 필요하다. `docs-search.tsx`의 서버 전용 모듈 타입 import는 현재는 안전하지만 잠재적 취약 지점이다.

### 위험도
**LOW**