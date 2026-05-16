### 발견사항

- **[INFO]** `node:fs` 표준 라이브러리 신규 임포트 — 외부 패키지 아님, 문제 없음
  - 위치: `frontend/src/lib/docs/__tests__/registry.test.ts` L1 (`import fs from "node:fs"`)
  - 상세: Node.js 내장 `fs` 모듈을 `node:` prefix 형식으로 명시적으로 임포트. 이미 같은 파일에서 `import path from "node:path"` 를 사용하는 패턴과 일치하며, 외부 의존성 추가가 아니다. Vitest 환경에서 파일시스템 접근이 가능하며 번들 크기에 영향 없다.
  - 제안: 현행 유지. 패턴 일관성 확인됨.

- **[INFO]** TypeORM 연산자 추가 임포트 (`IsNull`, `Or`) — 기존 의존성 내부 심볼, 신규 패키지 아님
  - 위치: `backend/src/modules/integrations/integration-expiry-scanner.service.ts` L4–10
  - 상세: 기존 `typeorm` 패키지(`^0.3.28`)에서 이미 존재하는 연산자를 추가로 import. `Or`, `IsNull` 은 TypeORM 0.3.x 에 모두 포함된 심볼이다. 새 외부 패키지 설치 없음, `package.json` 변경 없음.
  - 제안: 현행 유지. TypeORM 0.3.x 버전 내 API이므로 호환성 문제 없다.

- **[INFO]** 내부 모듈 의존 관계 변경 — `useLocale` 훅 신규 참조
  - 위치: `frontend/src/components/editor/canvas/custom-node.tsx` L14 (`import { useLocale } from "@/lib/i18n"`)
  - 상세: 프로젝트 내부 i18n 모듈에서 `useLocale` 훅을 추가 임포트. 같은 변경에서 `node-config-summary.ts` 는 `translateBackendWarning` 과 `Locale` 타입을 `@/lib/i18n/backend-labels` / `@/lib/i18n/types` 에서 참조한다. 모두 기존 내부 i18n 계층 내 심볼이며, 순환 의존성을 새로 만들지 않는다.
  - 제안: `backend-labels.ts` → `node-config-summary.ts` → `custom-node.tsx` 의 의존 방향이 단방향인지 확인 권장. 현재 diff 기준으로는 문제 없음.

- **[INFO]** `docker compose run --build` 플래그 추가 — 외부 의존성 아님, 빌드 환경 변경
  - 위치: `Makefile` L92, L110 (`run --rm --build backend-e2e-runner`, `run --rm --build playwright-runner`)
  - 상세: `docker compose run --build` 플래그는 Docker Compose v2.12.0+ 부터 지원된다. `docker compose up --build` 는 오래전부터 지원되나 `run` 서브커맨드에 `--build` 가 추가된 것은 비교적 최근이다. 팀의 Docker Compose 버전이 해당 플래그를 지원하는지 확인이 필요하다.
  - 제안: CI/로컬 환경의 Docker Compose 버전을 확인한다. Docker Desktop 4.x(포함된 Compose 2.x) 이상이면 안전하다. 필요 시 `Makefile` 상단 또는 README 에 최소 Compose 버전 요구사항을 명시하면 onboarding 시 혼란을 방지할 수 있다.

### 요약

이번 변경 세트(130+ 파일)는 신규 외부 패키지 추가가 전혀 없다. `package.json` / `package-lock.json` 변경이 없으며, 의존성 관련 변경은 (1) 기존 `typeorm` 패키지에서 추가 연산자 심볼 import, (2) 기존 내부 i18n 모듈에서 훅·타입 추가 참조, (3) Node.js 내장 `node:fs` 모듈 사용, (4) Docker Compose `run --build` 플래그 도입 네 가지에 그친다. 라이선스, 취약점, 번들 크기, 버전 충돌 관점의 위험 요소가 없다. Docker Compose 버전 하한선이 문서화되어 있지 않은 점이 유일한 주의 사항이나, 실무적으로 최신 Docker Desktop 사용 환경에서는 문제가 되지 않을 것으로 판단된다.

### 위험도

NONE
