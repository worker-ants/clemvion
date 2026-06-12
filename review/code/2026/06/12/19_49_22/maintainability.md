# 유지보수성(Maintainability) 리뷰

## 발견사항

### [INFO] `isSwaggerEnabled` 함수 — 단일 책임, 간결 구현
- 위치: `codebase/backend/src/common/config/production-guards.ts` L820-823
- 상세: 2줄 함수로 단일 판정만 수행. `isFlagOn` 재사용, 기존 guard 패턴과 동형. 의도(production gate)가 JSDoc 에 명확히 기술되어 있으며 반환 타입·파라미터 기본값 모두 명시적. 가독성 우수.
- 제안: 현상 유지.

### [INFO] `main.ts` — `setupSwagger` 추출로 bootstrap 함수 분리
- 위치: `codebase/backend/src/main.ts` L969-977 (diff 기준)
- 상세: Swagger 설정 빌더 체이닝(~50줄)이 별도 `setupSwagger(app)` 함수로 추출되어 `bootstrap`이 설정 조각을 직접 포함하지 않게 개선됐다. 함수 단일 책임 원칙에 부합하며 `bootstrap` 읽기 흐름이 개선됨.
- 제안: 현상 유지.

### [WARNING] `main.ts` — `isSwaggerEnabled(process.env)` 이중 호출
- 위치: `codebase/backend/src/main.ts` L1216, L1250 (전체 파일 기준)
- 상세: `isSwaggerEnabled(process.env)`가 Swagger 마운트와 부팅 로그 출력 두 곳에서 독립적으로 호출된다. 순수 함수이므로 결과는 항상 동일하지만, 향후 `isSwaggerEnabled`의 비용이 높아지거나 로직이 변경될 경우 한쪽에서 수정을 놓칠 수 있다. 결과를 두 번 읽는 이유가 코드에서 즉시 드러나지 않는다.
- 제안: `bootstrap` 초반에 `const swaggerEnabled = isSwaggerEnabled(process.env)` 로 한 번만 계산하고 두 곳에서 변수를 참조하도록 변경. 의도를 명시하고 중복 평가를 제거.

### [INFO] `compileUserRegex` — 명확한 결과 타입(`RegexCompileResult`) 정의
- 위치: `codebase/backend/src/nodes/core/condition-evaluator.util.ts` L2097-2130
- 상세: 거부 사유를 문자열 리터럴 유니온(`'too-long' | 'unsafe' | 'invalid'`)으로 타입화하고, 성공/실패 판별을 타입 수준에서 강제(`regex: null` + `reason` 필수). `compileRegexCache` 의 이전 인라인 try-catch 3블록이 단일 chokepoint 호출로 교체돼 중복 코드가 제거됐다.
- 제안: 현상 유지. `MAX_REGEX_LENGTH`의 선정 근거(safe-regex 기준과의 관계)를 주석으로 추가하면 향후 값 변경 시 참고가 용이해진다.

### [INFO] `filter.handler.ts` — `getRegex` 클로저 단순화
- 위치: `codebase/backend/src/nodes/logic/filter/filter.handler.ts` L2990-3004
- 상세: 기존 try-catch + 길이 검사를 `compileUserRegex` 단일 호출로 교체. `null`을 "이전 거부"의 마커로 재사용하는 패턴은 유지. 변경 후 `getRegex` 내부 흐름이 명확해짐.
- 제안: 현상 유지.

### [INFO] `transform.handler.ts` — `safeCompileRegex` 인라인 로직 제거
- 위치: `codebase/backend/src/nodes/data/transform/transform.handler.ts` L2509-2517
- 상세: 로컬 `MAX_REGEX_LENGTH` 상수와 try-catch가 `compileUserRegex` 1줄 위임으로 교체됐다. 파일 레벨 상수 중복이 제거되고 SSOT가 `condition-evaluator.util.ts`로 일원화됨.
- 제안: 현상 유지. `safeCompileRegex`를 제거하고 호출부에서 직접 `compileUserRegex(pattern, flags).regex`를 호출해도 가독성이 떨어지지 않으나, 현재 형태도 허용 가능.

### [INFO] `websocket.gateway.ts` — `authorize` 시그니처 확장
- 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` L1418-1421
- 상세: `authorize(channel, workspaceId)` → `authorize(channel, { workspaceId, userId })` 로 명명된 파라미터 구조체를 사용하도록 변경됐다. 새 authorizer 추가 시 컨텍스트 인자 추가가 시그니처 전면 변경 없이 가능한 확장 가능 설계. 기존 `execution:`, `kb:`, `background:run:` authorizer 모두 destructuring으로 필요한 필드만 참조.
- 제안: 향후 더 많은 컨텍스트가 필요해질 경우 `ctx` 오브젝트를 별도 타입으로 명명하는 것을 고려.

### [WARNING] `websocket.gateway.ts` — `notifications:` authorizer 의 `Promise.resolve` 래핑
- 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` L1471-1478
- 상세: `notifications:` authorizer는 동기 판별만 하면 되지만 `authorize` 인터페이스가 `Promise<...>`를 요구하므로 `Promise.resolve(...)`로 감쌌다. 구조적으로 불가피하지만, 미래 authorizer 작성자가 동기 결과도 래핑해야 한다는 점을 주석 없이 알기 어렵다.
- 제안: 인터페이스 정의 근처에 "동기 결과도 `Promise.resolve`로 감싸야 함" 주석 1줄 추가 또는 인터페이스를 `MaybePromise` 유틸리티로 완화 고려.

### [INFO] `safe-html.ts` — `ALLOWED_TAGS`, `ALLOWED_ATTR`, `ALLOWED_URI_REGEXP` 모듈 레벨 상수화
- 위치: `codebase/channel-web-chat/src/lib/safe-html.ts` L3400-3418
- 상세: DOMPurify 옵션이 `sanitize` 호출 인라인에서 모듈 레벨 명명 상수로 분리됐다. 목록 변경 위치가 단일화되고 검토 시 목록 전체를 한 눈에 확인 가능. 각 상수에 설명 주석이 있음.
- 제안: 현상 유지.

### [INFO] `production-guards.spec.ts` — 테스트 구조 일관성
- 위치: `codebase/backend/src/common/config/production-guards.spec.ts` 전체
- 상세: 새로 추가된 `isSwaggerEnabled` describe 블록이 기존 `isFlagOn` describe 블록과 동일한 `it.each` 패턴을 사용. 명명, 구조, 케이스 분류가 일관됨.
- 제안: 현상 유지.

### [WARNING] 타이밍 기반 테스트 단언 — CI 환경 의존성
- 위치: `codebase/backend/src/nodes/core/condition-evaluator.util.spec.ts` L2046-2053; `codebase/backend/src/nodes/logic/filter/filter.handler.spec.ts` L2803-2816
- 상세: `elapsed < 100ms`, `elapsed < 1000ms` 하드코딩 임계값이 CI 환경 부하에 따라 flaky할 수 있다. ReDoS 방어가 `compileUserRegex`에서 컴파일 전 차단임을 확인하는 의도는 명확하지만, 타이밍 대신 함수 반환값(`r.regex === null`)으로 핵심 불변식을 이미 검증하므로 타이밍 단언은 보조적 성격에 불과하다.
- 제안: 타이밍 단언을 삭제하거나 매우 넉넉한 임계값(5000ms 이상)으로 설정해 환경 민감도를 줄임.

### [INFO] `websocket.gateway.spec.ts` — 타입 캐스팅 중복
- 위치: `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts` L1301, L1315, L1334, L1354-1358, L1372-1376
- 상세: `(socket as Socket & { workspaceId?: string; userId?: string })` 패턴이 여러 테스트에서 반복된다. `createMockSocket`이 확장 타입을 반환하도록 수정하거나, 별도 타입 별칭을 선언하면 중복 제거 가능.
- 제안: `type EnrichedSocket = Socket & { workspaceId?: string; userId?: string }` 타입 별칭을 파일 상단에 선언하고 캐스팅 시 해당 타입 사용. 가독성과 타입 일관성이 개선됨.

---

## 요약

이번 변경은 보안 hardening(ReDoS 방어, Swagger 게이팅, WS IDOR 차단, HTML sanitize 화이트리스트)을 목적으로 하며, 유지보수성 관점에서 전반적으로 양호하다. `compileUserRegex` 신설로 세 곳에 산재하던 regex 컴파일 로직이 단일 chokepoint로 통합됐고, `setupSwagger` 추출로 `bootstrap` 함수 분리가 개선됐으며, authorizer 컨텍스트 파라미터 구조체화는 향후 확장을 염두에 둔 설계다. 실질적인 지적 사항은 두 가지다: (1) `isSwaggerEnabled(process.env)` 이중 호출 — 결과를 변수로 캐싱하면 의도가 더 명확해지고 미래 변경 리스크가 감소한다. (2) 타이밍 기반 테스트 단언(`elapsed < 100ms`) — 핵심 불변식은 이미 `r.regex === null`로 검증하므로 타이밍 단언은 CI 환경 부하 차이로 flaky를 유발할 수 있어 제거 또는 임계값 완화를 권장한다. 나머지 발견사항은 INFO 수준으로 코드베이스 동작에 영향을 주지 않는다.

## 위험도

LOW
