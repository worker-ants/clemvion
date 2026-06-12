# 아키텍처(Architecture) 리뷰 결과

## 발견사항

- **[INFO]** `resolveMemoryLimitMb()` 함수의 공개 export 범위 불일치
  - 위치: `/codebase/backend/src/nodes/data/code/code.handler.ts` 라인 1079
  - 상세: 함수가 `@internal Exported only for unit testing` 주석을 달고 있음에도 `export function`으로 공개 심볼로 노출된다. TypeScript에는 `@internal`을 실제로 강제하는 가시성 키워드가 없어, 모듈 경계 외부에서도 호출 가능하다. 의도적이나 아키텍처적으로 "테스트용 노출"이라는 개념이 모듈 경계를 명확히 표현하지 못한다.
  - 제안: 단위 테스트 시 환경 변수를 조작(process.env 직접 set/restore)하는 현 패턴은 적절하다. 다만 모듈 내부 함수를 테스트하기 위해 export하는 패턴이 반복될 경우 별도 `__tests__/internals/` 테스트-only re-export 파일이나 `jest.config`의 `moduleNameMapper`를 활용하는 방식을 장기적으로 검토할 수 있다. 현 변경 범위에서는 INFO 수준.

- **[INFO]** `CodeHandler` 클래스 내 private 메서드(`_buildIsolateContext`, `_runWithTimeout`)와 모듈 수준 순수 함수들(`hostHash`, `hostB64Encode`, `hostB64Decode`, `classifyCodeNodeError`, `resolveMemoryLimitMb`) 간의 책임 분리 패턴 혼재
  - 위치: `/codebase/backend/src/nodes/data/code/code.handler.ts`
  - 상세: 이번 변경에서 기존 `execute()` 내 인라인 코드를 `_buildIsolateContext`와 `_runWithTimeout`으로 추출한 것은 SRP 개선이다. 그러나 `hostB64Encode`, `hostB64Decode`는 클래스 바깥 모듈 수준 함수로, 클래스 private 메서드인 `_buildIsolateContext`에서 직접 참조된다. 이 패턴은 해당 모듈에 일관되게 사용되고 있어 현재로서는 문제없다. 단, 향후 `$helpers` API가 확장될 경우 Host-realm 콜백들을 별도 `HostCallbacks` 객체/네임스페이스로 그룹화하면 `CodeHandler` 클래스의 의존성이 더 명시적이 된다.
  - 제안: 현재 규모에서는 허용 가능. 장기적으로는 `hostCallbacks` 네임스페이스 객체를 도입해 `_buildIsolateContext`가 `hostCallbacks` 단일 의존성만 받도록 개선을 고려.

- **[INFO]** `classifyExecutionFailure` (chat-channel)와 `classifyCodeNodeError` (code handler) — 두 분류 함수의 위치가 적절히 분리되어 있음을 확인
  - 위치: `/codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.ts`, `/codebase/backend/src/nodes/data/code/code.handler.ts`
  - 상세: `classifyCodeNodeError`는 코드 노드 내부 에러 코드(legacy/internal)를 공개 `ErrorCode`로 정규화하는 노드 계층 책임이고, `classifyExecutionFailure`는 채널 어댑터 계층에서 공개 `ErrorCode`를 UI-facing 분류 키로 매핑하는 별도 책임이다. 두 단계가 명확히 분리된 좋은 구조다. `CODE_MEMORY_LIMIT`의 주석 업데이트(하드코딩 → env-tunable 표현)도 이 계층 경계를 일관되게 유지한다.
  - 제안: 현재 구조 유지. 별도 조치 불필요.

- **[INFO]** 설정값(`CODE_NODE_MEMORY_LIMIT_MB`) 읽기 위치 — 모듈 로드 시 1회 결정
  - 위치: `/codebase/backend/src/nodes/data/code/code.handler.ts` 라인 1089 (`const ISOLATE_MEMORY_LIMIT_MB = resolveMemoryLimitMb()`)
  - 상세: 환경 변수를 프로세스 시작 시 1회 읽어 모듈 수준 상수로 고정하는 패턴은 성능상 올바르다. 주석에 "Read once at module load — changing it requires an instance restart"가 명시되어 있어 운영상 의미도 문서화되어 있다. `.env.example`과 테스트 코드도 이 의미론을 일관되게 반영한다. NestJS `ConfigService`를 통한 중앙 집중적 설정 관리 패턴(다른 설정들이 따르는 방식)과는 다소 다르게 `process.env`를 직접 읽지만, 코드 노드가 `isolated-vm` 초기화 시 고정값이 필요하다는 기술적 이유가 있어 현재 패턴은 정당하다.
  - 제안: 현재 구조 허용. 만약 NestJS DI 일관성이 요구된다면 `CodeHandler`가 `ConfigService`를 주입받고 `CodeHandlerModule` 초기화 시 값을 확정하는 방식으로 리팩토링 가능하지만, 그로 인한 추상화 비용이 현재 이득보다 크지 않다.

- **[INFO]** 문서 레이어(MDX, i18n)에서 구체 값(128MB) 제거 — 올바른 추상화 방향
  - 위치: `/codebase/frontend/src/content/docs/02-nodes/data.en.mdx`, `/codebase/frontend/src/content/docs/02-nodes/data.mdx`, `/codebase/frontend/src/lib/i18n/backend-labels.ts`
  - 상세: 기존 UI/문서에 하드코딩되어 있던 "128MB" 수치를 "기본값(default)" + "설정 가능" 표현으로 교체한 것은 단일 진실 원칙 준수와 문서-구현 갭 해소 측면에서 올바른 방향이다. 실제 값의 SoT는 코드(`DEFAULT_MEMORY_LIMIT_MB`)와 `.env.example`에 집중된다.
  - 제안: 현재 방향 유지.

## 요약

이번 변경 세트는 Code 노드의 격리 메모리 한도를 하드코딩에서 `CODE_NODE_MEMORY_LIMIT_MB` 환경 변수로 운영자 조정 가능하게 전환하면서, 동시에 `execute()` 내 인라인 로직을 `_buildIsolateContext` / `_runWithTimeout` private 메서드로 추출해 SRP를 개선하고, `$helpers.base64` API에 타입 가드를 추가해 `hostHash`와 일관된 입력 계약을 확립했다. 아키텍처 관점에서 주요 레이어(노드 핸들러 / 채널 어댑터 / 설정 / 문서)의 책임 분리가 잘 유지되고 있으며, 에러 코드 정규화의 두 단계(내부 코드 → 공개 ErrorCode, 공개 ErrorCode → UI 분류 키)가 명확히 분리되어 있다. `resolveMemoryLimitMb()`의 테스트용 export가 모듈 경계를 약간 흐리는 점은 있으나 INFO 수준이며, 전반적으로 구조적 결함 없이 응집도와 확장성이 양호하다.

## 위험도

NONE
