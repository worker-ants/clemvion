# 부작용(Side Effect) 리뷰

## 발견사항

### [WARNING] `WidgetBridge.on()` 반환 타입 변경 — 기존 호출자 영향
- 위치: `codebase/packages/web-chat-sdk/src/bridge.ts` WidgetBridge.on(), `codebase/packages/web-chat-sdk/src/types.ts` ChatInstance.on()
- 상세: 기존 `on(event, cb): void` 시그니처가 `on(event, cb): Unsubscribe`로 변경되었다. 반환 타입 확장(void → 함수)이므로 기존 반환값을 무시하던 호출자는 영향 없다. 그러나 타입 시스템 상 `void`를 기대하던 코드가 있으면 TypeScript 컴파일 에러가 발생할 수 있다. `index.ts`는 `bridge.on()` 반환을 그대로 전달하므로 실제 `Unsubscribe` 함수가 전달된다. 현재 파악된 호출처(index.ts, loader.ts, 테스트 파일) 모두 반환값을 사용하거나 무시하는 방식으로 이미 갱신되어 있어 실질적 파손 없음.
- 제안: 패키지가 internal-only(v0.x)이므로 허용 범위 내. 문서에 명시 권장.

### [WARNING] `installGlobal()` 내부 전역 설치 방식 변경 — 전역 상태 변경 패턴
- 위치: `codebase/packages/web-chat-sdk/src/loader.ts` installGlobal()
- 상세: 기존에는 `win.ClemvionChat = api` 로 직접 설정했으나 이제 `w[globalName] = api` (동적 키)로 window 전역을 수정한다. "비-함수 점유 가드"가 새로 추가되어 기존의 silent overwrite 동작이 변경되었다(경고 후 설치 중단). 이전 동작에 의존하던 호스트 페이지가 있다면 행동 변화가 생기지만, silent overwrite는 안전하지 않은 패턴이므로 변경 방향은 올바르다.
- 제안: 이상 없음. 단 "비-함수 전역 점유 시 설치 중단" 동작 변화를 릴리즈 노트에 명시 권장.

### [INFO] `PublicWebhookQuotaService` — Constructor 내 네트워크 리소스 생성
- 위치: `codebase/backend/src/modules/hooks/public-webhook-quota.service.ts` constructor
- 상세: NestJS Injectable 서비스 constructor에서 `new Redis(...)` 를 직접 생성한다. `lazyConnect: true` 옵션으로 즉각 TCP 연결은 발생하지 않지만, Redis 클라이언트 인스턴스가 모듈 초기화 시 생성되며 `error` 이벤트 핸들러가 등록된다. `onModuleDestroy`에서 `quit()`을 호출해 정리하므로 라이프사이클 관리는 적절하다.
- 제안: 이상 없음.

### [INFO] `PublicWebhookThrottleGuard` — 요청마다 DB 조회 부작용
- 위치: `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` canActivate()
- 상세: Guard가 `canActivate`마다 `triggerRepository.findOne()`을 호출한다. 이는 `/api/hooks/:endpointPath`의 모든 요청(공개·인증 모두)에 추가 DB 쿼리를 발생시킨다. `select: { authConfigId: true }` 로 최소 컬럼만 조회하는 것은 적절하다. 단, 고빈도 인증 webhook(GitHub 등)도 이 Guard를 통과하므로 DB 부하가 증가한다.
- 제안: 고빈도 경로에서는 trigger의 `authConfigId` 여부를 짧게 캐싱(예: 30초 in-memory LRU)하면 DB 부하를 줄일 수 있다. 현재 구현은 기능적으로 정확하지만 성능 측면에서 후속 개선 후보.

### [INFO] npm 패키지명 변경(`@clemvion/web-chat` → `@workflow/web-chat`) — 패키지 이름 부작용
- 위치: `codebase/packages/web-chat-sdk/package.json`
- 상세: `package.json`의 `name` 변경은 이 패키지를 `file:` 경로로 의존하는 모든 곳에서 import 경로 변경을 요구한다. 현재 internal-only이며 외부 publish 전이므로 downstream 영향은 monorepo 내부로 한정된다. examples 파일은 이미 갱신됨.
- 제안: `@clemvion/web-chat` import가 남아 있는 파일이 없는지 monorepo 전체 grep 확인 권장.

### [INFO] `ChatInstance` 인터페이스 확장 — 공개 API 추가
- 위치: `codebase/packages/web-chat-sdk/src/types.ts` ChatInstance
- 상세: `off()` 메서드가 공개 인터페이스에 추가되었다. 외부에서 `ChatInstance`를 직접 구현(mock 등)하는 코드가 있다면 컴파일 에러 발생 가능. `index.ts`에서 `off`가 추가됨을 확인했고 테스트 `fakeInstance()`도 갱신되어 정합하다.
- 제안: internal-only 패키지이므로 허용 범위.

### [INFO] `wc:resize` 처리 시 DOM 직접 수정 — iframe 엘리먼트 상태 변경
- 위치: `codebase/packages/web-chat-sdk/src/bridge.ts` applyResize()
- 상세: `iframe.style.width`, `iframe.style.height`, `iframe.dataset.wcState`를 직접 변경한다. 이전에는 `wc:resize` 메시지를 무시했으므로 이 변경으로 iframe이 실제로 리사이즈된다는 런타임 부작용이 새로 생긴다. 호스트 페이지가 CSS로 iframe 크기를 별도 고정한 경우 충돌 가능성이 있으나, 이는 예상된 의도된 동작이다.
- 제안: 이상 없음.

### [INFO] `loader-entry.ts` — `document.currentScript` 접근 타이밍 부작용
- 위치: `codebase/packages/web-chat-sdk/src/loader-entry.ts` resolveGlobalName()
- 상세: `document.currentScript`는 `<script>` 가 동기 실행 중일 때만 유효하며, `async`/`defer` 스크립트에서는 `null`을 반환한다. 현재 코드는 null 시 기본값(`DEFAULT_GLOBAL_NAME`)으로 fallback하므로 안전하다.
- 제안: 이상 없음.

---

## 요약

이번 변경에서 의도치 않은 부작용 위험은 낮다. `WidgetBridge.on()` 반환 타입 확장(void→Unsubscribe)과 `ChatInstance.off()` 추가는 공개 API 시그니처 변경이지만 internal-only v0.x 패키지에서 모든 호출처가 이미 갱신되어 실질적 파손 없음. `installGlobal()`의 비-함수 전역 점유 가드 추가는 기존 silent overwrite를 중단하는 동작 변화이나 의도된 올바른 방향이다. `PublicWebhookThrottleGuard`가 요청마다 trigger DB 조회를 수행하는 추가 부하가 생기며, Redis 클라이언트가 모듈 초기화 시 생성되는 네트워크 리소스 부작용이 있으나 모두 `lazyConnect`·fail-open·`onModuleDestroy` 정리로 적절히 제어된다. 패키지명 변경(`@clemvion/web-chat`→`@workflow/web-chat`)으로 인한 import 경로 파손 가능성은 monorepo 내부로 한정되며 examples는 갱신 완료. 전반적으로 의도치 않은 부작용은 없으며, 성능 관련 후속 개선 후보(Guard per-request DB 캐싱)만 남는다.

---

## 위험도

LOW
