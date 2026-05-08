### 발견사항

- **[INFO]** `engineResolvedConfigCache`가 핸들러 공개 인터페이스에 노출됨
  - 위치: `node-handler.interface.ts:37`
  - 상세: `ExecutionContext`는 모든 `NodeHandler.execute()`의 세 번째 인자로 전달된다. JSDoc이 "NOT exposed to expression context"라고 명시했지만, 이는 expression resolver에만 적용되는 제약이며 13+ 핸들러가 직접 `ctx.engineResolvedConfigCache`를 읽거나 쓰는 것을 막지 못한다. 엔진 내부 전용 슬롯임에도 핸들러와의 계약(인터페이스)에 노출된 상태.
  - 제안: `engineResolvedConfigCache`를 `ExecutionContext`에서 분리하거나, 타입 레벨에서 `Readonly<...>`를 적용해 핸들러의 우발적 변이를 방지. 또는 JSDoc에 "핸들러는 이 필드를 읽거나 쓰지 말 것" 명시.

- **[WARNING]** 캐시 미스 시 silent default → throw로의 동작 파괴 가능성
  - 위치: `execution-engine.service.ts` (Parallel/Container runParallel/runContainerInner 진입부), `coerce-container-param.ts`
  - 상세: `engineResolvedConfigCache` 미스 시 fallback이 `parallelNode.config`(raw 값 포함)로 떨어지고, `coerceContainerNumber("{{4}}")` 등이 `INVALID_CONTAINER_PARAM` 예외를 던진다. 정상 경로에서는 cache가 항상 채워지므로 문제없지만, Redis 역직렬화된 구형 context(이 필드가 없는 상태로 저장된 실행)나 테스트 픽스처가 cache 없이 container 진입 시 예외 발생. 이전에는 silent fallback으로 처리되던 경로가 hard failure로 전환.
  - 제안: `engineResolvedConfigCache` 미스 + raw 값 도착 시 throw 대신 warn 후 `Number()` 변환 시도(기존 동작)로 graceful degradation하거나, context 역직렬화 시 cache 필드를 재구성하는 migration guard 추가.

- **[INFO]** `coerceContainerBoolean`의 대소문자 엄격성
  - 위치: `coerce-container-param.ts:127-128`
  - 상세: `"true"/"false"` 소문자만 허용. `"True"`, `"TRUE"`, `"False"` 등은 `not a boolean` 예외. 외부 시스템(webhook payload, 변수 주입)에서 대문자 문자열이 올 경우 명시적 에러가 발생.
  - 제안: 스펙/사용자 문서에 반드시 lowercase만 허용됨을 명시하거나, `trimmed.toLowerCase() === 'true'`로 case-insensitive 처리.

- **[INFO]** 새 에러 코드 `INVALID_CONTAINER_PARAM`이 기존 에러 카탈로그와 미통합
  - 위치: `coerce-container-param.ts:21`
  - 상세: spec의 에러 처리 문서(`3-error-handling.md`)에 정의된 에러 코드 vocabulary에 `INVALID_CONTAINER_PARAM`이 없음. `CONTAINER_MISSING_EMIT`, `MAX_ITERATIONS_EXCEEDED` 등 기존 에러 코드 패턴(`SCREAMING_SNAKE_CASE`, 맥락 명사 접두사)과는 일치하나, 공식 카탈로그에 미등록.
  - 제안: 에러 처리 스펙에 `INVALID_CONTAINER_PARAM` 추가 또는 기존 에러 분류 체계에 편입.

---

### 요약

이번 변경은 HTTP REST API 엔드포인트를 변경하지 않으며, `NodeHandler` 인터페이스·`ExecutionContext` 내부 계약이 주요 영향 범위다. `engineResolvedConfigCache`가 `ExecutionContext`에 선택적 필드로 추가되어 하위 호환성은 유지된다. 핵심 위험은 구형 실행 컨텍스트(캐시 미포함)가 container 경로에 진입할 때 기존의 silent fallback이 hard throw로 전환될 수 있다는 점이며, 이는 Redis 영속 실행 중인 워크플로가 배포 직후 캐시 미스를 만날 경우에 해당한다. 정상 신규 실행 경로에서는 `createContext()`가 항상 캐시를 초기화하므로 실질적 위험은 낮다.

### 위험도
**LOW**