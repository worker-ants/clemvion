# 부작용(Side Effect) 리뷰 결과

검토 대상: External Interaction API PR2 — 총 15개 파일 (SDK 패키지 신설, i18n 확장, consistency/plan 문서)

---

## 발견사항

### [INFO] i18n dict 객체에 중첩 서브키 추가 — 기존 flat 구조와 혼재

- 위치: `codebase/frontend/src/lib/i18n/dict/ko/triggers.ts` 61~60번째 줄, `externalInteraction: { ... }` 블록
- 상세: 기존 `triggers` 객체는 모든 키가 flat string 이었다. 이번 변경으로 `externalInteraction` 하나만 중첩 객체 형태로 추가된다. `as const` 타입 추론 덕분에 TypeScript 타입은 자동으로 재계산되나, i18n 라이브러리가 `t('triggers.externalInteraction.section')` 형식의 중첩 접근을 지원하는지 런타임에서 확인이 필요하다. 영문 대응 파일(`dict/en/triggers.ts`)에 동일 키가 추가되지 않으면 ko/en parity 위반이 발생한다. 이번 diff 에는 en 파일 변경이 포함되지 않아 현재 상태로는 parity 불일치 가능성이 있다.
- 제안: `dict/en/triggers.ts` 에 동일한 `externalInteraction` 서브키 블록 추가 여부를 확인한다. i18n 라이브러리가 중첩 키를 지원하지 않는다면 flat 키 패턴으로 변경해야 한다.

---

### [INFO] SDK `package.json` prepare 스크립트 — 설치 시 빌드 부작용

- 위치: `codebase/packages/sdk/package.json` line `"prepare": "[ -d dist ] || tsc"`
- 상세: `prepare` 훅은 `npm install` 및 `npm publish` 시 자동으로 실행된다. `dist` 디렉토리가 없으면 `tsc` 빌드가 실행되어 파일시스템에 `dist/` 디렉토리와 컴파일 산출물이 생성된다. monorepo 에서 루트 `npm install` 실행 시 workspace 패키지의 `prepare` 도 실행될 수 있다. CI 환경에서 TypeScript 컴파일러가 없거나 `src/` 내 의존 파일이 누락된 상태에서 루트 install 을 하면 빌드 에러가 발생해 install 자체가 실패할 수 있다.
- 제안: `prepare` 대신 `postinstall` 을 쓰거나, CI 에서 `npm ci --ignore-scripts` 를 쓰는 패턴과 일관성을 유지하고 있는지 확인한다.

---

### [INFO] `randomUUID` — Node.js `crypto` 모듈 직접 import

- 위치: `codebase/packages/sdk/src/client.ts` line 1 `import { randomUUID } from 'crypto'`
- 상세: Node 20+ 에서는 `globalThis.crypto.randomUUID()` 가 표준으로 사용 가능하다. 현재 코드는 Node.js `crypto` 모듈을 명시적으로 import 하므로 브라우저 환경에서는 번들러가 polyfill 을 주입하거나 에러가 발생한다. `README.md` 와 `package.json` 모두 "Node.js 20+ 또는 fetchImpl 주입" 을 전제하므로 브라우저 지원 범위가 사실상 제한된다. 단, `tsconfig.json` 에 `"lib": ["ES2020", "DOM"]` 이 포함되어 있어 브라우저 타입을 선언하고 있는 상태와 실제 런타임 제약이 불일치한다.
- 제안: 브라우저 환경 지원 의사가 없으면 `tsconfig.json` 의 `"DOM"` lib 을 제거한다. 브라우저 지원이 필요하다면 `randomUUID` 를 `globalThis.crypto?.randomUUID?.() ?? fallback` 형태로 교체한다.

---

### [INFO] SSE 구독 `void` async IIFE — 에러가 외부로 전파되지 않음

- 위치: `codebase/packages/sdk/src/client.ts` line 116~161, `subscribeToExecution` 내 `void (async () => { ... })()`
- 상세: async IIFE 를 `void` 로 시작해 Promise rejection 을 소멸시킨다. 내부에서 에러가 발생하면 `handlers.onError` 콜백을 통해서만 외부로 통보된다. `handlers.onError` 가 제공되지 않으면 에러가 완전히 소실된다. 또한 AbortController 취소 후 reader 가 이미 `read()` 중이면 AbortError 가 발생하는데, `controller.signal.aborted` 체크(`line 156`)로 이를 걸러내므로 의도한 동작이다. 그러나 `onError` 미제공 시 에러 소실이라는 암묵적 계약이 호출자에게 충분히 전달되지 않는다.
- 제안: `onError` 가 없을 경우 `console.warn` 또는 `console.error` fallback 을 두거나, JSDoc 에 "onError 미제공 시 연결 에러가 조용히 무시됨" 을 명시한다.

---

### [WARNING] SSE 스트림에서 토큰을 query string 으로 전송 — URL 로그에 토큰 노출

- 위치: `codebase/packages/sdk/src/client.ts` line 113~114, `?token=${encodeURIComponent(token)}`
- 상세: SSE 연결 URL 에 Bearer 토큰을 query parameter 로 포함한다. EventSource 는 Authorization 헤더를 지원하지 않아 불가피한 설계이지만, URL 은 서버 액세스 로그 및 브라우저 히스토리, 리버스 프록시 로그에 기록된다. 토큰이 `iext_*` (단명 1h) 임을 감안하면 실질적 위험은 제한적이나, 로그 집계 시스템에서 토큰이 필터링 없이 수집될 수 있다.
- 제안: 서버 측에서 SSE URL 경로의 query parameter 를 액세스 로그에서 제외하도록 설정하거나, README 에 "토큰이 query string 에 포함됨 — 로그 마스킹 필요" 경고를 추가한다.

---

### [WARNING] `subscribeToExecution` — AbortController signal 이 fetch 에만 전달되고 reader.cancel() 미호출

- 위치: `codebase/packages/sdk/src/client.ts` line 118~130, `reader` 처리 로직
- 상세: `close()` 호출 시 `controller.abort()` 가 실행되면 fetch 레벨의 request 가 취소된다. 그러나 이미 응답 body reader 가 `reader.read()` 대기 중인 경우, abort 신호가 전파되어 `AbortError` 가 발생하는 것은 올바른 동작이다. 단, reader 의 `releaseLock()` 또는 `cancel()` 이 명시적으로 호출되지 않으므로, 일부 환경에서 ReadableStream lock 이 해제되지 않아 스트림 리소스가 GC 되기 전까지 유지될 수 있다.
- 제안: `done` 이 `true` 이거나 abort 이후 catch 블록에서 `reader.cancel()` 을 호출하는 finally 블록을 추가한다.

---

### [INFO] `verifyNotificationSignature` 에서 `Date.now()` 직접 호출

- 위치: `codebase/packages/sdk/src/signature.ts` line 1560, `const now = opts.nowSec ?? Math.floor(Date.now() / 1000)`
- 상세: `nowSec` 옵션이 제공되지 않으면 `Date.now()` 를 사용한다. 이는 전역 시스템 클럭에 의존하는 숨겨진 부작용으로, 테스트 환경에서 `Date.now()` mock 없이 기본 호출 시 시스템 시각을 사용한다. 현재 스펙 테스트는 모두 `nowSec` 를 명시적으로 주입하고 있어 테스트 자체는 결정적이다.
- 제안: 현재 패턴은 양호하다. `nowSec` 주입 패턴이 일관되게 테스트에 사용되고 있으므로 추가 조치 불필요.

---

### [INFO] `computeNotificationSignature` 에서 지원하지 않는 알고리즘 전달 시 throw

- 위치: `codebase/packages/sdk/src/signature.ts` line 1614~1616
- 상세: `ALG_TO_NODE[algorithm]` 결과가 `undefined` 면 `throw new Error(...)` 가 발생한다. TypeScript strict 타입에서 `SupportedHmacAlgorithm` 이 두 값만 허용하므로 정상 사용에서는 발생하지 않는다. 단 JavaScript로 사용하는 SDK 소비자가 타입 없이 임의 문자열을 전달하면 예외가 발생한다.
- 제안: 현재 에러 처리 방식이 적절하다. 추가 조치 불필요.

---

### [INFO] plan 완료 파일에 `worktree` frontmatter 값이 구현 워크트리와 불일치

- 위치: `plan/complete/external-interaction-api.md` frontmatter, `worktree: spec-external-interaction-api`
- 상세: 이 plan 파일은 PR2 구현 단계가 완료된 후 `git mv` 로 이동된 것이나, frontmatter 의 `worktree` 는 PR1(Spec) 단계의 워크트리(`spec-external-interaction-api`)를 가리킨다. 현재 PR2 가 진행 중인 워크트리(`impl-external-interaction-api-31801c`)는 반영되지 않았다. plan 파일의 워크트리 필드가 이력 추적 목적으로 쓰인다면 오해를 일으킬 수 있다.
- 제안: 상태 기록용 INFO 수준 사항으로 실제 코드 부작용은 없다. plan lifecycle 정책 상 필요하면 frontmatter 를 갱신한다.

---

## 요약

이번 변경의 핵심은 신규 SDK 패키지(`codebase/packages/sdk/`) 추가, i18n 사전 확장, consistency/plan 문서 신설이다. 부작용 관점에서 가장 주목할 사항은 두 가지다. 첫째, SSE 연결 URL 에 Bearer 토큰이 query string 으로 포함되어 서버 로그에 토큰이 노출될 수 있다(WARNING). 둘째, `package.json` 의 `prepare` 스크립트가 `npm install` 시 `tsc` 빌드를 자동 실행해 CI 환경에서 예상치 못한 빌드 실패를 유발할 수 있다(INFO). SSE reader 의 명시적 cleanup 누락도 리소스 누수의 잠재 원인이다(WARNING). 전역 변수 도입, 파일시스템 부작용(의도치 않은 쓰기), 기존 함수 시그니처 파괴적 변경, 기존 공개 API 제거는 이번 변경에서 발견되지 않았다. 신규 파일만 추가되었고, 기존 `triggers.ts` 에 대한 변경은 `as const` 타입 추론 범위 내에서 additive 하게 이루어졌다.

## 위험도

LOW

STATUS=success
