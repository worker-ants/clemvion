# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [INFO] main.ts — OAUTH_STUB_MODE/LLM_STUB_MODE 인라인 가드 제거
- 위치: `codebase/backend/src/main.ts`, bootstrap() 함수 초반
- 상세: 기존에 `bootstrap()` 내부에 인라인으로 존재하던 OAUTH_STUB_MODE·LLM_STUB_MODE throw 블록이 제거되고, `assertProductionConfig(process.env)` 단일 호출로 대체되었다. 기능적으로 동일하며 두 가드 모두 `production-guards.ts` 안에서 동일 조건으로 재구현되어 있다. 기존 동작을 변경하지 않는 리팩터링이다.

### [INFO] main.ts — Logger 인스턴스를 `new` 로 직접 생성
- 위치: `codebase/backend/src/main.ts`, ALLOW_PRIVATE_HOST_TARGETS warn 블록
- 상세: `new Logger('Bootstrap').warn(...)` 는 NestJS DI 컨텍스트 밖에서 Logger를 직접 인스턴스화한다. `bootstrap()` 함수는 `app` 생성 이전 시점에 이 코드가 실행되며, Logger 인스턴스를 변수에 할당하지 않고 바로 버린다. 이것은 의도한 패턴(일회성 경고 출력)이지만, 해당 Logger 인스턴스는 NestJS가 자체 관리하는 Logger 파이프라인(버퍼/레벨 설정)을 거치지 않고 콘솔에 직접 쓴다. 운영에서 구조화 로그(JSON/OTLP) 어댑터가 `app.useLogger()`로 주입되기 전이라면 경고 로그가 plain text로만 출력될 수 있다. 사이드 이펙트 관점에서는 의도치 않은 상태 변경이 없고 해당 warn이 누락되는 것도 아니므로 수용 가능하다.

### [INFO] production-guards.ts — 모듈 로드 시점 Set 상수 초기화
- 위치: `codebase/backend/src/common/config/production-guards.ts`, INSECURE_JWT_SECRETS / KNOWN_EXAMPLE_ENCRYPTION_KEYS
- 상세: `export const` 로 선언된 두 `ReadonlySet<string>` 은 모듈 import 시 단 1회 초기화되는 모듈 레벨 상수다. 이후 변경 불가(ReadonlySet)이므로 공유 상태 변경 위험이 없다. 테스트 환경에서도 동일 모듈을 import 하는 모든 테스트가 같은 Set 참조를 공유하지만, 읽기 전용이라 오염 경로가 없다.

### [INFO] assertProductionConfig — 기본 매개변수 `process.env` 참조
- 위치: `codebase/backend/src/common/config/production-guards.ts`, 함수 시그니처
- 상세: `env: NodeJS.ProcessEnv = process.env` 가 기본 매개변수로 `process.env` 를 사용한다. 이는 함수 호출 시점의 `process.env` 를 참조하므로, 테스트에서 `process.env` 를 직접 조작(jest.replaceProperty 등)한 채 인자 없이 호출하면 조작된 값이 읽힌다. 하지만 spec 파일이 명시적으로 환경 맵을 주입하는 방식(`prodEnv()`)을 사용하므로 실제 테스트에서 `process.env` 부작용 위험은 없다. `assertProductionConfig` 자체는 env를 쓰지 않고 읽기만 하므로 환경 변수 쓰기 부작용은 발생하지 않는다.

### [INFO] .env.example — ENCRYPTION_KEY placeholder 변경
- 위치: `codebase/backend/.env.example`, ENCRYPTION_KEY 라인
- 상세: 기존 `0123456789abcdef...` 예시 키가 `0000000000000000...` (all-zero)로 교체되었다. `production-guards.ts` 의 `KNOWN_EXAMPLE_ENCRYPTION_KEYS` 에는 두 값 모두 포함되어 있으므로, 이전 예시 키를 복붙해 이미 운영하던 환경도 차단된다. 이는 의도된 동작이다. `.env.example` 은 실행 환경의 상태를 변경하지 않는 문서 파일이므로 런타임 부작용 없음.

### [INFO] plan/complete/security-jwt-secret-fallback.md — status frontmatter 변경
- 위치: `plan/complete/security-jwt-secret-fallback.md`, frontmatter `status` 필드
- 상세: diff에서 `status: backlog` → `status: superseded` 로 변경. plan 파일은 런타임 상태에 영향을 주지 않으며, 추적 문서의 상태 갱신이다. 부작용 없음.

## 요약

이번 변경은 production 부팅 가드를 main.ts 인라인에서 순수 함수(`assertProductionConfig`)로 추출·중앙화하는 리팩터링이다. 기존 OAUTH_STUB_MODE·LLM_STUB_MODE 가드는 동일한 조건으로 재구현되어 있고, 신규 항목(JWT_SECRET 미설정/예시값, ENCRYPTION_KEY 미설정/예시값, MCP_ALLOW_INSECURE_URL)만 추가되었다. 함수가 `process.env`를 읽기만 하고 쓰지 않으므로 환경 변수 부작용이 없으며, 모듈 레벨 Set 상수는 불변이다. ALLOW_PRIVATE_HOST_TARGETS 경고에 사용된 `new Logger(...)` 는 DI 외부 인스턴스화라 로그 포맷 어댑터를 거치지 않을 수 있으나 보안·상태 부작용은 없다. 전반적으로 의도하지 않은 부작용이 발견되지 않았다.

## 위험도

NONE
