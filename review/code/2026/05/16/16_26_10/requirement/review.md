# 요구사항(Requirement) 코드 리뷰

## 발견사항

### 파일 1: `integration-oauth.service.cafe24.spec.ts` — `buildFakeCafe24Integration`

- **[WARNING]** `installToken` / `installTokenIssuedAt` 기본값이 `undefined`로 반환됨
  - 위치: `buildFakeCafe24Integration` 반환 객체의 `installToken: overrides.installToken`, `installTokenIssuedAt: overrides.installTokenIssuedAt`
  - 상세: `overrides.installToken`이 명시되지 않으면 값이 `undefined`가 된다. `mallId` 처럼 `?? null` fallback 을 적용하면 실제 DB row 모델(nullable 컬럼)과 일치하지만, 현재는 `undefined`가 반환되어 `null`을 기대하는 서비스 코드와 타입 불일치가 발생할 수 있다.
  - 제안: `installToken: overrides.installToken ?? null`, `installTokenIssuedAt: overrides.installTokenIssuedAt ?? null` 로 변경하거나, 타입 정의에 `undefined` 허용 여부를 명시.

- **[WARNING]** `lastError` 기본값이 `null`로 표현되지만 `overrides.lastError` 가 `undefined` 가 아닌 `unknown` 타입 — 제로값 케이스 불명확
  - 위치: 반환 객체 `lastError: overrides.lastError ?? null`
  - 상세: `overrides.lastError = undefined`(override 미제공) → `null` 반환은 정상이나, `overrides.lastError = null`로 명시 override하면 `null ?? null` → `null`로 동일 결과다. 실제 서비스에서 `lastError` 가 `null` vs `undefined` vs 빈 객체 `{}` 중 어느 값이 정상 상태인지 테스트 mock 레벨에서 불명확하다.
  - 제안: JSDoc에 `lastError` 기본값이 `null`임을 명시 (가독성 개선).

- **[INFO]** legacy `mallId: null` 테스트 케이스에서 `credentialsMallId` default 가 `'priv-shop'` 이지만 테스트는 `'pub-shop'` 을 override — 의도는 명확하나 factory 기본 mall_id 가 케이스별로 다름
  - 위치: `buildFakeCafe24Integration({ mallId: null, credentialsMallId: 'pub-shop', ... })` 호출부
  - 상세: factory 기본 `credentialsMallId` 는 `mallId ?? 'priv-shop'` 이므로 `mallId: null` 이면 `'priv-shop'` 이 되는데, 일부 테스트에서 `credentialsMallId: 'pub-shop'` 을 override 한다. 동작은 정확하지만 기본값과 override 의도가 주석 없이는 혼동될 수 있다.
  - 제안: legacy 케이스 테스트 내에 `// mallId 컬럼 없는 legacy row — credentials.mall_id 로만 식별` 등 단문 주석 추가.

- **[INFO]** `name` 기본값 `\`${credentialsMallId} (Cafe24)\`` 는 spec 에서 확인된 포맷과 일치해야 함
  - 위치: `name: overrides.name ?? \`${credentialsMallId} (Cafe24)\``
  - 상세: 기존 인라인 mock 에는 `'priv-shop (Cafe24 Private)'` 처럼 `app_type` 이 포함된 이름도 있었다. factory 기본값에는 `app_type` 이 포함되지 않는다. 이미 수정된 테스트(`conn-1` 케이스)에서 `name: 'priv-shop (Cafe24 Private)'` 를 명시 override 하고 있어 동작은 올바르나, factory 기본 패턴이 실 데이터 패턴(`{mallId} (Cafe24 {AppType})`)과 다르다는 점을 문서화하는 것이 좋다.
  - 제안: 주석 또는 JSDoc에 기본 `name` 패턴이 단순화된 목적임을 명시.

---

### 파일 2: `integration-oauth.service.ts` — 타입 인라인 reformatting

- **[INFO]** 변경 내용이 `Cafe24PrecheckStatus` 타입 선언의 줄바꿈 제거뿐으로 순수 코드 스타일 변경
  - 위치: 파일 321~347행
  - 상세: 기능·비즈니스 로직 변경 없음. 요구사항 관점에서 영향 없음.

---

### 파일 3: `integrations.controller.ts` — `@ApiOperation.description` 라우트 순서 주석

- **[INFO]** Swagger 문서 description 에 라우트 순서 경고가 추가됨 — 회귀 방지 의도는 좋으나 런타임 검증 부재
  - 위치: `@ApiOperation({ description: ... })` 문자열
  - 상세: 라우트 순서 문제(`cafe24`가 `:id`로 소비되는 버그)를 Swagger description 에만 언급하는 것은 documentation-level 경고에 불과하다. 실제 controller 파일의 코드 주석(`// ROUTE ORDER: must be before :id route`)이나 e2e 테스트가 더 강력한 회귀 안전망이다. description 텍스트가 길어져 Swagger UI 표시가 복잡해질 수 있다.
  - 제안: description 에 추가된 회귀 주의사항을 controller 코드 레벨 주석으로도 병기하거나, 라우트 순서 검증 e2e 테스트 케이스 추가를 검토.

---

### 파일 4: `integrations.service.ts` — 트랜잭션 미적용 의도 주석

- **[INFO]** 트랜잭션 경계 의도 주석이 추가됨 — 내용 합리적이나 미래 부작용 추가 시 재검토 기준 불명확
  - 위치: `try { const saved = await this.integrationRepository.save(entity); ...` 앞 주석 블록
  - 상세: 주석에서 "향후 audit log 외 부작용이 추가되면 재검토" 라고 명시하고 있으나, 어느 수준의 부작용이 트랜잭션 도입 기준인지 구체적이지 않다. `auditLogsService.record` 실패 시 integration row 는 이미 저장된 상태이고 audit 기록만 누락되는 부분 성공 시나리오가 허용됨을 명시하지 않았다.
  - 제안: 주석에 "auditLog 기록 실패는 부분 성공으로 허용 (audit 는 best-effort)" 한 줄 추가로 의도 명확화.

---

### 파일 5~18: Cafe24 metadata 파일들 — Phase 8 operation 제거 및 `planned.ts` 이관

- **[WARNING]** `planned.ts` 에 이관된 operation 들이 실제 metadata 파일에서는 제거되었는데, 기존 spec catalog(`*.md`)도 `planned` 상태로 롤백되어 `method/path/scope` 필드가 `?` 로 교체됨 — 이 정보들은 이미 알려진 값
  - 위치: `spec/conventions/cafe24-api-catalog/application.md`, `collection.md`, `community.md`, `design.md`, `mileage.md` 등 (파일 24~28+)
  - 상세: Phase 8a~8j 에서 구현된 후 `supported` 로 마킹됐던 operation 들이 이번 diff 에서 `planned` 로 되돌아가고 `method/path/scope` 가 `?` 로 바뀌었다. 이는 구현 코드를 `metadata/*.ts` 에서 제거하고 `planned.ts` 에 목록만 남겨두는 결정의 반영이다. 그러나 spec catalog 파일은 API 의 최종 상태를 기술하는 문서인데, 이미 구현 방법이 확정된(Cafe24 공식 API) 정보를 `?` 로 지우는 것은 정보 손실이다. `planned.ts` 에 실제 metadata 가 없으므로 이 operation 들은 현재 사용자에게 노출되지 않는 상태(기능 미구현)이며, spec catalog 의 `planned` 상태는 이를 반영하는 것이지만, `method/path/scope` 는 Cafe24 공식 docs 에서 이미 확정된 정보이므로 `?` 가 아닌 실제 값을 유지하는 것이 더 유용하다.
  - 제안: spec catalog 에서 `status` 컬럼만 `planned` 로 변경하고 `method/path/scope` 는 실제 값을 그대로 유지. `?` 는 실제로 method/path 가 미결정인 경우에만 사용.

- **[WARNING]** `planned.ts` 에 `coupon_manage` 가 `promotion` 목록에 포함되어 있으나, `promotion.ts` metadata 파일에는 해당 operation 이 제거됨 — `planned` 목록과 실제 구현 간 상태 일치성 확인 필요
  - 위치: `planned.ts` line `promotion: [{ id: 'coupon_manage', label: '쿠폰 관리 (사용/중지)' }]` + `promotion.ts` diff 의 Phase 8b 블록 제거
  - 상세: `coupon_manage` 는 `promotion.ts` 에서 제거되어 `planned.ts` 의 `promotion` 배열에만 존재한다. 이 패턴은 의도된 것(planned 목록 이관)이지만 `planned.ts` 가 실제로 런타임에 어떻게 소비되는지 — 즉 UI 에 "미구현 operation" 으로 표시되는지, 아니면 단순 개발자 참조용인지 — 가 diff 범위 내에서 확인되지 않는다. 만약 `planned.ts` 가 UI 에서 소비된다면 `coupon_manage` 는 사용자에게 노출되지 않아야 할 기능이 노출될 위험이 있다.
  - 제안: `planned.ts` 의 소비 코드(import 처)를 확인해 planned operation 이 런타임에 노출되지 않음을 검증. 또는 `planned.ts` 의 용도를 JSDoc/주석으로 명확히 문서화.

- **[INFO]** `_overview.md` 의 누적 합계 업데이트에서 Phase 8 관련 changelog row 가 모두 제거됨
  - 위치: `spec/conventions/cafe24-api-catalog/_overview.md` diff 의 `2026-05-16 (coverage Phase 8a~8j)` 행 삭제
  - 상세: Phase 8 작업의 changelog 기록이 완전히 삭제됐다. 이는 Phase 8 구현을 철회(revert)하는 것과 동일한 effect 이며, history 가 사라진다. 추후 "왜 이 operation 들이 planned 상태인가"를 추적할 때 changelog 부재로 혼란이 발생할 수 있다.
  - 제안: Phase 8 changelog 를 삭제하는 대신 "Phase 8 rollback to planned" 또는 "Phase 8 operations deferred to planned.ts" 로 changelog 내용을 업데이트해 이력 보존.

---

### 파일 19: `cafe24-precheck.test.tsx` — AbortController abort 검증 테스트

- **[WARNING]** abort 검증이 `effect cleanup` 시 동기적으로 발생한다고 가정하는데, `user.clear()` 후 React 의 effect cleanup 실행 시점이 보장되지 않을 수 있음
  - 위치: `expect(firstSignal?.aborted).toBe(true)` — `user.clear(mallIdInput)` + `user.type(mallIdInput, 'shop-b')` 이후
  - 상세: 테스트 주석에 "abort 는 동기적으로 발생 (effect cleanup)" 이라고 명시하고 있으나, React Testing Library 와 fake timers 환경에서 `useEffect` cleanup 이 즉시(동기적으로) 실행된다는 보장은 환경에 따라 다를 수 있다. 현재 테스트 패턴은 `act` 없이 `expect(firstSignal?.aborted).toBe(true)` 를 호출하므로, React batch update 타이밍에 따라 flaky 해질 여지가 있다.
  - 제안: `await act(async () => { await user.clear(mallIdInput); await user.type(mallIdInput, 'shop-b'); })` 로 감싸고 그 직후 abort 상태를 확인하거나, `waitFor(() => expect(firstSignal?.aborted).toBe(true))` 로 비동기 대기.

- **[INFO]** 첫 요청이 "영원히 resolve 안 됨" (new Promise(() => {})) 으로 설정되어 있어, 테스트 메모리 누수 또는 타이머 경고가 발생할 수 있음
  - 위치: `precheckMock.mockImplementationOnce((_mallId, signal) => new Promise(() => {}))`
  - 상세: 영구 pending Promise 는 AbortSignal 로 취소되지 않는 한 GC 되지 않는다. 테스트 환경에서 signal.abort() 호출 시 Promise 자체가 reject 되지 않으므로 (AbortSignal 이 Promise를 자동 reject 하지 않음) 누수가 발생한다. 테스트는 pass 하지만 Jest/Vitest 의 open handle 경고가 발생할 수 있다.
  - 제안: `new Promise((_, reject) => { signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))); })` 처럼 signal 구독 형태로 변경하거나, afterEach 에서 mock 정리 확인.

---

### 파일 20: `page.tsx` — AbortController 도입

- **[INFO]** `void err` 사용으로 AbortError 와 일반 오류를 구별하지 않고 모두 silent fail 처리
  - 위치: `catch (err) { if (!aborted) setCafe24Conflict(null); void err; }`
  - 상세: AbortError(`err.name === 'AbortError'`)를 명시적으로 확인하지 않아, 실제 네트워크 오류나 서버 500 응답도 동일하게 silent fail 된다. 코드 주석에서 "AbortError 는 정상 cancel 시그널 — silent" 라고 하나, 비 AbortError 도 `!aborted` 조건에서 `setCafe24Conflict(null)` 이 호출되므로, 기능은 이전(cancelled flag 방식)과 동일하다. spec 에 precheck 실패를 silent fail 로 허용한다고 명시된 경우라면 이 동작은 의도적이나, AbortError 와 타 오류를 분기하면 디버깅이 쉬워진다.
  - 제안: `if (err instanceof DOMException && err.name === 'AbortError') return;` 분기를 추가해 AbortError 와 일반 오류를 명시적으로 구분. 일반 오류는 console.warn 수준의 로깅 추가 권장.

- **[INFO]** `aborted` flag 와 `controller.abort()` 가 중복 역할을 수행
  - 위치: cleanup 함수 `return () => { aborted = true; clearTimeout(t); controller.abort(); }`
  - 상세: `aborted` flag 는 timeout 내부 async 코드가 cleanup 후에도 실행됐는지 guard 하는 용도이고, `controller.abort()` 는 실제 fetch 취소다. 두 가지가 모두 필요한 이유는 `setTimeout` 이 abort 후에도 실행될 수 있기 때문이다. 현재 구현은 올바르나, `aborted` flag 이름이 이전 `cancelled` 와 차이가 없어 AbortController 도입 의도를 명확히 전달하지 못한다. `isCancelled` 또는 `isCleanedUp` 같은 이름이 더 명확할 수 있다.
  - 제안: 변수명을 `isCleaned` 또는 `isCancelled` 로 변경해 flag 의 역할(effect cleanup 여부 추적)을 명확히 표현.

---

### 파일 21: `integrations.ts` — `cafe24Precheck` signature 변경

- **[INFO]** `signal` 인자가 optional(`signal?`)이므로 기존 호출자와 호환되며 기능 완전성 문제 없음
  - 위치: `async cafe24Precheck(mallId: string, signal?: AbortSignal)`
  - 상세: 옵셔널 파라미터 추가로 하위 호환성이 유지되어 있다. `apiClient.get` 의 `signal` 전달도 axios/fetch 의 표준 방식과 일치한다. 요구사항 관점에서 이상 없음.

---

### 파일 22: `cafe24-mall-dup-followup.md` — Plan 상태

- **[INFO]** Plan 문서에 미완료 항목(`[ ] AI-REVIEW`, `[ ] PR`) 이 남아 있어 `in-progress` 상태가 올바르게 유지되고 있음
  - 위치: `plan/in-progress/cafe24-mall-dup-followup.md`
  - 상세: 구현 완료 항목 4건이 모두 체크되어 있고, AI-REVIEW 와 PR 만 남아 있다. 현재 PR 이 완료되지 않은 시점의 상태이므로 `in-progress` 위치가 적절하다.

---

## 요약

이번 변경은 4가지 독립적인 요구사항 대응(W20 테스트 factory 통일, W21 Swagger 라우트 순서 주석, W23 트랜잭션 의도 명시, INFO 6 AbortController 도입)으로 구성되며, 각각 기존 deferred 항목의 follow-up 이다. 핵심 비즈니스 로직(Cafe24 중복 감지, precheck 결과 반환, 충돌 상태 우선순위)은 변경되지 않았고 테스트 factory 패턴 도입으로 반복 선언이 통일되었다. 다만 `buildFakeCafe24Integration` 의 `installToken` / `installTokenIssuedAt` 기본값이 `undefined` 로 남아 DB 모델(`null` nullable)과 불일치하는 엣지가 있고, Phase 8a~8j 에서 한 번 `supported` 로 마킹됐던 spec catalog operation 들이 이번 diff 에서 `planned` + `?` 로 일괄 롤백되면서 이미 알려진 API 메타 정보(method/path/scope)가 소실되는 점이 아쉽다. AbortController 도입 테스트에서 React effect cleanup 의 동기 실행을 가정하는 부분은 환경에 따라 flaky 해질 여지가 있어 `waitFor` 또는 `act` 래핑으로 보강이 필요하다.

## 위험도

LOW
