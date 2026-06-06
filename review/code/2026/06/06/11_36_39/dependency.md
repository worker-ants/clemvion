# 의존성(Dependency) 리뷰

## 발견사항

### [WARNING] @types/jsonwebtoken 버전 선언이 설치본과 불일치
- 위치: `codebase/backend/package.json` devDependencies — `"@types/jsonwebtoken": "^9.0.0"`
- 상세: `package.json`에 `^9.0.0`으로 선언했으나, 실제 설치본(`package-lock.json`)의 top-level `@types/jsonwebtoken`은 `9.0.10`이다. 이 `9.0.10`은 `@nestjs/jwt`가 이미 `dependencies`에 `"@types/jsonwebtoken": "9.0.10"`으로 고정 선언한 것이 hoist된 결과다. 즉 devDependencies의 `^9.0.0` 선언은 실질적으로 `@nestjs/jwt`가 pin한 버전을 그대로 사용하고 있으며, `^9.0.0` 범위 내 하위 버전(예: `9.0.0`~`9.0.9`)이 설치될 수 있다는 오해를 유발한다. `9.0.3`으로 고정(`jsonwebtoken`과 동일 시점 pin)하거나, 또는 `@nestjs/jwt`가 이미 types를 포함하므로 devDependencies 별도 선언을 생략하는 편이 더 명확하다.
- 제안: `"@types/jsonwebtoken": "9.0.10"` 으로 실 설치본에 맞게 pin하거나, `@nestjs/jwt`가 이미 `@types/jsonwebtoken`을 직접 의존성으로 포함하므로 devDependencies 중복 선언 자체를 제거하는 방안 검토.

### [INFO] jsonwebtoken devDependencies 명시 — W9 fix 확인 (적절)
- 위치: `codebase/backend/package.json` devDependencies — `"jsonwebtoken": "9.0.3"` (exact pin)
- 상세: 이전 리뷰(SUMMARY W9)에서 지적된 "jsonwebtoken이 @nestjs/jwt의 전이 의존성으로만 존재" 문제를 수정한 것이다. `package-lock.json`에서 `node_modules/jsonwebtoken`의 resolved 버전이 `9.0.3`이고, `@nestjs/jwt`도 `"jsonwebtoken": "9.0.3"`으로 pin하므로 버전이 일치한다. e2e 스펙 파일(`execution-park-resume.e2e-spec.ts` L3)에서 `import { sign } from 'jsonwebtoken'`을 직접 사용하는 코드가 존재하므로 명시 선언은 정당하다.
- 제안: 없음 (적절한 fix).

### [INFO] jsonwebtoken 9.0.3 — 라이선스 및 보안
- 위치: `codebase/backend/package.json` devDependencies
- 상세: `package-lock.json` 기준 `jsonwebtoken 9.0.3`의 license는 `MIT`로 프로젝트(UNLICENSED 내부 상업 코드)와 호환된다. 주요 known CVE(CVE-2022-23529, CVE-2022-23541)는 `9.0.0` 미만 버전에서 fix되었으며, `9.0.3`은 이를 포함한 최신 stable 버전이다. devDependencies 배치이므로 프로덕션 번들에는 포함되지 않는다.
- 제안: 없음.

### [INFO] jsonwebtoken이 devDependencies에 배치된 이유 — 적절한 분류
- 위치: `codebase/backend/package.json`
- 상세: `jsonwebtoken` 직접 호출(`sign`)은 e2e 테스트(`execution-park-resume.e2e-spec.ts`)에서만 발생한다. 프로덕션 경로는 `@nestjs/jwt` 모듈을 통해 간접 사용하므로 devDependencies 분류는 정확하다.
- 제안: 없음.

### [INFO] StubLlmClient — 외부 의존성 없음 (번들 영향 없음)
- 위치: `codebase/backend/src/modules/llm/clients/stub.client.ts`, `stub.client.spec.ts`
- 상세: 이번 변경에서 추가된 `StubLlmClient` 및 관련 테스트 파일은 외부 패키지를 일절 import하지 않는다. 순수 TypeScript 구현체이며 번들 크기·빌드 시간에 영향이 없다.
- 제안: 없음.

### [INFO] main.ts LLM_STUB_MODE 가드 — 의존성 관점 추가 사항 없음
- 위치: `codebase/backend/src/main.ts`
- 상세: 새 의존성 추가 없음. 기존 `process.env` 직접 참조 패턴이며 의존성 관점에서 영향 없다.
- 제안: 없음.

## 요약

이번 변경의 의존성 관점 핵심은 이전 리뷰 W9(jsonwebtoken 직접 선언 누락)를 `devDependencies`에 `"jsonwebtoken": "9.0.3"` exact pin으로 해결한 것이다. 버전은 `package-lock.json` 설치본 및 `@nestjs/jwt`의 의존 버전과 일치하며, devDependencies 배치도 사용 위치(e2e only)에 적합하다. 라이선스(MIT)와 보안(CVE-free 버전)도 문제없다. 단, 함께 추가된 `"@types/jsonwebtoken": "^9.0.0"`은 실 설치본(`9.0.10`, `@nestjs/jwt`가 이미 pin)과 범위 불일치가 있어 minor 혼란을 유발할 수 있다. `StubLlmClient` 신규 파일은 외부 의존성이 전혀 없어 번들·빌드에 무영향이다.

## 위험도

LOW
