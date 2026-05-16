# 의존성(Dependency) 코드 리뷰

## 발견사항

- **[INFO]** 새 외부 의존성 추가 없음 — 변경은 React 내장 훅(`useState`)만 사용
  - 위치: `frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx` line 1 (`import { useState } from "react"`)
  - 상세: `useState`는 `react` 패키지의 내장 API이며, `react`는 이미 `package.json` `dependencies`에 `19.2.4`(exact pin)로 등록되어 있다. 별도 패키지 추가 없이 기존 의존성만 활용한 구현이다.
  - 제안: 변경 불필요.

- **[INFO]** 테스트 파일의 import도 기존 의존성 범위 내
  - 위치: `frontend/src/components/editor/settings-panel/node-configs/__tests__/cafe24-config.test.tsx` lines 1–3
  - 상세: `vitest`, `@testing-library/react`, `react`는 모두 `devDependencies`에 이미 등록된 패키지이다. `useLocaleStore`는 내부 모듈(`@/lib/stores/locale-store`) 경유이며 새 외부 의존성이 아니다.
  - 제안: 변경 불필요.

- **[INFO]** `react` 버전 고정 방식 혼재 — `19.2.4` exact pin vs. `^19` type 범위
  - 위치: `frontend/package.json` — `dependencies.react: "19.2.4"`, `dependencies.react-dom: "19.2.4"` (exact) / `devDependencies."@types/react": "^19"`, `devDependencies."@types/react-dom": "^19"` (range)
  - 상세: 런타임 패키지(`react`, `react-dom`)는 exact pin이어서 재현 가능한 빌드를 보장한다. 타입 정의(`@types/react`)는 캐럿 범위로 두어 minor 업데이트를 허용하는 전형적 패턴이며 이번 변경과 무관하다. 본 PR이 이 구조를 바꾸지 않으므로 위험 없음.
  - 제안: 현행 유지. 타입 패키지도 exact pin으로 통일하려면 별도 PR에서 일괄 처리한다.

- **[INFO]** 내부 모듈 의존 관계 확인
  - 위치: `integration-configs.tsx` — `./shared`, `@/components/editor/expression`, `./integration-selector`, `@/lib/i18n`, `@/lib/stores/locale-store`(테스트용 mock 경유)
  - 상세: 이번 변경으로 새로운 내부 모듈 경계를 넘는 import가 추가되지 않았다. `integration-selector`는 테스트에서 `vi.mock`으로 교체되어 react-query 의존 전파를 차단하고 있으며, 이는 적절한 격리 패턴이다.
  - 제안: 변경 불필요.

## 요약

이번 PR(`fix(node-configs/cafe24): keep newly added fields rows visible`)은 새로운 외부 패키지를 일절 추가하지 않았다. 변경은 React `useState` 훅(이미 `dependencies`에 exact pin된 `react 19.2.4` 포함)만 사용하여 `Cafe24Config` 내부 편집 버퍼를 도입하고, 기존 `@testing-library/react`·`vitest` 인프라로 단위 테스트를 추가하는 데 그친다. 의존성 추가·버전 변경·라이선스·취약점·번들 크기·내부 모듈 구조 어느 측면에서도 새로운 위험 요소가 발생하지 않는다.

## 위험도

NONE
