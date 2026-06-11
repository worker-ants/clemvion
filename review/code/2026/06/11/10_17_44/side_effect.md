# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [INFO] production-guards.ts: 모듈 수준 상수가 import 시점에 Set을 초기화
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/prod-fail-closed-guards/codebase/backend/src/common/config/production-guards.ts` — `INSECURE_JWT_SECRETS`, `KNOWN_EXAMPLE_ENCRYPTION_KEYS` 선언부
- 상세: 두 `ReadonlySet<string>` 상수는 `new Set([...])` 호출로 모듈 import 시점에 힙에 할당된다. 이는 의도된 설계이며 변경 가능 상태를 공유하지 않는다(ReadonlySet). 부작용 없음.
- 제안: 현행 유지.

### [INFO] assertProductionConfig: 기본 파라미터 `process.env` 참조
- 위치: `production-guards.ts` — `assertProductionConfig(env: NodeJS.ProcessEnv = process.env)`
- 상세: 기본 인자가 `process.env` (전역 객체 참조)를 사용한다. 함수 자체는 env 를 **읽기만** 하고 쓰지 않으므로 전역 변수 변경은 없다. 테스트에서 주입 경로를 사용하므로 `process.env` 직접 의존도 테스트 격리에 문제 없다.
- 제안: 현행 유지.

### [INFO] main.ts: bootstrap 함수 내 Logger 인스턴스 생성이 NestFactory.create 이전에 위치
- 위치: `main.ts` — `const logger = new Logger('Bootstrap')` (NestFactory.create 호출보다 앞)
- 상세: `assertProductionConfig` 가드 바로 뒤에 `logger.warn(...)` 분기가 있다. Logger 인스턴스는 NestJS 프레임워크 초기화 이전에 생성되지만, `@nestjs/common` 의 Logger 는 NestJS DI 컨텍스트 없이도 독립적으로 동작하므로 부작용 없다. 단, production guard 가 throw 하면 logger 인스턴스 자체는 GC 대상이 되며 warn 로그가 남지 않는다—의도된 동작이다(throw 가 warn보다 우선).
- 제안: 현행 유지.

### [INFO] main.ts: OAUTH_STUB_MODE / LLM_STUB_MODE 기존 인라인 가드 제거 및 assertProductionConfig 위임
- 위치: `main.ts` diff — 기존 22행 가드 블록 제거
- 상세: 두 인라인 `if (process.env.NODE_ENV === 'production' && ...)` throw 블록이 `assertProductionConfig` 단일 호출로 교체됐다. 호출 시점(bootstrap 진입부)이 동일하고 throw 의미가 동일하므로 호출자 영향 없다. 기존 throw 메시지가 영어였던 것이 한국어로 바뀌었으나, 이 메시지는 운영자 대상(부팅 거부 로그)이고 인터페이스가 아니므로 파괴적 변경 아니다.
- 제안: 현행 유지.

### [INFO] .env.example: ENCRYPTION_KEY placeholder 값 변경 (0123... → 0000...)
- 위치: `codebase/backend/.env.example` diff
- 상세: 예시 키가 `0123456789abcdef...` 에서 `000...0` 으로 변경됐다. 이 파일은 런타임에 읽히지 않으며 실제 `.env` 를 생성하는 참조 문서다. 옛 값(`0123...`)은 `KNOWN_EXAMPLE_ENCRYPTION_KEYS` Set 에 그대로 유지되어 이미 그 값을 쓰는 배포도 production 부팅에서 차단된다. 부작용 없음.
- 제안: 현행 유지.

### [INFO] 테스트 파일 production-guards.spec.ts: process.env 를 직접 변경하지 않음
- 위치: `production-guards.spec.ts` 전체
- 상세: 모든 테스트가 `prodEnv(over)` 헬퍼로 순수 객체를 전달하고 `assertProductionConfig(env)` 를 호출한다. `process.env` 를 직접 읽거나 쓰지 않으므로 테스트 간 상태 오염 없다. 병렬 테스트 실행에서도 안전하다.
- 제안: 현행 유지.

### [INFO] spec 문서 변경: 인터페이스 변경 없음, 문서 전용
- 위치: `spec/5-system/1-auth.md`, `spec/5-system/11-mcp-client.md`, `spec/5-system/14-external-interaction-api.md`, `spec/5-system/7-llm-client.md`, `spec/conventions/secret-store.md`
- 상세: 모든 spec 변경은 기존 동작에 대한 서술 추가(production fail-closed 정책 문서화)이며 코드 인터페이스·API 계약 변경이 없다. 부작용 없음.
- 제안: 현행 유지.

### [INFO] plan/complete/security-jwt-secret-fallback.md: status 필드 변경 (backlog → superseded)
- 위치: `plan/complete/security-jwt-secret-fallback.md` frontmatter
- 상세: 계획 문서의 `status` 필드가 `backlog` 에서 `superseded` 로 변경됐다. 런타임 부작용 없다.
- 제안: 현행 유지.

---

## 요약

이번 변경은 production 부팅 가드 로직을 `main.ts` 인라인에서 `common/config/production-guards.ts` 의 순수 함수 `assertProductionConfig` 로 추출한 리팩토링이다. 신규 전역 변수 도입 없이 `ReadonlySet` 상수 2개(모듈 스코프)가 추가됐으며, 이는 변경 불가능하고 외부에 노출되지 않는다. `assertProductionConfig` 함수는 환경 맵을 읽기만 하고 쓰지 않는 순수 함수 설계로 환경 변수 부작용이 없다. `main.ts` 의 기존 throw 정책이 동일한 의미로 위임됐으며 호출 시점이 동일해 기존 호출자에 영향이 없다. 테스트 파일은 `process.env` 를 직접 조작하지 않아 테스트 격리가 보장된다. 의도치 않은 부작용은 발견되지 않았다.

## 위험도

NONE
