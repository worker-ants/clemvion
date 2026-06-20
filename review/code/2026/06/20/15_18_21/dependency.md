# Dependency Review

## 발견사항

### [WARNING] `jsonwebtoken` 정확 버전 고정 (caret 없음)
- 위치: `/Volumes/project/private/clemvion/codebase/backend/package.json` line 67 (`"jsonwebtoken": "9.0.3"`)
- 상세: `jsonwebtoken` 이 `9.0.3` 으로 caret(`^`) 없이 정확 고정되어 있다. 이로 인해 향후 보안 패치(`9.0.4` 등)가 `pnpm update` 로 자동 반영되지 않는다. `jsonwebtoken` 은 JWT 서명·검증의 핵심 패키지로, 보안 수정이 지연되는 위험이 있다. 이 고정은 이번 diff 에서 새로 도입된 것이 아닌 기존 설정이나, 본 PR 에서 수정되지 않고 유지된다.
- 제안: 의도적 고정이라면 `package.json` 에 인라인 주석(`// 의도적 고정: 이유`)으로 근거를 명시할 것. 그렇지 않다면 `"^9.0.3"` 으로 변경해 패치 버전 업데이트를 허용할 것. 단, `@types/jsonwebtoken` 이 `^9.0.0` 으로 선언되어 있어 버전 추적이 가능하므로 `^` 복원이 안전하다.

### [INFO] `gray-matter` 프론트엔드 프로덕션 번들 포함 여부 미검증
- 위치: `/Volumes/project/private/clemvion/codebase/frontend/package.json` (`"gray-matter": "^4.0.3"`)
- 상세: `gray-matter` 가 frontend `dependencies`(프로덕션 의존성)에 선언되어 있다. 이번 diff 에서 `plan-frontmatter.test.ts`(vitest 테스트)가 `gray-matter` 를 import 하는데, 이 사용은 순수 Node.js 테스트 컨텍스트다. `gray-matter` 는 `js-yaml`, `strip-bom-string` 등의 Node.js 전용 API 를 포함하며, Next.js CSR 번들에 포함될 경우 불필요한 번들 크기 증가가 발생할 수 있다. `registry.ts` 서버사이드 사용이 있다면 정당하나, 클라이언트 번들 포함 여부가 확인되지 않았다.
- 제안: `next build` 후 번들 분석기(`@next/bundle-analyzer`) 또는 `next build --debug` 로 `gray-matter` 가 클라이언트 번들에 포함되는지 확인 권장. 테스트 전용이라면 `devDependencies` 로 이동이 적합하나, 서버사이드 사용이 있다면 현행 유지 가능.

### [INFO] `@nestjs/swagger` 정확 버전 고정 (`pnpm.overrides`)
- 위치: 루트 `/Volumes/project/private/clemvion/package.json` `pnpm.overrides."@nestjs/swagger": "11.2.7"`
- 상세: `@nestjs/swagger` 가 workspace-global `pnpm.overrides` 에서 `11.2.7` 로 정확 고정되어 있다. 이는 이번 diff 에 포함되지 않은 기존 설정이며, 루트 `package.json` 의 `//swagger-pin` 주석에 고정 근거(`deep-import` 호환성 문제)가 명시되어 있다. 이번 변경에서 영향 없음.
- 제안: 없음. 주석으로 근거가 충분히 문서화되어 있음.

### [INFO] 이번 diff 에서 새 외부 의존성 추가 없음
- 위치: `codebase/backend/package.json` diff
- 상세: 이번 변경은 `package.json` 의 `lint` 스크립트를 `report-only` 로 전환하고 `lint:fix` 스크립트를 별도로 추가한 것이다. 새 외부 패키지/라이브러리 추가는 없다. ESLint 설정 파일(`eslint.config.mjs`)의 규칙 변경은 기존 `typescript-eslint`, `eslint-plugin-prettier` 를 그대로 사용한다.

### [INFO] 내부 workspace 의존성 (`@workflow/*`) 이번 diff 영향 없음
- 위치: `codebase/backend/package.json` `"@workflow/chat-channel-validation": "workspace:*"` 등 4개
- 상세: 이번 변경에서 내부 workspace 패키지(`@workflow/chat-channel-validation`, `@workflow/expression-engine`, `@workflow/graph-warning-rules`, `@workflow/node-summary`)에 대한 변경이 없다. `workspace:*` 로 선언되어 있어 버전 고정 관리는 pnpm workspace 가 담당한다. 이상 없음.

## 요약

이번 diff 는 backend `lint` 스크립트를 `--fix` 제거(report-only) 로 전환하고 `lint:fix` 를 별도 스크립트로 분리한 변경이다. 새 외부 의존성 추가가 없고, 기존 ESLint 관련 패키지(`typescript-eslint`, `eslint-plugin-prettier`)를 그대로 사용한다. 의존성 관점의 주요 위험은 기존에 이미 존재하는 `jsonwebtoken` 의 정확 버전 고정(caret 없음)으로, 이번 변경과 직접적인 인과 관계는 없으나 보안 패치 자동 반영이 차단되는 구조적 위험이다. `gray-matter` 의 프론트엔드 번들 포함 여부는 비차단 advisory 수준이다.

## 위험도

LOW

STATUS: success
