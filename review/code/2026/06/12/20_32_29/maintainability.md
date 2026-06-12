# 유지보수성(Maintainability) 리뷰

## 발견사항

### [INFO] `isSwaggerEnabled` — 단일 책임, 명확한 JSDoc
- 위치: `codebase/backend/src/common/config/production-guards.ts`
- 상세: 2줄 구현, `isFlagOn` 재사용, 환경변수 맵 주입으로 순수 함수 유지. `main.ts` 에서 `const swaggerEnabled = isSwaggerEnabled(process.env)` 로 1회만 평가 후 마운트·로그 두 곳이 변수를 공유한다 — 이전 리뷰 WARNING(이중 호출) 이 이미 수정된 상태.
- 제안: 현상 유지.

### [INFO] `main.ts` — `setupSwagger` 추출 + `swaggerEnabled` 단일 평가
- 위치: `codebase/backend/src/main.ts` L46-119, L121-208
- 상세: Swagger 빌더 체이닝 ~70줄이 `setupSwagger(app: INestApplication): void` 로 추출되어 `bootstrap` 가독성이 개선됐다. `swaggerEnabled` 변수가 부팅 상단(L124)에서 1회 계산되고 조건 분기(L171)·로그(L205) 두 곳에서 참조한다. 결정을 한 곳에서 평가하겠다는 의도가 주석으로도 명시됨(`// 04 M-1 — 게이팅 판정을 부팅당 1회만 평가`).
- 제안: 현상 유지.

### [INFO] `compileUserRegex` — discriminated union 결과 타입
- 위치: `codebase/backend/src/nodes/core/condition-evaluator.util.ts`
- 상세: `RegexRejectReason = 'too-long' | 'unsafe' | 'invalid'` + `RegexCompileResult` discriminated union 으로 타입 수준에서 성공/실패 분기가 강제된다. 평가 순서(길이 → 문법 → safe-regex)도 주석으로 근거를 명시해 유지보수 시 순서 변경 리스크를 사전 고지한다. 이전 세 곳 산재 try-catch 가 단일 chokepoint 로 통합된 것은 중복 코드 제거 측면에서 긍정적.
- 제안: `MAX_REGEX_LENGTH = 200` 선정 근거(safe-regex 와의 관계, 길이는 2차 방어)를 상수 JSDoc 에 한 줄 추가하면 값 변경 시 판단 기준이 명확해진다.

### [INFO] `compileRegexCache` / `filter.handler.ts` `getRegex` — 단순화
- 위치: `codebase/backend/src/nodes/core/condition-evaluator.util.ts`, `codebase/backend/src/nodes/logic/filter/filter.handler.ts`
- 상세: `compileRegexCache` 내 4줄 try-catch + 길이 검사가 `compileUserRegex` 1회 호출 + 조건 분기로 교체됐다. `filter.handler.ts` 의 `getRegex` 클로저도 동일하게 단순화. 두 곳 모두 중복 로직이 제거되고 흐름이 명확해짐.
- 제안: 현상 유지.

### [INFO] `transform.handler.ts` — 로컬 `MAX_REGEX_LENGTH` 상수 제거로 SSOT 달성
- 위치: `codebase/backend/src/nodes/data/transform/transform.handler.ts`
- 상세: 파일 레벨에 중복 선언돼 있던 `MAX_REGEX_LENGTH = 200` 이 제거되고, `safeCompileRegex` 래퍼가 `compileUserRegex(pattern, flags).regex` 1줄로 단순화됐다. SSOT 는 `condition-evaluator.util.ts` 로 일원화.
- 제안: `safeCompileRegex` 래퍼 자체가 이제 1줄 위임이므로, 호출부에서 직접 `compileUserRegex` 를 쓰도록 래퍼를 인라인 제거하는 것도 검토 가능하나 현재 형태도 가독성을 해치지 않음.

### [INFO] `websocket.gateway.ts` — `authorize` 시그니처 컨텍스트 구조체 확장
- 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` L82-88
- 상세: `authorize(channel, workspaceId: string)` -> `authorize(channel, ctx: { workspaceId: string; userId: string })` 로 확장. 기존 authorizer 4개는 모두 destructuring으로 필요한 필드만 취해 하위 호환. 향후 ctx 필드 추가 시 모든 authorizer 시그니처를 수정하지 않아도 된다.
- 제안: 인라인 타입 대신 `type WsAuthContext = { workspaceId: string; userId: string }` 를 파일 상단에 export 로 정의하면, 향후 확장 시 타입 체인이 명확해진다.

### [WARNING] `websocket.gateway.ts` — `notifications:` authorizer 의 `Promise.resolve` 래핑 의도 미문서화
- 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` L152-159
- 상세: `notifications:` authorizer 는 동기 로직만으로 결과를 결정할 수 있으나, `authorize` 인터페이스가 `Promise<...>` 를 강제하므로 `Promise.resolve(...)` 로 감쌌다. `channelAuthorizers` 인터페이스 정의 근처에 "동기 결과도 `Promise.resolve` 로 감싸야 한다" 는 설명이 없어 새 authorizer 작성자가 동기 반환으로 구현했다가 타입 에러를 받거나 `async` 키워드를 임의로 붙이는 혼란이 생길 수 있다.
- 제안: `channelAuthorizers` 인터페이스 정의 직전 주석에 `// 동기 판별 시에도 Promise.resolve()로 감싸야 한다 — authorize 시그니처 통일.` 한 줄 추가. 또는 `authorize` 반환 타입을 `MaybePromise<{ error: string } | null>` 로 완화해 동기 반환을 허용하는 것도 고려.

### [INFO] `websocket.gateway.spec.ts` — 소켓 타입 캐스팅 패턴 중복
- 위치: `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts` L306, L321, L338 등 10회 이상
- 상세: `(socket as Socket & { workspaceId?: string })` 와 `(socket as Socket & { workspaceId?: string; userId?: string })` 두 형태가 혼재하며 반복된다. 일관성도 낮다(workflow 테스트는 `workspaceId?` 만, notifications 테스트는 두 필드 모두).
- 제안: 파일 상단에 `type EnrichedSocket = Socket & { workspaceId?: string; userId?: string }` 타입 별칭을 선언하고 모든 캐스팅을 `socket as EnrichedSocket` 으로 통일. 중복 제거와 일관성 확보.

### [INFO] `safe-html.ts` — `ALLOWED_TAGS`, `ALLOWED_ATTR`, `ALLOWED_URI_REGEXP` 모듈 레벨 상수화
- 위치: `codebase/channel-web-chat/src/lib/safe-html.ts`
- 상세: DOMPurify 옵션을 `sanitize` 인라인에서 모듈 레벨 명명 상수로 분리해 목록 관리 위치가 단일화됐다. 블랙리스트 -> 화이트리스트 전환이 함수 본체를 건드리지 않고 상수 교체만으로 이루어진 점은 OCP 에 부합.
- 제안: `ALLOWED_URI_REGEXP` 세 번째 대안(`[a-z+.-]+(?:[^a-z+.:-]|$)`)이 relative URL/anchor 를 허용하기 위한 것임을 인라인 주석으로 보완하면 향후 값 변경 시 의도치 않은 scheme 허용/차단을 방지할 수 있다.

### [INFO] 환경변수 원복 패턴 중복 — 테스트 보일러플레이트
- 위치: `codebase/backend/src/modules/auth/auth.controller.spec.ts`, `codebase/backend/src/modules/auth/sessions.controller.spec.ts`, `codebase/backend/src/modules/hooks/hooks.service.spec.ts`, `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.spec.ts`
- 상세: `CORS_ORIGINS`, `TRUST_CF_CONNECTING_IP` 환경변수를 각 테스트 내 `const prev = process.env.X; try { ... } finally { if (prev === undefined) delete process.env.X; else process.env.X = prev; }` 패턴으로 원복하는 코드가 5곳 이상 반복된다. `client-ip.spec.ts` 는 `afterEach` 로 중앙화한 방식을 보여주는데, 나머지 파일들은 케이스별 try-finally 방식으로 일관성이 낮다.
- 제안: `client-ip.spec.ts` 의 `afterEach` 패턴을 다른 spec 에도 적용하거나, `withEnv(vars, fn)` 형태의 테스트 유틸리티 헬퍼를 공용 test-utils 에 추출해 환경변수 격리를 일관되게 관리. 현재 코드는 정합성은 있으나 중복이 많아 유지보수 시 원복 누락 위험이 있다.

### [INFO] `production-guards.spec.ts` — `isSwaggerEnabled` 테스트 구조 일관성
- 위치: `codebase/backend/src/common/config/production-guards.spec.ts`
- 상세: 신규 `describe('isSwaggerEnabled (04 M-1)', ...)` 블록이 기존 `isFlagOn` 패턴(`it.each`, 경계 케이스 분리)과 동일한 구조를 유지. 타이밍 기반 단언 없음.
- 제안: 현상 유지.

---

## 요약

이번 변경(refactor-04-security)은 보안 강화를 목적으로 하면서도 유지보수성 측면에서 긍정적 방향으로 진행됐다. `compileUserRegex` 신설로 세 곳 산재 regex 컴파일 로직이 단일 chokepoint 로 통합되고, 이전 회차 WARNING 이었던 `isSwaggerEnabled` 이중 호출은 `swaggerEnabled` 변수 캐싱으로 이미 수정됐으며, 타이밍 기반 테스트 단언도 현재 파일에서 발견되지 않아 RESOLUTION 이 정상 반영된 것으로 확인된다. 실질적 미결 사항은 두 가지다: (1) `notifications:` authorizer 의 `Promise.resolve` 래핑 의도를 인터페이스 정의 근처에 명시하지 않아, 신규 동기 authorizer 작성 시 패턴 혼란이 올 수 있다(WARNING). (2) 환경변수 원복 보일러플레이트가 4개 spec 에 걸쳐 반복되며 `afterEach` 방식과 `try-finally` 방식이 혼재해 일관성이 낮다(INFO). 기타 관찰 사항(소켓 타입 캐스팅 중복, `ALLOWED_URI_REGEXP` 주석 보완, `WsAuthContext` 타입 별칭, `MAX_REGEX_LENGTH` JSDoc 보강)은 모두 INFO 수준으로 동작에 영향을 주지 않는다.

## 위험도

LOW
