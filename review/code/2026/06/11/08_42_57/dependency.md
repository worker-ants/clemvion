# 의존성(Dependency) 리뷰

## 발견사항

### [INFO] 새 외부 패키지 없음 — 기존 의존성만 사용
- 위치: `codebase/frontend/src/components/knowledge-base/unsearchable-banner.tsx` (전체)
- 상세: 이번 변경에서 `package.json` 또는 `package-lock.json` 수정이 없다. `unsearchable-banner.tsx` 의 import 3종(`AlertTriangle`, `Loader2`, `RefreshCw`)은 모두 `lucide-react` 에서 가져오며, `lucide-react` 는 이미 프로젝트 프론트엔드 의존성으로 등록된 패키지다. `Button`, `RoleGate`, `useT` 역시 프로젝트 내부 모듈이다.
- 제안: 해당 없음.

### [INFO] 내부 모듈 의존 관계 — 적절한 계층 준수
- 위치: `codebase/frontend/src/components/knowledge-base/unsearchable-banner.tsx` 전체 import 목록
- 상세: `UnsearchableBanner` 는 다음 내부 모듈에만 의존한다.
  - `@/components/ui/button` (공통 UI 원자)
  - `@/components/auth/role-gate` (인증 관문 컴포넌트)
  - `@/lib/i18n` (i18n 훅)
  - `lucide-react` (아이콘 라이브러리 — 기존 등록 패키지)
  컴포넌트가 도메인 스토어(`useWorkspaceStore`)를 직접 import 하지 않고 `RoleGate` 에 위임하므로 관심사 분리가 유지된다. 테스트 파일에서 `useWorkspaceStore`를 직접 조작하지만 이는 테스트 설정용이며 프로덕션 컴포넌트 내부 결합과 무관하다.
- 제안: 현행 유지 적절.

### [INFO] lucide-react 아이콘 3종 추가 — 번들 크기 영향 미미
- 위치: `unsearchable-banner.tsx` L3 (`import { AlertTriangle, Loader2, RefreshCw } from "lucide-react"`)
- 상세: `AlertTriangle`, `Loader2`, `RefreshCw` 세 아이콘 중 `Loader2` 는 이미 프로젝트 내 다른 컴포넌트에서 광범위하게 사용되어 tree-shaking 후 번들에 포함될 가능성이 높다. `AlertTriangle`, `RefreshCw` 도 동일한 lucide-react 패키지 내 아이콘이므로 신규 패키지 로드가 없고, tree-shaking 환경(Next.js + turbopack)에서 사용하는 아이콘 단위로 번들된다. 3개 SVG 아이콘의 추가 크기는 수 KB 미만으로 번들 크기에 유의미한 영향이 없다.
- 제안: 현행 유지 적절.

### [INFO] 테스트 파일의 testing 라이브러리 의존 — 기존 패턴 일치
- 위치: `codebase/frontend/src/components/knowledge-base/__tests__/unsearchable-banner.test.tsx` L1–2
- 상세: `vitest`, `@testing-library/react` 는 프로젝트 devDependency 로 이미 등록되어 있으며 기존 다수 테스트 파일과 동일한 import 패턴을 따른다. 신규 테스트 라이브러리 도입 없음.
- 제안: 해당 없음.

---

## 요약

이번 변경(`UnsearchableBanner` 컴포넌트 신설 + `[id]/page.tsx` 배선 + i18n 키 3종 추가)은 외부 패키지 의존성 변경이 전혀 없는 순수 내부 구현이다. 사용된 모든 import — `lucide-react` 아이콘, `@/components/ui/button`, `@/components/auth/role-gate`, `@/lib/i18n` — 은 프로젝트에 이미 등록된 기존 의존성이며 버전·라이선스·취약점 문제가 새로 발생하지 않는다. 내부 모듈 의존 계층도 UI 원자 → 도메인 컴포넌트 방향으로 정상적이며, 컴포넌트가 도메인 스토어를 직접 참조하지 않는 설계가 결합도를 적절히 낮추고 있다. 의존성 관점에서 지적할 사항이 없다.

## 위험도

NONE
