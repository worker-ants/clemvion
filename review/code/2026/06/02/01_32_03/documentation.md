# 문서화(Documentation) 리뷰 결과

## 발견사항

### [INFO] PublicWebhookQuotaService 클래스 독스트링 — 설정 키 누락
- 위치: `codebase/backend/src/modules/hooks/public-webhook-quota.service.ts` 클래스 독스트링 상단
- 상세: 클래스 독스트링에 스펙 참조와 fail-open 정책이 잘 기술되어 있다. 그러나 config 키 목록(`publicWebhook.startupPerMinute`, `publicWebhook.hourlyNewMax`)이 static 상수 JSDoc 코멘트에만 분산되어 있고, 클래스 레벨 문서에서 "어떤 config 키들로 조정 가능한가"를 일괄 확인할 수 없다. 운영자가 환경변수 오버라이드를 파악하려면 코드를 상세히 탐색해야 한다.
- 제안: 클래스 독스트링 끝에 `@see config keys: publicWebhook.startupPerMinute, publicWebhook.hourlyNewMax` 또는 간단한 설정 목록을 추가해 한 곳에서 확인 가능하도록 한다.

### [INFO] PublicWebhookThrottleGuard — `maxBodyBytes` config 키 클래스 독스트링 미언급
- 위치: `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` 클래스 독스트링
- 상세: 클래스 독스트링이 rate-limit 동작 흐름을 잘 설명하지만, `publicWebhook.maxBodyBytes` config 키가 `DEFAULT_MAX_BODY_BYTES` 상수 JSDoc 코멘트에만 있고 클래스 독스트링에서는 언급이 없다. `PublicWebhookQuotaService`와 비교해 설정 조정 지점이 분산되어 있다.
- 제안: 클래스 독스트링에 설정 가능 키를 한 줄로 병기하거나, 두 클래스 모두 일관된 패턴을 따르도록 정비한다.

### [INFO] `extractClientIp` 함수 — 중복 코드 경고 주석 추적 불안
- 위치: `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` 파일 하단 `extractClientIp` 함수
- 상세: JSDoc에 "hooks.service.ts 의 동명 헬퍼와 동일 정책. 추후 공용 util 추출 후보."라는 코멘트가 있어 중복 존재를 인지하고 있음을 나타낸다. 이는 적절한 인라인 문서화지만, "추출 후보"로만 남겨두면 두 버전이 점차 달라질 위험이 있다.
- 제안: `// TODO: extract to shared util — see hooks.service.ts` 처럼 TODO 태그를 붙이면 정적 분석이나 grep 검색으로 추적 가능해진다.

### [INFO] `wc:resize` applyResize 메서드 독스트링 — "필수" 이유 미기술
- 위치: `codebase/packages/web-chat-sdk/src/bridge.ts` `applyResize` 메서드 JSDoc
- 상세: JSDoc에 `2-sdk §3 필수`라고만 기재되어 있다. "필수" 레이블이 spec에서 격상된 중요한 계약이지만, 주석만 보고는 필수 이유(iframe이 자체 크기 제어 권한이 없으므로 host가 의무적으로 처리해야 함)를 알 수 없다.
- 제안: `/** wc:resize 적용 — iframe은 자체 크기 제어 불가, host가 반드시 처리해야 함 (2-sdk §3 필수). */` 정도로 한 줄 이유를 추가하면 코드 리더에게 맥락이 명확해진다.

### [INFO] `Unsubscribe` 타입 — 공개 API 표면 노출 여부 미언급
- 위치: `codebase/packages/web-chat-sdk/src/types.ts` `Unsubscribe` 타입 정의
- 상세: JSDoc이 있으나, 이 타입이 공개 API 표면의 일부로 npm 소비자에게 노출되는지 여부(re-export 정책)가 명시되어 있지 않다. `index.ts`에서 `Unsubscribe`가 re-export되지 않는다면 소비자는 `ReturnType<typeof chat.on>` 패턴을 써야 한다.
- 제안: `// 공개 API 표면 — index.ts 에서 re-export 대상` 또는 반대로 내부 타입임을 주석으로 명시한다.

### [INFO] `loader-entry.ts` `resolveGlobalName` — `currentScript` 타이밍 의존성 미문서화
- 위치: `codebase/packages/web-chat-sdk/src/loader-entry.ts` `resolveGlobalName` 함수
- 상세: 함수 위 주석이 적절히 존재한다. 다만 `document.currentScript`가 IIFE 번들 실행 중에만 유효하고 평가 완료 후 null이 됨을 설명하는 문구가 없다. 미묘한 타이밍 의존성이라 미래 수정자가 함수를 다른 시점에 호출하면 의도치 않게 동작할 수 있다.
- 제안: `// document.currentScript 는 <script> 실행 중에만 유효; IIFE 완료 후 null` 한 줄 추가.

### [WARNING] 새로운 config 키들 — 백엔드 운영 설정 문서 미반영
- 위치: `publicWebhook.startupPerMinute`, `publicWebhook.hourlyNewMax`, `publicWebhook.maxBodyBytes` (신규); Redis 연동 설정 경로는 기존이나 새 서비스에서 처음 사용
- 상세: `PublicWebhookQuotaService`와 `PublicWebhookThrottleGuard`가 사용하는 config 키들이 소스 파일 JSDoc 및 static 상수 코멘트에만 기록되어 있다. 백엔드 설정 문서(README, `.env.example`, 또는 운영 가이드)에 이 새 옵션들이 추가되어야 한다. 현재 diff에는 그런 외부 문서 변경이 없다. rate-limit 기본값(분당 10, 시간당 20, body 32KB)과 Redis 연동 없을 때 fail-open 정책도 운영자가 쉽게 확인할 수 있어야 한다.
- 제안: 백엔드 설정 문서에 `publicWebhook.*` 섹션을 추가하거나, `.env.example`이 있다면 관련 키를 주석과 함께 추가한다. Redis 미설정 시 동작(fail-open, 레이트 리밋 비활성화)도 명시적으로 기술한다.

### [INFO] web-chat-sdk README 코드 예제 — `off()` 사용법 미포함
- 위치: `codebase/packages/web-chat-sdk/README.md` `## 사용 (요약)` 섹션
- 상세: README의 요약 예제는 `ClemvionChat.boot`와 `chat.on("message", ...)`만 보여주고, 새로 추가된 `chat.off()`와 `on()` 반환 unsubscribe 패턴을 보여주지 않는다. `off()`는 이번 변경의 핵심 공개 API 추가이며, SPA 언마운트 cleanup 패턴이 주요 사용 목적이다.
- 제안: README 요약 예제에 `const unsubscribe = chat.on("message", (m) => {...}); unsubscribe();` 또는 `chat.off("message")` 패턴을 한 줄 추가한다.

### [INFO] `ClemvionChatMethod` — `off` 추가 주석 없음
- 위치: `codebase/packages/web-chat-sdk/src/types.ts` `ClemvionChatMethod` union 타입
- 상세: `off`가 union에 추가되었으나 어떤 메서드가 어떤 조건에서 사용 가능한지(예: boot 이전에 `off` 호출 시 동작)에 대한 주석이 없다. 다른 메서드들도 동일하게 주석이 없으므로 이 파일 전체의 일관성은 유지된다.
- 제안: 현재 수준에서 수용 가능. 전체 정책 주석이 필요하다면 별도 타입 문서화 작업으로 처리.

## 요약

이번 변경은 문서화 관점에서 전반적으로 양호한 수준이다. 핵심 신규 파일(`PublicWebhookQuotaService`, `PublicWebhookThrottleGuard`)에는 클래스 레벨 독스트링, spec 참조, fail-open 정책 설명, 한도값 상수에 대한 JSDoc이 충실히 작성되어 있다. SDK 측 변경(`on`/`off`/`applyResize`, `installGlobal` 확장, 신규 타입)에도 메서드 레벨 주석이 적절히 추가되었으며, npm scope 확정에 따른 README·예제·package.json 동기화도 누락 없이 이루어졌다. 유일한 WARNING 수준 이슈는 새로 추가된 `publicWebhook.*` config 키들이 소스 파일 외부의 운영 설정 문서에 반영되지 않은 점으로, 운영자가 rate-limit 기본값이나 Redis 연동 옵션을 파악하려면 소스 코드를 직접 탐색해야 한다.

## 위험도

LOW
