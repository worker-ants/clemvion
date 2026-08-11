# 신규 식별자 충돌 검토 — spec/7-channel-web-chat (impl-done)

검토 대상 diff: `codebase/channel-web-chat/src/{lib,widget}/*.ts` (eia-client, session-store,
use-token-refresh, use-widget 및 각 테스트). 신규 도입 식별자: `refresh_deferred`
(`SeedOutcome` 갈래), `redactToken`·`isTerminalAuthError`·`sseErrorDetail`·`applyRefreshedToken`·
`retryDelayMs`(헬퍼), `TOKEN_REFRESH_RETRY_BASE_MS`·`TOKEN_REFRESH_RETRY_MAX_DELAY_MS`(상수).
`spec/7-channel-web-chat/*.md` 자체는 이번 diff 에 포함되지 않았다(코드만 변경 — 이미 병합된
spec 산문이 기술하는 4-state 흐름의 구현).

전 식별자를 워킹트리 HEAD 전체(`codebase/`, `spec/`, `plan/`)에서 grep 하여 target 밖 기존
사용처와의 충돌 여부를 확인했다.

## 발견사항

- **[INFO]** `redactToken`(신규, `channel-web-chat/src/lib/eia-client.ts:199`) — 기존 backend
  `redact*` 계열과 이름 패턴만 공유
  - target 신규 식별자: `redactToken` (channel-web-chat 전용, 쿼리 `token=` 값만 마스킹)
  - 기존 사용처: `codebase/backend/src/shared/utils/sanitize-error-message.ts` 의
    `redactSecrets`/`deepRedactSecrets`, `codebase/backend/src/shared/conversation-thread/thread-renderer.ts`
    의 `redactThreadForPublic` — backend 전용 모듈에서 이미 "redact 계열" 명명 컨벤션이 확립돼 있음
  - 상세: 완전히 다른 패키지(channel-web-chat 은 독립 배포 SPA, backend 는 NestJS 서버)라 import
    스코프가 겹치지 않고, TS 컴파일 타임 충돌도 없다. 의미도 유사(민감정보 마스킹)해 명명 컨벤션이
    자연스럽게 일치한 경우 — 오히려 바람직한 일관성이다. 실충돌 아님
  - 제안: 조치 불요. 향후 `channel-web-chat` 이 backend 유틸을 공유하게 될 경우에만 재검토

- **[INFO]** `'refresh_deferred'`(신규, `SeedOutcome` 갈래) vs 기존 `'deferred'`(admission outcome)
  — 같은 영어 단어를 다른 bounded context 가 사용
  - target 신규 식별자: `SeedOutcome` 의 리터럴 `"refresh_deferred"`
    (`codebase/channel-web-chat/src/widget/use-widget.ts:111`)
  - 기존 사용처: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2873`
    의 `Promise<'admitted' | 'cancelled' | 'deferred'>` (ws/wf 동시성 cap 초과 시 admission 결과)
  - 상세: 정확한 문자열이 다르고(`refresh_deferred` ≠ `deferred`), 타입도 별도 union 이며, 패키지
    경계(frontend widget vs backend execution engine)도 분리돼 있어 코드 상 충돌 지점이 없다.
    다만 두 값 모두 "결과가 지금 확정되지 않고 나중으로 미뤄진다" 는 동일한 도메인 어휘를 재발명한
    우연의 일치 — 실질 위험은 없음
  - 제안: 조치 불요

- **[INFO]** `TOKEN_REFRESH_RETRY_BASE_MS` 가 `TOKEN_REFRESH_MIN_DELAY_MS` 의 별칭(동일값 재-export)
  - target 신규 식별자: `TOKEN_REFRESH_RETRY_BASE_MS` (`use-token-refresh.ts:13`,
    `= TOKEN_REFRESH_MIN_DELAY_MS`)
  - 기존 사용처: `TOKEN_REFRESH_MIN_DELAY_MS`(`use-token-refresh.ts:11`, 기존 — "예약 지연 최소
    클램프" 용도)
  - 상세: 두 상수가 같은 파일에서 값을 공유하지만 **의도가 다르다** — `MIN_DELAY_MS` 는
    `refreshDelayMs`(정상 스케줄 지연)의 하한, `RETRY_BASE_MS` 는 `retryDelayMs`(실패 후 지수
    백오프)의 base. 값이 우연히 같을 뿐 서로 다른 축이라 이름이 비슷해 보이면 헷갈릴 여지가
    있으나, JSDoc 주석이 각 상수의 용도를 이미 명확히 구분해 두었고(§`use-token-refresh.ts:9-15`),
    실제 충돌(동일 이름·다른 의미)은 아니다
  - 제안: 조치 불요(이미 문서화됨). 다음에 값이 갈라질 경우를 대비해 별칭 관계를 끊고 독립 리터럴로
    분리하는 것도 고려 가능하나 이번 리뷰의 차단 사유는 아님

- **[INFO]** `retryDelayMs` vs 기존 `refreshDelayMs` — 이름 유사도가 높은 자매 함수 쌍
  - target 신규 식별자: `retryDelayMs`(`use-token-refresh.ts:23`, 연속 실패 횟수 → 지수 백오프 지연)
  - 기존 사용처: `refreshDelayMs`(`use-token-refresh.ts:39`, 기존 — `expiresAt` → 다음 정상 갱신
    예약 지연)
  - 상세: 두 함수 모두 "…DelayMs" 로 끝나고 파일·모듈이 같아 호출부만 보면 순간적으로 혼동될 수
    있다(`retryDelayMs(1)` vs `refreshDelayMs(expiresAt, now)` — 시그니처가 달라 실제 오용 가능성은
    낮음). 동일 식별자 충돌은 아니고 명명 유사성에 따른 가독성 이슈 수준
  - 제안: 조치 불요. 필요 시 `retryDelayMs`→`refreshRetryDelayMs` 등으로 더 명시화할 수 있으나
    이번 diff 의 JSDoc(§L88, §L1215)이 이미 관계를 명문화해 실무적 위험은 낮다

- **[INFO]** `isTerminalAuthError`·`sseErrorDetail`·`applyRefreshedToken` — grep 결과 전부
  `channel-web-chat` 내부에서만 정의·사용
  - target 신규 식별자: 위 3개
  - 기존 사용처: 없음(신규 도입 시점부터 정의처와 소비처가 모두 이 diff 안에 있음). backend 에
    이름이 유사한 `waitForTerminalStatus`/`pollNodeExecutionTerminal`/`terminalSuccess` 가 있으나
    별도 패키지·별도 의미(HTTP polling 헬퍼, 테스트 fixture)라 충돌로 볼 근거 없음
  - 상세: 요구사항 ID·API endpoint·env var·spec 파일 경로 어느 축으로도 걸리는 기존 정의가 없음
  - 제안: 조치 불요

## 요약

diff 가 새로 도입하는 6개 식별자(`refresh_deferred`, `redactToken`, `isTerminalAuthError`,
`sseErrorDetail`, `TOKEN_REFRESH_RETRY_BASE_MS`, `TOKEN_REFRESH_RETRY_MAX_DELAY_MS`)와 부수
식별자(`applyRefreshedToken`, `retryDelayMs`)를 워킹트리 전체(`codebase/`, `spec/`, `plan/`)에서
grep 대조한 결과 **동일 이름이 다른 의미로 이미 쓰이고 있는 진짜 충돌(CRITICAL)은 없다**. 새 spec
파일·API endpoint·env var·webhook/SSE 이벤트명도 이번 diff 에 추가되지 않았다(코드 diff 뿐이고
spec 문서 자체는 변경분에 없음). 발견된 것은 전부 "이름이 비슷하거나 도메인 어휘가 겹치지만 실제
스코프·타입·패키지가 분리돼 충돌하지 않는" INFO 수준이며, 그중 다수는 diff 자체의 JSDoc 이 이미
용도를 명문화해 실무 혼동 위험을 낮춰 두었다.

## 위험도

LOW
