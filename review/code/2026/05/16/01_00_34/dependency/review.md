### 발견사항

- **[INFO]** 이번 변경에서 새 외부 패키지/라이브러리는 추가되지 않음
  - 위치: `frontend/package.json`
  - 상세: `scope-tab.tsx`, `open-oauth-popup.ts`, `scope-tab.test.tsx` 등 신규 파일들이 모두 기존 의존성(`react`, `@tanstack/react-query`, `sonner`, `lucide-react`, `@testing-library/*`, `vitest`, `@tanstack/react-query`)만을 사용하고 있다. `package.json` 수정 없음.
  - 제안: 현 상태 유지. 별도 조치 불필요.

- **[INFO]** 기존 의존성 버전 고정 현황 — 일부 캐럿(`^`) 범위 지정 사용 중
  - 위치: `frontend/package.json` 전체
  - 상세: 본 변경과 직접 관련된 `@tanstack/react-query: "^5.95.2"`, `sonner: "^2.0.7"`, `lucide-react: "^1.7.0"`, `@testing-library/react: "^16.3.2"`, `@testing-library/user-event: "^14.6.1"`, `vitest: "^4.1.4"` 모두 캐럿 범위. 기존 프로젝트 관행이며 이번 PR 에서 새로 도입한 것이 아니므로 별도 조치는 이번 PR 범위 밖.
  - 제안: 의존성 잠금(lock 파일 추적)이 되어 있으면 실질적 위험 낮음. 향후 메이저 버전 범프 시 lockfile 갱신과 함께 호환성을 검증할 것.

- **[INFO]** 내부 모듈 의존 관계 — 적절한 방향성 확인
  - 위치: `scope-tab.tsx` (lines 3–14), `open-oauth-popup.ts` (신규), `page.tsx` (변경)
  - 상세: `page.tsx` → `./scope-tab` → `./open-oauth-popup` 계층 구조로 의존 방향이 명확하다. `scope-tab.tsx` 가 `@/lib/api/integrations`, `@/lib/i18n`, `@/components/ui/button` 등 공용 레이어를 참조하는 것도 정상. 테스트 파일(`scope-tab.test.tsx`)이 `../scope-tab`를 직접 import 하도록 컴포넌트를 독립 모듈로 분리한 설계 의도가 명확하다.
  - 제안: 현 구조 적절. 추후 `openOAuthPopup` 이 다른 영역(신규 통합 페이지 등)에서도 필요해지면 `@/lib/integrations/` 공용 레이어로 상향 이동을 고려.

- **[INFO]** `RequestScopesResult` 신규 타입 — `OAuthBeginResult` 와의 구조 중복 경계
  - 위치: `frontend/src/lib/api/integrations.ts` (+15행)
  - 상세: `RequestScopesResult` 의 두 유니온 멤버 중 첫 번째(`{ authUrl: string; state: string }`)는 `OAuthBeginResult` 의 동일 멤버와 구조가 동일하다. 현재는 `scopesAdded` 필드가 추가된 `cafe24_private_pending` 분기를 type-safe 하게 표현하기 위해 분리했으며 이는 타당한 결정. 단, 두 타입이 향후 별도로 진화할 경우 중복 관리 부담이 생길 수 있음.
  - 제안: 단기적으로는 현 설계 적절. 중장기적으로 공통 멤버를 base type 으로 추출하거나 `OAuthBeginResult` 를 `RequestScopesResult` 로 통합하는 리팩토링을 고려.

- **[INFO]** 테스트 파일의 의존성 — 프로젝트 내 기존 패키지만 활용
  - 위치: `frontend/src/app/(main)/integrations/[id]/__tests__/scope-tab.test.tsx` (lines 1–11)
  - 상세: `vitest`, `@testing-library/react`, `@testing-library/user-event`, `@tanstack/react-query` 모두 `devDependencies` 에 이미 등록된 패키지다. 테스트 작성을 위해 새 패키지를 추가하지 않았다.
  - 제안: 현 상태 유지.

### 요약

이번 변경은 새 외부 의존성을 전혀 추가하지 않는다. 신규 파일(`scope-tab.tsx`, `open-oauth-popup.ts`, `scope-tab.test.tsx`)과 타입 추가(`RequestScopesResult`)는 모두 `@tanstack/react-query`, `sonner`, `lucide-react`, `@testing-library/*`, `vitest` 등 기존 `package.json` 에 등록된 패키지만을 사용한다. 내부 모듈 의존 방향도 `page.tsx → scope-tab → open-oauth-popup` 으로 단방향이며 순환 의존 없이 깔끔하다. `RequestScopesResult` 가 `OAuthBeginResult` 와 일부 구조를 공유하는 중복이 있으나 이는 type-safety 를 위한 의식적 분리이며 의존성 위험으로 볼 수준은 아니다. 라이선스·취약점·버전 충돌·번들 크기 측면에서 이번 변경이 유발하는 새로운 위험은 없다.

### 위험도

NONE
