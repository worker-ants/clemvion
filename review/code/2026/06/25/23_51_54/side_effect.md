# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [INFO] 모듈 스코프 Logger 인스턴스 — 공유 상태이나 의도된 설계
- 위치: `telegram-message.renderer.ts:9`, `language-hint-defaults.ts:3`
- 상세: `const logger = new Logger('...')` 가 모듈 최상위(module scope)에 선언되어 모든 호출자가 단일 인스턴스를 공유한다. NestJS `Logger` 는 내부적으로 static 상태(`Logger.overrideLogger`, `Logger.logLevels`)를 갖지만, 이는 NestJS DI 컨테이너 설계상 전역 공유가 의도된 것이고 본 변경이 해당 static 상태를 수정하지 않는다. 부작용 없음.
- 제안: 해당 없음.

### [INFO] 테스트 spy 대상 변경 — `console.warn` → `Logger.prototype.warn`
- 위치: `node-handler.registry.spec.ts:349`, `language-hint-defaults.spec.ts:1668`
- 상세: `.spyOn(console, 'warn')` 에서 `.spyOn(Logger.prototype, 'warn')` 으로 교체되었다. `Logger.prototype` spy 는 테스트 실행 중 동일 프로세스 내 모든 Logger 인스턴스의 `warn` 호출을 가로막는다. 두 테스트 모두 `mockRestore()` 로 정상 복원하므로 테스트 간 누출(leak)은 없다. 단, 병렬 실행 시(Jest `--runInBand` 미사용 + 동일 worker 배치) prototype spy 가 다른 테스트의 Logger 출력을 일시 차단할 수 있으나, Jest 의 기본 worker isolation 으로 완화된다.
- 제안: 현 구현으로 충분. 경계 조건을 명확히 하려면 `afterEach(() => jest.restoreAllMocks())` 를 상위 `describe` 에 추가하는 것을 고려할 수 있으나 필수는 아님.

### [INFO] `node-handler.registry.spec.ts` warn 메시지 검증 문자열 변경
- 위치: `node-handler.registry.spec.ts:353`
- 상세: 이전 spy 는 `console.warn('[NodeHandlerRegistry] (non-production) ...')` 전체 문자열에서 `'NodeHandlerRegistry'` 를 검증했다. 새 spy 는 `Logger.prototype.warn` 의 첫 번째 인자가 `'executionMetadata'` 를 포함하는지 확인한다. NestJS Logger 는 컨텍스트를 별도 인자로 처리하므로 `warn(message)` 의 `message` 파라미터만 spy 에 잡히며, 실제 메시지 문자열이 `executionMetadata` 를 포함하는 것이 코드상 확인된다. 기능 동등성 유지됨.
- 제안: 해당 없음.

### [INFO] `eslint.config.mjs` `no-console: error` 추가 — 빌드 파이프라인 부작용
- 위치: `eslint.config.mjs:69`
- 상세: 새 규칙이 프로젝트 전체 lint 게이트를 강화한다. 이는 의도된 변경이며, 면제(override)가 `src/scripts/**`, `src/instrumentation.ts`, `*.spec.ts` / `*.e2e-spec.ts` / `test/**` 에 적용되어 있다. 커밋 메시지에 "잔여 un-exempted console.* 0건" 으로 전수 확인됨.
- 제안: 해당 없음.

### [INFO] `code.handler.ts` inline `eslint-disable` 추가 — 런타임 동작 변경 없음
- 위치: `code.handler.ts:41, 45, 121`
- 상세: `resolveMemoryLimitMb()` 의 두 `console.warn` 과 `DAYJS_SNAPSHOT` IIFE 내 `console.warn` 에 `eslint-disable-next-line no-console` 주석을 추가했다. 런타임 동작을 전혀 바꾸지 않으며 lint 경고 억제만 한다.
- 제안: 해당 없음.

### [INFO] `main.ts` `logger.log` 전환 — 로그 출력 형식 변경
- 위치: `main.ts:448, 450`
- 상세: `console.log(...)` → `logger.log(...)` 전환으로 출력 형식이 바뀐다. `console.log` 는 `Application running on port 3011` 평문이었고, NestJS `Logger.log` 는 `[Bootstrap] Application running on port 3011 +0ms` 형태로 컨텍스트 접두어와 타임스탬프를 포함한다. 로그 파이프라인(예: 클라우드 로그 에이전트)이 부트스트랩 메시지의 특정 텍스트 패턴을 파싱하고 있다면 형식 변경에 의한 파싱 오류가 발생할 수 있다.
- 제안: 로그 파이프라인이 이 메시지를 패턴 매칭하고 있지 않다면 무시 가능. 구조화 로깅 규약으로의 전환이 의도된 목적이므로 수용.

## 요약

본 변경은 `console.*` → NestJS `Logger` 전환 리팩터링으로, 공개 API·함수 시그니처·환경 변수·파일시스템·네트워크 호출에 어떠한 변경도 없다. 전역 상태 관점에서는 모듈 스코프 `logger` 인스턴스가 NestJS `Logger` 의 static 레벨 설정을 공유하지만 이는 프레임워크 설계 내 의도된 동작이다. 테스트 spy 가 `Logger.prototype` 레벨로 올라간 점은 동일 Jest worker 내 다른 Logger 호출을 일시 차단할 수 있으나 `mockRestore()` 로 항상 복원되어 누출이 없다. 부트스트랩 로그 형식이 `console.log` 평문에서 NestJS 구조화 포맷으로 바뀌는 것이 유일한 관찰 가능한 런타임 차이이며, 이는 규약 정합 목적의 의도된 변경이다. 전체적으로 의도치 않은 부작용은 발견되지 않는다.

## 위험도

NONE
