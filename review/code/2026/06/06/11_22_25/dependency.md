# 의존성(Dependency) 리뷰

## 발견사항

### [WARNING] `jsonwebtoken`이 package.json에 직접 선언되지 않음
- 위치: `codebase/backend/test/execution-park-resume.e2e-spec.ts` 라인 3 — `import { sign } from 'jsonwebtoken'`
- 상세: `jsonwebtoken` 패키지가 `codebase/backend/package.json`의 `dependencies` 또는 `devDependencies`에 직접 명시되어 있지 않다. 현재는 `@nestjs/jwt`의 의존성(`"jsonwebtoken": "9.0.3"`)으로 전이적(transitive)으로 설치되어 동작한다. 다만 `@nestjs/jwt`가 버전 업되거나 내부 구현이 바뀌어 `jsonwebtoken`을 번들하거나 추상화할 경우 e2e 테스트가 암묵적으로 깨질 위험이 있다. `interaction-token.service.ts`와 `.spec.ts`도 동일하게 `from 'jsonwebtoken'`을 직접 import하므로 이미 소스 코드 레벨에서 직접 의존하는 상태다.
- 제안: `devDependencies`에 `"jsonwebtoken": "9.0.3"` (또는 `"^9.0.3"`)와 `"@types/jsonwebtoken": "^9.0.0"`을 명시적으로 추가한다. 이미 `@nestjs/jwt`가 동일 버전을 잠금하고 있으므로 충돌 위험은 없다.

### [WARNING] `LLM_STUB_MODE` 프로덕션 가드 부재
- 위치: `codebase/backend/src/modules/llm/llm.service.ts` 라인 81
- 상세: `OAUTH_STUB_MODE`는 `main.ts`에서 `NODE_ENV=production` 시 fail-closed 부트스트랩 가드를 두고, `isOAuthStubModeAllowed()` 헬퍼가 `test|development`만 허용한다. 반면 `LLM_STUB_MODE`는 `process.env.LLM_STUB_MODE === 'true'` 한 줄만으로 분기하며, `NODE_ENV` 검사가 없다. 운영 환경에서 이 변수가 잘못 주입되면 실제 LLM 호출 없이 stub이 활성화되어 프로덕션 응답이 `[stub] received: ...` echo로 대체된다. LLM stub은 인증 우회보다 위험도가 낮지만, 동일 패턴을 따르지 않으면 운영 사고 가능성이 있다.
- 제안: `OAUTH_STUB_MODE`와 동일하게 (1) `main.ts` 부트스트랩에 `NODE_ENV=production && LLM_STUB_MODE=true`이면 프로세스 종료 가드를 추가하거나, (2) `llm.service.ts` 분기 조건을 `process.env.LLM_STUB_MODE === 'true' && (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development')`로 강화한다.

### [INFO] 새 외부 패키지 추가 없음 — 기존 의존성 활용
- 위치: 전체 diff
- 상세: 이번 변경에서 `package.json`에 새로 추가된 외부 패키지는 없다. `StubLlmClient`(`stub.client.ts`)는 순수 TypeScript로 작성되어 외부 의존성이 전혀 없다. `jsonwebtoken`은 신규 추가가 아니라 이미 전이적으로 존재하는 패키지를 import한 것이다. `LLM_STUB_MODE` env 환경 변수는 `docker-compose.e2e.yml`에만 주입되므로 운영 이미지 빌드 산출물에는 영향이 없다.

### [INFO] 내부 의존성 구조 — 인터페이스 기반 정상 분리
- 위치: `codebase/backend/src/modules/llm/clients/stub.client.ts`
- 상세: `StubLlmClient`는 `../interfaces/llm-client.interface`에서 타입만 import하고, `LLMClient` 인터페이스를 구현한다. 런타임 의존성이 없는 순수 값 반환 구현체이므로 번들 크기·빌드 시간에 영향이 없다. `LlmService`가 `StubLlmClient`를 직접 import하는 것은 env-gated 분기를 위한 최소 결합이며, 팩토리나 DI 컨테이너 우회 없이 합리적으로 처리됐다.

### [INFO] `docker-compose.e2e.yml` — e2e 전용 격리 확인됨
- 위치: `docker-compose.e2e.yml` 라인 1686
- 상세: `LLM_STUB_MODE: "true"`는 `backend-e2e` 서비스에만 주입되며, `profiles: ["test"]` 분리와 worktree 단위 compose project 격리로 운영 compose와 충돌하지 않는다. 기존 `OAUTH_STUB_MODE` 선례와 동일한 위치에 추가되어 패턴 일관성을 유지한다.

## 요약

이번 변경은 새 외부 패키지를 추가하지 않고 기존 인프라(전이적 `jsonwebtoken`, 내부 LLM 인터페이스)를 활용해 e2e stub을 구현했다. 핵심 우려는 두 가지다. 첫째, `jsonwebtoken`을 소스에서 직접 import하면서 `package.json`에 직접 선언하지 않아 전이 의존성에 묵시적으로 의존하는 취약한 결합이 있다. 둘째, `OAUTH_STUB_MODE`가 갖춘 프로덕션 fail-closed 가드를 `LLM_STUB_MODE`는 갖추지 않아, 인프라 실수로 운영 환경에서 stub이 활성화될 경우 LLM 응답이 echo stub으로 대체될 수 있다. 두 항목 모두 비교적 낮은 위험도이나, 기존 프로젝트 패턴과의 일관성 차원에서 수정이 권장된다.

## 위험도

LOW
