# 의존성(Dependency) 리뷰 결과

## 발견사항

### [INFO] web-chat-sdk devDependencies — ESLint 4개 신규 추가 (기존 패턴과 일관)
- 위치: `codebase/packages/web-chat-sdk/package.json` devDependencies
- 상세: `@eslint/js ^9.18.0`, `eslint ^9.18.0`, `globals ^16.0.0`, `typescript-eslint ^8.20.0` 4개 신규 추가. 모두 `codebase/backend/package.json`에 이미 동일 semver 범위로 선언된 버전이므로 monorepo 내 버전 정합성 유지됨. devDependency이므로 런타임 번들 및 npm 소비자에게 영향 없음. `package-lock.json`이 함께 커밋되어 실제 설치 버전이 고정됨(재현성 확보).
- 추가 관찰: lock 파일 실제 설치 버전(`eslint 9.39.4`, `typescript-eslint 8.60.0`, `globals 16.5.0`, `@eslint/js 9.39.4`)이 package.json semver 범위(`^9.18.0`, `^8.20.0`, `^16.0.0`) 내에 있어 정상적인 lock 동작임.
- 제안: 없음.

### [INFO] channel-web-chat — 의존성 변경 없음
- 상세: `codebase/channel-web-chat/package.json`은 이번 변경에서 수정되지 않았다. 신규 컴포넌트(`presentations.tsx`, `presentation.ts`)와 상태 기계 확장은 기존 의존성(`react 19.2.4`, `next ^16.2.6`, `vitest ^3`, `@testing-library/react ^16`)만 사용한다. chart 렌더링에 별도 차트 라이브러리를 추가하지 않고 inline SVG로 구현한 것은 번들 크기 측면에서 긍정적인 선택이다.
- 제안: 없음.

### [INFO] backend — 의존성 변경 없음, 기존 패키지 재사용
- 위치: `codebase/backend/src/modules/hooks/embed-config.service.ts`
- 상세: `EmbedConfigService`는 `@nestjs/common`, `@nestjs/typeorm`, `typeorm` 등 기존 backend 의존성만 사용. `Workspace` 엔터티 신규 import는 `hooks.module.ts`의 `TypeOrmModule.forFeature([Trigger, Node, Workspace])`에 정상 등록됨. 신규 외부 패키지 추가 없음.
- 제안: 없음.

### [INFO] GitHub Actions — tag 버전 사용, SHA 핀닝 없음 (기존 패턴 일관)
- 위치: `.github/workflows/web-chat-checks.yml` (`actions/checkout@v5`, `actions/setup-node@v6`)
- 상세: `actions/checkout@v5`와 `actions/setup-node@v6`를 SHA 없이 tag 버전으로 참조한다. SHA 핀닝이 없으면 tag 재지정(tag mutation) 시 예기치 않은 버전이 실행될 수 있다. 단, 이 패턴은 기존 `frontend-checks.yml`, `e2e.yml` 등 모든 기존 워크플로와 동일하므로 이번 변경이 새로운 위험을 도입하는 것은 아니다.
- 제안: 프로젝트 전체 CI 보안 정책으로 SHA 핀닝(`actions/checkout@<sha>`) 도입을 고려할 수 있으나 현재 변경 범위에서 필수 조치 아님.

### [WARNING] byo-ui-headless.ts — `@workflow/sdk` import가 package.json에 미선언
- 위치: `codebase/packages/web-chat-sdk/examples/byo-ui-headless.ts` (1행: `import { ClemvionClient } from "@workflow/sdk"`)
- 상세: `examples/byo-ui-headless.ts`가 `@workflow/sdk`를 import하지만 `codebase/packages/web-chat-sdk/package.json`의 `dependencies` 또는 `devDependencies`에 `@workflow/sdk`가 선언되지 않았다. `package.json`의 `//dependencies` 주석에 "스캐폴딩 stub 은 미사용이라 보류"라고 명시되어 있으나, 실제 코드가 import를 포함하게 되어 선언과 코드 간 불일치가 생겼다. `tsconfig.json`의 `include`가 `src/**/*.ts`로 한정되고 `examples/`가 제외되므로 `tsc` 빌드 시 타입 오류는 발생하지 않는다. 그러나 개발자가 예제를 직접 실행하거나 `typecheck` 스크립트를 `examples/`까지 포함하도록 확장하면 모듈 해석 실패가 발생한다.
- 제안: 아래 중 하나를 선택한다.
  1. `package.json`의 `devDependencies`에 `"@workflow/sdk": "file:../sdk"` 추가 (로컬 file: 참조, 이미 `//dependencies` 주석에 예고된 경로).
  2. 또는 `byo-ui-headless.ts` 상단에 "이 예제를 실행하려면 `@workflow/sdk`(file:../sdk)를 수동으로 설치하거나 link 필요" 주석 추가 (최소 조치).

### [INFO] 라이선스 — 신규 추가 패키지 모두 MIT
- 상세: `@eslint/js`(MIT), `eslint`(MIT), `globals`(MIT), `typescript-eslint`(MIT). 모두 MIT 라이선스로 상업적 사용·재배포 허용. 프로젝트 라이선스(`UNLICENSED`)와 충돌 없음.
- 제안: 없음.

### [INFO] 취약점 — 신규 패키지 기준 알려진 CVE 없음
- 상세: `eslint 9.39.4`, `typescript-eslint 8.60.0`, `globals 16.5.0`, `@eslint/js 9.39.4` 모두 2026년 6월 기준 알려진 CVE 없음. devDependency이므로 런타임 공격 표면 없음.
- 제안: 없음.

### [INFO] 내부 의존성 — hooks.module.ts의 Workspace 추가가 순환 의존 없이 정상 처리됨
- 위치: `codebase/backend/src/modules/hooks/hooks.module.ts`
- 상세: `TypeOrmModule.forFeature([Trigger, Node, Workspace])` 추가로 `EmbedConfigService`가 `Workspace` 레포지터리를 주입받을 수 있게 되었다. `WorkspacesModule` 전체를 import하지 않고 TypeORM 피처 등록만 하는 패턴으로 모듈 간 순환 의존 위험이 없다. 기존 `HooksModule`의 `forwardRef` 패턴과 일관된 방식이다.
- 제안: 없음.

## 요약

이번 변경에서 신규 외부 의존성 추가는 `codebase/packages/web-chat-sdk`의 ESLint 관련 devDependency 4개(`@eslint/js`, `eslint`, `globals`, `typescript-eslint`)에 한정된다. 모두 MIT 라이선스이고, 동일 버전이 backend에 이미 선언되어 있어 monorepo 버전 정합성이 유지된다. `package-lock.json` 커밋으로 재현성이 확보되어 있고 lock 버전이 semver 범위 내에 있다. chart 렌더링에 외부 차트 라이브러리 대신 inline SVG를 선택한 것은 번들 크기 영향을 최소화한 긍정적인 판단이다. 주요 주의 사항은 `examples/byo-ui-headless.ts`가 `@workflow/sdk`를 import하나 `package.json`에 선언이 없는 불일치(WARNING)이며, `tsconfig.json` exclude로 빌드 영향은 없으나 예제 실행 시 모듈 해석 실패가 발생할 수 있다. GitHub Actions의 SHA 미핀닝은 기존 워크플로와 동일한 패턴이므로 이번 변경이 새로운 위험을 추가하지 않는다.

## 위험도

LOW

---

STATUS=success ISSUES=1
