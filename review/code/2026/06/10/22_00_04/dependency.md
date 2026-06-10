# 의존성(Dependency) 리뷰

## 발견사항

### [INFO] `pLimit` (p-limit) — 기존 의존성 사용 확인
- 위치: `codebase/backend/src/modules/execution-engine/containers/parallel-executor.ts` (전체 파일 컨텍스트 `import pLimit from 'p-limit'`)
- 상세: `parallel-executor.ts` 는 이미 `p-limit` 을 사용 중이며 이번 변경(M-5 freeze 추가)에서 새로운 외부 의존성을 추가하지 않았다. `deepFreeze` / `freezeSharedCacheValues` 는 표준 `Object.freeze` / `Object.values` 만 활용하는 순수 내부 구현이다.
- 제안: 해당 없음.

### [INFO] Node.js 표준 라이브러리만 활용 — 신규 외부 의존성 없음
- 위치: 전체 변경 파일
- 상세: 이번 변경(파일 1~16)에서 `package.json` 또는 `package-lock.json` 의 추가/변경은 없다. 모든 새 코드는 아래 중 하나를 사용한다.
  - Node.js 내장(`node:os`, `node:crypto`) — `continuation-bus.service.ts` 기존 사용
  - TypeScript/JavaScript 표준 API(`Object.freeze`, `Object.values`, `Object.isFrozen`, `process.env`)
  - 이미 등록된 프레임워크(`@nestjs/*`, `bullmq`, `ioredis`, `p-limit`)
- 제안: 해당 없음.

### [INFO] `process.env.NODE_ENV` 환경 변수 의존 — dev/test 전용 분기
- 위치: `codebase/backend/src/modules/execution-engine/containers/parallel-executor.ts` 라인 `const FREEZE_BRANCH_CACHE = process.env.NODE_ENV !== 'production'`
- 상세: 신규 외부 패키지 의존성은 아니지만 런타임 환경 변수(`NODE_ENV`)에 대한 의존이 추가된다. `NODE_ENV` 는 NestJS 생태계 표준으로 이미 존재하며, `production` 미설정 시 freeze 가 활성화되어 불필요한 deepFreeze 호출이 발생할 수 있다. CI/staging 환경에서 `NODE_ENV=test` 또는 `NODE_ENV=development` 가 설정돼 있어야 의도대로 동작하므로, 환경 설정 문서화 여부를 확인하는 것이 권장된다.
- 제안: 기존 NestJS 표준과 동일 패턴이므로 문제없음. 주석이 이미 "dev/test 에서만 적용"을 명기하고 있어 충분하다.

### [INFO] deprecated 심볼 제거 — 내부 모듈 간 의존 관계 정리
- 위치:
  - `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts` — `toEiaEvent` export alias 제거
  - `codebase/backend/src/modules/execution-engine/continuation/continuation-bus.service.ts` — `on()` 메서드 제거
  - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `registerContinuationHandlers()` private 메서드 제거
  - `codebase/backend/src/modules/system-status/system-status.constants.ts` — `FAILED_DEGRADED_THRESHOLD`, `DELAYED_DEGRADED_THRESHOLD` 상수 export 제거
- 상세: 모두 `@deprecated` 로 표시된 내부 심볼의 제거이다. `toEiaEvent` 는 `toChatChannelEvent` 의 alias 였으며, spec 테스트에서만 참조되었다. 제거 전 모든 참조가 `toChatChannelEvent` 로 교체되어 내부 의존 관계가 올바르게 정리되었다. `on()` no-op stub 및 `registerContinuationHandlers()` no-op stub 도 BullMQ Worker 가 완전히 대체한 이후의 잔재이므로 제거가 적절하다.
- 제안: 해당 없음.

## 요약

이번 변경 전반에 걸쳐 신규 외부 패키지 의존성이 전혀 추가되지 않았다. 모든 구현은 Node.js 표준 API, 기존 등록된 프레임워크(`@nestjs/*`, `bullmq`, `ioredis`, `p-limit`), 그리고 `process.env.NODE_ENV` 표준 환경 변수만을 활용한다. 주요 의존성 변화는 내부 deprecated 심볼(`toEiaEvent`, `on()`, `registerContinuationHandlers`, `FAILED_DEGRADED_THRESHOLD`, `DELAYED_DEGRADED_THRESHOLD`) 제거에 의한 내부 모듈 간 의존 관계 정리이며, 이는 BullMQ Worker 로의 완전 전환 이후 잔재를 처리한 의도적 정리이다. 버전 고정, 라이선스 충돌, 취약점, 번들 크기 영향 면에서 리스크가 없다.

## 위험도

NONE
